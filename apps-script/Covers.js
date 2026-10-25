/**
 * Covers.js
 * Nog meer covers, voor boeken waar Open Library en Google Books er geen voor hadden.
 *
 *   A. Andere uitgaven via Open Library (dit bestand, menu "8. Zoek covers van andere uitgaven"):
 *      1. Open Library groepeert uitgaven per werk. Kent Open Library het ISBN, dan nemen we
 *         de cover van het werk (die kan van een herdruk of een andere vertaling zijn).
 *      2. Kent Open Library het ISBN niet, dan zoeken we op titel en auteur. Enkel als titel
 *         en achternaam goed overeenkomen, nemen we de cover over.
 *   B. Google Books via de browser van het bestuur (zie Beheer.js en bestuur-beheer.js).
 *
 * Elke cover die zo binnenkomt, krijgt in de kolom cover_bron vanwaar ze komt. Covers van
 * een andere uitgave kan je zo nakijken. cover_bron is nooit publiek.
 * Elk opgezocht boek krijgt een datum in cover_gezocht. Opnieuw laten zoeken? Maak die cel leeg.
 */

var CV_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var CV_PAUZE_MS = 1000; // Open Library vraagt om rustig te zoeken
var CV_ANDERE_UITGAVE = 'andere uitgave (Open Library)';
var CV_TITEL_AUTEUR = 'titel en auteur (Open Library)';

/** Heeft dit boek nog een cover nodig van een andere uitgave? */
function heeftAndereUitgaveNodig(boek) {
  if (!isLeeg(boek.cover_url) || !isLeeg(boek.cover_gezocht)) return false;
  return /^\d{13}$/.test(String(boek.isbn || '')) || !isLeeg(boek.titel);
}

/** Het adres van een cover bij Open Library, uit het nummer van die cover. */
function olCoverUrl(coverId) {
  return 'https://covers.openlibrary.org/b/id/' + coverId + '-M.jpg';
}

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

/** Zoekt bij Open Library. Geeft { docs } of { limiet: true }. */
function olZoek(parameters) {
  var r = haalJson('https://openlibrary.org/search.json?' + parameters + '&fields=key,title,author_name,cover_i&limit=5');
  if (r.code === 429 || r.code >= 500) return { limiet: true, code: r.code };
  return { docs: (r.data && r.data.docs) || [] };
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

var IA_BRON = 'Internet Archive';

/** Heeft dit boek nog een cover van Internet Archive nodig? */
function heeftIaNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.ia_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** De zoekvraag voor Internet Archive: het ISBN in 13 en in 10 cijfers. */
function iaZoekUrl(isbn) {
  var nummers = [String(isbn), isbn13Naar10(isbn)].filter(Boolean).join(' OR ');
  return 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('isbn:(' + nummers + ')') +
    '&fl%5B%5D=identifier&fl%5B%5D=title&rows=3&output=json';
}

/** De link naar de afbeelding van een boek bij Internet Archive. Enkel veilige namen. */
function iaCoverUrl(identifier) {
  var id = String(identifier || '');
  return /^[A-Za-z0-9._-]+$/.test(id) ? 'https://archive.org/services/img/' + id : '';
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

/** Een boekcover is staand. Een logo of pictogram is vierkant of liggend. */
function isStaandeCover(afm) {
  return !!afm && afm.breedte > 0 && afm.hoogte >= afm.breedte * 1.15;
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
