/**
 * Opslag.js
 * Lezen en schrijven van de tabbladen. Elke rij wordt een object met de
 * kolomkoppen als sleutels. Zo maakt de volgorde van de kolommen niet uit,
 * en mag het bestuur er zelf kolommen bijzetten.
 *
 * Werkwijze bij wijzigen:
 *   - wijzig(rij, {veld: waarde}) past een rij aan en onthoudt dat ze gewijzigd is
 *   - voegToe(lijst, object) voegt een nieuwe rij toe
 *   - bewaarTabel(tabel) schrijft enkel wat veranderd is terug naar de spreadsheet
 */

/** De kolommen van elk tabblad. De volgorde bepaalt enkel de opbouw bij installeren. */
var KOLOMMEN = {
  'Catalogus': [
    'boek_id', 'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas',
    'uitvoering', 'nieuwstaat', 'aanrader', 'genre', 'extra_onderwerpen', 'klassieker', 'aantal',
    'uitleenbaar', 'publiek', 'status', 'beschrijving', 'beschrijving_en', 'beschrijving_bron', 'cover_url', 'startpagina', 'leeslijsten', 'toegevoegd_op',
    // Films (zie Films.js): land, speelduur, kijktip. te_koop werkt voor elk boek of elke film.
    'land', 'duur', 'film_tip', 'te_koop',
    // De titel in de oorspronkelijke taal, als die verschilt (vooral films en vertaalde boeken).
    'originele_titel',
    // Vanaf hier: nooit publiek.
    'herkomst', 'isbn_origineel', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald',
    'cover_bron', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'wiki_gezocht',
    'letterboxd', 'imdb', 'wikidata', 'film_gezocht',
    // Interne notitie van het bestuur (bv. schade, plaats in de kast). Nooit publiek.
    'notitie'
  ],
  'Onderwerpen': ['genre', 'filtergroepen', 'aantal_boeken'],
  // notitie: enkel voor het bestuur. Verdwijnt met de lener bij de privacy-opruiming.
  'Leners': ['lenersnummer', 'voornaam', 'achternaam', 'telefoon', 'email', 'datum_inschrijving', 'toestemming_privacy', 'actief', 'notitie'],
  'Uitleningen': [
    'uitlening_id', 'exemplaar', 'boek_id', 'lenersnummer', 'datum_uit', 'oorspronkelijke_vervaldatum',
    'vervaldatum', 'datum_terug', 'aantal_verlengingen', 'datum_verlenging', 'borg', 'betaalwijze_borg',
    'borg_terugbetaald', 'gift', 'laatste_herinnering', 'vrijwilliger', 'bron',
    // Hoe het boek terugkwam (in orde, licht beschadigd, beschadigd), met een opmerking.
    'staat_terug',
    // De vervaldatum voor de laatste verlenging: zo kan je een verlenging annuleren.
    'vorige_vervaldatum'
  ],
  'Reservaties': [
    'reservatie_id', 'boek_id', 'lenersnummer', 'datum_reservatie', 'status', 'exemplaar',
    'datum_klaar', 'ophalen_tot', 'datum_afgesloten', 'vrijwilliger'
  ],
  'Uitzonderingen': ['datum', 'wie', 'grens', 'lenersnummer', 'boek_id', 'exemplaar', 'reden', 'actie'],
  'Na te kijken': ['datum', 'bron', 'boek_id', 'titel', 'veld', 'waarde_catalogus', 'waarde_bron', 'opmerking', 'afgehandeld', 'sleutel'],
  'Logboek': ['tijdstip', 'wie', 'actie', 'details'],
  // Online reserveren (Aanvragen.js). Bevat contactgegevens: nooit publiek.
  'Aanvragen': ['aanvraag_id', 'datum', 'boek_id', 'titel', 'voornaam', 'contact', 'opmerking', 'status', 'datum_afgehandeld', 'afgehandeld_door'],
  // Van vrijwilligers (Vrijwilligers.js): voorgestelde beschrijvingen en meldingen voor het bestuur.
  'Voorstellen': ['voorstel_id', 'datum', 'boek_id', 'titel', 'tekst', 'voorgesteld_door', 'status', 'behandeld_door', 'datum_behandeld'],
  'Meldingen': ['melding_id', 'datum', 'wie', 'soort', 'onderwerp', 'bericht', 'status', 'afgehandeld_door', 'datum_afgehandeld'],
  // Archief van de shifts: wie de bib openhield (bib) of back-up was, en gesloten avonden (Shifts.js).
  'Shifts': ['datum', 'rol', 'naam', 'event'],
  // Briefjes van vrijwilligers voor de volgende shift. Staan 14 dagen op Vandaag, gewist na briefjes_bewaren_dagen.
  'Briefjes': ['briefje_id', 'datum', 'wie', 'tekst', 'status', 'weg_door', 'datum_weg'],
  // Inhoud van de website. Kolommen op _en zijn de Engelse versie (mag leeg: dan toont de site het Nederlands).
  // online_vanaf: een bericht met een datum in de toekomst verschijnt pas op die dag.
  // voorgesteld_door: voornaam van de vrijwilliger die dit voorstelde. Leeg zodra het bestuur het online zet.
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'online_vanaf', 'voorgesteld_door', 'bron_id'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek', 'voorgesteld_door', 'bron_id'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek', 'bron_id'],
  // Leeslijsten (thema's). Welke boeken erin staan, zet je in de kolom leeslijsten van de Catalogus.
  // zichtbaar_vanaf en zichtbaar_tot: een geplande lijst verschijnt en verdwijnt vanzelf.
  'Leeslijsten': ['volgorde', 'naam', 'naam_en', 'uitleg', 'uitleg_en', 'publiek', 'zichtbaar_vanaf', 'zichtbaar_tot']
};

