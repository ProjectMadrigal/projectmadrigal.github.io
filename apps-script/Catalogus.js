/**
 * Catalogus.js
 * Bouwt het tabblad Catalogus op uit de tabbladen Stock en Zines, en onderhoudt
 * de vertaaltabel Onderwerpen.
 *
 * Je mag maakCatalogus() zo vaak uitvoeren als je wil:
 *   - een boek dat al in de Catalogus staat, krijgt geen tweede rij;
 *   - een waarde die je in de Catalogus met de hand verbeterde, blijft staan;
 *   - enkel lege velden worden aangevuld.
 */

/** Kolomnamen in Stock en Zines, en hoe ze in de Catalogus heten. */
var BRONKOLOMMEN = {
  'titel': 'titel',
  'auteur s': 'auteur', 'auteurs': 'auteur', 'auteur': 'auteur',
  'isbn': 'isbn', 'isbn issn': 'isbn', 'issn': 'isbn', 'isbn of issn': 'isbn',
  'uitgeverij': 'uitgeverij',
  'jaartal': 'jaartal', 'jaar': 'jaartal',
  'taal': 'taal',
  'pagina s': 'paginas', 'paginas': 'paginas',
  'uitvoering': 'uitvoering',
  'nieuwstaat': 'nieuwstaat',
  'aanrader': 'aanrader',
  'genre': 'genre',
  'aantal': 'aantal'
};

/** De standaard filtergroepen op de website, in deze volgorde. */
var FILTERGROEPEN = ['Gender', 'Seksualiteit', 'Feminisme', 'Fictie', 'Klassiekers', 'Geschiedenis en maatschappij', 'Biografie', 'Poëzie', 'Graphic novel', 'Young adult', 'Pulp', 'Erotica en BDSM', 'Zines'];

/** Voorstellen voor de vertaaltabel: een genre met dit woord erin gaat naar deze groep. */
var ONDERWERP_VOORSTELLEN = [
  [/gender|trans|non ?binair|interseks|intersex/, 'Gender'],
  [/seks|sexualiteit|homo|lesb|queer|lgbt|holebi|coming out|gay|polyamor|relatie/, 'Seksualiteit'],
  [/femin|vrouw/, 'Feminisme'],
  [/roman|fictie|fiction|verhal|verhaal|proza|literatuur|thriller|detective|fantasy|science|kort/, 'Fictie'],
  [/geschied|histor|maatschap|politi|sociolog|activis|essay|non ?fictie|filosof|religie|kolonial|marx|fascis|ecolog|cultuur|onderzoek/, 'Geschiedenis en maatschappij'],
  [/biogra|^bio$|memoir|dagboek/, 'Biografie'],
  [/poezie|gedicht|poetry|poem/, 'Poëzie'],
  [/graphic|strip|comic|manga/, 'Graphic novel'],
  [/young adult|^ya$|jeugd|kinder/, 'Young adult'],
  [/pulp/, 'Pulp'],
  [/erotic|erotiek|bdsm|kink|fetish|leder|leather/, 'Erotica en BDSM'],
  [/zine/, 'Zines']
];

/**
 * Zet de ruwe waarden van een tabblad (Stock of Zines) om naar boek-objecten.
 * waarden: tweedimensionale lijst zoals getValues() ze teruggeeft.
 * soort: 'boek' of 'zine'.
 * Lege rijen en herhaalde kopregels slaan we over.
 */
