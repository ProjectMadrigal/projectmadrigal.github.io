/**
 * Auteursnamen.js
 * Gekozen namen en pseudoniemen van auteurs (tabblad Auteursnamen).
 *
 *   - Gekozen naam: een auteur die een andere naam koos. Elke vroegere naam (bv. op een oude druk) vervangt het
 *     script in de Catalogus door de gekozen naam. Wie de vroegere naam opzoekt, vindt het boek wel, maar de website
 *     toont die naam nergens.
 *   - Pseudoniem: een auteur die (ook) onder een andere naam schrijft. De naam op het boek blijft staan. Wie de
 *     andere naam opzoekt, vindt het boek ook. Dat werkt in beide richtingen.
 *   - Per rij: auteur (de naam die de website toont, of het pseudoniem), andere_namen (meer namen met ; ertussen,
 *     want een naam bevat zelf een komma), soort (gekozen naam of pseudoniem). De kolom boeken vult het script in.
 *   - De volgorde van voornaam en achternaam en hoofdletters tellen niet: "Pat Voorbeeld" = "Voorbeeld, Pat".
 *   - De namen om op te zoeken staan in de kolom auteur_zoeknamen van de Catalogus. Het script vult die zelf.
 *   - Werkt elk uur vanzelf, en via Madrigal > Titels en auteurs.
 */

var AUTEURSNAMEN_TABBLAD = 'Auteursnamen';
var AUTEURSNAMEN_PSEUDONIEM = 'pseudoniem';
var AUTEURSNAMEN_GEKOZEN = 'gekozen naam';

// De voorbeelden van het bestuur: één keer in het tabblad gezet. Daarna beheer je ze in het tabblad zelf.
// Het zijn publiek bekende namen van auteurs, geen gegevens van leners of schenkers.
var AUTEURSNAMEN_STANDAARD = [
  { auteur: 'Califia, Patrick', andere_namen: 'Califia, Pat', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Tempest, Kae', andere_namen: 'Tempest, Kate', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Februari, Maxim', andere_namen: 'Februari, Marjolijn', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Fraus, Pia', andere_namen: 'Schoeters, Gaea', soort: AUTEURSNAMEN_PSEUDONIEM }
];
var AUTEURSNAMEN_STANDAARD_VERSIE = 'v1';

/** De rijen van het tabblad als regels: [{ toon, pseudoniem, namen: [{ naam, sleutel }] }]. namen[0] is de getoonde naam. */
function auteursnamenRegels(rijen) {
  var uit = [];
  (rijen || []).forEach(function (r) {
    var toon = schoon(r.auteur);
    if (!toon) return;
    var namen = [{ naam: toon, sleutel: controleAuteurSleutel(toon) }];
    String(r.andere_namen || '').split(/\s*[;\n]\s*/).forEach(function (n) {
      n = schoon(n);
      var s = controleAuteurSleutel(n);
      if (n && s && !namen.some(function (x) { return x.sleutel === s; })) namen.push({ naam: n, sleutel: s });
    });
    if (namen.length < 2) return;
    uit.push({ toon: toon, pseudoniem: /pseudo/i.test(String(r.soort || '')), namen: namen });
  });
  return uit;
}

/**
 * Past de regels toe op één auteursveld (meer auteurs met ; of & ertussen).
 * Geeft { tekst, zoek: [namen om op te zoeken], regels: [indexen van de regels die pasten] }.
 */
function auteursnamenVervang(auteur, regels) {
  var delen = String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING);
  var zoek = [], gepast = [];
  var voegToe = function (naam) { if (zoek.indexOf(naam) === -1) zoek.push(naam); };
  for (var i = 0; i < delen.length; i += 2) {
    var sleutel = controleAuteurSleutel(delen[i]);
    if (!sleutel) continue;
    for (var r = 0; r < regels.length; r++) {
      var regel = regels[r];
      var j = -1;
      regel.namen.forEach(function (n, k) { if (j === -1 && n.sleutel === sleutel) j = k; });
      if (j === -1) continue;
      if (gepast.indexOf(r) === -1) gepast.push(r);
      if (regel.pseudoniem) {
        // De naam op het boek blijft. De andere namen van dezelfde auteur zijn zoekbaar.
        regel.namen.forEach(function (n, k) { if (k !== j) voegToe(n.naam); });
      } else {
        // Een vroegere naam: de gekozen naam in de plaats. De vroegere namen blijven zoekbaar, nooit zichtbaar.
        var voor = delen[i].match(/^\s*/)[0], na = delen[i].match(/\s*$/)[0];
        delen[i] = voor + regel.toon + na;
        regel.namen.forEach(function (n, k) { if (k > 0) voegToe(n.naam); });
      }
      break;
    }
  }
  return { tekst: delen.join(''), zoek: zoek, regels: gepast };
}

