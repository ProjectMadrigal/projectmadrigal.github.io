/**
 * OpenLibrary.js
 * Vult wat nog ontbreekt aan via de gratis Open Library-API, plus een link naar de cover.
 *
 * Een script mag hoogstens 6 minuten draaien. Daarom werken we in porties:
 *   - elk boek dat we opvroegen, krijgt een datum in de kolom ol_gecontroleerd;
 *   - na ongeveer 4,5 minuten stopt het script en plant het zichzelf opnieuw in,
 *     een minuut later. Dat herhaalt zich tot alles verwerkt is.
 * Wil je een boek opnieuw laten opzoeken? Maak de cel ol_gecontroleerd leeg.
 *
 * Gebruiksvoorwaarden van Open Library: we vragen in groepjes van 20 ISBN's op,
 * wachten 1,5 seconde tussen twee opvragingen en sturen een herkenbare naam mee.
 */

var OL_PORTIE = 20;
var OL_PAUZE_MS = 1500;
var OL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var OL_TALEN = { eng: 'Engels', dut: 'Nederlands', fre: 'Frans', ger: 'Duits', spa: 'Spaans', ita: 'Italiaans', por: 'Portugees' };

/** Velden die Open Library kan aanvullen. */
var OL_VELDEN = ['uitgeverij', 'jaartal', 'paginas', 'taal', 'beschrijving', 'cover_url'];

/** Heeft dit boek nog iets nodig van Open Library? */
function heeftOpenLibraryNodig(boek) {
  var isbn = String(boek.isbn || '');
  if (!/^\d{13}$/.test(isbn)) return false;
  if (!isLeeg(boek.ol_gecontroleerd)) return false;
  return OL_VELDEN.some(function (v) { return isLeeg(boek[v]); });
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

/** Menu: vult de Catalogus aan uit Open Library, in porties. */
function vulAanUitOpenLibrary() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulAanUitOpenLibrary')) return;
  if (!startAchtergrond('vulAanUitOpenLibrary')) {
    meldAlBezig('vulAanUitOpenLibrary');
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
      var antwoord = haalExtern(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': BS_USER_AGENT } // zie Beschrijvingen.js
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
      bewaarAchtergrond(tabel);
      Utilities.sleep(OL_PAUZE_MS);
    }
    rest = tabel.rijen.filter(heeftOpenLibraryNodig).length;
  } finally {
    stopAchtergrond('vulAanUitOpenLibrary');
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

/** Verwijdert geplande uitvoeringen van een functie. */
function verwijderTriggers(functienaam) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === functienaam) ScriptApp.deleteTrigger(t);
  });
}
