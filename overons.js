/**
 * overons.js
 * Het blok over de Antwerp Queer Bookclub op de pagina Over ons. Naam, tekst, Instagram en de
 * eerstvolgende datums komen uit ?actie=site (zie apps-script/Bookclub.js). Leeg of uit: het blok blijft weg.
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

  function teken() {
    var bc = data && data.bookclub;
    $('bookclub').hidden = !bc;
    if (!bc) return;
    $('bookclub-titel').textContent = bc.naam;
    $('bookclub-tekst').textContent = tt(bc.tekst);
    var datums = (bc.volgende || []).map(function (d) { return T.datum(d); }).join(', ');
    $('bookclub-wanneer').textContent = T.t('bcWanneer', { regel: tt(bc.regel), uur: bc.uur ? T.t('bcOm', { uur: bc.uur }) : '' }) + (datums ? ' ' + T.t('bcVolgende', { datums: datums }) : '');
    D.vervang($('bookclub-link'), bc.link ? el('a', { class: 'knop', href: bc.link, target: '_blank', rel: 'noopener' }, T.t('bcInstagram')) : null);
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
    .catch(function () { /* geen gegevens: het blok blijft weg */ });
  document.addEventListener('taalgewijzigd', teken);
})();
