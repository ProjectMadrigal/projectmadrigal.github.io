/**
 * OudeBoeken.js
 * Eenmalig: neemt de beschrijvingen en covers van de boeken over van de oude website
 * (projectmadrigal.be, met een Supabase-databank, zie OudeSite.js).
 *
 *   - Het script zoekt elk boek van de oude website in de Catalogus: eerst op ISBN, anders op
 *     titel en achternaam van de auteur.
 *   - De beschrijving en de cover van de oude website gaan voor op wat het script zelf vond
 *     (Google, Open Library, Wikipedia, bol.com, Internet Archive). Niet op eigen werk:
 *       - een cover met cover_bron "foto in de bib" of "link" (met de hand toegevoegd);
 *       - een beschrijving of cover die iemand aanpaste in het bestuursscherm of het venster
 *         Bewerk dit boek, of een goedgekeurd voorstel van een vrijwilliger (dat staat in het Logboek).
 *   - Stap 1 (menu): de beschrijvingen meteen, de covers komen in de kolom oude_cover.
 *   - Stap 2 (achtergrond, vanzelf): kopieerOudeCovers kopieert die covers naar Google Drive, in porties.
 *     Zo blijven ze werken als de oude website ooit verdwijnt.
 *   - Boeken van de oude website die niet in de Catalogus staan, komen in Na te kijken.
 *   - Een cover die bij drie of meer boeken dezelfde is, is een standaardafbeelding: die nemen we niet.
 *   - Wat van de oude website komt, krijgt de bron "oude website" (cover_bron, beschrijving_bron). De zoektochten
 *     vullen enkel lege velden, en Zoek afgebroken beschrijvingen opnieuw slaat deze boeken over. Wil je toch
 *     dat het script opnieuw zoekt? Maak de cel cover_url of beschrijving leeg.
 */

var OUDE_COVER_BRON = 'oude website';
var OUD_PER_PAGINA = 1000;          // zoveel rijen geeft Supabase hoogstens per vraag
var OUD_STANDAARD_MIN = 3;          // dezelfde cover bij zoveel boeken: een standaardafbeelding
var OUD_MAX_LOOPTIJD_MS = 4 * 60 * 1000; // ruim onder de 6 minuten die Google een taak geeft

/** Een boek van de oude website: { id, isbn, titel, auteur, beschrijving, cover }. basis: adres van de databank. */
function oudBoekUitRij(r, basis) {
  var auteurs = eersteVeld(r, ['authors', 'author', 'auteurs', 'auteur']);
  // Meerdere auteurs met ; ertussen: een komma hoort bij "Achternaam, Voornaam" (zie oudeAchternamen).
  if (Array.isArray(auteurs)) auteurs = auteurs.map(function (a) { return a && typeof a === 'object' ? (a.name || a.naam || '') : a; }).filter(Boolean).join('; ');
  var beeld = schoon(eersteVeld(r, ['image', 'cover', 'cover_url', 'coverUrl', 'uuid']));
  var cover = '';
  if (beeld) cover = /^https?:\/\//.test(beeld) ? beeld.replace(/^http:/, 'https:') : basis + '/storage/v1/object/public/covers/' + beeld.replace(/^covers\//, '').replace(/\.jpe?g$/i, '') + '.jpg';
  var titel = schoon(eersteVeld(r, ['title', 'titel', 'name']));
  var ondertitel = schoon(eersteVeld(r, ['subtitle', 'ondertitel']));
  return {
    id: String(eersteVeld(r, ['id', 'uuid'])),
    // isbn13 eerst, anders isbn10 (dat wordt een ISBN-13).
    isbn: normaliseerIsbn(eersteVeld(r, ['isbn', 'isbn13', 'isbn10', 'ean'])).isbn,
    // Op de oude website verborgen (hidden): vaak een boek dat er niet meer is.
    verborgen: r.hidden === true || jaNee(r.hidden) === 'ja',
    titel: titel, ondertitel: ondertitel, auteur: schoon(auteurs),
    beschrijving: htmlNaarTekst(eersteVeld(r, ['description', 'beschrijving', 'summary', 'content'])),
    cover: cover
  };
}

/** Covers die bij OUD_STANDAARD_MIN of meer boeken dezelfde zijn: standaardafbeeldingen. Geeft { link: true }. */
function oudeStandaardCovers(oudeBoeken) {
  var tel = {}, uit = {};
  oudeBoeken.forEach(function (b) { if (b.cover) tel[b.cover] = (tel[b.cover] || 0) + 1; });
  Object.keys(tel).forEach(function (k) { if (tel[k] >= OUD_STANDAARD_MIN) uit[k] = true; });
  return uit;
}

/**
 * Welke boeken eigen werk hebben, uit het Logboek: { beschrijving: { boek_id: true }, cover: { ... } }.
 * logRijen: [tijdstip, wie, actie, details].
 */
