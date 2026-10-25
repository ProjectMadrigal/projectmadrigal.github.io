/**
 * madrigal-script.gs
 * Alle code van de catalogus van Project Madrigal in één bestand.
 * Plak dit volledige bestand in Apps Script (Extensies > Apps Script).
 * De functies staan alfabetisch, zodat je ze makkelijk vindt naast "Uitvoeren".
 *
 * PAS DIT BESTAND NIET MET DE HAND AAN. Het wordt gemaakt uit de map
 * apps-script/ met: node tools/bundel.js
 * De uitleg per onderdeel staat bovenaan de bestanden in apps-script/.
 */

/* ==================== Vaste waarden ==================== */

var AANVRAAG_MAX_PER_UUR = 30;

var AANVRAAG_MAX_PER_CONTACT = 3;

var AANVRAAG_NIEUW = 'nieuw';

var AANVRAAG_STATUSSEN = ['nieuw', 'afgehandeld', 'geweigerd'];

var CACHE_SLEUTEL = 'publiek_v1';

var CACHE_DUUR_SECONDEN = 6 * 60 * 60; // het maximum van Google: 6 uur

var CACHE_STUK = 90000;                 // een cachewaarde mag hoogstens 100 kB zijn

/** Welke rol nodig is voor elke actie. */
var ACTIES = {
  aanmelden: 'balie',
  balieData: 'balie',
  uitlenen: 'balie',
  terugbrengen: 'balie',
  verlengen: 'balie',
  reserveren: 'balie',
  annuleerReservatie: 'balie',
  nieuweLener: 'balie',
  roosterOverzicht: 'balie',
  bestuurData: 'bestuur',
  borgTerugbetaald: 'bestuur',
  herinneringVerstuurd: 'bestuur',
  lenerAanpassen: 'bestuur',
  aanvraagAfhandelen: 'bestuur',
  // Zonder code, vanaf de publieke website (Aanvragen.js). Staat uit tot online_reserveren = ja.
  reservatieAanvraag: 'publiek',
  // Beheer van de website (Beheer.js). Wil je vrijwilligers dit laten doen? Zet de actie op 'balie'.
  beheerBoekOphalen: 'bestuur',
  beheerBoekBewaren: 'bestuur',
  beheerBoekToevoegen: 'bestuur',
  beheerIsbnOpzoeken: 'bestuur',
  beheerInhoud: 'bestuur',
  beheerInhoudBewaren: 'bestuur',
  beheerInstellingBewaren: 'bestuur',
  beheerCoversLijst: 'bestuur',
  beheerCoversBewaren: 'bestuur',
  beheerCoverUpload: 'bestuur',
  beheerTekstUitFoto: 'bestuur',
  beheerIaCovers: 'bestuur',
  beheerIaCoversWissen: 'bestuur'
};

/* ---------- Staat lezen en bewaren ---------- */

var BACKUP_VOORVOEGSEL = 'Madrigal back-up ';

/** Velden van een boek die je via de website kan aanpassen. De rest (herkomst, ...) blijft enkel in de spreadsheet. */
var BEHEER_BOEKVELDEN = [
  'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat',
  'aanrader', 'genre', 'extra_onderwerpen', 'klassieker', 'aantal', 'uitleenbaar', 'publiek', 'status',
  'startpagina', 'beschrijving', 'beschrijving_en', 'cover_url'
];

/** Velden met ja/nee. Bij startpagina betekent leeg "automatisch". */
var BEHEER_JANEE = ['nieuwstaat', 'klassieker', 'uitleenbaar', 'publiek', 'startpagina'];

/** Tabbladen met inhoud van de website, en de kolommen die je via de website kan aanpassen. */
var BEHEER_INHOUD = {
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek']
};

/** Instellingen die nooit via de website zichtbaar of aanpasbaar zijn. Pas die aan in de spreadsheet. */
var BEHEER_GEHEIM = ['toegangscode_balie', 'code_bestuur', 'rooster_code', 'google_books_api_key', 'bol_client_id', 'bol_client_secret'];

/** Lange teksten: meer tekens toegelaten en regeleinden blijven staan. */
var BEHEER_LANG = ['beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en'];

var FOTO_MAX_BYTES = 1500000;

var FOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

var OCR_MAX_BYTES = 4000000;

var BS_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

// Een beschrijving blijft volledig tot deze lengte. Is ze langer, dan stopt ze na
// de laatste volledige zin, nooit midden in een zin.
var BS_MAX_LENGTE = 2500;

var BS_USER_AGENT = 'ProjectMadrigal-catalogus (Google Apps Script; queer bibliotheek Antwerpen)';

/** Open Library gaf niets terwijl Google weigerde: Google moet het nog opzoeken. */
var BS_ENKEL_OL = 'OL ';

var BOL_PAUZE_MS = 300;

var BOL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var BOL_API = 'https://api.bol.com/marketing/catalog/v1';

/** Kolomnamen in Stock en Zines, en hoe ze in de Catalogus heten. */
var BRONKOLOMMEN = {
  'titel': 'titel',
  'auteur s': 'auteur', 'auteurs': 'auteur', 'auteur': 'auteur',
  'isbn': 'isbn', 'isbn issn': 'isbn', 'issn': 'isbn', 'isbn of issn': 'isbn',
  'uitgeverij': 'uitgeverij',
  'jaartal': 'jaartal', 'jaar': 'jaartal',
  'taal': 'taal',
  'pagina s': 'paginas', 'paginas': 'paginas',
  'uitvoering': 'uitvoering',
  'nieuwstaat': 'nieuwstaat',
  'aanrader': 'aanrader',
  'genre': 'genre',
  'aantal': 'aantal'
};

/** De standaard filtergroepen op de website, in deze volgorde. */
var FILTERGROEPEN = ['Gender', 'Seksualiteit', 'Feminisme', 'Fictie', 'Klassiekers', 'Geschiedenis en maatschappij', 'Biografie', 'Poëzie', 'Graphic novel', 'Young adult', 'Pulp', 'Erotica en BDSM', 'Zines'];

/** Voorstellen voor de vertaaltabel: een genre met dit woord erin gaat naar deze groep. */
var ONDERWERP_VOORSTELLEN = [
  [/gender|trans|non ?binair|interseks|intersex/, 'Gender'],
  [/seks|sexualiteit|homo|lesb|queer|lgbt|holebi|coming out|gay|polyamor|relatie/, 'Seksualiteit'],
  [/femin|vrouw/, 'Feminisme'],
  [/roman|fictie|fiction|verhal|verhaal|proza|literatuur|thriller|detective|fantasy|science|kort/, 'Fictie'],
  [/geschied|histor|maatschap|politi|sociolog|activis|essay|non ?fictie|filosof|religie|kolonial|marx|fascis|ecolog|cultuur|onderzoek/, 'Geschiedenis en maatschappij'],
  [/biogra|^bio$|memoir|dagboek/, 'Biografie'],
  [/poezie|gedicht|poetry|poem/, 'Poëzie'],
  [/graphic|strip|comic|manga/, 'Graphic novel'],
  [/young adult|^ya$|jeugd|kinder/, 'Young adult'],
  [/pulp/, 'Pulp'],
  [/erotic|erotiek|bdsm|kink|fetish|leder|leather/, 'Erotica en BDSM'],
  [/zine/, 'Zines']
];

/**
 * De kolom status in de Catalogus. Leeg = gewoon.
 *   verloren            niet op de website, niet uitleenbaar
 *   gevoelig verborgen  niet op de website, wel uitleenbaar aan de balie
 *   gevoelig zichtbaar  op de website met het label "Gevoelige inhoud"
 */
var BOEKSTATUSSEN = ['verloren', 'gevoelig verborgen', 'gevoelig zichtbaar'];

var CV_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var CV_PAUZE_MS = 1000; // Open Library vraagt om rustig te zoeken

var CV_ANDERE_UITGAVE = 'andere uitgave (Open Library)';

var CV_TITEL_AUTEUR = 'titel en auteur (Open Library)';

var IA_BRON = 'Internet Archive';

var WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Welke kolom van de Goodreads-export welk veld van de Catalogus aanvult. */
var GOODREADS_VELDEN = {
  uitgeverij: ['Publisher'],
  jaartal: ['Year Published', 'Original Publication Year'],
  paginas: ['Number of Pages']
};

var GB_PAUZE_MS = 400;

var GB_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var GB_TALEN = { nl: 'Nederlands', en: 'Engels', fr: 'Frans', de: 'Duits', es: 'Spaans', it: 'Italiaans', pt: 'Portugees' };

var GRENZEN = [
  {
    id: 'max_boeken',
    naam: 'Maximum aantal boeken per lener',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var aantal = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).length;
      var max = ctx.inst.max_boeken_per_lener;
      if (aantal < max) return null;
      return 'Deze lener heeft al ' + aantal + (aantal === 1 ? ' boek' : ' boeken') + '. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'te_laat',
    naam: 'Lener heeft nog een boek te laat',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var telaat = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).filter(function (u) {
        return u.vervaldatum < ctx.vandaag;
      });
      if (!telaat.length) return null;
      var titels = telaat.map(function (u) {
        var b = boekVan(ctx.staat, u.boek_id);
        return '"' + (b ? b.titel : u.exemplaar) + '" (te laat sinds ' + datumTekst(u.vervaldatum, ctx.vandaag) + ')';
      });
      return 'Deze lener heeft nog een boek te laat: ' + titels.join(', ') + '.';
    }
  },
  {
    id: 'gereserveerd_voor_ander',
    naam: 'Exemplaar gereserveerd voor iemand anders',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var anderen = actieveReservaties(ctx.staat, ctx.boek.boek_id).filter(function (r) {
        if (String(r.lenersnummer) === String(ctx.lener.lenersnummer)) return false;
        // Een klaarliggende reservatie voor een ander exemplaar houdt dit exemplaar niet tegen.
        if (r.status === 'klaar om op te halen' && r.exemplaar && r.exemplaar !== ctx.exemplaar) return false;
        return true;
      });
      if (!anderen.length) return null;
      var r = anderen[0];
      return 'Dit boek is gereserveerd voor lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.';
    }
  },
  {
    id: 'max_verlengingen',
    naam: 'Maximum aantal verlengingen',
    actie: 'verlengen',
    controleer: function (ctx) {
      var aantal = Number(ctx.uitlening.aantal_verlengingen || 0);
      var max = ctx.inst.max_verlengingen;
      if (aantal < max) return null;
      return 'Dit boek is al ' + aantal + ' keer verlengd. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'verlengen_bij_reservatie',
    naam: 'Verlengen terwijl iemand anders wacht',
    actie: 'verlengen',
    controleer: function (ctx) {
      if (!ctx.inst.verlengen_niet_bij_reservatie) return null;
      var wachtenden = actieveReservaties(ctx.staat, ctx.uitlening.boek_id).filter(function (r) {
        return String(r.lenersnummer) !== String(ctx.uitlening.lenersnummer);
      });
      if (!wachtenden.length) return null;
      var r = wachtenden[0];
      return 'Iemand anders wacht op dit boek: lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.' +
        (wachtenden.length > 1 ? ' Er wachten in totaal ' + wachtenden.length + ' mensen.' : '');
    }
  }
];

/** Lidwoorden die we negeren bij zoeken en vergelijken (Nederlands, Engels, Frans, Duits). */
var LIDWOORDEN = ['de', 'het', 'een', 'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'el', 'los', 'las'];

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
  ['online_reserveren', 'nee', 'ja: de website toont bij elk uitleenbaar boek de knop "Reserveer dit boek". De aanvragen verschijnen in het bestuursscherm en in het tabblad Aanvragen.'],
  ['aanvragen_bewaren_dagen', 60, 'Na hoeveel dagen een aanvraag (met voornaam en contactgegevens) gewist wordt.'],
  ['backup_map', 'Project Madrigal back-ups', 'Naam van de map op Google Drive waar elke week een kopie van deze spreadsheet komt.'],
  ['backup_bewaren', 8, 'Hoeveel back-ups je bewaart. De oudste gaan vanzelf naar de prullenbak. Een back-up bevat ook de gegevens van leners.'],
  ['bewaartermijn_afgesloten_uitleningen_maanden', 12, 'Na hoeveel maanden de koppeling tussen een teruggebrachte uitlening en de lener gewist wordt.'],
  ['goodreads_shelf', '', 'Naam van de Goodreads-shelf met de boeken van Madrigal, precies zoals op Goodreads. Leeg: alle boeken uit de export.'],
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

var OL_PORTIE = 20;

var OL_PAUZE_MS = 1500;

var OL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var OL_TALEN = { eng: 'Engels', dut: 'Nederlands', fre: 'Frans', ger: 'Duits', spa: 'Spaans', ita: 'Italiaans', por: 'Portugees' };

/** Velden die Open Library kan aanvullen. */
var OL_VELDEN = ['uitgeverij', 'jaartal', 'paginas', 'taal', 'beschrijving', 'cover_url'];

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

var INSTELLING_GROEPEN = [
  ['Toegang', ['toegangscode_balie', 'code_bestuur']],
  ['Uitlenen', ['uitleentermijn_weken', 'verlengingstermijn_weken', 'max_verlengingen', 'verlengen_niet_bij_reservatie',
    'max_boeken_per_lener', 'waarschuwing_dagen_voor_vervaldatum', 'ophaaltermijn_openingsdagen', 'zines_te_koop_uitleenbaar']],
  ['Borg en giften', ['borg_per_boek', 'borg_betaalwijzen', 'gift_mogelijk']],
  ['Openingsdagen', ['openingsdagen', 'terugbrengdatum_op_openingsdag', 'gesloten_data']],
  ['Herinneringen', ['tekst_herinnering', 'tekst_herinnering_binnenkort']],
  ['Website: contact', ['adres', 'openingsuren', 'openingsuren_en', 'mail_algemeen', 'mail_events']],
  ['Website: teksten bij Boeken', ['tekst_welkom', 'tekst_welkom_en', 'tekst_uitleg_lenen', 'tekst_uitleg_lenen_en', 'tekst_privacy', 'tekst_privacy_en']],
  ['Website: Doe mee', ['tekst_vrijwilliger', 'tekst_vrijwilliger_en', 'tekst_schenken', 'tekst_schenken_en', 'tekst_steunen', 'tekst_steunen_en']],
  ['Aanraders', ['aanraders_uit_stocklijst', 'aanraders_verbergen', 'nieuw_op_startpagina_dagen', 'nieuw_op_startpagina_aantal']],
  ['Boekgegevens aanvullen', ['goodreads_shelf', 'google_books_api_key', 'bol_client_id', 'bol_client_secret', 'cover_map']],
  ['Rooster', ['rooster_url', 'rooster_code', 'rooster_link']],
  ['Privacy', ['bewaartermijn_afgesloten_uitleningen_maanden']],
  ['Back-up', ['backup_map', 'backup_bewaren']],
  ['Online reserveren', ['online_reserveren', 'aanvragen_bewaren_dagen']]
];

var TABBLAD_GROEPEN = [
  ['#6b3597', ['Uitleningen', 'Reservaties', 'Aanvragen', 'Leners', 'Uitzonderingen']],      // uitlenen
  ['#ffcd30', ['Catalogus', 'Onderwerpen', 'Na te kijken']],                     // collectie
  ['#2a6f73', ['Nieuws', 'Agenda', 'Veelgestelde vragen']],                      // website
  ['#1b1b1c', ['Instellingen', 'Logboek']],                                      // beheer
  ['#bdbdbd', ['Stock', 'Zines', 'Goodreads-export']]                            // bronnen, zelden nodig
];

var OUDE_SITE = 'https://www.projectmadrigal.be/';

var ROOSTER_CACHE_SLEUTEL = 'rooster_v1';

var ROOSTER_CACHE_SECONDEN = 10 * 60;

var SITE_CACHE_SLEUTEL = 'site_v3'; // v3: met de teksten van de pagina Doe mee

var SITE_MAX_NIEUWS = 3;

var SITE_MAX_AANRADERS = 12;

var STATUS_WACHT = 'wacht';

var STATUS_KLAAR = 'klaar om op te halen';

var STATUS_AFGEHAALD = 'afgehaald';

var STATUS_VERVALLEN = 'vervallen';

var STATUS_GEANNULEERD = 'geannuleerd';

/* ---------- Opzoeken ---------- */

var WIKI_TALEN = ['nl', 'en'];

var WIKI_PAUZE_MS = 300;

var WIKI_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

/* ==================== Functies, van A tot Z ==================== */

/** Aantal exemplaren van een boek (een leeg veld telt als 1). */
function aantalExemplaren(boek) {
  var n = parseerGetal(boek.aantal);
  return n && n > 0 ? Math.round(n) : 1;
}

/** Zet een aanvraag op afgehandeld of geweigerd. invoer: { aanvraag_id, status } */
function aanvraagAfhandelen(rijen, invoer, wie, vandaag) {
  var status = String(invoer.status || '');
  if (status !== 'afgehandeld' && status !== 'geweigerd') return { ok: false, fout: 'Onbekende status.' };
  var a = (rijen || []).filter(function (r) { return String(r.aanvraag_id) === String(invoer.aanvraag_id); })[0];
  if (!a) return { ok: false, fout: 'Deze aanvraag bestaat niet meer.' };
  wijzig(a, { status: status, datum_afgehandeld: vandaag, afgehandeld_door: tekstInvoer(wie, 40) });
  return { ok: true, tekst: 'Aanvraag ' + a.aanvraag_id + ' staat op ' + status + '.' };
}

/**
 * Achternaam uit "Achternaam, Voornaam" of "Voornaam Achternaam", genormaliseerd,
 * zonder tussenvoegsel.
 * Bij meerdere auteurs (gescheiden door ; of &) nemen we de eerste.
 */
function achternaam(auteur) {
  var eerste = schoon(auteur).split(/;|&| en | and /)[0];
  // "van Babylon, Dirk" en "Babylon, Dirk van" geven allebei "babylon":
  // we nemen het laatste woord, zodat tussenvoegsels geen rol spelen.
  var delen = normaliseerTekst(eerste.indexOf(',') > -1 ? eerste.split(',')[0] : eerste).split(' ');
  return delen[delen.length - 1] || '';
}

/** Reservaties die nog lopen (wacht of klaar), in volgorde van de wachtrij. */
function actieveReservaties(staat, boekId) {
  return staat.reservaties.filter(function (r) {
    return r.boek_id === boekId && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR);
  }).sort(function (a, b) {
    return String(a.datum_reservatie).localeCompare(String(b.datum_reservatie)) ||
      String(a.reservatie_id).localeCompare(String(b.reservatie_id));
  });
}

/* ---------- Nummers ---------- */

/**
 * Breedte en hoogte van een JPG, PNG of GIF, uit de eerste bytes. Geeft null als dat niet lukt.
 * bytes: lijst getallen (zoals Blob.getBytes(), mag negatief zijn).
 */
function afbeeldingAfmetingen(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  if (!bytes || bytes.length < 24) return null;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) {           // PNG
    return { breedte: (b(16) << 24 | b(17) << 16 | b(18) << 8 | b(19)) >>> 0, hoogte: (b(20) << 24 | b(21) << 16 | b(22) << 8 | b(23)) >>> 0 };
  }
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) {                             // GIF
    return { breedte: b(6) | b(7) << 8, hoogte: b(8) | b(9) << 8 };
  }
  if (b(0) === 0xFF && b(1) === 0xD8) {                                              // JPG: zoek het SOF-blok
    var i = 2;
    while (i + 9 < bytes.length) {
      if (b(i) !== 0xFF) { i++; continue; }
      var soort = b(i + 1);
      if (soort >= 0xC0 && soort <= 0xCF && soort !== 0xC4 && soort !== 0xC8 && soort !== 0xCC) {
        return { hoogte: b(i + 5) << 8 | b(i + 6), breedte: b(i + 7) << 8 | b(i + 8) };
      }
      i += 2 + (b(i + 2) << 8 | b(i + 3));
    }
  }
  return null;
}

/** Alle lopende reservaties, met hun plaats in de wachtrij. */
function alleReservaties(staat) {
  var perBoek = {};
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_WACHT || r.status === STATUS_KLAAR) perBoek[r.boek_id] = true;
  });
  var lijst = [];
  Object.keys(perBoek).forEach(function (boekId) {
    actieveReservaties(staat, boekId).forEach(function (r, i) { lijst.push(reservatieInfo(staat, r, i + 1)); });
  });
  return lijst;
}

/** Een reservatie annuleren. Lag het boek al klaar, dan gaat het naar de volgende. */
function annuleerReservatie(staat, invoer) {
  var r = reservatieVan(staat, invoer.reservatie_id);
  if (!r) return { ok: false, fout: 'Deze reservatie bestaat niet.' };
  if (r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR) return { ok: false, fout: 'Deze reservatie is al afgesloten.' };
  var lag = r.status === STATUS_KLAAR ? r.exemplaar : '';
  wijzig(r, { status: STATUS_GEANNULEERD, datum_afgesloten: staat.vandaag });
  staat.log.push(['reservatie geannuleerd', r.reservatie_id]);
  var melding = lag ? geefExemplaarDoor(staat, r.boek_id, lag) : null;
  return { ok: true, tekst: 'Reservatie geannuleerd.' + (lag && !melding ? ' Het boek mag terug in de kast.' : ''), apartLeggen: melding ? [melding] : [] };
}

function apartLeggenMelding(staat, r) {
  return {
    reservatie_id: r.reservatie_id, exemplaar: r.exemplaar, lenersnummer: r.lenersnummer,
    tekst: 'Leg dit boek apart voor lener ' + lenerNaam(staat, r.lenersnummer),
    ophalen_tot: r.ophalen_tot,
    ophalenTekst: 'Ligt klaar tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
  };
}

/** "Mira Verbeek" wordt "Verbeek, Mira", zoals de rest van de catalogus. */
function auteurAchternaamEerst(naam) {
  var n = schoon(naam);
  if (!n || n.indexOf(',') > -1) return n;
  var delen = n.split(' ');
  if (delen.length < 2) return n;
  return delen.pop() + ', ' + delen.join(' ');
}

/** De map voor de back-ups. Bestaat ze nog niet, dan maken we ze. */
function backupMap(naam) {
  var mappen = DriveApp.getFoldersByName(naam);
  return mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
}

/** De naam van een back-up: "Madrigal back-up 2026-10-24". */
function backupNaam(vandaag) {
  return BACKUP_VOORVOEGSEL + vandaag;
}

/** Korte lijst van alle boeken voor het uitleenscherm, ook de niet-publieke. */
function baliecatalogus(staat) {
  return staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && !isLeeg(b.titel); }).map(function (b) {
    var info = {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), i: schoon(b.isbn),
      x: aantalExemplaren(b), u: isUitleenbaar(b), c: !isLeeg(b.cover_url)
    };
    // st: zodat de vrijwilliger het weet. Gevoelig (verborgen of zichtbaar) mag je gewoon uitlenen.
    var status = boekStatus(b);
    if (status === 'verloren') info.st = 'verloren';
    else if (status) info.st = 'gevoelig';
    return info;
  });
}

/** Gegevens voor het uitleenscherm. */
function balieGegevens(staat) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, false); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    instellingen: {
      borg_per_boek: staat.inst.borg_per_boek,
      borg_betaalwijzen: staat.inst.borg_betaalwijzen,
      gift_mogelijk: staat.inst.gift_mogelijk,
      max_boeken_per_lener: staat.inst.max_boeken_per_lener
    },
    privacy: staat.inst.tekst_privacy,
    boeken: baliecatalogus(staat),
    leners: staat.leners.filter(function (l) { return jaNee(l.actief) !== 'nee'; }).map(function (l) {
      return { n: l.lenersnummer, v: l.voornaam };
    }),
    lopend: lopend,
    reservaties: alleReservaties(staat)
  };
}

/** Bedrag: een getal van 0 tot 1000, afgerond op centen. Geeft null bij ongeldige invoer. */
function bedragInvoer(waarde) {
  if (isLeeg(waarde)) return 0;
  var n = parseerGetal(waarde);
  if (n === null || n < 0 || n > 1000) return null;
  return Math.round(n * 100) / 100;
}

function bedragTekst(n) {
  var b = Number(n || 0);
  return (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ',')) + ' euro';
}

/**
 * Controleert de grenzen. Zijn er overschreden en is er geen reden opgegeven,
 * dan geeft dit het antwoord terug dat de schermen een reden moeten vragen.
 * Met een reden worden de uitzonderingen genoteerd en geeft dit null terug.
 */
function behandelGrenzen(staat, actie, ctx, invoer) {
  ctx.staat = staat;
  ctx.inst = staat.inst;
  ctx.vandaag = staat.vandaag;
  var overschreden = controleerGrenzen(actie, ctx);
  if (!overschreden.length) return null;
  var reden = invoer.uitzondering ? tekstInvoer(invoer.uitzondering.reden, 300) : '';
  if (reden.length < 3) return { ok: false, grenzen: overschreden };
  overschreden.forEach(function (g) {
    staat.uitzonderingen.push({
      datum: staat.vandaag, wie: staat.wie, grens: g.naam,
      lenersnummer: ctx.lener ? ctx.lener.lenersnummer : (ctx.uitlening ? ctx.uitlening.lenersnummer : ''),
      boek_id: ctx.boek ? ctx.boek.boek_id : '',
      exemplaar: ctx.exemplaar || (ctx.uitlening ? ctx.uitlening.exemplaar : ''),
      reden: reden, actie: actie
    });
  });
  return null;
}

/* ---------- Reservaties doorgeven ---------- */

/** Bestuur: een aanvraag afhandelen in het tabblad. */
function beheerAanvraagAfhandelen(invoer, wie) {
  var tabel = leesTabel('Aanvragen');
  var r = aanvraagAfhandelen(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, 'aanvraag ' + invoer.status, String(invoer.aanvraag_id));
  }
  return r;
}

