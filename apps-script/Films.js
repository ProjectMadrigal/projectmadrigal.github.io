/**
 * Films.js
 * Films (dvd's) in de collectie, naast de boeken. Een film is een rij in de Catalogus met
 * soort "film" en een nummer F0001. Zo werken uitlenen, reserveren en terugbrengen aan de balie
 * zoals bij een boek.
 *
 * Kolommen in de Catalogus die enkel voor films dienen:
 *   auteur      de regie (bv. Todd Haynes)
 *   land        het land of de landen, gescheiden door komma's
 *   duur        de speelduur in minuten
 *   genre       de genres, gescheiden door komma's (op de filmpagina een filter)
 *   film_tip    ja: een kijktip, deze film is niet in de bib
 *   te_koop     ja: te koop in de bib, niet uitleenbaar (werkt ook voor boeken)
 *   letterboxd  het korte adres van de film bij Letterboxd (bv. carol-2015), om dubbels te vermijden
 *   imdb        het nummer bij IMDb (bv. tt2402927), uit een export van IMDb
 *   originele_titel  de titel in de oorspronkelijke taal, als die verschilt (uit IMDb of Wikidata)
 *   wikidata    het nummer bij Wikidata (bv. Q1047256)
 *   film_gezocht  de dag waarop het script de film opzocht. Opnieuw laten zoeken? Maak die cel leeg.
 *
 * Films ophalen: Madrigal > Films > Haal de Letterboxd-lijst op (instelling letterboxd_lijst).
 * Of zonder vragen naar buiten (handig als de daglimiet van Google op is): exporteer een lijst als CSV
 * bij IMDb of Letterboxd, importeer ze in een nieuw tabblad, open dat tabblad en kies
 * Madrigal > Films > Neem de films over uit dit tabblad.
 * Gegevens aanvullen: Madrigal > Films > Vul de films aan. Dat zoekt bij Wikidata (regie, land,
 * jaartal, genre, duur, taal) en Wikipedia (de omschrijving, CC BY-SA 4.0 met bronvermelding).
 * Wat je zelf invulde, blijft staan: het script vult enkel lege velden aan.
 *
 * Verborgen voor bezoekers tot de instelling films_tonen op ja staat. Het bestuur ziet de
 * filmpagina wel, op een toestel waar het met de bestuurscode aangemeld is (actie filmsVoorbeeld).
 */

var FILM_PAUZE_MS = 400;
var FILM_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var FILM_PORTIE = 20;         // zoveel films per vraag aan Wikidata
var FILM_MAX_GENRES = 4;
var LETTERBOXD_MAX_PAGINAS = 30;

function isFilm(rij) {
  return normaliseerTekst(rij && rij.soort) === 'film';
}

function isFilmTip(rij) {
  return isFilm(rij) && jaNee(rij.film_tip) === 'ja';
}

/** Een lijst uit een cel: "Drama, Romantiek" wordt ["Drama", "Romantiek"]. */
function filmLijst(waarde) {
  return splitsLijst(waarde).map(schoon).filter(Boolean);
}

/** De filtergroepen van een film: de genres en de extra onderwerpen. */
function filmGroepen(rij) {
  var uit = [];
  filmLijst(rij.genre).concat(filmLijst(rij.extra_onderwerpen)).forEach(function (g) {
    var mooi = g.charAt(0).toUpperCase() + g.slice(1);
    if (uit.indexOf(mooi) === -1) uit.push(mooi);
  });
  return uit;
}

/* ---------- Letterboxd ---------- */

function htmlTekst(t) {
  return String(t || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); }).trim();
}

/**
 * Leest de films uit één pagina van een lijst bij Letterboxd. Geeft [{ slug, titel, jaar }].
 * Letterboxd verandert soms de opmaak. Daarom zoeken we breed: elk element met data-film-slug
 * of data-item-slug, en daarbij de naam (data-item-name, data-film-name of de alt van de afbeelding).
 */
