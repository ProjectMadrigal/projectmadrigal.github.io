/**
 * Titelcontrole.js
 * Een lijst om in de bib na te kijken of de titel en de auteur van een boek juist geschreven zijn.
 *
 *   - Het script vergelijkt drie bronnen: de stocklijst (tabbladen Stock en Zines), de oude website
 *     (projectmadrigal.be) en de Catalogus (wat nu op de website staat).
 *   - Enkel echte verschillen tellen: andere letters of woorden. Hoofdletters, leestekens, de volgorde
 *     van voornaam en achternaam, dezelfde naam twee keer, en een ondertitel die er bij de ene bron wel en bij
 *     de andere niet staat, tellen niet.
 *   - Een auteur die enkel anders geschreven is, zet het script meteen in de juiste vorm in de Catalogus:
 *     "Achternaam, Voornaam" (de vorm uit de stocklijst of de oude website), elke naam één keer.
 *   - De lijst staat in het tabblad Titelcontrole. In het bestuurs- en vrijwilligersscherm (Titels en auteurs
 *     nakijken) neem je de boeken een voor een door, kast per kast: een versie kiezen, zelf typen, "klopt" of
 *     "niet in de kast".
 *   - Opnieuw maken mag: wat al nagekeken is (status ingevuld), blijft staan en komt niet opnieuw op de lijst.
 *   - De bron_sleutel van het boek verandert niet. Zo vindt Catalogus opbouwen het boek in Stock nog terug.
 */

var TITELCONTROLE_TABBLAD = 'Titelcontrole';
var TITELCONTROLE_STATUSSEN = ['klopt', 'aangepast', 'niet in de kast'];

/** Sleutel om titels te vergelijken: enkel letters en cijfers, in kleine letters. */
function controleTitelSleutel(titel) {
  return normaliseerTekst(titel);
}

/** Sleutel om auteurs te vergelijken: de woorden in alfabetische volgorde ("Melchior, Willem" = "Willem Melchior"). */
function controleAuteurSleutel(auteur) {
  // Elk woord één keer: "J.R. Ackerley; J. R. Ackerley" is dezelfde naam als "Ackerley, J.R".
  var uniek = [];
  normaliseerTekst(String(auteur || '').replace(/\b(en|and|et|und)\b|&/gi, ' ')).split(' ').forEach(function (w) {
    if (w && uniek.indexOf(w) === -1) uniek.push(w);
  });
  return uniek.sort().join(' ');
}

/** Dezelfde naam twee keer in één veld ("J.R. Ackerley; J. R. Ackerley") wordt één keer. */
function controleAuteurZonderDubbels(auteur) {
  var gezien = [];
  return String(auteur || '').split(/\s*;\s*/).filter(function (deel) {
    var k = controleAuteurSleutel(deel);
    if (!k || gezien.indexOf(k) > -1) return false;
    gezien.push(k);
    return true;
  }).map(schoon).join('; ');
}

/** Staat elke naam in de vorm "Achternaam, Voornaam"? (Een naam uit één woord telt als goed.) */
function controleAuteurGoedeVorm(auteur) {
  var delen = String(auteur || '').split(/\s*;\s*/).filter(function (d) { return schoon(d); });
  return delen.length > 0 && delen.every(function (d) { return /,/.test(d) || schoon(d).split(' ').length === 1; });
}

/**
 * De auteur in de juiste vorm, als de bronnen dezelfde naam geven maar anders geschreven: "Achternaam, Voornaam",
 * elke naam één keer. We nemen de vorm van de stocklijst of de oude website als die al juist is. Anders enkel de
 * dubbels eruit (de achternaam raden we niet: van, de, ... maken dat onzeker). Geeft '' als er niets te verbeteren valt.
 */
function controleAuteurVerbeterd(nu, anderen) {
  var schoonNu = controleAuteurZonderDubbels(nu);
  if (!schoonNu) return '';
  var sleutel = controleAuteurSleutel(nu);
  var beste = controleAuteurGoedeVorm(schoonNu) ? schoonNu : '';
  if (!beste) {
    (anderen || []).some(function (a) {
      var v = controleAuteurZonderDubbels(a);
      if (v && controleAuteurSleutel(v) === sleutel && controleAuteurGoedeVorm(v)) { beste = v; return true; }
      return false;
    });
  }
  if (!beste) beste = schoonNu;
  return beste !== schoon(nu) ? beste : '';
}

