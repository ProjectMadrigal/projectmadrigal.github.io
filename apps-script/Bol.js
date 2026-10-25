/**
 * Bol.js
 * Covers via de Marketing Catalog API van bol.com, vooral nuttig voor Nederlandstalige boeken.
 *
 *   - Je hebt een (gratis) partneraccount bij bol.com nodig. Maak daar in de API-instellingen
 *     een Client ID en Client Secret, en zet die in Instellingen bij bol_client_id en
 *     bol_client_secret. Leeg: dit script doet niets.
 *   - Lees de voorwaarden van het partnerprogramma na: die API is bedoeld voor partners die
 *     bol.com-producten aanprijzen.
 *   - Het ISBN-13 van een boek is ook zijn EAN-code.
 *   - Elk opgezocht boek krijgt een datum in bol_gezocht. Opnieuw laten zoeken? Maak die cel leeg.
 */

var BOL_PAUZE_MS = 300;
var BOL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;
var BOL_API = 'https://api.bol.com/marketing/catalog/v1';

/** Heeft dit boek nog een cover van bol.com nodig? */
function heeftBolNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.bol_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** Een toegangsbewijs (token) van bol.com, 4 minuten bewaard. Geeft { token } of { fout }. */
function bolToken(inst) {
  if (!inst.bol_client_id || !inst.bol_client_secret) return { fout: 'Vul bol_client_id en bol_client_secret in bij Instellingen.' };
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get('bol_token');
  if (bewaard) return { token: bewaard };
  var r = UrlFetchApp.fetch('https://login.bol.com/token?grant_type=client_credentials', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(inst.bol_client_id + ':' + inst.bol_client_secret), Accept: 'application/json' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  if (r.getResponseCode() !== 200 || !data || !data.access_token) {
    return { fout: 'bol.com gaf geen toegang (code ' + r.getResponseCode() + '). Kijk de Client ID en Client Secret na.' };
  }
  cache.put('bol_token', data.access_token, 240);
  return { token: data.access_token };
}

/** Vraagt iets op bij de Marketing Catalog API. Geeft { code, data }. */
function bolVraag(pad, token) {
  var r = UrlFetchApp.fetch(BOL_API + pad, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Accept-Language': 'nl' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  return { code: r.getResponseCode(), data: data };
}

/**
 * Zoekt in een antwoord van bol.com de beste link naar een afbeelding. We weten niet zeker hoe
 * het antwoord eruitziet, dus we zoeken overal naar https-links naar afbeeldingen, en nemen
 * die met een breedte het dichtst bij 550 pixels (of anders de eerste).
 */
function bolAfbeelding(data) {
  var kandidaten = [];
  (function zoek(w, breedte) {
    if (!w) return;
    if (typeof w === 'string') {
      if (/^https:\/\/[^\s"'<>]+\.(jpe?g|png|webp)(\?[^\s"'<>]*)?$/i.test(w)) kandidaten.push({ url: w, breedte: breedte || 0 });
      return;
    }
    if (Array.isArray(w)) { w.forEach(function (x) { zoek(x, breedte); }); return; }
    if (typeof w === 'object') {
      var b = Number(w.width || w.breedte || 0) || breedte;
      Object.keys(w).forEach(function (k) { zoek(w[k], b); });
    }
  })(data, 0);
  if (!kandidaten.length) return '';
  kandidaten.sort(function (a, b) {
    var da = a.breedte ? Math.abs(a.breedte - 550) : 9999, db = b.breedte ? Math.abs(b.breedte - 550) : 9999;
    return da - db;
  });
  return kandidaten[0].url;
}

/** Menu: zoekt covers bij bol.com, in porties. */
function zoekCoversBol() {
  var start = Date.now();
  var inst = leesInstellingen();
  var t = bolToken(inst);
  if (t.fout) { logboek('menu', 'zoekCoversBol', t.fout); meld(t.fout); return; }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('bol_gezocht') === -1) { meld('De kolom bol_gezocht ontbreekt nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftBolNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BOL_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = bolVraag('/products/' + boek.isbn + '/media', t.token);
      if (r.code === 401) { t = bolToken(inst); if (t.fout) { fout = t.fout; break; } r = bolVraag('/products/' + boek.isbn + '/media', t.token); }
      if (r.code === 429 || r.code >= 500) { wachten = true; fout = 'code ' + r.code; break; }
      if (r.code >= 400 && r.code !== 404) { fout = 'code ' + r.code + (r.data && r.data.title ? ': ' + r.data.title : ''); break; }
      var url = r.code === 200 ? bolAfbeelding(r.data) : '';
      var velden = { bol_gezocht: vandaag };
      if (url) { velden.cover_url = url; velden.cover_bron = 'bol.com'; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 25 === 0) bewaarTabel(tabel);
      Utilities.sleep(BOL_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftBolNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekCoversBol');
  if (rest > 0 && (!fout || wachten)) ScriptApp.newTrigger('zoekCoversBol').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversBol', verwerkt + ' opgezocht, ' + gevonden + ' covers gevonden, ' + rest + ' te gaan' + (fout ? '. bol.com meldt: ' + fout : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij bol.com, ' + gevonden + ' covers gevonden.' + (fout ? ' bol.com meldt: ' + fout : ''), 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/** Menu: test bol.com met één ISBN en toont wat bol.com teruggeeft. */
function testBol() {
  var isbn = '9789044641035';
  try {
    var eigen = normaliseerIsbn(String(SpreadsheetApp.getActiveRange().getValue() || '')).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var t = bolToken(leesInstellingen());
  if (t.fout) { meld(t.fout); return; }
  var r = bolVraag('/products/' + isbn + '/media', t.token);
  var tekst = 'bol.com, ISBN ' + isbn + ': code ' + r.code + '. Afbeelding: ' + (bolAfbeelding(r.data) || 'geen gevonden') +
    '. Antwoord (begin): ' + JSON.stringify(r.data || '').slice(0, 400);
  logboek('menu', 'testBol', tekst);
  meld(tekst);
}
