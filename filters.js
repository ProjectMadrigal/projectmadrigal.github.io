/**
 * filters.js
 * De filters en het sorteren van de catalogus, volledig in de browser.
 * Een filter toevoegen? Voeg een blok toe aan FILTERS met:
 *   sleutel:  korte naam, komt ook in de link (bv. ?taal=Engels)
 *   label:    tekst boven het keuzemenu (labelSleutel: de vertaling in i18n.js)
 *   waarden:  functie(boek) die de waarde(n) van dat boek als lijst teruggeeft
 *   volgorde: (optioneel) functie die de keuzes sorteert
 */
(function (root) {
  'use strict';

  /** Periodes van uitgave. */
  var PERIODES = [
    { label: 'Voor 1970', van: 0, tot: 1969 },
    { label: '1970 tot 1989', van: 1970, tot: 1989 },
    { label: '1990 tot 1999', van: 1990, tot: 1999 },
    { label: '2000 tot 2009', van: 2000, tot: 2009 },
    { label: '2010 tot 2019', van: 2010, tot: 2019 },
    { label: '2020 en later', van: 2020, tot: 9999 }
  ];

  function periodeVan(jaar) {
    var j = Number(jaar);
    if (!j) return '';
    for (var i = 0; i < PERIODES.length; i++) {
      if (j >= PERIODES[i].van && j <= PERIODES[i].tot) return PERIODES[i].label;
    }
    return '';
  }

  function alfabetisch(a, b) { return a.localeCompare(b, 'nl'); }

  var FILTERS = [
    { sleutel: 'groep', labelSleutel: 'fOnderwerp', label: 'Onderwerp', waarden: function (b) { return b.g || []; } /* volgorde: zie catalogus */ },
    { sleutel: 'taal', labelSleutel: 'fTaal', label: 'Taal', waarden: function (b) { return b.l ? [b.l] : []; }, volgorde: alfabetisch },
    { sleutel: 'staat', labelSleutel: 'fStaat', label: 'Nieuw of tweedehands', waarden: function (b) { return b.n ? [b.n === 'nieuw' ? 'Nieuw' : 'Tweedehands'] : []; }, volgorde: alfabetisch },
    { sleutel: 'uitvoering', labelSleutel: 'fUitvoering', label: 'Uitvoering', waarden: function (b) { return b.v ? [b.v] : []; }, volgorde: alfabetisch },
    {
      sleutel: 'periode', labelSleutel: 'fPeriode', label: 'Periode van uitgave',
      waarden: function (b) { var p = periodeVan(b.j); return p ? [p] : []; },
      volgorde: function (a, b) {
        var labels = PERIODES.map(function (p) { return p.label; });
        return labels.indexOf(a) - labels.indexOf(b);
      }
    },
    { sleutel: 'aanrader', labelSleutel: 'fAanrader', label: 'Aanrader', waarden: function (b) { return (b.r || []).map(function (n) { return 'Aanrader van ' + n; }); }, volgorde: alfabetisch },
    { sleutel: 'lijst', labelSleutel: 'fLeeslijst', label: 'Leeslijst', waarden: function (b) { return b.ll || []; } /* volgorde: zie catalogus */ }
  ];

  /** De filters van de pagina Films (films.html): genre, land, periode, taal en aanrader. */
  var FILMFILTERS = [
    { sleutel: 'genre', labelSleutel: 'fGenre', label: 'Genre', waarden: function (b) { return b.g || []; }, volgorde: alfabetisch },
    { sleutel: 'land', labelSleutel: 'fLand', label: 'Land', waarden: function (b) { return b.la ? String(b.la).split(/\s*,\s*/).filter(Boolean) : []; }, volgorde: alfabetisch },
    {
      sleutel: 'periode', labelSleutel: 'fPeriodeFilm', label: 'Periode',
      waarden: function (b) { var p = periodeVan(b.j); return p ? [p] : []; },
      volgorde: function (a, b) {
        var labels = PERIODES.map(function (p) { return p.label; });
        return labels.indexOf(a) - labels.indexOf(b);
      }
    },
    { sleutel: 'taal', labelSleutel: 'fTaal', label: 'Taal', waarden: function (b) { return b.l ? [b.l] : []; }, volgorde: alfabetisch },
    { sleutel: 'aanrader', labelSleutel: 'fAanrader', label: 'Aanrader', waarden: function (b) { return (b.r || []).map(function (n) { return 'Aanrader van ' + n; }); }, volgorde: alfabetisch }
  ];

  /**
   * De keuzes per filter, met het aantal boeken.
   * groepVolgorde: de volgorde van de filtergroepen uit de catalogus.
   * lijstVolgorde: de namen van de leeslijsten, in de volgorde van de catalogus.
   * Geeft { sleutel: [{ waarde, aantal }] } terug.
   */
  function opties(boeken, groepVolgorde, lijstVolgorde, filters) {
    var resultaat = {};
    (filters || FILTERS).forEach(function (f) {
      var tel = {};
      boeken.forEach(function (b) { f.waarden(b).forEach(function (w) { tel[w] = (tel[w] || 0) + 1; }); });
      var lijst = Object.keys(tel);
      if (f.sleutel === 'lijst' && lijstVolgorde) {
        lijst.sort(function (a, b) { return lijstVolgorde.indexOf(a) - lijstVolgorde.indexOf(b); });
      } else if (f.sleutel === 'groep' && groepVolgorde) {
        lijst.sort(function (a, b) {
          var ia = groepVolgorde.indexOf(a), ib = groepVolgorde.indexOf(b);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || alfabetisch(a, b);
        });
      } else if (f.volgorde) {
        lijst.sort(f.volgorde);
      }
      resultaat[f.sleutel] = lijst.map(function (w) { return { waarde: w, aantal: tel[w] }; });
    });
    return resultaat;
  }

  /**
   * Past de gekozen filters toe.
   * keuzes: { groep: 'Gender', taal: 'Engels', ..., beschikbaar: true }
   */
  function pasToe(boeken, keuzes, filters) {
    var lijst = filters || FILTERS;
    return boeken.filter(function (b) {
      for (var i = 0; i < lijst.length; i++) {
        var f = lijst[i];
        var gekozen = keuzes[f.sleutel];
        if (gekozen && f.waarden(b).indexOf(gekozen) === -1) return false;
      }
      if (keuzes.beschikbaar && (!b.b || b.b.c !== 'beschikbaar')) return false;
      return true;
    });
  }

  /**
   * Sorteert een lijst boeken.
   * wijze: 'titel', 'auteur', 'jaar-nieuw', 'jaar-oud', 'toegevoegd' of 'relevantie' (lijst blijft zoals ze is).
   * toegevoegd: de datum van toevoegen (ta), anders het hoogste boek-ID eerst.
   */
  function sorteer(boeken, wijze) {
    var Z = root.MadrigalZoeken;
    var lijst = boeken.slice();
    var opTitel = function (a, b) { return Z.sorteerTekst(a.t).localeCompare(Z.sorteerTekst(b.t), 'nl'); };
    if (wijze === 'titel') lijst.sort(opTitel);
    else if (wijze === 'auteur') {
      lijst.sort(function (a, b) {
        // Boeken zonder auteur achteraan.
        if (!a.a !== !b.a) return a.a ? -1 : 1;
        return Z.normaliseer(a.a).localeCompare(Z.normaliseer(b.a), 'nl') || opTitel(a, b);
      });
    } else if (wijze === 'toegevoegd') {
      var nr = function (b) { return Number(String(b.id).replace(/\D/g, '')) || 0; };
      lijst.sort(function (a, b) { return String(b.ta || '').localeCompare(String(a.ta || '')) || nr(b) - nr(a); });
    } else if (wijze === 'jaar-nieuw' || wijze === 'jaar-oud') {
      var richting = wijze === 'jaar-nieuw' ? -1 : 1;
      lijst.sort(function (a, b) {
        // Boeken zonder jaartal achteraan.
        if (!a.j !== !b.j) return a.j ? -1 : 1;
        return richting * ((a.j || 0) - (b.j || 0)) || opTitel(a, b);
      });
    }
    return lijst;
  }

  /**
   * "Lees ook": boeken die op dit boek lijken. Punten voor dezelfde auteur (3), een gedeelde
   * leeslijst (2), een gedeelde aanrader (1) en elk gedeeld onderwerp (1).
   * In drie trappen, zodat elk boek suggesties krijgt:
   *   1. minstens 2 punten (sterke overeenkomst);
   *   2. is er nog plaats: 1 punt (één gedeeld onderwerp);
   *   3. is er nog plaats: dezelfde taal (dezelfde soort, boek of zine, eerst);
   *   4. is er nog altijd plaats: andere boeken, beschikbare eerst.
   * Binnen een trap: meer punten eerst, dan beschikbaar, daarna een vaste maar per boek andere
   * volgorde, zodat niet altijd dezelfde boeken verschijnen.
   */
  function gelijkaardig(boeken, boek, aantal) {
    var Z = root.MadrigalZoeken;
    var auteur = boek.a ? Z.normaliseer(boek.a) : '';
    var deel = function (x, y) { return (x || []).filter(function (w) { return (y || []).indexOf(w) > -1; }).length; };
    var meng = function (id) {
      var s = String(boek.id) + '|' + id, h = 0;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return h;
    };
    var soort = function (b) { return b.s || 'boek'; };
    return boeken.map(function (b) {
      if (b.id === boek.id) return null;
      var punten = (auteur && b.a && Z.normaliseer(b.a) === auteur ? 3 : 0) + 2 * deel(boek.ll, b.ll) + deel(boek.r, b.r) + deel(boek.g, b.g);
      var trap = punten >= 2 ? 4 : punten === 1 ? 3 : (b.l || '') === (boek.l || '') ? 2 : 1;
      return { boek: b, trap: trap, punten: punten, zelfdeSoort: soort(b) === soort(boek) ? 1 : 0, vrij: b.b && b.b.c === 'beschikbaar' ? 1 : 0, meng: meng(b.id) };
    }).filter(Boolean).sort(function (a, b) {
      return b.trap - a.trap || b.punten - a.punten || b.zelfdeSoort - a.zelfdeSoort || b.vrij - a.vrij || a.meng - b.meng;
    }).slice(0, aantal || 6).map(function (x) { return x.boek; });
  }

  var api = { FILTERS: FILTERS, FILMFILTERS: FILMFILTERS, gelijkaardig: gelijkaardig, PERIODES: PERIODES, periodeVan: periodeVan, opties: opties, pasToe: pasToe, sorteer: sorteer };
  root.MadrigalFilters = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
