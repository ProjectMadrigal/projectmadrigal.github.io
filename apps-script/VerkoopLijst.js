/**
 * VerkoopLijst.js
 * Een verkooplijst (bv. uit Excel) overnemen in de verkoop: welke boeken de bib te koop heeft, hoeveel en aan welke prijs.
 *
 *   1. Plak de lijst in het tabblad Verkooplijst, met de kopregel erbij (Titel, Auteur(s), ISBN, Uitgeverij,
 *      Jaartal, Taal, Pagina's, Uitvoering, Nieuwstaat, Genre, Aantal, Prijs). Dezelfde kolommen als de stocklijst,
 *      plus Prijs. Een titelregel erboven (bv. "Verkoop") mag.
 *   2. Kies Madrigal > Verkoop > Neem de verkooplijst over.
 *
 *   - Staat het boek al in de Catalogus (zelfde ISBN, of zelfde titel en achternaam), dan krijgt dat boek
 *     te_koop_aantal en prijs. Het uitlenen verandert niet: de exemplaren te koop staan los van de uitleenbare.
 *   - Staat het er nog niet, dan komt het erbij als boek dat enkel te koop is: niet uitleenbaar en (nog) niet
 *     op de website. Wil je het toch tonen, zet dan publiek op ja.
 *   - Aantal: het eerste getal ("3 + 1 inkijkexemplaar" wordt 3). Leeg: 1. Prijs leeg: blijft leeg (vul later in).
 *   - Elke verwerkte rij krijgt in de kolom verwerkt de datum en het boek-ID. Opnieuw overnemen slaat die over,
 *     zodat een verkoop van intussen niet teruggedraaid wordt. Een rij opnieuw? Maak die cel leeg.
 */

var VERKOOPLIJST_TABBLAD = 'Verkooplijst';
var VERKOOPLIJST_KOP = ['Titel', 'Auteur(s)', 'ISBN', 'Uitgeverij', 'Jaartal', 'Taal', 'Pagina\'s', 'Uitvoering', 'Nieuwstaat', 'Genre', 'Aantal', 'Prijs', 'verwerkt', 'opmerking'];

/** "nieuw" of "2e hands" naar ja of nee (kolom nieuwstaat in de Catalogus). */
function verkoopNieuwstaat(w) {
  var t = normaliseerTekst(w);
  if (!t) return '';
  if (/^nieuw|^new|^ja$/.test(t)) return 'ja';
  if (/2 ?e ?hands|tweedehands|second|^nee$|gebruikt/.test(t)) return 'nee';
  return '';
}

/** De sleutel om een boek zonder ISBN te herkennen: de titel (zonder ondertitel) en de achternaam. */
function verkoopSleutel(titel, auteur) {
  return titelKern(titel) + '|' + normaliseerTekst(achternaam(auteur));
}

/**
 * Leest het tabblad: de kopregel (met "Titel") en de rijen eronder. waarden: getValues().
 * Geeft [{ rij (1-gebaseerd), titel, auteur, isbn, ..., aantalTekst, prijs, verwerkt }].
 */
function leesVerkooplijst(waarden) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var k = function (namen) { for (var i = 0; i < namen.length; i++) { var j = kop.indexOf(namen[i]); if (j > -1) return j; } return -1; };
  var kol = {
    titel: k(['titel']), auteur: k(['auteur s', 'auteurs', 'auteur']), isbn: k(['isbn', 'isbn issn']), uitgeverij: k(['uitgeverij']),
    jaartal: k(['jaartal', 'jaar']), taal: k(['taal']), paginas: k(['pagina s', 'paginas']), uitvoering: k(['uitvoering']),
    nieuwstaat: k(['nieuwstaat']), genre: k(['genre']), aantal: k(['aantal']), prijs: k(['prijs']), verwerkt: k(['verwerkt']), opmerking: k(['opmerking'])
  };
  var uit = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (v) { return kol[v] === -1 ? '' : rij[kol[v]]; };
    var titel = schoon(lees('titel'));
    if (!titel || normaliseerTekst(titel) === 'titel') continue;
    uit.push({
      rij: i + 1, titel: titel, auteur: schoon(lees('auteur')), isbn: lees('isbn'), uitgeverij: schoon(lees('uitgeverij')),
      jaartal: parseerGetal(lees('jaartal')) || '', taal: lees('taal'), paginas: parseerGetal(lees('paginas')) || '',
      uitvoering: lees('uitvoering'), nieuwstaat: lees('nieuwstaat'), genre: schoon(lees('genre')),
      aantalTekst: schoon(lees('aantal')), prijs: verkoopGetal(lees('prijs')), verwerkt: schoon(lees('verwerkt'))
    });
  }
  uit.kolommen = kol;
  uit.kopRij = kopIndex + 1;
  return uit;
}

/**
 * Past de verkooplijst toe op de Catalogus (wijzig en voegToe). nieuwId: functie (soort) -> boek-ID.
 * Geeft [{ rij, boek_id, verwerkt, opmerking, nieuw }] voor de rijen die nog niet verwerkt waren.
 */
