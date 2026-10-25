/**
 * sw.js
 * Laat de website ook zonder internet openen, en maakt ze installeerbaar als app op een gsm.
 *
 * Zo werkt het:
 *   - Bij het eerste bezoek bewaart de browser de vaste bestanden (HTML, stijl, scripts, lettertypes).
 *   - Daarna vraagt de browser elk bestand altijd eerst vers op bij GitHub ("eerst het net").
 *     Een wijziging aan de site is dus meteen zichtbaar. Enkel zonder internet komt de bewaarde versie.
 *   - De catalogus en de teksten van de startpagina bewaren api.js en home.js zelf in de browser.
 *   - Covers (van andere websites), de web-app van Google en het rooster (/rooster/) gaan er niet door.
 *
 * Een bestand toegevoegd dat ook offline moet werken? Zet het in VASTE_BESTANDEN en verhoog VERSIE.
 */
'use strict';

var VERSIE = 'madrigal-v2';
var VASTE_BESTANDEN = [
  './', 'index.html', 'boeken.html', 'over-ons.html', 'doe-mee.html', 'peperfabriek.html',
  'styles.css', 'config.js', 'i18n.js', 'layout.js', 'api.js', 'dom.js', 'zoeken.js', 'filters.js',
  'app.js', 'home.js', 'agenda.js', 'doemee.js', 'peperfabriek.js',
  'assets/logo.svg', 'assets/fonts/Geist-Variable.woff2', 'assets/fonts/GeistMono-Variable.ttf',
  'manifest.json', 'icons/icoon-192.png', 'icons/icoon-512.png', 'favicon.ico'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIE).then(function (cache) {
    // Eén ontbrekend bestand mag de installatie niet laten mislukken.
    return Promise.all(VASTE_BESTANDEN.map(function (url) {
      return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (namen) {
    return Promise.all(namen.filter(function (n) { return n !== VERSIE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

/** Enkel bestanden van deze website, behalve het rooster (dat is een aparte tool). */
function hoortErbij(request) {
  if (request.method !== 'GET') return false;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return url.pathname.indexOf('/rooster/') !== 0 && url.pathname !== '/rooster';
}

self.addEventListener('fetch', function (e) {
  var request = e.request;
  if (!hoortErbij(request)) return;
  e.respondWith(fetch(request).then(function (antwoord) {
    if (antwoord && antwoord.ok && antwoord.type === 'basic') {
      var kopie = antwoord.clone();
      caches.open(VERSIE).then(function (cache) { cache.put(request, kopie); });
    }
    return antwoord;
  }).catch(function () {
    // Geen internet: de bewaarde versie. Een pagina die we niet kennen: de startpagina.
    return caches.match(request, { ignoreSearch: true }).then(function (bewaard) {
      if (bewaard) return bewaard;
      if (request.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    });
  }));
});