/** Een boek zoals het beheerscherm het toont. */
function beheerBoek(rij) {
  var boek = { boek_id: String(rij.boek_id) };
  BEHEER_BOEKVELDEN.forEach(function (v) { boek[v] = isLeeg(rij[v]) ? '' : rij[v]; });
  boek.status = boekStatus(rij).replace('_', ' ');
  boek.toegevoegd_op = rij.toegevoegd_op || '';
  return boek;
}

/** Bewaart een wijziging in Nieuws, Agenda of Veelgestelde vragen. */
function beheerInhoudBewaren(invoer, wie) {
  if (!BEHEER_INHOUD[invoer.tabblad]) return { ok: false, fout: 'Onbekend tabblad.' };
  var tabel = leesTabel(invoer.tabblad);
  var antwoord = inhoudAanpassen(tabel.rijen, invoer);
  if (antwoord.ok) {
    bewaarTabel(tabel);
    logboek(wie, 'website aangepast', invoer.tabblad);
  }
  return antwoord;
}

/** Gegevens voor de onderdelen Nieuws en agenda, en Teksten en instellingen. */
function beheerInhoudGegevens() {
  var uit = { tabbladen: {} };
  Object.keys(BEHEER_INHOUD).forEach(function (naam) {
    uit.tabbladen[naam] = spreadsheet().getSheetByName(naam) ? inhoudRijen(naam, leesTabel(naam).rijen) : [];
  });
  uit.instellingen = instellingenVoorBeheer(leesTabel('Instellingen').rijen);
  return { ok: true, data: uit };
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

/** Maakt één ingevuld veld netjes. Geeft { waarde } of { fout }. */
function beheerVeld(veld, ruw) {
  if (BEHEER_LANG.indexOf(veld) > -1) return { waarde: String(ruw === undefined || ruw === null ? '' : ruw).trim().slice(0, 5000) };
  var w = tekstInvoer(ruw, 300);
  if (BEHEER_JANEE.indexOf(veld) > -1) return { waarde: jaNee(w) };
  if (veld === 'soort') return { waarde: normaliseerTekst(w) === 'zine' ? 'zine' : 'boek' };
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
  if (veld === 'jaartal' || veld === 'paginas' || veld === 'aantal' || veld === 'volgorde') {
    if (!w) return { waarde: '' };
    var n = parseerGetal(w);
    if (n === null || n < 0 || n !== Math.round(n)) return { fout: 'Vul bij ' + veld + ' een geheel getal in.' };
    return { waarde: n };
  }
  if (veld === 'datum') {
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

/**
 * Tot wanneer ligt een gereserveerd boek apart?
 * Tot en met de zoveelste openingsdag na de dag waarop het boek klaarlag.
 */
function berekenOphaalTermijn(datumKlaar, inst) {
  var d = datumKlaar;
  for (var i = 0; i < Math.max(1, inst.ophaaltermijn_openingsdagen); i++) d = volgendeOpeningsdag(d, inst, false);
  return d;
}

/** Nieuwe vervaldatum na verlengen: huidige vervaldatum plus de verlengingstermijn. */
function berekenVerlenging(huidigeVervaldatum, inst) {
  var d = telDagenOp(huidigeVervaldatum, inst.verlengingstermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Vervaldatum van een nieuwe uitlening:
 * uitleendatum plus de uitleentermijn, opgeschoven naar de eerstvolgende openingsdag.
 */
function berekenVervaldatum(datumUit, inst) {
  var d = telDagenOp(datumUit, inst.uitleentermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Beschikbaarheid van een boek voor de publieke catalogus.
 * Geeft { code, label, totaal, beschikbaar, terug } terug. Nooit wie het boek heeft.
 *   code: 'beschikbaar', 'uitgeleend', 'gereserveerd' of 'niet_uitleenbaar'
 */
function beschikbaarheid(staat, boek) {
  var totaal = aantalExemplaren(boek);
  if (!isUitleenbaar(boek)) {
    var teKoop = normaliseerTekst(boek.genre) === 'verkoop';
    return { code: 'niet_uitleenbaar', label: teKoop ? 'Te koop in de bib, niet uitleenbaar' : 'Niet uitleenbaar', totaal: totaal, beschikbaar: 0, terug: '' };
  }
  var uit = lopendeUitleningen(staat).filter(function (u) { return u.boek_id === boek.boek_id; });
  var reservaties = actieveReservaties(staat, boek.boek_id);
  var apart = reservaties.filter(function (r) { return r.status === STATUS_KLAAR; }).length;
  var wacht = reservaties.length - apart;
  var vrij = Math.max(0, totaal - uit.length - apart);
  var terug = uit.map(function (u) { return u.vervaldatum; }).sort()[0] || '';
  if (vrij > 0) {
    return { code: 'beschikbaar', label: totaal > 1 ? vrij + ' van ' + totaal + ' beschikbaar' : 'Beschikbaar', totaal: totaal, beschikbaar: vrij, terug: '' };
  }
  if (apart > 0 || wacht > 0) {
    return { code: 'gereserveerd', label: 'Gereserveerd', totaal: totaal, beschikbaar: 0, terug: terug };
  }
  var label = terug && terug >= staat.vandaag ? 'Uitgeleend, verwacht terug op ' + datumTekst(terug, staat.vandaag) : 'Uitgeleend';
  return { code: 'uitgeleend', label: label, totaal: totaal, beschikbaar: 0, terug: terug };
}

/** Beschrijving via Google Books. Geeft { tekst } of { limiet: true }. */
function beschrijvingUitGoogleBooks(isbn, sleutel) {
  var r = googleBooksZoek(isbn, sleutel);
  if (r.code === 429 || r.code === 403 || r.code === 400) return { limiet: true, fout: r.fout };
  var items = r.items;
  for (var i = 0; i < items.length; i++) {
    var tekst = maakBeschrijvingNetjes(items[i].volumeInfo && items[i].volumeInfo.description);
    if (tekst) return { tekst: tekst };
  }
  return { tekst: '' };
}

/** Beschrijving via Open Library: eerst de uitgave, dan het werk. */
function beschrijvingUitOpenLibrary(isbn) {
  var uitgave = haalJson('https://openlibrary.org/isbn/' + isbn + '.json');
  if (uitgave.code === 429) return { limiet: true };
  if (!uitgave.data) return { tekst: '' };
  var tekst = maakBeschrijvingNetjes(olTekst(uitgave.data.description));
  if (tekst) return { tekst: tekst };
  var werk = uitgave.data.works && uitgave.data.works.length ? uitgave.data.works[0].key : '';
  if (!/^\/works\/OL\d+W$/.test(String(werk))) return { tekst: '' };
  Utilities.sleep(1000);
  var w = haalJson('https://openlibrary.org' + werk + '.json');
  if (w.code === 429) return { limiet: true };
  return { tekst: maakBeschrijvingNetjes(olTekst(w.data && w.data.description)) };
}

/** Gegevens voor het bestuursscherm. */
function bestuurGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, true); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  lopend.forEach(function (info) {
    var sjabloon = info.status.code === 'telaat' ? staat.inst.tekst_herinnering : staat.inst.tekst_herinnering_binnenkort;
    info.herinnering = herinneringTekst(sjabloon, info, staat);
  });

  // Borgen: ingehouden (borg betaald en nog niet terug) per betaalwijze.
  var ingehouden = { totaal: 0, perBetaalwijze: {} };
  var terugTeBetalen = [];
  staat.uitleningen.forEach(function (u) {
    var borg = Number(u.borg || 0);
    if (borg <= 0 || !isLeeg(u.borg_terugbetaald)) return;
    var wijze = u.betaalwijze_borg || 'onbekend';
    ingehouden.totaal += borg;
    ingehouden.perBetaalwijze[wijze] = (ingehouden.perBetaalwijze[wijze] || 0) + borg;
    // Boek is terug, maar de borg nog niet: die moet nog terugbetaald worden.
    if (!isLeeg(u.datum_terug)) {
      var info = uitleningInfo(staat, u, true);
      info.datum_terug = u.datum_terug;
      terugTeBetalen.push(info);
    }
  });

  // Giften en uitleningen per maand, voor de laatste 12 maanden.
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), uitleningen: 0, giften: 0 };
  }
  var perBoek = {}, perGroep = {};
  var vertaal = vertaalTabel(onderwerpRijen);
  staat.uitleningen.forEach(function (u) {
    var maand = String(u.datum_uit || '').slice(0, 7);
    if (perMaand[maand]) {
      perMaand[maand].uitleningen++;
      perMaand[maand].giften += Number(u.gift || 0);
    }
    perBoek[u.boek_id] = (perBoek[u.boek_id] || 0) + 1;
    var boek = boekVan(staat, u.boek_id);
    if (boek) filtergroepenVan(boek, vertaal).forEach(function (g) { perGroep[g] = (perGroep[g] || 0) + 1; });
  });
  var meestGeleend = Object.keys(perBoek).sort(function (a, b) { return perBoek[b] - perBoek[a]; }).slice(0, 10).map(function (id) {
    var b = boekVan(staat, id);
    return { boek_id: id, titel: b ? b.titel : id, auteur: b ? b.auteur : '', aantal: perBoek[id] };
  });
  var groepen = Object.keys(perGroep).sort(function (a, b) { return perGroep[b] - perGroep[a]; }).map(function (g) {
    return { groep: g, aantal: perGroep[g] };
  });

  // Uitzonderingen van de laatste 6 maanden, nieuwste eerst.
  var grens = telMaandenOp(staat.vandaag, -6);
  var uitzonderingen = (staat.uitzonderingenTabel || []).filter(function (x) { return String(x.datum) >= grens; }).map(function (x) {
    var b = boekVan(staat, x.boek_id);
    return {
      datum: x.datum, wie: x.wie, grens: x.grens, lenersnummer: x.lenersnummer,
      voornaam: (lenerVan(staat, x.lenersnummer) || {}).voornaam || '',
      titel: b ? b.titel : x.boek_id, reden: x.reden, actie: x.actie
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });

  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    borgen: {
      ingehouden: ingehouden,
      terugTeBetalen: terugTeBetalen
    },
    perMaand: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    meestGeleend: meestGeleend,
    groepen: groepen,
    reservaties: alleReservaties(staat),
    uitzonderingen: uitzonderingen,
    boekstatus: boekenMetStatus(staat),
    boeken: baliecatalogus(staat),
    leners: staat.leners.map(function (l) {
      return {
        lenersnummer: l.lenersnummer, voornaam: l.voornaam, achternaam: l.achternaam, telefoon: l.telefoon,
        email: l.email, datum_inschrijving: l.datum_inschrijving, toestemming_privacy: l.toestemming_privacy,
        actief: jaNee(l.actief) !== 'nee',
        lopend: lopendeUitleningenVan(staat, l.lenersnummer).length
      };
    })
  };
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

/** Schrijft alle wijzigingen van een staat terug naar de spreadsheet. */
function bewaarStaat(staat) {
  ['Leners', 'Uitleningen', 'Reservaties', 'Uitzonderingen'].forEach(function (naam) {
    if (staat.tabellen[naam]) bewaarTabel(staat.tabellen[naam]);
  });
  if (staat.uitzonderingen.length) {
    var tabel = staat.tabellen.Uitzonderingen || leesTabel('Uitzonderingen');
    staat.uitzonderingen.forEach(function (x) { voegToe(tabel.rijen, x); });
    bewaarTabel(tabel);
  }
  staat.log.forEach(function (regel) { logboek(staat.wie, regel[0], regel[1]); });
}

/* ---------- Publiek eindpunt ---------- */

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

/** Bij elke wijziging met de hand in Catalogus, Onderwerpen of Instellingen: cache leegmaken. */
function bijWijziging(e) {
  var naam = e && e.range ? e.range.getSheet().getName() : '';
  if (['Catalogus', 'Onderwerpen', 'Instellingen', 'Uitleningen', 'Reservaties', 'Nieuws', 'Agenda', 'Veelgestelde vragen'].indexOf(naam) > -1) leegCache();
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
  staat.log.push(['boek aangepast', boek.boek_id]);
  return { ok: true, tekst: '"' + schoon(boek.titel) + '" is bewaard.', boek: beheerBoek(boek) };
}

/** Boeken met een status, per status, voor het bestuursscherm. */
function boekenMetStatus(staat) {
  var lijsten = { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] };
  staat.catalogus.forEach(function (b) {
    var s = boekStatus(b);
    if (!s || isLeeg(b.boek_id)) return;
    lijsten[s].push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur) });
  });
  Object.keys(lijsten).forEach(function (k) {
    lijsten[k].sort(function (a, b) { return a.titel.localeCompare(b.titel); });
  });
  return lijsten;
}

/** Een boek ophalen om aan te passen. */
function boekOphalen(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  return { ok: true, boek: beheerBoek(boek) };
}

/** Geeft '', 'verloren', 'gevoelig_verborgen' of 'gevoelig_zichtbaar'. Hoofdletters en kleine tikfouten mogen. */
function boekStatus(boek) {
  var s = normaliseerTekst(boek && boek.status);
  if (!s) return '';
  if (/verlor|kwijt/.test(s)) return 'verloren';
  if (/gevoelig/.test(s)) return /(^|\s)zichtbaar|waarschuw/.test(s) ? 'gevoelig_zichtbaar' : 'gevoelig_verborgen';
  return '';
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

function boekVan(staat, boekId) {
  var id = schoon(boekId).toUpperCase();
  for (var i = 0; i < staat.catalogus.length; i++) {
    if (String(staat.catalogus[i].boek_id).toUpperCase() === id) return staat.catalogus[i];
  }
  return null;
}

/**
 * Zoekt in een antwoord van bol.com de beste link naar een afbeelding. We weten niet zeker hoe
 * het antwoord eruitziet, dus we zoeken overal naar https-links naar afbeeldingen, en nemen
 * die met een breedte het dichtst bij 550 pixels (of anders de eerste).
 */
function bolAfbeelding(data) {
  var kandidaten = [];
  (function zoek(w, breedte) {
    if (!w) return;
    if (typeof w === 'string') {
      if (/^https:\/\/[^\s"'<>]+\.(jpe?g|png|webp)(\?[^\s"'<>]*)?$/i.test(w)) kandidaten.push({ url: w, breedte: breedte || 0 });
      return;
    }
    if (Array.isArray(w)) { w.forEach(function (x) { zoek(x, breedte); }); return; }
    if (typeof w === 'object') {
      var b = Number(w.width || w.breedte || 0) || breedte;
      Object.keys(w).forEach(function (k) { zoek(w[k], b); });
    }
  })(data, 0);
  if (!kandidaten.length) return '';
  kandidaten.sort(function (a, b) {
    var da = a.breedte ? Math.abs(a.breedte - 550) : 9999, db = b.breedte ? Math.abs(b.breedte - 550) : 9999;
    return da - db;
  });
  return kandidaten[0].url;
}

/** Een toegangsbewijs (token) van bol.com, 4 minuten bewaard. Geeft { token } of { fout }. */
function bolToken(inst) {
  if (!inst.bol_client_id || !inst.bol_client_secret) return { fout: 'Vul bol_client_id en bol_client_secret in bij Instellingen.' };
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get('bol_token');
  if (bewaard) return { token: bewaard };
  var r = UrlFetchApp.fetch('https://login.bol.com/token?grant_type=client_credentials', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(inst.bol_client_id + ':' + inst.bol_client_secret), Accept: 'application/json' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  if (r.getResponseCode() !== 200 || !data || !data.access_token) {
    return { fout: 'bol.com gaf geen toegang (code ' + r.getResponseCode() + '). Kijk de Client ID en Client Secret na.' };
  }
  cache.put('bol_token', data.access_token, 240);
  return { token: data.access_token };
}

/** Vraagt iets op bij de Marketing Catalog API. Geeft { code, data }. */
function bolVraag(pad, token) {
  var r = UrlFetchApp.fetch(BOL_API + pad, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Accept-Language': 'nl' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  return { code: r.getResponseCode(), data: data };
}

/** Bestuur: de borg van een uitlening als terugbetaald noteren. */
function borgTerugbetaald(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.borg_terugbetaald)) return { ok: false, fout: 'Deze borg is al terugbetaald.' };
  wijzig(u, { borg_terugbetaald: staat.vandaag });
  staat.log.push(['borg terugbetaald', u.uitlening_id]);
  return { ok: true, tekst: 'Borg genoteerd als terugbetaald.' };
}

/** Bouwt het object dat het publieke eindpunt teruggeeft. */
function bouwPubliekeCatalogus(staat, onderwerpRijen) {
  var vertaal = vertaalTabel(onderwerpRijen);
  // Namen in de instelling aanraders_verbergen verschijnen nergens op de website.
  var verborgen = splitsLijst((staat.inst || {}).aanraders_verbergen).map(normaliseerTekst);
  var boeken = [];
  staat.catalogus.forEach(function (rij) {
    if (isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
    if (!opWebsite(rij)) return;
    var b = beschikbaarheid(staat, rij);
    var boek = {
      id: String(rij.boek_id),
      t: schoon(rij.titel),
      a: schoon(rij.auteur),
      g: filtergroepenVan(rij, vertaal),
      s: normaliseerTekst(rij.soort) === 'zine' ? 'zine' : 'boek',
      b: { c: b.code, l: b.label, t: b.totaal, v: b.beschikbaar }
    };
    // Datum van verwachte terugkeer en "te koop": zo maakt de website het label in elke taal op.
    if (b.code === 'uitgeleend' && b.terug && b.terug >= staat.vandaag) boek.b.d = b.terug;
    if (b.code === 'niet_uitleenbaar' && normaliseerTekst(rij.genre) === 'verkoop') boek.b.k = 1;
    if (boekStatus(rij) === 'gevoelig_zichtbaar') boek.w = 1;
    // Lege velden laten we weg: dat maakt de lijst kleiner.
    var extra = {
      i: schoon(rij.isbn), u: schoon(rij.uitgeverij), j: parseerGetal(rij.jaartal) || '',
      l: schoon(rij.taal), p: parseerGetal(rij.paginas) || '', v: schoon(rij.uitvoering),
      n: jaNee(rij.nieuwstaat) === 'ja' ? 'nieuw' : (jaNee(rij.nieuwstaat) === 'nee' ? 'tweedehands' : ''),
      d: schoonMetRegels(rij.beschrijving), c: veiligeCoverUrl(rij.cover_url), ta: parseerDatum(rij.toegevoegd_op),
      db: /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(schoon(rij.beschrijving_bron)) && schoonMetRegels(rij.beschrijving) ? schoon(rij.beschrijving_bron) : ''
    };
    var en = schoonMetRegels(rij.beschrijving_en);
    if (en && en !== extra.d) extra.de = en;
    Object.keys(extra).forEach(function (k) { if (!isLeeg(extra[k])) boek[k] = extra[k]; });
    var aanraders = splitsLijst(String(rij.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
      return verborgen.indexOf(normaliseerTekst(naam)) === -1;
    });
    if (aanraders.length) boek.r = aanraders;
    boeken.push(boek);
  });
  // Filtergroepen: eerst de standaardvolgorde, dan eventuele eigen groepen.
  var groepen = FILTERGROEPEN.slice();
  boeken.forEach(function (b) { b.g.forEach(function (g) { if (groepen.indexOf(g) === -1) groepen.push(g); }); });
  return {
    bijgewerkt: staat.vandaag,
    teksten: publiekeTeksten(staat.inst),
    filtergroepen: groepen,
    boeken: boeken
  };
}

/**
 * Zet de antwoorden van de roostertool (actie "maand") om naar één lijst avonden
 * vanaf vandaag. Een maand zonder gepubliceerd rooster toont enkel de avonden.
 * antwoorden: lijst van { maand, avonden: [{ datum, status, event }], rooster: [...] of null }
 */
function bouwRoosterOverzicht(antwoorden, vandaag) {
  var avonden = [];
  var nietGepubliceerd = [];
  antwoorden.forEach(function (a) {
    if (!a || !a.ok) return;
    var perDatum = {};
    (a.rooster || []).forEach(function (r) { perDatum[r.datum] = r; });
    if (!a.rooster) nietGepubliceerd.push(a.maand);
    (a.avonden || []).forEach(function (av) {
      if (String(av.datum) < vandaag) return;
      var r = perDatum[av.datum] || {};
      avonden.push({
        datum: av.datum,
        status: av.status || 'open',
        event: schoon(av.event),
        vrijwilligers: r.vrijwilligers || [],
        backups: r.backups || [],
        afgemeld: r.afgemeld || [],
        gepubliceerd: !!a.rooster
      });
    });
  });
  avonden.sort(function (x, y) { return x.datum < y.datum ? -1 : 1; });
  return { avonden: avonden, nietGepubliceerd: nietGepubliceerd };
}

/**
 * Bouwt de inhoud van de startpagina (zonder de spreadsheet aan te raken).
 * tabellen: { nieuws, agenda, faq } met de rijen van die tabbladen.
 * staat: zoals in Uitlenen.js (voor de aanraders en hun beschikbaarheid).
 */
function bouwSiteInhoud(staat, tabellen) {
  var inst = staat.inst;

  var nieuws = (tabellen.nieuws || []).filter(function (r) { return isPubliek(r) && (r.titel || r.tekst); })
    .sort(function (a, b) { return String(b.datum || '').localeCompare(String(a.datum || '')); })
    .slice(0, SITE_MAX_NIEUWS)
    .map(function (r) {
      return { datum: parseerDatum(r.datum), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link) };
    });

  var events = (tabellen.agenda || []).filter(function (r) { return isPubliek(r) && parseerDatum(r.datum) && r.titel; })
    .map(function (r) {
      return {
        datum: parseerDatum(r.datum), uur: schoon(r.uur), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'),
        locatie: schoon(r.locatie), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link)
      };
    });
  var komend = events.filter(function (e) { return e.datum >= staat.vandaag; }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
  var voorbij = events.filter(function (e) { return e.datum < staat.vandaag; }).sort(function (a, b) { return b.datum.localeCompare(a.datum); });

  var faq = (tabellen.faq || []).filter(function (r) { return isPubliek(r) && r.vraag; })
    .sort(function (a, b) { return (parseerGetal(a.volgorde) || 999) - (parseerGetal(b.volgorde) || 999); })
    .map(function (r) { return { vraag: tweetalig(r, 'vraag'), antwoord: tweetaligLang(r, 'antwoord') }; });

  // Aanraders op de startpagina. Een boek staat erop als:
  //   - de kolom startpagina "ja" is, of
  //   - iemand het aanraadt (namen uit aanraders_verbergen tellen niet mee).
  // Beschikbare boeken eerst, daarna willekeurig maar vast per week: elke maandag een nieuwe keuze.
  // Nieuw binnen is een aparte lijst (zie verder): zo verdringen de aanraders de nieuwe boeken nooit.
  // "nee" in de kolom startpagina haalt een boek er altijd af.
  // Een boek met gevoelige inhoud komt er enkel op met "ja" in de kolom startpagina.
  var verborgen = splitsLijst(inst.aanraders_verbergen).map(normaliseerTekst);
  var dagenNieuw = parseerGetal(inst.nieuw_op_startpagina_dagen);
  if (dagenNieuw === null) dagenNieuw = 60;
  var isNieuw = function (b) {
    var d = parseerDatum(b.toegevoegd_op);
    if (!d || dagenNieuw <= 0) return false;
    var dagen = dagenTussen(d, staat.vandaag);
    return dagen >= 0 && dagen < dagenNieuw;
  };
  var kandidaten = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && opWebsite(b) && jaNee(b.startpagina) !== 'nee';
  });
  var startpaginaBoek = function (b) {
    var bs = beschikbaarheid(staat, b);
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), c: veiligeCoverUrl(b.cover_url),
      s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : 'boek',
      r: splitsLijst(String(b.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
        return verborgen.indexOf(normaliseerTekst(naam)) === -1;
      }),
      n: isNieuw(b) ? 1 : 0,
      zelf: jaNee(b.startpagina) === 'ja',
      gevoelig: boekStatus(b) === 'gevoelig_zichtbaar',
      vrij: bs.code === 'beschikbaar',
      volgorde: dagVolgorde(String(b.boek_id), weekBegin(staat.vandaag)),
      toegevoegd: parseerDatum(b.toegevoegd_op) || ''
    };
  };
  var opruimen = function (b) { delete b.volgorde; delete b.zelf; delete b.toegevoegd; if (b.gevoelig) b.w = 1; delete b.gevoelig; return b; };
  var aanraders = kandidaten.map(startpaginaBoek)
    .filter(function (b) { return b.zelf || (!b.gevoelig && b.r.length); })
    .sort(function (a, b) { return (b.vrij - a.vrij) || (a.volgorde - b.volgorde); })
    .slice(0, SITE_MAX_AANRADERS)
    .map(opruimen);

  // Nieuw binnen: de laatst toegevoegde boeken, nieuwste eerst.
  var aantalNieuw = parseerGetal(inst.nieuw_op_startpagina_aantal);
  if (aantalNieuw === null) aantalNieuw = 8;
  // Zijn er minder nieuwe boeken dan het aantal, dan vullen we aan met de laatst
  // gecatalogiseerde boeken: het hoogste boek-ID kwam het laatst in de Catalogus.
  // Zo is de sectie nooit leeg, ook niet net na de eerste opbouw (toen kreeg geen
  // enkel boek een datum in toegevoegd_op). 0 dagen: Nieuw binnen staat uit.
  var nieuwsteEerst = function (a, b) { return b.toegevoegd.localeCompare(a.toegevoegd) || idNummer(b.id) - idNummer(a.id); };
  var nieuwBinnen = [];
  if (dagenNieuw > 0) {
    var toonbaar = kandidaten.map(startpaginaBoek).filter(function (b) { return b.zelf || !b.gevoelig; });
    nieuwBinnen = toonbaar.filter(function (b) { return b.n; }).sort(nieuwsteEerst);
    if (nieuwBinnen.length < aantalNieuw) {
      nieuwBinnen = nieuwBinnen.concat(toonbaar.filter(function (b) { return !b.n; }).sort(nieuwsteEerst));
    }
    nieuwBinnen = nieuwBinnen.slice(0, Math.max(0, aantalNieuw)).map(opruimen);
  }

  return {
    bijgewerkt: staat.vandaag,
    contact: {
      adres: String(inst.adres || ''), openingsuren: { nl: String(inst.openingsuren || ''), en: String(inst.openingsuren_en || '') || String(inst.openingsuren || '') },
      mail_algemeen: inst.mail_algemeen, mail_events: inst.mail_events
    },
    nieuws: nieuws,
    agenda: { komend: komend.slice(0, 3), vorig: voorbij[0] || null },
    faq: faq,
    aanraders: aanraders,
    nieuw: nieuwBinnen,
    // Pagina Doe mee. Een leeg blok toont de website niet.
    doeMee: {
      vrijwilliger: { nl: String(inst.tekst_vrijwilliger || ''), en: String(inst.tekst_vrijwilliger_en || '') || String(inst.tekst_vrijwilliger || '') },
      schenken: { nl: String(inst.tekst_schenken || ''), en: String(inst.tekst_schenken_en || '') || String(inst.tekst_schenken || '') },
      steunen: { nl: String(inst.tekst_steunen || ''), en: String(inst.tekst_steunen_en || '') || String(inst.tekst_steunen || '') }
    }
  };
}