function leesBronRijen(waarden, soort) {
  // Zoek de kopregel: de eerste rij met een cel "Titel".
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var kolom = {};
  var laatsteBenoemde = -1;
  kop.forEach(function (k, i) {
    var veld = BRONKOLOMMEN[k];
    if (veld && kolom[veld] === undefined) { kolom[veld] = i; laatsteBenoemde = Math.max(laatsteBenoemde, i); }
  });
  // De herkomst staat in de eerste kolom zonder kop, rechts van de benoemde kolommen.
  var herkomstKolom = -1;
  for (var c = laatsteBenoemde + 1; c < kop.length + 5; c++) {
    if (kop[c]) continue;
    var heeftData = waarden.slice(kopIndex + 1).some(function (rij) { return !isLeeg(rij[c]); });
    if (heeftData) { herkomstKolom = c; break; }
  }

  var boeken = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var titel = schoon(rij[kolom.titel]);
    if (!titel || normaliseerTekst(titel) === 'titel') continue; // lege rij of herhaalde kop
    var lees = function (veld) { return kolom[veld] === undefined ? '' : rij[kolom[veld]]; };
    var isbnRuw = lees('isbn');
    var isbn = normaliseerIsbn(isbnRuw);
    var aantal = parseerGetal(lees('aantal'));
    var jaar = parseerGetal(lees('jaartal'));
    var paginas = parseerGetal(lees('paginas'));
    boeken.push({
      soort: soort,
      titel: titel,
      auteur: schoon(lees('auteur')),
      isbn: isbn.isbn || isbn.issn,
      isbn_origineel: isbn.geldig || isbn.leeg ? '' : schoon(isbnRuw),
      uitgeverij: schoon(lees('uitgeverij')),
      jaartal: jaar ? Math.round(jaar) : '',
      taal: normaliseerTaal(lees('taal')),
      paginas: paginas ? Math.round(paginas) : '',
      uitvoering: normaliseerUitvoering(lees('uitvoering')),
      nieuwstaat: jaNee(lees('nieuwstaat')),
      aanrader: schoon(lees('aanrader')),
      genre: schoon(lees('genre')),
      aantal: aantal && aantal > 0 ? Math.round(aantal) : 1,
      herkomst: herkomstKolom > -1 ? schoon(rij[herkomstKolom]) : ''
    });
  }
  return boeken;
}

/**
 * Sleutel om hetzelfde boek te herkennen: het ISBN, of anders de volledige titel en auteur.
 * Een boek zonder geldig ISBN maar met een ongeldig nummer, gebruikt titel en auteur.
 */
function bronSleutel(boek) {
  if (boek.isbn) return boek.soort + ':isbn:' + boek.isbn;
  // De volledige titel: "Ember: Macht (derde editie)" en "Ember: Bubbels (tweede editie)"
  // zijn verschillende boeken. Enkel hoofdletters, accenten en leestekens tellen niet.
  return boek.soort + ':ta:' + normaliseerTekst(boek.titel) + '|' + normaliseerTekst(boek.auteur);
}

/**
 * De kolom status in de Catalogus. Leeg = gewoon.
 *   verloren            niet op de website, niet uitleenbaar
 *   gevoelig verborgen  niet op de website, wel uitleenbaar aan de balie
 *   gevoelig zichtbaar  op de website met het label "Gevoelige inhoud"
 */
var BOEKSTATUSSEN = ['verloren', 'gevoelig verborgen', 'gevoelig zichtbaar'];

/** Geeft '', 'verloren', 'gevoelig_verborgen' of 'gevoelig_zichtbaar'. Hoofdletters en kleine tikfouten mogen. */
function boekStatus(boek) {
  var s = normaliseerTekst(boek && boek.status);
  if (!s) return '';
  if (/verlor|kwijt/.test(s)) return 'verloren';
  if (/gevoelig/.test(s)) return /(^|\s)zichtbaar|waarschuw/.test(s) ? 'gevoelig_zichtbaar' : 'gevoelig_verborgen';
  return '';
}

/** Mag het boek op de website? Niet bij publiek = nee, verloren of gevoelig verborgen. */
function opWebsite(boek) {
  var s = boekStatus(boek);
  return jaNee(boek.publiek) !== 'nee' && s !== 'verloren' && s !== 'gevoelig_verborgen';
}

/** Mag het boek uitgeleend worden? Niet bij uitleenbaar = nee, verloren, te koop, of een kijktip (film die niet in de bib is). */
function isUitleenbaar(boek) {
  return jaNee(boek.uitleenbaar) !== 'nee' && boekStatus(boek) !== 'verloren' && jaNee(boek.te_koop) !== 'ja' && !isFilmTip(boek);
}

/** De soort van een rij in de Catalogus: boek, zine of film. */
function soortVan(rij) {
  var s = normaliseerTekst(rij && rij.soort);
  return s === 'zine' || s === 'film' ? s : 'boek';
}

/** De foutmelding aan de balie voor een boek dat niet uitleenbaar is. */
function nietUitleenbaarFout(boek) {
  return boekStatus(boek) === 'verloren' ? 'Dit boek staat als verloren. Zet de status in de Catalogus leeg als het terug is.' : 'Dit boek is niet uitleenbaar.';
}

