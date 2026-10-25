/**
 * Beschrijvingen.js
 * Zoekt een korte beschrijving voor boeken waar de kolom beschrijving nog leeg is.
 *
 *   1. Google Books (op ISBN). Heeft vaak een flaptekst, soms in de taal van het boek.
 *   2. Lukt dat niet: Open Library. De beschrijving staat daar bij het "werk",
 *      niet bij de uitgave. Daarom zoeken we eerst de uitgave op en dan het werk.
 *
 *   - Goodreads geeft geen beschrijvingen: niet in de export, en Goodreads heeft
 *     geen open API meer. Daarom gebruiken we die bron hier niet.
 *   - Enkel boeken met een ISBN. Zines en boeken zonder ISBN vul je zelf in.
 *   - Een beschrijving die je zelf invult, overschrijft het script nooit.
 *   - Elk opgezocht boek krijgt een datum in de kolom beschrijving_gezocht.
 *     Opnieuw laten zoeken? Maak die cel leeg.
 *   - Google Books: met een API-sleutel (instelling google_books_api_key) krijg je een
 *     eigen daglimiet. Zonder sleutel deelt Google een kleine limiet met veel andere gebruikers.
 *   - Weigert Google, dan zoekt het script gewoon verder bij Open Library. Een boek dat
 *     Open Library niet kent, krijgt "OL" + de datum (bv. OL 20261024) in beschrijving_gezocht: Google
 *     zoekt het later nog op, zodra de limiet weer vrij is.
 *   - Daarna vertaalt het script elke beschrijving met Google Translate (gratis
 *     in Apps Script): de Nederlandse versie komt in beschrijving, de Engelse in
 *     beschrijving_en. De website toont de versie in de gekozen taal.
 *   - Werkt in porties van 4,5 minuten en plant zichzelf opnieuw in, net als
 *     Open Library en Google Books. Google Books start dit vanzelf als het klaar is.
 */

var BS_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
// Een beschrijving blijft volledig tot deze lengte. Is ze langer, dan stopt ze na
// de laatste volledige zin, nooit midden in een zin.
var BS_MAX_LENGTE = 2500;
// Herkenbare naam met een link naar de website: Wikipedia en Open Library vragen dat van elk script,
// en remmen naamloze scripts sneller af.
var BS_USER_AGENT = 'ProjectMadrigal-catalogus/1.0 (https://projectmadrigal.github.io; queer bibliotheek Antwerpen; Google Apps Script)';

/** Open Library gaf niets terwijl Google weigerde: Google moet het nog opzoeken. */
var BS_ENKEL_OL = 'OL ';

/** Moet het script voor dit boek nog een beschrijving zoeken? (Ook als enkel Google nog moet.) */
function heeftBeschrijvingNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.beschrijving_gezocht) && !wachtOpGoogle(boek)) return false;
  return isLeeg(boek.beschrijving);
}

/** Zocht enkel Open Library al, en moet Google dit boek nog opzoeken? */
function wachtOpGoogle(boek) {
  return String(boek.beschrijving_gezocht || '').indexOf(BS_ENKEL_OL) === 0;
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

/** ISBN-13 (978…) naar ISBN-10. Geeft '' als dat niet kan. */
function isbn13Naar10(isbn13) {
  var s = String(isbn13 || '');
  if (!/^978\d{10}$/.test(s)) return '';
  var kern = s.slice(3, 12), som = 0;
  for (var i = 0; i < 9; i++) som += (10 - i) * Number(kern.charAt(i));
  var c = (11 - (som % 11)) % 11;
  return kern + (c === 10 ? 'X' : String(c));
}

/** Enkel de uitgaven met precies dit ISBN (13 of 10 cijfers). */
function googleItemsMetIsbn(items, isbn) {
  var gezocht = [String(isbn), isbn13Naar10(isbn)].filter(Boolean);
  return (items || []).filter(function (it) {
    var ids = (it && it.volumeInfo && it.volumeInfo.industryIdentifiers) || [];
    return ids.some(function (id) { return gezocht.indexOf(String(id.identifier || '').replace(/[^0-9X]/gi, '').toUpperCase()) > -1; });
  });
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

/** De foutmelding uit een antwoord van Google, kort. */
function googleFout(data) {
  var e = data && data.error;
  if (!e) return '';
  var reden = e.errors && e.errors[0] && e.errors[0].reason ? ' (' + e.errors[0].reason + ')' : '';
  return String(e.message || e.status || '').replace(/\s+/g, ' ').slice(0, 200) + reden;
}

/** Gaat een fout van Google over de daglimiet, of over iets anders (sleutel, API uit, ...)? */
function isGoogleLimiet(code, fout) {
  if (code === 429) return true;
  return code === 403 && /quota|rate ?limit|dailyLimit|userRateLimit|limitExceeded/i.test(String(fout || ''));
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

/** Werd deze beschrijving vroeger afgebroken (eindigt ze op "...")? */
function isAfgebroken(tekst) {
  return /(\.\.\.|…)\s*$/.test(String(tekst || ''));
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

/** Een beschrijving uit Open Library: tekst, of een object met value. */
function olTekst(description) {
  if (!description) return '';
  return typeof description === 'string' ? description : String(description.value || '');
}

/** Haalt JSON op. Geeft { code, data } terug. */
function haalJson(url) {
  // Api-User-Agent: de manier die Wikipedia aanraadt om je script te herkennen.
  var antwoord = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT, 'Api-User-Agent': BS_USER_AGENT } });
  var data = null;
  try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = null; }
  return { code: antwoord.getResponseCode(), data: data };
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

/** Menu: zoekt beschrijvingen voor boeken waar die nog ontbreekt, in porties. */
function vulBeschrijvingenAan() {
  var start = Date.now();
  if (!startAchtergrond('vulBeschrijvingenAan')) {
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
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(400);
    }
    bewaarAchtergrond(tabel);
    var nog = tabel.rijen.filter(heeftBeschrijvingNodig);
    rest = nog.length;
    // Nog boeken die niemand opzocht: over een minuut verder (Open Library werkt nog).
    // Enkel nog Google nodig en Google weigert: over 6 uur.
    var nieuwTeDoen = nog.filter(function (b) { return !wachtOpGoogle(b); }).length;
    limiet = limiet && nieuwTeDoen === 0;
  } finally {
    stopAchtergrond('vulBeschrijvingenAan');
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

/** Moet deze beschrijving nog vertaald worden? */
function heeftVertalingNodig(boek) {
  return !isLeeg(boek.beschrijving) && isLeeg(boek.beschrijving_vertaald);
}

/** Vergelijkt twee teksten zonder hoofdletters, leestekens en spaties. */
function zelfdeTekst(a, b) {
  var kaal = function (t) { return normaliseerTekst(t).replace(/[^a-z0-9]/g, ''); };
  return kaal(a) === kaal(b);
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

/** Plant de vertaling over een paar minuten (één keer). */
function planVertaling(minuten) {
  verwijderTriggers('vertaalBeschrijvingen');
  ScriptApp.newTrigger('vertaalBeschrijvingen').timeBased().after(minuten * 60 * 1000).create();
}

/** Menu: vertaalt de beschrijvingen naar het Nederlands en het Engels, in porties. */
function vertaalBeschrijvingen() {
  var start = Date.now();
  if (!startAchtergrond('vertaalBeschrijvingen')) { planVertaling(5); return; } // een andere bewerking loopt: straks opnieuw
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
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(200);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftVertalingNodig).length;
  } finally {
    stopAchtergrond('vertaalBeschrijvingen');
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
