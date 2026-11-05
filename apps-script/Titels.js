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
 * Staat de titel duidelijk in een andere taal dan de kolom taal zegt, dan stelt het script ook een andere taal
 * voor (kolom taal_nieuw) en past het de regel van die taal toe.
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

/*
 * De taal raden uit de titel. Google Books en Open Library zetten soms Engels bij een Nederlands of Frans boek.
 * Het script telt kleine woorden die typisch zijn voor een taal (het, een, van, les, und, ...). Woorden die in
 * meer talen voorkomen (de, en, die) tellen half. Korte titels zonder zulke woorden (Giovanni's Room) blijven
 * bij de taal uit de Catalogus.
 */
var TITEL_TAALWOORDEN = {
  Nederlands: ['het', 'een', 'van', 'voor', 'op', 'zijn', 'niet', 'naar', 'uit', 'als', 'wat', 'hoe', 'mijn', 'jouw', 'door', 'bij', 'tot', 'aan', 'ook', 'dat', 'geen', 'nooit', 'meer', 'nog', 'ik', 'wij', 'jij', 'zij', 'onze', 'ons', 'hun', 'wie', 'waar', 'waarom', 'wanneer', 'tussen', 'zonder', 'leven', 'liefde', 'verhalen', 'jongen', 'meisje', 'mannen', 'vrouwen'],
  Engels: ['the', 'of', 'and', 'to', 'with', 'for', 'my', 'your', 'his', 'her', 'our', 'their', 'is', 'are', 'how', 'what', 'why', 'who', 'from', 'about', 'when', 'this', 'that', 'you', 'we', 'they', 'it', 'not', 'an', 'be', 'love', 'life', 'story', 'stories', 'boy', 'girl', 'men', 'women', 'guide'],
  Frans: ['le', 'la', 'les', 'des', 'du', 'une', 'et', 'est', 'pour', 'dans', 'sur', 'au', 'aux', 'avec', 'sans', 'qui', 'ne', 'pas', 'mon', 'ma', 'mes', 'ses', 'amour', 'vie', 'fille', 'garçon', 'femmes', 'hommes'],
  Spaans: ['el', 'los', 'las', 'y', 'por', 'para', 'con', 'sin', 'mi', 'su', 'es', 'al', 'amor', 'vida', 'mujeres', 'hombres'],
  Duits: ['der', 'das', 'und', 'ein', 'eine', 'ist', 'mit', 'für', 'von', 'zu', 'im', 'auf', 'nicht', 'ich', 'wir', 'liebe', 'leben'],
  Italiaans: ['il', 'lo', 'gli', 'della', 'di', 'che', 'nel', 'nella', 'amore', 'vita'],
  Portugees: ['os', 'do', 'da', 'dos', 'um', 'uma', 'em', 'com', 'não', 'amor']
};
// Woorden die in meer talen voorkomen: elke taal krijgt een halve punt.
var TITEL_GEDEELD = { de: ['Nederlands', 'Frans', 'Spaans', 'Portugees'], en: ['Nederlands', 'Frans'], die: ['Nederlands', 'Duits'], den: ['Nederlands', 'Duits'], in: ['Nederlands', 'Engels', 'Duits', 'Italiaans'], un: ['Frans', 'Italiaans'], una: ['Spaans', 'Italiaans'], del: ['Spaans', 'Italiaans'], per: ['Italiaans'], e: ['Italiaans', 'Portugees'], o: ['Portugees'], a: ['Engels'], i: ['Engels'], que: ['Frans', 'Spaans', 'Portugees'], as: ['Engels', 'Portugees'], das: ['Duits', 'Portugees'], on: ['Engels'], no: ['Engels', 'Spaans', 'Portugees'], me: ['Engels', 'Spaans'], te: ['Nederlands', 'Spaans'], om: ['Nederlands'], er: ['Nederlands'], is: ['Engels', 'Nederlands'], was: ['Engels', 'Nederlands'], man: ['Engels', 'Nederlands'], met: ['Nederlands', 'Engels'], over: ['Nederlands', 'Engels'] };

