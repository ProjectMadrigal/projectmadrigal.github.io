/**
 * snel-bewerken.js
 * Een boek aanpassen op de boekpagina van de website, zonder naar het bestuursscherm te gaan.
 *
 *   - Enkel als je op dit toestel aangemeld bent in het bestuursscherm (de code van het bestuur staat
 *     dan in localStorage). Bezoekers zien niets.
 *   - Titel, auteur, de gegevens (uitgeverij, jaartal, taal, pagina's, ISBN, ...) en de beschrijving.
 *   - Thema's (vinkjes), categorieën, trefwoorden en triggerwaarschuwingen (labels), en of het boek zichtbaar en
 *     uitleenbaar is (status, op de website, uitleenbaar, aantal, te koop).
 *   - De cover: een foto (bijgesneden tot 2 op 3, zoals op de website) of een link.
 *   - Dezelfde acties als het bestuursscherm: beheerBoekOphalen, beheerBoekBewaren, beheerCoverUpload
 *     en beheerCoverVanLink. De web-app kijkt de code bij elke vraag na.
 */
(function (root) {
  'use strict';

  var D = root.MadrigalDom;
  var el = D.el;

  var CODE = 'madrigal_code_bestuur';
  var WIE = 'madrigal_wie';

  // Keuzes voor de velden met een vaste lijst (zoals in het bestuursscherm).
  var KEUZES = {
    status: [['', 'Gewoon'], ['verloren', 'Verloren'], ['gevoelig verborgen', 'Gevoelig, verborgen'], ['gevoelig zichtbaar', 'Gevoelig, zichtbaar met label']],
    publiek: [['ja', 'Ja'], ['nee', 'Nee, verborgen']],
    uitleenbaar: [['ja', 'Ja'], ['nee', 'Nee']],
    te_koop: [['', 'Nee'], ['ja', 'Ja, te koop en niet uitleenbaar']],
    taal: [['', 'Onbekend'], ['Nederlands', 'Nederlands'], ['Engels', 'Engels'], ['Frans', 'Frans'], ['Duits', 'Duits']],
    uitvoering: [['', 'Onbekend'], ['Hardcover', 'Hardcover'], ['Paperback', 'Paperback'], ['Pocket', 'Pocket']]
  };
  // [veld in de Catalogus, label, soort invoer, groep]. Soort: tekst, getal, lang, keuze, vinkjes, lijst.
  // Een lijst krijgt zijn keuzes uit beheerBoekOphalen (r.keuzes): themas, categorieen, trefwoorden, triggerwaarschuwingen.
  var VELDEN = [
    ['titel', 'Titel', 'tekst'],
    ['originele_titel', 'Originele titel', 'tekst'],
    ['auteur', 'Auteur', 'tekst'],
    ['uitgeverij', 'Uitgeverij', 'tekst'],
    ['jaartal', 'Jaartal', 'getal'],
    ['taal', 'Taal', 'keuze'],
    ['paginas', "Pagina's", 'getal'],
    ['uitvoering', 'Uitvoering', 'keuze'],
    ['isbn', 'ISBN', 'tekst'],
    ['beschrijving', 'Beschrijving', 'lang'],
    ['beschrijving_en', 'Beschrijving in het Engels (leeg: het script vertaalt ze)', 'lang'],
    ['extra_onderwerpen', 'Thema\'s', 'vinkjes', 'themas'],
    ['categorieen', 'Categorieën', 'lijst', 'categorieen'],
    ['trefwoorden', 'Trefwoorden', 'lijst', 'trefwoorden'],
    ['triggerwaarschuwingen', 'Triggerwaarschuwingen', 'lijst', 'triggerwaarschuwingen'],
    ['status', 'Status', 'keuze'],
    ['publiek', 'Op de website', 'keuze'],
    ['uitleenbaar', 'Uitleenbaar', 'keuze'],
    ['aantal', 'Aantal exemplaren', 'getal'],
    ['te_koop', 'Te koop', 'keuze']
  ];
  // Kopjes in het formulier: voor welk veld een nieuw blok begint.
  var KOPJES = { titel: 'Het boek', extra_onderwerpen: 'Thema\'s, categorieën en trefwoorden', status: 'Beschikbaar en zichtbaar' };

  function lees(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

  /** Ben je op dit toestel aangemeld als bestuur? */
  function actief() { return !!(lees(CODE) && lees(WIE)) && root.MadrigalApi && root.MadrigalApi.isGekoppeld(); }

  function vraag(actie, gegevens) {
    return root.MadrigalApi.verstuur(actie, Object.assign({ code: lees(CODE), wie: lees(WIE) }, gegevens)).then(function (r) {
      if (r && r.code === 'ongeldige_code') r.fout = 'Je code klopt niet meer. Meld je opnieuw aan in het bestuursscherm.';
      return r;
    }, function () { return { ok: false, fout: 'Geen verbinding met de web-app.' }; });
  }

  function melding(vak, soort, tekst) {
    D.vervang(vak, el('div', { class: 'melding ' + soort, role: soort === 'fout' ? 'alert' : 'status' }, tekst));
  }

  /**
   * Opent het venster om boek b (zoals op de website: b.id, b.t, ...) aan te passen.
   * klaar(wijzigingen): na het bewaren, met de nieuwe waarden in de velden van de Catalogus (en cover_url).
   */
  function open(b, klaar) {
    var venster = el('dialog', { class: 'snel-bewerken', 'aria-labelledby': 'sb-kop' });
    var inhoud = el('div', {}, el('p', {}, 'Gegevens laden...'));
    var sluit = el('button', { type: 'button', class: 'knop tweede' }, 'Sluit');
    sluit.addEventListener('click', function () { venster.close(); });
    venster.addEventListener('close', function () { venster.remove(); });
    venster.appendChild(el('h2', { id: 'sb-kop' }, 'Bewerk dit boek'));
    venster.appendChild(inhoud);
    venster.appendChild(el('div', { class: 'knoppen' }, sluit));
    document.body.appendChild(venster);
    venster.showModal();

    vraag('beheerBoekOphalen', { boek_id: b.id }).then(function (r) {
      if (!r.ok) { melding(inhoud, 'fout', r.fout || 'Het boek kon niet laden.'); return; }
      D.vervang(inhoud, coverBlok(b, r.boek, klaar), formulier(b, r.boek, klaar, venster, r.keuzes || {}));
    });
  }

  function formulier(b, boek, klaar, venster, keuzes) {
    var invoer = {};
    var fout = el('div', { 'aria-live': 'assertive' });
    var knop = el('button', { type: 'submit', class: 'knop' }, 'Bewaar');
    var vorm = el('form', { novalidate: true }, VELDEN.map(function (v) {
      var id = 'sb-' + v[0];
      var waarde = boek[v[0]] === undefined || boek[v[0]] === null ? '' : String(boek[v[0]]);
      var kop = KOPJES[v[0]] ? el('h3', { class: 'sb-kopje' }, KOPJES[v[0]]) : null;
      if (v[2] === 'vinkjes' || v[2] === 'lijst') {
        var l = D.lijstVeld({ id: id, label: v[1], waarde: waarde, keuzes: keuzes[v[3]] || [], vinkjes: v[2] === 'vinkjes' });
        invoer[v[0]] = l.invoer;
        return [kop, l.blok];
      }
      if (v[2] === 'keuze') {
        invoer[v[0]] = el('select', { id: id }, KEUZES[v[0]].map(function (k) { return el('option', { value: k[0], selected: k[0] === waarde }, k[1]); }));
        if (waarde && !KEUZES[v[0]].some(function (k) { return k[0] === waarde; })) invoer[v[0]].appendChild(el('option', { value: waarde, selected: true }, waarde));
      } else {
        invoer[v[0]] = v[2] === 'lang'
          ? el('textarea', { id: id, rows: v[0] === 'beschrijving' ? '8' : '4' }, waarde)
          : el('input', { type: 'text', id: id, value: waarde, inputmode: v[2] === 'getal' ? 'numeric' : null });
      }
      return [kop, el('div', { class: 'veld' }, el('label', { for: id }, v[1]), invoer[v[0]])];
    }), fout, el('div', { class: 'knoppen' }, knop));
    vorm.addEventListener('submit', function (e) {
      e.preventDefault();
      // Enkel wat veranderde, gaat naar de web-app.
      var velden = {};
      VELDEN.forEach(function (v) {
        var oud = boek[v[0]] === undefined || boek[v[0]] === null ? '' : String(boek[v[0]]);
        // Een lege cel en de eerste keuze (bv. Op de website: Ja) zijn hetzelfde: niets veranderd.
        if (v[2] === 'keuze' && !oud && invoer[v[0]].value === KEUZES[v[0]][0][0]) return;
        if (invoer[v[0]].value.trim() !== oud.trim()) velden[v[0]] = invoer[v[0]].value;
      });
      if (!Object.keys(velden).length) { melding(fout, 'info', 'Er is niets veranderd.'); return; }
      if (velden.hasOwnProperty('titel') && !velden.titel.trim()) { melding(fout, 'fout', 'Een boek heeft een titel nodig.'); invoer.titel.focus(); return; }
      knop.disabled = true;
      vraag('beheerBoekBewaren', { boek_id: b.id, velden: velden }).then(function (r) {
        knop.disabled = false;
        if (!r.ok) { melding(fout, 'fout', r.fout || 'Bewaren lukte niet.'); return; }
        Object.keys(velden).forEach(function (k) { boek[k] = velden[k]; });
        venster.close();
        klaar(velden, r.tekst + ' Andere bezoekers zien het binnen enkele minuten.');
      });
    });
    return vorm;
  }

  function coverBlok(b, boek, klaar) {
    var huidig = el('img', { class: 'cover-voorbeeld', alt: 'Huidige cover', src: boek.cover_url || '', hidden: !boek.cover_url });
    var foto = el('input', { type: 'file', id: 'sb-foto', accept: 'image/*' });
    var snijVak = el('div');
    var bericht = el('div', { 'aria-live': 'polite' });
    var fotoKnop = el('button', { type: 'button', class: 'knop', hidden: true }, 'Gebruik deze foto als cover');
    var snijder = null;
    foto.addEventListener('change', function () {
      var bestand = foto.files && foto.files[0];
      fotoKnop.hidden = true; D.vervang(snijVak);
      if (!bestand) return;
      D.coverUitFoto(bestand, 'sb-foto').then(function (s) {
        snijder = s; D.vervang(snijVak, s.vak); fotoKnop.hidden = false;
      }, function (e) { melding(bericht, 'fout', e.message); });
    });
    function nieuweCover(r) {
      if (!r.ok) { melding(bericht, 'fout', r.fout || 'Dat lukte niet.'); return; }
      boek.cover_url = r.cover_url;
      huidig.src = r.cover_url; huidig.hidden = false;
      D.vervang(snijVak); fotoKnop.hidden = true; foto.value = ''; link.value = '';
      melding(bericht, 'ok', r.tekst + ' Andere bezoekers zien ze binnen enkele minuten.');
      klaar({ cover_url: r.cover_url });
    }
    fotoKnop.addEventListener('click', function () {
      fotoKnop.disabled = true;
      vraag('beheerCoverUpload', { boek_id: b.id, data: snijder.dataUrl().split(',')[1], mime: 'image/jpeg' }).then(function (r) {
        fotoKnop.disabled = false;
        nieuweCover(r);
      });
    });
    var link = el('input', { type: 'url', id: 'sb-link', inputmode: 'url', autocomplete: 'off', placeholder: 'https://...' });
    var linkKnop = el('button', { type: 'button', class: 'knop tweede' }, 'Gebruik deze link');
    linkKnop.addEventListener('click', function () {
      var url = link.value.trim();
      if (!url) { melding(bericht, 'fout', 'Plak eerst een link.'); link.focus(); return; }
      if (/^data:image\//.test(url)) {
        // Uit Google Afbeeldingen komt soms de afbeelding zelf mee: die snijden we bij zoals een foto.
        fetch(url).then(function (a) { return a.blob(); }).then(function (blob) { return D.coverUitFoto(blob, 'sb-foto'); }).then(function (s) {
          snijder = s; D.vervang(snijVak, s.vak); fotoKnop.hidden = false;
        }, function (e) { melding(bericht, 'fout', e.message); });
        return;
      }
      linkKnop.disabled = true;
      melding(bericht, 'info', 'Afbeelding ophalen...');
      vraag('beheerCoverVanLink', { boek_id: b.id, url: url }).then(function (r) {
        linkKnop.disabled = false;
        nieuweCover(r);
      });
    });
    return el('fieldset', { class: 'blok' }, el('legend', {}, 'Cover'), huidig,
      el('p', { class: 'hulptekst' }, 'Een foto wordt bijgesneden tot de vorm van een cover (2 op 3), zoals op de website. Een link naar een afbeelding of een webpagina (bv. bol.com) kan ook.'),
      el('div', { class: 'veld' }, el('label', { for: 'sb-foto' }, 'Foto nemen of kiezen'), foto), snijVak,
      el('div', { class: 'knoppen' }, fotoKnop),
      el('div', { class: 'veld' }, el('label', { for: 'sb-link' }, 'Of plak een link'), link),
      el('div', { class: 'knoppen' }, linkKnop), bericht);
  }

  root.MadrigalSnelBewerken = { actief: actief, open: open };
})(window);
