/**
 * Instellingen.js
 * De standaardwaarden voor het tabblad Instellingen, en het inlezen ervan.
 * Wil je een nieuwe instelling toevoegen? Zet ze in de lijst hieronder én in een
 * groep in Ordenen.js, en voer daarna "Madrigal > Installeer tabbladen" uit: ontbrekende
 * sleutels worden aangevuld, bestaande waarden blijven staan, en het tabblad
 * wordt per thema geordend.
 */

var STANDAARD_INSTELLINGEN = [
  ['uitleentermijn_weken', 4, 'Hoeveel weken een lener een boek mag houden.'],
  ['verlengingstermijn_weken', 4, 'Hoeveel weken er bij een verlenging bijkomen.'],
  ['max_verlengingen', 1, 'Hoe vaak een lener een boek mag verlengen. Meer kan, maar dan als uitzondering met een reden.'],
  ['verlengen_niet_bij_reservatie', 'ja', 'ja: verlengen kan niet (zonder uitzondering) als iemand anders het boek gereserveerd heeft.'],
  ['max_boeken_per_lener', 2, 'Hoeveel boeken een lener tegelijk mag lenen. Meer kan, maar dan als uitzondering met een reden.'],
  ['borg_per_boek', 5, 'Borg in euro per boek. Het uitleenscherm vult dit bedrag voor.'],
  ['borg_betaalwijzen', 'cash, QR', 'Hoe iemand de borg kan betalen, gescheiden door komma\'s.'],
  ['gift_mogelijk', 'ja', 'ja: het uitleenscherm toont een veld voor een vrijwillige gift.'],
  ['openingsdagen', 'vrijdag', 'Op welke weekdagen de bib open is, gescheiden door komma\'s.'],
  ['terugbrengdatum_op_openingsdag', 'ja', 'ja: de terugbrengdatum schuift op naar de eerstvolgende openingsdag.'],
  ['gesloten_data', '', 'Openingsdagen waarop de bib toch dicht is. Schrijf ze als 25/12/2026, gescheiden door komma\'s.'],
  ['waarschuwing_dagen_voor_vervaldatum', 7, 'Vanaf hoeveel dagen voor de vervaldatum een uitlening "vervalt binnenkort" krijgt.'],
  ['ophaaltermijn_openingsdagen', 2, 'Hoeveel openingsdagen een gereserveerd boek apart blijft liggen. Daarna gaat het naar de volgende in de wachtrij.'],
  ['toegangscode_balie', '', 'Code voor de vrijwilligers aan de balie. Wijzig ze als ze uitlekt.'],
  ['rooster_url', '', 'Optioneel. De URL van de web-app van het vrijwilligersrooster (eindigt op /exec). Dan tonen de balie en het bestuur het rooster.'],
  ['rooster_code', '', 'De toegangscode voor vrijwilligers van het rooster. Blijft op de server, de browser ziet ze nooit.'],
  ['rooster_link', 'https://projectmadrigal.github.io/rooster/', 'Adres van de roostertool, voor de knop "Beschikbaarheid invullen".'],
  ['code_bestuur', '', 'Code voor het bestuursscherm. Geef ze enkel aan het bestuur.'],
  ['code_vrijwilliger', '', 'Code voor het vrijwilligersscherm: uitleningen nakijken, covers toevoegen, nieuws en agenda voorstellen, leeslijsten opmaken. Werkt ook aan de balie. Geef ze aan vaste vrijwilligers.'],
  ['leeslijsten_tonen', 'nee', 'ja: de leeslijsten staan op de website, met een eigen plek in het menu. nee: ze staan klaar, maar enkel het bestuursscherm toont ze.'],
  ['online_reserveren', 'nee', 'ja: de website toont bij elk uitleenbaar boek de knop "Reserveer dit boek". De aanvragen verschijnen in het bestuursscherm en in het tabblad Aanvragen.'],
  ['aanvragen_bewaren_dagen', 60, 'Na hoeveel dagen een aanvraag (met voornaam en contactgegevens) gewist wordt.'],
  ['backup_map', 'Project Madrigal back-ups', 'Naam van de map op Google Drive waar elke week een kopie van deze spreadsheet komt.'],
  ['backup_bewaren', 8, 'Hoeveel back-ups je bewaart. De oudste gaan vanzelf naar de prullenbak. Een back-up bevat ook de gegevens van leners.'],
  ['bewaartermijn_afgesloten_uitleningen_maanden', 12, 'Na hoeveel maanden de koppeling tussen een teruggebrachte uitlening en de lener gewist wordt.'],
  ['goodreads_shelf', '', 'Naam van de Goodreads-shelf met de boeken van Madrigal, precies zoals op Goodreads. Leeg: alle boeken uit de export.'],
  ['goatcounter_code', 'projectmadrigal', 'De code van het GoatCounter-account (projectmadrigal voor projectmadrigal.goatcounter.com). Dezelfde als statistiek in config.js.'],
  ['goatcounter_api_sleutel', '', 'Optioneel. Een API-sleutel van GoatCounter (je naam rechtsboven > Preferences > tabblad API, enkel "Read statistics"). Dan toont het bestuursscherm de bezoekers onder Cijfers. Deel deze sleutel met niemand.'],
  ['google_books_api_key', '', 'Optioneel. Een sleutel voor de Google Books-API, zodat covers sneller opgezocht worden. Leeg werkt ook, maar trager.'],
  ['bol_client_id', '', 'Optioneel. Client ID van een partneraccount bij bol.com (Marketing Catalog API), voor covers van Nederlandstalige boeken.'],
  ['bol_client_secret', '', 'Optioneel. Client Secret van dat partneraccount. Blijft op de server.'],
  ['cover_map', 'Project Madrigal covers', 'Naam van de map op Google Drive voor foto\'s van covers die je in de bib neemt.'],
  ['zines_te_koop_uitleenbaar', 'nee', 'nee: zines met genre "verkoop" zijn niet uitleenbaar.'],
  ['tekst_welkom', 'Welkom in de catalogus van Project Madrigal, de queer bib van Antwerpen. Zoek, snuister en kom langs om te lenen.', 'Welkomsttekst bovenaan de publieke catalogus.'],
  ['tekst_uitleg_lenen', 'Je leent gratis, je betaalt enkel 5 euro borg per boek. Die krijg je terug als je het boek terugbrengt. Je mag 2 boeken tegelijk lenen, voor 4 weken. Kom langs op vrijdag tijdens de openingsuren.', 'Uitleg over lenen in de publieke catalogus: wanneer open, hoe lang, hoeveel.'],
  ['tekst_privacy', 'We bewaren enkel je voornaam, eventueel je achternaam, je telefoonnummer en/of e-mailadres, en je lenersnummer. We gebruiken die enkel om je uitleningen op te volgen en je te herinneren als een boek terug moet. Enkel het bestuur ziet je contactgegevens. Na een teruggebracht boek wissen we de koppeling met jou na 12 maanden. Wil je je gegevens inkijken of laten wissen? Vraag het aan de balie of mail naar [vul het mailadres van het bestuur in].', 'Privacyverklaring bij het inschrijven en in de publieke catalogus.'],
  ['tekst_welkom_en', 'Welcome to the catalogue of Project Madrigal, the queer library of Antwerp. Search, browse and come by to borrow.', 'Welkomsttekst in het Engels.'],
  ['tekst_uitleg_lenen_en', 'Borrowing is free, you only pay a 5 euro deposit per book. You get it back when you return the book. You can borrow 2 books at a time, for 4 weeks. Come by on Friday during opening hours.', 'Uitleg over lenen in het Engels.'],
  ['tekst_privacy_en', 'We only keep your first name, possibly your last name, your phone number and/or email address, and your borrower number. We only use them to follow up on your loans and to remind you when a book is due. Only the board can see your contact details. Twelve months after you return a book, we remove the link with you. Want to see your data or have it deleted? Ask at the desk or email [fill in the board email address].', 'Privacyverklaring in het Engels.'],
  ['tekst_vrijwilliger', '', 'Pagina Doe mee: hoe word je vrijwilliger? Wat doe je, hoeveel tijd vraagt het, hoe meld je je aan. Leeg: dit blok staat niet op de pagina.'],
  ['tekst_vrijwilliger_en', '', 'Pagina Doe mee, vrijwilliger worden, in het Engels.'],
  ['tekst_schenken', '', 'Pagina Doe mee: welke boeken neem je graag aan, en welke niet? Hoe breng je ze binnen? Leeg: dit blok staat niet op de pagina.'],
  ['tekst_schenken_en', '', 'Pagina Doe mee, boeken schenken, in het Engels.'],
  ['tekst_steunen', '', 'Pagina Doe mee: hoe kan iemand Project Madrigal steunen (gift, rekeningnummer, materiaal)? Leeg: dit blok staat niet op de pagina.'],
  ['tekst_steunen_en', '', 'Pagina Doe mee, steunen, in het Engels.'],
  ['adres', 'Peperfabriek (eerste verdieping)\nBreughelstraat 31\n2018 Antwerpen', 'Adres op de website. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren', 'Elke vrijdag: 18:00 - 20:00', 'Openingsuren op de website, in het Nederlands. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren_en', 'Every Friday: 18:00 - 20:00', 'Openingsuren op de website, in het Engels.'],
  ['mail_algemeen', 'info@projectmadrigal.be', 'Algemeen mailadres op de website.'],
  ['mail_events', 'events.madrigal@gmail.com', 'Mailadres voor events op de website.'],
  ['nieuw_op_startpagina_dagen', 60, 'Hoeveel dagen een nieuw toegevoegd boek vooraan in "Nieuw binnen" staat. Zijn er te weinig, dan vult de site aan met de laatst gecatalogiseerde boeken. 0: de sectie Nieuw binnen staat uit.'],
  ['nieuw_op_startpagina_aantal', 8, 'Hoeveel boeken "Nieuw binnen" op de startpagina hoogstens toont. De nieuwste eerst.'],
  ['aanraders_uit_stocklijst', 'Johanna', 'Namen van wie de aanraders uit de oude stocklijst overgenomen worden, gescheiden door komma\'s. Andere namen uit de stocklijst niet. Een aanrader die je zelf typt in de kolom aanrader van de Catalogus, staat altijd op de website.'],
  ['aanraders_verbergen', '', 'Namen van wie de aanraders nergens op de website staan, gescheiden door komma\'s (bv. Nance): niet op de startpagina, niet als label bij de boeken en niet in de filter Aanrader. De namen blijven in de Catalogus staan. Leeg: iedereen staat erop.'],
  ['tekst_herinnering', 'Hoi {voornaam}, je leende bij Project Madrigal "{titel}". Dat boek moest terug op {vervaldatum}. Breng je het binnenkort binnen? Lukt dat niet, laat het ons dan even weten. Dank je!', 'Herinnering voor een boek dat te laat is. Gebruik {voornaam}, {titel} en {vervaldatum}.'],
  ['tekst_herinnering_binnenkort', 'Hoi {voornaam}, een vriendelijke herinnering: "{titel}" mag terug naar Project Madrigal op {vervaldatum}. Wil je het langer houden? Laat het ons weten, dan verlengen we het. Veel leesplezier!', 'Herinnering voor een boek dat binnenkort vervalt.']
];