/** Punten per taal voor een titel: { Nederlands: 2, Engels: 0.5, ... }. */
function titelTaalPunten(titel) {
  var punten = {};
  Object.keys(TITEL_TAALWOORDEN).forEach(function (t) { punten[t] = 0; });
  var gezien = {};
  String(titel || '').toLowerCase().split(/[^a-zà-öø-ÿ'’]+/).forEach(function (w) {
    if (!w) return;
    if (/^(l|d|qu|j|n|s|c)['’][a-zà-öø-ÿ]/.test(w)) { punten.Frans += 1; return; } // l'amour, d'une
    w = w.replace(/['’].*$/, '');
    if (!w || gezien[w]) return;
    gezien[w] = true;
    Object.keys(TITEL_TAALWOORDEN).forEach(function (t) { if (TITEL_TAALWOORDEN[t].indexOf(w) > -1) punten[t] += 1; });
    (TITEL_GEDEELD[w] || []).forEach(function (t) { punten[t] += 0.5; });
  });
  return punten;
}

/**
 * De taal van een titel, als die duidelijk is: minstens 1 punt en minstens 1 punt meer dan elke andere taal.
 * Anders ''.
 */
function titelTaalRaden(titel) {
  var punten = titelTaalPunten(titel);
  var talen = Object.keys(punten).sort(function (a, b) { return punten[b] - punten[a]; });
  if (punten[talen[0]] >= 1 && punten[talen[0]] - punten[talen[1]] >= 1) return talen[0];
  return '';
}

/**
 * Stelt een andere taal voor als de titel duidelijk in een andere taal staat dan de kolom taal zegt
 * (of als de kolom taal leeg is). Een kolom met meer talen (Nederlands, Engels) laten we staan. Geeft '' of de taal.
 */
function titelTaalVoorstel(titel, taal) {
  if (/[,;\/&]| en /.test(String(taal || ''))) return '';
  var nu = normaliseerTaal(taal);
  var geraden = titelTaalRaden(titel);
  if (!geraden || geraden === nu) return '';
  // De huidige taal moet duidelijk minder punten hebben, anders twijfelen we en laten we ze staan.
  var punten = titelTaalPunten(titel);
  if (nu && punten[nu] !== undefined && punten[geraden] - punten[nu] < 1) return '';
  return geraden;
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
    // Kleine woorden in de titels tellen mee als bewijs dat een woord geen naam is (ik ben, alles wat was).
    (String(b.titel || '').match(TITEL_WOORD) || []).slice(1).forEach(function (w) {
      if (!titelGroot(w)) { var k = w.toLowerCase(); klein[k] = (klein[k] || 0) + 1; }
    });
  });
  Object.keys(groot).forEach(function (k) { if (groot[k] >= 2 && groot[k] >= 4 * (klein[k] || 0)) namen[k] = true; });
  // Een auteur die Ben of Was heet, maakt van ben en was nog geen naam: een woord dat vaak klein staat, is gewoon een woord.
  Object.keys(namen).forEach(function (k) { if ((klein[k] || 0) >= 3 && (klein[k] || 0) >= (groot[k] || 0)) delete namen[k]; });
  // Kleine woorden zijn nooit een naam, ook al staan ze soms groot (De Wever, Van Gogh).
  ['de', 'het', 'een', 'van', 'en', 'in', 'op', 'the', 'and', 'of', 'le', 'la', 'les', 'du', 'des', 'et', 'el', 'y', 'der', 'den', 'ter', 'ten'].forEach(function (k) { delete namen[k]; });
  return namen;
}

/**
 * Een titel die eigenlijk een datum is ("Mon Jul 24 2023 00:00:00 GMT+0200 ..."): de spreadsheet maakte ooit
 * een datum van de titel (bv. 24/7). Die passen we niet aan: jij verbetert de titel met de hand.
 */
function titelIsDatum(titel) {
  return /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT/.test(schoon(titel));
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
  if (!regel || !t || titelIsDatum(t)) return t;
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

/**
 * De voorstellen: elk boek waarvan de titel volgens de regel anders zou zijn, of waarvan de titel duidelijk
 * in een andere taal staat. [{ boek_id, taal, taal_nieuw, titel_nu, titel_nieuw, toepassen }]
 */
function titelNakijklijst(catalogus) {
  var namen = titelNamen(catalogus);
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel) || isFilm(b) || titelIsDatum(b.titel)) return;
    var taalNieuw = titelTaalVoorstel(b.titel, b.taal);
    var nieuw = titelSchrijfwijze(b.titel, taalNieuw || b.taal, namen);
    if (taalNieuw || (nieuw && nieuw !== schoon(b.titel))) {
      // Een andere taal is een gok op basis van de titel (een vertaling houdt soms de Engelse titel):
      // die rijen staan op nee tot jij ze nakijkt. De titel hangt dan ook af van die taal.
      uit.push({ boek_id: String(b.boek_id), taal: schoon(b.taal), taal_nieuw: taalNieuw, titel_nu: schoon(b.titel), titel_nieuw: nieuw, toepassen: taalNieuw ? 'nee' : 'ja' });
    }
  });
  // De rijen met een andere taal bovenaan, de rest in de volgorde van de Catalogus.
  return uit.filter(function (r) { return r.taal_nieuw; }).concat(uit.filter(function (r) { return !r.taal_nieuw; }));
}

/**
 * Past de nakijklijst toe: rijen met toepassen = ja. De titel enkel als titel_nieuw alleen in hoofdletters of
 * spaties verschilt van de titel in de Catalogus (een andere titel nemen we niet zomaar over: dat kan een
 * tikfout zijn). De taal als taal_nieuw ingevuld is.
 * Geeft { gedaan, overgeslagen }.
 */
