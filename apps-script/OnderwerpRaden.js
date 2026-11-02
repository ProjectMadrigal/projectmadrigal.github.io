/**
 * OnderwerpRaden.js
 * Boeken zonder onderwerp (geen thema op de website) een thema geven, enkel waar het zeker is.
 *
 *   1. Een genre zonder thema in het tabblad Onderwerpen: het thema komt uit het genre zelf (stelFiltergroepenVoor),
 *      bv. "lesbische roman" wordt Seksualiteit en Fictie. Dat geldt meteen voor alle boeken met dat genre.
 *   2. Geen genre (of een genre zonder voorstel): het script telt woorden in de titel en de beschrijving die op een
 *      thema wijzen. Wijst het duidelijk naar één thema (minstens 3 keer, en minstens dubbel zo vaak als een ander
 *      thema), dan komt dat thema meteen in de kolom extra_onderwerpen.
 *   3. Twijfel: het boek komt in het tabblad "Onderwerpen nakijken", met een voorstel. De keuzelijst bevat alle thema's
 *      en alle genres uit Onderwerpen (bv. Politiek). Jij past aan en zet toepassen
 *      op ja. Daarna: Madrigal > Boeken > Onderwerpen: pas de nakijklijst toe.
 * Klassiekers en Zines raadt het script niet: die komen uit het vinkje klassieker en de soort zine.
 */

var ONDERWERP_NAKIJKEN = 'Onderwerpen nakijken';
var ONDERWERP_ZEKER_MIN = 3;    // zo vaak moet een thema minstens voorkomen in titel en beschrijving
var ONDERWERP_ZEKER_FACTOR = 2; // en zoveel keer vaker dan het volgende thema

/*
 * Woorden in een titel of beschrijving die op een thema wijzen. Woorden die in bijna elke beschrijving in een queer
 * bib staan (lesbisch, homo, gay, queer, liefde, vrouw), tellen bewust niet: die zeggen niets over het thema.
 * Een woord telt als het ermee begint (roman telt ook voor romans en romancier). Met = vooraan: enkel precies dat
 * woord (=god telt niet voor godin). Met een spatie: twee woorden na elkaar (coming out).
 */
var ONDERWERP_TEKST_WOORDEN = [
  ['Fictie', ['roman', 'novel', 'verhalenbundel', 'kortverhal', 'fictie', 'fiction', 'thriller', 'detective', 'personage', 'hoofdpersonage', 'protagonist']],
  ['Poëzie', ['gedicht', 'poezie', 'poetry', 'poem', 'dichter', 'dichteres', 'poet', 'dichtbundel']],
  ['Graphic novel', ['strip', 'stripverhaal', 'graphic', 'comic', 'manga', 'getekend', 'tekeningen']],
  ['Biografie', ['biografie', 'biography', 'memoir', 'memoires', 'autobiografie', 'autobiography', 'dagboek', 'levensverhaal', 'diary']],
  ['Gender', ['transgender', 'transitie', 'transvrouw', 'transman', 'nonbinair', 'non binair', 'genderidentiteit', 'genderqueer', 'intersekse', 'intersex']],
  ['Feminisme', ['feminis', 'patriarchaat', 'patriarchy', 'vrouwenbeweging', 'vrouwenrechten', 'misogyn']],
  ['Geschiedenis', ['geschiedenis', 'history', 'historisch', 'historical', '=eeuw', '=eeuwen', '=century', '=centuries', 'oorlog', 'holocaust', 'archief']],
  ['Maatschappij', ['essay', 'politiek', 'politics', 'samenleving', 'maatschappij', 'society', 'activis', 'sociolog', 'filosof', 'philosoph', 'onderzoek', 'research']],
  ['Religie en Spiritualiteit', ['religie', 'religion', 'geloof', 'faith', 'kerk', 'church', 'bijbel', 'bible', 'islam', 'spiritualiteit', 'spiritual', 'tarot', 'heks', 'witch', '=god', '=goden', '=gods']],
  ['Young Adult', ['young adult', 'tiener', 'teen', 'jongeren', 'middelbare school', 'high school', 'puber']],
  ['Erotica en BDSM', ['erotisch', 'erotiek', 'erotic', 'bdsm', 'kink', 'fetish', '=leder', 'leather', 'dominant', 'submissive']],
  ['Seksualiteit', ['seksualiteit', 'sexuality', 'coming out', 'comingout', 'seksuele', 'sexual']]
];

