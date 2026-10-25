/**
 * Peperfabriek.js
 * Het programma van De Peperfabriek, het huis waar de bib zit, voor de pagina peperfabriek.html.
 * Met toestemming van De Peperfabriek: titel, datum, korte tekst en afbeelding, telkens met een
 * link naar hun eigen site.
 *
 * Werking:
 *   - Elke nacht haalt haalPeperfabriekOp() de pagina in de instelling peperfabriek_url op en bewaart
 *     de activiteiten in de eigenschappen van het script. ?actie=site geeft ze mee aan de website.
 *   - Het script probeert drie manieren, in deze volgorde:
 *       1. gestructureerde gegevens in de pagina (schema.org Event, JSON-LD), zoals veel websites ze hebben;
 *       2. een agenda-bestand (iCal, .ics) waar de pagina naar verwijst;
 *       3. de links naar de pagina's van de activiteiten, met een datum in de buurt.
 *   - Menu: Madrigal > Onderhoud > Peperfabriek: test het ophalen. Dat toont wat het script vindt.
 *     Verandert hun website en vindt het script niets meer, dan blijft het vorige programma staan.
 *
 * Leeg peperfabriek_url: niets ophalen. De pagina toont dan enkel de tekst en een link.
 */

var PF_EIGENSCHAP = 'peperfabriek_programma';
var PF_MAX = 40;
var PF_MAANDEN = { jan: 1, feb: 2, maa: 3, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };

/** Een link volledig maken: /nl/x wordt https://www.voorbeeld.be/nl/x. Enkel http(s). */
function pfAbsoluut(href, basis) {
  var h = String(href || '').trim().replace(/&amp;/g, '&');
  if (!h || /^(mailto|tel|javascript):/i.test(h) || h.charAt(0) === '#') return '';
  if (/^https?:\/\//i.test(h)) return h.replace(/^http:/i, 'https:');
  var m = String(basis).match(/^(https?:\/\/[^\/]+)(\/.*)?$/i);
  if (!m) return '';
  if (h.indexOf('//') === 0) return 'https:' + h;
  if (h.charAt(0) === '/') return m[1] + h;
  var map = (m[2] || '/').replace(/[^\/]*$/, '');
  return m[1] + map + h;
}

function pfTekst(html) {
  return schoon(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&#39;|&rsquo;/g, '\'')
    .replace(/&quot;/g, '"').replace(/&eacute;/g, 'é').replace(/&euml;/g, 'ë').replace(/&[a-z]+;/g, ' '));
}

/** Een datum (en uur) uit een tekst als 2026-11-07T20:00:00+01:00. Geeft { datum, uur } of null. */
function pfIsoDatum(w) {
  var m = String(w || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { datum: m[1] + '-' + m[2] + '-' + m[3], uur: m[4] && (m[4] !== '00' || m[5] !== '00') ? m[4] + ':' + m[5] : '' };
}

/** Een afbeelding uit JSON-LD: tekst, lijst of { url }. */
function pfAfbeelding(img) {
  if (!img) return '';
  if (Array.isArray(img)) return pfAfbeelding(img[0]);
  if (typeof img === 'object') return String(img.url || img.contentUrl || '');
  return String(img);
}

/** Maakt een activiteit netjes: enkel https-links, korte teksten. */
function pfActiviteit(a, basis) {
  var link = pfAbsoluut(a.link, basis);
  var afbeelding = pfAbsoluut(a.afbeelding, basis);
  var tekst = pfTekst(a.tekst);
  if (tekst.length > 280) tekst = tekst.slice(0, 280).replace(/\s+\S*$/, '') + '…';
  return {
    titel: pfTekst(a.titel).slice(0, 140),
    datum: a.datum, uur: a.uur || '', einde: a.einde || '',
    link: veiligeCoverUrl(link), afbeelding: veiligeCoverUrl(afbeelding), tekst: tekst
  };
}

/* ---------- 1. JSON-LD (schema.org Event) ---------- */

function pfUitJsonLd(html, basis) {
  var uit = [];
  var re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, m;
  function bekijk(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(bekijk); return; }
    if (x['@graph']) bekijk(x['@graph']);
    if (x.itemListElement) bekijk(x.itemListElement.map(function (i) { return i && i.item ? i.item : i; }));
    var type = [].concat(x['@type'] || []).join(' ');
    if (/Event\b/.test(type) && x.name && x.startDate) {
      var start = pfIsoDatum(x.startDate), einde = pfIsoDatum(x.endDate);
      if (start) uit.push(pfActiviteit({ titel: x.name, datum: start.datum, uur: start.uur, einde: einde && einde.datum !== start.datum ? einde.datum : '',
        link: x.url || '', afbeelding: pfAfbeelding(x.image), tekst: x.description || '' }, basis));
    }
  }
  while ((m = re.exec(html))) {
    try { bekijk(JSON.parse(m[1].trim())); } catch (e) { /* ongeldige JSON: overslaan */ }
  }
  return uit;
}

/* ---------- 2. iCal ---------- */

/** Een link naar een .ics-bestand in de pagina, of ''. */
function pfIcalLink(html, basis) {
  var m = html.match(/<link[^>]*type=["']text\/calendar["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/href=["']((?:webcal|https?):\/\/[^"']+\.ics[^"']*|[^"']+\.ics(?:\?[^"']*)?)["']/i) ||
    html.match(/href=["']([^"']*(?:ical=1|outlook-ical=1|\/ical\/?)[^"']*)["']/i);
  return m ? pfAbsoluut(m[1].replace(/^webcal:/i, 'https:'), basis) : '';
}

function pfUitIcal(ics, basis) {
  var regels = String(ics || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  var uit = [], e = null;
  var waarde = function (r) { return r.slice(r.indexOf(':') + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';'); };
  regels.forEach(function (r) {
    if (r === 'BEGIN:VEVENT') e = {};
    else if (r === 'END:VEVENT' && e) {
      if (e.titel && e.datum) uit.push(pfActiviteit(e, basis));
      e = null;
    } else if (e) {
      var sleutel = r.split(/[:;]/)[0];
      if (sleutel === 'SUMMARY') e.titel = waarde(r);
      else if (sleutel === 'DTSTART') {
        var d = waarde(r).match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if (d) { e.datum = d[1] + '-' + d[2] + '-' + d[3]; e.uur = d[4] && (d[4] !== '00' || d[5] !== '00') ? d[4] + ':' + d[5] : ''; }
      } else if (sleutel === 'URL') e.link = waarde(r);
      else if (sleutel === 'DESCRIPTION') e.tekst = waarde(r);
      else if (sleutel === 'ATTACH' && /\.(jpe?g|png|webp)/i.test(r)) e.afbeelding = waarde(r);
    }
  });
  return uit;
}

/* ---------- 3. Links naar activiteiten, met een datum in de buurt ---------- */

/** Zoekt een datum in een stuk tekst. vandaag: om het jaar te raden als het ontbreekt. */
function pfDatumInTekst(t, vandaag) {
  var iso = String(t).match(/datetime=["'](\d{4}-\d{2}-\d{2}[^"']*)["']/i) || String(t).match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return pfIsoDatum(iso[1]);
  var tekst = pfTekst(t).toLowerCase();
  var uurM = tekst.match(/\b(\d{1,2})[:u.h](\d{2})\b/);
  var uur = uurM && Number(uurM[1]) < 24 ? ('0' + uurM[1]).slice(-2) + ':' + uurM[2] : '';
  var jaar, maand, dag;
  var num = tekst.match(/\b(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\b/);
  var woord = tekst.match(/\b(\d{1,2})\s+(jan|feb|maa|mrt|mar|apr|mei|may|jun|jul|aug|sep|okt|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/);
  if (woord) { dag = Number(woord[1]); maand = PF_MAANDEN[woord[2]]; jaar = woord[3] ? Number(woord[3]) : 0; }
  else if (num && Number(num[2]) >= 1 && Number(num[2]) <= 12) { dag = Number(num[1]); maand = Number(num[2]); jaar = num[3] ? Number(num[3].length === 2 ? '20' + num[3] : num[3]) : 0; }
  else return null;
  if (!dag || dag > 31 || !maand) return null;
  if (!jaar) {
    // Zonder jaar: het eerstvolgende, of hoogstens een maand geleden.
    var nu = Number(vandaag.slice(0, 4));
    var kandidaat = nu + '-' + ('0' + maand).slice(-2) + '-' + ('0' + dag).slice(-2);
    jaar = kandidaat < telDagenOp(vandaag, -31) ? nu + 1 : nu;
  }
  return { datum: jaar + '-' + ('0' + maand).slice(-2) + '-' + ('0' + dag).slice(-2), uur: uur };
}

function pfUitLinks(html, basis, vandaag) {
  var lijstPad = String(basis).replace(/^https?:\/\/[^\/]+/i, '').replace(/\/$/, '');
  var uit = [], gezien = {};
  var re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, m;
  while ((m = re.exec(html))) {
    var link = pfAbsoluut(m[1], basis);
    var pad = link.replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    // Enkel pagina's onder het programma (of een agenda/event-pagina), niet het programma zelf.
    if (!pad || pad === lijstPad || !(pad.indexOf(lijstPad + '/') === 0 || /\/(agenda|events?|activiteit(en)?|programma)\/[^\/]+/.test(pad))) continue;
    if (gezien[link]) continue;
    // Het stuk rond de link: van na de vorige link tot voor de volgende, hoogstens 600 tekens aan elke kant.
    var voor = html.slice(Math.max(0, m.index - 600), m.index);
    var vorige = voor.lastIndexOf('</a>');
    if (vorige > -1) voor = voor.slice(vorige + 4);
    var na = html.slice(m.index + m[0].length, m.index + m[0].length + 600);
    var volgende = na.search(/<a\b/i);
    if (volgende > -1) na = na.slice(0, volgende);
    var stuk = voor + m[0] + na;
    var titel = pfTekst(m[2]);
    if (!titel || titel.length < 3 || /^(meer|lees meer|info|tickets?|more|read more)$/i.test(titel)) {
      var kop = m[0].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || stuk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      titel = kop ? pfTekst(kop[1]) : '';
    }
    // Eerst een datum in de link zelf, dan ervoor (meestal staat de datum boven de titel), pas dan erna.
    var d = pfDatumInTekst(m[0], vandaag) || pfDatumInTekst(voor, vandaag) || pfDatumInTekst(na, vandaag);
    if (!titel || !d) continue;
    var img = m[0].match(/<img[^>]*(?:data-src|src)=["']([^"']+)["']/i);
    gezien[link] = true;
    uit.push(pfActiviteit({ titel: titel, datum: d.datum, uur: d.uur, link: link, afbeelding: img ? img[1] : '' }, basis));
  }
  return uit;
}

/* ---------- Samen ---------- */

/**
 * Leest het programma uit de HTML van de pagina (zonder internet: ical is de tekst van het .ics-bestand
 * als die er is). Geeft { manier, activiteiten, icalLink }.
 */
function pfLeesProgramma(html, basis, vandaag, ical) {
  var lijsten = [['schema.org', pfUitJsonLd(html, basis)], ['iCal', ical ? pfUitIcal(ical, basis) : []], ['links', pfUitLinks(html, basis, vandaag)]];
  for (var i = 0; i < lijsten.length; i++) {
    var lijst = lijsten[i][1].filter(function (a) { return a.titel && /^\d{4}-\d{2}-\d{2}$/.test(a.datum); });
    if (lijst.length) return { manier: lijsten[i][0], activiteiten: pfSorteer(lijst), icalLink: pfIcalLink(html, basis) };
  }
  return { manier: '', activiteiten: [], icalLink: pfIcalLink(html, basis) };
}

/** Enkel komende activiteiten (of die nog lopen), de eerste eerst, zonder dubbels. */
function pfSorteer(lijst) {
  var gezien = {};
  return lijst.filter(function (a) {
    var k = a.datum + '|' + a.titel.toLowerCase();
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  }).sort(function (a, b) { return (a.datum + a.uur).localeCompare(b.datum + b.uur); }).slice(0, PF_MAX * 3);
}

/** Wat de website toont: enkel vanaf vandaag (of nog bezig), hoogstens aantal. */
function pfVoorSite(lijst, vandaag, aantal) {
  return (lijst || []).filter(function (a) { return (a.einde || a.datum) >= vandaag; }).slice(0, aantal || 12);
}

/** Haalt de pagina op (en het .ics-bestand als de pagina ernaar verwijst). */
function pfHaal(url) {
  var opties = { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT, 'Accept-Language': 'nl-BE,nl;q=0.9' } };
  var r = UrlFetchApp.fetch(url, opties);
  var html = r.getResponseCode() === 200 ? r.getContentText() : '';
  var ical = '';
  var icalLink = html ? pfIcalLink(html, url) : '';
  if (icalLink && !pfUitJsonLd(html, url).length) {
    try { var ri = UrlFetchApp.fetch(icalLink, opties); if (ri.getResponseCode() === 200) ical = ri.getContentText(); } catch (e) { /* geen iCal */ }
  }
  return { code: r.getResponseCode(), html: html, ical: ical };
}

/** Planning (elke nacht) en menu: haalt het programma op en bewaart het. */
function haalPeperfabriekOp() {
  var url = String(leesInstellingen().peperfabriek_url || '').trim();
  if (!url) return { ok: true, aantal: 0 };
  var r;
  try { r = pfHaal(url); } catch (e) { logboek('planning', 'peperfabriek', 'niet bereikbaar: ' + e.message); return { ok: false }; }
  var p = pfLeesProgramma(r.html, url, vandaagTekst(), r.ical);
  if (!p.activiteiten.length) {
    // Niets gevonden: het vorige programma blijft staan.
    logboek('planning', 'peperfabriek', 'niets gevonden (code ' + r.code + ')');
    return { ok: false, aantal: 0 };
  }
  PropertiesService.getScriptProperties().setProperty(PF_EIGENSCHAP, JSON.stringify({ opgehaald: vandaagTekst(), manier: p.manier, activiteiten: p.activiteiten.slice(0, PF_MAX) }));
  leegCache();
  return { ok: true, aantal: p.activiteiten.length, manier: p.manier };
}

/** Het bewaarde programma, voor ?actie=site. */
function peperfabriekBewaard() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PF_EIGENSCHAP) || '{}'); } catch (e) { return {}; }
}

/** Menu: toont wat het script op de pagina vindt, en bewaart het programma als er iets gevonden is. */
function testPeperfabriek() {
  var url = String(leesInstellingen().peperfabriek_url || '').trim();
  if (!url) { meld('Vul eerst in Instellingen bij peperfabriek_url het adres van hun programma in.'); return; }
  var r = pfHaal(url);
  var p = pfLeesProgramma(r.html, url, vandaagTekst(), r.ical);
  var html = r.html;
  var generator = (html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)/i) || [])[1] || '';
  var regels = [
    'Adres: ' + url, 'Antwoord: ' + r.code + ', ' + html.length + ' tekens' + (generator ? ', gemaakt met ' + generator : ''),
    'Gestructureerde gegevens (schema.org): ' + pfUitJsonLd(html, url).length,
    'Agenda-bestand (iCal): ' + (p.icalLink || 'geen') + (r.ical ? ', ' + pfUitIcal(r.ical, url).length + ' activiteiten' : ''),
    'Links naar activiteiten met een datum: ' + pfUitLinks(html, url, vandaagTekst()).length,
    'Gebruikte manier: ' + (p.manier || 'geen, er is niets gevonden'),
    ''
  ].concat(p.activiteiten.slice(0, 6).map(function (a) { return a.datum + (a.uur ? ' ' + a.uur : '') + ' · ' + a.titel + (a.link ? ' · ' + a.link : '') + (a.afbeelding ? ' · met afbeelding' : ''); }));
  if (!p.activiteiten.length) {
    // Een stukje van de pagina, om te zien hoe ze in elkaar zit.
    var i = html.search(/<main\b/i);
    regels.push('Begin van de inhoud: ' + html.slice(i > -1 ? i : 0, (i > -1 ? i : 0) + 1500).replace(/\s+/g, ' '));
  } else {
    haalPeperfabriekOp();
    regels.push('', 'Het programma is bewaard. De website toont het binnen enkele minuten.');
  }
  logboek('menu', 'testPeperfabriek', regels.slice(0, 7).join(' | ').slice(0, 450));
  meld(regels.join('\n'));
}