/** Kolommen met een getal. Staat er per ongeluk datumopmaak op, dan leest leesTabel toch het getal. */
var GETALKOLOMMEN = ['duur', 'jaartal', 'paginas', 'aantal'];

/** Het getal achter een datum in de spreadsheet: het aantal dagen sinds 30 december 1899. */
function datumNaarGetal(d) {
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

/** Kolommen met een datum. Die schrijven we als echte datum in de spreadsheet. */
// wiki_gezocht staat er bewust niet bij: die datum bewaren we als tekst (zie herstelKolom in Wikipedia.js).
var DATUMKOLOMMEN = [
  'datum_inschrijving', 'datum_uit', 'oorspronkelijke_vervaldatum', 'vervaldatum', 'datum_terug',
  'datum_verlenging', 'borg_terugbetaald', 'laatste_herinnering', 'datum_reservatie', 'datum_klaar',
  'ophalen_tot', 'datum_afgesloten', 'datum', 'ol_gecontroleerd', 'gb_gecontroleerd', 'toegevoegd_op', 'beschrijving_gezocht', 'beschrijving_vertaald', 'datum_afgehandeld', 'datum_behandeld', 'vorige_vervaldatum', 'datum_weg', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht',
  'online_vanaf', 'zichtbaar_vanaf', 'zichtbaar_tot'
];

/** Het actieve spreadsheetbestand. */
function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Tijdzone van het script, voor datums van vandaag. */
function tijdzone() {
  return Session.getScriptTimeZone() || 'Europe/Brussels';
}

/** De datum van vandaag als "JJJJ-MM-DD". */
function vandaagTekst() {
  return Utilities.formatDate(new Date(), tijdzone(), 'yyyy-MM-dd');
}

/**
 * Leest een tabblad in.
 * Geeft { naam, blad, kop, rijen } terug. Elke rij heeft een verborgen veld _rij
 * met het rijnummer in de spreadsheet. Volledig lege rijen slaan we over.
 */
function leesTabel(naam) {
  var blad = spreadsheet().getSheetByName(naam);
  if (!blad) throw new Error('Het tabblad "' + naam + '" bestaat niet. Voer eerst "Madrigal > Installeer tabbladen" uit.');
  var waarden = blad.getDataRange().getValues();
  var kop = (waarden[0] || []).map(function (k) { return schoon(k); });
  var rijen = [];
  for (var r = 1; r < waarden.length; r++) {
    var obj = { _rij: r + 1 };
    var leeg = true;
    for (var k = 0; k < kop.length; k++) {
      if (!kop[k]) continue;
      var w = waarden[r][k];
      // Een getal in een kolom met datumopmaak (96 minuten wordt 5/4/1900): terug naar het getal.
      if (isDatumObject(w) && GETALKOLOMMEN.indexOf(kop[k]) > -1) w = datumNaarGetal(w);
      else if (isDatumObject(w)) w = parseerDatum(w);
      // Een datum die iemand als tekst typte (20/11/2026), ook omzetten.
      else if (typeof w === 'string' && w && DATUMKOLOMMEN.indexOf(kop[k]) > -1) w = parseerDatum(w) || w;
      if (!isLeeg(w)) leeg = false;
      obj[kop[k]] = w;
    }
    if (!leeg) rijen.push(obj);
  }
  return { naam: naam, blad: blad, kop: kop, rijen: rijen };
}

/** Past velden van een rij aan en markeert de rij als gewijzigd. */
function wijzig(rij, velden) {
  if (!rij._velden) rij._velden = {};
  Object.keys(velden).forEach(function (k) { rij[k] = velden[k]; rij._velden[k] = true; });
  rij._gewijzigd = true;
  return rij;
}

/*
 * Achtergrondtaken (Wikipedia, vertalen, covers zoeken, ...) lopen tot 4,5 minuut. Hielden ze
 * al die tijd het slot vast, dan kregen de balie en het bestuur "Het is even druk".
 * Daarom:
 *   - startAchtergrond / stopAchtergrond: dezelfde taak loopt nooit twee keer tegelijk
 *     (een vlag in de cache, geen slot);
 *   - bewaarAchtergrond: neemt het slot enkel om te bewaren. Het leest het tabblad opnieuw in
 *     en schrijft enkel de velden die de taak aanpaste. Zo gaat niets verloren van wat
 *     iemand intussen aan de balie of in het bestuursscherm wijzigde.
 */
var ACHTERGROND_DUUR_SECONDEN = 6 * 60;

function startAchtergrond(naam) {
  var cache = CacheService.getScriptCache();
  if (cache.get('taak_' + naam)) return false;
  cache.put('taak_' + naam, String(Date.now()), ACHTERGROND_DUUR_SECONDEN);
  HUIDIGE_TAAK = naam;
  return true;
}

/** De tekst als iemand een taak start die al loopt. Zegt sinds wanneer en dat je niets hoeft te doen. */
function bezigTekst(waarde, tijdzone) {
  var sinds = Number(waarde);
  var uur = sinds ? ' (gestart om ' + Utilities.formatDate(new Date(sinds), tijdzone || 'Europe/Brussels', 'HH:mm') + ')' : '';
  return 'Deze bewerking loopt al op de achtergrond' + uur + '. Je hoeft niets te doen: ze gaat vanzelf verder en schrijft na elke ronde een regel in het Logboek.';
}

function meldAlBezig(naam) {
  var waarde = null;
  try { waarde = CacheService.getScriptCache().get('taak_' + naam); } catch (e) { /* geen cache */ }
  meld(bezigTekst(waarde, Session.getScriptTimeZone()));
}

function stopAchtergrond(naam) {
  try { CacheService.getScriptCache().remove('taak_' + naam); } catch (e) { /* vervalt vanzelf */ }
}

/**
 * Schrijft de aangepaste velden van een tabel weg onder een kort slot. Geeft true als het lukte.
 * Lukt het slot niet, dan blijven de rijen gemarkeerd: de volgende keer probeert de taak opnieuw.
 */
function bewaarAchtergrond(tabel) {
  var gewijzigd = tabel.rijen.filter(function (r) { return r._gewijzigd && !r._nieuw && !r._verwijderen; });
  if (!gewijzigd.length) return true;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return false;
  try {
    var vers = leesTabel(tabel.naam);
    voegVeldenSamen(gewijzigd, vers.rijen);
    bewaarTabel(vers);
  } finally {
    lock.releaseLock();
  }
  return true;
}

/**
 * Zet de aangepaste velden van oude rijen over naar vers ingelezen rijen. Herkenning op boek_id,
 * anders op rijnummer met dezelfde titel. Een rij die intussen weg is, slaan we over.
 */
function voegVeldenSamen(gewijzigd, versRijen) {
  var perId = {}, perRij = {};
  versRijen.forEach(function (r) {
    if (!isLeeg(r.boek_id)) perId[String(r.boek_id)] = r;
    perRij[r._rij] = r;
  });
  gewijzigd.forEach(function (oud) {
    var doel = !isLeeg(oud.boek_id) ? perId[String(oud.boek_id)] : perRij[oud._rij];
    if (doel && isLeeg(oud.boek_id) && schoon(doel.titel) !== schoon(oud.titel)) doel = null;
    if (doel) {
      var velden = {};
      Object.keys(oud._velden || {}).forEach(function (k) { velden[k] = oud[k]; });
      wijzig(doel, velden);
    }
    oud._gewijzigd = false;
    oud._velden = {};
  });
}

/** Voegt een nieuwe rij toe aan een lijst en markeert ze als nieuw. */
function voegToe(lijst, obj) {
  obj._nieuw = true;
  lijst.push(obj);
  return obj;
}

/** Markeert een rij om te verwijderen (enkel gebruikt bij de privacy-opruiming). */
function markeerVerwijderen(rij) {
  rij._verwijderen = true;
}

/** Zet een waarde om naar wat we in een cel schrijven. */
function celWaarde(kolom, waarde) {
  if (waarde === undefined || waarde === null) return '';
  if (DATUMKOLOMMEN.indexOf(kolom) > -1 && typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde)) {
    var d = waarde.split('-');
    // Middag, zodat zomer- en wintertijd de dag niet doen verspringen.
    return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), 12);
  }
  return veiligeCel(waarde);
}