/** Hoe vaak elk thema voorkomt in de titel en de beschrijving van een boek. Geeft [[thema, aantal]], hoogste eerst. */
function onderwerpScores(boek) {
  var woorden = normaliseerTekst([boek.titel, boek.beschrijving, boek.beschrijving_en].join(' ')).split(' ').filter(Boolean);
  var scores = {};
  woorden.forEach(function (w, i) {
    var paar = w + ' ' + (woorden[i + 1] || '');
    ONDERWERP_TEKST_WOORDEN.forEach(function (t) {
      // Een woord telt hoogstens één keer per thema.
      var raak = t[1].some(function (k) {
        if (k.charAt(0) === '=') return w === k.slice(1);
        return k.indexOf(' ') > -1 ? paar.indexOf(k + ' ') === 0 || paar === k : w.indexOf(k) === 0;
      });
      if (raak) scores[t[0]] = (scores[t[0]] || 0) + 1;
    });
  });
  return Object.keys(scores).map(function (t) { return [t, scores[t]]; })
    .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
}

/** Is één thema duidelijk de winnaar? Geeft het thema of ''. */
function zekerOnderwerp(scores) {
  if (!scores.length || scores[0][1] < ONDERWERP_ZEKER_MIN) return '';
  var tweede = scores[1] ? scores[1][1] : 0;
  return scores[0][1] >= ONDERWERP_ZEKER_FACTOR * tweede ? scores[0][0] : '';
}

/**
 * Doet het werk zonder spreadsheet. catalogus en onderwerpRijen worden aangepast (wijzig).
 * Geeft { genres: [genres die een thema kregen], boeken: [boek_id met een geraden thema], nakijken: [rijen] }.
 */
function vulOntbrekendeOnderwerpen(catalogus, onderwerpRijen) {
  var uit = { genres: [], boeken: [], nakijken: [] };
  // 1. Genres zonder thema: het voorstel uit het genre.
  onderwerpRijen.forEach(function (r) {
    if (isLeeg(r.genre) || !isLeeg(r.filtergroepen)) return;
    var voorstel = stelFiltergroepenVoor(r.genre);
    if (voorstel.length) { wijzig(r, { filtergroepen: voorstel.join(', ') }); uit.genres.push(schoon(r.genre)); }
  });
  var vertaal = vertaalTabel(onderwerpRijen);
  // 2. Boeken die nog altijd geen thema hebben.
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel) || isFilm(b)) return;
    if (filtergroepenVan(b, vertaal).length) return;
    var scores = onderwerpScores(b);
    var zeker = zekerOnderwerp(scores);
    if (zeker) {
      wijzig(b, { extra_onderwerpen: zeker });
      uit.boeken.push(String(b.boek_id));
      return;
    }
    uit.nakijken.push({
      boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur), genre: schoon(b.genre),
      voorstel: scores.slice(0, 3).map(function (s) { return s[0] + ' (' + s[1] + ')'; }).join(', ') || 'geen aanwijzing',
      onderwerp_nieuw: scores.length ? scores[0][0] : '', toepassen: 'nee'
    });
  });
  return uit;
}

/**
 * De keuzes voor de keuzelijst onderwerp_nieuw: de vaste thema's van de website en de genres uit Onderwerpen
 * (bv. Politiek), elk één keer in de juiste schrijfwijze.
 * Geeft { themas: [...], genres: [...], lijst: [thema's en genres samen, alfabetisch] }.
 */
function onderwerpKeuzes(onderwerpRijen, catalogus) {
  // Enkel de vaste thema's van de website, en de genres elk één keer in de juiste schrijfwijze (zie Genres.js).
  var themas = alleThemas().filter(function (f) { return f !== 'Zines' && f !== 'Klassiekers'; });
  var genres = [], gezien = {};
  (onderwerpRijen || []).forEach(function (r) {
    if (isLeeg(r.genre)) return;
    var k = genreSleutel(r.genre);
    if (gezien[k]) return;
    gezien[k] = true;
    genres.push(genreMooi(r.genre));
  });
  var sorteer = function (x, y) { return x.localeCompare(y, 'nl'); };
  genres.sort(sorteer);
  var alleenGenre = genres.filter(function (g) { return !themas.some(function (t) { return normaliseerTekst(t) === normaliseerTekst(g); }); });
  return { themas: themas.slice().sort(sorteer), genres: genres, lijst: themas.concat(alleenGenre).sort(sorteer) };
}

/**
 * De nakijklijst toepassen bij de rijen met toepassen = ja. Per keuze in onderwerp_nieuw:
 *   - een thema: erbij in extra_onderwerpen;
 *   - een genre uit Onderwerpen (bv. Politiek): wordt het genre van het boek als dat nog leeg is, anders komen de
 *     thema's van dat genre erbij in extra_onderwerpen;
 *   - iets anders (zelf getypt): erbij in extra_onderwerpen, als nieuw thema.
 * Geeft het aantal boeken.
 */
