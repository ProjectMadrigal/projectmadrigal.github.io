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

/** De schermgroottes van GoatCounter: die hebben geen naam, enkel een id. */
var GC_TOESTELLEN = {
  phone: 'Gsm', largephone: 'Grote gsm of kleine tablet', tablet: 'Tablet of kleine laptop',
  desktop: 'Computer', desktophd: 'Groot computerscherm', unknown: 'Onbekend'
};

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
  // Zonder naam: de id (schermgroottes), anders "(onbekend)". Regels met 0 vallen weg.
  var lijst = function (a, namen) {
    return ((a && a.stats) || []).map(function (s) {
      var id = schoon(s.id);
      return { naam: schoon(s.name) || (namen && namen[id]) || id || '(onbekend)', n: Number(s.count) || 0 };
    }).filter(function (s) { return s.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  };
  return {
    totaal: Number(t.total) || 0,
    perWeek: dagen > 60,
    verloop: verloop,
    paginas: ((antwoorden.paginas && antwoorden.paginas.hits) || []).filter(function (h) { return !h.event; }).map(function (h) {
      return { pad: String(h.path || ''), titel: schoon(h.title), n: Number(h.count) || 0 };
    }).sort(function (a, b) { return b.n - a.n; }),
    bronnen: lijst(antwoorden.bronnen),
    toestellen: lijst(antwoorden.toestellen, GC_TOESTELLEN),
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
  var data = {}, mislukt = [];
  for (var i = 0; i < sleutels.length; i++) {
    var code = antwoorden[i].getResponseCode();
    var tekst = antwoorden[i].getContentText();
    if (code === 401 || code === 403) return { ok: false, fout: 'GoatCounter weigert de API-sleutel (' + code + '). Kijk na of ze klopt en het recht "Read statistics" heeft.' };
    if (code === 429) return { ok: false, fout: 'GoatCounter vraagt even te wachten. Probeer het over een minuut opnieuw.' };
    var json = null;
    if (code >= 200 && code < 300) { try { json = JSON.parse(tekst); } catch (e) { json = null; } }
    if (json) data[sleutels[i]] = json;
    else mislukt.push(gcFoutRegel(sleutels[i], code, tekst));
  }
  var r = gcUitkomst(data, mislukt, dagen, inst.goatcounter_code);
  if (r.ok && !mislukt.length) {
    try { cache.put(cacheSleutel, JSON.stringify(r.cijfers), GC_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  }
  if (mislukt.length) logboek('bestuur', 'bezoekersCijfers', mislukt.join(' | ').slice(0, 450));
  return r;
}

/** Eén regel over een mislukte vraag: welk onderdeel, de code en het begin van het antwoord. */
function gcFoutRegel(sleutel, code, tekst) {
  var kort = schoon(String(tekst || '').replace(/<[^>]*>/g, ' ')).slice(0, 120);
  return sleutel + ': ' + code + (kort ? ' (' + kort + ')' : '');
}

/**
 * Wat het bestuursscherm krijgt. Lukte niets, dan een fout met de details per onderdeel.
 * Lukte een deel, dan de cijfers en een waarschuwing over wat ontbreekt.
 */
function gcUitkomst(data, mislukt, dagen, code) {
  if (!Object.keys(data).length) {
    var geenSite = mislukt.some(function (m) { return /no site at this domain/i.test(m); });
    return {
      ok: false,
      fout: geenSite ? 'GoatCounter kent de code ' + code + ' niet. Kijk de instelling goatcounter_code na.'
        : 'GoatCounter gaf geen cijfers. Antwoord per onderdeel: ' + mislukt.join('; ')
    };
  }
  var r = { ok: true, cijfers: verwerkGoatcounter(data, dagen) };
  if (mislukt.length) r.waarschuwing = 'Niet alles kwam binnen: ' + mislukt.join('; ');
  return r;
}
