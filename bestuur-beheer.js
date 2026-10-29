/**
 * bestuur-beheer.js
 * De onderdelen van het bestuursscherm die de website aanpassen:
 *   - Boeken: een boek zoeken en aanpassen, of een nieuw boek toevoegen (met opzoeken via het ISBN);
 *   - Nieuws en agenda: ook de veelgestelde vragen;
 *   - Leeslijsten: een lijst maken en er boeken in zetten;
 *   - Teksten en instellingen.
 * Alles komt in de spreadsheet terecht (zie apps-script/Beheer.js).
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;
  var B = root.MadrigalBeheer;
  var Z = root.MadrigalZoeken;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Hulp ---------- */

  var LABELS = {
    titel: 'Titel', auteur: 'Auteur', isbn: 'ISBN', soort: 'Soort', uitgeverij: 'Uitgeverij', jaartal: 'Jaartal',
    taal: 'Taal', paginas: 'Pagina\'s', uitvoering: 'Uitvoering', nieuwstaat: 'Nieuw of tweedehands',
    aanrader: 'Aanrader van', genre: 'Genre', extra_onderwerpen: 'Extra onderwerpen', klassieker: 'Klassieker',
    aantal: 'Aantal exemplaren', uitleenbaar: 'Uitleenbaar', publiek: 'Op de website', status: 'Status',
    startpagina: 'Op de startpagina', leeslijsten: 'Leeslijsten', beschrijving: 'Beschrijving (Nederlands)', beschrijving_en: 'Beschrijving (Engels)',
    cover_url: 'Link naar de cover', herkomst: 'Herkomst', notitie: 'Notitie (enkel voor het bestuur)',
    land: 'Land (films)', originele_titel: 'Originele titel', duur: 'Duur in minuten (films)', film_tip: 'Kijktip (film niet in de bib)', te_koop: 'Te koop',
    datum: 'Datum', uur: 'Uur', titel_en: 'Titel (Engels)', tekst: 'Tekst', tekst_en: 'Tekst (Engels)',
    locatie: 'Locatie', afbeelding: 'Link naar een afbeelding', link: 'Link voor meer info',
    online_vanaf: 'Online vanaf', zichtbaar_vanaf: 'Zichtbaar vanaf', zichtbaar_tot: 'Zichtbaar tot en met',
    naam: 'Naam', naam_en: 'Naam (Engels)', uitleg: 'Uitleg', uitleg_en: 'Uitleg (Engels)',
    volgorde: 'Volgorde', vraag: 'Vraag', vraag_en: 'Vraag (Engels)', antwoord: 'Antwoord', antwoord_en: 'Antwoord (Engels)'
  };

  var HULP = {
    auteur: 'Achternaam eerst: Verbeek, Mira. Bij een film: de regie.',
    land: 'Bij een film: het land of de landen, gescheiden door komma\'s',
    originele_titel: 'Enkel als die verschilt van de titel, bv. de titel in de taal van de film of van het oorspronkelijke boek.',
    film_tip: 'Ja: deze film is niet in de bib, maar we raden hem aan. Niet uitleenbaar.',
    aanrader: 'Voornamen, gescheiden door komma\'s. Wordt het label "Aanrader van ..."',
    leeslijsten: 'Namen van leeslijsten, gescheiden door komma\'s. Uitleg en Engelse naam zet je in het tabblad Leeslijsten.',
    extra_onderwerpen: 'Extra filtergroepen, gescheiden door komma\'s',
    status: 'Verloren: op de website als niet meer beschikbaar, niet uitleenbaar. Gevoelig verborgen: niet op de website, wel uitleenbaar. Gevoelig zichtbaar: met het label "Gevoelige inhoud".',
    startpagina: 'Automatisch: als aanrader of als het nieuw binnen is',
    beschrijving_en: 'Leeg laten: dan vertaalt het script de Nederlandse tekst',
    herkomst: 'Nooit publiek: donatie, schenker, ... Enkel zichtbaar in de spreadsheet',
    publiek: 'Nee: blijft bewaard, maar verschijnt niet op de website',
    tekst_en: 'Leeg laten: dan toont de site het Nederlands',
    volgorde: 'Kleinste getal eerst',
    online_vanaf: 'Leeg: meteen online. Een datum in de toekomst: het bericht verschijnt pas op die dag.',
    zichtbaar_vanaf: 'Leeg laten voor een lijst zonder planning. Met een datum verschijnt de lijst die dag vanzelf, ook het menu-item.',
    zichtbaar_tot: 'Leeg: blijft staan. Met een datum verdwijnt de lijst de dag erna vanzelf.',
    naam: 'Bv. Pride-maand. Geen komma\'s.',
    naam_en: 'Leeg laten: dan toont de Engelse site de Nederlandse naam',
    uitleg_en: 'Leeg laten: dan toont de Engelse site de Nederlandse uitleg'
  };

  var KEUZES = {
    soort: [['boek', 'Boek'], ['zine', 'Zine'], ['film', 'Film']],
    film_tip: [['', 'Nee'], ['ja', 'Ja, enkel een kijktip']],
    te_koop: [['', 'Nee'], ['ja', 'Ja, te koop en niet uitleenbaar']],
    nieuwstaat: [['', 'Onbekend'], ['ja', 'Nieuw'], ['nee', 'Tweedehands']],
    klassieker: [['', 'Nee'], ['ja', 'Ja']],
    uitleenbaar: [['ja', 'Ja'], ['nee', 'Nee']],
    publiek: [['ja', 'Ja'], ['nee', 'Nee, verborgen']],
    startpagina: [['', 'Automatisch'], ['ja', 'Altijd'], ['nee', 'Nooit']],
    status: [['', 'Gewoon'], ['verloren', 'Verloren'], ['gevoelig verborgen', 'Gevoelig, verborgen'], ['gevoelig zichtbaar', 'Gevoelig, zichtbaar met label']]
  };

  var LANG = ['notitie', 'beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en', 'uitleg', 'uitleg_en'];
  var GETAL = ['jaartal', 'paginas', 'aantal', 'volgorde', 'duur'];

  /** Eén veld van een formulier. Geeft { blok, lees } terug. */
  function veld(prefix, naam, waarde) {
    var id = prefix + '-' + naam;
    var w = waarde === undefined || waarde === null ? '' : String(waarde);
    var invoer;
    if (KEUZES[naam]) {
      invoer = el('select', { id: id }, KEUZES[naam].map(function (k) {
        return el('option', { value: k[0], selected: k[0] === w }, k[1]);
      }));
      // Een waarde die niet in de lijst staat (bv. zelf getypt in de spreadsheet), toch tonen.
      if (w && !KEUZES[naam].some(function (k) { return k[0] === w; })) invoer.appendChild(el('option', { value: w, selected: true }, w));
    } else if (LANG.indexOf(naam) > -1) {
      invoer = el('textarea', { id: id, rows: '5' });
      invoer.value = w;
    } else {
      var type = /^(datum|online_vanaf|zichtbaar_vanaf|zichtbaar_tot)$/.test(naam) ? 'date' : GETAL.indexOf(naam) > -1 ? 'number' : /url|afbeelding|link/.test(naam) ? 'url' : 'text';
      invoer = el('input', { type: type, id: id, value: w, autocomplete: 'off' });
      if (type === 'number') { invoer.setAttribute('min', '0'); invoer.setAttribute('inputmode', 'numeric'); }
    }
    var hulpId = HULP[naam] ? id + '-hulp' : null;
    if (hulpId) invoer.setAttribute('aria-describedby', hulpId);
    var blok = el('div', { class: 'veld' }, el('label', { for: id }, LABELS[naam] || naam),
      hulpId ? el('p', { class: 'hulptekst', id: hulpId }, HULP[naam]) : null, invoer);
    return { naam: naam, blok: blok, invoer: invoer, oud: w, lees: function () { return invoer.value; } };
  }

  /** Enkel de velden die veranderden (of alles bij iets nieuws). */
  function gewijzigd(velden, alles) {
    var uit = {};
    velden.forEach(function (v) { if (alles || v.lees() !== v.oud) uit[v.naam] = v.lees(); });
    return uit;
  }

  function knoppen() {
    return el('div', { class: 'knoppen' }, Array.prototype.slice.call(arguments));
  }

  /* ---------- Kleine covers in de lijsten ---------- */

  var coverLinksBelofte = null; // { boek_id: link }, één keer per bezoek opgehaald

  function laadCoverLinks() {
    if (!coverLinksBelofte) {
      coverLinksBelofte = B.voerUit('beheerCoverLinks').then(function (r) { return r.ok ? r.links : {}; }, function () { return {}; });
    }
    return coverLinksBelofte;
  }

  /** Een kleine cover voor in een lijst. Zonder cover: een grijs vlakje. */
  function miniCover(b) {
    var vak = el('span', { class: 'mini-cover', 'aria-hidden': 'true' });
    if (b.c) {
      laadCoverLinks().then(function (links) {
        if (!links[b.id]) return;
        var beeld = el('img', { src: links[b.id], alt: '', loading: 'lazy' });
        beeld.addEventListener('error', function () { beeld.remove(); });
        vak.appendChild(beeld);
      });
    }
    return vak;
  }

  /** Een knop in een lijst van boeken: kleine cover, titel en daaronder auteur en boek-ID. */
  function boekKnop(b, opKlik, extra) {
    return el('button', Object.assign({ type: 'button', class: 'knop keuzeknop met-mini', onclick: opKlik }, extra || {}), miniCover(b),
      el('span', { class: 'mini-tekst' }, el('strong', {}, b.t), el('span', {}, [b.a, b.id].filter(Boolean).join(' · ')),
        b.st ? el('span', { class: 'labels' }, b.st === 'verloren' ? D.statusLabel('verloren', 'Verloren') : el('span', { class: 'label label-gevoelig' }, 'Gevoelige inhoud')) : null,
        b.voorgesteld ? el('span', { class: 'labels' }, D.statusLabel('binnenkort', 'Beschrijving voorgesteld')) : null));
  }

  /* ---------- Boeken ---------- */

  var GROEPEN_BOEK = [
    ['Het boek', ['titel', 'auteur', 'isbn', 'soort', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat']],
    ['Op de website', ['status', 'publiek', 'startpagina', 'aanrader', 'leeslijsten', 'genre', 'extra_onderwerpen', 'klassieker', 'cover_url', 'beschrijving', 'beschrijving_en']],
    ['Uitlenen', ['aantal', 'uitleenbaar', 'te_koop']],
    ['Film', ['originele_titel', 'land', 'duur', 'film_tip']],
    ['Intern (niet op de website)', ['notitie']]
  ];

  var vanLijst = ''; // kwam je van de lijst zonder cover ('cover') of zonder beschrijving ('beschrijving')? Dan gaat "Terug" daarheen.
  var lijstBoeken = []; // de boeken van die lijst, in dezelfde volgorde en met de zoekterm: voor Vorig en Volgend boek
  var LIJST_STAP = 100; // zoveel boeken toont een lijst per keer
  // Per lijst: de zoekterm, hoeveel boeken je ziet en welk boek je laatst opende. Zo kom je terug waar je was.
  var lijstStand = { cover: { q: '', aantal: LIJST_STAP, laatste: '' }, beschrijving: { q: '', aantal: LIJST_STAP, laatste: '' } };

  /** Terug: in het vrijwilligersscherm naar de lijst zonder cover, anders naar Boeken. */
  function naarBoeken(vak, ctx) {
    if (ctx.scherm === 'vrijwilliger') toonZonderCover(vak, ctx); else toonBoeken(vak, ctx);
  }
  function terugTekst(ctx) {
    return ctx.scherm === 'vrijwilliger' ? 'Terug naar de lijst zonder cover' : 'Terug naar de boeken';
  }

  /** Vrijwilligersscherm: een cover toevoegen met een foto. De andere velden past het bestuur aan. */
  function coverToevoegen(vak, ctx, b) {
    D.vervang(vak, ctx.kop(b.t, [b.a, b.id].filter(Boolean).join(' · ')),
      fotoBlok({ boek_id: b.id }, null, ctx),
      knoppen.apply(null, bladerKnoppen(vak, ctx, b.id).concat(
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonZonderCover(vak, ctx); } }, 'Terug naar de lijst zonder cover'))));
    vak.querySelector('h2').focus();
  }

  /** Het boek voor (-1) of na (+1) dit boek in de lijst waar je vandaan komt, of null. */
  function buurBoek(id, richting) {
    if (!vanLijst) return null;
    var i = lijstBoeken.map(function (b) { return b.id; }).indexOf(String(id));
    return i === -1 ? null : lijstBoeken[i + richting] || null;
  }

  /** Opent een boek uit een lijst: vrijwilligers voegen een cover toe, het bestuur krijgt het hele formulier. */
  function openUitLijst(vak, ctx, b) {
    if (lijstStand[vanLijst]) lijstStand[vanLijst].laatste = b.id;
    if (ctx.scherm !== 'vrijwilliger') bewerkBoek(vak, ctx, b.id);
    else if (vanLijst === 'beschrijving') beschrijvingVoorstellen(vak, ctx, b);
    else coverToevoegen(vak, ctx, b);
  }

  /**
   * Vrijwilligersscherm: een beschrijving voorstellen. Typ ze zelf of laat de achterkant lezen.
   * Het bestuur keurt ze goed in het bestuursscherm (Voorgestelde beschrijvingen). Pas dan staat ze op de website.
   */
  function beschrijvingVoorstellen(vak, ctx, b) {
    var tekst = el('textarea', { id: 'vb-tekst', rows: '8', maxlength: '3000' });
    var fout = el('div', { 'aria-live': 'assertive' });
    var al = (ctx.data.voorgesteld || []).indexOf(b.id) > -1;
    function stelVoor(daarna) {
      return function (e) {
        e.target.disabled = true;
        B.voerUit('voorstelBeschrijving', { boek_id: b.id, tekst: tekst.value }).then(function (r) {
          e.target.disabled = false;
          if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
          ctx.data.voorgesteld = (ctx.data.voorgesteld || []).concat(b.id);
          B.melding($('melding'), 'ok', r.tekst);
          var volgend = buurBoek(b.id, 1);
          if (daarna && volgend) openUitLijst(vak, ctx, volgend); else toonZonderBeschrijving(vak, ctx);
        });
      };
    }
    var zoekterm = [b.t, (b.a || '').split(',')[0], 'boek'].filter(Boolean).join(' ');
    D.vervang(vak, ctx.kop(b.t, [b.a, b.id].filter(Boolean).join(' · ')),
      al ? el('p', { class: 'melding info' }, 'Voor dit boek ligt al een voorstel klaar. Een nieuw voorstel vervangt het vorige.') : null,
      el('p', {}, 'Schrijf in een paar zinnen waarover het boek gaat, in het Nederlands en in je eigen woorden. Het bestuur leest je voorstel na voor het op de website komt.'),
      el('p', {}, el('a', { href: 'https://www.google.com/search?q=' + encodeURIComponent(zoekterm), target: '_blank', rel: 'noopener' }, 'Zoek dit boek op Google'), ' (opent in een nieuw tabblad)'),
      el('div', { class: 'veld' }, el('label', { for: 'vb-tekst' }, 'Beschrijving'), tekst),
      achterkantBlok({ invoer: tekst }, 'Klik daarna op Stel voor.'),
      fout,
      knoppen(el('button', { type: 'button', class: 'knop', onclick: stelVoor(true) }, 'Stel voor en volgend boek'),
        el('button', { type: 'button', class: 'knop tweede', onclick: stelVoor(false) }, 'Stel voor')),
      knoppen.apply(null, bladerKnoppen(vak, ctx, b.id).concat(
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonZonderBeschrijving(vak, ctx); } }, 'Terug naar de lijst zonder beschrijving'))));
    vak.querySelector('h2').focus();
  }

  /** Vorig boek en Volgend boek, zonder te bewaren. Enkel als je uit een lijst komt. */
  function bladerKnoppen(vak, ctx, id) {
    var vorig = buurBoek(id, -1), volgend = buurBoek(id, 1);
    return [
      vorig ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { openUitLijst(vak, ctx, vorig); } }, '‹ Vorig boek') : null,
      volgend ? el('button', { type: 'button', class: 'knop tweede', onclick: function () { openUitLijst(vak, ctx, volgend); } }, 'Volgend boek ›') : null
    ].filter(Boolean);
  }

  function terugNaarLijst(vak, ctx) {
    if (vanLijst === 'cover') toonZonderCover(vak, ctx);
    else if (vanLijst === 'beschrijving') toonZonderBeschrijving(vak, ctx);
    else toonBoeken(vak, ctx);
  }
  function terugNaarLijstTekst() {
    return vanLijst === 'cover' ? 'Terug naar de lijst zonder cover' : vanLijst === 'beschrijving' ? 'Terug naar de lijst zonder beschrijving' : 'Terug naar de boeken';
  }

  function toonBoeken(vak, ctx) {
    vanLijst = '';
    var zonder = (ctx.data.boeken || []).filter(function (b) { return !b.c; }).length;
    var zonderTekst = (ctx.data.boeken || []).filter(function (b) { return b.zb; }).length;
    var index = Z.maakIndex(ctx.data.boeken || []);
    var zoekveld = el('input', { type: 'search', id: 'beheer-boek-zoek', autocomplete: 'off', placeholder: 'Titel, auteur, ISBN of boek-ID' });
    var lijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = zoekveld.value.trim();
      if (!q) { D.vervang(lijst, el('p', { class: 'hulptekst' }, 'Typ minstens een deel van een titel, auteur of ISBN.')); return; }
      var gevonden = Z.zoek(index, q).slice(0, 20).map(function (r) { return r.boek; });
      D.vervang(lijst, gevonden.length ? el('ul', { class: 'kaartlijst' }, gevonden.map(function (b) {
        return el('li', {}, boekKnop(b, function () { bewerkBoek(vak, ctx, b.id); }));
      })) : el('p', {}, 'Geen boek gevonden.'));
    }
    zoekveld.addEventListener('input', teken);
    D.vervang(vak, ctx.kop('Boeken', 'Zoek een boek om het aan te passen, of voeg een nieuw boek toe. Alles komt in het tabblad Catalogus van de spreadsheet.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { nieuwBoek(vak, ctx); } }, '+ Nieuw boek toevoegen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () {
          // Een ISBN dat al in de catalogus staat: dat boek openen. Anders een nieuw boek met dat ISBN.
          scanIsbn().then(function (isbn) {
            if (!isbn) return;
            var bekend = (ctx.data.boeken || []).filter(function (b) { return String(b.i) === isbn; })[0];
            if (bekend) bewerkBoek(vak, ctx, bekend.id); else boekFormulier(vak, ctx, {}, true, { isbn: isbn });
          });
        } }, 'Scan een ISBN'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonCoversZoeken(vak, ctx); } }, 'Zoek ontbrekende covers en beschrijvingen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonZonderCover(vak, ctx); } }, 'Boeken zonder cover (' + zonder + ')'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonZonderBeschrijving(vak, ctx); } }, 'Boeken zonder beschrijving (' + zonderTekst + ')'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonIaControle(vak, ctx); } }, 'Controleer covers van Internet Archive')),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonReeksStart(vak, ctx); } }, 'Schenking invoeren (boek na boek)'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBulk(vak, ctx); } }, 'Meerdere boeken tegelijk aanpassen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { downloadCsv('catalogus.csv', ctx.data.boeken || []); } }, 'Download de catalogus (CSV)')),
      el('div', { class: 'veld' }, el('label', { for: 'beheer-boek-zoek' }, 'Zoek een boek'), zoekveld), lijst);
    teken();
  }

  /** Kijkt alle covers van Internet Archive na en toont die met enkel het logo, om ze te wissen. */
  function toonIaControle(vak, ctx) {
    var voortgang = el('progress', { max: '1', value: '0', style: 'width:100%' });
    var status = el('p', { 'aria-live': 'polite' }, 'Lijst ophalen...');
    var resultaat = el('div');
    D.vervang(vak, ctx.kop('Covers van Internet Archive nakijken', 'Heeft een boek bij Internet Archive geen afbeelding, dan toont die het eigen logo. Deze pagina zoekt die logo\'s. Je ziet ze eerst, daarna kan je ze wissen.'),
      voortgang, status, resultaat, knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { naarBoeken(vak, ctx); } }, terugTekst(ctx))));
    B.voerUit('beheerIaCovers').then(function (r) {
      if (!r.ok) { status.textContent = r.fout || 'De lijst laden lukte niet.'; return; }
      var boeken = r.boeken, slecht = [], gedaan = 0;
      if (!boeken.length) { status.textContent = 'Er zijn geen covers van Internet Archive.'; return; }
      voortgang.max = boeken.length;
      var volgende = 0;
      function werker() {
        if (volgende >= boeken.length) return Promise.resolve();
        var b = boeken[volgende++];
        return isStaandBeeld(b.cover).then(function (staand) {
          if (staand !== true) { b.reden = staand === null ? 'laadt niet' : 'logo of geen boekcover'; slecht.push(b); }
          gedaan++; voortgang.value = gedaan;
          status.textContent = gedaan + ' van ' + boeken.length + ' nagekeken, ' + slecht.length + ' zonder echte cover.';
          return werker();
        });
      }
      // Vier tegelijk: sneller, maar zonder Internet Archive te overladen.
      Promise.all([werker(), werker(), werker(), werker()]).then(function () {
        if (!slecht.length) { status.textContent = 'Alle ' + boeken.length + ' covers van Internet Archive zijn echte covers.'; return; }
        var wis = el('button', { type: 'button', class: 'knop' }, 'Wis deze ' + slecht.length + ' covers');
        wis.addEventListener('click', function () {
          var klaar = bezig(wis, 'Bezig met wissen...');
          B.voerUit('beheerIaCoversWissen', { ids: slecht.map(function (b) { return b.id; }) }).then(function (a) {
            klaar();
            if (!a.ok) { status.textContent = a.fout; return; }
            wis.hidden = true;
            status.textContent = a.tekst + ' Die boeken staan nu in de lijst Boeken zonder cover, en Google zoekt ze opnieuw op.';
            slecht.forEach(function (s) { (ctx.data.boeken || []).forEach(function (x) { if (x.id === s.id) x.c = false; }); });
          });
        });
        D.vervang(resultaat,
          el('p', {}, slecht.length + ' covers tonen geen boek. Kijk ze even na:'),
          el('ul', { class: 'aanraders', style: 'margin-bottom:1rem' }, slecht.map(function (b) {
            return el('li', { class: 'aanrader' }, el('img', { src: b.cover, alt: '', loading: 'lazy', style: 'width:100%;max-width:8rem;border:1px solid var(--kleur-rand)' }),
              el('span', { class: 'aanrader-titel' }, b.t), el('span', { class: 'aanrader-auteur' }, [b.a, b.id, b.reden].filter(Boolean).join(' · ')));
          })),
          knoppen(wis));
      });
    });
  }

  /** Alle boeken zonder cover, alfabetisch: handig om met je gsm langs de kasten te gaan en foto's te nemen. */
  function toonZonderCover(vak, ctx) { toonLijst(vak, ctx, 'cover'); }

  /** Alle boeken zonder beschrijving, alfabetisch. Kies een boek om de beschrijving in te vullen of de achterkant te laten lezen. */
  function toonZonderBeschrijving(vak, ctx) { toonLijst(vak, ctx, 'beschrijving'); }

  /**
   * De lijst zonder cover of zonder beschrijving. Toont telkens 100 boeken meer met de knop onderaan.
   * Kom je terug uit een boek, dan staan de zoekterm en het aantal zoals je ze liet, en sta je bij dat boek.
   */
  function toonLijst(vak, ctx, soort) {
    vanLijst = soort;
    var cover = soort === 'cover';
    var stand = lijstStand[soort];
    var voorgesteld = ctx.data.voorgesteld || [];
    var alle = (ctx.data.boeken || []).filter(function (b) { return cover ? !b.c : b.zb; })
      .map(function (b) { return !cover && voorgesteld.indexOf(b.id) > -1 ? Object.assign({}, b, { voorgesteld: true }) : b; })
      .sort(function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); });
    var filterId = cover ? 'zonder-cover-zoek' : 'zonder-beschrijving-zoek';
    var filter = el('input', { type: 'search', id: filterId, autocomplete: 'off', placeholder: 'Titel, auteur of boek-ID' });
    filter.value = stand.q;
    var vakLijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = Z.normaliseer(stand.q);
      lijstBoeken = alle.filter(function (b) { return !q || Z.normaliseer([b.t, b.a, b.id].join(' ')).indexOf(q) > -1; });
      var zichtbaar = lijstBoeken.slice(0, stand.aantal);
      var rest = lijstBoeken.length - zichtbaar.length;
      D.vervang(vakLijst, zichtbaar.length ? el('ul', { class: 'kaartlijst' }, zichtbaar.map(function (b) {
        return el('li', {}, boekKnop(b, function () { openUitLijst(vak, ctx, b); }, { 'data-id': b.id }));
      })) : el('p', {}, alle.length ? 'Geen boek gevonden.' : cover ? 'Alle boeken hebben een cover.' : 'Alle boeken hebben een beschrijving.'),
      rest > 0 ? el('p', {}, zichtbaar.length + ' van ' + lijstBoeken.length + ' boeken getoond.') : null,
      rest > 0 ? knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        var eerste = stand.aantal;
        stand.aantal += LIJST_STAP;
        teken();
        // De focus naar het eerste nieuwe boek, zodat je verder kan zonder te zoeken.
        var knop = vakLijst.querySelectorAll('.kaartlijst button')[eerste];
        if (knop) knop.focus();
      } }, 'Toon er nog ' + Math.min(LIJST_STAP, rest))) : null);
    }
    filter.addEventListener('input', function () { stand.q = filter.value; stand.aantal = LIJST_STAP; teken(); });
    var vrijwilliger = ctx.scherm === 'vrijwilliger';
    var zoekKnop = knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonCoversZoeken(vak, ctx); } },
      cover ? 'Zoek covers automatisch op het internet' : 'Zoek beschrijvingen automatisch op het internet'));
    var terug = vrijwilliger ? null : knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken'));
    var uitleg = !cover && vrijwilliger
      ? 'Kies een boek en stel een beschrijving voor. Typ ze zelf, of neem een foto van de achterkant: de site leest de tekst voor je. Het bestuur keurt je voorstel goed voor het op de website komt.'
      : cover
      ? 'Kies een boek en neem een foto van de cover met je gsm. Tip: leg het boek op een effen achtergrond, met goed licht en zonder schaduw. Met Volgend boek ga je meteen verder.'
      : 'Kies een boek. Typ de beschrijving in het veld Beschrijving, of neem een foto van de achterkant: de site leest de tekst voor je. Met Bewaar en volgend boek ga je meteen verder. Wil je eerst Google laten zoeken? Gebruik dan de knop hieronder.';
    D.vervang(vak, ctx.kop((cover ? 'Boeken zonder cover (' : 'Boeken zonder beschrijving (') + alle.length + ')', uitleg),
      (cover && !vrijwilliger) || (!cover && vrijwilliger) ? null : zoekKnop,
      el('div', { class: 'veld' }, el('label', { for: filterId }, 'Zoek in deze lijst'), filter), vakLijst,
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { downloadCsv(cover ? 'zonder-cover.csv' : 'zonder-beschrijving.csv', lijstBoeken); } }, 'Download deze lijst (CSV)'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { drukLijstAf(cover ? 'Boeken zonder cover' : 'Boeken zonder beschrijving', lijstBoeken); } }, 'Druk deze lijst af')),
      terug);
    teken();
    // Terug uit een boek: meteen bij dat boek (of het boek erna, als het intussen uit de lijst is).
    if (stand.laatste) {
      var knop = vakLijst.querySelector('[data-id="' + stand.laatste + '"]');
      if (knop) { knop.focus(); knop.scrollIntoView({ block: 'center' }); }
    }
  }

  /** Verkleint een foto in de browser (standaard tot hoogstens 600 pixels) en geeft een JPG terug (base64). */
  function verkleinFoto(bestand, max) {
    return new Promise(function (klaar, mislukt) {
      var lezer = new FileReader();
      lezer.onerror = function () { mislukt(new Error('De foto kon niet gelezen worden.')); };
      lezer.onload = function () {
        var beeld = new Image();
        beeld.onerror = function () { mislukt(new Error('Dit bestand is geen foto.')); };
        beeld.onload = function () {
          var schaal = Math.min(1, (max || 600) / Math.max(beeld.width, beeld.height));
          var doek = document.createElement('canvas');
          doek.width = Math.round(beeld.width * schaal);
          doek.height = Math.round(beeld.height * schaal);
          doek.getContext('2d').drawImage(beeld, 0, 0, doek.width, doek.height);
          klaar(doek.toDataURL('image/jpeg', 0.82));
        };
        beeld.src = lezer.result;
      };
      lezer.readAsDataURL(bestand);
    });
  }

  /** Het blok om een foto van de cover te nemen en te bewaren (enkel voor een bestaand boek). */
  /** Het blok om de tekst van de achterkant te laten lezen. Die komt in het veld beschrijving. */
  function achterkantBlok(beschrijvingVeld, slot) {
    var invoer = el('input', { type: 'file', id: 'bb-achterkant', accept: 'image/*', capture: 'environment' });
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    invoer.addEventListener('change', function () {
      var bestand = invoer.files && invoer.files[0];
      if (!bestand) return;
      melding.textContent = 'Foto verkleinen...';
      // Voor tekstherkenning is een scherpere foto nodig dan voor een cover.
      verkleinFoto(bestand, 1800).then(function (url) {
        melding.textContent = 'Tekst lezen, even geduld (tot een halve minuut)...';
        return B.voerUit('beheerTekstUitFoto', { data: url.split(',')[1], mime: 'image/jpeg' });
      }).then(function (r) {
        invoer.value = '';
        if (!r.ok) { melding.textContent = r.fout; return; }
        var huidig = beschrijvingVeld.invoer.value.trim();
        if (huidig && !window.confirm('Er staat al een beschrijving. Wil je die vervangen door de tekst van de foto?')) {
          melding.textContent = 'De bestaande beschrijving bleef staan.';
          return;
        }
        beschrijvingVeld.invoer.value = r.tekst;
        beschrijvingVeld.invoer.focus();
        melding.textContent = 'De tekst staat in het veld Beschrijving (Nederlands). Lees ze na en verbeter wat de herkenning fout las. ' + (slot || 'Klik daarna onderaan op Bewaar.');
      }, function (e) { melding.textContent = e.message; });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Tekst van de achterkant'),
      el('p', { class: 'hulptekst' }, 'Neem een foto van de achterflap, recht van boven en met goed licht. Google leest de tekst en zet ze in het veld Beschrijving. Lees ze altijd na voor je bewaart.'),
      el('div', { class: 'veld' }, el('label', { for: 'bb-achterkant' }, 'Foto van de achterkant nemen of kiezen'), invoer), melding);
  }

  function fotoBlok(boek, coverVeld, ctx) {
    var invoer = el('input', { type: 'file', id: 'bb-foto', accept: 'image/*', capture: 'environment' });
    var voorbeeld = el('img', { alt: 'Voorbeeld van de foto', hidden: true, style: 'max-width:12rem;border-radius:.4rem;margin-top:.5rem' });
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    var knop = el('button', { type: 'button', class: 'knop', disabled: true }, 'Gebruik deze foto als cover');
    var dataUrl = '';
    invoer.addEventListener('change', function () {
      var bestand = invoer.files && invoer.files[0];
      knop.disabled = true; voorbeeld.hidden = true; melding.textContent = '';
      if (!bestand) return;
      melding.textContent = 'Foto verkleinen...';
      verkleinFoto(bestand).then(function (url) {
        dataUrl = url; voorbeeld.src = url; voorbeeld.hidden = false; knop.disabled = false;
        melding.textContent = 'Ziet het er goed uit? Klik dan op de knop.';
      }, function (e) { melding.textContent = e.message; });
    });
    knop.addEventListener('click', function () {
      var klaar = bezig(knop, 'Bezig met bewaren...');
      B.voerUit('beheerCoverUpload', { boek_id: boek.boek_id, data: dataUrl.split(',')[1], mime: 'image/jpeg' }).then(function (r) {
        klaar();
        if (!r.ok) { melding.textContent = r.fout; return; }
        if (coverVeld) { coverVeld.invoer.value = r.cover_url; coverVeld.oud = r.cover_url; coverVeld.invoer.dispatchEvent(new Event('input')); }
        // Meteen uit de lijst zonder cover halen, zonder alles opnieuw te laden.
        (ctx.data.boeken || []).forEach(function (b) { if (b.id === String(boek.boek_id)) b.c = true; });
        if (coverLinksBelofte) coverLinksBelofte.then(function (l) { l[String(boek.boek_id)] = r.cover_url; });
        knop.disabled = true;
        melding.textContent = r.tekst + ' De website toont ze binnen enkele minuten.';
      });
    });
    // Of een link: naar een afbeelding, een webpagina (bv. bol.com) of uit Google Afbeeldingen.
    var link = el('input', { type: 'url', id: 'bb-cover-link', inputmode: 'url', autocomplete: 'off', placeholder: 'https://...' });
    var linkKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Gebruik deze link');
    linkKnop.addEventListener('click', function () {
      var url = link.value.trim();
      if (!url) { melding.textContent = 'Plak eerst een link.'; return; }
      if (/^data:image\//.test(url)) {
        // Uit Google Afbeeldingen komt soms de afbeelding zelf mee: die verkleinen we zoals een foto.
        melding.textContent = 'Afbeelding verkleinen...';
        fetch(url).then(function (a) { return a.blob(); }).then(function (blob) { return verkleinFoto(blob); }).then(function (u) {
          dataUrl = u; voorbeeld.src = u; voorbeeld.hidden = false; knop.disabled = false;
          melding.textContent = 'Ziet het er goed uit? Klik dan op Gebruik deze foto als cover.';
        }, function (e) { melding.textContent = e.message; });
        return;
      }
      var klaar = bezig(linkKnop, 'Afbeelding ophalen...');
      B.voerUit('beheerCoverVanLink', { boek_id: boek.boek_id, url: url }).then(function (r) {
        klaar();
        if (!r.ok) { melding.textContent = r.fout; return; }
        if (coverVeld) { coverVeld.invoer.value = r.cover_url; coverVeld.oud = r.cover_url; coverVeld.invoer.dispatchEvent(new Event('input')); }
        (ctx.data.boeken || []).forEach(function (b) { if (b.id === String(boek.boek_id)) b.c = true; });
        if (coverLinksBelofte) coverLinksBelofte.then(function (l) { l[String(boek.boek_id)] = r.cover_url; });
        voorbeeld.src = r.cover_url; voorbeeld.hidden = false; link.value = '';
        melding.textContent = r.tekst + ' De website toont ze binnen enkele minuten.';
      });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Foto of link van de cover'),
      el('p', { class: 'hulptekst' }, 'Neem met je gsm een foto van de voorkant, of kies een foto. De site verkleint ze en bewaart ze op Google Drive.'),
      el('div', { class: 'veld' }, el('label', { for: 'bb-foto' }, 'Foto nemen of kiezen'), invoer), voorbeeld, knoppen(knop),
      el('div', { class: 'veld' }, el('label', { for: 'bb-cover-link' }, 'Of plak een link ', el('span', { class: 'hulptekst' }, '(naar een afbeelding, een webpagina zoals bol.com, of uit Google Afbeeldingen)')), link),
      knoppen(linkKnop), melding);
  }

  /**
   * De huidige cover bovenaan het formulier. Volgt het veld Link naar de cover: plak je een
   * andere link of bewaar je een foto, dan zie je meteen de nieuwe cover.
   */
  function huidigeCover(coverVeld) {
    var beeld = el('img', { alt: 'Huidige cover', style: 'max-width:8rem;border:1px solid var(--kleur-rand);border-radius:.3rem' });
    var tekst = el('p', { class: 'hulptekst' });
    function toon() {
      var url = coverVeld.invoer.value.trim();
      beeld.hidden = !url;
      tekst.textContent = url ? '' : 'Dit boek heeft nog geen cover.';
      if (url && beeld.getAttribute('src') !== url) beeld.src = url;
    }
    beeld.addEventListener('error', function () { beeld.hidden = true; tekst.textContent = 'De cover op deze link laadt niet.'; });
    coverVeld.invoer.addEventListener('input', toon);
    toon();
    return el('div', { class: 'blok' }, beeld, tekst);
  }

  /**
   * Eén boek opzoeken vanuit het formulier: eerst Google Books (op ISBN, anders op titel en auteur),
   * dan Open Library voor een cover. Enkel lege velden worden ingevuld. Je kijkt na en bewaart zelf.
   */
  function zoekBlok(velden, sleutel) {
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    var knop = el('button', { type: 'button', class: 'knop tweede' }, 'Zoek dit boek op het internet');
    function veldVan(naam) { return velden.filter(function (v) { return v.naam === naam; })[0]; }
    function waarde(naam) { var v = veldVan(naam); return v ? v.lees() : ''; }
    knop.addEventListener('click', function () {
      var isbn = String(waarde('isbn')).replace(/[^0-9X]/gi, '');
      var titel = waarde('titel'), auteur = waarde('auteur');
      if (!/^\d{13}$/.test(isbn) && !titel) { melding.textContent = 'Vul eerst een ISBN of een titel in.'; return; }
      var klaar = bezig(knop, 'Bezig met zoeken...');
      var google = /^\d{13}$/.test(isbn) ? vraagGoogle(isbn, sleutel) : vraagGoogleTitel(titel, auteur, sleutel);
      var voorstel = {}, googleFout = '';
      google.then(function (a) {
        if (a.fout) googleFout = a.fout;
        if (a.info) {
          var v = a.info, links = v.imageLinks || {};
          voorstel.beschrijving = v.description || '';
          voorstel.uitgeverij = v.publisher || '';
          voorstel.jaartal = (String(v.publishedDate || '').match(/\d{4}/) || [''])[0];
          voorstel.paginas = v.pageCount ? String(v.pageCount) : '';
          voorstel.cover_url = String(links.thumbnail || links.smallThumbnail || '').replace(/^http:/, 'https:');
        }
        if (voorstel.cover_url || waarde('cover_url')) return {};
        return zoekOl({ isbn: /^\d{13}$/.test(isbn) ? isbn : '', t: titel, a: auteur });
      }).then(function (o) {
        if (o && o.cover) voorstel.cover_url = o.cover;
        klaar();
        var ingevuld = [];
        Object.keys(voorstel).forEach(function (naam) {
          var v = veldVan(naam);
          if (!v || !voorstel[naam] || v.lees()) return; // wat al ingevuld is, blijft staan
          v.invoer.value = voorstel[naam];
          v.invoer.dispatchEvent(new Event('input'));
          ingevuld.push(LABELS[naam] || naam);
        });
        melding.textContent = ingevuld.length
          ? 'Ingevuld: ' + ingevuld.join(', ') + '. Kijk het na en klik op Bewaar.'
          : (googleFout ? 'Google Books antwoordt niet (' + googleFout + '). ' : '') + 'Niets nieuws gevonden voor de lege velden.';
      });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Opzoeken op het internet'),
      el('p', { class: 'hulptekst' }, 'Zoekt dit boek bij Google Books en Open Library en vult enkel de lege velden in, zoals de beschrijving en de cover. Wat al ingevuld is, blijft staan.'),
      knoppen(knop), melding);
  }

  /**
   * Uitleningen en wijzigingen van een boek, dichtgeklapt bovenaan het formulier:
   * wie het nu leent, de wachtrij, hoe vaak het uitgeleend werd en wie het laatst aanpaste.
   */
  function boekOverzicht(ctx, boek, extra) {
    var id = String(boek.boek_id);
    var nu = (ctx.data.lopend || []).filter(function (u) { return String(u.boek_id) === id; });
    var wachtrij = (ctx.data.reservaties || []).filter(function (r) { return String(r.boek_id) === id; });
    var h = extra.historiek || { keer: 0, laatst: '' };
    var wijz = extra.wijzigingen || [];
    var kort = nu.length ? 'nu uitgeleend' : 'in huis';
    return el('details', { class: 'blok boek-overzicht' }, el('summary', {}, 'Uitleningen en wijzigingen (' + kort + (wachtrij.length ? ', ' + wachtrij.length + ' in de wachtrij' : '') + ')'),
      el('h3', {}, 'Nu'),
      nu.length ? el('ul', {}, nu.map(function (u) {
        return el('li', {}, u.exemplaar + ' bij lener ' + u.lenersnummer + (u.voornaam ? ' (' + u.voornaam + ')' : '') + ', terug tegen ' + D.korteDatum(u.vervaldatum));
      })) : el('p', {}, 'Niet uitgeleend.'),
      wachtrij.length ? el('ol', {}, wachtrij.map(function (r) { return el('li', {}, 'Lener ' + r.lenersnummer + (r.voornaam ? ' (' + r.voornaam + ')' : '') + ': ' + r.tekst); })) : null,
      el('h3', {}, 'Eerder'),
      el('p', {}, h.keer ? (h.keer === 1 ? '1 keer uitgeleend' : h.keer + ' keer uitgeleend') + ', laatst op ' + D.korteDatum(h.laatst) + '.' : 'Nog nooit uitgeleend (of de privacy-opruiming wiste de oude uitleningen).'),
      el('h3', {}, 'Laatst aangepast'),
      wijz.length ? el('ul', {}, wijz.map(function (w) {
        var d = new Date(w.tijd);
        var tijd = D.korteDatum(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2));
        var velden = w.details.indexOf(':') > -1 ? ' (' + w.details.split(':').slice(1).join(':').trim() + ')' : '';
        return el('li', {}, tijd + ', ' + w.wie + ': ' + w.actie + velden);
      })) : el('p', {}, 'Geen wijzigingen via dit scherm in het Logboek. Wat iemand rechtstreeks in de spreadsheet aanpast, staat er niet in.'));
  }

  /* ---------- ISBN scannen met de camera ---------- */

  // Chrome op Android leest streepjescodes zelf (BarcodeDetector). Andere browsers, zoals Safari op de
  // iPhone, gebruiken ZXing: een open source lezer die we pas laden als het nodig is.
  var ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  var zxingBelofte = null;

  function laadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingBelofte) {
      zxingBelofte = new Promise(function (klaar, mislukt) {
        var s = document.createElement('script');
        s.src = ZXING_URL;
        s.onload = function () { if (window.ZXing) klaar(window.ZXing); else mislukt(new Error('ZXing laadt niet.')); };
        s.onerror = function () { zxingBelofte = null; mislukt(new Error('De scanner kon niet laden.')); };
        document.head.appendChild(s);
      });
    }
    return zxingBelofte;
  }

  function isIsbn(c) { return /^97[89]\d{10}$/.test(String(c || '')); }

  /** Leest een ISBN uit een canvas met ZXing. Geeft het ISBN of ''. */
  function leesIsbnZxing(ZX, canvas) {
    try {
      var hints = new Map();
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [ZX.BarcodeFormat.EAN_13]);
      hints.set(ZX.DecodeHintType.TRY_HARDER, true);
      var lezer = new ZX.MultiFormatReader();
      lezer.setHints(hints);
      var tekst = lezer.decode(new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.HTMLCanvasElementLuminanceSource(canvas)))).getText();
      return isIsbn(tekst) ? tekst : '';
    } catch (e) {
      return ''; // geen streepjescode in dit beeld
    }
  }

  /**
   * Opent de camera en geeft een Promise met het gescande ISBN, of null als je stopt.
   * opties.doorlopend: de camera blijft open (kastcontrole). Elk nieuw ISBN gaat naar opties.bijIsbn,
   * dat de tekst teruggeeft die onder het beeld komt. Stop geeft dan null.
   */
  function scanIsbn(opties) {
    opties = opties || {};
    var vorige = '', vorigeTijd = 0;
    return new Promise(function (klaar) {
      var video = el('video', { playsinline: true, muted: true, class: 'scan-video' });
      var status = el('p', { 'aria-live': 'polite' }, 'Camera starten...');
      var stopKnop = el('button', { type: 'button', class: 'knop tweede' }, opties.doorlopend ? 'Klaar met scannen' : 'Stop');
      var dialoog = el('dialog', { class: 'scan-dialoog', 'aria-labelledby': 'scan-titel' },
        el('h2', { id: 'scan-titel' }, opties.titel || 'ISBN scannen'),
        el('p', {}, opties.uitleg || 'Richt de camera op de streepjescode op de achterkant van het boek. Hou het boek stil, met genoeg licht.'),
        video, status, knoppen(stopKnop));
      var stroom = null, klaarOk = false, doek = document.createElement('canvas');
      function einde(isbn) {
        if (klaarOk) return;
        klaarOk = true;
        if (stroom) stroom.getTracks().forEach(function (t) { t.stop(); });
        if (dialoog.open) dialoog.close();
        dialoog.remove();
        klaar(isbn || null);
      }
      stopKnop.addEventListener('click', function () { einde(null); });
      dialoog.addEventListener('cancel', function (e) { e.preventDefault(); einde(null); });
      document.body.appendChild(dialoog);
      dialoog.showModal();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'Deze browser kan de camera niet gebruiken. Typ het ISBN in.';
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
        stroom = s;
        video.srcObject = s;
        return video.play();
      }).then(function () {
        if (klaarOk) return;
        var lees;
        if ('BarcodeDetector' in window) {
          var detector = new window.BarcodeDetector({ formats: ['ean_13'] });
          lees = function () { return detector.detect(video).then(function (codes) { return codes.map(function (c) { return c.rawValue; }).filter(isIsbn)[0] || ''; }); };
        } else {
          status.textContent = 'Scanner laden...';
          lees = function () {
            return laadZxing().then(function (ZX) {
              doek.width = video.videoWidth; doek.height = video.videoHeight;
              doek.getContext('2d').drawImage(video, 0, 0);
              return leesIsbnZxing(ZX, doek);
            });
          };
        }
        (function kijk() {
          if (klaarOk) return;
          lees().then(function (isbn) {
            if (isbn && opties.doorlopend) {
              // Hetzelfde boek nog even voor de camera: niet opnieuw tellen.
              if (isbn !== vorige || Date.now() - vorigeTijd > 4000) status.textContent = opties.bijIsbn(isbn);
              vorige = isbn; vorigeTijd = Date.now();
              setTimeout(kijk, 300);
              return;
            }
            if (isbn) { einde(isbn); return; }
            if (!opties.doorlopend) status.textContent = 'Zoeken naar een streepjescode...';
            setTimeout(kijk, 300);
          }, function (e) { status.textContent = e.message || 'Scannen lukt niet. Typ het ISBN in.'; });
        })();
      }, function () {
        status.textContent = 'De camera opent niet. Geef deze site toestemming voor de camera, of typ het ISBN in.';
      });
    });
  }

  /* ---------- Downloaden en afdrukken ---------- */

  /** Een CSV voor Excel (puntkomma's, met een BOM zodat Excel de accenten goed leest). */
  function downloadCsv(naam, boeken) {
    var cel = function (w) { w = String(w === undefined || w === null ? '' : w); return /[";\n]/.test(w) ? '"' + w.replace(/"/g, '""') + '"' : w; };
    var rijen = [['boek_id', 'titel', 'auteur', 'isbn', 'exemplaren', 'cover', 'beschrijving']].concat(boeken.map(function (b) {
      return [b.id, b.t, b.a, b.i ? '\'' + b.i : '', b.x, b.c ? 'ja' : 'nee', b.zb ? 'nee' : 'ja'];
    }));
    var tekst = '\ufeff' + rijen.map(function (r) { return r.map(cel).join(';'); }).join('\r\n');
    var link = el('a', { href: URL.createObjectURL(new Blob([tekst], { type: 'text/csv;charset=utf-8' })), download: naam });
    document.body.appendChild(link);
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
  }

  /** Een lijst om af te drukken: titel, auteur en boek-ID, met een vakje om af te vinken. */
  function drukLijstAf(titel, boeken) {
    var vak = el('div', { class: 'afdruk', id: 'afdruk' }, el('h1', {}, titel + ' (' + boeken.length + ')'),
      el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'Titel'), el('th', {}, 'Auteur'), el('th', {}, 'Boek-ID'))),
        el('tbody', {}, boeken.map(function (b) { return el('tr', {}, el('td', {}, '☐'), el('td', {}, b.t), el('td', {}, b.a || ''), el('td', {}, b.id)); }))));
    document.body.appendChild(vak);
    document.body.classList.add('druk-lijst');
    window.addEventListener('afterprint', function weg() {
      document.body.classList.remove('druk-lijst');
      vak.remove();
      window.removeEventListener('afterprint', weg);
    });
    window.print();
  }

  /* ---------- Schenking: boek na boek invoeren ---------- */

  function toonReeksStart(vak, ctx) {
    var herkomst = el('input', { type: 'text', id: 'reeks-herkomst', maxlength: '120', placeholder: 'bv. schenking van een verzonnen naam, oktober 2026' });
    var fout = el('div', { 'aria-live': 'assertive' });
    D.vervang(vak, ctx.kop('Schenking invoeren', 'Vul eerst de herkomst in. Die komt bij elk boek van deze reeks. Daarna scan of typ je het ISBN, kijk je de gegevens na en klik je op Voeg toe en volgend boek. Zo gaat het boek na boek, tot je de reeks stopt.'),
      el('div', { class: 'veld' }, el('label', { for: 'reeks-herkomst' }, 'Herkomst ', el('span', { class: 'hulptekst' }, '(niet publiek)')), herkomst), fout,
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () {
        if (!herkomst.value.trim()) { B.melding(fout, 'fout', 'Vul de herkomst in.'); herkomst.focus(); return; }
        boekFormulier(vak, ctx, {}, true, { reeks: { herkomst: herkomst.value.trim(), aantal: 0 } });
      } }, 'Start'), el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));
    herkomst.focus();
  }

  /* ---------- Meerdere boeken tegelijk aanpassen ---------- */

  var BULK_VELDEN = ['genre', 'extra_onderwerpen', 'status', 'aanrader', 'startpagina', 'publiek', 'uitleenbaar', 'klassieker'];

  function toonBulk(vak, ctx) {
    var gekozen = {};
    var index = Z.maakIndex(ctx.data.boeken || []);
    var zoek = el('input', { type: 'search', id: 'bulk-zoek', autocomplete: 'off', placeholder: 'Titel, auteur, ISBN of boek-ID' });
    var lijst = el('div', { 'aria-live': 'polite' });
    var teller = el('p', { 'aria-live': 'polite' });
    var veldKeuze = el('select', { id: 'bulk-veld' }, BULK_VELDEN.map(function (v) { return el('option', { value: v }, LABELS[v] || v); }));
    var waardeVak = el('div', { class: 'veld' });
    var fout = el('div', { 'aria-live': 'assertive' });
    var gevonden = [];
    function waardeInvoer() {
      var v = veldKeuze.value;
      var invoer = KEUZES[v] ? el('select', { id: 'bulk-waarde' }, KEUZES[v].map(function (k) { return el('option', { value: k[0] }, k[1]); }))
        : el('input', { type: 'text', id: 'bulk-waarde', maxlength: '200' });
      D.vervang(waardeVak, el('label', { for: 'bulk-waarde' }, 'Nieuwe waarde'), invoer);
    }
    function tel() { var n = Object.keys(gekozen).length; teller.textContent = n + (n === 1 ? ' boek gekozen.' : ' boeken gekozen.'); }
    function teken() {
      var q = zoek.value.trim();
      gevonden = q ? Z.zoek(index, q).slice(0, 200).map(function (r) { return r.boek; }) : [];
      D.vervang(lijst, gevonden.length ? [
        knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { gevonden.forEach(function (b) { gekozen[b.id] = true; }); teken(); tel(); } }, 'Vink alle ' + gevonden.length + ' aan')),
        el('ul', { class: 'vinklijst' }, gevonden.map(function (b) {
          var id = 'bulk-' + b.id;
          var vakje = el('input', { type: 'checkbox', id: id, checked: !!gekozen[b.id] });
          vakje.addEventListener('change', function () { if (vakje.checked) gekozen[b.id] = true; else delete gekozen[b.id]; tel(); });
          return el('li', {}, el('label', { class: 'vinkje', for: id }, vakje, miniCover(b),
            el('span', {}, el('strong', {}, b.t), ' ', el('span', { class: 'hulptekst' }, [b.a, b.id].filter(Boolean).join(' · ')))));
        }))] : el('p', { class: 'hulptekst' }, q ? 'Geen boek gevonden.' : 'Zoek boeken en vink ze aan. Je kan na elkaar op verschillende woorden zoeken: wat je aanvinkte, blijft gekozen.'));
    }
    var toepassen = el('button', { type: 'button', class: 'knop' }, 'Pas aan');
    toepassen.addEventListener('click', function () {
      var ids = Object.keys(gekozen);
      if (!ids.length) { B.melding(fout, 'fout', 'Vink eerst een of meer boeken aan.'); return; }
      var waarde = $('bulk-waarde').value;
      var tekstWaarde = KEUZES[veldKeuze.value] ? $('bulk-waarde').selectedOptions[0].textContent : (waarde || '(leeg)');
      if (!window.confirm('Je zet ' + (LABELS[veldKeuze.value] || veldKeuze.value) + ' op "' + tekstWaarde + '" voor ' + ids.length + (ids.length === 1 ? ' boek' : ' boeken') + '. Doorgaan?')) return;
      var klaar = bezig(toepassen, 'Bezig met aanpassen...');
      B.voerUit('beheerBoekenBulk', { ids: ids, veld: veldKeuze.value, waarde: waarde }).then(function (r) {
        klaar();
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', r.tekst);
        ctx.laad();
      });
    });
    zoek.addEventListener('input', teken);
    veldKeuze.addEventListener('change', waardeInvoer);
    D.vervang(vak, ctx.kop('Meerdere boeken tegelijk aanpassen', 'Kies de boeken, dan het veld en de nieuwe waarde. Je krijgt eerst een samenvatting. Elke aanpassing komt in het Logboek.'),
      el('div', { class: 'veld' }, el('label', { for: 'bulk-zoek' }, 'Zoek boeken'), zoek), lijst, teller,
      el('div', { class: 'veld' }, el('label', { for: 'bulk-veld' }, 'Veld'), veldKeuze), waardeVak, fout,
      knoppen(toepassen, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));
    waardeInvoer();
    teken();
    tel();
  }

  /** Het formulier voor een boek. boek: bestaand boek of {} voor een nieuw. */
  function boekFormulier(vak, ctx, boek, nieuw, extra) {
    extra = extra || {};
    var velden = [];
    var fout = el('div', { 'aria-live': 'assertive' });
    var delen = GROEPEN_BOEK.map(function (g) {
      return el('fieldset', { class: 'blok' }, el('legend', {}, g[0]), g[1].map(function (naam) {
        var v = veld('bb', naam, boek[naam] !== undefined ? boek[naam] : (nieuw && KEUZES[naam] ? KEUZES[naam][0][0] : ''));
        velden.push(v);
        return v.blok;
      }));
    });
    var herkomst = nieuw ? veld('bb', 'herkomst', extra.reeks ? extra.reeks.herkomst : '') : null;
    var opzoekMelding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    var zoekKnop = el('button', { type: 'button', class: 'knop tweede', onclick: zoekOp }, 'Zoek gegevens op');
    var opzoeken = nieuw ? el('div', { class: 'blok' },
      el('p', {}, 'Heeft het boek een ISBN? Vul het hieronder in bij ISBN en klik op ', el('strong', {}, 'Zoek gegevens op'), '. Dan vult de site titel, auteur, cover en beschrijving voor je in. Kijk alles nog even na.'),
      knoppen(zoekKnop, el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        scanIsbn().then(function (isbn) { if (isbn) { $('bb-isbn').value = isbn; zoekKnop.click(); } });
      } }, 'Scan het ISBN met de camera')), opzoekMelding) : null;

    function zoekOp(e) {
      var isbn = $('bb-isbn').value;
      if (!isbn.trim()) { opzoekMelding.textContent = 'Vul eerst het ISBN in.'; $('bb-isbn').focus(); return; }
      var klaar = bezig(e.target, 'Bezig met zoeken...');
      B.voerUit('beheerIsbnOpzoeken', { isbn: isbn }).then(function (r) {
        klaar();
        if (!r.ok) { opzoekMelding.textContent = r.fout; return; }
        var ingevuld = 0;
        velden.forEach(function (v) {
          var w = r.voorstel[v.naam];
          if (w === undefined || w === '' || w === null) return;
          if (v.naam !== 'isbn' && v.lees()) return; // wat je zelf al invulde, blijft staan
          v.invoer.value = String(w);
          v.invoer.dispatchEvent(new Event('input'));
          ingevuld++;
        });
        opzoekMelding.textContent = r.gevonden ? ingevuld + ' velden ingevuld. Kijk ze na voor je bewaart.' : 'Open Library en Google Books kennen dit ISBN niet. Vul de gegevens zelf in.';
      });
    }

    var bewaar = el('button', { type: 'submit', class: 'knop' }, extra.reeks ? 'Voeg toe en volgend boek' : nieuw ? 'Voeg toe aan de catalogus' : 'Bewaar');
    var coverVeld = velden.filter(function (v) { return v.naam === 'cover_url'; })[0];
    var foto = nieuw ? null : fotoBlok(boek, coverVeld, ctx);
    var cover = coverVeld ? huidigeCover(coverVeld) : null;
    var opzoekenBestaand = nieuw ? null : zoekBlok(velden, extra.sleutel);
    var overzicht = nieuw ? null : boekOverzicht(ctx, boek, extra);
    var beschrijvingVeld = velden.filter(function (v) { return v.naam === 'beschrijving'; })[0];
    var achterkant = beschrijvingVeld ? achterkantBlok(beschrijvingVeld) : null;
    var volgend = nieuw ? null : buurBoek(boek.boek_id, 1);
    var bewaarVolgend = volgend ? el('button', { type: 'button', class: 'knop', onclick: function () { verstuur(false, true); } }, 'Bewaar en volgend boek ›') : null;
    var formulier = el('form', { novalidate: true }, cover, overzicht, opzoeken, opzoekenBestaand, foto, achterkant, delen, herkomst ? el('fieldset', { class: 'blok' }, el('legend', {}, 'Intern'), herkomst.blok) : null,
      fout, knoppen.apply(null, [bewaar, bewaarVolgend].concat(nieuw ? [] : bladerKnoppen(vak, ctx, boek.boek_id),
        [el('button', { type: 'button', class: 'knop tweede', onclick: function () { terugNaarLijst(vak, ctx); } }, terugNaarLijstTekst())]).filter(Boolean)));

    /** Na het bewaren: de korte lijst van het bestuursscherm bijwerken, zonder alles opnieuw te laden. */
    function werkLijstBij() {
      var waarde = function (naam) { var v = velden.filter(function (x) { return x.naam === naam; })[0]; return v ? v.lees() : ''; };
      (ctx.data.boeken || []).forEach(function (b) {
        if (b.id !== String(boek.boek_id)) return;
        b.t = waarde('titel') || b.t;
        b.a = waarde('auteur');
        b.c = !!waarde('cover_url');
        if (coverLinksBelofte) coverLinksBelofte.then(function (l) { if (b.c) l[b.id] = waarde('cover_url'); else delete l[b.id]; });
        if (waarde('beschrijving')) delete b.zb; else b.zb = true;
      });
      velden.forEach(function (v) { v.oud = v.lees(); });
    }

    function verstuur(toch, daarnaVolgend) {
      var invoer = nieuw ? { velden: gewijzigd(velden, true), herkomst: herkomst.lees(), toch: toch === true } : { boek_id: boek.boek_id, velden: gewijzigd(velden, false) };
      if (!nieuw && !Object.keys(invoer.velden).length) {
        if (daarnaVolgend) { openUitLijst(vak, ctx, volgend); return; }
        B.melding(fout, 'ok', 'Er is niets veranderd.');
        return;
      }
      var klaar = bezig(daarnaVolgend ? bewaarVolgend : bewaar, 'Bezig met bewaren...');
      B.voerUit(nieuw ? 'beheerBoekToevoegen' : 'beheerBoekBewaren', invoer).then(function (r) {
        klaar();
        if (!r.ok) {
          D.vervang(fout, el('div', { class: 'melding fout', role: 'alert' }, el('p', {}, r.fout),
            r.dubbel ? knoppen(
              el('button', { type: 'button', class: 'knop tweede', onclick: function () { bewerkBoek(vak, ctx, r.dubbel); } }, 'Open ' + r.dubbel),
              el('button', { type: 'button', class: 'knop tweede', onclick: function () { verstuur(true); } }, 'Toch als nieuw boek toevoegen')) : null));
          return;
        }
        B.melding($('melding'), 'ok', r.tekst);
        if (nieuw && extra.reeks) {
          // Schenking: meteen het volgende boek. De lijsten worden pas bijgewerkt als je de reeks stopt.
          extra.reeks.aantal++;
          boekFormulier(vak, ctx, {}, true, { reeks: extra.reeks });
          return;
        }
        if (nieuw) { ctx.laad(); return; }
        // Een bestaand boek: je blijft hier (of gaat naar het volgende boek), en de lijsten kloppen meteen.
        werkLijstBij();
        if (daarnaVolgend) { openUitLijst(vak, ctx, volgend); return; }
        B.melding(fout, 'ok', r.tekst);
      });
    }
    formulier.addEventListener('submit', function (e) { e.preventDefault(); verstuur(false); });

    if (nieuw && extra.isbn) setTimeout(function () { $('bb-isbn').value = extra.isbn; zoekKnop.click(); }, 0);
    var reeksBalk = extra.reeks ? el('div', { class: 'melding info' },
      el('p', {}, el('strong', {}, 'Schenking: ' + extra.reeks.herkomst), ' · ' + extra.reeks.aantal + (extra.reeks.aantal === 1 ? ' boek' : ' boeken') + ' toegevoegd.'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        B.melding($('melding'), 'ok', 'Schenking afgesloten: ' + extra.reeks.aantal + (extra.reeks.aantal === 1 ? ' boek' : ' boeken') + ' toegevoegd.');
        ctx.laad();
      } }, 'Stop de reeks'))) : null;
    var titel = nieuw ? 'Nieuw boek' : (boek.titel || boek.boek_id);
    D.vervang(vak, ctx.kop(titel, nieuw ? 'Velden met een waarde uit een lijst mag je zo laten.' : boek.boek_id + (boek.toegevoegd_op ? ' · toegevoegd op ' + D.korteDatum(boek.toegevoegd_op) : '')), reeksBalk, formulier);
    vak.querySelector('h2').focus();
  }

  function bewerkBoek(vak, ctx, id) {
    D.vervang(vak, el('p', {}, 'Boek laden...'));
    B.voerUit('beheerBoekOphalen', { boek_id: id }).then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout); toonBoeken(vak, ctx); return; }
      boekFormulier(vak, ctx, r.boek, false, r);
    });
  }

  function nieuwBoek(vak, ctx) { boekFormulier(vak, ctx, {}, true); }

  /* ---------- Ontbrekende covers zoeken via deze browser ---------- */

  /*
   * Google Books en Open Library weigeren vragen vanuit Apps Script vaak. Vanuit een gewone
   * browser lukt het wel. Deze browser zoekt dus de covers (eerst Google, dan Open Library),
   * en stuurt per 20 boeken door naar de web-app, die ze in de Catalogus zet.
   */
  var COVERS_VERSIE = '9'; // staat in de voortgang: zo zie je of je browser de nieuwste versie gebruikt
  var COVERS_PER_PORTIE = 20;
  var COVERS_PAUZE_MS = 350;

  function wacht(ms) { return new Promise(function (klaar) { setTimeout(klaar, ms); }); }

  /** Vraagt één ISBN op bij Google Books. Geeft { info } of { fout, limiet, storing }. */
  /** ISBN-13 (978…) naar ISBN-10, om uitgaven te vergelijken. */
  function isbn13Naar10(s) {
    if (!/^978\d{10}$/.test(s)) return '';
    var kern = s.slice(3, 12), som = 0;
    for (var i = 0; i < 9; i++) som += (10 - i) * Number(kern.charAt(i));
    var c = (11 - (som % 11)) % 11;
    return kern + (c === 10 ? 'X' : String(c));
  }

  /** Enkel uitgaven met precies dit ISBN. */
  function metIsbn(items, isbn) {
    var gezocht = [isbn, isbn13Naar10(isbn)].filter(Boolean);
    return (items || []).filter(function (it) {
      return ((it.volumeInfo || {}).industryIdentifiers || []).some(function (id) {
        return gezocht.indexOf(String(id.identifier || '').replace(/[^0-9X]/gi, '').toUpperCase()) > -1;
      });
    });
  }

  /**
   * Vraagt één ISBN op. Eerst op het ISBN als gewoon getal (dat werkt bij Google het best),
   * en we nemen enkel een uitgave met precies dat ISBN. Levert dat niets op, dan als reserve "isbn:…".
   */
  function vraagGoogle(isbn, sleutel) {
    return vraagGoogleUrl(encodeURIComponent(isbn), sleutel).then(function (a) {
      if (!a.fout) a = { items: metIsbn(a.items, isbn) };
      if (a.limiet || (a.items && a.items.length)) return a;
      return vraagGoogleUrl('isbn:' + encodeURIComponent(isbn), sleutel).then(function (b) {
        if (!b.fout || b.limiet) return b;
        return a.fout ? a : { items: [] };
      });
    }).then(function (a) {
      if (a.fout) return a;
      return { info: a.items.length ? a.items[0].volumeInfo : null };
    });
  }

  function vraagGoogleUrl(q, sleutel) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=' + q + (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
    return fetch(url).then(function (r) { return r.json().then(function (d) { return { code: r.status, d: d }; }); }).then(function (a) {
      if (a.code >= 400 || a.d.error) {
        var e = a.d.error || {};
        var reden = e.errors && e.errors[0] ? e.errors[0].reason : '';
        var fout = (e.message || ('code ' + a.code)) + (reden ? ' (' + reden + ')' : '');
        // Een storing herkennen we aan de code (5xx) en ook aan de tekst: Google is daar niet altijd consequent in.
        var storing = a.code >= 500 || Number(e.code) >= 500 || /temporarily unavailable|backendFailed|backend error|internal error/i.test(fout);
        return { fout: fout, limiet: !storing && (a.code === 429 || /quota|limit/i.test(fout)), storing: storing };
      }
      return { items: a.d.items || [] };
    }, function () { return { fout: 'Geen verbinding met Google.', storing: true }; });
  }

  /** Google Books op titel en auteur, voor een boek zonder ISBN. Enkel een uitgave met (bijna) dezelfde titel. */
  function vraagGoogleTitel(titel, auteur, sleutel) {
    var t = titelSleutel(titel), naam = achternaam(auteur);
    var q = 'intitle:' + encodeURIComponent(t) + (naam ? '+inauthor:' + encodeURIComponent(naam) : '');
    return vraagGoogleUrl(q, sleutel).then(function (a) {
      if (a.fout) return a;
      var goed = a.items.filter(function (it) { return gelijkenis(t, titelSleutel((it.volumeInfo || {}).title)) >= 0.85; });
      return { info: goed.length ? goed[0].volumeInfo : null };
    });
  }

  /* Open Library: cover van het werk (andere uitgave), op ISBN of op titel en auteur. */

  var OL_PAUZE_MS = 1000; // Open Library vraagt om rustig te zoeken

  function normaliseer(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function titelSleutel(t) { return normaliseer(String(t || '').replace(/\(.*?\)/g, ' ').split(':')[0]); }
  function achternaam(a) {
    var eerste = String(a || '').split(/;|&| en | and /)[0];
    var delen = normaliseer(eerste.indexOf(',') > -1 ? eerste.split(',')[0] : eerste).split(' ');
    return delen[delen.length - 1] || '';
  }
  function gelijkenis(a, b) {
    if (!a && !b) return 1;
    var m = a.length, n = b.length, vorige = [], huidige;
    for (var j = 0; j <= n; j++) vorige[j] = j;
    for (var i = 1; i <= m; i++) {
      huidige = [i];
      for (var k = 1; k <= n; k++) huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1));
      vorige = huidige;
    }
    return 1 - vorige[n] / Math.max(m, n);
  }

  /** Eén vraag aan Open Library. Geeft { docs } of { fout, wacht }. */
  function vraagOl(parameters) {
    return fetch('https://openlibrary.org/search.json?' + parameters + '&fields=key,title,author_name,cover_i&limit=5')
      .then(function (r) {
        if (r.status === 429) return { fout: 'Open Library vraagt om te wachten.', wacht: true };
        if (r.status >= 400) return { fout: 'Open Library: code ' + r.status };
        return r.json().then(function (d) { return { docs: d.docs || [] }; });
      }, function () { return { fout: 'Geen verbinding met Open Library.' }; });
  }

  /** Zoekt een cover bij Open Library. Geeft { cover, bron } , {} (niets gevonden) of { fout, wacht }. */
  function zoekOl(b) {
    var opIsbn = b.isbn ? vraagOl('isbn=' + b.isbn) : Promise.resolve({ docs: [] });
    return opIsbn.then(function (a) {
      if (a.fout) return a;
      if (a.docs.length && a.docs[0].cover_i) return { cover: 'https://covers.openlibrary.org/b/id/' + a.docs[0].cover_i + '-M.jpg', bron: 'ol-isbn' };
      if (!b.t) return {};
      var titel = titelSleutel(b.t), naam = achternaam(b.a);
      return wacht(b.isbn ? OL_PAUZE_MS : 0).then(function () {
        return vraagOl('title=' + encodeURIComponent(titel) + (naam ? '&author=' + encodeURIComponent(naam) : ''));
      }).then(function (t) {
        if (t.fout) return t;
        for (var i = 0; i < t.docs.length; i++) {
          var d = t.docs[i];
          if (!d.cover_i || gelijkenis(titel, titelSleutel(d.title)) < 0.85) continue;
          if (naam && (d.author_name || []).map(achternaam).indexOf(naam) === -1) continue;
          return { cover: 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-M.jpg', bron: 'ol-titel' };
        }
        return {};
      });
    });
  }

  /**
   * Laadt een afbeelding en kijkt of ze staand is, zoals een boekcover. Het logo van Internet
   * Archive (als een boek daar geen afbeelding heeft) is vierkant. Geeft true, false of null (niet te laden).
   */
  function isStaandBeeld(url) {
    return new Promise(function (klaar) {
      var beeld = new Image(), klaar1 = false;
      var einde = function (w) { if (!klaar1) { klaar1 = true; klaar(w); } };
      beeld.onload = function () { einde(beeld.naturalWidth > 0 && beeld.naturalHeight >= beeld.naturalWidth * 1.15); };
      beeld.onerror = function () { einde(null); };
      setTimeout(function () { einde(null); }, 15000);
      beeld.src = url;
    });
  }

  /* Internet Archive: ingescande boeken, op ISBN (13 en 10 cijfers). */

  /** Zoekt een boek bij Internet Archive. Geeft { cover }, {} (niets gevonden) of { fout }. */
  function zoekIa(isbn) {
    var nummers = [isbn, isbn13Naar10(isbn)].filter(Boolean).join(' OR ');
    var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('isbn:(' + nummers + ')') + '&fl%5B%5D=identifier&rows=3&output=json';
    return fetch(url).then(function (r) {
      if (r.status >= 400) return { fout: 'Internet Archive: code ' + r.status };
      return r.json().then(function (d) {
        var docs = (d.response && d.response.docs) || [];
        for (var i = 0; i < docs.length; i++) {
          var id = String(docs[i].identifier || '');
          if (/^[A-Za-z0-9._-]+$/.test(id)) {
            var url = 'https://archive.org/services/img/' + id;
            // Geen echte afbeelding (logo van Internet Archive)? Dan geen cover.
            return isStaandBeeld(url).then(function (staand) { return staand ? { cover: url } : {}; });
          }
        }
        return {};
      });
    }, function () { return { fout: 'Geen verbinding met Internet Archive.' }; });
  }

  function toonCoversZoeken(vak, ctx) {
    var stop = false;
    var voortgang = el('progress', { max: '1', value: '0', style: 'width:100%' });
    var status = el('p', { 'aria-live': 'polite' }, 'Lijst ophalen...');
    var stopKnop = el('button', { type: 'button', class: 'knop tweede', onclick: function () { stop = true; stopKnop.disabled = true; status.textContent = 'Stoppen...'; } }, 'Stop');
    D.vervang(vak, ctx.kop('Ontbrekende covers en beschrijvingen zoeken', 'Deze browser zoekt een cover en een beschrijving voor elk boek waar die ontbreken: eerst bij Google Books (jouw uitgave), dan voor de cover ook bij Open Library (soms een andere uitgave) en Internet Archive (ingescande boeken). Wat gevonden wordt, komt meteen in de Catalogus. Laat dit venster open tot het klaar is. Je kan altijd stoppen en later verdergaan.'),
      voortgang, status, knoppen(stopKnop, el('button', { type: 'button', class: 'knop tweede', onclick: function () { stop = true; naarBoeken(vak, ctx); } }, terugTekst(ctx))));

    B.voerUit('beheerCoversLijst').then(function (r) {
      if (!r.ok) { status.textContent = r.fout || 'De lijst laden lukte niet.'; return; }
      var boeken = r.boeken, sleutel = r.sleutel;
      if (!boeken.length) { status.textContent = 'Er zijn geen boeken meer zonder cover of beschrijving die nog opgezocht moeten worden.'; stopKnop.hidden = true; return; }
      voortgang.max = boeken.length;
      var gedaan = 0, covers = 0, beschrijvingen = 0, items = [], googleUit = !sleutel, googleReden = sleutel ? '' : 'geen google_books_api_key',
        googleNaElkaar = 0, olUit = false, olNaElkaar = 0, iaUit = false, iaNaElkaar = 0;

      /** Bewaart de gevonden covers. Is de web-app even bezig (bv. met een script), dan tot 5 keer opnieuw. */
      function stuur(poging) {
        if (!items.length) return Promise.resolve({ ok: true });
        var pakket = { items: items };
        return B.voerUit('beheerCoversBewaren', pakket).then(function (a) {
          if (!a.ok && /druk/i.test(a.fout || '') && (poging || 1) < 5) {
            toon('De spreadsheet is even bezig, opnieuw over 30 seconden...');
            return wacht(30000).then(function () { return stuur((poging || 1) + 1); });
          }
          if (a.ok) { covers += a.covers; beschrijvingen += a.beschrijvingen || 0; items = []; }
          return a;
        });
      }
      function toon(tekst) {
        voortgang.value = gedaan;
        status.textContent = '[versie ' + COVERS_VERSIE + '] ' + gedaan + ' van ' + boeken.length + ' opgezocht, ' + covers + ' covers en ' + beschrijvingen + ' beschrijvingen gevonden.' +
          (googleUit ? ' Google: overgeslagen (' + googleReden + ').' : '') + (olUit ? ' Open Library: overgeslagen.' : '') +
          (iaUit ? ' Internet Archive: overgeslagen.' : '') + (tekst ? ' ' + tekst : '');
      }
      function einde(tekst) { return stuur().then(function () { toon(tekst); stopKnop.hidden = true; }); }

      /** Google met tot 5 pogingen bij een storing. */
      function google(b) {
        function probeer(poging) {
          return vraagGoogle(b.isbn, sleutel).then(function (a) {
            if (a.storing && poging < 5 && !stop) {
              toon('Google hapert, nieuwe poging ' + (poging + 1) + ' van 5...');
              return wacht(1000 * Math.pow(2, poging)).then(function () { return probeer(poging + 1); });
            }
            return a;
          });
        }
        return probeer(1);
      }

      function volgende(i) {
        if (stop) return einde('Gestopt. Klik later opnieuw om verder te gaan.');
        if (i >= boeken.length) return einde('Klaar.');
        if (googleUit && olUit && iaUit) return einde('Google, Open Library en Internet Archive weigeren alle drie. Probeer het later opnieuw.');
        var b = boeken[i];
        var item = { boek_id: b.id, google: false, ol: false };
        var stap = (b.g && !googleUit) ? google(b) : Promise.resolve(null);
        return stap.then(function (a) {
          if (a && a.fout) {
            if (a.storing) { if (++googleNaElkaar >= 10) { googleUit = true; googleReden = 'blijvende storing'; } }
            else { googleUit = true; googleReden = a.fout; }
          } else if (a) {
            googleNaElkaar = 0;
            item.google = true;
            if (a.info) {
              var v = a.info, links = v.imageLinks || {};
              item.meta = { beschrijving: v.description || '', uitgeverij: v.publisher || '', jaartal: v.publishedDate || '', paginas: v.pageCount || '', taal: v.language || '' };
              var c = links.thumbnail || links.smallThumbnail || '';
              if (c) { item.cover = c; item.bron = 'google'; }
            }
          }
          if (item.cover || !b.o || olUit) return null;
          return wacht(OL_PAUZE_MS).then(function () { return zoekOl(b); });
        }).then(function (o) {
          if (o && o.fout) {
            if (++olNaElkaar >= 10) olUit = true;
            if (o.wacht) { toon('Open Library vraagt om te wachten, even pauze...'); return wacht(60000); }
          } else if (o) {
            olNaElkaar = 0;
            item.ol = true;
            if (o.cover) { item.cover = o.cover; item.bron = o.bron; }
          }
          if (item.cover || !b.i || iaUit) return null;
          return wacht(500).then(function () { return zoekIa(b.isbn); });
        }).then(function (ia) {
          if (ia && ia.fout) {
            if (++iaNaElkaar >= 10) iaUit = true;
          } else if (ia) {
            iaNaElkaar = 0;
            item.ia = true;
            if (ia.cover) { item.cover = ia.cover; item.bron = 'ia'; }
          }
        }).then(function () {
          if (item.google || item.ol || item.ia) items.push(item);
          gedaan++;
          var bewaar = items.length >= COVERS_PER_PORTIE ? stuur() : Promise.resolve({ ok: true });
          return bewaar.then(function (s) {
            if (!s.ok) return einde('Bewaren lukte niet: ' + (s.fout || '') + ' Gestopt.');
            toon('');
            return wacht(COVERS_PAUZE_MS).then(function () { return volgende(i + 1); });
          });
        });
      }
      toon('');
      volgende(0);
    });
  }

  /** Zet een knop op "bezig". Geeft een functie terug om ze terug te zetten. */
  function bezig(knop, tekst) {
    var oud = knop.textContent;
    knop.disabled = true;
    knop.textContent = tekst;
    return function () { knop.disabled = false; knop.textContent = oud; };
  }

  /* ---------- Nieuws, agenda en vragen ---------- */

  var inhoud = null; // gegevens uit beheerInhoud, tot iemand op Vernieuw klikt

  var INHOUD = [
    ['Nieuws', 'Nieuws', ['datum', 'titel', 'tekst', 'titel_en', 'tekst_en', 'afbeelding', 'link', 'publiek', 'online_vanaf'], 'Nieuw bericht'],
    ['Agenda', 'Agenda', ['datum', 'uur', 'titel', 'tekst', 'locatie', 'titel_en', 'tekst_en', 'afbeelding', 'link', 'publiek'], 'Nieuw event'],
    ['Veelgestelde vragen', 'Veelgestelde vragen', ['volgorde', 'vraag', 'antwoord', 'vraag_en', 'antwoord_en', 'publiek'], 'Nieuwe vraag']
  ];
  var gekozenInhoud = 'Nieuws';

  function laadInhoud(vak, ctx, verder) {
    if (inhoud) { verder(); return; }
    D.vervang(vak, el('p', {}, 'Laden...'));
    B.voerUit('beheerInhoud').then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout || 'Laden lukte niet.'); return; }
      inhoud = r.data;
      verder();
    });
  }

  function toonInhoud(vak, ctx) {
    laadInhoud(vak, ctx, function () {
      var vrijwilliger = ctx.scherm === 'vrijwilliger';
      var soorten = INHOUD.filter(function (s) { return !vrijwilliger || s[0] !== 'Veelgestelde vragen'; });
      if (!soorten.some(function (s) { return s[0] === gekozenInhoud; })) gekozenInhoud = soorten[0][0];
      var soort = soorten.filter(function (s) { return s[0] === gekozenInhoud; })[0];
      var rijen = (inhoud.tabbladen[soort[0]] || []).slice();
      if (soort[0] === 'Veelgestelde vragen') rijen.sort(function (a, b) { return (Number(a.volgorde) || 999) - (Number(b.volgorde) || 999); });
      else rijen.sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });
      var tabs = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Kies wat je wil aanpassen' }, soorten.map(function (s) {
        return el('button', {
          type: 'button', class: 'knop' + (s[0] === gekozenInhoud ? '' : ' tweede'), 'aria-pressed': s[0] === gekozenInhoud ? 'true' : 'false',
          onclick: function () { gekozenInhoud = s[0]; toonInhoud(vak, ctx); }
        }, s[1]);
      }));
      D.vervang(vak, ctx.kop('Nieuws en agenda', vrijwilliger
        ? 'Stel een bericht of event voor. Het bestuur leest het na en zet het online. Tot dan blijft het verborgen.'
        : 'Berichten, events en veelgestelde vragen op de startpagina. Alles komt in het gelijknamige tabblad van de spreadsheet.'),
        tabs,
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { inhoudFormulier(vak, ctx, soort, null); } }, '+ ' + soort[3])),
        rijen.length ? el('ul', { class: 'kaartlijst' }, rijen.map(function (r) {
          var hoofd = r.titel || r.vraag || '(zonder titel)';
          var sub = soort[0] === 'Veelgestelde vragen' ? (r.volgorde ? 'Volgorde ' + r.volgorde : '') : [D.korteDatum(r.datum), r.uur, r.locatie].filter(Boolean).join(' · ');
          return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { inhoudFormulier(vak, ctx, soort, r); } },
            el('strong', {}, hoofd), sub ? el('span', {}, sub) : null,
            r.voorgesteld_door && r.publiek === 'nee' ? el('span', { class: 'labels' }, D.statusLabel('gereserveerd', 'Voorstel van ' + r.voorgesteld_door + ', wacht op het bestuur'))
              : r.publiek === 'nee' ? el('span', { class: 'labels' }, D.statusLabel('niet_uitleenbaar', 'Verborgen'))
              : (r.online_vanaf && r.online_vanaf > vandaag() ? el('span', { class: 'labels' }, D.statusLabel('gereserveerd', 'Gepland vanaf ' + D.korteDatum(r.online_vanaf))) : null)));
        })) : el('p', {}, 'Hier staat nog niets.'));
    });
  }

  function inhoudFormulier(vak, ctx, soort, rij) {
    var vrijwilliger = ctx.scherm === 'vrijwilliger';
    // Een vrijwilliger kiest niet zelf of het online staat: dat doet het bestuur.
    var namen = vrijwilliger ? soort[2].filter(function (n) { return n !== 'publiek'; }) : soort[2];
    var velden = namen.map(function (naam) {
      var w = rij ? rij[naam] : (naam === 'publiek' ? 'ja' : '');
      return veld('bi', naam, w);
    });
    var fout = el('div', { 'aria-live': 'assertive' });
    var bewaar = el('button', { type: 'submit', class: 'knop' }, rij ? 'Bewaar' : 'Voeg toe');
    var verwijder = rij ? el('button', { type: 'button', class: 'knop tweede', onclick: function () {
      if (!window.confirm('Wil je dit echt verwijderen? Wil je het enkel even weghalen van de website, zet dan "Op de website" op Nee.')) return;
      stuur({ tabblad: soort[0], rij: rij.rij, vingerafdruk: rij.vingerafdruk, verwijderen: true }, verwijder);
    } }, 'Verwijder') : null;
    if (vrijwilliger && rij && rij.publiek !== 'nee') verwijder = null; // al online: enkel het bestuur verwijdert
    var goedkeuren = !vrijwilliger && rij && rij.voorgesteld_door && rij.publiek === 'nee'
      ? el('button', { type: 'button', class: 'knop', onclick: function () {
        stuur({ tabblad: soort[0], rij: rij.rij, vingerafdruk: rij.vingerafdruk, velden: { publiek: 'ja' } }, goedkeuren);
      } }, 'Keur goed en zet online') : null;
    var uitleg = vrijwilliger
      ? el('p', { class: 'melding info' }, rij && rij.publiek !== 'nee'
        ? 'Dit staat online. Bewaar je een aanpassing, dan gaat het offline tot het bestuur het opnieuw goedkeurt.'
        : 'Na het bewaren leest het bestuur je voorstel na en zet het online.')
      : (rij && rij.voorgesteld_door && rij.publiek === 'nee'
        ? el('p', { class: 'melding let-op' }, 'Voorstel van ' + rij.voorgesteld_door + '. Lees het na en klik op "Keur goed en zet online", of zet "Op de website" op Ja.') : null);
    var formulier = el('form', { novalidate: true }, uitleg, velden.map(function (v) { return v.blok; }), fout,
      knoppen(goedkeuren, bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonInhoud(vak, ctx); } }, 'Terug'), verwijder));

    function stuur(invoer, knop) {
      var klaar = bezig(knop, 'Bezig...');
      B.voerUit('beheerInhoudBewaren', invoer).then(function (r) {
        klaar();
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        B.melding($('melding'), 'ok', r.tekst + ' De website toont het binnen enkele minuten.');
        inhoud = null;
        toonInhoud(vak, ctx);
      });
    }
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = gewijzigd(velden, !rij);
      if (rij && !Object.keys(v).length) { B.melding(fout, 'ok', 'Er is niets veranderd.'); return; }
      stuur({ tabblad: soort[0], rij: rij ? rij.rij : null, vingerafdruk: rij ? rij.vingerafdruk : null, velden: v }, bewaar);
    });
    D.vervang(vak, ctx.kop(rij ? (rij.titel || rij.vraag || soort[1]) : soort[3]), formulier);
    vak.querySelector('h2').focus();
  }

  /* ---------- Leeslijsten ---------- */

  var LIJST_VELDEN = ['naam', 'naam_en', 'uitleg', 'uitleg_en', 'zichtbaar_vanaf', 'zichtbaar_tot', 'volgorde', 'publiek'];

  /** Vandaag als JJJJ-MM-DD, in de tijd van de computer. */
  function vandaag() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /**
   * Hoe een lijst er vandaag voor staat (zelfde regels als leeslijstZichtbaar in Publiek.js).
   * Geeft [code voor het label, tekst].
   */
  function lijstStatus(r, schakelaar) {
    if (r.publiek === 'nee') return ['niet_uitleenbaar', 'Verborgen'];
    var van = r.zichtbaar_vanaf, tot = r.zichtbaar_tot, nu = vandaag();
    if (!van && !tot) return schakelaar ? ['beschikbaar', 'Zichtbaar'] : ['niet_uitleenbaar', 'Klaar, wacht op de knop hierboven'];
    var periode = (van ? 'van ' + D.korteDatum(van) : '') + (van && tot ? ' ' : '') + (tot ? 'tot en met ' + D.korteDatum(tot) : '');
    if (van && van > nu) return ['gereserveerd', 'Gepland, ' + periode];
    if (tot && tot < nu) return ['niet_uitleenbaar', 'Voorbij, ' + periode];
    return ['beschikbaar', 'Zichtbaar, ' + periode];
  }

  function zelfde(a, b) { return Z.normaliseer(a) === Z.normaliseer(b); }

  function inLijst(b, naam) {
    return (b.ll || []).some(function (n) { return zelfde(n, naam); });
  }

  /** De waarde van één instelling uit beheerInhoud. */
  function instelling(sleutel) {
    var gevonden = null;
    (inhoud.instellingen || []).forEach(function (g) {
      g.instellingen.forEach(function (i) { if (i.sleutel === sleutel) gevonden = i; });
    });
    return gevonden;
  }

  function toonLeeslijsten(vak, ctx) {
    laadInhoud(vak, ctx, function () {
      var rijen = (inhoud.tabbladen.Leeslijsten || []).slice().sort(function (a, b) {
        return (Number(a.volgorde) || 999) - (Number(b.volgorde) || 999) || String(a.naam).localeCompare(String(b.naam));
      });
      var boeken = ctx.data.boeken || [];
      var tonen = instelling('leeslijsten_tonen');
      var aan = tonen && /^(ja|j|yes|x|1|true|waar)$/i.test(String(tonen.waarde).trim());
      var schakel = el('button', { type: 'button', class: 'knop tweede' }, aan ? 'Verberg de leeslijsten op de website' : 'Zet de leeslijsten op de website');
      var schakelMelding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
      schakel.addEventListener('click', function () {
        if (!tonen) { schakelMelding.textContent = 'De instelling leeslijsten_tonen ontbreekt nog. Kies in de spreadsheet Madrigal > Installeer tabbladen.'; return; }
        var klaar = bezig(schakel, 'Bezig...');
        B.voerUit('beheerInstellingBewaren', { sleutel: 'leeslijsten_tonen', waarde: aan ? 'nee' : 'ja' }).then(function (r) {
          klaar();
          if (!r.ok) { schakelMelding.textContent = r.fout; return; }
          tonen.waarde = aan ? 'nee' : 'ja';
          B.melding($('melding'), 'ok', aan ? 'De leeslijsten zijn verborgen.' : 'De leeslijsten staan op de website, ook in het menu. Dat is binnen enkele minuten zichtbaar.');
          toonLeeslijsten(vak, ctx);
        });
      });
      var verwittiging = inhoud.tabbladen.hasOwnProperty('Leeslijsten') && (tonen || !rijen.length) ? null
        : el('p', { class: 'melding let-op' }, 'Kies eerst in de spreadsheet Madrigal > Installeer tabbladen. Dan komen het tabblad Leeslijsten en de instelling leeslijsten_tonen erbij.');
      D.vervang(vak, ctx.kop('Leeslijsten', 'Boeken rond een thema, zoals Pride-maand. Maak een lijst en kies de boeken. Alles komt in het tabblad Leeslijsten en in de kolom leeslijsten van de Catalogus.'),
        verwittiging,
        el('div', { class: 'blok' },
          el('p', {}, el('strong', {}, aan ? 'Op de website: zichtbaar.' : 'Op de website: verborgen.'), ' ',
            aan ? 'Bezoekers zien de leeslijsten via het menu en op de pagina Boeken.' : 'De lijsten staan klaar. Enkel jij ziet ze hier. Zet ze op de website wanneer je klaar bent.'),
          el('p', { class: 'hulptekst' }, 'Een lijst met "Zichtbaar vanaf" of "Zichtbaar tot" volgt haar eigen data, ook als deze knop op verborgen staat. Zo zet je Pride-maand klaar voor 1 juni.'),
          ctx.scherm === 'vrijwilliger' ? el('p', { class: 'hulptekst' }, 'Alle leeslijsten online zetten doet het bestuur.') : knoppen(schakel), schakelMelding),
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { leeslijstFormulier(vak, ctx, null); } }, '+ Nieuwe leeslijst')),
        rijen.length ? el('ul', { class: 'kaartlijst' }, rijen.map(function (r) {
          var n = boeken.filter(function (b) { return inLijst(b, r.naam); }).length;
          return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { leeslijstOpenen(vak, ctx, r); } },
            el('strong', {}, r.naam || '(zonder naam)'), el('span', {}, n === 1 ? '1 boek' : n + ' boeken'),
            el('span', { class: 'labels' }, D.statusLabel.apply(null, lijstStatus(r, aan)))));
        })) : el('p', {}, 'Er is nog geen leeslijst.'));
    });
  }

  /** Naam, uitleg en volgorde van een lijst. rij leeg: een nieuwe lijst. */
  function leeslijstFormulier(vak, ctx, rij) {
    var velden = LIJST_VELDEN.map(function (naam) { return veld('ll', naam, rij ? rij[naam] : (naam === 'publiek' ? 'ja' : '')); });
    var fout = el('div', { 'aria-live': 'assertive' });
    var bewaar = el('button', { type: 'submit', class: 'knop' }, rij ? 'Bewaar' : 'Maak de lijst');
    var verwijder = rij ? el('button', { type: 'button', class: 'knop tweede', onclick: function () {
      if (!window.confirm('Wil je de leeslijst ' + rij.naam + ' echt verwijderen? De boeken blijven in de catalogus, enkel de lijst verdwijnt.')) return;
      stuur({ tabblad: 'Leeslijsten', rij: rij.rij, vingerafdruk: rij.vingerafdruk, verwijderen: true }, verwijder, null);
    } }, 'Verwijder de lijst') : null;
    var formulier = el('form', { novalidate: true }, velden.map(function (v) { return v.blok; }), fout,
      knoppen(bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { if (rij) leeslijstOpenen(vak, ctx, rij); else toonLeeslijsten(vak, ctx); } }, 'Terug'), verwijder));

    function stuur(invoer, knop, nieuweNaam) {
      var klaar = bezig(knop, 'Bezig...');
      B.voerUit('beheerInhoudBewaren', invoer).then(function (r) {
        klaar();
        if (!r.ok) { B.melding(fout, 'fout', r.fout); return; }
        // Hernoemd of verwijderd: het script paste de boeken aan. Hier doen we hetzelfde.
        if (rij) {
          (ctx.data.boeken || []).forEach(function (b) {
            if (!inLijst(b, rij.naam)) return;
            b.ll = b.ll.filter(function (n) { return !zelfde(n, rij.naam); });
            if (nieuweNaam) b.ll.push(nieuweNaam);
          });
        }
        B.melding($('melding'), 'ok', r.tekst);
        inhoud = null;
        if (invoer.verwijderen) { toonLeeslijsten(vak, ctx); return; }
        laadInhoud(vak, ctx, function () {
          var naam = nieuweNaam || (rij && rij.naam);
          var vers = (inhoud.tabbladen.Leeslijsten || []).filter(function (x) { return zelfde(x.naam, naam); })[0];
          if (vers) leeslijstOpenen(vak, ctx, vers); else toonLeeslijsten(vak, ctx);
        });
      });
    }
    formulier.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = gewijzigd(velden, !rij);
      if (rij && !Object.keys(v).length) { B.melding(fout, 'ok', 'Er is niets veranderd.'); return; }
      var naam = v.hasOwnProperty('naam') ? v.naam.trim() : (rij ? rij.naam : '');
      stuur({ tabblad: 'Leeslijsten', rij: rij ? rij.rij : null, vingerafdruk: rij ? rij.vingerafdruk : null, velden: v }, bewaar, naam);
    });
    D.vervang(vak, ctx.kop(rij ? 'Leeslijst ' + rij.naam + ' aanpassen' : 'Nieuwe leeslijst'), formulier);
    vak.querySelector('h2').focus();
  }

  /**
   * Boeken kiezen voor een lijst. Je zoekt en vinkt aan of uit. Pas bij "Bewaar" gaat alles
   * in één keer naar de spreadsheet.
   */
  function leeslijstOpenen(vak, ctx, rij) {
    var naam = rij.naam;
    var boeken = ctx.data.boeken || [];
    var index = Z.maakIndex(boeken);
    var keuze = {}; // boek-ID: true (erin) of false (eruit), enkel wat veranderde
    var zoekveld = el('input', { type: 'search', id: 'll-zoek', autocomplete: 'off', placeholder: 'Titel, auteur, ISBN of boek-ID' });
    // Filter op onderwerp: alle onderwerpen met het aantal boeken, alfabetisch.
    var perOnderwerp = {};
    boeken.forEach(function (b) { (b.g || []).forEach(function (g) { perOnderwerp[g] = (perOnderwerp[g] || 0) + 1; }); });
    var onderwerp = el('select', { id: 'll-onderwerp' }, el('option', { value: '' }, 'Alle onderwerpen'),
      Object.keys(perOnderwerp).sort(function (a, b) { return a.localeCompare(b, 'nl'); }).map(function (g) {
        return el('option', { value: g }, g + ' (' + perOnderwerp[g] + ')');
      }));
    var allesAan = el('button', { type: 'button', class: 'knop tweede', disabled: true }, 'Vink alles hieronder aan'); // hidden werkt niet bij .knop
    allesAan.addEventListener('click', function () {
      Array.prototype.forEach.call(gevondenVak.querySelectorAll('input[type="checkbox"]'), function (x) {
        if (!x.checked) { x.checked = true; x.dispatchEvent(new Event('change')); }
      });
    });
    var gevondenVak = el('div', { 'aria-live': 'polite' });
    var inLijstVak = el('div');
    var bewaar = el('button', { type: 'button', class: 'knop', disabled: true }, 'Bewaar');
    var bewaarMelding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });

    function zitErin(b) { return keuze.hasOwnProperty(b.id) ? keuze[b.id] : inLijst(b, naam); }

    // Een vinkje verandert niets aan de lijst eronder, zodat de focus blijft waar ze is.
    // Enkel een boek dat nieuw aangevinkt wordt in de zoekresultaten, komt onderaan bij.
    function vinkje(b, waar) {
      var id = 'll-' + waar + '-' + b.id;
      var vak2 = el('input', { type: 'checkbox', id: id, checked: zitErin(b), 'data-boek': b.id });
      vak2.addEventListener('change', function () {
        if (vak2.checked === inLijst(b, naam)) delete keuze[b.id]; else keuze[b.id] = vak2.checked;
        Array.prototype.forEach.call(vak.querySelectorAll('input[data-boek="' + CSS.escape(b.id) + '"]'), function (x) { x.checked = vak2.checked; });
        knop();
        if (waar === 'zoek' && vak2.checked && !inLijstVak.querySelector('input[data-boek="' + CSS.escape(b.id) + '"]')) tekenLijst();
      });
      return el('li', {}, el('label', { class: 'vinkje', for: id }, vak2, miniCover(b),
        el('span', {}, el('strong', {}, b.t), ' ', el('span', { class: 'hulptekst' }, [b.a, b.id].filter(Boolean).join(' · ')))));
    }

    function knop() {
      var aantal = Object.keys(keuze).length;
      bewaar.disabled = !aantal;
      bewaar.textContent = aantal ? 'Bewaar (' + aantal + (aantal === 1 ? ' wijziging)' : ' wijzigingen)') : 'Bewaar';
      var erin = boeken.filter(zitErin).length;
      var titel = inLijstVak.querySelector('h3');
      if (titel) titel.textContent = 'In deze lijst (' + erin + ')';
    }

    /** De boeken in de lijst, ook die je net uitvinkte (dan zonder vinkje, tot je bewaart). */
    function tekenLijst() {
      var toon = boeken.filter(function (b) { return inLijst(b, naam) || keuze[b.id] === true; })
        .sort(function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); });
      D.vervang(inLijstVak, el('h3', {}, ''),
        toon.length ? el('ul', { class: 'vinklijst' }, toon.map(function (b) { return vinkje(b, 'lijst'); }))
          : el('p', { class: 'hulptekst' }, 'Nog geen boeken. Zoek hierboven en vink aan.'));
      knop();
    }

    function tekenZoek() {
      var q = zoekveld.value.trim();
      var g = onderwerp.value;
      if (!q && !g) {
        allesAan.disabled = true;
        D.vervang(gevondenVak, el('p', { class: 'hulptekst' }, 'Typ een deel van een titel, auteur of ISBN, of kies een onderwerp.'));
        return;
      }
      var gevonden = q ? Z.zoek(index, q).map(function (r) { return r.boek; })
        : boeken.slice().sort(function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); });
      if (g) gevonden = gevonden.filter(function (b) { return (b.g || []).indexOf(g) > -1; });
      var totaal = gevonden.length;
      gevonden = gevonden.slice(0, g ? 300 : 30);
      allesAan.disabled = !gevonden.length;
      D.vervang(gevondenVak,
        gevonden.length ? el('p', { class: 'hulptekst' }, totaal > gevonden.length ? 'De eerste ' + gevonden.length + ' van ' + totaal + ' boeken.' : (totaal === 1 ? '1 boek.' : totaal + ' boeken.')) : null,
        gevonden.length ? el('ul', { class: 'vinklijst' }, gevonden.map(function (b) { return vinkje(b, 'zoek'); })) : el('p', {}, 'Geen boek gevonden.'));
    }

    bewaar.addEventListener('click', function () {
      var toevoegen = [], weghalen = [];
      Object.keys(keuze).forEach(function (id) { (keuze[id] ? toevoegen : weghalen).push(id); });
      var klaar = bezig(bewaar, 'Bezig...');
      B.voerUit('beheerLeeslijstBoeken', { naam: naam, toevoegen: toevoegen, weghalen: weghalen }).then(function (r) {
        klaar();
        if (!r.ok) { bewaarMelding.textContent = r.fout; return; }
        boeken.forEach(function (b) {
          if (!keuze.hasOwnProperty(b.id)) return;
          var rest = (b.ll || []).filter(function (n) { return !zelfde(n, naam); });
          b.ll = keuze[b.id] ? rest.concat([naam]) : rest;
        });
        keuze = {};
        bewaarMelding.textContent = r.tekst;
        tekenLijst();
        tekenZoek();
      });
    });
    zoekveld.addEventListener('input', tekenZoek);
    onderwerp.addEventListener('change', tekenZoek);

    D.vervang(vak, ctx.kop('Leeslijst ' + naam, rij.uitleg || 'Zoek boeken en vink ze aan. Klik daarna op Bewaar.'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        if (Object.keys(keuze).length && !window.confirm('Je hebt nog niet bewaard. Toch teruggaan?')) return;
        toonLeeslijsten(vak, ctx);
      } }, '← Alle leeslijsten'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { leeslijstFormulier(vak, ctx, rij); } }, 'Naam en uitleg aanpassen')),
      el('div', { class: 'veld' }, el('label', { for: 'll-zoek' }, 'Zoek een boek om toe te voegen'), zoekveld),
      el('div', { class: 'veld' }, el('label', { for: 'll-onderwerp' }, 'Onderwerp'), onderwerp),
      knoppen(allesAan),
      gevondenVak,
      el('div', { class: 'blok' }, inLijstVak),
      el('div', { class: 'knoppen plakkend' }, bewaar), bewaarMelding);
    tekenLijst();
    tekenZoek();
    vak.querySelector('h2').focus();
  }

  /* ---------- Teksten en instellingen ---------- */

  function toonInstellingen(vak, ctx) {
    laadInhoud(vak, ctx, function () {
      var groepen = inhoud.instellingen.map(function (g) {
        return el('section', { class: 'blok' }, el('h3', {}, g.titel), g.instellingen.map(instellingVeld));
      });
      D.vervang(vak, ctx.kop('Teksten en instellingen', 'Pas een waarde aan en klik op Bewaar naast die instelling. De codes pas je enkel in de spreadsheet aan.'), groepen);
    });
  }

  function instellingVeld(inst) {
    var id = 'inst-' + inst.sleutel;
    var lang = inst.waarde.length > 60 || /^tekst_|openingsuren/.test(inst.sleutel);
    var invoer = lang ? el('textarea', { id: id, rows: '4' }) : el('input', { type: 'text', id: id, value: inst.waarde, autocomplete: 'off' });
    if (lang) invoer.value = inst.waarde;
    if (inst.uitleg) invoer.setAttribute('aria-describedby', id + '-uitleg');
    var knop = el('button', { type: 'button', class: 'knop tweede', disabled: true }, 'Bewaar');
    var melding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    invoer.addEventListener('input', function () { knop.disabled = invoer.value === inst.waarde; melding.textContent = ''; });
    knop.addEventListener('click', function () {
      var klaar = bezig(knop, 'Bezig...');
      B.voerUit('beheerInstellingBewaren', { sleutel: inst.sleutel, waarde: invoer.value }).then(function (r) {
        klaar();
        if (!r.ok) { melding.textContent = r.fout; knop.disabled = false; return; }
        inst.waarde = invoer.value;
        knop.disabled = true;
        melding.textContent = 'Bewaard.';
      });
    });
    return el('div', { class: 'veld' },
      el('label', { for: id }, inst.sleutel),
      inst.uitleg ? el('p', { class: 'hulptekst', id: id + '-uitleg' }, inst.uitleg) : null,
      invoer, el('div', { class: 'knoppen' }, knop), melding);
  }

  root.MadrigalBestuurBeheer = {
    boeken: toonBoeken,
    inhoud: toonInhoud,
    covers: toonZonderCover,
    zonderBeschrijving: toonZonderBeschrijving,
    /** Voor de tests: een ISBN lezen uit een canvas met ZXing. */
    leesIsbn: function (canvas) { return laadZxing().then(function (ZX) { return leesIsbnZxing(ZX, canvas); }); },
    leeslijsten: toonLeeslijsten,
    /** Voor vrijwilligers.js: de camera, de knoppen met kleine cover en isIsbn. */
    scanIsbn: scanIsbn,
    boekKnop: boekKnop,
    isIsbn: isIsbn,
    instellingen: toonInstellingen,
    /** Bij Vernieuw: nieuws, agenda en instellingen opnieuw ophalen. */
    vergeet: function () { inhoud = null; }
  };
})(window);
