/**
 * Tests voor de catalogus en het uitleensysteem.
 * Uitvoeren:  node tests/run.js
 * Alle namen, boeken en gegevens hieronder zijn verzonnen.
 */
'use strict';

const assert = require('assert');
const { laad } = require('./laad');

const M = laad();
let geslaagd = 0;
const mislukt = [];

/** Vergelijkt waarden als JSON (lijsten uit de testomgeving hebben een ander prototype). */
function gelijk(a, b) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}

function test(naam, fn) {
  try {
    fn();
    geslaagd++;
    console.log('  ok   ' + naam);
  } catch (e) {
    mislukt.push(naam);
    console.log('  FOUT ' + naam + '\n       ' + (e && e.message));
  }
}

/** Instellingen zoals de standaard, met aanpassingen. */
function instellingen(ruw) {
  return M.verwerkInstellingen(ruw || {});
}

/** Een verzonnen staat met een kleine catalogus en drie leners. */
function maakStaat(vandaag, ruw) {
  return {
    inst: instellingen(ruw),
    vandaag: vandaag || '2026-10-23',
    wie: 'Testvrijwilliger',
    catalogus: [
      { boek_id: 'B0001', soort: 'boek', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', aantal: 1, uitleenbaar: 'ja', publiek: 'ja', genre: 'Roman', herkomst: 'gift van Kees Voorbeeld' },
      { boek_id: 'B0002', soort: 'boek', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', isbn: '', aantal: 2, uitleenbaar: 'ja', publiek: 'ja', genre: 'essay' },
      { boek_id: 'B0003', soort: 'boek', titel: 'Stille lichten', auteur: 'Aerts, Noor', isbn: '', aantal: '', uitleenbaar: 'ja', publiek: 'ja', genre: 'Poëzie' },
      { boek_id: 'B0004', soort: 'boek', titel: 'Het nachtboek', auteur: 'Claes, Ilo', isbn: '', aantal: 1, uitleenbaar: 'ja', publiek: 'nee', genre: 'Roman', herkomst: 'niet op site' },
      { boek_id: 'Z0001', soort: 'zine', titel: 'Glitterbrief #3', auteur: 'Collectief Fictief', isbn: '', aantal: 1, uitleenbaar: 'nee', publiek: 'ja', genre: 'verkoop' }
    ],
    leners: [
      { lenersnummer: '1', voornaam: 'Sam', achternaam: 'Achternaamtest', telefoon: '0470 00 00 01', email: 'sam@voorbeeld.test', datum_inschrijving: '2026-01-10', toestemming_privacy: 'ja', actief: 'ja' },
      { lenersnummer: '2', voornaam: 'Jo', achternaam: '', telefoon: '', email: 'jo@voorbeeld.test', datum_inschrijving: '2026-02-01', toestemming_privacy: 'ja', actief: 'ja' },
      { lenersnummer: '3', voornaam: 'Alex', achternaam: '', telefoon: '0470 00 00 03', email: '', datum_inschrijving: '2026-03-01', toestemming_privacy: 'ja', actief: 'ja' }
    ],
    uitleningen: [],
    reservaties: [],
    uitzonderingen: [],
    uitzonderingenTabel: [],
    log: []
  };
}

function uitleen(staat, exemplaar, lener, extra) {
  return M.uitlenen(staat, Object.assign({ exemplaar: exemplaar, lenersnummer: lener, borg: 5, betaalwijze: 'cash', gift: '' }, extra || {}));
}

console.log('\nISBN');

test('ISBN-10 met streepjes wordt ISBN-13', () => {
  const r = M.normaliseerIsbn('0-306-40615-2');
  assert.strictEqual(r.isbn, '9780306406157');
  assert.strictEqual(r.geldig, true);
});
test('ISBN-10 met X als controlecijfer', () => {
  assert.strictEqual(M.normaliseerIsbn('080442957X').isbn, '9780804429573');
});
test('ISBN-13 met spaties', () => {
  assert.strictEqual(M.normaliseerIsbn(' 978 0 306 40615 7 ').isbn, '9780306406157');
});
test('ISBN als getal uit de spreadsheet', () => {
  assert.strictEqual(M.normaliseerIsbn(9780306406157).isbn, '9780306406157');
});
test('fout controlecijfer wordt geweigerd', () => {
  const r = M.normaliseerIsbn('978-0-306-40615-8');
  assert.strictEqual(r.isbn, '');
  assert.strictEqual(r.geldig, false);
});
test('ISSN van een zine', () => {
  assert.strictEqual(M.normaliseerIsbn('ISSN 1234-5679').issn, '1234-5679');
});
test('leeg ISBN', () => {
  assert.strictEqual(M.normaliseerIsbn('').leeg, true);
});

console.log('\nOpschonen van de stocklijst');

test('Stock: kolom A genegeerd, lege rijen en herhaalde kop overgeslagen, herkomst apart', () => {
  const waarden = [
    ['', 'Titel', 'Auteur(s)', 'ISBN', 'Uitgeverij', 'Jaartal', 'Taal', "Pagina's", 'Uitvoering', 'Nieuwstaat', 'Aanrader', 'Genre', 'Aantal', ''],
    [true, 'De verzonnen zee ', 'Verbeek, Mira', '0-306-40615-2', 'Uitgeverij Fictie', 1999, 'nederlands', 210, 'paperback', 'Ja', 'Robin', 'roman', '', 'donatie Kees Voorbeeld'],
    [false, '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Titel', 'Auteur(s)', 'ISBN', '', '', '', '', '', '', '', '', '', ''],
    [false, 'Stille lichten', 'Aerts, Noor', '12345', '', '', 'EN', '', 'Hardcover', 'nee', '', 'Roman', 2, 'niet op site']
  ];
  const rijen = M.leesBronRijen(waarden, 'boek');
  assert.strictEqual(rijen.length, 2);
  assert.strictEqual(rijen[0].titel, 'De verzonnen zee');
  assert.strictEqual(rijen[0].isbn, '9780306406157');
  assert.strictEqual(rijen[0].taal, 'Nederlands');
  assert.strictEqual(rijen[0].uitvoering, 'Paperback');
  assert.strictEqual(rijen[0].nieuwstaat, 'ja');
  assert.strictEqual(rijen[0].herkomst, 'donatie Kees Voorbeeld');
  assert.strictEqual(rijen[0].aantal, 1);
  assert.strictEqual(rijen[1].isbn, '');
  assert.strictEqual(rijen[1].isbn_origineel, '12345');
  assert.strictEqual(rijen[1].taal, 'Engels');
  assert.strictEqual(rijen[1].aantal, 2);
  assert.ok(!('selectievakje' in rijen[0]));
});

test('maakCatalogus mag opnieuw: geen dubbels, handmatige correctie blijft', () => {
  const bron = [
    { soort: 'boek', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: 'Fictie', jaartal: 1999, taal: 'Nederlands', paginas: 210, uitvoering: 'Paperback', nieuwstaat: 'ja', aanrader: '', genre: 'roman', aantal: 1, herkomst: 'gift', isbn_origineel: '' },
    { soort: 'zine', titel: 'Glitterbrief #3', auteur: 'Collectief Fictief', isbn: '', uitgeverij: '', jaartal: '', taal: '', paginas: '', uitvoering: '', nieuwstaat: '', aanrader: '', genre: 'verkoop', aantal: 1, herkomst: 'niet op site', isbn_origineel: '' }
  ];
  const catalogus = [];
  let n = 0;
  const id = (s) => (s === 'zine' ? 'Z' : 'B') + (++n);
  const inst = instellingen();
  let t = M.voegBronSamen(catalogus, JSON.parse(JSON.stringify(bron)), id, inst);
  assert.strictEqual(t.nieuw, 2);
  assert.strictEqual(catalogus[1].uitleenbaar, 'nee');
  assert.strictEqual(catalogus[1].publiek, 'nee');
  catalogus[0].titel = 'De verzonnen zee (verbeterd)';
  catalogus[0].uitgeverij = '';
  t = M.voegBronSamen(catalogus, JSON.parse(JSON.stringify(bron)), id, inst);
  assert.strictEqual(t.nieuw, 0);
  assert.strictEqual(catalogus.length, 2);
  assert.strictEqual(catalogus[0].titel, 'De verzonnen zee (verbeterd)');
  assert.strictEqual(catalogus[0].uitgeverij, 'Fictie');
  assert.strictEqual(catalogus[0].boek_id, 'B1');
});

test('nieuw boek krijgt toegevoegd_op, maar niet bij de eerste opbouw', () => {
  const boek = (titel) => ({ soort: 'boek', titel: titel, auteur: 'Verzonnen, Iemand', isbn: '', uitgeverij: '', jaartal: '', taal: '', paginas: '', uitvoering: '', nieuwstaat: '', aanrader: '', genre: 'roman', aantal: 1, herkomst: '', isbn_origineel: '' });
  const catalogus = [];
  let n = 0;
  const id = () => 'B' + (++n);
  M.voegBronSamen(catalogus, [boek('Eerste')], id, instellingen(), '2026-10-01');
  assert.strictEqual(catalogus[0].toegevoegd_op, '');
  M.voegBronSamen(catalogus, [boek('Eerste'), boek('Tweede')], id, instellingen(), '2026-10-20');
  assert.strictEqual(catalogus[1].toegevoegd_op, '2026-10-20');
});

test('aanrader uit de stocklijst: enkel toegelaten namen, de rest kan je wissen', () => {
  const boek = (titel, aanrader) => ({ soort: 'boek', titel: titel, auteur: 'Verzonnen, Iemand', isbn: '', uitgeverij: '', jaartal: '', taal: '', paginas: '', uitvoering: '', nieuwstaat: '', aanrader: aanrader, genre: 'roman', aantal: 1, herkomst: '', isbn_origineel: '' });
  const inst = instellingen();
  inst.aanraders_uit_stocklijst = 'Kim';
  const bron = [boek('Eerste', 'Robin'), boek('Tweede', 'Kim'), boek('Derde', 'Robin en Kim'), boek('Vierde', 'Robin')];
  const catalogus = [];
  let n = 0;
  M.voegBronSamen(catalogus, JSON.parse(JSON.stringify(bron)), () => 'B' + (++n), inst);
  gelijk(catalogus.map((r) => r.aanrader), ['', 'Kim', 'Kim', '']);
  // Een oude Catalogus met alles overgenomen, en één aanrader die je zelf aanpaste.
  catalogus[0].aanrader = 'Robin';
  catalogus[1].aanrader = 'Kim';
  catalogus[2].aanrader = 'robin en Kim';
  catalogus[3].aanrader = 'Sam';
  assert.strictEqual(M.wisAanradersUitStockRijen(catalogus, bron, inst), 2);
  gelijk(catalogus.map((r) => r.aanrader), ['', 'Kim', 'Kim', 'Sam']);
});

test('boeken zonder ISBN met dezelfde titel tot de dubbele punt blijven apart', () => {
  const zine = (titel, aantal) => ({ soort: 'zine', titel: titel, auteur: '', isbn: '', uitgeverij: '', jaartal: '', taal: '', paginas: '', uitvoering: '', nieuwstaat: '', aanrader: '', genre: 'Zine', aantal: aantal, herkomst: '', isbn_origineel: '' });
  const catalogus = [];
  let n = 0;
  const t = M.voegBronSamen(catalogus, [
    zine('Glitter: Macht (derde editie)', 3), zine('Glitter: Bubbels (tweede editie)', 3),
    zine('Het besef (23)', 1), zine('Het besef (28)', 1), zine('Het besef (28) ', 1)
  ], () => 'Z' + (++n), instellingen());
  assert.strictEqual(t.nieuw, 4);
  assert.strictEqual(catalogus[3].aantal, 2);
});

test('genres met andere schrijfwijze komen één keer in Onderwerpen', () => {
  const rijen = [];
  const nieuw = M.vulOnderwerpenAan(rijen, [{ genre: 'Young Adult' }, { genre: 'Young adult' }, { genre: 'young adult' }, { genre: 'Erotica' }, { genre: 'erotica' }]);
  assert.strictEqual(nieuw, 2);
  const ya = rijen.find((r) => r.genre.toLowerCase() === 'young adult');
  assert.strictEqual(ya.aantal_boeken, 3);
  assert.strictEqual(ya.filtergroepen, 'Young adult');
  assert.strictEqual(rijen.find((r) => r.genre.toLowerCase() === 'erotica').filtergroepen, 'Erotica en BDSM');
});

test('filtergroepen: vertaaltabel, extra onderwerpen, klassieker en zines', () => {
  const vertaal = M.vertaalTabel([{ genre: 'Roman', filtergroepen: 'Fictie' }]);
  const g = M.filtergroepenVan({ genre: 'roman', extra_onderwerpen: 'gender; Seksualiteit', klassieker: true, soort: 'boek' }, vertaal);
  gelijk(Array.from(g), ['Fictie', 'Gender', 'Seksualiteit', 'Klassiekers']);
  gelijk(Array.from(M.filtergroepenVan({ genre: 'verkoop', soort: 'zine' }, vertaal)), ['Zines']);
});

console.log('\nGoodreads');

test('koppeling op ISBN vult enkel lege velden aan', () => {
  const catalogus = [{ boek_id: 'B1', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: '', jaartal: 2001, paginas: '' }];
  const gr = [{ Title: 'De verzonnen zee', Author: 'Mira Verbeek', 'Author l-f': 'Verbeek, Mira', ISBN: '="0306406152"', ISBN13: '="9780306406157"', Publisher: 'Fictie & Zonen', 'Year Published': '2001', 'Number of Pages': '212' }];
  const r = M.koppelGoodreads(catalogus, gr);
  const velden = r.aanvullingen.map((a) => a.veld).sort();
  gelijk(velden, ['paginas', 'uitgeverij']);
  assert.strictEqual(r.naTeKijken.length, 0);
});
test('verschillende waarde: de Catalogus wint, geen rij in Na te kijken', () => {
  const catalogus = [{ boek_id: 'B1', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', isbn: '9780306406157', uitgeverij: 'Fictie', jaartal: 1999, paginas: 210 }];
  const gr = [{ Title: 'De verzonnen zee', 'Author l-f': 'Verbeek, Mira', ISBN13: '="9780306406157"', Publisher: 'Fictie BV', 'Year Published': '2004', 'Number of Pages': '209' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 0);
  assert.strictEqual(r.naTeKijken.length, 0);
});
test('koppeling op titel en auteur (zonder ISBN), ISBN enkel als voorstel', () => {
  const catalogus = [{ boek_id: 'B2', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', isbn: '', uitgeverij: '', jaartal: '', paginas: '' }];
  const gr = [{ Title: 'Twee Kasten Vol: een essay (Reeks Fictief, #2)', 'Author l-f': 'Dewit, Rein', ISBN13: '="9780306406157"', Publisher: 'Huis', 'Year Published': '2010', 'Number of Pages': '99' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 3);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(r.naTeKijken[0].veld, 'isbn');
});
test('enkel de titel komt overeen: twijfel, niets ingevuld', () => {
  const catalogus = [{ boek_id: 'B3', titel: 'Stille lichten', auteur: 'Aerts, Noor', isbn: '', uitgeverij: '', jaartal: '', paginas: '' }];
  const gr = [{ Title: 'Stille lichten', 'Author l-f': 'Janssens, Piet', Author: 'Piet Janssens', Publisher: 'X', 'Year Published': '2015' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 0);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(r.naTeKijken[0].veld, 'koppeling');
});
test('Goodreads: enkel boeken van de gekozen shelf', () => {
  const waarden = [
    ['Title', 'Author', 'Bookshelves', 'Exclusive Shelf'],
    ['Boek op shelf', 'A', 'madrigal, favorites', 'read'],
    ['Persoonlijk boek', 'B', 'favorites', 'read'],
    ['Exclusief op shelf', 'C', '', 'Madrigal']
  ];
  gelijk(M.leesGoodreadsRijen(waarden, 'Madrigal').map((r) => r.Title), ['Boek op shelf', 'Exclusief op shelf']);
  assert.strictEqual(M.leesGoodreadsRijen(waarden, '').length, 3);
});

test('koppeling op titel en auteur: andere uitgave is geen twijfel', () => {
  const catalogus = [{ boek_id: 'B4', titel: 'Dagen zonder eind', auteur: 'Barry, Sam', isbn: '9780306406157', uitgeverij: 'Uitgeverij A', jaartal: 2016, paginas: 302 }];
  const gr = [{ Title: 'Dagen zonder eind', 'Author l-f': 'Barry, Sam', ISBN13: '="9780804429573"', Publisher: 'Uitgeverij B', 'Year Published': '2017', 'Number of Pages': '259' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.naTeKijken.length, 0);
  assert.strictEqual(r.aanvullingen.length, 0);
});
test('tussenvoegsel: "van Dijk, Jo" en "Dijk, Jo van" zijn dezelfde auteur', () => {
  assert.strictEqual(M.achternaam('van Dijk, Jo'), 'dijk');
  assert.strictEqual(M.achternaam('Dijk, Jo van'), 'dijk');
  assert.strictEqual(M.achternaam('Jo van Dijk'), 'dijk');
  const catalogus = [{ boek_id: 'B5', titel: 'De zwarte zee', auteur: 'van Dijk, Jo', isbn: '', uitgeverij: '', jaartal: '', paginas: '' }];
  const gr = [{ Title: 'De zwarte zee', 'Author l-f': 'Dijk, Jo van', Publisher: 'Huis', 'Year Published': '1986', 'Number of Pages': '420' }];
  const r = M.koppelGoodreads(catalogus, gr);
  assert.strictEqual(r.aanvullingen.length, 3);
  assert.strictEqual(r.naTeKijken.filter((x) => x.veld === 'koppeling').length, 0);
});

test('Na te kijken: zelfde twijfel twee keer, één rij', () => {
  const rijen = [];
  const item = { boek: { boek_id: 'B1', titel: 'T' }, veld: 'jaartal', waarde_catalogus: 1999, waarde_bron: 2004, opmerking: '' };
  M.voegNaTeKijkenToe(rijen, [item], 'Goodreads', '2026-10-23');
  M.voegNaTeKijkenToe(rijen, [item], 'Goodreads', '2026-10-24');
  assert.strictEqual(rijen.length, 1);
});

console.log('\nOpen Library');

test('vult enkel lege velden en bouwt de cover-link', () => {
  const boek = { isbn: '9780306406157', uitgeverij: 'Bestaand', jaartal: '', paginas: '', taal: '', beschrijving: '', cover_url: '' };
  const v = M.verwerkOpenLibrary(boek, { publishers: ['Ander'], publish_date: 'March 1999', number_of_pages: 321, languages: [{ key: '/languages/eng' }], covers: [12345], description: { value: 'Een verzonnen beschrijving.' } });
  assert.strictEqual(v.uitgeverij, undefined);
  assert.strictEqual(v.jaartal, 1999);
  assert.strictEqual(v.paginas, 321);
  assert.strictEqual(v.taal, 'Engels');
  assert.strictEqual(v.cover_url, 'https://covers.openlibrary.org/b/id/12345-M.jpg');
  assert.strictEqual(v.beschrijving, 'Een verzonnen beschrijving.');
});

test('beschrijvingen: netjes gemaakt, enkel zoeken waar nodig', () => {
  const ol = 'Een verzonnen roman over een zee.\n\nTweede alinea met een [link](https://voorbeeld.test).\n\n----------\nZie ook: [1]\n[1]: https://voorbeeld.test';
  assert.strictEqual(M.maakBeschrijvingNetjes(ol), 'Een verzonnen roman over een zee.\n\nTweede alinea met een link.');
  assert.strictEqual(M.maakBeschrijvingNetjes('<p>Een <b>vet</b> boek&amp;meer</p>'), 'Een vet boek&meer');
  // Een beschrijving van 650 tekens blijft volledig (vroeger stopte ze na 600 tekens).
  const middel = 'Pietro is een stadsjongen uit Milaan. '.repeat(17).trim();
  assert.strictEqual(M.maakBeschrijvingNetjes(middel), middel);
  // Te lang: stopt na de laatste volledige zin, niet midden in een zin.
  const zinnen = 'Dit is een verzonnen zin over een boek. '.repeat(100);
  const kort = M.maakBeschrijvingNetjes(zinnen);
  assert.ok(kort.length <= 2500 && kort.endsWith('boek.'));
  // Zonder zinseinde: na een volledig woord, met ...
  const woorden = M.maakBeschrijvingNetjes('woord '.repeat(600));
  assert.ok(woorden.length <= 2500 && woorden.endsWith('woord...'));
  assert.strictEqual(M.olTekst({ value: 'Tekst' }), 'Tekst');
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '9780306406157', beschrijving: '', beschrijving_gezocht: '' }), true);
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '9780306406157', beschrijving: 'Eigen tekst', beschrijving_gezocht: '' }), false);
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '9780306406157', beschrijving: '', beschrijving_gezocht: '2026-10-23' }), false);
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '', beschrijving: '', beschrijving_gezocht: '' }), false);
});

