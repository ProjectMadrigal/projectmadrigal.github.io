/**
 * layout.js
 * De kop (logo, menu, taal, donkere modus) en de voet van elke publieke pagina.
 * Zo staan ze maar op één plaats. Een pagina zet in <body> data-pagina="home",
 * "boeken" of "over", en heeft een <header id="site-kop"> en <footer id="site-voet">.
 *
 * Een menu-item toevoegen? Voeg het toe aan MENU hieronder, en de tekst in i18n.js.
 */
(function () {
  'use strict';

  var T = window.MadrigalTaal;
  var THEMA = 'madrigal_thema';

  var INSTAGRAM = 'https://www.instagram.com/projectmadrigal/';

  var MENU = [
    { pagina: 'home', href: 'index.html', tekst: 'menuHome' },
    { pagina: 'boeken', href: 'boeken.html', tekst: 'menuBoeken' },
    // Verborgen tot de instelling leeslijsten_tonen op ja staat (zie leeslijstenTonen hieronder).
    { pagina: 'leeslijsten', href: 'boeken.html#/leeslijsten', tekst: 'menuLeeslijsten', verborgen: true },
    { pagina: 'over', href: 'over-ons.html', tekst: 'menuOver' },
    { pagina: 'doemee', href: 'doe-mee.html', tekst: 'menuDoeMee' }
  ];

  /* Iconen (Feather, MIT-licentie). De kleur volgt de tekstkleur. */
  var ICOON = {
    wereld: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    maan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    zon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
  };

  function huidigThema() {
    var gezet = document.documentElement.getAttribute('data-theme');
    if (gezet) return gezet;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function zetThema(thema) {
    document.documentElement.setAttribute('data-theme', thema);
    try { localStorage.setItem(THEMA, thema); } catch (e) { /* enkel voor deze pagina */ }
    tekenKnoppen();
  }

  function tekenKnoppen() {
    var donker = huidigThema() === 'dark';
    var tk = document.getElementById('themaknop');
    if (tk) {
      tk.innerHTML = donker ? ICOON.zon : ICOON.maan;
      tk.setAttribute('aria-label', T.t(donker ? 'donkerUit' : 'donkerAan'));
      tk.setAttribute('aria-pressed', donker ? 'true' : 'false');
    }
    var tl = document.getElementById('taalknop');
    if (tl) {
      tl.innerHTML = ICOON.wereld + '<span>' + T.t('taalKnop') + '</span>';
      tl.setAttribute('aria-label', T.t('taalLabel'));
      tl.setAttribute('lang', T.taal() === 'nl' ? 'en' : 'nl');
    }
  }

  function kop(pagina) {
    var el = document.getElementById('site-kop');
    if (!el) return;
    el.className = 'site-kop';
    el.innerHTML =
      '<a class="overslaan" href="#inhoud" data-i18n="overslaan"></a>' +
      '<div class="site-kop-binnen">' +
      '  <a class="merk" href="index.html"><img src="assets/logo.svg" alt="" width="44" height="44"><span class="merk-naam">Project Madrigal</span></a>' +
      '  <button type="button" class="menuknop" id="menuknop" aria-expanded="false" aria-controls="hoofdmenu" data-i18n-aria-label="menu">' + ICOON.menu + '</button>' +
      '  <nav class="hoofdmenu" id="hoofdmenu" data-i18n-aria-label="menu"><ul>' +
      MENU.map(function (m) {
        var weg = m.verborgen && leesLeeslijsten() !== 'ja';
        return '<li' + (weg ? ' hidden' : '') + ' data-menu="' + m.pagina + '"><a href="' + m.href + '" data-i18n="' + m.tekst + '"' + (m.pagina === pagina ? ' aria-current="page"' : '') + '></a></li>';
      }).join('') +
      '  </ul>' +
      '  <div class="kopknoppen"><button type="button" class="ikoonknop" id="taalknop"></button><button type="button" class="ikoonknop" id="themaknop"></button></div>' +
      '  </nav>' +
      '</div>';
    document.getElementById('menuknop').addEventListener('click', function () {
      var open = this.getAttribute('aria-expanded') !== 'true';
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
      el.classList.toggle('menu-open', open);
    });
    document.getElementById('taalknop').addEventListener('click', function () {
      T.kies(T.taal() === 'nl' ? 'en' : 'nl');
    });
    document.getElementById('themaknop').addEventListener('click', function () {
      zetThema(huidigThema() === 'dark' ? 'light' : 'dark');
    });
  }

  function voet() {
    var el = document.getElementById('site-voet');
    if (!el) return;
    el.className = 'site-voet';
    el.innerHTML =
      '<div class="site-voet-binnen">' +
      '  <p><strong>Project Madrigal</strong></p>' +
      '  <p data-i18n="voetTekst"></p>' +
      '  <p><a href="boeken.html#/privacy" data-i18n="privacy"></a> · <a href="balie.html" data-i18n="vrijwilligers"></a></p>' +
      '  <p><a class="sociaal" href="' + INSTAGRAM + '" target="_blank" rel="noopener" data-i18n-aria-label="instagramLabel">' + ICOON.instagram + '<span>@ProjectMadrigal</span></a></p>' +
      '</div>';
  }

  /**
   * Bezoekersaantallen via GoatCounter, enkel op de publieke pagina's en enkel als
   * statistiek in config.js ingevuld is. Geen cookies, geen persoonsgegevens.
   * Wie in de browser "niet volgen" aanzette, tellen we niet. Zoekwoorden sturen we nooit door.
   */
  function statistiek() {
    var code = (window.MADRIGAL_CONFIG || {}).statistiek;
    if (!code || !/^[a-z0-9-]+$/.test(code)) return;
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
    window.goatcounter = { no_onload: true };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://gc.zgo.at/count.js';
    s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
    s.addEventListener('load', tel);
    document.head.appendChild(s);
    window.addEventListener('hashchange', tel);
  }

  /** Telt de huidige pagina. Bij boeken ook welk boek, maar nooit wat iemand zocht. */
  function tel() {
    if (!window.goatcounter || !window.goatcounter.count) return;
    var hash = location.hash.split('?')[0];
    window.goatcounter.count({ path: location.pathname + (/^#\/(boek|privacy|leeslijsten)/.test(hash) ? hash : '') });
  }

  /*
   * Het menu-item Leeslijsten. De catalogus en de startpagina vertellen of het mag verschijnen
   * (instelling leeslijsten_tonen). De browser onthoudt dat voor de andere pagina's.
   */
  var LEESLIJSTEN = 'madrigal_leeslijsten';
  function leesLeeslijsten() {
    try { return localStorage.getItem(LEESLIJSTEN); } catch (e) { return null; }
  }
  function leeslijstenTonen(aan) {
    try { localStorage.setItem(LEESLIJSTEN, aan ? 'ja' : 'nee'); } catch (e) { /* enkel voor deze pagina */ }
    var li = document.querySelector('[data-menu="leeslijsten"]');
    if (li) li.hidden = !aan;
  }
  /** Welk menu-item de huidige pagina is (op boeken.html: Boeken of Leeslijsten). */
  function huidig(pagina) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-menu]'), function (li) {
      var a = li.querySelector('a');
      if (li.getAttribute('data-menu') === pagina) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  window.MadrigalLayout = { leeslijstenTonen: leeslijstenTonen, huidig: huidig };

  /** Offline werken en installeren als app (zie sw.js). Niet in het voorbeeld op je eigen computer. */
  function offline() {
    if (!('serviceWorker' in navigator) || (location.protocol !== 'https:' && location.hostname !== 'localhost')) return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* geen probleem: de site werkt ook zonder */ });
  }

  var pagina = document.body.getAttribute('data-pagina');
  offline();
  kop(pagina);
  statistiek();
  voet();
  T.toepassen();
  tekenKnoppen();
  document.addEventListener('taalgewijzigd', tekenKnoppen);
  // Volgt de instelling van het toestel zolang er niets gekozen is.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', tekenKnoppen);
  }
})();
