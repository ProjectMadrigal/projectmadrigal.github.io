/**
 * Kolommen.js
 * Brede tabbladen overzichtelijk maken (Catalogus, Uitleningen):
 *   - de eerste kolommen (welk boek, welke uitlening) blijven staan als je naar rechts schuift;
 *   - de kopregel krijgt een kleur per thema;
 *   - elke kop krijgt een uitleg (zichtbaar als je met de muis over de kop gaat);
 *   - niet-publieke kolommen staan in schuine, grijze letters, met "Niet publiek" in de uitleg;
 *   - de kolommen die enkel het script gebruikt, zitten in een groep die ingeklapt is (+ om ze te tonen).
 * Gebeurt bij Installeer tabbladen, en via het menu Madrigal > Spreadsheet en onderhoud > Maak de brede tabbladen overzichtelijk.
 */

var KOLOM_THEMAS = {
  boek: ['#fff2cc', 'Gegevens van het boek'],
  website: ['#e4d7f5', 'Website'],
  uitlenen: ['#d9eaf7', 'Uitlenen'],
  film: ['#d9ead3', 'Film'],
  verkoop: ['#fce5cd', 'Verkoop'],
  bestuur: ['#f4cccc', 'Bestuur'],
  techniek: ['#eeeeee', 'Techniek (het script)'],
  datum: ['#d9eaf7', 'Datums'],
  borg: ['#fce5cd', 'Borg en gift'],
  wie: ['#e4d7f5', 'Wie en hoe']
};

/**
 * Per tabblad: de vaste kolommen (tot en met deze kolom blijven ze staan) en per kolom [thema, uitleg, niet publiek].
 * Een kolom die hier niet staat, krijgt niets (een kolom die het bestuur zelf toevoegde, blijft zoals ze is).
 */
