/**
 * Ordenen.js
 * Zet de tabbladen en de instellingen in een vaste, logische volgorde.
 *
 *   - Instellingen: per thema, met een tussenkop per groep. Een Engelse tekst
 *     staat vlak onder de Nederlandse. Waarden blijven altijd behouden.
 *   - Tabbladen: eerst wat je dagelijks gebruikt, achteraan wat zelden nodig
 *     is, met een kleur per groep.
 *
 * "Madrigal > Installeer tabbladen" doet dit vanzelf. Je kan het ook apart uitvoeren via
 * het menu: Madrigal > Onderhoud > Orden tabbladen en instellingen.
 *
 * Een nieuwe instelling toevoegen? Zet ze in STANDAARD_INSTELLINGEN
 * (Instellingen.js) én in een groep hieronder. Een test controleert dat.
 */

// Vijf blokken, van vaak naar zelden gebruikt: Uitlenen, Vrijwilligers, Website, Privacy, Techniek.
// De codes staan in Techniek, onderaan: zo staan ze niet meteen in beeld als je het tabblad opent.
var INSTELLING_GROEPEN = [
  ['Uitlenen', ['uitleentermijn_weken', 'verlengingstermijn_weken', 'max_verlengingen', 'verlengen_niet_bij_reservatie',
    'max_boeken_per_lener', 'waarschuwing_dagen_voor_vervaldatum', 'ophaaltermijn_openingsdagen', 'zines_te_koop_uitleenbaar']],
  ['Uitlenen: borg en giften', ['borg_per_boek', 'borg_betaalwijzen', 'gift_mogelijk']],
  ['Uitlenen: openingsdagen en -uren', ['openingsdagen', 'terugbrengdatum_op_openingsdag', 'gesloten_data', 'openingsuren', 'openingsuren_en']],
  ['Uitlenen: herinneringen', ['tekst_herinnering', 'tekst_herinnering_binnenkort']],
  ['Uitlenen: online reserveren', ['online_reserveren']],
  ['Vrijwilligers: shift', ['tekst_checklist_openen', 'tekst_checklist_sluiten', 'tekst_checklist_uitlenen']],
  ['Vrijwilligers: handleiding', ['tekst_handleiding', 'tekst_handleiding_en']],
  ['Vrijwilligers: rooster', ['rooster_link', 'tekst_vaste_events']],
  ['Website: contact', ['adres', 'mail_algemeen', 'mail_events']],
  ['Website: startpagina en aanraders', ['nieuw_op_startpagina_dagen', 'nieuw_op_startpagina_aantal', 'aanraders_uit_stocklijst', 'aanraders_verbergen']],
  ['Website: teksten bij Boeken', ['tekst_welkom', 'tekst_welkom_en', 'tekst_uitleg_lenen', 'tekst_uitleg_lenen_en', 'tekst_privacy', 'tekst_privacy_en']],
  ['Website: leeslijsten', ['leeslijsten_tonen']],
  ['Website: Doe mee', ['tekst_vrijwilliger', 'tekst_vrijwilliger_en', 'tekst_schenken', 'tekst_schenken_en', 'tekst_steunen', 'tekst_steunen_en']],
  ['Website: Antwerp Queer Bookclub', ['bookclub_naam', 'bookclub_week', 'bookclub_dag', 'bookclub_uur', 'tekst_bookclub', 'tekst_bookclub_en', 'bookclub_link']],
  ['Website: De Peperfabriek', ['peperfabriek_url', 'tekst_peperfabriek', 'tekst_peperfabriek_en', 'peperfabriek_aantal']],
  ['Website: films', ['films_tonen', 'tekst_films', 'tekst_films_en']],
  ['Privacy: bewaartermijnen', ['bewaartermijn_afgesloten_uitleningen_maanden', 'aanvragen_bewaren_dagen', 'meldingen_bewaren_dagen', 'briefjes_bewaren_dagen']],
  ['Techniek: toegang (codes)', ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur']],
  ['Techniek: koppeling met het rooster', ['rooster_url', 'rooster_code']],
  ['Techniek: boek- en filmgegevens aanvullen', ['goodreads_shelf', 'google_books_api_key', 'bol_client_id', 'bol_client_secret', 'cover_map', 'letterboxd_lijst']],
  ['Techniek: bezoekers van de website', ['goatcounter_code', 'goatcounter_api_sleutel']],
  ['Techniek: back-up', ['backup_map', 'backup_bewaren']]
];

var TABBLAD_GROEPEN = [
  ['#6b3597', ['Uitleningen', 'Reservaties', 'Aanvragen', 'Leners', 'Uitzonderingen', 'Meldingen', 'Briefjes']],      // uitlenen
  ['#ffcd30', ['Catalogus', 'Onderwerpen', 'Voorstellen', 'Na te kijken']],                     // collectie
  ['#2a6f73', ['Nieuws', 'Agenda', 'Veelgestelde vragen', 'Leeslijsten']],       // website
  ['#1b1b1c', ['Instellingen', 'Logboek', 'Shifts']],                                      // beheer
  ['#bdbdbd', ['Stock', 'Zines', 'Goodreads-export']]                            // bronnen, zelden nodig
];

/** Een tussenkop in het tabblad Instellingen: "── UITLENEN ──". */
function instellingKop(titel) {
  return '── ' + titel.toUpperCase() + ' ──';
}

function isInstellingKop(sleutel) {
  return /^──/.test(String(sleutel || ''));
}

/**
 * Zet de rijen van het tabblad Instellingen (zonder kopregel) in de volgorde
 * van INSTELLING_GROEPEN. Elke rij is [sleutel, waarde, uitleg].
 *   - Bestaande waarden blijven staan. De uitleg komt uit STANDAARD_INSTELLINGEN.
 *   - Ontbrekende instellingen komen erbij met hun standaardwaarde.
 *   - Onbekende sleutels (bv. zelf toegevoegd) gaan naar een groep "Overige".
 *   - Oude tussenkoppen en lege rijen verdwijnen.
 * Geeft { rijen, koppen } terug: koppen zijn de indexen van de tussenkoppen.
 */
function ordenInstellingRijen(bestaand) {
  var perSleutel = {};
  var volgorde = [];
  bestaand.forEach(function (r) {
    var s = schoon(r[0]);
    if (!s || isInstellingKop(s) || perSleutel.hasOwnProperty(s)) return;
    perSleutel[s] = r;
    volgorde.push(s);
  });
  var standaard = {};
  STANDAARD_INSTELLINGEN.forEach(function (r) { standaard[r[0]] = r; });

  var rijen = [], koppen = [], gebruikt = {};
  function groep(titel, sleutels) {
    if (!sleutels.length) return;
    koppen.push(rijen.length);
    rijen.push([instellingKop(titel), '', '']);
    sleutels.forEach(function (s) {
      gebruikt[s] = true;
      var oud = perSleutel[s];
      var std = standaard[s];
      rijen.push([s, oud ? oud[1] : (std ? std[1] : ''), std ? std[2] : (oud ? oud[2] || '' : '')]);
    });
  }
  INSTELLING_GROEPEN.forEach(function (g) {
    groep(g[0], g[1].filter(function (s) { return standaard.hasOwnProperty(s) || perSleutel.hasOwnProperty(s); }));
  });
  // Staat een standaardinstelling in geen enkele groep, dan toch niet verliezen.
  var rest = STANDAARD_INSTELLINGEN.map(function (r) { return r[0]; })
    .concat(volgorde)
    .filter(function (s, i, lijst) { return !gebruikt[s] && lijst.indexOf(s) === i; });
  groep('Overige', rest);
  return { rijen: rijen, koppen: koppen };
}

/**
 * De volgorde van de tabbladen: eerst die uit TABBLAD_GROEPEN (als ze bestaan),
 * daarna alle andere in hun huidige volgorde. Geeft [{ naam, kleur }] terug.
 */
function tabbladVolgorde(namen) {
  var uit = [], gezien = {};
  TABBLAD_GROEPEN.forEach(function (g) {
    g[1].forEach(function (naam) {
      if (namen.indexOf(naam) > -1) { uit.push({ naam: naam, kleur: g[0] }); gezien[naam] = true; }
    });
  });
  namen.forEach(function (naam) { if (!gezien[naam]) uit.push({ naam: naam, kleur: null }); });
  return uit;
}

/** Herschikt het tabblad Instellingen per thema. */
function ordenInstellingen(ss) {
  var blad = ss.getSheetByName('Instellingen');
  if (!blad || blad.getLastRow() < 1) return;
  var oud = blad.getLastRow() > 1 ? blad.getRange(2, 1, blad.getLastRow() - 1, 3).getValues() : [];
  var nieuw = ordenInstellingRijen(oud);
  if (!nieuw.rijen.length) return;
  // Eerst alles lezen, dan in één keer schrijven: zo gaat er geen waarde verloren.
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, 3).clear();
  blad.getRange(2, 1, nieuw.rijen.length, 3).setValues(nieuw.rijen).setVerticalAlignment('top');
  blad.getRange(2, 2, nieuw.rijen.length, 2).setWrap(true);
  nieuw.koppen.forEach(function (i) {
    blad.getRange(i + 2, 1, 1, 3).setBackground('#e6dcf2').setFontWeight('bold');
  });
  opmaakKop(blad, 3);
}

/** Zet de tabbladen in vaste volgorde, met een kleur per groep. */
function ordenTabbladen(ss) {
  var volgorde = tabbladVolgorde(ss.getSheets().map(function (b) { return b.getName(); }));
  volgorde.forEach(function (t, i) {
    var blad = ss.getSheetByName(t.naam);
    ss.setActiveSheet(blad);
    ss.moveActiveSheet(i + 1);
    if (t.kleur) blad.setTabColor(t.kleur);
  });
  ss.setActiveSheet(ss.getSheets()[0]);
}

/** Menu: orden de tabbladen en de instellingen. */
function ordenAlles() {
  var ss = spreadsheet();
  ordenInstellingen(ss);
  ordenTabbladen(ss);
  leegCache();
  meld('De tabbladen en de instellingen staan nu geordend.');
}