/**
 * Sleutel om hetzelfde boek te herkennen: het ISBN, of anders de volledige titel en auteur.
 * Een boek zonder geldig ISBN maar met een ongeldig nummer, gebruikt titel en auteur.
 */
function bronSleutel(boek) {
  if (boek.isbn) return boek.soort + ':isbn:' + boek.isbn;
  // De volledige titel: "Ember: Macht (derde editie)" en "Ember: Bubbels (tweede editie)"
  // zijn verschillende boeken. Enkel hoofdletters, accenten en leestekens tellen niet.
  return boek.soort + ':ta:' + normaliseerTekst(boek.titel) + '|' + normaliseerTekst(boek.auteur);
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

/**
 * Controleert alle grenzen van een actie.
 * Geeft een lijst terug met de overschreden grenzen: [{ id, naam, melding }].
 */
function controleerGrenzen(actie, ctx) {
  var overschreden = [];
  GRENZEN.forEach(function (g) {
    if (g.actie !== actie) return;
    var melding = g.controleer(ctx);
    if (melding) overschreden.push({ id: g.id, naam: g.naam, melding: melding });
  });
  return overschreden;
}

/**
 * Bewaart wat de browser bij Google Books en Open Library vond.
 * invoer.items: [{ boek_id, google, ol, bron, cover, meta: { beschrijving, uitgeverij, jaartal, paginas, taal } }]
 *   google / ol: dit boek werd daar opgezocht (dan krijgt het een datum in gb_gecontroleerd / cover_gezocht)
 *   bron: 'google', 'ol-isbn', 'ol-titel' of 'ia' (Internet Archive)
 * Enkel lege velden worden aangevuld, en enkel covers van Google of Open Library.
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

/**
 * De boeken zonder cover of zonder beschrijving die de browser nog moet opzoeken.
 *   g: nog niet bij Google opgezocht (enkel met een ISBN): voor een cover en een beschrijving
 *   o: nog niet bij Open Library opgezocht voor een andere uitgave (ISBN, of titel en auteur)
 *   i: nog niet bij Internet Archive opgezocht (enkel met een ISBN)
 */
function coversTeZoeken(staat) {
  var boeken = [];
  staat.catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var zonderCover = isLeeg(b.cover_url);
    if (!zonderCover && !isLeeg(b.beschrijving)) return;
    var isbn = /^\d{13}$/.test(String(b.isbn || '')) ? String(b.isbn) : '';
    // Google: voor een cover en voor een beschrijving. Open Library en Internet Archive: enkel voor een cover.
    var g = !!isbn && isLeeg(b.gb_gecontroleerd);
    var o = zonderCover && isLeeg(b.cover_gezocht) && (!!isbn || !isLeeg(b.titel));
    var i = zonderCover && !!isbn && isLeeg(b.ia_gezocht);
    if (g || o || i) boeken.push({ id: String(b.boek_id), isbn: isbn, t: schoon(b.titel), a: schoon(b.auteur), g: g, o: o, i: i });
  });
  return { ok: true, boeken: boeken, sleutel: String(staat.inst.google_books_api_key || '') };
}

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

/** "1 dag" of "5 dagen". */
function dagenTekst(n) {
  return n + (n === 1 ? ' dag' : ' dagen');
}

/** Aantal dagen van datum a tot datum b (positief als b later is). */
function dagenTussen(a, b) {
  return Math.round((naarUtc(b) - naarUtc(a)) / 86400000);
}

/** Een getal dat per boek en per periode anders is: zo wisselt de keuze van de aanraders. */
function dagVolgorde(id, dag) {
  // FNV-1a met een eindmenging: een kleine wijziging in de datum geeft een heel andere volgorde.
  var tekst = id + '|' + dag;
  var h = 2166136261;
  for (var i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * Datum als leesbare tekst: "vrijdag 20 november".
 * Valt de datum in een ander jaar dan vandaag, dan komt het jaar erbij.
 */
function datumTekst(datum, vandaag) {
  if (!datum) return '';
  var d = naarUtc(datum);
  var tekst = WEEKDAGEN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MAANDEN[d.getUTCMonth()];
  if (vandaag && vandaag.slice(0, 4) !== datum.slice(0, 4)) tekst += ' ' + d.getUTCFullYear();
  return tekst;
}

/** GET: de publieke catalogus. */
function doGet(e) {
  var actie = e && e.parameter ? e.parameter.actie : '';
  if (actie === 'catalogus') return json(publiekeCatalogusJson(), true);
  if (actie === 'site') return json(siteInhoudJson(), true);
  return json(JSON.stringify({ ok: true, info: 'Catalogus Project Madrigal. Gebruik ?actie=catalogus.' }), true);
}

/** POST: acties voor de balie en het bestuur. */
function doPost(e) {
  var invoer;
  try {
    invoer = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, fout: 'Ongeldig verzoek.' });
  }
  if (!invoer || typeof invoer !== 'object') return json({ ok: false, fout: 'Ongeldig verzoek.' });
  var actie = String(invoer.actie || '');
  if (!ACTIES.hasOwnProperty(actie)) return json({ ok: false, fout: 'Onbekende actie.' });

  if (ACTIES[actie] === 'publiek') {
    try {
      return json(publiekeAanvraag(invoer));
    } catch (err) {
      logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
      return json({ ok: false, fout: 'Er ging iets mis. Probeer het later opnieuw of kom langs in de bib.' });
    }
  }

  var rol = rolVoorCode(invoer.code, leesInstellingen());
  if (!rol) {
    // Even wachten maakt het raden van codes trager.
    Utilities.sleep(1500);
    return json({ ok: false, fout: 'De code klopt niet.', code: 'ongeldige_code' });
  }
  if (ACTIES[actie] === 'bestuur' && rol !== 'bestuur') {
    return json({ ok: false, fout: 'Dit kan enkel met de code van het bestuur.' });
  }

  try {
    return json(voerActieUit(actie, invoer, rol));
  } catch (err) {
    logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
    return json({ ok: false, fout: 'Er ging iets mis: ' + String(err && err.message || err) });
  }
}

/** De eerste niet-lege waarde uit een lijst mogelijke veldnamen. */
function eersteVeld(rij, namen) {
  for (var i = 0; i < namen.length; i++) {
    var w = rij[namen[i]];
    if (w !== undefined && w !== null && String(w).trim() !== '') return w;
  }
  return '';
}

/** Zoekt boek en exemplaar bij een exemplaarnummer. "B0012" mag ook als er maar één exemplaar is. */
function exemplaarInfo(staat, exemplaar) {
  var t = schoon(exemplaar).toUpperCase();
  var m = t.match(/^([A-Z]\d+)(?:-(\d+))?$/);
  if (!m) return null;
  var boek = boekVan(staat, m[1]);
  if (!boek) return null;
  var nr = m[2] ? Number(m[2]) : 1;
  if (nr < 1 || nr > aantalExemplaren(boek)) return null;
  return { boek: boek, exemplaar: boek.boek_id + '-' + nr };
}

/** Alle exemplaarnummers van een boek: ["B0012-1", "B0012-2"]. */
function exemplarenVan(boek) {
  var lijst = [];
  for (var i = 1; i <= aantalExemplaren(boek); i++) lijst.push(boek.boek_id + '-' + i);
  return lijst;
}

/**
 * Bepaalt de filtergroepen van een boek: via de vertaaltabel, de kolom
 * extra_onderwerpen, het vinkje klassieker en de soort (zines).
 * vertaal: object genre (genormaliseerd) -> lijst filtergroepen.
 */
function filtergroepenVan(boek, vertaal) {
  var groepen = (vertaal[normaliseerTekst(boek.genre)] || []).slice();
  splitsLijst(boek.extra_onderwerpen).forEach(function (g) { groepen.push(g); });
  if (jaNee(boek.klassieker) === 'ja') groepen.push('Klassiekers');
  if (normaliseerTekst(boek.soort) === 'zine') groepen.push('Zines');
  // Schrijfwijze gelijktrekken met de standaardgroepen, dubbels weg.
  var uniek = [];
  groepen.forEach(function (g) {
    var standaard = FILTERGROEPEN.filter(function (f) { return normaliseerTekst(f) === normaliseerTekst(g); })[0] || schoon(g);
    if (standaard && uniek.indexOf(standaard) === -1) uniek.push(standaard);
  });
  return uniek;
}

/**
 * Een exemplaar komt vrij (teruggebracht, reservatie vervallen of geannuleerd).
 * Wacht er iemand op dit boek, dan krijgt de eerste in de wachtrij dit exemplaar.
 * Geeft de melding voor de vrijwilliger terug, of null.
 */
function geefExemplaarDoor(staat, boekId, exemplaar) {
  var wachtend = actieveReservaties(staat, boekId).filter(function (r) { return r.status === STATUS_WACHT; });
  if (!wachtend.length) return null;
  var r = wachtend[0];
  wijzig(r, {
    status: STATUS_KLAAR, exemplaar: exemplaar, datum_klaar: staat.vandaag,
    ophalen_tot: berekenOphaalTermijn(staat.vandaag, staat.inst)
  });
  staat.log.push(['reservatie klaar', r.reservatie_id + ' ' + exemplaar + ' voor lener ' + r.lenersnummer]);
  return apartLeggenMelding(staat, r);
}

/**
 * Geeft elke rij zonder boek-ID (maar met een titel) een boek-ID, de datum van
 * vandaag in toegevoegd_op en nette waarden (ISBN, taal, ...). Geeft het aantal terug.
 */
function geefNieuweBoekenEenId() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    tabel.rijen.forEach(function (rij) {
      if (!isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
      var soort = normaliseerTekst(rij.soort) === 'zine' ? 'zine' : 'boek';
      var isbn = normaliseerIsbn(rij.isbn);
      var velden = {
        boek_id: ids.nieuw(soort),
        soort: soort,
        titel: schoon(rij.titel), auteur: schoon(rij.auteur),
        isbn: isbn.isbn || isbn.issn || schoon(rij.isbn),
        taal: normaliseerTaal(rij.taal),
        uitvoering: normaliseerUitvoering(rij.uitvoering),
        nieuwstaat: jaNee(rij.nieuwstaat),
        aantal: parseerGetal(rij.aantal) || 1,
        uitleenbaar: jaNee(rij.uitleenbaar) || 'ja',
        publiek: jaNee(rij.publiek) || 'ja',
        toegevoegd_op: parseerDatum(rij.toegevoegd_op) || vandaagTekst()
      };
      velden.bron_sleutel = bronSleutel({ soort: soort, isbn: velden.isbn, titel: velden.titel, auteur: velden.auteur });
      wijzig(rij, velden);
      aantal++;
    });
    if (aantal) {
      bewaarTabel(tabel);
      ids.bewaar();
    }
  } finally {
    lock.releaseLock();
  }
  return aantal;
}

/** Hulp voor parseerDatum: controleert of dag en maand bestaan. */
function geldigeDatum(jaar, maand, dag) {
  var d = new Date(Date.UTC(jaar, maand - 1, dag));
  if (d.getUTCFullYear() !== jaar || d.getUTCMonth() !== maand - 1 || d.getUTCDate() !== dag) return '';
  return jaar + '-' + tweeCijfers(maand) + '-' + tweeCijfers(dag);
}

function geldigEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Telefoonnummer: cijfers, spaties, +, /, . en - ; minstens 8 cijfers. */
function geldigeTelefoon(t) {
  return /^[+0-9 ()\/.\-]{8,25}$/.test(t) && t.replace(/\D/g, '').length >= 8;
}

/** Gelijkenis tussen twee teksten, van 0 (niets gemeen) tot 1 (gelijk). */
function gelijkenis(a, b) {
  if (!a && !b) return 1;
  var max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** Goodreads zet ISBN's als ="0123456789". Dit haalt die tekens weg. */
function goodreadsIsbn(waarde) {
  return normaliseerIsbn(String(waarde || '').replace(/[="]/g, '')).isbn;
}

/** De eerste niet-lege waarde uit een lijst Goodreads-kolommen. */
function goodreadsWaarde(rij, kolommen) {
  for (var i = 0; i < kolommen.length; i++) {
    var w = rij[kolommen[i]];
    if (!isLeeg(w) && String(w).trim() !== '0') return w;
  }
  return '';
}

/**
 * Het adres om een ISBN op te vragen bij Google Books.
 * country=BE: Apps Script draait op servers van Google, zonder gekend land. Zonder
 * land weigert Google met "Cannot determine user location" (unknownLocation).
 */
function googleBooksUrl(isbn, sleutel, land, vorm) {
  return 'https://www.googleapis.com/books/v1/volumes?q=' + (vorm === 'vrij' ? '' : 'isbn:') + encodeURIComponent(isbn) +
    (land === '' ? '' : '&country=' + (land || 'BE')) + (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
}

/** Eén vraag aan Google Books. Geeft { code, items, limiet, fout }. */
function googleBooksVraag(url) {
  var a = haalJson(url);
  var r = { code: a.code, items: (a.data && a.data.items) || [], limiet: false, fout: '' };
  if (a.code >= 400) {
    r.fout = googleFout(a.data) || ('code ' + a.code);
    r.limiet = isGoogleLimiet(a.code, r.fout);
  }
  return r;
}

/**
 * Zoekt een ISBN op bij Google Books. Geeft { code, items, limiet, fout } terug.
 *   limiet: Google zegt dat de daglimiet op is (dan later opnieuw proberen);
 *   fout:   wat Google zelf als reden geeft, bv. "API not enabled" of een probleem met de sleutel.
 */
function googleBooksZoek(isbn, sleutel, land) {
  // Eerst op het ISBN als gewoon getal: dat werkt bij Google het best. We nemen enkel een
  // uitgave met precies dat ISBN. Levert dat niets op, dan als reserve de vorm "isbn:…".
  var r = googleBooksVraag(googleBooksUrl(isbn, sleutel, land, 'vrij'));
  if (!r.fout) r.items = googleItemsMetIsbn(r.items, isbn);
  if (r.limiet || r.items.length) return r;
  var reserve = googleBooksVraag(googleBooksUrl(isbn, sleutel, land));
  if (!reserve.fout) return reserve;
  return r.fout ? r : { code: 200, items: [], limiet: false, fout: '' };
}

/** De foutmelding uit een antwoord van Google, kort. */
function googleFout(data) {
  var e = data && data.error;
  if (!e) return '';
  var reden = e.errors && e.errors[0] && e.errors[0].reason ? ' (' + e.errors[0].reason + ')' : '';
  return String(e.message || e.status || '').replace(/\s+/g, ' ').slice(0, 200) + reden;
}

/** Enkel de uitgaven met precies dit ISBN (13 of 10 cijfers). */
function googleItemsMetIsbn(items, isbn) {
  var gezocht = [String(isbn), isbn13Naar10(isbn)].filter(Boolean);
  return (items || []).filter(function (it) {
    var ids = (it && it.volumeInfo && it.volumeInfo.industryIdentifiers) || [];
    return ids.some(function (id) { return gezocht.indexOf(String(id.identifier || '').replace(/[^0-9X]/gi, '').toUpperCase()) > -1; });
  });
}

/** Haalt JSON op. Geeft { code, data } terug. */
function haalJson(url) {
  var antwoord = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
  var data = null;
  try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = null; }
  return { code: antwoord.getResponseCode(), data: data };
}

/** Haalt een tabel op uit de oude databank. Geeft [] als die niet bestaat. */
function haalOudeTabel(db, tabel) {
  var antwoord = UrlFetchApp.fetch(db.url + '/rest/v1/' + tabel + '?select=*', {
    muteHttpExceptions: true,
    headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
  });
  if (antwoord.getResponseCode() !== 200) return [];
  try { return JSON.parse(antwoord.getContentText()) || []; } catch (e) { return []; }
}

/** Vraagt één maand op bij de roostertool. */
function haalRoosterMaand(url, code, maand) {
  var antwoord = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'text/plain',
    payload: JSON.stringify({ actie: 'maand', code: code, maand: maand }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  try { return JSON.parse(antwoord.getContentText()); } catch (e) { return { ok: false, fout: 'Het rooster gaf een onverwacht antwoord.' }; }
}

/** Heeft dit boek nog een cover nodig van een andere uitgave? */
function heeftAndereUitgaveNodig(boek) {
  if (!isLeeg(boek.cover_url) || !isLeeg(boek.cover_gezocht)) return false;
  return /^\d{13}$/.test(String(boek.isbn || '')) || !isLeeg(boek.titel);
}

/** Moet het script voor dit boek nog een beschrijving zoeken? (Ook als enkel Google nog moet.) */
function heeftBeschrijvingNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.beschrijving_gezocht) && !wachtOpGoogle(boek)) return false;
  return isLeeg(boek.beschrijving);
}

/** Heeft dit boek nog een cover van bol.com nodig? */
function heeftBolNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.bol_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** Heeft dit boek nog een cover nodig van Google Books? */
function heeftGoogleBooksNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.gb_gecontroleerd)) return false;
  return isLeeg(boek.cover_url);
}

/** Heeft dit boek nog een cover van Internet Archive nodig? */
function heeftIaNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.ia_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** Heeft dit boek nog iets nodig van Open Library? */
function heeftOpenLibraryNodig(boek) {
  var isbn = String(boek.isbn || '');
  if (!/^\d{13}$/.test(isbn)) return false;
  if (!isLeeg(boek.ol_gecontroleerd)) return false;
  return OL_VELDEN.some(function (v) { return isLeeg(boek[v]); });
}

/** Moet deze beschrijving nog vertaald worden? */
function heeftVertalingNodig(boek) {
  return !isLeeg(boek.beschrijving) && isLeeg(boek.beschrijving_vertaald);
}

/** Heeft dit boek nog een beschrijving van Wikipedia nodig? */
function heeftWikiNodig(boek) {
  return isLeeg(boek.beschrijving) && isLeeg(boek.wiki_gezocht) && !isLeeg(boek.titel) && !isLeeg(boek.auteur);
}

/**
 * Menu: wist de Catalogus en bouwt ze opnieuw op uit Stock en Zines.
 * Enkel bedoeld voor de eerste opbouw. Wat je met de hand in de Catalogus
 * aanpaste, gaat verloren. Het script weigert zodra er uitleningen of
 * reservaties zijn, want die verwijzen naar de boek-ID's.
 */
function herbouwCatalogus() {
  if (leesTabel('Uitleningen').rijen.length || leesTabel('Reservaties').rijen.length) {
    meld('De Catalogus opnieuw opbouwen kan niet meer: er zijn al uitleningen of reservaties. Die verwijzen naar de boek-ID\'s.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var antwoord = ui.alert('Catalogus opnieuw opbouwen',
    'Dit wist alle boeken in het tabblad Catalogus, ook wat je er met de hand aanpaste, en bouwt ze opnieuw op uit Stock en Zines. De boek-ID\'s beginnen opnieuw bij B0001. Doorgaan?',
    ui.ButtonSet.YES_NO);
  if (antwoord !== ui.Button.YES) return;
  var blad = spreadsheet().getSheetByName('Catalogus');
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, blad.getLastColumn()).clearContent();
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('teller_boek_B');
  props.deleteProperty('teller_boek_Z');
  logboek('menu', 'herbouwCatalogus', 'Catalogus gewist');
  maakCatalogus();
}

/** Vult de herinneringstekst in voor een uitlening. */
function herinneringTekst(sjabloon, info, staat) {
  return String(sjabloon || '')
    .replace(/\{voornaam\}/g, info.voornaam || '')
    .replace(/\{titel\}/g, info.titel || '')
    .replace(/\{vervaldatum\}/g, datumTekst(info.vervaldatum, staat.vandaag));
}

/** Bestuur: noteren dat een herinnering verstuurd werd. */
function herinneringVerstuurd(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  wijzig(u, { laatste_herinnering: staat.vandaag });
  staat.log.push(['herinnering verstuurd', u.uitlening_id]);
  return { ok: true, tekst: 'Herinnering genoteerd op ' + korteDatum(staat.vandaag) + '.' };
}

/** Menu: zoekt de afgebroken beschrijvingen opnieuw op, volledig. */
function herstelAfgebrokenBeschrijvingen() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var tabel = leesTabel('Catalogus');
    n = maakAfgebrokenLeeg(tabel.rijen);
    bewaarTabel(tabel);
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'herstelAfgebrokenBeschrijvingen', n + ' beschrijvingen opnieuw te zoeken');
  if (!n) { meld('Er zijn geen afgebroken beschrijvingen.'); return; }
  meld(n + ' afgebroken beschrijvingen worden opnieuw opgezocht en vertaald. Dat gebeurt in porties en gaat vanzelf verder. Het Logboek toont de stand.');
  vulBeschrijvingenAan();
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

/** HTML uit de oude databank naar gewone tekst met regeleinden. */
function htmlNaarTekst(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Haalt een afbeelding op en kijkt of het een staande cover is (en niet het logo van Internet Archive). */
function iaCoverIsEcht(url) {
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
    if (r.getResponseCode() !== 200) return false;
    return isStaandeCover(afbeeldingAfmetingen(r.getBlob().getBytes()));
  } catch (e) {
    return false;
  }
}

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

/** Kiest uit het antwoord van Internet Archive de eerste bruikbare link, of ''. */
function iaCoverUitAntwoord(data) {
  var docs = (data && data.response && data.response.docs) || [];
  for (var i = 0; i < docs.length; i++) {
    var url = iaCoverUrl(docs[i].identifier);
    if (url) return url;
  }
  return '';
}

/** De link naar de afbeelding van een boek bij Internet Archive. Enkel veilige namen. */
function iaCoverUrl(identifier) {
  var id = String(identifier || '');
  return /^[A-Za-z0-9._-]+$/.test(id) ? 'https://archive.org/services/img/' + id : '';
}

/** De zoekvraag voor Internet Archive: het ISBN in 13 en in 10 cijfers. */
function iaZoekUrl(isbn) {
  var nummers = [String(isbn), isbn13Naar10(isbn)].filter(Boolean).join(' OR ');
  return 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('isbn:(' + nummers + ')') +
    '&fl%5B%5D=identifier&fl%5B%5D=title&rows=3&output=json';
}

/** Het getal in een boek-ID: B0123 wordt 123. */
function idNummer(id) {
  return Number(String(id).replace(/\D/g, '')) || 0;
}

/** Menu: neemt nieuws, agenda en veelgestelde vragen over van de oude website. */
function importeerOudeSite() {
  installeer(); // zorgt dat de tabbladen Nieuws, Agenda en Veelgestelde vragen bestaan
  var db = vindOudeDatabank();
  var posts = haalOudeTabel(db, 'posts');
  if (!posts.length) posts = haalOudeTabel(db, 'view_posts');
  var events = haalOudeTabel(db, 'events');
  var faq = haalOudeTabel(db, 'faq');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var tellers = {};
  try {
    [['Nieuws', zetOudeNieuwsOm(posts, db.url)], ['Agenda', zetOudeEventsOm(events, db.url)], ['Veelgestelde vragen', zetOudeFaqOm(faq)]].forEach(function (paar) {
      var tabel = leesTabel(paar[0]);
      tellers[paar[0]] = voegOudeRijenToe(tabel.rijen, paar[1]);
      bewaarTabel(tabel);
    });
  } finally {
    lock.releaseLock();
  }
  leegCache();
  // Welke velden de oude databank had: handig als er iets ontbreekt.
  var velden = function (rijen) { return rijen.length ? Object.keys(rijen[0]).join(', ') : '(leeg)'; };
  logboek('menu', 'importeerOudeSite', 'nieuws: ' + velden(posts) + ' | events: ' + velden(events) + ' | faq: ' + velden(faq));
  meld('Overgenomen van de oude website: ' + tellers['Nieuws'] + ' nieuwsberichten, ' + tellers['Agenda'] + ' events en ' +
    tellers['Veelgestelde vragen'] + ' veelgestelde vragen. Kijk ze na in de tabbladen. De Engelse kolommen vul je zelf aan waar nodig.');
}

/**
 * Past een rij van Nieuws, Agenda of Veelgestelde vragen aan, voegt er een toe of verwijdert er een.
 * invoer: { tabblad, rij (leeg = nieuw), vingerafdruk, velden, verwijderen }
 * rijen: de rijen van dat tabblad (worden aangepast).
 */
