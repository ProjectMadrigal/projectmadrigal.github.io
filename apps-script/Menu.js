/**
 * Menu.js
 * Het menu "Madrigal" in de spreadsheet, en de installatie van de tabbladen.
 */

/**
 * Menu: maakt de nieuwe tabbladen aan. Bestaande tabbladen en gegevens blijven
 * staan: enkel ontbrekende tabbladen, kolommen en instellingen komen erbij.
 */
/** Instellingen met een toegangscode: leeg betekent bij het installeren een nieuwe willekeurige code. */
var CODE_INSTELLINGEN = ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur'];

/**
 * Lichte versie van installeer: maakt enkel de genoemde tabbladen aan en voegt ontbrekende kolommen toe.
 * Andere tabbladen blijven onaangeroerd (installeer ordent en herschikt alles, dat duurt en springt rond).
 */
function zorgVoorTabbladen(namen) {
  var ss = spreadsheet();
  namen.forEach(function (naam) {
    var kolommen = KOLOMMEN[naam];
    if (!kolommen) return;
    var blad = ss.getSheetByName(naam);
    if (!blad) {
      blad = ss.insertSheet(naam);
      blad.getRange(1, 1, 1, kolommen.length).setValues([kolommen]);
      opmaakKop(blad, kolommen.length);
      return;
    }
    var kop = blad.getLastRow() > 0 ? blad.getRange(1, 1, 1, Math.max(1, blad.getLastColumn())).getValues()[0].map(schoon) : [];
    var ontbrekend = kolommen.filter(function (k) { return kop.indexOf(k) === -1; });
    if (!ontbrekend.length) return;
    var start = kop.some(function (k) { return k; }) ? blad.getLastColumn() + 1 : 1;
    blad.getRange(1, start, 1, ontbrekend.length).setValues([ontbrekend]);
    opmaakKop(blad, blad.getLastColumn());
  });
}

