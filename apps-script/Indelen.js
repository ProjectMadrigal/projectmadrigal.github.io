/**
 * Indelen.js
 * Deelt de boeken in op hun titel en beschrijving: thema's (extra_onderwerpen), categorieën en trefwoorden.
 *
 *   - Het script voegt enkel toe, het haalt nooit iets weg. Opnieuw uitvoeren maakt niets dubbel.
 *   - Categorieën en trefwoorden komen uit het tabblad Categorieën en trefwoorden (soort categorie of trefwoord).
 *     Een naam telt als hij in de tekst staat, of een van zijn zoekwoorden (kolom zoekwoorden in dat tabblad,
 *     of de ingebouwde lijst INDELEN_ZOEKWOORDEN hieronder).
 *   - Eén treffer in de titel of de beschrijving is genoeg, voor een categorie ("deze roman") en een trefwoord.
 *     Zet een naam die te vaak raak is (Queer, LGBTQIA+) op weg in het tabblad.
 *   - Thema's: zie ONDERWERP_TEKST_WOORDEN (OnderwerpRaden.js). Elk thema dat minstens ONDERWERP_ZEKER_MIN keer
 *     voorkomt, komt erbij.
 *   - Wat erbij kwam, staat daarna in het tabblad Indeling.
 */

var INDELEN_MIN_CATEGORIE = 1;
var INDELEN_MIN_TREFWOORD = 1;      // één treffer is genoeg: een beschrijving noemt een onderwerp vaak maar één keer
var INDELEN_MIN_TREFWOORD_FILM = 1;
// Thema's die bij een film geen trefwoord worden: dat zijn eigenlijk soorten boeken.
var INDELEN_GEEN_FILMTREFWOORD = ['Fictie', 'Klassiekers', 'Zines', 'Pulp', 'Young Adult', 'Graphic novel', 'Poëzie', 'Biografie', 'Onderzoek', 'Kunst en Fotoboek'];

/*
 * Ingebouwde zoekwoorden per naam (de sleutel is genreSleutel van de naam). Een woord telt als een woord in de
 * tekst ermee begint (lesbi telt voor lesbisch en lesbienne). Met = vooraan: enkel precies dat woord.
 * Met een spatie: twee woorden na elkaar. Een eigen kolom zoekwoorden in het tabblad komt hier bovenop.
 */
