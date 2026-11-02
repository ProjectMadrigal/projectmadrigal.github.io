/**
 * toegankelijkheid.js
 * De pagina Bereikbaarheid en toegankelijkheid. De tekst staat in de Instellingen (tekst_toegankelijkheid en
 * tekst_toegankelijkheid_en) en komt via ?actie=site. Opmaak, zoals bij de handleiding voor vrijwilligers:
 *   # Titel            een tussentitel
 *   - punt             een opsommingspunt
 *   ![beschrijving](https://...)   een foto, met een beschrijving voor wie ze niet ziet
 *   gewone tekst       een alinea
 */
(function () {
  'use strict';

  var CONFIG = window.MADRIGAL_CONFIG || {};
  var T = window.MadrigalTaal;
  var D = window.MadrigalDom;
  var el = D.el;
  var CACHE_SLEUTEL = 'madrigal_site_v1'; // dezelfde bewaarde versie als de startpagina (home.js)
  var data = null;

  function $(id) { return document.getElementById(id); }
  function tt(w) { return !w ? '' : typeof w === 'string' ? w : (w[T.taal()] || w.nl || ''); }

  /** Een veilige link naar een afbeelding: enkel https. */
  function veiligeLink(url) { return /^https:\/\/[^\s"'<>]+$/.test(url) ? url : ''; }

  /** De tekst omzetten naar titels, punten, foto's en alinea's. */
  function opbouw(tekst) {
    var uit = [], lijst = null;
    String(tekst || '').split('\n').forEach(function (regel) {
      regel = regel.trim();
      if (!regel) { lijst = null; return; }
      var foto = regel.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (/^-\s+/.test(regel)) {
        if (!lijst) { lijst = el('ul'); uit.push(lijst); }
        lijst.appendChild(el('li', null, regel.replace(/^-\s+/, '')));
        return;
      }
      lijst = null;
      if (/^#\s*/.test(regel)) uit.push(el('h2', null, regel.replace(/^#\s*/, '')));
      else if (foto && veiligeLink(foto[2])) {
        var img = el('img', { src: foto[2], alt: foto[1], loading: 'lazy' });
        uit.push(el('figure', null, img, foto[1] ? el('figcaption', null, foto[1]) : null));
      } else uit.push(el('p', null, regel));
    });
    return uit;
  }

  function teken() {
    var tekst = data && tt(data.toegankelijkheid);
    D.vervang($('toegankelijkheid'), tekst ? opbouw(tekst) : el('p', null, T.t('toegLeeg')));
  }

  function ontvang(tekst, bewaar) {
    var nieuw;
    try { nieuw = JSON.parse(tekst); } catch (e) { return; }
    if (!nieuw || !nieuw.contact) return;
    data = nieuw;
    if (bewaar) { try { localStorage.setItem(CACHE_SLEUTEL, tekst); } catch (e) { /* geen opslag */ } }
    teken();
  }

  var gekoppeld = !!CONFIG.apiUrl;
  var bewaard = null;
  if (gekoppeld) { try { bewaard = localStorage.getItem(CACHE_SLEUTEL); } catch (e) { /* geen opslag */ } }
  if (bewaard) ontvang(bewaard, false);
  fetch(gekoppeld ? CONFIG.apiUrl + '?actie=site' : 'voorbeeld/site.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('Status ' + r.status); return r.text(); })
    .then(function (tekst) { if (tekst !== bewaard) ontvang(tekst, gekoppeld); })
    .catch(function () { if (!data) D.vervang($('toegankelijkheid'), el('p', null, T.t('toegLeeg'))); });
  document.addEventListener('taalgewijzigd', teken);
})();
