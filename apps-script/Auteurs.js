/**
 * Auteurs.js
 * Elke auteur in de Catalogus in de vorm "Achternaam, Voornaam".
 *
 *   - Het script leert de voornamen en achternamen uit de Catalogus zelf: uit alle namen die al in de vorm
 *     "Achternaam, Voornaam" staan. Zo weet het welk woord de voornaam is.
 *   - "Kate Tempest" (Kate is een gekende voornaam) wordt "Tempest, Kate".
 *   - "Blackett Nancy" (de achternaam staat al vooraan, enkel de komma ontbreekt) wordt "Blackett, Nancy".
 *   - Tussenvoegsels komen achter de voornaam: "Gea van Beuningen" wordt "Beuningen, Gea van".
 *   - "J.R. Ackerley" en "Ackerley J.R." worden "Ackerley, J.R.".
 *   - Meerdere auteurs krijgen " & " ertussen. Dezelfde naam twee keer wordt één keer.
 *   - Niet zeker (geen gekende voornaam, bv. een organisatie zoals "COC Amsterdam" of "Roze Front")? Dan blijft
 *     de naam zoals hij is en staat hij in het tabblad Auteurs aangepast met "niet zeker". Zet daar zelf de komma,
 *     of laat een organisatie zo staan.
 *   - Een naam met een komma of uit één woord blijft altijd. Films niet: daar staat de regie.
 *   - Loopt vanzelf elke dag, en bij nieuwe boeken.
 */

var AUTEURS_TABBLAD = 'Auteurs aangepast';
var AUTEUR_NIET_ZEKER = 'niet zeker: zet zelf de komma (of laat een organisatie zo staan)';
// Woorden die zeker op een organisatie wijzen: die naam draaien we nooit om.
var AUTEUR_ORGANISATIE = /\b(stichting|vzw|vereniging|collectief|collective|redactie|redaction|uitgeverij|publishing|publishers|press|association|society|group|groep|team|staff|magazine|tijdschrift|foundation|fonds|institute|instituut|museum|centrum|centra|center|centre|network|netwerk|coalition|project|projet|house|editors|redacteurs|various|diverse|diversen|anoniem|anonymous|onbekend|unknown|verzameld|anthology|antologie|international|internationaal|front|verbond|rebellion|comics|jeugd|coc|vlaanderen|nederland|belgie|amsterdam|antwerpen|brussel|gent)\b/i;
// Geen naam maar een aanvulling: blijft zoals ze is.
var AUTEUR_AANVULLING = /^(e\.?a\.?|etc\.?|et al\.?|en anderen|and others|\.\.\.|…)$/i;
var AUTEUR_ACHTERVOEGSEL = /^(jr\.?|sr\.?|ii|iii|iv)$/i;
// Initialen: "J.R.", "J.", "JR".
var AUTEUR_INITIALEN = /^([A-Z]\.){1,4}$|^[A-Z]{1,3}$/;

/**
 * Wat de Catalogus weet: de voornamen (elk woord en de volledige voornaam) en de achternamen uit alle namen
 * met een komma. Geeft { voornaam: { woord: true }, achternaam: { woord: true } }.
 */
function auteurKennis(catalogus) {
  var k = { voornaam: {}, achternaam: {} };
  (catalogus || []).forEach(function (b) {
    if (isFilm(b)) return;
    String(b.auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
      if (i % 2) return;
      var m = schoon(deel).match(/^([^,]+),\s*([^,]+)/);
      if (!m) return;
      var voor = schoon(m[2]).split(' ').filter(function (w) {
        return w && !AUTEUR_INITIALEN.test(w) && CONTROLE_TUSSENVOEGSELS.indexOf(w.toLowerCase()) === -1;
      });
      voor.forEach(function (w) { k.voornaam[normaliseerTekst(w)] = true; });
      if (voor.length) k.voornaam[normaliseerTekst(voor.join(' '))] = true;
      normaliseerTekst(m[1]).split(' ').forEach(function (w) { if (w) k.achternaam[w] = true; });
    });
  });
  return k;
}

function isVoornaam(w, kennis) { return !!(kennis && kennis.voornaam[normaliseerTekst(w)]); }

/** "Voornaam (tussenvoegsels) Achternaam" wordt "Achternaam, Voornaam tussenvoegsels". */
function voornaamVooraanOmdraaien(woorden) {
  woorden = woorden.slice();
  var achter = '';
  if (woorden.length > 2 && AUTEUR_ACHTERVOEGSEL.test(woorden[woorden.length - 1])) achter = ', ' + woorden.pop();
  var achternaam = woorden.pop();
  var tussen = [];
  while (woorden.length > 1 && CONTROLE_TUSSENVOEGSELS.indexOf(woorden[woorden.length - 1].toLowerCase()) > -1) tussen.unshift(woorden.pop());
  return achternaam + ', ' + woorden.concat(tussen).join(' ') + achter;
}