test('afgebroken beschrijvingen: enkel die van het script worden opnieuw gezocht', () => {
  const rijen = [
    { isbn: '9780306406157', beschrijving: 'Een verhaal dat stopt...', beschrijving_en: 'A story that stops...', gb_gecontroleerd: '2026-10-20', beschrijving_vertaald: '2026-10-21' },
    { isbn: '9780306406157', beschrijving: 'Een eigen tekst...', beschrijving_en: '' },
    { isbn: '9780306406157', beschrijving: 'Een volledige tekst.', beschrijving_gezocht: '2026-10-20' }
  ];
  assert.strictEqual(M.maakAfgebrokenLeeg(rijen), 1);
  assert.strictEqual(rijen[0].beschrijving, '');
  assert.strictEqual(rijen[0].beschrijving_vertaald, '');
  assert.strictEqual(rijen[1].beschrijving, 'Een eigen tekst...');
  assert.strictEqual(M.heeftBeschrijvingNodig(rijen[0]), true);
});
test('beschrijvingen vertalen: Nederlands blijft, Engels komt in beschrijving_en', () => {
  const nep = (tekst, taal) => {
    const woordenboek = { 'A made-up novel.': { nl: 'Een verzonnen roman.', en: 'A made-up novel.' }, 'Een verzonnen roman.': { nl: 'Een verzonnen roman.', en: 'A made-up novel.' } };
    return woordenboek[tekst][taal];
  };
  gelijk(M.maakTweetaligeBeschrijving({ beschrijving: 'A made-up novel.', beschrijving_en: '' }, nep), { beschrijving: 'Een verzonnen roman.', beschrijving_en: 'A made-up novel.' });
  gelijk(M.maakTweetaligeBeschrijving({ beschrijving: 'Een verzonnen roman.', beschrijving_en: '' }, nep), { beschrijving_en: 'A made-up novel.' });
  gelijk(M.maakTweetaligeBeschrijving({ beschrijving: 'Een verzonnen roman.', beschrijving_en: 'Eigen Engelse tekst' }, nep), {});
  assert.strictEqual(M.heeftVertalingNodig({ beschrijving: 'x', beschrijving_vertaald: '' }), true);
  assert.strictEqual(M.heeftVertalingNodig({ beschrijving: 'x', beschrijving_vertaald: '2026-10-23' }), false);
  assert.strictEqual(M.schoonMetRegels('  Regel  1 \r\n\n\n\n Regel 2 '), 'Regel 1\n\nRegel 2');
});