function titelsToepassen(catalogus, rijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var uit = { gedaan: 0, overgeslagen: 0 };
  rijen.forEach(function (r) {
    if (jaNee(r.toepassen) !== 'ja') return;
    var boek = perId[String(r.boek_id)];
    if (!boek) return;
    var nieuw = schoon(r.titel_nieuw);
    var taalNieuw = normaliseerTaal(r.taal_nieuw);
    var velden = {};
    if (nieuw && nieuw !== schoon(boek.titel)) {
      if (normaliseerTekst(nieuw) !== normaliseerTekst(boek.titel) && schoon(r.titel_nu) !== schoon(boek.titel)) { uit.overgeslagen++; return; }
      velden.titel = nieuw;
    }
    if (taalNieuw && taalNieuw !== normaliseerTaal(boek.taal)) velden.taal = taalNieuw;
    if (!Object.keys(velden).length) return;
    wijzig(boek, velden);
    wijzig(r, { toepassen: 'gedaan' });
    uit.gedaan++;
  });
  return uit;
}

/* ---------- In Apps Script ---------- */

var TITELS_TABBLAD = 'Titels nakijken';
var TITELS_KOLOMMEN = ['boek_id', 'taal', 'taal_nieuw', 'titel_nu', 'titel_nieuw', 'toepassen'];

/** Menu: stap 1, de nakijklijst maken (het tabblad Titels nakijken wordt opnieuw geschreven). */
function maakTitelNakijklijst() {
  var catalogus = leesTabel('Catalogus').rijen;
  var lijst = titelNakijklijst(catalogus);
  var datums = catalogus.filter(function (b) { return !isLeeg(b.boek_id) && titelIsDatum(b.titel); }).map(function (b) { return String(b.boek_id); });
  var ss = spreadsheet();
  var blad = ss.getSheetByName(TITELS_TABBLAD) || maakTabblad(TITELS_TABBLAD);
  blad.clear();
  // clear() laat keuzelijsten staan: die van een vorige versie (andere kolommen) eerst weghalen.
  blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
  var waarden = [TITELS_KOLOMMEN].concat(lijst.map(function (r) { return TITELS_KOLOMMEN.map(function (k) { return r[k]; }); }));
  blad.getRange(1, 1, waarden.length, TITELS_KOLOMMEN.length).setValues(waarden);
  opmaakKop(blad, TITELS_KOLOMMEN.length);
  blad.setColumnWidth(TITELS_KOLOMMEN.indexOf('titel_nu') + 1, 360);
  blad.setColumnWidth(TITELS_KOLOMMEN.indexOf('titel_nieuw') + 1, 360);
  if (lijst.length) {
    // Keuzelijst ja / nee in de kolom toepassen (gedaan mag ook: dat zet het script na het toepassen).
    blad.getRange(2, TITELS_KOLOMMEN.indexOf('toepassen') + 1, lijst.length, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee', 'gedaan'], true).setAllowInvalid(false).build());
    blad.setFrozenRows(1);
  }
  var talen = lijst.filter(function (r) { return r.taal_nieuw; }).length;
  logboek('menu', 'maakTitelNakijklijst', lijst.length + ' titels met een voorstel, waarvan ' + talen + ' met een andere taal');
  meld(lijst.length + ' titels hebben een voorstel, waarvan ' + talen + ' met een andere taal (kolom taal_nieuw). De rijen met een andere taal staan bovenaan en op nee: kijk na of het boek echt in die taal geschreven is en zet dan ja. Voor de andere rijen: pas titel_nieuw aan waar nodig, of zet toepassen op nee. Kies daarna Madrigal > Titels en auteurs > Schrijfwijze: pas de nakijklijst toe.' +
    (datums.length ? ' Let op: bij ' + datums.join(', ') + ' werd de titel ooit een datum. Verbeter die titels met de hand in de Catalogus (typ een \' voor de titel, bv. \'24/7).' : ''));
}

/** Menu: stap 2, de nakijklijst toepassen op de Catalogus. */
function pasTitelNakijklijstToe() {
  if (!spreadsheet().getSheetByName(TITELS_TABBLAD)) { meld('Maak eerst de nakijklijst: Madrigal > Titels en auteurs > Schrijfwijze: maak een nakijklijst.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var lijst = leesTabel(TITELS_TABBLAD);
    uit = titelsToepassen(catalogus.rijen, lijst.rijen);
    // Eén kolom in één keer schrijven: rij per rij bewaren duurt bij honderden titels langer dan 6 minuten.
    schrijfKolommen(catalogus, ['titel', 'taal']);
    schrijfKolommen(lijst, ['toepassen']);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  var tekst = uit.gedaan + ' boeken aangepast in de Catalogus (titel, taal of allebei).' + (uit.overgeslagen ? ' ' + uit.overgeslagen + ' overgeslagen: de titel in de Catalogus was intussen veranderd.' : '');
  logboek('menu', 'pasTitelNakijklijstToe', tekst);
  meld(tekst);
}