/**
 * Eén naam in de vorm "Achternaam, Voornaam". Geeft { naam, zeker }. zeker = false: de naam bleef zoals hij was,
 * omdat het script niet weet welk woord de voornaam is.
 */
function eenAuteurNetjes(deel, kennis) {
  var naam = schoon(deel).replace(/\s+,/g, ',');
  if (!naam || naam.indexOf(',') > -1 || AUTEUR_AANVULLING.test(naam) || AUTEUR_ORGANISATIE.test(naam)) return { naam: naam, zeker: true };
  var woorden = naam.split(' ');
  if (woorden.length < 2) return { naam: naam, zeker: true };
  var eerste = woorden[0], laatste = woorden[woorden.length - 1];
  // "Ackerley J.R.": de achternaam staat vooraan, met de initialen erachter.
  if (AUTEUR_INITIALEN.test(laatste) && !AUTEUR_INITIALEN.test(eerste)) return { naam: eerste + ', ' + woorden.slice(1).join(' '), zeker: true };
  // "J.R. Ackerley": initialen vooraan.
  if (AUTEUR_INITIALEN.test(eerste)) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
  var rest = woorden.slice(1).join(' ');
  var voorVooraan = isVoornaam(eerste, kennis);
  var voorAchteraan = isVoornaam(rest, kennis) || isVoornaam(laatste, kennis);
  // "Kate Tempest": de voornaam staat vooraan.
  if (voorVooraan && !voorAchteraan) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
  // "Blackett Nancy", "Bringsvaerd Tor Age": de achternaam staat al vooraan, enkel de komma ontbreekt.
  if (voorAchteraan && !voorVooraan) return { naam: eerste + ', ' + rest, zeker: true };
  // Allebei een voornaam ("Thomas Mann"?): is het eerste woord een gekende achternaam en het laatste niet, dan achternaam vooraan.
  if (voorVooraan && voorAchteraan) {
    var achterEerste = !!(kennis && kennis.achternaam[normaliseerTekst(eerste)]);
    var achterLaatste = !!(kennis && kennis.achternaam[normaliseerTekst(laatste)]);
    if (achterLaatste && !achterEerste) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
    if (achterEerste && !achterLaatste) return { naam: eerste + ', ' + rest, zeker: true };
  }
  return { naam: naam, zeker: false };
}

/**
 * Is een veld met komma's eigenlijk een lijst van namen zonder komma ("Mira Verbeek, Kim Ander")?
 * Enkel als elk stuk minstens twee woorden heeft, en het eerste woord van elk stuk een gekende voornaam is.
 */
function isKommaLijst(veld, kennis) {
  var stukken = String(veld || '').split(',').map(schoon).filter(Boolean);
  if (stukken.length < 2) return false;
  return stukken.every(function (s) {
    var w = s.split(' ');
    return w.length >= 2 && isVoornaam(w[0], kennis) && !AUTEUR_ACHTERVOEGSEL.test(s);
  });
}

/** Het hele veld. Geeft { tekst, nietZeker: [namen] }. */
function auteurNetjesInfo(auteur, kennis) {
  var veld = schoon(auteur).replace(/&(?=\S)/g, '& ');
  var uit = { tekst: veld, nietZeker: [] };
  if (!veld) return uit;
  if (!/;|&|\s(en|and|et|und)\s/i.test(veld) && isKommaLijst(veld, kennis)) veld = veld.split(',').map(schoon).filter(Boolean).join(' & ');
  var namen = [], gezien = [];
  veld.split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
    if (i % 2 || !schoon(deel)) return;
    var r = eenAuteurNetjes(deel, kennis);
    if (!r.zeker) uit.nietZeker.push(r.naam);
    var k = controleAuteurSleutel(r.naam);
    if (gezien.indexOf(k) > -1) return;
    gezien.push(k);
    namen.push(r.naam);
  });
  uit.tekst = namen.join(' & ');
  return uit;
}

/** Het hele veld netjes. kennis: zie auteurKennis (zonder kennis draait het script enkel om wat zeker is). */
function auteurNetjes(auteur, kennis) {
  return auteurNetjesInfo(auteur, kennis).tekst;
}

/**
 * Zet alle auteurs in de Catalogus netjes. herstel: { boek_id: { vroeger, nu } } uit het tabblad Auteurs aangepast
 * van een vorige keer: staat de auteur nog zoals het script ze toen zette, dan vertrekt het opnieuw van vroeger.
 * Geeft [{ boek_id, titel, auteur_vroeger, auteur_nu, opmerking }].
 */
