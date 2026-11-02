/**
 * Titels.js
 * De schrijfwijze van titels gelijktrekken, volgens de regel van de taal van het boek (kolom taal).
 *
 *   - Engels: Title Case. Elk woord met een hoofdletter, behalve kleine woorden (a, the, of, and, in, ...)
 *     die niet vooraan of achteraan staan: "The Picture of Dorian Gray".
 *   - Nederlands, Frans, Spaans, Italiaans, Portugees: enkel het eerste woord (en het eerste woord na een
 *     dubbelpunt) met een hoofdletter, plus namen: "Het portret van Dorian Gray".
 *   - Duits (zelfstandige naamwoorden met een hoofdletter) en onbekende talen: niets.
 *
 * Namen herkent het script uit de Catalogus zelf: woorden die in de beschrijvingen midden in een zin
 * bijna altijd met een hoofdletter staan (Dorian, Antwerpen), en de namen van de auteurs. Afkortingen
 * (LGBTQ, HIV) en woorden met een hoofdletter in het midden (McCarthy) blijven zoals ze zijn.
 *
 * Stap 1 (menu): het tabblad "Titels nakijken" met de huidige en de voorgestelde titel. Jij kijkt na:
 * pas titel_nieuw aan of zet toepassen op nee. Stap 2 (menu): enkel wat op ja staat, komt in de Catalogus.
 */

var TITEL_KLEIN_EN = ['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'with', 'from', 'into', 'onto', 'over', 'than'];
var TITEL_AFKORTINGEN = ['lgbt', 'lgbtq', 'lgbtqi', 'lgbtqia', 'lgbti', 'lhbt', 'lhbti', 'lhbtiq', 'aids', 'hiv', 'bdsm', 'usa', 'uk', 'vs', 'ok', 'dj', 'tv', 'nyc', 'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', 'xii'];
var TITEL_ZINSTALEN = ['Nederlands', 'Frans', 'Spaans', 'Italiaans', 'Portugees'];
var TITEL_WOORD = /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’]*/g;

/** De taalregel voor een boek: 'en', 'zin' of '' (niets aanpassen). */
function titelRegel(taal) {
  var eerste = normaliseerTaal(String(taal || '').split(/[,;\/&]| en /)[0]);
  if (eerste === 'Engels') return 'en';
  return TITEL_ZINSTALEN.indexOf(eerste) > -1 ? 'zin' : '';
}

/** Begint dit woord met een hoofdletter? */
function titelGroot(w) {
  return w.charAt(0) !== w.charAt(0).toLowerCase();
}

/**
 * Namen uit de Catalogus: woorden die in de beschrijvingen midden in een zin bijna altijd groot staan
 * (minstens 2 keer, en minstens 4 keer zo vaak groot als klein), en de woorden uit de namen van de auteurs.
 * Geeft { woord in kleine letters: true }.
 */
function titelNamen(catalogus) {
  var groot = {}, klein = {}, namen = {};
  catalogus.forEach(function (b) {
    String(b.beschrijving || '').split(/[.!?:\n]+\s*/).forEach(function (zin) {
      var woorden = zin.match(TITEL_WOORD) || [];
      woorden.slice(1).forEach(function (w) {
        var k = w.toLowerCase();
        if (titelGroot(w)) groot[k] = (groot[k] || 0) + 1; else klein[k] = (klein[k] || 0) + 1;
      });
    });
    (String(b.auteur || '').match(TITEL_WOORD) || []).forEach(function (w) {
      if (titelGroot(w) && w.length >= 3) namen[w.toLowerCase()] = true;
    });
  });
  Object.keys(groot).forEach(function (k) { if (groot[k] >= 2 && groot[k] >= 4 * (klein[k] || 0)) namen[k] = true; });
  // Kleine woorden zijn nooit een naam, ook al staan ze soms groot (De Wever, Van Gogh).
  ['de', 'het', 'een', 'van', 'en', 'in', 'op', 'the', 'and', 'of', 'le', 'la', 'les', 'du', 'des', 'et', 'el', 'y', 'der', 'den', 'ter', 'ten'].forEach(function (k) { delete namen[k]; });
  return namen;
}

