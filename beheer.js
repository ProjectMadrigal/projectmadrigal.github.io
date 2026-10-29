/**
 * beheer.js
 * Gedeeld door het uitleenscherm (balie.html) en het bestuursscherm (bestuur.html):
 *   - aanmelden met een code (de browser onthoudt de code op dit toestel)
 *   - acties versturen, en bij een overschreden grens een reden vragen
 *   - statuslabels voor uitleningen
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var SLEUTEL_WIE = 'madrigal_wie';

  function lees(sleutel) {
    try { return root.localStorage.getItem(sleutel) || ''; } catch (e) { return ''; }
  }
  function schrijf(sleutel, waarde) {
    try {
      if (waarde) root.localStorage.setItem(sleutel, waarde);
      else root.localStorage.removeItem(sleutel);
    } catch (e) { /* geen opslag: dan vraagt het scherm de code elke keer */ }
  }

  // alsRol: het bestuur bekijkt het vrijwilligersscherm met de rechten van een vrijwilliger. echteRol: de rol van de code.
  var sessie = { code: '', wie: '', rol: '', echteRol: '', alsRol: '', codeSleutel: '' };
  /** Zelfde rangorde als ROL_RANG in apps-script/Api.js. */
  var RANG = { balie: 1, vrijwilliger: 2, bestuur: 3 };

  /**
   * Toont het aanmeldformulier, of meldt meteen aan met de bewaarde code.
   * opties: { codeSleutel, reserveSleutel (optioneel, ook een lijst), vereisteRol ('balie', 'vrijwilliger' of 'bestuur'), bijAangemeld(rol) }
   */
  /*
   * Automatisch afmelden na een uur zonder gebruik (bestuurs- en vrijwilligersscherm), tenzij je
   * "Dit is mijn toestel" aanvinkt. Zo blijft er op een gedeelde computer geen code achter.
   */
  var SLEUTEL_MIJN = 'madrigal_mijn_toestel';
  var SLEUTEL_ACTIEF = 'madrigal_laatst_actief';
  var INACTIEF_MS = 60 * 60 * 1000;

  function teLangInactief() {
    var laatst = Number(lees(SLEUTEL_ACTIEF) || 0);
    return lees(SLEUTEL_MIJN) !== 'ja' && laatst > 0 && Date.now() - laatst > INACTIEF_MS;
  }

  function volgActiviteit(codeSleutels) {
    var vorige = 0;
    function actief() {
      if (Date.now() - vorige < 30000) return; // niet bij elke klik schrijven
      vorige = Date.now();
      schrijf(SLEUTEL_ACTIEF, String(vorige));
    }
    actief();
    ['click', 'keydown', 'touchstart', 'scroll'].forEach(function (n) { document.addEventListener(n, actief, { passive: true }); });
    setInterval(function () {
      if (!teLangInactief()) return;
      codeSleutels.forEach(function (s) { schrijf(s, ''); });
      schrijf(SLEUTEL_ACTIEF, '');
      try {
        sessionStorage.removeItem('madrigal_data_bestuur');
        sessionStorage.removeItem('madrigal_data_vrijwilliger');
        sessionStorage.setItem('madrigal_afgemeld', 'ja');
      } catch (e) { /* geen opslag */ }
      location.reload();
    }, 60000);
  }

  /** Het vinkje "Dit is mijn toestel" (op het aanmeldscherm en bovenaan het scherm). */
  function koppelMijnToestel() {
    Array.prototype.forEach.call(document.querySelectorAll('.mijn-toestel'), function (vak) {
      vak.checked = lees(SLEUTEL_MIJN) === 'ja';
      vak.addEventListener('change', function () {
        schrijf(SLEUTEL_MIJN, vak.checked ? 'ja' : '');
        Array.prototype.forEach.call(document.querySelectorAll('.mijn-toestel'), function (ander) { ander.checked = vak.checked; });
      });
    });
  }

  function aanmelden(opties) {
    sessie.codeSleutel = opties.codeSleutel;
    sessie.alsRol = opties.alsRol || '';
    var codeSleutels = [opties.codeSleutel].concat(opties.reserveSleutel || []);
    if (opties.afmeldenNaInactiviteit) {
      koppelMijnToestel();
      if (teLangInactief()) {
        codeSleutels.forEach(function (s) { schrijf(s, ''); });
        schrijf(SLEUTEL_ACTIEF, '');
        try { sessionStorage.setItem('madrigal_afgemeld', 'ja'); } catch (e) { /* geen opslag */ }
      }
    }
    var formulier = document.getElementById('aanmeldformulier');
    var melding = document.getElementById('aanmeld-melding');
    var codeVeld = document.getElementById('code');
    var wieVeld = document.getElementById('wie');
    wieVeld.value = lees(SLEUTEL_WIE);

    function probeer(code, wie, stil) {
      melding.hidden = true;
      return root.MadrigalApi.verstuur('aanmelden', { code: code, wie: wie, alsRol: sessie.alsRol }).then(function (r) {
        if (r.ok && (RANG[r.rol] || 0) >= (RANG[opties.vereisteRol] || 1)) {
          sessie.code = code; sessie.wie = wie; sessie.rol = r.rol; sessie.echteRol = r.echteRol || r.rol;
          schrijf(opties.codeSleutel, code);
          schrijf(SLEUTEL_WIE, wie);
          document.getElementById('aanmelden').hidden = true;
          document.getElementById('app').hidden = false;
          if (opties.afmeldenNaInactiviteit) volgActiviteit(codeSleutels);
          opties.bijAangemeld(r.rol);
          return;
        }
        schrijf(opties.codeSleutel, '');
        document.getElementById('app').hidden = true;
        document.getElementById('aanmelden').hidden = false;
        if (!stil) {
          melding.textContent = r.ok ? 'Deze code geeft geen toegang tot dit scherm.' : (r.fout || 'Aanmelden lukte niet.');
          melding.hidden = false;
          codeVeld.focus();
        }
      });
    }

    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var code = codeVeld.value.trim();
      var wie = wieVeld.value.trim();
      if (!code || !wie) {
        melding.textContent = 'Vul de code en je voornaam in.';
        melding.hidden = false;
        return;
      }
      var knop = formulier.querySelector('button[type="submit"]');
      knop.disabled = true;
      probeer(code, wie, false).then(function () { knop.disabled = false; codeVeld.value = ''; });
    });

    // Het bestuur mag ook de balie gebruiken: dan volstaat de bewaarde bestuurscode.
    var bewaard = lees(opties.codeSleutel);
    [].concat(opties.reserveSleutel || []).forEach(function (s) { if (!bewaard) bewaard = lees(s); });
    if (bewaard && lees(SLEUTEL_WIE)) {
      // Sneller openen: met een bewaarde code toont het scherm meteen de gegevens en controleert het
      // de code tegelijk. De web-app kijkt de code bij elke vraag toch na. Klopt ze niet, dan verschijnt
      // het aanmeldscherm.
      if (opties.snelStart) {
        sessie.code = bewaard; sessie.wie = lees(SLEUTEL_WIE);
        document.getElementById('app').hidden = false;
        opties.snelStart();
      }
      probeer(bewaard, lees(SLEUTEL_WIE), true);
    } else document.getElementById('aanmelden').hidden = false;
    var afgemeld = false;
    try { afgemeld = sessionStorage.getItem('madrigal_afgemeld') === 'ja'; sessionStorage.removeItem('madrigal_afgemeld'); } catch (e) { /* geen opslag */ }
    if (afgemeld) {
      melding.textContent = 'Je werd afgemeld omdat dit scherm een uur niet gebruikt werd. Werk je op je eigen toestel? Vink dan "Dit is mijn toestel" aan.';
      melding.hidden = false;
    }
  }

  /** Afmelden: vergeet de code op dit toestel. */
  function afmelden() {
    schrijf(sessie.codeSleutel, '');
    try { sessionStorage.removeItem('madrigal_data_bestuur'); sessionStorage.removeItem('madrigal_data_vrijwilliger'); } catch (e) { /* geen opslag */ }
    location.reload();
  }

  /**
   * Haalt de gegevens van een ander scherm alvast op en bewaart ze in dit tabblad (sessionStorage).
   * Zo opent het vrijwilligers- of bestuursscherm meteen als je erheen gaat. Eén keer per tabblad.
   */
  function haalAlvastOp(actie, cacheSleutel) {
    var vlag = 'madrigal_alvast_' + actie;
    try { if (sessionStorage.getItem(cacheSleutel) || sessionStorage.getItem(vlag)) return; sessionStorage.setItem(vlag, 'ja'); } catch (e) { return; }
    voerUit(actie).then(function (r) {
      if (r && r.ok) { try { sessionStorage.setItem(cacheSleutel, JSON.stringify(r.data)); } catch (e) { /* te groot: niet erg */ } }
    });
  }

  /** Wie staat er aan de balie? Wisselen zonder opnieuw de code te typen. */
  function wisselWie(nieuw) {
    sessie.wie = nieuw;
    schrijf(SLEUTEL_WIE, nieuw);
  }

  /**
   * Vraagt een reden voor een uitzondering, met de knoppen Annuleren en Toch doorgaan.
   * Geeft een Promise met de reden, of null bij Annuleren.
   */
  function vraagReden(grenzen) {
    return new Promise(function (klaar) {
      var dialoog = document.getElementById('grens-dialoog');
      var lijst = document.getElementById('grens-meldingen');
      var reden = document.getElementById('grens-reden');
      var fout = document.getElementById('grens-fout');
      D.vervang(lijst, grenzen.map(function (g) { return el('li', {}, g.melding); }));
      reden.value = '';
      fout.hidden = true;

      function sluit(waarde) {
        dialoog.removeEventListener('close', bijSluiten);
        document.getElementById('grens-doorgaan').removeEventListener('click', doorgaan);
        document.getElementById('grens-annuleren').removeEventListener('click', annuleren);
        if (dialoog.open) dialoog.close();
        klaar(waarde);
      }
      function doorgaan() {
        var tekst = reden.value.trim();
        if (tekst.length < 3) {
          fout.hidden = false;
          reden.focus();
          return;
        }
        sluit(tekst);
      }
      function annuleren() { sluit(null); }
      function bijSluiten() { sluit(null); } // Escape-toets

      document.getElementById('grens-doorgaan').addEventListener('click', doorgaan);
      document.getElementById('grens-annuleren').addEventListener('click', annuleren);
      dialoog.addEventListener('close', bijSluiten);
      dialoog.showModal();
      document.getElementById('grens-annuleren').focus();
    });
  }

  /**
   * Verstuurt een actie met de code en de naam van de vrijwilliger.
   * Is er een grens overschreden, dan vraagt dit een reden en probeert opnieuw.
   * Geeft een Promise met het antwoord. Bij Annuleren: { ok: false, geannuleerd: true }.
   * bijVraag: (optioneel) wordt opgeroepen net voor de vraag om een reden verschijnt.
   */
  function voerUit(actie, gegevens, bijVraag, poging) {
    var body = Object.assign({ code: sessie.code, wie: sessie.wie }, sessie.alsRol ? { alsRol: sessie.alsRol } : {}, gegevens || {});
    return root.MadrigalApi.verstuur(actie, body).then(function (r) {
      // "Het is even druk": het script deed nog niets. Twee keer vanzelf opnieuw proberen.
      if (r && !r.ok && /even druk/.test(r.fout || '') && (poging || 0) < 2) {
        return new Promise(function (klaar) { setTimeout(klaar, 4000); }).then(function () {
          return voerUit(actie, gegevens, bijVraag, (poging || 0) + 1);
        });
      }
      if (r && r.code === 'ongeldige_code') {
        afmelden();
        return r;
      }
      if (r && r.grenzen && r.grenzen.length) {
        if (bijVraag) bijVraag();
        return vraagReden(r.grenzen).then(function (reden) {
          if (reden === null) return { ok: false, geannuleerd: true };
          return voerUit(actie, Object.assign({}, gegevens, { uitzondering: { reden: reden } }), bijVraag);
        });
      }
      return r;
    });
  }

  /** Statuslabel(s) en tekst van een lopende uitlening. */
  function uitleenStatus(info) {
    var s = info.status;
    if (!s) return null;
    return el('div', {},
      el('p', { class: 'labels' },
        D.statusLabel(s.code, s.label),
        s.verlengd ? D.statusLabel('verlengd', 'Verlengd') : null),
      el('p', {}, s.tekst),
      s.verlengd ? el('p', { class: 'hulptekst' }, s.verlengdTekst) : null);
  }

  /** Een melding in een container: type 'ok', 'fout', 'info' of 'let-op'. */
  function melding(container, type, tekst) {
    D.vervang(container, el('div', { class: 'melding ' + type, role: type === 'fout' ? 'alert' : 'status' }, tekst));
  }

  /* ---------- Rooster ---------- */

  var DAGNAMEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
  var MAANDNAMEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  var AVONDSTATUS = { gesloten: 'Gesloten', workshop: 'Workshop', ander: 'Andere activiteit' };

  /** "2026-10-30" wordt "vrijdag 30 oktober". */
  function langeDatum(iso) {
    var d = String(iso).split('-').map(Number);
    var dt = new Date(Date.UTC(d[0], d[1] - 1, d[2]));
    return DAGNAMEN[dt.getUTCDay()] + ' ' + d[2] + ' ' + MAANDNAMEN[d[1] - 1];
  }

  /** Een naam, doorgestreept met "afgemeld" als die persoon zich afmeldde. */
  function roosterNaam(naam, afgemeld) {
    if (afgemeld.indexOf(naam) === -1) return el('span', {}, naam);
    return el('span', {}, el('s', {}, naam), ' (afgemeld)');
  }

  /**
   * Toont het rooster in een container: elke avond vanaf vandaag, deze en volgende maand.
   * Laadt het zelf op via de actie roosterOverzicht.
   */
  /** Toont de site een oudere versie van het rooster (zie laatsteRooster in Rooster.js)? Dan deze uitleg. */
  function roosterVerouderd(d) {
    if (!d.verouderd) return '';
    var t = new Date(d.verouderd.tijd);
    var wanneer = d.verouderd.tijd ? t.getDate() + '/' + (t.getMonth() + 1) + ' om ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) : 'eerder';
    return 'Dit is het rooster zoals het ' + wanneer + ' was. ' + d.verouderd.reden + ' Wie zich intussen aan- of afmeldde, staat er misschien nog niet bij.';
  }

  function toonRooster(container) {
    D.vervang(container, el('p', { class: 'laden' }, 'Het rooster laden...'));
    voerUit('roosterOverzicht').then(function (r) {
      if (!r.ok) { melding(container, 'fout', r.fout || 'Het rooster kon niet laden.'); return; }
      var d = r.data;
      var knop = el('p', {}, el('a', { class: 'knop tweede', href: d.link, target: '_blank', rel: 'noopener' }, 'Beschikbaarheid invullen of afmelden'));
      if (!d.gekoppeld) {
        D.vervang(container,
          el('div', { class: 'melding info' }, 'Het rooster is nog niet gekoppeld. Het bestuur vult in de spreadsheet bij Instellingen rooster_url en rooster_code in.'),
          knop);
        return;
      }
      var maandenZonder = d.nietGepubliceerd.map(function (m) { return MAANDNAMEN[Number(m.slice(5, 7)) - 1]; });
      var kaarten = d.avonden.map(function (a, i) {
        var dicht = AVONDSTATUS[a.status];
        var inhoud = [el('h3', {}, (i === 0 && a.datum === d.vandaag ? 'Vandaag, ' : '') + langeDatum(a.datum))];
        if (a.event) inhoud.push(el('p', {}, 'Event: ' + a.event));
        if (dicht) {
          inhoud.push(el('p', { class: 'labels' }, D.statusLabel('gesloten', dicht)));
        } else if (!a.gepubliceerd) {
          inhoud.push(el('p', { class: 'hulptekst' }, 'Nog niet ingepland.'));
        } else {
          var namen = function (lijst) {
            if (!lijst.length) return [el('em', {}, 'niemand')];
            var uit = [];
            lijst.forEach(function (n, j) { if (j) uit.push(', '); uit.push(roosterNaam(n, a.afgemeld)); });
            return uit;
          };
          inhoud.push(el('p', {}, el('strong', {}, 'Bib: '), namen(a.vrijwilligers)));
          inhoud.push(el('p', {}, el('strong', {}, 'Back-up: '), namen(a.backups)));
        }
        return el('li', { class: 'kaart rooster-avond' + (dicht ? ' dicht' : '') }, inhoud);
      });
      D.vervang(container,
        d.verouderd ? el('div', { class: 'melding let-op' }, roosterVerouderd(d)) : null,
        maandenZonder.length ? el('div', { class: 'melding info' }, 'Het rooster van ' + maandenZonder.join(' en ') + ' is nog niet gepubliceerd.') : null,
        kaarten.length ? el('ul', { class: 'kaartlijst' }, kaarten) : el('p', {}, 'Er staan geen avonden meer gepland deze en volgende maand.'),
        knop);
    });
  }

  /**
   * Hoe kwam het boek terug? Voor de balie en het bestuursscherm. Bij schade komt het ook
   * in de notitie van het boek (zie terugbrengen in Uitlenen.js).
   * Geeft { blok, lees } terug. lees() geeft { staat_boek, opmerking }.
   */
  function staatVraag(voorvoegsel) {
    var naam = voorvoegsel + '-staat';
    var opmerking = el('input', { type: 'text', id: voorvoegsel + '-opmerking', maxlength: '200', autocomplete: 'off', placeholder: 'bv. koffievlek op blz. 12' });
    var blok = el('div', {},
      el('fieldset', { class: 'keuzes' }, el('legend', {}, 'Staat van het boek'),
        ['in orde', 'licht beschadigd', 'beschadigd'].map(function (s, i) {
          return el('label', {}, el('input', { type: 'radio', name: naam, value: s, checked: i === 0 }), s.charAt(0).toUpperCase() + s.slice(1));
        })),
      el('div', { class: 'veld' }, el('label', { for: voorvoegsel + '-opmerking' }, 'Opmerking ', el('span', { class: 'hulptekst' }, '(mag leeg)')), opmerking));
    return {
      blok: blok,
      lees: function () {
        var gekozen = blok.querySelector('input[name="' + naam + '"]:checked');
        return { staat_boek: gekozen ? gekozen.value : 'in orde', opmerking: opmerking.value.trim() };
      }
    };
  }

  root.MadrigalBeheer = {
    aanmelden: aanmelden, afmelden: afmelden, wisselWie: wisselWie, voerUit: voerUit, haalAlvastOp: haalAlvastOp,
    uitleenStatus: uitleenStatus, melding: melding, sessie: sessie, toonRooster: toonRooster, staatVraag: staatVraag,
    langeDatum: langeDatum, AVONDSTATUS: AVONDSTATUS, roosterVerouderd: roosterVerouderd
  };
})(window);