/** Zet een rij-object om naar een lijst celwaarden volgens de kop. */
function rijNaarWaarden(kop, obj) {
  return kop.map(function (k) { return k ? celWaarde(k, obj[k]) : ''; });
}

/**
 * Schrijft de wijzigingen van een tabel terug: gewijzigde rijen op hun plaats,
 * nieuwe rijen onderaan, te verwijderen rijen van onder naar boven.
 */
function bewaarTabel(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  tabel.rijen.forEach(function (rij) {
    if (rij._gewijzigd && !rij._nieuw && !rij._verwijderen) {
      blad.getRange(rij._rij, 1, 1, kop.length).setValues([rijNaarWaarden(kop, rij)]);
      rij._gewijzigd = false;
      rij._velden = {};
    }
  });
  var nieuw = tabel.rijen.filter(function (r) { return r._nieuw; });
  if (nieuw.length) {
    var start = blad.getLastRow() + 1;
    blad.getRange(start, 1, nieuw.length, kop.length).setValues(nieuw.map(function (r) { return rijNaarWaarden(kop, r); }));
    nieuw.forEach(function (r, i) { r._nieuw = false; r._gewijzigd = false; r._rij = start + i; });
  }
  var weg = tabel.rijen.filter(function (r) { return r._verwijderen; }).map(function (r) { return r._rij; });
  weg.sort(function (a, b) { return b - a; }).forEach(function (rijnummer) { blad.deleteRow(rijnummer); });
  if (weg.length) tabel.rijen = tabel.rijen.filter(function (r) { return !r._verwijderen; });
}