function letterboxdFilms(html) {
  var tekst = String(html || '');
  var re = /data-(?:film|item)-slug="([^"]+)"/g, m, plekken = [];
  while ((m = re.exec(tekst))) {
    // Hetzelfde adres twee keer na elkaar (bv. in de afbeelding en de link) is één film.
    if (!plekken.length || plekken[plekken.length - 1].slug !== m[1]) plekken.push({ slug: m[1], plek: m.index });
  }
  var uit = [], gezien = {};
  plekken.forEach(function (p, i) {
    if (gezien[p.slug]) return;
    var begin = tekst.lastIndexOf('<', p.plek);
    // Tot het begin van het element van de volgende film: anders lezen we de naam van die film.
    var einde = i + 1 < plekken.length ? tekst.lastIndexOf('<', plekken[i + 1].plek) : Math.min(tekst.length, p.plek + 2000);
    var stuk = tekst.slice(begin, Math.max(einde, p.plek + 1));
    var naam = (stuk.match(/data-(?:item|film)-name="([^"]+)"/) || stuk.match(/alt="([^"]+)"/) || [])[1] || '';
    naam = htmlTekst(naam).replace(/^Poster for /i, '');
    var jaar = Number((stuk.match(/data-film-release-year="(\d{4})"/) || [])[1]) || 0;
    var mj = naam.match(/^(.*\S)\s*\((\d{4})\)$/);
    if (mj) { naam = mj[1]; jaar = jaar || Number(mj[2]); }
    if (!naam) naam = p.slug.replace(/-\d{4}$/, '').replace(/-/g, ' ');
    gezien[p.slug] = true;
    uit.push({ slug: p.slug, titel: naam, jaar: jaar || '' });
  });
  return uit;
}

/** Het adres van pagina n van een lijst: https://letterboxd.com/naam/list/lijst/page/2/ */
function letterboxdPaginaUrl(lijst, n) {
  var basis = String(lijst || '').trim().replace(/\/page\/\d+\/?$/, '').replace(/\/?$/, '/');
  return n > 1 ? basis + 'page/' + n + '/' : basis;
}

function isLetterboxdLijst(url) {
  return /^https:\/\/(www\.)?letterboxd\.com\/[^\/\s]+\/list\/[^\/\s]+\/?/.test(String(url || '').trim());
}

/**
 * Zet nieuwe films in de Catalogus. Een film die er al staat (zelfde letterboxd, of zelfde titel
 * en jaartal), komt er niet nog eens bij. nieuwId(soort) geeft een nieuw nummer.
 * Geeft het aantal nieuwe films.
 */
function voegFilmsToe(rijen, films, vandaag, nieuwId) {
  var sleutels = {};
  var sleutel = function (titel, jaar) { return normaliseerTekst(titel) + '|' + (jaar || ''); };
  rijen.forEach(function (r) {
    if (!isFilm(r)) return;
    if (!isLeeg(r.letterboxd)) sleutels['lb:' + schoon(r.letterboxd)] = true;
    if (!isLeeg(r.imdb)) sleutels['im:' + schoon(r.imdb)] = true;
    sleutels[sleutel(r.titel, parseerGetal(r.jaartal))] = true;
  });
  var n = 0;
  films.forEach(function (f) {
    if (!f.slug && !f.titel) return;
    if ((f.slug && sleutels['lb:' + f.slug]) || (f.imdb && sleutels['im:' + f.imdb]) || sleutels[sleutel(f.titel, f.jaar)]) return;
    var rij = {
      boek_id: nieuwId('film'), soort: 'film', titel: schoon(f.titel), jaartal: f.jaar || '',
      letterboxd: f.slug || '', imdb: f.imdb || '', auteur: f.regie || '', genre: f.genre || '', duur: f.duur || '', originele_titel: f.origineel || '',
      aantal: 1, uitleenbaar: 'ja', publiek: 'ja', uitvoering: 'dvd', toegevoegd_op: vandaag
    };
    rij.bron_sleutel = bronSleutel(rij);
    voegToe(rijen, rij);
    if (f.slug) sleutels['lb:' + f.slug] = true;
    if (f.imdb) sleutels['im:' + f.imdb] = true;
    sleutels[sleutel(f.titel, f.jaar)] = true;
    n++;
  });
  return n;
}