/** Staat er in de herkomst een interne notitie dat het boek niet publiek mag? */
function nietPubliekVolgensHerkomst(herkomst) {
  return /niet\s+(op\s+(de\s+)?)?(site|website|online)|niet\s+publiek/i.test(herkomst || '');
}

/**
 * Voegt de boeken uit Stock en Zines samen met de bestaande Catalogus.
 * bestaand: rijen van de Catalogus (worden aangevuld, nooit overschreven).
 * bron: boek-objecten uit leesBronRijen.
 * nieuwId: functie(soort) die een nieuwe, unieke boek-ID geeft.
 * Geeft { nieuw, aangevuld } terug (aantallen).
 */
/**
 * Enkel de namen uit de instelling aanraders_uit_stocklijst (bv. Johanna) komen
 * uit de stocklijst. "Nance en Johanna" wordt zo "Johanna". Andere aanraders
 * typ je zelf in de kolom aanrader van de Catalogus.
 */
function toegelatenStockAanrader(waarde, inst) {
  var toegelaten = splitsLijst((inst || {}).aanraders_uit_stocklijst).map(normaliseerTekst);
  return splitsLijst(String(waarde || '').replace(/ en | & /g, ',')).filter(function (naam) {
    return toegelaten.indexOf(normaliseerTekst(naam)) > -1;
  }).join(', ');
}

function voegBronSamen(bestaand, bron, nieuwId, inst, vandaag) {
  // Bij de eerste opbouw is niets "nieuw binnen". Daarna krijgt een nieuw boek de datum van vandaag.
  var datumNieuw = bestaand.length && vandaag ? vandaag : '';
  // 1. Dubbele rijen in de bron samenvoegen: aantallen optellen, herkomst bundelen.
  var perSleutel = {};
  var volgorde = [];
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (!perSleutel[s]) { perSleutel[s] = b; volgorde.push(s); return; }
    var eerste = perSleutel[s];
    eerste.aantal += b.aantal;
    if (b.herkomst && eerste.herkomst.indexOf(b.herkomst) === -1) {
      eerste.herkomst = eerste.herkomst ? eerste.herkomst + ' | ' + b.herkomst : b.herkomst;
    }
    Object.keys(b).forEach(function (k) { if (isLeeg(eerste[k]) && !isLeeg(b[k])) eerste[k] = b[k]; });
  });

  // 2. Bestaande rijen opzoeken op hun bronsleutel.
  var index = {};
  bestaand.forEach(function (rij) { if (rij.bron_sleutel) index[rij.bron_sleutel] = rij; });

  var teller = { nieuw: 0, aangevuld: 0 };
  volgorde.forEach(function (s) {
    var b = perSleutel[s];
    var rij = index[s];
    if (rij) {
      // Enkel lege velden aanvullen. Wat iemand met de hand invulde, blijft.
      var velden = {};
      ['titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat', 'genre', 'herkomst', 'isbn_origineel'].forEach(function (k) {
        if (isLeeg(rij[k]) && !isLeeg(b[k])) velden[k] = b[k];
      });
      // De aanrader: enkel de toegelaten namen (zie toegelatenStockAanrader).
      var aanrader = toegelatenStockAanrader(b.aanrader, inst);
      if (isLeeg(rij.aanrader) && aanrader) velden.aanrader = aanrader;
      if (isLeeg(rij.aantal)) velden.aantal = b.aantal;
      if (Object.keys(velden).length) { wijzig(rij, velden); teller.aangevuld++; }
      return;
    }
    var teKoop = b.soort === 'zine' && normaliseerTekst(b.genre) === 'verkoop';
    var nieuweRij = {
      boek_id: nieuwId(b.soort),
      soort: b.soort,
      titel: b.titel, auteur: b.auteur, isbn: b.isbn, uitgeverij: b.uitgeverij, jaartal: b.jaartal,
      taal: b.taal, paginas: b.paginas, uitvoering: b.uitvoering, nieuwstaat: b.nieuwstaat,
      aanrader: toegelatenStockAanrader(b.aanrader, inst), genre: b.genre, extra_onderwerpen: '', klassieker: '',
      aantal: b.aantal,
      uitleenbaar: teKoop && !inst.zines_te_koop_uitleenbaar ? 'nee' : 'ja',
      publiek: nietPubliekVolgensHerkomst(b.herkomst) ? 'nee' : 'ja',
      beschrijving: '', cover_url: '', startpagina: '', toegevoegd_op: datumNieuw,
      herkomst: b.herkomst, isbn_origineel: b.isbn_origineel, bron_sleutel: s, ol_gecontroleerd: ''
    };
    voegToe(bestaand, nieuweRij);
    index[s] = nieuweRij;
    teller.nieuw++;
  });
  return teller;
}