test('rooster: deze en volgende maand, vanaf vandaag, ongepubliceerde maand zonder namen', () => {
  gelijk(M.roosterMaanden('2026-12-18'), ['2026-12', '2027-01']);
  const d = M.bouwRoosterOverzicht([
    { ok: true, maand: '2026-10', avonden: [{ datum: '2026-10-16', status: 'open', event: '' }, { datum: '2026-10-30', status: 'open', event: 'Praatcafé' }],
      rooster: [{ datum: '2026-10-30', vrijwilligers: ['Sam', 'Lou'], backups: [], afgemeld: ['Lou'] }] },
    { ok: true, maand: '2026-11', avonden: [{ datum: '2026-11-06', status: 'gesloten', event: '' }], rooster: null }
  ], '2026-10-23');
  gelijk(d.avonden.map((a) => a.datum), ['2026-10-30', '2026-11-06']);
  gelijk(d.avonden[0].vrijwilligers, ['Sam', 'Lou']);
  gelijk(d.avonden[0].afgemeld, ['Lou']);
  assert.strictEqual(d.avonden[0].event, 'Praatcafé');
  assert.strictEqual(d.avonden[1].gepubliceerd, false);
  gelijk(d.nietGepubliceerd, ['2026-11']);
});

test('ordenen: elke instelling staat in precies één groep', () => {
  const inGroep = [];
  M.INSTELLING_GROEPEN.forEach((g) => g[1].forEach((s) => inGroep.push(s)));
  const sleutels = M.STANDAARD_INSTELLINGEN.map((r) => r[0]);
  gelijk(sleutels.filter((s) => !inGroep.includes(s)), []);
  gelijk(inGroep.filter((s, i) => inGroep.indexOf(s) !== i), []);
  gelijk(inGroep.filter((s) => !sleutels.includes(s)), []);
});
test('ordenen: waarden blijven, oude koppen weg, onbekende sleutels naar Overige', () => {
  const r = M.ordenInstellingRijen([
    ['max_verlengingen', 3, 'oude uitleg'],
    ['── OUDE KOP ──', '', ''],
    ['', '', ''],
    ['eigen_notitie', 'iets', 'zelf toegevoegd'],
    ['toegangscode_balie', 'geheim1', '']
  ]);
  const waarde = (s) => r.rijen.find((x) => x[0] === s);
  assert.strictEqual(r.rijen[0][0], '── TOEGANG ──');
  assert.strictEqual(waarde('toegangscode_balie')[1], 'geheim1');
  assert.strictEqual(waarde('max_verlengingen')[1], 3);
  assert.notStrictEqual(waarde('max_verlengingen')[2], 'oude uitleg');
  assert.strictEqual(waarde('uitleentermijn_weken')[1], 4);
  assert.strictEqual(waarde('eigen_notitie')[1], 'iets');
  assert.strictEqual(r.rijen[r.rijen.length - 2][0], '── OVERIGE ──');
  assert.ok(!r.rijen.some((x) => x[0] === '── OUDE KOP ──' || x[0] === ''));
  r.koppen.forEach((i) => assert.ok(M.isInstellingKop(r.rijen[i][0])));
  // Nog eens ordenen verandert niets.
  gelijk(M.ordenInstellingRijen(r.rijen).rijen, r.rijen);
});
test('ordenen: tabbladen per gebruik, onbekende achteraan', () => {
  const v = M.tabbladVolgorde(['Instellingen', 'Oud uitleenblad', 'Catalogus', 'Uitleningen', 'Logboek', 'Stock']);
  gelijk(v.map((t) => t.naam), ['Uitleningen', 'Catalogus', 'Instellingen', 'Logboek', 'Stock', 'Oud uitleenblad']);
  assert.strictEqual(v[v.length - 1].kleur, null);
});

