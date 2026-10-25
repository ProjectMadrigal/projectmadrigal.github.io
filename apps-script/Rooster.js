/**
 * Rooster.js
 * Toont het vrijwilligersrooster in het uitleenscherm en het bestuursscherm.
 *
 * Het rooster is een aparte tool (repository "rooster", met een eigen spreadsheet
 * en script). Dit script vraagt dat rooster op bij de web-app van het rooster,
 * met de toegangscode voor vrijwilligers. Die code blijft hier op de server:
 * de browser krijgt ze nooit te zien.
 *
 * Instellingen:
 *   rooster_url   de URL van de web-app van het rooster (eindigt op /exec)
 *   rooster_code  de toegangscode voor vrijwilligers van het rooster
 *   rooster_link  het adres van de roostertool, voor de knop "Beschikbaarheid invullen"
 *
 * Het resultaat blijft 10 minuten in de cache, zodat het scherm snel opent.
 * De laatste goede versie bewaren we ook langer (ROOSTER_LAATST_SLEUTEL). Lukt ophalen niet, bv. omdat
 * de daglimiet van Google op is, dan toont het scherm die versie, met de tijd erbij.
 */

var ROOSTER_CACHE_SLEUTEL = 'rooster_v1';
var ROOSTER_CACHE_SECONDEN = 10 * 60;
var ROOSTER_LAATST_SLEUTEL = 'rooster_laatst';

/** "2026-10" en de maand erna. */
function roosterMaanden(vandaag) {
  var j = Number(vandaag.slice(0, 4)), m = Number(vandaag.slice(5, 7));
  var volgende = m === 12 ? (j + 1) + '-01' : j + '-' + tweeCijfers(m + 1);
  return [vandaag.slice(0, 7), volgende];
}

/**
 * Zet de antwoorden van de roostertool (actie "maand") om naar één lijst avonden
 * vanaf vandaag. Een maand zonder gepubliceerd rooster toont enkel de avonden.
 * antwoorden: lijst van { maand, avonden: [{ datum, status, event }], rooster: [...] of null }
 */
function bouwRoosterOverzicht(antwoorden, vandaag) {
  var avonden = [];
  var nietGepubliceerd = [];
  antwoorden.forEach(function (a) {
    if (!a || !a.ok) return;
    var perDatum = {};
    (a.rooster || []).forEach(function (r) { perDatum[r.datum] = r; });
    if (!a.rooster) nietGepubliceerd.push(a.maand);
    (a.avonden || []).forEach(function (av) {
      if (String(av.datum) < vandaag) return;
      var r = perDatum[av.datum] || {};
      avonden.push({
        datum: av.datum,
        status: av.status || 'open',
        event: schoon(av.event),
        vrijwilligers: r.vrijwilligers || [],
        backups: r.backups || [],
        afgemeld: r.afgemeld || [],
        gepubliceerd: !!a.rooster
      });
    });
  });
  avonden.sort(function (x, y) { return x.datum < y.datum ? -1 : 1; });
  return { avonden: avonden, nietGepubliceerd: nietGepubliceerd };
}

/** Vraagt één maand op bij de roostertool. */
function haalRoosterMaand(url, code, maand) {
  var antwoord = haalExtern(url, {
    method: 'post',
    contentType: 'text/plain',
    payload: JSON.stringify({ actie: 'maand', code: code, maand: maand }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  try { return JSON.parse(antwoord.getContentText()); } catch (e) { return { ok: false, fout: 'Het rooster gaf een onverwacht antwoord.' }; }
}

/** Actie voor balie en bestuur: het rooster van deze en volgende maand. */
function roosterOverzicht() {
  var inst = leesInstellingen();
  var link = schoon(inst.rooster_link) || 'https://projectmadrigal.github.io/rooster/';
  var url = schoon(inst.rooster_url), code = schoon(inst.rooster_code);
  if (!/^https:\/\/script\.google\.com\//.test(url) || !code) {
    return { ok: true, data: { gekoppeld: false, link: link } };
  }
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(ROOSTER_CACHE_SLEUTEL);
  if (bewaard) return { ok: true, data: JSON.parse(bewaard) };
  var props = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  // De daglimiet van Google is op: niet opnieuw proberen, meteen de laatste versie.
  if (daglimietWachttijd(daglimietSinds(), Date.now())) return laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, true);

  var antwoorden;
  try {
    antwoorden = roosterMaanden(vandaag).map(function (m) { return haalRoosterMaand(url, code, m); });
  } catch (e) {
    return laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, isDaglimietFout(e));
  }
  var fout = antwoorden.filter(function (a) { return !a || !a.ok; })[0];
  if (fout && fout.codeFout) return { ok: false, fout: 'De rooster_code in Instellingen klopt niet. Gebruik de toegangscode voor vrijwilligers van het rooster.' };
  if (fout && antwoorden.every(function (a) { return !a || !a.ok; })) {
    var oud = laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, false);
    return oud.ok ? oud : { ok: false, fout: 'Het rooster kon niet laden: ' + (fout.fout || 'onbekende fout') };
  }

  var data = bouwRoosterOverzicht(antwoorden, vandaag);
  data.gekoppeld = true;
  data.link = link;
  data.vandaag = vandaag;
  var tekst = JSON.stringify(data);
  try { cache.put(ROOSTER_CACHE_SLEUTEL, tekst, ROOSTER_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  try { props.setProperty(ROOSTER_LAATST_SLEUTEL, JSON.stringify({ tijd: Date.now(), data: data })); } catch (e) { /* te groot: dan zonder reserve */ }
  return { ok: true, data: data };
}

/**
 * De laatst opgehaalde versie van het rooster, zonder de avonden die al voorbij zijn.
 * bewaard: de tekst uit ROOSTER_LAATST_SLEUTEL. daglimiet: lag het aan de daglimiet van Google?
 */
function laatsteRooster(bewaard, vandaag, daglimiet) {
  var oud = null;
  try { oud = JSON.parse(bewaard || 'null'); } catch (e) { oud = null; }
  var reden = daglimiet ? 'Google laat vandaag geen nieuwe vragen naar buiten meer toe (daglimiet).' : 'De roostertool antwoordt nu niet.';
  if (!oud || !oud.data) return { ok: false, fout: 'Het rooster kon niet laden. ' + reden + ' Probeer het later opnieuw.' };
  var data = oud.data;
  data.avonden = (data.avonden || []).filter(function (a) { return String(a.datum) >= vandaag; });
  data.vandaag = vandaag;
  data.verouderd = { tijd: Number(oud.tijd) || 0, reden: reden };
  return { ok: true, data: data };
}