var INDELEN_ZOEKWOORDEN = {
  'lesbisch': ['lesbi', 'lesbo', 'sapph', 'saffisch'],
  'lesbian': ['lesbi', 'lesbo', 'sapph', 'saffisch'],
  'homo': ['homoseks', 'homofiel', '=homo', '=homos', '=gay', 'gay man', 'gay men'],
  'gay': ['homoseks', 'homofiel', '=homo', '=homos', '=gay'],
  'biseksueel': ['biseks', 'bisexu', 'biseksualiteit', '=bi'],
  'bisexual': ['biseks', 'bisexu', '=bi'],
  'trans': ['transgender', 'transvrouw', 'transman', 'transitie', 'transition', '=trans'],
  'transgender': ['transgender', 'transvrouw', 'transman', 'transitie', 'transition', '=trans'],
  'non binair': ['nonbinair', 'non binair', 'nonbinary', 'non binary', 'genderqueer', 'genderfluid'],
  'non binary': ['nonbinair', 'non binair', 'nonbinary', 'non binary', 'genderqueer', 'genderfluid'],
  'interseks': ['interseks', 'intersex'],
  'intersekse': ['interseks', 'intersex'],
  'aseksueel': ['aseks', 'asexu', 'aromantisch', 'aromantic', '=ace'],
  'asexual': ['aseks', 'asexu', 'aromantic', '=ace'],
  'coming out': ['coming out', 'comingout', 'uit de kast'],
  'aids': ['=aids', '=hiv', 'aidsepidemie', 'aids epidemie', 'hiv positief', 'hiv positive', 'act up'],
  'hiv': ['=aids', '=hiv'],
  'crime': ['misdaad', 'detective', 'thriller', 'moord', 'murder', 'rechercheur', 'politieonderzoek'],
  'misdaad': ['misdaad', 'detective', 'thriller', 'moord', 'murder', 'rechercheur', 'crime'],
  'thriller': ['thriller', 'spanning', 'suspense'],
  'comic': ['=strip', '=strips', 'stripverhaal', 'stripboek', '=comic', '=comics', 'graphic novel', 'manga', 'beeldroman'],
  'strip': ['=strip', '=strips', 'stripverhaal', 'stripboek', '=comic', '=comics', 'graphic novel', 'manga', 'beeldroman'],
  'manga': ['manga'],
  'roman': ['roman', 'novel', 'debuutroman'],
  'novel': ['roman', 'novel'],
  'verhal': ['verhalenbundel', 'kortverhal', 'short stor', 'verhalen'],
  'short story': ['verhalenbundel', 'kortverhal', 'short stor'],
  'essay': ['essay', 'essaybundel'],
  'kinderboek': ['kinderboek', 'prentenboek', 'voorlezen', 'kleuter', 'picture book', 'children'],
  'children': ['kinderboek', 'prentenboek', 'picture book', 'children'],
  'young adult': ['young adult', 'tiener', 'teen', 'puber', 'middelbare school', 'high school'],
  'sport': ['sport', 'voetbal', 'football', 'soccer', 'atleet', 'athlete', 'olympisch', 'olympic', 'wielren', 'tennis', 'boks', 'zwemm'],
  'fotografie': ['fotograf', 'photograph', 'fotoboek', 'foto s'],
  'kunst': ['kunst', 'kunstenaar', 'schilder', 'artist', '=art'],
  'muziek': ['muziek', 'music', 'muzikant', 'zanger', 'singer', 'opera'],
  'film': ['=film', '=films', 'cinema', 'regisseur', 'filmmaker'],
  'theater': ['theater', 'toneel', 'theatre', 'cabaret'],
  'drag': ['=drag', 'dragqueen', 'drag queen', 'dragking', 'drag king'],
  'romance': ['romance', 'liefdesverhaal', 'liefdesroman', 'love story', 'verliefd', 'falls in love'],
  'liefde': ['liefdesverhaal', 'liefdesroman', 'love story', 'verliefd', 'falls in love'],
  'fantasy': ['fantasy', 'magie', 'magic', 'draken', 'dragon', 'tovenaar', 'wizard', 'elfen'],
  'science fiction': ['science fiction', 'sciencefiction', 'sci fi', 'scifi', 'ruimteschip', 'spaceship', 'dystop'],
  'horror': ['horror', 'griezel', 'spook', 'ghost', 'vampier', 'vampire'],
  'humor': ['humor', 'humour', 'grappig', 'funny', 'hilarisch', 'hilarious', 'komisch'],
  'mentale gezondheid': ['depressie', 'depression', 'angststoornis', 'anxiety', 'mentale gezondheid', 'mental health', 'therapie', 'therapy', 'zelfmoord', 'suicide', 'psychisch', 'trauma'],
  'gezondheid': ['gezondheid', 'health', 'ziekte', 'illness', 'medisch', 'medical'],
  'familie': ['familie', 'gezin', 'family', 'ouderschap', 'parenting', 'regenboogfamilie', 'regenbooggezin', 'adoptie', 'adoption'],
  'ouderschap': ['ouderschap', 'parenting', 'regenboogfamilie', 'regenbooggezin', 'adoptie', 'adoption', 'zwanger', 'pregnan'],
  'relatie': ['relatie', 'relationship', 'huwelijk', 'marriage', 'trouwen', 'scheiding', 'divorce'],
  'polyamorie': ['polyamor', '=poly', 'open relatie', 'open relationship'],
  'racisme': ['racism', 'racist', 'kolonial', 'colonial', 'dekolonis', 'decolonis'],
  'migratie': ['migratie', 'migrant', 'vluchteling', 'refugee', 'asiel', 'asylum', 'diaspora'],
  'reizen': ['reis', 'reizen', 'travel', 'reisgids', 'roadtrip'],
  'kookboek': ['kookboek', 'recept', 'recipe', 'koken', 'cooking'],
  'sprookje': ['sprookje', 'fairy tale', 'fairytale'],
  'oorlog': ['oorlog', '=war', '=wars', 'wartime', 'wereldoorlog', 'world war', '=wwii', '=ww2', 'holocaust', 'nazi', 'soldaat', 'soldier', 'leger', 'army', 'verzet', 'resistance'],
  'sekswerk': ['sekswerk', 'sex work', 'sexwork', 'prostitu', 'escort', 'hustler', 'hooker', 'hoerenloper', 'bordeel', 'brothel', 'rosse buurt', 'red light', 'tippelaar'],
  'sex work': ['sekswerk', 'sex work', 'sexwork', 'prostitu', 'escort', 'hustler', 'hooker', 'bordeel', 'brothel', 'red light'],
  'activisme': ['activis', 'protest', 'betoging', 'demonstratie', 'pride', 'stonewall'],
  'religie': ['religie', 'religion', 'geloof', 'faith', 'kerk', 'church', 'bijbel', 'bible', 'islam', 'joods', 'jewish', 'christen', 'christelijk', 'christian'],
  'bdsm': ['bdsm', 'kink', 'fetish', 'fetisj', 'dominant', 'submissive', 'bondage', '=leder', 'leather'],
  'erotiek': ['erotisch', 'erotiek', 'erotic', 'seks', 'sex'],
  'seks': ['seks', 'sex', 'seksualiteit', 'sexuality']
};