function onderwerpNakijklijstToepassen(catalogus, rijen, onderwerpRijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var keuzes = onderwerpKeuzes(onderwerpRijen, catalogus);
  var vertaal = vertaalTabel(onderwerpRijen || []);
  var zoek = function (lijst, w) { return lijst.filter(function (x) { return normaliseerTekst(x) === normaliseerTekst(w); })[0]; };
  var n = 0;
  rijen.forEach(function (r) {
    if (jaNee(r.toepassen) !== 'ja' || isLeeg(r.onderwerp_nieuw)) return;
    var boek = perId[String(r.boek_id)];
    if (!boek) return;
    var lijst = splitsLijst(boek.extra_onderwerpen);
    var velden = {};
    var erbij = function (o) { if (!lijst.some(function (x) { return normaliseerTekst(x) === normaliseerTekst(o); })) lijst.push(schoon(o)); };
    splitsLijst(r.onderwerp_nieuw).forEach(function (o) {
      var thema = zoek(keuzes.themas, o);
      var genre = zoek(keuzes.genres, o);
      if (thema) erbij(thema);
      else if (genre && isLeeg(boek.genre) && !velden.genre) velden.genre = genre;
      else if (genre) (vertaal[normaliseerTekst(genre)] || []).forEach(erbij);
      else erbij(o);
    });
    if (lijst.join(', ') !== schoon(boek.extra_onderwerpen)) velden.extra_onderwerpen = lijst.join(', ');
    if (Object.keys(velden).length) wijzig(boek, velden);
    wijzig(r, { toepassen: 'gedaan' });
    n++;
  });
  return n;
}

/* ---------- In Apps Script ---------- */

var ONDERWERP_KOLOMMEN = ['boek_id', 'titel', 'auteur', 'genre', 'voorstel', 'onderwerp_nieuw', 'toepassen'];

/** Menu: ontbrekende onderwerpen aanvullen waar het zeker is, de rest op de nakijklijst. */
function vulOntbrekendeOnderwerpenMenu() {
  werkOnderwerpenBij(); // nieuwe genres eerst in Onderwerpen
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var onderwerpen = leesTabel('Onderwerpen');
    uit = vulOntbrekendeOnderwerpen(catalogus.rijen, onderwerpen.rijen);
    bewaarTabel(onderwerpen);
    if (uit.boeken.length) schrijfKolommen(catalogus, ['extra_onderwerpen']);
    var ss = spreadsheet();
    var blad = ss.getSheetByName(ONDERWERP_NAKIJKEN) || ss.insertSheet(ONDERWERP_NAKIJKEN);
    blad.clear();
    blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
    var waarden = [ONDERWERP_KOLOMMEN].concat(uit.nakijken.map(function (r) { return ONDERWERP_KOLOMMEN.map(function (k) { return r[k]; }); }));
    blad.getRange(1, 1, waarden.length, ONDERWERP_KOLOMMEN.length).setValues(waarden);
    opmaakKop(blad, ONDERWERP_KOLOMMEN.length);
    if (uit.nakijken.length) {
      var col = function (k) { return ONDERWERP_KOLOMMEN.indexOf(k) + 1; };
      blad.getRange(2, col('toepassen'), uit.nakijken.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee', 'gedaan'], true).setAllowInvalid(false).build());
      blad.getRange(2, col('onderwerp_nieuw'), uit.nakijken.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(onderwerpKeuzes(onderwerpen.rijen, catalogus.rijen).lijst.slice(0, 500), true).setAllowInvalid(true).build());
    }
  } finally {
    lock.releaseLock();
  }
  leegCache();
  var tekst = uit.genres.length + ' genres kregen een thema in Onderwerpen, ' + uit.boeken.length + ' boeken kregen meteen een thema (zeker). ' +
    uit.nakijken.length + ' boeken staan in het tabblad ' + ONDERWERP_NAKIJKEN + ': kies een thema in onderwerp_nieuw, zet toepassen op ja, ' +
    'en kies daarna Madrigal > Boeken > Onderwerpen: pas de nakijklijst toe.';
  logboek('menu', 'vulOntbrekendeOnderwerpen', tekst + (uit.genres.length ? ' Genres: ' + uit.genres.join(', ') + '.' : '') + (uit.boeken.length ? ' Boeken: ' + uit.boeken.join(', ') : ''));
  meld(tekst);
}

/** Menu: de nakijklijst toepassen. */
function pasOnderwerpNakijklijstToe() {
  if (!spreadsheet().getSheetByName(ONDERWERP_NAKIJKEN)) { meld('Maak eerst de lijst: Madrigal > Boeken > Onderwerpen: vul ontbrekende aan.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var catalogus = leesTabel('Catalogus');
    var lijst = leesTabel(ONDERWERP_NAKIJKEN);
    n = onderwerpNakijklijstToepassen(catalogus.rijen, lijst.rijen, leesTabel('Onderwerpen').rijen);
    schrijfKolommen(catalogus, ['extra_onderwerpen', 'genre']);
    schrijfKolommen(lijst, ['toepassen']);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  logboek('menu', 'pasOnderwerpNakijklijstToe', n + ' boeken kregen een thema');
  meld(n + ' boeken kregen een thema. Ze staan binnen enkele minuten in dat thema op de website.');
}