var KOLOM_INDELING = {
  'Catalogus': {
    vast: ['boek_id', 'titel', 'auteur'],
    kolommen: {
      boek_id: ['boek', 'Uniek nummer van het boek (B0001). Het script geeft het vanzelf. Niet wijzigen.'],
      soort: ['boek', 'boek, zine of film.'],
      titel: ['boek', 'Titel zoals op het boek. Een ondertitel na een dubbelpunt: "Titel: Ondertitel".'],
      auteur: ['boek', 'Achternaam, Voornaam. Meer auteurs met & ertussen.'],
      isbn: ['boek', 'ISBN van 13 cijfers, zonder streepjes.'],
      uitgeverij: ['boek', 'Uitgeverij.'],
      jaartal: ['boek', 'Jaar van uitgave.'],
      taal: ['boek', 'Taal van het boek: Nederlands, Engels, Frans, ...'],
      paginas: ['boek', 'Aantal pagina\'s.'],
      uitvoering: ['boek', 'Hardcover, Paperback of Pocket.'],
      nieuwstaat: ['boek', 'Staat van het boek, uit de stocklijst.'],
      originele_titel: ['boek', 'Titel in de oorspronkelijke taal, als die anders is (vertalingen, films).'],
      aanrader: ['website', 'Wie dit boek aanraadt (bv. Johanna). Staat op de website.'],
      genre: ['website', 'Genre uit de stocklijst. Via het tabblad Onderwerpen bepaalt dit in welk thema het boek staat.'],
      extra_onderwerpen: ['website', 'Extra thema\'s voor de filters op de website, met een komma ertussen.'],
      categorieen: ['website', 'Categorieën zoals op de oude website (bv. Roman, Essay), met een komma ertussen. Geel bij het boek, en een filter op de website. Keuzes en indeling: tabblad Categorieën en trefwoorden.'],
      trefwoorden: ['website', 'Thema\'s en trefwoorden zoals op de oude website (bv. Lesbisch, Coming-out), met een komma ertussen. Paars bij het boek, een filter en zoekbaar op de website. Keuzes en indeling: tabblad Categorieën en trefwoorden.'],
      triggerwaarschuwingen: ['website', 'Triggerwaarschuwingen (bv. geweld, zelfdoding), met een komma ertussen. Op de website enkel als de instelling triggerwaarschuwingen_tonen op ja staat.'],
      klassieker: ['website', 'ja = staat bij de klassiekers.'],
      publiek: ['website', 'ja = op de website. nee = verborgen.'],
      status: ['website', 'Leeg = gewoon.\nverloren: niet op de website, niet uitleenbaar.\ngevoelig verborgen: niet op de website, wel uitleenbaar.\ngevoelig zichtbaar: op de website met het label "Gevoelige inhoud".'],
      beschrijving: ['website', 'Beschrijving op de website, in het Nederlands.'],
      beschrijving_en: ['website', 'Beschrijving in het Engels. Leeg: het script vertaalt.'],
      beschrijving_bron: ['website', 'Waar de beschrijving vandaan komt. Leeg bij een eigen tekst.'],
      cover_url: ['website', 'Link naar de cover. Leeg: het script zoekt er een.'],
      startpagina: ['website', 'ja = in de kijker op de startpagina.'],
      leeslijsten: ['website', 'De leeslijsten waarin dit boek staat, met een komma ertussen.'],
      toegevoegd_op: ['website', 'Datum waarop het boek erbij kwam (Nieuw in de bib).'],
      aantal: ['uitlenen', 'Aantal exemplaren in de bib.'],
      uitleenbaar: ['uitlenen', 'ja of nee. nee = enkel lezen in de bib.'],
      land: ['film', 'Film: land.'],
      duur: ['film', 'Film: speelduur in minuten.'],
      film_tip: ['film', 'Film: ja = kijktip.'],
      letterboxd: ['film', 'Film: adres bij Letterboxd.'],
      imdb: ['film', 'Film: nummer bij IMDb (tt...).'],
      wikidata: ['film', 'Film: nummer bij Wikidata.'],
      te_koop: ['verkoop', 'ja = te koop.'],
      prijs: ['verkoop', 'Verkoopprijs in euro.'],
      onderhandelbaar: ['verkoop', 'ja = de prijs is bespreekbaar.'],
      te_koop_aantal: ['verkoop', 'Aantal exemplaren te koop.'],
      notitie: ['bestuur', 'Interne notitie van het bestuur (bv. schade, plaats in de kast).', true],
      herkomst: ['techniek', 'Waar het boek vandaan komt, uit de stocklijst.', true],
      isbn_origineel: ['techniek', 'Het ISBN zoals in de stocklijst, als het ongeldig was.', true],
      bron_sleutel: ['techniek', 'Koppeling met de stocklijst. Niet wijzigen.', true],
      ol_gecontroleerd: ['techniek', 'Datum: opgezocht bij Open Library. Leeg = opnieuw zoeken.', true],
      gb_gecontroleerd: ['techniek', 'Datum: opgezocht bij Google Books. Leeg = opnieuw zoeken.', true],
      beschrijving_gezocht: ['techniek', 'Datum: beschrijving gezocht. Leeg = opnieuw zoeken.', true],
      beschrijving_vertaald: ['techniek', 'Datum: beschrijving vertaald. Leeg = opnieuw vertalen.', true],
      cover_bron: ['techniek', 'Waar de cover vandaan komt (foto in de bib, link, oude website, ...).', true],
      cover_gezocht: ['techniek', 'Datum: cover gezocht. Leeg = opnieuw zoeken.', true],
      bol_gezocht: ['techniek', 'Datum: opgezocht bij bol.com. Leeg = opnieuw zoeken.', true],
      ia_gezocht: ['techniek', 'Datum: opgezocht bij Internet Archive. Leeg = opnieuw zoeken.', true],
      wiki_gezocht: ['techniek', 'Datum: opgezocht bij Wikipedia. Leeg = opnieuw zoeken.', true],
      oude_cover: ['techniek', 'Cover van de oude website die nog naar Drive gekopieerd moet worden. Leeg als het klaar is.', true],
      film_gezocht: ['techniek', 'Datum: film opgezocht bij Wikidata. Leeg = opnieuw zoeken.', true]
    }
  },
  'Uitleningen': {
    vast: ['uitlening_id', 'exemplaar', 'boek_id'],
    kolommen: {
      uitlening_id: ['boek', 'Nummer van de uitlening (U0001).'],
      exemplaar: ['boek', 'Welk exemplaar: boek_id met een volgnummer (B0001-1).'],
      boek_id: ['boek', 'Het boek (zie de Catalogus).'],
      lenersnummer: ['boek', 'De lener (zie het tabblad Leners).'],
      datum_uit: ['datum', 'Datum van uitlenen.'],
      oorspronkelijke_vervaldatum: ['datum', 'De eerste vervaldatum, voor elke verlenging.'],
      vervaldatum: ['datum', 'Tegen wanneer het boek terug moet.'],
      vorige_vervaldatum: ['datum', 'De vervaldatum voor de laatste verlenging. Zo kan je een verlenging annuleren.'],
      datum_terug: ['datum', 'Datum waarop het boek terugkwam. Leeg = nog uitgeleend.'],
      aantal_verlengingen: ['datum', 'Hoe vaak verlengd.'],
      datum_verlenging: ['datum', 'Datum van de laatste verlenging.'],
      laatste_herinnering: ['datum', 'Datum van de laatste herinnering.'],
      borg: ['borg', 'Borg in euro.'],
      betaalwijze_borg: ['borg', 'cash of QR-code.'],
      borg_terugbetaald: ['borg', 'ja = de borg is terugbetaald.'],
      gift: ['borg', 'Gift in euro.'],
      vrijwilliger: ['wie', 'Wie de uitlening deed.'],
      bron: ['wie', 'Hoe de uitlening binnenkwam (balie, aanvraag, ...).'],
      staat_terug: ['wie', 'Hoe het boek terugkwam (in orde, licht beschadigd, beschadigd), met een opmerking.']
    }
  }
};