/** Een woord met de eerste letter groot (de rest blijft zoals het is). */
function titelHoofdletter(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * De titel volgens de regel van de taal. namen: van titelNamen. Geeft de titel terug (ongewijzigd als de taal
 * geen regel heeft).
 */
function titelSchrijfwijze(titel, taal, namen) {
  var regel = titelRegel(taal);
  var t = schoon(titel);
  if (!regel || !t) return t;
  namen = namen || {};
  var letters = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  var allesGroot = letters.length > 3 && letters === letters.toUpperCase();
  var woorden = t.match(TITEL_WOORD) || [];
  // In Title Case geschreven (de meeste woorden groot, ook kleine woorden): dan zeggen de hoofdletters niets over namen.
  var grootTeller = woorden.slice(1).filter(titelGroot).length;
  var titelCase = allesGroot || (woorden.length > 2 && grootTeller >= 0.6 * (woorden.length - 1));
  var laatste = woorden.length ? woorden[woorden.length - 1] : '';
  var nr = 0, vorigEinde = 0;
  return t.replace(TITEL_WOORD, function (w, plaats) {
    nr++;
    var ervoor = t.slice(vorigEinde, plaats);
    vorigEinde = plaats + w.length;
    var begin = nr === 1 || /[:.!?]\s*$|\s[-–—]\s*$/.test(ervoor);
    var k = w.toLowerCase();
    // Afkortingen en woorden met een hoofdletter in het midden (McCarthy) laten we staan.
    if (TITEL_AFKORTINGEN.indexOf(k.replace(/['’].*$/, '')) > -1) return allesGroot || w === w.toUpperCase() ? w.toUpperCase() : w;
    if (!allesGroot && /[a-zà-öø-ÿ].*[A-ZÀ-ÖØ-Þ]/.test(w)) return w;
    if (!allesGroot && w.length >= 2 && w.length <= 6 && w === w.toUpperCase() && !begin) return w;
    var basis = allesGroot ? k : w;
    if (regel === 'en') {
      if (begin || w === laatste || TITEL_KLEIN_EN.indexOf(k) === -1) return titelHoofdletter(basis);
      return k;
    }
    // Zinsregel: eerste woord groot, namen groot, de rest klein.
    if (begin) return titelHoofdletter(basis);
    if (namen[k]) return titelHoofdletter(basis);
    if (!titelCase && titelGroot(w)) return w; // bewust groot in een titel die verder klein is: wellicht een naam
    return k;
  });
}

/** De voorstellen: elk boek waarvan de titel volgens de regel anders zou zijn. [{ boek_id, taal, titel_nu, titel_nieuw }] */
function titelNakijklijst(catalogus) {
  var namen = titelNamen(catalogus);
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel) || isFilm(b)) return;
    var nieuw = titelSchrijfwijze(b.titel, b.taal, namen);
    if (nieuw && nieuw !== schoon(b.titel)) uit.push({ boek_id: String(b.boek_id), taal: normaliseerTaal(b.taal), titel_nu: schoon(b.titel), titel_nieuw: nieuw, toepassen: 'ja' });
  });
  return uit;
}

/**
 * Past de nakijklijst toe: rijen met toepassen = ja en een titel_nieuw die enkel in hoofdletters of spaties
 * verschilt van de titel in de Catalogus (een andere titel nemen we niet zomaar over: dat kan een tikfout zijn).
 * Geeft { gedaan, overgeslagen }.
 */
function titelsToepassen(catalogus, rijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var uit = { gedaan: 0, overgeslagen: 0 };
  rijen.forEach(function (r) {
    if (jaNee(r.toepassen) !== 'ja') return;
    var boek = perId[String(r.boek_id)];
    var nieuw = schoon(r.titel_nieuw);
    if (!boek || !nieuw || nieuw === schoon(boek.titel)) return;
    if (normaliseerTekst(nieuw) !== normaliseerTekst(boek.titel) && schoon(r.titel_nu) !== schoon(boek.titel)) { uit.overgeslagen++; return; }
    wijzig(boek, { titel: nieuw });
    wijzig(r, { toepassen: 'gedaan' });
    uit.gedaan++;
  });
  return uit;
}

/* ---------- In Apps Script ---------- */

var TITELS_TABBLAD = 'Titels nakijken';
var TITELS_KOLOMMEN = ['boek_id', 'taal', 'titel_nu', 'titel_nieuw', 'toepassen'];

/** Menu: stap 1, de nakijklijst maken (het tabblad Titels nakijken wordt opnieuw geschreven). */
function maakTitelNakijklijst() {
  var lijst = titelNakijklijst(leesTabel('Catalogus').rijen);
  var ss = spreadsheet();
  var blad = ss.getSheetByName(TITELS_TABBLAD) || ss.insertSheet(TITELS_TABBLAD);
  blad.clear();
  var waarden = [TITELS_KOLOMMEN].concat(lijst.map(function (r) { return TITELS_KOLOMMEN.map(function (k) { return r[k]; }); }));
  blad.getRange(1, 1, waarden.length, TITELS_KOLOMMEN.length).setValues(waarden);
  opmaakKop(blad, TITELS_KOLOMMEN.length);
  blad.setColumnWidth(3, 360);
  blad.setColumnWidth(4, 360);
  logboek('menu', 'maakTitelNakijklijst', lijst.length + ' titels met een voorstel');
  meld(lijst.length + ' titels hebben een andere schrijfwijze nodig. Kijk ze na in het tabblad ' + TITELS_TABBLAD + ': pas titel_nieuw aan waar nodig, of zet toepassen op nee. Kies daarna Madrigal > Boeken > Titels: pas de nakijklijst toe.');
}

/** Schrijft de gewijzigde waarden van één kolom in één keer terug naar het tabblad. */
function titelsSchrijfKolom(tabel, kolom) {
  var nr = tabel.kop.indexOf(kolom) + 1;
  var aantal = tabel.blad.getLastRow() - 1;
  if (nr < 1 || aantal < 1) return;
  var bereik = tabel.blad.getRange(2, nr, aantal, 1);
  var waarden = bereik.getValues();
  var veranderd = false;
  tabel.rijen.forEach(function (r) {
    if (!r._gewijzigd || !r._rij || r._rij < 2 || r._rij > aantal + 1) return;
    waarden[r._rij - 2][0] = r[kolom];
    r._gewijzigd = false;
    r._velden = {};
    veranderd = true;
  });
  if (veranderd) bereik.setValues(waarden);
}

/** Menu: stap 2, de nakijklijst toepassen op de Catalogus. */
function pasTitelNakijklijstToe() {
  if (!spreadsheet().getSheetByName(TITELS_TABBLAD)) { meld('Maak eerst de nakijklijst: Madrigal > Boeken > Titels: maak een nakijklijst.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var lijst = leesTabel(TITELS_TABBLAD);
    uit = titelsToepassen(catalogus.rijen, lijst.rijen);
    // Eén kolom in één keer schrijven: rij per rij bewaren duurt bij honderden titels langer dan 6 minuten.
    titelsSchrijfKolom(catalogus, 'titel');
    titelsSchrijfKolom(lijst, 'toepassen');
  } finally {
    lock.releaseLock();
  }
  leegCache();
  var tekst = uit.gedaan + ' titels aangepast in de Catalogus.' + (uit.overgeslagen ? ' ' + uit.overgeslagen + ' overgeslagen: de titel in de Catalogus was intussen veranderd.' : '');
  logboek('menu', 'pasTitelNakijklijstToe', tekst);
  meld(tekst);
}
