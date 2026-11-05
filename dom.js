/**
 * dom.js
 * Kleine hulpfuncties om stukjes pagina te bouwen. We gebruiken altijd
 * textContent, nooit innerHTML met gegevens: zo kan er geen code binnensluipen
 * via een titel of naam.
 */
(function (root) {
  'use strict';

  /**
   * Maakt een element.
   *   el('p', { class: 'meta' }, 'tekst', ander element, ...)
   * Eigenschappen die met "on" beginnen, worden een gebeurtenis (onclick).
   */
  function el(tag, eigenschappen) {
    var e = document.createElement(tag);
    var props = eigenschappen || {};
    Object.keys(props).forEach(function (k) {
      var w = props[k];
      if (w === null || w === undefined || w === false) return;
      if (k.indexOf('on') === 0 && typeof w === 'function') e.addEventListener(k.slice(2), w);
      else if (k === 'class') e.className = w;
      else if (k === 'text') e.textContent = w;
      else if (w === true) e.setAttribute(k, '');
      else e.setAttribute(k, w);
    });
    for (var i = 2; i < arguments.length; i++) voegToe(e, arguments[i]);
    return e;
  }

  function voegToe(ouder, kind) {
    if (kind === null || kind === undefined || kind === false) return;
    if (Array.isArray(kind)) { kind.forEach(function (k) { voegToe(ouder, k); }); return; }
    ouder.appendChild(typeof kind === 'string' || typeof kind === 'number' ? document.createTextNode(String(kind)) : kind);
  }

  /** Maakt een element leeg en vult het met nieuwe inhoud. */
  function vervang(ouder) {
    while (ouder.firstChild) ouder.removeChild(ouder.firstChild);
    for (var i = 1; i < arguments.length; i++) voegToe(ouder, arguments[i]);
  }

  /** Een statuslabel: kleur én tekst (en een teken via CSS), nooit enkel kleur. */
  function statusLabel(code, tekst) {
    return el('span', { class: 'label status-' + code }, tekst);
  }

  /** "2026-11-20" naar "20/11/2026". */
  function korteDatum(datum) {
    if (!datum) return '';
    var d = String(datum).split('-');
    return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
  }

  /** Bedrag in euro: 5 of 2,50. */
  function euro(n) {
    var b = Number(n || 0);
    return '€ ' + (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ','));
  }

  /**
   * Een tijdelijke cover voor een boek zonder foto: titel en auteur op een
   * gekleurd vlak, zoals een eenvoudige boekomslag. De kleur hangt vast aan het
   * boek (via de id), zodat hetzelfde boek altijd dezelfde kleur heeft.
   * Zines krijgen altijd geel. De kleuren staan in styles.css (.ph-kleur-0 tot 6).
   */
  var PH_KLEUREN = 7;
  function plaatshouder(b) {
    var id = String(b.id || b.t || '');
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
    // "Verbeek, Mira" wordt "Mira Verbeek".
    var auteur = String(b.a || '');
    var delen = auteur.split(',');
    if (delen.length === 2 && delen[1].trim()) auteur = delen[1].trim() + ' ' + delen[0].trim();
    var zine = b.s === 'zine';
    return el('div', { class: 'plaatshouder ' + (zine ? 'zine' : 'ph-kleur-' + (h % PH_KLEUREN)), 'aria-hidden': 'true' },
      el('div', { class: 'ph-vlak' },
        el('span', { class: 'ph-titel' }, b.t || ''),
        auteur ? el('span', { class: 'ph-auteur' }, auteur) : null,
        el('span', { class: 'ph-merk' }, zine ? 'zine' : 'Madrigal')));
  }

  /**
   * Een foto als cover: bijgesneden tot 2 op 3 (zoals de covers op de website), 600 bij 900 pixels.
   * Is de foto breder of hoger, dan kies je met een schuifbalk welk stuk je houdt.
   * Geeft { vak, dataUrl } terug: vak is het voorbeeld met de schuifbalk, dataUrl() de JPG (base64-link).
   * id: een uniek voorvoegsel voor de schuifbalk (voor het label).
   */
  var COVER_B = 600, COVER_H = 900;
  function coverBijsnijder(beeld, id) {
    var doek = document.createElement('canvas');
    doek.width = COVER_B; doek.height = COVER_H;
    var breed = beeld.width / beeld.height > COVER_B / COVER_H;
    var schuif = el('input', { type: 'range', id: id + '-schuif', min: '0', max: '100', value: '50' });
    var voorbeeld = el('img', { alt: 'Voorbeeld van de cover', class: 'cover-voorbeeld' });
    function teken() {
      var p = Number(schuif.value) / 100;
      var bw = breed ? beeld.height * COVER_B / COVER_H : beeld.width;
      var bh = breed ? beeld.height : beeld.width * COVER_H / COVER_B;
      var x = breed ? (beeld.width - bw) * p : 0, y = breed ? 0 : (beeld.height - bh) * p;
      var c = doek.getContext('2d');
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, COVER_B, COVER_H);
      c.drawImage(beeld, x, y, bw, bh, 0, 0, COVER_B, COVER_H);
      voorbeeld.src = doek.toDataURL('image/jpeg', 0.85);
    }
    schuif.addEventListener('input', teken);
    teken();
    var past = Math.abs(beeld.width / beeld.height - COVER_B / COVER_H) < 0.02;
    var vak = el('div', { class: 'cover-bijsnijder' }, voorbeeld,
      past ? null : el('div', { class: 'veld' }, el('label', { for: id + '-schuif' }, breed ? 'Schuif naar links of rechts' : 'Schuif naar boven of onder'), schuif));
    return { vak: vak, dataUrl: function () { return voorbeeld.src; } };
  }

  /** Leest een foto (bestand of blob) en geeft een belofte met een coverBijsnijder. */
  function coverUitFoto(bestand, id) {
    return new Promise(function (klaar, mislukt) {
      var lezer = new FileReader();
      lezer.onerror = function () { mislukt(new Error('De foto kon niet gelezen worden.')); };
      lezer.onload = function () {
        var beeld = new Image();
        beeld.onerror = function () { mislukt(new Error('Dit bestand is geen foto.')); };
        beeld.onload = function () { klaar(coverBijsnijder(beeld, id)); };
        beeld.src = lezer.result;
      };
      lezer.readAsDataURL(bestand);
    });
  }

  /**
   * Een veld met een lijst namen. vinkjes: elke keuze een vinkje (de thema's). Anders: de namen als labels met
   * een kruisje, en een veld om er een toe te voegen (met de bestaande namen als suggestie).
   * In de spreadsheet blijft het één cel met komma's: invoer.value is die tekst.
   * o: { id, label, hulp, waarde, keuzes, vinkjes }. Geeft { blok, invoer, lees }.
   */
  function lijstVeld(o) {
    var id = o.id, keuzes = o.keuzes || [], vinkjes = !!o.vinkjes, label = o.label;
    var invoer = el('input', { type: 'hidden', id: id, value: String(o.waarde || '') });
    var hulpId = o.hulp ? id + '-hulp' : null;
    var hulp = hulpId ? el('p', { class: 'hulptekst', id: hulpId }, o.hulp) : null;
    var namen = function () { return String(invoer.value || '').split(',').map(function (n) { return n.trim(); }).filter(Boolean); };
    var zet = function (lijst) { invoer.value = lijst.join(', '); teken(); };
    var vak = el('div', {});
    var blok;
    function teken() {
      var nu = namen();
      if (vinkjes) {
        var gekend = keuzes.map(function (k) { return k.toLowerCase(); });
        var extra = nu.filter(function (n) { return gekend.indexOf(n.toLowerCase()) === -1; });
        vervang(vak, el('ul', { class: 'vinklijst kolommen' }, keuzes.concat(extra).map(function (k, i) {
          var vid = id + '-' + i;
          var vakje = el('input', { type: 'checkbox', id: vid, checked: nu.some(function (n) { return n.toLowerCase() === k.toLowerCase(); }) });
          vakje.addEventListener('change', function () {
            var rest = namen().filter(function (n) { return n.toLowerCase() !== k.toLowerCase(); });
            zet(vakje.checked ? rest.concat(k) : rest);
            var terug = document.getElementById(vid); if (terug) terug.focus();
          });
          return el('li', {}, el('label', { class: 'vinkje', for: vid }, vakje, ' ' + k));
        })));
        return;
      }
      var lijstId = id + '-keuzes';
      var nieuw = el('input', { type: 'text', id: id + '-nieuw', list: lijstId, autocomplete: 'off', placeholder: 'Of typ een nieuwe naam' });
      if (hulpId) nieuw.setAttribute('aria-describedby', hulpId);
      var voegToe = function () {
        var n = nieuw.value.trim();
        if (!n) return;
        if (!namen().some(function (x) { return x.toLowerCase() === n.toLowerCase(); })) zet(namen().concat(n)); else nieuw.value = '';
        var terug = document.getElementById(id + '-nieuw'); if (terug) terug.focus();
      };
      nieuw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); voegToe(); } });
      // Een selectielijst met alle bestaande namen: kies er een, en hij komt erbij.
      var nog = keuzes.filter(function (k) { return !nu.some(function (n) { return n.toLowerCase() === k.toLowerCase(); }); });
      var kies = nog.length ? el('select', { id: id + '-kies', 'aria-label': 'Kies uit de lijst: ' + label }, [el('option', { value: '' }, 'Kies uit de lijst...')].concat(nog.map(function (k) {
        return el('option', { value: k }, k);
      }))) : null;
      if (kies) kies.addEventListener('change', function () {
        if (!kies.value) return;
        zet(namen().concat(kies.value));
        var terug = document.getElementById(id + '-kies'); if (terug) terug.focus();
      });
      vervang(vak,
        nu.length ? el('ul', { class: 'labels lijstveld-labels', 'aria-label': label }, nu.map(function (n) {
          return el('li', {}, el('span', { class: 'label lijstveld-label' }, n,
            el('button', { type: 'button', class: 'lijstveld-weg', 'aria-label': 'Haal ' + n + ' weg', onclick: function () {
              zet(namen().filter(function (x) { return x !== n; }));
              var terug = document.getElementById(id + '-nieuw'); if (terug) terug.focus();
            } }, '×')));
        })) : el('p', { class: 'hulptekst' }, 'Nog niets.'),
        kies ? el('div', { class: 'lijstveld-toevoegen' }, kies) : null,
        el('div', { class: 'lijstveld-toevoegen' }, nieuw,
          el('datalist', { id: lijstId }, keuzes.filter(function (k) { return nu.indexOf(k) === -1; }).map(function (k) { return el('option', { value: k }); })),
          el('button', { type: 'button', class: 'knop tweede klein', onclick: voegToe }, 'Voeg toe')));
    }
    invoer.addEventListener('input', teken);
    teken();
    blok = vinkjes
      ? el('fieldset', { class: 'veld lijstveld' }, el('legend', {}, label), hulp, vak, invoer)
      : el('div', { class: 'veld lijstveld' }, el('label', { for: id + '-nieuw' }, label), hulp, vak, invoer);
    return { blok: blok, invoer: invoer, lees: function () { return invoer.value; } };
  }

  root.MadrigalDom = { el: el, vervang: vervang, statusLabel: statusLabel, korteDatum: korteDatum, euro: euro, plaatshouder: plaatshouder, coverUitFoto: coverUitFoto, lijstVeld: lijstVeld };
})(window);
