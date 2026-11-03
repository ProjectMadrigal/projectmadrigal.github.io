/**
 * Auteurs.js
 * Elke auteur in de Catalogus in de vorm "Achternaam, Voornaam". Die regel wint altijd.
 *
 *   - "Gea van Beuningen" wordt "Beuningen, Gea van" (tussenvoegsels achter de voornaam, zoals in de stocklijst).
 *   - "J.R. Ackerley" en "Ackerley J.R." worden "Ackerley, J.R.".
 *   - Meerdere auteurs krijgen " & " ertussen: "Mira Verbeek; Kim Ander" en "Mira Verbeek, Kim Ander"
 *     worden "Verbeek, Mira & Ander, Kim". Dezelfde naam twee keer wordt één keer.
 *   - Een naam die al een komma heeft, of uit één woord bestaat, blijft. Zo blijft een naam die je zelf
 *     verbeterde (bv. "García Márquez, Gabriel") altijd staan.
 *   - Een organisatie (Stichting ..., ... Collective, Redactie, ...) en "e.a." of "etc." blijven zoals ze zijn.
 *   - Films niet: daar staat de regie, zoals de filmpagina die toont.
 *   - Loopt vanzelf elke dag, en bij nieuwe boeken. Het tabblad Auteurs aangepast toont wat veranderde.
 */

var AUTEURS_TABBLAD = 'Auteurs aangepast';
// Woorden die op een organisatie wijzen: die naam draaien we niet om.
var AUTEUR_ORGANISATIE = /\b(stichting|vzw|vereniging|collectief|collective|redactie|redaction|uitgeverij|publishing|publishers|press|association|society|group|groep|team|staff|magazine|tijdschrift|foundation|institute|instituut|museum|centrum|center|centre|network|netwerk|coalition|project|house|editors|redacteurs|various|diverse|diversen|anoniem|anonymous|onbekend|unknown|verzameld|anthology|antologie)\b/i;
// Geen naam maar een aanvulling: blijft zoals ze is.
var AUTEUR_AANVULLING = /^(e\.?a\.?|etc\.?|et al\.?|en anderen|and others|\.\.\.|…)$/i;
var AUTEUR_ACHTERVOEGSEL = /^(jr\.?|sr\.?|ii|iii|iv)$/i;
// Initialen: "J.R.", "J.", "JR".
var AUTEUR_INITIALEN = /^([A-Z]\.){1,4}$|^[A-Z]{1,3}$/;

/** Eén naam in de vorm "Achternaam, Voornaam". */
function eenAuteurNetjes(deel) {
  var naam = schoon(deel).replace(/\s+,/g, ',');
  if (!naam || naam.indexOf(',') > -1 || AUTEUR_AANVULLING.test(naam) || AUTEUR_ORGANISATIE.test(naam)) return naam;
  var woorden = naam.split(' ');
  if (woorden.length < 2) return naam;
  // "Ackerley J.R.": de achternaam staat al vooraan, met de initialen erachter.
  if (AUTEUR_INITIALEN.test(woorden[woorden.length - 1]) && !AUTEUR_INITIALEN.test(woorden[0])) {
    return woorden[0] + ', ' + woorden.slice(1).join(' ');
  }
  // "Martin Luther King Jr.": "King, Martin Luther, Jr."
  var achter = '';
  if (woorden.length > 2 && AUTEUR_ACHTERVOEGSEL.test(woorden[woorden.length - 1])) achter = ', ' + woorden.pop();
  var achternaam = woorden.pop();
  var tussen = [];
  while (woorden.length > 1 && CONTROLE_TUSSENVOEGSELS.indexOf(woorden[woorden.length - 1].toLowerCase()) > -1) tussen.unshift(woorden.pop());
  return achternaam + ', ' + woorden.concat(tussen).join(' ') + achter;
}

/**
 * Is een veld met komma's eigenlijk een lijst van namen zonder komma ("Mira Verbeek, Kim Ander")?
 * Enkel als elk stuk minstens twee woorden heeft en niet met een tussenvoegsel begint of een achtervoegsel is.
 * "Verbeek, Mira" en "Van Bendegem, Jean Paul" zijn gewone namen.
 */
