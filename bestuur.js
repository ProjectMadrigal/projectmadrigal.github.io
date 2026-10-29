/**
 * bestuur.js
 * Het bestuursscherm: te laat, vervalt binnenkort, lopende uitleningen,
 * borgen en giften, reservaties, uitzonderingen, leners en cijfers.
 * Daarnaast boeken, nieuws, agenda en instellingen aanpassen (bestuur-beheer.js).
 * Herinneringen verstuur je zelf (WhatsApp, sms of mail). Dit scherm kopieert
 * de tekst en noteert daarna dat de herinnering verstuurd is.
 *
 * Vandaag toont wat aandacht vraagt. Logboek en taken toont de achtergrondtaken en het Logboek.
 * Het onderdeel staat in het adres (#telaat, #boeken, ...), zodat herladen en Terug werken.
 *
 * Hetzelfde script maakt ook het vrijwilligersscherm (vrijwilliger.html, data-scherm="vrijwilliger"):
 * minder onderdelen, geen contactgegevens van leners. Welke onderdelen: zie SECTIES.
 */
(function () {
  'use strict';

  var D = window.MadrigalDom;
  var el = D.el;
  var B = window.MadrigalBeheer;
  var Z = window.MadrigalZoeken;
  var W = window.MadrigalBestuurBeheer;
  var V = window.MadrigalVrijwilligers;
  var $ = function (id) { return document.getElementById(id); };

  var data = null;
  var VRIJWILLIGER = document.body.getAttribute('data-scherm') === 'vrijwilliger';
  var actief = 'vandaag';

  /**
   * De onderdelen: [sleutel, knoptekst, functie, groep, scherm]. De groepen staan in GROEPEN.
   * scherm: 'beide' staat ook in het vrijwilligersscherm, 'vrijwilliger' enkel daar, leeg enkel bij het bestuur.
   */
  var ALLE_SECTIES = [
    ['vandaag', 'Vandaag', toonVandaag, 'start', 'beide'],
    ['meldingen', 'Meldingen', function (vak) { V.meldingen(vak, context()); }, 'start'],
    ['handleiding', 'Handleiding', function (vak) { V.handleiding(vak, context()); }, 'start', 'vrijwilliger'],
    ['shift', 'Checklist voor de shift', function (vak) { V.checklist(vak, context()); }, 'start', 'vrijwilliger'],
    ['melden', 'Iets melden', function (vak) { V.melden(vak, context()); }, 'start', 'vrijwilliger'],
    ['mijn', 'Mijn voorstellen en meldingen', function (vak) { V.mijn(vak, context()); }, 'start', 'vrijwilliger'],
    ['telaat', 'Te laat', toonTeLaat, 'uitlenen', 'beide'],
    ['binnenkort', 'Vervalt binnenkort', toonBinnenkort, 'uitlenen', 'beide'],
    ['lopend', 'Alle uitleningen', toonLopend, 'uitlenen', 'beide'],
    ['reservaties', 'Reservaties', toonReservaties, 'uitlenen', 'beide'],
    ['terugzetten', 'Terug te zetten', function (vak) { V.terugzetten(vak, context()); }, 'uitlenen', 'beide'],
    ['tevervangen', 'Te vervangen', toonTeVervangen, 'uitlenen', 'beide'],
    ['opzoeken', 'Boek opzoeken', function (vak) { V.opzoeken(vak, context()); }, 'uitlenen', 'vrijwilliger'],
    ['aanvragen', 'Aanvragen van de website', toonAanvragen, 'uitlenen'],
    ['leners', 'Leners', toonLeners, 'uitlenen'],
    ['borgen', 'Borgen en giften', toonBorgen, 'uitlenen'],
    ['uitzonderingen', 'Uitzonderingen', toonUitzonderingen, 'uitlenen'],
    // De website aanpassen: zie bestuur-beheer.js.
    ['boeken', 'Boeken', function (vak) { W.boeken(vak, context()); }, 'website'],
    ['covers', 'Boeken zonder cover', function (vak) { W.covers(vak, context()); }, 'website', 'vrijwilliger'],
    ['beschrijvingen', 'Boeken zonder beschrijving', function (vak) { W.zonderBeschrijving(vak, context()); }, 'website', 'vrijwilliger'],
    ['voorstellen', 'Voorgestelde beschrijvingen', function (vak) { V.voorstellen(vak, context()); }, 'website'],
    ['kast', 'Kastcontrole', function (vak) { V.kast(vak, context()); }, 'website', 'beide'],
    ['boekstatus', 'Verloren en gevoelig', toonBoekstatus, 'website'],
    ['inhoud', 'Nieuws en agenda', function (vak) { W.inhoud(vak, context()); }, 'website', 'beide'],
    ['leeslijsten', 'Leeslijsten', function (vak) { W.leeslijsten(vak, context()); }, 'website', 'beide'],
    ['instellingen', 'Teksten en instellingen', function (vak) { W.instellingen(vak, context()); }, 'website'],
    ['cijfers', 'Cijfers', toonCijfers, 'overzicht'],
    ['logboek', 'Logboek en taken', toonLogboek, 'overzicht'],
    ['rooster', 'Rooster', toonRoosterSectie, 'overzicht', 'beide']
  ];
  var SECTIES = ALLE_SECTIES.filter(function (s) {
    return VRIJWILLIGER ? s[4] === 'beide' || s[4] === 'vrijwilliger' : s[4] !== 'vrijwilliger';
  });

  var GROEPEN = [['start', 'Start'], ['uitlenen', 'Uitlenen'], ['website', 'Website'], ['overzicht', 'Overzicht']];

  /* Het onderdeel staat in het adres (bv. bestuur.html#telaat): na herladen blijf je waar je was, en Terug werkt. */
  function sectieUitAdres() {
    var naam = decodeURIComponent(location.hash.slice(1));
    return SECTIES.some(function (s) { return s[0] === naam; }) ? naam : '';
  }
  actief = sectieUitAdres() || actief;
  window.addEventListener('popstate', function () {
    var naam = sectieUitAdres() || 'vandaag';
    if (data && naam !== actief) toonSectie(naam, true, true);
  });

  /** Wat bestuur-beheer.js nodig heeft van dit scherm. */
  function context() {
    return { data: data, kop: kop, laad: laad, scherm: VRIJWILLIGER ? 'vrijwilliger' : 'bestuur', toonSectie: function (naam) { toonSectie(naam, true); } };
  }

  /* ---------- Gegevens en navigatie ---------- */

  /*
   * Sneller openen: de gegevens van het vorige bezoek in dit tabblad (sessionStorage, weg als je het
   * tabblad sluit of afmeldt) verschijnen meteen. Intussen haalt het scherm de verse gegevens op.
   * Begon je al te werken, dan verandert het scherm niet onder je handen: enkel de gegevens en de tellers.
   */
  var CACHE = VRIJWILLIGER ? 'madrigal_data_vrijwilliger' : 'madrigal_data_bestuur';
  var eersteKeer = true, bezigSindsCache = false;
  ['click', 'keydown', 'input'].forEach(function (n) { $('sectie').addEventListener(n, function () { bezigSindsCache = true; }); });

  function toonGegevens(nieuw, volledig) {
    data = nieuw;
    $('bestuur-info').textContent = 'Aangemeld als ' + B.sessie.wie + ' · ' + data.vandaagTekst;
    tekenNav();
    if (volledig) toonSectie(actief, false);
  }

  function laad() {
    var vanCache = false;
    if (eersteKeer) {
      eersteKeer = false;
      var bewaard = null;
      try { bewaard = JSON.parse(sessionStorage.getItem(CACHE) || 'null'); } catch (e) { bewaard = null; }
      if (bewaard) { toonGegevens(bewaard, true); bezigSindsCache = false; vanCache = true; }
    }
    return B.voerUit(VRIJWILLIGER ? 'vrijwilligerData' : 'bestuurData').then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout || 'De gegevens konden niet laden.'); return; }
      try { sessionStorage.setItem(CACHE, JSON.stringify(r.data)); } catch (e) { /* te groot of geen opslag: niet erg */ }
      // Na een actie (bv. Teruggebracht) altijd opnieuw tekenen. Na het snelle openen enkel als je nog niets deed.
      toonGegevens(r.data, !(vanCache && bezigSindsCache));
    });
  }

  /** Het getal achter een onderdeel in het menu, of null. */
  function aantalVoor(naam) {
    if (naam === 'telaat') return data.telaat.length;
    if (naam === 'binnenkort') return data.binnenkort.length;
    if (naam === 'aanvragen') return (data.aanvragen || []).length;
    if (naam === 'meldingen') return (data.meldingen || []).length;
    if (naam === 'terugzetten') return (data.vandaagTerug || []).length;
    if (naam === 'tevervangen') return (data.teVervangen || []).length;
    if (naam === 'voorstellen') return (data.beschrijvingVoorstellen || []).length;
    return null;
  }

  /** Op een gsm: één keuzelijst in plaats van alle knoppen (zie .sectiekeuze in styles.css). */
  function keuzelijst() {
    var lijst = el('select', { id: 'sectiekeuze' }, GROEPEN.map(function (g) {
      var opties = SECTIES.filter(function (s) { return s[3] === g[0] && zichtbaarInMenu(s); }).map(function (s) {
        var aantal = aantalVoor(s[0]);
        return el('option', { value: s[0], selected: s[0] === actief }, s[1] + (aantal !== null ? ' (' + aantal + ')' : ''));
      });
      return opties.length ? el('optgroup', { label: g[1] }, opties) : null;
    }));
    lijst.addEventListener('change', function () { toonSectie(lijst.value, true); });
    return el('div', { class: 'veld sectiekeuze' }, el('label', { for: 'sectiekeuze' }, 'Onderdeel'), lijst);
  }

  function zichtbaarInMenu(s) {
    return !(s[0] === 'aanvragen' && !data.onlineReserveren && !(data.aanvragen || []).length);
  }

  function tekenNav() {
    D.vervang($('sectienav'), keuzelijst(), GROEPEN.map(function (g) {
      var kopId = 'navgroep-' + g[0];
      return el('div', { class: 'navgroep', role: 'group', 'aria-labelledby': kopId },
        el('span', { class: 'navgroep-kop', id: kopId }, g[1]),
        el('div', { class: 'navgroep-knoppen' }, SECTIES.filter(function (s) { return s[3] === g[0]; }).map(function (s) {
          var aantal = aantalVoor(s[0]);
          // Voorstellen van vrijwilligers die op goedkeuring wachten.
          var extra = s[0] === 'inhoud' && data.voorstellen ? ' (' + data.voorstellen + ' te keuren)' : '';
          if (!zichtbaarInMenu(s)) return null;
          return el('button', {
            type: 'button', class: 'knop' + (s[0] === actief ? '' : ' tweede'), 'aria-pressed': s[0] === actief ? 'true' : 'false',
            onclick: function () { toonSectie(s[0], true); }
          }, s[1] + (aantal !== null ? ' (' + aantal + ')' : '') + extra);
        })));
    }));
  }

  function toonSectie(naam, focus, uitGeschiedenis) {
    actief = naam;
    // Een keuze van de gebruiker komt in het adres, zodat Terug en herladen werken.
    if (focus && !uitGeschiedenis && sectieUitAdres() !== naam) history.pushState(null, '', '#' + naam);
    tekenNav();
    // Enkel bij een wissel door de gebruiker: anders verdwijnt een net getoonde bevestiging.
    if (focus) D.vervang($('melding'));
    var sectie = SECTIES.filter(function (s) { return s[0] === naam; })[0];
    toonHulp(naam);
    sectie[2]($('sectie'));
    if (focus) { var kop = $('sectie').querySelector('h2'); if (kop) kop.focus(); }
  }

  function kop(tekst, uitleg) {
    return [el('h2', { tabindex: '-1' }, tekst), uitleg ? el('p', {}, uitleg) : null];
  }

  /* ---------- Herinneringen ---------- */

  function kopieer(tekst, knop) {
    function gelukt() {
      var oud = knop.textContent;
      knop.textContent = 'Gekopieerd!';
      setTimeout(function () { knop.textContent = oud; }, 2000);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(tekst).then(gelukt, function () { toonTekst(tekst); });
    } else {
      toonTekst(tekst);
    }
  }

  /** Lukt kopiëren niet, toon de tekst dan om met de hand te selecteren. */
  function toonTekst(tekst) {
    B.melding($('melding'), 'info', 'Kopiëren lukte niet. Selecteer deze tekst en kopieer hem zelf: ' + tekst);
  }

  /** Belgisch gsm-nummer naar internationaal formaat voor WhatsApp: 0470... wordt 32470... */
  function whatsappNummer(tel) {
    var c = String(tel || '').replace(/[^\d+]/g, '');
    if (c.indexOf('+') === 0) return c.slice(1);
    if (c.indexOf('00') === 0) return c.slice(2);
    if (c.indexOf('0') === 0) return '32' + c.slice(1);
    return c;
  }

  function herinneringKaart(u, naVerstuurd) {
    var kopieerKnop = el('button', { type: 'button', class: 'knop' }, 'Kopieer herinnering');
    kopieerKnop.addEventListener('click', function () { kopieer(u.herinnering, kopieerKnop); });
    var verstuurdKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Herinnering verstuurd');
    verstuurdKnop.addEventListener('click', function () {
      verstuurdKnop.disabled = true;
      B.voerUit('herinneringVerstuurd', { uitlening_id: u.uitlening_id }).then(function (r) {
        if (!r.ok) { verstuurdKnop.disabled = false; B.melding($('melding'), 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', 'Herinnering voor "' + u.titel + '" genoteerd.');
        if (typeof naVerstuurd === 'function') naVerstuurd(); else laad();
      });
    });
    var contact = [];
    if (u.telefoon) {
      contact.push(el('a', { href: 'tel:' + u.telefoon.replace(/[^\d+]/g, '') }, u.telefoon));
      contact.push(' · ', el('a', { href: 'https://wa.me/' + whatsappNummer(u.telefoon) + '?text=' + encodeURIComponent(u.herinnering), target: '_blank', rel: 'noopener' }, 'WhatsApp'));
    }
    if (u.email) {
      if (contact.length) contact.push(' · ');
      contact.push(el('a', { href: 'mailto:' + u.email + '?subject=' + encodeURIComponent('Herinnering Project Madrigal') + '&body=' + encodeURIComponent(u.herinnering) }, u.email));
    }
    return el('li', { class: 'kaart ' + u.status.code },
      el('h3', {}, u.titel),
      el('p', {}, u.exemplaar + ' · lener ' + u.lenersnummer + ': ' + [u.voornaam, u.achternaam].filter(Boolean).join(' ')),
      B.uitleenStatus(u),
      el('p', {}, contact.length ? contact : 'Geen contactgegevens.'),
      el('p', {}, 'Laatste herinnering: ' + (u.laatste_herinnering ? D.korteDatum(u.laatste_herinnering) : 'nog geen')),
      el('details', {}, el('summary', {}, 'Toon de tekst'), el('p', {}, u.herinnering)),
      el('div', { class: 'knoppen' }, kopieerKnop, verstuurdKnop),
      uitleenKnoppen(u));
  }

  function toonRoosterSectie(vak) {
    var inhoud = el('div');
    D.vervang(vak, kop('Rooster', VRIJWILLIGER ? 'Wie staat er de komende vrijdagen in de bib? Je beschikbaarheid vul je in via de knop naar de roostertool.'
      : 'Wie staat er de komende vrijdagen in de bib? Het rooster zelf maak je in de roostertool.'), inhoud);
    B.toonRooster(inhoud);
  }

  /** Voor het vrijwilligersscherm: wie en wanneer, zonder contactgegevens. */
  function uitleningKaart(u) {
    return el('li', { class: 'kaart ' + u.status.code },
      el('h3', {}, u.titel),
      el('p', {}, u.exemplaar + ' · lener ' + u.lenersnummer + ' (' + u.voornaam + ') · uit sinds ' + D.korteDatum(u.datum_uit)),
      B.uitleenStatus(u),
      u.borg ? el('p', {}, 'Borg: ' + D.euro(u.borg) + (u.betaalwijze_borg ? ' (' + u.betaalwijze_borg + ')' : '')) : null,
      uitleenKnoppen(u));
  }

  /**
   * Terugbrengen en verlengen, rechtstreeks vanuit dit scherm. Dezelfde regels als aan de balie:
   * bij een overschreden grens vraagt het scherm een reden (zie grens-dialoog).
   */
  function uitleenKnoppen(u) {
    var vak = el('div');
    var fout = el('div', { 'aria-live': 'assertive' });
    var terug = el('button', { type: 'button', class: 'knop tweede' }, 'Teruggebracht');
    var verleng = el('button', { type: 'button', class: 'knop tweede' }, 'Verleng');
    terug.addEventListener('click', function () {
      var bevestig = el('button', { type: 'button', class: 'knop' }, 'Bevestig: boek is terug');
      var naam = 'borg-' + u.uitlening_id;
      var staatVraag = B.staatVraag('t-' + u.uitlening_id);
      var vraag = u.borg > 0 ? el('fieldset', { class: 'keuzes' },
        el('legend', {}, 'Borg van ' + D.euro(u.borg) + ' terugbetaald?'),
        el('label', {}, el('input', { type: 'radio', name: naam, value: 'ja', checked: true }), 'Ja, teruggegeven'),
        el('label', {}, el('input', { type: 'radio', name: naam, value: 'nee' }), 'Nee, nog niet')) : null;
      bevestig.addEventListener('click', function () {
        var keuze = vak.querySelector('input[name="' + naam + '"]:checked');
        bevestig.disabled = true;
        B.voerUit('terugbrengen', Object.assign({ uitlening_id: u.uitlening_id, borg_terugbetaald: !!keuze && keuze.value === 'ja' }, staatVraag.lees())).then(function (r) {
          if (!r.ok) { bevestig.disabled = false; B.melding(fout, 'fout', r.fout); return; }
          B.melding($('melding'), 'ok', r.tekst || '"' + u.titel + '" is terug.');
          laad();
        });
      });
      D.vervang(vak, staatVraag.blok, vraag, fout, el('div', { class: 'knoppen' }, bevestig,
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { D.vervang(vak, rij); } }, 'Annuleer')));
    });
    verleng.addEventListener('click', function () {
      verleng.disabled = true;
      B.voerUit('verlengen', { uitlening_id: u.uitlening_id }, function () { verleng.disabled = false; }).then(function (r) {
        verleng.disabled = false;
        if (r.geannuleerd) return;
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', r.tekst || '"' + u.titel + '" is verlengd.');
        laad();
      });
    });
    var rij = [fout, el('div', { class: 'knoppen' }, terug, verleng), meerOpties(u, fout)];
    D.vervang(vak, rij);
    return vak;
  }

  /**
   * Meer opties bij een uitlening: de termijn aanpassen (bestuur), een verlenging annuleren,
   * of de uitlening annuleren na een vergissing. Een vrijwilliger annuleert enkel uitleningen
   * van de laatste 7 dagen (dat controleert de web-app).
   */
  function meerOpties(u, fout) {
    function actie(naam, gegevens, knop) {
      knop.disabled = true;
      B.voerUit(naam, Object.assign({ uitlening_id: u.uitlening_id }, gegevens)).then(function (r) {
        knop.disabled = false;
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        var extra = (r.apartLeggen || []).map(function (m) { return ' ' + m.tekst + '.'; }).join('');
        B.melding($('melding'), 'ok', (r.tekst || 'Aangepast.') + extra);
        laad();
      });
    }
    var id = 'dagen-' + u.uitlening_id;
    var dagen = el('input', { type: 'number', id: id, value: '7', min: '-365', max: '365', step: '1', class: 'kort', inputmode: 'numeric' });
    var termijn = VRIJWILLIGER ? null : el('div', { class: 'veld' },
      el('label', { for: id }, 'Termijn aanpassen met zoveel dagen ', el('span', { class: 'hulptekst' }, '(negatief om in te korten, telt niet als verlenging)')),
      el('div', { class: 'knoppen' }, dagen, el('button', { type: 'button', class: 'knop tweede', onclick: function (e) {
        actie('vervaldatumAanpassen', { dagen: dagen.value }, e.target);
      } }, 'Pas de termijn aan')));
    var verlenging = u.aantal_verlengingen > 0 ? el('button', { type: 'button', class: 'knop tweede', onclick: function (e) {
      if (!window.confirm('De laatste verlenging van "' + u.titel + '" annuleren? De vorige terugbrengdatum komt terug.')) return;
      actie('annuleerVerlenging', {}, e.target);
    } }, 'Annuleer de verlenging') : null;
    var annuleer = el('button', { type: 'button', class: 'knop tweede gevaar', onclick: function (e) {
      if (!window.confirm('De uitlening van "' + u.titel + '" annuleren, alsof ze nooit gebeurde? Gebruik dit enkel na een vergissing. Komt het boek gewoon terug, kies dan Teruggebracht.')) return;
      actie('annuleerUitlening', {}, e.target);
    } }, 'Annuleer de uitlening');
    return el('details', { class: 'meer-opties' }, el('summary', {}, 'Meer opties'),
      termijn, el('div', { class: 'knoppen' }, verlenging, annuleer), VRIJWILLIGER ? null : verlorenBlok(u, actie));
  }

  /** Bestuur: het boek is verloren. Sluit de uitlening af en zet de status van het boek op verloren. */
  function verlorenBlok(u, actie) {
    var naam = 'borg-' + u.uitlening_id;
    var keuzes = u.borg > 0 ? el('fieldset', { class: 'keuzes' }, el('legend', {}, 'De borg van ' + D.euro(u.borg)),
      [['ingehouden', 'Ingehouden als vergoeding'], ['terugbetaald', 'Terugbetaald: de lener bracht een ander exemplaar of betaalde de waarde']].map(function (k, i) {
        var id = naam + '-' + k[0];
        return el('label', { class: 'vinkje', for: id }, el('input', { type: 'radio', name: naam, id: id, value: k[0], checked: i === 0 }), k[1]);
      })) : null;
    var opmerkingId = 'verloren-opmerking-' + u.uitlening_id;
    var opmerking = el('input', { type: 'text', id: opmerkingId, maxlength: '200', autocomplete: 'off', placeholder: 'bv. lener betaalde 15 euro' });
    return el('div', { class: 'veld' },
      el('h4', {}, 'Boek verloren'),
      el('p', { class: 'hulptekst' }, 'Sluit de uitlening af en zet het boek op verloren: op de website staat het als niet meer beschikbaar en je kan het niet meer uitlenen. Telt niet mee in de uitleenduur.'),
      keuzes,
      el('label', { for: opmerkingId }, 'Opmerking ', el('span', { class: 'hulptekst' }, '(mag leeg)')), opmerking,
      el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede gevaar', onclick: function (e) {
        if (!window.confirm('"' + u.titel + '" als verloren noteren? De uitlening wordt afgesloten.')) return;
        var gekozen = document.querySelector('input[name="' + naam + '"]:checked');
        actie('boekVerloren', { borg: gekozen ? gekozen.value : 'ingehouden', opmerking: opmerking.value }, e.target);
      } }, 'Noteer als verloren')));
  }

  function toonTeLaat(vak) {
    var naElkaar = !VRIJWILLIGER && data.telaat.length > 1
      ? el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop', onclick: function () { herinneringenNaElkaar(vak, data.telaat, 0); } }, 'Verstuur de herinneringen een voor een'))
      : null;
    D.vervang(vak, kop('Te laat', VRIJWILLIGER ? 'Het bestuur stuurt de herinneringen. Komt de lener langs, dan breng je het boek terug in het uitleenscherm.'
      : 'Kopieer de herinnering, verstuur ze zelf via WhatsApp, sms of mail, en noteer daarna dat ze verstuurd is.'),
      naElkaar,
      data.telaat.length ? el('ul', { class: 'kaartlijst' }, data.telaat.map(function (u) { return VRIJWILLIGER ? uitleningKaart(u) : herinneringKaart(u); })) : el('p', {}, 'Geen boeken te laat. Fijn!'));
  }

  /**
   * De herinneringen een voor een: één lener per keer, met WhatsApp of mail bovenaan.
   * Na Herinnering verstuurd ga je meteen naar de volgende.
   */
  function herinneringenNaElkaar(vak, lijst, i) {
    if (i >= lijst.length) {
      B.melding($('melding'), 'ok', 'Alle herinneringen overlopen.');
      laad();
      return;
    }
    var u = lijst[i];
    var snel = [];
    if (u.telefoon) snel.push(el('a', { class: 'knop', href: 'https://wa.me/' + whatsappNummer(u.telefoon) + '?text=' + encodeURIComponent(u.herinnering), target: '_blank', rel: 'noopener' }, 'Open in WhatsApp'));
    if (u.email) snel.push(el('a', { class: 'knop tweede', href: 'mailto:' + u.email + '?subject=' + encodeURIComponent('Herinnering Project Madrigal') + '&body=' + encodeURIComponent(u.herinnering) }, 'Open in je mail'));
    D.vervang(vak, kop('Herinnering ' + (i + 1) + ' van ' + lijst.length, 'Verstuur het bericht en klik daarna op Herinnering verstuurd. Dan komt de volgende.'),
      snel.length ? el('div', { class: 'knoppen' }, snel) : null,
      el('ul', { class: 'kaartlijst' }, herinneringKaart(u, function () { herinneringenNaElkaar(vak, lijst, i + 1); })),
      el('div', { class: 'knoppen' },
        i > 0 ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { herinneringenNaElkaar(vak, lijst, i - 1); } }, '‹ Vorige') : null,
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { herinneringenNaElkaar(vak, lijst, i + 1); } }, i + 1 < lijst.length ? 'Sla over ›' : 'Klaar'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonTeLaat(vak); } }, 'Terug naar Te laat')));
    vak.querySelector('h2').focus();
  }

  function toonBinnenkort(vak) {
    D.vervang(vak, kop('Vervalt binnenkort', VRIJWILLIGER ? 'Deze boeken moeten binnenkort terug.' : 'Stuur op tijd een vriendelijke herinnering.'),
      data.binnenkort.length ? el('ul', { class: 'kaartlijst' }, data.binnenkort.map(VRIJWILLIGER ? uitleningKaart : herinneringKaart)) : el('p', {}, 'Er vervalt binnenkort niets.'));
  }

  /* ---------- Lopende uitleningen ---------- */

  function toonLopend(vak) {
    var zoek = el('input', { type: 'search', id: 'lopend-zoek', autocomplete: 'off', placeholder: 'Titel, exemplaar, lenersnummer of voornaam' });
    var soort = el('select', { id: 'lopend-soort' },
      el('option', { value: '' }, 'Alle'), el('option', { value: 'telaat' }, 'Te laat'),
      el('option', { value: 'binnenkort' }, 'Vervalt binnenkort'), el('option', { value: 'optijd' }, 'Op tijd'));
    var lijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = Z.normaliseer(zoek.value);
      var gevonden = data.lopend.filter(function (u) {
        return (!soort.value || u.status.code === soort.value) &&
          (!q || Z.normaliseer([u.titel, u.exemplaar, u.lenersnummer, u.voornaam].join(' ')).indexOf(q) > -1);
      });
      D.vervang(lijst, el('p', {}, gevonden.length + ' van ' + data.lopend.length + ' uitleningen.'),
        gevonden.length ? el('ul', { class: 'kaartlijst' }, gevonden.map(uitleningKaart)) : null);
    }
    zoek.addEventListener('input', teken);
    soort.addEventListener('change', teken);
    D.vervang(vak, kop('Alle lopende uitleningen', data.lopend.length + (data.lopend.length === 1 ? ' boek' : ' boeken') + ' uitgeleend, gesorteerd op vervaldatum.'),
      el('div', { class: 'veld' }, el('label', { for: 'lopend-zoek' }, 'Zoek'), zoek),
      el('div', { class: 'veld' }, el('label', { for: 'lopend-soort' }, 'Toon'), soort), lijst);
    teken();
  }

  /* ---------- Borgen en giften ---------- */

  function toonBorgen(vak) {
    var b = data.borgen;
    var perWijze = Object.keys(b.ingehouden.perBetaalwijze).map(function (w) {
      return el('tr', {}, el('td', {}, w), el('td', { class: 'getal' }, D.euro(b.ingehouden.perBetaalwijze[w])));
    });
    var terug = b.terugTeBetalen.map(function (u) {
      var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Borg terugbetaald');
      knop.addEventListener('click', function () {
        knop.disabled = true;
        B.voerUit('borgTerugbetaald', { uitlening_id: u.uitlening_id }).then(function (r) {
          if (!r.ok) { knop.disabled = false; B.melding($('melding'), 'fout', r.fout); return; }
          B.melding($('melding'), 'ok', r.tekst);
          laad();
        });
      });
      return el('li', { class: 'kaart' },
        el('h3', {}, u.titel),
        el('p', {}, 'Lener ' + u.lenersnummer + ': ' + [u.voornaam, u.achternaam].filter(Boolean).join(' ') + ' · terug op ' + D.korteDatum(u.datum_terug)),
        el('p', {}, 'Borg ' + D.euro(u.borg) + (u.betaalwijze_borg ? ' (' + u.betaalwijze_borg + ')' : '')),
        el('div', { class: 'knoppen' }, knop));
    });
    D.vervang(vak, kop('Borgen en giften'),
      el('h3', {}, 'Nu ingehouden: ' + D.euro(b.ingehouden.totaal)),
      perWijze.length ? el('div', { class: 'tabel-wrap' }, el('table', {},
        el('caption', { class: 'verborgen' }, 'Ingehouden borg per betaalwijze'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Betaalwijze'), el('th', { scope: 'col', class: 'getal' }, 'Bedrag'))),
        el('tbody', {}, perWijze))) : el('p', {}, 'Er is geen borg ingehouden.'),
      el('h3', { style: 'margin-top:1.5rem' }, 'Nog terug te betalen'),
      el('p', {}, 'Boeken die terug zijn, maar waarvan de borg nog niet terugbetaald werd.'),
      terug.length ? el('ul', { class: 'kaartlijst' }, terug) : el('p', {}, 'Niets terug te betalen.'),
      el('h3', { style: 'margin-top:1.5rem' }, 'Giften per maand'),
      el('div', { class: 'tabel-wrap' }, el('table', {},
        el('caption', { class: 'verborgen' }, 'Giften per maand'),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Maand'), el('th', { scope: 'col', class: 'getal' }, 'Giften'))),
        el('tbody', {}, data.perMaand.map(function (m) {
          return el('tr', {}, el('td', {}, m.maand), el('td', { class: 'getal' }, D.euro(m.giften)));
        })))),
      (data.perJaar || []).length ? [
        el('h3', { style: 'margin-top:1.5rem' }, 'Giften per jaar'),
        el('p', { class: 'hulptekst' }, 'Alle bewaarde uitleningen, ook die ouder dan 12 maanden.'),
        el('div', { class: 'tabel-wrap' }, el('table', {},
          el('caption', { class: 'verborgen' }, 'Giften per jaar'),
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Jaar'), el('th', { scope: 'col', class: 'getal' }, 'Uitleningen'), el('th', { scope: 'col', class: 'getal' }, 'Giften'))),
          el('tbody', {}, data.perJaar.map(function (j) {
            return el('tr', {}, el('td', {}, String(j.jaar)), el('td', { class: 'getal' }, String(j.uitleningen)), el('td', { class: 'getal' }, D.euro(j.giften)));
          }))))] : null);
  }

  /* ---------- Reservaties ---------- */

  function toonReservaties(vak) {
    var perBoek = {};
    data.reservaties.forEach(function (r) { (perBoek[r.boek_id] = perBoek[r.boek_id] || []).push(r); });
    var boeken = Object.keys(perBoek);
    D.vervang(vak, kop('Reservaties en wachtrij', 'Per boek de wachtrij, de eerste bovenaan.'),
      boeken.length ? el('ul', { class: 'kaartlijst' }, boeken.map(function (id) {
        var rij = perBoek[id];
        return el('li', { class: 'kaart' }, el('h3', {}, rij[0].titel),
          el('ol', {}, rij.map(function (r) {
            var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Annuleer');
            knop.addEventListener('click', function () {
              if (!window.confirm('Reservatie van lener ' + r.lenersnummer + ' (' + r.voornaam + ') annuleren?')) return;
              knop.disabled = true;
              B.voerUit('annuleerReservatie', { reservatie_id: r.reservatie_id }).then(function (a) {
                if (!a.ok) { knop.disabled = false; B.melding($('melding'), 'fout', a.fout); return; }
                var extra = (a.apartLeggen || []).map(function (m) { return ' ' + m.tekst + '.'; }).join('');
                B.melding($('melding'), 'ok', a.tekst + extra);
                laad();
              });
            });
            return el('li', {}, el('p', {},
              el('strong', {}, 'Lener ' + r.lenersnummer + ' (' + r.voornaam + ')'), el('br'),
              r.status === 'klaar om op te halen' ? D.statusLabel('gereserveerd', 'Ligt klaar') : D.statusLabel('uitgeleend', 'Wacht'),
              ' ', r.tekst), el('div', { class: 'knoppen', style: 'margin-top:.3rem' }, knop));
          })));
      })) : el('p', {}, 'Er zijn geen lopende reservaties.'));
  }

  /* ---------- Uitzonderingen ---------- */

  function toonUitzonderingen(vak) {
    D.vervang(vak, kop('Uitzonderingen', 'Keren dat een vrijwilliger of het bestuur een grens bewust overschreed, de laatste 6 maanden.'),
      data.uitzonderingen.length ? el('div', { class: 'tabel-wrap' }, el('table', {},
        el('caption', { class: 'verborgen' }, 'Uitzonderingen'),
        el('thead', {}, el('tr', {}, ['Datum', 'Wie', 'Grens', 'Lener', 'Boek', 'Reden'].map(function (t) { return el('th', { scope: 'col' }, t); }))),
        el('tbody', {}, data.uitzonderingen.map(function (x) {
          return el('tr', {},
            el('td', {}, D.korteDatum(x.datum)), el('td', {}, x.wie), el('td', {}, x.grens),
            el('td', {}, x.lenersnummer ? x.lenersnummer + (x.voornaam ? ' (' + x.voornaam + ')' : '') : '(gewist)'),
            el('td', {}, x.titel || ''), el('td', {}, x.reden));
        })))) : el('p', {}, 'Geen uitzonderingen in de laatste 6 maanden.'));
  }

  /* ---------- Aanvragen van de website ---------- */

  function toonAanvragen(vak) {
    var lijst = data.aanvragen || [];
    D.vervang(vak, kop('Aanvragen van de website', 'Mensen die via de website een boek wilden reserveren. Neem contact op, maak de reservatie in het uitleenscherm en zet de aanvraag daarna op afgehandeld.'),
      data.onlineReserveren ? null : el('p', { class: 'melding' }, 'Online reserveren staat uit. Zet de instelling online_reserveren op ja (onder Teksten en instellingen) om de knop op de website te tonen.'),
      lijst.length ? el('ul', { class: 'kaartlijst' }, lijst.map(function (a) {
        var fout = el('div');
        var knop = function (status, tekst) {
          return el('button', { type: 'button', class: 'knop' + (status === 'afgehandeld' ? '' : ' tweede'), onclick: function (e) {
            e.target.disabled = true;
            B.voerUit('aanvraagAfhandelen', { aanvraag_id: a.aanvraag_id, status: status }).then(function (r) {
              if (!r.ok) { e.target.disabled = false; B.melding(fout, 'fout', r.fout); return; }
              B.melding($('melding'), 'ok', r.tekst);
              laad();
            });
          } }, tekst);
        };
        return el('li', { class: 'kaart' },
          el('h3', {}, a.titel), el('p', {}, a.boek_id + ' · aangevraagd op ' + D.korteDatum(a.datum)),
          el('p', {}, el('strong', {}, a.voornaam), ' · ', a.contact),
          a.opmerking ? el('p', {}, 'Opmerking: ' + a.opmerking) : null,
          fout,
          el('div', { class: 'knoppen' }, knop('afgehandeld', 'Afgehandeld'), knop('geweigerd', 'Kan niet, geweigerd')));
      })) : el('p', {}, 'Er zijn geen open aanvragen.'));
  }

  /* ---------- Te vervangen ---------- */

  /**
   * Verloren exemplaren: een nieuw exemplaar zoeken, of beslissen dat het niet vervangen wordt.
   * Vrijwilligers zien de lijst (handig als je tweedehands zoekt), het bestuur beslist.
   */
  function toonTeVervangen(vak) {
    var lijst = data.teVervangen || [];
    D.vervang(vak, kop('Te vervangen', VRIJWILLIGER
      ? 'Boeken die verloren zijn. Zie je er een tweedehands, of brengt iemand er een binnen? Meld het via Iets melden.'
      : 'Boeken die verloren zijn. Staat er een nieuw exemplaar in de kast, klik dan op Vervangen. Koop je het niet opnieuw, klik op Niet vervangen: dan blijft het op de website als niet meer beschikbaar.'),
      lijst.length ? el('ul', { class: 'kaartlijst' }, lijst.map(function (b) {
        var fout = el('div', { 'aria-live': 'polite' });
        function kies(keuze, knop) {
          knop.disabled = true;
          B.voerUit('boekVervangen', { sleutel: b.sleutel, keuze: keuze }).then(function (r) {
            knop.disabled = false;
            if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
            B.melding($('melding'), 'ok', r.tekst);
            laad();
          });
        }
        return el('li', { class: 'kaart' },
          el('p', {}, el('strong', {}, b.titel), b.auteur ? ' (' + b.auteur + ')' : ''),
          el('p', { class: 'hulptekst' }, [b.exemplaar || b.boek_id, b.isbn ? 'ISBN ' + b.isbn : '', b.datum ? 'verloren op ' + D.korteDatum(b.datum) : '',
            b.lenersnummer ? 'lener ' + b.lenersnummer : '', b.borg ? 'borg ' + b.borg : ''].filter(Boolean).join(' · ')),
          b.opmerking ? el('p', {}, b.opmerking) : null,
          fout,
          VRIJWILLIGER ? null : el('div', { class: 'knoppen' },
            el('button', { type: 'button', class: 'knop', onclick: function (e) { kies('vervangen', e.target); } }, 'Vervangen'),
            el('button', { type: 'button', class: 'knop tweede', onclick: function (e) {
              if (window.confirm('"' + b.titel + '" niet vervangen? Het blijft op de website als niet meer beschikbaar.')) kies('niet', e.target);
            } }, 'Niet vervangen')));
      })) : el('p', {}, 'Er is niets te vervangen.'));
  }

  /* ---------- Verloren en gevoelig ---------- */

  function toonBoekstatus(vak) {
    var s = data.boekstatus || { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] };
    function lijst(titel, uitleg, boeken, leeg) {
      return el('div', { class: 'blok' }, el('h3', {}, titel + ' (' + boeken.length + ')'), el('p', { class: 'hulptekst' }, uitleg),
        boeken.length ? el('ul', {}, boeken.map(function (b) {
          return el('li', {}, el('strong', {}, b.titel), b.auteur ? ', ' + b.auteur : '', ' ', el('span', { class: 'hulptekst' }, '(' + b.boek_id + ')'));
        })) : el('p', {}, leeg));
    }
    D.vervang(vak, kop('Verloren en gevoelig', 'Boeken met een status in de kolom status van de Catalogus. Zet de status leeg om een boek terug gewoon te maken.'),
      lijst('Verloren', 'Op de website als niet meer beschikbaar, niet uitleenbaar.', s.verloren, 'Geen verloren boeken.'),
      lijst('Gevoelig, verborgen', 'Niet op de website, wel uitleenbaar aan de balie.', s.gevoelig_verborgen, 'Geen boeken.'),
      lijst('Gevoelig, zichtbaar', 'Op de website met het label "Gevoelige inhoud".', s.gevoelig_zichtbaar, 'Geen boeken.'));
  }

  /* ---------- Leners ---------- */

  function toonLeners(vak) {
    var zoekveld = el('input', { type: 'search', id: 'lener-zoek', autocomplete: 'off', placeholder: 'Nummer, naam, telefoon of e-mail' });
    var lijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = Z.normaliseer(zoekveld.value);
      var gevonden = data.leners.filter(function (l) {
        if (!q) return true;
        return String(l.lenersnummer) === q || Z.normaliseer([l.voornaam, l.achternaam, l.telefoon, l.email].join(' ')).indexOf(q) > -1;
      }).slice(0, 30);
      D.vervang(lijst, gevonden.length ? el('ul', { class: 'kaartlijst' }, gevonden.map(function (l) {
        return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { bewerk(l); } },
          el('strong', {}, l.lenersnummer + ' · ' + [l.voornaam, l.achternaam].filter(Boolean).join(' ')),
          el('span', {}, [l.telefoon, l.email].filter(Boolean).join(' · ')),
          el('span', { class: 'labels' },
            l.actief ? null : D.statusLabel('niet_uitleenbaar', 'Inactief'),
            l.markering ? D.statusLabel('binnenkort', 'Gemarkeerd') : null,
            l.toestemming_privacy === 'ja' ? null : D.statusLabel('binnenkort', 'Toestemming: ' + (l.toestemming_privacy || 'onbekend')),
            l.lopend ? D.statusLabel('uitgeleend', l.lopend + ' in huis') : null)));
      })) : el('p', {}, 'Geen lener gevonden.'));
    }
    zoekveld.addEventListener('input', teken);
    D.vervang(vak, kop('Leners', data.leners.length + ' leners. Zoek, pas aan of zet op inactief. Een inactieve lener zonder uitleningen wordt na de bewaartermijn gewist.'),
      el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop', onclick: nieuweLener }, '+ Nieuwe lener')),
      el('div', { class: 'veld' }, el('label', { for: 'lener-zoek' }, 'Zoek een lener'), zoekveld), lijst);
    teken();

    function bewerk(l) {
      var fout = el('div');
      var veld = function (id, label, waarde, type) {
        return el('div', { class: 'veld' }, el('label', { for: id }, label), el('input', { type: type || 'text', id: id, value: waarde || '', autocomplete: 'off' }));
      };
      var formulier = el('form', { novalidate: true },
        veld('l-voornaam', 'Voornaam', l.voornaam),
        veld('l-achternaam', 'Achternaam', l.achternaam),
        veld('l-telefoon', 'Telefoon', l.telefoon, 'tel'),
        veld('l-email', 'E-mail', l.email, 'email'),
        el('div', { class: 'veld' }, el('label', { for: 'l-notitie' }, 'Notitie ', el('span', { class: 'hulptekst' }, '(enkel voor het bestuur, verdwijnt met de lener bij de privacy-opruiming)')),
          el('textarea', { id: 'l-notitie', rows: '3', maxlength: '500' }, l.notitie || '')),
        el('div', { class: 'veld' }, el('label', { for: 'l-markering' }, 'Markering ', el('span', { class: 'hulptekst' }, '(leeg: geen markering)')),
          el('p', { class: 'hulptekst', id: 'l-markering-uitleg' }, 'Schrijf hier waarom deze lener even niets kan lenen of reserveren, bv. "boek van maart nog niet terug". Aan de balie zien vrijwilligers enkel een vriendelijke vraag om contact op te nemen met het bestuur, nooit deze reden. Haal de tekst weg zodra het opgelost is.' + (l.markering_sinds ? ' Gemarkeerd sinds ' + D.korteDatum(l.markering_sinds) + '.' : '')),
          el('textarea', { id: 'l-markering', rows: '2', maxlength: '300', 'aria-describedby': 'l-markering-uitleg' }, l.markering || '')),
        el('label', { class: 'vinkje', for: 'l-actief' }, el('input', { type: 'checkbox', id: 'l-actief', checked: l.actief }), 'Actief'),
        el('p', { class: 'hulptekst' }, 'Ingeschreven op ' + D.korteDatum(l.datum_inschrijving) + '. Toestemming privacy: ' + (l.toestemming_privacy || 'onbekend') + '. Pas de toestemming aan in het tabblad Leners.'),
        fout,
        el('div', { class: 'knoppen' },
          el('button', { type: 'submit', class: 'knop' }, 'Bewaar'),
          el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonLeners(vak); } }, 'Terug naar de lijst')));
      formulier.addEventListener('submit', function (e) {
        e.preventDefault();
        B.voerUit('lenerAanpassen', {
          lenersnummer: l.lenersnummer, voornaam: $('l-voornaam').value, achternaam: $('l-achternaam').value,
          telefoon: $('l-telefoon').value, email: $('l-email').value, actief: $('l-actief').checked, notitie: $('l-notitie').value,
          markering: $('l-markering').value
        }).then(function (r) {
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          B.melding($('melding'), 'ok', r.tekst);
          laad();
        });
      });
      D.vervang(vak, kop('Lener ' + l.lenersnummer + ' · ' + [l.voornaam, l.achternaam].filter(Boolean).join(' ')), lenerOverzicht(l), formulier);
      vak.querySelector('h2').focus();
    }

    /** Een nieuwe lener inschrijven, zoals aan de balie (zelfde controle en privacyverklaring). */
    function nieuweLener() {
      var fout = el('div', { 'aria-live': 'assertive' });
      var knop = el('button', { type: 'submit', class: 'knop' }, 'Schrijf in');
      var invoer = function (id, label, type, extraLabel) {
        return el('div', { class: 'veld' }, el('label', { for: id }, label, extraLabel ? el('span', { class: 'hulptekst' }, ' ' + extraLabel) : null),
          el('input', { type: type || 'text', id: id, autocomplete: 'off' }));
      };
      var formulier = el('form', { novalidate: true },
        invoer('nl-voornaam', 'Voornaam'), invoer('nl-achternaam', 'Achternaam', 'text', '(mag leeg)'),
        el('p', {}, 'Vul minstens een telefoonnummer of een e-mailadres in.'),
        invoer('nl-telefoon', 'Telefoon', 'tel'), invoer('nl-email', 'E-mail', 'email'),
        data.privacy ? el('div', { class: 'melding info' }, el('strong', {}, 'Privacyverklaring'), el('p', {}, data.privacy)) : null,
        el('label', { class: 'vinkje', for: 'nl-toestemming' }, el('input', { type: 'checkbox', id: 'nl-toestemming' }), 'De lener heeft de privacyverklaring gelezen en geeft toestemming.'),
        fout, el('div', { class: 'knoppen' }, knop, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonLeners(vak); } }, 'Annuleer')));
      formulier.addEventListener('submit', function (e) {
        e.preventDefault();
        knop.disabled = true;
        B.voerUit('nieuweLener', {
          voornaam: $('nl-voornaam').value, achternaam: $('nl-achternaam').value,
          telefoon: $('nl-telefoon').value, email: $('nl-email').value, toestemming: $('nl-toestemming').checked
        }).then(function (r) {
          knop.disabled = false;
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          D.vervang(vak, kop('Ingeschreven'), el('p', { class: 'groot-getal' }, el('strong', {}, r.tekst)),
            el('div', { class: 'knoppen' },
              el('a', { class: 'knop', href: 'balie.html#uitlenen=' + encodeURIComponent(r.lenersnummer) }, 'Meteen een boek uitlenen'),
              el('button', { type: 'button', class: 'knop tweede', onclick: function () { laad(); } }, 'Klaar')));
        });
      });
      D.vervang(vak, kop('Nieuwe lener'), formulier);
      $('nl-voornaam').focus();
    }

    /** Wat deze lener nu leent, wat er gereserveerd staat, en (op vraag) wat die vroeger leende. */
    function lenerOverzicht(l) {
      var nr = String(l.lenersnummer);
      var nu = data.lopend.filter(function (u) { return String(u.lenersnummer) === nr; });
      var res = data.reservaties.filter(function (r) { return String(r.lenersnummer) === nr; });
      var vroeger = el('div', { 'aria-live': 'polite' });
      var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Toon wat deze lener vroeger leende');
      knop.addEventListener('click', function () {
        knop.disabled = true;
        D.vervang(vroeger, el('p', {}, 'Laden...'));
        B.voerUit('beheerLenerHistoriek', { lenersnummer: nr }).then(function (r) {
          knop.hidden = true;
          if (!r.ok) { D.vervang(vroeger, el('p', { class: 'melding fout' }, r.fout)); return; }
          D.vervang(vroeger, r.uitleningen.length ? el('ul', {}, r.uitleningen.map(function (u) {
            return el('li', {}, u.titel + ' (' + u.exemplaar + '): ' + D.korteDatum(u.datum_uit) + ' tot ' + D.korteDatum(u.datum_terug));
          })) : el('p', {}, 'Geen eerdere uitleningen (of de privacy-opruiming wiste ze).'),
          r.totaal > r.uitleningen.length ? el('p', { class: 'hulptekst' }, 'De laatste ' + r.uitleningen.length + ' van ' + r.totaal + '.') : null);
        });
      });
      return el('div', { class: 'blok' },
        el('h3', {}, 'Nu in huis'),
        nu.length ? el('ul', { class: 'kaartlijst' }, nu.map(uitleningKaart)) : el('p', {}, 'Geen boeken in huis.'),
        el('div', { class: 'knoppen' }, el('a', { class: 'knop', href: 'balie.html#uitlenen=' + encodeURIComponent(nr) }, 'Leen een boek uit aan deze lener')),
        el('h3', {}, 'Reservaties'),
        res.length ? el('ul', {}, res.map(function (r) { return el('li', {}, r.titel + ': ' + r.tekst); })) : el('p', {}, 'Geen reservaties.'),
        el('h3', {}, 'Vroeger'), vroeger, el('div', { class: 'knoppen' }, knop));
    }
  }

  /* ---------- Cijfers ---------- */

  function staafTabel(titel, kolom, rijen) {
    var max = Math.max.apply(null, rijen.map(function (r) { return r[1]; }).concat([1]));
    return el('div', { class: 'tabel-wrap' }, el('table', {},
      el('caption', { class: 'verborgen' }, titel),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, kolom), el('th', { scope: 'col' }, 'Aantal'))),
      el('tbody', {}, rijen.map(function (r) {
        return el('tr', {}, el('td', {}, r[0]),
          el('td', {}, el('span', { class: 'balk', style: 'width:' + Math.round(r[1] / max * 8) + 'rem', 'aria-hidden': 'true' }), String(r[1])));
      }))));
  }

  /* ---------- Bezoekers van de website (GoatCounter, zie apps-script/Bezoekers.js) ---------- */

  var bezoekPeriode = '30';
  var bezoekCijfers = {}; // per periode, tot iemand op Vernieuw klikt

  var PAGINA_NAMEN = {
    '/': 'Startpagina', '/index.html': 'Startpagina', '/boeken.html': 'Boeken (catalogus)', '/over-ons.html': 'Over ons',
    '/doe-mee.html': 'Doe mee', '/boeken.html#/leeslijsten': 'Leeslijsten', '/boeken.html#/privacy': 'Privacy'
  };

  /** Een leesbare naam voor een pagina: een boek krijgt zijn titel. */
  function paginaNaam(p) {
    var m = p.pad.match(/#\/boek\/([A-Za-z0-9-]+)/);
    if (m) {
      var boek = (data.boeken || []).filter(function (b) { return b.id === m[1]; })[0];
      return 'Boek: ' + (boek ? boek.t : m[1]);
    }
    return PAGINA_NAMEN[p.pad] || p.titel || p.pad;
  }

  function bezoekersBlok() {
    var vak = el('div', { 'aria-live': 'polite' });
    var knoppen = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Periode' }, [['7', '7 dagen'], ['30', '30 dagen'], ['365', '12 maanden']].map(function (p) {
      return el('button', {
        type: 'button', class: 'knop' + (p[0] === bezoekPeriode ? '' : ' tweede'), 'aria-pressed': p[0] === bezoekPeriode ? 'true' : 'false',
        onclick: function () {
          bezoekPeriode = p[0];
          Array.prototype.forEach.call(knoppen.children, function (k, i) {
            var aan = ['7', '30', '365'][i] === bezoekPeriode;
            k.className = 'knop' + (aan ? '' : ' tweede');
            k.setAttribute('aria-pressed', aan ? 'true' : 'false');
          });
          laadBezoekers(vak);
        }
      }, p[1]);
    }));
    laadBezoekers(vak);
    return [el('h3', {}, 'Bezoekers van de website'), knoppen, vak];
  }

  function laadBezoekers(vak) {
    var periode = bezoekPeriode;
    if (bezoekCijfers[periode]) { tekenBezoekers(vak, bezoekCijfers[periode]); return; }
    D.vervang(vak, el('p', {}, 'Laden...'));
    B.voerUit('bezoekersCijfers', { dagen: Number(periode) }).then(function (r) {
      if (periode !== bezoekPeriode) return; // intussen een andere periode gekozen
      if (!r.ok) { D.vervang(vak, el('p', { class: 'melding fout' }, r.fout || 'De bezoekerscijfers konden niet laden.')); return; }
      if (r.nietIngesteld) {
        D.vervang(vak, el('p', {}, 'Nog niet gekoppeld. Maak in GoatCounter een API-sleutel (je naam rechtsboven > Preferences > tabblad API, enkel "Read statistics") en zet ze in de spreadsheet bij de instelling goatcounter_api_sleutel.'));
        return;
      }
      if (!r.waarschuwing) bezoekCijfers[periode] = r.cijfers;
      tekenBezoekers(vak, r.cijfers);
      if (r.waarschuwing) vak.insertBefore(el('p', { class: 'melding let-op' }, r.waarschuwing), vak.firstChild);
    });
  }

  /** Laat de dagen of weken met 0 bezoekers vóór de eerste telling weg (van voor GoatCounter er was). */
  function vanafEersteTelling(verloop) {
    var i = 0;
    while (i < verloop.length && !verloop[i].n) i++;
    return verloop.slice(i);
  }

  function tekenBezoekers(vak, c) {
    var tijd = function (d) { return D.korteDatum(d); };
    var lijstOfNiets = function (titel, kolom, rijen) {
      return [el('h4', {}, titel), rijen.length ? staafTabel(titel, kolom, rijen) : el('p', { class: 'hulptekst' }, 'Nog niets geteld.')];
    };
    D.vervang(vak,
      el('p', { class: 'groot-getal' }, el('strong', {}, String(c.totaal)), ' bezoekers'),
      el('p', { class: 'hulptekst' }, 'Wie dezelfde pagina meerdere keren op een dag bekijkt, telt één keer. Bezoekers met "niet volgen" in hun browser tellen niet mee. De cijfers vernieuwen elk half uur.'),
      lijstOfNiets(c.perWeek ? 'Per week' : 'Per dag', c.perWeek ? 'Week van' : 'Dag', vanafEersteTelling(c.verloop).map(function (s) { return [tijd(s.dag), s.n]; })),
      lijstOfNiets('Meest bekeken pagina\'s', 'Pagina', c.paginas.map(function (p) { return [paginaNaam(p), p.n]; })),
      lijstOfNiets('Vanwaar bezoekers komen', 'Bron', c.bronnen.map(function (b) { return [b.naam === '(onbekend)' ? 'Rechtstreeks (geen verwijzing)' : b.naam, b.n]; })),
      c.bronnen.some(function (b) { return b.naam === '(onbekend)'; }) ? el('p', { class: 'hulptekst' }, 'Rechtstreeks: de browser gaf niet door vanwaar de bezoeker kwam. Bijvoorbeeld wie het adres typt, een bladwijzer gebruikt, of een link opent vanuit een app zoals Instagram, WhatsApp of een mail.') : null,
      lijstOfNiets('Toestel', 'Schermgrootte', c.toestellen.map(function (b) { return [b.naam, b.n]; })),
      lijstOfNiets('Land', 'Land', c.landen.map(function (b) { return [b.naam, b.n]; })));
  }

  var cijfers = null; // apart geladen (bestuurCijfers), tot je op Vernieuw klikt

  function toonCijfers(vak) {
    if (!cijfers) {
      D.vervang(vak, kop('Cijfers'), el('p', {}, 'Cijfers laden...'));
      B.voerUit('bestuurCijfers').then(function (r) {
        if (!r.ok) { D.vervang(vak, kop('Cijfers'), el('p', { class: 'melding fout' }, r.fout || 'De cijfers laden lukte niet.')); return; }
        cijfers = r.cijfers;
        if (actief === 'cijfers') toonCijfers(vak);
      });
      return;
    }
    D.vervang(vak, kop('Cijfers'),
      bezoekersBlok(),
      el('h3', { style: 'margin-top:1.5rem' }, 'Uitleningen'),
      el('h4', {}, 'Uitleningen per maand'),
      staafTabel('Uitleningen per maand', 'Maand', data.perMaand.map(function (m) { return [m.maand, m.uitleningen]; })),
      el('h4', {}, 'Meest geleende boeken'),
      cijfers.meestGeleend.length ? staafTabel('Meest geleende boeken', 'Boek', cijfers.meestGeleend.map(function (b) { return [b.titel + (b.auteur ? ' (' + b.auteur + ')' : ''), b.aantal]; })) : el('p', {}, 'Nog geen uitleningen.'),
      el('h4', {}, 'Uitleningen per filtergroep'),
      cijfers.groepen.length ? staafTabel('Uitleningen per filtergroep', 'Filtergroep', cijfers.groepen.map(function (g) { return [g.groep, g.aantal]; })) : el('p', {}, 'Nog geen uitleningen.'),
      extraCijfersBlok(),
      shiftsBlok());
  }

  /** Shifts per vrijwilliger dit jaar (tabblad Shifts), en de avonden dat de bib dicht was. */
  function shiftsBlok() {
    var s = cijfers.shifts;
    if (!s) return null;
    var tabel = s.personen.length ? el('div', { class: 'tabel-wrap' }, el('table', {},
      el('caption', { class: 'verborgen' }, 'Shifts per vrijwilliger in ' + s.jaar),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Vrijwilliger'), el('th', { scope: 'col', class: 'getal' }, 'In de bib'), el('th', { scope: 'col', class: 'getal' }, 'Back-up'))),
      el('tbody', {}, s.personen.map(function (p) {
        return el('tr', {}, el('td', {}, p.naam), el('td', { class: 'getal' }, String(p.bib)), el('td', { class: 'getal' }, String(p.backup)));
      })))) : el('p', {}, 'Nog geen shifts. Neem een oud rooster over via Madrigal > Eenmalig bij de start in de spreadsheet.');
    return [
      el('h3', { style: 'margin-top:1.5rem' }, 'Shifts in ' + s.jaar),
      el('p', { class: 'hulptekst' }, 'Wie hoeveel vrijdagen de bib openhield of back-up was, volgens het tabblad Shifts. Handig om te bedanken.'),
      tabel,
      s.dicht.length ? el('div', {}, el('h4', {}, 'Dicht of workshop'), el('ul', {}, s.dicht.map(function (d) {
        return el('li', {}, D.korteDatum(d.datum) + ': ' + (d.rol === 'workshop' ? 'workshop' : 'gesloten'));
      }))) : null
    ];
  }

  /** Leners en collectie: nieuwe leners, actieve leners, uitleenduur, boeken die nooit uitgeleend werden. */
  function extraCijfersBlok() {
    var x = cijfers.extraCijfers;
    if (!x) return null;
    return [
      el('h3', { style: 'margin-top:1.5rem' }, 'Leners en collectie'),
      el('p', { class: 'groot-getal' }, el('strong', {}, String(x.actieveLeners)), ' leners leenden het voorbije jaar iets.'),
      el('p', { class: 'groot-getal' }, el('strong', {}, String(x.mediaanDagen)), ' dagen duurt een uitlening meestal (mediaan van ' + x.afgesloten + ' afgesloten uitleningen).'),
      x.langerDanHalfJaar ? el('p', { class: 'hulptekst' }, x.langerDanHalfJaar + (x.langerDanHalfJaar === 1 ? ' uitlening duurde' : ' uitleningen duurden') + ' langer dan een half jaar. Klopt de datum terug? Kijk het na in het tabblad Uitleningen.') : null,
      el('h4', {}, 'Nieuwe leners per maand'),
      staafTabel('Nieuwe leners per maand', 'Maand', x.nieuweLeners.map(function (m) { return [m.maand, m.aantal]; })),
      el('h4', {}, 'Nooit uitgeleend'),
      el('p', {}, x.nooitUitgeleend + ' uitleenbare boeken werden nog nooit uitgeleend.'),
      el('p', { class: 'hulptekst' }, 'Oude uitleningen verdwijnen bij de privacy-opruiming. Deze cijfers gaan dus enkel over wat er nog bewaard is.')
    ];
  }

  /* ---------- Vandaag ---------- */

  /** Wat vandaag aandacht vraagt, met een knop naar het onderdeel. Enkel wat niet nul is. */
  function toonVandaag(vak) {
    var klaar = (data.reservaties || []).filter(function (r) { return r.status === 'klaar om op te halen'; }).length;
    var wacht = (data.reservaties || []).length - klaar;
    var boeken = data.boeken || [];
    var zonderCover = boeken.filter(function (b) { return !b.c; }).length;
    var zonderTekst = boeken.filter(function (b) { return b.zb; }).length;
    var punten = [
      [data.telaat.length, data.telaat.length === 1 ? 'uitlening is te laat' : 'uitleningen zijn te laat', 'Stuur een herinnering.', 'telaat', 'telaat'],
      [data.binnenkort.length, data.binnenkort.length === 1 ? 'uitlening vervalt binnenkort' : 'uitleningen vervallen binnenkort', '', 'binnenkort', 'binnenkort'],
      [klaar, klaar === 1 ? 'reservatie ligt klaar om op te halen' : 'reservaties liggen klaar om op te halen', '', 'reservaties', ''],
      [wacht, wacht === 1 ? 'reservatie wacht op een boek' : 'reservaties wachten op een boek', '', 'reservaties', ''],
      [VRIJWILLIGER ? 0 : (data.aanvragen || []).length, 'aanvragen van de website', 'Neem contact op en handel ze af.', 'aanvragen', ''],
      [VRIJWILLIGER ? 0 : (data.meldingen || []).length, (data.meldingen || []).length === 1 ? 'melding van een vrijwilliger' : 'meldingen van vrijwilligers', 'Volg op en zet ze op afgehandeld.', 'meldingen', 'binnenkort'],
      [VRIJWILLIGER ? 0 : (data.beschrijvingVoorstellen || []).length, (data.beschrijvingVoorstellen || []).length === 1 ? 'voorgestelde beschrijving wacht op goedkeuring' : 'voorgestelde beschrijvingen wachten op goedkeuring', '', 'voorstellen', ''],
      [VRIJWILLIGER ? 0 : data.voorstellen || 0, data.voorstellen === 1 ? 'voorstel van een vrijwilliger wacht op goedkeuring' : 'voorstellen van vrijwilligers wachten op goedkeuring', '', 'inhoud', ''],
      [zonderCover, zonderCover === 1 ? 'boek heeft nog geen cover' : 'boeken hebben nog geen cover', '', VRIJWILLIGER ? 'covers' : 'boeken', '', function (vak2) { W.covers(vak2, context()); }],
      [zonderTekst, zonderTekst === 1 ? 'boek heeft nog geen beschrijving' : 'boeken hebben nog geen beschrijving', VRIJWILLIGER ? 'Stel er een voor.' : '', VRIJWILLIGER ? 'beschrijvingen' : 'boeken', '', VRIJWILLIGER ? null : function (vak2) { W.zonderBeschrijving(vak2, context()); }]
    ].filter(function (p) { return p[0] > 0; });
    D.vervang(vak, kop('Vandaag', 'Wat aandacht vraagt. Klik op Open om ernaartoe te gaan.'),
      VRIJWILLIGER ? V.welkomBlok(context()) : null,
      VRIJWILLIGER ? V.shiftBlok(context()) : null,
      V.briefjes(context()),
      punten.length ? el('ul', { class: 'kaartlijst' }, punten.map(function (p) {
        return el('li', { class: 'kaart' + (p[4] ? ' ' + p[4] : '') }, el('p', {}, el('strong', { class: 'vandaag-getal' }, String(p[0])), ' ', p[1]),
          p[2] ? el('p', { class: 'hulptekst' }, p[2]) : null,
          el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede', onclick: function () {
            toonSectie(p[3], true);
            if (p[5]) p[5]($('sectie'));
          } }, 'Open')));
      })) : el('p', {}, 'Niets dringends. Alles is in orde.'),
      VRIJWILLIGER ? V.rondleidingKnop(context()) : el('p', {}, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonSectie('logboek', true); } }, 'Logboek en achtergrondtaken bekijken')));
  }

  /* ---------- Logboek en taken ---------- */

  var STATUS_TAAK = { loopt: 'loopt nu', gepland: 'gaat vanzelf verder', stil: 'staat stil', klaar: 'klaar' };

  function uurTekst(ms) {
    var d = new Date(ms);
    return ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /** De achtergrondtaken (hoeveel boeken nog, loopt ze) en de laatste regels van het Logboek. */
  function toonLogboek(vak) {
    D.vervang(vak, kop('Logboek en taken'), el('p', {}, 'Laden...'));
    B.voerUit('beheerLogboek').then(function (r) {
      if (actief !== 'logboek') return;
      if (!r.ok) { D.vervang(vak, kop('Logboek en taken'), el('p', { class: 'melding fout' }, r.fout || 'Het Logboek laden lukte niet.')); return; }
      var filter = el('select', { id: 'logboek-filter' }, [el('option', { value: '' }, 'Alle acties')].concat(
        r.logboek.map(function (x) { return x.actie; }).filter(function (a, i, alle) { return a && alle.indexOf(a) === i; }).sort()
          .map(function (a) { return el('option', { value: a }, a); })));
      var zoek = el('input', { type: 'search', id: 'logboek-zoek', autocomplete: 'off', placeholder: 'Woord in de regel' });
      var lijst = el('div', { 'aria-live': 'polite' });
      function teken() {
        var q = zoek.value.trim().toLowerCase();
        var regels = r.logboek.filter(function (x) {
          return (!filter.value || x.actie === filter.value) && (!q || (x.wie + ' ' + x.actie + ' ' + x.details).toLowerCase().indexOf(q) > -1);
        });
        D.vervang(lijst, regels.length ? el('ul', { class: 'logboek' }, regels.map(function (x) {
          return el('li', {}, el('span', { class: 'logboek-tijd' }, x.tijd ? uurTekst(x.tijd) : ''), ' ',
            el('strong', {}, x.actie), ' ', el('span', { class: 'hulptekst' }, x.wie), el('div', {}, x.details));
        })) : el('p', {}, 'Geen regels gevonden.'));
      }
      filter.addEventListener('change', teken);
      zoek.addEventListener('input', teken);
      var taken = r.taken.filter(function (t) { return t.teGaan > 0 || t.status === 'loopt' || t.status === 'gepland'; });
      D.vervang(vak, kop('Logboek en taken', 'De taken die op de achtergrond boeken opzoeken, en de laatste ' + r.logboek.length + ' regels van het Logboek. Een taak die stilstaat, start je in de spreadsheet via het menu Madrigal.'),
        r.daglimiet ? el('p', { class: 'melding fout' }, 'De daglimiet van Google voor vragen naar buiten is op sinds ' + uurTekst(r.daglimiet) + '. De taken gaan vanzelf verder als ze weer vrij is.') : null,
        el('h3', {}, 'Achtergrondtaken'),
        taken.length ? el('div', { class: 'tabel-wrap' }, el('table', {},
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Taak'), el('th', { scope: 'col' }, 'Nog te doen'), el('th', { scope: 'col' }, 'Stand'))),
          el('tbody', {}, taken.map(function (t) {
            return el('tr', {}, el('td', {}, t.naam), el('td', {}, String(t.teGaan)),
              el('td', {}, STATUS_TAAK[t.status] + (t.status === 'loopt' && t.sinds ? ' (sinds ' + uurTekst(t.sinds).slice(-5) + ')' : '')));
          })))) : el('p', {}, 'Alle taken zijn klaar.'),
        el('h3', {}, 'Logboek'),
        el('div', { class: 'veld' }, el('label', { for: 'logboek-filter' }, 'Actie'), filter),
        el('div', { class: 'veld' }, el('label', { for: 'logboek-zoek' }, 'Zoek'), zoek),
        lijst,
        el('div', { class: 'knoppen' }, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonLogboek(vak); } }, 'Vernieuw')));
      teken();
    });
  }

  /* ---------- Hoe werkt dit? ---------- */

  /** Korte uitleg per onderdeel, uitklapbaar boven het onderdeel. */
  var HULP = {
    vandaag: 'Hier zie je wat vandaag aandacht vraagt. Klik op Open om naar het onderdeel te gaan. Staat er niets, dan is alles in orde.',
    telaat: 'Deze boeken hadden al terug moeten zijn. Bestuur: open de herinnering in WhatsApp of je mail, verstuur ze, en klik daarna op Herinnering verstuurd. Met Verstuur de herinneringen een voor een ga je ze snel na elkaar af. Is het boek terug? Klik op Teruggebracht.',
    binnenkort: 'Deze boeken moeten binnenkort terug. Een vriendelijke herinnering op tijd voorkomt dat ze te laat komen. Wil de lener langer lezen? Klik op Verleng.',
    lopend: 'Alle boeken die nu uitgeleend zijn. Zoek op titel, exemplaar, lenersnummer of voornaam, of toon enkel wat te laat is. Teruggebracht en Verleng werken zoals aan de balie. Onder Meer opties annuleer je een verlenging of een uitlening na een vergissing. Het bestuur kan er ook de termijn aanpassen, bv. 7 dagen extra.',
    reservaties: 'Per boek de wachtrij. Komt een gereserveerd boek terug, dan legt het uitleenscherm het apart voor de eerste in de rij.',
    aanvragen: 'Reservaties die via de website binnenkwamen. Neem contact op met de lener en handel de aanvraag daarna af.',
    leners: 'Zoek een lener om de gegevens aan te passen, te zien wat die leent of leende, of meteen een boek uit te lenen. Met Nieuwe lener schrijf je iemand in, met dezelfde privacyverklaring als aan de balie.',
    borgen: 'Hoeveel borg er nu in kas zit, per betaalwijze, en welke borgen nog terugbetaald moeten worden.',
    uitzonderingen: 'Telkens iemand een grens overschreed (bv. te veel boeken tegelijk), met de reden die toen opgegeven werd.',
    boeken: 'Zoek een boek om het aan te passen. Je kan ook een ISBN scannen, een schenking boek na boek invoeren, meerdere boeken tegelijk aanpassen, of de catalogus downloaden als CSV voor Excel.',
    covers: 'Boeken zonder cover. Neem een foto van de voorkant met je gsm, of laat de site zoeken op het internet.',
    boekstatus: 'Boeken die verloren zijn of gevoelige inhoud hebben. Je past de status aan bij het boek zelf.',
    inhoud: 'Nieuws, agenda en veelgestelde vragen voor de website. Voorstellen van vrijwilligers verschijnen pas na goedkeuring.',
    leeslijsten: 'Stel lijsten samen voor de website, bijvoorbeeld voor een themamaand. Je kan ze plannen met een begin- en einddatum.',
    instellingen: 'De teksten en instellingen van de website en het uitleensysteem. Codes en sleutels pas je enkel in de spreadsheet aan.',
    cijfers: 'Uitleningen per maand, de meest geleende boeken, bezoekers van de website, en cijfers over leners en de collectie.',
    logboek: 'De achtergrondtaken die boeken opzoeken (Wikipedia, Google, covers) en de laatste regels van het Logboek. Staat een taak stil, start ze dan in de spreadsheet via het menu Madrigal.',
    rooster: 'Wie wanneer de bib openhoudt. Je beschikbaarheid geef je door in de roostertool.',
    mijn: 'Je voorgestelde beschrijvingen en je meldingen van de laatste 60 dagen, met wat het bestuur ermee deed. Het scherm zoekt op de voornaam waarmee je aanmeldt.',
    tevervangen: 'Boeken die verloren zijn en een nieuw exemplaar nodig hebben. Het bestuur beslist: vervangen of niet.',
    terugzetten: 'De boeken die vandaag terugkwamen, per onderwerp, zodat je weet in welke kast ze horen. Vink aan wat terug staat.',
    opzoeken: 'Zoek een boek op titel, auteur, ISBN of boek-ID, of scan het ISBN. Je ziet hoeveel exemplaren er zijn, wanneer uitgeleende exemplaren terug moeten en hoeveel mensen wachten. Namen van leners zie je hier niet.',
    meldingen: 'Wat vrijwilligers via Iets melden doorgaven: een kapot boek, iets kwijt, een vraag van een lener. Volg op en klik op Afgehandeld.',
    shift: 'De punten om af te werken bij het openen en sluiten van de bib. Wat je afvinkt, onthoudt dit toestel tot het einde van de dag. Het bestuur past de punten aan bij Teksten en instellingen.',
    melden: 'Geef iets door aan het bestuur: een kapot boek, iets dat kwijt is, of een vraag van een lener die je niet kon beantwoorden.',
    beschrijvingen: 'Boeken zonder beschrijving. Kies een boek en stel een tekst voor, of neem een foto van de achterkant. Het bestuur keurt je voorstel goed voor het op de website komt.',
    voorstellen: 'Beschrijvingen die vrijwilligers voorstelden. Lees na, verbeter waar nodig en klik op Keur goed. Dan staat de tekst in de Catalogus en op de website.',
    kast: 'Kies een kast (onderwerp en eventueel letters van de auteurs) en scan de boeken die er staan. Het scherm toont wat ontbreekt, wat uitgeleend is en wat niet in de kast hoort. Boeken zonder ISBN vink je met de hand aan.'
  };

  function toonHulp(naam) {
    var vak = $('hulp');
    if (!vak) return;
    D.vervang(vak, HULP[naam] ? el('details', { class: 'hulp' }, el('summary', {}, 'Hoe werkt dit?'), el('p', {}, HULP[naam])) : null);
  }

  /* ---------- Donkere modus en grotere letters ---------- */

  var THEMA = 'madrigal_thema'; // dezelfde keuze als op de publieke site (layout.js)
  var LETTERS = 'madrigal_letters';

  function leesKeuze(sleutel) { try { return localStorage.getItem(sleutel) || ''; } catch (e) { return ''; } }
  function bewaarKeuze(sleutel, w) { try { localStorage.setItem(sleutel, w); } catch (e) { /* enkel voor deze pagina */ } }

  function zetWeergave() {
    var donker = leesKeuze(THEMA) === 'dark' || (!leesKeuze(THEMA) && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', donker ? 'dark' : 'light');
    document.documentElement.classList.toggle('groot-lettertype', leesKeuze(LETTERS) === 'groot');
    if ($('thema-knop')) { $('thema-knop').textContent = donker ? 'Lichte modus' : 'Donkere modus'; $('thema-knop').setAttribute('aria-pressed', donker ? 'true' : 'false'); }
    if ($('letter-knop')) { var groot = leesKeuze(LETTERS) === 'groot'; $('letter-knop').textContent = groot ? 'Gewone letters' : 'Grotere letters'; $('letter-knop').setAttribute('aria-pressed', groot ? 'true' : 'false'); }
  }
  if ($('thema-knop')) $('thema-knop').addEventListener('click', function () {
    bewaarKeuze(THEMA, document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    zetWeergave();
  });
  if ($('letter-knop')) $('letter-knop').addEventListener('click', function () {
    bewaarKeuze(LETTERS, leesKeuze(LETTERS) === 'groot' ? '' : 'groot');
    zetWeergave();
  });
  zetWeergave();

  /* ---------- Start ---------- */

  var gestart = false;
  $('vernieuw').addEventListener('click', function () { W.vergeet(); bezoekCijfers = {}; cijfers = null; bezigSindsCache = false; laad(); });
  $('afmelden').addEventListener('click', B.afmelden);

  B.aanmelden({
    codeSleutel: VRIJWILLIGER ? 'madrigal_code_vrijwilliger' : 'madrigal_code_bestuur',
    reserveSleutel: VRIJWILLIGER ? 'madrigal_code_bestuur' : null,
    vereisteRol: VRIJWILLIGER ? 'vrijwilliger' : 'bestuur',
    // Met de bestuurscode in het vrijwilligersscherm zie je precies wat een vrijwilliger ziet.
    alsRol: VRIJWILLIGER ? 'vrijwilliger' : '',
    afmeldenNaInactiviteit: true,
    // Met een bewaarde code: meteen laden, tegelijk met de controle van de code.
    snelStart: function () { gestart = true; laad(); },
    bijAangemeld: function () {
      if (VRIJWILLIGER && B.sessie.echteRol === 'bestuur') $('als-vrijwilliger').hidden = false;
      if (!gestart) laad();
      gestart = true;
      // Bestuur: de gegevens van het vrijwilligersscherm alvast ophalen zodra je naar Bekijk als vrijwilliger wijst.
      var als = document.querySelector('a[href="vrijwilliger.html"]');
      if (!VRIJWILLIGER && als) ['pointerenter', 'focus', 'touchstart'].forEach(function (n) {
        als.addEventListener(n, function () { B.haalAlvastOp('vrijwilligerData', 'madrigal_data_vrijwilliger'); }, { passive: true });
      });
    }
  });
})();
