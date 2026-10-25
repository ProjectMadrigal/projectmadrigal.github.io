/**
 * bestuur.js
 * Het bestuursscherm: te laat, vervalt binnenkort, lopende uitleningen,
 * borgen en giften, reservaties, uitzonderingen, leners en cijfers.
 * Daarnaast boeken, nieuws, agenda en instellingen aanpassen (bestuur-beheer.js).
 * Herinneringen verstuur je zelf (WhatsApp, sms of mail). Dit scherm kopieert
 * de tekst en noteert daarna dat de herinnering verstuurd is.
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
  var $ = function (id) { return document.getElementById(id); };

  var data = null;
  var VRIJWILLIGER = document.body.getAttribute('data-scherm') === 'vrijwilliger';
  var actief = 'telaat';

  /**
   * De onderdelen: [sleutel, knoptekst, functie, groep, scherm]. De groepen staan in GROEPEN.
   * scherm: 'beide' staat ook in het vrijwilligersscherm, 'vrijwilliger' enkel daar, leeg enkel bij het bestuur.
   */
  var ALLE_SECTIES = [
    ['telaat', 'Te laat', toonTeLaat, 'uitlenen', 'beide'],
    ['binnenkort', 'Vervalt binnenkort', toonBinnenkort, 'uitlenen', 'beide'],
    ['lopend', 'Alle uitleningen', toonLopend, 'uitlenen', 'beide'],
    ['reservaties', 'Reservaties', toonReservaties, 'uitlenen', 'beide'],
    ['aanvragen', 'Aanvragen van de website', toonAanvragen, 'uitlenen'],
    ['leners', 'Leners', toonLeners, 'uitlenen'],
    ['borgen', 'Borgen en giften', toonBorgen, 'uitlenen'],
    ['uitzonderingen', 'Uitzonderingen', toonUitzonderingen, 'uitlenen'],
    // De website aanpassen: zie bestuur-beheer.js.
    ['boeken', 'Boeken', function (vak) { W.boeken(vak, context()); }, 'website'],
    ['covers', 'Boeken zonder cover', function (vak) { W.covers(vak, context()); }, 'website', 'vrijwilliger'],
    ['boekstatus', 'Verloren en gevoelig', toonBoekstatus, 'website'],
    ['inhoud', 'Nieuws en agenda', function (vak) { W.inhoud(vak, context()); }, 'website', 'beide'],
    ['leeslijsten', 'Leeslijsten', function (vak) { W.leeslijsten(vak, context()); }, 'website', 'beide'],
    ['instellingen', 'Teksten en instellingen', function (vak) { W.instellingen(vak, context()); }, 'website'],
    ['cijfers', 'Cijfers', toonCijfers, 'overzicht'],
    ['rooster', 'Rooster', toonRoosterSectie, 'overzicht', 'beide']
  ];
  var SECTIES = ALLE_SECTIES.filter(function (s) {
    return VRIJWILLIGER ? s[4] === 'beide' || s[4] === 'vrijwilliger' : s[4] !== 'vrijwilliger';
  });

  var GROEPEN = [['uitlenen', 'Uitlenen'], ['website', 'Website'], ['overzicht', 'Overzicht']];

  /** Wat bestuur-beheer.js nodig heeft van dit scherm. */
  function context() {
    return { data: data, kop: kop, laad: laad, scherm: VRIJWILLIGER ? 'vrijwilliger' : 'bestuur' };
  }

  /* ---------- Gegevens en navigatie ---------- */

  function laad() {
    return B.voerUit(VRIJWILLIGER ? 'vrijwilligerData' : 'bestuurData').then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout || 'De gegevens konden niet laden.'); return; }
      data = r.data;
      $('bestuur-info').textContent = 'Aangemeld als ' + B.sessie.wie + ' · ' + data.vandaagTekst;
      tekenNav();
      toonSectie(actief, false);
    });
  }

  function tekenNav() {
    D.vervang($('sectienav'), GROEPEN.map(function (g) {
      var kopId = 'navgroep-' + g[0];
      return el('div', { class: 'navgroep', role: 'group', 'aria-labelledby': kopId },
        el('span', { class: 'navgroep-kop', id: kopId }, g[1]),
        el('div', { class: 'navgroep-knoppen' }, SECTIES.filter(function (s) { return s[3] === g[0]; }).map(function (s) {
          var aantal = s[0] === 'telaat' ? data.telaat.length : s[0] === 'binnenkort' ? data.binnenkort.length
            : s[0] === 'aanvragen' ? (data.aanvragen || []).length : null;
          // Voorstellen van vrijwilligers die op goedkeuring wachten.
          var extra = s[0] === 'inhoud' && data.voorstellen ? ' (' + data.voorstellen + ' te keuren)' : '';
          if (s[0] === 'aanvragen' && !data.onlineReserveren && !(data.aanvragen || []).length) return null;
          return el('button', {
            type: 'button', class: 'knop' + (s[0] === actief ? '' : ' tweede'), 'aria-pressed': s[0] === actief ? 'true' : 'false',
            onclick: function () { toonSectie(s[0], true); }
          }, s[1] + (aantal !== null ? ' (' + aantal + ')' : '') + extra);
        })));
    }));
  }

  function toonSectie(naam, focus) {
    actief = naam;
    tekenNav();
    // Enkel bij een wissel door de gebruiker: anders verdwijnt een net getoonde bevestiging.
    if (focus) D.vervang($('melding'));
    var sectie = SECTIES.filter(function (s) { return s[0] === naam; })[0];
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

  function herinneringKaart(u) {
    var kopieerKnop = el('button', { type: 'button', class: 'knop' }, 'Kopieer herinnering');
    kopieerKnop.addEventListener('click', function () { kopieer(u.herinnering, kopieerKnop); });
    var verstuurdKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Herinnering verstuurd');
    verstuurdKnop.addEventListener('click', function () {
      verstuurdKnop.disabled = true;
      B.voerUit('herinneringVerstuurd', { uitlening_id: u.uitlening_id }).then(function (r) {
        if (!r.ok) { verstuurdKnop.disabled = false; B.melding($('melding'), 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', 'Herinnering voor "' + u.titel + '" genoteerd.');
        laad();
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
      el('div', { class: 'knoppen' }, kopieerKnop, verstuurdKnop));
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
      u.borg ? el('p', {}, 'Borg: ' + D.euro(u.borg) + (u.betaalwijze_borg ? ' (' + u.betaalwijze_borg + ')' : '')) : null);
  }

  function toonTeLaat(vak) {
    D.vervang(vak, kop('Te laat', VRIJWILLIGER ? 'Het bestuur stuurt de herinneringen. Komt de lener langs, dan breng je het boek terug in het uitleenscherm.'
      : 'Kopieer de herinnering, verstuur ze zelf via WhatsApp, sms of mail, en noteer daarna dat ze verstuurd is.'),
      data.telaat.length ? el('ul', { class: 'kaartlijst' }, data.telaat.map(VRIJWILLIGER ? uitleningKaart : herinneringKaart)) : el('p', {}, 'Geen boeken te laat. Fijn!'));
  }

  function toonBinnenkort(vak) {
    D.vervang(vak, kop('Vervalt binnenkort', VRIJWILLIGER ? 'Deze boeken moeten binnenkort terug.' : 'Stuur op tijd een vriendelijke herinnering.'),
      data.binnenkort.length ? el('ul', { class: 'kaartlijst' }, data.binnenkort.map(VRIJWILLIGER ? uitleningKaart : herinneringKaart)) : el('p', {}, 'Er vervalt binnenkort niets.'));
  }

  /* ---------- Lopende uitleningen ---------- */

  function toonLopend(vak) {
    D.vervang(vak, kop('Alle lopende uitleningen', data.lopend.length + (data.lopend.length === 1 ? ' boek' : ' boeken') + ' uitgeleend, gesorteerd op vervaldatum.'),
      el('ul', { class: 'kaartlijst' }, data.lopend.map(uitleningKaart)));
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
        })))));
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
      lijst('Verloren', 'Niet op de website en niet uitleenbaar.', s.verloren, 'Geen verloren boeken.'),
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
            l.toestemming_privacy === 'ja' ? null : D.statusLabel('binnenkort', 'Toestemming: ' + (l.toestemming_privacy || 'onbekend')),
            l.lopend ? D.statusLabel('uitgeleend', l.lopend + ' in huis') : null)));
      })) : el('p', {}, 'Geen lener gevonden.'));
    }
    zoekveld.addEventListener('input', teken);
    D.vervang(vak, kop('Leners', data.leners.length + ' leners. Zoek, pas aan of zet op inactief. Een inactieve lener zonder uitleningen wordt na de bewaartermijn gewist.'),
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
          telefoon: $('l-telefoon').value, email: $('l-email').value, actief: $('l-actief').checked
        }).then(function (r) {
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          B.melding($('melding'), 'ok', r.tekst);
          laad();
        });
      });
      D.vervang(vak, kop('Lener ' + l.lenersnummer), formulier);
      vak.querySelector('h2').focus();
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

  function tekenBezoekers(vak, c) {
    var tijd = function (d) { return D.korteDatum(d); };
    var lijstOfNiets = function (titel, kolom, rijen) {
      return [el('h4', {}, titel), rijen.length ? staafTabel(titel, kolom, rijen) : el('p', { class: 'hulptekst' }, 'Nog niets geteld.')];
    };
    D.vervang(vak,
      el('p', { class: 'groot-getal' }, el('strong', {}, String(c.totaal)), ' bezoekers'),
      el('p', { class: 'hulptekst' }, 'Wie dezelfde pagina meerdere keren op een dag bekijkt, telt één keer. Bezoekers met "niet volgen" in hun browser tellen niet mee. De cijfers vernieuwen elk half uur.'),
      lijstOfNiets(c.perWeek ? 'Per week' : 'Per dag', c.perWeek ? 'Week van' : 'Dag', c.verloop.map(function (s) { return [tijd(s.dag), s.n]; })),
      lijstOfNiets('Meest bekeken pagina\'s', 'Pagina', c.paginas.map(function (p) { return [paginaNaam(p), p.n]; })),
      lijstOfNiets('Vanwaar bezoekers komen', 'Bron', c.bronnen.map(function (b) { return [b.naam === '(onbekend)' ? 'Rechtstreeks of onbekend' : b.naam, b.n]; })),
      lijstOfNiets('Toestel', 'Schermgrootte', c.toestellen.map(function (b) { return [b.naam, b.n]; })),
      lijstOfNiets('Land', 'Land', c.landen.map(function (b) { return [b.naam, b.n]; })));
  }

  function toonCijfers(vak) {
    D.vervang(vak, kop('Cijfers'),
      bezoekersBlok(),
      el('h3', { style: 'margin-top:1.5rem' }, 'Uitleningen'),
      el('h4', {}, 'Uitleningen per maand'),
      staafTabel('Uitleningen per maand', 'Maand', data.perMaand.map(function (m) { return [m.maand, m.uitleningen]; })),
      el('h4', {}, 'Meest geleende boeken'),
      data.meestGeleend.length ? staafTabel('Meest geleende boeken', 'Boek', data.meestGeleend.map(function (b) { return [b.titel + (b.auteur ? ' (' + b.auteur + ')' : ''), b.aantal]; })) : el('p', {}, 'Nog geen uitleningen.'),
      el('h4', {}, 'Uitleningen per filtergroep'),
      data.groepen.length ? staafTabel('Uitleningen per filtergroep', 'Filtergroep', data.groepen.map(function (g) { return [g.groep, g.aantal]; })) : el('p', {}, 'Nog geen uitleningen.'));
  }

  /* ---------- Start ---------- */

  $('vernieuw').addEventListener('click', function () { W.vergeet(); bezoekCijfers = {}; laad(); });
  $('afmelden').addEventListener('click', B.afmelden);

  B.aanmelden({
    codeSleutel: VRIJWILLIGER ? 'madrigal_code_vrijwilliger' : 'madrigal_code_bestuur',
    reserveSleutel: VRIJWILLIGER ? 'madrigal_code_bestuur' : null,
    vereisteRol: VRIJWILLIGER ? 'vrijwilliger' : 'bestuur',
    bijAangemeld: function () { laad(); }
  });
})();
