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
  // Wat Google op elke vraag antwoordde, onderaan in de melding: zo zie je wat er gebeurt.
  var details = [];
  // De titel en auteur: van een bekend boek, of uit de Catalogus (dan telt ook een andere uitgave).
  var titels = Object.assign({}, GB_CONTROLE_BOEKEN);
  if (!titels[isbn]) {
    try {
      var rij = leesTabel('Catalogus').rijen.filter(function (b) { return normaliseerIsbn(b.isbn).isbn === isbn; })[0];
      if (rij) titels[isbn] = { titel: rij.titel, auteur: rij.auteur };
    } catch (e) { /* zonder titel */ }
  }
  var zoek = function (x) {
    var antwoord = googleBooksZoek(x, sleutel, undefined, titels[x]);
    details.push(x + ': ' + (antwoord.pogingen || []).join(' / '));
    return antwoord;
  };
  var r = zoek(isbn);
  // Kent Google dit boek niet, dan kijken we of Google wel een bekend boek kent: zo weet je of het aan het boek ligt.
  var controle = r.fout || r.items.length ? { werkt: !r.fout, fout: null } : googleBooksControle(sleutel, zoek);
  var tekst = googleTestTekst(isbn, controle.fout || r, sleutel, controle.werkt, controle.vreemd) + '\nWat Google antwoordde (' + (sleutel ? 'met' : 'zonder') + ' sleutel, land BE): ' + details.join(' | ');
  logboek('menu', 'testGoogleBooks', tekst.replace(/\n/g, ' | '));
  meld(tekst);
}

/** De uitkomst van de test in gewone woorden. r: het antwoord van googleBooksZoek. */
function googleTestTekst(isbn, r, sleutel, werkt, vreemd) {
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
  } else if (vreemd) {
    regels.push('Google Books zoekt nu verkeerd: op het ISBN van een bekend boek komen andere boeken terug. Dat ligt bij Google, niet bij je sleutel.');
    regels.push('Het script vinkt zolang geen boeken af als "niet gevonden". Probeer de test morgen opnieuw.');
  } else {
    // Geen fout, maar ook geen bekend boek: dat gebeurt soms even bij Google. Later opnieuw proberen.
    regels.push('Google Books gaf geen enkel boek terug, ook geen boek dat het zeker kent, en meldde geen fout. Probeer de test over een uur opnieuw. Blijft het zo, kijk dan de google_books_api_key in Instellingen na.');
  }
  if (!sleutel) regels.push('Er staat geen google_books_api_key in Instellingen.');
  return regels.join('\n');
}

/** Waarom een ronde stopte en wanneer het script verdergaat, voor het Logboek. Leeg als het gewoon doorloopt. */
function googleRondeReden(limiet, storing, fout, rest) {
  if (!rest) return '';
  if (limiet) return (!fout || /quota|limit/i.test(fout) ? ' (daglimiet van Google bereikt' : ' (Google weigert') + ', gaat vanzelf verder rond 9 uur in de ochtend)';
  if (storing) return ' (storing bij Google, gaat over 15 minuten vanzelf verder)';
  return '';
}

// Boeken die Google zeker kent: Pride and Prejudice (Penguin Classics) en To Kill a Mockingbird (Harper Perennial).
var GB_CONTROLE_ISBNS = ['9780141439518', '9780061120084'];
var GB_CONTROLE_BOEKEN = { '9780141439518': { titel: 'Pride and Prejudice', auteur: 'Austen, Jane' }, '9780061120084': { titel: 'To Kill a Mockingbird', auteur: 'Lee, Harper' } };

/**
 * Kent Google Books een boek dat het zeker kent? Zo weten we of de verbinding en de sleutel werken.
 * Geeft { werkt, fout, vreemd } terug. fout: het antwoord van Google als dat een fout was (daglimiet, storing, sleutel).
 * vreemd: Google gaf andere boeken terug dan het bekende boek (Google zoekt dan verkeerd, zoals op 29/10/2026).
 * zoek(isbn): standaard googleBooksZoek met de sleutel (een andere functie kan in de tests).
 */
function googleBooksControle(sleutel, zoek) {
  zoek = zoek || function (isbn) { return googleBooksZoek(isbn, sleutel, undefined, GB_CONTROLE_BOEKEN[isbn]); };
  var vreemd = false;
  for (var i = 0; i < GB_CONTROLE_ISBNS.length; i++) {
    var r = zoek(GB_CONTROLE_ISBNS[i]);
    if (r.items.length) return { werkt: true, fout: null, vreemd: false };
    if (r.fout) return { werkt: false, fout: r, vreemd: false };
    // Google gaf wel boeken terug, maar niet dit bekende boek: dan geeft Google verkeerde resultaten.
    if (r.totaal > 0) vreemd = true;
  }
  return { werkt: false, fout: null, vreemd: vreemd };
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
  var verwerkt = 0, aangevuld = 0, rest = 0, limiet = false, fout = '', gekend = 0, storing = false, verdacht = false, vreemd = false;
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
      var antwoord = googleBooksZoek(boek.isbn, sleutel, undefined, boek); // zie Beschrijvingen.js
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
      // Kent Google ook dat niet: bij de daglimiet of een storing wachten, anders klopt er iets niet (sleutel, land, ...).
      // Kent Google het wel, dan zijn het gewoon moeilijke boeken (bv. Nederlandstalig of oud) en gaan we verder.
      if (verwerkt === 20 && gekend === 0) {
        var controle = googleBooksControle(sleutel);
        if (!controle.werkt) {
          // Niets aanvinken: deze boeken komen later opnieuw aan de beurt.
          gedaan.forEach(function (b) { wijzig(b, { gb_gecontroleerd: '' }); });
          if (controle.fout && controle.fout.limiet) { limiet = true; fout = controle.fout.fout; }
          else if (controle.fout && controle.fout.code >= 500) { storing = true; fout = controle.fout.fout; }
          else { verdacht = true; vreemd = controle.vreemd; }
          break;
        }
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
    var waarschuwing = vreemd
      ? 'Google Books zoekt nu verkeerd: op het ISBN van een bekend boek komen andere boeken terug. Het script stopt en vinkt niets aan. Probeer het morgen opnieuw.'
      : 'Google Books kende geen enkel boek van de eerste 20. Er klopt iets niet: het script stopt en vinkt niets aan. Kies Madrigal > Covers > Test Google Books.';
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
  var reden = googleRondeReden(limiet, storing, fout, rest);
  logboek('menu', 'vulAanUitGoogleBooks', verwerkt + ' opgevraagd, ' + gekend + ' gekend bij Google, ' + aangevuld + ' covers gevonden, ' + rest + ' te gaan' + reden + (fout ? '. Google meldt: ' + fout : '') + (sleutel ? '' : '. Er staat geen google_books_api_key in Instellingen.'));
  var tekst = verwerkt + ' boeken opgevraagd bij Google Books, ' + aangevuld + ' covers gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google is bereikt: het script gaat vanzelf verder als Google ze terugzet, rond 9 uur in de ochtend.'
    : storing ? ' Google heeft een storing: het script gaat over 15 minuten vanzelf verder.'
    : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt. Het script zoekt nu nog ontbrekende beschrijvingen.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}
