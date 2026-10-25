/**
 * Bezoekers.js
 * Bezoekerscijfers van de website, uit GoatCounter, voor het onderdeel Cijfers van het bestuursscherm.
 *
 * GoatCounter telt bezoeken zonder cookies en zonder persoonsgegevens (zie config.js, statistiek).
 * Om de cijfers hier te tonen, heeft het script een API-sleutel nodig:
 *   - instelling goatcounter_code: de code van het account (projectmadrigal voor projectmadrigal.goatcounter.com);
 *   - instelling goatcounter_api_sleutel: in GoatCounter via je naam rechtsboven > Preferences > tabblad API (/user/api), met enkel "Read statistics".
 * De sleutel blijft op de server: het bestuursscherm ziet ze nooit.
 *
 * GoatCounter telt bezoekers: wie dezelfde pagina meerdere keren op een dag bekijkt, telt één keer.
 */

var GC_PERIODES = { '7': 7, '30': 30, '365': 365 };
var GC_CACHE_SECONDEN = 30 * 60;

/** Het adres van de API van GoatCounter voor een code. Enkel letters, cijfers en streepjes. */
function gcBasis(code) {
  var c = schoon(code).toLowerCase();
  return /^[a-z0-9-]+$/.test(c) ? 'https://' + c + '.goatcounter.com/api/v0' : '';
}

/** Begin en einde van een periode van zoveel dagen, tot en met vandaag. */
function gcPeriode(vandaag, dagen) {
  var start = parseerDatum(telDagenOp(vandaag, -(dagen - 1)));
  return { start: start + 'T00:00:00Z', end: vandaag + 'T23:59:59Z' };
}

/** De vragen die we stellen, als { sleutel: url }. */
function gcVragen(basis, periode) {
  var q = 'start=' + encodeURIComponent(periode.start) + '&end=' + encodeURIComponent(periode.end);
  return {
    totaal: basis + '/stats/total?' + q,
    paginas: basis + '/stats/hits?' + q + '&limit=15',
    bronnen: basis + '/stats/toprefs?' + q + '&limit=10',
    toestellen: basis + '/stats/sizes?' + q + '&limit=10',
    landen: basis + '/stats/locations?' + q + '&limit=10'
  };
}

/**
 * Zet de antwoorden van GoatCounter om naar wat het bestuursscherm toont.
 * antwoorden: { totaal, paginas, bronnen, toestellen, landen } met het JSON-antwoord (of null).
 * Per week bij een lange periode, anders per dag.
 */
function verwerkGoatcounter(antwoorden, dagen) {
  var t = antwoorden.totaal || {};
  var perDag = (t.stats || []).map(function (s) { return { dag: String(s.day || ''), n: Number(s.daily) || 0 }; })
    .filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s.dag); })
    .sort(function (a, b) { return a.dag.localeCompare(b.dag); });
  var verloop = perDag;
  if (dagen > 60) {
    var perWeek = [];
    perDag.forEach(function (s, i) {
      if (i % 7 === 0) perWeek.push({ dag: s.dag, n: 0 });
      perWeek[perWeek.length - 1].n += s.n;
    });
    verloop = perWeek;
  }
  var lijst = function (a) {
    return ((a && a.stats) || []).map(function (s) { return { naam: schoon(s.name) || '(onbekend)', n: Number(s.count) || 0 }; });
  };
  return {
    totaal: Number(t.total) || 0,
    perWeek: dagen > 60,
    verloop: verloop,
    paginas: ((antwoorden.paginas && antwoorden.paginas.hits) || []).filter(function (h) { return !h.event; }).map(function (h) {
      return { pad: String(h.path || ''), titel: schoon(h.title), n: Number(h.count) || 0 };
    }).sort(function (a, b) { return b.n - a.n; }),
    bronnen: lijst(antwoorden.bronnen),
    toestellen: lijst(antwoorden.toestellen),
    landen: lijst(antwoorden.landen)
  };
}

/** Bestuur: de bezoekerscijfers voor 7, 30 of 365 dagen. invoer: { dagen } */
function bezoekersCijfers(invoer) {
  var dagen = GC_PERIODES[String(invoer.dagen)] || 30;
  var inst = leesInstellingen();
  var basis = gcBasis(inst.goatcounter_code);
  var sleutel = String(inst.goatcounter_api_sleutel || '').trim();
  if (!basis || !sleutel) return { ok: true, nietIngesteld: true };
  var cache = CacheService.getScriptCache();
  var cacheSleutel = 'gc_' + dagen + '_' + vandaagTekst();
  var bewaard = cache.get(cacheSleutel);
  if (bewaard) return { ok: true, cijfers: JSON.parse(bewaard) };

  var vragen = gcVragen(basis, gcPeriode(vandaagTekst(), dagen));
  var sleutels = Object.keys(vragen);
  var antwoorden;
  try {
    antwoorden = UrlFetchApp.fetchAll(sleutels.map(function (k) {
      return { url: vragen[k], headers: { Authorization: 'Bearer ' + sleutel }, muteHttpExceptions: true };
    }));
  } catch (e) {
    return { ok: false, fout: 'GoatCounter is niet bereikbaar. Probeer het later opnieuw.' };
  }
  var data = {};
  for (var i = 0; i < sleutels.length; i++) {
    var code = antwoorden[i].getResponseCode();
    if (code === 401 || code === 403) return { ok: false, fout: 'GoatCounter weigert de API-sleutel. Kijk na of ze klopt en het recht "Read statistics" heeft.' };
    if (code === 429) return { ok: false, fout: 'GoatCounter vraagt even te wachten. Probeer het over een minuut opnieuw.' };
    if (code === 404) return { ok: false, fout: 'GoatCounter kent de code ' + inst.goatcounter_code + ' niet. Kijk de instelling goatcounter_code na.' };
    if (code >= 200 && code < 300) {
      try { data[sleutels[i]] = JSON.parse(antwoorden[i].getContentText()); } catch (e) { data[sleutels[i]] = null; }
    }
  }
  var cijfers = verwerkGoatcounter(data, dagen);
  try { cache.put(cacheSleutel, JSON.stringify(cijfers), GC_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return { ok: true, cijfers: cijfers };
}