/**
 * Maakt een generator voor nieuwe boek-ID's: B0001 voor boeken, Z0001 voor zines.
 * De teller staat in de scripteigenschappen, zodat een ID nooit twee keer gebruikt wordt,
 * ook niet als je een boek wist. Roep bewaar() op als je klaar bent.
 */
function maakIdGenerator(catalogusRijen) {
  var props = PropertiesService.getScriptProperties();
  var tellers = {};
  ['B', 'Z', 'F'].forEach(function (prefix) {
    var laatste = Number(props.getProperty('teller_boek_' + prefix) || 0);
    catalogusRijen.forEach(function (r) {
      var id = String(r.boek_id || '');
      if (id.charAt(0) === prefix) laatste = Math.max(laatste, Number(id.slice(1)) || 0);
    });
    tellers[prefix] = laatste;
  });
  return {
    nieuw: function (soort) {
      var prefix = soort === 'zine' ? 'Z' : soort === 'film' ? 'F' : 'B';
      tellers[prefix] += 1;
      return prefix + metNullen(tellers[prefix], 4);
    },
    bewaar: function () {
      props.setProperty('teller_boek_B', String(tellers.B));
      props.setProperty('teller_boek_Z', String(tellers.Z));
      props.setProperty('teller_boek_F', String(tellers.F));
    }
  };
}

/** Menu: bouwt de Catalogus op uit Stock en Zines. */
function maakCatalogus() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = spreadsheet();
    var inst = leesInstellingen();
    var bron = [];
    [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
      var blad = ss.getSheetByName(paar[0]);
      if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
    });
    if (!bron.length) throw new Error('Geen boeken gevonden in de tabbladen Stock en Zines.');
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    var teller = voegBronSamen(tabel.rijen, bron, ids.nieuw, inst, vandaagTekst());
    schrijfVolledig(tabel);
    ids.bewaar();
    var onderwerpen = werkOnderwerpenBij();
    leegCache();
    logboek('menu', 'maakCatalogus', teller.nieuw + ' nieuw, ' + teller.aangevuld + ' aangevuld');
    meld('Catalogus klaar: ' + teller.nieuw + ' nieuwe boeken, ' + teller.aangevuld + ' aangevuld. ' +
      onderwerpen + ' nieuwe genres in Onderwerpen. Kijk de boeken met een ongeldig ISBN na (kolom isbn_origineel).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Wist de aanraders die uit de stocklijst kwamen, behalve de namen uit de
 * instelling aanraders_uit_stocklijst (bv. Johanna). Een aanrader die je zelf
 * invulde of aanpaste (een andere waarde dan in de stocklijst), blijft staan.
 * catalogusRijen: rijen van de Catalogus. bron: boek-objecten uit leesBronRijen.
 * Geeft het aantal aangepaste boeken terug.
 */
function wisAanradersUitStockRijen(catalogusRijen, bron, inst) {
  var uitStock = {};
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (b.aanrader && !uitStock[s]) uitStock[s] = normaliseerTekst(b.aanrader);
  });
  var n = 0;
  catalogusRijen.forEach(function (rij) {
    if (isLeeg(rij.aanrader) || !rij.bron_sleutel) return;
    if (uitStock[rij.bron_sleutel] === normaliseerTekst(rij.aanrader)) {
      var blijft = toegelatenStockAanrader(rij.aanrader, inst);
      if (normaliseerTekst(blijft) === normaliseerTekst(rij.aanrader)) return;
      wijzig(rij, { aanrader: blijft });
      n++;
    }
  });
  return n;
}