function isKommaLijst(veld) {
  var stukken = String(veld || '').split(',').map(schoon).filter(Boolean);
  if (stukken.length < 2) return false;
  return stukken.every(function (s) {
    var w = s.split(' ');
    return w.length >= 2 && !AUTEUR_ACHTERVOEGSEL.test(s) && CONTROLE_TUSSENVOEGSELS.indexOf(w[0].toLowerCase()) === -1 &&
      !AUTEUR_INITIALEN.test(w[w.length - 1]);
  });
}

/** Het hele veld: elke naam "Achternaam, Voornaam", " & " ertussen, elke naam één keer. Geeft de nieuwe tekst. */
function auteurNetjes(auteur) {
  var veld = schoon(auteur);
  if (!veld) return veld;
  // Zonder ander scheidingsteken en met komma's tussen volledige namen: dat zijn verschillende auteurs.
  if (!/;|&|\s(en|and|et|und)\s/i.test(veld) && isKommaLijst(veld)) veld = veld.split(',').map(schoon).filter(Boolean).join(' & ');
  var namen = [], gezien = [];
  veld.split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
    if (i % 2 || !schoon(deel)) return;
    var n = eenAuteurNetjes(deel);
    var k = controleAuteurSleutel(n);
    if (gezien.indexOf(k) > -1) return;
    gezien.push(k);
    namen.push(n);
  });
  return namen.join(' & ');
}

/** Zet alle auteurs in de Catalogus netjes. Geeft [{ boek_id, titel, auteur_vroeger, auteur_nu }] van wat veranderde. */
function auteursOpkuisen(catalogus) {
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.auteur) || isFilm(b)) return;
    var nu = auteurNetjes(b.auteur);
    if (!nu || nu === schoon(b.auteur)) return;
    uit.push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur_vroeger: schoon(b.auteur), auteur_nu: nu });
    wijzig(b, { auteur: nu });
  });
  return uit;
}

/** Doet het werk in de spreadsheet. Geeft de rijen die veranderden. */
function auteursOpkuisenUitvoeren() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    uit = auteursOpkuisen(catalogus.rijen);
    if (uit.length) schrijfKolommen(catalogus, ['auteur']);
  } finally {
    lock.releaseLock();
  }
  if (uit.length) {
    var ss = spreadsheet();
    var blad = ss.getSheetByName(AUTEURS_TABBLAD) || ss.insertSheet(AUTEURS_TABBLAD);
    var kop = KOLOMMEN[AUTEURS_TABBLAD];
    blad.clear();
    var waarden = [kop].concat(uit.map(function (r) { return kop.map(function (k) { return r[k]; }); }));
    blad.getRange(1, 1, waarden.length, kop.length).setValues(waarden);
    opmaakKop(blad, kop.length);
    leegCache();
  }
  return uit;
}

/** Menu: Titels en auteurs > Auteurs: zet alles in de vorm Achternaam, Voornaam. */
function auteursOpkuisenMenu() {
  var uit = auteursOpkuisenUitvoeren();
  var tekst = uit.length ? uit.length + ' auteurs in de vorm "Achternaam, Voornaam" gezet. Het tabblad ' + AUTEURS_TABBLAD + ' toont wat veranderde.'
    : 'Alle auteurs staan al in de vorm "Achternaam, Voornaam".';
  logboek('menu', 'auteursOpkuisen', tekst + (uit.length ? ' ' + uit.slice(0, 50).map(function (r) { return r.boek_id + ': ' + r.auteur_vroeger + ' > ' + r.auteur_nu; }).join('; ') : ''));
  meld(tekst);
}

/** Vanzelf, één keer per dag (vanuit verwerkNieuweBoekenAutomatisch). */
function auteursOpkuisenAutomatisch() {
  var eigenschappen = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  if (eigenschappen.getProperty('auteurs_laatst') === vandaag) return;
  eigenschappen.setProperty('auteurs_laatst', vandaag);
  var uit = auteursOpkuisenUitvoeren();
  if (uit.length) logboek('systeem', 'auteursOpkuisen', uit.length + ' auteurs in de vorm "Achternaam, Voornaam" gezet: ' +
    uit.slice(0, 50).map(function (r) { return r.boek_id + ': ' + r.auteur_vroeger + ' > ' + r.auteur_nu; }).join('; '));
}