test('Google Books: cover in https, enkel lege velden, eigen cover blijft', () => {
  const info = { imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl' }, language: 'nl', pageCount: 120, publisher: 'Verzonnen BV', publishedDate: '1999-05-01', description: '<b>Een</b> verzonnen boek.' };
  const v = M.verwerkGoogleBooks({ isbn: '9780306406157', cover_url: '', uitgeverij: 'Bestaand', jaartal: '', paginas: '', taal: '', beschrijving: '' }, info);
  assert.strictEqual(v.cover_url, 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1');
  assert.strictEqual(v.uitgeverij, undefined);
  assert.strictEqual(v.jaartal, 1999);
  assert.strictEqual(v.taal, 'Nederlands');
  assert.strictEqual(v.beschrijving, 'Een verzonnen boek.');
  assert.strictEqual(M.heeftGoogleBooksNodig({ isbn: '9780306406157', cover_url: 'https://voorbeeld.test/eigen.jpg' }), false);
  assert.strictEqual(M.heeftGoogleBooksNodig({ isbn: '9780306406157', cover_url: '' }), true);
  assert.strictEqual(M.heeftGoogleBooksNodig({ isbn: '9780306406157', cover_url: '', gb_gecontroleerd: '2026-10-23' }), false);
  assert.strictEqual(M.verwerkGoogleBooks({ cover_url: 'https://voorbeeld.test/eigen.jpg' }, info).cover_url, undefined);
});

console.log('\nZoeken en filteren');

const Z = M.MadrigalZoeken;
const F = M.MadrigalFilters;
const voorbeeldBoeken = [
  { id: 'B1', t: 'The Color of Water', a: 'Baldwin, Jamie', u: 'Penguin', i: '9780306406157', j: 1965, l: 'Engels', g: ['Fictie', 'Klassiekers'], n: 'tweedehands', v: 'Paperback', r: ['Robin'], b: { c: 'beschikbaar' } },
  { id: 'B2', t: 'Een kamer voor Émile', a: 'Zola, Lou', u: 'Fictieve Pers', j: 2021, l: 'Nederlands', g: ['Gender'], n: 'nieuw', v: 'Hardcover', b: { c: 'uitgeleend' } },
  { id: 'B3', t: 'Le désir', a: 'Ardent, Camille', u: 'Maison', j: 1992, l: 'Frans', g: ['Seksualiteit', 'Fictie'], n: 'tweedehands', r: ['Robin', 'Kai'], b: { c: 'beschikbaar' } }
];
const index = Z.maakIndex(voorbeeldBoeken);

test('zoeken negeert hoofdletters, accenten en lidwoorden', () => {
  gelijk(Z.zoek(index, 'emile').map((r) => r.boek.id), ['B2']);
  gelijk(Z.zoek(index, 'DESIR').map((r) => r.boek.id), ['B3']);
  gelijk(Z.zoek(index, 'the color').map((r) => r.boek.id), ['B1']);
});
test('zoeken vergeeft tikfouten', () => {
  gelijk(Z.zoek(index, 'baldwn').map((r) => r.boek.id), ['B1']);
  gelijk(Z.zoek(index, 'kamr').map((r) => r.boek.id), ['B2']);
});
test('zoeken op uitgeverij en op ISBN-10 met streepjes', () => {
  gelijk(Z.zoek(index, 'fictieve pers').map((r) => r.boek.id), ['B2']);
  gelijk(Z.zoek(index, '0-306-40615-2').map((r) => r.boek.id), ['B1']);
});
test('filters: groep, taal, periode, aanrader, beschikbaar', () => {
  gelijk(F.pasToe(voorbeeldBoeken, { groep: 'Fictie' }).map((b) => b.id), ['B1', 'B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { groep: 'Fictie', taal: 'Frans' }).map((b) => b.id), ['B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { periode: 'Voor 1970' }).map((b) => b.id), ['B1']);
  gelijk(F.pasToe(voorbeeldBoeken, { aanrader: 'Aanrader van Kai' }).map((b) => b.id), ['B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { beschikbaar: true }).map((b) => b.id), ['B1', 'B3']);
  gelijk(F.pasToe(voorbeeldBoeken, { staat: 'Nieuw' }).map((b) => b.id), ['B2']);
});
test('opties tellen boeken per keuze', () => {
  const o = F.opties(voorbeeldBoeken, ['Gender', 'Seksualiteit', 'Fictie']);
  gelijk(o.groep.map((x) => x.waarde), ['Gender', 'Seksualiteit', 'Fictie', 'Klassiekers']);
  assert.strictEqual(o.groep.find((x) => x.waarde === 'Fictie').aantal, 2);
});
test('sorteren op titel negeert lidwoord, op jaartal nieuwste eerst', () => {
  gelijk(F.sorteer(voorbeeldBoeken, 'titel').map((b) => b.id), ['B1', 'B3', 'B2']);
  gelijk(F.sorteer(voorbeeldBoeken, 'jaar-nieuw').map((b) => b.id), ['B2', 'B3', 'B1']);
  gelijk(F.sorteer(voorbeeldBoeken, 'auteur').map((b) => b.id), ['B3', 'B1', 'B2']);
});

console.log('\nVervaldatums');

test('vervaldatum: 4 weken later, op een vrijdag', () => {
  const inst = instellingen();
  assert.strictEqual(M.berekenVervaldatum('2026-10-23', inst), '2026-11-20');
  // Uitgeleend op een woensdag: opgeschoven naar de vrijdag erna.
  assert.strictEqual(M.berekenVervaldatum('2026-10-21', inst), '2026-11-20');
});
test('vervaldatum op een gesloten vrijdag schuift naar de volgende open vrijdag', () => {
  const inst = instellingen({ gesloten_data: '20/11/2026, 27/11/2026' });
  assert.strictEqual(M.berekenVervaldatum('2026-10-23', inst), '2026-12-04');
});
test('statusteksten met kleurcode en tekst', () => {
  const inst = instellingen();
  const u = { vervaldatum: '2026-11-20', oorspronkelijke_vervaldatum: '2026-11-20', aantal_verlengingen: 0 };
  let s = M.uitleenStatus(u, '2026-11-02', inst);
  assert.strictEqual(s.code, 'optijd');
  assert.strictEqual(s.tekst, 'Terug tegen vrijdag 20 november (nog 18 dagen)');
  s = M.uitleenStatus(u, '2026-11-15', inst);
  assert.strictEqual(s.code, 'binnenkort');
  assert.strictEqual(s.tekst, 'Vervalt vrijdag 20 november (nog 5 dagen)');
  s = M.uitleenStatus(u, '2026-12-02', inst);
  assert.strictEqual(s.code, 'telaat');
  assert.strictEqual(s.tekst, 'Te laat sinds vrijdag 20 november (12 dagen)');
  s = M.uitleenStatus({ vervaldatum: '2026-12-18', oorspronkelijke_vervaldatum: '2026-11-20', aantal_verlengingen: 1 }, '2026-11-25', inst);
  assert.strictEqual(s.verlengd, true);
  assert.strictEqual(s.verlengdTekst, 'Verlengd: eerst vrijdag 20 november, nu vrijdag 18 december');
});
test('ophaaltermijn: 2 openingsdagen, gesloten vrijdag telt niet', () => {
  const inst = instellingen({ gesloten_data: '06/11/2026' });
  // Klaar op vrijdag 30/10. 6/11 is dicht, dus de 2 openingsdagen zijn 13/11 en 20/11.
  assert.strictEqual(M.berekenOphaalTermijn('2026-10-30', inst), '2026-11-20');
});

console.log('\nUitlenen en grenzen');

test('uitlenen geeft de terugbrengdatum terug', () => {
  const s = maakStaat();
  const r = uitleen(s, 'B0001', '1');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.terugTekst, 'Breng terug tegen vrijdag 20 november');
  assert.strictEqual(s.uitleningen[0].exemplaar, 'B0001-1');
  assert.strictEqual(s.uitleningen[0].borg, 5);
});
test('niet uitleenbaar en al uitgeleend worden geweigerd', () => {
  const s = maakStaat();
  assert.strictEqual(uitleen(s, 'Z0001', '1').ok, false);
  uitleen(s, 'B0001', '1');
  const r = uitleen(s, 'B0001-1', '2');
  assert.strictEqual(r.ok, false);
  assert.ok(/al uitgeleend/.test(r.fout));
});
test('derde boek zonder reden: melding, geen uitlening', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0002-1', '1');
  const r = uitleen(s, 'B0003', '1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'max_boeken');
  assert.strictEqual(r.grenzen[0].melding, 'Deze lener heeft al 2 boeken. Het maximum is 2.');
  assert.strictEqual(s.uitleningen.length, 2);
  assert.strictEqual(s.uitzonderingen.length, 0);
});
test('derde boek met reden: uitlening en uitzondering genoteerd', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0002-1', '1');
  const r = uitleen(s, 'B0003', '1', { uitzondering: { reden: 'Leest voor een thesis' } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.uitleningen.length, 3);
  assert.strictEqual(s.uitzonderingen.length, 1);
  assert.strictEqual(s.uitzonderingen[0].grens, 'Maximum aantal boeken per lener');
  assert.strictEqual(s.uitzonderingen[0].reden, 'Leest voor een thesis');
  assert.strictEqual(s.uitzonderingen[0].wie, 'Testvrijwilliger');
});
test('een te laat boek: status en grens bij uitlenen', () => {
  const s = maakStaat('2026-12-04');
  s.uitleningen.push({ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-10-23', oorspronkelijke_vervaldatum: '2026-11-20', vervaldatum: '2026-11-20', datum_terug: '', aantal_verlengingen: 0 });
  const info = M.uitleningInfo(s, s.uitleningen[0]);
  assert.strictEqual(info.status.code, 'telaat');
  assert.strictEqual(info.status.tekst, 'Te laat sinds vrijdag 20 november (14 dagen)');
  const r = uitleen(s, 'B0003', '1');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'te_laat');
});

console.log('\nVerlengen');

test('verlengen zonder reservatie: 4 weken erbij', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const id = s.uitleningen[0].uitlening_id;
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.vervaldatum, '2026-12-18');
  assert.strictEqual(s.uitleningen[0].aantal_verlengingen, 1);
  assert.strictEqual(s.uitleningen[0].oorspronkelijke_vervaldatum, '2026-11-20');
});
test('tweede verlenging vraagt een uitzondering', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const id = s.uitleningen[0].uitlening_id;
  M.verlengen(s, { uitlening_id: id });
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'max_verlengingen');
  const r2 = M.verlengen(s, { uitlening_id: id, uitzondering: { reden: 'Ziek geweest' } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(s.uitleningen[0].aantal_verlengingen, 2);
});
test('verlengen met een reservatie van iemand anders toont wie wacht', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  s.vandaag = '2026-10-30';
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' }).ok, true);
  const id = s.uitleningen[0].uitlening_id;
  const r = M.verlengen(s, { uitlening_id: id });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.grenzen[0].id, 'verlengen_bij_reservatie');
  assert.ok(r.grenzen[0].melding.indexOf('lener 2 (Jo), sinds vrijdag 30 oktober') > -1);
  const r2 = M.verlengen(s, { uitlening_id: id, uitzondering: { reden: 'Jo gaf akkoord' } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(s.uitzonderingen[0].grens, 'Verlengen terwijl iemand anders wacht');
});

console.log('\nBoek met 2 exemplaren en reservaties');

test('"1 van 2 beschikbaar", dan uitgeleend, dan gereserveerd', () => {
  const s = maakStaat();
  const boek = s.catalogus[1];
  assert.strictEqual(M.beschikbaarheid(s, boek).label, '2 van 2 beschikbaar');
  uitleen(s, 'B0002-1', '1');
  assert.strictEqual(M.beschikbaarheid(s, boek).label, '1 van 2 beschikbaar');
  // Reserveren kan niet zolang er een exemplaar in de kast staat.
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' }).ok, false);
  uitleen(s, 'B0002-2', '2');
  const b = M.beschikbaarheid(s, boek);
  assert.strictEqual(b.code, 'uitgeleend');
  assert.strictEqual(b.label, 'Uitgeleend, verwacht terug op vrijdag 20 november');
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' }).ok, true);
  assert.strictEqual(M.beschikbaarheid(s, boek).code, 'gereserveerd');
});
test('teruggebracht exemplaar gaat naar de wachtrij, met melding om apart te leggen', () => {
  const s = maakStaat();
  uitleen(s, 'B0002-1', '1');
  uitleen(s, 'B0002-2', '2');
  M.reserveren(s, { boek_id: 'B0002', lenersnummer: '3' });
  s.vandaag = '2026-10-30';
  const id = s.uitleningen[1].uitlening_id;
  const r = M.terugbrengen(s, { uitlening_id: id, borg_terugbetaald: true });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.apartLeggen[0].tekst, 'Leg dit boek apart voor lener 3 (Alex)');
  assert.strictEqual(s.uitleningen[1].borg_terugbetaald, '2026-10-30');
  assert.strictEqual(s.reservaties[0].status, 'klaar om op te halen');
  assert.strictEqual(s.reservaties[0].exemplaar, 'B0002-2');
  assert.strictEqual(s.reservaties[0].ophalen_tot, '2026-11-13');
  // Iemand anders wil het apart gelegde exemplaar lenen: grens.
  const ander = uitleen(s, 'B0002-2', '2');
  assert.strictEqual(ander.ok, false);
  assert.strictEqual(ander.grenzen.map((g) => g.id).indexOf('gereserveerd_voor_ander') > -1, true);
  // De juiste lener haalt het af.
  const juist = uitleen(s, 'B0002-2', '3');
  assert.strictEqual(juist.ok, true);
  assert.strictEqual(s.reservaties[0].status, 'afgehaald');
});
test('niet afgehaalde reservatie vervalt en gaat naar de volgende', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' });
  s.vandaag = '2026-10-24';
  M.reserveren(s, { boek_id: 'B0001', lenersnummer: '3' });
  s.vandaag = '2026-10-30';
  M.terugbrengen(s, { uitlening_id: s.uitleningen[0].uitlening_id, borg_terugbetaald: false });
  s.vandaag = '2026-11-14';
  const m = M.verwerkVervallenReservaties(s);
  assert.strictEqual(s.reservaties[0].status, 'vervallen');
  assert.strictEqual(s.reservaties[1].status, 'klaar om op te halen');
  assert.strictEqual(m[0].tekst, 'Leg dit boek apart voor lener 3 (Alex)');
});

console.log('\nLeners en privacy');