function inhoudAanpassen(rijen, invoer) {
  var tabblad = String(invoer.tabblad || '');
  var kolommen = BEHEER_INHOUD[tabblad];
  if (!kolommen) return { ok: false, fout: 'Onbekend tabblad.' };
  var rij = null;
  if (invoer.rij) {
    rij = rijen.filter(function (r) { return r._rij === Number(invoer.rij); })[0];
    if (!rij || vingerafdruk(rij, kolommen) !== String(invoer.vingerafdruk)) {
      return { ok: false, fout: 'Iemand paste dit intussen aan in de spreadsheet. Klik op Vernieuw en probeer opnieuw.' };
    }
  }
  if (invoer.verwijderen) {
    if (!rij) return { ok: false, fout: 'Er is niets om te verwijderen.' };
    markeerVerwijderen(rij);
    return { ok: true, tekst: 'Verwijderd uit ' + tabblad + '.' };
  }
  var r = beheerVelden(invoer.velden, kolommen);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  var hoofd = tabblad === 'Veelgestelde vragen' ? 'vraag' : 'titel';
  var nieuweWaarde = v.hasOwnProperty(hoofd) ? v[hoofd] : (rij ? rij[hoofd] : '');
  if (isLeeg(nieuweWaarde)) return { ok: false, fout: 'Vul een ' + hoofd + ' in.' };
  if (tabblad === 'Agenda' && isLeeg(v.hasOwnProperty('datum') ? v.datum : (rij ? rij.datum : ''))) {
    return { ok: false, fout: 'Een event heeft een datum nodig.' };
  }
  if (!v.publiek && !rij) v.publiek = 'ja';
  if (rij) {
    wijzig(rij, v);
  } else {
    var nieuw = {};
    kolommen.forEach(function (k) { nieuw[k] = v.hasOwnProperty(k) ? v[k] : ''; });
    if (tabblad === 'Nieuws' && !nieuw.datum) nieuw.datum = vandaagTekst();
    voegToe(rijen, nieuw);
  }
  return { ok: true, tekst: (rij ? 'Aangepast' : 'Toegevoegd') + ' in ' + tabblad + '.' };
}

/* ---------- Instellingen ---------- */

/** De rijen van een inhoudstabblad, zoals het beheerscherm ze toont. */
function inhoudRijen(tabblad, rijen) {
  var kolommen = BEHEER_INHOUD[tabblad];
  return rijen.map(function (rij) {
    var uit = { rij: rij._rij, vingerafdruk: vingerafdruk(rij, kolommen) };
    kolommen.forEach(function (k) { uit[k] = isLeeg(rij[k]) ? '' : rij[k]; });
    return uit;
  });
}

/**
 * Menu: maakt de nieuwe tabbladen aan. Bestaande tabbladen en gegevens blijven
 * staan: enkel ontbrekende tabbladen, kolommen en instellingen komen erbij.
 */
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
      if ((rij[0] === 'toegangscode_balie' || rij[0] === 'code_bestuur') && isLeeg(bestaand[rij[0]])) {
        zetInstelling(inst, rij[0], willekeurigeCode());
      }
      return;
    }
    var waarde = rij[1];
    if (rij[0] === 'toegangscode_balie' || rij[0] === 'code_bestuur') waarde = willekeurigeCode();
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

  // Tekstopmaak voor kolommen die tekst moeten blijven (ISBN, telefoon, lenersnummer).
  zetTekstopmaak(ss.getSheetByName('Catalogus'), ['isbn', 'boek_id']);
  zetTekstopmaak(ss.getSheetByName('Leners'), ['telefoon']);

  // Niet-publieke kolommen van de Catalogus grijs markeren.
  var cat = ss.getSheetByName('Catalogus');
  var catKop = cat.getRange(1, 1, 1, cat.getLastColumn()).getValues()[0].map(schoon);
  ['herkomst', 'isbn_origineel', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald', 'cover_bron', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'wiki_gezocht'].forEach(function (k) {
    var i = catKop.indexOf(k);
    if (i > -1) {
      cat.getRange(1, i + 1).setBackground('#d9d9d9').setNote('Niet publiek. Deze kolom verschijnt nooit op de website.');
    }
  });

  // Kolom status: een keuzelijst, met uitleg bij de kop.
  var si = catKop.indexOf('status');
  if (si > -1) {
    cat.getRange(2, si + 1, Math.max(1, cat.getMaxRows() - 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(BOEKSTATUSSEN, true).setAllowInvalid(true).build());
    cat.getRange(1, si + 1).setNote('Leeg = gewoon.\nverloren: niet op de website, niet uitleenbaar.\n' +
      'gevoelig verborgen: niet op de website, wel uitleenbaar.\ngevoelig zichtbaar: op de website met het label "Gevoelige inhoud".');
  }

  // Planning: elke nacht de privacy-opruiming, elke maandagnacht een back-up,
  // en de cache legen bij een wijziging.
  verwijderTriggers('ruimOp');
  verwijderTriggers('bijWijziging');
  verwijderTriggers('maakBackup');
  verwijderTriggers('verwerkNieuweBoekenAutomatisch');
  ScriptApp.newTrigger('verwerkNieuweBoekenAutomatisch').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('ruimOp').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('maakBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
  ScriptApp.newTrigger('bijWijziging').forSpreadsheet(ss).onEdit().create();

  ordenTabbladen(ss);
  logboek('menu', 'installeer', 'tabbladen klaar');
  meld('De tabbladen staan klaar. Kijk in Instellingen de codes en teksten na.');
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

/** Een tussenkop in het tabblad Instellingen: "── UITLENEN ──". */
function instellingKop(titel) {
  return '── ' + titel.toUpperCase() + ' ──';
}

/** Werd deze beschrijving vroeger afgebroken (eindigt ze op "...")? */
function isAfgebroken(tekst) {
  return /(\.\.\.|…)\s*$/.test(String(tekst || ''));
}

/** Controleert het controlecijfer van een ISBN-10 (10 tekens, laatste mag X zijn). */
function isbn10Geldig(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 10; i++) {
    var c = isbn.charAt(i);
    som += (c === 'X' ? 10 : Number(c)) * (10 - i);
  }
  return som % 11 === 0;
}

/** Zet een (geldig) ISBN-10 om naar ISBN-13: 978 ervoor en een nieuw controlecijfer. */
function isbn10Naar13(isbn10) {
  var basis = '978' + isbn10.slice(0, 9);
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(basis.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return basis + ((10 - (som % 10)) % 10);
}

/** Controleert het controlecijfer van een ISBN-13. */
function isbn13Geldig(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(isbn.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return (10 - (som % 10)) % 10 === Number(isbn.charAt(12));
}

/** ISBN-13 (978…) naar ISBN-10. Geeft '' als dat niet kan. */
function isbn13Naar10(isbn13) {
  var s = String(isbn13 || '');
  if (!/^978\d{10}$/.test(s)) return '';
  var kern = s.slice(3, 12), som = 0;
  for (var i = 0; i < 9; i++) som += (10 - i) * Number(kern.charAt(i));
  var c = (11 - (som % 11)) % 11;
  return kern + (c === 10 ? 'X' : String(c));
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

/** Is dit een Date-object (zoals de spreadsheet datums teruggeeft)? */
function isDatumObject(waarde) {
  return Object.prototype.toString.call(waarde) === '[object Date]' && !isNaN(waarde.getTime());
}

function isGoogleCover(url) {
  return /^https:\/\/(books\.google\.[a-z.]+|books\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)\//.test(String(url || ''));
}

/** Gaat een fout van Google over de daglimiet, of over iets anders (sleutel, API uit, ...)? */
function isGoogleLimiet(code, fout) {
  if (code === 429) return true;
  return code === 403 && /quota|rate ?limit|dailyLimit|userRateLimit|limitExceeded/i.test(String(fout || ''));
}

function isInstellingKop(sleutel) {
  return /^──/.test(String(sleutel || ''));
}

/** Geeft true als een waarde leeg is (niets, lege tekst of enkel spaties). */
function isLeeg(waarde) {
  return waarde === null || waarde === undefined || String(waarde).trim() === '';
}

/** Enkel covers van Open Library zelf, in het vaste formaat. */
function isOlCover(url) {
  return /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(String(url || ''));
}

/** Is de bib open op deze datum? Juiste weekdag en niet in gesloten_data. */
function isOpeningsdag(datum, inst) {
  return inst.openingsdagen.indexOf(weekdag(datum)) > -1 && inst.gesloten_data.indexOf(datum) === -1;
}

function isPubliek(rij) {
  return jaNee(rij.publiek) !== 'nee';
}

/** Een boekcover is staand. Een logo of pictogram is vierkant of liggend. */
function isStaandeCover(afm) {
  return !!afm && afm.breedte > 0 && afm.hoogte >= afm.breedte * 1.15;
}

/** Mag het boek uitgeleend worden? Niet bij uitleenbaar = nee of verloren. */
function isUitleenbaar(boek) {
  return jaNee(boek.uitleenbaar) !== 'nee' && boekStatus(boek) !== 'verloren';
}

/** Maakt ja/nee eenvormig. Geeft 'ja', 'nee' of '' terug. */
function jaNee(waarde) {
  if (waarde === true) return 'ja';
  if (waarde === false) return 'nee';
  var t = normaliseerTekst(waarde);
  if (['ja', 'j', 'yes', 'y', 'waar', 'true', 'x', '1'].indexOf(t) > -1) return 'ja';
  if (['nee', 'n', 'no', 'onwaar', 'false', '0'].indexOf(t) > -1) return 'nee';
  return '';
}

/** Een JSON-antwoord. */
function json(tekst) {
  return ContentService.createTextOutput(typeof tekst === 'string' ? tekst : JSON.stringify(tekst))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Afgeschermde eindpunten ---------- */

/**
 * Kiest uit de zoekresultaten van Open Library (search.json) het werk dat bij het boek past.
 * Enkel bij een goede overeenkomst van titel (tot de dubbele punt) en achternaam van de auteur.
 * Geeft het nummer van de cover terug, of 0.
 */
function kiesOlWerk(boek, docs) {
  var titel = titelSleutel(boek.titel);
  var naam = achternaam(boek.auteur);
  for (var i = 0; i < (docs || []).length; i++) {
    var d = docs[i];
    if (!d || !d.cover_i) continue;
    if (gelijkenis(titel, titelSleutel(d.title)) < 0.85) continue;
    if (naam) {
      var namen = (d.author_name || []).map(achternaam);
      if (namen.indexOf(naam) === -1) continue;
    }
    return d.cover_i;
  }
  return 0;
}

/** Kiest uit de zoekresultaten de titels van artikels die goed overeenkomen met de titel van het boek. */
function kiesWikiTitels(boek, titels) {
  var gezocht = titelSleutel(boek.titel);
  return (titels || []).filter(function (t) {
    return gelijkenis(gezocht, titelSleutel(wikiTitelZonderUitleg(t))) >= 0.85;
  });
}

/**
 * Koppelt de Catalogus aan de Goodreads-export (zonder de spreadsheet aan te raken).
 * catalogus: rijen van de Catalogus
 * goodreads: rijen uit leesGoodreadsRijen
 * Geeft terug:
 *   aanvullingen: [{ boek, veld, waarde }]   -> mag meteen ingevuld worden
 *   naTeKijken:   [{ boek, veld, waarde_catalogus, waarde_bron, opmerking }]
 */
function koppelGoodreads(catalogus, goodreads) {
  var opIsbn = {}, opTitelAuteur = {}, opTitel = {};
  goodreads.forEach(function (g) {
    [goodreadsIsbn(g.ISBN13), goodreadsIsbn(g.ISBN)].forEach(function (i) { if (i) opIsbn[i] = g; });
    var auteur = g['Author l-f'] || g.Author;
    var t = titelSleutel(g.Title);
    opTitelAuteur[t + '|' + achternaam(auteur)] = g;
    (opTitel[t] = opTitel[t] || []).push(g);
  });

  var aanvullingen = [], naTeKijken = [];
  catalogus.forEach(function (boek) {
    if (isLeeg(boek.boek_id)) return;
    var t = titelSleutel(boek.titel);
    var g = boek.isbn ? opIsbn[boek.isbn] : null;
    if (!g) g = opTitelAuteur[t + '|' + achternaam(boek.auteur)];
    if (!g && opTitel[t] && opTitel[t].length === 1) {
      // Twijfel: enkel de titel komt overeen. Niets invullen, wel voorleggen.
      var kandidaat = opTitel[t][0];
      naTeKijken.push({
        boek: boek, veld: 'koppeling', waarde_catalogus: boek.auteur,
        waarde_bron: kandidaat.Title + ' / ' + (kandidaat.Author || ''),
        opmerking: 'Enkel de titel komt overeen, de auteur verschilt. Is dit hetzelfde boek? Vul dan zelf aan.'
      });
      return;
    }
    if (!g) return;

    Object.keys(GOODREADS_VELDEN).forEach(function (veld) {
      var waarde = goodreadsWaarde(g, GOODREADS_VELDEN[veld]);
      if (isLeeg(waarde)) return;
      if (veld !== 'uitgeverij') waarde = parseerGetal(waarde) || '';
      if (isLeeg(waarde)) return;
      if (isLeeg(boek[veld])) {
        aanvullingen.push({ boek: boek, veld: veld, waarde: veld === 'uitgeverij' ? schoon(waarde) : waarde });
      }
    });
    // Een ISBN vullen we nooit zelf in: het kan van een andere uitgave zijn.
    var grIsbn = goodreadsIsbn(g.ISBN13) || goodreadsIsbn(g.ISBN);
    if (!boek.isbn && grIsbn) {
      naTeKijken.push({
        boek: boek, veld: 'isbn', waarde_catalogus: '', waarde_bron: grIsbn,
        opmerking: 'ISBN uit Goodreads. Klopt het met jouw uitgave? Zet het dan in de Catalogus, zodat Open Library de cover kan vinden.'
      });
    }
  });
  return { aanvullingen: aanvullingen, naTeKijken: naTeKijken };
}

/**
 * Kort een tekst af tot hoogstens max tekens, na de laatste volledige zin.
 * Een zin eindigt op . ! ? of een regeleinde. Is er geen zinseinde, dan stopt
 * de tekst na het laatste volledige woord, met "...".
 */
function kortAfOpZin(tekst, max) {
  var t = String(tekst || '');
  if (t.length <= max) return t;
  var stuk = t.slice(0, max);
  var einde = -1;
  var re = /[.!?»"”')]\s|\n/g, m;
  while ((m = re.exec(stuk))) einde = m.index + 1;
  if (einde > max / 3) return stuk.slice(0, einde).trim();
  return stuk.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
}

/** Korte datum: "20/11/2026". */
function korteDatum(datum) {
  if (!datum) return '';
  var d = datum.split('-');
  return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
}

/**
 * Leest alle gegevens die de uitleenlogica nodig heeft.
 * wie: voornaam van de vrijwilliger (voor het logboek en de uitzonderingen).
 */
function laadStaat(wie, metUitzonderingen) {
  var tabellen = {
    Catalogus: leesTabel('Catalogus'),
    Leners: leesTabel('Leners'),
    Uitleningen: leesTabel('Uitleningen'),
    Reservaties: leesTabel('Reservaties')
  };
  if (metUitzonderingen) tabellen.Uitzonderingen = leesTabel('Uitzonderingen');
  // Getallen uit de spreadsheet (lenersnummer 12.0) gelijk maken aan tekst ("12").
  tabellen.Leners.rijen.forEach(function (l) { l.lenersnummer = String(l.lenersnummer); });
  tabellen.Uitleningen.rijen.forEach(function (u) { if (!isLeeg(u.lenersnummer)) u.lenersnummer = String(u.lenersnummer); });
  tabellen.Reservaties.rijen.forEach(function (r) { if (!isLeeg(r.lenersnummer)) r.lenersnummer = String(r.lenersnummer); });
  return {
    tabellen: tabellen,
    inst: leesInstellingen(),
    vandaag: vandaagTekst(),
    wie: tekstInvoer(wie, 40) || 'onbekend',
    catalogus: tabellen.Catalogus.rijen,
    leners: tabellen.Leners.rijen,
    uitleningen: tabellen.Uitleningen.rijen,
    reservaties: tabellen.Reservaties.rijen,
    uitzonderingenTabel: tabellen.Uitzonderingen ? tabellen.Uitzonderingen.rijen : [],
    uitzonderingen: [],
    log: [],
    nieuwNummer: function (soort, bestaande) { return volgendNummer(soort, bestaande); }
  };
}

/** Maakt de cache van de publieke catalogus leeg, zodat de volgende opvraging vers is. */
function leegCache() {
  try { CacheService.getScriptCache().removeAll([CACHE_SLEUTEL + '_n', SITE_CACHE_SLEUTEL]); } catch (e) { /* niets aan de hand */ }
}

/** Leest de borg uit tekst als "5 cash", "€5 QR" of "QR". */
function leesBorg(waarde, inst) {
  var bedrag = parseerGetal(waarde);
  var t = normaliseerTekst(waarde);
  var wijze = '';
  inst.borg_betaalwijzen.forEach(function (w) { if (t.indexOf(normaliseerTekst(w)) > -1) wijze = w; });
  if (bedrag === null && wijze) bedrag = inst.borg_per_boek;
  return { bedrag: bedrag || 0, betaalwijze: wijze };
}

/**
 * Zet de ruwe waarden van een tabblad (Stock of Zines) om naar boek-objecten.
 * waarden: tweedimensionale lijst zoals getValues() ze teruggeeft.
 * soort: 'boek' of 'zine'.
 * Lege rijen en herhaalde kopregels slaan we over.
 */
function leesBronRijen(waarden, soort) {
  // Zoek de kopregel: de eerste rij met een cel "Titel".
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var kolom = {};
  var laatsteBenoemde = -1;
  kop.forEach(function (k, i) {
    var veld = BRONKOLOMMEN[k];
    if (veld && kolom[veld] === undefined) { kolom[veld] = i; laatsteBenoemde = Math.max(laatsteBenoemde, i); }
  });
  // De herkomst staat in de eerste kolom zonder kop, rechts van de benoemde kolommen.
  var herkomstKolom = -1;
  for (var c = laatsteBenoemde + 1; c < kop.length + 5; c++) {
    if (kop[c]) continue;
    var heeftData = waarden.slice(kopIndex + 1).some(function (rij) { return !isLeeg(rij[c]); });
    if (heeftData) { herkomstKolom = c; break; }
  }

  var boeken = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var titel = schoon(rij[kolom.titel]);
    if (!titel || normaliseerTekst(titel) === 'titel') continue; // lege rij of herhaalde kop
    var lees = function (veld) { return kolom[veld] === undefined ? '' : rij[kolom[veld]]; };
    var isbnRuw = lees('isbn');
    var isbn = normaliseerIsbn(isbnRuw);
    var aantal = parseerGetal(lees('aantal'));
    var jaar = parseerGetal(lees('jaartal'));
    var paginas = parseerGetal(lees('paginas'));
    boeken.push({
      soort: soort,
      titel: titel,
      auteur: schoon(lees('auteur')),
      isbn: isbn.isbn || isbn.issn,
      isbn_origineel: isbn.geldig || isbn.leeg ? '' : schoon(isbnRuw),
      uitgeverij: schoon(lees('uitgeverij')),
      jaartal: jaar ? Math.round(jaar) : '',
      taal: normaliseerTaal(lees('taal')),
      paginas: paginas ? Math.round(paginas) : '',
      uitvoering: normaliseerUitvoering(lees('uitvoering')),
      nieuwstaat: jaNee(lees('nieuwstaat')),
      aanrader: schoon(lees('aanrader')),
      genre: schoon(lees('genre')),
      aantal: aantal && aantal > 0 ? Math.round(aantal) : 1,
      herkomst: herkomstKolom > -1 ? schoon(rij[herkomstKolom]) : ''
    });
  }
  return boeken;
}

/**
 * Zet de ruwe waarden van het tabblad Goodreads-export om naar objecten.
 * shelf: (optioneel) enkel boeken op deze shelf. De export bevat je volledige
 * bibliotheek; de kolommen "Bookshelves" en "Exclusive Shelf" zeggen op welke
 * shelves een boek staat.
 */
function leesGoodreadsRijen(waarden, shelf) {
  if (!waarden.length) return [];
  var kop = waarden[0].map(schoon);
  var gezocht = normaliseerTekst(shelf);
  return waarden.slice(1).map(function (rij) {
    var obj = {};
    kop.forEach(function (k, i) { if (k) obj[k] = rij[i]; });
    return obj;
  }).filter(function (o) {
    if (isLeeg(o.Title)) return false;
    if (!gezocht) return true;
    var shelves = splitsLijst(o.Bookshelves).concat([schoon(o['Exclusive Shelf'])]);
    return shelves.some(function (s) { return normaliseerTekst(s) === gezocht; });
  });
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

/** Zet de waarden van het oude blad om naar objecten met vaste namen. */
function leesOudeUitleningen(waarden) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(10, waarden.length); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'boek'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(normaliseerTekst);
  var k = {
    boek: oudeKolom(kop, 'boek'), auteur: oudeKolom(kop, 'auteur'), voornaam: oudeKolom(kop, 'voornaam'),
    achternaam: oudeKolom(kop, 'achternaam'), telefoon: oudeKolom(kop, 'telefoon'), email: oudeKolom(kop, 'e mail') > -1 ? oudeKolom(kop, 'e mail') : oudeKolom(kop, 'email'),
    datum_uit: oudeKolom(kop, 'datum ontlening'), datum_terug_afgesproken: oudeKolom(kop, 'datum terug'),
    borg: oudeKolom(kop, 'borg'), gift: oudeKolom(kop, 'gift'), herinnering: oudeKolom(kop, 'reminder'),
    terug_op: oudeKolom(kop, 'boek terug op')
  };
  var rijen = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (naam) { return k[naam] > -1 ? rij[k[naam]] : ''; };
    if (isLeeg(lees('boek'))) continue;
    rijen.push({
      rijnummer: i + 1,
      boek: schoon(lees('boek')), auteur: schoon(lees('auteur')),
      voornaam: schoon(lees('voornaam')), achternaam: schoon(lees('achternaam')),
      telefoon: schoon(lees('telefoon')), email: schoon(lees('email')).toLowerCase(),
      datum_uit: parseerDatum(lees('datum_uit')), datum_terug_afgesproken: parseerDatum(lees('datum_terug_afgesproken')),
      borg: lees('borg'), gift: lees('gift'), herinnering: lees('herinnering'),
      terug_op: lees('terug_op')
    });
  }
  return rijen;
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

/**
 * Bestuur: gegevens van een lener aanpassen of op inactief zetten.
 * invoer: { lenersnummer, voornaam, achternaam, telefoon, email, actief }
 */
function lenerAanpassen(staat, invoer) {
  var l = lenerVan(staat, invoer.lenersnummer);
  if (!l) return { ok: false, fout: 'Deze lener bestaat niet.' };
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var telefoon = tekstInvoer(invoer.telefoon, 25);
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  wijzig(l, {
    voornaam: voornaam, achternaam: tekstInvoer(invoer.achternaam, 80), telefoon: telefoon, email: email,
    actief: invoer.actief === false ? 'nee' : 'ja'
  });
  staat.log.push(['lener aangepast', 'lener ' + l.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + l.lenersnummer + ' is bijgewerkt.' };
}

/* ---------- Informatie voor de schermen ---------- */

/** "12 (Sam)": wat een vrijwilliger van een lener mag zien. */
function lenerNaam(staat, lenersnummer) {
  var l = lenerVan(staat, lenersnummer);
  return lenersnummer + (l && l.voornaam ? ' (' + l.voornaam + ')' : '');
}

function lenerVan(staat, lenersnummer) {
  var n = String(parseerGetal(lenersnummer));
  for (var i = 0; i < staat.leners.length; i++) {
    if (String(staat.leners[i].lenersnummer) === n) return staat.leners[i];
  }
  return null;
}

/** Levenshtein-afstand: het aantal tikfouten tussen twee woorden. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var vorige = [];
  for (var j = 0; j <= b.length; j++) vorige[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var huidige = [i];
    for (var k = 1; k <= b.length; k++) {
      var kost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + kost);
    }
    vorige = huidige;
  }
  return vorige[b.length];
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

function lopendeUitleningen(staat) {
  return staat.uitleningen.filter(function (u) { return u.exemplaar && isLeeg(u.datum_terug); });
}

function lopendeUitleningenVan(staat, lenersnummer) {
  return lopendeUitleningen(staat).filter(function (u) { return String(u.lenersnummer) === String(lenersnummer); });
}

/**
 * Maakt een aanvraag, zonder de spreadsheet aan te raken.
 * omgeving: { inst, vandaag, catalogus, aanvragen }
 * nieuwId: functie die een nieuw aanvraagnummer geeft.
 * Geeft { ok, tekst } of { ok: false, fout }. stil: true als een robot het verborgen veld invulde.
 */
function maakAanvraag(omgeving, invoer, nieuwId) {
  if (!omgeving.inst.online_reserveren) return { ok: false, fout: 'Online reserveren kan nog niet. Kom langs in de bib.' };
  // Een robot vult elk veld in, ook het verborgen. We doen alsof het lukte.
  if (!isLeeg(invoer.website)) return { ok: true, stil: true, tekst: 'Je aanvraag is verstuurd.' };
  var boek = omgeving.catalogus.filter(function (b) { return String(b.boek_id) === String(invoer.boek_id); })[0];
  if (!boek || !opWebsite(boek)) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isUitleenbaar(boek)) return { ok: false, fout: 'Dit boek is niet uitleenbaar.' };
  var voornaam = tekstInvoer(invoer.voornaam, 40);
  if (!voornaam) return { ok: false, fout: 'Vul je voornaam in.' };
  var contact = tekstInvoer(invoer.contact, 80);
  if (!geldigEmail(contact) && !geldigeTelefoon(contact)) return { ok: false, fout: 'Vul een geldig telefoonnummer of e-mailadres in.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Geef toestemming om je gegevens te bewaren, anders kunnen we je niet contacteren.' };
  var zelfde = normaliseerTekst(contact);
  var open = omgeving.aanvragen.filter(function (a) { return a.status === AANVRAAG_NIEUW && normaliseerTekst(a.contact) === zelfde; });
  if (open.length >= AANVRAAG_MAX_PER_CONTACT) return { ok: false, fout: 'Je hebt al ' + open.length + ' aanvragen lopen. Wacht tot het bestuur je contacteert.' };
  if (open.some(function (a) { return String(a.boek_id) === String(boek.boek_id); })) return { ok: false, fout: 'Je vroeg dit boek al aan. Het bestuur neemt contact met je op.' };
  voegToe(omgeving.aanvragen, {
    aanvraag_id: nieuwId(), datum: omgeving.vandaag, boek_id: String(boek.boek_id), titel: schoon(boek.titel),
    voornaam: voornaam, contact: contact, opmerking: tekstInvoer(invoer.opmerking, 300), status: AANVRAAG_NIEUW
  });
  return { ok: true, tekst: 'Je aanvraag is verstuurd. Het bestuur neemt contact met je op om af te spreken wanneer je het boek kan ophalen.' };
}

/**
 * Maakt afgebroken beschrijvingen leeg, zodat het script ze opnieuw volledig zoekt
 * en vertaalt. Enkel beschrijvingen die het script zelf vond (met een datum in
 * beschrijving_gezocht, ol_gecontroleerd of gb_gecontroleerd). Geeft het aantal terug.
 */
function maakAfgebrokenLeeg(rijen) {
  var n = 0;
  rijen.forEach(function (rij) {
    var doorScript = !isLeeg(rij.beschrijving_gezocht) || !isLeeg(rij.ol_gecontroleerd) || !isLeeg(rij.gb_gecontroleerd);
    if (!doorScript || !/^\d{13}$/.test(String(rij.isbn || ''))) return;
    if (!isAfgebroken(rij.beschrijving) && !isAfgebroken(rij.beschrijving_en)) return;
    wijzig(rij, { beschrijving: '', beschrijving_en: '', beschrijving_gezocht: '', beschrijving_vertaald: '' });
    n++;
  });
  return n;
}

/** Maakt een back-up en ruimt de oudste op. Draait elke week vanzelf (zie Installeer tabbladen). */
function maakBackup() {
  var inst = leesInstellingen();
  var ss = spreadsheet();
  var map = backupMap(inst.backup_map || 'Project Madrigal back-ups');
  var kopie = DriveApp.getFileById(ss.getId()).makeCopy(backupNaam(vandaagTekst()), map);
  var bestanden = [];
  var lijst = map.getFiles();
  while (lijst.hasNext()) {
    var f = lijst.next();
    bestanden.push({ id: f.getId(), naam: f.getName(), datum: f.getDateCreated().getTime() });
  }
  var weg = teVerwijderenBackups(bestanden, inst.backup_bewaren);
  weg.forEach(function (id) { DriveApp.getFileById(id).setTrashed(true); });
  logboek('systeem', 'back-up', kopie.getName() + (weg.length ? ', ' + weg.length + ' oude naar de prullenbak' : ''));
  return { naam: kopie.getName(), map: map.getName(), url: kopie.getUrl(), opgeruimd: weg.length };
}

/** Menu: nu meteen een back-up maken. */
function maakBackupMenu() {
  var r = maakBackup();
  meld('Back-up gemaakt: "' + r.naam + '" in de map "' + r.map + '" op je Google Drive.' + (r.opgeruimd ? ' ' + r.opgeruimd + ' oude back-up(s) gingen naar de prullenbak.' : ''));
}

/**
 * Maakt een beschrijving uit een externe bron netjes: geen HTML, geen
 * bronvermeldingen van Open Library, en hoogstens BS_MAX_LENGTE tekens.
 * Alinea's blijven behouden.
 */
function maakBeschrijvingNetjes(tekst) {
  var t = String(tekst || '');
  // Open Library zet onder een streep vaak bronnen en links: die laten we weg.
  t = t.split(/\n\s*-{3,}/)[0];
  t = t
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')       // [tekst](link) wordt tekst
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')         // [tekst][1] wordt tekst
    .replace(/^\s*\[\d+\]:.*$/gm, '')              // [1]: https://... weg
    .replace(/\(\s*\[?source\]?[^)]*\)/gi, '')     // (source) weg
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return kortAfOpZin(t, BS_MAX_LENGTE);
}

/** Menu: bouwt de Catalogus op uit Stock en Zines. */
function maakCatalogus() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = spreadsheet();
    var inst = leesInstellingen();
    var bron = [];
    [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
      var blad = ss.getSheetByName(paar[0]);
      if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
    });
    if (!bron.length) throw new Error('Geen boeken gevonden in de tabbladen Stock en Zines.');
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    var teller = voegBronSamen(tabel.rijen, bron, ids.nieuw, inst, vandaagTekst());
    schrijfVolledig(tabel);
    ids.bewaar();
    var onderwerpen = werkOnderwerpenBij();
    leegCache();
    logboek('menu', 'maakCatalogus', teller.nieuw + ' nieuw, ' + teller.aangevuld + ' aangevuld');
    meld('Catalogus klaar: ' + teller.nieuw + ' nieuwe boeken, ' + teller.aangevuld + ' aangevuld. ' +
      onderwerpen + ' nieuwe genres in Onderwerpen. Kijk de boeken met een ongeldig ISBN na (kolom isbn_origineel).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Maakt een generator voor nieuwe boek-ID's: B0001 voor boeken, Z0001 voor zines.
 * De teller staat in de scripteigenschappen, zodat een ID nooit twee keer gebruikt wordt,
 * ook niet als je een boek wist. Roep bewaar() op als je klaar bent.
 */
function maakIdGenerator(catalogusRijen) {
  var props = PropertiesService.getScriptProperties();
  var tellers = {};
  ['B', 'Z'].forEach(function (prefix) {
    var laatste = Number(props.getProperty('teller_boek_' + prefix) || 0);
    catalogusRijen.forEach(function (r) {
      var id = String(r.boek_id || '');
      if (id.charAt(0) === prefix) laatste = Math.max(laatste, Number(id.slice(1)) || 0);
    });
    tellers[prefix] = laatste;
  });
  return {
    nieuw: function (soort) {
      var prefix = soort === 'zine' ? 'Z' : 'B';
      tellers[prefix] += 1;
      return prefix + metNullen(tellers[prefix], 4);
    },
    bewaar: function () {
      props.setProperty('teller_boek_B', String(tellers.B));
      props.setProperty('teller_boek_Z', String(tellers.Z));
    }
  };
}

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
 * Bepaalt de Nederlandse en de Engelse beschrijving.
 * vertaal(tekst, doeltaal) geeft de vertaling (in Apps Script: LanguageApp).
 *   - Is de tekst al Nederlands (de vertaling naar het Nederlands verandert niets),
 *     dan blijft beschrijving precies zoals ze was.
 *   - Een Engelse versie die je zelf invulde in beschrijving_en, blijft staan.
 */
function maakTweetaligeBeschrijving(boek, vertaal) {
  var origineel = schoonMetRegels(boek.beschrijving);
  var v = {};
  var nl = schoonMetRegels(vertaal(origineel, 'nl'));
  if (nl && !zelfdeTekst(nl, origineel)) v.beschrijving = nl;
  if (isLeeg(boek.beschrijving_en)) {
    var en = schoonMetRegels(vertaal(origineel, 'en'));
    if (en) v.beschrijving_en = en;
  }
  return v;
}

/** "2026-11" naar "november 2026". */
function maandTekst(jjjjmm) {
  var d = jjjjmm.split('-');
  return MAANDEN[Number(d[1]) - 1] + ' ' + d[0];
}

/** Markeert een rij om te verwijderen (enkel gebruikt bij de privacy-opruiming). */
function markeerVerwijderen(rij) {
  rij._verwijderen = true;
}

/** Toont een melding in de spreadsheet (of in het logboek als er geen scherm is). */
function meld(tekst) {
  try {
    SpreadsheetApp.getUi().alert(tekst);
  } catch (e) {
    try { spreadsheet().toast(tekst, 'Madrigal', 10); } catch (e2) { Logger.log(tekst); }
  }
}

/** Vult een nummer aan met nullen: 7 wordt "0007". */
function metNullen(n, breedte) {
  var s = String(n);
  while (s.length < breedte) s = '0' + s;
  return s;
}

/** "2026-11-20" naar een Date in UTC (enkel om mee te rekenen). */
function naarUtc(datum) {
  var d = datum.split('-');
  return new Date(Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])));
}

/** Menu: vraagt de link naar het oude blad en neemt de lopende uitleningen over. */
function neemUitleningenOver() {
  var ui = SpreadsheetApp.getUi();
  var vraag = ui.prompt('Lopende uitleningen overnemen',
    'Plak de link naar het oude digitale uitleenblad (de Google-spreadsheet). Enkel boeken die nog niet terug zijn, komen mee.',
    ui.ButtonSet.OK_CANCEL);
  if (vraag.getSelectedButton() !== ui.Button.OK) return;
  var link = schoon(vraag.getResponseText());
  var oud;
  try {
    oud = SpreadsheetApp.openByUrl(link);
  } catch (e) {
    meld('Ik kan dat blad niet openen. Kijk of de link klopt en of jouw account het blad mag openen.');
    return;
  }
  // Het eerste tabblad met een kolom "Boek".
  var rijen = [];
  oud.getSheets().some(function (blad) {
    rijen = leesOudeUitleningen(blad.getDataRange().getValues());
    return rijen.length > 0;
  });
  if (!rijen.length) {
    meld('Ik vond geen tabblad met een kolom "Boek" in het oude blad.');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('overzetten', false);
    var resultaat = verwerkOudeUitleningen(staat, rijen);
    var naTeKijken = leesTabel('Na te kijken');
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken.map(function (x) {
      x.waarde_bron = x.waarde_bron + ' [' + x.sleutel_extra + ']';
      return x;
    }), 'Overzetten', staat.vandaag);
    bewaarStaat(staat);
    bewaarTabel(naTeKijken);
    leegCache();
    logboek('menu', 'neemUitleningenOver', resultaat.uitleningen + ' uitleningen, ' + resultaat.leners + ' leners, ' + nieuw + ' na te kijken');
    meld(resultaat.uitleningen + ' lopende uitleningen overgenomen, ' + resultaat.leners + ' nieuwe leners aangemaakt. ' +
      nieuw + ' twijfelgevallen staan in "Na te kijken". Vraag nieuwe leners bij hun volgende bezoek om toestemming voor de privacyverklaring (kolom toestemming_privacy staat op "onbekend").');
  } finally {
    lock.releaseLock();
  }
}

