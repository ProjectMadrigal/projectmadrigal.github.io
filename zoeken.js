/**
 * zoeken.js
 * Zoeken in de catalogus, volledig in de browser.
 *   - Hoofdletters, accenten en leestekens tellen niet mee.
 *   - Lidwoorden (de, het, een, the, le, ...) worden genegeerd.
 *   - Kleine tikfouten worden vergeven ("Baldwn" vindt "Baldwin").
 *   - Een ISBN mag met of zonder streepjes, als ISBN-10 of ISBN-13.
 * Zoeken gebeurt in titel, auteur, uitgeverij en ISBN.
 */
(function (root) {
  'use strict';

  var LIDWOORDEN = ['de', 'het', 'een', 'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'el', 'los', 'las'];

  /** Kleine letters, zonder accenten en leestekens. */
  function normaliseer(tekst) {
    return String(tekst || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’'`´]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  /** Woorden zonder lidwoorden (tenzij er dan niets overblijft). */
  function woorden(tekst) {
    var alle = normaliseer(tekst).split(' ').filter(Boolean);
    var zonder = alle.filter(function (w) { return LIDWOORDEN.indexOf(w) === -1; });
    return zonder.length ? zonder : alle;
  }

  /** Tekst om op te sorteren: zonder lidwoord vooraan ("The Color Purple" bij C). */
  function sorteerTekst(tekst) {
    var w = normaliseer(tekst).split(' ').filter(Boolean);
    if (w.length > 1 && LIDWOORDEN.indexOf(w[0]) > -1) w.shift();
    return w.join(' ');
  }

  /** Levenshtein met een plafond: stopt zodra de afstand groter wordt dan max. */
  function afstand(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var vorige = [];
    for (var j = 0; j <= b.length; j++) vorige[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var huidige = [i];
      var kleinste = i;
      for (var k = 1; k <= b.length; k++) {
        var kost = a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1;
        huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + kost);
        if (huidige[k] < kleinste) kleinste = huidige[k];
      }
      if (kleinste > max) return max + 1;
      vorige = huidige;
    }
    return vorige[b.length];
  }

  /** Controlecijfer van een ISBN-10 omzetten naar ISBN-13. */
  function isbnNaar13(tekens) {
    if (tekens.length === 13) return tekens;
    if (tekens.length !== 10) return '';
    var basis = '978' + tekens.slice(0, 9);
    var som = 0;
    for (var i = 0; i < 12; i++) som += Number(basis.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    return basis + ((10 - (som % 10)) % 10);
  }

  /**
   * Maakt een zoekindex: per boek de woorden van elk veld, één keer berekend.
   * boeken: lijst uit de publieke catalogus (korte sleutels t, a, u, i).
   */
  function maakIndex(boeken) {
    return boeken.map(function (b) {
      return {
        boek: b,
        velden: [
          { gewicht: 3, woorden: woorden(b.t) },
          { gewicht: 2, woorden: woorden(b.ot) },
          { gewicht: 2, woorden: woorden(b.a) },
          { gewicht: 1, woorden: woorden(b.u) }
        ],
        isbn: String(b.i || '').replace(/[^0-9X]/gi, '')
      };
    });
  }

  /** Hoe goed past één zoekwoord bij één woord? 1 = gelijk, 0.8 = begint ermee, 0.5 = tikfout. */
  function woordScore(zoekwoord, woord) {
    if (woord === zoekwoord) return 1;
    if (zoekwoord.length >= 2 && woord.indexOf(zoekwoord) === 0) return 0.8;
    if (zoekwoord.length >= 4) {
      var max = zoekwoord.length >= 8 ? 2 : 1;
      // Ook een tikfout in een woord dat nog niet volledig getypt is.
      var deel = woord.slice(0, zoekwoord.length + 1);
      if (afstand(zoekwoord, woord, max) <= max || afstand(zoekwoord, deel, max) <= max) return 0.5;
    }
    return 0;
  }

  /**
   * Zoekt in de index. Elk zoekwoord moet ergens passen.
   * Geeft [{ boek, score }] terug, met de beste eerst.
   */
  function zoek(index, vraag) {
    var tekst = String(vraag || '').trim();
    if (!tekst) return index.map(function (r) { return { boek: r.boek, score: 0 }; });

    // Ziet de vraag eruit als een ISBN? Dan zoeken we op nummer.
    var cijfers = tekst.replace(/[\s\-]/g, '').toUpperCase();
    if (/^\d{9}[\dX]$|^\d{13}$/.test(cijfers)) {
      var isbn13 = isbnNaar13(cijfers);
      return index.filter(function (r) { return r.isbn === isbn13 || r.isbn === cijfers; })
        .map(function (r) { return { boek: r.boek, score: 10 }; });
    }

    var zoekwoorden = woorden(tekst);
    var resultaten = [];
    index.forEach(function (r) {
      var totaal = 0;
      for (var z = 0; z < zoekwoorden.length; z++) {
        var beste = 0;
        for (var v = 0; v < r.velden.length; v++) {
          var veld = r.velden[v];
          for (var w = 0; w < veld.woorden.length; w++) {
            var s = woordScore(zoekwoorden[z], veld.woorden[w]) * veld.gewicht;
            if (s > beste) beste = s;
          }
        }
        // Een deel van een ISBN mag ook ("9789").
        if (!beste && /^\d{4,}$/.test(zoekwoorden[z]) && r.isbn.indexOf(zoekwoorden[z]) > -1) beste = 1;
        if (!beste) return;
        totaal += beste;
      }
      resultaten.push({ boek: r.boek, score: totaal });
    });
    resultaten.sort(function (a, b) { return b.score - a.score; });
    return resultaten;
  }

  var api = { normaliseer: normaliseer, woorden: woorden, sorteerTekst: sorteerTekst, maakIndex: maakIndex, zoek: zoek, afstand: afstand };
  root.MadrigalZoeken = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