/** De ingebouwde lijst, met als sleutel genreSleutel van de naam (zo werkt Oorlog, Reizen of Biseksueel ook). */
var INDELEN_INDEX = null;
function indelenIndex() {
  if (INDELEN_INDEX) return INDELEN_INDEX;
  INDELEN_INDEX = {};
  Object.keys(INDELEN_ZOEKWOORDEN).forEach(function (k) {
    var sleutel = genreSleutel(k);
    INDELEN_INDEX[sleutel] = (INDELEN_INDEX[sleutel] || []).concat(INDELEN_ZOEKWOORDEN[k]);
  });
  return INDELEN_INDEX;
}

/**
 * De zoekwoorden van een naam: de naam zelf, de ingebouwde lijst en de eigen zoekwoorden. Genormaliseerd.
 * Een naam met / of & (AIDS/HIV, Kunst & Cultuur) telt elk deel apart.
 */
function indelenZoekwoorden(naam, eigen) {
  var lijst = [];
  var delen = String(naam || '').split(/\s*[\/&]\s*/);
  delen.forEach(function (deel) {
    var n = normaliseerTekst(deel);
    if (!n) return;
    var stam = genreSleutel(deel);
    var ingebouwd = indelenIndex()[stam];
    // Staat de naam in de ingebouwde lijst, dan bepaalt die lijst hoe hij telt ("Strip" enkel als woord, niet striptease).
    if (ingebouwd) { ingebouwd.forEach(function (w) { lijst.push(w); }); return; }
    lijst.push(n.length < 4 ? '=' + n : n);
    if (stam && stam !== n && stam.length >= 4) lijst.push(stam);
  });
  splitsLijst(eigen).forEach(function (w) { lijst.push(w.charAt(0) === '=' ? '=' + normaliseerTekst(w.slice(1)) : normaliseerTekst(w)); });
  var uniek = [];
  lijst.forEach(function (w) { if (w && w !== '=' && uniek.indexOf(w) === -1) uniek.push(w); });
  return uniek;
}

/** Past een zoekwoord op het woord op plaats i? Korte woorden (minder dan 4 letters) enkel precies. */
function indelenRaak(zoekwoord, woorden, i) {
  var w = woorden[i];
  if (zoekwoord.charAt(0) === '=') return w === zoekwoord.slice(1);
  if (zoekwoord.indexOf(' ') > -1) {
    var delen = zoekwoord.split(' ');
    for (var d = 0; d < delen.length; d++) {
      var x = woorden[i + d];
      if (!x || (d < delen.length - 1 ? x !== delen[d] : x.indexOf(delen[d]) !== 0)) return false;
    }
    return true;
  }
  return zoekwoord.length < 4 ? w === zoekwoord : w.indexOf(zoekwoord) === 0;
}