/** Staat er in de herkomst een interne notitie dat het boek niet publiek mag? */
function nietPubliekVolgensHerkomst(herkomst) {
  return /niet\s+(op\s+(de\s+)?)?(site|website|online)|niet\s+publiek/i.test(herkomst || '');
}

/**
 * Voegt de boeken uit Stock en Zines samen met de bestaande Catalogus.
 * bestaand: rijen van de Catalogus (worden aangevuld, nooit overschreven).
 * bron: boek-objecten uit leesBronRijen.
 * nieuwId: functie(soort) die een nieuwe, unieke boek-ID geeft.
 * Geeft { nieuw, aangevuld } terug (aantallen).
 */

/** De foutmelding aan de balie voor een boek dat niet uitleenbaar is. */
function nietUitleenbaarFout(boek) {
  return boekStatus(boek) === 'verloren' ? 'Dit boek staat als verloren. Zet de status in de Catalogus leeg als het terug is.' : 'Dit boek is niet uitleenbaar.';
}

/**
 * Nieuwe lener inschrijven.
 * invoer: { voornaam, achternaam, telefoon, email, toestemming }
 */
function nieuweLener(staat, invoer) {
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var achternaamWaarde = tekstInvoer(invoer.achternaam, 80);
  var telefoon = tekstInvoer(invoer.telefoon, 25);
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Zonder toestemming voor de privacyverklaring kunnen we geen gegevens bewaren.' };
  var dubbel = staat.leners.filter(function (l) {
    return (email && String(l.email).toLowerCase() === email) || (telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(telefoon));
  })[0];
  if (dubbel) return { ok: false, fout: 'Deze persoon is al ingeschreven als lener ' + lenerNaam(staat, dubbel.lenersnummer) + '.' };
  var nummer = nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }));
  voegToe(staat.leners, {
    lenersnummer: nummer, voornaam: voornaam, achternaam: achternaamWaarde, telefoon: telefoon, email: email,
    datum_inschrijving: staat.vandaag, toestemming_privacy: 'ja', actief: 'ja'
  });
  staat.log.push(['nieuwe lener', 'lener ' + nummer]);
  return { ok: true, lenersnummer: nummer, voornaam: voornaam, tekst: 'Lenersnummer ' + nummer };
}

/**
 * Nieuw volgnummer. In de spreadsheet levert Api.js een teller die nooit terugtelt.
 * Zonder teller (in de tests) nemen we het hoogste bestaande nummer plus 1.
 */
function nieuwNummer(staat, soort, bestaande) {
  if (staat.nieuwNummer) return staat.nieuwNummer(soort, bestaande);
  var max = 0;
  bestaande.forEach(function (w) { max = Math.max(max, Number(String(w).replace(/\D/g, '')) || 0); });
  return max + 1;
}

/* ---------- Controle van invoer ---------- */

/**
 * Normaliseert een ISBN of ISSN zoals het in de stocklijst staat.
 * Geeft een object terug:
 *   isbn:    het ISBN-13 als het geldig is, anders ''
 *   issn:    het ISSN (formaat 1234-5678) als het een ISSN is, anders ''
 *   geldig:  true als het nummer klopt
 *   leeg:    true als er niets ingevuld was
 */
function normaliseerIsbn(waarde) {
  var ruw = schoon(waarde).toUpperCase();
  if (!ruw) return { isbn: '', issn: '', geldig: false, leeg: true };
  // Een getal uit de spreadsheet kan als 9.78E+12 binnenkomen: zet het eerst om.
  if (typeof waarde === 'number') ruw = String(Math.round(waarde));
  var tekens = ruw.replace(/^ISBN|^ISSN/, '').replace(/[^0-9X]/g, '');
  if (tekens.length === 10 && isbn10Geldig(tekens)) return { isbn: isbn10Naar13(tekens), issn: '', geldig: true, leeg: false };
  if (tekens.length === 13 && isbn13Geldig(tekens)) return { isbn: tekens, issn: '', geldig: true, leeg: false };
  if (tekens.length === 8) return { isbn: '', issn: tekens.slice(0, 4) + '-' + tekens.slice(4), geldig: true, leeg: false };
  return { isbn: '', issn: '', geldig: false, leeg: false };
}

/* ---------- Getallen en datums ---------- */