function installeer() {
  var ss = spreadsheet();

  // Instellingen: sleutel, waarde, uitleg.
  var inst = ss.getSheetByName('Instellingen') || ss.insertSheet('Instellingen');
  if (inst.getLastRow() === 0) {
    inst.appendRow(['sleutel', 'waarde', 'uitleg']);
    opmaakKop(inst, 3);
  }
  var bestaand = {};
  inst.getDataRange().getValues().slice(1).forEach(function (r) { bestaand[schoon(r[0])] = r[1]; });
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    if (bestaand.hasOwnProperty(rij[0])) {
      // Een lege code vullen we in met een willekeurige code.
      if (CODE_INSTELLINGEN.indexOf(rij[0]) > -1 && isLeeg(bestaand[rij[0]])) {
        zetInstelling(inst, rij[0], willekeurigeCode());
      }
      return;
    }
    var waarde = rij[1];
    if (CODE_INSTELLINGEN.indexOf(rij[0]) > -1) waarde = willekeurigeCode();
    inst.appendRow([rij[0], waarde, rij[2]]);
  });
  ordenInstellingen(ss); // per thema, met tussenkoppen (zie Ordenen.js)
  inst.setColumnWidth(1, 280);
  inst.setColumnWidth(2, 380);
  inst.setColumnWidth(3, 480);
  inst.getRange(1, 2, inst.getLastRow(), 2).setWrap(true);

  // De andere tabbladen met hun kolommen.
  Object.keys(KOLOMMEN).forEach(function (naam) {
    var blad = ss.getSheetByName(naam) || ss.insertSheet(naam);
    var kolommen = KOLOMMEN[naam];
    var kop = blad.getLastRow() > 0 ? blad.getRange(1, 1, 1, Math.max(1, blad.getLastColumn())).getValues()[0].map(schoon) : [];
    var ontbrekend = kolommen.filter(function (k) { return kop.indexOf(k) === -1; });
    if (ontbrekend.length) {
      var start = blad.getLastColumn() + 1;
      if (!kop.some(function (k) { return k; })) start = 1;
      blad.getRange(1, start, 1, ontbrekend.length).setValues([ontbrekend]);
    }
    opmaakKop(blad, blad.getLastColumn());
  });

  // Tekstopmaak voor kolommen die tekst moeten blijven (ISBN, telefoon, lenersnummer, en titels zoals 24/7 die anders een datum worden).
  zetTekstopmaak(ss.getSheetByName('Catalogus'), ['isbn', 'boek_id', 'wiki_gezocht', 'titel', 'originele_titel', 'auteur']);
  zetGetalopmaak(ss.getSheetByName('Catalogus'), ['duur', 'te_koop_aantal']);
  zetGetalopmaak(ss.getSheetByName('Catalogus'), ['prijs'], '0.00');
  zetGetalopmaak(ss.getSheetByName('Standje boeken'), ['prijs'], '0.00');
  zetGetalopmaak(ss.getSheetByName('Verkopen'), ['prijs'], '0.00');
  zetTekstopmaak(ss.getSheetByName('Leners'), ['telefoon']);

  // Kolom status: een keuzelijst, met uitleg bij de kop.
  var cat = ss.getSheetByName('Catalogus');
  var catKop = cat.getRange(1, 1, 1, cat.getLastColumn()).getValues()[0].map(schoon);
  var si = catKop.indexOf('status');
  if (si > -1) {
    cat.getRange(2, si + 1, Math.max(1, cat.getMaxRows() - 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(BOEKSTATUSSEN, true).setAllowInvalid(true).build());
    cat.getRange(1, si + 1).setNote('Leeg = gewoon.\nverloren: niet op de website, niet uitleenbaar.\n' +
      'gevoelig verborgen: niet op de website, wel uitleenbaar.\ngevoelig zichtbaar: op de website met het label "Gevoelige inhoud".');
  }

  // Brede tabbladen overzichtelijk: vaste eerste kolommen, kleur per thema, uitleg bij elke kop,
  // niet-publieke kolommen schuin en grijs, technische kolommen ingeklapt (Kolommen.js).
  maakTabbladenOverzichtelijk(true);

  // Planning: elke nacht de privacy-opruiming, elke maandagnacht een back-up,
  // en de cache legen bij een wijziging.
  verwijderTriggers('ruimOp');
  verwijderTriggers('bijWijziging');
  verwijderTriggers('maakBackup');
  verwijderTriggers('verwerkNieuweBoekenAutomatisch');
  verwijderTriggers('haalPeperfabriekOp');
  ScriptApp.newTrigger('verwerkNieuweBoekenAutomatisch').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('ruimOp').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('haalPeperfabriekOp').timeBased().everyDays(1).atHour(5).create();
  ScriptApp.newTrigger('maakBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
  ScriptApp.newTrigger('bijWijziging').forSpreadsheet(ss).onEdit().create();

  // Het tabblad Voorraad (Verkoop.js): een overzicht dat het script zelf schrijft.
  try { schrijfVoorraad(leesTabel('Catalogus').rijen, leesTabel('Verkopen').rijen); } catch (e) { /* later via Madrigal > Verkoop */ }

  ordenTabbladen(ss);
  logboekNieuwsteBoven(ss.getSheetByName('Logboek'));
  naTeKijkenNieuwsteBoven();
  logboek('menu', 'installeer', 'tabbladen klaar');
  meld('De tabbladen staan klaar. Kijk in Instellingen de codes en teksten na.');
}

/**
 * Zet het menu klaar telkens de spreadsheet opent. Bovenaan wat je het vaakst nodig hebt,
 * daarna een deelmenu per onderwerp, en achteraan wat je enkel bij de start gebruikt.
 * Een nieuw menu-item? Zet het in het passende deelmenu, en verwijs in de README en in
 * meldingen naar "Madrigal > Deelmenu > Item".
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Madrigal')
    // Vaak nodig.
    .addItem('Ververs de publieke catalogus', 'verversMenu')
    .addItem('Installeer tabbladen (na een nieuw script)', 'installeer')
    .addSeparator()
    // De collectie: boeken, titels, covers, beschrijvingen, films en verkoop.
    .addSubMenu(ui.createMenu('Boeken')
      .addItem('Nieuwe boeken verwerken', 'verwerkNieuweBoeken')
      .addItem('Vul gegevens aan uit Open Library', 'vulAanUitOpenLibrary')
      .addItem('Werk de vertaaltabel Onderwerpen bij', 'werkOnderwerpenBijMenu')
      .addSeparator()
      .addItem('Onderwerpen: vul ontbrekende aan', 'vulOntbrekendeOnderwerpenMenu')
      .addItem('Onderwerpen: pas de nakijklijst toe', 'pasOnderwerpNakijklijstToe')
      .addSeparator()
      .addItem('Genres en thema\'s: kuis op (zelfde schrijfwijze)', 'kuisGenresOp')
      .addItem('Categorieën en trefwoorden: vernieuw de lijst en de keuzelijsten', 'vernieuwCategorieenMenu')
      .addItem('Deel de boeken in op titel en beschrijving (thema, categorie, trefwoord)', 'deelBoekenInMenu'))
    .addSubMenu(ui.createMenu('Titels en auteurs')
      .addItem('Schrijfwijze: maak een nakijklijst', 'maakTitelNakijklijst')
      .addItem('Schrijfwijze: pas de nakijklijst toe', 'pasTitelNakijklijstToe')
      .addSeparator()
      .addItem('Titelcontrole in de bib: maak de lijst', 'maakTitelcontroleMenu'))
    .addSubMenu(ui.createMenu('Covers')
      .addItem('Zoek covers bij Google Books', 'vulAanUitGoogleBooks')
      .addItem('Zoek covers bij bol.com', 'zoekCoversBol')
      .addItem('Zoek covers bij Internet Archive', 'zoekCoversInternetArchive')
      .addItem('Zoek covers van andere uitgaven', 'zoekCoversAndereUitgaven')
      .addSeparator()
      .addItem('Zoek opnieuw bij Google', 'zoekCoversOpnieuw')
      .addItem('Internet Archive: zoek de boeken van vandaag opnieuw', 'zoekIaVanVandaagOpnieuw')
      .addItem('Verwijder standaardafbeeldingen (zoals LibraryThing)', 'verwijderStandaardCovers'))
    .addSubMenu(ui.createMenu('Beschrijvingen')
      .addItem('Zoek ontbrekende beschrijvingen', 'vulBeschrijvingenAan')
      .addItem('Zoek beschrijvingen bij Wikipedia', 'zoekBeschrijvingenWikipedia')
      .addItem('Zoek afgebroken beschrijvingen opnieuw', 'herstelAfgebrokenBeschrijvingen')
      .addSeparator()
      .addItem('Vertaal de beschrijvingen', 'vertaalBeschrijvingen'))
    .addSubMenu(ui.createMenu('Films')
      .addItem('Haal de Letterboxd-lijst op', 'haalLetterboxdLijst')
      .addItem('Neem de films over uit dit tabblad (CSV van IMDb of Letterboxd)', 'neemFilmsOverUitTabblad')
      .addItem('Vul de films aan (Wikidata en Wikipedia)', 'vulFilmsAan')
      .addItem('Deel de films in op titel en beschrijving (trefwoorden)', 'deelFilmsInMenu'))
    .addSubMenu(ui.createMenu('Verkoop')
      .addItem('Werk de voorraad bij', 'voorraadBijwerkenMenu'))
    .addSeparator()
    // De spreadsheet zelf.
    .addSubMenu(ui.createMenu('Spreadsheet en onderhoud')
      .addItem('Orden tabbladen en instellingen', 'ordenAlles')
      .addItem('Maak de brede tabbladen overzichtelijk', 'maakTabbladenOverzichtelijk')
      .addSeparator()
      .addItem('Maak nu een back-up', 'maakBackupMenu')
      .addItem('Privacy-opruiming nu uitvoeren', 'ruimOp')
      .addItem('Zet de gsm-nummers van de leners in één vorm (0495/64.48.48)', 'gsmNummersMenu'))
    .addSubMenu(ui.createMenu('Testen')
      .addItem('Test Google Books (kies eerst een cel met een ISBN)', 'testGoogleBooks')
      .addItem('Test bol.com (kies eerst een cel met een ISBN)', 'testBol')
      .addItem('Wikipedia: test het opzoeken', 'testWikipedia')
      .addItem('Wikipedia: test het bewaren', 'testWikipediaBewaren')
      .addItem('Peperfabriek: test het ophalen', 'testPeperfabriek'))
    .addSeparator()
    // Eenmalig: de overstap naar dit systeem en van de oude website.
    .addSubMenu(ui.createMenu('Eenmalig bij de start')
      .addItem('Bouw de catalogus uit Stock en Zines', 'maakCatalogus')
      .addItem('Vul aan uit Goodreads', 'vulAanUitGoodreads')
      .addItem('Neem de uitleningen over (lopend en historiek)', 'neemUitleningenOver')
      .addItem('Neem een oud rooster over uit de tabbladen (een tabblad per maand)', 'neemRoosterOverUitTabbladen')
      .addItem('Neem het draaiboek voor vrijwilligers over (checklists en vragen)', 'neemDraaiboekOver')
      .addItem('Verdeel Geschiedenis en maatschappij in drie thema\'s', 'verdeelOudeGroepMenu')
      .addItem('Wis de aanraders die uit de stocklijst kwamen', 'wisAanradersUitStock')
      .addSeparator()
      .addItem('Oude website: neem nieuws, agenda en vragen over', 'importeerOudeSite')
      .addItem('Oude website: neem beschrijvingen, covers, categorieën en thema\'s van de boeken over', 'neemOudeBoekenOver')
      .addItem('Oude website: neem de rijen uit Na te kijken over met overnemen = ja', 'neemAangeduideOudeBoekenOver')
      .addItem('Oude website: kopieer de covers verder', 'startOudeCovers')
      .addSeparator()
      .addItem('Catalogus wissen en opnieuw opbouwen', 'herbouwCatalogus'))
    .addToUi();
}

function werkOnderwerpenBijMenu() {
  var nieuw = werkOnderwerpenBij();
  leegCache();
  meld(nieuw + ' nieuwe genres toegevoegd aan Onderwerpen. Kijk de kolom filtergroepen na.');
}

function verversMenu() {
  leegCache();
  meld('De publieke catalogus haalt bij de volgende opvraging alles vers op.');
}

/** Bij elke wijziging met de hand in Catalogus, Onderwerpen of Instellingen: cache leegmaken. */
function bijWijziging(e) {
  var naam = e && e.range ? e.range.getSheet().getName() : '';
  if (['Catalogus', 'Onderwerpen', 'Instellingen', 'Uitleningen', 'Reservaties', 'Nieuws', 'Agenda', 'Vaste events', 'Veelgestelde vragen', 'Leeslijsten'].indexOf(naam) > -1) leegCache();
  if (naam === 'Catalogus') voorraadBijWijziging(e); // zie Verkoop.js
}

/** Opmaak van de kopregel: vet, vastgezet. */
function opmaakKop(blad, kolommen) {
  if (kolommen < 1) return;
  blad.getRange(1, 1, 1, kolommen).setFontWeight('bold');
  blad.setFrozenRows(1);
}

/** Zet de opmaak van kolommen op tekst, zodat 0470... en ISBN's niet als getal verminkt worden. */
function zetTekstopmaak(blad, kolommen) {
  if (!blad) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  kolommen.forEach(function (k) {
    var i = kop.indexOf(k);
    if (i > -1 && blad.getMaxRows() > 1) blad.getRange(2, i + 1, blad.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

/**
 * Zet de opmaak van kolommen op een gewoon getal. Een nieuwe kolom erft soms de datumopmaak van de
 * kolom ernaast: dan wordt 96 minuten 5/4/1900. Een datum die er al staat, wordt terug het getal.
 * opmaak: '0' (standaard, gehele getallen) of bv. '0.00' voor een prijs.
 */
function zetGetalopmaak(blad, kolommen, opmaak) {
  if (!blad || blad.getLastRow() < 2) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  kolommen.forEach(function (k) {
    var i = kop.indexOf(k);
    if (i === -1) return;
    var bereik = blad.getRange(2, i + 1, blad.getLastRow() - 1, 1);
    var waarden = bereik.getValues();
    var anders = false;
    waarden.forEach(function (r) { if (isDatumObject(r[0])) { r[0] = datumNaarGetal(r[0]); anders = true; } });
    bereik.setNumberFormat(opmaak || '0');
    if (anders) bereik.setValues(waarden);
  });
}

/** Past één instelling aan in het tabblad. */
function zetInstelling(blad, sleutel, waarde) {
  var waarden = blad.getDataRange().getValues();
  for (var r = 1; r < waarden.length; r++) {
    if (schoon(waarden[r][0]) === sleutel) {
      blad.getRange(r + 1, 2).setValue(waarde);
      return;
    }
  }
}

/** Een willekeurige code van 8 tekens, zonder tekens die je makkelijk verwart (0/O, 1/l). */
function willekeurigeCode() {
  var tekens = 'abcdefghjkmnpqrstuvwxyz23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += tekens.charAt(Math.floor(Math.random() * tekens.length));
  return code;
}

/** Menu: zet de gsm-nummers in het tabblad Leners in één vorm. */
function gsmNummersMenu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var tabel = leesTabel('Leners');
    var n = gsmNummersOpmaken(tabel.rijen);
    if (n) bewaarTabel(tabel);
    leegCache();
    logboek('menu', 'gsmNummersMenu', n + ' leners aangepast');
    meld(n ? n + ' gsm-nummers staan nu in de vorm 0495/64.48.48. Vaste en buitenlandse nummers bleven zoals ze waren.' : 'Alle gsm-nummers stonden al in de vorm 0495/64.48.48.');
  } finally {
    lock.releaseLock();
  }
}
