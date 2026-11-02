/**
 * Hulp.js
 * Kleine hulpfuncties voor tekst, ISBN, getallen en datums.
 * Deze functies raken de spreadsheet niet aan, zodat de tests ze kunnen gebruiken.
 */

/** Lidwoorden die we negeren bij zoeken en vergelijken (Nederlands, Engels, Frans, Duits). */
var LIDWOORDEN = ['de', 'het', 'een', 'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'el', 'los', 'las'];

/** Geeft true als een waarde leeg is (niets, lege tekst of enkel spaties). */
function isLeeg(waarde) {
  return waarde === null || waarde === undefined || String(waarde).trim() === '';
}

/** Haalt spaties aan begin en einde weg en maakt dubbele spaties enkel. */
function schoon(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\s+/g, ' ').trim();
}

/** Zoals schoon, maar regeleinden en lege regels (alinea's) blijven. */
function schoonMetRegels(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Kleine letters, zonder accenten en leestekens. "Émile Zola!" wordt "emile zola". */
function normaliseerTekst(waarde) {
  return schoon(waarde)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Woorden van een tekst, zonder lidwoorden (tenzij er dan niets overblijft). */
function woorden(waarde) {
  var alle = normaliseerTekst(waarde).split(' ').filter(function (w) { return w; });
  var zonder = alle.filter(function (w) { return LIDWOORDEN.indexOf(w) === -1; });
  return zonder.length ? zonder : alle;
}

/**
 * Sleutel om titels te vergelijken: zonder ondertitel (na ":"), zonder reeksinfo
 * tussen haakjes en zonder lidwoorden.
 */
function titelSleutel(titel) {
  var t = schoon(titel).replace(/\(.*?\)/g, ' ').split(':')[0];
  return woorden(t).join(' ');
}

/**
 * Achternaam uit "Achternaam, Voornaam" of "Voornaam Achternaam", genormaliseerd,
 * zonder tussenvoegsel.
 * Bij meerdere auteurs (gescheiden door ; of &) nemen we de eerste.
 */
function achternaam(auteur) {
  var eerste = schoon(auteur).split(/;|&| en | and /)[0];
  // "van Babylon, Dirk" en "Babylon, Dirk van" geven allebei "babylon":
  // we nemen het laatste woord, zodat tussenvoegsels geen rol spelen.
  var delen = normaliseerTekst(eerste.indexOf(',') > -1 ? eerste.split(',')[0] : eerste).split(' ');
  return delen[delen.length - 1] || '';
}

/** Levenshtein-afstand: het aantal tikfouten tussen twee woorden. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var vorige = [];
  for (var j = 0; j <= b.length; j++) vorige[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var huidige = [i];
    for (var k = 1; k <= b.length; k++) {
      var kost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + kost);
    }
    vorige = huidige;
  }
  return vorige[b.length];
}

/** Gelijkenis tussen twee teksten, van 0 (niets gemeen) tot 1 (gelijk). */
function gelijkenis(a, b) {
  if (!a && !b) return 1;
  var max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** Maakt ja/nee eenvormig. Geeft 'ja', 'nee' of '' terug. */
function jaNee(waarde) {
  if (waarde === true) return 'ja';
  if (waarde === false) return 'nee';
  var t = normaliseerTekst(waarde);
  if (['ja', 'j', 'yes', 'y', 'waar', 'true', 'x', '1'].indexOf(t) > -1) return 'ja';
  if (['nee', 'n', 'no', 'onwaar', 'false', '0'].indexOf(t) > -1) return 'nee';
  return '';
}

/** Maakt de taal eenvormig: "engels", "EN" en "English" worden "Engels". */
function normaliseerTaal(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  var tabel = {
    'nederlands': 'Nederlands', 'nl': 'Nederlands', 'dutch': 'Nederlands', 'vlaams': 'Nederlands', 'ned': 'Nederlands',
    'engels': 'Engels', 'en': 'Engels', 'english': 'Engels', 'eng': 'Engels',
    'frans': 'Frans', 'fr': 'Frans', 'french': 'Frans', 'francais': 'Frans', 'fre': 'Frans',
    'duits': 'Duits', 'de': 'Duits', 'german': 'Duits', 'deutsch': 'Duits', 'ger': 'Duits',
    'spaans': 'Spaans', 'es': 'Spaans', 'spanish': 'Spaans', 'spa': 'Spaans'
  };
  if (tabel[t]) return tabel[t];
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Maakt de uitvoering eenvormig (Hardcover, Paperback, Pocket). */
function normaliseerUitvoering(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  if (t.indexOf('hard') > -1 || t === 'gebonden') return 'Hardcover';
  if (t.indexOf('pocket') > -1 || t.indexOf('mass market') > -1) return 'Pocket';
  if (t.indexOf('paper') > -1 || t.indexOf('soft') > -1 || t === 'ingenaaid') return 'Paperback';
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- ISBN ---------- */

/** Controleert het controlecijfer van een ISBN-10 (10 tekens, laatste mag X zijn). */
function isbn10Geldig(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 10; i++) {
    var c = isbn.charAt(i);
    som += (c === 'X' ? 10 : Number(c)) * (10 - i);
  }
  return som % 11 === 0;
}

/** Controleert het controlecijfer van een ISBN-13. */
function isbn13Geldig(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(isbn.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return (10 - (som % 10)) % 10 === Number(isbn.charAt(12));
}

/** Zet een (geldig) ISBN-10 om naar ISBN-13: 978 ervoor en een nieuw controlecijfer. */
function isbn10Naar13(isbn10) {
  var basis = '978' + isbn10.slice(0, 9);
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(basis.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return basis + ((10 - (som % 10)) % 10);
}

/**
 * Normaliseert een ISBN of ISSN zoals het in de stocklijst staat.
 * Geeft een object terug:
 *   isbn:    het ISBN-13 als het geldig is, anders ''
 *   issn:    het ISSN (formaat 1234-5678) als het een ISSN is, anders ''
 *   geldig:  true als het nummer klopt
 *   leeg:    true als er niets ingevuld was
 */
function normaliseerIsbn(waarde) {
  var ruw = schoon(waarde).toUpperCase();
  if (!ruw) return { isbn: '', issn: '', geldig: false, leeg: true };
  // Een getal uit de spreadsheet kan als 9.78E+12 binnenkomen: zet het eerst om.
  if (typeof waarde === 'number') ruw = String(Math.round(waarde));
  var tekens = ruw.replace(/^ISBN|^ISSN/, '').replace(/[^0-9X]/g, '');
  if (tekens.length === 10 && isbn10Geldig(tekens)) return { isbn: isbn10Naar13(tekens), issn: '', geldig: true, leeg: false };
  if (tekens.length === 13 && isbn13Geldig(tekens)) return { isbn: tekens, issn: '', geldig: true, leeg: false };
  if (tekens.length === 8) return { isbn: '', issn: tekens.slice(0, 4) + '-' + tekens.slice(4), geldig: true, leeg: false };
  return { isbn: '', issn: '', geldig: false, leeg: false };
}

/* ---------- Getallen en datums ---------- */

/** Zet "5", "5,00", "€ 5" of 5 om naar het getal 5. Geeft null als er geen getal in staat. */
function parseerGetal(waarde) {
  if (typeof waarde === 'number') return isNaN(waarde) ? null : waarde;
  var m = schoon(waarde).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Vult aan met nullen: 7 wordt "07". */
function tweeCijfers(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Is dit een Date-object (zoals de spreadsheet datums teruggeeft)? */
function isDatumObject(waarde) {
  return Object.prototype.toString.call(waarde) === '[object Date]' && !isNaN(waarde.getTime());
}

/**
 * Zet een datum om naar tekst "JJJJ-MM-DD".
 * Werkt met een Date-object, "2026-11-20", "20/11/2026", "20-11-2026" of "20.11.26".
 * Geeft '' als het geen datum is.
 */
function parseerDatum(waarde) {
  if (isLeeg(waarde)) return '';
  if (isDatumObject(waarde)) {
    return waarde.getFullYear() + '-' + tweeCijfers(waarde.getMonth() + 1) + '-' + tweeCijfers(waarde.getDate());
  }
  var t = schoon(waarde);
  var m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return geldigeDatum(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var jaar = Number(m[3]);
    if (jaar < 100) jaar += 2000;
    return geldigeDatum(jaar, Number(m[2]), Number(m[1]));
  }
  return '';
}

/** Hulp voor parseerDatum: controleert of dag en maand bestaan. */
function geldigeDatum(jaar, maand, dag) {
  var d = new Date(Date.UTC(jaar, maand - 1, dag));
  if (d.getUTCFullYear() !== jaar || d.getUTCMonth() !== maand - 1 || d.getUTCDate() !== dag) return '';
  return jaar + '-' + tweeCijfers(maand) + '-' + tweeCijfers(dag);
}

/**
 * Maakt een tekst veilig om in een cel te schrijven.
 * Tekst die met = + - of @ begint, zou de spreadsheet als formule lezen.
 * Telefoonnummers met een 0 vooraan en lange cijferreeksen (ISBN) blijven tekst.
 */
function veiligeCel(waarde) {
  if (typeof waarde !== 'string') return waarde;
  if (/^[=+\-@]/.test(waarde) || /^0\d/.test(waarde) || /^\d{8,}$/.test(waarde)) return "'" + waarde;
  return waarde;
}

/** Splitst een lijst in een cel ("a, b; c") in losse, opgeschoonde waarden. */
function splitsLijst(waarde) {
  return schoon(waarde).split(/[,;\n]+/).map(schoon).filter(function (x) { return x; });
}

/* ---------- Tekst uit HTML ---------- */

/**
 * Tekst uit HTML: zonder tags, en tekens zoals &amp;, &#39;, &#x27; en &rsquo; terug naar gewone tekens.
 * Gebruikt voor Letterboxd (Films.js) en bol.com (Aankoop.js).
 */
var HTML_NAMEN = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', hellip: '\u2026', eacute: '\u00e9', euml: '\u00eb' };

function htmlTekst(t) {
  // &amp; eerst: zo wordt ook een dubbel gecodeerd teken (&amp;#x27;) goed. Daarna &#39;, &#x27; en namen zoals &rsquo;.
  return schoon(String(t || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]{1,6});/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&#(\d{1,7});/g, function (m, n) { return String.fromCharCode(Number(n)); })
    .replace(/&([a-z]+);/gi, function (m, n) { return HTML_NAMEN.hasOwnProperty(n.toLowerCase()) ? HTML_NAMEN[n.toLowerCase()] : m; }));
}
