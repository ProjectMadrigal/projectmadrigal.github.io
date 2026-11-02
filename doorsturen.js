/* 404.html: adressen van de oude website sturen we door naar de nieuwe pagina's. */
// Adressen van de oude website sturen we door naar de nieuwe pagina's.
(function () {
  var pad = location.pathname.replace(/\/+$/, '').toLowerCase();
  var naar = {
    '/boeken': 'boeken.html',
    '/over-project-madrigal': 'over-ons.html',
    '/over-ons': 'over-ons.html',
    '/home': 'index.html'
  };
  var basis = location.pathname.replace(/[^\/]*\/?$/, '');
  Object.keys(naar).forEach(function (oud) {
    if (pad.slice(-oud.length) === oud) location.replace(basis + naar[oud]);
  });
})();