/* ---------- Een export van IMDb of Letterboxd (CSV in een tabblad) ---------- */

/** Genres van IMDb in het Nederlands. Een onbekend genre blijft in het Engels. */
var FILM_GENRES_NL = {
  action: 'Actie', adventure: 'Avontuur', animation: 'Animatie', biography: 'Biografie', comedy: 'Komedie', crime: 'Misdaad',
  documentary: 'Documentaire', drama: 'Drama', family: 'Familie', fantasy: 'Fantasy', history: 'Geschiedenis', horror: 'Horror',
  music: 'Muziek', musical: 'Musical', mystery: 'Mysterie', romance: 'Romantiek', 'sci fi': 'Sciencefiction', 'science fiction': 'Sciencefiction',
  short: 'Kortfilm', sport: 'Sport', thriller: 'Thriller', war: 'Oorlog', western: 'Western', 'film noir': 'Film noir'
};

function filmGenreNl(g) {
  var k = normaliseerTekst(g);
  return FILM_GENRES_NL[k] || schoon(g);
}

/** De kolommen die we herkennen, met de namen bij IMDb en Letterboxd. */
var FILM_KOLOMMEN = {
  titel: ['title', 'name', 'titel'],
  origineel: ['original title', 'originele titel'],
  jaar: ['year', 'jaar', 'jaartal'],
  regie: ['directors', 'director', 'regie'],
  genres: ['genres', 'genre'],
  duur: ['runtime mins', 'runtime', 'duur'],
  imdb: ['const', 'imdb', 'imdb id'],
  soort: ['title type']
};

/**
 * Leest de films uit de waarden van een tabblad (eerste rij: de kolomnamen).
 * Geeft [{ titel, jaar, regie, genre, duur, imdb, slug }] of null als het geen lijst met films is.
 * Afleveringen van een reeks laten we weg.
 */
function filmsUitTabel(waarden) {
  if (!waarden || waarden.length < 2) return null;
  var kop = waarden[0].map(normaliseerTekst);
  var kolom = {};
  Object.keys(FILM_KOLOMMEN).forEach(function (k) {
    kolom[k] = -1;
    FILM_KOLOMMEN[k].forEach(function (naam) { if (kolom[k] === -1) kolom[k] = kop.indexOf(naam); });
  });
  if (kolom.titel === -1) return null;
  var w = function (rij, k) { return kolom[k] > -1 ? rij[kolom[k]] : ''; };
  return waarden.slice(1).map(function (rij) {
    var titel = schoon(w(rij, 'titel'));
    if (!titel || /episode/i.test(String(w(rij, 'soort')))) return null;
    var imdb = (String(w(rij, 'imdb')).match(/tt\d{6,10}/) || [])[0] || '';
    return {
      titel: titel, jaar: parseerGetal(w(rij, 'jaar')) || '', imdb: imdb, slug: '', origineel: andereTitel(titel, w(rij, 'origineel')),
      regie: filmLijst(w(rij, 'regie')).slice(0, 3).join(', '),
      genre: filmLijst(w(rij, 'genres')).map(filmGenreNl).slice(0, FILM_MAX_GENRES).join(', '),
      duur: parseerGetal(w(rij, 'duur')) || ''
    };
  }).filter(Boolean);
}

