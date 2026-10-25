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
    'uitleenbaar', 'publiek', 'status', 'beschrijving', 'beschrijving_en', 'beschrijving_bron', 'cover_url', 'startpagina', 'toegevoegd_op',
    // Vanaf hier: nooit publiek.
    'herkomst', 'isbn_origineel', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald',
    'cover_bron', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'wiki_gezocht'
  ],
  'Onderwerpen': ['genre', 'filtergroepen', 'aantal_boeken'],
  'Leners': ['lenersnummer', 'voornaam', 'achternaam', 'telefoon', 'email', 'datum_inschrijving', 'toestemming_privacy', 'actief'],
  'Uitleningen': [
    'uitlening_id', 'exemplaar', 'boek_id', 'lenersnummer', 'datum_uit', 'oorspronkelijke_vervaldatum',
    'vervaldatum', 'datum_terug', 'aantal_verlengingen', 'datum_verlenging', 'borg', 'betaalwijze_borg',
    'borg_terugbetaald', 'gift', 'laatste_herinnering', 'vrijwilliger', 'bron'
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
  // Inhoud van de website. Kolommen op _en zijn de Engelse versie (mag leeg: dan toont de site het Nederlands).
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'bron_id'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek', 'bron_id'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek', 'bron_id']
};

/** Kolommen met een datum. Die schrijven we als echte datum in de spreadsheet. */
var DATUMKOLOMMEN = [
  'datum_inschrijving', 'datum_uit', 'oorspronkelijke_vervaldatum', 'vervaldatum', 'datum_terug',
  'datum_verlenging', 'borg_terugbetaald', 'laatste_herinnering', 'datum_reservatie', 'datum_klaar',
  'ophalen_tot', 'datum_afgesloten', 'datum', 'ol_gecontroleerd', 'gb_gecontroleerd', 'toegevoegd_op', 'beschrijving_gezocht', 'beschrijving_vertaald', 'datum_afgehandeld', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'wiki_gezocht'
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
  if (!blad) throw new Error('Het tabblad "' + naam + '" bestaat niet. Voer eerst "Installeer tabbladen" uit.');
  var waarden = blad.getDataRange().getValues();
  var kop = (waarden[0] || []).map(function (k) { return schoon(k); });
  var rijen = [];
  for (var r = 1; r < waarden.length; r++) {
    var obj = { _rij: r + 1 };
    var leeg = true;
    for (var k = 0; k < kop.length; k++) {
      if (!kop[k]) continue;
      var w = waarden[r][k];
      if (isDatumObject(w)) w = parseerDatum(w);
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
  Object.keys(velden).forEach(function (k) { rij[k] = velden[k]; });
  rij._gewijzigd = true;
  return rij;
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
 */
function logboek(wie, actie, details) {
  var blad = spreadsheet().getSheetByName('Logboek');
  if (!blad) return;
  blad.appendRow([new Date(), veiligeCel(schoon(wie) || 'systeem'), actie, veiligeCel(details || '')]);
}
