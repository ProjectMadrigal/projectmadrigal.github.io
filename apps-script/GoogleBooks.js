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
 * Menu: test Google Books met één ISBN, op dezelfde manier als het script zoekt (met de sleutel, land BE).
 * Zonder ISBN in de gekozen cel: een boek dat Google zeker kent.
 */
function testGoogleBooks() {
  var isbn = '9780141439518'; // Pride and Prejudice (Penguin Classics): Google kent dit boek zeker
  try {
    var cel = String(SpreadsheetApp.getActiveRange().getValue() || '');
    var eigen = normaliseerIsbn(cel).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var sleutel = leesInstellingen().google_books_api_key;
  var r = googleBooksZoek(isbn, sleutel);
  // Kent Google dit boek niet, dan kijken we of Google wel een bekend boek kent: zo weet je of het aan het boek ligt.
  var werkt = r.fout ? false : (r.items.length ? true : googleBooksWerkt(sleutel));
  var tekst = googleTestTekst(isbn, r, sleutel, werkt);
  logboek('menu', 'testGoogleBooks', tekst.replace(/\n/g, ' | '));
  meld(tekst);
}

/** De uitkomst van de test in gewone woorden. r: het antwoord van googleBooksZoek. */
function googleTestTekst(isbn, r, sleutel, werkt) {
  var info = r.items.length ? r.items[0].volumeInfo : null;
  var regels = [];
  if (r.fout) {
    regels.push('Google Books werkt niet.');
    regels.push(r.limiet ? 'De daglimiet van je sleutel is op. Het script gaat vanzelf verder rond 9 uur in de ochtend.' : 'Google meldt: ' + r.fout);
  } else if (info) {
    regels.push('Google Books werkt.');
    regels.push('ISBN ' + isbn + ': "' + (info.title || '?') + '", cover ' + (info.imageLinks ? 'ja' : 'nee') + ', beschrijving ' + (info.description ? 'ja' : 'nee') + '.');
  } else if (werkt) {
    regels.push('Google Books werkt, maar kent ISBN ' + isbn + ' niet.');
  } else {
    regels.push('Google Books werkt niet: Google kent zelfs een bekend boek niet. Kijk de google_books_api_key in Instellingen na.');
  }
  if (!sleutel) regels.push('Er staat geen google_books_api_key in Instellingen.');
  return regels.join('\n');
}

/** Kent Google Books een boek dat het zeker kent? Zo weten we of de verbinding en de sleutel werken. */
function googleBooksWerkt(sleutel) {
  return googleBooksZoek('9780141439518', sleutel).items.length > 0; // Pride and Prejudice
}

/**
 * Hoeveel minuten tot de daglimiet van Google weer vrij is. Google zet die limiet om middernacht
 * in Californië terug op nul. We wachten tot 10 minuten daarna. uur en minuut: de tijd nu in Californië.
 */
function minutenTotGoogleReset(uur, minuut) {
  return 24 * 60 - (uur * 60 + minuut) + 10;
}

/** Hoeveel minuten wachten na de daglimiet van Google Books. Lukt de berekening niet: 6 uur. */
function wachtNaGoogleLimiet() {
  try {
    var t = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'H:m').split(':');
    return minutenTotGoogleReset(Number(t[0]), Number(t[1]));
  } catch (e) {
    return 6 * 60;
  }
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
  if (wachtOpDaglimiet('vulAanUitGoogleBooks')) return;
  if (!startAchtergrond('vulAanUitGoogleBooks')) {
    meldAlBezig('vulAanUitGoogleBooks');
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
      // Kent Google na 20 boeken nog geen enkel boek, dan vragen we een boek dat Google zeker kent.
      // Kent Google ook dat niet, dan klopt er iets niet (sleutel, land, ...): stoppen en niets aanvinken.
      // Kent Google het wel, dan zijn het gewoon moeilijke boeken (bv. Nederlandstalig of oud) en gaan we verder.
      if (verwerkt === 20 && gekend === 0 && !googleBooksWerkt(sleutel)) {
        verdacht = true;
        gedaan.forEach(function (b) { wijzig(b, { gb_gecontroleerd: '' }); });
        break;
      }
      // Om de 25 boeken bewaren: zo gaat er niets verloren als het script stopt.
      if (verwerkt % 25 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(GB_PAUZE_MS);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftGoogleBooksNodig).length;
  } finally {
    stopAchtergrond('vulAanUitGoogleBooks');
  }
  verwijderTriggers('vulAanUitGoogleBooks');
  if (verdacht) {
    var waarschuwing = 'Google Books kende geen enkel boek van de eerste 20. Er klopt iets niet: het script stopt en vinkt niets aan. Kies Madrigal > Covers > Test Google Books.';
    logboek('menu', 'vulAanUitGoogleBooks', waarschuwing);
    meld(waarschuwing);
    return;
  }
  if (rest > 0) {
    // Daglimiet: wachten tot Google ze terugzet (rond 9 uur 's ochtends bij ons). Storing bij Google: een kwartier. Anders: een minuut.
    var minuten = limiet ? wachtNaGoogleLimiet() : (storing ? 15 : 1);
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
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google is bereikt: het script gaat vanzelf verder als Google ze terugzet, rond 9 uur in de ochtend.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt. Het script zoekt nu nog ontbrekende beschrijvingen.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}
