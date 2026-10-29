/**
 * Beheer.js
 * Wat het bestuur op de website kan aanpassen, zonder de spreadsheet te openen:
 *   - een boek aanpassen of toevoegen (met opzoeken via het ISBN);
 *   - Nieuws, Agenda en Veelgestelde vragen;
 *   - de teksten en instellingen.
 * Alles komt in dezelfde spreadsheet terecht. Je kan dus ook daar blijven werken.
 *
 * Wie mag wat? Dat staat per actie in ACTIES (Api.js). Wil je later vrijwilligers
 * bv. boeken laten toevoegen, zet die actie daar dan op 'balie'.
 */

/** Velden van een boek die je via de website kan aanpassen. De rest (herkomst, ...) blijft enkel in de spreadsheet. */
var BEHEER_BOEKVELDEN = [
  'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat',
  'aanrader', 'genre', 'extra_onderwerpen', 'klassieker', 'aantal', 'uitleenbaar', 'publiek', 'status',
  'startpagina', 'leeslijsten', 'beschrijving', 'beschrijving_en', 'cover_url', 'notitie',
  'land', 'duur', 'film_tip', 'te_koop', 'originele_titel'
];

/** Velden met ja/nee. Bij startpagina betekent leeg "automatisch". */
var BEHEER_JANEE = ['nieuwstaat', 'klassieker', 'uitleenbaar', 'publiek', 'startpagina', 'film_tip', 'te_koop'];

/** Tabbladen met inhoud van de website, en de kolommen die je via de website kan aanpassen. */
var BEHEER_INHOUD = {
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'online_vanaf'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek'],
  'Leeslijsten': ['volgorde', 'naam', 'naam_en', 'uitleg', 'uitleg_en', 'publiek', 'zichtbaar_vanaf', 'zichtbaar_tot']
};

/** Instellingen die nooit via de website zichtbaar of aanpasbaar zijn. Pas die aan in de spreadsheet. */
var BEHEER_GEHEIM = ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur', 'rooster_code', 'google_books_api_key', 'bol_client_id', 'bol_client_secret', 'goatcounter_api_sleutel'];

/** Lange teksten: meer tekens toegelaten en regeleinden blijven staan. */
var BEHEER_LANG = ['beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en', 'uitleg', 'uitleg_en'];

/** Maakt één ingevuld veld netjes. Geeft { waarde } of { fout }. */
function beheerVeld(veld, ruw) {
  if (BEHEER_LANG.indexOf(veld) > -1) return { waarde: String(ruw === undefined || ruw === null ? '' : ruw).trim().slice(0, 5000) };
  var w = tekstInvoer(ruw, 300);
  if (BEHEER_JANEE.indexOf(veld) > -1) return { waarde: jaNee(w) };
  if (veld === 'soort') return { waarde: soortVan({ soort: w }) };
  if (veld === 'status') {
    var s = boekStatus({ status: w });
    if (w && !s) return { fout: 'Kies als status: leeg, ' + BOEKSTATUSSEN.join(', ') + '.' };
    return { waarde: s ? s.replace('_', ' ') : '' };
  }
  if (veld === 'isbn') {
    if (!w) return { waarde: '' };
    var isbn = normaliseerIsbn(w);
    return { waarde: isbn.isbn || isbn.issn || w };
  }
  if (veld === 'cover_url' || veld === 'afbeelding' || veld === 'link') {
    if (w && !veiligeCoverUrl(w)) return { fout: 'Een link moet beginnen met https://' };
    return { waarde: w };
  }
  if (veld === 'jaartal' || veld === 'paginas' || veld === 'aantal' || veld === 'volgorde' || veld === 'duur') {
    if (!w) return { waarde: '' };
    var n = parseerGetal(w);
    if (n === null || n < 0 || n !== Math.round(n)) return { fout: 'Vul bij ' + veld + ' een geheel getal in.' };
    return { waarde: n };
  }
  if (veld === 'datum' || veld === 'online_vanaf' || veld === 'zichtbaar_vanaf' || veld === 'zichtbaar_tot') {
    if (!w) return { waarde: '' };
    var d = parseerDatum(w);
    if (!d) return { fout: 'Deze datum klopt niet. Schrijf ze als 20/11/2026.' };
    return { waarde: d };
  }
  if (veld === 'taal') return { waarde: normaliseerTaal(w) || w };
  if (veld === 'uitvoering') return { waarde: normaliseerUitvoering(w) || w };
  return { waarde: w };
}

/** Zet de ingevulde velden om. Enkel toegelaten velden. Geeft { velden } of { fout }. */
function beheerVelden(invoer, toegelaten) {
  var velden = {};
  var bron = invoer || {};
  for (var i = 0; i < toegelaten.length; i++) {
    var veld = toegelaten[i];
    if (!bron.hasOwnProperty(veld)) continue;
    var r = beheerVeld(veld, bron[veld]);
    if (r.fout) return { fout: r.fout };
    velden[veld] = r.waarde;
  }
  return { velden: velden };
}

/* ---------- Boeken ---------- */

/** Een boek zoals het beheerscherm het toont. */
function beheerBoek(rij) {
  var boek = { boek_id: String(rij.boek_id) };
  BEHEER_BOEKVELDEN.forEach(function (v) { boek[v] = isLeeg(rij[v]) ? '' : rij[v]; });
  boek.status = boekStatus(rij).replace('_', ' ');
  boek.toegevoegd_op = rij.toegevoegd_op || '';
  return boek;
}