/**
 * De indeling van een tabblad volgens de kopregel. kop: de koppen in hun echte volgorde.
 * Geeft { vast: aantal vaste kolommen, kleuren: [kleur of ''], uitleg: [tekst of ''], nietPubliek: [bool],
 * groepen: [[eerste kolom (1 = A), aantal]] } of null als het tabblad geen indeling heeft.
 */
function kolomIndeling(tabblad, kop) {
  var ind = KOLOM_INDELING[tabblad];
  if (!ind) return null;
  // Vast tot en met de laatste kolom uit "vast", als die vooraan staat (hoogstens de eerste 5 kolommen).
  var vast = 0;
  ind.vast.forEach(function (k) { var i = kop.indexOf(k); if (i > -1 && i < 5) vast = Math.max(vast, i + 1); });
  var uit = { vast: vast, kleuren: [], uitleg: [], nietPubliek: [], groepen: [] };
  var begin = -1;
  kop.forEach(function (k, i) {
    var v = ind.kolommen[k];
    uit.kleuren.push(v ? KOLOM_THEMAS[v[0]][0] : '');
    uit.nietPubliek.push(!!(v && v[2]));
    uit.uitleg.push(v ? KOLOM_THEMAS[v[0]][1] + (v[2] ? '. 🔒 Niet publiek: verschijnt nooit op de website' : '') + '.\n' + v[1] : '');
    // Groepen: aaneengesloten technische kolommen (niet de vaste kolommen).
    var tech = v && v[0] === 'techniek' && i >= vast;
    if (tech && begin === -1) begin = i;
    if ((!tech || i === kop.length - 1) && begin > -1) {
      var einde = tech ? i : i - 1;
      uit.groepen.push([begin + 1, einde - begin + 1]);
      begin = -1;
    }
  });
  return uit;
}

/** Past de indeling toe op een tabblad in de spreadsheet. */
function maakTabbladOverzichtelijk(blad) {
  if (!blad || blad.getLastColumn() < 1) return false;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  var ind = kolomIndeling(blad.getName(), kop);
  if (!ind) return false;
  var n = kop.length;
  var rij = blad.getRange(1, 1, 1, n);
  rij.setBackgrounds([ind.kleuren.map(function (k) { return k || null; })]);
  rij.setFontStyles([ind.nietPubliek.map(function (p) { return p ? 'italic' : 'normal'; })]);
  rij.setFontColors([ind.nietPubliek.map(function (p) { return p ? '#666666' : '#000000'; })]);
  rij.setFontWeight('bold');
  rij.setNotes([ind.uitleg.map(function (u, i) { return u || blad.getRange(1, i + 1).getNote(); })]);
  blad.setFrozenRows(1);
  if (ind.vast) blad.setFrozenColumns(ind.vast);
  // Oude groepen weg, dan de technische kolommen opnieuw groeperen en inklappen.
  for (var d = 0; d < 3; d++) {
    try { blad.getRange(1, 1, 1, blad.getMaxColumns()).shiftColumnGroupDepth(-1); } catch (e) { break; }
  }
  ind.groepen.forEach(function (g) {
    try {
      blad.getRange(1, g[0], 1, g[1]).shiftColumnGroupDepth(1);
      blad.getColumnGroup(g[0], 1).collapse();
    } catch (e) { /* niet erg: dan blijven ze zichtbaar */ }
  });
  return true;
}

/** Menu (en Installeer tabbladen): Catalogus en Uitleningen overzichtelijk maken. */
function maakTabbladenOverzichtelijk(stil) {
  var ss = spreadsheet();
  var gedaan = Object.keys(KOLOM_INDELING).filter(function (naam) { return maakTabbladOverzichtelijk(ss.getSheetByName(naam)); });
  if (!stil) meld('Klaar: ' + gedaan.join(' en ') + '. De eerste kolommen blijven staan als je naar rechts schuift, de kopregel heeft een kleur per thema, ' +
    'en bij elke kop staat uitleg (ga er met de muis over). Niet-publieke kolommen staan in schuine, grijze letters. ' +
    'De kolommen van het script zijn ingeklapt: klik op + boven de kolommen om ze te tonen.');
}