/** Zijn twee titels gelijk? Ook als de ene een ondertitel heeft (na ":" of " - ") en de andere niet. */
function controleTitelGelijk(a, b) {
  var x = controleTitelSleutel(a), y = controleTitelSleutel(b);
  if (!x || !y || x === y) return true;
  var kortA = controleTitelSleutel(String(a).split(/:| [-–—] /)[0]);
  var kortB = controleTitelSleutel(String(b).split(/:| [-–—] /)[0]);
  return kortA === y || kortB === x;
}

/** Zijn twee auteurs gelijk? Een lege auteur telt niet als verschil. */
function controleAuteurGelijk(a, b) {
  var x = controleAuteurSleutel(a), y = controleAuteurSleutel(b);
  return !x || !y || x === y;
}

/**
 * Maakt de lijst. catalogus: rijen van de Catalogus. stock: boeken uit leesBronRijen (Stock en Zines).
 * oudeBoeken: boeken van de oude website (oudBoekUitRij). bestaand: rijen van het tabblad Titelcontrole.
 * verbeterd: een lijst. Is ze er, dan zet het script een auteur die enkel anders geschreven is meteen in de juiste
 * vorm (zie controleAuteurVerbeterd) en komt de boek_id in de lijst.
 * Geeft de nieuwe open rijen: { boek_id, titel_nu, auteur_nu, titel_stock, auteur_stock, titel_oud, auteur_oud, status: '' }.
 */
function titelcontroleRijen(catalogus, stock, oudeBoeken, bestaand, verbeterd) {
  var perSleutel = {};
  stock.forEach(function (b) { var s = bronSleutel(b); if (!perSleutel[s]) perSleutel[s] = b; });
  var oudPerId = {};
  if (oudeBoeken.length) oudeParen(catalogus, oudeBoeken).paren.forEach(function (p) { oudPerId[String(p[1].boek.boek_id)] = p[0]; });
  var klaar = {};
  (bestaand || []).forEach(function (r) { if (TITELCONTROLE_STATUSSEN.indexOf(schoon(r.status)) > -1) klaar[String(r.boek_id)] = true; });
  var uit = [];
  catalogus.forEach(function (b) {
    var id = String(b.boek_id || '');
    if (!id || isLeeg(b.titel) || isFilm(b) || klaar[id]) return;
    var st = perSleutel[b.bron_sleutel];
    var oud = oudPerId[id];
    // Dezelfde auteur, enkel anders geschreven: meteen in de juiste vorm in de Catalogus, niet op de lijst.
    var beter = controleAuteurVerbeterd(b.auteur, [st && st.auteur, oud && oud.auteur]);
    if (beter && verbeterd) { wijzig(b, { auteur: beter }); verbeterd.push(id); }
    var nu = { titel: schoon(b.titel), auteur: schoon(b.auteur) };
    var bronnen = [nu];
    if (st) bronnen.push({ titel: schoon(st.titel), auteur: schoon(st.auteur) });
    if (oud) bronnen.push({ titel: schoon(oud.titel) + (oud.ondertitel ? ': ' + schoon(oud.ondertitel) : ''), auteur: schoon(oud.auteur) });
    var anders = false;
    for (var i = 0; i < bronnen.length && !anders; i++) {
      for (var j = i + 1; j < bronnen.length && !anders; j++) {
        if (!controleTitelGelijk(bronnen[i].titel, bronnen[j].titel) || !controleAuteurGelijk(bronnen[i].auteur, bronnen[j].auteur)) anders = true;
      }
    }
    if (!anders) return;
    uit.push({
      boek_id: id, titel_nu: nu.titel, auteur_nu: nu.auteur,
      titel_stock: st ? schoon(st.titel) : '', auteur_stock: st ? schoon(st.auteur) : '',
      titel_oud: oud ? bronnen[bronnen.length - 1].titel : '', auteur_oud: oud ? schoon(oud.auteur) : '',
      status: ''
    });
  });
  return uit;
}