/** Het hoogste exemplaarnummer dat nu uitgeleend of apart gelegd is. */
function hoogsteExemplaarInGebruik(staat, boekId) {
  var hoogste = 0;
  var tel = function (ex) {
    var m = String(ex || '').match(/-(\d+)$/);
    if (m && String(ex).indexOf(boekId + '-') === 0) hoogste = Math.max(hoogste, Number(m[1]));
  };
  lopendeUitleningen(staat).forEach(function (u) { if (u.boek_id === boekId) tel(u.exemplaar); });
  actieveReservaties(staat, boekId).forEach(function (r) { tel(r.exemplaar); });
  return hoogste;
}

/** Een boek ophalen om aan te passen. */
function boekOphalen(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  // sleutel: zodat de browser van het bestuur dit ene boek bij Google Books kan opzoeken (knop in het formulier).
  return { ok: true, boek: beheerBoek(boek), sleutel: String(staat.inst.google_books_api_key || '') };
}

/** Een boek aanpassen. invoer: { boek_id, velden: { ... } } */
function boekAanpassen(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var r = beheerVelden(invoer.velden, BEHEER_BOEKVELDEN);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  if (v.hasOwnProperty('titel') && !v.titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
  if (v.hasOwnProperty('aantal')) {
    if (!v.aantal) v.aantal = 1;
    var inGebruik = hoogsteExemplaarInGebruik(staat, boek.boek_id);
    if (v.aantal < inGebruik) {
      return { ok: false, fout: 'Exemplaar ' + boek.boek_id + '-' + inGebruik + ' is uitgeleend of ligt apart. Het aantal kan niet lager dan ' + inGebruik + '.' };
    }
  }
  if (v.hasOwnProperty('isbn') || v.hasOwnProperty('titel') || v.hasOwnProperty('auteur') || v.hasOwnProperty('soort')) {
    var samen = {};
    ['soort', 'isbn', 'titel', 'auteur'].forEach(function (k) { samen[k] = v.hasOwnProperty(k) ? v[k] : boek[k]; });
    v.bron_sleutel = bronSleutel(samen);
  }
  // Een nieuwe Nederlandse beschrijving: de vertaling opnieuw laten maken.
  if (v.hasOwnProperty('beschrijving') && v.beschrijving !== schoonMetRegels(boek.beschrijving) && !v.hasOwnProperty('beschrijving_en')) {
    v.beschrijving_vertaald = '';
    staat.vertalingNodig = true;
  }
  // Maak je de beschrijving leeg, dan valt ook de bronvermelding weg.
  if (v.hasOwnProperty('beschrijving') && !v.beschrijving) v.beschrijving_bron = '';
  wijzig(boek, v);
  staat.catalogusGewijzigd = true;
  // Welke velden: zo zie je in het Logboek en bij het boek wat er veranderde.
  staat.log.push(['boek aangepast', boek.boek_id + ': ' + Object.keys(v).filter(function (k) { return BEHEER_BOEKVELDEN.indexOf(k) > -1; }).join(', ')]);
  return { ok: true, tekst: '"' + schoon(boek.titel) + '" is bewaard.', boek: beheerBoek(boek) };
}

/**
 * Een nieuw boek toevoegen. invoer: { velden: { ... }, toch: true om een dubbel ISBN toe te laten }
 * nieuwId: functie (soort) -> nieuwe boek-ID.
 */
function boekToevoegen(staat, invoer, nieuwId) {
  var r = beheerVelden(invoer.velden, BEHEER_BOEKVELDEN);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  if (!v.titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
  v.soort = v.soort || 'boek';
  if (v.isbn && !invoer.toch) {
    var dubbel = staat.catalogus.filter(function (b) { return String(b.isbn) === String(v.isbn) && !isLeeg(b.boek_id); })[0];
    if (dubbel) {
      return {
        ok: false, dubbel: String(dubbel.boek_id),
        fout: 'Dit ISBN staat al in de catalogus als ' + dubbel.boek_id + ' ("' + schoon(dubbel.titel) + '"). Is het een extra exemplaar? Verhoog daar het aantal.'
      };
    }
  }
  var boek = {};
  BEHEER_BOEKVELDEN.forEach(function (k) { boek[k] = v.hasOwnProperty(k) ? v[k] : ''; });
  boek.boek_id = nieuwId(v.soort);
  boek.aantal = v.aantal || 1;
  boek.uitleenbaar = v.uitleenbaar || 'ja';
  boek.publiek = v.publiek || 'ja';
  boek.toegevoegd_op = staat.vandaag;
  boek.herkomst = tekstInvoer(invoer.herkomst, 300);
  boek.bron_sleutel = bronSleutel(boek);
  voegToe(staat.catalogus, boek);
  staat.catalogusGewijzigd = true;
  staat.log.push(['boek toegevoegd', boek.boek_id]);
  return { ok: true, tekst: '"' + boek.titel + '" staat in de catalogus als ' + boek.boek_id + '.', boek: beheerBoek(boek) };
}

/** "Mira Verbeek" wordt "Verbeek, Mira", zoals de rest van de catalogus. */
function auteurAchternaamEerst(naam) {
  var n = schoon(naam);
  if (!n || n.indexOf(',') > -1) return n;
  var delen = n.split(' ');
  if (delen.length < 2) return n;
  return delen.pop() + ', ' + delen.join(' ');
}

/**
 * Voegt wat Open Library en Google Books over een ISBN weten samen tot een voorstel.
 * olDetails: het "details"-object van Open Library, gbInfo: een "volumeInfo" van Google Books.
 */
function isbnVoorstel(olDetails, gbInfo) {
  var leeg = {};
  var v = verwerkOpenLibrary(leeg, olDetails);
  var gb = verwerkGoogleBooks(v, gbInfo);
  Object.keys(gb).forEach(function (k) { if (isLeeg(v[k])) v[k] = gb[k]; });
  var titel = olDetails && olDetails.title ? schoon(olDetails.title) + (olDetails.subtitle ? ': ' + schoon(olDetails.subtitle) : '') : '';
  if (!titel && gbInfo && gbInfo.title) titel = schoon(gbInfo.title) + (gbInfo.subtitle ? ': ' + schoon(gbInfo.subtitle) : '');
  var auteurs = (olDetails && olDetails.authors || []).map(function (a) { return a.name; });
  if (!auteurs.length && gbInfo && gbInfo.authors) auteurs = gbInfo.authors;
  if (titel) v.titel = titel;
  if (auteurs.length) v.auteur = auteurs.map(auteurAchternaamEerst).join(' & ');
  return v;
}

/** Zoekt een ISBN op bij Open Library en Google Books. Geeft { ok, voorstel } terug. */
function isbnOpzoeken(invoer) {
  var isbn = normaliseerIsbn(invoer.isbn).isbn;
  if (!isbn) return { ok: false, fout: 'Dit ISBN klopt niet. Kijk het nog eens na.' };
  var ol = null, gb = null;
  try {
    var r = haalJson('https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=ISBN:' + isbn);
    ol = r.data && r.data['ISBN:' + isbn] ? r.data['ISBN:' + isbn].details : null;
  } catch (e) { ol = null; }
  try {
    var sleutel = leesInstellingen().google_books_api_key;
    var g = googleBooksZoek(isbn, sleutel); // zie Beschrijvingen.js (met het land erbij)
    gb = g.items.length ? g.items[0].volumeInfo : null;
  } catch (e) { gb = null; }
  var voorstel = isbnVoorstel(ol, gb);
  voorstel.isbn = isbn;
  return { ok: true, voorstel: voorstel, gevonden: !!(ol || gb) };
}

/* ---------- Nieuws, Agenda, Veelgestelde vragen ---------- */

/** Een korte vingerafdruk van een rij: zo merken we het als iemand ze intussen in de spreadsheet aanpaste. */
function vingerafdruk(rij, kolommen) {
  var tekst = kolommen.map(function (k) { return String(isLeeg(rij[k]) ? '' : rij[k]); }).join('\u0001');
  var h = 5381;
  for (var i = 0; i < tekst.length; i++) h = ((h * 33) ^ tekst.charCodeAt(i)) >>> 0;
  return String(h);
}

/** De rijen van een inhoudstabblad, zoals het beheerscherm ze toont. */
function inhoudRijen(tabblad, rijen) {
  var kolommen = BEHEER_INHOUD[tabblad];
  return rijen.map(function (rij) {
    var uit = { rij: rij._rij, vingerafdruk: vingerafdruk(rij, kolommen) };
    kolommen.forEach(function (k) { uit[k] = isLeeg(rij[k]) ? '' : rij[k]; });
    // Voorstel van een vrijwilliger dat nog op goedkeuring wacht (zie inhoudAanpassen).
    if (!isLeeg(rij.voorgesteld_door)) uit.voorgesteld_door = schoon(rij.voorgesteld_door);
    return uit;
  });
}

/** Hoeveel nieuwsberichten en events van vrijwilligers nog op goedkeuring wachten. */
function telVoorstellen() {
  return VOORSTEL_TABBLADEN.reduce(function (n, naam) {
    if (!spreadsheet().getSheetByName(naam)) return n;
    return n + leesTabel(naam).rijen.filter(function (r) { return !isLeeg(r.voorgesteld_door) && jaNee(r.publiek) === 'nee'; }).length;
  }, 0);
}

/** Tabbladen die een vrijwilliger mag aanpassen. Nieuws en Agenda enkel als voorstel. */
var VRIJWILLIGER_INHOUD = ['Nieuws', 'Agenda', 'Leeslijsten'];
var VOORSTEL_TABBLADEN = ['Nieuws', 'Agenda'];

/**
 * Past een rij van Nieuws, Agenda of Veelgestelde vragen aan, voegt er een toe of verwijdert er een.
 * invoer: { tabblad, rij (leeg = nieuw), vingerafdruk, velden, verwijderen }
 * rijen: de rijen van dat tabblad (worden aangepast).
 */
function inhoudAanpassen(rijen, invoer, vrijwilliger) {
  var tabblad = String(invoer.tabblad || '');
  var kolommen = BEHEER_INHOUD[tabblad];
  if (!kolommen) return { ok: false, fout: 'Onbekend tabblad.' };
  // vrijwilliger: de voornaam als een vrijwilliger dit doet (leeg bij het bestuur).
  if (vrijwilliger && VRIJWILLIGER_INHOUD.indexOf(tabblad) === -1) return { ok: false, fout: 'Dit kan enkel met de code van het bestuur.' };
  var voorstel = !!vrijwilliger && VOORSTEL_TABBLADEN.indexOf(tabblad) > -1;
  var rij = null;
  if (invoer.rij) {
    rij = rijen.filter(function (r) { return r._rij === Number(invoer.rij); })[0];
    if (!rij || vingerafdruk(rij, kolommen) !== String(invoer.vingerafdruk)) {
      return { ok: false, fout: 'Iemand paste dit intussen aan in de spreadsheet. Klik op Vernieuw en probeer opnieuw.' };
    }
  }
  if (invoer.verwijderen) {
    if (!rij) return { ok: false, fout: 'Er is niets om te verwijderen.' };
    if (voorstel && jaNee(rij.publiek) !== 'nee') return { ok: false, fout: 'Dit staat al online. Vraag het bestuur om het te verwijderen.' };
    markeerVerwijderen(rij);
    return { ok: true, tekst: 'Verwijderd uit ' + tabblad + '.' };
  }
  var r = beheerVelden(invoer.velden, kolommen);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  var hoofd = { 'Veelgestelde vragen': 'vraag', 'Leeslijsten': 'naam' }[tabblad] || 'titel';
  var nieuweWaarde = v.hasOwnProperty(hoofd) ? v[hoofd] : (rij ? rij[hoofd] : '');
  if (isLeeg(nieuweWaarde)) return { ok: false, fout: 'Vul een ' + hoofd + ' in.' };
  if (tabblad === 'Leeslijsten') {
    if (/[,;]/.test(nieuweWaarde)) return { ok: false, fout: 'Een naam van een leeslijst mag geen komma of puntkomma bevatten.' };
    var dubbel = rijen.some(function (r) { return r !== rij && !r._verwijderen && normaliseerTekst(r.naam) === normaliseerTekst(nieuweWaarde); });
    if (dubbel) return { ok: false, fout: 'Er bestaat al een leeslijst met die naam.' };
    var van = v.hasOwnProperty('zichtbaar_vanaf') ? v.zichtbaar_vanaf : (rij ? parseerDatum(rij.zichtbaar_vanaf) : '');
    var tot = v.hasOwnProperty('zichtbaar_tot') ? v.zichtbaar_tot : (rij ? parseerDatum(rij.zichtbaar_tot) : '');
    if (van && tot && tot < van) return { ok: false, fout: 'De einddatum ligt voor de startdatum.' };
  }
  if (tabblad === 'Agenda' && isLeeg(v.hasOwnProperty('datum') ? v.datum : (rij ? rij.datum : ''))) {
    return { ok: false, fout: 'Een event heeft een datum nodig.' };
  }
  if (!v.publiek && !rij) v.publiek = 'ja';
  // Een vrijwilliger stelt voor: het bericht blijft verborgen tot het bestuur het op zichtbaar zet.
  // Ook een aanpassing aan een bericht dat al online stond, gaat eerst langs het bestuur.
  if (voorstel) { v.publiek = 'nee'; v.voorgesteld_door = tekstInvoer(vrijwilliger, 40); }
  else if (VOORSTEL_TABBLADEN.indexOf(tabblad) > -1 && v.publiek === 'ja') v.voorgesteld_door = '';
  if (rij) {
    wijzig(rij, v);
  } else {
    var nieuw = {};
    kolommen.forEach(function (k) { nieuw[k] = v.hasOwnProperty(k) ? v[k] : ''; });
    if (v.voorgesteld_door) nieuw.voorgesteld_door = v.voorgesteld_door;
    if (tabblad === 'Nieuws' && !nieuw.datum) nieuw.datum = vandaagTekst();
    voegToe(rijen, nieuw);
  }
  if (voorstel) return { ok: true, tekst: (rij ? 'Aangepast' : 'Toegevoegd') + ' in ' + tabblad + '. Het bestuur zet het online na nalezen.' };
  return { ok: true, tekst: (rij ? 'Aangepast' : 'Toegevoegd') + ' in ' + tabblad + '.' };
}

/* ---------- Instellingen ---------- */

/** De instellingen per groep, zonder de geheime. rijen: de rijen van het tabblad Instellingen. */
function instellingenVoorBeheer(rijen) {
  var perSleutel = {};
  rijen.forEach(function (r) {
    var s = schoon(r.sleutel);
    if (s && !isInstellingKop(s)) perSleutel[s] = r;
  });
  var groepen = [], gezien = {};
  var maak = function (titel, sleutels) {
    var items = sleutels.filter(function (s) { return perSleutel[s] && BEHEER_GEHEIM.indexOf(s) === -1; }).map(function (s) {
      gezien[s] = true;
      return { sleutel: s, waarde: isLeeg(perSleutel[s].waarde) ? '' : String(perSleutel[s].waarde), uitleg: schoon(perSleutel[s].uitleg) };
    });
    BEHEER_GEHEIM.forEach(function (s) { gezien[s] = true; });
    if (items.length) groepen.push({ titel: titel, instellingen: items });
  };
  INSTELLING_GROEPEN.forEach(function (g) { maak(g[0], g[1]); });
  maak('Overige', Object.keys(perSleutel).filter(function (s) { return !gezien[s]; }));
  return groepen;
}

/** Past één instelling aan. invoer: { sleutel, waarde } */
function instellingAanpassen(rijen, invoer) {
  var sleutel = schoon(invoer.sleutel);
  if (!sleutel || isInstellingKop(sleutel)) return { ok: false, fout: 'Onbekende instelling.' };
  if (BEHEER_GEHEIM.indexOf(sleutel) > -1) return { ok: false, fout: 'Deze instelling pas je enkel in de spreadsheet aan.' };
  var rij = rijen.filter(function (r) { return schoon(r.sleutel) === sleutel; })[0];
  if (!rij) return { ok: false, fout: 'Onbekende instelling.' };
  var waarde = String(invoer.waarde === undefined || invoer.waarde === null ? '' : invoer.waarde).trim().slice(0, 5000);
  wijzig(rij, { waarde: waarde });
  return { ok: true, tekst: 'De instelling ' + sleutel + ' is bewaard.' };
}

/* ---------- Acties die enkel een tabblad lezen of schrijven ---------- */

/**
 * Gegevens voor de onderdelen Nieuws en agenda, Leeslijsten, en Teksten en instellingen.
 * Een vrijwilliger krijgt enkel Nieuws, Agenda en Leeslijsten, en van de instellingen enkel leeslijsten_tonen.
 */
function beheerInhoudGegevens(rol) {
  var vrijwilliger = rol && rol !== 'bestuur';
  var uit = { tabbladen: {} };
  Object.keys(BEHEER_INHOUD).forEach(function (naam) {
    if (vrijwilliger && VRIJWILLIGER_INHOUD.indexOf(naam) === -1) return;
    uit.tabbladen[naam] = spreadsheet().getSheetByName(naam) ? inhoudRijen(naam, leesTabel(naam).rijen) : [];
  });
  var groepen = instellingenVoorBeheer(leesTabel('Instellingen').rijen);
  if (vrijwilliger) {
    groepen = groepen.map(function (g) {
      return { titel: g.titel, instellingen: g.instellingen.filter(function (i) { return i.sleutel === 'leeslijsten_tonen'; }) };
    }).filter(function (g) { return g.instellingen.length; });
  }
  uit.instellingen = groepen;
  return { ok: true, data: uit };
}

/** Bewaart een wijziging in Nieuws, Agenda, Veelgestelde vragen of Leeslijsten. */
function beheerInhoudBewaren(invoer, wie, rol) {
  if (!BEHEER_INHOUD[invoer.tabblad]) return { ok: false, fout: 'Onbekend tabblad.' };
  var tabel = leesTabel(invoer.tabblad);
  var oud = invoer.rij ? tabel.rijen.filter(function (r) { return r._rij === Number(invoer.rij); })[0] : null;
  var oudeNaam = oud ? schoon(oud.naam) : '';
  var antwoord = inhoudAanpassen(tabel.rijen, invoer, rol && rol !== 'bestuur' ? (wie || 'vrijwilliger') : '');
  if (antwoord.ok) {
    if (tabel.kop.indexOf('voorgesteld_door') === -1 && tabel.rijen.some(function (r) { return r.voorgesteld_door; })) {
      return { ok: false, fout: 'De kolom voorgesteld_door ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
    }
    bewaarTabel(tabel);
    logboek(wie, 'website aangepast', invoer.tabblad);
    // Een leeslijst hernoemd of verwijderd: ook de boeken in de Catalogus aanpassen.
    if (invoer.tabblad === 'Leeslijsten' && oudeNaam) {
      var nieuweNaam = invoer.verwijderen ? '' : schoon(oud.naam);
      if (nieuweNaam !== oudeNaam) {
        var cat = leesTabel('Catalogus');
        var n = hernoemLeeslijst(cat.rijen, oudeNaam, nieuweNaam);
        if (n) bewaarTabel(cat);
      }
    }
  }
  return antwoord;
}

/* ---------- Leeslijsten: boeken kiezen ---------- */

/** Zet de namen in de kolom leeslijsten terug als tekst. */
function leeslijstTekst(namen) {
  return namen.join(', ');
}

/**
 * Hernoemt een leeslijst in alle boeken, of haalt ze weg (nieuw leeg). Geeft het aantal aangepaste boeken.
 */
function hernoemLeeslijst(catalogus, oud, nieuw) {
  var sleutel = normaliseerTekst(oud);
  var n = 0;
  catalogus.forEach(function (b) {
    var namen = splitsLijst(b.leeslijsten);
    var i = namen.map(normaliseerTekst).indexOf(sleutel);
    if (i === -1) return;
    if (nieuw) namen[i] = nieuw; else namen.splice(i, 1);
    namen = namen.filter(function (x, j) { return namen.map(normaliseerTekst).indexOf(normaliseerTekst(x)) === j; });
    wijzig(b, { leeslijsten: leeslijstTekst(namen) });
    n++;
  });
  return n;
}

/**
 * Zet boeken in een leeslijst of haalt ze eruit.
 * invoer: { naam, toevoegen: [boek_id], weghalen: [boek_id] }
 */
function leeslijstBoeken(staat, invoer) {
  var naam = tekstInvoer(invoer.naam, 80);
  if (!naam || /[,;]/.test(naam)) return { ok: false, fout: 'Kies eerst een leeslijst.' };
  var sleutel = normaliseerTekst(naam);
  var erbij = 0, eruit = 0;
  function pas(ids, toevoegen) {
    (Array.isArray(ids) ? ids : []).slice(0, 500).forEach(function (id) {
      var boek = boekVan(staat, String(id));
      if (!boek) return;
      var namen = splitsLijst(boek.leeslijsten);
      var i = namen.map(normaliseerTekst).indexOf(sleutel);
      if (toevoegen && i === -1) { namen.push(naam); erbij++; }
      else if (!toevoegen && i > -1) { namen.splice(i, 1); eruit++; }
      else return;
      wijzig(boek, { leeslijsten: leeslijstTekst(namen) });
    });
  }
  pas(invoer.toevoegen, true);
  pas(invoer.weghalen, false);
  if (erbij || eruit) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['leeslijst ' + naam, erbij + ' boeken erbij, ' + eruit + ' eruit']);
  }
  return { ok: true, tekst: 'Leeslijst ' + naam + ': ' + erbij + ' boeken toegevoegd, ' + eruit + ' weggehaald.' };
}

/** Bewaart een instelling. */
function beheerInstellingBewaren(invoer, wie) {
  var tabel = leesTabel('Instellingen');
  var antwoord = instellingAanpassen(tabel.rijen, invoer);
  if (antwoord.ok) {
    bewaarTabel(tabel);
    logboek(wie, 'instelling aangepast', schoon(invoer.sleutel));
  }
  return antwoord;
}

/* ---------- Covers zoeken via de browser van het bestuur ---------- */

/*
 * Google Books en Open Library weigeren vaak vragen vanuit Apps Script: die komen van servers
 * van Google, die veel andere scripts delen. Daarom vraagt de browser van het bestuur de covers
 * op, en bewaart het script wat gevonden is. De browser krijgt daarvoor de google_books_api_key: enkel wie de code van het bestuur
 * heeft, ziet die. Beperk de sleutel in de Google Cloud Console tot de Books API.
 */

/**
 * De boeken zonder cover of zonder beschrijving die de browser nog moet opzoeken.
 * Een beschrijving van Wikipedia telt als ontbrekend voor Google: die vervangt ze.
 *   g: nog niet bij Google opgezocht (enkel met een ISBN): voor een cover en een beschrijving
 *   o: nog niet bij Open Library opgezocht voor een andere uitgave (ISBN, of titel en auteur)
 *   i: nog niet bij Internet Archive opgezocht (enkel met een ISBN)
 */
function coversTeZoeken(staat, metSleutel) {
  var boeken = [];
  staat.catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var zonderCover = isLeeg(b.cover_url);
    if (!zonderCover && !isLeeg(b.beschrijving) && !heeftWikiBeschrijving(b)) return;
    var isbn = /^\d{13}$/.test(String(b.isbn || '')) ? String(b.isbn) : '';
    // Google: voor een cover en voor een beschrijving. Open Library en Internet Archive: enkel voor een cover.
    var g = !!isbn && isLeeg(b.gb_gecontroleerd);
    var o = zonderCover && isLeeg(b.cover_gezocht) && (!!isbn || !isLeeg(b.titel));
    var i = zonderCover && !!isbn && isLeeg(b.ia_gezocht);
    if (g || o || i) boeken.push({ id: String(b.boek_id), isbn: isbn, t: schoon(b.titel), a: schoon(b.auteur), g: g, o: o, i: i });
  });
  // De sleutel van Google Books enkel voor het bestuur. Vrijwilligers zoeken zonder sleutel (trager, wel gratis).
  return { ok: true, boeken: boeken, sleutel: metSleutel === false ? '' : String(staat.inst.google_books_api_key || '') };
}

