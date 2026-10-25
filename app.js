/**
 * app.js
 * De publieke catalogus: lijst, zoeken, filters en de detailpagina per boek.
 * De gegevens laden één keer. Zoeken en filteren gebeurt daarna in de browser.
 *
 * Adressen (alles na het #-teken, zodat GitHub Pages geen extra pagina's nodig heeft):
 *   #/                     de lijst
 *   #/?q=baldwin&taal=Engels   de lijst met een zoekopdracht en filters
 *   #/boek/B0012           de detailpagina van een boek (vaste link om te delen)
 *   #/privacy              de privacyverklaring
 *   #/leeslijsten          alle leeslijsten (thema's), elk met een link naar #/?lijst=...
 *
 * Hetzelfde script maakt de pagina Films (films.html, <body data-soort="film">): enkel de films,
 * met hun eigen filters (genre, land, periode) en #/film/F0001 voor de detailpagina.
 * Zolang de instelling films_tonen op nee staat, ziet enkel het bestuur de films (actie filmsVoorbeeld).
 */
(function () {
  'use strict';

  var Z = window.MadrigalZoeken;
  var F = window.MadrigalFilters;
  var D = window.MadrigalDom;
  var el = D.el;
  var T = window.MadrigalTaal;
  var t = T.t;

  var FILM = document.body.getAttribute('data-soort') === 'film';
  var PAD = FILM ? 'film' : 'boek'; // #/boek/B0012 of #/film/F0001
  var FILTERS = FILM ? F.FILMFILTERS : F.FILTERS;
  var PER_PAGINA = 30; // zoveel boeken staan er op één pagina (deelbaar door 2 en 3, voor het raster)

  var staat = {
    data: null,
    index: [],
    perId: {},
    keuzes: { q: '', beschikbaar: false, sorteer: 'relevantie', pagina: 1 },
    laatsteLijstAdres: '#/',
    laatstGeopend: null,
    scrollPositie: 0
  };

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Adres (hash) lezen en schrijven ---------- */

  function leesAdres() {
    var hash = location.hash.replace(/^#\/?/, '');
    var m = hash.match(/^(?:boek|film)\/([A-Za-z0-9\-]+)/);
    if (m) return { scherm: 'boek', id: decodeURIComponent(m[1]) };
    if (hash.indexOf('privacy') === 0) return { scherm: 'privacy' };
    if (hash.indexOf('leeslijsten') === 0) return { scherm: 'leeslijsten' };
    var params = new URLSearchParams(hash.replace(/^\?/, ''));
    var keuzes = {
      q: params.get('q') || '', beschikbaar: params.get('beschikbaar') === 'ja', sorteer: params.get('sorteer') || 'relevantie',
      pagina: Math.max(1, parseInt(params.get('pagina'), 10) || 1)
    };
    FILTERS.forEach(function (f) { if (params.get(f.sleutel)) keuzes[f.sleutel] = params.get(f.sleutel); });
    return { scherm: 'lijst', keuzes: keuzes };
  }

  function lijstAdres(pagina) {
    var params = new URLSearchParams();
    if (staat.keuzes.q) params.set('q', staat.keuzes.q);
    FILTERS.forEach(function (f) { if (staat.keuzes[f.sleutel]) params.set(f.sleutel, staat.keuzes[f.sleutel]); });
    if (staat.keuzes.beschikbaar) params.set('beschikbaar', 'ja');
    if (staat.keuzes.sorteer !== 'relevantie') params.set('sorteer', staat.keuzes.sorteer);
    var nr = pagina || staat.keuzes.pagina;
    if (nr > 1) params.set('pagina', nr);
    var p = params.toString();
    return '#/' + (p ? '?' + p : '');
  }

  function bewaarAdres() {
    staat.laatsteLijstAdres = lijstAdres();
    if (location.hash !== staat.laatsteLijstAdres && !(location.hash === '' && staat.laatsteLijstAdres === '#/')) {
      history.replaceState(null, '', staat.laatsteLijstAdres);
    }
  }

  /* ---------- Gegevens ---------- */

  /** Tekst uit de spreadsheet in de gekozen taal, met het Nederlands als terugval. */
  function tekst(sleutel) {
    var teksten = (staat.data && staat.data.teksten) || {};
    return (T.taal() === 'en' && teksten[sleutel + '_en']) || teksten[sleutel] || '';
  }

  /** Beschikbaarheid in de gekozen taal. Code, aantallen en datum komen van de server. */
  function status(b) {
    var s = b.b || {};
    if (s.c === 'tip') return t('stTip');
    if (s.c === 'niet_uitleenbaar') return t(s.k ? (FILM ? 'stTeKoopFilm' : 'stTeKoop') : 'stNietUitleenbaar');
    if (s.c === 'beschikbaar') return s.t > 1 ? t('stVanBeschikbaar', { v: s.v, t: s.t }) : t('stBeschikbaar');
    if (s.c === 'gereserveerd') return t('stGereserveerd');
    if (s.c === 'uitgeleend') return s.d ? t('stUitgeleendTot', { datum: T.datum(s.d) }) : t('stUitgeleend');
    return s.l || '';
  }

  /* ---------- Leeslijsten ---------- */

  function leeslijsten() {
    return (staat.data && staat.data.leeslijsten) || [];
  }

  function leeslijst(naam) {
    return leeslijsten().filter(function (l) { return l.n === naam; })[0] || { n: naam };
  }

  /** Naam van een leeslijst in de gekozen taal. */
  function lijstNaam(naam) {
    var l = leeslijst(naam);
    return (T.taal() === 'en' && l.ne) || l.n;
  }

  function lijstUitleg(l) {
    return (T.taal() === 'en' && l.ue) || l.u || '';
  }

  function lijstLink(naam) {
    return '#/?' + new URLSearchParams({ lijst: naam }).toString();
  }

  /** Boven de lijst: titel en uitleg van de gekozen leeslijst. */
  function toonLijstKop() {
    var vak = $('leeslijst-kop');
    var naam = staat.keuzes.lijst;
    vak.hidden = !naam;
    if (!naam) { D.vervang(vak); return; }
    var l = leeslijst(naam);
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    D.vervang(vak,
      el('p', { class: 'hulptekst' }, el('a', { href: '#/leeslijsten' }, t('alleLeeslijsten'))),
      el('h2', {}, t('leeslijst') + ': ' + lijstNaam(naam)),
      lijstUitleg(l) ? el('p', {}, lijstUitleg(l)) : null,
      el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        deelLink(lijstNaam(naam) + ' · Project Madrigal', location.href.split('#')[0] + lijstLink(naam), melding);
      } }, t('deelLijst'))),
      melding);
  }

  /** Het overzicht van alle leeslijsten. */
  function toonLeeslijsten() {
    var scherm = $('leeslijsten-scherm');
    var lijsten = leeslijsten();
    var boeken = (staat.data && staat.data.boeken) || [];
    var inhoud = lijsten.map(function (l) {
      var erin = boeken.filter(function (b) { return (b.ll || []).indexOf(l.n) > -1; });
      var voorbeeld = erin.filter(function (b) { return b.c; }).concat(erin.filter(function (b) { return !b.c; })).slice(0, 4);
      return el('li', { class: 'blok leeslijst' },
        el('h2', {}, el('a', { href: lijstLink(l.n) }, lijstNaam(l.n))),
        lijstUitleg(l) ? el('p', {}, lijstUitleg(l)) : null,
        voorbeeld.length ? el('div', { class: 'leeslijst-covers', 'aria-hidden': 'true' }, voorbeeld.map(function (b) { return cover(b, false); })) : null,
        el('p', { class: 'hulptekst' }, erin.length === 1 ? t('lijstAantal1') : t('lijstAantalN', { n: erin.length })));
    });
    D.vervang(scherm,
      el('a', { class: 'terug', href: '#/' }, t('terugCatalogus')),
      el('h1', { tabindex: '-1' }, t('leeslijsten')),
      el('p', {}, t('leeslijstenIntro')),
      inhoud.length ? el('ul', { class: 'leeslijsten' }, inhoud) : el('p', { class: 'blok' }, staat.data ? t('geenLeeslijsten') : t('laden')));
  }

  function zetTeksten() {
    $('welkom').textContent = tekst(FILM ? 'films' : 'welkom');
    $('uitleg-lenen').textContent = tekst('uitleg');
    $('privacy-tekst').textContent = tekst('privacy');
    // Leeslijsten staan enkel in de catalogus als de instelling leeslijsten_tonen op ja staat.
    var tonen = !!(staat.data && Array.isArray(staat.data.leeslijsten));
    if (window.MadrigalLayout) window.MadrigalLayout.leeslijstenTonen(tonen);
    if (window.MadrigalLayout && staat.data && !staat.data.voorbeeld) window.MadrigalLayout.filmsTonen(!!staat.data.filmsTonen);
    if ($('naar-leeslijsten')) $('naar-leeslijsten').hidden = FILM || !leeslijsten().length;
    var stat = $('privacy-statistiek');
    if (stat) stat.hidden = !(window.MADRIGAL_CONFIG || {}).statistiek;
  }

  /*
   * Films verborgen (films_tonen op nee)? Dan vraagt de pagina de films aan de web-app met de
   * bestuurscode die op dit toestel bewaard is. Zonder die code blijft de pagina leeg.
   */
  var voorbeeldGevraagd = false;
  function lees(sleutel) { try { return localStorage.getItem(sleutel) || ''; } catch (e) { return ''; } }

  function vraagVoorbeeld(data) {
    var code = lees('madrigal_code_bestuur');
    if (!code || !window.MadrigalApi.isGekoppeld()) { toonNietBeschikbaar(); return; }
    if (voorbeeldGevraagd) return;
    voorbeeldGevraagd = true;
    window.MadrigalApi.verstuur('filmsVoorbeeld', { code: code, wie: lees('madrigal_wie') || 'bestuur' }).then(function (r) {
      if (!r || !r.ok) { toonNietBeschikbaar(); return; }
      ontvang(Object.assign({}, data, { boeken: r.boeken, teksten: Object.assign({}, data.teksten, r.teksten), voorbeeld: true }));
    }, toonNietBeschikbaar);
  }

  function toonNietBeschikbaar() {
    $('laden').hidden = true;
    $('aantal').textContent = t('filmsNietBeschikbaar');
    D.vervang($('resultaten'));
  }

  function ontvang(data) {
    // Enkel de films op de pagina Films, en geen films op de pagina Boeken.
    data = Object.assign({}, data, { boeken: (data.boeken || []).filter(function (b) { return (b.s === 'film') === FILM; }) });
    if (FILM && !data.voorbeeld && !data.filmsTonen) {
      if (window.MadrigalLayout) window.MadrigalLayout.filmsTonen(false);
      vraagVoorbeeld(data);
      return;
    }
    if (FILM) $('films-voorbeeld').hidden = !data.voorbeeld;
    staat.data = data;
    staat.index = Z.maakIndex(data.boeken);
    staat.perId = {};
    data.boeken.forEach(function (b) { staat.perId[b.id] = b; });
    $('voorbeeld-melding').hidden = window.MadrigalApi.isGekoppeld();
    zetTeksten();
    $('laden').hidden = true;
    var eerste = !staat.geladen;
    staat.geladen = true;
    bouwFilters();
    if (eerste) { toonScherm(); return; }
    // Verse gegevens na de bewaarde versie: stil bijwerken, zonder focus of invoer te verstoren.
    var adres = leesAdres();
    if (adres.scherm === 'lijst') toonLijst();
    else if (adres.scherm === 'boek') toonDetail(adres.id);
    else if (adres.scherm === 'leeslijsten') toonLeeslijsten();
  }

  function fout() {
    $('laden').textContent = t('ladenFout');
    $('aantal').textContent = t('ladenFout');
  }

  /* ---------- Filters ---------- */

  function bouwFilters() {
    var opties = F.opties(staat.data.boeken, staat.data.filtergroepen, leeslijsten().map(function (l) { return l.n; }), FILTERS);
    var raster = $('filterraster');
    D.vervang(raster, FILTERS.map(function (f) {
      if (f.sleutel === 'lijst' && !opties.lijst.length) return null;
      var id = 'filter-' + f.sleutel;
      var select = el('select', { id: id, onchange: function () { staat.keuzes[f.sleutel] = this.value; nieuweLijst(); } },
        el('option', { value: '' }, t('alle')),
        opties[f.sleutel].map(function (o) {
          var naam = f.sleutel === 'lijst' ? lijstNaam(o.waarde) : T.waarde(o.waarde);
          return el('option', { value: o.waarde, selected: staat.keuzes[f.sleutel] === o.waarde }, naam + ' (' + o.aantal + ')');
        }));
      return el('div', { class: 'veld' }, el('label', { for: id }, t(f.labelSleutel) || f.label), select);
    }));
    $('filter-beschikbaar').checked = staat.keuzes.beschikbaar;
  }

  function zetFormulier() {
    $('zoek').value = staat.keuzes.q;
    $('sorteer').value = staat.keuzes.sorteer;
    $('filter-beschikbaar').checked = staat.keuzes.beschikbaar;
    FILTERS.forEach(function (f) {
      var s = $('filter-' + f.sleutel);
      if (s) s.value = staat.keuzes[f.sleutel] || '';
    });
  }

  function aantalActieveFilters() {
    var n = staat.keuzes.beschikbaar ? 1 : 0;
    FILTERS.forEach(function (f) { if (staat.keuzes[f.sleutel]) n++; });
    return n;
  }

  /* ---------- Lijst ---------- */

  function resultaten() {
    var gevonden = Z.zoek(staat.index, staat.keuzes.q).map(function (r) { return r.boek; });
    var gefilterd = F.pasToe(gevonden, staat.keuzes, FILTERS);
    var wijze = staat.keuzes.sorteer;
    if (wijze === 'relevantie' && !staat.keuzes.q.trim()) wijze = 'titel';
    return F.sorteer(gefilterd, wijze);
  }

  /** Andere zoekterm, filter of sortering: terug naar pagina 1. */
  function nieuweLijst() {
    staat.keuzes.pagina = 1;
    toonLijst();
    bewaarAdres();
  }

  function toonLijst() {
    if (!staat.data) return;
    var lijst = resultaten();
    var n = lijst.length;
    var paginas = Math.max(1, Math.ceil(n / PER_PAGINA));
    if (staat.keuzes.pagina > paginas) { staat.keuzes.pagina = paginas; bewaarAdres(); }
    var nu = staat.keuzes.pagina;
    D.vervang($('resultaten'), lijst.slice((nu - 1) * PER_PAGINA, nu * PER_PAGINA).map(boekKaart));
    var v = FILM ? 'Film' : ''; // gevonden0Film, gevonden1Film, gevondenNFilm
    // Nog geen enkele film in de Catalogus (voorbeeld voor het bestuur): zeg hoe je ze toevoegt.
    var leeg = FILM && staat.data.voorbeeld && !staat.data.boeken.length;
    $('aantal').textContent = leeg ? t('filmsNogGeen') : n === 0 ? t('gevonden0' + v)
      : (n === 1 ? t('gevonden1' + v) : t('gevondenN' + v, { n: n })) + (paginas > 1 ? t('paginaVan', { nu: nu, totaal: paginas }) : '');
    tekenPaginas(nu, paginas);
    toonLijstKop();
    var actief = aantalActieveFilters();
    $('filter-teller').textContent = actief ? t('filtersActief', { n: actief }) : '';
  }

  /** Welke paginanummers we tonen: de eerste, de laatste en twee rond de huidige. */
  function paginaNummers(nu, totaal) {
    var nrs = [];
    for (var i = 1; i <= totaal; i++) {
      if (i === 1 || i === totaal || Math.abs(i - nu) <= 2) nrs.push(i);
      else if (nrs[nrs.length - 1] !== '…') nrs.push('…');
    }
    return nrs;
  }

  function tekenPaginas(nu, totaal) {
    var nav = $('paginas');
    nav.hidden = totaal <= 1;
    if (totaal <= 1) { D.vervang(nav); return; }
    // Op een smal scherm verdwijnt het woord en blijft enkel de pijl (zie styles.css).
    var stap = function (nr, tekstSleutel, rel) {
      var pijl = rel === 'prev' ? '←' : '→';
      var inhoud = rel === 'prev'
        ? [pijl, el('span', { class: 'pagina-woord' }, ' ' + t(tekstSleutel))]
        : [el('span', { class: 'pagina-woord' }, t(tekstSleutel) + ' '), pijl];
      if (nr < 1 || nr > totaal) return el('span', { class: 'pagina-stap uit', 'aria-hidden': 'true' }, inhoud);
      return el('a', { class: 'pagina-stap', href: lijstAdres(nr), rel: rel, 'aria-label': t(tekstSleutel) }, inhoud);
    };
    D.vervang(nav,
      stap(nu - 1, 'vorige', 'prev'),
      el('ul', null, paginaNummers(nu, totaal).map(function (nr) {
        if (nr === '…') return el('li', { 'aria-hidden': 'true' }, '…');
        return el('li', null, el('a', {
          href: lijstAdres(nr), 'aria-current': nr === nu ? 'page' : null,
          'aria-label': t('paginaNr', { nr: nr })
        }, String(nr)));
      })),
      stap(nu + 1, 'volgende', 'next'));
  }

  function cover(b, groot) {
    var plaatshouder = D.plaatshouder(b);
    if (!b.c) return plaatshouder;
    var img = el('img', {
      class: 'cover', src: b.c, alt: groot ? t('coverVan', { titel: b.t }) : '', loading: 'lazy', decoding: 'async',
      width: groot ? 192 : 72, height: groot ? 288 : 108
    });
    img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(plaatshouder, img); });
    return img;
  }

  function meta(b) {
    if (FILM) return [b.j, b.la, b.du ? t('minuten', { n: b.du }) : ''].filter(Boolean).join(' · ');
    return [b.j, T.waarde(b.l), b.u].filter(Boolean).join(' · ');
  }

  /** Onder de titel: de auteur, of bij een film de regie. */
  function maker(b) {
    return b.a ? el('p', { class: 'auteur' }, FILM ? t('regieDoor', { naam: b.a }) : b.a) : null;
  }

  function labels(b) {
    var items = [el('li', {}, D.statusLabel(b.b.c, status(b)))];
    if (b.w) items.push(el('li', {}, el('span', { class: 'label label-gevoelig' }, t('gevoelig'))));
    (b.r || []).forEach(function (naam) { items.push(el('li', {}, el('span', { class: 'label label-aanrader' }, t('aanraderVan', { naam: naam })))); });
    return el('ul', { class: 'labels', 'aria-label': t('labels') }, items);
  }

  function boekKaart(b) {
    return el('li', { class: 'boek' },
      cover(b, false),
      el('div', {},
        el('h2', { class: 'boek-titel' }, el('a', { href: '#/' + PAD + '/' + encodeURIComponent(b.id), 'data-id': b.id }, b.t)),
        maker(b),
        meta(b) ? el('p', { class: 'meta' }, meta(b)) : null,
        labels(b)));
  }

  /* ---------- Detailpagina ---------- */

  /**
   * Online reserveren: enkel als het bestuur de instelling online_reserveren aanzette
   * en het boek uitleenbaar is. Geeft { knop, vak } of null.
   */
  function reservatieBlok(b) {
    var teksten = (staat.data && staat.data.teksten) || {};
    if (!teksten.online_reserveren || b.b.c === 'niet_uitleenbaar' || b.b.c === 'tip' || (staat.data && staat.data.voorbeeld) || !window.MadrigalApi.isGekoppeld()) return null;
    var vak = el('div', { class: 'blok reservatie', hidden: true });
    var knop = el('button', { type: 'button', class: 'knop', 'aria-expanded': 'false', 'aria-controls': 'reservatie-vak',
      onclick: function () {
        vak.hidden = !vak.hidden;
        knop.setAttribute('aria-expanded', vak.hidden ? 'false' : 'true');
        if (!vak.hidden) $('res-voornaam').focus();
      } }, t('reserveer'));
    vak.id = 'reservatie-vak';
    var melding = el('div', { 'aria-live': 'polite' });
    var verstuur = el('button', { type: 'submit', class: 'knop' }, t('reserveerVerstuur'));
    var formulier = el('form', { novalidate: true },
      el('h2', { class: 'klein' }, t('reserveerTitel')),
      el('p', {}, t('reserveerUitleg')),
      el('div', { class: 'veld' }, el('label', { for: 'res-voornaam' }, t('reserveerVoornaam')),
        el('input', { type: 'text', id: 'res-voornaam', autocomplete: 'given-name', maxlength: '40', required: true })),
      el('div', { class: 'veld' }, el('label', { for: 'res-contact' }, t('reserveerContact')),
        el('input', { type: 'text', id: 'res-contact', autocomplete: 'email', maxlength: '80', required: true })),
      el('div', { class: 'veld' }, el('label', { for: 'res-opmerking' }, t('reserveerOpmerking')),
        el('textarea', { id: 'res-opmerking', maxlength: '300', rows: '3' })),
      // Enkel robots vullen dit veld in. Mensen zien het niet.
      el('div', { class: 'verborgen', 'aria-hidden': 'true' },
        el('label', { for: 'res-website' }, 'Website'), el('input', { type: 'text', id: 'res-website', tabindex: '-1', autocomplete: 'off' })),
      el('label', { class: 'vinkje', for: 'res-toestemming' }, el('input', { type: 'checkbox', id: 'res-toestemming' }),
        el('span', {}, t('reserveerToestemming'), ' ', el('a', { href: '#/privacy' }, t('privacy')))),
      melding,
      el('div', { class: 'knoppen' }, verstuur));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      verstuur.disabled = true;
      window.MadrigalApi.verstuur('reservatieAanvraag', {
        boek_id: b.id, voornaam: $('res-voornaam').value, contact: $('res-contact').value,
        opmerking: $('res-opmerking').value, website: $('res-website').value, toestemming: $('res-toestemming').checked
      }).then(function (r) {
        verstuur.disabled = false;
        if (!r.ok) { D.vervang(melding, el('p', { class: 'melding fout', role: 'alert' }, r.fout)); return; }
        D.vervang(vak, el('p', { class: 'melding ok', role: 'status', tabindex: '-1' }, t('reserveerGelukt')));
        knop.remove(); // de stijl van .knop zou hidden negeren
        vak.firstChild.focus();
      });
    });
    vak.appendChild(formulier);
    return { knop: knop, vak: vak };
  }

  function toonDetail(id) {
    var b = staat.perId[id];
    var scherm = $('detail-scherm');
    var terug = el('a', { class: 'terug', href: staat.laatsteLijstAdres }, t(FILM ? 'terugFilms' : 'terugCatalogus'));
    if (!b) {
      D.vervang(scherm, terug, el('div', { class: 'blok' },
        el('h1', { tabindex: '-1' }, t(FILM ? 'filmNietGevonden' : 'nietGevonden')),
        el('p', {}, t(FILM ? 'filmNietGevondenTekst' : 'nietGevondenTekst'))));
      document.title = t(FILM ? 'filmNietGevonden' : 'nietGevonden') + ' · Project Madrigal';
      return;
    }
    var rijen = FILM ? [
      [t('vJaar'), b.j], [t('vLand'), b.la], [t('vRegie'), b.a], [t('vDuur'), b.du ? t('minuten', { n: b.du }) : ''],
      [t('vTaal'), T.waarde(b.l)], [t('vUitvoering'), T.waarde(b.v)]
    ].filter(function (r) { return r[1]; }) : [
      [t('vJaartal'), b.j], [t('vTaal'), T.waarde(b.l)], [t('vUitgeverij'), b.u], [t('vPaginas'), b.p], [t('vUitvoering'), T.waarde(b.v)],
      [t('vStaat'), b.n === 'nieuw' ? t('nieuw') : (b.n === 'tweedehands' ? t('tweedehands') : '')], [t('vIsbn'), b.i],
      [t('vSoort'), b.s === 'zine' ? t('zine') : '']
    ].filter(function (r) { return r[1]; });

    var onderwerpen = (b.g || []).map(function (g) {
      return el('li', {}, el('a', { class: 'label label-onderwerp', href: '#/?' + (FILM ? 'genre' : 'groep') + '=' + encodeURIComponent(g) }, T.waarde(g)));
    });
    var uitlegStatus = {
      beschikbaar: t(FILM ? 'uitlegBeschikbaarFilm' : 'uitlegBeschikbaar'),
      uitgeleend: t('uitlegUitgeleend'),
      gereserveerd: t('uitlegGereserveerd'),
      tip: t('uitlegTip'),
      niet_uitleenbaar: ''
    }[b.b.c] || '';

    var deelKnop = el('button', { type: 'button', class: 'knop tweede', onclick: function () { deel(b); } }, t(FILM ? 'deelFilm' : 'deelBoek'));
    var reservatie = reservatieBlok(b);

    D.vervang($('detail-scherm'), terug, el('article', { class: 'blok detail' },
      el('div', {}, cover(b, true)),
      el('div', {},
        el('h1', { tabindex: '-1' }, b.t),
        maker(b),
        el('p', { class: 'beschikbaarheid' }, D.statusLabel(b.b.c, status(b))),
        uitlegStatus ? el('p', {}, uitlegStatus) : null,
        b.w ? el('p', {}, el('span', { class: 'label label-gevoelig' }, t('gevoelig')), ' ', t('gevoeligUitleg')) : null,
        (b.r || []).length ? el('ul', { class: 'labels' }, b.r.map(function (n) {
          return el('li', {}, el('a', { class: 'label label-aanrader', href: '#/?aanrader=' + encodeURIComponent('Aanrader van ' + n) }, t('aanraderVan', { naam: n })));
        })) : null,
        (b.ll || []).length ? el('ul', { class: 'labels', 'aria-label': t('leeslijsten') }, b.ll.map(function (n) {
          return el('li', {}, el('a', { class: 'label label-leeslijst', href: lijstLink(n) }, t('leeslijst') + ': ' + lijstNaam(n)));
        })) : null,
        b.d ? el('p', { class: 'beschrijving' }, (T.taal() === 'en' && b.de) || b.d) : null,
        b.d && b.db ? el('p', { class: 'hulptekst' }, t('bronWikipedia') + ' ', el('a', { href: b.db, target: '_blank', rel: 'noopener' }, 'Wikipedia'),
          ' (', el('a', { href: 'https://creativecommons.org/licenses/by-sa/4.0/deed.nl', target: '_blank', rel: 'noopener' }, 'CC BY-SA 4.0'), ')' + (T.taal() === 'en' ? '' : t('bronVertaald'))) : null,
        el('dl', { class: 'gegevens' }, rijen.map(function (r) { return [el('dt', {}, r[0]), el('dd', {}, String(r[1]))]; })),
        onderwerpen.length ? el('div', {}, el('h2', { class: 'klein' }, t(FILM ? 'genres' : 'onderwerpen')), el('ul', { class: 'labels' }, onderwerpen)) : null,
        el('div', { class: 'knoppen' }, reservatie ? reservatie.knop : null, deelKnop),
        reservatie ? reservatie.vak : null,
        el('p', { class: 'hulptekst', id: 'deel-melding', 'aria-live': 'polite' }))),
      leesOok(b));
    document.title = b.t + ' · Project Madrigal';
  }

  /** "Lees ook": boeken die op dit boek lijken (zie filters.js). */
  function leesOok(b) {
    var lijst = F.gelijkaardig(staat.data.boeken, b, 6);
    if (!lijst.length) return null;
    return el('section', { class: 'blok lees-ook', 'aria-labelledby': 'lees-ook-titel' },
      el('h2', { id: 'lees-ook-titel' }, t(FILM ? 'kijkOok' : 'leesOok')),
      el('ul', { class: 'aanraders' }, lijst.map(function (x) {
        return el('li', { class: 'aanrader' }, el('a', { href: '#/' + PAD + '/' + encodeURIComponent(x.id) },
          cover(x, false),
          el('span', { class: 'aanrader-titel' }, x.t),
          x.a ? el('span', { class: 'aanrader-auteur' }, x.a) : null));
      })));
  }

  function deel(b) {
    var url = location.href.split('#')[0] + '#/' + PAD + '/' + encodeURIComponent(b.id);
    deelLink(b.t + (b.a ? ' · ' + b.a : '') + ' · Project Madrigal', url, $('deel-melding'), b.t);
  }

  /** Delen via de deelknop van de gsm, anders de link kopiëren. */
  function deelLink(tekst, url, melding, titel) {
    if (navigator.share) {
      navigator.share({ title: titel || tekst, text: tekst, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { melding.textContent = t('linkGekopieerd'); },
        function () { melding.textContent = t('kopieerLink', { url: url }); });
    } else {
      melding.textContent = t('kopieerLink', { url: url });
    }
  }

  /* ---------- Schermen wisselen ---------- */

  function toonScherm() {
    var adres = leesAdres();
    var lijst = $('lijst-scherm'), detail = $('detail-scherm'), privacy = $('privacy-scherm'), lijsten = $('leeslijsten-scherm');
    lijst.hidden = adres.scherm !== 'lijst';
    detail.hidden = adres.scherm !== 'boek';
    privacy.hidden = adres.scherm !== 'privacy';
    lijsten.hidden = adres.scherm !== 'leeslijsten';
    if (window.MadrigalLayout) window.MadrigalLayout.huidig(FILM ? 'films' : adres.scherm === 'leeslijsten' || (adres.keuzes && adres.keuzes.lijst) ? 'leeslijsten' : 'boeken');

    if (adres.scherm === 'lijst') {
      document.title = t(FILM ? 'filmsTitel' : 'catalogusTitel') + ' · Project Madrigal';
      var anderePagina = staat.data && adres.keuzes.pagina !== staat.keuzes.pagina;
      staat.keuzes = adres.keuzes;
      staat.laatsteLijstAdres = lijstAdres();
      zetFormulier();
      toonLijst();
      // Andere pagina gekozen: naar boven, en de schermlezer leest het aantal en de pagina.
      if (anderePagina && !staat.laatstGeopend) {
        $('lijst-titel').scrollIntoView();
        $('aantal').focus({ preventScroll: true });
      }
      // Terug van een detailpagina: zelfde plek en focus op hetzelfde boek.
      if (staat.laatstGeopend) {
        window.scrollTo(0, staat.scrollPositie);
        var link = document.querySelector('[data-id="' + CSS.escape(staat.laatstGeopend) + '"]');
        if (link) link.focus({ preventScroll: true });
        staat.laatstGeopend = null;
      }
    } else if (adres.scherm === 'boek') {
      if (!staat.data) return;
      toonDetail(adres.id);
      window.scrollTo(0, 0);
      var kop = detail.querySelector('h1');
      if (kop) kop.focus({ preventScroll: true });
    } else if (adres.scherm === 'leeslijsten') {
      document.title = t('leeslijsten') + ' · Project Madrigal';
      toonLeeslijsten();
      window.scrollTo(0, 0);
      lijsten.querySelector('h1').focus({ preventScroll: true });
    } else {
      document.title = 'Privacy · Project Madrigal';
      window.scrollTo(0, 0);
      privacy.querySelector('h1').focus({ preventScroll: true });
    }
  }

  /* ---------- Gebeurtenissen ---------- */

  function vertraag(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  function start() {
    // Het zoekveld op de startpagina stuurt naar boeken.html?q=...: zet dat om naar #/?q=...
    var zoekvraag = new URLSearchParams(location.search).get('q');
    if (zoekvraag && !location.hash) history.replaceState(null, '', location.pathname + '#/?' + new URLSearchParams({ q: zoekvraag }).toString());
    var adres = leesAdres();
    if (adres.scherm === 'lijst') staat.keuzes = adres.keuzes;
    zetFormulier();

    $('zoek').addEventListener('input', vertraag(function () {
      staat.keuzes.q = $('zoek').value;
      nieuweLijst();
    }, 180));
    $('zoekformulier').addEventListener('submit', function (e) {
      e.preventDefault();
      staat.keuzes.q = $('zoek').value;
      nieuweLijst();
      // Enter in het zoekveld: naar het eerste resultaat.
      var eerste = $('resultaten').querySelector('.boek-titel a');
      if (eerste) eerste.focus();
    });
    $('sorteer').addEventListener('change', function () { staat.keuzes.sorteer = this.value; nieuweLijst(); });
    $('filter-beschikbaar').addEventListener('change', function () { staat.keuzes.beschikbaar = this.checked; nieuweLijst(); });
    $('wis-filters').addEventListener('click', function () {
      FILTERS.forEach(function (f) { delete staat.keuzes[f.sleutel]; });
      staat.keuzes.beschikbaar = false;
      zetFormulier();
      nieuweLijst();
    });
    $('resultaten').addEventListener('click', function (e) {
      var a = e.target.closest('a[data-id]');
      if (a) { staat.laatstGeopend = a.getAttribute('data-id'); staat.scrollPositie = window.scrollY; }
    });
    window.addEventListener('hashchange', toonScherm);
    // Andere taal gekozen: alles opnieuw tekenen, zonder de focus te verplaatsen.
    document.addEventListener('taalgewijzigd', function () {
      if (!staat.data) return;
      zetTeksten();
      bouwFilters();
      zetFormulier();
      var adres = leesAdres();
      if (adres.scherm === 'lijst') toonLijst();
      else if (adres.scherm === 'boek') toonDetail(adres.id);
      else if (adres.scherm === 'leeslijsten') { toonLeeslijsten(); document.title = t('leeslijsten') + ' · Project Madrigal'; }
    });

    window.MadrigalApi.haalCatalogus(ontvang, fout);
  }

  start();
})();