/**
 * Past het tabblad toe op de Catalogus (wijzig). Ook films.
 * Geeft { vervangen: boeken met een andere auteur, zoeknamen: boeken met andere zoeknamen, perRegel: [aantal boeken] }.
 */
function auteursnamenToepassen(catalogus, rijen) {
  var regels = auteursnamenRegels(rijen);
  var uit = { vervangen: 0, zoeknamen: 0, perRegel: regels.map(function () { return 0; }) };
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var r = auteursnamenVervang(b.auteur, regels);
    r.regels.forEach(function (i) { uit.perRegel[i]++; });
    var velden = {};
    if (!isLeeg(b.auteur) && r.tekst !== String(b.auteur)) { velden.auteur = r.tekst; uit.vervangen++; }
    var zoek = r.zoek.join('; ');
    if (zoek !== schoon(b.auteur_zoeknamen)) { velden.auteur_zoeknamen = zoek; uit.zoeknamen++; }
    if (Object.keys(velden).length) wijzig(b, velden);
  });
  return uit;
}

/** De rijen uit AUTEURSNAMEN_STANDAARD die nog niet in het tabblad staan (zelfde getoonde naam). */
function auteursnamenOntbrekend(rijen) {
  var er = {};
  (rijen || []).forEach(function (r) { er[controleAuteurSleutel(r.auteur)] = true; });
  return AUTEURSNAMEN_STANDAARD.filter(function (r) { return !er[controleAuteurSleutel(r.auteur)]; });
}

/** Doet het werk in de spreadsheet. Geeft het resultaat van auteursnamenToepassen. */
function auteursnamenUitvoeren() {
  zorgVoorTabbladen(['Catalogus', AUTEURSNAMEN_TABBLAD]);
  var eigenschappen = PropertiesService.getScriptProperties();
  var tab = leesTabel(AUTEURSNAMEN_TABBLAD);
  // Eén keer: de voorbeelden van het bestuur erin. Haal je er later een weg, dan komt die niet terug.
  if (eigenschappen.getProperty('auteursnamen_standaard') !== AUTEURSNAMEN_STANDAARD_VERSIE) {
    var erbij = auteursnamenOntbrekend(tab.rijen);
    if (erbij.length) {
      var start = tab.blad.getLastRow() + 1;
      tab.blad.getRange(start, 1, erbij.length, tab.kop.length).setValues(erbij.map(function (r) { return rijNaarWaarden(tab.kop, r); }));
      tab = leesTabel(AUTEURSNAMEN_TABBLAD);
    }
    eigenschappen.setProperty('auteursnamen_standaard', AUTEURSNAMEN_STANDAARD_VERSIE);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    uit = auteursnamenToepassen(catalogus.rijen, tab.rijen);
    if (uit.vervangen || uit.zoeknamen) schrijfKolommen(catalogus, ['auteur', 'auteur_zoeknamen']);
  } finally {
    lock.releaseLock();
  }
  // Per rij in het tabblad: bij hoeveel boeken de naam voorkomt.
  var kolBoeken = tab.kop.indexOf('boeken');
  if (kolBoeken > -1) {
    var i = 0;
    tab.rijen.forEach(function (r) {
      if (!auteursnamenRegels([r]).length) return;
      var n = uit.perRegel[i++];
      if (String(r.boeken) !== String(n)) tab.blad.getRange(r._rij, kolBoeken + 1).setValue(n);
    });
  }
  if (uit.vervangen || uit.zoeknamen) leegCache();
  return uit;
}

function auteursnamenTekst(uit) {
  return uit.vervangen + ' boeken kregen de gekozen naam van de auteur, bij ' + uit.zoeknamen +
    ' boeken veranderden de namen om op te zoeken. De kolom boeken in het tabblad ' + AUTEURSNAMEN_TABBLAD + ' toont per naam hoeveel boeken er zijn.';
}

/** Menu: Titels en auteurs > Auteursnamen: pas gekozen namen en pseudoniemen toe. */
function auteursnamenMenu() {
  var tekst = auteursnamenTekst(auteursnamenUitvoeren());
  logboek('menu', 'auteursnamen', tekst);
  meld(tekst);
}

/** Vanzelf, elk uur (vanuit verwerkNieuweBoekenAutomatisch). Schrijft enkel als er iets verandert. */
function auteursnamenAutomatisch() {
  var uit = auteursnamenUitvoeren();
  if (uit.vervangen || uit.zoeknamen) logboek('systeem', 'auteursnamen', auteursnamenTekst(uit));
}

/** De namen om op te zoeken van een boek (kolom auteur_zoeknamen), als lijst. */
function auteurZoeknamen(rij) {
  return String((rij && rij.auteur_zoeknamen) || '').split(/\s*;\s*/).map(schoon).filter(function (x) { return x; });
}
