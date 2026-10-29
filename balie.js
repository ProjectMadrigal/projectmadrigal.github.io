/**
 * balie.js
 * Het uitleenscherm voor de vrijwilligers aan de balie.
 * Uitlenen, terugbrengen, verlengen, reserveren, lener opzoeken en inschrijven.
 * Een vrijwilliger ziet van een lener enkel de voornaam en het lenersnummer.
 */
(function () {
  'use strict';

  var D = window.MadrigalDom;
  var el = D.el;
  var B = window.MadrigalBeheer;
  var Z = window.MadrigalZoeken;
  var $ = function (id) { return document.getElementById(id); };

  var data = null;
  var index = [];
  var uitPerExemplaar = {};
  var apartPerExemplaar = {};
  var werkvlak = $('werkvlak');

  /* ---------- Gegevens ---------- */

  function laad() {
    return B.voerUit('balieData').then(function (r) {
      if (!r.ok) {
        B.melding($('apart-lijst'), 'fout', r.fout || 'De gegevens konden niet laden.');
        return;
      }
      data = r.data;
      index = Z.maakIndex(data.boeken);
      uitPerExemplaar = {};
      data.lopend.forEach(function (u) { uitPerExemplaar[u.exemplaar] = u; });
      apartPerExemplaar = {};
      data.reservaties.forEach(function (r) { if (r.status === 'klaar om op te halen' && r.exemplaar) apartPerExemplaar[r.exemplaar] = r; });
      $('balie-info').textContent = 'Aan de balie: ' + B.sessie.wie + ' · ' + data.vandaagTekst;
      toonApart();
    });
  }

  /** Bovenaan: boeken die apart moeten liggen voor een reservatie. */
  function toonApart() {
    var apart = data.reservaties.filter(function (r) { return r.status === 'klaar om op te halen'; });
    if (!apart.length) { D.vervang($('apart-lijst')); return; }
    D.vervang($('apart-lijst'), el('div', { class: 'melding info' },
      el('strong', {}, 'Ligt apart voor een reservatie'),
      el('ul', {}, apart.map(function (r) {
        return el('li', {}, '"' + r.titel + '" (' + r.exemplaar + ') voor lener ' + r.lenersnummer + ' (' + r.voornaam + '). ' + r.tekst + '.');
      }))));
  }

  /* ---------- Zoeken ---------- */

  function boekVan(id) {
    for (var i = 0; i < data.boeken.length; i++) if (data.boeken[i].id === id) return data.boeken[i];
    return null;
  }

  function zoekBoeken(vraag) {
    var q = vraag.trim();
    if (!q) return [];
    // Een exemplaarnummer (B0012-2) of boek-ID rechtstreeks.
    var m = q.toUpperCase().match(/^([BZF]\d{1,})(?:-\d+)?$/);
    if (m) {
      var b = boekVan(m[1].charAt(0) + ('0000' + m[1].slice(1)).slice(-4));
      if (b) return [b];
    }
    return Z.zoek(index, q).slice(0, 8).map(function (r) { return r.boek; });
  }

  function zoekLeners(vraag) {
    var q = Z.normaliseer(vraag);
    if (!q) return [];
    var resultaat;
    if (/^\d+$/.test(q)) {
      resultaat = data.leners.filter(function (l) { return String(l.n) === q; })
        .concat(data.leners.filter(function (l) { return String(l.n) !== q && String(l.n).indexOf(q) === 0; }));
    } else {
      resultaat = data.leners.filter(function (l) { return Z.normaliseer(l.v).indexOf(q) === 0; })
        .concat(data.leners.filter(function (l) { var v = Z.normaliseer(l.v); return v.indexOf(q) > 0; }));
    }
    return resultaat.slice(0, 8);
  }

  function lopendVanLener(n) {
    return data.lopend.filter(function (u) { return String(u.lenersnummer) === String(n); });
  }

  /** Lopende uitleningen zoeken op boek of lener. */
  function zoekLopend(vraag) {
    var q = Z.normaliseer(vraag);
    var lijst = data.lopend;
    if (!q) return lijst.slice(0, 15);
    return lijst.filter(function (u) {
      var boek = boekVan(u.boek_id) || {};
      if (String(u.lenersnummer) === q) return true;
      var tekst = Z.normaliseer([u.titel, u.auteur, u.exemplaar, boek.i, u.voornaam].join(' '));
      return q.split(' ').every(function (w) { return tekst.indexOf(w) > -1; });
    }).slice(0, 15);
  }

  /* ---------- Bouwstenen ---------- */

  /** Toont een scherm in het werkvlak, met een knop terug naar het menu. */
  function scherm(titel) {
    var kop = el('h2', { tabindex: '-1' }, titel);
    var inhoud = Array.prototype.slice.call(arguments, 1);
    D.vervang(werkvlak,
      el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, '← Menu'),
      el('div', { class: 'blok', style: 'margin-top:1rem' }, kop, inhoud));
    kop.focus();
    window.scrollTo(0, 0);
  }

  /**
   * Een zoekveld met resultaten als grote knoppen.
   * opties: { id, label, hulp, zoek(vraag) -> items, toon(item, kies) -> element, kies(item), leeg }
   */
  function kiezer(opties) {
    var resultaten = el('div', { class: 'kaartlijst', 'aria-live': 'polite' });
    var invoer = el('input', { type: 'search', id: opties.id, autocomplete: 'off', placeholder: opties.placeholder || '' });
    var houder = el('div', { class: 'veld' },
      el('label', { for: opties.id }, opties.label, opties.hulp ? el('span', { class: 'hulptekst' }, ' ' + opties.hulp) : null),
      invoer, resultaten);
    function toon() {
      var items = opties.zoek(invoer.value);
      if (!invoer.value.trim() && !items.length) { D.vervang(resultaten); return; }
      if (!items.length) { D.vervang(resultaten, el('p', {}, opties.leeg || 'Niets gevonden.')); return; }
      D.vervang(resultaten, items.map(function (item) { return opties.toon(item, opties.kies); }));
    }
    invoer.addEventListener('input', toon);
    houder.toon = toon;
    houder.invoer = invoer;
    return houder;
  }

  /** Een vak met de gekozen waarde en een knop om te wijzigen. */
  function gekozenVak(inhoud, wijzig) {
    return el('div', { class: 'gekozen' }, inhoud,
      el('div', { class: 'knoppen', style: 'margin-top:.5rem' },
        el('button', { type: 'button', class: 'knop tweede', onclick: wijzig }, 'Wijzig')));
  }

  function knopLener(l, kies) {
    var lopend = lopendVanLener(l.n);
    var telaat = lopend.filter(function (u) { return u.status && u.status.code === 'telaat'; }).length;
    return el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { kies(l); } },
      el('strong', {}, l.n + ' · ' + l.v),
      el('span', {}, lopend.length + (lopend.length === 1 ? ' boek' : ' boeken') + ' in huis' + (telaat ? ', ' + telaat + ' te laat' : '')));
  }

  function lenerBlok(l) {
    var lopend = lopendVanLener(l.n);
    return el('div', {},
      el('p', {}, el('strong', {}, 'Lener ' + l.n + ' · ' + l.v)),
      lopend.length ? el('ul', { class: 'kaartlijst', style: 'margin-top:.5rem' }, lopend.map(function (u) {
        return el('li', { class: 'kaart ' + u.status.code }, el('h3', {}, u.titel), B.uitleenStatus(u));
      })) : el('p', {}, 'Heeft nu geen boeken in huis.'));
  }

  function uitleningKnop(u, kies) {
    return el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { kies(u); } },
      el('strong', {}, u.titel),
      el('span', {}, u.exemplaar + ' · lener ' + u.lenersnummer + ' (' + u.voornaam + ')'),
      el('span', { class: 'labels' }, D.statusLabel(u.status.code, u.status.label), u.status.verlengd ? D.statusLabel('verlengd', 'Verlengd') : null),
      el('span', {}, u.status.tekst));
  }

  /** Grote melding om een boek apart te leggen. */
  function apartBlokken(lijst) {
    return (lijst || []).map(function (m) {
      return el('div', { class: 'apart-leggen', role: 'alert' },
        el('p', { class: 'groot' }, m.tekst),
        el('p', {}, 'Exemplaar ' + m.exemplaar + '. ' + m.ophalenTekst + '.'));
    });
  }

  /** Bij een boek met gevoelige inhoud: een melding voor de vrijwilliger. */
  function gevoeligMelding(b) {
    if (b.st !== 'gevoelig') return null;
    return el('p', { class: 'labels' }, el('span', { class: 'label label-gevoelig' }, 'Gevoelige inhoud'),
      el('span', { class: 'hulptekst' }, 'Dit boek staat niet of met een waarschuwing op de website. Je mag het gewoon uitlenen.'));
  }

  function foutVak() { return el('div', { 'aria-live': 'assertive' }); }

  /** Zet een knop even op "bezig" tijdens het versturen. */
  function bezig(knop, tekst) {
    var oud = knop.textContent;
    knop.disabled = true;
    knop.textContent = tekst || 'Even geduld...';
    return function () { knop.disabled = false; knop.textContent = oud; };
  }

  /* ---------- Menu ---------- */

  function toonMenu() {
    var knoppen = [
      ['Uitlenen', '📕', toonUitlenen],
      ['Terugbrengen', '↩', toonTerugbrengen],
      ['Verlengen', '↻', toonVerlengen],
      ['Reserveren', '⧗', toonReserveren],
      ['Lener opzoeken', '🔍', toonLenerOpzoeken],
      ['Nieuwe lener', '＋', toonNieuweLener],
      ['Rooster', '📅', toonRooster],
      ['Checklist', '✓', function () { metVrijwilligers('checklist'); }],
      ['Handleiding', '📖', function () { metVrijwilligers('handleiding'); }]
    ];
    D.vervang(werkvlak, el('h2', { class: 'verborgen' }, 'Menu'), el('nav', { class: 'menu-raster', 'aria-label': 'Wat wil je doen?' },
      knoppen.map(function (k) {
        return el('button', { type: 'button', class: 'knop', onclick: function () { k[2](); } }, el('span', { 'aria-hidden': 'true' }, k[1]), k[0]);
      })));
  }

  /* ---------- Checklist en handleiding (uit vrijwilligers.js) ---------- */

  /** Toont de checklist voor de shift of de handleiding, zoals in het vrijwilligersscherm. */
  function metVrijwilligers(onderdeel) {
    var vak = el('div');
    D.vervang(werkvlak,
      el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, '← Menu'),
      el('div', { class: 'blok', style: 'margin-top:1rem' }, vak));
    window.MadrigalVrijwilligers[onderdeel](vak, {
      data: data,
      kop: function (titel, uitleg) {
        return [el('h2', { tabindex: '-1' }, titel), uitleg ? el('p', { class: 'hulptekst' }, uitleg) : null];
      }
    });
    var kop = vak.querySelector('h2');
    if (kop) kop.focus();
    window.scrollTo(0, 0);
  }

  /* ---------- Rooster ---------- */

  function toonRooster() {
    var vak = el('div');
    scherm('Rooster', el('p', {}, 'Wie staat er de komende vrijdagen in de bib?'), vak);
    B.toonRooster(vak);
  }

  /* ---------- Uitlenen ---------- */

  function toonUitlenen(voorafLener) {
    var keuze = { boek: null, exemplaar: '', lener: voorafLener || null };
    var boekStap = el('div', { class: 'stap' });
    var lenerStap = el('div', { class: 'stap' });
    var borgStap = el('div', { class: 'stap' });
    var fout = foutVak();
    var bevestig = el('button', { type: 'button', class: 'knop breed', disabled: true }, 'Bevestig de uitlening');

    function exemplaarKnoppen(b, kies) {
      if (b.st === 'verloren') return el('p', { class: 'labels' }, D.statusLabel('verloren', 'Verloren'));
      if (!b.u) return el('p', { class: 'labels' }, D.statusLabel('niet_uitleenbaar', 'Niet uitleenbaar'));
      var knoppen = [];
      for (var i = 1; i <= b.x; i++) {
        (function (ex) {
          var uit = uitPerExemplaar[ex];
          var apart = apartPerExemplaar[ex];
          var tekst = uit ? 'uitgeleend, ' + uit.status.tekst.charAt(0).toLowerCase() + uit.status.tekst.slice(1)
            : apart ? 'ligt apart voor lener ' + apart.lenersnummer + ' (' + apart.voornaam + ')' : 'beschikbaar';
          knoppen.push(el('button', {
            type: 'button', class: 'knop keuzeknop', disabled: !!uit,
            onclick: function () { kies({ boek: b, exemplaar: ex }); }
          }, el('strong', {}, 'Exemplaar ' + ex), el('span', {}, tekst)));
        })(b.id + '-' + i);
      }
      return knoppen;
    }

    function tekenBoek() {
      if (keuze.boek) {
        D.vervang(boekStap, el('h3', {}, '1. Boek'), gekozenVak(
          el('p', {}, el('strong', {}, keuze.boek.t), el('br'), keuze.boek.a || '', el('br'), 'Exemplaar ' + keuze.exemplaar),
          function () { keuze.boek = null; tekenBoek(); controleer(); }));
        return;
      }
      var k = kiezer({
        id: 'uit-boek', label: 'Zoek het boek', hulp: '(titel, auteur, ISBN of nummer op het etiket)',
        zoek: zoekBoeken,
        toon: function (b, kies) {
          return el('div', { class: 'kaart' }, el('h3', {}, b.t), b.a ? el('p', {}, b.a) : null,
            gevoeligMelding(b),
            el('div', { class: 'kaartlijst', style: 'margin-top:.5rem' }, exemplaarKnoppen(b, kies)));
        },
        kies: function (v) { keuze.boek = v.boek; keuze.exemplaar = v.exemplaar; tekenBoek(); controleer(); if (!keuze.lener) focusOp('uit-lener'); },
        leeg: 'Geen boek gevonden. Probeer een ander woord.'
      });
      D.vervang(boekStap, el('h3', {}, '1. Boek'), k);
    }

    function tekenLener() {
      if (keuze.lener) {
        D.vervang(lenerStap, el('h3', {}, '2. Lener'), gekozenVak(lenerBlok(keuze.lener),
          function () { keuze.lener = null; tekenLener(); controleer(); focusOp('uit-lener'); }));
        return;
      }
      var k = kiezer({
        id: 'uit-lener', label: 'Lenersnummer of voornaam', zoek: zoekLeners, toon: knopLener,
        kies: function (l) { keuze.lener = l; tekenLener(); controleer(); },
        leeg: 'Geen lener gevonden. Nieuw? Schrijf de lener eerst in via "Nieuwe lener".'
      });
      k.invoer.setAttribute('inputmode', 'search');
      D.vervang(lenerStap, el('h3', {}, '2. Lener'), k);
    }

    function tekenBorg() {
      var inst = data.instellingen;
      var wijzen = inst.borg_betaalwijzen.map(function (w, i) {
        return el('label', {}, el('input', { type: 'radio', name: 'betaalwijze', value: w, checked: i === 0 }), w);
      });
      D.vervang(borgStap, el('h3', {}, '3. Borg'),
        el('div', { class: 'veld' }, el('label', { for: 'uit-borg' }, 'Borg in euro'),
          el('input', { type: 'number', id: 'uit-borg', min: '0', step: '0.5', inputmode: 'decimal', value: String(inst.borg_per_boek) })),
        el('fieldset', { class: 'keuzes' }, el('legend', {}, 'Betaald met'), wijzen),
        inst.gift_mogelijk ? el('div', { class: 'veld' },
          el('label', { for: 'uit-gift' }, 'Gift in euro ', el('span', { class: 'hulptekst' }, '(vrijwillig, mag leeg)')),
          el('input', { type: 'number', id: 'uit-gift', min: '0', step: '0.5', inputmode: 'decimal' })) : null);
    }

    function controleer() { bevestig.disabled = !(keuze.boek && keuze.lener); }

    bevestig.addEventListener('click', function () {
      var gekozenWijze = werkvlak.querySelector('input[name="betaalwijze"]:checked');
      var klaar = bezig(bevestig);
      B.voerUit('uitlenen', {
        exemplaar: keuze.exemplaar, lenersnummer: keuze.lener.n,
        borg: $('uit-borg').value, betaalwijze: gekozenWijze ? gekozenWijze.value : '',
        gift: $('uit-gift') ? $('uit-gift').value : ''
      }, klaar).then(function (r) {
        klaar();
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        var lener = keuze.lener;
        scherm('Uitgeleend',
          el('div', { class: 'groot-resultaat', role: 'status' },
            el('p', {}, '"' + r.uitlening.titel + '" voor lener ' + lener.n + ' (' + lener.v + ')'),
            el('p', { class: 'groot' }, r.terugTekst)),
          apartBlokken(r.apartLeggen),
          el('div', { class: 'knoppen' },
            el('button', { type: 'button', class: 'knop', onclick: function () { toonUitlenen(lener); } }, 'Nog een boek voor ' + lener.v),
            el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, 'Klaar')));
        laad();
      });
    });

    tekenBoek();
    tekenLener();
    tekenBorg();
    scherm('Uitlenen', boekStap, lenerStap, borgStap, checklistUitlenen(), fout, el('div', { class: 'knoppen' }, bevestig));
    focusOp('uit-boek');
  }

  /** De checklist bij elke uitlening (instelling tekst_checklist_uitlenen). Afvinken is een geheugensteun, geen verplichting. */
  function checklistUitlenen() {
    var punten = (data.instellingen && data.instellingen.checklist_uitlenen) || [];
    if (!punten.length) return null;
    return el('fieldset', { class: 'stap checklist' }, el('legend', {}, 'Niet vergeten'),
      punten.map(function (p, i) {
        var id = 'uit-check-' + i;
        return el('label', { class: 'vinkje', for: id }, el('input', { type: 'checkbox', id: id }), p);
      }));
  }

  function focusOp(id) {
    setTimeout(function () { var e = $(id); if (e) e.focus(); }, 0);
  }

  /* ---------- Terugbrengen ---------- */

  function toonTerugbrengen() {
    var vak = el('div');
    var k = kiezer({
      id: 'terug-zoek', label: 'Zoek het boek of de lener', hulp: '(titel, nummer op het etiket, lenersnummer of voornaam)',
      zoek: zoekLopend, toon: uitleningKnop,
      kies: function (u) { bevestigTerug(u); },
      leeg: 'Geen lopende uitlening gevonden.'
    });
    scherm('Terugbrengen', k, vak);
    k.toon();
    focusOp('terug-zoek');

    function bevestigTerug(u) {
      var fout = foutVak();
      var knop = el('button', { type: 'button', class: 'knop breed' }, 'Bevestig: boek is terug');
      var borgVraag = u.borg > 0 ? el('fieldset', { class: 'keuzes' },
        el('legend', {}, 'Borg van ' + D.euro(u.borg) + (u.betaalwijze_borg ? ' (' + u.betaalwijze_borg + ')' : '') + ' terugbetaald?'),
        el('label', {}, el('input', { type: 'radio', name: 'borgterug', value: 'ja', checked: true }), 'Ja, teruggegeven'),
        el('label', {}, el('input', { type: 'radio', name: 'borgterug', value: 'nee' }), 'Nee, nog niet')) : el('p', {}, 'Er werd geen borg betaald.');
      var staatVraag = B.staatVraag('terug');
      knop.addEventListener('click', function () {
        var keuze = werkvlak.querySelector('input[name="borgterug"]:checked');
        var klaar = bezig(knop);
        var invoer = Object.assign({ uitlening_id: u.uitlening_id, borg_terugbetaald: !!keuze && keuze.value === 'ja' }, staatVraag.lees());
        B.voerUit('terugbrengen', invoer).then(function (r) {
          klaar();
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          scherm('Teruggebracht',
            el('div', { class: 'groot-resultaat', role: 'status' }, el('p', { class: 'groot' }, 'Bedankt!'), el('p', {}, r.tekst)),
            apartBlokken(r.apartLeggen),
            r.apartLeggen && r.apartLeggen.length ? null : el('p', {}, 'Het boek mag terug in de kast.'),
            el('div', { class: 'knoppen' },
              el('button', { type: 'button', class: 'knop', onclick: toonTerugbrengen }, 'Nog een boek terugbrengen'),
              el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, 'Klaar')));
          laad();
        });
      });
      scherm('Terugbrengen',
        gekozenVak(el('div', {}, el('p', {}, el('strong', {}, u.titel), el('br'), u.exemplaar + ' · lener ' + u.lenersnummer + ' (' + u.voornaam + ')'), B.uitleenStatus(u)), toonTerugbrengen),
        el('div', { class: 'stap' }, staatVraag.blok), el('div', { class: 'stap' }, borgVraag), fout, el('div', { class: 'knoppen' }, knop));
    }
  }

  /* ---------- Verlengen ---------- */

  function toonVerlengen() {
    var k = kiezer({
      id: 'verleng-zoek', label: 'Zoek het boek of de lener', hulp: '(titel, nummer op het etiket, lenersnummer of voornaam)',
      zoek: zoekLopend, toon: uitleningKnop, kies: bevestigVerlengen, leeg: 'Geen lopende uitlening gevonden.'
    });
    scherm('Verlengen', el('p', {}, 'Een lener vraagt meestal per mail om te verlengen. Kies het boek. Daarna zie je de nieuwe terugbrengdatum, die je nog kan aanpassen.'), k);
    k.toon();
    focusOp('verleng-zoek');

    function bevestigVerlengen(u) {
      var fout = foutVak();
      var knop = el('button', { type: 'button', class: 'knop breed' }, 'Bevestig de verlenging');
      // De voorgestelde datum: de huidige vervaldatum plus de termijn. Een andere datum kiezen mag.
      var weken = Number((data.instellingen || {}).verlengingstermijn_weken) || 4;
      var basis = new Date(String(u.vervaldatum) + 'T12:00:00Z');
      basis.setUTCDate(basis.getUTCDate() + weken * 7);
      var voorstel = basis.toISOString().slice(0, 10);
      var datum = el('input', { type: 'date', id: 'verleng-datum', value: voorstel });
      knop.addEventListener('click', function () {
        var klaar = bezig(knop);
        var invoer = { uitlening_id: u.uitlening_id };
        if (datum.value && datum.value !== voorstel) invoer.tot = datum.value;
        B.voerUit('verlengen', invoer, klaar).then(function (r) {
          klaar();
          if (r.geannuleerd) return;
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          scherm('Verlengd',
            el('div', { class: 'groot-resultaat', role: 'status' },
              el('p', {}, '"' + u.titel + '" voor lener ' + u.lenersnummer + ' (' + u.voornaam + ')'),
              el('p', { class: 'groot' }, r.terugTekst)),
            el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, 'Klaar')));
          laad();
        });
      });
      scherm('Verlengen',
        gekozenVak(el('div', {}, el('p', {}, el('strong', {}, u.titel), el('br'), 'lener ' + u.lenersnummer + ' (' + u.voornaam + ')'), B.uitleenStatus(u)), toonVerlengen),
        el('div', { class: 'veld' }, el('label', { for: 'verleng-datum' }, 'Nieuwe terugbrengdatum ',
          el('span', { class: 'hulptekst' }, '(' + weken + ' weken erbij. Kan de lener pas later komen? Kies een andere datum. Ze schuift naar een openingsdag.)')), datum),
        fout, el('div', { class: 'knoppen' }, knop));
    }
  }

  /* ---------- Reserveren ---------- */

  function toonReserveren() {
    var keuze = { boek: null, lener: null };
    var boekStap = el('div', { class: 'stap' });
    var lenerStap = el('div', { class: 'stap' });
    var fout = foutVak();
    var knop = el('button', { type: 'button', class: 'knop breed', disabled: true }, 'Zet in de wachtrij');

    function wachtrij(b) {
      return data.reservaties.filter(function (r) { return r.boek_id === b.id; });
    }
    function tekenBoek() {
      if (keuze.boek) {
        var rij = wachtrij(keuze.boek);
        D.vervang(boekStap, el('h3', {}, '1. Boek'), gekozenVak(el('div', {},
          el('p', {}, el('strong', {}, keuze.boek.t)),
          el('p', {}, rij.length ? 'Er wachten al ' + rij.length + ' mensen.' : 'Nog niemand in de wachtrij.')),
          function () { keuze.boek = null; tekenBoek(); knop.disabled = true; }));
        return;
      }
      D.vervang(boekStap, el('h3', {}, '1. Boek'), kiezer({
        id: 'res-boek', label: 'Zoek het boek', zoek: zoekBoeken,
        toon: function (b, kies) {
          var uit = 0;
          for (var i = 1; i <= b.x; i++) if (uitPerExemplaar[b.id + '-' + i] || apartPerExemplaar[b.id + '-' + i]) uit++;
          var vrij = b.x - uit;
          return el('button', { type: 'button', class: 'knop keuzeknop', disabled: !b.u, onclick: function () { kies(b); } },
            el('strong', {}, b.t), b.a ? el('span', {}, b.a) : null,
            b.st === 'gevoelig' ? el('span', {}, 'Gevoelige inhoud') : null,
            el('span', {}, b.st === 'verloren' ? 'Verloren' : !b.u ? 'Niet uitleenbaar' : vrij > 0 ? vrij + ' van ' + b.x + ' in de kast: je kan het meteen uitlenen' : 'Alle exemplaren zijn uitgeleend of apart gelegd'));
        },
        kies: function (b) { keuze.boek = b; tekenBoek(); knop.disabled = !(keuze.boek && keuze.lener); focusOp('res-lener'); }
      }));
    }
    function tekenLener() {
      if (keuze.lener) {
        D.vervang(lenerStap, el('h3', {}, '2. Lener'), gekozenVak(el('p', {}, el('strong', {}, 'Lener ' + keuze.lener.n + ' · ' + keuze.lener.v)),
          function () { keuze.lener = null; tekenLener(); knop.disabled = true; }));
        return;
      }
      D.vervang(lenerStap, el('h3', {}, '2. Lener'), kiezer({
        id: 'res-lener', label: 'Lenersnummer of voornaam', zoek: zoekLeners, toon: knopLener,
        kies: function (l) { keuze.lener = l; tekenLener(); knop.disabled = !(keuze.boek && keuze.lener); }
      }));
    }
    knop.addEventListener('click', function () {
      var klaar = bezig(knop);
      B.voerUit('reserveren', { boek_id: keuze.boek.id, lenersnummer: keuze.lener.n }, klaar).then(function (r) {
        klaar();
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        scherm('Gereserveerd',
          el('div', { class: 'groot-resultaat', role: 'status' }, el('p', { class: 'groot' }, 'In de wachtrij'), el('p', {}, r.tekst)),
          el('p', {}, 'Komt het boek terug, dan toont het uitleenscherm dat het apart moet liggen.'),
          el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, 'Klaar')));
        laad();
      });
    });
    tekenBoek();
    tekenLener();
    scherm('Reserveren', boekStap, lenerStap, fout, el('div', { class: 'knoppen' }, knop));
    focusOp('res-boek');
  }

  /* ---------- Lener opzoeken ---------- */

  function toonLenerOpzoeken() {
    var vak = el('div');
    var k = kiezer({
      id: 'zoek-lener', label: 'Lenersnummer of voornaam', zoek: zoekLeners, toon: knopLener,
      kies: function (l) {
        var reservaties = data.reservaties.filter(function (r) { return String(r.lenersnummer) === String(l.n); });
        scherm('Lener ' + l.n + ' · ' + l.v,
          lenerBlok(l),
          reservaties.length ? el('div', { class: 'stap' }, el('h3', {}, 'Reservaties'),
            el('ul', {}, reservaties.map(function (r) { return el('li', {}, '"' + r.titel + '": ' + r.tekst); }))) : null,
          el('div', { class: 'knoppen' },
            el('button', { type: 'button', class: 'knop', onclick: function () { toonUitlenen(l); } }, 'Boek uitlenen aan ' + l.v),
            el('button', { type: 'button', class: 'knop tweede', onclick: toonLenerOpzoeken }, 'Andere lener zoeken')));
      }
    });
    scherm('Lener opzoeken', k, vak);
    focusOp('zoek-lener');
  }

  /* ---------- Nieuwe lener ---------- */

  function toonNieuweLener() {
    var fout = foutVak();
    var knop = el('button', { type: 'submit', class: 'knop breed' }, 'Schrijf in');
    var formulier = el('form', { novalidate: true },
      el('div', { class: 'veld' }, el('label', { for: 'nl-voornaam' }, 'Voornaam'), el('input', { type: 'text', id: 'nl-voornaam', autocomplete: 'off', maxlength: '50', required: true })),
      el('div', { class: 'veld' }, el('label', { for: 'nl-achternaam' }, 'Achternaam ', el('span', { class: 'hulptekst' }, '(mag leeg)')), el('input', { type: 'text', id: 'nl-achternaam', autocomplete: 'off', maxlength: '80' })),
      el('p', {}, 'Vul minstens een telefoonnummer of een e-mailadres in.'),
      el('div', { class: 'veld' }, el('label', { for: 'nl-telefoon' }, 'Telefoon'), el('input', { type: 'tel', id: 'nl-telefoon', autocomplete: 'off', maxlength: '25' })),
      el('div', { class: 'veld' }, el('label', { for: 'nl-email' }, 'E-mail'), el('input', { type: 'email', id: 'nl-email', autocomplete: 'off', maxlength: '100' })),
      el('div', { class: 'melding info' }, el('strong', {}, 'Privacyverklaring'), el('p', {}, data.privacy)),
      el('label', { class: 'vinkje', for: 'nl-toestemming' }, el('input', { type: 'checkbox', id: 'nl-toestemming' }),
        'De lener heeft de privacyverklaring gelezen en geeft toestemming.'),
      fout, el('div', { class: 'knoppen' }, knop));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var klaar = bezig(knop);
      B.voerUit('nieuweLener', {
        voornaam: $('nl-voornaam').value, achternaam: $('nl-achternaam').value,
        telefoon: $('nl-telefoon').value, email: $('nl-email').value, toestemming: $('nl-toestemming').checked
      }).then(function (r) {
        klaar();
        if (!r.ok) { B.melding(fout, 'fout', r.fout); fout.scrollIntoView({ block: 'center' }); return; }
        var lener = { n: String(r.lenersnummer), v: r.voornaam };
        scherm('Ingeschreven',
          el('div', { class: 'groot-resultaat', role: 'status' },
            el('p', { class: 'groot' }, r.tekst),
            el('p', {}, 'Schrijf dit nummer op een kaartje voor ' + r.voornaam + '.')),
          el('div', { class: 'knoppen' },
            el('button', { type: 'button', class: 'knop', onclick: function () { laad().then(function () { toonUitlenen(lener); }); } }, 'Meteen een boek uitlenen'),
            el('button', { type: 'button', class: 'knop tweede', onclick: toonMenu }, 'Klaar')));
        laad();
      });
    });
    scherm('Nieuwe lener', formulier);
    focusOp('nl-voornaam');
  }

  /* ---------- Start ---------- */

  $('vernieuw').addEventListener('click', function () { laad(); });
  $('afmelden').addEventListener('click', B.afmelden);
  $('wissel').addEventListener('click', function () {
    var nieuw = window.prompt('Wie staat er nu aan de balie? Vul je voornaam in.', '');
    if (nieuw && nieuw.trim()) {
      B.wisselWie(nieuw.trim().slice(0, 40));
      if (data) $('balie-info').textContent = 'Aan de balie: ' + B.sessie.wie + ' · ' + data.vandaagTekst;
    }
  });

  B.aanmelden({
    codeSleutel: 'madrigal_code_balie',
    reserveSleutel: ['madrigal_code_vrijwilliger', 'madrigal_code_bestuur'],
    vereisteRol: 'balie',
    bijAangemeld: function (rol) {
      // Met de code voor vrijwilligers of het bestuur: een knop naar dat scherm.
      if ((rol === 'vrijwilliger' || rol === 'bestuur') && !$('naar-scherm')) {
        var knop = document.createElement('a');
        knop.id = 'naar-scherm';
        knop.className = 'knop tweede';
        knop.href = rol === 'bestuur' ? 'bestuur.html' : 'vrijwilliger.html';
        knop.textContent = rol === 'bestuur' ? 'Naar het bestuursscherm' : 'Naar het vrijwilligersscherm';
        $('vernieuw').parentNode.insertBefore(knop, $('vernieuw'));
      }
      laad().then(function () {
        if (!data) return;
        // Vanuit het bestuursscherm: balie.html#uitlenen=12 opent Uitlenen met die lener.
        var m = /^#uitlenen=(.+)$/.exec(location.hash);
        var lener = m ? data.leners.filter(function (l) { return String(l.n) === decodeURIComponent(m[1]); })[0] : null;
        if (m) history.replaceState(null, '', location.pathname);
        if (lener) toonUitlenen(lener); else toonMenu();
      });
    }
  });
})();