/** Menu: wist de aanraders die automatisch uit de stocklijst overgenomen werden. */
function wisAanradersUitStock() {
  var ss = spreadsheet();
  var bron = [];
  [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
    var blad = ss.getSheetByName(paar[0]);
    if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
  });
  if (!bron.length) {
    meld('De tabbladen Stock en Zines ontbreken. Wis de namen in de kolom aanrader van de Catalogus dan met de hand.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var tabel = leesTabel('Catalogus');
    n = wisAanradersUitStockRijen(tabel.rijen, bron, leesInstellingen());
    bewaarTabel(tabel);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  logboek('menu', 'wisAanradersUitStock', n + ' aanraders gewist');
  meld(n + ' boeken kregen een aangepaste aanrader. De namen uit aanraders_uit_stocklijst (zoals Johanna) en wat je zelf invulde, bleven staan. Een andere aanrader typ je voortaan in de kolom aanrader van de Catalogus.');
}

/**
 * Menu: wist de Catalogus en bouwt ze opnieuw op uit Stock en Zines.
 * Enkel bedoeld voor de eerste opbouw. Wat je met de hand in de Catalogus
 * aanpaste, gaat verloren. Het script weigert zodra er uitleningen of
 * reservaties zijn, want die verwijzen naar de boek-ID's.
 */
function herbouwCatalogus() {
  if (leesTabel('Uitleningen').rijen.length || leesTabel('Reservaties').rijen.length) {
    meld('De Catalogus opnieuw opbouwen kan niet meer: er zijn al uitleningen of reservaties. Die verwijzen naar de boek-ID\'s.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var antwoord = ui.alert('Catalogus opnieuw opbouwen',
    'Dit wist alle boeken in het tabblad Catalogus, ook wat je er met de hand aanpaste, en bouwt ze opnieuw op uit Stock en Zines. De boek-ID\'s beginnen opnieuw bij B0001. Doorgaan?',
    ui.ButtonSet.YES_NO);
  if (antwoord !== ui.Button.YES) return;
  var blad = spreadsheet().getSheetByName('Catalogus');
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, blad.getLastColumn()).clearContent();
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('teller_boek_B');
  props.deleteProperty('teller_boek_Z');
  logboek('menu', 'herbouwCatalogus', 'Catalogus gewist');
  maakCatalogus();
}

/**
 * Geeft elke rij zonder boek-ID (maar met een titel) een boek-ID, de datum van
 * vandaag in toegevoegd_op en nette waarden (ISBN, taal, ...). Geeft het aantal terug.
 */
function geefNieuweBoekenEenId() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    tabel.rijen.forEach(function (rij) {
      if (!isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
      var soort = soortVan(rij);
      var isbn = normaliseerIsbn(rij.isbn);
      var velden = {
        boek_id: ids.nieuw(soort),
        soort: soort,
        titel: schoon(rij.titel), auteur: schoon(rij.auteur),
        isbn: isbn.isbn || isbn.issn || schoon(rij.isbn),
        taal: normaliseerTaal(rij.taal),
        uitvoering: normaliseerUitvoering(rij.uitvoering),
        nieuwstaat: jaNee(rij.nieuwstaat),
        aantal: parseerGetal(rij.aantal) || 1,
        uitleenbaar: jaNee(rij.uitleenbaar) || 'ja',
        publiek: jaNee(rij.publiek) || 'ja',
        toegevoegd_op: parseerDatum(rij.toegevoegd_op) || vandaagTekst()
      };
      velden.bron_sleutel = bronSleutel({ soort: soort, isbn: velden.isbn, titel: velden.titel, auteur: velden.auteur });
      wijzig(rij, velden);
      aantal++;
    });
    if (aantal) {
      bewaarTabel(tabel);
      ids.bewaar();
    }
  } finally {
    lock.releaseLock();
  }
  return aantal;
}

/**
 * Elk uur vanzelf (zie Madrigal > Installeer tabbladen): een boek dat je met de hand in de
 * Catalogus typte, krijgt een boek-ID en verschijnt zo op de website en in Nieuw binnen.
 */
function verwerkNieuweBoekenAutomatisch() {
  var aantal = geefNieuweBoekenEenId();
  if (!aantal) return;
  werkOnderwerpenBij();
  leegCache();
  logboek('systeem', 'nieuwe boeken', aantal + ' boeken kregen vanzelf een boek-ID');
}

/**
 * Menu: verwerkt boeken die je met de hand onderaan de Catalogus toevoegde.
 * Geeft ze een boek-ID, maakt het ISBN en de taal netjes, en vult aan uit
 * Goodreads (als dat tabblad bestaat) en Open Library.
 */
function verwerkNieuweBoeken() {
  var aantal = geefNieuweBoekenEenId();
  werkOnderwerpenBij();
  leegCache();
  if (spreadsheet().getSheetByName('Goodreads-export')) vulAanUitGoodreads(true);
  meld(aantal + ' nieuwe boeken kregen een boek-ID. Open Library vult nu de rest aan.');
  vulAanUitOpenLibrary();
}

