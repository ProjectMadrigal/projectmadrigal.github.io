/**
 * doemee.js
 * De pagina Doe mee: vrijwilliger worden, boeken schenken, steunen.
 * De teksten komen uit de Instellingen (tekst_vrijwilliger, tekst_schenken,
 * tekst_steunen en hun Engelse versie), via ?actie=site. Een leeg blok staat niet op de pagina.
 */
(function () {
  'use strict';

  var CONFIG = window.MADRIGAL_CONFIG || {};
  var T = window.MadrigalTaal;
  var data = null;
  var BLOKKEN = ['vrijwilliger', 'schenken', 'steunen'];

  function tt(w) {
    if (!w) return '';
    if (typeof w === 'string') return w;
    return w[T.taal()] || w.nl || '';
  }

  function mailLink(vak, mail) {
    vak.textContent = '';
    if (!mail) return;
    var a = document.createElement('a');
    a.className = 'knop';
    a.href = 'mailto:' + mail;
    a.textContent = T.t('dmMail') + ': ' + mail;
    vak.appendChild(a);
  }

  function teken() {
    if (!data) return;
    var doeMee = data.doeMee || {};
    var mail = (data.contact || {}).mail_algemeen || '';
    var iets = false;
    BLOKKEN.forEach(function (naam) {
      var sectie = document.getElementById('dm-' + naam);
      var tekst = tt(doeMee[naam]).trim();
      sectie.hidden = !tekst;
      if (!tekst) return;
      iets = true;
      sectie.querySelector('[data-tekst]').textContent = tekst;
      mailLink(sectie.querySelector('[data-mail]'), mail);
    });
    var leeg = document.getElementById('dm-leeg');
    leeg.hidden = iets;
    mailLink(leeg.querySelector('[data-mail]'), mail);
  }

  // Zelfde bewaarde versie als de startpagina (home.js): zo staan de teksten er meteen.
  var CACHE_SLEUTEL = 'madrigal_site_v1';
  var bewaard = null;
  if (CONFIG.apiUrl) { try { bewaard = localStorage.getItem(CACHE_SLEUTEL); } catch (e) { /* geen opslag */ } }
  if (bewaard) { try { data = JSON.parse(bewaard); teken(); } catch (e) { bewaard = null; } }
  fetch(CONFIG.apiUrl ? CONFIG.apiUrl + '?actie=site' : 'voorbeeld/site.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('Status ' + r.status); return r.text(); })
    .then(function (tekst) {
      if (tekst === bewaard) return;
      data = JSON.parse(tekst);
      if (CONFIG.apiUrl) { try { localStorage.setItem(CACHE_SLEUTEL, tekst); } catch (e) { /* geen opslag */ } }
      teken();
    })
    .catch(function () { if (!data) { data = { doeMee: {}, contact: {} }; teken(); } });
  document.addEventListener('taalgewijzigd', teken);
})();
