/**
 * GoogleBooks.js
 * Tweede bron, na Open Library: zoekt via de gratis Google Books-API een cover
 * (en wat dan nog ontbreekt) voor boeken met een ISBN die nog geen cover hebben.
 *
 *   - Enkel lege velden worden aangevuld. Een cover-link die je zelf in
 *     cover_url zette, blijft altijd staan.
 *   - Elk opgezocht boek krijgt een datum in de kolom gb_gecontroleerd.
 *     Wil je een boek opnieuw laten opzoeken? Maak die cel leeg.
 *   - Zonder API-sleutel staat Google maar een beperkt aantal opvragingen per dag
 *     toe, gedeeld met veel andere gebruikers. Is de limiet bereikt, dan stopt het script en probeert het een paar
 *     uur later vanzelf opnieuw. Met een sleutel (instelling google_books_api_key)
 *     gaat het sneller.
 *   - Open Library start dit script vanzelf als het klaar is.
 */

var GB_PAUZE_MS = 400;
var GB_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var GB_TALEN = { nl: 'Nederlands', en: 'Engels', fr: 'Frans', de: 'Duits', es: 'Spaans', it: 'Italiaans', pt: 'Portugees' };

/** Heeft dit boek nog een cover nodig van Google Books? */
function heeftGoogleBooksNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.gb_gecontroleerd)) return false;
  return isLeeg(boek.cover_url);
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
  // Google heeft de omschrijving van het boek zelf: die vervangt ook een tekst van Wikipedia.
  var wiki = heeftWikiBeschrijving(boek);
  if ((isLeeg(boek.beschrijving) || wiki) && info.description) {
    var b = schoon(String(info.description).replace(/<[^>]*>/g, ' '));
    if (b) {
      v.beschrijving = maakBeschrijvingNetjes(b);
      if (wiki) { v.beschrijving_bron = ''; v.beschrijving_en = ''; v.beschrijving_vertaald = ''; }
    }
  }
  return v;
}

/** De beschrijving komt van Wikipedia (dan staat er een link naar Wikipedia in beschrijving_bron). */
function heeftWikiBeschrijving(boek) {
  return !isLeeg(boek.beschrijving) && /^https:\/\/[a-z]{2,3}\.wikipedia\.org\//.test(String(boek.beschrijving_bron || ''));
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

/** Menu: boeken zonder cover nog eens laten opzoeken bij Google (maakt gb_gecontroleerd leeg). */
function zoekCoversOpnieuw() {
  var tabel = leesTabel('Catalogus');
  var n = 0;
  tabel.rijen.forEach(function (b) {
    if ((isLeeg(b.cover_url) || isLeeg(b.beschrijving) || heeftWikiBeschrijving(b)) && !isLeeg(b.gb_gecontroleerd) && /^\d{13}$/.test(String(b.isbn || ''))) {
      wijzig(b, { gb_gecontroleerd: '' });
      n++;
    }
  });
  bewaarTabel(tabel);
  logboek('menu', 'zoekCoversOpnieuw', n + ' boeken zonder cover of beschrijving (of met een tekst van Wikipedia) komen opnieuw aan de beurt bij Google');
  meld(n + ' boeken zonder cover of beschrijving (of met een tekst van Wikipedia) komen opnieuw aan de beurt bij Google. Gebruik daarna de knop in het bestuursscherm: Boeken > Zoek ontbrekende covers en beschrijvingen.');
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
    var waarschuwing = 'Google Books kende geen enkel boek van de eerste 20. Er klopt iets niet: het script stopt en vinkt niets aan. Kies Madrigal > Covers > Test Google Books.';
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