/** De open rijen voor het scherm, met de huidige titel en auteur uit de Catalogus. Plus de boeken die niet in de kast stonden. */
function titelcontroleLijst(catalogus, rijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var open = [], nietGevonden = [], gedaan = 0;
  rijen.forEach(function (r) {
    var b = perId[String(r.boek_id)];
    if (!b) return;
    var status = schoon(r.status);
    var item = {
      id: String(r.boek_id), isbn: schoon(b.isbn),
      nu: { t: schoon(b.titel), a: schoon(b.auteur) },
      stock: r.titel_stock || r.auteur_stock ? { t: schoon(r.titel_stock), a: schoon(r.auteur_stock) } : null,
      oud: r.titel_oud || r.auteur_oud ? { t: schoon(r.titel_oud), a: schoon(r.auteur_oud) } : null
    };
    if (!status) open.push(item);
    else if (status === 'niet in de kast') { item.wie = schoon(r.wie); item.datum = parseerDatum(r.datum) || schoon(r.datum); nietGevonden.push(item); }
    else gedaan++;
  });
  return { open: open, nietGevonden: nietGevonden, gedaan: gedaan };
}

/** Hoeveel boeken nog na te kijken zijn: voor het getal op de knop in het scherm. */
function titelcontroleAantal(rijen) {
  return (rijen || []).filter(function (r) { return !isLeeg(r.boek_id) && !schoon(r.status); }).length;
}

/**
 * Bewaart wat iemand bij een boek koos. invoer: { boek_id, status: klopt | aangepast | niet in de kast | open, titel, auteur }.
 * Bij aangepast: titel en auteur in de Catalogus (de bron_sleutel blijft). Geeft { ok, tekst, catalogusGewijzigd } of { ok: false, fout }.
 */