/**
 * Zet elk genre uit de Catalogus in de vertaaltabel Onderwerpen, met een voorstel
 * voor de filtergroep. Bestaande regels blijven ongemoeid, het aantal boeken wordt bijgewerkt.
 * Geeft het aantal nieuwe genres terug.
 */
function werkOnderwerpenBij() {
  var catalogus = leesTabel('Catalogus');
  var tabel = leesTabel('Onderwerpen');
  var resultaat = vulOnderwerpenAan(tabel.rijen, catalogus.rijen);
  bewaarTabel(tabel);
  return resultaat;
}

/** Pure versie van werkOnderwerpenBij, voor de tests. */
function vulOnderwerpenAan(onderwerpRijen, catalogusRijen) {
  var tellingen = {};
  var schrijfwijzen = {};
  catalogusRijen.forEach(function (b) {
    var g = normaliseerTekst(b.genre);
    if (!g || isFilm(b)) return; // filmgenres staan los van de onderwerpen van de boeken
    tellingen[g] = (tellingen[g] || 0) + 1;
    schrijfwijzen[g] = schrijfwijzen[g] || {};
    var s = schoon(b.genre);
    schrijfwijzen[g][s] = (schrijfwijzen[g][s] || 0) + 1;
  });
  var bekend = {};
  onderwerpRijen.forEach(function (r) {
    var g = normaliseerTekst(r.genre);
    bekend[g] = true;
    if (Number(r.aantal_boeken) !== (tellingen[g] || 0)) wijzig(r, { aantal_boeken: tellingen[g] || 0 });
  });
  var nieuw = 0;
  Object.keys(tellingen).sort().forEach(function (g) {
    if (bekend[g]) return;
    // De meest gebruikte schrijfwijze wordt de naam in de tabel.
    var naam = Object.keys(schrijfwijzen[g]).sort(function (a, b) { return schrijfwijzen[g][b] - schrijfwijzen[g][a]; })[0];
    voegToe(onderwerpRijen, { genre: naam, filtergroepen: stelFiltergroepenVoor(g).join(', '), aantal_boeken: tellingen[g] });
    nieuw++;
  });
  return nieuw;
}

/** Stelt filtergroepen voor op basis van woorden in het genre. */
function stelFiltergroepenVoor(genre) {
  var g = normaliseerTekst(genre);
  var groepen = [];
  ONDERWERP_VOORSTELLEN.forEach(function (paar) {
    if (paar[0].test(g) && groepen.indexOf(paar[1]) === -1) groepen.push(paar[1]);
  });
  return groepen;
}

/**
 * Bepaalt de filtergroepen van een boek: via de vertaaltabel, de kolom
 * extra_onderwerpen, het vinkje klassieker en de soort (zines).
 * vertaal: object genre (genormaliseerd) -> lijst filtergroepen.
 */
function filtergroepenVan(boek, vertaal) {
  var groepen = (vertaal[normaliseerTekst(boek.genre)] || []).slice();
  splitsLijst(boek.extra_onderwerpen).forEach(function (g) { groepen.push(g); });
  if (jaNee(boek.klassieker) === 'ja') groepen.push('Klassiekers');
  if (normaliseerTekst(boek.soort) === 'zine') groepen.push('Zines');
  // Schrijfwijze gelijktrekken met de standaardgroepen, dubbels weg.
  var uniek = [];
  groepen.forEach(function (g) {
    var standaard = FILTERGROEPEN.filter(function (f) { return normaliseerTekst(f) === normaliseerTekst(g); })[0] || schoon(g);
    if (standaard && uniek.indexOf(standaard) === -1) uniek.push(standaard);
  });
  return uniek;
}

/** Leest de vertaaltabel als object: genre -> lijst filtergroepen. */
function vertaalTabel(onderwerpRijen) {
  var vertaal = {};
  onderwerpRijen.forEach(function (r) {
    vertaal[normaliseerTekst(r.genre)] = splitsLijst(r.filtergroepen);
  });
  return vertaal;
}

/** Toont een melding in de spreadsheet (of in het logboek als er geen scherm is). */
function meld(tekst) {
  try {
    SpreadsheetApp.getUi().alert(tekst);
  } catch (e) {
    try { spreadsheet().toast(tekst, 'Madrigal', 10); } catch (e2) { Logger.log(tekst); }
  }
}
