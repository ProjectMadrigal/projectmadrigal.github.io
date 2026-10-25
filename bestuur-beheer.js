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
    cover_url: 'Link naar de cover', herkomst: 'Herkomst',
    datum: 'Datum', uur: 'Uur', titel_en: 'Titel (Engels)', tekst: 'Tekst', tekst_en: 'Tekst (Engels)',
    locatie: 'Locatie', afbeelding: 'Link naar een afbeelding', link: 'Link voor meer info',
    naam: 'Naam', naam_en: 'Naam (Engels)', uitleg: 'Uitleg', uitleg_en: 'Uitleg (Engels)',
    volgorde: 'Volgorde', vraag: 'Vraag', vraag_en: 'Vraag (Engels)', antwoord: 'Antwoord', antwoord_en: 'Antwoord (Engels)'
  };

  var HULP = {
    auteur: 'Achternaam eerst: Verbeek, Mira',
    aanrader: 'Voornamen, gescheiden door komma\'s. Wordt het label "Aanrader van ..."',
    leeslijsten: 'Namen van leeslijsten, gescheiden door komma\'s. Uitleg en Engelse naam zet je in het tabblad Leeslijsten.',
    extra_onderwerpen: 'Extra filtergroepen, gescheiden door komma\'s',
    status: 'Verloren: niet op de website, niet uitleenbaar. Gevoelig verborgen: niet op de website, wel uitleenbaar. Gevoelig zichtbaar: met het label "Gevoelige inhoud".',
    startpagina: 'Automatisch: als aanrader of als het nieuw binnen is',
    beschrijving_en: 'Leeg laten: dan vertaalt het script de Nederlandse tekst',
    herkomst: 'Nooit publiek: donatie, schenker, ... Enkel zichtbaar in de spreadsheet',
    publiek: 'Nee: blijft bewaard, maar verschijnt niet op de website',
    tekst_en: 'Leeg laten: dan toont de site het Nederlands',
    volgorde: 'Kleinste getal eerst',
    naam: 'Bv. Pride-maand. Geen komma\'s.',
    naam_en: 'Leeg laten: dan toont de Engelse site de Nederlandse naam',
    uitleg_en: 'Leeg laten: dan toont de Engelse site de Nederlandse uitleg'
  };

  var KEUZES = {
    soort: [['boek', 'Boek'], ['zine', 'Zine']],
    nieuwstaat: [['', 'Onbekend'], ['ja', 'Nieuw'], ['nee', 'Tweedehands']],
    klassieker: [['', 'Nee'], ['ja', 'Ja']],
    uitleenbaar: [['ja', 'Ja'], ['nee', 'Nee']],
    publiek: [['ja', 'Ja'], ['nee', 'Nee, verborgen']],
    startpagina: [['', 'Automatisch'], ['ja', 'Altijd'], ['nee', 'Nooit']],
    status: [['', 'Gewoon'], ['verloren', 'Verloren'], ['gevoelig verborgen', 'Gevoelig, verborgen'], ['gevoelig zichtbaar', 'Gevoelig, zichtbaar met label']]
  };

  var LANG = ['beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en', 'uitleg', 'uitleg_en'];
  var GETAL = ['jaartal', 'paginas', 'aantal', 'volgorde'];

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
      var type = naam === 'datum' ? 'date' : GETAL.indexOf(naam) > -1 ? 'number' : /url|afbeelding|link/.test(naam) ? 'url' : 'text';
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

  /* ---------- Boeken ---------- */

  var GROEPEN_BOEK = [
    ['Het boek', ['titel', 'auteur', 'isbn', 'soort', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat']],
    ['Op de website', ['status', 'publiek', 'startpagina', 'aanrader', 'leeslijsten', 'genre', 'extra_onderwerpen', 'klassieker', 'cover_url', 'beschrijving', 'beschrijving_en']],
    ['Uitlenen', ['aantal', 'uitleenbaar']]
  ];

  var vanZonderCover = false; // kwam je van de lijst zonder cover? Dan gaat "Terug" daarheen.

  function terugNaarLijst(vak, ctx) {
    if (vanZonderCover) toonZonderCover(vak, ctx); else toonBoeken(vak, ctx);
  }

  function toonBoeken(vak, ctx) {
    vanZonderCover = false;
    var zonder = (ctx.data.boeken || []).filter(function (b) { return !b.c; }).length;
    var index = Z.maakIndex(ctx.data.boeken || []);
    var zoekveld = el('input', { type: 'search', id: 'beheer-boek-zoek', autocomplete: 'off', placeholder: 'Titel, auteur, ISBN of boek-ID' });
    var lijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = zoekveld.value.trim();
      if (!q) { D.vervang(lijst, el('p', { class: 'hulptekst' }, 'Typ minstens een deel van een titel, auteur of ISBN.')); return; }
      var gevonden = Z.zoek(index, q).slice(0, 20).map(function (r) { return r.boek; });
      D.vervang(lijst, gevonden.length ? el('ul', { class: 'kaartlijst' }, gevonden.map(function (b) {
        return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { bewerkBoek(vak, ctx, b.id); } },
          el('strong', {}, b.t), el('span', {}, [b.a, b.id].filter(Boolean).join(' · ')),
          b.st ? el('span', { class: 'labels' }, b.st === 'verloren' ? D.statusLabel('verloren', 'Verloren') : el('span', { class: 'label label-gevoelig' }, 'Gevoelige inhoud')) : null));
      })) : el('p', {}, 'Geen boek gevonden.'));
    }
    zoekveld.addEventListener('input', teken);
    D.vervang(vak, ctx.kop('Boeken', 'Zoek een boek om het aan te passen, of voeg een nieuw boek toe. Alles komt in het tabblad Catalogus van de spreadsheet.'),
      knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { nieuwBoek(vak, ctx); } }, '+ Nieuw boek toevoegen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonCoversZoeken(vak, ctx); } }, 'Zoek ontbrekende covers en beschrijvingen'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonZonderCover(vak, ctx); } }, 'Boeken zonder cover (' + zonder + ')'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonIaControle(vak, ctx); } }, 'Controleer covers van Internet Archive')),
      el('div', { class: 'veld' }, el('label', { for: 'beheer-boek-zoek' }, 'Zoek een boek'), zoekveld), lijst);
    teken();
  }

  /** Kijkt alle covers van Internet Archive na en toont die met enkel het logo, om ze te wissen. */
  function toonIaControle(vak, ctx) {
    var voortgang = el('progress', { max: '1', value: '0', style: 'width:100%' });
    var status = el('p', { 'aria-live': 'polite' }, 'Lijst ophalen...');
    var resultaat = el('div');
    D.vervang(vak, ctx.kop('Covers van Internet Archive nakijken', 'Heeft een boek bij Internet Archive geen afbeelding, dan toont die het eigen logo. Deze pagina zoekt die logo\'s. Je ziet ze eerst, daarna kan je ze wissen.'),
      voortgang, status, resultaat, knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));
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
  function toonZonderCover(vak, ctx) {
    vanZonderCover = true;
    var lijst = (ctx.data.boeken || []).filter(function (b) { return !b.c; })
      .sort(function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); });
    var filter = el('input', { type: 'search', id: 'zonder-cover-zoek', autocomplete: 'off', placeholder: 'Titel, auteur of boek-ID' });
    var vakLijst = el('div', { 'aria-live': 'polite' });
    function teken() {
      var q = Z.normaliseer(filter.value);
      var zichtbaar = lijst.filter(function (b) { return !q || Z.normaliseer([b.t, b.a, b.id].join(' ')).indexOf(q) > -1; }).slice(0, 100);
      D.vervang(vakLijst, zichtbaar.length ? el('ul', { class: 'kaartlijst' }, zichtbaar.map(function (b) {
        return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { bewerkBoek(vak, ctx, b.id); } },
          el('strong', {}, b.t), el('span', {}, [b.a, b.id].filter(Boolean).join(' · '))));
      })) : el('p', {}, lijst.length ? 'Geen boek gevonden.' : 'Alle boeken hebben een cover.'));
    }
    filter.addEventListener('input', teken);
    D.vervang(vak, ctx.kop('Boeken zonder cover (' + lijst.length + ')', 'Kies een boek en neem een foto van de cover met je gsm. Tip: leg het boek op een effen achtergrond, met goed licht en zonder schaduw.'),
      el('div', { class: 'veld' }, el('label', { for: 'zonder-cover-zoek' }, 'Zoek in deze lijst'), filter), vakLijst,
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));
    teken();
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
  function achterkantBlok(beschrijvingVeld) {
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
        melding.textContent = 'De tekst staat in het veld Beschrijving (Nederlands). Lees ze na, verbeter wat de herkenning fout las, en klik onderaan op Bewaar.';
      }, function (e) { melding.textContent = e.message; });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Tekst van de achterkant'),
      el('p', { class: 'hulptekst' }, 'Neem een foto van de achterflap, recht van boven en met goed licht. Google leest de tekst en zet ze in het veld Beschrijving. Lees ze altijd na voor je bewaart.'),
      el('div', { class: 'veld' }, el('label', { for: 'bb-achterkant' }, 'Foto van de achterkant nemen of kiezen'), invoer), melding);
  }

  function fotoBlok(boek, coverVeld, ctx) {
    var invoer = el('input', { type: 'file', id: 'bb-foto', accept: 'image/*', capture: 'environment' });
    var voorbeeld = el('img', { alt: 'Voorbeeld van de foto', hidden: true, style: 'max-width:12rem;border-radius:.4rem;display:block;margin-top:.5rem' });
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
        if (coverVeld) { coverVeld.invoer.value = r.cover_url; coverVeld.oud = r.cover_url; }
        // Meteen uit de lijst zonder cover halen, zonder alles opnieuw te laden.
        (ctx.data.boeken || []).forEach(function (b) { if (b.id === String(boek.boek_id)) b.c = true; });
        knop.disabled = true;
        melding.textContent = r.tekst + ' De website toont ze binnen enkele minuten.';
      });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Foto van de cover'),
      el('p', { class: 'hulptekst' }, 'Neem met je gsm een foto van de voorkant, of kies een foto. De site verkleint ze en bewaart ze op Google Drive.'),
      el('div', { class: 'veld' }, el('label', { for: 'bb-foto' }, 'Foto nemen of kiezen'), invoer), voorbeeld, melding, knoppen(knop));
  }

  /** Het formulier voor een boek. boek: bestaand boek of {} voor een nieuw. */
  function boekFormulier(vak, ctx, boek, nieuw) {
    var velden = [];
    var fout = el('div', { 'aria-live': 'assertive' });
    var delen = GROEPEN_BOEK.map(function (g) {
      return el('fieldset', { class: 'blok' }, el('legend', {}, g[0]), g[1].map(function (naam) {
        var v = veld('bb', naam, boek[naam] !== undefined ? boek[naam] : (nieuw && KEUZES[naam] ? KEUZES[naam][0][0] : ''));
        velden.push(v);
        return v.blok;
      }));
    });
    var herkomst = nieuw ? veld('bb', 'herkomst', '') : null;
    var opzoekMelding = el('p', { class: 'hulptekst', 'aria-live': 'polite' });
    var opzoeken = nieuw ? el('div', { class: 'blok' },
      el('p', {}, 'Heeft het boek een ISBN? Vul het hieronder in bij ISBN en klik op ', el('strong', {}, 'Zoek gegevens op'), '. Dan vult de site titel, auteur, cover en beschrijving voor je in. Kijk alles nog even na.'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: zoekOp }, 'Zoek gegevens op')), opzoekMelding) : null;

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
          ingevuld++;
        });
        opzoekMelding.textContent = r.gevonden ? ingevuld + ' velden ingevuld. Kijk ze na voor je bewaart.' : 'Open Library en Google Books kennen dit ISBN niet. Vul de gegevens zelf in.';
      });
    }

    var bewaar = el('button', { type: 'submit', class: 'knop' }, nieuw ? 'Voeg toe aan de catalogus' : 'Bewaar');
    var coverVeld = velden.filter(function (v) { return v.naam === 'cover_url'; })[0];
    var foto = nieuw ? null : fotoBlok(boek, coverVeld, ctx);
    var beschrijvingVeld = velden.filter(function (v) { return v.naam === 'beschrijving'; })[0];
    var achterkant = beschrijvingVeld ? achterkantBlok(beschrijvingVeld) : null;
    var formulier = el('form', { novalidate: true }, opzoeken, foto, achterkant, delen, herkomst ? el('fieldset', { class: 'blok' }, el('legend', {}, 'Intern'), herkomst.blok) : null,
      fout, knoppen(bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { terugNaarLijst(vak, ctx); } }, vanZonderCover ? 'Terug naar de lijst zonder cover' : 'Terug naar de boeken')));

    function verstuur(toch) {
      var invoer = nieuw ? { velden: gewijzigd(velden, true), herkomst: herkomst.lees(), toch: toch === true } : { boek_id: boek.boek_id, velden: gewijzigd(velden, false) };
      if (!nieuw && !Object.keys(invoer.velden).length) { B.melding(fout, 'ok', 'Er is niets veranderd.'); return; }
      var klaar = bezig(bewaar, 'Bezig met bewaren...');
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
        ctx.laad();
      });
    }
    formulier.addEventListener('submit', function (e) { e.preventDefault(); verstuur(false); });

    var titel = nieuw ? 'Nieuw boek' : (boek.titel || boek.boek_id);
    D.vervang(vak, ctx.kop(titel, nieuw ? 'Velden met een waarde uit een lijst mag je zo laten.' : boek.boek_id + (boek.toegevoegd_op ? ' · toegevoegd op ' + D.korteDatum(boek.toegevoegd_op) : '')), formulier);
    vak.querySelector('h2').focus();
  }

  function bewerkBoek(vak, ctx, id) {
    D.vervang(vak, el('p', {}, 'Boek laden...'));
    B.voerUit('beheerBoekOphalen', { boek_id: id }).then(function (r) {
      if (!r.ok) { B.melding($('melding'), 'fout', r.fout); toonBoeken(vak, ctx); return; }
      boekFormulier(vak, ctx, r.boek, false);
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
        if (!b.fout) return b;
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
      voortgang, status, knoppen(stopKnop, el('button', { type: 'button', class: 'knop tweede', onclick: function () { stop = true; toonBoeken(vak, ctx); } }, 'Terug naar de boeken')));

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
    ['Nieuws', 'Nieuws', ['datum', 'titel', 'tekst', 'titel_en', 'tekst_en', 'afbeelding', 'link', 'publiek'], 'Nieuw bericht'],
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
      var soort = INHOUD.filter(function (s) { return s[0] === gekozenInhoud; })[0];
      var rijen = (inhoud.tabbladen[soort[0]] || []).slice();
      if (soort[0] === 'Veelgestelde vragen') rijen.sort(function (a, b) { return (Number(a.volgorde) || 999) - (Number(b.volgorde) || 999); });
      else rijen.sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });
      var tabs = el('div', { class: 'knoppen', role: 'group', 'aria-label': 'Kies wat je wil aanpassen' }, INHOUD.map(function (s) {
        return el('button', {
          type: 'button', class: 'knop' + (s[0] === gekozenInhoud ? '' : ' tweede'), 'aria-pressed': s[0] === gekozenInhoud ? 'true' : 'false',
          onclick: function () { gekozenInhoud = s[0]; toonInhoud(vak, ctx); }
        }, s[1]);
      }));
      D.vervang(vak, ctx.kop('Nieuws en agenda', 'Berichten, events en veelgestelde vragen op de startpagina. Alles komt in het gelijknamige tabblad van de spreadsheet.'),
        tabs,
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { inhoudFormulier(vak, ctx, soort, null); } }, '+ ' + soort[3])),
        rijen.length ? el('ul', { class: 'kaartlijst' }, rijen.map(function (r) {
          var hoofd = r.titel || r.vraag || '(zonder titel)';
          var sub = soort[0] === 'Veelgestelde vragen' ? (r.volgorde ? 'Volgorde ' + r.volgorde : '') : [D.korteDatum(r.datum), r.uur, r.locatie].filter(Boolean).join(' · ');
          return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { inhoudFormulier(vak, ctx, soort, r); } },
            el('strong', {}, hoofd), sub ? el('span', {}, sub) : null,
            r.publiek === 'nee' ? el('span', { class: 'labels' }, D.statusLabel('niet_uitleenbaar', 'Verborgen')) : null));
        })) : el('p', {}, 'Hier staat nog niets.'));
    });
  }

  function inhoudFormulier(vak, ctx, soort, rij) {
    var velden = soort[2].map(function (naam) {
      var w = rij ? rij[naam] : (naam === 'publiek' ? 'ja' : '');
      return veld('bi', naam, w);
    });
    var fout = el('div', { 'aria-live': 'assertive' });
    var bewaar = el('button', { type: 'submit', class: 'knop' }, rij ? 'Bewaar' : 'Voeg toe');
    var verwijder = rij ? el('button', { type: 'button', class: 'knop tweede', onclick: function () {
      if (!window.confirm('Wil je dit echt verwijderen? Wil je het enkel even weghalen van de website, zet dan "Op de website" op Nee.')) return;
      stuur({ tabblad: soort[0], rij: rij.rij, vingerafdruk: rij.vingerafdruk, verwijderen: true }, verwijder);
    } }, 'Verwijder') : null;
    var formulier = el('form', { novalidate: true }, velden.map(function (v) { return v.blok; }), fout,
      knoppen(bewaar, el('button', { type: 'button', class: 'knop tweede', onclick: function () { toonInhoud(vak, ctx); } }, 'Terug'), verwijder));

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

  var LIJST_VELDEN = ['naam', 'naam_en', 'uitleg', 'uitleg_en', 'volgorde', 'publiek'];

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
          knoppen(schakel), schakelMelding),
        knoppen(el('button', { type: 'button', class: 'knop', onclick: function () { leeslijstFormulier(vak, ctx, null); } }, '+ Nieuwe leeslijst')),
        rijen.length ? el('ul', { class: 'kaartlijst' }, rijen.map(function (r) {
          var n = boeken.filter(function (b) { return inLijst(b, r.naam); }).length;
          return el('li', {}, el('button', { type: 'button', class: 'knop keuzeknop', onclick: function () { leeslijstOpenen(vak, ctx, r); } },
            el('strong', {}, r.naam || '(zonder naam)'), el('span', {}, n === 1 ? '1 boek' : n + ' boeken'),
            r.publiek === 'nee' ? el('span', { class: 'labels' }, D.statusLabel('niet_uitleenbaar', 'Verborgen')) : null));
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
      return el('li', {}, el('label', { class: 'vinkje', for: id }, vak2,
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
      if (!q) { D.vervang(gevondenVak, el('p', { class: 'hulptekst' }, 'Typ een deel van een titel, auteur of ISBN.')); return; }
      var gevonden = Z.zoek(index, q).slice(0, 30).map(function (r) { return r.boek; });
      D.vervang(gevondenVak, gevonden.length ? el('ul', { class: 'vinklijst' }, gevonden.map(function (b) { return vinkje(b, 'zoek'); })) : el('p', {}, 'Geen boek gevonden.'));
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

    D.vervang(vak, ctx.kop('Leeslijst ' + naam, rij.uitleg || 'Zoek boeken en vink ze aan. Klik daarna op Bewaar.'),
      knoppen(el('button', { type: 'button', class: 'knop tweede', onclick: function () {
        if (Object.keys(keuze).length && !window.confirm('Je hebt nog niet bewaard. Toch teruggaan?')) return;
        toonLeeslijsten(vak, ctx);
      } }, '← Alle leeslijsten'),
        el('button', { type: 'button', class: 'knop tweede', onclick: function () { leeslijstFormulier(vak, ctx, rij); } }, 'Naam en uitleg aanpassen')),
      el('div', { class: 'veld' }, el('label', { for: 'll-zoek' }, 'Zoek een boek om toe te voegen'), zoekveld),
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
    leeslijsten: toonLeeslijsten,
    instellingen: toonInstellingen,
    /** Bij Vernieuw: nieuws, agenda en instellingen opnieuw ophalen. */
    vergeet: function () { inhoud = null; }
  };
})(window);