function eigenWerkUitLogboek(logRijen) {
  var eigen = { beschrijving: {}, cover: {} };
  (logRijen || []).forEach(function (r) {
    var actie = String(r[2] || ''), details = String(r[3] || '');
    var m = details.match(/^([A-Za-z]\d{3,})\s*:\s*(.*)$/);
    if (actie === 'boek aangepast' && m) {
      if (/\bbeschrijving\b/.test(m[2])) eigen.beschrijving[m[1]] = true;
      if (/\bcover_url\b/.test(m[2])) eigen.cover[m[1]] = true;
    }
    var v = details.match(/boek ([A-Za-z]\d{3,})/);
    if (actie === 'voorstel goedgekeurd' && v) eigen.beschrijving[v[1]] = true;
    if ((actie === 'cover-foto' || actie === 'cover-link') && /^[A-Za-z]\d{3,}$/.test(details.trim())) eigen.cover[details.trim()] = true;
  });
  return eigen;
}

/**
 * De achternamen van alle auteurs: "Verzonnen, Vera; Noor Bedacht" geeft ["verzonnen", "bedacht"].
 * Auteurs scheiden we met ; & / en "en" of "and". Een komma hoort bij "Achternaam, Voornaam".
 */
function oudeAchternamen(auteur) {
  return schoon(auteur).split(/;|&|\/| en | and /).map(function (deel) { return achternaam(deel); }).filter(Boolean);
}

// Woorden in een naam die niets zeggen over wie het is.
var NAAM_STOPWOORDEN = ['van', 'der', 'den', 'het', 'von', 'and', 'een', 'etc', 'the', 'les', 'des', 'del', 'della', 'ter', 'ten'];

/** Alle woorden van de auteurs (vanaf 3 letters): "Lesbos, Sappho van" geeft ["lesbos", "sappho"]. */
function auteurWoorden(auteur) {
  return normaliseerTekst(auteur).split(' ').filter(function (w) { return w.length >= 3 && NAAM_STOPWOORDEN.indexOf(w) === -1 && !/^\d+$/.test(w); });
}

/** Zelfde naam, of een tikfout in een lange naam (Hemmerechts en Hammerechts). */
function oudZelfdeNaam(x, y) {
  return x === y || (x.length >= 6 && y.length >= 6 && gelijkenis(x, y) >= 0.85);
}

/**
 * Delen twee auteurs een naam? De achternaam van de ene moet een van de namen van de andere zijn:
 * zo telt "Sappho" en "Lesbos, Sappho van", en "Chagoll Lydia" en "Chagoll, Lydia", maar niet
 * twee verschillende mensen met dezelfde voornaam.
 */
function auteursDelen(a, b) {
  var wa = auteurWoorden(a), wb = auteurWoorden(b);
  var past = function (namen, woorden) { return namen.some(function (n) { return woorden.some(function (w) { return oudZelfdeNaam(n, w); }); }); };
  if (past(oudeAchternamen(a), wb) || past(oudeAchternamen(b), wa)) return true;
  // Aan elkaar geschreven: "Jane DeLynn" en "Lynn, Jane De" (alle letters van de naam, in alfabetische volgorde).
  var letters = function (x) { return normaliseerTekst(x).replace(/ /g, '').split('').sort().join(''); };
  return !!normaliseerTekst(a) && !/[;&\/]/.test(a + b) && letters(a).length >= 8 && letters(a) === letters(b);
}

/** De titel om te vergelijken: zonder ondertitel (na ":" of " - "), zonder haakjes, lidwoorden en "en", "and" of "&". */
function oudTitelKern(titel) {
  var k = titelSleutel(String(titel || '').split(/\s[-–—]\s/)[0]);
  var zonder = k.split(' ').filter(function (w) { return ['en', 'and', 'und', 'et'].indexOf(w) === -1; }).join(' ');
  return zonder || k;
}

// Woorden die niets zeggen over welk boek het is (naast de lidwoorden).
var TITEL_STOPWOORDEN = ['van', 'and', 'en', 'of', 'in', 'op', 'the', 'een', 'novel', 'roman', 'met', 'for', 'voor'];

/** De woorden van de volledige titel, zonder lidwoorden, nummers en de naam van de auteur ("Flo #7 EGO" geeft "flo ego"). */
function oudTitelWoorden(titel, auteur) {
  var namen = auteurWoorden(auteur);
  return woorden(titel).filter(function (w) { return !/^\d+$/.test(w) && namen.indexOf(w) === -1; });
}

/**
 * Hoe gelijk zijn twee titels, van 0 tot 1. De hoogste van:
 *   - de kern (zonder ondertitel), en de volledige titel zonder nummers en auteursnaam;
 *   - dezelfde, zonder spaties ("killer condom" en "killerkondoom");
 *   - 0,9 als alle betekenisvolle woorden van de kortste titel in de langste staan (minstens twee):
 *     "House Rules" en "House of Rules", "Critical Reception of James Baldwin, 1963-2010" en "The Critical Reception of James Baldwin";
 *   - 0,82 als ze minstens twee woorden van 5 letters of meer delen ("Autobiography of Alice B. Toklas" en "De autobriografie van Alice B. Toklas").
 */