/** Hoeveel keer een naam voorkomt: titel dubbel, beschrijving (NL en EN) enkel. */
function indelenScore(zoekwoorden, titelWoorden, tekstWoorden) {
  var tel = function (woorden) {
    var n = 0;
    for (var i = 0; i < woorden.length; i++) {
      if (zoekwoorden.some(function (z) { return indelenRaak(z, woorden, i); })) n++;
    }
    return n;
  };
  return 2 * tel(titelWoorden) + tel(tekstWoorden);
}

/**
 * Deelt de boeken in. catalogus wordt aangepast (wijzig). namen: rijen van het tabblad Categorieën en trefwoorden
 * ({ naam, soort, zoekwoorden }). Geeft [{ boek_id, titel, themas, categorieen, trefwoorden }] met wat erbij kwam.
 */
function deelBoekenIn(catalogus, namen, welke) {
  var kandidaten = (namen || []).filter(function (r) {
    var s = normaliseerTekst(r.soort);
    return (s === 'categorie' || s === 'trefwoord') && schoon(r.naam) && !themaExact(r.naam);
  }).map(function (r) {
    var categorie = normaliseerTekst(r.soort) === 'categorie';
    return { naam: schoon(r.naam), kolom: categorie ? 'categorieen' : 'trefwoorden', min: categorie ? INDELEN_MIN_CATEGORIE : INDELEN_MIN_TREFWOORD,
      minFilm: INDELEN_MIN_TREFWOORD_FILM,
      zoekwoorden: indelenZoekwoorden(r.naam, r.zoekwoorden) };
  });
  // Films hebben geen thema's maar genres. Een thema als Coming-out of Kolonialisme kan daarom bij een film
  // een trefwoord zijn (niet de thema's die eigenlijk een soort boek zijn, zoals Fictie of Poëzie).
  var filmKandidaten = kandidaten.filter(function (k) { return k.kolom === 'trefwoorden'; }).concat(alleThemas().filter(function (t) {
    return INDELEN_GEEN_FILMTREFWOORD.indexOf(t) === -1;
  }).map(function (t) {
    return { naam: t, kolom: 'trefwoorden', min: INDELEN_MIN_TREFWOORD_FILM, minFilm: INDELEN_MIN_TREFWOORD_FILM, zoekwoorden: indelenZoekwoorden(t, '') };
  }));
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel)) return;
    // Een film krijgt enkel trefwoorden: thema's en categorieën zijn voor boeken (een film heeft genres).
    var film = isFilm(b);
    // welke: 'boeken' of 'films' (menu), leeg = allebei (vanzelf, elke dag).
    if ((welke === 'boeken' && film) || (welke === 'films' && !film)) return;
    var titelWoorden = normaliseerTekst(b.titel).split(' ').filter(Boolean);
    // De beschrijving (NL en EN) en het genre (bij films bv. War of Drama van IMDb).
    var tekstWoorden = normaliseerTekst([b.beschrijving, b.beschrijving_en, b.genre].join(' ')).split(' ').filter(Boolean);
    var erbij = { extra_onderwerpen: [], categorieen: [], trefwoorden: [] };
    // Thema's: elk thema dat duidelijk voorkomt.
    if (!film) onderwerpScores(b).forEach(function (s) { if (s[1] >= ONDERWERP_ZEKER_MIN) erbij.extra_onderwerpen.push(s[0]); });
    (film ? filmKandidaten : kandidaten).forEach(function (k) {
      if (indelenScore(k.zoekwoorden, titelWoorden, tekstWoorden) >= (film ? k.minFilm : k.min)) erbij[k.kolom].push(k.naam);
    });
    var velden = {}, nieuw = {};
    Object.keys(erbij).forEach(function (kol) {
      var voor = splitsLijst(b[kol]);
      var na = voegLijstToe(b[kol], erbij[kol]);
      if (na !== voor.join(', ')) {
        velden[kol] = na;
        nieuw[kol] = splitsLijst(na).slice(voor.length);
      }
    });
    if (!Object.keys(velden).length) return;
    wijzig(b, velden);
    uit.push({ boek_id: String(b.boek_id), titel: schoon(b.titel), themas: (nieuw.extra_onderwerpen || []).join(', '),
      categorieen: (nieuw.categorieen || []).join(', '), trefwoorden: (nieuw.trefwoorden || []).join(', ') });
  });
  return uit;
}