function isGoogleCover(url) {
  return /^https:\/\/(books\.google\.[a-z.]+|books\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)\//.test(String(url || ''));
}

/** Enkel covers van Open Library zelf, in het vaste formaat. */
function isOlCover(url) {
  return /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(String(url || ''));
}

/**
 * Bewaart wat de browser bij Google Books en Open Library vond.
 * invoer.items: [{ boek_id, google, ol, bron, cover, meta: { beschrijving, uitgeverij, jaartal, paginas, taal } }]
 *   google / ol: dit boek werd daar opgezocht (dan krijgt het een datum in gb_gecontroleerd / cover_gezocht)
 *   bron: 'google', 'ol-isbn', 'ol-titel' of 'ia' (Internet Archive)
 * Enkel lege velden worden aangevuld (behalve een beschrijving van Wikipedia: Google vervangt die),
 * en enkel covers van Google, Open Library of Internet Archive.
 * (Oudere versie van de knop: { gezocht, resultaten } met enkel Google.)
 */
function coversBewaren(staat, invoer) {
  var items = invoer.items;
  if (!items && invoer.gezocht) {
    var perId = {};
    (invoer.resultaten || []).forEach(function (r) { perId[String(r.boek_id)] = r; });
    items = invoer.gezocht.map(function (id) {
      var r = perId[String(id)] || {};
      return { boek_id: id, google: true, bron: r.cover ? 'google' : '', cover: r.cover, meta: r };
    });
  }
  var covers = 0, n = 0, beschrijvingen = 0;
  (items || []).slice(0, 200).forEach(function (it) {
    var boek = boekVan(staat, String(it.boek_id));
    if (!boek) return;
    n++;
    var velden = {};
    if (it.google) velden.gb_gecontroleerd = staat.vandaag;
    if (it.ol) velden.cover_gezocht = staat.vandaag;
    if (it.ia) velden.ia_gezocht = staat.vandaag;
    var cover = String(it.cover || '').replace(/^http:/, 'https:');
    var m = it.meta || {};
    if (it.google || it.bron === 'google') {
      var info = {
        imageLinks: it.bron === 'google' && isGoogleCover(cover) ? { thumbnail: cover } : null,
        description: tekstInvoer(m.beschrijving, 5000), publisher: tekstInvoer(m.uitgeverij, 120),
        publishedDate: tekstInvoer(m.jaartal, 20), pageCount: parseerGetal(m.paginas) || 0, language: tekstInvoer(m.taal, 5)
      };
      var gb = verwerkGoogleBooks(boek, info);
      Object.keys(gb).forEach(function (k) { velden[k] = gb[k]; });
      if (gb.cover_url) velden.cover_bron = 'Google Books';
      if (gb.beschrijving) { beschrijvingen++; staat.vertalingNodig = true; }
    }
    if (!velden.cover_url && isLeeg(boek.cover_url) && (it.bron === 'ol-isbn' || it.bron === 'ol-titel') && isOlCover(cover)) {
      velden.cover_url = cover;
      velden.cover_bron = it.bron === 'ol-isbn' ? CV_ANDERE_UITGAVE : CV_TITEL_AUTEUR;
    }
    if (!velden.cover_url && isLeeg(boek.cover_url) && it.bron === 'ia' && /^https:\/\/archive\.org\/services\/img\/[A-Za-z0-9._-]+$/.test(cover)) {
      velden.cover_url = cover;
      velden.cover_bron = IA_BRON;
    }
    if (velden.cover_url) covers++;
    wijzig(boek, velden);
  });
  if (n) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['covers via de browser', n + ' opgezocht, ' + covers + ' covers, ' + beschrijvingen + ' beschrijvingen']);
  }
  return { ok: true, covers: covers, beschrijvingen: beschrijvingen };
}

