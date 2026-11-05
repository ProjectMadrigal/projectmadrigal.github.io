/**
 * titelcontrole.js
 * Titels en auteurs nakijken in de bib, in het bestuursscherm en het vrijwilligersscherm. Zie apps-script/Titelcontrole.js.
 *
 *   - De boeken waarvan de titel of de auteur verschilt tussen de stocklijst, de oude website en de Catalogus.
 *   - Kast per kast (onderwerp), binnen een kast op auteur, zoals bij Kastcontrole.
 *   - Een voor een: een versie overnemen, zelf typen, "klopt" of "niet in de kast". Overslaan en terug kan ook.
 *   - Met de cover van het boek erbij, zodat je het sneller vindt in de kast.
 *   - Bewaren gebeurt op de achtergrond: het volgende boek staat er meteen. Wat je in dit bezoek nakeek, blijft
 *     in de rij staan: met Vorige ga je terug naar een boek dat je net bewaarde, en pas je het nog aan.
 *     Lukt bewaren niet, dan komt het boek terug op de lijst, met een melding.
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
  var nagekeken = {}; // boek_id: { x, status, bezig } van wat je in dit bezoek nakeek: blijft in de rij voor Vorige
  var wachtrij = [];  // bewaren gebeurt een voor een op de achtergrond
  var bezigMet = 0;   // zoveel boeken worden nog bewaard
  var statusVak = null; // de melding van het bewaren: blijft staan als het scherm opnieuw tekent
  var W = root.MadrigalBestuurBeheer;

  // Pagina sluiten terwijl er nog iets bewaard wordt: eerst waarschuwen.
  root.addEventListener('beforeunload', function (e) { if (bezigMet) { e.preventDefault(); e.returnValue = ''; } });

  function isBestuur(ctx) { return ctx.scherm === 'bestuur' && B.sessie.rol === 'bestuur'; }
  function knoppen() { return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments)); }

  /** Het onderwerp (kast) en de auteur van een boek, uit de gegevens van het scherm. */
  function info(ctx, id) {
    var b = (ctx.data.boeken || []).filter(function (x) { return x.id === id; })[0];
    return { g: b && b.g && b.g.length ? b.g : [ZONDER], boek: b };
  }

  /** De open boeken en wat je in dit bezoek al nakeek (dat blijft op zijn plaats staan, voor Vorige). */
  function inDeRij() {
    var ids = lijst.open.map(function (x) { return x.id; });
    return lijst.open.concat(Object.keys(nagekeken).filter(function (id) { return ids.indexOf(id) === -1; }).map(function (id) { return nagekeken[id].x; }));
  }

  /** De boeken van de gekozen kast, op onderwerp en daarbinnen op auteur. */
  function boekenInKast(ctx) {
    return inDeRij().map(function (x) { return { x: x, g: info(ctx, x.id).g }; })
      .filter(function (o) { return !kast || o.g.indexOf(kast) > -1; })
      .sort(function (p, q) {
        var gp = kast || p.g[0], gq = kast || q.g[0];
        return gp.localeCompare(gq, 'nl') || Z.sorteerTekst(p.x.nu.a || p.x.nu.t).localeCompare(Z.sorteerTekst(q.x.nu.a || q.x.nu.t), 'nl');
      }).map(function (o) { o.x.kast = kast || o.g[0]; return o.x; });
  }

  // Tussen twee auteurs: ; of & of "en". Een komma hoort bij "Achternaam, Voornaam". Zoals in apps-script/Titelcontrole.js.
  var SCHEIDING = /(\s*;\s*|\s*&\s*|\s+(?:en|and|et|und)\s+)/i;
  // Tussen titel en ondertitel: een dubbelpunt, een streepje met spaties, of een punt gevolgd door meer tekst.
  var ONDERTITEL = /\s*:\s*|\s+[-–—]\s+|\.\s+(?=\S)|\s*,\s+(?=\S)|\s+(?=\()/;
  function sleutel(t) { return Z.normaliseer(t).split(' ').filter(function (w, i, alle) { return w && alle.indexOf(w) === i; }).sort().join(' '); }
  /** Staat elke naam in de vorm "Achternaam, Voornaam"? (Een naam uit één woord telt als goed.) Zoals in Titelcontrole.js. */
  function goedeVorm(auteur) {
    var delen = String(auteur || '').split(SCHEIDING).filter(function (d, i) { return !(i % 2) && d.trim(); });
    return delen.length > 0 && delen.every(function (d) { return d.indexOf(',') > -1 || d.trim().split(/\s+/).length === 1; });
  }

  /** De namen in een veld, elk als sleutel, zonder dubbels. */
  function namen(auteur) {
    var uit = [];
    String(auteur || '').split(SCHEIDING).forEach(function (d, i) { var k = sleutel(d); if (!(i % 2) && k && uit.indexOf(k) === -1) uit.push(k); });
    return uit;
  }

  /**
   * Een auteur zonder komma in de vorm "Achternaam, Voornaam", met de achternaam uit het voorbeeld (wat nu op de
   * website staat). "Aaron William" met voorbeeld "Aaron, Willem" wordt "Aaron, William". Vindt het de achternaam
   * niet terug, dan blijft de naam zoals hij is: raden doen we niet.
   */
  function auteurInVorm(auteur, voorbeeld) {
    var achternamen = String(voorbeeld || '').split(SCHEIDING).filter(function (d, i) { return !(i % 2) && d.indexOf(',') > -1; })
      .map(function (d) { return Z.normaliseer(d.split(',')[0]).split(' ').filter(Boolean); });
    return String(auteur || '').split(SCHEIDING).map(function (deel, nr) {
      if (nr % 2) return deel; // het scheidingsteken blijft
      deel = deel.trim();
      if (!deel || deel.indexOf(',') > -1) return deel;
      var woorden = deel.split(/\s+/);
      var klein = woorden.map(function (w) { return Z.normaliseer(w); });
      for (var i = 0; i < achternamen.length; i++) {
        var an = achternamen[i];
        for (var p = 0; p + an.length <= klein.length; p++) {
          if (an.every(function (w, j) { return klein[p + j] === w; })) {
            var rest = woorden.slice(0, p).concat(woorden.slice(p + an.length));
            return woorden.slice(p, p + an.length).join(' ') + (rest.length ? ', ' + rest.join(' ') : '');
          }
        }
      }
      return deel;
    }).join('');
  }

  function laad(vak, ctx, okTekst) {
    D.vervang(vak, ctx.kop('Titels en auteurs nakijken'), el('p', {}, 'Lijst laden...'));
    B.voerUit('titelcontroleData', {}).then(function (r) {
      if (!r.ok) { D.vervang(vak, ctx.kop('Titels en auteurs nakijken'), el('div', { class: 'melding fout', role: 'alert' }, r.fout || 'De lijst kon niet laden.')); return; }
      lijst = r.lijst;
      // Staat een boek volgens de spreadsheet weer open (bv. terug op de lijst gezet), dan telt het niet meer als nagekeken.
      lijst.open.forEach(function (o) { if (nagekeken[o.id] && !nagekeken[o.id].bezig) delete nagekeken[o.id]; });
      teken(vak, ctx, okTekst);
    });
  }

  function toon(vak, ctx) {
    // Telkens vers: de lijst kan intussen opnieuw gemaakt zijn (ook via het menu in de spreadsheet).
    laad(vak, ctx);
  }

  function teken(vak, ctx, okTekst) {
    // Het getal op de knop in het menu bijwerken.
    var aantal = lijst.leeg ? 0 : lijst.open.length;
    if (ctx.data && ctx.data.titelcontrole !== aantal) {
      ctx.data.titelcontrole = aantal;
      if (ctx.tekenNav) ctx.tekenNav();
    }
    var bestuur = isBestuur(ctx);
    if (!statusVak) statusVak = el('div', { 'aria-live': 'polite' });
    var melding = statusVak;
    if (okTekst) B.melding(melding, 'ok', okTekst);
    var uitleg = 'Boeken waarvan de titel of de auteur anders geschreven is in de stocklijst, op de oude website of nu op de website. Neem het boek uit de kast en kijk hoe het op de cover staat. Neem een versie over of typ het zelf.';
    var delen = [ctx.kop('Titels en auteurs nakijken', uitleg), melding];
    if (lijst.leeg) {
      delen.push(el('p', {}, bestuur ? 'Er is nog geen lijst. Maak ze hieronder, of via Madrigal > Titels en auteurs > Titelcontrole in de bib: maak de lijst.' : 'Er is nog geen lijst. Vraag het bestuur om ze te maken.'));
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
    // Een kast waarvan je alles nakeek, blijft in de lijst (met 0): zo kan je er nog naar terug.
    inDeRij().forEach(function (x) { info(ctx, x.id).g.forEach(function (g) { tel[g] = tel[g] || 0; }); });
    var kasten = Object.keys(tel).sort(function (a, b) { return a.localeCompare(b, 'nl'); });
    if (kast && !tel.hasOwnProperty(kast)) kast = '';
    var keuze = el('select', { id: 'tc-kast' }, [el('option', { value: '' }, 'Alle kasten (' + lijst.open.length + ')')].concat(kasten.map(function (g) {
      return el('option', { value: g, selected: g === kast ? 'selected' : null }, g + ' (' + tel[g] + ')');
    })));
    keuze.addEventListener('change', function () { kast = keuze.value; plaats = 0; teken(vak, ctx); var k = document.getElementById('tc-kast'); if (k) k.focus(); });
    return el('div', { class: 'veld' }, el('label', { for: 'tc-kast' }, 'Kast'), keuze);
  }

  function huidig(vak, ctx, melding) {
    var boeken = boekenInKast(ctx);
    if (plaats < 0) plaats = 0;
    if (plaats >= boeken.length) {
      // Voorbij het laatste boek: klaar met deze kast. Vorige brengt je terug naar het laatste boek.
      plaats = boeken.length;
      var terug = boeken.length ? el('button', { type: 'button', class: 'knop tweede' }, '‹ Vorige') : null;
      if (terug) terug.addEventListener('click', function () { plaats = boeken.length - 1; teken(vak, ctx); focusTitel(); });
      var openHier = boeken.filter(function (b) { return !nagekeken[b.id]; }).length;
      return el('div', {},
        el('p', {}, !lijst.open.length ? 'Alles is nagekeken. ' + lijst.gedaan + ' boeken gedaan. Dank je!'
          : openHier ? 'Je bent aan het einde van deze kast. Er staan nog ' + openHier + ' boeken open die je oversloeg: klik op Vorige.'
            : 'Deze kast is klaar. Kies een andere kast.'),
        terug ? knoppen(terug) : null);
    }
    var x = boeken[plaats];
    var al = nagekeken[x.id]; // in dit bezoek al nagekeken?
    var titel = el('input', { type: 'text', id: 'tc-titel', value: x.nu.t, autocomplete: 'off' });
    var auteur = el('input', { type: 'text', id: 'tc-auteur', value: x.nu.a, autocomplete: 'off' });
    var bewaar = el('button', { type: 'button', class: 'knop' }, 'Klopt, volgende');
    function pasKnopAan() {
      var anders = titel.value.trim() !== x.nu.t || auteur.value.trim() !== x.nu.a;
      bewaar.textContent = anders ? 'Bewaar, volgende' : 'Klopt, volgende';
    }
    titel.addEventListener('input', pasKnopAan);
    auteur.addEventListener('input', pasKnopAan);

    // Gelijk zoals het script vergelijkt: hoofdletters, leestekens en de volgorde van de namen tellen niet.
    function zelfdeTitel(a, b) {
      var x = Z.normaliseer(a), y = Z.normaliseer(b);
      // Een ondertitel bij de ene bron en niet bij de andere is geen verschil.
      var kort = function (t) { return Z.normaliseer(String(t || '').split(ONDERTITEL)[0]); };
      return !x || !y || x === y || kort(a) === y || kort(b) === x;
    }
    function zelfdeAuteur(a, b) {
      if (!a || !b) return true;
      var na = namen(a), nb = namen(b);
      // Een naam die volledig in een andere naam zit ("Aurora" en "Aurora Staff"), is dezelfde.
      var zelfde = function (k, m) {
        var p = k.split(' '), q = m.split(' ');
        var deel = function (u, v) { return u.every(function (w) { return v.indexOf(w) > -1; }); };
        return deel(p, q) || deel(q, p);
      };
      var in_ = function (p, q) { return p.length > 0 && p.every(function (k) { return q.some(function (m) { return zelfde(k, m); }); }); };
      // Minder namen bij de ene bron, maar allemaal ook bij de andere: geen verschil.
      if (in_(na, nb) || in_(nb, na)) return true;
      // De vorm "Achternaam, Voornaam" wint altijd: een bron zonder die vorm telt niet tegen een bron met die vorm.
      return goedeVorm(a) !== goedeVorm(b);
    }
    /** De woorden die niet in de versie van nu staan, gemarkeerd: zo zie je meteen wat verschilt (Fonker, Jonker). */
    function gemarkeerd(tekst, nuTekst) {
      var nuWoorden = Z.normaliseer(nuTekst).split(' ');
      return String(tekst || '').split(/(\s+)/).map(function (w) {
        var k = Z.normaliseer(w);
        // "&" en "and" (en, et, und) tellen niet als verschil.
        return k && k.split(' ').some(function (d) { return nuWoorden.indexOf(d) === -1 && ['and', 'en', 'et', 'und'].indexOf(d) === -1; }) ? el('mark', {}, w) : w;
      });
    }
    function cel(tekst, anders, knop) {
      return el('td', {}, tekst || '–', anders ? [' ', D.statusLabel('anders', 'anders')] : null, knop ? [el('br'), knop] : null);
    }
    function neemKnop(tekst, label, doe) {
      var k = el('button', { type: 'button', class: 'knop tweede klein', 'aria-label': label }, tekst);
      k.addEventListener('click', function () { doe(); pasKnopAan(); });
      return k;
    }
    /** Een rij per bron. Nu op de website staat al in de velden. Enkel wat echt verschilt, krijgt een knop: titel en auteur apart. */
    function versie(naam, v, isNu) {
      if (!v) return el('tr', {}, el('th', { scope: 'row' }, naam), el('td', { colspan: '3', class: 'hulptekst' }, 'Niet gevonden in deze bron'));
      if (isNu) return el('tr', {}, el('th', { scope: 'row' }, naam), cel(v.t), cel(v.a), el('td', { class: 'hulptekst' }, 'Staat in de velden'));
      // Het script zegt wat echt anders is (ta, aa). Anders vergelijkt het scherm zelf.
      var titelAnders = typeof v.ta === 'boolean' ? v.ta : !!v.t && !zelfdeTitel(v.t, x.nu.t);
      var auteurAnders = typeof v.aa === 'boolean' ? v.aa : !!v.a && !zelfdeAuteur(v.a, x.nu.a);
      var bron = naam.toLowerCase();
      var titelKnop = titelAnders ? neemKnop('Neem titel over', 'Neem de titel van ' + bron + ' over', function () { titel.value = v.t; titel.focus(); }) : null;
      // De auteur in de vorm Achternaam, Voornaam, met de achternaam zoals die nu op de website staat.
      var auteurKnop = auteurAnders ? neemKnop('Neem auteur over', 'Neem de auteur van ' + bron + ' over', function () { auteur.value = auteurInVorm(v.a, x.nu.a); auteur.focus(); }) : null;
      return el('tr', {}, el('th', { scope: 'row' }, naam), cel(titelAnders ? gemarkeerd(v.t, x.nu.t) : v.t, titelAnders, titelKnop), cel(auteurAnders ? gemarkeerd(v.a, x.nu.a) : v.a, auteurAnders, auteurKnop),
        el('td', { class: 'hulptekst' }, titelAnders || auteurAnders ? '' : 'Zelfde als nu'));
    }

    /**
     * Bewaart op de achtergrond: het scherm gaat meteen naar het volgende boek. Lukt het niet, dan komt
     * alles terug zoals het was en zegt de melding welk boek niet bewaard is.
     */
    function stuur(status) {
      var vroeger = nagekeken[x.id] || null;
      var oudNu = x.nu;
      var wasOpen = lijst.open.some(function (o) { return o.id === x.id; });
      var oudNiet = lijst.nietGevonden.slice();
      var telt = function (st) { return st && st !== 'niet in de kast' ? 1 : 0; };
      var invoer = { boek_id: x.id, status: status, titel: titel.value, auteur: auteur.value };
      // Meteen op het scherm.
      if (status === 'aangepast') x.nu = Object.assign({}, x.nu, { t: titel.value.trim(), a: auteur.value.trim() });
      lijst.open = lijst.open.filter(function (o) { return o.id !== x.id; });
      lijst.nietGevonden = lijst.nietGevonden.filter(function (o) { return o.id !== x.id; });
      if (status === 'niet in de kast') lijst.nietGevonden.push(Object.assign({}, x, { wie: B.sessie.wie || '', datum: '' }));
      lijst.gedaan += telt(status) - telt(vroeger && vroeger.status);
      var dit = { x: x, status: status, bezig: true };
      nagekeken[x.id] = dit;
      bezigMet++;
      B.melding(melding, 'info', 'Bezig met bewaren: "' + x.nu.t + '"...');
      plaats++;
      teken(vak, ctx);
      focusTitel();
      bewaarOpAchtergrond(invoer, function (r) {
        dit.bezig = false;
        if (r.ok) {
          B.melding(melding, 'ok', r.tekst + (bezigMet ? ' Nog ' + bezigMet + ' aan het bewaren.' : ''));
          // Toont het scherm dit boek nog (je ging terug)? Enkel de melding bijwerken, niet wat je typt.
          var alVak = document.getElementById('tc-al');
          if (alVak && alVak.getAttribute('data-id') === x.id) alVak.textContent = alTekst(dit);
          return;
        }
        // Terug zoals het was.
        x.nu = oudNu;
        if (nagekeken[x.id] === dit) { if (vroeger) nagekeken[x.id] = vroeger; else delete nagekeken[x.id]; }
        if (wasOpen && !lijst.open.some(function (o) { return o.id === x.id; })) lijst.open.push(x);
        lijst.nietGevonden = oudNiet;
        lijst.gedaan -= telt(status) - telt(vroeger && vroeger.status);
        teken(vak, ctx);
        if (!r.geannuleerd) B.melding(melding, 'fout', 'Bewaren lukte niet voor "' + oudNu.t + '": ' + (r.fout || 'geen verbinding.') + ' Het boek staat terug op de lijst.');
      });
    }
    bewaar.addEventListener('click', function () { stuur('aangepast'); });
    var niet = el('button', { type: 'button', class: 'knop tweede' }, 'Niet in de kast');
    niet.addEventListener('click', function () { stuur('niet in de kast'); });
    var vorige = el('button', { type: 'button', class: 'knop tweede', disabled: plaats === 0 ? true : null }, '‹ Vorige');
    vorige.addEventListener('click', function () { plaats--; teken(vak, ctx); focusTitel(); });
    var sla = el('button', { type: 'button', class: 'knop tweede', disabled: plaats >= boeken.length - 1 ? true : null }, al ? 'Volgende ›' : 'Sla over ›');
    sla.addEventListener('click', function () { plaats++; teken(vak, ctx); focusTitel(); });
    var kaft = coverVak(ctx, x);
    var volgendBoek = boeken[plaats + 1];
    if (volgendBoek) laadCoverVooraf(ctx, volgendBoek.id);

    return el('section', { class: 'blok', 'aria-labelledby': 'tc-kop' },
      el('p', { class: 'hulptekst' }, x.kast + ': boek ' + (plaats + 1) + ' van ' + boeken.length + '. Al nagekeken: ' + lijst.gedaan + '.'),
      el('div', { class: 'tc-boek' }, kaft,
        el('div', {},
          el('h3', { id: 'tc-kop' }, x.nu.t + (x.nu.a ? ' (' + x.nu.a + ')' : '')),
          el('p', { class: 'hulptekst' }, 'Boek ' + x.id + (x.isbn ? ', ISBN ' + x.isbn : '')))),
      al ? el('p', { class: 'melding info', id: 'tc-al', 'data-id': x.id }, alTekst(al)) : null,
      el('div', { class: 'tabel-wrap' }, el('table', { class: 'tabel' },
        el('caption', {}, 'Zo staat het in elke bron'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Bron'), el('th', { scope: 'col' }, 'Titel'), el('th', { scope: 'col' }, 'Auteur'), el('td', {}))),
        el('tbody', {}, versie('Nu op de website', x.nu, true),
          // De stocklijst enkel als ze iets anders zegt dan nu: meestal is ze gelijk (de Catalogus kwam eruit).
          x.stock && (typeof x.stock.ta === 'boolean' ? !x.stock.ta && !x.stock.aa : zelfdeTitel(x.stock.t, x.nu.t) && zelfdeAuteur(x.stock.a, x.nu.a)) ? null : versie('Stocklijst', x.stock),
          versie('Oude website', x.oud)))),
      el('p', { class: 'hulptekst' }, 'Hoofdletters, leestekens en de volgorde van de namen tellen niet als verschil.'),
      el('p', {}, 'Vergelijk met het boek. Klopt wat in de velden staat? Klik dan op Klopt, volgende. Staat het anders op het boek? Klik bij de juiste versie op Neem titel over of Neem auteur over, of typ het zelf, en klik op Bewaar, volgende.'),
      el('div', { class: 'veld' }, el('label', { for: 'tc-titel' }, 'Titel zoals op het boek'), titel),
      el('div', { class: 'veld' }, el('label', { for: 'tc-auteur' }, 'Auteur zoals op het boek'), auteur),
      knoppen(bewaar, niet),
      knoppen(vorige, sla));
  }

  /** De uitleg bij een boek dat je in dit bezoek al nakeek. */
  function alTekst(al) {
    return (al.bezig ? 'Wordt bewaard: ' : 'Al nagekeken in dit bezoek: ') +
      (al.status === 'niet in de kast' ? 'niet in de kast.' : al.status === 'aangepast' ? 'bewaard zoals in de velden.' : 'klopt.') +
      ' Klopt het niet? Pas het aan en bewaar opnieuw.';
  }

  function focusTitel() { var t = document.getElementById('tc-titel'); if (t) t.focus(); }

  /** Bewaart een voor een, in de volgorde waarin je klikte. doe(r) krijgt het antwoord. */
  function bewaarOpAchtergrond(invoer, doe) {
    wachtrij.push(function () {
      return B.voerUit('titelcontroleBewaren', invoer).then(null, function () { return { ok: false, fout: 'geen verbinding' }; }).then(function (r) {
        bezigMet--;
        doe(r || { ok: false });
      });
    });
    if (wachtrij.length === 1) volgende();
    function volgende() {
      if (!wachtrij.length) return;
      wachtrij[0]().then(function () { wachtrij.shift(); volgende(); });
    }
  }

  /** De cover van het boek, zodat je het sneller vindt in de kast. Zonder cover: een grijs vlak. */
  function coverVak(ctx, x) {
    var vak = el('span', { class: 'tc-cover' });
    var b = info(ctx, x.id).boek;
    if (!b || !b.c || !W || !W.coverLink) { vak.appendChild(el('span', { class: 'hulptekst' }, 'Geen cover')); return vak; }
    W.coverLink(x.id).then(function (link) {
      if (!link) { vak.appendChild(el('span', { class: 'hulptekst' }, 'Geen cover')); return; }
      var beeld = el('img', { src: link, alt: 'Cover van ' + x.nu.t });
      beeld.addEventListener('error', function () { beeld.remove(); vak.appendChild(el('span', { class: 'hulptekst' }, 'Cover laadt niet')); });
      vak.appendChild(beeld);
    });
    return vak;
  }

  /** De cover van het volgende boek alvast laden: dan staat ze er meteen. */
  function laadCoverVooraf(ctx, id) {
    var b = info(ctx, id).boek;
    if (b && b.c && W && W.coverLink) W.coverLink(id).then(function (link) { if (link) { var i = new Image(); i.src = link; } });
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
            delete nagekeken[x.id];
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

  root.MadrigalTitelcontrole = { toon: toon, auteurInVorm: auteurInVorm };
})(window);