test('nieuwe lener: toestemming verplicht, dubbel herkend op telefoon', () => {
  const s = maakStaat();
  assert.strictEqual(M.nieuweLener(s, { voornaam: 'Kim', telefoon: '0470 00 00 09', toestemming: false }).ok, false);
  assert.strictEqual(M.nieuweLener(s, { voornaam: 'Kim', toestemming: true }).ok, false);
  const r = M.nieuweLener(s, { voornaam: 'Kim', telefoon: '0470 00 00 09', toestemming: true });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.lenersnummer, 4);
  const dubbel = M.nieuweLener(s, { voornaam: 'Kim', telefoon: '+32 470 00 00 09', toestemming: true });
  assert.strictEqual(dubbel.ok, false);
});
test('balie ziet geen contactgegevens', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const tekst = JSON.stringify(M.balieGegevens(s));
  assert.ok(tekst.indexOf('sam@voorbeeld.test') === -1);
  assert.ok(tekst.indexOf('0470') === -1);
  assert.ok(tekst.indexOf('Achternaamtest') === -1);
});
test('bestuur ziet te laat met contact en een ingevulde herinnering', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  s.vandaag = '2026-12-01';
  const d = M.bestuurGegevens(s, []);
  assert.strictEqual(d.telaat.length, 1);
  assert.strictEqual(d.telaat[0].email, 'sam@voorbeeld.test');
  assert.ok(d.telaat[0].herinnering.indexOf('Hoi Sam') === 0);
  assert.ok(d.telaat[0].herinnering.indexOf('vrijdag 20 november') > -1);
  assert.strictEqual(d.borgen.ingehouden.totaal, 5);
  assert.strictEqual(d.borgen.ingehouden.perBetaalwijze.cash, 5);
});
test('publieke catalogus toont geen herkomst, geen niet-publieke boeken en geen leners', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const p = M.bouwPubliekeCatalogus(s, [{ genre: 'Roman', filtergroepen: 'Fictie' }]);
  const tekst = JSON.stringify(p);
  assert.ok(tekst.indexOf('Kees Voorbeeld') === -1);
  assert.ok(tekst.indexOf('Het nachtboek') === -1);
  assert.ok(tekst.indexOf('Sam') === -1);
  assert.ok(tekst.indexOf('code') === -1);
  const zine = p.boeken.find((b) => b.id === 'Z0001');
  assert.strictEqual(zine.b.l, 'Te koop in de bib, niet uitleenbaar');
  gelijk(Array.from(zine.g), ['Zines']);
});
test('publieke catalogus: aanraders_verbergen haalt de naam weg bij de boeken', () => {
  const s = maakStaat();
  s.catalogus[0].aanrader = 'Robin en Sam';
  s.catalogus[1].aanrader = 'robin';
  s.inst.aanraders_verbergen = 'Robin';
  const p = M.bouwPubliekeCatalogus(s, []);
  const b0 = p.boeken.find((b) => b.id === String(s.catalogus[0].boek_id));
  const b1 = p.boeken.find((b) => b.id === String(s.catalogus[1].boek_id));
  gelijk(b0.r, ['Sam']);
  assert.strictEqual(b1.r, undefined);
  assert.ok(JSON.stringify(p).toLowerCase().indexOf('robin') === -1);
});
test('publieke catalogus: beschrijving met alinea\'s, Engelse versie enkel als ze verschilt', () => {
  const s = maakStaat();
  s.catalogus[0].beschrijving = 'Een verzonnen roman.\n\nTweede alinea.';
  s.catalogus[0].beschrijving_en = 'A made-up novel.';
  s.catalogus[1].beschrijving = 'Zelfde tekst.';
  s.catalogus[1].beschrijving_en = 'Zelfde tekst.';
  const p = M.bouwPubliekeCatalogus(s, []);
  const b0 = p.boeken.find((b) => b.id === String(s.catalogus[0].boek_id));
  const b1 = p.boeken.find((b) => b.id === String(s.catalogus[1].boek_id));
  assert.strictEqual(b0.d, 'Een verzonnen roman.\n\nTweede alinea.');
  assert.strictEqual(b0.de, 'A made-up novel.');
  assert.strictEqual(b1.de, undefined);
});
test('privacy-opruiming na de bewaartermijn', () => {
  const s = maakStaat('2027-12-01');
  s.leners[2].actief = 'nee';
  s.uitleningen.push({ uitlening_id: 'U1', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '3', datum_uit: '2026-10-01', vervaldatum: '2026-10-29', datum_terug: '2026-10-29' });
  s.uitleningen.push({ uitlening_id: 'U2', exemplaar: 'B0003-1', boek_id: 'B0003', lenersnummer: '1', datum_uit: '2027-11-01', vervaldatum: '2027-11-26', datum_terug: '' });
  const t = M.ruimOpStaat(s);
  assert.strictEqual(s.uitleningen[0].lenersnummer, '');
  assert.strictEqual(s.uitleningen[1].lenersnummer, '1');
  assert.strictEqual(t.leners, 1);
  assert.strictEqual(s.leners[2]._verwijderen, true);
  assert.ok(!s.leners[0]._verwijderen);
});

console.log('\nOverzetten uit het oude uitleenblad');

test('lopende uitleningen overnemen: één lener per persoon, twijfel apart', () => {
  const s = maakStaat();
  s.leners = [];
  const waarden = [
    ['Boek', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR)', 'Gift', 'reminder mail', 'boek terug op...'],
    ['De verzonnen zee', 'Mira Verbeek', 'Robin', 'Testpersoon', '0470/00.00.07', '', '02/10/2026', '30/10/2026', '5 QR', '2', '28/10/2026', ''],
    ['Stille lichten', 'Noor Aerts', 'Robin', 'Testpersoon', '+32 470 00 00 07', '', '02/10/2026', '30/10/2026', 'cash', '', '', ''],
    ['Twee kasten vol', 'Rein Dewit', 'Lou', '', '', 'lou@voorbeeld.test', '01/09/2026', '29/09/2026', '5 cash', '', '', '29/09/2026'],
    ['Een boek dat niet bestaat', 'Niemand', 'Lou', '', '', 'lou@voorbeeld.test', '01/10/2026', '', '', '', '', '']
  ];
  const r = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  assert.strictEqual(r.uitleningen, 2);
  assert.strictEqual(r.leners, 2);
  assert.strictEqual(r.naTeKijken.length, 1);
  assert.strictEqual(s.uitleningen[0].borg, 5);
  assert.strictEqual(s.uitleningen[0].betaalwijze_borg, 'QR');
  assert.strictEqual(s.uitleningen[0].laatste_herinnering, '2026-10-28');
  assert.strictEqual(s.uitleningen[0].vervaldatum, '2026-10-30');
  assert.strictEqual(s.uitleningen[1].borg, 5);
  assert.strictEqual(s.uitleningen[0].lenersnummer, s.uitleningen[1].lenersnummer);
  // Opnieuw uitvoeren maakt niets dubbel.
  const r2 = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  assert.strictEqual(r2.uitleningen, 0);
  assert.strictEqual(r2.leners, 0);
});

console.log('\nWebsite');

test('startpagina: enkel publieke rijen, nieuwste nieuws, komend en vorig event, vragen op volgorde', () => {
  const s = maakStaat('2026-10-23');
  s.catalogus[0].aanrader = 'Robin';
  s.catalogus[3].aanrader = 'Kai'; // niet publiek
  const d = M.bouwSiteInhoud(s, {
    nieuws: [
      { datum: '2026-09-01', titel: 'Oud bericht', tekst: 'a' },
      { datum: '2026-10-01', titel: 'Nieuw bericht', titel_en: 'New post', tekst: 'Regel 1\nRegel 2' },
      { datum: '2026-10-10', titel: 'Verborgen', tekst: 'x', publiek: 'nee' }
    ],
    agenda: [
      { datum: '2026-10-02', titel: 'Voorbij' }, { datum: '2026-11-06', uur: '19:00', titel: 'Leesclub' }, { datum: '2026-12-04', titel: 'Later' }
    ],
    faq: [{ volgorde: 2, vraag: 'Tweede?', antwoord: 'b' }, { volgorde: 1, vraag: 'Eerste?', antwoord: 'a', antwoord_en: 'A' }]
  });
  gelijk(d.nieuws.map((n) => n.titel.nl), ['Nieuw bericht', 'Oud bericht']);
  assert.strictEqual(d.nieuws[0].titel.en, 'New post');
  assert.strictEqual(d.nieuws[1].titel.en, 'Oud bericht');
  assert.strictEqual(d.nieuws[0].tekst.nl, 'Regel 1\nRegel 2');
  gelijk(d.agenda.komend.map((e) => e.titel.nl), ['Leesclub', 'Later']);
  assert.strictEqual(d.agenda.vorig.titel.nl, 'Voorbij');
  gelijk(d.faq.map((f) => f.vraag.nl), ['Eerste?', 'Tweede?']);
  gelijk(d.aanraders.map((a) => a.id), ['B0001']);
  assert.ok(JSON.stringify(d).indexOf('Kees Voorbeeld') === -1);
});
test('startpagina: aanraders_verbergen haalt namen weg, het boek blijft als iemand anders het aanraadt', () => {
  const s = maakStaat('2026-10-23');
  s.catalogus[0].aanrader = 'Robin';
  s.catalogus[1].aanrader = 'robin en Sam';
  s.inst.aanraders_verbergen = 'Robin';
  const d = M.bouwSiteInhoud(s, {});
  gelijk(d.aanraders.map((a) => a.id), [String(s.catalogus[1].boek_id)]);
  gelijk(d.aanraders[0].r, ['Sam']);
});
test('startpagina: nieuw binnen is een aparte lijst, de kolom startpagina beslist het laatst', () => {
  const s = maakStaat('2026-10-23');
  s.catalogus.forEach((b) => { b.aanrader = ''; b.toegevoegd_op = ''; b.startpagina = ''; });
  s.catalogus[0].toegevoegd_op = '2026-10-01';               // nieuw binnen
  s.catalogus[1].toegevoegd_op = '2026-01-01';               // te lang geleden
  s.catalogus[2].toegevoegd_op = '2026-10-10';
  s.catalogus[2].startpagina = 'nee';                        // nieuw, maar met de hand weggehaald
  s.catalogus[4].startpagina = 'ja';                         // met de hand toegevoegd
  const ids = (lijst) => lijst.map((a) => a.id);
  let d = M.bouwSiteInhoud(s, {});
  gelijk(ids(d.aanraders), [String(s.catalogus[4].boek_id)]);
  // Eerst het nieuwe boek, daarna aangevuld: eerst wie een (oudere) datum heeft, dan het hoogste boek-ID.
  // B0003 staat op nee, B0004 is niet publiek.
  gelijk(ids(d.nieuw), ['B0001', 'B0002', 'Z0001']);
  assert.strictEqual(d.nieuw[0].n, 1);
  assert.strictEqual(d.nieuw[1].n, 0);
  s.inst.nieuw_op_startpagina_dagen = 0;
  d = M.bouwSiteInhoud(s, {});
  gelijk(ids(d.nieuw), []);
  s.catalogus[4].aanrader = 'Robin';
  s.catalogus[4].startpagina = 'nee';
  d = M.bouwSiteInhoud(s, {});
  gelijk(ids(d.aanraders), []);
});
test('nieuw binnen: nieuwste eerst, hoogstens het ingestelde aantal, nooit verdrongen door aanraders', () => {
  const s = maakStaat('2026-10-23');
  s.inst.nieuw_op_startpagina_aantal = 2;
  for (let i = 0; i < 20; i++) s.catalogus.push({ boek_id: 'B' + (100 + i), titel: 'Aanrader ' + i, aantal: 1, uitleenbaar: 'ja', publiek: 'ja', aanrader: 'Johanna' });
  s.catalogus[0].toegevoegd_op = '2026-10-01';
  s.catalogus[1].toegevoegd_op = '2026-10-20';
  s.catalogus[2].toegevoegd_op = '2026-10-10';
  const d = M.bouwSiteInhoud(s, {});
  assert.strictEqual(d.aanraders.length, 12);
  gelijk(d.nieuw.map((b) => b.id), ['B0002', 'B0003']);
  assert.strictEqual(M.verwerkInstellingen({}).nieuw_op_startpagina_aantal, 8);
});
test('oude website: html wordt tekst, ids voorkomen dubbels', () => {
  assert.strictEqual(M.htmlNaarTekst('<p>Hallo <b>daar</b></p><p>Tot&nbsp;vrijdag</p>'), 'Hallo daar\nTot vrijdag');
  const faq = M.zetOudeFaqOm([{ id: 1, order: 1, question: 'Kan ik lenen?', answer: '<p>Ja!</p>' }]);
  assert.strictEqual(faq[0].antwoord, 'Ja!');
  const rijen = [];
  assert.strictEqual(M.voegOudeRijenToe(rijen, faq), 1);
  assert.strictEqual(M.voegOudeRijenToe(rijen, faq), 0);
  const ev = M.zetOudeEventsOm([{ id: 7, eventDate: '2026-11-06T18:30:00.000Z', title: 'Leesclub', location: 'Peperfabriek' }]);
  assert.strictEqual(ev[0].datum, '2026-11-06');
  assert.strictEqual(ev[0].locatie, 'Peperfabriek');
  assert.strictEqual(M.oudeAfbeelding('about/x.png', 'https://voorbeeld.supabase.co'), 'https://voorbeeld.supabase.co/storage/v1/object/public/about/x.png');
});