/** Maakt de taal eenvormig: "engels", "EN" en "English" worden "Engels". */
function normaliseerTaal(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  var tabel = {
    'nederlands': 'Nederlands', 'nl': 'Nederlands', 'dutch': 'Nederlands', 'vlaams': 'Nederlands', 'ned': 'Nederlands',
    'engels': 'Engels', 'en': 'Engels', 'english': 'Engels', 'eng': 'Engels',
    'frans': 'Frans', 'fr': 'Frans', 'french': 'Frans', 'francais': 'Frans', 'fre': 'Frans',
    'duits': 'Duits', 'de': 'Duits', 'german': 'Duits', 'deutsch': 'Duits', 'ger': 'Duits',
    'spaans': 'Spaans', 'es': 'Spaans', 'spanish': 'Spaans', 'spa': 'Spaans'
  };
  if (tabel[t]) return tabel[t];
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Kleine letters, zonder accenten en leestekens. "Émile Zola!" wordt "emile zola". */
function normaliseerTekst(waarde) {
  return schoon(waarde)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Maakt de uitvoering eenvormig (Hardcover, Paperback, Pocket). */
function normaliseerUitvoering(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  if (t.indexOf('hard') > -1 || t === 'gebonden') return 'Hardcover';
  if (t.indexOf('pocket') > -1 || t.indexOf('mass market') > -1) return 'Pocket';
  if (t.indexOf('paper') > -1 || t.indexOf('soft') > -1 || t === 'ingenaaid') return 'Paperback';
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- ISBN ---------- */

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

/** Het adres van een cover bij Open Library, uit het nummer van die cover. */
function olCoverUrl(coverId) {
  return 'https://covers.openlibrary.org/b/id/' + coverId + '-M.jpg';
}

/** Een beschrijving uit Open Library: tekst, of een object met value. */
function olTekst(description) {
  if (!description) return '';
  return typeof description === 'string' ? description : String(description.value || '');
}

/** Zoekt bij Open Library. Geeft { docs } of { limiet: true }. */
function olZoek(parameters) {
  var r = haalJson('https://openlibrary.org/search.json?' + parameters + '&fields=key,title,author_name,cover_i&limit=5');
  if (r.code === 429 || r.code >= 500) return { limiet: true, code: r.code };
  return { docs: (r.data && r.data.docs) || [] };
}

/** Zet het menu klaar telkens de spreadsheet opent. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Madrigal')
    .addItem('1. Installeer tabbladen', 'installeer')
    .addItem('2. Bouw de catalogus uit Stock en Zines', 'maakCatalogus')
    .addItem('3. Vul aan uit Goodreads', 'vulAanUitGoodreads')
    .addItem('4. Vul aan uit Open Library', 'vulAanUitOpenLibrary')
    .addItem('5. Zoek ontbrekende covers bij Google Books', 'vulAanUitGoogleBooks')
    .addItem('Test Google Books (kies eerst een cel met een ISBN)', 'testGoogleBooks')
    .addItem('Zoek opnieuw bij Google (boeken zonder cover of beschrijving)', 'zoekCoversOpnieuw')
    .addItem('6. Zoek ontbrekende beschrijvingen', 'vulBeschrijvingenAan')
    .addItem('7. Vertaal de beschrijvingen (Nederlands en Engels)', 'vertaalBeschrijvingen')
    .addItem('8. Zoek covers van andere uitgaven (Open Library)', 'zoekCoversAndereUitgaven')
    .addItem('9. Zoek covers bij bol.com', 'zoekCoversBol')
    .addItem('10. Zoek covers bij Internet Archive', 'zoekCoversInternetArchive')
    .addItem('11. Zoek beschrijvingen bij Wikipedia', 'zoekBeschrijvingenWikipedia')
    .addItem('Test bol.com (kies eerst een cel met een ISBN)', 'testBol')
    .addItem('Zoek afgebroken beschrijvingen opnieuw (volledig)', 'herstelAfgebrokenBeschrijvingen')
    .addSeparator()
    .addItem('Nieuwe boeken verwerken', 'verwerkNieuweBoeken')
    .addItem('Werk de vertaaltabel Onderwerpen bij', 'werkOnderwerpenBijMenu')
    .addItem('Wis de aanraders die uit de stocklijst kwamen', 'wisAanradersUitStock')
    .addItem('Ververs de publieke catalogus', 'verversMenu')
    .addSeparator()
    .addItem('Neem lopende uitleningen over uit het oude blad', 'neemUitleningenOver')
    .addItem('Neem nieuws, agenda en vragen over van de oude website', 'importeerOudeSite')
    .addItem('Privacy-opruiming nu uitvoeren', 'ruimOp')
    .addItem('Maak nu een back-up', 'maakBackupMenu')
    .addItem('Orden tabbladen en instellingen', 'ordenAlles')
    .addSeparator()
    .addItem('Catalogus wissen en opnieuw opbouwen (enkel bij de start)', 'herbouwCatalogus')
    .addToUi();
}

/** De open aanvragen voor het bestuursscherm, oudste eerst. */
function openAanvragen(rijen) {
  return (rijen || []).filter(function (a) { return a.status === AANVRAAG_NIEUW; }).map(function (a) {
    return {
      aanvraag_id: String(a.aanvraag_id), datum: a.datum, boek_id: String(a.boek_id), titel: schoon(a.titel),
      voornaam: schoon(a.voornaam), contact: schoon(a.contact), opmerking: schoon(a.opmerking)
    };
  }).sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
}

/** Opmaak van de kopregel: vet, vastgezet. */
function opmaakKop(blad, kolommen) {
  if (kolommen < 1) return;
  blad.getRange(1, 1, 1, kolommen).setFontWeight('bold');
  blad.setFrozenRows(1);
}

/** Mag het boek op de website? Niet bij publiek = nee, verloren of gevoelig verborgen. */
function opWebsite(boek) {
  var s = boekStatus(boek);
  return jaNee(boek.publiek) !== 'nee' && s !== 'verloren' && s !== 'gevoelig_verborgen';
}

/** Menu: orden de tabbladen en de instellingen. */
function ordenAlles() {
  var ss = spreadsheet();
  ordenInstellingen(ss);
  ordenTabbladen(ss);
  leegCache();
  meld('De tabbladen en de instellingen staan nu geordend.');
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

/** Een afbeelding: een volledige link, of een pad in de opslag van de oude databank. */
function oudeAfbeelding(waarde, basis) {
  var w = schoon(waarde);
  if (!w) return '';
  if (/^https:\/\//.test(w)) return w;
  if (/^http:\/\//.test(w)) return w.replace(/^http:/, 'https:');
  return basis ? basis + '/storage/v1/object/public/' + w.replace(/^\//, '') : w;
}

/** Datum uit een ISO-tijdstip, in de tijdzone van Brussel ("2026-11-20"). */
function oudeDatum(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return parseerDatum(iso);
  return typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'yyyy-MM-dd') : d.toISOString().slice(0, 10);
}

/** Zoekt een kolom in de kop van het oude blad, op het begin van de naam. */
function oudeKolom(kop, begin) {
  for (var i = 0; i < kop.length; i++) if (kop[i].indexOf(begin) === 0) return i;
  return -1;
}

/** Uur uit een ISO-tijdstip, in de tijdzone van Brussel ("19:30"). Leeg als het middernacht is. */
function oudUur(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var uur = typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'HH:mm') : d.toISOString().slice(11, 16);
  return uur === '00:00' ? '' : uur;
}

/**
 * Zet een datum om naar tekst "JJJJ-MM-DD".
 * Werkt met een Date-object, "2026-11-20", "20/11/2026", "20-11-2026" of "20.11.26".
 * Geeft '' als het geen datum is.
 */
function parseerDatum(waarde) {
  if (isLeeg(waarde)) return '';
  if (isDatumObject(waarde)) {
    return waarde.getFullYear() + '-' + tweeCijfers(waarde.getMonth() + 1) + '-' + tweeCijfers(waarde.getDate());
  }
  var t = schoon(waarde);
  var m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return geldigeDatum(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var jaar = Number(m[3]);
    if (jaar < 100) jaar += 2000;
    return geldigeDatum(jaar, Number(m[2]), Number(m[1]));
  }
  return '';
}

/** Zet "5", "5,00", "€ 5" of 5 om naar het getal 5. Geeft null als er geen getal in staat. */
function parseerGetal(waarde) {
  if (typeof waarde === 'number') return isNaN(waarde) ? null : waarde;
  var m = schoon(waarde).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Plant de vertaling over een paar minuten (één keer). */
function planVertaling(minuten) {
  verwijderTriggers('vertaalBeschrijvingen');
  ScriptApp.newTrigger('vertaalBeschrijvingen').timeBased().after(minuten * 60 * 1000).create();
}

/** Publiek eindpunt: een aanvraag van de website. */
function publiekeAanvraag(invoer) {
  var inst = leesInstellingen();
  if (!inst.online_reserveren) return { ok: false, fout: 'Online reserveren kan nog niet. Kom langs in de bib.' };
  var cache = CacheService.getScriptCache();
  var teller = Number(cache.get('aanvragen_uur') || 0);
  if (teller >= AANVRAAG_MAX_PER_UUR) return { ok: false, fout: 'Er kwamen net veel aanvragen binnen. Probeer het over een uur opnieuw.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var tabel = leesTabel('Aanvragen');
    var omgeving = { inst: inst, vandaag: vandaagTekst(), catalogus: leesTabel('Catalogus').rijen, aanvragen: tabel.rijen };
    var nieuwId = function () {
      return 'A' + metNullen(volgendNummer('aanvraag', tabel.rijen.map(function (a) { return a.aanvraag_id; })), 4);
    };
    var r = maakAanvraag(omgeving, invoer, nieuwId);
    if (r.ok && !r.stil) {
      bewaarTabel(tabel);
      cache.put('aanvragen_uur', String(teller + 1), 3600);
      var nieuw = tabel.rijen[tabel.rijen.length - 1];
      logboek('website', 'reservatieaanvraag', nieuw.aanvraag_id + ', boek ' + nieuw.boek_id);
    }
    return { ok: r.ok, tekst: r.tekst, fout: r.fout };
  } finally {
    lock.releaseLock();
  }
}

/** De publieke catalogus als JSON-tekst, uit de cache als die er is. */
function publiekeCatalogusJson() {
  var cache = CacheService.getScriptCache();
  var aantal = Number(cache.get(CACHE_SLEUTEL + '_n') || 0);
  if (aantal > 0) {
    var sleutels = [];
    for (var i = 0; i < aantal; i++) sleutels.push(CACHE_SLEUTEL + '_' + i);
    var stukken = cache.getAll(sleutels);
    if (Object.keys(stukken).length === aantal) {
      return sleutels.map(function (s) { return stukken[s]; }).join('');
    }
  }
  var staat = laadStaat('publiek', false);
  verwerkVervallenReservatiesStil(staat);
  var tekst = JSON.stringify(bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen));
  var waarden = {};
  var n = Math.ceil(tekst.length / CACHE_STUK);
  for (var j = 0; j < n; j++) waarden[CACHE_SLEUTEL + '_' + j] = tekst.slice(j * CACHE_STUK, (j + 1) * CACHE_STUK);
  waarden[CACHE_SLEUTEL + '_n'] = String(n);
  try { cache.putAll(waarden, CACHE_DUUR_SECONDEN); } catch (err) { /* te groot voor de cache: dan zonder */ }
  return tekst;
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

/** Reservatie zoals de schermen ze tonen. */
function reservatieInfo(staat, r, plaats) {
  var boek = boekVan(staat, r.boek_id);
  return {
    reservatie_id: r.reservatie_id, boek_id: r.boek_id, titel: boek ? boek.titel : r.boek_id,
    lenersnummer: r.lenersnummer, voornaam: (lenerVan(staat, r.lenersnummer) || {}).voornaam || '',
    datum_reservatie: r.datum_reservatie, status: r.status, exemplaar: r.exemplaar,
    ophalen_tot: r.ophalen_tot, plaats: plaats,
    tekst: r.status === STATUS_KLAAR
      ? 'Ligt apart (' + r.exemplaar + ') tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
      : 'Wacht sinds ' + datumTekst(r.datum_reservatie, staat.vandaag) + ', plaats ' + plaats + ' in de wachtrij'
  };
}

function reservatieVan(staat, reservatieId) {
  return staat.reservaties.filter(function (r) { return String(r.reservatie_id) === String(reservatieId); })[0] || null;
}

/**
 * Reserveren: zet een lener in de wachtrij voor een boek.
 * invoer: { boek_id, lenersnummer }
 */
function reserveren(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isUitleenbaar(boek)) return { ok: false, fout: nietUitleenbaarFout(boek) };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief.' };
  var actief = actieveReservaties(staat, boek.boek_id);
  if (actief.some(function (r) { return String(r.lenersnummer) === String(lener.lenersnummer); })) {
    return { ok: false, fout: 'Deze lener staat al in de wachtrij voor dit boek.' };
  }
  if (lopendeUitleningenVan(staat, lener.lenersnummer).some(function (u) { return u.boek_id === boek.boek_id; })) {
    return { ok: false, fout: 'Deze lener heeft dit boek nu zelf in huis.' };
  }
  var b = beschikbaarheid(staat, boek);
  if (b.beschikbaar > 0) return { ok: false, fout: 'Er staat een exemplaar in de bib. Je kan het meteen uitlenen.' };
  var r = voegToe(staat.reservaties, {
    reservatie_id: 'R' + metNullen(nieuwNummer(staat, 'reservatie', staat.reservaties.map(function (x) { return x.reservatie_id; })), 4),
    boek_id: boek.boek_id, lenersnummer: lener.lenersnummer, datum_reservatie: staat.vandaag,
    status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '', vrijwilliger: staat.wie
  });
  staat.log.push(['reserveren', r.reservatie_id + ' ' + boek.boek_id + ' voor lener ' + lener.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + lenerNaam(staat, lener.lenersnummer) + ' staat op plaats ' + (actief.length + 1) + ' in de wachtrij voor "' + boek.titel + '".' };
}

/** Zet een rij-object om naar een lijst celwaarden volgens de kop. */
function rijNaarWaarden(kop, obj) {
  return kop.map(function (k) { return k ? celWaarde(k, obj[k]) : ''; });
}

/** Welke rol hoort bij een code? '' als de code niet klopt. */
function rolVoorCode(code, inst) {
  var c = schoon(code);
  if (!c) return '';
  if (inst.code_bestuur && c === String(inst.code_bestuur)) return 'bestuur';
  if (inst.toegangscode_balie && c === String(inst.toegangscode_balie)) return 'balie';
  return '';
}

/** "2026-10" en de maand erna. */
function roosterMaanden(vandaag) {
  var j = Number(vandaag.slice(0, 4)), m = Number(vandaag.slice(5, 7));
  var volgende = m === 12 ? (j + 1) + '-01' : j + '-' + tweeCijfers(m + 1);
  return [vandaag.slice(0, 7), volgende];
}

/** Actie voor balie en bestuur: het rooster van deze en volgende maand. */
function roosterOverzicht() {
  var inst = leesInstellingen();
  var link = schoon(inst.rooster_link) || 'https://projectmadrigal.github.io/rooster/';
  var url = schoon(inst.rooster_url), code = schoon(inst.rooster_code);
  if (!/^https:\/\/script\.google\.com\//.test(url) || !code) {
    return { ok: true, data: { gekoppeld: false, link: link } };
  }
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(ROOSTER_CACHE_SLEUTEL);
  if (bewaard) return { ok: true, data: JSON.parse(bewaard) };

  var vandaag = vandaagTekst();
  var antwoorden = roosterMaanden(vandaag).map(function (m) { return haalRoosterMaand(url, code, m); });
  var fout = antwoorden.filter(function (a) { return !a || !a.ok; })[0];
  if (fout && fout.codeFout) return { ok: false, fout: 'De rooster_code in Instellingen klopt niet. Gebruik de toegangscode voor vrijwilligers van het rooster.' };
  if (fout && antwoorden.every(function (a) { return !a || !a.ok; })) return { ok: false, fout: 'Het rooster kon niet laden: ' + (fout.fout || 'onbekende fout') };

  var data = bouwRoosterOverzicht(antwoorden, vandaag);
  data.gekoppeld = true;
  data.link = link;
  data.vandaag = vandaag;
  try { cache.put(ROOSTER_CACHE_SLEUTEL, JSON.stringify(data), ROOSTER_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return { ok: true, data: data };
}

/** Nachtelijke opruiming van de aanvragen (zie Privacy.js). */
function ruimAanvragenOp(inst) {
  if (!spreadsheet().getSheetByName('Aanvragen')) return 0;
  var tabel = leesTabel('Aanvragen');
  var n = ruimAanvragenOpRijen(tabel.rijen, vandaagTekst(), inst.aanvragen_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/** Privacy: aanvragen ouder dan het aantal dagen gaan weg, ook de open. Geeft het aantal terug. */
function ruimAanvragenOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (a) {
    var d = parseerDatum(a.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(a); n++; }
  });
  return n;
}

/** Menu en nachtelijke planning: voert de opruiming uit op de spreadsheet. */
function ruimOp() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('systeem', true);
    // Vervallen reservaties doorgeven gebeurt ook hier, zodat de wachtrij elke nacht klopt.
    verwerkVervallenReservaties(staat);
    var teller = ruimOpStaat(staat);
    bewaarStaat(staat);
    var aanvragen = ruimAanvragenOp(staat.inst);
    logboek('systeem', 'privacy-opruiming', teller.koppelingen + ' koppelingen gewist, ' + teller.leners + ' leners gewist, ' + aanvragen + ' aanvragen gewist');
  } finally {
    lock.releaseLock();
  }
  leegCache();
}

/**
 * Pure versie van de opruiming, voor de tests.
 * staat: zoals in Uitlenen.js, plus staat.uitzonderingenTabel.
 * Geeft het aantal gewiste koppelingen en leners terug.
 */
function ruimOpStaat(staat) {
  var grens = telMaandenOp(staat.vandaag, -staat.inst.bewaartermijn_afgesloten_uitleningen_maanden);
  var teller = { koppelingen: 0, leners: 0 };

  staat.uitleningen.forEach(function (u) {
    if (!isLeeg(u.datum_terug) && u.datum_terug < grens && !isLeeg(u.lenersnummer)) {
      wijzig(u, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  staat.reservaties.forEach(function (r) {
    var afgesloten = r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR;
    var datum = r.datum_afgesloten || r.datum_reservatie;
    if (afgesloten && datum && datum < grens && !isLeeg(r.lenersnummer)) {
      wijzig(r, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  (staat.uitzonderingenTabel || []).forEach(function (x) {
    if (x.datum && x.datum < grens && !isLeeg(x.lenersnummer)) {
      wijzig(x, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });

  staat.leners.forEach(function (l) {
    if (jaNee(l.actief) !== 'nee') return;
    var nr = String(l.lenersnummer);
    var laatste = String(l.datum_inschrijving || '');
    var nogIets = false;
    staat.uitleningen.forEach(function (u) {
      if (String(u.lenersnummer) !== nr) return;
      if (isLeeg(u.datum_terug)) nogIets = true;
      [u.datum_uit, u.datum_terug].forEach(function (d) { if (d && d > laatste) laatste = d; });
    });
    staat.reservaties.forEach(function (r) {
      if (String(r.lenersnummer) === nr && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR)) nogIets = true;
    });
    if (!nogIets && laatste < grens) {
      markeerVerwijderen(l);
      teller.leners++;
    }
  });
  return teller;
}

/** Haalt spaties aan begin en einde weg en maakt dubbele spaties enkel. */
function schoon(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\s+/g, ' ').trim();
}

/** Zoals schoon, maar regeleinden en lege regels (alinea's) blijven. */
function schoonMetRegels(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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

/** De inhoud van de startpagina als JSON-tekst, uit de cache als die er is. */
function siteInhoudJson() {
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(SITE_CACHE_SLEUTEL);
  if (bewaard) return bewaard;
  var staat = laadStaat('publiek', false);
  var lees = function (naam) {
    return spreadsheet().getSheetByName(naam) ? leesTabel(naam).rijen : [];
  };
  var tekst = JSON.stringify(bouwSiteInhoud(staat, { nieuws: lees('Nieuws'), agenda: lees('Agenda'), faq: lees('Veelgestelde vragen') }));
  try { cache.put(SITE_CACHE_SLEUTEL, tekst, CACHE_DUUR_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return tekst;
}

/** Splitst een lijst in een cel ("a, b; c") in losse, opgeschoonde waarden. */
function splitsLijst(waarde) {
  return schoon(waarde).split(/[,;\n]+/).map(schoon).filter(function (x) { return x; });
}

/** Het actieve spreadsheetbestand. */
function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Stelt filtergroepen voor op basis van woorden in het genre. */
function stelFiltergroepenVoor(genre) {
  var g = normaliseerTekst(genre);
  var groepen = [];
  ONDERWERP_VOORSTELLEN.forEach(function (paar) {
    if (paar[0].test(g) && groepen.indexOf(paar[1]) === -1) groepen.push(paar[1]);
  });
  return groepen;
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

/** Tekstveld: opgeschoond en ingekort. */
function tekstInvoer(waarde, max) {
  return schoon(waarde).slice(0, max || 100);
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

/** Telt een aantal dagen op bij een datum (negatief mag ook). */
function telDagenOp(datum, dagen) {
  var d = naarUtc(datum);
  d.setUTCDate(d.getUTCDate() + dagen);
  return vanUtc(d);
}

/** Telefoon vergelijkbaar maken: +32 470 12 34 56 en 0470/12.34.56 worden gelijk. */
function telefoonSleutel(t) {
  var c = String(t || '').replace(/\D/g, '');
  if (c.indexOf('0032') === 0) c = '0' + c.slice(4);
  else if (c.indexOf('32') === 0 && c.length === 11) c = '0' + c.slice(2);
  return c;
}

/* ---------- Grenzen ---------- */

/** Telt een aantal maanden op (negatief mag ook). 31 maart min 1 maand wordt 28 of 29 februari. */
function telMaandenOp(datum, maanden) {
  var d = naarUtc(datum);
  var dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  var laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, laatste));
  return vanUtc(d);
}

/**
 * Terugbrengen.
 * invoer: { uitlening_id, borg_terugbetaald: true/false }
 */
function terugbrengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var velden = { datum_terug: staat.vandaag };
  if (invoer.borg_terugbetaald === true && Number(u.borg) > 0) velden.borg_terugbetaald = staat.vandaag;
  wijzig(u, velden);
  staat.log.push(['terugbrengen', u.uitlening_id + ' ' + u.exemplaar]);
  var melding = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  var boek = boekVan(staat, u.boek_id);
  return {
    ok: true,
    tekst: '"' + (boek ? boek.titel : u.exemplaar) + '" is teruggebracht.' +
      (velden.borg_terugbetaald ? ' Borg van ' + bedragTekst(u.borg) + ' terugbetaald.' : (Number(u.borg) > 0 ? ' De borg staat nog open.' : '')),
    apartLeggen: melding ? [melding] : []
  };
}

/** Menu: test bol.com met één ISBN en toont wat bol.com teruggeeft. */
function testBol() {
  var isbn = '9789044641035';
  try {
    var eigen = normaliseerIsbn(String(SpreadsheetApp.getActiveRange().getValue() || '')).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var t = bolToken(leesInstellingen());
  if (t.fout) { meld(t.fout); return; }
  var r = bolVraag('/products/' + isbn + '/media', t.token);
  var tekst = 'bol.com, ISBN ' + isbn + ': code ' + r.code + '. Afbeelding: ' + (bolAfbeelding(r.data) || 'geen gevonden') +
    '. Antwoord (begin): ' + JSON.stringify(r.data || '').slice(0, 400);
  logboek('menu', 'testBol', tekst);
  meld(tekst);
}

/**
 * Menu: test Google Books met één ISBN en toont het antwoord. Zo zie je meteen of de
 * sleutel werkt en wat Google over een boek weet. Zonder ISBN in de cel: een bekend boek.
 */
function testGoogleBooks() {
  var isbn = '9780141439518'; // Pride and Prejudice (Penguin Classics): Google kent dit boek zeker
  try {
    var cel = String(SpreadsheetApp.getActiveRange().getValue() || '');
    var eigen = normaliseerIsbn(cel).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var sleutel = leesInstellingen().google_books_api_key;
  // Een paar varianten naast elkaar: zo zien we welke wel werkt.
  var varianten = [
    ['met sleutel, land BE', sleutel, 'BE'],
    ['met sleutel, land US', sleutel, 'US'],
    ['met sleutel, zonder land', sleutel, ''],
    ['zonder sleutel, land BE', '', 'BE']
  ];
  var regels = ['Google Books, ISBN ' + isbn + (sleutel ? '' : ' (er staat geen google_books_api_key in Instellingen)')];
  varianten.forEach(function (v) {
    if (v[0].indexOf('met sleutel') === 0 && !sleutel) return;
    var r = googleBooksZoek(isbn, v[1], v[2]);
    var info = r.items.length ? r.items[0].volumeInfo : null;
    regels.push(v[0] + ': ' + (r.fout ? 'fout, ' + r.fout
      : !info ? 'kent dit ISBN niet (code ' + r.code + ')'
      : '"' + (info.title || '?') + '", cover ' + (info.imageLinks ? 'ja' : 'nee') + ', beschrijving ' + (info.description ? 'ja' : 'nee')));
    Utilities.sleep(300);
  });
  var tekst = regels.join('\n');
  logboek('menu', 'testGoogleBooks', regels.join(' | '));
  meld(tekst);
}

/**
 * Welke back-ups mogen weg? bestanden: [{ id, naam, datum }] (datum als getal of tekst).
 * Geeft de id's van alles buiten de nieuwste "bewaren" back-ups. Enkel bestanden
 * waarvan de naam met BACKUP_VOORVOEGSEL begint, tellen mee.
 */
function teVerwijderenBackups(bestanden, bewaren) {
  var n = Math.max(1, Math.round(Number(bewaren) || 0));
  return bestanden
    .filter(function (b) { return String(b.naam || '').indexOf(BACKUP_VOORVOEGSEL) === 0; })
    .sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; })
    .slice(n)
    .map(function (b) { return b.id; });
}

/** Tijdzone van het script, voor datums van vandaag. */
function tijdzone() {
  return Session.getScriptTimeZone() || 'Europe/Brussels';
}

/**
 * Sleutel om titels te vergelijken: zonder ondertitel (na ":"), zonder reeksinfo
 * tussen haakjes en zonder lidwoorden.
 */
function titelSleutel(titel) {
  var t = schoon(titel).replace(/\(.*?\)/g, ' ').split(':')[0];
  return woorden(t).join(' ');
}

/**
 * Enkel de namen uit de instelling aanraders_uit_stocklijst (bv. Johanna) komen
 * uit de stocklijst. "Nance en Johanna" wordt zo "Johanna". Andere aanraders
 * typ je zelf in de kolom aanrader van de Catalogus.
 */
function toegelatenStockAanrader(waarde, inst) {
  var toegelaten = splitsLijst((inst || {}).aanraders_uit_stocklijst).map(normaliseerTekst);
  return splitsLijst(String(waarde || '').replace(/ en | & /g, ',')).filter(function (naam) {
    return toegelaten.indexOf(normaliseerTekst(naam)) > -1;
  }).join(', ');
}

/** Vult aan met nullen: 7 wordt "07". */
function tweeCijfers(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Een tekst in beide talen. Lege Engelse versie: de Nederlandse. */
function tweetalig(rij, veld) {
  var nl = schoon(rij[veld]);
  return { nl: nl, en: schoon(rij[veld + '_en']) || nl };
}

/** Een tekst met meerdere regels: enkel spaties aan begin en einde weg. */
function tweetaligLang(rij, veld) {
  var nl = String(rij[veld] || '').trim();
  return { nl: nl, en: String(rij[veld + '_en'] || '').trim() || nl };
}

/**
 * Status van een lopende uitlening, met kleurcode én tekst.
 * Geeft terug:
 *   code:   'optijd', 'binnenkort' of 'telaat' (de kleur in de schermen)
 *   label:  korte tekst voor een label
 *   tekst:  volledige zin, bv. "Terug tegen vrijdag 20 november (nog 18 dagen)"
 *   verlengd, verlengdTekst: extra label als de uitlening verlengd is
 */
function uitleenStatus(uitlening, vandaag, inst) {
  var verval = uitlening.vervaldatum;
  var dagen = dagenTussen(vandaag, verval);
  var dt = datumTekst(verval, vandaag);
  var status;
  if (dagen < 0) {
    status = { code: 'telaat', label: 'Te laat', tekst: 'Te laat sinds ' + dt + ' (' + dagenTekst(-dagen) + ')' };
  } else if (dagen === 0) {
    status = { code: 'binnenkort', label: 'Vervalt vandaag', tekst: 'Vervalt vandaag, ' + dt };
  } else if (dagen <= inst.waarschuwing_dagen_voor_vervaldatum) {
    status = { code: 'binnenkort', label: 'Vervalt binnenkort', tekst: 'Vervalt ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  } else {
    status = { code: 'optijd', label: 'Op tijd', tekst: 'Terug tegen ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  }
  status.dagen = dagen;
  status.verlengd = Number(uitlening.aantal_verlengingen || 0) > 0;
  if (status.verlengd) {
    status.verlengdTekst = 'Verlengd: eerst ' + datumTekst(uitlening.oorspronkelijke_vervaldatum, vandaag) + ', nu ' + dt;
  }
  return status;
}

/**
 * Uitlenen.
 * invoer: { exemplaar, lenersnummer, borg, betaalwijze, gift, uitzondering: { reden } }
 */
function uitlenen(staat, invoer) {
  var ex = exemplaarInfo(staat, invoer.exemplaar);
  if (!ex) return { ok: false, fout: 'Dit exemplaar bestaat niet.' };
  if (!isUitleenbaar(ex.boek)) return { ok: false, fout: nietUitleenbaarFout(ex.boek) };
  if (uitleningVanExemplaar(staat, ex.exemplaar)) return { ok: false, fout: 'Dit exemplaar is al uitgeleend. Kies een ander exemplaar of registreer eerst het terugbrengen.' };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief. Vraag het bestuur om de lener weer actief te zetten.' };
  var borg = bedragInvoer(invoer.borg);
  var gift = bedragInvoer(invoer.gift);
  if (borg === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de borg.' };
  if (gift === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de gift.' };
  var betaalwijze = tekstInvoer(invoer.betaalwijze, 20);
  if (borg > 0 && staat.inst.borg_betaalwijzen.indexOf(betaalwijze) === -1) {
    return { ok: false, fout: 'Kies hoe de borg betaald werd: ' + staat.inst.borg_betaalwijzen.join(' of ') + '.' };
  }

  var stop = behandelGrenzen(staat, 'uitlenen', { lener: lener, boek: ex.boek, exemplaar: ex.exemplaar }, invoer);
  if (stop) return stop;

  var verval = berekenVervaldatum(staat.vandaag, staat.inst);
  var u = voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: ex.exemplaar, boek_id: ex.boek.boek_id, lenersnummer: lener.lenersnummer,
    datum_uit: staat.vandaag, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg, betaalwijze_borg: borg > 0 ? betaalwijze : '',
    borg_terugbetaald: '', gift: gift || '', laatste_herinnering: '', vrijwilliger: staat.wie, bron: ''
  });

  // Had deze lener een reservatie voor dit boek? Dan is die nu afgehaald.
  var meldingen = [];
  actieveReservaties(staat, ex.boek.boek_id).forEach(function (r) {
    if (String(r.lenersnummer) !== String(lener.lenersnummer)) return;
    var vrijExemplaar = r.status === STATUS_KLAAR && r.exemplaar && r.exemplaar !== ex.exemplaar ? r.exemplaar : '';
    wijzig(r, { status: STATUS_AFGEHAALD, datum_afgesloten: staat.vandaag });
    // De lener nam een ander exemplaar mee dan het apart gelegde: dat gaat naar de volgende.
    if (vrijExemplaar) {
      var m = geefExemplaarDoor(staat, ex.boek.boek_id, vrijExemplaar);
      if (m) meldingen.push(m);
    }
  });

  staat.log.push(['uitlenen', u.uitlening_id + ' ' + u.exemplaar + ' aan lener ' + lener.lenersnummer]);
  return {
    ok: true,
    terugTekst: 'Breng terug tegen ' + datumTekst(verval, staat.vandaag),
    vervaldatum: verval,
    uitlening: uitleningInfo(staat, u),
    apartLeggen: meldingen
  };
}

/**
 * Een uitlening zoals de schermen ze tonen.
 * metContact: true enkel voor het bestuur (telefoon, e-mail, achternaam).
 */
function uitleningInfo(staat, u, metContact) {
  var boek = boekVan(staat, u.boek_id);
  var lener = lenerVan(staat, u.lenersnummer);
  var info = {
    uitlening_id: u.uitlening_id, exemplaar: u.exemplaar, boek_id: u.boek_id,
    titel: boek ? boek.titel : '(onbekend boek)', auteur: boek ? boek.auteur : '',
    lenersnummer: u.lenersnummer, voornaam: lener ? lener.voornaam : '',
    datum_uit: u.datum_uit, vervaldatum: u.vervaldatum,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0),
    borg: Number(u.borg || 0), betaalwijze_borg: u.betaalwijze_borg,
    status: isLeeg(u.datum_terug) ? uitleenStatus(u, staat.vandaag, staat.inst) : null
  };
  if (metContact) {
    info.achternaam = lener ? lener.achternaam : '';
    info.telefoon = lener ? lener.telefoon : '';
    info.email = lener ? lener.email : '';
    info.laatste_herinnering = u.laatste_herinnering;
  }
  return info;
}

function uitleningVan(staat, uitleningId) {
  return staat.uitleningen.filter(function (u) { return String(u.uitlening_id) === String(uitleningId); })[0] || null;
}

function uitleningVanExemplaar(staat, exemplaar) {
  return lopendeUitleningen(staat).filter(function (u) { return u.exemplaar === exemplaar; })[0] || null;
}

/** De datum van vandaag als "JJJJ-MM-DD". */
function vandaagTekst() {
  return Utilities.formatDate(new Date(), tijdzone(), 'yyyy-MM-dd');
}

/** Date in UTC terug naar "JJJJ-MM-DD". */
function vanUtc(d) {
  return d.getUTCFullYear() + '-' + tweeCijfers(d.getUTCMonth() + 1) + '-' + tweeCijfers(d.getUTCDate());
}

/**
 * Maakt een tekst veilig om in een cel te schrijven.
 * Tekst die met = + - of @ begint, zou de spreadsheet als formule lezen.
 * Telefoonnummers met een 0 vooraan en lange cijferreeksen (ISBN) blijven tekst.
 */
function veiligeCel(waarde) {
  if (typeof waarde !== 'string') return waarde;
  if (/^[=+\-@]/.test(waarde) || /^0\d/.test(waarde) || /^\d{8,}$/.test(waarde)) return "'" + waarde;
  return waarde;
}

/** Enkel https-links naar afbeeldingen. Zo kan er geen vreemde code via een cover binnensluipen. */
function veiligeCoverUrl(url) {
  var u = schoon(url);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}

/**
 * Verlengen.
 * invoer: { uitlening_id, uitzondering: { reden } }
 */
function verlengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var stop = behandelGrenzen(staat, 'verlengen', { uitlening: u, boek: boekVan(staat, u.boek_id), lener: lenerVan(staat, u.lenersnummer) }, invoer);
  if (stop) return stop;
  var nieuw = berekenVerlenging(u.vervaldatum, staat.inst);
  wijzig(u, {
    vervaldatum: nieuw,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0) + 1,
    datum_verlenging: staat.vandaag,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum || u.vervaldatum
  });
  staat.log.push(['verlengen', u.uitlening_id + ' tot ' + nieuw]);
  return { ok: true, terugTekst: 'Nieuwe datum: breng terug tegen ' + datumTekst(nieuw, staat.vandaag), vervaldatum: nieuw, uitlening: uitleningInfo(staat, u) };
}

/** Menu: vertaalt de beschrijvingen naar het Nederlands en het Engels, in porties. */
function vertaalBeschrijvingen() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { planVertaling(5); return; } // een andere bewerking loopt: straks opnieuw
  var verwerkt = 0, rest = 0, limiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_vertaald') === -1 || tabel.kop.indexOf('beschrijving_en') === -1) {
      meld('De kolommen beschrijving_en en beschrijving_vertaald ontbreken nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var vertaal = function (tekst, taal) { return LanguageApp.translate(tekst, '', taal); };
    var teDoen = tabel.rijen.filter(heeftVertalingNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var velden;
      try {
        velden = maakTweetaligeBeschrijving(teDoen[i], vertaal);
      } catch (e) {
        // Meestal de daglimiet van Google Translate.
        limiet = true;
        break;
      }
      velden.beschrijving_vertaald = vandaag;
      wijzig(teDoen[i], velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(200);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftVertalingNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vertaalBeschrijvingen');
  if (rest > 0) planVertaling(limiet ? 24 * 60 : 1);
  if (verwerkt) leegCache();
  logboek('menu', 'vertaalBeschrijvingen', verwerkt + ' vertaald, ' + rest + ' te gaan' + (limiet ? ' (daglimiet van Google Translate)' : ''));
  var tekst = verwerkt + ' beschrijvingen vertaald.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google Translate is bereikt: morgen gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is vertaald.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Leest de vertaaltabel als object: genre -> lijst filtergroepen. */
function vertaalTabel(onderwerpRijen) {
  var vertaal = {};
  onderwerpRijen.forEach(function (r) {
    vertaal[normaliseerTekst(r.genre)] = splitsLijst(r.filtergroepen);
  });
  return vertaal;
}

function verversMenu() {
  leegCache();
  meld('De publieke catalogus haalt bij de volgende opvraging alles vers op.');
}

/**
 * Haalt uit het antwoord van Google Books (één "volumeInfo") de velden die nog leeg zijn.
 * Geeft een object veld -> waarde terug.
 */
function verwerkGoogleBooks(boek, info) {
  var v = {};
  if (!info) return v;
  var links = info.imageLinks || {};
  var cover = links.thumbnail || links.smallThumbnail;
  if (isLeeg(boek.cover_url) && cover) {
    // Altijd https, zonder het omgekrulde hoekje dat Google soms toevoegt.
    v.cover_url = String(cover).replace(/^http:/, 'https:').replace(/&edge=curl/, '');
  }
  if (isLeeg(boek.uitgeverij) && info.publisher) v.uitgeverij = schoon(info.publisher);
  if (isLeeg(boek.jaartal) && info.publishedDate) {
    var m = String(info.publishedDate).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && info.pageCount) v.paginas = Number(info.pageCount);
  if (isLeeg(boek.taal) && GB_TALEN[info.language]) v.taal = GB_TALEN[info.language];
  if (isLeeg(boek.beschrijving) && info.description) {
    var b = schoon(String(info.description).replace(/<[^>]*>/g, ' '));
    if (b) v.beschrijving = maakBeschrijvingNetjes(b);
  }
  return v;
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

/**
 * Menu: verwerkt boeken die je met de hand onderaan de Catalogus toevoegde.
 * Geeft ze een boek-ID, maakt het ISBN en de taal netjes, en vult aan uit
 * Goodreads (als dat tabblad bestaat) en Open Library.
 */
function verwerkNieuweBoeken() {
  var aantal = geefNieuweBoekenEenId();
  werkOnderwerpenBij();
  leegCache();
  if (spreadsheet().getSheetByName('Goodreads-export')) vulAanUitGoodreads(true);
  meld(aantal + ' nieuwe boeken kregen een boek-ID. Open Library vult nu de rest aan.');
  vulAanUitOpenLibrary();
}

/**
 * Elk uur vanzelf (zie Installeer tabbladen): een boek dat je met de hand in de
 * Catalogus typte, krijgt een boek-ID en verschijnt zo op de website en in Nieuw binnen.
 */
function verwerkNieuweBoekenAutomatisch() {
  var aantal = geefNieuweBoekenEenId();
  if (!aantal) return;
  werkOnderwerpenBij();
  leegCache();
  logboek('systeem', 'nieuwe boeken', aantal + ' boeken kregen vanzelf een boek-ID');
}

/**
 * Haalt uit het antwoord van Open Library (jscmd=details) de velden die nog leeg zijn.
 * details: het "details"-object van één ISBN.
 * Geeft een object veld -> waarde terug (enkel voor lege velden).
 */
function verwerkOpenLibrary(boek, details) {
  var v = {};
  if (!details) return v;
  if (isLeeg(boek.uitgeverij) && details.publishers && details.publishers.length) v.uitgeverij = schoon(details.publishers[0]);
  if (isLeeg(boek.jaartal) && details.publish_date) {
    var m = String(details.publish_date).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && details.number_of_pages) v.paginas = Number(details.number_of_pages);
  if (isLeeg(boek.taal) && details.languages && details.languages.length) {
    var code = String(details.languages[0].key || '').split('/').pop();
    if (OL_TALEN[code]) v.taal = OL_TALEN[code];
  }
  if (isLeeg(boek.beschrijving) && details.description) {
    var b = typeof details.description === 'string' ? details.description : details.description.value;
    b = schoon(b);
    if (b) v.beschrijving = maakBeschrijvingNetjes(b);
  }
  if (isLeeg(boek.cover_url) && details.covers && details.covers.length && details.covers[0] > 0) {
    v.cover_url = 'https://covers.openlibrary.org/b/id/' + details.covers[0] + '-M.jpg';
  }
  return v;
}

/**
 * Verwerkt de oude rijen in de staat (zonder de spreadsheet aan te raken).
 * Geeft { uitleningen, leners, naTeKijken } terug.
 */
function verwerkOudeUitleningen(staat, oudeRijen) {
  var teller = { uitleningen: 0, leners: 0 };
  var naTeKijken = [];
  var bekend = {};
  staat.uitleningen.forEach(function (u) { if (u.bron) bekend[u.bron] = true; });

  oudeRijen.forEach(function (o) {
    if (!isLeeg(o.terug_op)) return; // al teruggebracht: blijft in het oude blad
    var bron = 'oud blad rij ' + o.rijnummer;
    if (bekend[bron]) return;

    // 1. De lener: bestaat die al (zelfde e-mail of telefoon)?
    var lener = staat.leners.filter(function (l) {
      return (o.email && String(l.email).toLowerCase() === o.email) ||
        (o.telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(o.telefoon));
    })[0];
    if (!lener) {
      lener = voegToe(staat.leners, {
        lenersnummer: String(nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }))),
        voornaam: o.voornaam || '?', achternaam: o.achternaam, telefoon: o.telefoon, email: o.email,
        datum_inschrijving: o.datum_uit || staat.vandaag,
        toestemming_privacy: 'onbekend', actief: 'ja'
      });
      teller.leners++;
    }

    // 2. Het boek.
    var gevonden = zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur);
    var boek = gevonden.zeker;
    var exemplaar = '';
    if (boek) {
      exemplaar = exemplarenVan(boek).filter(function (ex) { return !uitleningVanExemplaar(staat, ex); })[0] || '';
    }
    var borg = leesBorg(o.borg, staat.inst);
    var context = 'Lener ' + lener.lenersnummer + ', geleend op ' + korteDatum(o.datum_uit) +
      ', terug tegen ' + korteDatum(o.datum_terug_afgesproken) + ', borg ' + bedragTekst(borg.bedrag) + (borg.betaalwijze ? ' (' + borg.betaalwijze + ')' : '') + '.';
    if (!boek || !exemplaar) {
      naTeKijken.push({
        boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
        titel: o.boek, veld: 'uitlening', waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
        waarde_bron: o.boek + ' / ' + o.auteur,
        opmerking: (boek ? 'Alle exemplaren staan al als uitgeleend. ' : 'Het boek is niet zeker gevonden. ') + context +
          ' Registreer deze uitlening zelf via het uitleenscherm.',
        sleutel_extra: bron
      });
      bekend[bron] = true;
      return;
    }

    // 3. De uitlening.
    var datumUit = o.datum_uit || staat.vandaag;
    var verval = o.datum_terug_afgesproken || berekenVervaldatum(datumUit, staat.inst);
    var gift = parseerGetal(o.gift);
    voegToe(staat.uitleningen, {
      uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
      exemplaar: exemplaar, boek_id: boek.boek_id, lenersnummer: lener.lenersnummer,
      datum_uit: datumUit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
      aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
      borg_terugbetaald: '', gift: gift || '',
      laatste_herinnering: parseerDatum(o.herinnering) || schoon(o.herinnering),
      vrijwilliger: 'overgezet', bron: bron
    });
    bekend[bron] = true;
    teller.uitleningen++;
  });
  return { uitleningen: teller.uitleningen, leners: teller.leners, naTeKijken: naTeKijken };
}

/**
 * Zet klaarliggende reservaties die niet op tijd afgehaald werden op "vervallen"
 * en geeft het exemplaar door aan de volgende. Geeft de meldingen terug.
 */
function verwerkVervallenReservaties(staat) {
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_KLAAR && r.ophalen_tot && r.ophalen_tot < staat.vandaag) {
      wijzig(r, { status: STATUS_VERVALLEN, datum_afgesloten: staat.vandaag });
      staat.log.push(['reservatie vervallen', r.reservatie_id]);
      var m = geefExemplaarDoor(staat, r.boek_id, r.exemplaar);
      if (m) meldingen.push(m);
    }
  });
  return meldingen;
}

/* ---------- Acties ---------- */

/** Vervallen reservaties bijwerken zonder het publieke verzoek te laten mislukken. */
function verwerkVervallenReservatiesStil(staat) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    verwerkVervallenReservaties(staat);
    bewaarStaat(staat);
  } finally {
    lock.releaseLock();
  }
}

/** Verwijdert geplande uitvoeringen van een functie. */
function verwijderTriggers(functienaam) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === functienaam) ScriptApp.deleteTrigger(t);
  });
}

/** Zoekt het adres en de publieke sleutel van de databank in de code van de oude website. */
function vindOudeDatabank() {
  var html = UrlFetchApp.fetch(OUDE_SITE).getContentText();
  var main = (html.match(/main\.[a-f0-9]+\.js/) || [])[0];
  if (!main) throw new Error('Ik vond de code van de oude website niet.');
  var code = UrlFetchApp.fetch(OUDE_SITE + main).getContentText();
  var url = (code.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  var sleutel = (code.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [])[0];
  if (!url || !sleutel) throw new Error('Ik vond het adres van de oude databank niet.');
  return { url: url, sleutel: sleutel };
}

/** Een korte vingerafdruk van een rij: zo merken we het als iemand ze intussen in de spreadsheet aanpaste. */
function vingerafdruk(rij, kolommen) {
  var tekst = kolommen.map(function (k) { return String(isLeeg(rij[k]) ? '' : rij[k]); }).join('\u0001');
  var h = 5381;
  for (var i = 0; i < tekst.length; i++) h = ((h * 33) ^ tekst.charCodeAt(i)) >>> 0;
  return String(h);
}

function voegBronSamen(bestaand, bron, nieuwId, inst, vandaag) {
  // Bij de eerste opbouw is niets "nieuw binnen". Daarna krijgt een nieuw boek de datum van vandaag.
  var datumNieuw = bestaand.length && vandaag ? vandaag : '';
  // 1. Dubbele rijen in de bron samenvoegen: aantallen optellen, herkomst bundelen.
  var perSleutel = {};
  var volgorde = [];
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (!perSleutel[s]) { perSleutel[s] = b; volgorde.push(s); return; }
    var eerste = perSleutel[s];
    eerste.aantal += b.aantal;
    if (b.herkomst && eerste.herkomst.indexOf(b.herkomst) === -1) {
      eerste.herkomst = eerste.herkomst ? eerste.herkomst + ' | ' + b.herkomst : b.herkomst;
    }
    Object.keys(b).forEach(function (k) { if (isLeeg(eerste[k]) && !isLeeg(b[k])) eerste[k] = b[k]; });
  });

  // 2. Bestaande rijen opzoeken op hun bronsleutel.
  var index = {};
  bestaand.forEach(function (rij) { if (rij.bron_sleutel) index[rij.bron_sleutel] = rij; });

  var teller = { nieuw: 0, aangevuld: 0 };
  volgorde.forEach(function (s) {
    var b = perSleutel[s];
    var rij = index[s];
    if (rij) {
      // Enkel lege velden aanvullen. Wat iemand met de hand invulde, blijft.
      var velden = {};
      ['titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat', 'genre', 'herkomst', 'isbn_origineel'].forEach(function (k) {
        if (isLeeg(rij[k]) && !isLeeg(b[k])) velden[k] = b[k];
      });
      // De aanrader: enkel de toegelaten namen (zie toegelatenStockAanrader).
      var aanrader = toegelatenStockAanrader(b.aanrader, inst);
      if (isLeeg(rij.aanrader) && aanrader) velden.aanrader = aanrader;
      if (isLeeg(rij.aantal)) velden.aantal = b.aantal;
      if (Object.keys(velden).length) { wijzig(rij, velden); teller.aangevuld++; }
      return;
    }
    var teKoop = b.soort === 'zine' && normaliseerTekst(b.genre) === 'verkoop';
    var nieuweRij = {
      boek_id: nieuwId(b.soort),
      soort: b.soort,
      titel: b.titel, auteur: b.auteur, isbn: b.isbn, uitgeverij: b.uitgeverij, jaartal: b.jaartal,
      taal: b.taal, paginas: b.paginas, uitvoering: b.uitvoering, nieuwstaat: b.nieuwstaat,
      aanrader: toegelatenStockAanrader(b.aanrader, inst), genre: b.genre, extra_onderwerpen: '', klassieker: '',
      aantal: b.aantal,
      uitleenbaar: teKoop && !inst.zines_te_koop_uitleenbaar ? 'nee' : 'ja',
      publiek: nietPubliekVolgensHerkomst(b.herkomst) ? 'nee' : 'ja',
      beschrijving: '', cover_url: '', startpagina: '', toegevoegd_op: datumNieuw,
      herkomst: b.herkomst, isbn_origineel: b.isbn_origineel, bron_sleutel: s, ol_gecontroleerd: ''
    };
    voegToe(bestaand, nieuweRij);
    index[s] = nieuweRij;
    teller.nieuw++;
  });
  return teller;
}

/**
 * Voegt twijfelgevallen toe aan het tabblad "Na te kijken", zonder dubbels.
 * rijen: rijen van "Na te kijken"; items: [{boek, veld, waarde_catalogus, waarde_bron, opmerking}]
 */
function voegNaTeKijkenToe(rijen, items, bron, vandaag) {
  var bekend = {};
  rijen.forEach(function (r) { bekend[r.sleutel] = true; });
  var nieuw = 0;
  items.forEach(function (item) {
    var sleutel = bron + '|' + (item.boek ? item.boek.boek_id : item.boek_id) + '|' + item.veld + '|' + normaliseerTekst(item.waarde_bron);
    if (bekend[sleutel]) return;
    bekend[sleutel] = true;
    voegToe(rijen, {
      datum: vandaag, bron: bron,
      boek_id: item.boek ? item.boek.boek_id : (item.boek_id || ''),
      titel: item.boek ? item.boek.titel : (item.titel || ''),
      veld: item.veld, waarde_catalogus: item.waarde_catalogus, waarde_bron: item.waarde_bron,
      opmerking: item.opmerking, afgehandeld: 'nee', sleutel: sleutel
    });
    nieuw++;
  });
  return nieuw;
}

/** Voegt rijen toe die er nog niet zijn (op bron_id). Geeft het aantal nieuwe terug. */
function voegOudeRijenToe(bestaande, nieuwe) {
  var bekend = {};
  bestaande.forEach(function (r) { if (r.bron_id) bekend[r.bron_id] = true; });
  var n = 0;
  nieuwe.forEach(function (r) {
    if (bekend[r.bron_id]) return;
    voegToe(bestaande, r);
    bekend[r.bron_id] = true;
    n++;
  });
  return n;
}

/** Voegt een nieuwe rij toe aan een lijst en markeert ze als nieuw. */
function voegToe(lijst, obj) {
  obj._nieuw = true;
  lijst.push(obj);
  return obj;
}

/** Voert een actie uit. Wijzigende acties gebeuren onder een slot, zodat twee balies elkaar niet storen. */
function voerActieUit(actie, invoer, rol) {
  if (actie === 'aanmelden') return { ok: true, rol: rol };
  if (actie === 'roosterOverzicht') return roosterOverzicht(); // leest enkel, geen slot nodig
  if (actie === 'beheerIsbnOpzoeken') return isbnOpzoeken(invoer); // leest enkel bij Open Library en Google Books
  if (actie === 'beheerInhoud') return beheerInhoudGegevens();
  if (actie === 'beheerTekstUitFoto') return tekstUitFoto(invoer, ocrViaDrive); // leest enkel, geen slot nodig

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var wie = tekstInvoer(invoer.wie, 40) || 'onbekend';
    if (actie === 'aanvraagAfhandelen') return beheerAanvraagAfhandelen(invoer, wie);
    if (actie === 'beheerInhoudBewaren' || actie === 'beheerInstellingBewaren') {
      var gewijzigd = actie === 'beheerInhoudBewaren' ? beheerInhoudBewaren(invoer, wie) : beheerInstellingBewaren(invoer, wie);
      if (gewijzigd.ok) leegCache();
      return gewijzigd;
    }
    var staat = laadStaat(invoer.wie, actie === 'bestuurData');
    var meldingen = verwerkVervallenReservaties(staat);
    var antwoord;
    switch (actie) {
      case 'balieData': antwoord = { ok: true, data: balieGegevens(staat) }; break;
      case 'bestuurData':
        antwoord = { ok: true, data: bestuurGegevens(staat, leesTabel('Onderwerpen').rijen) };
        antwoord.data.aanvragen = openAanvragen(spreadsheet().getSheetByName('Aanvragen') ? leesTabel('Aanvragen').rijen : []);
        antwoord.data.onlineReserveren = staat.inst.online_reserveren === true;
        break;
      case 'uitlenen': antwoord = uitlenen(staat, invoer); break;
      case 'terugbrengen': antwoord = terugbrengen(staat, { uitlening_id: invoer.uitlening_id, borg_terugbetaald: invoer.borg_terugbetaald === true }); break;
      case 'verlengen': antwoord = verlengen(staat, invoer); break;
      case 'reserveren': antwoord = reserveren(staat, invoer); break;
      case 'annuleerReservatie': antwoord = annuleerReservatie(staat, invoer); break;
      case 'nieuweLener': antwoord = nieuweLener(staat, { voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, toestemming: invoer.toestemming === true }); break;
      case 'borgTerugbetaald': antwoord = borgTerugbetaald(staat, invoer); break;
      case 'herinneringVerstuurd': antwoord = herinneringVerstuurd(staat, invoer); break;
      case 'beheerBoekOphalen': antwoord = boekOphalen(staat, invoer); break;
      case 'beheerCoversLijst': antwoord = coversTeZoeken(staat); break;
      case 'beheerCoversBewaren': antwoord = coversBewaren(staat, invoer); break;
      case 'beheerIaCovers': antwoord = iaCoversLijst(staat); break;
      case 'beheerIaCoversWissen': antwoord = iaCoversWissen(staat, invoer); break;
      case 'beheerCoverUpload': antwoord = coverUploaden(staat, invoer, bewaarFotoInDrive); break;
      case 'beheerBoekBewaren': antwoord = boekAanpassen(staat, invoer); break;
      case 'beheerBoekToevoegen':
        var ids = maakIdGenerator(staat.catalogus);
        antwoord = boekToevoegen(staat, invoer, ids.nieuw);
        if (antwoord.ok) ids.bewaar();
        break;
      case 'lenerAanpassen': antwoord = lenerAanpassen(staat, { lenersnummer: invoer.lenersnummer, voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, actief: invoer.actief !== false }); break;
    }
    // Ook bij een geweigerde actie bewaren we vervallen reservaties.
    bewaarStaat(staat);
    if (staat.vertalingNodig) {
      try { planVertaling(2); } catch (e) { /* lukt het niet, dan vertaalt het menu later */ }
    }
    if (staat.catalogusGewijzigd) {
      bewaarTabel(staat.tabellen.Catalogus);
      werkOnderwerpenBij(); // een nieuw genre komt zo in de vertaaltabel Onderwerpen
    }
    if (meldingen.length || (antwoord.ok && actie !== 'balieData' && actie !== 'bestuurData')) leegCache();
    if (meldingen.length && antwoord.ok) antwoord.apartLeggen = (antwoord.apartLeggen || []).concat(meldingen);
    return antwoord;
  } finally {
    lock.releaseLock();
  }
}

/**
 * De eerstvolgende openingsdag vanaf een datum.
 * inclusief = true: de datum zelf telt mee als die een openingsdag is.
 */
function volgendeOpeningsdag(datum, inst, inclusief) {
  if (!inst.openingsdagen.length) return datum;
  var d = inclusief ? datum : telDagenOp(datum, 1);
  // Veiligheidsgrens: hoogstens een jaar vooruit zoeken.
  for (var i = 0; i < 366; i++) {
    if (isOpeningsdag(d, inst)) return d;
    d = telDagenOp(d, 1);
  }
  return datum;
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

/** Menu: vult de Catalogus aan uit het tabblad Goodreads-export. */
function vulAanUitGoodreads(stil) {
  var blad = spreadsheet().getSheetByName('Goodreads-export');
  if (!blad) {
    meld('Er is geen tabblad "Goodreads-export". Plak eerst de export van Goodreads in een nieuw tabblad met die naam.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var shelf = leesInstellingen().goodreads_shelf;
    var goodreads = leesGoodreadsRijen(blad.getDataRange().getValues(), shelf);
    if (!goodreads.length) {
      meld(shelf ? 'Ik vond geen boeken op de shelf "' + shelf + '". Kijk in Instellingen of de naam van goodreads_shelf precies klopt.' : 'Het tabblad Goodreads-export is leeg.');
      return;
    }
    var catalogus = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    var resultaat = koppelGoodreads(catalogus.rijen, goodreads);
    resultaat.aanvullingen.forEach(function (a) {
      var v = {}; v[a.veld] = a.waarde;
      wijzig(a.boek, v);
    });
    // Oude rijen van Goodreads die nog niet afgehandeld zijn, vervangen we door de nieuwe.
    naTeKijken.rijen = naTeKijken.rijen.filter(function (r) { return r.bron !== 'Goodreads' || jaNee(r.afgehandeld) === 'ja'; });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken, 'Goodreads', vandaagTekst());
    bewaarTabel(catalogus);
    schrijfVolledig(naTeKijken);
    leegCache();
    logboek('menu', 'vulAanUitGoodreads', resultaat.aanvullingen.length + ' velden aangevuld, ' + nieuw + ' na te kijken');
    if (!stil) meld(goodreads.length + ' boeken van Goodreads gebruikt' + (shelf ? ' (shelf "' + shelf + '")' : '') + '. ' +
      resultaat.aanvullingen.length + ' velden aangevuld. ' + nieuw + ' nieuwe twijfelgevallen in "Na te kijken". ' +
      'Je mag het tabblad Goodreads-export nu verwijderen: het bevat ook de rest van je persoonlijke bibliotheek.');
  } finally {
    lock.releaseLock();
  }
}

/** Menu: vult covers aan uit Google Books, in porties. */
function vulAanUitGoogleBooks() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, aangevuld = 0, rest = 0, limiet = false, fout = '', gekend = 0, storing = false, verdacht = false;
  var gedaan = [];
  try {
    var sleutel = leesInstellingen().google_books_api_key;
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('gb_gecontroleerd') === -1) {
      meld('De kolom gb_gecontroleerd ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftGoogleBooksNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > GB_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var antwoord = googleBooksZoek(boek.isbn, sleutel); // zie Beschrijvingen.js
      var code = antwoord.code;
      if (code >= 400) fout = antwoord.fout;
      if (antwoord.limiet || code === 403 || code === 400) { limiet = true; break; } // daglimiet, of Google weigert (zie fout)
      if (code >= 500) { storing = true; break; }                                     // storing bij Google: later verder
      var info = antwoord.items.length ? antwoord.items[0].volumeInfo : null;
      if (info) gekend++;
      var velden = verwerkGoogleBooks(boek, info);
      if (velden.cover_url) aangevuld++;
      velden.gb_gecontroleerd = vandaag;
      wijzig(boek, velden);
      gedaan.push(boek);
      verwerkt++;
      // Kent Google na 20 boeken nog geen enkel boek, dan klopt er iets niet (sleutel, land, ...).
      // Dan stoppen we en vinken we niets aan, zodat die boeken later opnieuw aan de beurt komen.
      if (verwerkt === 20 && gekend === 0) {
        verdacht = true;
        gedaan.forEach(function (b) { wijzig(b, { gb_gecontroleerd: '' }); });
        break;
      }
      // Om de 25 boeken bewaren: zo gaat er niets verloren als het script stopt.
      if (verwerkt % 25 === 0) bewaarTabel(tabel);
      Utilities.sleep(GB_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftGoogleBooksNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulAanUitGoogleBooks');
  if (verdacht) {
    var waarschuwing = 'Google Books kende geen enkel boek van de eerste 20. Er klopt iets niet: het script stopt en vinkt niets aan. Kies Madrigal > Test Google Books.';
    logboek('menu', 'vulAanUitGoogleBooks', waarschuwing);
    meld(waarschuwing);
    return;
  }
  if (rest > 0) {
    // Daglimiet: 6 uur wachten. Storing bij Google: een kwartier. Anders: een minuut.
    var minuten = limiet ? 6 * 60 : (storing ? 15 : 1);
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after(minuten * 60 * 1000).create();
  } else {
    // Klaar: nu de beschrijvingen die nog ontbreken (zie Beschrijvingen.js).
    verwijderTriggers('vulBeschrijvingenAan');
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after(60 * 1000).create();
  }
  if (aangevuld) leegCache();
  var echteLimiet = !fout || /quota|limit/i.test(fout);
  var reden = !limiet ? '' : (echteLimiet ? ' (daglimiet van Google bereikt)' : ' (Google weigert)');
  logboek('menu', 'vulAanUitGoogleBooks', verwerkt + ' opgevraagd, ' + gekend + ' gekend bij Google, ' + aangevuld + ' covers gevonden, ' + rest + ' te gaan' + reden + (fout ? '. Google meldt: ' + fout : '') + (sleutel ? '' : '. Er staat geen google_books_api_key in Instellingen.'));
  var tekst = verwerkt + ' boeken opgevraagd bij Google Books, ' + aangevuld + ' covers gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt. Het script zoekt nu nog ontbrekende beschrijvingen.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Menu: vult de Catalogus aan uit Open Library, in porties. */
function vulAanUitOpenLibrary() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, aangevuld = 0, rest = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftOpenLibraryNodig);
    for (var i = 0; i < teDoen.length; i += OL_PORTIE) {
      if (Date.now() - start > OL_MAX_LOOPTIJD_MS) break;
      var portie = teDoen.slice(i, i + OL_PORTIE);
      var sleutels = portie.map(function (b) { return 'ISBN:' + b.isbn; }).join(',');
      var url = 'https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=' + encodeURIComponent(sleutels);
      var antwoord = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'ProjectMadrigal-catalogus (Google Apps Script; queer bibliotheek Antwerpen)' }
      });
      if (antwoord.getResponseCode() === 429 || antwoord.getResponseCode() >= 500) {
        // Open Library vraagt om trager te gaan of heeft een storing: later verder.
        break;
      }
      var data = {};
      try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = {}; }
      portie.forEach(function (boek) {
        var gevonden = data['ISBN:' + boek.isbn];
        var velden = verwerkOpenLibrary(boek, gevonden ? gevonden.details : null);
        if (Object.keys(velden).length) aangevuld++;
        velden.ol_gecontroleerd = vandaag;
        wijzig(boek, velden);
        verwerkt++;
      });
      // Na elke portie bewaren: zo gaat er niets verloren als het script stopt.
      bewaarTabel(tabel);
      Utilities.sleep(OL_PAUZE_MS);
    }
    rest = tabel.rijen.filter(heeftOpenLibraryNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulAanUitOpenLibrary');
  if (rest > 0) {
    ScriptApp.newTrigger('vulAanUitOpenLibrary').timeBased().after(60 * 1000).create();
  } else {
    leegCache();
    // Klaar: Google Books zoekt nog covers voor de boeken waar Open Library er geen had.
    verwijderTriggers('vulAanUitGoogleBooks');
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after(60 * 1000).create();
  }
  logboek('menu', 'vulAanUitOpenLibrary', verwerkt + ' opgevraagd, ' + aangevuld + ' aangevuld, ' + rest + ' te gaan');
  var tekst = verwerkt + ' boeken opgevraagd bij Open Library, ' + aangevuld + ' aangevuld.';
  tekst += rest > 0 ? ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.' : ' Alles is verwerkt. Google Books zoekt nu nog ontbrekende covers.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Menu: zoekt beschrijvingen voor boeken waar die nog ontbreekt, in porties. */
function vulBeschrijvingenAan() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, gevonden = 0, rest = 0, limiet = false, gbLimiet = false, gbFout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_gezocht') === -1) {
      meld('De kolom beschrijving_gezocht ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var sleutel = leesInstellingen().google_books_api_key;
    var vandaag = vandaagTekst();
    // Eerst de boeken die nog nergens opgezocht zijn, dan die enkel Google nog nodig hebben.
    var teDoen = tabel.rijen.filter(heeftBeschrijvingNodig).sort(function (a, b) { return wachtOpGoogle(a) - wachtOpGoogle(b); });
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var enkelGoogle = wachtOpGoogle(boek);
      if (enkelGoogle && gbLimiet) break; // Google weigert nog: de rest wacht
      // Zit Google aan zijn daglimiet, dan zoeken we verder bij Open Library alleen.
      var r = gbLimiet ? { tekst: '' } : beschrijvingUitGoogleBooks(boek.isbn, sleutel);
      if (r.limiet) { gbLimiet = true; limiet = true; gbFout = r.fout || ''; r = { tekst: '' }; if (enkelGoogle) break; }
      if (!r.tekst && !enkelGoogle) { Utilities.sleep(1000); r = beschrijvingUitOpenLibrary(boek.isbn); }
      if (r.limiet) break; // Open Library vraagt om te wachten
      if (r.tekst) {
        wijzig(boek, { beschrijving: r.tekst, beschrijving_gezocht: vandaag });
        gevonden++;
      } else {
        // Weigerde Google, dan noteren we dat enkel Open Library al zocht: Google volgt later.
        // Zonder streepjes: anders leest het script de cel later als een gewone datum en valt "OL" weg.
        wijzig(boek, { beschrijving_gezocht: gbLimiet ? BS_ENKEL_OL + vandaag.replace(/-/g, '') : vandaag });
      }
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(400);
    }
    bewaarTabel(tabel);
    var nog = tabel.rijen.filter(heeftBeschrijvingNodig);
    rest = nog.length;
    // Nog boeken die niemand opzocht: over een minuut verder (Open Library werkt nog).
    // Enkel nog Google nodig en Google weigert: over 6 uur.
    var nieuwTeDoen = nog.filter(function (b) { return !wachtOpGoogle(b); }).length;
    limiet = limiet && nieuwTeDoen === 0;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('vulBeschrijvingenAan');
  if (rest > 0) {
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after((limiet ? 6 * 60 : 1) * 60 * 1000).create();
  }
  if (gevonden) leegCache();
  // Nieuwe beschrijvingen gevonden? Dan vertalen (zie onderaan).
  if (gevonden) planVertaling(2);
  logboek('menu', 'vulBeschrijvingenAan', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan' + (limiet ? ' (limiet bereikt)' : '') + (gbFout ? '. Google meldt: ' + gbFout : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' beschrijvingen gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/* ---------- Vertalen ---------- */

/** Pure versie van werkOnderwerpenBij, voor de tests. */
function vulOnderwerpenAan(onderwerpRijen, catalogusRijen) {
  var tellingen = {};
  var schrijfwijzen = {};
  catalogusRijen.forEach(function (b) {
    var g = normaliseerTekst(b.genre);
    if (!g) return;
    tellingen[g] = (tellingen[g] || 0) + 1;
    schrijfwijzen[g] = schrijfwijzen[g] || {};
    var s = schoon(b.genre);
    schrijfwijzen[g][s] = (schrijfwijzen[g][s] || 0) + 1;
  });
  var bekend = {};
  onderwerpRijen.forEach(function (r) {
    var g = normaliseerTekst(r.genre);
    bekend[g] = true;
    if (Number(r.aantal_boeken) !== (tellingen[g] || 0)) wijzig(r, { aantal_boeken: tellingen[g] || 0 });
  });
  var nieuw = 0;
  Object.keys(tellingen).sort().forEach(function (g) {
    if (bekend[g]) return;
    // De meest gebruikte schrijfwijze wordt de naam in de tabel.
    var naam = Object.keys(schrijfwijzen[g]).sort(function (a, b) { return schrijfwijzen[g][b] - schrijfwijzen[g][a]; })[0];
    voegToe(onderwerpRijen, { genre: naam, filtergroepen: stelFiltergroepenVoor(g).join(', '), aantal_boeken: tellingen[g] });
    nieuw++;
  });
  return nieuw;
}

/** Zocht enkel Open Library al, en moet Google dit boek nog opzoeken? */
function wachtOpGoogle(boek) {
  return String(boek.beschrijving_gezocht || '').indexOf(BS_ENKEL_OL) === 0;
}

/** De maandag van de week van een datum ("JJJJ-MM-DD"). Zo wisselen de aanraders elke week. */
function weekBegin(datum) {
  var terug = (weekdag(datum) + 6) % 7; // maandag 0, zondag 6
  return telDagenOp(datum, -terug);
}

/** Weekdag als getal: 0 = zondag, 5 = vrijdag. */
function weekdag(datum) {
  return naarUtc(datum).getUTCDay();
}

/** Weekdagen als tekst naar het getal van de weekdag (0 = zondag). */
function weekdagNummers(waarde) {
  return splitsLijst(waarde).map(function (w) {
    return WEEKDAGEN.indexOf(normaliseerTekst(w));
  }).filter(function (n) { return n > -1; });
}

/**
 * Zet elk genre uit de Catalogus in de vertaaltabel Onderwerpen, met een voorstel
 * voor de filtergroep. Bestaande regels blijven ongemoeid, het aantal boeken wordt bijgewerkt.
 * Geeft het aantal nieuwe genres terug.
 */
function werkOnderwerpenBij() {
  var catalogus = leesTabel('Catalogus');
  var tabel = leesTabel('Onderwerpen');
  var resultaat = vulOnderwerpenAan(tabel.rijen, catalogus.rijen);
  bewaarTabel(tabel);
  return resultaat;
}

function werkOnderwerpenBijMenu() {
  var nieuw = werkOnderwerpenBij();
  leegCache();
  meld(nieuw + ' nieuwe genres toegevoegd aan Onderwerpen. Kijk de kolom filtergroepen na.');
}

/** Past velden van een rij aan en markeert de rij als gewijzigd. */
function wijzig(rij, velden) {
  Object.keys(velden).forEach(function (k) { rij[k] = velden[k]; });
  rij._gewijzigd = true;
  return rij;
}

/** Een veilige link naar een artikel van Wikipedia, of ''. */
function wikiLink(s) {
  var url = s && s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page;
  return /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(String(url || '')) ? url : '';
}

/** Is deze samenvatting van Wikipedia bruikbaar voor dit boek? (geen doorverwijspagina, auteur vermeld) */
function wikiSamenvattingOk(boek, s) {
  if (!s || s.type !== 'standard' || !s.extract || String(s.extract).length < 80) return false;
  var naam = achternaam(boek.auteur);
  if (!naam) return false;
  return normaliseerTekst(s.extract + ' ' + (s.description || '')).split(' ').indexOf(naam) > -1;
}

/** Titel van een artikel zonder "(roman)", "(boek)", ... aan het einde. */
function wikiTitelZonderUitleg(titel) {
  return String(titel || '').replace(/\s*\([^)]*\)\s*$/, '');
}

/** Een willekeurige code van 8 tekens, zonder tekens die je makkelijk verwart (0/O, 1/l). */
function willekeurigeCode() {
  var tekens = 'abcdefghjkmnpqrstuvwxyz23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += tekens.charAt(Math.floor(Math.random() * tekens.length));
  return code;
}

/** Menu: wist de aanraders die automatisch uit de stocklijst overgenomen werden. */
function wisAanradersUitStock() {
  var ss = spreadsheet();
  var bron = [];
  [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
    var blad = ss.getSheetByName(paar[0]);
    if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
  });
  if (!bron.length) {
    meld('De tabbladen Stock en Zines ontbreken. Wis de namen in de kolom aanrader van de Catalogus dan met de hand.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var tabel = leesTabel('Catalogus');
    n = wisAanradersUitStockRijen(tabel.rijen, bron, leesInstellingen());
    bewaarTabel(tabel);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  logboek('menu', 'wisAanradersUitStock', n + ' aanraders gewist');
  meld(n + ' boeken kregen een aangepaste aanrader. De namen uit aanraders_uit_stocklijst (zoals Johanna) en wat je zelf invulde, bleven staan. Een andere aanrader typ je voortaan in de kolom aanrader van de Catalogus.');
}

/**
 * Wist de aanraders die uit de stocklijst kwamen, behalve de namen uit de
 * instelling aanraders_uit_stocklijst (bv. Johanna). Een aanrader die je zelf
 * invulde of aanpaste (een andere waarde dan in de stocklijst), blijft staan.
 * catalogusRijen: rijen van de Catalogus. bron: boek-objecten uit leesBronRijen.
 * Geeft het aantal aangepaste boeken terug.
 */
function wisAanradersUitStockRijen(catalogusRijen, bron, inst) {
  var uitStock = {};
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (b.aanrader && !uitStock[s]) uitStock[s] = normaliseerTekst(b.aanrader);
  });
  var n = 0;
  catalogusRijen.forEach(function (rij) {
    if (isLeeg(rij.aanrader) || !rij.bron_sleutel) return;
    if (uitStock[rij.bron_sleutel] === normaliseerTekst(rij.aanrader)) {
      var blijft = toegelatenStockAanrader(rij.aanrader, inst);
      if (normaliseerTekst(blijft) === normaliseerTekst(rij.aanrader)) return;
      wijzig(rij, { aanrader: blijft });
      n++;
    }
  });
  return n;
}

/** Woorden van een tekst, zonder lidwoorden (tenzij er dan niets overblijft). */
function woorden(waarde) {
  var alle = normaliseerTekst(waarde).split(' ').filter(function (w) { return w; });
  var zonder = alle.filter(function (w) { return LIDWOORDEN.indexOf(w) === -1; });
  return zonder.length ? zonder : alle;
}

/** Vergelijkt twee teksten zonder hoofdletters, leestekens en spaties. */
function zelfdeTekst(a, b) {
  var kaal = function (t) { return normaliseerTekst(t).replace(/[^a-z0-9]/g, ''); };
  return kaal(a) === kaal(b);
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

function zetOudeEventsOm(rijen, basis) {
  return rijen.map(function (r) {
    var moment = eersteVeld(r, ['eventDate', 'event_date', 'date', 'start']);
    return {
      datum: oudeDatum(moment), uur: oudUur(moment),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'description', 'body', 'text', 'textNl'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'descriptionEn', 'bodyEn', 'textEn', 'text_en'])),
      locatie: schoon(eersteVeld(r, ['location', 'locatie', 'place'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

function zetOudeFaqOm(rijen) {
  return rijen.map(function (r) {
    return {
      volgorde: eersteVeld(r, ['order', 'volgorde', 'position']),
      vraag: schoon(htmlNaarTekst(eersteVeld(r, ['question', 'questionNl', 'title', 'titleNl']))),
      vraag_en: schoon(htmlNaarTekst(eersteVeld(r, ['questionEn', 'question_en', 'titleEn']))),
      antwoord: htmlNaarTekst(eersteVeld(r, ['answer', 'answerNl', 'content', 'contentNl', 'text', 'textNl'])),
      antwoord_en: htmlNaarTekst(eersteVeld(r, ['answerEn', 'answer_en', 'contentEn', 'textEn'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

/** Zet de rijen van de oude databank om naar rijen voor de nieuwe tabbladen. */
function zetOudeNieuwsOm(rijen, basis) {
  return rijen.map(function (r) {
    return {
      datum: oudeDatum(eersteVeld(r, ['date', 'publishedAt', 'published_at', 'created_at', 'createdAt'])),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'content_nl', 'body', 'text', 'textNl', 'description'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'content_en', 'bodyEn', 'textEn', 'text_en', 'descriptionEn'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover', 'picture']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
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

/** Menu: zoekt beschrijvingen bij Wikipedia, in porties. */
function zoekBeschrijvingenWikipedia() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('wiki_gezocht') === -1 || tabel.kop.indexOf('beschrijving_bron') === -1) {
      meld('De kolommen wiki_gezocht en beschrijving_bron ontbreken nog. Voer eerst Madrigal > 1. Installeer tabbladen uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftWikiNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > WIKI_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = {};
      for (var t = 0; t < WIKI_TALEN.length && !r.tekst && !r.fout; t++) r = zoekWikipedia(boek, WIKI_TALEN[t]);
      if (r.fout) { wachten = true; fout = r.fout; break; }
      var velden = { wiki_gezocht: vandaag };
      if (r.tekst) {
        velden.beschrijving = r.tekst;
        velden.beschrijving_bron = r.link;
        velden.beschrijving_vertaald = '';
        gevonden++;
      }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(WIKI_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftWikiNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekBeschrijvingenWikipedia');
  if (rest > 0) ScriptApp.newTrigger('zoekBeschrijvingenWikipedia').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) { leegCache(); planVertaling(2); }
  logboek('menu', 'zoekBeschrijvingenWikipedia', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan' + (fout ? ' (Wikipedia: ' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Wikipedia, ' + gevonden + ' beschrijvingen gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/**
 * Zoekt een boek in de Catalogus op titel en auteur.
 * Geeft { zeker: boek } of { twijfel: [boeken] } of {} terug.
 */
function zoekBoekOpTitel(catalogus, titel, auteur) {
  var sleutel = titelSleutel(titel);
  var naam = achternaam(auteur);
  if (!sleutel) return {};
  var kandidaten = [];
  catalogus.forEach(function (b) {
    var s = titelSleutel(b.titel);
    if (!s) return;
    var gelijk = gelijkenis(s, sleutel);
    var bevat = (s.length >= 5 && sleutel.indexOf(s) > -1) || (sleutel.length >= 5 && s.indexOf(sleutel) > -1);
    if (gelijk < 0.8 && !bevat) return;
    var auteurOk = !naam || levenshtein(achternaam(b.auteur), naam) <= 1;
    kandidaten.push({ boek: b, score: gelijk, auteurOk: auteurOk });
  });
  var zeker = kandidaten.filter(function (k) { return k.score >= 0.95 && k.auteurOk; });
  if (zeker.length === 1) return { zeker: zeker[0].boek };
  if (!kandidaten.length) return {};
  kandidaten.sort(function (a, b) { return b.score - a.score; });
  return { twijfel: kandidaten.slice(0, 3).map(function (k) { return k.boek; }) };
}

/** Menu: zoekt covers van andere uitgaven bij Open Library, in porties. */
function zoekCoversAndereUitgaven() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.');
    return;
  }
  var verwerkt = 0, gevonden = 0, rest = 0, limiet = false, code = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('cover_gezocht') === -1 || tabel.kop.indexOf('cover_bron') === -1) {
      meld('De kolommen cover_gezocht en cover_bron ontbreken nog. Voer eerst Madrigal > 1. Installeer tabbladen uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftAndereUitgaveNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CV_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var cover = 0, bron = '';
      if (/^\d{13}$/.test(String(boek.isbn || ''))) {
        var opIsbn = olZoek('isbn=' + boek.isbn);
        if (opIsbn.limiet) { limiet = true; code = opIsbn.code; break; }
        if (opIsbn.docs.length && opIsbn.docs[0].cover_i) { cover = opIsbn.docs[0].cover_i; bron = CV_ANDERE_UITGAVE; }
        Utilities.sleep(CV_PAUZE_MS);
      }
      if (!cover && !isLeeg(boek.titel)) {
        var vraag = 'title=' + encodeURIComponent(titelSleutel(boek.titel)) + (achternaam(boek.auteur) ? '&author=' + encodeURIComponent(achternaam(boek.auteur)) : '');
        var opTitel = olZoek(vraag);
        if (opTitel.limiet) { limiet = true; code = opTitel.code; break; }
        cover = kiesOlWerk(boek, opTitel.docs);
        if (cover) bron = CV_TITEL_AUTEUR;
        Utilities.sleep(CV_PAUZE_MS);
      }
      var velden = { cover_gezocht: vandaag };
      if (cover) { velden.cover_url = olCoverUrl(cover); velden.cover_bron = bron; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftAndereUitgaveNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekCoversAndereUitgaven');
  if (rest > 0) ScriptApp.newTrigger('zoekCoversAndereUitgaven').timeBased().after((limiet ? 30 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversAndereUitgaven', verwerkt + ' opgezocht, ' + gevonden + ' covers van andere uitgaven gevonden, ' + rest + ' te gaan' + (limiet ? ' (Open Library weigert, code ' + code + ': vanuit Apps Script gaat het traag. Sneller: Bestuursscherm > Boeken > Zoek ontbrekende covers)' : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' covers gevonden.';
  tekst += rest > 0 ? ' Nog ' + rest + ' te gaan: het script gaat vanzelf verder.' : ' Alles is verwerkt. Kijk de covers met cover_bron "' + CV_TITEL_AUTEUR + '" even na.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/* ---------- Internet Archive ---------- */

/*
 * Internet Archive (archive.org) heeft miljoenen ingescande boeken, ook oudere en tweedehands
 * uitgaven. We zoeken op ISBN (13 en 10 cijfers) en nemen de afbeelding van het gevonden boek:
 * meestal een scan of foto van de voorkant. Elk opgezocht boek krijgt een datum in ia_gezocht.
 */

/** Menu: zoekt covers bij bol.com, in porties. */
function zoekCoversBol() {
  var start = Date.now();
  var inst = leesInstellingen();
  var t = bolToken(inst);
  if (t.fout) { logboek('menu', 'zoekCoversBol', t.fout); meld(t.fout); return; }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('bol_gezocht') === -1) { meld('De kolom bol_gezocht ontbreekt nog. Voer eerst Madrigal > 1. Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftBolNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BOL_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = bolVraag('/products/' + boek.isbn + '/media', t.token);
      if (r.code === 401) { t = bolToken(inst); if (t.fout) { fout = t.fout; break; } r = bolVraag('/products/' + boek.isbn + '/media', t.token); }
      if (r.code === 429 || r.code >= 500) { wachten = true; fout = 'code ' + r.code; break; }
      if (r.code >= 400 && r.code !== 404) { fout = 'code ' + r.code + (r.data && r.data.title ? ': ' + r.data.title : ''); break; }
      var url = r.code === 200 ? bolAfbeelding(r.data) : '';
      var velden = { bol_gezocht: vandaag };
      if (url) { velden.cover_url = url; velden.cover_bron = 'bol.com'; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 25 === 0) bewaarTabel(tabel);
      Utilities.sleep(BOL_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftBolNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekCoversBol');
  if (rest > 0 && (!fout || wachten)) ScriptApp.newTrigger('zoekCoversBol').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversBol', verwerkt + ' opgezocht, ' + gevonden + ' covers gevonden, ' + rest + ' te gaan' + (fout ? '. bol.com meldt: ' + fout : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij bol.com, ' + gevonden + ' covers gevonden.' + (fout ? ' bol.com meldt: ' + fout : ''), 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/** Menu: zoekt covers bij Internet Archive, in porties. */
function zoekCoversInternetArchive() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('ia_gezocht') === -1) { meld('De kolom ia_gezocht ontbreekt nog. Voer eerst Madrigal > 1. Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftIaNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CV_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = haalJson(iaZoekUrl(boek.isbn));
      if (r.code === 429 || r.code >= 500 || !r.data) { wachten = true; fout = 'code ' + r.code; break; }
      var url = iaCoverUitAntwoord(r.data);
      // Heeft het boek bij Internet Archive geen afbeelding, dan toont die het eigen logo: dat nemen we niet.
      if (url && !iaCoverIsEcht(url)) url = '';
      var velden = { ia_gezocht: vandaag };
      if (url) { velden.cover_url = url; velden.cover_bron = IA_BRON; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 25 === 0) bewaarTabel(tabel);
      Utilities.sleep(CV_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftIaNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekCoversInternetArchive');
  if (rest > 0) ScriptApp.newTrigger('zoekCoversInternetArchive').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversInternetArchive', verwerkt + ' opgezocht, ' + gevonden + ' covers gevonden, ' + rest + ' te gaan' + (fout ? ' (Internet Archive: ' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Internet Archive, ' + gevonden + ' covers gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/** Menu: boeken zonder cover nog eens laten opzoeken bij Google (maakt gb_gecontroleerd leeg). */
function zoekCoversOpnieuw() {
  var tabel = leesTabel('Catalogus');
  var n = 0;
  tabel.rijen.forEach(function (b) {
    if ((isLeeg(b.cover_url) || isLeeg(b.beschrijving)) && !isLeeg(b.gb_gecontroleerd) && /^\d{13}$/.test(String(b.isbn || ''))) {
      wijzig(b, { gb_gecontroleerd: '' });
      n++;
    }
  });
  bewaarTabel(tabel);
  logboek('menu', 'zoekCoversOpnieuw', n + ' boeken zonder cover of beschrijving komen opnieuw aan de beurt bij Google');
  meld(n + ' boeken zonder cover of beschrijving komen opnieuw aan de beurt bij Google. Gebruik daarna de knop in het bestuursscherm: Boeken > Zoek ontbrekende covers en beschrijvingen.');
}

/** Zoekt een boek op bij Wikipedia in één taal. Geeft { tekst, link }, {} of { fout }. */
function zoekWikipedia(boek, taal) {
  var basis = 'https://' + taal + '.wikipedia.org';
  var vraag = titelSleutel(boek.titel) + ' ' + achternaam(boek.auteur);
  var z = haalJson(basis + '/w/api.php?action=query&list=search&srlimit=5&srprop=&format=json&srsearch=' + encodeURIComponent(vraag));
  if (z.code === 429 || z.code >= 500) return { fout: 'code ' + z.code };
  var titels = ((z.data && z.data.query && z.data.query.search) || []).map(function (r) { return r.title; });
  var kandidaten = kiesWikiTitels(boek, titels);
  for (var i = 0; i < kandidaten.length && i < 3; i++) {
    Utilities.sleep(WIKI_PAUZE_MS);
    var s = haalJson(basis + '/api/rest_v1/page/summary/' + encodeURIComponent(kandidaten[i].replace(/ /g, '_')));
    if (s.code === 429 || s.code >= 500) return { fout: 'code ' + s.code };
    if (wikiSamenvattingOk(boek, s.data) && wikiLink(s.data)) {
      return { tekst: maakBeschrijvingNetjes(s.data.extract), link: wikiLink(s.data) };
    }
  }
  return {};
}
