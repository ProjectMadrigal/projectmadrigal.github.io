/**
 * home.js
 * De startpagina: de wisselende woorden in de hoofding, en het nieuws, de agenda,
 * de aanraders, de veelgestelde vragen en de contactgegevens uit de spreadsheet
 * (via ?actie=site). Zonder web-app tonen we verzonnen voorbeeldinhoud.
 */
(function () {
  'use strict';

  var T = window.MadrigalTaal;
  var D = window.MadrigalDom;
  var el = D.el;
  var CONFIG = window.MADRIGAL_CONFIG || {};
  var CACHE_SLEUTEL = 'madrigal_site_v1';
  var data = null;

  /** Staat er nog niets in Instellingen, dan tonen we de gegevens van de oude website. */
  var STANDAARD = {
    adres: 'Peperfabriek (eerste verdieping)\nBreughelstraat 31\n2018 Antwerpen',
    openingsuren: { nl: 'Elke vrijdag: 18:00 - 20:00', en: 'Every Friday: 18:00 - 20:00' },
    mail_algemeen: 'info@projectmadrigal.be',
    mail_events: 'events.madrigal@gmail.com'
  };

  function $(id) { return document.getElementById(id); }

  /** Kiest de tekst in de gekozen taal uit { nl, en }. */
  function tt(w) {
    if (!w) return '';
    if (typeof w === 'string') return w;
    return w[T.taal()] || w.nl || '';
  }

  /* ---------- Hoofding: "Ik ben ..." met wisselende woorden ---------- */

  var typTimer = null;
  var rustig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function startHero() {
    clearTimeout(typTimer);
    var woorden = T.t('heroWoorden');
    // Schermlezers krijgen de hele lijst één keer, niet het getyp.
    $('hero-alles').textContent = woorden.join(', ');
    var vak = $('hero-woord');
    if (rustig) { vak.textContent = woorden[woorden.length - 1]; return; }
    var i = 0, n = 0, wissen = false;
    (function stap() {
      var woord = woorden[i];
      if (!wissen) {
        n++;
        vak.textContent = woord.slice(0, n);
        if (n === woord.length) { wissen = true; typTimer = setTimeout(stap, 1800); return; }
        typTimer = setTimeout(stap, 110);
      } else {
        n--;
        vak.textContent = woord.slice(0, n);
        if (n === 0) { wissen = false; i = (i + 1) % woorden.length; typTimer = setTimeout(stap, 300); return; }
        typTimer = setTimeout(stap, 50);
      }
    })();
  }

  $('hero-zoek').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('hero-q').value.trim();
    location.href = 'boeken.html#/' + (q ? '?' + new URLSearchParams({ q: q }).toString() : '');
  });

  /* ---------- Inhoud tekenen ---------- */

  /** Een link die naar buiten gaat, opent in een nieuw tabblad. */
  function link(href, tekst) {
    var extern = /^https?:\/\//.test(href) && href.indexOf(location.host) === -1;
    return el('a', { href: href, target: extern ? '_blank' : null, rel: extern ? 'noopener' : null }, tekst);
  }

  function nieuwsKaart(n) {
    return el('article', { class: 'nieuwskaart' },
      n.afbeelding ? el('img', { src: n.afbeelding, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'inhoud' },
        el('h3', null, tt(n.titel)),
        n.datum ? el('p', { class: 'datum' }, T.datum(n.datum)) : null,
        el('div', { class: 'tekstblok' }, el('p', null, tt(n.tekst))),
        n.link ? el('p', null, link(n.link, T.t('meerInfo'))) : null));
  }

  function eventKaart(e, kop) {
    var wanneer = T.datum(e.datum) + (e.uur ? ', ' + e.uur : '');
    return el('article', { class: 'nieuwskaart' },
      e.afbeelding ? el('img', { src: e.afbeelding, alt: '', loading: 'lazy' }) : null,
      el('div', { class: 'inhoud' },
        kop ? el('p', { class: 'datum' }, kop) : null,
        el('h3', null, tt(e.titel)),
        el('p', { class: 'datum' }, wanneer + (e.locatie ? ' · ' + e.locatie : '')),
        tt(e.tekst) ? el('div', { class: 'tekstblok' }, el('p', null, tt(e.tekst))) : null,
        e.link ? el('p', null, link(e.link, T.t('meerInfo'))) : null,
        e.datum >= vandaag() ? el('p', null, el('button', { type: 'button', class: 'knop tweede klein', onclick: function () {
          window.MadrigalAgenda.download({ datum: e.datum, uur: e.uur, titel: tt(e.titel), tekst: tt(e.tekst), locatie: e.locatie, link: e.link });
        } }, T.t('inMijnAgenda'))) : null));
  }

  /** De datum van vandaag als "JJJJ-MM-DD", in de tijdzone van de bezoeker. */
  function vandaag() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function aanrader(b, inNieuw) {
    var beeld = b.c ? el('img', { class: 'cover', src: b.c, alt: '', loading: 'lazy' }) : D.plaatshouder(b);
    if (b.c) beeld.addEventListener('error', function () { beeld.replaceWith(D.plaatshouder(b)); });
    var label = (b.r || []).length ? el('span', { class: 'aanrader-label' }, T.t('aanraderVan', { naam: b.r.join(', ') }))
      : (b.n && !inNieuw ? el('span', { class: 'aanrader-label nieuw' }, T.t('nieuwBinnen')) : null);
    return el('li', { class: 'aanrader' },
      el('a', { href: 'boeken.html#/boek/' + encodeURIComponent(b.id) },
        beeld,
        label,
        el('span', { class: 'aanrader-titel' }, b.t),
        b.a ? el('span', { class: 'aanrader-auteur' }, b.a) : null,
        b.w ? el('span', { class: 'aanrader-auteur' }, T.t('gevoelig')) : null));
  }

  /**
   * Verdeelt de sectie In de kijker in groepen: eerst per persoon (wie de meeste boeken
   * aanraadt eerst), dan wat het bestuur zelf op de startpagina zette.
   * Een boek met meerdere namen staat bij de eerste naam. Nieuw binnen is een eigen sectie.
   */
  function aanraderGroepen(lijst) {
    var perNaam = {}, namen = [], kijker = [];
    lijst.forEach(function (b) {
      var naam = (b.r || [])[0];
      if (naam) {
        if (!perNaam[naam]) { perNaam[naam] = []; namen.push(naam); }
        perNaam[naam].push(b);
      } else if (!b.n) kijker.push(b);
    });
    namen.sort(function (a, c) { return perNaam[c].length - perNaam[a].length; });
    var groepen = namen.map(function (naam) { return { titel: T.t('aanradersVan', { naam: naam }), naam: naam, ster: true, boeken: perNaam[naam] }; });
    if (kijker.length) groepen.push({ titel: T.t('uitgelicht'), boeken: kijker });
    return groepen;
  }

  function tekenAanraders(lijst) {
    var groepen = aanraderGroepen(lijst);
    return groepen.map(function (g, i) {
      var id = 'aanradergroep-' + i;
      return el('div', { class: 'aanradergroep' },
        el('h3', { id: id, class: g.ster ? 'met-ster' : null }, g.titel),
        el('ul', { class: 'aanraders', 'aria-labelledby': id }, g.boeken.map(function (b) { return aanrader(b, false); })),
        g.naam ? el('p', { class: 'meer' }, el('a', { href: 'boeken.html#/?aanrader=' + encodeURIComponent('Aanrader van ' + g.naam) }, T.t('alleAanradersVan', { naam: g.naam }))) : null);
    });
  }

  function teken() {
    if (!data) return;

    var nieuws = data.nieuws || [];
    $('nieuws-sectie').hidden = !nieuws.length;
    D.vervang($('nieuws'), nieuws.map(nieuwsKaart));

    var ag = data.agenda || {};
    var kaarten = (ag.komend || []).map(function (e, i) { return eventKaart(e, i === 0 ? T.t('volgendEvent') : ''); });
    if (!kaarten.length) kaarten.push(el('p', null, T.t('geenEvents')));
    if (ag.vorig) kaarten.push(eventKaart(ag.vorig, T.t('vorigEvent')));
    D.vervang($('agenda'), kaarten);

    // Nieuw binnen: een eigen lijst van de web-app. Oudere versies van het script
    // stuurden die nog niet mee: dan de boeken met het kenmerk "nieuw" uit de aanraders.
    var nieuw = data.nieuw || (data.aanraders || []).filter(function (b) { return b.n; });
    $('nieuw-sectie').hidden = !nieuw.length;
    D.vervang($('nieuw-binnen'), nieuw.map(function (b) { return aanrader(b, true); }));

    var groepen = tekenAanraders(data.aanraders || []);
    $('aanraders-sectie').hidden = !groepen.length;
    D.vervang($('aanraders'), groepen);

    var faq = data.faq || [];
    $('faq-sectie').hidden = !faq.length;
    D.vervang($('faq'), faq.map(function (v) {
      return el('details', null, el('summary', null, tt(v.vraag)), el('div', { class: 'tekstblok' }, el('p', null, tt(v.antwoord))));
    }));

    tekenContact();
  }

  function tekenContact() {
    var c = (data && data.contact) || {};
    var veld = function (k) { return tt(c[k]) ? c[k] : STANDAARD[k]; };
    $('adres').textContent = veld('adres');
    $('openingsuren').textContent = tt(veld('openingsuren'));
    var mails = [['algemeen', veld('mail_algemeen')], ['events', veld('mail_events')]].map(function (m) {
      return el('div', null, T.t(m[0]) + ': ', el('a', { href: 'mailto:' + m[1] }, m[1]));
    });
    D.vervang($('mails'), mails);
  }

  /* ---------- Ophalen ---------- */

  function ontvang(tekst, bewaar) {
    var nieuw;
    try { nieuw = JSON.parse(tekst); } catch (e) { return; }
    if (!nieuw || !nieuw.contact) return;
    data = nieuw;
    if (window.MadrigalLayout) window.MadrigalLayout.leeslijstenTonen(nieuw.leeslijsten === true);
    if (bewaar) { try { localStorage.setItem(CACHE_SLEUTEL, tekst); } catch (e) { /* geen opslag */ } }
    teken();
  }

  function haal() {
    var gekoppeld = !!CONFIG.apiUrl;
    $('voorbeeld-melding').hidden = gekoppeld;
    var bewaard = null;
    if (gekoppeld) { try { bewaard = localStorage.getItem(CACHE_SLEUTEL); } catch (e) { /* geen opslag */ } }
    if (bewaard) ontvang(bewaard, false);
    fetch(gekoppeld ? CONFIG.apiUrl + '?actie=site' : 'voorbeeld/site.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Status ' + r.status); return r.text(); })
      .then(function (tekst) { if (tekst !== bewaard) ontvang(tekst, gekoppeld); })
      .catch(function () {
        if (data) return;
        // Niets binnen: de vaste contactgegevens blijven staan, de rest verdwijnt.
        data = { contact: {}, nieuws: [], agenda: {}, faq: [], aanraders: [] };
        teken();
      });
  }

  startHero();
  tekenContact();
  haal();
  document.addEventListener('taalgewijzigd', function () { startHero(); if (data) teken(); else tekenContact(); });
})();