console.log('\nCellen');

test('formules en telefoonnummers blijven tekst', () => {
  assert.strictEqual(M.veiligeCel('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
  assert.strictEqual(M.veiligeCel('0470000001'), "'0470000001");
  assert.strictEqual(M.veiligeCel('Sam'), 'Sam');
});

console.log('\nEén bestand voor Apps Script');

test('madrigal-script.gs is bijgewerkt (anders: node tools/bundel.js)', () => {
  const fs = require('fs');
  const { maakBundel, UIT } = require('../tools/bundel');
  assert.strictEqual(fs.readFileSync(UIT, 'utf8'), maakBundel());
});
test('madrigal-script.gs bevat elke functie precies één keer, alfabetisch', () => {
  const fs = require('fs');
  const path = require('path');
  const { knip, MAP, UIT } = require('../tools/bundel');
  let namen = [];
  fs.readdirSync(MAP).filter((f) => f.endsWith('.js')).forEach((f) => {
    namen = namen.concat(knip(fs.readFileSync(path.join(MAP, f), 'utf8'), f).filter((x) => x.soort === 'function').map((x) => x.naam));
  });
  const inBundel = (fs.readFileSync(UIT, 'utf8').match(/^function ([A-Za-z0-9_$]+)/gm) || []).map((r) => r.slice(9));
  gelijk(inBundel.slice().sort(), namen.slice().sort());
  gelijk(inBundel, inBundel.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
  // Geen code buiten functies en vaste waarden die verloren kan gaan.
  const alleCode = fs.readdirSync(MAP).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(MAP, f), 'utf8')).join('\n');
  const losseRegels = alleCode.split('\n').filter((r) => /^[A-Za-z]/.test(r) && !/^(function|var) /.test(r));
  gelijk(losseRegels, []);
});
test('madrigal-script.gs werkt op zichzelf', () => {
  const fs = require('fs');
  const vm = require('vm');
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(require('../tools/bundel').UIT, 'utf8'), ctx);
  assert.strictEqual(typeof ctx.onOpen, 'function');
  assert.strictEqual(typeof ctx.doGet, 'function');
  assert.strictEqual(ctx.normaliseerIsbn('0-306-40615-2').isbn, '9780306406157');
});

console.log('\nBoekstatus');
test('status lezen: verloren, gevoelig verborgen, gevoelig zichtbaar, tikfouten mogen', () => {
  gelijk(['', 'Verloren', 'kwijt', 'Gevoelig verborgen', 'gevoelig', 'Gevoelig zichtbaar', 'gevoelig, met waarschuwing', 'gevoelig onzichtbaar', 'iets anders']
    .map((st) => M.boekStatus({ status: st })),
  ['', 'verloren', 'verloren', 'gevoelig_verborgen', 'gevoelig_verborgen', 'gevoelig_zichtbaar', 'gevoelig_zichtbaar', 'gevoelig_verborgen', '']);
});
test('website: verloren en gevoelig verborgen weg, gevoelig zichtbaar met label', () => {
  const s = maakStaat();
  s.catalogus[0].status = 'verloren';
  s.catalogus[1].status = 'gevoelig verborgen';
  s.catalogus[2].status = 'gevoelig zichtbaar';
  const p = M.bouwPubliekeCatalogus(s, []);
  const ids = p.boeken.map((b) => b.id);
  assert.ok(ids.indexOf('B0001') === -1 && ids.indexOf('B0002') === -1);
  const b3 = p.boeken.filter((b) => b.id === 'B0003')[0];
  assert.strictEqual(b3.w, 1);
  assert.ok(!('status' in b3));
});
test('verloren: niet uitleenbaar, niet reserveerbaar, met duidelijke melding', () => {
  const s = maakStaat();
  s.catalogus[0].status = 'verloren';
  const r = uitleen(s, 'B0001-1', '1');
  assert.strictEqual(r.ok, false);
  assert.ok(/verloren/.test(r.fout));
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' }).ok, false);
});
test('gevoelig verborgen: wel uitleenbaar, balie krijgt een melding', () => {
  const s = maakStaat();
  s.catalogus[0].status = 'gevoelig verborgen';
  assert.strictEqual(uitleen(s, 'B0001-1', '1').ok, true);
  const b = M.baliecatalogus(s).filter((x) => x.id === 'B0001')[0];
  assert.strictEqual(b.st, 'gevoelig');
  assert.strictEqual(b.u, true);
  s.catalogus[1].status = 'verloren';
  const v = M.baliecatalogus(s).filter((x) => x.id === 'B0002')[0];
  gelijk([v.st, v.u], ['verloren', false]);
});
test('startpagina: gevoelig zichtbaar enkel met startpagina = ja', () => {
  const s = maakStaat();
  s.catalogus[0].aanrader = 'Ari';
  s.catalogus[0].status = 'gevoelig zichtbaar';
  let d = M.bouwSiteInhoud(s, {});
  assert.ok(!d.aanraders.some((b) => b.id === 'B0001'));
  s.catalogus[0].startpagina = 'ja';
  d = M.bouwSiteInhoud(s, {});
  const b = d.aanraders.filter((x) => x.id === 'B0001')[0];
  assert.strictEqual(b.w, 1);
  assert.ok(!('gevoelig' in b));
});
test('bestuur: overzicht per status', () => {
  const s = maakStaat();
  s.catalogus[0].status = 'verloren';
  s.catalogus[2].status = 'gevoelig zichtbaar';
  const d = M.bestuurGegevens(s, []);
  gelijk(d.boekstatus.verloren.map((b) => b.boek_id), ['B0001']);
  gelijk(d.boekstatus.gevoelig_verborgen, []);
  gelijk(d.boekstatus.gevoelig_zichtbaar.map((b) => b.boek_id), ['B0003']);
});

console.log('\nBeheer via de website');
function idTeller() { let n = 100; return (soort) => (soort === 'zine' ? 'Z' : 'B') + String(++n).padStart(4, '0'); }
test('boek aanpassen: enkel toegelaten velden, netjes gemaakt', () => {
  const s = maakStaat();
  const r = M.boekAanpassen(s, { boek_id: 'B0002', velden: { titel: ' Twee kasten vol ', status: 'Gevoelig zichtbaar', startpagina: 'Ja', jaartal: '2011', herkomst: 'mag niet', cover_url: 'https://voorbeeld.test/c.jpg' } });
  assert.strictEqual(r.ok, true);
  const b = s.catalogus[1];
  gelijk([b.titel, b.status, b.startpagina, b.jaartal, b.cover_url], ['Twee kasten vol', 'gevoelig zichtbaar', 'ja', 2011, 'https://voorbeeld.test/c.jpg']);
  assert.ok(!b.herkomst);
  assert.strictEqual(s.catalogusGewijzigd, true);
});
test('boek aanpassen: foute invoer geweigerd', () => {
  const s = maakStaat();
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B0002', velden: { titel: '' } }).ok, false);
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B0002', velden: { status: 'zoek' } }).ok, false);
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B0002', velden: { cover_url: 'javascript:alert(1)' } }).ok, false);
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B9999', velden: {} }).ok, false);
});
test('boek aanpassen: aantal niet lager dan een uitgeleend exemplaar', () => {
  const s = maakStaat();
  assert.strictEqual(uitleen(s, 'B0002-2', '1').ok, true);
  const r = M.boekAanpassen(s, { boek_id: 'B0002', velden: { aantal: '1' } });
  assert.strictEqual(r.ok, false);
  assert.ok(/B0002-2/.test(r.fout));
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B0002', velden: { aantal: '3' } }).ok, true);
});
test('nieuwe beschrijving: vertaling wordt opnieuw gemaakt', () => {
  const s = maakStaat();
  s.catalogus[0].beschrijving = 'Oud.'; s.catalogus[0].beschrijving_vertaald = '2026-01-01';
  M.boekAanpassen(s, { boek_id: 'B0001', velden: { beschrijving: 'Een nieuwe tekst.' } });
  assert.strictEqual(s.catalogus[0].beschrijving_vertaald, '');
});
test('boek toevoegen: nieuwe ID, standaardwaarden, dubbel ISBN gemeld', () => {
  const s = maakStaat();
  const nieuw = idTeller();
  const r = M.boekToevoegen(s, { velden: { titel: 'Een verzonnen boek', auteur: 'Voorbeeld, Kim', isbn: '978-0-306-40615-7' } }, nieuw);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.dubbel, 'B0001');
  const t = M.boekToevoegen(s, { velden: { titel: 'Een verzonnen boek', auteur: 'Voorbeeld, Kim', genre: 'Roman' } }, nieuw);
  assert.strictEqual(t.ok, true);
  const b = s.catalogus[s.catalogus.length - 1];
  gelijk([b.boek_id, b.soort, b.aantal, b.uitleenbaar, b.publiek, b.toegevoegd_op, b._nieuw], ['B0101', 'boek', 1, 'ja', 'ja', '2026-10-23', true]);
  assert.strictEqual(M.boekToevoegen(s, { velden: { auteur: 'Zonder titel' } }, nieuw).ok, false);
  assert.strictEqual(M.boekToevoegen(s, { velden: { titel: 'Toch', isbn: '9780306406157' }, toch: true }, nieuw).ok, true);
});
test('ISBN-voorstel uit Open Library en Google Books', () => {
  const v = M.isbnVoorstel(
    { title: 'Verzonnen titel', subtitle: 'een test', authors: [{ name: 'Mira Verbeek' }], publishers: ['Huis van Papier'], publish_date: 'May 2010', covers: [42] },
    { title: 'Andere titel', authors: ['Iemand Anders'], pageCount: 114, language: 'nl', description: 'Een korte <b>beschrijving</b>.' });
  gelijk([v.titel, v.auteur, v.uitgeverij, v.jaartal, v.paginas, v.taal, v.cover_url],
    ['Verzonnen titel: een test', 'Verbeek, Mira', 'Huis van Papier', 2010, 114, 'Nederlands', 'https://covers.openlibrary.org/b/id/42-M.jpg']);
  assert.ok(/beschrijving/.test(v.beschrijving));
  gelijk(M.isbnVoorstel(null, { title: 'Enkel Google', authors: ['Sam Test'] }).auteur, 'Test, Sam');
});
test('nieuws: toevoegen, aanpassen met vingerafdruk, verwijderen', () => {
  const rijen = [{ _rij: 2, datum: '2026-10-01', titel: 'Oud bericht', tekst: 'Tekst', publiek: 'ja' }];
  const lijst = M.inhoudRijen('Nieuws', rijen);
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', velden: { titel: 'Nieuw bericht', datum: '20/10/2026' } }).ok, true);
  gelijk([rijen[1].titel, rijen[1].datum, rijen[1].publiek], ['Nieuw bericht', '2026-10-20', 'ja']);
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: lijst[0].vingerafdruk, velden: { titel: 'Aangepast', publiek: 'nee' } }).ok, true);
  gelijk([rijen[0].titel, rijen[0].publiek], ['Aangepast', 'nee']);
  // De oude vingerafdruk klopt niet meer: geweigerd.
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: lijst[0].vingerafdruk, velden: { titel: 'Nog eens' } }).ok, false);
  const vers = M.inhoudRijen('Nieuws', rijen)[0];
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: vers.vingerafdruk, verwijderen: true }).ok, true);
  assert.strictEqual(rijen[0]._verwijderen, true);
});
test('agenda en vragen: verplichte velden, onbekend tabblad geweigerd', () => {
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Agenda', velden: { titel: 'Leesavond' } }).ok, false);
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Agenda', velden: { titel: 'Leesavond', datum: '2026-11-20' } }).ok, true);
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Veelgestelde vragen', velden: { antwoord: 'Zonder vraag' } }).ok, false);
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Leners', velden: { titel: 'x' } }).ok, false);
});
test('instellingen: per groep, codes nooit zichtbaar of aanpasbaar', () => {
  const rijen = [
    { _rij: 2, sleutel: '── TOEGANG ──', waarde: '', uitleg: '' },
    { _rij: 3, sleutel: 'toegangscode_balie', waarde: 'geheim1', uitleg: '' },
    { _rij: 4, sleutel: 'code_bestuur', waarde: 'geheim2', uitleg: '' },
    { _rij: 5, sleutel: 'openingsuren', waarde: 'vrijdag 19-22', uitleg: 'Uren' },
    { _rij: 6, sleutel: 'eigen_sleutel', waarde: 'x', uitleg: '' }
  ];
  const groepen = M.instellingenVoorBeheer(rijen);
  const tekst = JSON.stringify(groepen);
  assert.ok(tekst.indexOf('geheim') === -1 && tekst.indexOf('code_bestuur') === -1);
  gelijk(groepen.map((g) => g.titel), ['Website: contact', 'Overige']);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: 'code_bestuur', waarde: 'x' }).ok, false);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: '── TOEGANG ──', waarde: 'x' }).ok, false);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: 'openingsuren', waarde: 'vrijdag 18-22' }).ok, true);
  assert.strictEqual(rijen[3].waarde, 'vrijdag 18-22');
});
test('elke beheeractie vraagt de code van het bestuur', () => {
  Object.keys(M.ACTIES).filter((a) => /^beheer/.test(a)).forEach((a) => assert.strictEqual(M.ACTIES[a], 'bestuur', a));
});

