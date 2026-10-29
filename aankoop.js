/**
 * aankoop.js
 * De aankooplijst in het bestuursscherm en het vrijwilligersscherm. Zie apps-script/Aankoop.js.
 *
 *   - Iedereen stelt een boek voor: titel, auteur, ISBN, link en waarom.
 *   - Enkel het bestuur (in het bestuursscherm): een lijst van bol.com inlezen (of ISBN's plakken),
 *     boeken aanpassen, aanduiden voor aankoop en verwijderen, en een lijst trekken van de
 *     aangeduide boeken: afdrukken, kopiëren of als CSV.
 *   - Boeken die in de catalogus komen, vinkt het script vanzelf af ("in de catalogus").
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var Z = root.MadrigalZoeken;

  var lijst = null;        // de laatst geladen aankooplijst
  var filter = 'open';     // 'open' of 'binnen'
  var zoekterm = '';

  function knoppen() { return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments)); }
  function prijs(p) { return p === null || p === undefined || p === '' ? '' : D.euro(p); }
  /** ", samen € 34,98." en hoeveel boeken nog geen prijs hebben. */
  function prijsSom(boeken, totaal) {
    var zonder = boeken.filter(function (b) { return b.p === null || b.p === undefined; }).length;
    if (zonder === boeken.length) return ', nog zonder prijs.';
    return ', samen ' + D.euro(totaal) + (zonder ? ' (' + zonder + (zonder === 1 ? ' boek' : ' boeken') + ' nog zonder prijs)' : '') + '.';
  }
  function isBestuur(ctx) { return ctx.scherm === 'bestuur' && B.sessie.rol === 'bestuur'; }
  function veld(id, label, invoer, hulp) {
    return el('div', { class: 'veld' }, el('label', { for: id }, label, hulp ? el('span', { class: 'hulptekst' }, ' ' + hulp) : null), invoer);
  }

  /** Voert een actie uit en tekent daarna de lijst opnieuw met wat de web-app teruggeeft. */
  function doe(actie, invoer, vak, ctx, melding, knop) {
    if (knop) knop.disabled = true;
    return B.voerUit(actie, invoer).then(function (r) {
      if (knop) knop.disabled = false;
      if (r.geannuleerd) return r;
      if (!r.ok) { B.melding(melding, 'fout', r.fout || 'Dat lukte niet.'); return r; }
      if (r.lijst) lijst = r.lijst;
      toon(vak, ctx, r.tekst);
      return r;
    });
  }

  /* ---------- Het onderdeel ---------- */

  function toon(vak, ctx, okTekst) {
    var bestuur = isBestuur(ctx);
    var melding = el('div', { 'aria-live': 'polite' });
    if (okTekst) B.melding(melding, 'ok', okTekst);
    var inhoud = el('div');
    D.vervang(vak,
      ctx.kop('Aankooplijst', bestuur
        ? 'Boeken die de bib wil kopen. Vrijwilligers stellen boeken voor, jij duidt aan wat je koopt en trekt daarvan een lijst. Een boek dat in de catalogus komt, vinkt het script vanzelf af.'
        : 'Boeken die de bib wil kopen. Mis je een boek in de bib? Stel het hier voor. Het bestuur beslist wat er gekocht wordt.'),
      melding, voorstelBlok(vak, ctx), bestuur ? inleesBlok(vak, ctx) : null, inhoud);
    if (!lijst) {
      D.vervang(inhoud, el('p', {}, 'De aankooplijst laden...'));
      B.voerUit('aankoopData').then(function (r) {
        if (!r.ok) { D.vervang(inhoud, el('div', { class: 'melding fout', role: 'alert' }, r.fout || 'De aankooplijst kon niet laden.')); return; }
        lijst = r.lijst;
        tekenLijst(inhoud, vak, ctx, melding);
      });
      return;
    }
    tekenLijst(inhoud, vak, ctx, melding);
  }

  /* ---------- Een boek voorstellen (iedereen) ---------- */

  function voorstelBlok(vak, ctx) {
    var titel = el('input', { type: 'text', id: 'ak-titel', maxlength: '200', required: true });
    var auteur = el('input', { type: 'text', id: 'ak-auteur', maxlength: '120' });
    var isbn = el('input', { type: 'text', id: 'ak-isbn', inputmode: 'numeric', maxlength: '20' });
    var link = el('input', { type: 'url', id: 'ak-link', maxlength: '400', placeholder: 'https://' });
    var reden = el('textarea', { id: 'ak-reden', rows: '2', maxlength: '300' });
    var fout = el('div', { 'aria-live': 'assertive' });
    var knop = el('button', { type: 'submit', class: 'knop' }, 'Zet op de aankooplijst');
    var formulier = el('form', { novalidate: true },
      veld('ak-titel', 'Titel', titel),
      veld('ak-auteur', 'Auteur', auteur),
      veld('ak-isbn', 'ISBN', isbn, '(als je het kent)'),
      veld('ak-link', 'Link naar het boek', link, '(bv. bol.com of een andere winkel)'),
      veld('ak-reden', 'Waarom dit boek?', reden, '(bv. gevraagd door een lener)'),
      fout, knoppen(knop));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!titel.value.trim()) { B.melding(fout, 'fout', 'Vul de titel in.'); titel.focus(); return; }
      doe('aankoopToevoegen', { titel: titel.value, auteur: auteur.value, isbn: isbn.value, link: link.value, reden: reden.value }, vak, ctx, fout, knop);
    });
    return el('details', { class: 'blok', open: !isBestuur(ctx) }, el('summary', {}, 'Stel een boek voor'), formulier);
  }

  /* ---------- Een lijst van bol.com of ISBN's inlezen (bestuur) ---------- */

  function inleesBlok(vak, ctx) {
    var link = el('input', { type: 'url', id: 'ak-bol', placeholder: 'https://www.bol.com/...' });
    var isbns = el('textarea', { id: 'ak-isbns', rows: '3' });
    var fout = el('div', { 'aria-live': 'assertive' });
    var resultaat = el('div', { 'aria-live': 'polite' });
    function lees(invoer, knop) {
      knop.disabled = true;
      B.melding(fout, 'info', 'Even geduld: het script leest elk boek apart. Dat kan een minuut duren.');
      B.voerUit('aankoopLezen', invoer).then(function (r) {
        knop.disabled = false;
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(fout, 'fout', r.fout || 'Inlezen lukte niet.'); return; }
        D.vervang(fout);
        nalezen(r, resultaat, vak, ctx);
      });
    }
    var bolKnop = el('button', { type: 'button', class: 'knop' }, 'Lees de lijst');
    bolKnop.addEventListener('click', function () {
      if (!/^https:\/\/(www\.)?bol\.com\//.test(link.value.trim())) { B.melding(fout, 'fout', 'Plak de link van je lijst op bol.com (die begint met https://www.bol.com/).'); link.focus(); return; }
      lees({ link: link.value.trim() }, bolKnop);
    });
    var isbnKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Zoek deze ISBN\'s op');
    isbnKnop.addEventListener('click', function () {
      if (!isbns.value.trim()) { B.melding(fout, 'fout', 'Plak een of meer ISBN\'s.'); isbns.focus(); return; }
      lees({ isbns: isbns.value }, isbnKnop);
    });
    return el('details', { class: 'blok' }, el('summary', {}, 'Lijst van bol.com inlezen'),
      el('p', {}, 'Open je lijst op bol.com, kies Delen en kopieer de link. Het script leest titel, auteur, ISBN, prijs en genre. Je kijkt alles na voor het op de aankooplijst komt.'),
      veld('ak-bol', 'Link van je lijst op bol.com', link), knoppen(bolKnop),
      veld('ak-isbns', 'Of plak ISBN\'s', isbns, '(één per regel of gescheiden door komma\'s. Het script zoekt titel, auteur en genre op, de prijs vul je zelf in)'),
      knoppen(isbnKnop), fout, resultaat);
  }

  /** Wat het script las: nakijken, aanvinken en toevoegen. */
  function nalezen(r, resultaat, vak, ctx) {
    var vakjes = [];
    var fout = el('div', { 'aria-live': 'assertive' });
    var items = r.boeken.map(function (b, i) {
      var id = 'ak-lees-' + i;
      var vakje = el('input', { type: 'checkbox', id: id });
      vakje.checked = !b.al;
      vakjes.push([vakje, b]);
      return el('li', { class: 'kaart' },
        el('label', { class: 'vinkje', for: id }, vakje, el('span', {}, el('strong', {}, b.titel), b.auteur ? ' (' + b.auteur + ')' : '')),
        el('p', { class: 'hulptekst' }, [b.genre, prijs(b.prijs), b.isbn ? 'ISBN ' + b.isbn : 'geen ISBN'].filter(Boolean).join(' · ')),
        b.al ? el('p', { class: 'hulptekst' }, 'Staat ' + b.al + '.') : null);
    });
    var knop = el('button', { type: 'button', class: 'knop' }, 'Zet de aangevinkte op de aankooplijst');
    knop.addEventListener('click', function () {
      var gekozen = vakjes.filter(function (v) { return v[0].checked; }).map(function (v) { return v[1]; });
      if (!gekozen.length) { B.melding(fout, 'fout', 'Vink minstens één boek aan.'); return; }
      doe('aankoopImporteren', { boeken: gekozen }, vak, ctx, fout, knop);
    });
    D.vervang(resultaat, el('div', { class: 'stap' },
      el('h3', {}, r.boeken.length + (r.boeken.length === 1 ? ' boek gelezen' : ' boeken gelezen')),
      r.overgeslagen ? el('p', { class: 'hulptekst' }, r.overgeslagen + ' boeken kon het script niet lezen. Voeg die met de hand toe.') : null,
      el('ul', { class: 'kaartlijst' }, items), fout, knoppen(knop)));
  }

  /* ---------- De lijst ---------- */

  function tekenLijst(inhoud, vak, ctx, melding) {
    var bestuur = isBestuur(ctx);
    var open = lijst.filter(function (b) { return b.s === 'open'; });
    var binnen = lijst.filter(function (b) { return b.s === 'binnen'; });
    var gekozen = open.filter(function (b) { return b.k; });
    var lijstVak = el('div', { 'aria-live': 'polite' });
    var zoek = el('input', { type: 'search', id: 'ak-zoek', autocomplete: 'off', placeholder: 'Titel, auteur of genre', value: zoekterm });
    zoek.addEventListener('input', function () { zoekterm = zoek.value; tekenKaarten(); });
    var keuze = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Welke boeken' },
      [['open', 'Te kopen (' + open.length + ')'], ['binnen', 'In de catalogus (' + binnen.length + ')']].map(function (f) {
        return el('button', { type: 'button', class: 'knop' + (filter === f[0] ? '' : ' tweede'), 'aria-pressed': filter === f[0] ? 'true' : 'false',
          onclick: function () { filter = f[0]; tekenLijst(inhoud, vak, ctx, melding); } }, f[1]);
      }));
    var totaal = gekozen.reduce(function (s, b) { return s + (b.p || 0); }, 0);
    var aangeduid = bestuur ? el('div', { class: 'blok' },
      el('p', {}, el('strong', {}, gekozen.length + (gekozen.length === 1 ? ' boek' : ' boeken') + ' aangeduid voor aankoop'), gekozen.length ? prijsSom(gekozen, totaal) : '.'),
      knoppen(
        el('button', { type: 'button', class: 'knop', disabled: !gekozen.length, onclick: function () { trekLijst(vak, ctx, gekozen); } }, 'Trek de aankooplijst'),
        gekozen.length ? el('button', { type: 'button', class: 'knop tweede', onclick: function (e) {
          if (window.confirm('Alle ' + gekozen.length + ' aanduidingen weghalen?')) doe('aankoopUitvinken', {}, vak, ctx, melding, e.target);
        } }, 'Vink alles uit') : null)) : null;
    function tekenKaarten() {
      var q = Z.normaliseer(zoekterm);
      var boeken = (filter === 'open' ? open : binnen).filter(function (b) { return !q || Z.normaliseer(b.t + ' ' + b.a + ' ' + b.g + ' ' + b.i).indexOf(q) > -1; });
      D.vervang(lijstVak, boeken.length ? el('ul', { class: 'kaartlijst' }, boeken.map(function (b) { return kaart(b, vak, ctx, melding); }))
        : el('p', {}, q ? 'Geen boek gevonden.' : filter === 'open' ? 'Er staat nog geen boek op de aankooplijst.' : 'Nog geen boek van de aankooplijst staat in de catalogus.'));
    }
    tekenKaarten();
    D.vervang(inhoud, aangeduid, keuze,
      el('div', { class: 'veld' }, el('label', { for: 'ak-zoek' }, 'Zoek op de aankooplijst'), zoek),
      bestuur && filter === 'binnen' && binnen.length ? knoppen(el('button', { type: 'button', class: 'knop tweede gevaar', onclick: function (e) {
        if (window.confirm('Alle ' + binnen.length + ' boeken die al in de catalogus staan van de aankooplijst verwijderen?')) {
          doe('aankoopVerwijderen', { ids: binnen.map(function (b) { return b.id; }) }, vak, ctx, melding, e.target);
        }
      } }, 'Verwijder alles wat in de catalogus staat')) : null,
      lijstVak);
  }

  function kaart(b, vak, ctx, melding) {
    var bestuur = isBestuur(ctx);
    var fout = el('div', { 'aria-live': 'assertive' });
    var extra = el('div');
    var info = [b.g, prijs(b.p), b.i ? 'ISBN ' + b.i : ''].filter(Boolean).join(' · ');
    var vakje = null;
    if (bestuur && b.s === 'open') {
      vakje = el('input', { type: 'checkbox', id: 'ak-kies-' + b.id });
      vakje.checked = b.k;
      vakje.addEventListener('change', function () {
        doe('aankoopAanpassen', { aankoop_id: b.id, gekozen: vakje.checked }, vak, ctx, fout, vakje);
      });
    }
    return el('li', { class: 'kaart' + (b.k ? ' optijd' : '') },
      el('p', {}, el('strong', {}, b.t), b.a ? ' (' + b.a + ')' : ''),
      info ? el('p', { class: 'hulptekst' }, info) : null,
      b.r ? el('p', {}, b.r) : null,
      el('p', { class: 'hulptekst' }, 'Voorgesteld door ' + (b.w || 'onbekend') + (b.d ? ' op ' + D.korteDatum(b.d) : '') +
        (b.s === 'binnen' ? '. In de catalogus' + (b.b ? ' als ' + b.b : '') + (b.db ? ' sinds ' + D.korteDatum(b.db) : '') : '') + '.'),
      b.l ? el('p', {}, el('a', { href: b.l, target: '_blank', rel: 'noopener noreferrer' }, 'Bekijk het boek online')) : null,
      vakje ? el('label', { class: 'vinkje', for: 'ak-kies-' + b.id }, vakje, 'Aanduiden voor aankoop') : null,
      bestuur ? knoppen(
        b.s === 'open' ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { D.vervang(extra, aanpasFormulier(b, vak, ctx, extra)); } }, 'Pas aan') : null,
        el('button', { type: 'button', class: 'knop tweede gevaar', onclick: function (e) {
          if (window.confirm('"' + b.t + '" van de aankooplijst verwijderen?')) doe('aankoopVerwijderen', { aankoop_id: b.id }, vak, ctx, fout, e.target);
        } }, 'Verwijder')) : null,
      fout, extra);
  }

  function aanpasFormulier(b, vak, ctx, extra) {
    var velden = [['titel', 'Titel', b.t], ['auteur', 'Auteur', b.a], ['isbn', 'ISBN', b.i], ['genre', 'Genre', b.g],
      ['prijs', 'Prijs in euro', b.p === null ? '' : String(b.p).replace('.', ',')], ['link', 'Link', b.l], ['reden', 'Waarom', b.r]];
    var invoer = {};
    var fout = el('div', { 'aria-live': 'assertive' });
    var knop = el('button', { type: 'submit', class: 'knop' }, 'Bewaar');
    var formulier = el('form', { class: 'stap', novalidate: true }, velden.map(function (v) {
      var id = 'ak-' + v[0] + '-' + b.id;
      invoer[v[0]] = el('input', { type: 'text', id: id, value: v[2] || '', inputmode: v[0] === 'prijs' ? 'decimal' : null });
      return veld(id, v[1], invoer[v[0]]);
    }), fout, knoppen(knop, el('button', { type: 'button', class: 'knop tweede', onclick: function () { D.vervang(extra); } }, 'Annuleer')));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { aankoop_id: b.id };
      Object.keys(invoer).forEach(function (k) { data[k] = invoer[k].value; });
      doe('aankoopAanpassen', data, vak, ctx, fout, knop);
    });
    setTimeout(function () { invoer.titel.focus(); }, 0);
    return formulier;
  }

  /* ---------- De lijst trekken: afdrukken, kopiëren, CSV ---------- */

  function trekLijst(vak, ctx, boeken) {
    var totaal = boeken.reduce(function (s, b) { return s + (b.p || 0); }, 0);
    var melding = el('div', { 'aria-live': 'polite' });
    var kopieerKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Kopieer de lijst');
    kopieerKnop.addEventListener('click', function () {
      var tekst = 'Aankooplijst Project Madrigal (' + boeken.length + ' boeken)\n\n' + boeken.map(function (b) {
        return b.t + (b.a ? ', ' + b.a : '') + (b.i ? ' (ISBN ' + b.i + ')' : '') + (b.p !== null ? ', ' + D.euro(b.p) : '');
      }).join('\n') + '\n\nTotaal: ' + D.euro(totaal);
      var gelukt = function () { B.melding(melding, 'ok', 'De lijst is gekopieerd. Plak ze in een mail of bericht.'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(tekst).then(gelukt, function () { toonTekst(melding, tekst); });
      else toonTekst(melding, tekst);
    });
    D.vervang(vak,
      ctx.kop('Aankooplijst trekken', 'De boeken die je aanduidde. Druk ze af (of bewaar als PDF), kopieer ze in een mail, of download een CSV-bestand voor Excel.'),
      el('div', { class: 'tabel-wrap' }, tabel(boeken, totaal)),
      knoppen(
        el('button', { type: 'button', class: 'knop', onclick: function () { drukAf(boeken, totaal); } }, 'Druk af of bewaar als PDF'),
        kopieerKnop,
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { downloadCsv(boeken); } }, 'Download als CSV')),
      melding,
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toon(vak, ctx); } }, '← Terug naar de aankooplijst')));
  }

  function tabel(boeken, totaal) {
    return el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'Titel'), el('th', {}, 'Auteur'), el('th', {}, 'ISBN'), el('th', { class: 'getal' }, 'Prijs'))),
      el('tbody', {}, boeken.map(function (b) {
        return el('tr', {}, el('td', {}, b.t), el('td', {}, b.a || ''), el('td', {}, b.i || ''), el('td', { class: 'getal' }, prijs(b.p)));
      })),
      el('tfoot', {}, el('tr', {}, el('th', { colspan: '3' }, 'Totaal (' + boeken.length + (boeken.length === 1 ? ' boek)' : ' boeken)')), el('th', { class: 'getal' }, D.euro(totaal)))));
  }

  function toonTekst(melding, tekst) {
    B.melding(melding, 'info', 'Kopiëren lukte niet. Selecteer deze tekst en kopieer hem zelf:');
    melding.appendChild(el('textarea', { rows: '8', readonly: true, 'aria-label': 'De aankooplijst als tekst' }, tekst));
  }

  /** Afdrukken: dezelfde aanpak als de lijsten in het bestuursscherm (.afdruk in styles.css). */
  function drukAf(boeken, totaal) {
    var vak = el('div', { class: 'afdruk', id: 'afdruk' },
      el('h1', {}, 'Aankooplijst Project Madrigal'),
      el('p', {}, D.korteDatum(new Date().toISOString().slice(0, 10))),
      tabel(boeken, totaal));
    document.body.appendChild(vak);
    document.body.classList.add('druk-lijst');
    window.addEventListener('afterprint', function weg() {
      document.body.classList.remove('druk-lijst');
      vak.remove();
      window.removeEventListener('afterprint', weg);
    });
    window.print();
  }

  /** Een CSV voor Excel: puntkomma's, met een BOM zodat Excel de accenten goed leest. */
  function csvTekst(boeken) {
    var cel = function (w) { w = String(w === undefined || w === null ? '' : w); return /[";\n]/.test(w) ? '"' + w.replace(/"/g, '""') + '"' : w; };
    var rijen = [['titel', 'auteur', 'isbn', 'genre', 'prijs', 'link', 'voorgesteld_door']].concat(boeken.map(function (b) {
      return [b.t, b.a, b.i ? '\'' + b.i : '', b.g, b.p === null ? '' : String(b.p).replace('.', ','), b.l, b.w];
    }));
    return '﻿' + rijen.map(function (r) { return r.map(cel).join(';'); }).join('\r\n');
  }

  function downloadCsv(boeken) {
    var link = el('a', { href: URL.createObjectURL(new Blob([csvTekst(boeken)], { type: 'text/csv;charset=utf-8' })), download: 'aankooplijst-' + new Date().toISOString().slice(0, 10) + '.csv' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  // Bij elk bezoek aan het onderdeel: de verse lijst ophalen.
  root.MadrigalAankoop = { toon: function (vak, ctx) { lijst = null; toon(vak, ctx); }, csvTekst: csvTekst };
})(window);