function titelcontroleToepassen(catalogus, rijen, invoer, wie, vandaag) {
  var id = String(invoer.boek_id || '');
  var rij = rijen.filter(function (r) { return String(r.boek_id) === id; })[0];
  var boek = catalogus.filter(function (b) { return String(b.boek_id) === id; })[0];
  if (!rij || !boek) return { ok: false, fout: 'Dit boek staat niet (meer) op de lijst. Laad de lijst opnieuw.' };
  var status = schoon(invoer.status);
  if (status === 'open') { wijzig(rij, { status: '', wie: '', datum: '' }); return { ok: true, tekst: '"' + schoon(boek.titel) + '" staat terug op de lijst.' }; }
  if (TITELCONTROLE_STATUSSEN.indexOf(status) === -1) return { ok: false, fout: 'Onbekende keuze.' };
  var veranderd = false;
  if (status === 'aangepast') {
    var titel = tekstInvoer(invoer.titel, 300);
    var auteur = tekstInvoer(invoer.auteur, 300);
    if (!titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
    var velden = {};
    if (titel !== schoon(boek.titel)) velden.titel = titel;
    if (auteur !== schoon(boek.auteur)) velden.auteur = auteur;
    if (Object.keys(velden).length) { wijzig(boek, velden); veranderd = true; } else status = 'klopt';
  }
  wijzig(rij, { status: status, wie: wie, datum: vandaag, titel_nu: schoon(boek.titel), auteur_nu: schoon(boek.auteur) });
  var tekst = status === 'niet in de kast' ? '"' + schoon(boek.titel) + '" staat op de lijst voor het bestuur: niet gevonden in de kast.'
    : veranderd ? '"' + schoon(boek.titel) + '" is aangepast.' : '"' + schoon(boek.titel) + '" klopt.';
  return { ok: true, tekst: tekst, catalogusGewijzigd: veranderd };
}

/* ---------- In Apps Script ---------- */

/** Het tabblad Titelcontrole, met de juiste kop (maakt het aan als het nog niet bestaat). */
function titelcontroleTabel() {
  var ss = spreadsheet();
  if (!ss.getSheetByName(TITELCONTROLE_TABBLAD)) {
    var blad = ss.insertSheet(TITELCONTROLE_TABBLAD);
    var kop = KOLOMMEN[TITELCONTROLE_TABBLAD];
    blad.getRange(1, 1, 1, kop.length).setValues([kop]);
    opmaakKop(blad, kop.length);
    blad.setFrozenRows(1);
  }
  return leesTabel(TITELCONTROLE_TABBLAD);
}

/**
 * Maakt de lijst (opnieuw). De open rijen gaan weg en komen opnieuw, wat nagekeken is blijft.
 * Geeft { ok, tekst }. Gebruikt door het menu en de knop in het bestuursscherm.
 */
function maakTitelcontroleLijst() {
  // Eerst de oude website lezen, zonder slot: dat duurt even.
  var oudeBoeken = [];
  try {
    var db = vindOudeDatabank();
    var oud = haalOudeBoeken(db);
    oudeBoeken = oud.rijen.map(function (r) { return oudBoekUitRij(r, db.url); }).filter(function (b) { return b.titel; });
  } catch (e) { oudeBoeken = []; }
  var ss = spreadsheet();
  var stock = [];
  [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
    var blad = ss.getSheetByName(paar[0]);
    if (blad) stock = stock.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var nieuw, verbeterd;
  try {
    var catalogus = leesTabel('Catalogus');
    var tabel = titelcontroleTabel();
    verbeterd = [];
    nieuw = titelcontroleRijen(catalogus.rijen, stock, oudeBoeken, tabel.rijen, verbeterd);
    if (verbeterd.length) schrijfKolommen(catalogus, ['auteur']);
    // Wat nagekeken is, blijft. De open rijen maken plaats voor de nieuwe. Alles in één keer schrijven.
    var blijft = tabel.rijen.filter(function (r) { return schoon(r.status); });
    var waarden = blijft.concat(nieuw).map(function (r) { return rijNaarWaarden(tabel.kop, r); });
    var blad = tabel.blad;
    if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, tabel.kop.length).clearContent();
    if (waarden.length) blad.getRange(2, 1, waarden.length, tabel.kop.length).setValues(waarden);
  } finally {
    lock.releaseLock();
  }
  if (verbeterd.length) leegCache();
  var tekst = nieuw.length + ' boeken om na te kijken: de titel of auteur verschilt tussen de stocklijst, de oude website en de Catalogus. ' +
    verbeterd.length + ' auteurs meteen verbeterd naar "Achternaam, Voornaam", zonder dubbele naam.' +
    (oudeBoeken.length ? '' : ' Let op: de oude website kon ik niet lezen, enkel de stocklijst telde.') +
    (stock.length ? '' : ' Let op: de tabbladen Stock en Zines ontbreken.');
  logboek('menu', 'maakTitelcontroleLijst', tekst + (verbeterd.length ? ' Verbeterde auteurs: ' + verbeterd.join(', ') : ''));
  return { ok: true, tekst: tekst };
}

/** Menu: de lijst maken. */
function maakTitelcontroleMenu() {
  meld(maakTitelcontroleLijst().tekst + ' Je vindt ze in het bestuurs- en vrijwilligersscherm bij Titels en auteurs nakijken.');
}

/** Acties van het scherm. titelcontroleData en titelcontroleBewaren: vrijwilligers en bestuur. titelcontroleMaken: bestuur. */
function titelcontroleActie(actie, invoer, wie) {
  var catalogus = leesTabel('Catalogus');
  var tabel = spreadsheet().getSheetByName(TITELCONTROLE_TABBLAD) ? leesTabel(TITELCONTROLE_TABBLAD) : null;
  if (!tabel) return { ok: true, lijst: { open: [], nietGevonden: [], gedaan: 0, leeg: true } };
  if (actie === 'titelcontroleBewaren') {
    var r = titelcontroleToepassen(catalogus.rijen, tabel.rijen, invoer, wie, vandaagTekst());
    if (!r.ok) return r;
    if (r.catalogusGewijzigd) {
      schrijfKolommen(catalogus, ['titel', 'auteur']);
      logboek(wie, 'titelcontrole', String(invoer.boek_id) + ': titel of auteur aangepast');
      leegCache();
    }
    schrijfKolommen(tabel, ['status', 'wie', 'datum', 'titel_nu', 'auteur_nu']);
    return { ok: true, tekst: r.tekst };
  }
  return { ok: true, lijst: titelcontroleLijst(catalogus.rijen, tabel.rijen) };
}