test('nieuw binnen: nooit leeg, ook zonder datums (na de eerste opbouw)', () => {
  const s = maakStaat('2026-10-23');
  s.catalogus.forEach((b) => { b.toegevoegd_op = ''; });
  s.inst.nieuw_op_startpagina_aantal = 2;
  const d = M.bouwSiteInhoud(s, {});
  gelijk(d.nieuw.map((b) => b.id), ['B0003', 'B0002']); // hoogste boek-ID eerst, zine Z0001 telt als 1
});
test('aanraders wisselen per week, niet per dag', () => {
  assert.strictEqual(M.weekBegin('2026-10-23'), '2026-10-19'); // vrijdag -> maandag
  assert.strictEqual(M.weekBegin('2026-10-19'), '2026-10-19');
  assert.strictEqual(M.weekBegin('2026-10-25'), '2026-10-19'); // zondag hoort bij dezelfde week
  const s = maakStaat('2026-10-19');
  for (let i = 0; i < 30; i++) s.catalogus.push({ boek_id: 'B' + (200 + i), titel: 'A' + i, aantal: 1, uitleenbaar: 'ja', publiek: 'ja', aanrader: 'Johanna' });
  const keuze = (dag) => { s.vandaag = dag; return M.bouwSiteInhoud(s, {}).aanraders.map((b) => b.id).join(); };
  assert.strictEqual(keuze('2026-10-19'), keuze('2026-10-25'));
  assert.notStrictEqual(keuze('2026-10-19'), keuze('2026-10-26'));
});

console.log('\nAgenda, sorteren en Doe mee');
test('agenda: uren lezen uit vrije tekst', () => {
  gelijk(M.MadrigalAgenda.uren('19:00 - 21:30'), [[19, 0], [21, 30]]);
  gelijk(M.MadrigalAgenda.uren('vanaf 19u'), [[19, 0]]);
  gelijk(M.MadrigalAgenda.uren('19.30'), [[19, 30]]);
  gelijk(M.MadrigalAgenda.uren(''), []);
});
test('agenda: .ics met uur, zonder einduur twee uur lang, zonder uur de hele dag', () => {
  const ics = M.MadrigalAgenda.maakIcs({ datum: '2026-11-20', uur: '19:00', titel: 'Leesavond, met thee', locatie: 'Verzonnen zaal', tekst: 'Breng een boek mee.' }, '2026-10-24T10:00:00.000Z');
  assert.ok(ics.includes('DTSTART;TZID=Europe/Brussels:20261120T190000'));
  assert.ok(ics.includes('DTEND;TZID=Europe/Brussels:20261120T210000'));
  assert.ok(ics.includes('SUMMARY:Leesavond\\, met thee'));
  assert.ok(ics.includes('DTSTAMP:20261024T100000Z'));
  const dag = M.MadrigalAgenda.maakIcs({ datum: '2026-12-31', titel: 'Oudejaar' }, '2026-10-24T10:00:00.000Z');
  assert.ok(dag.includes('DTSTART;VALUE=DATE:20261231') && dag.includes('DTEND;VALUE=DATE:20270101'));
});
test('catalogus: sorteren op laatst toegevoegd, anders hoogste boek-ID', () => {
  const lijst = [{ id: 'B0002', t: 'b' }, { id: 'B0010', t: 'c' }, { id: 'B0001', t: 'a', ta: '2026-10-20' }];
  gelijk(M.MadrigalFilters.sorteer(lijst, 'toegevoegd').map((b) => b.id), ['B0001', 'B0010', 'B0002']);
});
test('publieke catalogus geeft de datum van toevoegen mee', () => {
  const s = maakStaat();
  s.catalogus[0].toegevoegd_op = '2026-10-01';
  const p = M.bouwPubliekeCatalogus(s, []);
  assert.strictEqual(p.boeken.find((b) => b.id === 'B0001').ta, '2026-10-01');
  assert.ok(!('ta' in p.boeken.find((b) => b.id === 'B0002')));
});
test('Doe mee: teksten in beide talen, leeg Engels wordt Nederlands', () => {
  const s = maakStaat('2026-10-23', { tekst_vrijwilliger: 'Kom helpen aan de balie.', tekst_schenken_en: '' });
  const d = M.bouwSiteInhoud(s, {});
  gelijk(d.doeMee.vrijwilliger, { nl: 'Kom helpen aan de balie.', en: 'Kom helpen aan de balie.' });
  gelijk(d.doeMee.steunen, { nl: '', en: '' });
});

console.log('\nBeschrijvingen: wachten op Google');
test('beschrijving: boek met OL-merkteken wacht nog op Google', () => {
  assert.strictEqual(M.wachtOpGoogle({ beschrijving_gezocht: 'OL 20261024' }), true);
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '9780306406157', beschrijving_gezocht: 'OL 20261024' }), true);
  assert.strictEqual(M.heeftBeschrijvingNodig({ isbn: '9780306406157', beschrijving_gezocht: '2026-10-24' }), false);
  assert.strictEqual(M.parseerDatum('OL 20261024'), ''); // het merkteken blijft tekst, wordt geen datum
});

test('Google-fouten: daglimiet apart van een probleem met de sleutel of de API', () => {
  const nietAan = { error: { code: 403, message: 'Books API has not been used in project 123 before or it is disabled.', errors: [{ reason: 'accessNotConfigured' }] } };
  assert.ok(/has not been used.*\(accessNotConfigured\)/.test(M.googleFout(nietAan)));
  assert.strictEqual(M.isGoogleLimiet(403, M.googleFout(nietAan)), false);
  assert.strictEqual(M.isGoogleLimiet(403, 'Daily Limit Exceeded (dailyLimitExceeded)'), true);
  assert.strictEqual(M.isGoogleLimiet(429, ''), true);
  assert.strictEqual(M.isGoogleLimiet(400, 'API key not valid. Please pass a valid API key. (badRequest)'), false);
});