function auteursOpkuisen(catalogus, herstel) {
  // De kennis uit de oorspronkelijke namen: een naam die een vorige keer verkeerd omgedraaid werd ("Amsterdam, COC"),
  // mag het script niet leren als voornaam.
  var kennis = auteurKennis(catalogus.map(function (b) {
    var h = herstel && herstel[String(b.boek_id)];
    return h && h.vroeger && schoon(h.nu) === schoon(b.auteur) ? { soort: b.soort, auteur: h.vroeger } : b;
  }));
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.auteur) || isFilm(b)) return;
    var h = herstel && herstel[String(b.boek_id)];
    var vroeger = h && h.vroeger && schoon(h.nu) === schoon(b.auteur) ? schoon(h.vroeger) : schoon(b.auteur);
    var r = auteurNetjesInfo(vroeger, kennis);
    var opmerking = r.nietZeker.length ? AUTEUR_NIET_ZEKER + ': ' + r.nietZeker.join(', ') : '';
    if (r.tekst === schoon(b.auteur) && !opmerking) return;
    uit.push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur_vroeger: vroeger, auteur_nu: r.tekst, opmerking: opmerking });
    if (r.tekst !== schoon(b.auteur)) wijzig(b, { auteur: r.tekst });
  });
  return uit;
}

/** Doet het werk in de spreadsheet. Geeft de rijen van het tabblad. */
function auteursOpkuisenUitvoeren() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit, veranderd = 0;
  try {
    var catalogus = leesTabel('Catalogus');
    // Wat een vorige keer veranderde (ook de fouten van de eerste versie): opnieuw bekijken vanaf de oorspronkelijke naam.
    var herstel = {};
    var blad = spreadsheet().getSheetByName(AUTEURS_TABBLAD);
    if (blad && blad.getLastRow() > 1) {
      leesTabel(AUTEURS_TABBLAD).rijen.forEach(function (r) {
        if (!isLeeg(r.boek_id) && !isLeeg(r.auteur_vroeger)) herstel[String(r.boek_id)] = { vroeger: r.auteur_vroeger, nu: r.auteur_nu };
      });
    }
    var voor = {};
    catalogus.rijen.forEach(function (b) { voor[String(b.boek_id)] = schoon(b.auteur); });
    uit = auteursOpkuisen(catalogus.rijen, herstel);
    veranderd = uit.filter(function (r) { return r.auteur_nu !== voor[r.boek_id]; }).length;
    if (veranderd) schrijfKolommen(catalogus, ['auteur']);
  } finally {
    lock.releaseLock();
  }
  zorgVoorTabbladen([AUTEURS_TABBLAD]);
  var tab = spreadsheet().getSheetByName(AUTEURS_TABBLAD);
  var kop = KOLOMMEN[AUTEURS_TABBLAD];
  tab.clear();
  var waarden = [kop].concat(uit.map(function (r) { return kop.map(function (k) { return r[k]; }); }));
  tab.getRange(1, 1, waarden.length, kop.length).setValues(waarden);
  opmaakKop(tab, kop.length);
  if (veranderd) leegCache();
  uit.veranderd = veranderd;
  return uit;
}

function auteursTekst(uit) {
  var nz = uit.filter(function (r) { return r.opmerking; }).length;
  return uit.veranderd + ' auteurs in de vorm "Achternaam, Voornaam" gezet. ' +
    (nz ? nz + ' namen zijn niet zeker en bleven staan: die staan in het tabblad ' + AUTEURS_TABBLAD + ' met "niet zeker". ' : '') +
    'Het tabblad ' + AUTEURS_TABBLAD + ' toont wat veranderde.';
}

/** Menu: Titels en auteurs > Auteurs: zet alles in de vorm Achternaam, Voornaam. */
function auteursOpkuisenMenu() {
  var tekst = auteursTekst(auteursOpkuisenUitvoeren());
  // Enkel de aantallen: wat veranderde, staat in het tabblad.
  logboek('menu', 'auteursOpkuisen', tekst);
  meld(tekst);
}

/** Vanzelf, één keer per dag (vanuit verwerkNieuweBoekenAutomatisch). */
function auteursOpkuisenAutomatisch() {
  var eigenschappen = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  // Versie 2: de fouten van de eerste versie meteen herstellen, ook als die vandaag al liep.
  if (eigenschappen.getProperty('auteurs_laatst') === vandaag + ' v2') return;
  eigenschappen.setProperty('auteurs_laatst', vandaag + ' v2');
  var uit = auteursOpkuisenUitvoeren();
  if (uit.veranderd) logboek('systeem', 'auteursOpkuisen', auteursTekst(uit));
}