/** Deelt in en schrijft het tabblad Indeling. Geeft de rijen van Indeling. */
function deelBoekenInUitvoeren(welke) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var namen = leesTabel('Categorieën en trefwoorden').rijen;
    uit = deelBoekenIn(catalogus.rijen, namen, welke);
    if (uit.length) schrijfKolommen(catalogus, ['extra_onderwerpen', 'categorieen', 'trefwoorden']);
    if (uit.length) {
      var ss = spreadsheet();
      var blad = ss.getSheetByName('Indeling') || ss.insertSheet('Indeling');
      var kolommen = KOLOMMEN['Indeling'];
      blad.clear();
      var waarden = [kolommen].concat(uit.map(function (r) { return kolommen.map(function (k) { return r[k]; }); }));
      blad.getRange(1, 1, waarden.length, kolommen.length).setValues(waarden);
      opmaakKop(blad, kolommen.length);
    }
  } finally {
    lock.releaseLock();
  }
  // Het aantal boeken per naam bijwerken in Categorieën en trefwoorden.
  vernieuwCategorieen([]);
  leegCache();
  return uit;
}

function indelingTekst(uit, welke) {
  var tel = function (k) { return uit.filter(function (r) { return r[k]; }).length; };
  return uit.length + ' ' + (welke === 'boeken' ? 'boeken' : welke === 'films' ? 'films' : 'boeken en films') + ' ingedeeld op titel en beschrijving: ' + tel('themas') + ' kregen een thema erbij, ' +
    tel('categorieen') + ' een categorie, ' + tel('trefwoorden') + ' een trefwoord. Wat erbij kwam, staat in het tabblad Indeling. ' +
    'Er werd niets weggehaald.';
}

/** Menu: Boeken > Deel de boeken in op titel en beschrijving. */
function deelBoekenInMenu() {
  zorgVoorTabbladen(['Catalogus', 'Categorieën en trefwoorden', 'Indeling']);
  var tekst = indelingTekst(deelBoekenInUitvoeren('boeken'), 'boeken');
  logboek('menu', 'deelBoekenIn', tekst);
  meld(tekst);
}

/** Menu: Films > Deel de films in op titel en beschrijving (trefwoorden). */
function deelFilmsInMenu() {
  zorgVoorTabbladen(['Catalogus', 'Categorieën en trefwoorden', 'Indeling']);
  var tekst = indelingTekst(deelBoekenInUitvoeren('films'), 'films');
  logboek('menu', 'deelFilmsIn', tekst);
  meld(tekst);
}

/**
 * Vanzelf, één keer per dag (vanuit verwerkNieuweBoekenAutomatisch, die elk uur loopt): zo krijgen nieuwe boeken
 * en films hun thema's, categorieën en trefwoorden zodra hun beschrijving er is.
 */
function deelBoekenInAutomatisch() {
  var eigenschappen = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  if (eigenschappen.getProperty('indelen_laatst') === vandaag) return;
  if (!spreadsheet().getSheetByName('Categorieën en trefwoorden') || !spreadsheet().getSheetByName('Indeling')) return;
  eigenschappen.setProperty('indelen_laatst', vandaag);
  var uit = deelBoekenInUitvoeren();
  if (uit.length) logboek('systeem', 'deelBoekenIn', indelingTekst(uit));
}

/** De rijen van het tabblad Categorieën en trefwoorden, of [] als het (nog) niet bestaat. */
function categorieenTabRijen() {
  try {
    var blad = spreadsheet().getSheetByName('Categorieën en trefwoorden');
    return blad && blad.getLastRow() > 1 ? leesTabel('Categorieën en trefwoorden').rijen : [];
  } catch (e) { return []; }
}