/** Schrijft een volledige tabel in één keer (gebruikt bij de opbouw van de catalogus). */
function schrijfVolledig(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  var oud = blad.getLastRow();
  if (tabel.rijen.length) {
    blad.getRange(2, 1, tabel.rijen.length, kop.length).setValues(tabel.rijen.map(function (r) { return rijNaarWaarden(kop, r); }));
  }
  // Wat er vroeger onder stond (bv. lege rijen), maken we leeg.
  if (oud > tabel.rijen.length + 1) {
    blad.getRange(tabel.rijen.length + 2, 1, oud - tabel.rijen.length - 1, kop.length).clearContent();
  }
  tabel.rijen.forEach(function (r, i) { r._rij = i + 2; r._nieuw = false; r._gewijzigd = false; });
}

/**
 * Geeft een nieuw, uniek volgnummer. Het laatste nummer staat in de
 * scripteigenschappen, zodat een gewist nummer nooit opnieuw gebruikt wordt.
 * bestaande: lijst met bestaande waarden, om bij de eerste keer verder te tellen.
 */
function volgendNummer(sleutel, bestaande) {
  var props = PropertiesService.getScriptProperties();
  var laatste = Number(props.getProperty('teller_' + sleutel) || 0);
  bestaande.forEach(function (w) {
    var n = Number(String(w).replace(/\D/g, ''));
    if (n > laatste) laatste = n;
  });
  laatste += 1;
  props.setProperty('teller_' + sleutel, String(laatste));
  return laatste;
}

/** Vult een nummer aan met nullen: 7 wordt "0007". */
function metNullen(n, breedte) {
  var s = String(n);
  while (s.length < breedte) s = '0' + s;
  return s;
}

/**
 * Schrijft een regel in het Logboek. Zet hier nooit contactgegevens in,
 * enkel nummers (boek-ID, lenersnummer, uitlening-ID).
 * De nieuwste regel komt bovenaan, net onder de kop: zo hoef je niet te scrollen.
 */
function logboek(wie, actie, details) {
  var blad = spreadsheet().getSheetByName('Logboek');
  if (!blad) return;
  var rij = [new Date(), veiligeCel(schoon(wie) || 'systeem'), actie, veiligeCel(details || '')];
  if (blad.getLastRow() < 2) { blad.appendRow(rij); return; }
  blad.insertRowBefore(2); // neemt de opmaak van een gewone rij over, niet die van de kop
  blad.getRange(2, 1, 1, rij.length).setValues([rij]);
}

/** Zet de bestaande regels van het Logboek eenmalig met de nieuwste bovenaan (bij Installeer tabbladen). */
function logboekNieuwsteBoven(blad) {
  if (!blad || blad.getLastRow() < 3) return;
  blad.getRange(2, 1, blad.getLastRow() - 1, Math.max(4, blad.getLastColumn())).sort({ column: 1, ascending: false });
}