var GETALWOORDEN = { een: 1, one: 1, eins: 1, twee: 2, two: 2, drie: 3, three: 3, vier: 4, four: 4, vijf: 5, five: 5, zes: 6, six: 6, zeven: 7, seven: 7, acht: 8, eight: 8, negen: 9, nine: 9, tien: 10, ten: 10 };

/** Het deel van een reeks: "Volume One", "#1", "deel 2", "Heartstopper 1". Geeft een getal of 0. */
function oudVolgnummer(titel) {
  var t = normaliseerTekst(String(titel || '').replace(/#\s*(\d+)/g, ' nummer $1 '));
  var m = t.match(/\b(?:volume|vol|deel|tome|band|book|boek|nummer|part)\s+(\d+|[a-z]+)\b/);
  if (m && (/^\d+$/.test(m[1]) || GETALWOORDEN[m[1]])) return /^\d+$/.test(m[1]) ? Number(m[1]) : GETALWOORDEN[m[1]];
  m = t.match(/\s(\d{1,2})$/); // "Heartstopper 1", niet een jaartal
  return m ? Number(m[1]) : 0;
}

function oudTitelGelijk(oud, c) {
  // Twee verschillende delen van een reeks zijn twee boeken. Hetzelfde deel telt als (bijna) gelijk.
  var na = oudVolgnummer(oud.titel), nb = oudVolgnummer(c.titel);
  var basis = oudTitelGelijkZonderNummer(oud, c);
  if (na && nb) return na === nb ? Math.max(basis, oudTitelKern(oud.titel).split(' ')[0] === oudTitelKern(c.titel).split(' ')[0] ? 0.92 : 0) : Math.min(basis, 0.5);
  return basis;
}

function oudTitelGelijkZonderNummer(oud, c) {
  var ka = oudTitelKern(oud.titel), kb = oudTitelKern(c.titel);
  var wa = oudTitelWoorden(oud.titel, oud.auteur), wb = oudTitelWoorden(c.titel, c.auteur);
  var va = wa.join(' '), vb = wb.join(' ');
  var score = Math.max(gelijkenis(ka, kb), va && vb ? gelijkenis(va, vb) : 0,
    gelijkenis(ka.replace(/ /g, ''), kb.replace(/ /g, '')), va && vb ? gelijkenis(va.replace(/ /g, ''), vb.replace(/ /g, '')) : 0);
  var zin = function (lijst) { return lijst.filter(function (w) { return w.length >= 3 && TITEL_STOPWOORDEN.indexOf(w) === -1; }); };
  var za = zin(wa), zb = zin(wb);
  // Ook met enkel de kern (zonder ondertitel): "Out of Control - Bi-sexual Erotica" en "Out of Control The Zone 2".
  var kza = zin(ka.split(' ')), kzb = zin(kb.split(' '));
  var bevat = function (x, y) {
    var kort = x.length <= y.length ? x : y, lang = x.length <= y.length ? y : x;
    return kort.length >= 2 && kort.every(function (w) { return lang.indexOf(w) > -1; });
  };
  if (bevat(za, zb) || bevat(kza, zb) || bevat(za, kzb) || bevat(kza, kzb)) score = Math.max(score, 0.9);
  var gedeeld = za.filter(function (w) { return w.length >= 5 && zb.indexOf(w) > -1; });
  if (gedeeld.length >= 2) score = Math.max(score, 0.82);
  return score;
}

/** Zoekt een boek van de oude website in de Catalogus. index: van oudIndex. */
function oudIndex(catalogus) {
  var isbn = {}, titel = {}, kern = {}, perWoord = {}, alle = [];
  catalogus.forEach(function (c) {
    if (isLeeg(c.boek_id) || isFilm(c)) return;
    [c.isbn, c.isbn_origineel].forEach(function (w) {
      var i = normaliseerIsbn(w).isbn;
      if (i && !isbn[i]) isbn[i] = c;
    });
    var t = normaliseerTekst(c.titel), k = oudTitelKern(c.titel);
    if (!t) return;
    alle.push(c);
    (titel[t] = titel[t] || []).push(c);
    if (k) (kern[k] = kern[k] || []).push(c);
    auteurWoorden(c.auteur).forEach(function (w) { if ((perWoord[w] = perWoord[w] || []).indexOf(c) === -1) perWoord[w].push(c); });
  });
  return { isbn: isbn, titel: titel, kern: kern, perWoord: perWoord, alle: alle };
}

/**
 * Ronde 1: zoekt het boek in de Catalogus, van zeker naar minder zeker. Geeft { boek, hoe } of null.
 *   isbn:   zelfde ISBN (ook isbn_origineel);
 *   titel:  zelfde titel en een gemeenschappelijke auteur (ook "Sappho" en "Lesbos, Sappho van");
 *   kern:   zelfde titel zonder ondertitel, lidwoorden en "en/and/&", en een gemeenschappelijke auteur;
 *   bijna:  een gemeenschappelijke auteur en een gelijkende titel (zie oudTitelGelijk), duidelijk de beste;
 *   titel zonder auteur: geen auteur op de oude website, en de titel staat maar één keer in de Catalogus.
 */
function zoekOudBoek(oud, index, bezet) {
  bezet = bezet || {};
  if (oud.isbn && index.isbn[oud.isbn]) return { boek: index.isbn[oud.isbn], hoe: 'isbn' };
  var deeltAuteur = function (c) { return auteursDelen(oud.auteur, c.auteur); };
  var t = normaliseerTekst(oud.titel), k = oudTitelKern(oud.titel);
  var titels = [t];
  if (oud.ondertitel) titels.push(normaliseerTekst(oud.titel + ' ' + oud.ondertitel));
  for (var i = 0; i < titels.length; i++) {
    var zelfde = (index.titel[titels[i]] || []).filter(deeltAuteur);
    if (zelfde.length) return { boek: zelfde[0], hoe: 'titel' };
  }
  var kernZelfde = k ? (index.kern[k] || []).filter(deeltAuteur) : [];
  if (kernZelfde.length) return { boek: kernZelfde[0], hoe: 'kern' };
  // Bijna dezelfde titel bij dezelfde auteur. Twee verschillende boeken van die auteur even gelijk: dan niet raden.
  // Staat hetzelfde boek twee keer in de Catalogus (zelfde titel), dan is dat geen twijfel: we nemen het eerste vrije.
  var scores = oudKandidatenPerAuteur(oud, index).map(function (c) { return { c: c, g: oudTitelGelijk(oud, c) }; })
    .sort(function (x, y) { return y.g - x.g; });
  if (scores.length && scores[0].g >= 0.8) {
    var kernBest = oudTitelKern(scores[0].c.titel);
    var zelfdeBoek = scores.filter(function (x) { return oudTitelKern(x.c.titel) === kernBest; });
    var ander = scores.filter(function (x) { return oudTitelKern(x.c.titel) !== kernBest; })[0];
    if (!ander || scores[0].g - ander.g >= 0.05) {
      var vrij = zelfdeBoek.filter(function (x) { return !bezet[String(x.c.boek_id)]; })[0] || zelfdeBoek[0];
      return { boek: vrij.c, hoe: 'bijna' };
    }
  }
  // Geen auteur op de oude website: zelfde titel, als die maar één keer in de Catalogus staat.
  if (!auteurWoorden(oud.auteur).length && k && (index.kern[k] || []).length === 1) return { boek: index.kern[k][0], hoe: 'titel zonder auteur' };
  return null;
}

/** De boeken in de Catalogus die een auteur delen met dit oude boek. */
function oudKandidatenPerAuteur(oud, index) {
  var uit = [];
  auteurWoorden(oud.auteur).forEach(function (w) {
    Object.keys(index.perWoord).forEach(function (x) {
      if (!oudZelfdeNaam(w, x)) return;
      index.perWoord[x].forEach(function (c) { if (uit.indexOf(c) === -1 && auteursDelen(oud.auteur, c.auteur)) uit.push(c); });
    });
  });
  return uit;
}

/**
 * Ronde 2, enkel voor wat ronde 1 niet vond, en enkel bij boeken in de Catalogus die nog vrij zijn
 * (bezet: { boek_id: true }). Telkens moet het antwoord uniek zijn, anders laten we het voor Na te kijken.
 *   titel uniek:  zelfde titel (kern), en die titel staat maar één keer bij de vrije boeken én bij de
 *                 overgebleven oude boeken. Ook als de auteur anders is (bv. de uitgever stond als auteur).
 *   titel bijna:  één enkel vrij boek met een gelijkende titel (oudTitelGelijk vanaf 0,85), minstens 10 letters.
 *   auteur uniek: dezelfde auteur heeft maar één vrij boek in de Catalogus en maar één overgebleven oud boek
 *                 (bv. een vertaling: "Nightwood" en "Nachtwoud" van Djuna Barnes).
 * rest: de oude boeken die na ronde 1 overblijven (om te tellen).
 */
function zoekOudBoekRuim(oud, index, bezet, rest) {
  var vrij = function (c) { return !bezet[String(c.boek_id)]; };
  // Een boek dat twee keer op de oude website stond (zelfde titel en auteur), telt als één.
  var sleutel = function (o) { return oudTitelKern(o.titel) + '|' + normaliseerTekst(o.auteur); };
  var uniek = function (lijst) { var gezien = {}; return lijst.filter(function (o) { var x = sleutel(o); return gezien[x] ? false : (gezien[x] = true); }); };
  var k = oudTitelKern(oud.titel);
  if (k && k.length >= 8) {
    var zelfde = (index.kern[k] || []).filter(vrij);
    var oudZelfde = uniek(rest.filter(function (o) { return oudTitelKern(o.titel) === k; }));
    if (zelfde.length === 1 && oudZelfde.length === 1) return { boek: zelfde[0], hoe: 'titel uniek' };
  }
  if (k && k.length >= 10) {
    var bijna = index.alle.filter(function (c) { return vrij(c) && oudTitelGelijk(oud, c) >= 0.85; });
    if (bijna.length === 1) return { boek: bijna[0], hoe: 'titel bijna' };
  }
  // Dezelfde auteur (meestal een vertaling: "Nightwood" en "Nachtwoud", "Mädchen in Uniform" en "Meisjes in uniform").
  var vanAuteur = oudKandidatenPerAuteur(oud, index).filter(vrij);
  var oudVanAuteur = uniek(rest.filter(function (o) { return auteursDelen(o.auteur, oud.auteur); }));
  if (vanAuteur.length === 1) {
    // Eén vrij boek van die auteur: het gaat naar het oude boek met de meest gelijkende titel, als dat duidelijk is.
    var rang = oudVanAuteur.map(function (o) { return { o: o, g: oudTitelGelijk(o, vanAuteur[0]) }; }).sort(function (x, y) { return y.g - x.g; });
    if (rang.length && sleutel(rang[0].o) === sleutel(oud) && (rang.length === 1 || rang[0].g - rang[1].g >= 0.1)) return { boek: vanAuteur[0], hoe: 'auteur uniek' };
  } else if (vanAuteur.length > 1 && oudVanAuteur.length === 1) {
    // Eén oud boek van die auteur, meerdere vrije: enkel als één titel duidelijk het meest lijkt.
    var keuze = vanAuteur.map(function (c) { return { c: c, g: oudTitelGelijk(oud, c) }; }).sort(function (x, y) { return y.g - x.g; });
    if (keuze[0].g >= 0.6 && keuze[0].g - keuze[1].g >= 0.15) return { boek: keuze[0].c, hoe: 'auteur uniek' };
  }
  return null;
}

/** Voor Na te kijken: het boek in de Catalogus met de meest gelijkende titel (vanaf 60%), of null. */
function oudVoorstel(oud, catalogus) {
  var k = oudTitelKern(oud.titel), best = null, score = 0;
  if (!k) return null;
  catalogus.forEach(function (c) {
    if (isLeeg(c.boek_id) || isFilm(c)) return;
    var g = gelijkenis(k, oudTitelKern(c.titel));
    if (g > score) { score = g; best = c; }
  });
  return score >= 0.6 ? best : null;
}

/** Een cover die iemand met de hand toevoegde? */
function isEigenCover(boek, eigen) {
  var bron = schoon(boek.cover_bron);
  return bron === 'foto in de bib' || bron === 'link' || !!eigen.cover[String(boek.boek_id)];
}

/**
 * Past de Catalogus aan met de boeken van de oude website.
 * Geeft { beschrijvingen, covers, eigen, gelijk, nietGevonden: [oud boek], hoe: { manier: aantal } }.
 */
function oudeBoekenToepassen(catalogus, oudeBoeken, eigen) {
  var index = oudIndex(catalogus);
  var standaard = oudeStandaardCovers(oudeBoeken);
  var uit = { beschrijvingen: 0, covers: 0, eigen: 0, gelijk: 0, dubbel: 0, verborgen: 0, nietGevonden: [], hoe: {}, gekoppeld: {} };
  var gezien = {};
  // Ronde 1: de zekere manieren. Ronde 2: ruimer, enkel voor wat overblijft en enkel als het uniek is.
  var paren = [], rest = [];
  oudeBoeken.forEach(function (oud) {
    var g = zoekOudBoek(oud, index, gezien);
    if (g && !gezien[String(g.boek.boek_id)]) { gezien[String(g.boek.boek_id)] = true; paren.push([oud, g]); }
    else if (g) uit.dubbel++;
    else rest.push(oud);
  });
  var zelfdeOud = function (a, b) { return oudTitelKern(a.titel) === oudTitelKern(b.titel) && normaliseerTekst(a.auteur) === normaliseerTekst(b.auteur); };
  rest.slice().forEach(function (oud) {
    if (rest.indexOf(oud) === -1) return;
    var g = zoekOudBoekRuim(oud, index, gezien, rest);
    if (!g) return;
    gezien[String(g.boek.boek_id)] = true;
    paren.push([oud, g]);
    // Stond het boek twee keer op de oude website, dan is het tweede exemplaar ook gevonden.
    rest = rest.filter(function (o) { return !zelfdeOud(o, oud); });
  });
  // Wat overblijft en sterk lijkt op een boek dat al gekoppeld is (zelfde auteur, of geen auteur), is een tweede
  // exemplaar of uitgave op de oude website: dat boek staat al in de Catalogus en hoeft niet in Na te kijken.
  rest = rest.filter(function (oud) {
    var zonderAuteur = !auteurWoorden(oud.auteur).length;
    var al = index.alle.some(function (c) {
      return gezien[String(c.boek_id)] && (zonderAuteur || auteursDelen(oud.auteur, c.auteur)) && oudTitelGelijk(oud, c) >= 0.9;
    });
    if (al) uit.dubbel++;
    return !al;
  });
  // Verborgen op de oude website en niet gevonden: niet in Na te kijken (de melding telt ze).
  rest = rest.filter(function (oud) { if (oud.verborgen) uit.verborgen++; return !oud.verborgen; });
  uit.nietGevonden = rest;
  paren.forEach(function (paar) {
    var oud = paar[0], gevonden = paar[1];
    uit.hoe[gevonden.hoe] = (uit.hoe[gevonden.hoe] || 0) + 1;
    var boek = gevonden.boek;
    var id = String(boek.boek_id);
    uit.gekoppeld[id] = oud.titel; // voor Na te kijken: aan welk oud boek dit boek al hangt
    var velden = {};
    if (oud.beschrijving) {
      if (eigen.beschrijving[id]) uit.eigen++;
      // Vergelijken zoals het in de Catalogus komt (opgekuist en ingekort): anders lijkt een lange tekst elke keer nieuw.
      else if (normaliseerTekst(maakBeschrijvingNetjes(oud.beschrijving)) === normaliseerTekst(boek.beschrijving)) uit.gelijk++;
      else {
        // Een nieuwe Nederlandse tekst: ook de Engelse vertaling opnieuw laten maken.
        velden.beschrijving = maakBeschrijvingNetjes(oud.beschrijving);
        // De bron "oude website": geen enkele zoektocht (Google, Wikipedia, ...) overschrijft deze tekst nog.
        velden.beschrijving_bron = OUDE_COVER_BRON;
        velden.beschrijving_en = '';
        velden.beschrijving_vertaald = '';
        uit.beschrijvingen++;
      }
    }
    if (oud.cover && !standaard[oud.cover] && schoon(boek.cover_bron) !== OUDE_COVER_BRON) {
      if (isEigenCover(boek, eigen)) uit.eigen++;
      else { velden.oude_cover = oud.cover; uit.covers++; }
    }
    if (Object.keys(velden).length) wijzig(boek, velden);
  });
  return uit;
}

/**
 * Een rij voor Na te kijken: het oude boek, met het meest gelijkende boek uit de Catalogus als voorstel.
 * Hangt dat boek al aan een ander oud boek, dan staat dat erbij. [oud …] is de code van de oude website.
 */
function oudNaTeKijkenRij(b, catalogus, gekoppeld) {
  var voorstel = oudVoorstel(b, catalogus);
  var al = voorstel && gekoppeld[String(voorstel.boek_id)];
  return {
    boek_id: voorstel ? String(voorstel.boek_id) : '', titel: b.titel + (b.ondertitel ? ': ' + b.ondertitel : ''), veld: 'boek van de oude website',
    waarde_catalogus: voorstel ? 'misschien: ' + schoon(voorstel.titel) + (voorstel.auteur ? ' (' + schoon(voorstel.auteur) + ')' : '') +
      (al ? '. Al gekoppeld aan "' + al + '" van de oude website: een tweede uitgave?' : '') : 'niet gevonden',
    waarde_bron: [b.auteur, b.isbn ? 'ISBN ' + b.isbn : ''].filter(Boolean).join(', ') + ' [oud ' + b.id + ']',
    opmerking: [b.cover ? 'Cover: ' + b.cover : '', b.beschrijving.slice(0, 400)].filter(Boolean).join('\n')
  };
}

/**
 * Neemt de rijen van Na te kijken over waar overnemen = ja: de beschrijving en cover van het oude boek
 * gaan naar het boek in de kolom boek_id (dat mag je zelf aanpassen). Jouw keuze gaat voor, ook op eigen werk.
 * oudPerId: { code van de oude website: oud boek }. Geeft { gedaan, covers, fouten: [tekst] }.
 */
function oudeAangeduideOvernemen(catalogus, naRijen, oudPerId) {
  var perId = {};
  catalogus.forEach(function (c) { if (!isLeeg(c.boek_id)) perId[String(c.boek_id).trim()] = c; });
  var uit = { gedaan: 0, covers: 0, fouten: [] };
  naRijen.forEach(function (r) {
    if (schoon(r.bron) !== 'oude website' || jaNee(r.overnemen) !== 'ja' || jaNee(r.afgehandeld) === 'ja') return;
    var code = (String(r.waarde_bron || '').match(/\[oud ([^\]]+)\]/) || [])[1];
    var boek = perId[String(r.boek_id || '').trim()];
    var oud = code ? oudPerId[code] : null;
    if (!boek) { uit.fouten.push('"' + schoon(r.titel) + '": boek-ID ' + (schoon(r.boek_id) || '(leeg)') + ' staat niet in de Catalogus.'); return; }
    if (!oud) { uit.fouten.push('"' + schoon(r.titel) + '": kies eerst nog eens Neem beschrijvingen en covers over, dan krijgt deze rij een code van de oude website.'); return; }
    var velden = {};
    if (oud.beschrijving) {
      velden.beschrijving = maakBeschrijvingNetjes(oud.beschrijving);
      velden.beschrijving_bron = OUDE_COVER_BRON;
      velden.beschrijving_en = '';
      velden.beschrijving_vertaald = '';
    }
    if (oud.cover) { velden.oude_cover = oud.cover; uit.covers++; }
    wijzig(boek, velden);
    wijzig(r, { afgehandeld: 'ja', overnemen: 'gedaan' });
    uit.gedaan++;
  });
  return uit;
}

/** Moet de cover van dit boek nog gekopieerd worden van de oude website? */
function heeftOudeCoverNodig(boek) {
  return !isLeeg(boek.oude_cover);
}

/* ---------- In Apps Script ---------- */

/** Alle boeken van de oude databank, per 1000. Probeert eerst de tabel books, dan de publieke views. */
function haalOudeBoeken(db) {
  var pogingen = [['books', '*,authors(name)'], ['books', '*'], ['books_public_view_2', '*'], ['books_public_view', '*']];
  for (var p = 0; p < pogingen.length; p++) {
    var alles = [], fout = false;
    for (var van = 0; ; van += OUD_PER_PAGINA) {
      var a = UrlFetchApp.fetch(db.url + '/rest/v1/' + pogingen[p][0] + '?select=' + encodeURIComponent(pogingen[p][1]) + '&order=id&limit=' + OUD_PER_PAGINA + '&offset=' + van, {
        muteHttpExceptions: true, headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
      });
      if (a.getResponseCode() !== 200) { fout = true; break; }
      var deel = [];
      try { deel = JSON.parse(a.getContentText()) || []; } catch (e) { fout = true; break; }
      alles = alles.concat(deel);
      if (deel.length < OUD_PER_PAGINA) break;
    }
    if (!fout && alles.length) return { bron: pogingen[p][0], rijen: alles };
  }
  return { bron: '', rijen: [] };
}

/** Menu: stap 1. Neemt de beschrijvingen over en zet de covers klaar om te kopiëren. */
function neemOudeBoekenOver() {
  installeer(); // zorgt voor de kolom oude_cover
  var db = vindOudeDatabank();
  var oud = haalOudeBoeken(db);
  if (!oud.rijen.length) { meld('Ik kon de boeken van de oude website niet lezen. Er is niets veranderd.'); return; }
  var oudeBoeken = oud.rijen.map(function (r) { return oudBoekUitRij(r, db.url); }).filter(function (b) { return b.titel; });
  var logblad = spreadsheet().getSheetByName('Logboek');
  var eigen = eigenWerkUitLogboek(logblad && logblad.getLastRow() > 1 ? logblad.getDataRange().getValues().slice(1) : []);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    uit = oudeBoekenToepassen(tabel.rijen, oudeBoeken, eigen);
    bewaarTabel(tabel);
    // Opnieuw uitvoeren: de vorige lijst van de oude website (nog niet afgehandeld) maakt plaats voor de nieuwe.
    var naTeKijken = leesTabel('Na te kijken');
    // Rijen die je al op overnemen = ja zette, blijven staan.
    naTeKijken.rijen.forEach(function (r) { if (schoon(r.bron) === 'oude website' && jaNee(r.afgehandeld) !== 'ja' && jaNee(r.overnemen) !== 'ja') r._verwijderen = true; });
    bewaarTabel(naTeKijken);
    naTeKijken = leesTabel('Na te kijken');
    var bewaard = {};
    naTeKijken.rijen.forEach(function (r) { var m = String(r.waarde_bron || '').match(/\[oud ([^\]]+)\]/); if (m && schoon(r.bron) === 'oude website') bewaard[m[1]] = true; });
    voegNaTeKijkenToe(naTeKijken.rijen, uit.nietGevonden.filter(function (b) { return !bewaard[b.id]; }).map(function (b) {
      return oudNaTeKijkenRij(b, tabel.rijen, uit.gekoppeld);
    }), 'oude website', vandaagTekst());
    bewaarTabel(naTeKijken);
    naTeKijkenNieuwsteBoven();
  } finally {
    lock.releaseLock();
  }
  leegCache();
  if (uit.covers) planTaak('kopieerOudeCovers', 60 * 1000);
  var velden = Object.keys(oud.rijen[0] || {}).join(', ');
  var hoe = Object.keys(uit.hoe).map(function (k) { return uit.hoe[k] + ' op ' + k; }).join(', ');
  var tekst = oudeBoeken.length + ' boeken gelezen op de oude website. Gevonden: ' + hoe + '. ' + uit.beschrijvingen + ' beschrijvingen overgenomen, ' +
    uit.covers + ' covers klaargezet (die kopieert het script nu op de achtergrond naar Drive), ' + uit.eigen + ' keer eigen werk behouden, ' +
    uit.dubbel + ' keer een tweede exemplaar of uitgave van een boek dat al gekoppeld is, ' +
    uit.verborgen + ' boeken die op de oude website verborgen waren en niet in de Catalogus staan (niet in Na te kijken), ' +
    uit.nietGevonden.length + ' boeken niet gevonden in de Catalogus (zie Na te kijken).';
  logboek('menu', 'neemOudeBoekenOver', tekst + ' Bron: ' + oud.bron + ' (' + velden + ')');
  meld(tekst);
}

