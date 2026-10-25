/**
 * vrijwilligers.js
 * Onderdelen voor het vrijwilligersscherm en wat het bestuur daarvan ziet:
 *   - Jouw shift (op Vandaag): je volgende avond in de bib en wie er deze week staat, uit het rooster.
 *   - Checklist voor openen en sluiten. Het bestuur past de punten aan bij Teksten en instellingen.
 *     Wat je afvinkt, onthoudt deze browser tot het einde van de dag.
 *   - Rondleiding voor wie het scherm voor het eerst opent.
 *   - Kastcontrole: scan een kast en zie wat ontbreekt.
 *   - Iets melden aan het bestuur, en voor het bestuur: Meldingen en Voorgestelde beschrijvingen.
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var W = root.MadrigalBestuurBeheer;
  var Z = root.MadrigalZoeken;
  var $ = function (id) { return document.getElementById(id); };

  function knoppen() {
    return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments));
  }

  function lees(sleutel) { try { return localStorage.getItem(sleutel) || ''; } catch (e) { return ''; } }
  function bewaar(sleutel, w) { try { if (w) localStorage.setItem(sleutel, w); else localStorage.removeItem(sleutel); } catch (e) { /* niet erg */ } }

  /* ---------- Jouw shift (Vandaag) ---------- */

  function woorden(naam) {
    return Z.normaliseer(naam).split(' ').filter(Boolean);
  }

  /** Staat deze naam uit het rooster voor jou? Je voornaam moet het eerste woord zijn ("Kim" past bij "Kim V."). */
  function isIk(naam, wie) {
    var a = woorden(naam), b = woorden(wie);
    return !!a.length && !!b.length && a[0] === b[0];
  }

  /** Je volgende avond en wie er de komende 7 dagen in de bib staat. */
  function shiftUitRooster(d, wie) {
    var open = (d.avonden || []).filter(function (a) { return !B.AVONDSTATUS[a.status] && a.gepubliceerd; });
    var mijn = open.filter(function (a) {
      return (a.vrijwilligers || []).concat(a.backups || []).some(function (n) { return isIk(n, wie) && (a.afgemeld || []).indexOf(n) === -1; });
    })[0] || null;
    var grens = new Date(Date.parse(d.vandaag) + 7 * 86400000).toISOString().slice(0, 10);
    return {
      mijn: mijn,
      backup: !!mijn && !(mijn.vrijwilligers || []).some(function (n) { return isIk(n, wie); }),
      week: open.filter(function (a) { return a.datum <= grens; })
    };
  }

  function namen(a) {
    var aanwezig = (a.vrijwilligers || []).filter(function (n) { return (a.afgemeld || []).indexOf(n) === -1; });
    return aanwezig.length ? aanwezig.join(', ') : 'nog niemand';
  }

  /** Het blok bovenaan Vandaag. Laadt het rooster apart, zodat Vandaag niet hoeft te wachten. */
  function shiftBlok(ctx) {
    var vak = el('div', { class: 'blok', 'aria-live': 'polite' }, el('h3', {}, 'Jouw shift'), el('p', { class: 'hulptekst' }, 'Het rooster laden...'));
    B.voerUit('roosterOverzicht').then(function (r) {
      if (!r.ok || !r.data || !r.data.gekoppeld) {
        D.vervang(vak, el('h3', {}, 'Jouw shift'), el('p', { class: 'hulptekst' }, 'Het rooster is niet beschikbaar. Kijk bij het onderdeel Rooster.'));
        return;
      }
      var s = shiftUitRooster(r.data, B.sessie.wie);
      var vandaag = s.mijn && s.mijn.datum === r.data.vandaag;
      D.vervang(vak, el('h3', {}, 'Jouw shift'),
        s.mijn ? el('p', {}, el('strong', {}, vandaag ? 'Vandaag sta je in de bib' : 'Je volgende shift: ' + B.langeDatum(s.mijn.datum)),
          s.backup ? ' (als back-up)' : '', s.mijn.event ? '. Event: ' + s.mijn.event : '', '.')
          : el('p', {}, 'Je staat de komende weken niet op het rooster als ' + B.sessie.wie + '.'),
        vandaag ? knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { ctx.toonSectie('shift'); } }, 'Open de checklist')) : null,
        s.week.length ? el('div', {}, el('p', { class: 'hulptekst' }, 'Deze week in de bib:'),
          el('ul', {}, s.week.map(function (a) { return el('li', {}, B.langeDatum(a.datum) + ': ' + namen(a)); }))) : null);
    }, function () { /* geen verbinding: het blok blijft staan */ });
    return vak;
  }

  /* ---------- Checklist voor de shift ---------- */

  function vinkSleutel(datum) { return 'madrigal_checklist_' + datum; }

  /** De checklist: wat je afvinkt, blijft op dit toestel bewaard tot morgen. */
  function toonChecklist(vak, ctx) {
    var nu = new Date();
    var datum = nu.getFullYear() + '-' + ('0' + (nu.getMonth() + 1)).slice(-2) + '-' + ('0' + nu.getDate()).slice(-2);
    var gevinkt = {};
    try { gevinkt = JSON.parse(lees(vinkSleutel(datum)) || '{}') || {}; } catch (e) { gevinkt = {}; }
    // Oude dagen opruimen.
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('madrigal_checklist_') === 0 && k !== vinkSleutel(datum)) localStorage.removeItem(k); });
    } catch (e) { /* niet erg */ }
    var c = ctx.data.checklist || { openen: [], sluiten: [] };
    function lijst(soort, titel, punten) {
      var teller = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
      function tel() {
        var n = punten.filter(function (p, i) { return gevinkt[soort + i]; }).length;
        teller.textContent = n === punten.length ? 'Alles gedaan. Dank je!' : n + ' van ' + punten.length + ' gedaan.';
      }
      var vakjes = punten.map(function (p, i) {
        var id = 'check-' + soort + '-' + i;
        var vinkje = el('input', { type: 'checkbox', id: id, checked: !!gevinkt[soort + i] });
        vinkje.addEventListener('change', function () {
          gevinkt[soort + i] = vinkje.checked;
          bewaar(vinkSleutel(datum), JSON.stringify(gevinkt));
          tel();
        });
        return el('label', { class: 'vinkje', for: id }, vinkje, p);
      });
      tel();
      return el('fieldset', { class: 'blok checklist' }, el('legend', {}, titel), punten.length ? vakjes : el('p', {}, 'Nog geen punten. Het bestuur vult ze in bij Teksten en instellingen.'), teller);
    }
    D.vervang(vak, ctx.kop('Checklist voor de shift', 'Vink af wat gedaan is. Dit toestel onthoudt het tot het einde van de dag.'),
      lijst('openen', 'Bij het openen', c.openen),
      lijst('sluiten', 'Bij het sluiten', c.sluiten),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        bewaar(vinkSleutel(datum), '');
        toonChecklist(vak, ctx);
      } }, 'Alles uitvinken')));
  }

  /* ---------- Rondleiding ---------- */

  var GEZIEN = 'madrigal_rondleiding_gezien';

  var STAPPEN = [
    ['Welkom', 'Fijn dat je meehelpt! In dit scherm vind je alles wat je als vrijwilliger nodig hebt. Deze korte rondleiding toont de onderdelen. Je kan ze altijd opnieuw openen onderaan Vandaag.'],
    ['Vandaag', 'Vandaag toont wat aandacht vraagt: boeken die te laat zijn, reservaties die klaarliggen, en wanneer jij op het rooster staat. Klik op Open om ernaartoe te gaan.'],
    ['Uitlenen', 'Uitlenen en terugbrengen doe je in het uitleenscherm (knop bovenaan). Hier zie je de lopende uitleningen, de reservaties en wat te laat is. Teruggebracht en Verleng werken ook vanuit dit scherm.'],
    ['Je shift', 'De checklist toont wat je doet bij het openen en het sluiten van de bib. In het rooster zie je wie wanneer staat. Je beschikbaarheid vul je in via de roostertool.'],
    ['Boeken aanvullen', 'Bij Boeken zonder cover neem je een foto van de voorkant. Bij Boeken zonder beschrijving stel je een tekst voor. Het bestuur keurt die goed voor ze op de website komt. Met Kastcontrole scan je een kast en zie je wat ontbreekt.'],
    ['Iets melden', 'Is een boek kapot, raakte iets kwijt of had een lener een vraag die je niet kon beantwoorden? Gebruik Iets melden. Het bestuur ziet je melding en volgt ze op.']
  ];

  function rondleiding(vak, ctx, i) {
    bewaar(GEZIEN, 'ja');
    var stap = STAPPEN[i];
    D.vervang(vak, ctx.kop(stap[0], 'Rondleiding, stap ' + (i + 1) + ' van ' + STAPPEN.length), el('p', {}, stap[1]),
      knoppen(i > 0 ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { rondleiding(vak, ctx, i - 1); } }, '‹ Vorige') : null,
        i + 1 < STAPPEN.length ? el('button', { type: 'button', class: 'knop', onclick: function () { rondleiding(vak, ctx, i + 1); } }, 'Volgende ›') : null,
        el('button', { type: 'button', class: i + 1 < STAPPEN.length ? 'knop tweede' : 'knop', onclick: function () { ctx.toonSectie('vandaag'); } }, i + 1 < STAPPEN.length ? 'Sluit de rondleiding' : 'Klaar, naar Vandaag')));
    vak.querySelector('h2').focus();
  }

  /** Bovenaan Vandaag, enkel de eerste keer. Onderaan Vandaag altijd een knop om de rondleiding opnieuw te bekijken. */
  function welkomBlok(ctx) {
    if (lees(GEZIEN)) return null;
    return el('div', { class: 'melding info welkom' }, el('p', {}, el('strong', {}, 'Eerste keer hier? '), 'Een korte rondleiding toont je in een minuut wat je in dit scherm kan doen.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { rondleiding($('sectie'), ctx, 0); } }, 'Start de rondleiding'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function (e) { bewaar(GEZIEN, 'ja'); e.target.closest('.welkom').remove(); } }, 'Niet nodig')));
  }

  function rondleidingKnop(ctx) {
    return knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { rondleiding($('sectie'), ctx, 0); } }, 'Bekijk de rondleiding'));
  }

  /* ---------- Kastcontrole ---------- */

  // Blijft bewaard zolang het scherm open is, ook als je even een ander onderdeel opent.
  var kast = null;

  /** Vergelijkt de gescande boeken met de catalogus. Geeft de lijsten voor het resultaat. */
  function kastResultaat(k, boeken, lopend) {
    var uit = {};
    lopend.forEach(function (u) { uit[String(u.boek_id)] = (uit[String(u.boek_id)] || 0) + 1; });
    var res = { gevonden: [], uitgeleend: [], ontbreekt: [], ookUitgeleend: [], anderOnderwerp: [], onbekend: [] };
    k.boeken.forEach(function (b) {
      if (k.gevonden[b.id]) {
        res.gevonden.push(b);
        if (uit[b.id] && uit[b.id] >= (b.x || 1)) res.ookUitgeleend.push(b);
      } else if (uit[b.id]) res.uitgeleend.push(b);
      else res.ontbreekt.push(b);
    });
    var inKast = {};
    k.boeken.forEach(function (b) { inKast[b.id] = true; });
    k.gescand.forEach(function (isbn) {
      var b = boeken.filter(function (x) { return x.i === isbn; })[0];
      if (!b) res.onbekend.push(isbn);
      else if (!inKast[b.id] && res.anderOnderwerp.indexOf(b) === -1) res.anderOnderwerp.push(b);
    });
    return res;
  }

  /** De boeken van een onderwerp, alfabetisch op auteur. Verloren boeken tellen niet. */
  function boekenVoorKast(boeken, onderwerp, van, tot) {
    var a = Z.normaliseer(van || '').slice(0, 1) || 'a';
    var z = Z.normaliseer(tot || '').slice(0, 1) || 'z';
    return boeken.filter(function (b) {
      if (b.st === 'verloren' || (onderwerp && (b.g || []).indexOf(onderwerp) === -1)) return false;
      var eerste = Z.normaliseer(b.a || b.t).slice(0, 1);
      return eerste >= a && eerste <= z;
    }).sort(function (x, y) { return Z.sorteerTekst(x.a || x.t).localeCompare(Z.sorteerTekst(y.a || y.t), 'nl'); });
  }

  function toonKast(vak, ctx) {
    if (kast) { toonKastBezig(vak, ctx); return; }
    var boeken = ctx.data.boeken || [];
    var onderwerpen = [];
    boeken.forEach(function (b) { (b.g || []).forEach(function (g) { if (onderwerpen.indexOf(g) === -1) onderwerpen.push(g); }); });
    onderwerpen.sort(function (a, b) { return a.localeCompare(b, 'nl'); });
    var keuze = el('select', { id: 'kast-onderwerp' }, [el('option', { value: '' }, 'Alle onderwerpen')].concat(onderwerpen.map(function (g) { return el('option', { value: g }, g); })));
    var van = el('input', { type: 'text', id: 'kast-van', maxlength: '1', autocomplete: 'off', placeholder: 'A', class: 'kort' });
    var tot = el('input', { type: 'text', id: 'kast-tot', maxlength: '1', autocomplete: 'off', placeholder: 'Z', class: 'kort' });
    var aantal = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    function tel() { aantal.textContent = boekenVoorKast(boeken, keuze.value, van.value, tot.value).length + ' boeken volgens de catalogus.'; }
    [keuze, van, tot].forEach(function (x) { x.addEventListener('input', tel); x.addEventListener('change', tel); });
    tel();
    D.vervang(vak, ctx.kop('Kastcontrole', 'Kies welke kast je nakijkt. Scan daarna de boeken die er staan, een na een. Het scherm toont wat ontbreekt.'),
      el('div', { class: 'veld' }, el('label', { for: 'kast-onderwerp' }, 'Onderwerp'), keuze),
      el('div', { class: 'veld' }, el('label', { for: 'kast-van' }, 'Auteurs van letter ', el('span', { class: 'hulptekst' }, '(mag leeg)')), van),
      el('div', { class: 'veld' }, el('label', { for: 'kast-tot' }, 'Tot en met letter ', el('span', { class: 'hulptekst' }, '(mag leeg)')), tot),
      aantal,
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () {
        var lijst = boekenVoorKast(boeken, keuze.value, van.value, tot.value);
        if (!lijst.length) { B.melding($('melding'), 'fout', 'Geen boeken voor deze keuze.'); return; }
        kast = { naam: [keuze.value || 'Alle onderwerpen', (van.value || tot.value) ? (van.value || 'A').toUpperCase() + ' tot ' + (tot.value || 'Z').toUpperCase() : ''].filter(Boolean).join(', '),
          boeken: lijst, gevonden: {}, gescand: [] };
        toonKastBezig(vak, ctx);
      } }, 'Begin de controle')));
  }

  /** Een ISBN telt mee. Geeft de tekst voor onder het camerabeeld. */
  function verwerkIsbn(ctx, isbn) {
    if (kast.gescand.indexOf(isbn) === -1) kast.gescand.push(isbn);
    var b = (ctx.data.boeken || []).filter(function (x) { return x.i === isbn; })[0];
    if (!b) return isbn + ': niet in de catalogus.';
    var inKast = kast.boeken.some(function (x) { return x.id === b.id; });
    if (inKast) kast.gevonden[b.id] = true;
    return '"' + b.t + '"' + (inKast ? ' gevonden.' : ' hoort niet in deze kast.');
  }

  function toonKastBezig(vak, ctx) {
    var res = kastResultaat(kast, ctx.data.boeken || [], ctx.data.lopend || []);
    var isbnVeld = el('input', { type: 'text', id: 'kast-isbn', inputmode: 'numeric', autocomplete: 'off', placeholder: '978...' });
    var status = el('p', { 'aria-live': 'polite' });
    function voegIsbnToe(e) {
      e.preventDefault();
      var isbn = isbnVeld.value.replace(/[^\dX]/gi, '');
      if (!W.isIsbn(isbn)) { status.textContent = 'Dit is geen ISBN-13.'; return; }
      var tekst = verwerkIsbn(ctx, isbn);
      toonKastBezig(vak, ctx);
      B.melding($('melding'), 'info', tekst);
      $('kast-isbn').focus();
    }
    function vink(b) {
      var id = 'kast-' + b.id;
      var v = el('input', { type: 'checkbox', id: id, checked: !!kast.gevonden[b.id] });
      v.addEventListener('change', function () {
        if (v.checked) kast.gevonden[b.id] = true; else delete kast.gevonden[b.id];
        toonKastBezig(vak, ctx);
        var terug = $(id);
        if (terug) terug.focus();
      });
      return el('label', { class: 'vinkje', for: id }, v, el('span', {}, el('strong', {}, b.t), ' ', el('span', { class: 'hulptekst' }, [b.a, b.id, b.i ? '' : 'geen ISBN'].filter(Boolean).join(' · '))));
    }
    function groep(titel, uitleg, lijst, metVinkje) {
      return el('details', { class: 'blok', open: metVinkje && lijst.length > 0 && lijst.length <= 60 },
        el('summary', {}, titel + ' (' + lijst.length + ')'), uitleg ? el('p', { class: 'hulptekst' }, uitleg) : null,
        lijst.length ? el('div', {}, lijst.map(function (b) {
          return metVinkje ? vink(b) : el('p', {}, typeof b === 'string' ? b : [el('strong', {}, b.t), ' ', el('span', { class: 'hulptekst' }, [b.a, b.id].filter(Boolean).join(' · '))]);
        })) : el('p', {}, 'Geen.'));
    }
    var meldKnop = res.ontbreekt.length ? el('button', { type: 'button', class: 'knop tweede', onclick: function (e) {
      if (!window.confirm('De ' + res.ontbreekt.length + ' ontbrekende boeken melden aan het bestuur?')) return;
      e.target.disabled = true;
      B.voerUit('meldingMaken', { soort: 'iets kwijt', onderwerp: 'Kastcontrole: ' + kast.naam,
        bericht: 'Niet gevonden in de kast en niet uitgeleend:\n' + res.ontbreekt.map(function (b) { return b.id + ' ' + b.t; }).join('\n').slice(0, 950) }).then(function (r) {
        e.target.disabled = false;
        B.melding($('melding'), r.ok ? 'ok' : 'fout', r.ok ? 'De ontbrekende boeken zijn gemeld aan het bestuur.' : r.fout);
      });
    } }, 'Meld de ontbrekende boeken aan het bestuur') : null;
    D.vervang(vak, ctx.kop('Kastcontrole: ' + kast.naam, res.gevonden.length + ' van ' + kast.boeken.length + ' boeken gevonden. Scan de streepjescodes, of vink een boek zonder ISBN met de hand aan.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () {
        W.scanIsbn({ doorlopend: true, titel: 'Kast scannen', uitleg: 'Hou de boeken een voor een voor de camera. Klik op Klaar met scannen als de kast gedaan is.',
          bijIsbn: function (isbn) { return verwerkIsbn(ctx, isbn); } }).then(function () { toonKastBezig(vak, ctx); });
      } }, 'Scan met de camera')),
      el('form', { class: 'veld', novalidate: true, onsubmit: voegIsbnToe },
        el('label', { for: 'kast-isbn' }, 'Of typ een ISBN (een scanner met USB werkt ook)'), isbnVeld,
        knoppen(el('button', { type: 'submit', class: 'knop tweede' }, 'Voeg toe'))),
      status,
      groep('Ontbreekt', 'Niet gescand en niet uitgeleend. Kijk of ze elders staan.', res.ontbreekt, true),
      groep('Uitgeleend', 'Niet in de kast, maar dat klopt: ze zijn uitgeleend.', res.uitgeleend, true),
      groep('Gevonden', null, res.gevonden, true),
      res.ookUitgeleend.length ? groep('Gevonden, maar uitgeleend volgens het systeem', 'Breng deze boeken terug in het uitleenscherm, of meld het aan het bestuur.', res.ookUitgeleend) : null,
      res.anderOnderwerp.length ? groep('Hoort in een andere kast', 'Volgens de catalogus horen deze boeken niet bij deze keuze.', res.anderOnderwerp) : null,
      res.onbekend.length ? groep('Niet in de catalogus', 'Deze ISBN\'s staan niet in de catalogus. Leg de boeken apart voor het bestuur.', res.onbekend) : null,
      knoppen(meldKnop, el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        if (res.gevonden.length && !window.confirm('Stoppen met deze kast? Wat je scande, gaat verloren.')) return;
        kast = null;
        toonKast(vak, ctx);
      } }, 'Andere kast kiezen')));
  }

  /* ---------- Iets melden ---------- */

  var SOORTEN = [['boek kapot', 'Een boek is kapot'], ['iets kwijt', 'Iets is kwijt'], ['vraag van een lener', 'Een vraag van een lener'], ['andere', 'Iets anders']];

  function toonMelden(vak, ctx) {
    var fout = el('div', { 'aria-live': 'assertive' });
    var onderwerp = el('input', { type: 'text', id: 'melden-onderwerp', maxlength: '120', autocomplete: 'off', placeholder: 'bv. een boek-ID, een titel of de balie' });
    var bericht = el('textarea', { id: 'melden-bericht', rows: '5', maxlength: '1000' });
    var formulier = el('form', { novalidate: true },
      el('fieldset', { class: 'keuzes' }, el('legend', {}, 'Wat wil je melden?'), SOORTEN.map(function (s, i) {
        return el('label', {}, el('input', { type: 'radio', name: 'melden-soort', value: s[0], checked: i === 0 }), s[1]);
      })),
      el('div', { class: 'veld' }, el('label', { for: 'melden-onderwerp' }, 'Over wat gaat het? ', el('span', { class: 'hulptekst' }, '(mag leeg)')), onderwerp),
      el('div', { class: 'veld' }, el('label', { for: 'melden-bericht' }, 'Wat is er aan de hand?'), bericht,
        el('p', { class: 'hulptekst' }, 'Schrijf geen telefoonnummers of mailadressen van leners. Een lenersnummer volstaat.')),
      fout,
      el('button', { type: 'submit', class: 'knop' }, 'Verstuur naar het bestuur'));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var knop = formulier.querySelector('button[type="submit"]');
      knop.disabled = true;
      B.voerUit('meldingMaken', { soort: formulier.querySelector('input[name="melden-soort"]:checked').value, onderwerp: onderwerp.value, bericht: bericht.value }).then(function (r) {
        knop.disabled = false;
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', r.tekst);
        toonMelden(vak, ctx);
      });
    });
    D.vervang(vak, ctx.kop('Iets melden', 'Een boek kapot, iets kwijt, een vraag die je niet kon beantwoorden? Het bestuur krijgt je melding te zien in het bestuursscherm.'), formulier);
  }

  /* ---------- Voor het bestuur: meldingen en voorgestelde beschrijvingen ---------- */

  function toonMeldingen(vak, ctx) {
    var lijst = ctx.data.meldingen || [];
    D.vervang(vak, ctx.kop('Meldingen van vrijwilligers', 'Wat vrijwilligers via Iets melden doorgaven. Volg op en zet de melding daarna op afgehandeld. Afgehandelde meldingen verdwijnen na de bewaartermijn (instelling meldingen_bewaren_dagen).'),
      lijst.length ? el('ul', { class: 'kaartlijst' }, lijst.map(function (m) {
        var fout = el('div');
        return el('li', { class: 'kaart' },
          el('h3', {}, m.soort.charAt(0).toUpperCase() + m.soort.slice(1) + (m.onderwerp ? ': ' + m.onderwerp : '')),
          el('p', { class: 'hulptekst' }, D.korteDatum(m.datum) + ' · ' + m.wie + ' · ' + m.melding_id),
          el('p', { class: 'met-regels' }, m.bericht), fout,
          knoppen(el('button', { type: 'button', class: 'knop', onclick: function (e) {
            e.target.disabled = true;
            B.voerUit('meldingAfhandelen', { melding_id: m.melding_id }).then(function (r) {
              if (!r.ok) { e.target.disabled = false; B.melding(fout, 'fout', r.fout); return; }
              B.melding($('melding'), 'ok', r.tekst);
              ctx.laad();
            });
          } }, 'Afgehandeld')));
      })) : el('p', {}, 'Geen open meldingen.'));
  }

  function toonVoorstellen(vak, ctx) {
    var lijst = ctx.data.beschrijvingVoorstellen || [];
    D.vervang(vak, ctx.kop('Voorgestelde beschrijvingen', 'Beschrijvingen die vrijwilligers voorstelden. Pas de tekst aan als dat nodig is en keur goed: dan komt ze in de Catalogus en op de website.'),
      lijst.length ? el('ul', { class: 'kaartlijst' }, lijst.map(function (v) {
        var fout = el('div');
        var id = 'voorstel-' + v.voorstel_id;
        var tekst = el('textarea', { id: id, rows: '7', maxlength: '3000' });
        tekst.value = v.tekst;
        function besluit(soort) {
          return function (e) {
            if (soort === 'afgekeurd' && !window.confirm('Dit voorstel afkeuren?')) return;
            e.target.disabled = true;
            B.voerUit('voorstelBehandelen', { voorstel_id: v.voorstel_id, besluit: soort, tekst: tekst.value }).then(function (r) {
              if (!r.ok) { e.target.disabled = false; B.melding(fout, 'fout', r.fout); return; }
              B.melding($('melding'), 'ok', r.tekst);
              ctx.laad();
            });
          };
        }
        return el('li', { class: 'kaart' },
          el('h3', {}, v.titel), el('p', { class: 'hulptekst' }, v.boek_id + ' · voorgesteld door ' + v.voorgesteld_door + ' op ' + D.korteDatum(v.datum)),
          el('div', { class: 'veld' }, el('label', { for: id }, 'Beschrijving'), tekst), fout,
          knoppen(el('button', { type: 'button', class: 'knop', onclick: besluit('goedgekeurd') }, 'Keur goed'),
            el('button', { type: 'button', class: 'knop tweede', onclick: besluit('afgekeurd') }, 'Keur af')));
      })) : el('p', {}, 'Geen voorstellen die wachten.'));
  }

  root.MadrigalVrijwilligers = {
    shiftBlok: shiftBlok, checklist: toonChecklist, welkomBlok: welkomBlok, rondleidingKnop: rondleidingKnop,
    kast: toonKast, melden: toonMelden, meldingen: toonMeldingen, voorstellen: toonVoorstellen,
    /** Voor de tests. */
    shiftUitRooster: shiftUitRooster, kastResultaat: kastResultaat, boekenVoorKast: boekenVoorKast
  };
})(window);
