/**
 * i18n.js
 * Teksten van de website in het Nederlands en het Engels.
 *
 * Zo werkt het:
 *   - In HTML: <span data-i18n="menuBoeken">Boeken</span> krijgt de vertaalde tekst.
 *     Ook: data-i18n-placeholder, data-i18n-aria-label en data-i18n-title.
 *   - Langere stukken (zoals de pagina Over ons) staan twee keer in de HTML:
 *     <div data-taal="nl" lang="nl">...</div> en <div data-taal="en" lang="en">...</div>.
 *     De stijl toont enkel het blok van de gekozen taal.
 *   - In JavaScript: MadrigalTaal.t('menuBoeken').
 *
 * Een tekst toevoegen? Zet de sleutel in beide talen hieronder.
 * Het uitleenscherm en het bestuursscherm blijven enkel Nederlands.
 */
(function (root) {
  'use strict';

  var TEKSTEN = {
    nl: {
      overslaan: 'Ga naar de inhoud',
      menuHome: 'Home', menuBoeken: 'Boeken', menuOver: 'Over ons', menuDoeMee: 'Doe mee', menuLeeslijsten: 'Leeslijsten', menuPeperfabriek: 'Peperfabriek', menu: 'Menu',
      bcWanneer: 'De bookclub komt {regel} samen in de bib{uur}.', bcOm: ', om {uur}', bcVolgende: 'Volgende keren: {datums}.', bcInstagram: 'Programma en activiteiten op Instagram',
      pfTitel: 'De Peperfabriek', pfProgramma: 'Programma', pfTot: 'tot', pfMeerInfo: 'Meer info bij De Peperfabriek',
      pfLeeg: 'Het programma van De Peperfabriek verschijnt hier binnenkort. Bekijk intussen hun website.', pfVolledig: 'Bekijk het volledige programma',
      pfStandaard: 'De bib van Project Madrigal vind je in De Peperfabriek. Dit staat er de komende weken nog op het programma.',
      doeMeeTitel: 'Doe mee', doeMeeIntro: 'Project Madrigal draait volledig op vrijwilligers en op boeken die mensen ons toevertrouwen. Zo kan jij helpen.',
      dmVrijwilliger: 'Word vrijwilliger', dmSchenken: 'Schenk boeken', dmSteunen: 'Steun ons',
      dmLeeg: 'Wil je meehelpen, boeken schenken of ons steunen? Stuur ons een mailtje, we horen graag van je.', dmMail: 'Mail ons',
      taalKnop: 'EN', taalLabel: 'Switch to English',
      donkerAan: 'Donkere modus aanzetten', donkerUit: 'Lichte modus aanzetten',
      ikBen: 'Ik ben',
      heroWoorden: ['queer', 'gay', 'lesbisch', 'bi', 'non-binair', 'transgender', 'agender', 'interseks', 'ace', 'twijfelend', 'out of spoons', 'welkom'],
      zoekPlaatshouder: 'Zoek op titel, auteur, isbn...',
      zoekLabel: 'Zoek een boek',
      zoekKnop: 'Zoeken',
      nieuws: 'Nieuws', geenNieuws: 'Er is nog geen nieuws.',
      agenda: 'Agenda', volgendEvent: 'Volgend event', vorigEvent: 'Vorig event', geenEvents: 'Er staan geen events gepland.',
      meerInfo: 'Meer info',
      alleAanradersVan: 'Bekijk alle aanraders van {naam}', alleNieuwe: 'Bekijk alle boeken, laatst toegevoegd eerst', inMijnAgenda: 'Zet in mijn agenda',
      aanraders: 'In de kijker', aanraderVan: 'Aanrader van {naam}', aanradersVan: 'Aanraders van {naam}', uitgelicht: 'Uitgelicht', nieuwBinnen: 'Nieuw binnen',
      reserveer: 'Reserveer dit boek', reserveerTitel: 'Dit boek reserveren',
      reserveerUitleg: 'Laat je voornaam en een telefoonnummer of e-mailadres achter. Het bestuur neemt contact met je op om af te spreken wanneer je het boek kan ophalen. De borg betaal je bij het ophalen.',
      reserveerVoornaam: 'Je voornaam', reserveerContact: 'Telefoonnummer of e-mailadres', reserveerOpmerking: 'Opmerking (mag leeg)',
      reserveerToestemming: 'Ik geef toestemming om mijn voornaam en contactgegevens te bewaren voor deze aanvraag. Meer uitleg:',
      reserveerVerstuur: 'Verstuur je aanvraag',
      reserveerGelukt: 'Je aanvraag is verstuurd. Het bestuur neemt contact met je op om af te spreken wanneer je het boek kan ophalen.',
      privacyStatistiek: 'Deze website telt bezoeken met GoatCounter, zonder cookies en zonder persoonsgegevens. We zien enkel hoeveel keer een pagina of boek bekeken werd, nooit wie of wat je zocht. Staat "niet volgen" aan in je browser, dan tellen we je niet.',
      bronWikipedia: 'Bron:', bronVertaald: ', eventueel vertaald',
      gevoelig: 'Gevoelige inhoud', gevoeligUitleg: 'Dit boek behandelt thema’s die zwaar kunnen binnenkomen. Twijfel je? Vraag het gerust in de bib.',
      faq: 'Veelgestelde vragen',
      komLangs: 'Kom eens langs', openingsuren: 'Openingsuren', contact: 'Contact', adres: 'Adres',
      voorbeeldSite: 'Je ziet verzonnen voorbeeldinhoud. Het echte nieuws verschijnt zodra de web-app gekoppeld is.',
      algemeen: 'Algemeen', events: 'Events',
      kaartTitel: 'Kaart met de locatie van Project Madrigal',
      voetTekst: 'Project Madrigal is een queer bibliotheek in Antwerpen, gedragen door vrijwilligers.',
      privacy: 'Privacy', vrijwilligers: 'Voor vrijwilligers', instagramLabel: 'Project Madrigal op Instagram',
      laden: 'Even laden...',
      // Catalogus
      catalogusTitel: 'Boeken', catalogusLead: 'Blader door onze collectie van maar liefst {aantal} boeken!',
      hoeLenen: 'Hoe werkt lenen?', privacyLink: 'Wat doen we met je gegevens?',
      zoekHulp: 'Tikfouten zijn geen probleem.',
      filters: 'Filters', filtersActief: '({n} actief)', alle: 'Alle',
      enkelBeschikbaar: 'Toon enkel boeken die nu beschikbaar zijn',
      wisFilters: 'Wis alle filters',
      sorteerOp: 'Sorteer op', sortRelevantie: 'Beste overeenkomst, anders titel', sortTitel: 'Titel', sortAuteur: 'Auteur', sortToegevoegd: 'Laatst toegevoegd',
      sortJaarNieuw: 'Jaartal, nieuwste eerst', sortJaarOud: 'Jaartal, oudste eerst',
      gevonden0: 'Geen boeken gevonden. Probeer een ander woord of wis de filters.',
      gevonden1: '1 boek gevonden', gevondenN: '{n} boeken gevonden', paginaVan: ', pagina {nu} van {totaal}',
      paginas: 'Pagina\'s', paginaNr: 'Pagina {nr}', vorige: 'Vorige', volgende: 'Volgende',
      ladenFout: 'De catalogus kon niet laden. Kijk of je internet hebt en vernieuw de pagina.',
      voorbeeld: 'Je ziet verzonnen voorbeeldboeken. De echte catalogus verschijnt zodra de web-app gekoppeld is.',
      terugCatalogus: '← Terug naar de catalogus',
      nietGevonden: 'Dit boek vonden we niet', nietGevondenTekst: 'Misschien is het uit de catalogus gehaald. Zoek in de catalogus naar een ander boek.',
      leeslijst: 'Leeslijst', leeslijsten: 'Leeslijsten', alleLeeslijsten: '← Alle leeslijsten', bekijkLeeslijsten: 'Bekijk onze leeslijsten',
      leeslijstenIntro: 'Boeken rond een thema, samengesteld door de vrijwilligers van Project Madrigal.', geenLeeslijsten: 'Er zijn nog geen leeslijsten.',
      deelLijst: 'Deel deze lijst', lijstAantal1: '1 boek', lijstAantalN: '{n} boeken', leesOok: 'Lees ook', fLeeslijst: 'Leeslijst',
      deelBoek: 'Deel dit boek', linkGekopieerd: 'De link is gekopieerd.', kopieerLink: 'Kopieer deze link: {url}',
      onderwerpen: 'Onderwerpen', coverVan: 'Cover van {titel}',
      vJaartal: 'Jaartal', vTaal: 'Taal', vUitgeverij: 'Uitgeverij', vPaginas: "Pagina's", vUitvoering: 'Uitvoering', vStaat: 'Staat', vIsbn: 'ISBN', vSoort: 'Soort',
      nieuw: 'Nieuw', tweedehands: 'Tweedehands', zine: 'Zine',
      uitlegBeschikbaar: 'Kom langs in de bib om dit boek te lenen.',
      uitlegUitgeleend: 'Vraag in de bib om het te reserveren. Je krijgt het als eerste in de wachtrij zodra het terug is.',
      uitlegGereserveerd: 'Iemand wacht al op dit boek. Je kan in de bib ook in de wachtrij staan.',
      stBeschikbaar: 'Beschikbaar', stVanBeschikbaar: '{v} van {t} beschikbaar',
      stUitgeleend: 'Uitgeleend', stUitgeleendTot: 'Uitgeleend, verwacht terug op {datum}',
      stGereserveerd: 'Gereserveerd', stNietUitleenbaar: 'Niet uitleenbaar', stTeKoop: 'Te koop in de bib, niet uitleenbaar',
      labels: 'Labels',
      fOnderwerp: 'Onderwerp', fTaal: 'Taal', fStaat: 'Nieuw of tweedehands', fUitvoering: 'Uitvoering', fPeriode: 'Periode van uitgave', fAanrader: 'Aanrader',
      overTitel: 'Over Project Madrigal'
    },
    en: {
      overslaan: 'Skip to content',
      menuHome: 'Home', menuBoeken: 'Books', menuOver: 'About us', menuDoeMee: 'Get involved', menuLeeslijsten: 'Reading lists', menuPeperfabriek: 'Peperfabriek', menu: 'Menu',
      bcWanneer: 'The bookclub meets {regel} in the library{uur}.', bcOm: ', at {uur}', bcVolgende: 'Next meetings: {datums}.', bcInstagram: 'Programme and activities on Instagram',
      pfTitel: 'De Peperfabriek', pfProgramma: 'Programme', pfTot: 'until', pfMeerInfo: 'More info at De Peperfabriek',
      pfLeeg: 'The programme of De Peperfabriek will appear here soon. In the meantime, have a look at their website.', pfVolledig: 'See the full programme',
      pfStandaard: 'You will find the Project Madrigal library in De Peperfabriek. This is what is coming up there.',
      doeMeeTitel: 'Get involved', doeMeeIntro: 'Project Madrigal runs entirely on volunteers and on books people entrust to us. This is how you can help.',
      dmVrijwilliger: 'Become a volunteer', dmSchenken: 'Donate books', dmSteunen: 'Support us',
      dmLeeg: 'Want to help out, donate books or support us? Send us an email, we would love to hear from you.', dmMail: 'Email us',
      taalKnop: 'NL', taalLabel: 'Schakel naar Nederlands',
      donkerAan: 'Turn on dark mode', donkerUit: 'Turn on light mode',
      ikBen: 'I am',
      heroWoorden: ['queer', 'gay', 'lesbian', 'bi', 'non-binary', 'transgender', 'agender', 'intersex', 'ace', 'questioning', 'out of spoons', 'welcome'],
      zoekPlaatshouder: 'Search by title, author, isbn...',
      zoekLabel: 'Find a book',
      zoekKnop: 'Search',
      nieuws: 'News', geenNieuws: 'No news yet.',
      agenda: 'Events', volgendEvent: 'Next event', vorigEvent: 'Previous event', geenEvents: 'No events planned.',
      meerInfo: 'More info',
      alleAanradersVan: 'See all recommendations by {naam}', alleNieuwe: 'See all books, most recently added first', inMijnAgenda: 'Add to my calendar',
      aanraders: 'In the spotlight', aanraderVan: 'Recommended by {naam}', aanradersVan: 'Recommended by {naam}', uitgelicht: 'Featured', nieuwBinnen: 'Just in',
      reserveer: 'Reserve this book', reserveerTitel: 'Reserve this book',
      reserveerUitleg: 'Leave your first name and a phone number or email address. The board will contact you to arrange when you can pick up the book. You pay the deposit when you pick it up.',
      reserveerVoornaam: 'Your first name', reserveerContact: 'Phone number or email address', reserveerOpmerking: 'Note (optional)',
      reserveerToestemming: 'I agree that my first name and contact details are kept for this request. More information:',
      reserveerVerstuur: 'Send your request',
      reserveerGelukt: 'Your request has been sent. The board will contact you to arrange when you can pick up the book.',
      privacyStatistiek: 'This website counts visits with GoatCounter, without cookies and without personal data. We only see how often a page or book was viewed, never who you are or what you searched for. If "do not track" is on in your browser, we do not count you.',
      bronWikipedia: 'Source:', bronVertaald: '',
      gevoelig: 'Sensitive content', gevoeligUitleg: 'This book deals with themes that can hit hard. Not sure? Feel free to ask at the library.',
      faq: 'Frequently asked questions',
      komLangs: 'Come and visit', openingsuren: 'Opening hours', contact: 'Contact', adres: 'Address',
      voorbeeldSite: 'You are looking at made-up example content. The real news appears once the web app is connected.',
      algemeen: 'General', events: 'Events',
      kaartTitel: 'Map with the location of Project Madrigal',
      voetTekst: 'Project Madrigal is a queer library in Antwerp, run by volunteers.',
      privacy: 'Privacy', vrijwilligers: 'For volunteers', instagramLabel: 'Project Madrigal on Instagram',
      laden: 'Loading...',
      catalogusTitel: 'Books', catalogusLead: 'Browse our collection of no less than {aantal} books!',
      hoeLenen: 'How does borrowing work?', privacyLink: 'What do we do with your data?',
      zoekHulp: 'Typos are no problem.',
      filters: 'Filters', filtersActief: '({n} active)', alle: 'All',
      enkelBeschikbaar: 'Only show books that are available now',
      wisFilters: 'Clear all filters',
      sorteerOp: 'Sort by', sortRelevantie: 'Best match, otherwise title', sortTitel: 'Title', sortAuteur: 'Author', sortToegevoegd: 'Most recently added',
      sortJaarNieuw: 'Year, newest first', sortJaarOud: 'Year, oldest first',
      gevonden0: 'No books found. Try another word or clear the filters.',
      gevonden1: '1 book found', gevondenN: '{n} books found', paginaVan: ', page {nu} of {totaal}',
      paginas: 'Pages', paginaNr: 'Page {nr}', vorige: 'Previous', volgende: 'Next',
      ladenFout: 'The catalogue could not load. Check your internet connection and refresh the page.',
      voorbeeld: 'You are looking at made-up example books. The real catalogue appears once the web app is connected.',
      terugCatalogus: '← Back to the catalogue',
      nietGevonden: 'We could not find this book', nietGevondenTekst: 'It may have been removed from the catalogue. Search the catalogue for another book.',
      leeslijst: 'Reading list', leeslijsten: 'Reading lists', alleLeeslijsten: '← All reading lists', bekijkLeeslijsten: 'See our reading lists',
      leeslijstenIntro: 'Books around a theme, put together by the volunteers of Project Madrigal.', geenLeeslijsten: 'There are no reading lists yet.',
      deelLijst: 'Share this list', lijstAantal1: '1 book', lijstAantalN: '{n} books', leesOok: 'You might also like', fLeeslijst: 'Reading list',
      deelBoek: 'Share this book', linkGekopieerd: 'The link has been copied.', kopieerLink: 'Copy this link: {url}',
      onderwerpen: 'Topics', coverVan: 'Cover of {titel}',
      vJaartal: 'Year', vTaal: 'Language', vUitgeverij: 'Publisher', vPaginas: 'Pages', vUitvoering: 'Format', vStaat: 'Condition', vIsbn: 'ISBN', vSoort: 'Type',
      nieuw: 'New', tweedehands: 'Second-hand', zine: 'Zine',
      uitlegBeschikbaar: 'Come by the library to borrow this book.',
      uitlegUitgeleend: 'Ask at the library to reserve it. You will be first in line as soon as it is back.',
      uitlegGereserveerd: 'Someone is already waiting for this book. You can also join the queue at the library.',
      stBeschikbaar: 'Available', stVanBeschikbaar: '{v} of {t} available',
      stUitgeleend: 'On loan', stUitgeleendTot: 'On loan, expected back on {datum}',
      stGereserveerd: 'Reserved', stNietUitleenbaar: 'Not for loan', stTeKoop: 'For sale at the library, not for loan',
      labels: 'Labels',
      fOnderwerp: 'Topic', fTaal: 'Language', fStaat: 'New or second-hand', fUitvoering: 'Format', fPeriode: 'Publication period', fAanrader: 'Recommendation',
      overTitel: 'About Project Madrigal'
    }
  };

  /** Vertalingen van waarden uit de catalogus (filtergroepen, talen, ...). */
  var WAARDEN_EN = {
    'Gender': 'Gender', 'Seksualiteit': 'Sexuality', 'Feminisme': 'Feminism', 'Fictie': 'Fiction',
    'Klassiekers': 'Classics', 'Geschiedenis en maatschappij': 'History and society', 'Biografie': 'Biography',
    'Poëzie': 'Poetry', 'Graphic novel': 'Graphic novel', 'Young adult': 'Young adult', 'Pulp': 'Pulp',
    'Erotica en BDSM': 'Erotica and BDSM', 'Zines': 'Zines', 'Kunst en fotografie': 'Art and photography', 'Gezondheid': 'Health',
    'Nederlands': 'Dutch', 'Engels': 'English', 'Frans': 'French', 'Duits': 'German', 'Spaans': 'Spanish', 'Italiaans': 'Italian', 'Portugees': 'Portuguese',
    'Nieuw': 'New', 'Tweedehands': 'Second-hand', 'Hardcover': 'Hardcover', 'Paperback': 'Paperback', 'Pocket': 'Pocket',
    'Voor 1970': 'Before 1970', '1970 tot 1989': '1970 to 1989', '1990 tot 1999': '1990 to 1999',
    '2000 tot 2009': '2000 to 2009', '2010 tot 2019': '2010 to 2019', '2020 en later': '2020 and later'
  };

  var DAGEN = { nl: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
  var MAANDEN = {
    nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };

  var SLEUTEL = 'madrigal_taal';

  function bewaard() {
    try { return root.localStorage.getItem(SLEUTEL); } catch (e) { return null; }
  }

  /** Startwaarde: bewaard, anders die van de browser (Nederlands als standaard). */
  var huidige = (function () {
    var t = bewaard();
    if (t === 'nl' || t === 'en') return t;
    var nav = (root.navigator && (root.navigator.language || '')).toLowerCase();
    return nav.indexOf('en') === 0 ? 'en' : 'nl';
  })();

  /** De gekozen taal: 'nl' of 'en'. */
  function taal() {
    return huidige;
  }

  /** Vertaalt een sleutel en vult {waarden} in. */
  function t(sleutel, waarden) {
    var tekst = TEKSTEN[taal()][sleutel];
    if (tekst === undefined) tekst = TEKSTEN.nl[sleutel];
    if (tekst === undefined) return sleutel;
    if (typeof tekst !== 'string') return tekst;
    return tekst.replace(/\{(\w+)\}/g, function (m, k) { return waarden && waarden[k] !== undefined ? waarden[k] : m; });
  }

  /** Vertaalt een waarde uit de catalogus (enkel naar het Engels). */
  function waarde(w) {
    if (taal() !== 'en' || !w) return w;
    var m = String(w).match(/^Aanrader van (.+)$/);
    if (m) return t('aanraderVan', { naam: m[1] });
    return WAARDEN_EN[w] || w;
  }

  /** "2026-11-20" naar "vrijdag 20 november" of "Friday 20 November". */
  function datum(iso, metJaar) {
    if (!iso) return '';
    var d = String(iso).slice(0, 10).split('-');
    var dt = new Date(Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])));
    var tl = taal();
    var tekst = DAGEN[tl][dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + MAANDEN[tl][dt.getUTCMonth()];
    if (metJaar || Number(d[0]) !== new Date().getFullYear()) tekst += ' ' + d[0];
    return tekst;
  }

  /** Past alle data-i18n-attributen toe binnen een element. */
  function toepassen(el) {
    var r = el || document;
    r.querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = t(e.getAttribute('data-i18n')); });
    ['placeholder', 'aria-label', 'title'].forEach(function (attr) {
      r.querySelectorAll('[data-i18n-' + attr + ']').forEach(function (e) { e.setAttribute(attr, t(e.getAttribute('data-i18n-' + attr))); });
    });
  }

  /** Kiest een andere taal en laat de pagina dat weten. */
  function kies(nieuw) {
    huidige = nieuw === 'en' ? 'en' : 'nl';
    try { root.localStorage.setItem(SLEUTEL, nieuw); } catch (e) { /* geen opslag: enkel voor deze pagina */ }
    document.documentElement.lang = huidige;
    toepassen();
    document.dispatchEvent(new CustomEvent('taalgewijzigd', { detail: huidige }));
  }

  document.documentElement.lang = taal();
  root.MadrigalTaal = { t: t, taal: taal, kies: kies, toepassen: toepassen, waarde: waarde, datum: datum };
})(window);
