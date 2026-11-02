/**
 * titelcontrole.js
 * Titels en auteurs nakijken in de bib, in het bestuursscherm en het vrijwilligersscherm. Zie apps-script/Titelcontrole.js.
 *
 *   - De boeken waarvan de titel of de auteur verschilt tussen de stocklijst, de oude website en de Catalogus.
 *   - Kast per kast (onderwerp), binnen een kast op auteur, zoals bij Kastcontrole.
 *   - Een voor een: een versie overnemen, zelf typen, "klopt" of "niet in de kast". Overslaan en terug kan ook.
 *   - Enkel het bestuur: de lijst (opnieuw) maken, en de boeken die niet in de kast stonden terug op de lijst zetten.
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var Z = root.MadrigalZoeken;

  var ZONDER = 'Zonder onderwerp';
  var lijst = null;   // { open, nietGevonden, gedaan, leeg }
  var kast = '';      // gekozen onderwerp, '' = alle kasten
  var plaats = 0;     // het hoeveelste boek in de gekozen kast

  function isBestuur(ctx) { return ctx.scherm === 'bestuur' && B.sessie.rol === 'bestuur'; }
  function knoppen() { return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments)); }

  /** Het onderwerp (kast) en de auteur van een boek, uit de gegevens van het scherm. */
  function info(ctx, id) {
    var b = (ctx.data.boeken || []).filter(function (x) { return x.id === id; })[0];
    return { g: b && b.g && b.g.length ? b.g : [ZONDER] };
  }

  /** De boeken van de gekozen kast, op onderwerp en daarbinnen op auteur. */
  function boekenInKast(ctx) {
    return lijst.open.map(function (x) { return { x: x, g: info(ctx, x.id).g }; })
      .filter(function (o) { return !kast || o.g.indexOf(kast) > -1; })
      .sort(function (p, q) {
        var gp = kast || p.g[0], gq = kast || q.g[0];
        return gp.localeCompare(gq, 'nl') || Z.sorteerTekst(p.x.nu.a || p.x.nu.t).localeCompare(Z.sorteerTekst(q.x.nu.a || q.x.nu.t), 'nl');
      }).map(function (o) { o.x.kast = kast || o.g[0]; return o.x; });
  }

  function laad(vak, ctx, okTekst) {
    D.vervang(vak, ctx.kop('Titels en auteurs nakijken'), el('p', {}, 'Lijst laden...'));
    B.voerUit('titelcontroleData', {}).then(function (r) {
      if (!r.ok) { D.vervang(vak, ctx.kop('Titels en auteurs nakijken'), el('div', { class: 'melding fout', role: 'alert' }, r.fout || 'De lijst kon niet laden.')); return; }
      lijst = r.lijst;
      teken(vak, ctx, okTekst);
    });
  }

  function toon(vak, ctx) {
    if (lijst) teken(vak, ctx); else laad(vak, ctx);
  }

  function teken(vak, ctx, okTekst) {
    var bestuur = isBestuur(ctx);
    var melding = el('div', { 'aria-live': 'polite' });
    if (okTekst) B.melding(melding, 'ok', okTekst);
    var uitleg = 'Boeken waarvan de titel of de auteur anders geschreven is in de stocklijst, op de oude website of nu op de website. Neem het boek uit de kast en kijk hoe het op de cover staat. Neem een versie over of typ het zelf.';
    var delen = [ctx.kop('Titels en auteurs nakijken', uitleg), melding];
    if (lijst.leeg) {
      delen.push(el('p', {}, bestuur ? 'Er is nog geen lijst. Maak ze hieronder, of via Madrigal > Boeken > Titelcontrole in de bib: maak de lijst.' : 'Er is nog geen lijst. Vraag het bestuur om ze te maken.'));
    } else {
      delen.push(kastKeuze(vak, ctx), huidig(vak, ctx, melding));
      if (bestuur) delen.push(nietGevondenBlok(vak, ctx, melding));
    }
    if (bestuur) delen.push(maakBlok(vak, ctx, melding));
    D.vervang(vak, delen);
  }

  function kastKeuze(vak, ctx) {
    var tel = {};
    lijst.open.forEach(function (x) { info(ctx, x.id).g.forEach(function (g) { tel[g] = (tel[g] || 0) + 1; }); });
    var kasten = Object.keys(tel).sort(function (a, b) { return a.localeCompare(b, 'nl'); });
    if (kast && !tel[kast]) kast = '';
    var keuze = el('select', { id: 'tc-kast' }, [el('option', { value: '' }, 'Alle kasten (' + lijst.open.length + ')')].concat(kasten.map(function (g) {
      return el('option', { value: g, selected: g === kast ? 'selected' : null }, g + ' (' + tel[g] + ')');
    })));
    keuze.addEventListener('change', function () { kast = keuze.value; plaats = 0; teken(vak, ctx); var k = document.getElementById('tc-kast'); if (k) k.focus(); });
    return el('div', { class: 'veld' }, el('label', { for: 'tc-kast' }, 'Kast'), keuze);
  }

  function huidig(vak, ctx, melding) {
    var boeken = boekenInKast(ctx);
    if (!boeken.length) {
      return el('p', {}, lijst.open.length ? 'Deze kast is klaar. Kies een andere kast.' : 'Alles is nagekeken. ' + lijst.gedaan + ' boeken gedaan. Dank je!');
    }
    if (plaats >= boeken.length) plaats = boeken.length - 1;
    if (plaats < 0) plaats = 0;
    var x = boeken[plaats];
    var titel = el('input', { type: 'text', id: 'tc-titel', value: x.nu.t, autocomplete: 'off' });
    var auteur = el('input', { type: 'text', id: 'tc-auteur', value: x.nu.a, autocomplete: 'off' });
    var bewaar = el('button', { type: 'button', class: 'knop' }, 'Klopt, volgende');
    function pasKnopAan() {
      var anders = titel.value.trim() !== x.nu.t || auteur.value.trim() !== x.nu.a;
      bewaar.textContent = anders ? 'Bewaar, volgende' : 'Klopt, volgende';
    }
    titel.addEventListener('input', pasKnopAan);
    auteur.addEventListener('input', pasKnopAan);

    function versie(naam, v) {
      if (!v) return el('tr', {}, el('th', { scope: 'row' }, naam), el('td', { colspan: '3', class: 'hulptekst' }, 'Niet gevonden in deze bron'));
      var neem = el('button', { type: 'button', class: 'knop tweede klein' }, 'Neem over');
      neem.setAttribute('aria-label', 'Neem de versie van ' + naam.toLowerCase() + ' over');
      neem.addEventListener('click', function () {
        if (v.t) titel.value = v.t;
        if (v.a) auteur.value = v.a;
        pasKnopAan();
        titel.focus();
      });
      return el('tr', {}, el('th', { scope: 'row' }, naam), el('td', {}, v.t || '–'), el('td', {}, v.a || '–'), el('td', {}, neem));
    }

    function stuur(status, knop) {
      knop.disabled = true;
      B.voerUit('titelcontroleBewaren', { boek_id: x.id, status: status, titel: titel.value, auteur: auteur.value }).then(function (r) {
        knop.disabled = false;
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(melding, 'fout', r.fout || 'Dat lukte niet.'); return; }
        lijst.open = lijst.open.filter(function (o) { return o.id !== x.id; });
        if (status === 'niet in de kast') lijst.nietGevonden.push(Object.assign({}, x, { wie: B.sessie.wie || '', datum: '' }));
        else lijst.gedaan++;
        teken(vak, ctx, r.tekst);
        var volgende = document.getElementById('tc-titel');
        if (volgende) volgende.focus();
      });
    }
    bewaar.addEventListener('click', function () { stuur('aangepast', bewaar); });
    var niet = el('button', { type: 'button', class: 'knop tweede' }, 'Niet in de kast');
    niet.addEventListener('click', function () { stuur('niet in de kast', niet); });
    var vorige = el('button', { type: 'button', class: 'knop tweede', disabled: plaats === 0 ? true : null }, '‹ Vorige');
    vorige.addEventListener('click', function () { plaats--; teken(vak, ctx); });
    var sla = el('button', { type: 'button', class: 'knop tweede', disabled: plaats >= boeken.length - 1 ? true : null }, 'Sla over ›');
    sla.addEventListener('click', function () { plaats++; teken(vak, ctx); });

    return el('section', { class: 'blok', 'aria-labelledby': 'tc-kop' },
      el('p', { class: 'hulptekst' }, x.kast + ': boek ' + (plaats + 1) + ' van ' + boeken.length + '. Al nagekeken: ' + lijst.gedaan + '.'),
      el('h3', { id: 'tc-kop' }, x.nu.t + (x.nu.a ? ' (' + x.nu.a + ')' : '')),
      el('p', { class: 'hulptekst' }, 'Boek ' + x.id + (x.isbn ? ', ISBN ' + x.isbn : '')),
      el('div', { class: 'tabel-wrap' }, el('table', { class: 'tabel' },
        el('caption', {}, 'Zo staat het in elke bron'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Bron'), el('th', { scope: 'col' }, 'Titel'), el('th', { scope: 'col' }, 'Auteur'), el('td', {}))),
        el('tbody', {}, versie('Stocklijst', x.stock), versie('Oude website', x.oud), versie('Nu op de website', x.nu)))),
      el('div', { class: 'veld' }, el('label', { for: 'tc-titel' }, 'Titel zoals op het boek'), titel),
      el('div', { class: 'veld' }, el('label', { for: 'tc-auteur' }, 'Auteur zoals op het boek'), auteur),
      knoppen(bewaar, niet),
      knoppen(vorige, sla));
  }

  /** Enkel het bestuur: de boeken die niet in de kast stonden. */
  function nietGevondenBlok(vak, ctx, melding) {
    if (!lijst.nietGevonden.length) return null;
    return el('section', { class: 'blok', 'aria-labelledby': 'tc-niet' },
      el('h3', { id: 'tc-niet' }, 'Niet gevonden in de kast (' + lijst.nietGevonden.length + ')'),
      el('p', { class: 'hulptekst' }, 'Is het boek uitgeleend of staat het in een andere kast? Zet het terug op de lijst als het weer in de kast staat.'),
      el('ul', { class: 'kaartlijst' }, lijst.nietGevonden.map(function (x) {
        var terug = el('button', { type: 'button', class: 'knop tweede klein' }, 'Terug op de lijst');
        terug.addEventListener('click', function () {
          terug.disabled = true;
          B.voerUit('titelcontroleBewaren', { boek_id: x.id, status: 'open' }).then(function (r) {
            terug.disabled = false;
            if (r.geannuleerd) return;
            if (!r.ok) { B.melding(melding, 'fout', r.fout || 'Dat lukte niet.'); return; }
            lijst.nietGevonden = lijst.nietGevonden.filter(function (o) { return o.id !== x.id; });
            lijst.open.push(x);
            teken(vak, ctx, r.tekst);
          });
        });
        return el('li', { class: 'kaart' }, el('p', {}, el('strong', {}, x.nu.t), x.nu.a ? ' (' + x.nu.a + ')' : '', ', boek ' + x.id),
          x.wie || x.datum ? el('p', { class: 'hulptekst' }, 'Gemeld' + (x.wie ? ' door ' + x.wie : '') + (x.datum ? ' op ' + x.datum : '')) : null,
          knoppen(terug));
      })));
  }

  /** Enkel het bestuur: de lijst (opnieuw) maken. */
  function maakBlok(vak, ctx, melding) {
    var knop = el('button', { type: 'button', class: 'knop tweede' }, lijst.leeg ? 'Maak de lijst' : 'Maak de lijst opnieuw');
    knop.addEventListener('click', function () {
      knop.disabled = true;
      B.melding(melding, 'info', 'De lijst wordt gemaakt. Dat duurt even: het script leest de oude website.');
      B.voerUit('titelcontroleMaken', {}).then(function (r) {
        knop.disabled = false;
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(melding, 'fout', r.fout || 'Dat lukte niet.'); return; }
        plaats = 0;
        laad(vak, ctx, r.tekst);
      });
    });
    return el('section', { class: 'blok' },
      el('p', { class: 'hulptekst' }, 'Opnieuw maken vergelijkt de drie bronnen opnieuw. Wat al nagekeken is, blijft nagekeken.'),
      knoppen(knop));
  }

  root.MadrigalTitelcontrole = { toon: toon };
})(window);