/** Weekdagen als tekst naar het getal van de weekdag (0 = zondag). */
function weekdagNummers(waarde) {
  return splitsLijst(waarde).map(function (w) {
    return WEEKDAGEN.indexOf(normaliseerTekst(w));
  }).filter(function (n) { return n > -1; });
}

/**
 * Zet de ruwe waarden uit het tabblad om naar bruikbare instellingen.
 * ruw: object met sleutel -> waarde zoals in de spreadsheet.
 * Ontbrekende of onleesbare waarden krijgen de standaardwaarde.
 */
function verwerkInstellingen(ruw) {
  var inst = {};
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    var sleutel = rij[0];
    var standaard = rij[1];
    var waarde = ruw.hasOwnProperty(sleutel) && !isLeeg(ruw[sleutel]) ? ruw[sleutel] : standaard;
    if (typeof standaard === 'number') {
      var getal = parseerGetal(waarde);
      inst[sleutel] = getal === null ? standaard : getal;
    } else if (standaard === 'ja' || standaard === 'nee') {
      inst[sleutel] = (jaNee(waarde) || standaard) === 'ja';
    } else {
      // Teksten, adres en openingsuren mogen meerdere regels hebben.
      var meerdereRegels = sleutel.indexOf('tekst_') === 0 || ['adres', 'openingsuren', 'openingsuren_en'].indexOf(sleutel) > -1;
      inst[sleutel] = isDatumObject(waarde) ? parseerDatum(waarde) : (meerdereRegels ? String(waarde).trim() : schoon(waarde));
    }
  });
  inst.openingsdagen = weekdagNummers(inst.openingsdagen);
  inst.borg_betaalwijzen = splitsLijst(inst.borg_betaalwijzen);
  inst.gesloten_data = splitsLijst(inst.gesloten_data).map(parseerDatum).filter(function (d) { return d; });
  // Een enkele datum als Date-object in de cel.
  if (isDatumObject(ruw.gesloten_data)) inst.gesloten_data = [parseerDatum(ruw.gesloten_data)];
  return inst;
}

/** Leest het tabblad Instellingen en geeft de verwerkte instellingen terug. */
function leesInstellingen() {
  var blad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Instellingen');
  var ruw = {};
  if (blad) {
    blad.getDataRange().getValues().slice(1).forEach(function (rij) {
      var sleutel = schoon(rij[0]);
      if (sleutel) ruw[sleutel] = rij[1];
    });
  }
  return verwerkInstellingen(ruw);
}

/** Teksten die de publieke catalogus mag tonen. Nooit codes of andere interne waarden. */
function publiekeTeksten(inst) {
  return {
    welkom: inst.tekst_welkom,
    uitleg: inst.tekst_uitleg_lenen,
    privacy: inst.tekst_privacy,
    welkom_en: inst.tekst_welkom_en,
    uitleg_en: inst.tekst_uitleg_lenen_en,
    privacy_en: inst.tekst_privacy_en,
    online_reserveren: inst.online_reserveren === true
  };
}