/** Menu: neemt de rijen van Na te kijken over met overnemen = ja (zie oudeAangeduideOvernemen). */
function neemAangeduideOudeBoekenOver() {
  installeer(); // zorgt voor de kolom overnemen
  var db = vindOudeDatabank();
  var oud = haalOudeBoeken(db);
  if (!oud.rijen.length) { meld('Ik kon de boeken van de oude website niet lezen. Er is niets veranderd.'); return; }
  var perId = {};
  oud.rijen.forEach(function (r) { var b = oudBoekUitRij(r, db.url); perId[b.id] = b; });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    uit = oudeAangeduideOvernemen(tabel.rijen, naTeKijken.rijen, perId);
    bewaarTabel(tabel);
    bewaarTabel(naTeKijken);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  if (uit.covers) planTaak('kopieerOudeCovers', 60 * 1000);
  var tekst = uit.gedaan + ' boeken overgenomen uit Na te kijken (' + uit.covers + ' covers komen op de achtergrond).' +
    (uit.fouten.length ? ' Niet gelukt: ' + uit.fouten.join(' ') : '');
  logboek('menu', 'neemAangeduideOudeBoekenOver', tekst);
  meld(tekst);
}

/** Menu: het kopiëren start op de achtergrond, zodat de spreadsheet niet minutenlang bezig is in jouw venster. */
function startOudeCovers() {
  planTaak('kopieerOudeCovers', 60 * 1000);
  meld('Het kopiëren van de covers start binnen een minuut op de achtergrond en gaat vanzelf verder tot alles klaar is. Je kan gewoon verder werken. In het Logboek zie je elke ronde.');
}

