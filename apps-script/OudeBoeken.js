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
var OUD_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

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
    isbn: normaliseerIsbn(eersteVeld(r, ['isbn', 'isbn13', 'ean'])).isbn,
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
  return past(oudeAchternamen(a), wb) || past(oudeAchternamen(b), wa);
}

/** De titel om te vergelijken: zonder ondertitel (na ":" of " - "), zonder haakjes, lidwoorden en "en", "and" of "&". */
function oudTitelKern(titel) {
  var k = titelSleutel(String(titel || '').split(/\s[-–—]\s/)[0]);
  var zonder = k.split(' ').filter(function (w) { return ['en', 'and', 'und', 'et'].indexOf(w) === -1; }).join(' ');
  return zonder || k;
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
 *   bijna:  een gemeenschappelijke auteur en een titel die voor 85% gelijk is (tikfouten, spelling).
 */
function zoekOudBoek(oud, index) {
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
  var best = null, score = 0;
  oudKandidatenPerAuteur(oud, index).forEach(function (c) {
    var g = gelijkenis(k, oudTitelKern(c.titel));
    if (g > score) { score = g; best = c; }
  });
  if (best && score >= 0.85) return { boek: best, hoe: 'bijna' };
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
 *   titel bijna:  één enkel vrij boek met een titel die voor 85% gelijk is (tikfout), minstens 10 letters.
 *   auteur uniek: dezelfde auteur heeft maar één vrij boek in de Catalogus en maar één overgebleven oud boek
 *                 (bv. een vertaling: "Nightwood" en "Nachtwoud" van Djuna Barnes).
 * rest: de oude boeken die na ronde 1 overblijven (om te tellen).
 */
function zoekOudBoekRuim(oud, index, bezet, rest) {
  var vrij = function (c) { return !bezet[String(c.boek_id)]; };
  var k = oudTitelKern(oud.titel);
  if (k && k.length >= 8) {
    var zelfde = (index.kern[k] || []).filter(vrij);
    var oudZelfde = rest.filter(function (o) { return oudTitelKern(o.titel) === k; });
    if (zelfde.length === 1 && oudZelfde.length === 1) return { boek: zelfde[0], hoe: 'titel uniek' };
  }
  if (k && k.length >= 10) {
    var bijna = index.alle.filter(function (c) { return vrij(c) && gelijkenis(k, oudTitelKern(c.titel)) >= 0.85; });
    if (bijna.length === 1) return { boek: bijna[0], hoe: 'titel bijna' };
  }
  var vanAuteur = oudKandidatenPerAuteur(oud, index).filter(vrij);
  if (vanAuteur.length === 1) {
    var oudVanAuteur = rest.filter(function (o) { return auteursDelen(o.auteur, oud.auteur); });
    if (oudVanAuteur.length === 1) return { boek: vanAuteur[0], hoe: 'auteur uniek' };
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
  var uit = { beschrijvingen: 0, covers: 0, eigen: 0, gelijk: 0, nietGevonden: [], hoe: {} };
  var gezien = {};
  // Ronde 1: de zekere manieren. Ronde 2: ruimer, enkel voor wat overblijft en enkel als het uniek is.
  var paren = [], rest = [];
  oudeBoeken.forEach(function (oud) {
    var g = zoekOudBoek(oud, index);
    if (g && !gezien[String(g.boek.boek_id)]) { gezien[String(g.boek.boek_id)] = true; paren.push([oud, g]); }
    else if (!g) rest.push(oud);
  });
  rest.slice().forEach(function (oud) {
    var g = zoekOudBoekRuim(oud, index, gezien, rest);
    if (g) { gezien[String(g.boek.boek_id)] = true; paren.push([oud, g]); rest.splice(rest.indexOf(oud), 1); }
  });
  uit.nietGevonden = rest;
  paren.forEach(function (paar) {
    var oud = paar[0], gevonden = paar[1];
    uit.hoe[gevonden.hoe] = (uit.hoe[gevonden.hoe] || 0) + 1;
    var boek = gevonden.boek;
    var id = String(boek.boek_id);
    var velden = {};
    if (oud.beschrijving) {
      if (eigen.beschrijving[id]) uit.eigen++;
      else if (normaliseerTekst(oud.beschrijving) === normaliseerTekst(boek.beschrijving)) uit.gelijk++;
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
    naTeKijken.rijen.forEach(function (r) { if (schoon(r.bron) === 'oude website' && jaNee(r.afgehandeld) !== 'ja') r._verwijderen = true; });
    bewaarTabel(naTeKijken);
    naTeKijken = leesTabel('Na te kijken');
    voegNaTeKijkenToe(naTeKijken.rijen, uit.nietGevonden.map(function (b) {
      var voorstel = oudVoorstel(b, tabel.rijen);
      return {
        boek_id: voorstel ? String(voorstel.boek_id) : '', titel: b.titel + (b.ondertitel ? ': ' + b.ondertitel : ''), veld: 'boek van de oude website',
        waarde_catalogus: voorstel ? 'misschien: ' + schoon(voorstel.titel) + (voorstel.auteur ? ' (' + schoon(voorstel.auteur) + ')' : '') : 'niet gevonden',
        waarde_bron: [b.auteur, b.isbn ? 'ISBN ' + b.isbn : ''].filter(Boolean).join(', '),
        opmerking: [b.cover ? 'Cover: ' + b.cover : '', b.beschrijving.slice(0, 400)].filter(Boolean).join('\n')
      };
    }), 'oude website', vandaagTekst());
    bewaarTabel(naTeKijken);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  if (uit.covers) planTaak('kopieerOudeCovers', 60 * 1000);
  var velden = Object.keys(oud.rijen[0] || {}).join(', ');
  var hoe = Object.keys(uit.hoe).map(function (k) { return uit.hoe[k] + ' op ' + k; }).join(', ');
  var tekst = oudeBoeken.length + ' boeken gelezen op de oude website. Gevonden: ' + hoe + '. ' + uit.beschrijvingen + ' beschrijvingen overgenomen, ' +
    uit.covers + ' covers klaargezet (die kopieert het script nu op de achtergrond naar Drive), ' + uit.eigen + ' keer eigen werk behouden, ' +
    uit.nietGevonden.length + ' boeken niet gevonden in de Catalogus (zie Na te kijken).';
  logboek('menu', 'neemOudeBoekenOver', tekst + ' Bron: ' + oud.bron + ' (' + velden + ')');
  meld(tekst);
}

/** Achtergrond: stap 2. Kopieert de covers van de oude website naar Drive, in porties. */
function kopieerOudeCovers() {
  var start = Date.now();
  if (wachtOpDaglimiet('kopieerOudeCovers')) return;
  if (!startAchtergrond('kopieerOudeCovers')) { meldAlBezig('kopieerOudeCovers'); return; }
  var gekopieerd = 0, zonder = 0, rest = 0, storing = false;
  try {
    var tabel = leesTabel('Catalogus');
    var teDoen = tabel.rijen.filter(heeftOudeCoverNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > OUD_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var a = haalCoverLink(String(boek.oude_cover)); // zie Beheer.js
      if (a.code === 429 || a.code >= 500 || a.code === 0) { storing = true; break; }
      if (a.code === 200 && a.data) {
        var link = bewaarFotoInDrive('oud-' + boek.boek_id + '.jpg', a.data, a.type.split(';')[0] || 'image/jpeg');
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
  if (rest > 0) planTaak('kopieerOudeCovers', (storing ? 15 : 1) * 60 * 1000);
  if (gekopieerd) leegCache();
  logboek('menu', 'kopieerOudeCovers', gekopieerd + ' covers van de oude website gekopieerd, ' + zonder + ' zonder afbeelding, ' + rest + ' te gaan' +
    (storing ? ' (de oude website antwoordt even niet, over 15 minuten verder)' : ''));
}