function verkooplijstToepassen(catalogus, lijst, nieuwId, vandaag) {
  var kennis = auteurKennis(catalogus);
  var opIsbn = {}, opSleutel = {};
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isFilm(b)) return;
    var i = normaliseerIsbn(b.isbn).isbn;
    if (i) opIsbn[i] = b;
    var s = verkoopSleutel(b.titel, b.auteur);
    if (!opSleutel[s]) opSleutel[s] = b;
  });
  var uit = [];
  lijst.forEach(function (r) {
    if (r.verwerkt) return;
    var opmerkingen = [];
    var n = parseerGetal(r.aantalTekst);
    if (!n || n < 0) { n = 1; opmerkingen.push('aantal ontbrak: 1'); }
    n = Math.round(n);
    if (/inkijk/i.test(r.aantalTekst)) opmerkingen.push('inkijkexemplaar niet meegeteld');
    if (r.prijs === null) opmerkingen.push('prijs nog in te vullen');
    var isbn = normaliseerIsbn(r.isbn).isbn;
    var boek = (isbn && opIsbn[isbn]) || opSleutel[verkoopSleutel(r.titel, r.auteur)];
    var nieuw = false;
    if (boek) {
      var velden = { te_koop_aantal: n };
      if (r.prijs !== null) velden.prijs = r.prijs;
      wijzig(boek, velden);
      opmerkingen.unshift('al in de catalogus');
    } else {
      nieuw = true;
      boek = {
        boek_id: nieuwId('boek'), soort: 'boek', titel: r.titel, auteur: auteurNetjes(r.auteur, kennis), isbn: isbn || schoon(r.isbn),
        uitgeverij: r.uitgeverij, jaartal: r.jaartal, taal: normaliseerTaal(r.taal), paginas: r.paginas,
        uitvoering: normaliseerUitvoering(r.uitvoering), nieuwstaat: verkoopNieuwstaat(r.nieuwstaat),
        genre: r.genre ? genreMooi(r.genre) : '', aantal: '', uitleenbaar: 'nee', publiek: 'nee',
        te_koop_aantal: n, prijs: r.prijs === null ? '' : r.prijs, herkomst: 'verkooplijst', toegevoegd_op: vandaag
      };
      boek.bron_sleutel = bronSleutel(boek);
      voegToe(catalogus, boek);
      if (isbn) opIsbn[isbn] = boek;
      opSleutel[verkoopSleutel(boek.titel, boek.auteur)] = boek;
      opmerkingen.unshift('nieuw, enkel te koop (niet op de website)');
    }
    uit.push({ rij: r.rij, boek_id: String(boek.boek_id), verwerkt: vandaag + ' ' + boek.boek_id, opmerking: opmerkingen.join('; '), nieuw: nieuw });
  });
  return uit;
}

/** Menu: Verkoop > Neem de verkooplijst over (tabblad Verkooplijst). */
function neemVerkooplijstOver() {
  var ss = spreadsheet();
  var blad = ss.getSheetByName(VERKOOPLIJST_TABBLAD);
  if (!blad || blad.getLastRow() < 2) {
    if (!blad) {
      blad = maakTabblad(VERKOOPLIJST_TABBLAD);
      blad.getRange(1, 1, 1, VERKOOPLIJST_KOP.length).setValues([VERKOOPLIJST_KOP]);
      opmaakKop(blad, VERKOOPLIJST_KOP.length);
    }
    meld('Plak de verkooplijst in het tabblad ' + VERKOOPLIJST_TABBLAD + ', met de kopregel erbij (Titel, Auteur(s), ISBN, ..., Aantal, Prijs). Kies daarna opnieuw dit menu.');
    return;
  }
  var lijst = leesVerkooplijst(blad.getDataRange().getValues());
  if (!lijst.length) { meld('Ik vind geen kopregel met "Titel" in het tabblad ' + VERKOOPLIJST_TABBLAD + '.'); return; }
  zorgVoorTabbladen(['Catalogus']);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    uit = verkooplijstToepassen(tabel.rijen, lijst, function (soort) { return ids.nieuw(soort); }, vandaagTekst());
    if (uit.length) bewaarTabel(tabel);
    // Het resultaat naast elke rij: verwerkt (datum en boek-ID) en een opmerking.
    var kol = lijst.kolommen;
    var kopRij = lijst.kopRij;
    var breedte = blad.getLastColumn();
    var kolVerwerkt = kol.verwerkt > -1 ? kol.verwerkt + 1 : breedte + 1;
    var kolOpmerking = kol.opmerking > -1 ? kol.opmerking + 1 : (kol.verwerkt > -1 ? breedte + 1 : breedte + 2);
    blad.getRange(kopRij, kolVerwerkt).setValue('verwerkt');
    blad.getRange(kopRij, kolOpmerking).setValue('opmerking');
    uit.forEach(function (r) {
      blad.getRange(r.rij, kolVerwerkt).setValue(r.verwerkt);
      blad.getRange(r.rij, kolOpmerking).setValue(r.opmerking);
    });
  } finally {
    lock.releaseLock();
  }
  var verkopen = ss.getSheetByName('Verkopen') ? leesTabel('Verkopen').rijen : [];
  schrijfVoorraad(leesTabel('Catalogus').rijen, verkopen);
  leegCache();
  var nieuw = uit.filter(function (r) { return r.nieuw; }).length;
  var zonderPrijs = uit.filter(function (r) { return /prijs nog/.test(r.opmerking); }).length;
  var tekst = uit.length + ' boeken uit de verkooplijst overgenomen: ' + (uit.length - nieuw) + ' stonden al in de catalogus, ' + nieuw +
    ' kwamen erbij als boek dat enkel te koop is (niet op de website). ' + (zonderPrijs ? zonderPrijs + ' hebben nog geen prijs: vul die in de kolom prijs van de Catalogus in. ' : '') +
    'De Voorraad is bijgewerkt. De kolommen verwerkt en opmerking in het tabblad ' + VERKOOPLIJST_TABBLAD + ' tonen wat er met elke rij gebeurde.';
  logboek('menu', 'neemVerkooplijstOver', uit.length + ' boeken overgenomen, ' + nieuw + ' nieuw, ' + zonderPrijs + ' zonder prijs.');
  meld(tekst);
}