/** Menu: neemt de films over uit het tabblad dat open staat (een import van IMDb of Letterboxd). */
function neemFilmsOverUitTabblad() {
  var blad = SpreadsheetApp.getActiveSheet();
  if (!blad || blad.getName() === 'Catalogus') { meld('Open eerst het tabblad met de geïmporteerde lijst, en kies dan dit menu-item opnieuw.'); return; }
  var films = filmsUitTabel(blad.getDataRange().getValues());
  if (!films) { meld('In dit tabblad staat geen lijst met films. De eerste rij moet de kolomnamen hebben, met minstens Title of Name.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('imdb') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var ids = maakIdGenerator(tabel.rijen);
    aantal = voegFilmsToe(tabel.rijen, films, vandaagTekst(), ids.nieuw);
    if (aantal) { bewaarTabel(tabel); ids.bewaar(); }
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'neemFilmsOverUitTabblad', blad.getName() + ': ' + films.length + ' films, ' + aantal + ' nieuw in de Catalogus');
  if (aantal) { leegCache(); planTaak('vulFilmsAan', 60 * 1000); }
  meld(films.length + ' films in dit tabblad, ' + aantal + ' nieuw in de Catalogus.' +
    (aantal ? ' Land en omschrijving zoekt het script daarna op bij Wikidata en Wikipedia (zodra de daglimiet van Google het toelaat). Dit tabblad mag je daarna verwijderen.' : ''));
}

/* ---------- Wikidata en Wikipedia ---------- */

/** Heeft deze film nog gegevens van Wikidata of Wikipedia nodig? */
function heeftFilmGegevensNodig(rij) {
  return isFilm(rij) && !isLeeg(rij.titel) && isLeeg(rij.film_gezocht);
}

function sparqlTekst(t) {
  return '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Het deel van de vraag dat voor elke film dezelfde gegevens ophaalt. ?film moet al gekend zijn. */
var FILM_SPARQL_VELDEN =
  '  OPTIONAL { ?film wdt:P577 ?datum . }\n' +
  '  OPTIONAL { ?film wdt:P2047 ?duur . }\n' +
  '  OPTIONAL { ?film wdt:P1476 ?origineel . }\n' +
  '  OPTIONAL { ?film wdt:P57 ?r . ?r rdfs:label ?regieL . FILTER(LANG(?regieL) = "nl" || LANG(?regieL) = "en") }\n' +
  '  OPTIONAL { ?film wdt:P495 ?l . ?l rdfs:label ?landL . FILTER(LANG(?landL) = "nl") }\n' +
  '  OPTIONAL { ?film wdt:P136 ?g . ?g rdfs:label ?genreL . FILTER(LANG(?genreL) = "nl") }\n' +
  '  OPTIONAL { ?film wdt:P364 ?t . ?t rdfs:label ?taalL . FILTER(LANG(?taalL) = "nl") }\n' +
  '  OPTIONAL { ?nlA schema:about ?film ; schema:isPartOf <https://nl.wikipedia.org/> ; schema:name ?nl . }\n' +
  '  OPTIONAL { ?enA schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en . }\n';

var FILM_SPARQL_KOP = 'SELECT ?film ?lb (MIN(YEAR(?datum)) AS ?jaar) (SAMPLE(?duur) AS ?minuten) ' +
  '(GROUP_CONCAT(DISTINCT ?regieL; separator="|") AS ?regie) (GROUP_CONCAT(DISTINCT ?landL; separator="|") AS ?land) ' +
  '(GROUP_CONCAT(DISTINCT ?genreL; separator="|") AS ?genre) (SAMPLE(?taalL) AS ?taal) (SAMPLE(?origineel) AS ?ot) (SAMPLE(?nl) AS ?nlTitel) (SAMPLE(?en) AS ?enTitel) WHERE {\n';

/** De vraag voor films met een Letterboxd-adres (eigenschap P6127 van Wikidata). */
function filmVraagLetterboxd(slugs) {
  return FILM_SPARQL_KOP + '  VALUES ?lb { ' + slugs.map(sparqlTekst).join(' ') + ' }\n  ?film wdt:P6127 ?lb .\n' + FILM_SPARQL_VELDEN + '} GROUP BY ?film ?lb';
}

/** De vraag voor films met een nummer van IMDb (eigenschap P345). Het nummer komt in ?lb, de sleutel van het antwoord. */
function filmVraagImdb(nummers) {
  return FILM_SPARQL_KOP + '  VALUES ?lb { ' + nummers.map(sparqlTekst).join(' ') + ' }\n  ?film wdt:P345 ?lb .\n' + FILM_SPARQL_VELDEN + '} GROUP BY ?film ?lb';
}

/** De vraag voor één film zonder Letterboxd-adres: op de titel (Engels of Nederlands), en het jaartal als dat gekend is. */
function filmVraagTitel(titel, jaar) {
  var t = schoon(titel);
  return FILM_SPARQL_KOP +
    '  VALUES ?soort { wd:Q11424 wd:Q24869 wd:Q506240 wd:Q93204 }\n' +
    '  { ?film rdfs:label ' + sparqlTekst(t) + '@en . } UNION { ?film rdfs:label ' + sparqlTekst(t) + '@nl . }\n' +
    '  ?film wdt:P31 ?soort .\n' + FILM_SPARQL_VELDEN +
    (jaar ? '  FILTER(!BOUND(?datum) || ABS(YEAR(?datum) - ' + Number(jaar) + ') <= 1)\n' : '') +
    '} GROUP BY ?film ?lb LIMIT 3';
}

/** Zet het antwoord van Wikidata om. Geeft [{ qid, lb, jaar, duur, regie, land, genre, taal, nl, en }]. */
function filmUitWikidata(data) {
  var w = function (b, k) { return b[k] ? String(b[k].value || '') : ''; };
  var lijst = function (b, k) { return w(b, k).split('|').map(schoon).filter(Boolean); };
  return (((data || {}).results || {}).bindings || []).map(function (b) {
    var qid = (w(b, 'film').match(/(Q\d+)$/) || [])[1] || '';
    return {
      qid: qid, lb: w(b, 'lb'), jaar: Number(w(b, 'jaar')) || '', duur: Math.round(Number(w(b, 'minuten'))) || '',
      regie: lijst(b, 'regie').filter(function (n, i, alle) { return alle.indexOf(n) === i; }),
      land: lijst(b, 'land'), genre: lijst(b, 'genre').slice(0, FILM_MAX_GENRES),
      taal: w(b, 'taal'), nl: w(b, 'nlTitel'), en: w(b, 'enTitel'), origineel: w(b, 'ot')
    };
  }).filter(function (f) { return f.qid; });
}

/** Een regisseur staat bij Wikidata soms in het Nederlands en het Engels: één keer per naam. */
function uniekeNamen(namen) {
  var gezien = {};
  return namen.filter(function (n) { var k = normaliseerTekst(n); if (gezien[k]) return false; gezien[k] = true; return true; });
}

/**
 * Vult de lege velden van een film aan met wat Wikidata vond. Wat er al staat, blijft.
 * Geeft de velden voor wijzig().
 */
function filmVelden(rij, f) {
  var v = {};
  var leeg = function (k) { return isLeeg(rij[k]); };
  if (f.qid && leeg('wikidata')) v.wikidata = f.qid;
  if (f.regie.length && leeg('auteur')) v.auteur = uniekeNamen(f.regie).slice(0, 3).join(', ');
  if (f.jaar && leeg('jaartal')) v.jaartal = f.jaar;
  if (f.land.length && leeg('land')) v.land = f.land.slice(0, 3).join(', ');
  if (f.genre.length && leeg('genre')) v.genre = f.genre.map(function (g) { return g.charAt(0).toUpperCase() + g.slice(1); }).join(', ');
  if (f.duur && leeg('duur')) v.duur = f.duur;
  if (f.origineel && leeg('originele_titel') && andereTitel(rij.titel, f.origineel)) v.originele_titel = andereTitel(rij.titel, f.origineel);
  if (f.taal && leeg('taal')) v.taal = normaliseerTaal(f.taal) || f.taal;
  return v;
}

/** Kiest uit de antwoorden van Wikidata de film die past (op het jaartal als er meerdere zijn). */
function kiesFilm(rij, kandidaten) {
  if (!kandidaten.length) return null;
  var jaar = parseerGetal(rij.jaartal);
  if (!jaar) return kandidaten.length === 1 ? kandidaten[0] : null;
  return kandidaten.filter(function (f) { return !f.jaar || Math.abs(f.jaar - jaar) <= 1; })[0] || null;
}

/** De vraag aan Wikipedia: de eerste alinea van één artikel. */
function filmWikiUrl(taal, titel) {
  return 'https://' + taal + '.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&prop=extracts%7Cinfo&exintro=1&explaintext=1&inprop=url&titles=' + encodeURIComponent(titel);
}

/** De eerste alinea uit het antwoord van Wikipedia. Geeft { tekst, link } of {}. */
function filmWikiTekst(data) {
  var p = (((data || {}).query || {}).pages || [])[0];
  if (!p || p.missing || !p.extract || String(p.extract).length < 80) return {};
  var link = /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(String(p.fullurl || '')) ? p.fullurl : '';
  return link ? { tekst: maakBeschrijvingNetjes(p.extract), link: link } : {};
}

/* ---------- Menu en achtergrondtaak (enkel in Apps Script) ---------- */

function wikidataVraag(sparql) {
  var r = haalExtern('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), {
    muteHttpExceptions: true, headers: { 'User-Agent': BS_USER_AGENT, Accept: 'application/sparql-results+json' }
  });
  if (r.getResponseCode() !== 200) return { fout: 'Wikidata gaf code ' + r.getResponseCode() };
  try { return { films: filmUitWikidata(JSON.parse(r.getContentText())) }; } catch (e) { return { fout: 'Wikidata gaf een onverwacht antwoord' }; }
}

/** De uitleg als de daglimiet van Google op is. wacht: nog zoveel ms. */
function daglimietFilmTekst(wacht) {
  return 'De daglimiet van Google voor vragen naar andere websites is op. Probeer het over ' + Math.max(1, Math.ceil(wacht / 3600000)) + ' uur opnieuw. ' +
    'Zonder wachten: exporteer de lijst als CSV (bij IMDb of Letterboxd), importeer ze in een nieuw tabblad, open dat tabblad en kies Madrigal > Films > Neem de films over uit dit tabblad.';
}

/** Menu: haalt de films van de lijst bij Letterboxd (instelling letterboxd_lijst) en zet nieuwe films in de Catalogus. */
function haalLetterboxdLijst() {
  var url = schoon(leesInstellingen().letterboxd_lijst);
  if (!isLetterboxdLijst(url)) { meld('Vul bij Instellingen letterboxd_lijst het adres van de lijst in, bv. https://letterboxd.com/naam/list/lijst/'); return; }
  var wacht = 0;
  try { wacht = daglimietWachttijd(CacheService.getScriptCache().get(DAGLIMIET_SLEUTEL), Date.now()); } catch (e) { wacht = 0; }
  if (wacht) { meld(daglimietFilmTekst(wacht)); return; }
  var films = [], fout = '';
  for (var n = 1; n <= LETTERBOXD_MAX_PAGINAS; n++) {
    var r;
    try {
      r = haalExtern(letterboxdPaginaUrl(url, n), { muteHttpExceptions: true, followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ' + BS_USER_AGENT + ')', 'Accept-Language': 'en' } });
    } catch (e) { fout = String(e.message || e); break; }
    if (r.getResponseCode() === 404 && n > 1) break; // geen pagina meer
    if (r.getResponseCode() !== 200) { fout = 'Letterboxd gaf code ' + r.getResponseCode(); break; }
    var opPagina = letterboxdFilms(r.getContentText());
    var nieuw = opPagina.filter(function (f) { return !films.some(function (x) { return x.slug === f.slug; }); });
    if (!nieuw.length) break;
    films = films.concat(nieuw);
    Utilities.sleep(800);
  }
  if (!films.length && isDaglimietFout(fout)) {
    logboek('menu', 'haalLetterboxdLijst', 'niets gevonden: daglimiet van Google');
    meld(daglimietFilmTekst(DAGLIMIET_WACHT_MS));
    return;
  }
  if (!films.length) {
    logboek('menu', 'haalLetterboxdLijst', 'niets gevonden' + (fout ? ': ' + fout : ''));
    meld('Het script kon de lijst niet lezen' + (fout ? ' (' + fout + ')' : '') + '. Letterboxd laat scripts soms niet binnen. ' +
      'Typ dan de titels en jaartallen in de Catalogus, met soort "film" en zonder boek_id. Kies daarna Madrigal > Films > Vul de films aan.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('letterboxd') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var ids = maakIdGenerator(tabel.rijen);
    aantal = voegFilmsToe(tabel.rijen, films, vandaagTekst(), ids.nieuw);
    if (aantal) { bewaarTabel(tabel); ids.bewaar(); }
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'haalLetterboxdLijst', films.length + ' films op de lijst, ' + aantal + ' nieuw in de Catalogus' + (fout ? ' (gestopt: ' + fout + ')' : ''));
  if (aantal) planTaak('vulFilmsAan', 60 * 1000);
  meld(films.length + ' films op de lijst gevonden, ' + aantal + ' nieuw in de Catalogus.' + (aantal ? ' Over een minuut zoekt het script regie, land, genre en omschrijving op.' : '') +
    (fout ? ' Let op: het script stopte bij een pagina (' + fout + '). Probeer later opnieuw voor de rest.' : ''));
}

/** Menu en achtergrondtaak: vult films aan uit Wikidata en Wikipedia, in porties. */
function vulFilmsAan() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulFilmsAan')) return;
  if (!startAchtergrond('vulFilmsAan')) { meldAlBezig('vulFilmsAan'); return; }
  var verwerkt = 0, gevonden = 0, teksten = 0, rest = 0, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('film_gezocht') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftFilmGegevensNodig);
    while (teDoen.length && Date.now() - start < FILM_MAX_LOOPTIJD_MS && !fout) {
      var portie = teDoen.splice(0, FILM_PORTIE);
      // Eerst op het nummer van IMDb of het adres bij Letterboxd: dat is exact. De rest op de titel.
      var metImdb = portie.filter(function (r) { return !isLeeg(r.imdb); });
      var metSlug = portie.filter(function (r) { return isLeeg(r.imdb) && !isLeeg(r.letterboxd); });
      var perSleutel = {};
      [[metImdb, 'imdb', filmVraagImdb], [metSlug, 'letterboxd', filmVraagLetterboxd]].forEach(function (x) {
        if (!x[0].length || fout) return;
        var a = wikidataVraag(x[2](x[0].map(function (r) { return schoon(r[x[1]]); })));
        if (a.fout) { fout = a.fout; return; }
        a.films.forEach(function (f) { perSleutel[f.lb] = f; });
      });
      if (fout) break;
      for (var i = 0; i < portie.length; i++) {
        var rij = portie[i];
        var f = perSleutel[schoon(rij.imdb)] || perSleutel[schoon(rij.letterboxd)] || null;
        if (!f) {
          Utilities.sleep(FILM_PAUZE_MS);
          var b = wikidataVraag(filmVraagTitel(rij.titel, parseerGetal(rij.jaartal)));
          if (b.fout) { fout = b.fout; break; }
          f = kiesFilm(rij, b.films);
        }
        var velden = { film_gezocht: vandaag };
        if (f) {
          Object.assign(velden, filmVelden(rij, f));
          gevonden++;
          if (isLeeg(rij.beschrijving)) {
            var w = {};
            [['nl', f.nl], ['en', f.en]].forEach(function (x) {
              if (w.tekst || !x[1]) return;
              Utilities.sleep(FILM_PAUZE_MS);
              var ant = haalJson(filmWikiUrl(x[0], x[1]));
              if (ant.code === 200) w = filmWikiTekst(ant.data);
            });
            if (w.tekst) {
              velden.beschrijving = w.tekst;
              velden.beschrijving_bron = w.link;
              velden.beschrijving_vertaald = '';
              teksten++;
            }
          }
        }
        wijzig(rij, velden);
        verwerkt++;
      }
      bewaarAchtergrond(tabel);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftFilmGegevensNodig).length;
  } finally {
    stopAchtergrond('vulFilmsAan');
  }
  verwijderTriggers('vulFilmsAan');
  if (rest > 0) ScriptApp.newTrigger('vulFilmsAan').timeBased().after((fout ? 15 : 1) * 60 * 1000).create();
  if (verwerkt) leegCache();
  if (teksten) planVertaling(2);
  logboek('menu', 'vulFilmsAan', verwerkt + ' films opgezocht, ' + gevonden + ' gevonden bij Wikidata, ' + teksten + ' omschrijvingen, ' + rest + ' te gaan' + (fout ? ' (' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' films opgezocht, ' + gevonden + ' gevonden, ' + teksten + ' omschrijvingen.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}