/** Achtergrond: stap 2. Kopieert de covers van de oude website naar Drive, in porties. */
function kopieerOudeCovers() {
  var start = Date.now();
  if (wachtOpDaglimiet('kopieerOudeCovers')) return;
  if (!startAchtergrond('kopieerOudeCovers')) {
    // Een vorige ronde loopt nog (of stopte zonder op te ruimen): later opnieuw proberen in plaats van stil te stoppen.
    planTaak('kopieerOudeCovers', 10 * 60 * 1000);
    meldAlBezig('kopieerOudeCovers');
    return;
  }
  // Vangnet: stopt Google deze ronde onderweg (te lang bezig, of een fout van Drive), dan start ze vanzelf opnieuw.
  planTaak('kopieerOudeCovers', 10 * 60 * 1000);
  var gekopieerd = 0, zonder = 0, rest = 0, storing = false, fout = '', daglimiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    var teDoen = tabel.rijen.filter(heeftOudeCoverNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > OUD_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var a = haalCoverLink(String(boek.oude_cover)); // zie Beheer.js
      if (a.code === 429 || a.code >= 500 || a.code === 0) { storing = true; break; }
      if (a.code === 200 && a.data) {
        var link;
        try {
          link = bewaarFotoInDrive('oud-' + boek.boek_id + '.jpg', a.data, a.type.split(';')[0] || 'image/jpeg');
        } catch (e) {
          // Google Drive weigert even (bv. te veel bestanden vandaag): bewaren wat al lukte en later verder.
          fout = String(e && e.message || e).slice(0, 200);
          daglimiet = /too many times|te vaak|limit/i.test(fout);
          storing = true;
          break;
        }
        wijzig(boek, { cover_url: link, cover_bron: OUDE_COVER_BRON, oude_cover: '' });
        gekopieerd++;
      } else {
        // Geen afbeelding (bv. 404): de huidige cover blijft.
        wijzig(boek, { oude_cover: '' });
        zonder++;
      }
      if ((gekopieerd + zonder) % 25 === 0) bewaarAchtergrond(tabel);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftOudeCoverNodig).length;
  } finally {
    stopAchtergrond('kopieerOudeCovers');
  }
  verwijderTriggers('kopieerOudeCovers');
  // Daglimiet van Google Drive: over 6 uur. Andere storing: over 15 minuten. Anders: over een minuut.
  if (rest > 0) planTaak('kopieerOudeCovers', (daglimiet ? 6 * 60 : storing ? 15 : 1) * 60 * 1000);
  if (gekopieerd) leegCache();
  logboek('menu', 'kopieerOudeCovers', gekopieerd + ' covers van de oude website gekopieerd, ' + zonder + ' zonder afbeelding, ' + rest + ' te gaan' +
    (daglimiet ? ' (Google Drive: daglimiet, over 6 uur verder)' : storing ? ' (even een storing, over 15 minuten verder)' : '') + (fout ? '. Fout: ' + fout : ''));
}