/* ---------- Foto van een cover, genomen in de bib ---------- */

/*
 * Een bestuurslid neemt in de bib een foto van de cover (gsm). De browser verkleint die
 * en stuurt ze door. Het script bewaart ze in een map op Google Drive (instelling cover_map),
 * deelt ze als "iedereen met de link mag bekijken" en zet de link in cover_url.
 */

var FOTO_MAX_BYTES = 1500000;
var FOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Bewaart een foto als cover van een boek.
 * invoer: { boek_id, data (base64, zonder "data:..."), mime }
 * bewaar: functie (bestandsnaam, base64, mime) -> publieke link (Drive). Apart, zodat de tests zonder Drive kunnen.
 */
function coverUploaden(staat, invoer, bewaar) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var mime = String(invoer.mime || '');
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Enkel een foto als JPG, PNG of WebP.' };
  var data = String(invoer.data || '').replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, fout: 'Deze foto kon niet gelezen worden.' };
  if (data.length * 0.75 > FOTO_MAX_BYTES) return { ok: false, fout: 'Deze foto is te groot. Probeer opnieuw: de site verkleint ze normaal vanzelf.' };
  var url = bewaar(String(boek.boek_id) + '.' + FOTO_TYPES[mime], data, mime);
  if (!/^https:\/\//.test(String(url || ''))) return { ok: false, fout: 'Bewaren op Google Drive lukte niet.' };
  wijzig(boek, { cover_url: url, cover_bron: 'foto in de bib' });
  staat.catalogusGewijzigd = true;
  staat.log.push(['cover-foto', String(boek.boek_id)]);
  return { ok: true, tekst: 'De foto is de cover van "' + schoon(boek.titel) + '".', cover_url: url };
}

