/**
 * peperfabriek.js
 * De pagina De Peperfabriek: het huis waar de bib zit, met hun komende activiteiten.
 * Het script haalt hun programma elke nacht op (apps-script/Peperfabriek.js) en geeft het mee via ?actie=site.
 * De tekst bovenaan staat in Instellingen (tekst_peperfabriek en tekst_peperfabriek_en).
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

  function tt(w) {
    if (!w) return '';
    if (typeof w === 'string') return w;
    return w[T.taal()] || w.nl || '';
  }

  function activiteit(a) {
    var wanneer = T.datum(a.datum) + (a.einde ? ' ' + T.t('pfTot') + ' ' + T.datum(a.einde) : '') + (a.uur ? ', ' + a.uur : '');
    var beeld = a.afbeelding ? el('img', { src: a.afbeelding, alt: '', loading: 'lazy' }) : null;
    // Een afbeelding die niet laadt, verdwijnt gewoon.
    if (beeld) beeld.addEventListener('error', function () { beeld.remove(); });
    return el('article', { class: 'nieuwskaart' }, beeld,
      el('div', { class: 'inhoud' },
        el('p', { class: 'datum' }, wanneer),
        el('h3', null, a.titel),
        a.tekst ? el('div', { class: 'tekstblok' }, el('p', null, a.tekst)) : null,
        a.link ? el('p', null, el('a', { href: a.link, target: '_blank', rel: 'noopener' }, T.t('pfMeerInfo'))) : null,
        el('p', null, el('button', { type: 'button', class: 'knop tweede klein', onclick: function () {
          window.MadrigalAgenda.download({ datum: a.datum, uur: a.uur, titel: a.titel, tekst: a.tekst, locatie: 'De Peperfabriek', link: a.link });
        } }, T.t('inMijnAgenda')))));
  }

  function teken() {
    if (!data) return;
    var pf = data.peperfabriek || {};
    $('pf-tekst').textContent = tt(pf.tekst);
    var lijst = pf.activiteiten || [];
    D.vervang($('pf-programma'), lijst.length ? lijst.map(activiteit) : el('p', null, T.t('pfLeeg')));
    var volledig = $('pf-volledig');
    volledig.hidden = !pf.url;
    if (pf.url) D.vervang(volledig, el('a', { class: 'knop', href: pf.url, target: '_blank', rel: 'noopener' }, T.t('pfVolledig')));
  }

  function ontvang(tekst, bewaar) {
    var nieuw;
    try { nieuw = JSON.parse(tekst); } catch (e) { return; }
    if (!nieuw || !nieuw.contact) return;
    data = nieuw;
    if (window.MadrigalLayout && data.hasOwnProperty('leeslijsten')) window.MadrigalLayout.leeslijstenTonen(data.leeslijsten === true);
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
    .catch(function () {
      if (data) return;
      data = { contact: {}, peperfabriek: { tekst: { nl: T.t('pfStandaard'), en: T.t('pfStandaard') }, url: 'https://www.peperfabriek.be/nl/programma', activiteiten: [] } };
      teken();
    });
  document.addEventListener('taalgewijzigd', teken);
})();