test('Google Books: altijd met het land erbij, anders weigert Google vanuit Apps Script', () => {
  assert.strictEqual(M.googleBooksUrl('9780306406157', ''), 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780306406157&country=BE');
  assert.strictEqual(M.googleBooksUrl('9780306406157', '', 'US'), 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780306406157&country=US');
  assert.strictEqual(M.googleBooksUrl('9780306406157', '', ''), 'https://www.googleapis.com/books/v1/volumes?q=isbn:9780306406157');
  assert.ok(M.googleBooksUrl('9780306406157', 'abc').endsWith('&country=BE&key=abc'));
  assert.strictEqual(M.isGoogleLimiet(403, 'Cannot determine user location for geographically restricted operation. (unknownLocation)'), false);
});

console.log('\nCovers: andere uitgaven en via de browser');
test('andere uitgave: enkel bij goede titel en achternaam', () => {
  const boek = { titel: 'Stille lichten: gedichten', auteur: 'Aerts, Noor' };
  gelijk(M.kiesOlWerk(boek, [
    { title: 'Stille lichten', author_name: ['Iemand Anders'], cover_i: 1 },
    { title: 'Heel iets anders', author_name: ['Noor Aerts'], cover_i: 2 },
    { title: 'Stille Lichten', author_name: ['Noor Aerts'] },
    { title: 'Stille lichten', author_name: ['Noor Aerts'], cover_i: 4 }
  ]), 4);
  assert.strictEqual(M.kiesOlWerk(boek, []), 0);
  assert.strictEqual(M.olCoverUrl(4), 'https://covers.openlibrary.org/b/id/4-M.jpg');
});
test('andere uitgave: enkel boeken zonder cover die nog niet gezocht zijn', () => {
  assert.strictEqual(M.heeftAndereUitgaveNodig({ isbn: '9780306406157', titel: 'X' }), true);
  assert.strictEqual(M.heeftAndereUitgaveNodig({ isbn: '', titel: 'Zine zonder ISBN' }), true);
  assert.strictEqual(M.heeftAndereUitgaveNodig({ isbn: '9780306406157', titel: 'X', cover_url: 'https://x.test/c.jpg' }), false);
  assert.strictEqual(M.heeftAndereUitgaveNodig({ isbn: '9780306406157', titel: 'X', cover_gezocht: '2026-10-24' }), false);
});
test('covers via de browser: lijst, enkel covers van Google, enkel lege velden', () => {
  const s = maakStaat('2026-10-24', { google_books_api_key: 'sleutel-test' });
  s.catalogus[1].isbn = '9780141439518';
  s.catalogus[2].isbn = '9789044641035'; s.catalogus[2].uitgeverij = 'Eigen uitgeverij';
  const lijst = M.coversTeZoeken(s);
  gelijk([lijst.boeken.filter((b) => b.g).map((b) => b.id), lijst.sleutel], [['B0001', 'B0002', 'B0003'], 'sleutel-test']);
  gelijk(lijst.boeken.filter((b) => !b.isbn).map((b) => b.id), ['B0004', 'Z0001']); // zonder ISBN: enkel Open Library op titel
  const r = M.coversBewaren(s, {
    gezocht: ['B0002', 'B0003', 'B0001'],
    resultaten: [
      { boek_id: 'B0002', cover: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl', uitgeverij: 'Penguin', beschrijving: 'Een klassieker.' },
      { boek_id: 'B0003', cover: 'https://evil.test/x.jpg', uitgeverij: 'Andere' }
    ]
  });
  assert.strictEqual(r.covers, 1);
  assert.ok(s.catalogus[1].cover_url.startsWith('https://books.google.com/') && !s.catalogus[1].cover_url.includes('edge=curl'));
  gelijk([s.catalogus[1].cover_bron, s.catalogus[1].uitgeverij], ['Google Books', 'Penguin']);
  gelijk([s.catalogus[2].cover_url || '', s.catalogus[2].uitgeverij], ['', 'Eigen uitgeverij']); // vreemde link geweigerd, eigen waarde blijft
  gelijk(['B0001', 'B0002', 'B0003'].map((id) => s.catalogus.find((b) => b.boek_id === id).gb_gecontroleerd), ['2026-10-24', '2026-10-24', '2026-10-24']);
  assert.strictEqual(M.coversTeZoeken(s).boeken.filter((b) => b.g).length, 0);
});
test('covers via de browser: Open Library-covers met bron, enkel in het vaste formaat', () => {
  const s = maakStaat('2026-10-24');
  const r = M.coversBewaren(s, { items: [
    { boek_id: 'B0001', google: true, ol: true, bron: 'ol-isbn', cover: 'https://covers.openlibrary.org/b/id/123-M.jpg' },
    { boek_id: 'B0002', ol: true, bron: 'ol-titel', cover: 'https://covers.openlibrary.org/b/id/456-M.jpg' },
    { boek_id: 'B0003', ol: true, bron: 'ol-titel', cover: 'https://evil.test/x.jpg' },
    { boek_id: 'B0004', ol: true }
  ] });
  assert.strictEqual(r.covers, 2);
  gelijk([s.catalogus[0].cover_bron, s.catalogus[0].gb_gecontroleerd, s.catalogus[0].cover_gezocht], ['andere uitgave (Open Library)', '2026-10-24', '2026-10-24']);
  gelijk([s.catalogus[1].cover_bron, s.catalogus[1].gb_gecontroleerd || ''], ['titel en auteur (Open Library)', '']);
  gelijk([s.catalogus[2].cover_url || '', s.catalogus[3].cover_gezocht], ['', '2026-10-24']);
});

test('Google: tweede zoekvorm neemt enkel een uitgave met precies dit ISBN', () => {
  assert.strictEqual(M.isbn13Naar10('9780141439518'), '0141439513');
  assert.strictEqual(M.isbn13Naar10('9790000000001'), '');
  const items = [
    { volumeInfo: { title: 'Andere uitgave', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141199078' }] } },
    { volumeInfo: { title: 'Juiste uitgave', industryIdentifiers: [{ type: 'ISBN_10', identifier: '0141439513' }] } }
  ];
  gelijk(M.googleItemsMetIsbn(items, '9780141439518').map((i) => i.volumeInfo.title), ['Juiste uitgave']);
  assert.ok(M.googleBooksUrl('9780141439518', 'k', 'BE', 'vrij').includes('?q=9780141439518&country=BE&key=k'));
});

console.log('\nBack-up');
test('back-up: naam met de datum', () => {
  assert.strictEqual(M.backupNaam('2026-10-24'), 'Madrigal back-up 2026-10-24');
});
test('back-up: enkel de oudste back-ups weg, andere bestanden blijven', () => {
  const b = [
    { id: 'a', naam: 'Madrigal back-up 2026-10-05', datum: 5 },
    { id: 'b', naam: 'Madrigal back-up 2026-10-12', datum: 12 },
    { id: 'c', naam: 'Madrigal back-up 2026-10-19', datum: 19 },
    { id: 'x', naam: 'Iets anders', datum: 1 },
    { id: 'd', naam: 'Madrigal back-up 2026-10-26', datum: 26 }
  ];
  gelijk(M.teVerwijderenBackups(b, 2), ['b', 'a']);
  gelijk(M.teVerwijderenBackups(b, 8), []);
  gelijk(M.teVerwijderenBackups(b, 0), ['c', 'b', 'a']); // minstens één blijft altijd
});
test('back-up: standaard 8 back-ups bewaren', () => {
  assert.strictEqual(instellingen().backup_bewaren, 8);
  assert.strictEqual(instellingen().backup_map, 'Project Madrigal back-ups');
});

console.log('\nOnline reserveren');
function aanvraagOmgeving(aan) {
  const s = maakStaat(null, { online_reserveren: aan === false ? 'nee' : 'ja' });
  return { inst: s.inst, vandaag: s.vandaag, catalogus: s.catalogus, aanvragen: [] };
}
const goedeAanvraag = { boek_id: 'B0001', voornaam: 'Sam', contact: 'sam@voorbeeld.test', toestemming: true };
let aanvraagNr = 0;
const aanvraagId = () => 'A' + String(++aanvraagNr).padStart(4, '0');
test('online reserveren staat standaard uit', () => {
  assert.strictEqual(instellingen().online_reserveren, false);
  assert.strictEqual(M.publiekeTeksten(instellingen()).online_reserveren, false);
  assert.strictEqual(M.maakAanvraag(aanvraagOmgeving(false), goedeAanvraag, aanvraagId).ok, false);
  assert.strictEqual(M.ACTIES.reservatieAanvraag, 'publiek');
});
test('aanvraag: goede invoer komt in de lijst', () => {
  const o = aanvraagOmgeving();
  const r = M.maakAanvraag(o, Object.assign({ opmerking: 'Graag volgende vrijdag' }, goedeAanvraag), aanvraagId);
  assert.strictEqual(r.ok, true);
  gelijk([o.aanvragen.length, o.aanvragen[0].titel, o.aanvragen[0].status, o.aanvragen[0].datum], [1, 'De verzonnen zee', 'nieuw', '2026-10-23']);
});
test('aanvraag: foute invoer en niet-publieke boeken geweigerd', () => {
  const o = aanvraagOmgeving();
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { contact: 'geen contact' }), aanvraagId).ok, false);
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { voornaam: '' }), aanvraagId).ok, false);
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { toestemming: false }), aanvraagId).ok, false);
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { boek_id: 'B0004' }), aanvraagId).ok, false); // publiek = nee
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { boek_id: 'Z0001' }), aanvraagId).ok, false); // niet uitleenbaar
  assert.strictEqual(o.aanvragen.length, 0);
});
test('aanvraag: robot stil genegeerd, dubbels en te veel aanvragen geweigerd', () => {
  const o = aanvraagOmgeving();
  const robot = M.maakAanvraag(o, Object.assign({ website: 'spam.test' }, goedeAanvraag), aanvraagId);
  gelijk([robot.ok, robot.stil, o.aanvragen.length], [true, true, 0]);
  assert.strictEqual(M.maakAanvraag(o, goedeAanvraag, aanvraagId).ok, true);
  assert.strictEqual(M.maakAanvraag(o, goedeAanvraag, aanvraagId).ok, false);
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { boek_id: 'B0002' }), aanvraagId).ok, true);
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { boek_id: 'B0003' }), aanvraagId).ok, true);
  o.catalogus.push({ boek_id: 'B0009', titel: 'Nog een', aantal: 1, uitleenbaar: 'ja', publiek: 'ja' });
  assert.strictEqual(M.maakAanvraag(o, Object.assign({}, goedeAanvraag, { boek_id: 'B0009' }), aanvraagId).ok, false);
});
test('aanvraag afhandelen en privacy-opruiming', () => {
  const rijen = [
    { aanvraag_id: 'A0001', datum: '2026-10-20', boek_id: 'B0001', titel: 'X', voornaam: 'Sam', contact: '0470 00 00 01', status: 'nieuw' },
    { aanvraag_id: 'A0002', datum: '2026-07-01', boek_id: 'B0002', titel: 'Y', voornaam: 'Jo', contact: 'jo@voorbeeld.test', status: 'afgehandeld' }
  ];
  gelijk(M.openAanvragen(rijen).map((a) => a.aanvraag_id), ['A0001']);
  assert.strictEqual(M.aanvraagAfhandelen(rijen, { aanvraag_id: 'A0001', status: 'raar' }, 'Test', '2026-10-24').ok, false);
  assert.strictEqual(M.aanvraagAfhandelen(rijen, { aanvraag_id: 'A0001', status: 'afgehandeld' }, 'Test', '2026-10-24').ok, true);
  gelijk([rijen[0].status, rijen[0].datum_afgehandeld, rijen[0].afgehandeld_door], ['afgehandeld', '2026-10-24', 'Test']);
  assert.strictEqual(M.ruimAanvragenOpRijen(rijen, '2026-10-24', 60), 1);
  gelijk([rijen[0]._verwijderen, rijen[1]._verwijderen], [undefined, true]);
});

console.log('\n' + geslaagd + ' geslaagd, ' + mislukt.length + ' mislukt');
if (mislukt.length) process.exit(1);