/*
 * Een cover via een link. Een link naar een webpagina (bol.com, een uitgeverij, Goodreads) of uit
 * Google Afbeeldingen is geen afbeelding: het script zoekt de afbeelding erachter (bij Google de
 * parameter imgurl, op een webpagina de og:image), haalt ze op en bewaart ze op Google Drive,
 * net als een foto. Zo blijft de cover werken, ook als de andere site de link verandert.
 */

var LINK_MAX_BYTES = 4000000;

/** Haalt uit een link van Google Afbeeldingen of een doorverwijzing van Google het echte adres. */
function echteAfbeeldingLink(url) {
  var u = schoon(url).replace(/^http:\/\//i, 'https://');
  var m = u.match(/^https:\/\/(?:www\.)?google\.[a-z.]+\/(?:imgres|url)\?(.*)$/i);
  if (m) {
    var param = m[1].split('&').map(function (p) { return p.split('='); })
      .filter(function (p) { return p[0] === 'imgurl' || p[0] === 'url' || p[0] === 'q'; })[0];
    if (param && param[1]) {
      try { u = decodeURIComponent(param[1]).replace(/^http:\/\//i, 'https://'); } catch (e) { /* laat zoals het is */ }
    }
  }
  return u;
}

/** Zoekt in de HTML van een webpagina de afbeelding die de pagina zelf als voorbeeld geeft. */
function afbeeldingUitHtml(html, paginaUrl) {
  var patronen = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for (var i = 0; i < patronen.length; i++) {
    var m = String(html || '').match(patronen[i]);
    if (!m) continue;
    var link = m[1].replace(/&amp;/g, '&');
    if (/^\/\//.test(link)) link = 'https:' + link;
    else if (/^\//.test(link)) link = String(paginaUrl).replace(/^(https?:\/\/[^\/]+).*$/, '$1') + link;
    return link.replace(/^http:\/\//i, 'https://');
  }
  return '';
}

/**
 * Bewaart de afbeelding achter een link als cover van een boek.
 * invoer: { boek_id, url }
 * haal: functie (url) -> { code, type, data (base64), tekst (bij HTML) }. bewaar: zoals bij coverUploaden.
 */
function coverVanLink(staat, invoer, haal, bewaar) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var url = echteAfbeeldingLink(invoer.url);
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) return { ok: false, fout: 'Plak een link die begint met https://' };
  var r = haal(url);
  if (r && r.code < 300 && /^text\/html/i.test(r.type || '')) {
    var beeld = afbeeldingUitHtml(r.tekst, url);
    if (!beeld) return { ok: false, fout: 'Op deze pagina vond ik geen afbeelding. Klik met de rechtermuisknop op de cover en kies "Adres van afbeelding kopiëren", en plak dat adres.' };
    r = haal(beeld);
  }
  if (r && r.code === 429) return { ok: false, fout: 'Google laat vandaag geen vragen naar buiten meer toe (daglimiet). Probeer het morgen opnieuw, of neem een foto.' };
  if (!r || !r.code || r.code >= 300) return { ok: false, fout: 'Deze link opent niet' + (r && r.code ? ' (code ' + r.code + ')' : '') + '. Probeer een andere link, of neem een foto.' };
  var mime = String(r.type || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Achter deze link zit geen JPG, PNG of WebP. Kopieer het adres van de afbeelding zelf.' };
  if (String(r.data || '').length * 0.75 > LINK_MAX_BYTES) return { ok: false, fout: 'Deze afbeelding is te groot. Neem een kleinere, of maak een foto.' };
  var link = bewaar(String(boek.boek_id) + '.' + FOTO_TYPES[mime], r.data, mime);
  if (!/^https:\/\//.test(String(link || ''))) return { ok: false, fout: 'Bewaren op Google Drive lukte niet.' };
  wijzig(boek, { cover_url: link, cover_bron: 'link' });
  staat.catalogusGewijzigd = true;
  staat.log.push(['cover-link', String(boek.boek_id)]);
  return { ok: true, tekst: 'De afbeelding is de cover van "' + schoon(boek.titel) + '".', cover_url: link };
}

/** Haalt een link op voor coverVanLink (enkel in Apps Script). */
function haalCoverLink(url) {
  var a;
  try {
    a = haalExtern(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (Project Madrigal)' } });
  } catch (e) {
    return { code: isDaglimietFout(e) ? 429 : 0, type: '' };
  }
  var type = String((a.getHeaders() || {})['Content-Type'] || (a.getHeaders() || {})['content-type'] || '');
  var uit = { code: a.getResponseCode(), type: type };
  if (/^image\//i.test(type)) uit.data = Utilities.base64Encode(a.getBlob().getBytes());
  else if (/html/i.test(type)) uit.tekst = a.getContentText().slice(0, 300000);
  return uit;
}

/** Bewaart een foto in de map voor covers op Google Drive en geeft een publieke link terug. */
function bewaarFotoInDrive(bestandsnaam, base64, mime) {
  var naam = leesInstellingen().cover_map || 'Project Madrigal covers';
  var mappen = DriveApp.getFoldersByName(naam);
  var map = mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
  // Een oude foto van hetzelfde boek naar de prullenbak.
  var oud = map.getFilesByName(bestandsnaam);
  while (oud.hasNext()) oud.next().setTrashed(true);
  var bestand = map.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, bestandsnaam));
  bestand.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + bestand.getId();
}

/* ---------- Tekst van de achterkant (foto + tekstherkenning) ---------- */

/*
 * Een foto van de achterflap: Google Drive leest de tekst (tekstherkenning, OCR), en die
 * komt in het veld beschrijving van het bestuursscherm. Daar lees je ze na en bewaar je ze.
 * Nodig: in Apps Script de service "Drive API" aanzetten (Services > + > Drive API).
 */

var OCR_MAX_BYTES = 4000000;

/** Maakt herkende tekst netjes: woorden die over twee regels gesplitst werden, terug aan elkaar; alinea's blijven. */
function maakOcrTekstNetjes(ruw) {
  var t = String(ruw || '').replace(/\r/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')     // ge-\nschiedenis wordt geschiedenis
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\u0000')                   // alinea's even bewaren
    .replace(/\n/g, ' ')                              // gewone regeleinden worden spaties
    .replace(/\u0000/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
  return kortAfOpZin(t, BS_MAX_LENGTE);
}

/**
 * Leest de tekst van een foto. invoer: { data (base64), mime }
 * ocr: functie (base64, mime) -> ruwe tekst. Apart, zodat de tests zonder Google kunnen.
 */
function tekstUitFoto(invoer, ocr) {
  var mime = String(invoer.mime || '');
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Enkel een foto als JPG, PNG of WebP.' };
  var data = String(invoer.data || '').replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, fout: 'Deze foto kon niet gelezen worden.' };
  if (data.length * 0.75 > OCR_MAX_BYTES) return { ok: false, fout: 'Deze foto is te groot.' };
  var tekst = maakOcrTekstNetjes(ocr(data, mime));
  if (tekst.length < 20) return { ok: false, fout: 'Er stond geen leesbare tekst op de foto. Probeer opnieuw met meer licht, recht van boven.' };
  return { ok: true, tekst: tekst };
}

/** Tekstherkenning via Google Drive: de foto wordt even een Google Doc, daarna gaat die naar de prullenbak. */
function ocrViaDrive(base64, mime) {
  if (typeof Drive === 'undefined' || !Drive.Files) {
    throw new Error('Zet eerst in Apps Script de service Drive API aan: links naast Services op + klikken, Drive API kiezen en Toevoegen.');
  }
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, 'achterkant');
  var bestand = Drive.Files.create
    ? Drive.Files.create({ name: 'Madrigal tekstherkenning', mimeType: 'application/vnd.google-apps.document' }, blob, { ocrLanguage: 'nl', fields: 'id' })
    : Drive.Files.insert({ title: 'Madrigal tekstherkenning', mimeType: 'application/vnd.google-apps.document' }, blob, { ocr: true, ocrLanguage: 'nl' });
  try {
    return DocumentApp.openById(bestand.id).getBody().getText();
  } finally {
    DriveApp.getFileById(bestand.id).setTrashed(true);
  }
}

/* ---------- Covers van Internet Archive nakijken ---------- */

/** De boeken met een cover van Internet Archive, om in de browser na te kijken. */
function iaCoversLijst(staat) {
  return {
    ok: true,
    boeken: staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && schoon(b.cover_bron) === IA_BRON && !isLeeg(b.cover_url); })
      .map(function (b) { return { id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), cover: String(b.cover_url) }; })
  };
}

/**
 * Wist covers van Internet Archive die enkel het logo tonen. invoer: { ids: [...] }
 * Enkel covers met bron Internet Archive. Het boek komt daarna weer aan de beurt bij Google.
 */
function iaCoversWissen(staat, invoer) {
  var n = 0;
  (invoer.ids || []).slice(0, 2000).forEach(function (id) {
    var boek = boekVan(staat, String(id));
    if (!boek || schoon(boek.cover_bron) !== IA_BRON) return;
    wijzig(boek, { cover_url: '', cover_bron: '', gb_gecontroleerd: '' });
    n++;
  });
  if (n) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['logo van Internet Archive gewist', n + ' covers']);
  }
  return { ok: true, gewist: n, tekst: n + ' covers met het logo van Internet Archive gewist.' };
}
