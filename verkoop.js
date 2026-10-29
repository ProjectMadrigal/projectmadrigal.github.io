/**
 * verkoop.js
 * Het verkoopscherm voor standjes (verkoop.html). Zie apps-script/Verkoop.js.
 *
 *   - Standjes: naam, thema, datum, plaats. Hetzelfde boek mag op meerdere standjes.
 *   - Klaarzetten: kies boeken die te koop zijn (kolom te_koop_aantal in de Catalogus) en hoeveel mee gaan.
 *   - Verkopen: per boek de prijs, onderhandelbaar of niet, hoeveel mee, verkocht, nog hier en thuis.
 *   - Zonder internet: elke verkoop komt in een wachtrij op dit toestel (localStorage) en gaat door
 *     zodra er weer internet is. Elke verkoop heeft een eigen code, zodat ze nooit dubbel telt.
 *     Open het scherm thuis met internet: dan staan de gegevens en de pagina zelf op de gsm.
 *   - Afsluiten: het standje komt bij de afgesloten standjes, met de omzet.
 *   - Voorraad beheren (enkel met de code van het bestuur): een boek uit de Catalogus kiezen en
 *     het aantal te koop, de prijs en onderhandelbaar invullen. Enkel met internet.
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var $ = function (id) { return document.getElementById(id); };

  var DATA = 'madrigal_verkoop_data';
  var WACHTRIJ = 'madrigal_verkoop_wachtrij';
  var CODE = 'madrigal_code_vrijwilliger';

  var data = null;          // { teKoop, standjes }
  var huidig = null;        // standje_id
  var weergave = 'verkopen'; // 'klaarzetten', 'verkopen' of 'overzicht'
  var bezigMetSturen = false;
  var catalogus = null;     // voor Voorraad beheren: alle boeken, pas geladen als het bestuur het opent
  var opVoorraad = false;   // het bestuur werkt in Voorraad beheren

  function lees(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function bewaar(k, w) { try { if (w) localStorage.setItem(k, w); else localStorage.removeItem(k); } catch (e) { /* vol of geblokkeerd */ } }

  function wachtrij() {
    try { return JSON.parse(lees(WACHTRIJ) || '[]') || []; } catch (e) { return []; }
  }
  function zetWachtrij(lijst) { bewaar(WACHTRIJ, lijst.length ? JSON.stringify(lijst) : ''); }

  function knoppen() { return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments)); }

  function nieuweCode() {
    return 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function prijsTekst(p) { return p === null || p === undefined || p === '' ? 'geen prijs' : D.euro(p); }

  /* ---------- Gegevens en wachtrij ---------- */

  function gebruik(nieuw) {
    data = nieuw;
    bewaar(DATA, JSON.stringify(nieuw));
  }

  function laad() {
    return B.voerUit('verkoopData').then(function (r) {
      if (r.ok) gebruik(r.data);
      else if (!data) B.melding($('melding'), 'fout', r.fout || 'De gegevens konden niet laden.');
      teken();
    });
  }

  /** Stuurt de wachtrij door. Wat de web-app bewaarde, gaat uit de wachtrij. */
  function stuurDoor() {
    var lijst = wachtrij();
    if (!lijst.length || bezigMetSturen || !navigator.onLine) { toonVerbinding(); return Promise.resolve(); }
    bezigMetSturen = true;
    return B.voerUit('verkopenDoorsturen', { verkopen: lijst }).then(function (r) {
      bezigMetSturen = false;
      if (r.ok) {
        var bewaard = {};
        (r.bewaard || []).forEach(function (id) { bewaard[id] = true; });
        zetWachtrij(wachtrij().filter(function (v) { return !bewaard[v.verkoop_id]; }));
        if (r.data) gebruik(r.data);
        if (r.fouten && r.fouten.length) B.melding($('melding'), 'let-op', r.fouten.join(' '));
      }
      teken();
    });
  }

  function toonVerbinding() {
    var n = wachtrij().length;
    var online = navigator.onLine;
    D.vervang($('verbinding'), (!online || n) ? el('div', { class: 'melding ' + (online ? 'info' : 'let-op') },
      el('p', {}, online ? 'Er is internet.' : 'Geen internet. Je kan gewoon verder verkopen: dit toestel onthoudt alles.'),
      n ? el('p', {}, n === 1 ? '1 verkoop wacht om doorgestuurd te worden.' : n + ' verkopen wachten om doorgestuurd te worden.') : null,
      n && online ? knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { stuurDoor(); } }, 'Nu doorsturen')) : null) : null);
  }

  /** Verkopen in de wachtrij voor dit standje en dit boek (nog niet bij de web-app). */
  function inWachtrij(standjeId, boekId) {
    return wachtrij().filter(function (v) { return v.standje_id === standjeId && (!boekId || v.boek_id === boekId); });
  }

  function standjeVan(id) {
    return ((data && data.standjes) || []).filter(function (s) { return s.standje_id === id; })[0] || null;
  }

  /* ---------- Tekenen ---------- */

  function teken() {
    toonVerbinding();
    $('verkoop-info').textContent = 'Aangemeld als ' + B.sessie.wie + (navigator.onLine ? '' : ' · zonder internet');
    if (!data) { D.vervang($('werkvlak'), el('p', {}, 'Gegevens laden...')); return; }
    if (opVoorraad) { toonVoorraad(); return; }
    var s = huidig ? standjeVan(huidig) : null;
    if (s) toonStandje(s); else toonLijst();
  }

  function toonLijst() {
    huidig = null;
    var open = data.standjes.filter(function (s) { return s.status !== 'afgesloten'; });
    var dicht = data.standjes.filter(function (s) { return s.status === 'afgesloten'; });
    function kaart(s) {
      return el('li', { class: 'kaart' },
        el('h3', {}, s.naam),
        el('p', { class: 'hulptekst' }, [D.korteDatum(s.datum), s.thema, s.locatie, s.status].filter(Boolean).join(' · ')),
        el('p', {}, s.boeken.length + (s.boeken.length === 1 ? ' boek' : ' boeken') + ' klaargezet, omzet ' + D.euro(s.omzet.totaal) + '.'),
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { huidig = s.standje_id; weergave = s.status === 'voorbereiding' ? 'klaarzetten' : 'verkopen'; teken(); } }, 'Open')));
    }
    D.vervang($('werkvlak'),
      el('h2', { tabindex: '-1' }, 'Standjes'),
      el('p', {}, 'Kies een standje, of maak een nieuw. Zet de boeken klaar voor je vertrekt, en verkoop op het standje zelf.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: toonNieuwStandje }, '+ Nieuw standje'),
        B.sessie.rol === 'bestuur' ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { opVoorraad = true; teken(); } }, 'Voorraad beheren') : null),
      B.sessie.rol === 'bestuur' ? null : el('p', { class: 'hulptekst' }, 'Boeken aan de voorraad toevoegen kan enkel met de code van het bestuur.'),
      open.length ? el('ul', { class: 'kaartlijst' }, open.map(kaart)) : el('p', {}, 'Er is nog geen standje gepland.'),
      dicht.length ? [el('h3', { style: 'margin-top:1.5rem' }, 'Afgesloten'), el('ul', { class: 'kaartlijst' }, dicht.map(kaart))] : null);
  }

  function toonNieuwStandje(bestaand) {
    var s = bestaand && bestaand.standje_id ? bestaand : {};
    var fout = el('div', { 'aria-live': 'assertive' });
    var veld = function (id, label, type, waarde, extra) {
      return el('div', { class: 'veld' }, el('label', { for: id }, label, extra ? el('span', { class: 'hulptekst' }, ' ' + extra) : null),
        el('input', { type: type || 'text', id: id, value: waarde || '', autocomplete: 'off', maxlength: '120' }));
    };
    var formulier = el('form', { novalidate: true },
      veld('st-naam', 'Naam', 'text', s.naam, '(bv. Pride Antwerpen 2027)'),
      veld('st-thema', 'Thema', 'text', s.thema, '(bv. Pride, mag leeg)'),
      veld('st-datum', 'Datum', 'date', s.datum),
      veld('st-locatie', 'Plaats', 'text', s.locatie, '(mag leeg)'),
      fout,
      knoppen(el('button', { type: 'submit', class: 'knop' }, 'Bewaar'),
        el('button', { type: 'button', class: 'knop tweede', onclick: teken }, 'Annuleer')));
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!navigator.onLine) { B.melding(fout, 'fout', 'Een standje maken of aanpassen kan enkel met internet.'); return; }
      B.voerUit('standjeBewaren', { standje_id: s.standje_id || '', naam: $('st-naam').value, thema: $('st-thema').value, datum: $('st-datum').value, locatie: $('st-locatie').value }).then(function (r) {
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        gebruik(r.data);
        huidig = r.standje_id;
        weergave = 'klaarzetten';
        B.melding($('melding'), 'ok', r.tekst);
        teken();
      });
    });
    D.vervang($('werkvlak'), el('h2', { tabindex: '-1' }, s.standje_id ? 'Standje aanpassen' : 'Nieuw standje'), formulier);
    $('st-naam').focus();
  }

  function toonStandje(s) {
    var tabs = [['klaarzetten', 'Klaarzetten'], ['verkopen', 'Verkopen'], ['overzicht', 'Overzicht']];
    var keuze = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Onderdeel' }, tabs.map(function (t) {
      return el('button', { type: 'button', class: 'knop' + (t[0] === weergave ? '' : ' tweede'), 'aria-pressed': t[0] === weergave ? 'true' : 'false',
        onclick: function () { weergave = t[0]; teken(); } }, t[1]);
    }));
    var inhoud = weergave === 'klaarzetten' ? klaarzetten(s) : weergave === 'overzicht' ? overzicht(s) : verkopen(s);
    D.vervang($('werkvlak'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { huidig = null; teken(); } }, '← Alle standjes')),
      el('h2', { tabindex: '-1' }, s.naam),
      el('p', { class: 'hulptekst' }, [D.korteDatum(s.datum), s.thema, s.locatie, s.status].filter(Boolean).join(' · ')),
      keuze, inhoud);
  }

  /* ---------- Klaarzetten ---------- */

  function klaarzetten(s) {
    if (s.status === 'afgesloten') return el('p', {}, 'Dit standje is afgesloten.');
    var zoek = el('input', { type: 'search', id: 'kz-zoek', autocomplete: 'off', placeholder: 'Titel of auteur' });
    var lijst = el('div', { 'aria-live': 'polite' });
    var mee = {};
    s.boeken.forEach(function (b) { mee[b.boek_id] = b; });
    function rij(b) {
      var gekozen = mee[b.id];
      var idMee = 'kz-mee-' + b.id, idPrijs = 'kz-prijs-' + b.id;
      var fout = el('div', { 'aria-live': 'assertive' });
      var aantal = el('input', { type: 'number', id: idMee, min: '0', max: String(b.stock), step: '1', value: gekozen ? String(gekozen.mee) : '0', class: 'kort', inputmode: 'numeric' });
      var prijs = el('input', { type: 'text', id: idPrijs, inputmode: 'decimal', value: gekozen && gekozen.prijs !== b.prijs && gekozen.prijs !== null ? String(gekozen.prijs).replace('.', ',') : '', placeholder: b.prijs === null ? '' : String(b.prijs).replace('.', ','), class: 'kort' });
      var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Bewaar');
      knop.addEventListener('click', function () {
        if (!navigator.onLine) { B.melding(fout, 'fout', 'Klaarzetten kan enkel met internet.'); return; }
        knop.disabled = true;
        B.voerUit('standjeBoekZetten', { standje_id: s.standje_id, boek_id: b.id, mee: aantal.value, prijs: prijs.value }).then(function (r) {
          knop.disabled = false;
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          gebruik(r.data);
          B.melding(fout, 'ok', r.tekst);
        });
      });
      return el('li', { class: 'kaart' },
        el('p', {}, el('strong', {}, b.t), b.a ? ' (' + b.a + ')' : ''),
        el('p', { class: 'hulptekst' }, prijsTekst(b.prijs) + (b.o ? ', onderhandelbaar' : '') + ' · ' + b.stock + ' te koop in de stock'),
        el('div', { class: 'knoppen' },
          el('label', { for: idMee }, 'Mee '), aantal,
          el('label', { for: idPrijs }, 'Andere prijs voor dit standje '), prijs, knop),
        fout);
    }
    function tekenLijst() {
      var q = Z().normaliseer(zoek.value);
      var boeken = data.teKoop.filter(function (b) {
        return mee[b.id] || (q && Z().normaliseer(b.t + ' ' + b.a).indexOf(q) > -1);
      }).slice(0, 40);
      D.vervang(lijst, boeken.length ? el('ul', { class: 'kaartlijst' }, boeken.map(rij))
        : el('p', {}, q ? 'Geen boek te koop gevonden. Staat er een getal in de kolom te_koop_aantal van de Catalogus?' : 'Zoek een boek om het mee te nemen.'));
    }
    zoek.addEventListener('input', tekenLijst);
    tekenLijst();
    return el('div', {},
      el('p', {}, 'Zoek de boeken die mee gaan en vul in hoeveel. Bovenaan staat wat al klaargezet is. Laat de prijs leeg om de gewone prijs uit de Catalogus te gebruiken.'),
      el('div', { class: 'veld' }, el('label', { for: 'kz-zoek' }, 'Zoek een boek dat te koop is'), zoek),
      lijst,
      s.status === 'voorbereiding' ? knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { zetStatus(s, 'bezig'); } }, 'Klaar: begin de verkoop')) : null);
  }

  function Z() { return root.MadrigalZoeken; }

  /* ---------- Voorraad beheren (enkel het bestuur) ---------- */

  function toonVoorraad() {
    var terug = knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { opVoorraad = false; teken(); } }, '← Alle standjes'));
    if (!catalogus) {
      D.vervang($('werkvlak'), terug, el('h2', { tabindex: '-1' }, 'Voorraad beheren'), el('p', {}, 'De catalogus laden...'));
      if (!navigator.onLine) { D.vervang($('werkvlak'), terug, el('h2', {}, 'Voorraad beheren'), el('p', {}, 'Dit kan enkel met internet.')); return; }
      B.voerUit('voorraadCatalogus').then(function (r) {
        if (!r.ok) { D.vervang($('werkvlak'), terug, el('h2', {}, 'Voorraad beheren'), el('p', { class: 'melding fout' }, r.fout || 'De catalogus kon niet laden.')); return; }
        catalogus = r.boeken;
        if (opVoorraad) toonVoorraad();
      });
      return;
    }
    var zoek = el('input', { type: 'search', id: 'vr-zoek', autocomplete: 'off', placeholder: 'Titel, auteur of ISBN' });
    var lijst = el('div', { 'aria-live': 'polite' });
    function rij(b) {
      var idAantal = 'vr-aantal-' + b.id, idPrijs = 'vr-prijs-' + b.id, idO = 'vr-o-' + b.id;
      var fout = el('div', { 'aria-live': 'assertive' });
      var aantal = el('input', { type: 'number', id: idAantal, min: '0', step: '1', value: String(b.stock), class: 'kort', inputmode: 'numeric' });
      var prijs = el('input', { type: 'text', id: idPrijs, inputmode: 'decimal', value: b.prijs === null ? '' : String(b.prijs).replace('.', ','), class: 'kort' });
      var o = el('input', { type: 'checkbox', id: idO });
      o.checked = b.o;
      var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Bewaar');
      knop.addEventListener('click', function () {
        if (!navigator.onLine) { B.melding(fout, 'fout', 'Dit kan enkel met internet.'); return; }
        knop.disabled = true;
        B.voerUit('voorraadZetten', { boek_id: b.id, te_koop_aantal: aantal.value, prijs: prijs.value, onderhandelbaar: o.checked }).then(function (r) {
          knop.disabled = false;
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          b.stock = Number(aantal.value); b.prijs = prijs.value ? Number(String(prijs.value).replace(',', '.')) : null; b.o = o.checked;
          if (r.data) gebruik(r.data);
          B.melding(fout, 'ok', r.tekst);
        });
      });
      return el('li', { class: 'kaart' },
        el('p', {}, el('strong', {}, b.t), b.a ? ' (' + b.a + ')' : ''),
        el('div', { class: 'knoppen' },
          el('label', { for: idAantal }, 'Aantal te koop '), aantal,
          el('label', { for: idPrijs }, 'Prijs in euro '), prijs,
          el('label', { for: idO }, o, ' Onderhandelbaar'), knop),
        fout);
    }
    function tekenLijst() {
      var q = Z().normaliseer(zoek.value);
      var boeken = catalogus.filter(function (b) {
        return q ? Z().normaliseer(b.t + ' ' + b.a + ' ' + b.i).indexOf(q) > -1 : b.stock > 0;
      }).slice(0, 30);
      D.vervang(lijst, boeken.length ? el('ul', { class: 'kaartlijst' }, boeken.map(rij))
        : el('p', {}, q ? 'Geen boek gevonden in de Catalogus.' : 'Er is nog niets te koop. Zoek een boek om het toe te voegen.'));
    }
    zoek.addEventListener('input', tekenLijst);
    tekenLijst();
    D.vervang($('werkvlak'), terug,
      el('h2', { tabindex: '-1' }, 'Voorraad beheren'),
      el('p', {}, 'Zoek een boek uit de Catalogus en vul in hoeveel exemplaren te koop zijn en aan welke prijs. Zet het aantal op 0 om een boek uit de verkoop te halen. Zonder zoekterm zie je wat nu te koop is.'),
      el('div', { class: 'veld' }, el('label', { for: 'vr-zoek' }, 'Zoek een boek'), zoek),
      lijst);
  }

  /* ---------- Verkopen ---------- */

  function verkopen(s) {
    if (!s.boeken.length) return el('p', {}, 'Er staan nog geen boeken klaar. Ga naar Klaarzetten.');
    var wijzen = (data.betaalwijzen && data.betaalwijzen.length) ? data.betaalwijzen : ['cash', 'QR'];
    return el('ul', { class: 'kaartlijst' }, s.boeken.map(function (b) {
      var lokaal = inWachtrij(s.standje_id, b.boek_id).reduce(function (som, v) { return som + v.aantal; }, 0);
      var verkocht = b.verkocht + lokaal;
      var hier = Math.max(0, b.mee - verkocht);
      var thuis = Math.max(0, b.stock - lokaal - hier);
      var vak = el('div');
      function formulier() {
        var idPrijs = 'vk-prijs-' + b.boek_id;
        var prijs = el('input', { type: 'text', id: idPrijs, inputmode: 'decimal', value: b.prijs === null ? '' : String(b.prijs).replace('.', ','), class: 'kort', readonly: !b.o && b.prijs !== null });
        var naam = 'vk-wijze-' + b.boek_id;
        var keuzes = el('fieldset', { class: 'keuzes' }, el('legend', {}, 'Betaald met'), wijzen.map(function (w, i) {
          var id = naam + '-' + i;
          return el('label', { class: 'vinkje', for: id }, el('input', { type: 'radio', name: naam, id: id, value: w, checked: i === 0 }), w);
        }));
        var fout = el('div', { 'aria-live': 'assertive' });
        var bevestig = el('button', { type: 'button', class: 'knop' }, 'Bevestig de verkoop');
        bevestig.addEventListener('click', function () {
          var p = Number(String(prijs.value).replace(',', '.'));
          if (!isFinite(p) || p < 0 || String(prijs.value).trim() === '') { B.melding(fout, 'fout', 'Vul de prijs in, bv. 8 of 12,50.'); return; }
          var gekozen = vak.querySelector('input[name="' + naam + '"]:checked');
          var lijst = wachtrij();
          lijst.push({ verkoop_id: nieuweCode(), standje_id: s.standje_id, boek_id: b.boek_id, aantal: 1, prijs: p,
            betaalwijze: gekozen ? gekozen.value : '', tijdstip: new Date().toISOString().slice(0, 16) });
          zetWachtrij(lijst);
          B.melding($('melding'), 'ok', '"' + b.t + '" verkocht voor ' + D.euro(p) + '.');
          teken();
          stuurDoor();
        });
        D.vervang(vak, el('div', { class: 'stap' },
          el('div', { class: 'veld' }, el('label', { for: idPrijs }, 'Prijs ', el('span', { class: 'hulptekst' }, b.o ? '(onderhandelbaar: pas aan als je minder vraagt)' : '(vaste prijs)')), prijs),
          keuzes, fout, knoppen(bevestig, el('button', { type: 'button', class: 'knop tweede', onclick: function () { D.vervang(vak); } }, 'Annuleer'))));
        prijs.focus();
      }
      return el('li', { class: 'kaart' + (hier ? '' : ' telaat') },
        el('p', {}, el('strong', {}, b.t), b.a ? ' (' + b.a + ')' : ''),
        el('p', {}, el('strong', {}, prijsTekst(b.prijs)), b.o ? ' · onderhandelbaar' : ' · vaste prijs'),
        el('p', { class: 'hulptekst' }, 'Mee: ' + b.mee + ' · verkocht: ' + verkocht + ' · nog hier: ' + hier + ' · thuis: ' + thuis),
        hier && s.status !== 'afgesloten' ? knoppen(el('button', { type: 'button', class: 'knop', onclick: formulier }, 'Verkocht')) : el('p', {}, hier ? '' : 'Alles van dit boek is verkocht.'),
        vak);
    }));
  }

  /* ---------- Overzicht en afsluiten ---------- */

  function overzicht(s) {
    var lokaal = inWachtrij(s.standje_id);
    var perWijze = Object.assign({}, s.omzet.perBetaalwijze);
    var totaal = s.omzet.totaal;
    lokaal.forEach(function (v) { totaal += v.prijs * v.aantal; perWijze[v.betaalwijze || 'onbekend'] = (perWijze[v.betaalwijze || 'onbekend'] || 0) + v.prijs * v.aantal; });
    var verkocht = s.boeken.filter(function (b) { return b.verkocht || inWachtrij(s.standje_id, b.boek_id).length; });
    return el('div', {},
      el('p', { class: 'groot-getal' }, el('strong', {}, D.euro(totaal)), ' omzet'),
      el('ul', {}, Object.keys(perWijze).map(function (w) { return el('li', {}, w + ': ' + D.euro(perWijze[w])); })),
      lokaal.length ? el('p', { class: 'hulptekst' }, lokaal.length + (lokaal.length === 1 ? ' verkoop is' : ' verkopen zijn') + ' nog niet doorgestuurd en tellen hier al mee.') : null,
      el('h3', {}, 'Verkochte boeken'),
      verkocht.length ? el('ul', {}, verkocht.map(function (b) {
        return el('li', {}, b.t + ': ' + (b.verkocht + inWachtrij(s.standje_id, b.boek_id).length) + ' van ' + b.mee);
      })) : el('p', {}, 'Nog niets verkocht.'),
      s.status === 'afgesloten' ? el('p', {}, 'Dit standje is afgesloten.') : knoppen(
        s.status === 'voorbereiding' ? el('button', { type: 'button', class: 'knop', onclick: function () { zetStatus(s, 'bezig'); } }, 'Begin de verkoop') : null,
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonNieuwStandje(s); } }, 'Naam, datum of plaats aanpassen'),
        el('button', { type: 'button', class: 'knop tweede gevaar', onclick: function () {
          if (wachtrij().length) { B.melding($('melding'), 'let-op', 'Er wachten nog verkopen op internet. Stuur ze eerst door, dan sluit je af.'); return; }
          if (!window.confirm('Standje "' + s.naam + '" afsluiten? De omzet blijft bewaard. Daarna kan je niets meer klaarzetten.')) return;
          zetStatus(s, 'afgesloten');
        } }, 'Sluit het standje af')));
  }

  function zetStatus(s, status) {
    if (!navigator.onLine) { B.melding($('melding'), 'fout', 'Dit kan enkel met internet.'); return; }
    B.voerUit('standjeStatus', { standje_id: s.standje_id, status: status }).then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout); return; }
      gebruik(r.data);
      if (status === 'bezig') weergave = 'verkopen';
      B.melding($('melding'), 'ok', r.tekst);
      teken();
    });
  }

  /* ---------- Starten ---------- */

  function start() {
    try { data = JSON.parse(lees(DATA) || 'null'); } catch (e) { data = null; }
    teken();
    laad().then(stuurDoor);
    window.addEventListener('online', function () { stuurDoor(); laad(); });
    window.addEventListener('offline', teken);
    setInterval(function () { if (wachtrij().length) stuurDoor(); }, 60000);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* werkt ook zonder */ });
    }
  }

  $('vernieuw').addEventListener('click', function () { laad().then(stuurDoor); });
  $('afmelden').addEventListener('click', function () {
    if (wachtrij().length && !window.confirm('Er wachten nog verkopen op internet. Ze blijven op dit toestel bewaard. Toch afmelden?')) return;
    B.afmelden();
  });

  // Zonder internet: meteen verder met de bewaarde code en gegevens (aanmelden kan dan niet).
  if (!navigator.onLine && lees(DATA) && lees(CODE) && lees('madrigal_wie')) {
    B.sessie.code = lees(CODE);
    B.sessie.wie = lees('madrigal_wie');
    $('app').hidden = false;
    start();
  } else {
    B.aanmelden({ codeSleutel: CODE, reserveSleutel: ['madrigal_code_bestuur'], vereisteRol: 'vrijwilliger', bijAangemeld: start });
  }

  root.MadrigalVerkoop = { nieuweCode: nieuweCode };
})(window);
