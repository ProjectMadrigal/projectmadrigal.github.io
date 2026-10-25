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
  assert.strictEqual(r.rijen[0][0], '── UITLENEN ──');
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

test('lees ook: sterke overeenkomst eerst, dan één onderwerp, dan zelfde taal', () => {
  const boeken = [
    { id: 'A', t: 'Start', a: 'Baldwin, Jamie', g: ['Fictie', 'Klassiekers'], ll: ['Thema'], b: { c: 'beschikbaar' } },
    { id: 'B', t: 'Zelfde auteur', a: 'baldwin, jamie', g: ['Poëzie'], b: { c: 'uitgeleend' } },
    { id: 'C', t: 'Zelfde lijst', a: 'Ander', g: [], ll: ['Thema'], b: { c: 'beschikbaar' } },
    { id: 'D', t: 'Twee onderwerpen', a: 'X', g: ['Fictie', 'Klassiekers'], b: { c: 'uitgeleend' } },
    { id: 'E', t: 'Twee onderwerpen, vrij', a: 'Y', g: ['Klassiekers', 'Fictie'], b: { c: 'beschikbaar' } },
    { id: 'F', t: 'Eén onderwerp', a: 'Z', g: ['Fictie'], b: { c: 'beschikbaar' } }
  ];
  gelijk(F.gelijkaardig(boeken, boeken[0], 6).map((b) => b.id), ['B', 'C', 'E', 'D', 'F']);
  gelijk(F.gelijkaardig(boeken, boeken[0], 2).map((b) => b.id), ['B', 'C']);
  // F deelt enkel Fictie met A, D en E: die eerst. Daarna B en C (zelfde taal: geen).
  const f = F.gelijkaardig(boeken, boeken[5], 6).map((b) => b.id);
  gelijk([f.slice(0, 3).sort(), f.slice(3).sort()], [['A', 'D', 'E'], ['B', 'C']]);
  const metTaal = [
    { id: '1', t: 'Een', a: 'P', g: [], l: 'Engels', b: { c: 'beschikbaar' } },
    { id: '2', t: 'Twee', a: 'Q', g: [], l: 'Engels', b: { c: 'uitgeleend' } },
    { id: '3', t: 'Drie', a: 'R', g: [], l: 'Engels', s: 'zine', b: { c: 'beschikbaar' } },
    { id: '4', t: 'Vier', a: 'S', g: [], l: 'Frans', b: { c: 'beschikbaar' } }
  ];
  // Zelfde taal eerst (zelfde soort voor de zine), dan de rest.
  gelijk(F.gelijkaardig(metTaal, metTaal[0], 6).map((b) => b.id), ['2', '3', '4']);
  gelijk(F.gelijkaardig(metTaal, metTaal[0], 1).map((b) => b.id), ['2']);
});
test('filter leeslijst: in de volgorde van de catalogus', () => {
  const boeken = [{ id: '1', ll: ['Z-lijst', 'A-lijst'] }, { id: '2', ll: ['A-lijst'] }, { id: '3' }];
  gelijk(F.opties(boeken, [], ['Z-lijst', 'A-lijst']).lijst, [{ waarde: 'Z-lijst', aantal: 1 }, { waarde: 'A-lijst', aantal: 2 }]);
  gelijk(F.pasToe(boeken, { lijst: 'A-lijst' }).map((b) => b.id), ['1', '2']);
});
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
test('publieke catalogus: leeslijsten met naam en uitleg uit het tabblad, verborgen lijsten weg', () => {
  const s = maakStaat();
  s.inst.leeslijsten_tonen = true;
  s.catalogus[0].leeslijsten = 'eerste keer, Verborgen lijst';
  s.catalogus[1].leeslijsten = 'Zonder uitleg; Eerste keer';
  const p = M.bouwPubliekeCatalogus(s, [], [
    { volgorde: 2, naam: 'Eerste keer', naam_en: 'First time', uitleg: 'Voor wie begint.', publiek: '' },
    { volgorde: 1, naam: 'Verborgen lijst', publiek: 'nee' },
    { volgorde: '', naam: 'Leeg thema' }
  ]);
  gelijk(Array.from(p.boeken.find((b) => b.id === 'B0001').ll), ['Eerste keer']);
  gelijk(Array.from(p.boeken.find((b) => b.id === 'B0002').ll), ['Zonder uitleg', 'Eerste keer']);
  gelijk(JSON.parse(JSON.stringify(p.leeslijsten)), [{ n: 'Eerste keer', ne: 'First time', u: 'Voor wie begint.' }, { n: 'Zonder uitleg' }]);
  assert.ok(JSON.stringify(p).indexOf('Verborgen lijst') === -1);
  assert.ok(!p.boeken.find((b) => b.id === 'B0003').ll);
  const leeg = maakStaat(); leeg.inst.leeslijsten_tonen = true;
  gelijk(JSON.parse(JSON.stringify(M.bouwPubliekeCatalogus(leeg, []).leeslijsten)), []);
});
test('publieke catalogus: leeslijsten blijven weg zolang leeslijsten_tonen op nee staat', () => {
  const s = maakStaat();
  s.catalogus[0].leeslijsten = 'Pride-maand';
  const p = M.bouwPubliekeCatalogus(s, [], [{ naam: 'Pride-maand' }]);
  assert.strictEqual(s.inst.leeslijsten_tonen, false);
  assert.ok(!('leeslijsten' in p));
  assert.ok(JSON.stringify(p).indexOf('Pride-maand') === -1);
});
test('bestuursscherm: boeken met hun onderwerpen, het uitleenscherm zonder', () => {
  const s = maakStaat();
  s.catalogus[0].genre = 'Roman';
  s.catalogus[0].klassieker = 'ja';
  const metG = M.bestuurGegevens(s, [{ genre: 'Roman', filtergroepen: 'Fictie' }]).boeken.find((b) => b.id === 'B0001');
  gelijk(Array.from(metG.g), ['Fictie', 'Klassiekers']);
  assert.ok(!M.baliecatalogus(s).find((b) => b.id === 'B0001').g);
});
test('geplande leeslijst: verschijnt en verdwijnt op haar data, ook met de schakelaar uit', () => {
  const rijen = [
    { naam: 'Pride-maand', zichtbaar_vanaf: '2027-06-01', zichtbaar_tot: '2027-06-30' },
    { naam: 'Zonder data' },
    { naam: 'Verborgen gepland', zichtbaar_vanaf: '2027-06-01', publiek: 'nee' }
  ];
  const maak = (dag) => {
    const s = maakStaat(dag);
    s.catalogus[0].leeslijsten = 'Pride-maand, Zonder data, Verborgen gepland';
    s.catalogus[1].leeslijsten = 'Niet in het tabblad';
    return M.bouwPubliekeCatalogus(s, [], rijen);
  };
  assert.ok(!('leeslijsten' in maak('2027-05-31')));
  const juni = maak('2027-06-01');
  gelijk(juni.leeslijsten.map((l) => l.n), ['Pride-maand']);
  gelijk(Array.from(juni.boeken.find((b) => b.id === 'B0001').ll), ['Pride-maand']);
  assert.ok(!juni.boeken.find((b) => b.id === 'B0002').ll);
  assert.ok(maak('2027-06-30').leeslijsten.length === 1);
  assert.ok(!('leeslijsten' in maak('2027-07-01')));
  // Met de schakelaar aan: ook de lijsten zonder data, maar niet een voorbije geplande lijst.
  const s = maakStaat('2027-07-01'); s.inst.leeslijsten_tonen = true;
  s.catalogus[0].leeslijsten = 'Pride-maand, Zonder data';
  gelijk(M.bouwPubliekeCatalogus(s, [], rijen).leeslijsten.map((l) => l.n), ['Zonder data']);
  // Startpagina: menu-item enkel als er iets zichtbaar is.
  gelijk([M.bouwSiteInhoud(maakStaat('2027-06-10'), { leeslijsten: rijen }).leeslijsten, M.bouwSiteInhoud(maakStaat('2027-07-10'), { leeslijsten: rijen }).leeslijsten], [true, false]);
  // Einddatum voor de startdatum: geweigerd.
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Leeslijsten', velden: { naam: 'X', zichtbaar_vanaf: '10/06/2027', zichtbaar_tot: '01/06/2027' } }).ok, false);
});
test('gepland nieuws: pas zichtbaar vanaf online_vanaf', () => {
  const nieuws = [
    { datum: '2027-05-20', titel: 'Gepland', publiek: 'ja', online_vanaf: '2027-06-01' },
    { datum: '2027-05-10', titel: 'Nu al', publiek: 'ja', online_vanaf: '' }
  ];
  gelijk(M.bouwSiteInhoud(maakStaat('2027-05-31'), { nieuws: nieuws }).nieuws.map((n) => n.titel.nl), ['Nu al']);
  gelijk(M.bouwSiteInhoud(maakStaat('2027-06-01'), { nieuws: nieuws }).nieuws.map((n) => n.titel.nl), ['Gepland', 'Nu al']);
  const r = M.inhoudAanpassen([], { tabblad: 'Nieuws', velden: { titel: 'T', datum: '20/05/2027', online_vanaf: '01/06/2027' } });
  assert.strictEqual(r.ok, true);
});
test('achtergrondtaak bewaart enkel haar eigen velden, wat de balie intussen wijzigde blijft', () => {
  const oud = [
    { _rij: 2, boek_id: 'B0001', titel: 'Een', beschrijving: '', aantal: 1 },
    { _rij: 3, boek_id: '', titel: 'Zonder ID', beschrijving: '' },
    { _rij: 4, boek_id: 'B0003', titel: 'Intussen weg', beschrijving: '' }
  ];
  M.wijzig(oud[0], { beschrijving: 'Van Wikipedia', wiki_gezocht: '2026-10-25' });
  M.wijzig(oud[1], { beschrijving: 'Ook gevonden' });
  M.wijzig(oud[2], { beschrijving: 'Te laat' });
  // Intussen: iemand paste het aantal aan, en een rij schoof op.
  const vers = [
    { _rij: 2, boek_id: 'B0001', titel: 'Een', beschrijving: '', aantal: 3 },
    { _rij: 3, boek_id: '', titel: 'Zonder ID', beschrijving: '' }
  ];
  M.voegVeldenSamen(oud.filter((r) => r._gewijzigd), vers);
  gelijk([vers[0].aantal, vers[0].beschrijving, vers[0].wiki_gezocht, vers[1].beschrijving, oud[0]._gewijzigd], [3, 'Van Wikipedia', '2026-10-25', 'Ook gevonden', false]);
  // Een rij zonder ID op een plaats waar nu een ander boek staat: niet overschrijven.
  const oud2 = { _rij: 3, boek_id: '', titel: 'Zonder ID', beschrijving: '' };
  M.wijzig(oud2, { beschrijving: 'X' });
  const vers2 = [{ _rij: 3, boek_id: '', titel: 'Ander boek', beschrijving: '' }];
  M.voegVeldenSamen([oud2], vers2);
  assert.strictEqual(vers2[0].beschrijving, '');
});
test('bezoekers uit GoatCounter: adres, periode en omzetten', () => {
  assert.strictEqual(M.gcBasis('ProjectMadrigal'), 'https://projectmadrigal.goatcounter.com/api/v0');
  assert.strictEqual(M.gcBasis('evil.com/x'), '');
  gelijk(M.gcPeriode('2026-10-25', 7), { start: '2026-10-19T00:00:00Z', end: '2026-10-25T23:59:59Z' });
  const v = M.gcVragen('https://x.goatcounter.com/api/v0', { start: '2026-10-19T00:00:00Z', end: '2026-10-25T23:59:59Z' });
  assert.ok(v.paginas.indexOf('/stats/hits?start=2026-10-19T00%3A00%3A00Z') > -1);
  const c = M.verwerkGoatcounter({
    totaal: { total: 42, stats: [{ day: '2026-10-25', daily: 5 }, { day: '2026-10-24', daily: 7 }] },
    paginas: { hits: [{ path: '/boeken.html#/boek/B0001', title: 'X', count: 9 }, { path: 'klik', event: true, count: 3 }] },
    bronnen: { stats: [{ name: 'instagram.com', count: 4 }, { name: '', count: 2 }] },
    toestellen: null, landen: { stats: [{ name: 'Belgium', count: 30 }] }
  }, 7);
  gelijk([c.totaal, c.perWeek, c.verloop.map((d) => d.dag), c.paginas.length, c.bronnen[1].naam, c.toestellen.length, c.landen[0].n],
    [42, false, ['2026-10-24', '2026-10-25'], 1, '(onbekend)', 0, 30]);
  // Foutafhandeling: alles mislukt, onbekende site, of een deel mislukt.
  const alles = M.gcUitkomst({}, [M.gcFoutRegel('totaal', 404, '{"error":"not found"}')], 7, 'x');
  gelijk([alles.ok, /totaal: 404 \(\{"error":"not found"\}\)/.test(alles.fout)], [false, true]);
  assert.ok(/kent de code x niet/.test(M.gcUitkomst({}, [M.gcFoutRegel('totaal', 400, '{"error":"no site at this domain (\\"x.goatcounter.com\\")"}')], 7, 'x').fout));
  const deel = M.gcUitkomst({ totaal: { total: 3, stats: [] } }, ['landen: 404 (not found)'], 7, 'x');
  gelijk([deel.ok, deel.cijfers.totaal, deel.waarschuwing], [true, 3, 'Niet alles kwam binnen: landen: 404 (not found)']);
  const jaar = M.verwerkGoatcounter({ totaal: { total: 1, stats: Array.from({ length: 14 }, (_, i) => ({ day: '2026-01-' + String(i + 1).padStart(2, '0'), daily: 1 })) } }, 365);
  gelijk([jaar.perWeek, jaar.verloop.length, jaar.verloop[0].n], [true, 2, 7]);
});
test('peperfabriek: programma uit schema.org, iCal of links, enkel komende activiteiten', () => {
  const basis = 'https://www.voorbeeldhuis.test/nl/programma';
  // 1. Gestructureerde gegevens (JSON-LD)
  const jsonld = '<html><script type="application/ld+json">' + JSON.stringify({ '@graph': [
    { '@type': 'Event', name: 'Verzonnen workshop', startDate: '2026-11-07T19:30:00+01:00', url: '/nl/programma/verzonnen-workshop', image: { url: '/img/a.jpg' }, description: '<p>Een <b>verzonnen</b> avond.</p>' },
    { '@type': ['Event', 'Thing'], name: 'Oude activiteit', startDate: '2026-01-02' },
    { '@type': 'Organization', name: 'Geen activiteit' }
  ] }) + '</script></html>';
  let p = M.pfLeesProgramma(jsonld, basis, '2026-10-25', '');
  gelijk([p.manier, p.activiteiten.length, p.activiteiten[1].titel, p.activiteiten[1].uur, p.activiteiten[1].link, p.activiteiten[1].afbeelding, p.activiteiten[1].tekst],
    ['schema.org', 2, 'Verzonnen workshop', '19:30', 'https://www.voorbeeldhuis.test/nl/programma/verzonnen-workshop', 'https://www.voorbeeldhuis.test/img/a.jpg', 'Een verzonnen avond.']);
  gelijk(M.pfVoorSite(p.activiteiten, '2026-10-25', 12).map((a) => a.titel), ['Verzonnen workshop']);
  // 2. iCal
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Verzonnen concert\r\nDTSTART;TZID=Europe/Brussels:20261120T200000\r\nURL:https://www.voorbeeldhuis.test/nl/programma/concert\r\nDESCRIPTION:Lange tekst\\, met komma\r\n  die verder gaat\r\nEND:VEVENT\r\nEND:VCALENDAR';
  const metIcal = '<a href="/agenda/?ical=1">Agenda</a>';
  assert.strictEqual(M.pfIcalLink(metIcal, basis), 'https://www.voorbeeldhuis.test/agenda/?ical=1');
  p = M.pfLeesProgramma(metIcal, basis, '2026-10-25', ics);
  gelijk([p.manier, p.activiteiten[0].titel, p.activiteiten[0].datum, p.activiteiten[0].uur, p.activiteiten[0].tekst], ['iCal', 'Verzonnen concert', '2026-11-20', '20:00', 'Lange tekst, met komma die verder gaat']);
  // 3. Links met een datum in de buurt (zonder jaar: het eerstvolgende)
  const html = '<main><div class="kaart"><span>za 14 nov</span><a href="/nl/programma/verzonnen-lezing"><img src="/img/l.jpg"><h3>Verzonnen lezing</h3></a></div>' +
    '<div class="kaart"><time datetime="2027-01-09T14:00">9 januari</time><a href="https://www.voorbeeldhuis.test/nl/programma/verzonnen-markt">Verzonnen markt</a></div>' +
    '<a href="/nl/programma">Programma</a><a href="/nl/over-ons">Over ons</a><a href="/nl/programma/zonder-datum">Zonder datum</a></main>';
  p = M.pfLeesProgramma(html, basis, '2026-10-25', '');
  gelijk([p.manier, p.activiteiten.map((a) => a.titel + ' ' + a.datum + ' ' + a.uur)], ['links', ['Verzonnen lezing 2026-11-14 ', 'Verzonnen markt 2027-01-09 14:00']]);
  assert.strictEqual(p.activiteiten[0].afbeelding, 'https://www.voorbeeldhuis.test/img/l.jpg');
  // Datum zonder jaar in januari, gelezen in december: volgend jaar
  gelijk(M.pfDatumInTekst('vr 8 jan om 20u00', '2026-12-10'), { datum: '2027-01-08', uur: '20:00' });
  gelijk(M.pfDatumInTekst('12/11/2026', '2026-10-25'), { datum: '2026-11-12', uur: '' });
  // Niets gevonden, en onveilige links worden geweigerd
  assert.strictEqual(M.pfLeesProgramma('<p>Leeg</p>', basis, '2026-10-25', '').activiteiten.length, 0);
  assert.strictEqual(M.pfAbsoluut('javascript:alert(1)', basis), '');
});
test('peperfabriek: de startpagina-gegevens geven tekst, adres en komende activiteiten mee', () => {
  const s = maakStaat('2026-10-25');
  const d = M.bouwSiteInhoud(s, { peperfabriek: { opgehaald: '2026-10-25', activiteiten: [
    { titel: 'Voorbij', datum: '2026-10-20' }, { titel: 'Nog bezig', datum: '2026-10-20', einde: '2026-10-30' }, { titel: 'Komt eraan', datum: '2026-11-02' }] } });
  gelijk([d.peperfabriek.url, d.peperfabriek.activiteiten.map((a) => a.titel), /Peperfabriek/.test(d.peperfabriek.tekst.nl)],
    ['https://www.peperfabriek.be/nl/programma', ['Nog bezig', 'Komt eraan'], true]);
  gelijk(M.bouwSiteInhoud(s, {}).peperfabriek.activiteiten, []);
});
test('bookclub: de eerstvolgende tweede zondag vanzelf in de agenda (één keer), een eigen event van die dag gaat voor', () => {
  gelijk([M.nDeWeekdag(2026, 11, 0, 2), M.nDeWeekdag(2026, 11, 0, 5), M.nDeWeekdag(2026, 2, 0, 5), M.nDeWeekdag(2026, 3, 0, 5)], ['2026-11-08', '2026-11-29', '2026-02-22', '2026-03-29']);
  assert.strictEqual(M.nDeWeekdag(2026, 2, 0, 5).slice(0, 7), '2026-02');
  gelijk(M.bookclubDatums('2026-11-08', 2, 0, 3), ['2026-11-08', '2026-12-13', '2027-01-10']);
  gelijk(M.bookclubDatums('2026-11-09', 2, 0, 2), ['2026-12-13', '2027-01-10']);
  gelijk(M.bookclubRegel(2, 0), { nl: 'elke tweede zondag van de maand', en: 'every second Sunday of the month' });
  const s = maakStaat('2026-10-25');
  s.inst.tekst_vaste_events = 'geen'; // de vaste events hebben een eigen test
  s.inst.bookclub_uur = '14:00';
  s.inst.bookclub_link = 'https://www.instagram.com/verzonnen.bookclub';
  const agenda = [{ datum: '2026-12-13', titel: 'Antwerp Queer Bookclub: kerstspecial', publiek: 'ja' }, { datum: '2026-11-20', titel: 'Verzonnen event', publiek: 'ja' }];
  const d = M.bouwSiteInhoud(s, { agenda: agenda });
  gelijk(d.agenda.komend.map((e) => e.datum + ' ' + e.titel.nl), ['2026-11-08 Antwerp Queer Bookclub', '2026-11-20 Verzonnen event', '2026-12-13 Antwerp Queer Bookclub: kerstspecial']);
  gelijk([d.agenda.komend[0].uur, d.agenda.komend[0].link, d.bookclub.volgende, d.bookclub.regel.nl], ['14:00', 'https://www.instagram.com/verzonnen.bookclub', ['2026-11-08', '2026-12-13', '2027-01-10'], 'elke tweede zondag van de maand']);
  // Uitzetten: naam leeg
  s.inst.bookclub_naam = '';
  const leeg = M.bouwSiteInhoud(s, {});
  gelijk([leeg.bookclub, leeg.agenda.komend.length], [null, 0]);
  // Zonder eigen events: maar één kaart van de bookclub, de eerstvolgende.
  s.inst.bookclub_naam = 'Antwerp Queer Bookclub';
  gelijk(M.bouwSiteInhoud(s, {}).agenda.komend.map((e) => e.datum), ['2026-11-08']);
  // Is de eerstvolgende al een eigen event, dan komt er geen tweede kaart bij.
  gelijk(M.bouwSiteInhoud(s, { agenda: [{ datum: '2026-11-08', titel: 'Antwerp Queer Bookclub special', publiek: 'ja' }] }).agenda.komend.map((e) => e.datum + ' ' + e.titel.nl),
    ['2026-11-08 Antwerp Queer Bookclub special']);
});
test('leeslijsten in het bestuursscherm: boeken kiezen, hernoemen, dubbele naam geweigerd', () => {
  const s = maakStaat();
  s.catalogus[0].leeslijsten = 'Andere lijst';
  const r = M.leeslijstBoeken(s, { naam: 'Pride-maand', toevoegen: ['B0001', 'B0002', 'B9999'], weghalen: [] });
  gelijk([r.ok, s.catalogus[0].leeslijsten, s.catalogus[1].leeslijsten, s.catalogusGewijzigd], [true, 'Andere lijst, Pride-maand', 'Pride-maand', true]);
  M.leeslijstBoeken(s, { naam: 'pride-MAAND', toevoegen: ['B0001'], weghalen: ['B0002'] });
  gelijk([s.catalogus[0].leeslijsten, s.catalogus[1].leeslijsten], ['Andere lijst, Pride-maand', '']);
  assert.strictEqual(M.leeslijstBoeken(s, { naam: 'a, b', toevoegen: ['B0001'] }).ok, false);
  gelijk(M.hernoemLeeslijst(s.catalogus, 'Pride-maand', 'Pride 2027'), 1);
  assert.strictEqual(s.catalogus[0].leeslijsten, 'Andere lijst, Pride 2027');
  M.hernoemLeeslijst(s.catalogus, 'andere lijst', '');
  assert.strictEqual(s.catalogus[0].leeslijsten, 'Pride 2027');
  const rijen = [{ _rij: 2, naam: 'Pride 2027', publiek: 'ja' }];
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Leeslijsten', velden: { naam: 'pride 2027' } }).ok, false);
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Leeslijsten', velden: { naam: 'Met, komma' } }).ok, false);
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Leeslijsten', velden: { naam: 'Eerste keer', uitleg: 'Twee\nregels' } }).ok, true);
  gelijk([rijen.length, rijen[1].publiek, rijen[1].uitleg], [2, 'ja', 'Twee\nregels']);
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

test('oud uitleenblad: kolom A "ok" is terug, voorbeeldrij overgeslagen, herinnering "ok"', () => {
  const s = maakStaat();
  s.leners = [];
  const waarden = [
    ['', '', '', 'Uitleenblad', '', '', '', '', '', '', '', '', '', ''],
    ['', 'Boek', '', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR) ', 'Gift', 'reminder mail ', 'boek terug op...'],
    ['vb. ', 'De verzonnen zee', '', 'Mira Verbeek', 'Voorbeeld', 'Persoon', '0470/00.00.01', '', '11/10/2023', '08/11/2023', 'QR', '', '', ''],
    ['ok', 'Stille lichten', '', 'Noor Aerts', 'Robin', 'Testpersoon', '0470/00.00.07', '', '02/09/2026', '30/09/2026', 'QR', '', 'ok', ''],
    ['nok', 'De verzonnen zee', '', 'Mira Verbeek', 'Lou', '', '', 'lou@voorbeeld.test', '02/09/2026', '30/09/2026', 'cash', '', 'ok', ''],
    ['', 'Twee kasten vol', '', 'Rein Dewit', 'Sasha', '', '0470/00.00.09', '', '02/10/2026', '30/10/2026', 'cash', '', '', '']
  ];
  const rijen = M.leesOudeUitleningen(waarden);
  gelijk(rijen.map((r) => r.boek), ['Stille lichten', 'De verzonnen zee', 'Twee kasten vol'], 'Voorbeeldrij overgeslagen');
  const r = M.verwerkOudeUitleningen(s, rijen);
  assert.strictEqual(r.uitleningen, 2, 'Enkel "nok" en leeg komen over');
  const lopend = s.uitleningen.filter((u) => !u.datum_terug);
  gelijk(lopend.map((u) => u.boek_id), ['B0001', 'B0002']);
  // "ok" bij de herinnering: de afgesproken terugbrengdatum als datum.
  assert.strictEqual(lopend[0].laatste_herinnering, '2026-09-30');
  assert.strictEqual(lopend[1].laatste_herinnering, '');
  // De rij met "ok" in kolom A komt mee als historiek (teruggebracht).
  assert.strictEqual(r.historiek, 1);
  assert.strictEqual(s.uitleningen.find((u) => u.boek_id === 'B0003').datum_terug, '2026-09-30');
  assert.ok(M.MELDING_SOORTEN.indexOf('wil iets kopen') > -1);
  assert.ok(M.checklistPunten(instellingen({}).tekst_checklist_uitlenen).length === 3);
});

test('oud uitleenblad: historiek met lener binnen de bewaartermijn, zonder lener daarvoor', () => {
  const s = maakStaat('2026-10-25');
  s.leners = [];
  const waarden = [
    ['', 'Boek', '', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR)', 'Gift', 'reminder mail', 'boek terug op...'],
    ['ok', 'De verzonnen zee', '', 'Mira Verbeek', 'Robin', '', '', 'robin@voorbeeld.test', '10/01/2024', '07/02/2024', 'QR', '', '', '07/02/2024'],
    ['ok', 'Stille lichten', '', 'Noor Aerts', 'Lou', '', '', 'lou@voorbeeld.test', '05/06/2026', '03/07/2026', 'cash', '2', '', ''],
    ['ok', 'Een boek dat niet bestaat', '', 'Niemand', 'Sasha', '', '', 'sasha@voorbeeld.test', '05/06/2026', '03/07/2026', '', '', '', '']
  ];
  const r = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  gelijk([r.uitleningen, r.historiek, r.nietGevonden, r.leners], [0, 2, 1, 1]);
  const [oud, recent] = s.uitleningen;
  gelijk([oud.boek_id, oud.lenersnummer, oud.datum_uit, oud.datum_terug], ['B0001', '', '2024-01-10', '2024-02-07'], 'Ouder dan 12 maanden: zonder lener');
  gelijk([recent.boek_id, recent.datum_terug, recent.borg_terugbetaald, recent.gift], ['B0003', '2026-07-03', '2026-07-03', 2], 'Zonder datum terug: de afgesproken datum');
  assert.ok(recent.lenersnummer && s.leners.length === 1 && s.leners[0].voornaam === 'Lou', 'Recent: met lener');
  // Niet gevonden: in Na te kijken, met de vraag om het boek-ID.
  gelijk([r.naTeKijken.length, r.naTeKijken[0].veld, r.naTeKijken[0].sleutel_extra], [1, 'historiek', 'oud blad rij 4']);
  // Het bestuur kiest het boek in Na te kijken: daarna telt het mee.
  const gekozen = M.gekozenOudeBoeken([
    { bron: 'Overzetten', veld: 'historiek', boek_id: 'b0002', waarde_bron: 'Een boek dat niet bestaat / Niemand [oud blad rij 4]', afgehandeld: 'nee' },
    { bron: 'Overzetten', veld: 'historiek', boek_id: 'B0001, B0002', waarde_bron: 'Twijfel [oud blad rij 9]', afgehandeld: 'nee' }
  ]);
  gelijk(gekozen, { 'oud blad rij 4': 'B0002' }, 'Enkel een enkel boek-ID telt');
  const r2 = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden), gekozen);
  gelijk([r2.historiek, r2.nietGevonden], [1, 0], 'Opnieuw: enkel het gekozen boek erbij, niets dubbel');
  assert.strictEqual(s.uitleningen[2].boek_id, 'B0002');
  // Soepel voor de historiek: een iets andere titel met de juiste auteur.
  assert.strictEqual(M.zoekBoekOpTitel(s.catalogus, 'De verzonnen zee (roman)', 'Mira Verbeek', true).zeker.boek_id, 'B0001');
  // In de cijfers: de boeken tellen mee, het voorbije jaar 2 actieve leners.
  const c = M.bestuurCijfers(s, []);
  assert.strictEqual(c.extraCijfers.afgesloten, 3);
  assert.strictEqual(c.extraCijfers.actieveLeners, 2);
});

console.log('\nWebsite');

test('startpagina: enkel publieke rijen, nieuwste nieuws, komend en vorig event, vragen op volgorde', () => {
  const s = maakStaat('2026-10-23');
  s.inst.bookclub_naam = ''; // de bookclub heeft een eigen test
  s.inst.tekst_vaste_events = 'geen';
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
  gelijk(groepen.map((g) => g.titel), ['Uitlenen: openingsdagen en -uren', 'Overige']);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: 'code_bestuur', waarde: 'x' }).ok, false);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: '── TOEGANG ──', waarde: 'x' }).ok, false);
  assert.strictEqual(M.instellingAanpassen(rijen, { sleutel: 'openingsuren', waarde: 'vrijdag 18-22' }).ok, true);
  assert.strictEqual(rijen[3].waarde, 'vrijdag 18-22');
});
test('beheeracties: bestuur, behalve de lijst voor het vrijwilligersscherm', () => {
  const vrijwilliger = ['beheerLeeslijstBoeken', 'beheerInhoud', 'beheerInhoudBewaren', 'beheerCoversLijst', 'beheerCoversBewaren', 'beheerCoverUpload', 'beheerCoverLinks', 'beheerTekstUitFoto'];
  Object.keys(M.ACTIES).filter((a) => /^beheer/.test(a)).forEach((a) => assert.strictEqual(M.ACTIES[a], vrijwilliger.indexOf(a) > -1 ? 'vrijwilliger' : 'bestuur', a));
});
test('rollen: drie codes, elke rol mag wat de rol ervoor mag', () => {
  const inst = { toegangscode_balie: 'b1', code_vrijwilliger: 'v1', code_bestuur: 'x1' };
  gelijk(['b1', 'v1', 'x1', 'fout', ''].map((c) => M.rolVoorCode(c, inst)), ['balie', 'vrijwilliger', 'bestuur', '', '']);
  assert.strictEqual(M.rolVoorCode('', { code_vrijwilliger: '' }), '');
  gelijk(['uitlenen', 'vrijwilligerData', 'beheerInhoudBewaren', 'bestuurData', 'beheerInstellingBewaren', 'beheerBoekBewaren', 'lenerAanpassen'].map((a) => M.magActie('vrijwilliger', a)),
    [true, true, true, false, false, false, false]);
  gelijk([M.magActie('balie', 'vrijwilligerData'), M.magActie('bestuur', 'vrijwilligerData'), M.magActie('bestuur', 'bestaatNiet')], [false, true, false]);
});
test('vrijwilliger: nieuws en agenda als voorstel, verborgen tot het bestuur het goedkeurt', () => {
  const rijen = [{ _rij: 2, datum: '2026-10-01', titel: 'Online', publiek: 'ja' }];
  const vinger = M.inhoudRijen('Nieuws', rijen)[0].vingerafdruk;
  // Nieuw voorstel
  let r = M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', velden: { titel: 'Voorstel', datum: '20/10/2026', publiek: 'ja' } }, 'Kim');
  gelijk([r.ok, rijen[1].publiek, rijen[1].voorgesteld_door, /bestuur/.test(r.tekst)], [true, 'nee', 'Kim', true]);
  // Aanpassing aan een bericht dat online stond: weer verborgen
  r = M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: vinger, velden: { titel: 'Online, verbeterd' } }, 'Kim');
  gelijk([r.ok, rijen[0].publiek, rijen[0].voorgesteld_door], [true, 'nee', 'Kim']);
  // Het bestuur keurt goed
  const v2 = M.inhoudRijen('Nieuws', rijen)[0];
  assert.strictEqual(v2.voorgesteld_door, 'Kim');
  r = M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: v2.vingerafdruk, velden: { publiek: 'ja' } }, '');
  gelijk([r.ok, rijen[0].publiek, rijen[0].voorgesteld_door], [true, 'ja', '']);
  // Verwijderen mag enkel als het nog niet online staat
  const v3 = M.inhoudRijen('Nieuws', rijen)[0];
  assert.strictEqual(M.inhoudAanpassen(rijen, { tabblad: 'Nieuws', rij: 2, vingerafdruk: v3.vingerafdruk, verwijderen: true }, 'Kim').ok, false);
  // Veelgestelde vragen: niet voor vrijwilligers. Leeslijsten wel, gewoon zichtbaar.
  assert.strictEqual(M.inhoudAanpassen([], { tabblad: 'Veelgestelde vragen', velden: { vraag: 'V' } }, 'Kim').ok, false);
  const lijsten = [];
  M.inhoudAanpassen(lijsten, { tabblad: 'Leeslijsten', velden: { naam: 'Pride' } }, 'Kim');
  gelijk([lijsten[0].publiek, lijsten[0].voorgesteld_door], ['ja', undefined]);
});
test('vrijwilligersscherm: uitleningen zonder contactgegevens of borg, geen sleutel van Google', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const d = M.vrijwilligerGegevens(s, []);
  const tekst = JSON.stringify(d);
  assert.strictEqual(d.lopend.length, 1);
  ['email', 'telefoon', 'achternaam', 'borg', 'herinnering', 'leners'].forEach((k) => assert.ok(!(k in d.lopend[0]) && !(k in d), k));
  assert.ok(tekst.indexOf('@') === -1);
  s.inst.google_books_api_key = 'GEHEIM';
  gelijk([M.coversTeZoeken(s, false).sleutel, M.coversTeZoeken(s, true).sleutel], ['', 'GEHEIM']);
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

console.log('\nFoto van de cover en bol.com');
test('foto: enkel een afbeelding, niet te groot, en de link komt in cover_url', () => {
  const s = maakStaat();
  const bewaard = [];
  const bewaar = (naam, data, mime) => { bewaard.push([naam, mime]); return 'https://lh3.googleusercontent.com/d/test123'; };
  assert.strictEqual(M.coverUploaden(s, { boek_id: 'B0001', data: 'abc', mime: 'application/pdf' }, bewaar).ok, false);
  assert.strictEqual(M.coverUploaden(s, { boek_id: 'B0001', data: 'niet geldig!', mime: 'image/jpeg' }, bewaar).ok, false);
  assert.strictEqual(M.coverUploaden(s, { boek_id: 'B0001', data: 'A'.repeat(2100000), mime: 'image/jpeg' }, bewaar).ok, false);
  assert.strictEqual(M.coverUploaden(s, { boek_id: 'B9999', data: 'QUJD', mime: 'image/jpeg' }, bewaar).ok, false);
  const r = M.coverUploaden(s, { boek_id: 'B0001', data: 'data:image/jpeg;base64,QUJD', mime: 'image/jpeg' }, bewaar);
  assert.strictEqual(r.ok, true);
  gelijk(bewaard, [['B0001.jpg', 'image/jpeg']]);
  gelijk([s.catalogus[0].cover_url, s.catalogus[0].cover_bron], ['https://lh3.googleusercontent.com/d/test123', 'foto in de bib']);
  assert.strictEqual(M.ACTIES.beheerCoverUpload, 'vrijwilliger');
});
test('bol.com: beste afbeelding uit een onbekend antwoord, sleutels nooit zichtbaar op de site', () => {
  const antwoord = { images: [
    { renditions: [{ url: 'https://media.s-bol.com/abc/124x200.jpg', width: 124 }, { url: 'https://media.s-bol.com/abc/550x840.jpg', width: 550 }] },
    { url: 'https://media.s-bol.com/def/1200x1800.jpg', width: 1200 }] };
  assert.strictEqual(M.bolAfbeelding(antwoord), 'https://media.s-bol.com/abc/550x840.jpg');
  assert.strictEqual(M.bolAfbeelding({ image: { url: 'https://media.s-bol.com/x.jpg' } }), 'https://media.s-bol.com/x.jpg');
  assert.strictEqual(M.bolAfbeelding({ titel: 'geen beeld', link: 'https://www.bol.com/nl/p/x' }), '');
  assert.strictEqual(M.heeftBolNodig({ isbn: '9789044641035' }), true);
  assert.strictEqual(M.heeftBolNodig({ isbn: '9789044641035', bol_gezocht: '2026-10-24' }), false);
  const groepen = JSON.stringify(M.instellingenVoorBeheer([{ _rij: 2, sleutel: 'bol_client_secret', waarde: 'geheim' }, { _rij: 3, sleutel: 'bol_client_id', waarde: 'id' }]));
  assert.ok(groepen.indexOf('geheim') === -1 && groepen.indexOf('bol_client') === -1);
});

test('Internet Archive: zoeken op ISBN 13 en 10, enkel veilige links, met bron en datum', () => {
  assert.ok(decodeURIComponent(M.iaZoekUrl('9780141439518')).includes('isbn:(9780141439518 OR 0141439513)'));
  assert.strictEqual(M.iaCoverUitAntwoord({ response: { docs: [{ identifier: 'slecht/../pad' }, { identifier: 'prideprejudice00aust' }] } }), 'https://archive.org/services/img/prideprejudice00aust');
  assert.strictEqual(M.iaCoverUitAntwoord({ response: { docs: [] } }), '');
  const s = maakStaat('2026-10-24');
  assert.ok(M.coversTeZoeken(s).boeken.find((b) => b.id === 'B0001').i);
  const r = M.coversBewaren(s, { items: [
    { boek_id: 'B0001', ia: true, bron: 'ia', cover: 'https://archive.org/services/img/prideprejudice00aust' },
    { boek_id: 'B0002', ia: true, bron: 'ia', cover: 'https://archive.org/services/img/x"onclick' }
  ] });
  assert.strictEqual(r.covers, 1);
  gelijk([s.catalogus[0].cover_bron, s.catalogus[0].ia_gezocht, s.catalogus[1].cover_url || ''], ['Internet Archive', '2026-10-24', '']);
});

console.log('\nBeschrijvingen: Google via de browser, Wikipedia, achterkant');
test('Google via de browser: ook boeken met cover maar zonder beschrijving', () => {
  const s = maakStaat('2026-10-24');
  s.catalogus[0].cover_url = 'https://x.test/c.jpg';                                   // cover, geen beschrijving
  s.catalogus[1].cover_url = 'https://x.test/d.jpg'; s.catalogus[1].beschrijving = 'Al een tekst.'; // niets nodig
  const lijst = M.coversTeZoeken(s).boeken;
  const b1 = lijst.find((b) => b.id === 'B0001');
  gelijk([b1.g, b1.o, b1.i], [true, false, false]);
  assert.ok(!lijst.some((b) => b.id === 'B0002'));
  const r = M.coversBewaren(s, { items: [{ boek_id: 'B0001', google: true, meta: { beschrijving: 'Een mooie beschrijving van het boek.' } }] });
  gelijk([r.covers, r.beschrijvingen, s.catalogus[0].beschrijving, s.catalogus[0].cover_url, s.vertalingNodig], [0, 1, 'Een mooie beschrijving van het boek.', 'https://x.test/c.jpg', true]);
});
test('Google vervangt een beschrijving van Wikipedia, niet een eigen tekst', () => {
  const s = maakStaat('2026-10-25');
  Object.assign(s.catalogus[0], { cover_url: 'https://x.test/c.jpg', beschrijving: 'Tekst van Wikipedia.', beschrijving_en: 'Text from Wikipedia.',
    beschrijving_bron: 'https://nl.wikipedia.org/wiki/Verzonnen_boek', beschrijving_vertaald: '2026-10-24' });
  Object.assign(s.catalogus[1], { cover_url: 'https://x.test/d.jpg', beschrijving: 'Eigen tekst.', beschrijving_bron: '' });
  const lijst = M.coversTeZoeken(s).boeken;
  assert.ok(lijst.find((b) => b.id === 'B0001').g);
  assert.ok(!lijst.some((b) => b.id === 'B0002'));
  const r = M.coversBewaren(s, { items: [
    { boek_id: 'B0001', google: true, meta: { beschrijving: 'De omschrijving van de uitgever.' } },
    { boek_id: 'B0002', google: true, meta: { beschrijving: 'Andere tekst.' } }
  ] });
  const b = s.catalogus[0];
  gelijk([r.beschrijvingen, b.beschrijving, b.beschrijving_bron, b.beschrijving_en, b.beschrijving_vertaald, s.vertalingNodig],
    [1, 'De omschrijving van de uitgever.', '', '', '', true]);
  assert.strictEqual(s.catalogus[1].beschrijving, 'Eigen tekst.');
  // Vindt Google niets, dan blijft Wikipedia staan.
  const s2 = maakStaat();
  Object.assign(s2.catalogus[0], { beschrijving: 'Tekst van Wikipedia.', beschrijving_bron: 'https://en.wikipedia.org/wiki/X' });
  M.coversBewaren(s2, { items: [{ boek_id: 'B0001', google: true, meta: {} }] });
  gelijk([s2.catalogus[0].beschrijving, s2.catalogus[0].beschrijving_bron], ['Tekst van Wikipedia.', 'https://en.wikipedia.org/wiki/X']);
});
test('Wikipedia: enkel bij goede titel en vermelde auteur, met bronlink', () => {
  const boek = { titel: 'Giovanni\'s Room', auteur: 'Baldwin, James' };
  gelijk(M.kiesWikiTitels(boek, ['Giovanni\'s Room', 'James Baldwin', 'Giovanni\'s Room (novel)', 'Room']), ['Giovanni\'s Room', 'Giovanni\'s Room (novel)']);
  const goed = { type: 'standard', description: '1956 novel by James Baldwin', extract: 'Giovanni\'s Room is a 1956 novel by James Baldwin. The book focuses on the events in the life of an American man living in Paris.', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Giovanni%27s_Room' } } };
  assert.strictEqual(M.wikiSamenvattingOk(boek, goed), true);
  assert.strictEqual(M.wikiSamenvattingOk(boek, Object.assign({}, goed, { type: 'disambiguation' })), false);
  assert.strictEqual(M.wikiSamenvattingOk(boek, Object.assign({}, goed, { description: 'a room', extract: 'A room is any distinguishable space within a structure, usually separated from other spaces by walls.' })), false);
  assert.strictEqual(M.wikiLink(goed), 'https://en.wikipedia.org/wiki/Giovanni%27s_Room');
  assert.strictEqual(M.wikiLink({ content_urls: { desktop: { page: 'https://evil.test/wiki/x' } } }), '');
  assert.strictEqual(M.heeftWikiNodig({ titel: 'X', auteur: '' }), false);
});
test('website: bronvermelding enkel voor een link naar Wikipedia', () => {
  const s = maakStaat();
  s.catalogus[0].beschrijving = 'Tekst uit Wikipedia.'; s.catalogus[0].beschrijving_bron = 'https://nl.wikipedia.org/wiki/Voorbeeld';
  s.catalogus[1].beschrijving = 'Andere tekst.'; s.catalogus[1].beschrijving_bron = 'https://evil.test/x';
  const p = M.bouwPubliekeCatalogus(s, []);
  assert.strictEqual(p.boeken.find((b) => b.id === 'B0001').db, 'https://nl.wikipedia.org/wiki/Voorbeeld');
  assert.ok(!('db' in p.boeken.find((b) => b.id === 'B0002')));
  M.boekAanpassen(s, { boek_id: 'B0001', velden: { beschrijving: '' } });
  assert.strictEqual(s.catalogus[0].beschrijving_bron, '');
});
test('achterkant: tekst netjes, gesplitste woorden terug aan elkaar, alinea\'s blijven', () => {
  const ruw = 'Een roman over de ge-\nschiedenis van een\nqueer familie in Antwerpen.\n\nTweede   alinea\nhier.';
  assert.strictEqual(M.maakOcrTekstNetjes(ruw), 'Een roman over de geschiedenis van een queer familie in Antwerpen.\n\nTweede alinea hier.');
  assert.strictEqual(M.tekstUitFoto({ data: 'QUJD', mime: 'application/pdf' }, () => 'x').ok, false);
  assert.strictEqual(M.tekstUitFoto({ data: 'QUJD', mime: 'image/jpeg' }, () => 'kort').ok, false);
  const r = M.tekstUitFoto({ data: 'data:image/jpeg;base64,QUJD', mime: 'image/jpeg' }, () => ruw);
  gelijk([r.ok, r.tekst.slice(0, 18)], [true, 'Een roman over de ']);
  assert.strictEqual(M.ACTIES.beheerTekstUitFoto, 'vrijwilliger');
});

test('Internet Archive: logo herkennen aan de vorm, wissen enkel bij die bron', () => {
  // PNG van 180 x 180 (vierkant logo) en JPG van 300 x 450 (staande cover), enkel de koppen.
  const png = [0x89, 0x50, 0x4E, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 180, 0, 0, 0, 180, 8, 6];
  const jpg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0, 0xFF, 0xC0, 0, 17, 8, 1, 0xC2, 1, 0x2C, 3, 0, 0, 0, 0, 0, 0];
  gelijk(M.afbeeldingAfmetingen(png), { breedte: 180, hoogte: 180 });
  gelijk(M.afbeeldingAfmetingen(jpg), { breedte: 300, hoogte: 450 });
  assert.strictEqual(M.isStaandeCover(M.afbeeldingAfmetingen(png)), false);
  assert.strictEqual(M.isStaandeCover(M.afbeeldingAfmetingen(jpg)), true);
  assert.strictEqual(M.afbeeldingAfmetingen([1, 2, 3]), null);
  const s = maakStaat('2026-10-25');
  s.catalogus[0].cover_url = 'https://archive.org/services/img/x'; s.catalogus[0].cover_bron = 'Internet Archive'; s.catalogus[0].gb_gecontroleerd = '2026-10-24';
  s.catalogus[1].cover_url = 'https://x.test/eigen.jpg'; s.catalogus[1].cover_bron = 'foto in de bib';
  gelijk(M.iaCoversLijst(s).boeken.map((b) => b.id), ['B0001']);
  const r = M.iaCoversWissen(s, { ids: ['B0001', 'B0002'] });
  gelijk([r.gewist, s.catalogus[0].cover_url, s.catalogus[0].gb_gecontroleerd, s.catalogus[1].cover_url], [1, '', '', 'https://x.test/eigen.jpg']);
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

test('bezig-melding zegt dat je niets hoeft te doen', () => {
  const tekst = M.bezigTekst(null);
  assert.ok(tekst.indexOf('loopt al op de achtergrond') !== -1);
  assert.ok(tekst.indexOf('Logboek') !== -1);
  assert.ok(tekst.indexOf('gestart om') === -1);
});

test('Wikipedia-controle meldt dubbele kolommen en boek_ids', () => {
  assert.strictEqual(M.wikiDubbels(['titel', 'wiki_gezocht'], [{ boek_id: 'B1' }, { boek_id: 'B2' }]), '');
  assert.strictEqual(M.wikiDubbels(['wiki_gezocht', 'wiki_gezocht'], [{ boek_id: 'B1' }, { boek_id: 'B1' }, { boek_id: '' }]),
    ', 2 kolommen wiki_gezocht, 1 dubbele boek_id\'s');
});

test('Wikipedia: zoeken en eerste alinea in één antwoord', () => {
  const boek = { titel: 'Giovanni\'s Room', auteur: 'Baldwin, James' };
  const data = { query: { pages: [
    { title: 'James Baldwin', index: 2, extract: 'James Arthur Baldwin was an American writer and civil rights activist who wrote novels, essays and plays.', fullurl: 'https://en.wikipedia.org/wiki/James_Baldwin' },
    { title: 'Giovanni\'s Room', index: 1, extract: 'Giovanni\'s Room is a 1956 novel by James Baldwin. The book focuses on the events in the life of an American man living in Paris.', fullurl: 'https://en.wikipedia.org/wiki/Giovanni%27s_Room' }
  ] } };
  const paginas = M.wikiPaginas(data);
  gelijk(paginas.map((p) => p.titel), ['Giovanni\'s Room', 'James Baldwin']);
  const r = M.wikiKies(boek, paginas);
  assert.strictEqual(r.link, 'https://en.wikipedia.org/wiki/Giovanni%27s_Room');
  assert.ok(r.tekst.indexOf('1956 novel') > -1);
  // Een doorverwijspagina telt niet.
  data.query.pages[1].pageprops = { disambiguation: '' };
  gelijk(M.wikiKies(boek, M.wikiPaginas(data)), {});
  // Geen resultaten: Wikipedia stuurt dan geen query mee.
  gelijk(M.wikiPaginas({ batchcomplete: true }), []);
  assert.ok(M.wikiVraagUrl('nl', 'giovanni room baldwin').indexOf('https://nl.wikipedia.org/w/api.php?') === 0);
});

test('wiki_gezocht wordt als tekst bewaard, niet als datum', () => {
  assert.strictEqual(M.celWaarde('wiki_gezocht', '2026-10-25'), '2026-10-25');
  assert.ok(M.celWaarde('cover_gezocht', '2026-10-25') instanceof Date || Object.prototype.toString.call(M.celWaarde('cover_gezocht', '2026-10-25')) === '[object Date]');
});

test('bestuursscherm: boeken zonder beschrijving krijgen zb, de balie niet', () => {
  const s = maakStaat();
  s.catalogus[0].beschrijving = '';
  s.catalogus[1].beschrijving = 'Een verzonnen beschrijving.';
  const bestuur = M.baliecatalogus(s, {});
  assert.strictEqual(bestuur.find((b) => b.id === s.catalogus[0].boek_id).zb, true);
  assert.strictEqual(bestuur.find((b) => b.id === s.catalogus[1].boek_id).zb, undefined);
  assert.strictEqual(M.baliecatalogus(s).find((b) => b.id === s.catalogus[0].boek_id).zb, undefined);
});

test('Logboek en taken: stand per taak en nieuwste regels eerst', () => {
  const taken = [['taakA', 'Taak A', (r) => !r.klaar], ['taakB', 'Taak B', (r) => !r.klaar], ['taakC', 'Taak C', () => false], ['taakD', 'Taak D', (r) => !r.klaar]];
  const rijen = [{ klaar: true }, { klaar: false }, { klaar: false }];
  const stand = M.takenStand(taken, rijen, ['taakB'], { taakA: 1000 });
  gelijk(stand.map((t) => [t.functie, t.teGaan, t.status]), [['taakA', 2, 'loopt'], ['taakB', 2, 'gepland'], ['taakC', 0, 'klaar'], ['taakD', 2, 'stil']]);
  const waarden = [['tijdstip', 'wie', 'actie', 'details'],
    [new Date(2026, 9, 25, 9, 0), 'menu', 'oud', 'a'],
    [new Date(2026, 9, 25, 12, 0), 'menu', 'nieuw', 'b'],
    ['', '', '', ''],
    [new Date(2026, 9, 25, 10, 0), 'Kim', 'midden', 'c']];
  gelijk(M.laatsteLogregels(waarden, 2).map((r) => r.actie), ['nieuw', 'midden']);
  assert.ok(M.achtergrondTaken().every((t) => typeof t[2] === 'function'), 'Elke taak heeft een selectie');
});

test('geschiedenis per boek en per lener, wijzigingen uit het Logboek', () => {
  const s = maakStaat('2026-10-23');
  s.uitleningen = [
    { uitlening_id: 'U1', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-01-05', datum_terug: '2026-02-01' },
    { uitlening_id: 'U2', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '2', datum_uit: '2026-09-01', datum_terug: '' },
    { uitlening_id: 'U3', exemplaar: 'B0002-1', boek_id: 'B0002', lenersnummer: '1', datum_uit: '2026-03-10', datum_terug: '2026-04-01' }
  ];
  gelijk(M.boekHistoriek(s, 'B0001'), { keer: 2, laatst: '2026-09-01' });
  const l = M.lenerHistoriek(s, '1');
  gelijk(l.uitleningen.map((u) => u.titel), ['Twee kasten vol', 'De verzonnen zee']);
  assert.strictEqual(M.lenerHistoriek(s, '2').uitleningen.length, 0, 'Een lopende uitlening is geen geschiedenis');
  const log = [['tijdstip', 'wie', 'actie', 'details'],
    [new Date(2026, 9, 20), 'Kim', 'boek aangepast', 'B0001: beschrijving'],
    [new Date(2026, 9, 21), 'Kim', 'boek aangepast', 'B00011: titel'],
    [new Date(2026, 9, 22), 'Sam', 'cover-foto', 'B0001'],
    [new Date(2026, 9, 22), 'Sam', 'uitlenen', 'B0001-1']];
  gelijk(M.boekWijzigingen(log, 'B0001').map((r) => r.wie + ' ' + r.actie), ['Sam cover-foto', 'Kim boek aangepast']);
});

test('extra cijfers en meerdere boeken tegelijk aanpassen', () => {
  const s = maakStaat('2026-10-23');
  s.uitleningen = [
    { uitlening_id: 'U1', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-09-01', datum_terug: '2026-09-15' },
    { uitlening_id: 'U2', exemplaar: 'B0002-1', boek_id: 'B0002', lenersnummer: '2', datum_uit: '2026-10-01', datum_terug: '2026-10-21' }
  ];
  const c = M.extraCijfers(s);
  gelijk([c.gemiddeldeDagen, c.afgesloten, c.actieveLeners], [17, 2, 2]);
  assert.strictEqual(c.nieuweLeners.length, 12);
  assert.ok(c.nooitVoorbeelden.some((b) => b.boek_id === 'B0003'), 'B0003 werd nooit uitgeleend');
  assert.ok(!c.nooitVoorbeelden.some((b) => b.boek_id === 'Z0001'), 'Niet uitleenbaar telt niet');
  const r = M.boekenBulk(s, { ids: ['B0001', 'B0002', 'B9999'], veld: 'genre', waarde: 'Poëzie' });
  gelijk([r.ok, r.gelukt, r.fouten.length], [true, 2, 1]);
  gelijk([s.catalogus[0].genre, s.catalogus[1].genre], ['Poëzie', 'Poëzie']);
  assert.strictEqual(M.boekenBulk(s, { ids: ['B0001'], veld: 'titel', waarde: 'X' }).ok, false, 'Titel mag niet in bulk');
});

test('notities en de staat van een boek bij terugbrengen', () => {
  const s = maakStaat('2026-10-23');
  const u = uitleen(s, 'B0001-1', '1');
  const id = s.uitleningen[0].uitlening_id;
  const r = M.terugbrengen(s, { uitlening_id: id, borg_terugbetaald: true, staat_boek: 'beschadigd', opmerking: 'koffievlek' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(s.uitleningen[0].staat_terug, 'beschadigd: koffievlek');
  assert.ok(/2026-10-23 B0001-1: beschadigd: koffievlek/.test(s.catalogus[0].notitie), 'Schade in de notitie van het boek');
  // In orde: niets in de notitie van het boek.
  uitleen(s, 'B0002-1', '2');
  M.terugbrengen(s, { uitlening_id: s.uitleningen[1].uitlening_id, staat_boek: 'in orde' });
  assert.ok(!s.catalogus[1].notitie, 'Geen notitie bij in orde');
  // Een onbekende staat telt niet.
  uitleen(s, 'B0003-1', '3');
  M.terugbrengen(s, { uitlening_id: s.uitleningen[2].uitlening_id, staat_boek: 'verzonnen' });
  assert.ok(!s.uitleningen[2].staat_terug);
  // Notitie bij een lener, en in bestuurData, niet in de publieke catalogus.
  assert.strictEqual(M.lenerAanpassen(s, { lenersnummer: '1', voornaam: 'Sam', telefoon: '0470 00 00 01', email: '', notitie: 'Verhuist in december' }).ok, true);
  assert.strictEqual(M.bestuurGegevens(s, []).leners.find((l) => l.lenersnummer === '1').notitie, 'Verhuist in december');
  assert.ok(JSON.stringify(M.bouwPubliekeCatalogus(s, [])).indexOf('koffievlek') === -1, 'Notitie niet publiek');
  // Boek: notitie via het formulier, niet publiek
  assert.strictEqual(M.boekAanpassen(s, { boek_id: 'B0002', velden: { notitie: 'Staat op de bovenste plank' } }).ok, true);
  assert.strictEqual(s.catalogus[1].notitie, 'Staat op de bovenste plank');
  assert.ok(JSON.stringify(M.bouwPubliekeCatalogus(s, [])).indexOf('bovenste plank') === -1, 'Boeknotitie niet publiek');
  const c = M.bestuurCijfers(s, []);
  assert.ok(Array.isArray(c.meestGeleend) && c.extraCijfers.afgesloten === 3);
});

test('vrijwilligers: beschrijving voorstellen, goedkeuren en afkeuren', () => {
  const s = maakStaat('2026-10-23');
  const rijen = [];
  let n = 0;
  const id = () => 'V000' + (++n);
  assert.strictEqual(M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B0001', tekst: 'Te kort' }, id).ok, false);
  assert.strictEqual(M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B9999', tekst: 'x'.repeat(50) }, id).ok, false);
  const tekst = 'Een roman over een zee die niet bestaat, verteld door drie vrienden.';
  assert.strictEqual(M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B0001', tekst: tekst }, id).ok, true);
  // Een tweede voorstel voor hetzelfde boek vervangt het eerste.
  assert.strictEqual(M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B0001', tekst: tekst + ' Met een open einde.' }, id).ok, true);
  assert.strictEqual(rijen.length, 1);
  M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B0002', tekst: 'Essays over boeken, kasten en de mensen die ze vullen.' }, id);
  gelijk(M.voorgesteldeBoeken(rijen), ['B0001', 'B0002']);
  assert.ok(!s.catalogus[0].beschrijving, 'Nog niet in de Catalogus voor goedkeuring');
  assert.strictEqual(M.voorstelBehandelen(s, rijen, { voorstel_id: 'V0001', besluit: 'raar' }).ok, false);
  assert.strictEqual(M.voorstelBehandelen(s, rijen, { voorstel_id: 'V0001', besluit: 'goedgekeurd', tekst: 'Aangepaste tekst door het bestuur, lang genoeg.' }).ok, true);
  assert.strictEqual(s.catalogus[0].beschrijving, 'Aangepaste tekst door het bestuur, lang genoeg.');
  assert.strictEqual(rijen[0].status, 'goedgekeurd');
  assert.strictEqual(M.voorstelBehandelen(s, rijen, { voorstel_id: 'V0001', besluit: 'afgekeurd' }).ok, false, 'Al behandeld');
  assert.strictEqual(M.voorstelBehandelen(s, rijen, { voorstel_id: 'V0002', besluit: 'afgekeurd' }).ok, true);
  assert.ok(!s.catalogus[1].beschrijving);
  gelijk(M.openVoorstellen(rijen), []);
  // Een boek met een beschrijving krijgt geen voorstel meer.
  assert.strictEqual(M.maakBeschrijvingVoorstel(s, rijen, { boek_id: 'B0001', tekst: tekst }, id).ok, false);
});

test('vrijwilligers: iets melden, afhandelen en opruimen', () => {
  const rijen = [];
  let n = 0;
  const id = () => 'M000' + (++n);
  assert.strictEqual(M.maakMelding(rijen, { soort: 'verzonnen', bericht: 'Iets' }, 'Kim', '2026-10-01', id).ok, false);
  assert.strictEqual(M.maakMelding(rijen, { soort: 'boek kapot', bericht: '' }, 'Kim', '2026-10-01', id).ok, false);
  assert.strictEqual(M.maakMelding(rijen, { soort: 'boek kapot', onderwerp: 'B0001', bericht: 'Rug is gescheurd' }, 'Kim', '2026-06-01', id).ok, true);
  assert.strictEqual(M.maakMelding(rijen, { soort: 'andere', bericht: 'De lamp is stuk' }, 'Kim', '2026-06-01', id).ok, true);
  gelijk(M.openMeldingen(rijen).map((m) => m.melding_id), ['M0001', 'M0002']);
  assert.strictEqual(M.meldingAfhandelen(rijen, { melding_id: 'M0001' }, 'Bestuur', '2026-06-02').ok, true);
  gelijk(M.openMeldingen(rijen).map((m) => m.melding_id), ['M0002']);
  // Enkel afgehandelde meldingen gaan weg, open meldingen blijven.
  assert.strictEqual(M.ruimMeldingenOpRijen(rijen, '2026-10-23', 90), 1);
  gelijk([rijen[0]._verwijderen, rijen[1]._verwijderen], [true, undefined]);
});

test('vrijwilligers: checklist uit de instellingen', () => {
  gelijk(M.checklistPunten('- Licht aan\n\n2. Kassa klaar\n• Deur open'), ['Licht aan', 'Kassa klaar', 'Deur open']);
  const c = M.shiftChecklist(instellingen({}));
  assert.ok(c.openen.length > 1 && c.sluiten.length > 1, 'Standaard checklist');
});

test('bestuur bekijkt het vrijwilligersscherm met de rechten van een vrijwilliger', () => {
  assert.strictEqual(M.rolVoorScherm('bestuur', 'vrijwilliger'), 'vrijwilliger');
  assert.strictEqual(M.rolVoorScherm('bestuur', ''), 'bestuur');
  assert.strictEqual(M.rolVoorScherm('balie', 'vrijwilliger'), 'balie', 'Nooit meer rechten');
  assert.strictEqual(M.rolVoorScherm('vrijwilliger', 'bestuur'), 'vrijwilliger', 'Nooit meer rechten');
  assert.strictEqual(M.magActie(M.rolVoorScherm('bestuur', 'vrijwilliger'), 'bestuurData'), false);
});

test('vrijwilligers: briefjes voor de volgende shift', () => {
  const rijen = [];
  let n = 0;
  const id = () => 'N000' + (++n);
  assert.strictEqual(M.maakBriefje(rijen, { tekst: '' }, 'Kim', '2026-10-20', id).ok, false);
  assert.strictEqual(M.maakBriefje(rijen, { tekst: 'De printer is stuk.' }, 'Kim', '2026-10-08', id).ok, true);
  assert.strictEqual(M.maakBriefje(rijen, { tekst: 'Boek ligt apart achter de balie.' }, 'Ilo', '2026-10-20', id).ok, true);
  // Na 14 dagen niet meer op Vandaag.
  gelijk(M.openBriefjes(rijen, '2026-10-23').map((b) => b.briefje_id), ['N0002']);
  gelijk(M.openBriefjes(rijen, '2026-10-20').map((b) => b.briefje_id), ['N0002', 'N0001'], 'Nieuwste eerst');
  assert.strictEqual(M.briefjeWeg(rijen, { briefje_id: 'N0002' }, 'Sam', '2026-10-23').ok, true);
  gelijk(M.openBriefjes(rijen, '2026-10-23'), []);
  assert.strictEqual(M.ruimBriefjesOpRijen(rijen, '2026-12-10', 60), 1);
  assert.strictEqual(instellingen({}).briefjes_bewaren_dagen, 60);
});

test('vrijwilligers: mijn voorstellen en meldingen, en terug te zetten', () => {
  const voorstellen = [
    { voorstel_id: 'V0001', datum: '2026-10-20', titel: 'De verzonnen zee', voorgesteld_door: 'Kim', status: 'goedgekeurd', datum_behandeld: '2026-10-21' },
    { voorstel_id: 'V0002', datum: '2026-10-20', titel: 'Stille lichten', voorgesteld_door: 'Ilo', status: 'nieuw' },
    { voorstel_id: 'V0003', datum: '2026-01-01', titel: 'Oud', voorgesteld_door: 'Kim', status: 'afgekeurd' }
  ];
  const meldingen = [{ melding_id: 'M0001', datum: '2026-10-22', wie: 'kim', soort: 'boek kapot', onderwerp: 'B0001', bericht: 'Geheim', status: 'nieuw' }];
  const m = M.mijnBijdragen(voorstellen, meldingen, 'Kim V.', '2026-10-23');
  gelijk(m.voorstellen.map((v) => v.titel + ':' + v.status), ['De verzonnen zee:goedgekeurd']);
  gelijk(m.meldingen.map((x) => x.soort + ':' + x.status), ['boek kapot:nieuw']);
  assert.ok(JSON.stringify(m).indexOf('Geheim') === -1, 'De tekst van een melding hoort er niet bij');
  // Terug te zetten: enkel wat vandaag terugkwam, zonder lener.
  const s = maakStaat('2026-10-23');
  uitleen(s, 'B0001-1', '1');
  uitleen(s, 'B0003-1', '2');
  M.terugbrengen(s, { uitlening_id: s.uitleningen[0].uitlening_id, staat_boek: 'in orde' });
  const terug = M.vandaagTerug(s, M.vertaalTabel([{ genre: 'Roman', filtergroepen: 'Fictie' }]));
  gelijk(terug.map((t) => t.exemplaar + ':' + t.onderwerp), ['B0001-1:Fictie']);
  assert.ok(JSON.stringify(terug).indexOf('Sam') === -1 && !('lenersnummer' in terug[0]), 'Geen lener');
});

test('daglimiet van Google: wachten, herkennen en het laatste rooster tonen', () => {
  const uur = 3600000;
  assert.strictEqual(M.daglimietWachttijd(0, 10 * uur), 0, 'Geen limiet genoteerd');
  assert.strictEqual(M.daglimietWachttijd(10 * uur, 12 * uur), 4 * uur);
  assert.strictEqual(M.daglimietWachttijd(10 * uur, 17 * uur), 0, 'Na 6 uur niet meer wachten');
  assert.ok(M.isDaglimietFout(new Error('Service is te vaak aangeroepen voor één dag: urlfetch.')));
  assert.ok(M.isDaglimietFout(new Error('Service invoked too many times for one day: urlfetch.')));
  assert.ok(!M.isDaglimietFout(new Error('Address unavailable')));
  // Geen bewaarde versie: een duidelijke fout.
  const geen = M.laatsteRooster(null, '2026-10-25', true);
  assert.ok(!geen.ok && /daglimiet/.test(geen.fout));
  // Wel een bewaarde versie: zonder de avonden die voorbij zijn, met de tijd erbij.
  const bewaard = JSON.stringify({ tijd: 123, data: { gekoppeld: true, link: 'x', vandaag: '2026-10-20', nietGepubliceerd: [],
    avonden: [{ datum: '2026-10-23', vrijwilligers: ['Kim'] }, { datum: '2026-10-30', vrijwilligers: ['Ilo'] }] } });
  const r = M.laatsteRooster(bewaard, '2026-10-25', true);
  assert.ok(r.ok && r.data.verouderd.tijd === 123 && /daglimiet/.test(r.data.verouderd.reden));
  gelijk(r.data.avonden.map((a) => a.datum), ['2026-10-30']);
  assert.strictEqual(r.data.vandaag, '2026-10-25');
});

test('Internet Archive: boeken van vandaag zonder cover opnieuw opzoeken', () => {
  const rijen = [
    { boek_id: 'B0001', cover_url: '', ia_gezocht: '2026-10-25' },
    { boek_id: 'B0002', cover_url: 'https://archive.org/verzonnen.jpg', ia_gezocht: '2026-10-25' },
    { boek_id: 'B0003', cover_url: '', ia_gezocht: '2026-10-24' },
    { boek_id: 'B0004', cover_url: '', ia_gezocht: '' }
  ];
  gelijk(M.iaZonderCoverOp(rijen, '2026-10-25').map((b) => b.boek_id), ['B0001']);
});

test('instellingen: vijf blokken in vaste volgorde, codes onderaan, elke instelling één keer', () => {
  const blokken = M.INSTELLING_GROEPEN.map((g) => g[0].split(':')[0]).filter((b, i, l) => l.indexOf(b) === i);
  gelijk(blokken, ['Uitlenen', 'Vrijwilligers', 'Website', 'Privacy', 'Techniek']);
  const alle = [].concat.apply([], M.INSTELLING_GROEPEN.map((g) => g[1]));
  assert.strictEqual(alle.length, new Set(alle).size, 'Een instelling staat in twee groepen');
  const privacy = M.INSTELLING_GROEPEN.find((g) => /^Privacy/.test(g[0]))[1];
  ['bewaartermijn_afgesloten_uitleningen_maanden', 'aanvragen_bewaren_dagen', 'meldingen_bewaren_dagen'].forEach((k) => assert.ok(privacy.indexOf(k) > -1, k));
});

console.log('\nFilms');
test('films: Letterboxd-lijst lezen (oude en nieuwe opmaak)', () => {
  const html = '<li class="poster-container"><div class="film-poster" data-film-id="1" data-film-slug="verzonnen-zee-1999" data-target-link="/film/verzonnen-zee-1999/">' +
    '<img alt="De verzonnen zee" class="image"></div></li>' +
    '<li><div class="react-component" data-component-class="LazyPoster" data-item-name="Stille &amp; lichten (2021)" data-item-slug="stille-lichten" data-item-link="/film/stille-lichten/"></div></li>' +
    '<li><div data-film-slug="verzonnen-zee-1999"></div></li>';
  gelijk(M.letterboxdFilms(html), [
    { slug: 'verzonnen-zee-1999', titel: 'De verzonnen zee', jaar: '' },
    { slug: 'stille-lichten', titel: 'Stille & lichten', jaar: 2021 }
  ]);
  assert.strictEqual(M.letterboxdPaginaUrl('https://letterboxd.com/iemand/list/lijst', 2), 'https://letterboxd.com/iemand/list/lijst/page/2/');
  assert.strictEqual(M.letterboxdPaginaUrl('https://letterboxd.com/iemand/list/lijst/', 1), 'https://letterboxd.com/iemand/list/lijst/');
  assert.ok(M.isLetterboxdLijst('https://letterboxd.com/iemand/list/lijst/') && !M.isLetterboxdLijst('https://voorbeeld.test/lijst'));
});

test('films: in de Catalogus als soort film, zonder dubbels', () => {
  const rijen = [{ boek_id: 'F0001', soort: 'film', titel: 'De verzonnen zee', jaartal: 1999, letterboxd: 'verzonnen-zee-1999' }];
  let n = 1;
  const id = (soort) => (soort === 'film' ? 'F' : 'B') + String(++n).padStart(4, '0');
  const nieuw = M.voegFilmsToe(rijen, [
    { slug: 'verzonnen-zee-1999', titel: 'De verzonnen zee', jaar: 1999 },
    { slug: 'stille-lichten', titel: 'Stille lichten', jaar: 2021 },
    { slug: 'stille-lichten', titel: 'Stille lichten', jaar: 2021 }
  ], '2026-10-25', id);
  assert.strictEqual(nieuw, 1);
  const f = rijen[1];
  gelijk([f.boek_id, f.soort, f.uitleenbaar, f.letterboxd, f.toegevoegd_op], ['F0002', 'film', 'ja', 'stille-lichten', '2026-10-25']);
  assert.ok(M.heeftFilmGegevensNodig(f) && !M.heeftWikiNodig(Object.assign({ auteur: 'Iemand' }, f)), 'Films niet bij de boekentaken');
  assert.ok(!M.heeftAndereUitgaveNodig(f), 'Geen boekcover voor een film');
});

test('films: Wikidata lezen en enkel lege velden aanvullen', () => {
  const data = { results: { bindings: [{
    film: { value: 'http://www.wikidata.org/entity/Q123' }, lb: { value: 'stille-lichten' }, jaar: { value: '2021' }, minuten: { value: '104.0' },
    regie: { value: 'Noor Aerts|Noor Aerts|Ilo Claes' }, land: { value: 'België|Nederland' }, genre: { value: 'dramafilm|LGBT-gerelateerde film|komedie|thriller|western' },
    taal: { value: 'Nederlands' }, nlTitel: { value: 'Stille lichten' }
  }] } };
  const [f] = M.filmUitWikidata(data);
  gelijk([f.qid, f.jaar, f.duur, f.regie, f.land, f.genre.length, f.nl, f.en], ['Q123', 2021, 104, ['Noor Aerts', 'Ilo Claes'], ['België', 'Nederland'], 4, 'Stille lichten', '']);
  const v = M.filmVelden({ titel: 'Stille lichten', land: 'Frankrijk' }, f);
  gelijk([v.auteur, v.jaartal, v.land, v.genre, v.duur, v.wikidata], ['Noor Aerts, Ilo Claes', 2021, undefined, 'Dramafilm, LGBT-gerelateerde film, Komedie, Thriller', 104, 'Q123']);
  assert.strictEqual(M.kiesFilm({ jaartal: 2010 }, [f]), null, 'Ander jaartal: niet deze film');
  assert.strictEqual(M.kiesFilm({}, [f, f]), null, 'Twee kandidaten zonder jaartal: geen keuze');
  assert.ok(/P6127/.test(M.filmVraagLetterboxd(['a"b'])) && /"a\\"b"/.test(M.filmVraagLetterboxd(['a"b'])), 'Aanhalingstekens ontsnapt');
  assert.ok(/ABS\(YEAR\(\?datum\) - 2021\)/.test(M.filmVraagTitel('Stille lichten', 2021)));
  const w = M.filmWikiTekst({ query: { pages: [{ title: 'Stille lichten', extract: 'Stille lichten is een verzonnen Belgische film uit 2021 over twee vrienden die samen een vuurtoren opknappen.', fullurl: 'https://nl.wikipedia.org/wiki/Stille_lichten' }] } });
  assert.ok(w.tekst && w.link === 'https://nl.wikipedia.org/wiki/Stille_lichten');
  gelijk(M.filmWikiTekst({ query: { pages: [{ missing: true }] } }), {});
});

test('films: verborgen tot films_tonen, kijktip en te koop, uitlenen aan de balie', () => {
  const s = maakStaat('2026-10-25');
  s.catalogus.push(
    { boek_id: 'F0001', soort: 'film', titel: 'De verzonnen zee', auteur: 'Noor Aerts', jaartal: 1999, land: 'België, Nederland', duur: 98, genre: 'Drama, Romantiek', aantal: 1, uitleenbaar: 'ja', publiek: 'ja' },
    { boek_id: 'F0002', soort: 'film', titel: 'Stille lichten', film_tip: 'ja', publiek: 'ja' },
    { boek_id: 'F0003', soort: 'film', titel: 'Glitterfilm', te_koop: 'ja', publiek: 'ja' });
  const ids = (c) => c.boeken.map((b) => b.id).filter((x) => x[0] === 'F');
  gelijk(ids(M.bouwPubliekeCatalogus(s, [])), [], 'Verborgen voor bezoekers');
  assert.ok(!M.bouwPubliekeCatalogus(s, []).filmsTonen);
  const voorbeeld = M.bouwPubliekeCatalogus(s, [], [], { enkelFilms: true });
  gelijk(voorbeeld.boeken.map((b) => b.id), ['F0001', 'F0002', 'F0003'], 'Voorbeeld voor het bestuur: enkel films');
  const [f1, f2, f3] = voorbeeld.boeken;
  gelijk([f1.s, f1.a, f1.la, f1.du, f1.g, f1.b.c], ['film', 'Noor Aerts', 'België, Nederland', 98, ['Drama', 'Romantiek'], 'beschikbaar']);
  gelijk([f2.tip, f2.b.c], [1, 'tip']);
  gelijk([f3.b.c, f3.b.k], ['niet_uitleenbaar', 1]);
  const zichtbaar = M.bouwPubliekeCatalogus(maakStaat('2026-10-25', { films_tonen: 'ja' }), []);
  assert.ok(zichtbaar.filmsTonen === true);
  // Uitlenen: een film als een boek, een kijktip niet.
  assert.strictEqual(uitleen(s, 'F0001-1', '1').ok, true);
  assert.strictEqual(uitleen(s, 'F0002-1', '2').ok, false);
  // Filmgenres komen niet in de vertaaltabel Onderwerpen.
  const onderwerpen = [];
  M.vulOnderwerpenAan(onderwerpen, s.catalogus);
  assert.ok(!onderwerpen.some((o) => /drama/i.test(o.genre)), 'Filmgenre in Onderwerpen');
  // Een verborgen film kan je niet via de website aanvragen.
  const a = M.maakAanvraag({ inst: instellingen({ online_reserveren: 'ja' }), vandaag: '2026-10-25', catalogus: s.catalogus, aanvragen: [] },
    { boek_id: 'F0001', voornaam: 'Kim', contact: 'kim@voorbeeld.test', toestemming: true }, () => 'A0001');
  assert.strictEqual(a.ok, false);
});

test('films: export van IMDb of Letterboxd uit een tabblad', () => {
  const imdb = [
    ['Position', 'Const', 'Created', 'Modified', 'Description', 'Title', 'Original Title', 'URL', 'Title Type', 'IMDb Rating', 'Runtime (mins)', 'Year', 'Genres', 'Num Votes', 'Release Date', 'Directors'],
    [1, 'tt0000001', '', '', '', 'Glitter op de dijk', 'Glitter on the dyke', 'https://www.imdb.com/title/tt0000001/', 'Movie', 7.1, 96, 2019, 'Drama, Romance, Sci-Fi', 100, '', 'Noor Aerts'],
    [2, 'tt0000002', '', '', '', 'Een aflevering', '', '', 'TV Episode', 7, 30, 2020, 'Comedy', 1, '', 'Iemand'],
    [3, 'tt0000003', '', '', '', 'Het lange weekend', '', '', 'Movie', 6, 104, 1987, 'Drama', 1, '', 'Ilo Claes, Jo Dewit']
  ];
  const films = M.filmsUitTabel(imdb);
  gelijk(films.map((f) => [f.titel, f.jaar, f.imdb, f.regie, f.genre, f.duur]), [
    ['Glitter op de dijk', 2019, 'tt0000001', 'Noor Aerts', 'Drama, Romantiek, Sciencefiction', 96],
    ['Het lange weekend', 1987, 'tt0000003', 'Ilo Claes, Jo Dewit', 'Drama', 104]
  ]);
  const lb = M.filmsUitTabel([['Position', 'Name', 'Year', 'URL', 'Description'], [1, 'Stille lichten', 2021, 'https://boxd.it/verzonnen', '']]);
  gelijk(lb.map((f) => [f.titel, f.jaar]), [['Stille lichten', 2021]]);
  assert.strictEqual(M.filmsUitTabel([['Iets', 'Anders'], [1, 2]]), null, 'Geen lijst met films');
  // In de Catalogus, zonder dubbels: ook niet bij hetzelfde IMDb-nummer met een andere schrijfwijze.
  const rijen = [{ boek_id: 'F0001', soort: 'film', titel: 'Glitter op de Dijk!', imdb: 'tt0000001' }];
  let n = 1;
  assert.strictEqual(M.voegFilmsToe(rijen, films, '2026-10-25', () => 'F' + String(++n).padStart(4, '0')), 1);
  gelijk([rijen[1].titel, rijen[1].auteur, rijen[1].genre, rijen[1].duur, rijen[1].imdb], ['Het lange weekend', 'Ilo Claes, Jo Dewit', 'Drama', 104, 'tt0000003']);
  assert.strictEqual(films[0].origineel, 'Glitter on the dyke');
  assert.strictEqual(rijen[1].originele_titel, '', 'Geen originele titel als die dezelfde is');
  assert.strictEqual(M.andereTitel('Carol', 'carol!'), '');
  assert.strictEqual(M.andereTitel('Portret van een vrouw in vuur', 'Portrait de la jeune fille en feu'), 'Portrait de la jeune fille en feu');
  const s2 = maakStaat('2026-10-25', { films_tonen: 'ja' });
  s2.catalogus.push({ boek_id: 'F0009', soort: 'film', titel: 'Stemmen in de nacht', originele_titel: 'Voix dans la nuit', publiek: 'ja' });
  assert.strictEqual(M.bouwPubliekeCatalogus(s2, []).boeken.find((b) => b.id === 'F0009').ot, 'Voix dans la nuit');
  const wv = M.filmVelden({ titel: 'Stemmen in de nacht' }, { qid: 'Q1', regie: [], land: [], genre: [], origineel: 'Voix dans la nuit' });
  assert.strictEqual(wv.originele_titel, 'Voix dans la nuit');
  assert.ok(/P345/.test(M.filmVraagImdb(['tt0000003'])));
  // Wikidata vult enkel aan wat de export niet had.
  const v = M.filmVelden(rijen[1], { qid: 'Q9', regie: ['Iemand anders'], jaar: 1987, land: ['Nederland'], genre: ['dramafilm'], duur: 100, taal: '', nl: '', en: '' });
  gelijk([v.auteur, v.genre, v.duur, v.land], [undefined, undefined, undefined, 'Nederland']);
  assert.ok(/IMDb of Letterboxd/.test(M.daglimietFilmTekst(2 * 3600000)) && /2 uur/.test(M.daglimietFilmTekst(2 * 3600000)));
});

test('films: duur in een kolom met datumopmaak blijft het aantal minuten', () => {
  // 96 in een cel met datumopmaak geeft in Apps Script een datum: 5 april 1900.
  assert.strictEqual(M.datumNaarGetal(new Date(1900, 3, 5)), 96);
  assert.strictEqual(M.datumNaarGetal(new Date(1900, 0, 1)), 2);
  assert.ok(M.GETALKOLOMMEN.indexOf('duur') > -1);
});

test('daglimiet: de films herstarten eerst, de andere taken een half uur later', () => {
  const uur = 3600000;
  assert.strictEqual(M.herstartNaDaglimiet('vulFilmsAan', 2 * uur), 2 * uur);
  assert.strictEqual(M.herstartNaDaglimiet('zoekCoversInternetArchive', 2 * uur), 2.5 * uur);
  assert.strictEqual(M.herstartNaDaglimiet('zoekBeschrijvingenWikipedia', 6 * uur), 6.5 * uur);
  // Na 6 uur: de films meteen, de andere taken nog een half uur wachten.
  assert.strictEqual(M.wachtVoorTaak('vulFilmsAan', 10 * uur, 16 * uur), 0);
  assert.strictEqual(M.wachtVoorTaak('vulAanUitGoogleBooks', 10 * uur, 16 * uur), 0.5 * uur);
  assert.strictEqual(M.wachtVoorTaak('vulAanUitGoogleBooks', 10 * uur, 17 * uur), 0);
  assert.strictEqual(M.wachtVoorTaak('vulAanUitGoogleBooks', 0, 17 * uur), 0, 'Geen daglimiet genoteerd');
});

test('uitlening aanpassen: termijn met dagen verschuiven, verlenging en uitlening annuleren', () => {
  const s = maakStaat();
  uitleen(s, 'B0001', '1');
  const u = s.uitleningen[0];
  // +7 dagen: van vrijdag 20/11 naar vrijdag 27/11. Telt niet als verlenging.
  let r = M.vervaldatumAanpassen(s, { uitlening_id: u.uitlening_id, dagen: 7 });
  gelijk([r.ok, u.vervaldatum, Number(u.aantal_verlengingen)], [true, '2026-11-27', 0]);
  // +3 dagen schuift door naar de volgende openingsdag (vrijdag).
  r = M.vervaldatumAanpassen(s, { uitlening_id: u.uitlening_id, dagen: 3 });
  assert.strictEqual(u.vervaldatum, '2026-12-04');
  assert.strictEqual(M.vervaldatumAanpassen(s, { uitlening_id: u.uitlening_id, dagen: 'veel' }).ok, false);
  assert.strictEqual(M.vervaldatumAanpassen(s, { uitlening_id: u.uitlening_id, dagen: -100 }).ok, false, 'Niet voor de uitleendatum');
  // Verlengen en de verlenging annuleren: de vorige datum komt terug.
  M.verlengen(s, { uitlening_id: u.uitlening_id });
  assert.strictEqual(u.vervaldatum, '2027-01-01');
  r = M.annuleerVerlenging(s, { uitlening_id: u.uitlening_id });
  gelijk([r.ok, u.vervaldatum, u.aantal_verlengingen], [true, '2026-12-04', 0]);
  assert.strictEqual(M.annuleerVerlenging(s, { uitlening_id: u.uitlening_id }).ok, false, 'Geen verlenging meer');
  // Een oude verlenging zonder vorige_vervaldatum: terug naar de oorspronkelijke datum.
  const s2 = maakStaat();
  uitleen(s2, 'B0001', '1');
  const u2 = s2.uitleningen[0];
  M.verlengen(s2, { uitlening_id: u2.uitlening_id });
  u2.vorige_vervaldatum = '';
  assert.strictEqual(M.annuleerVerlenging(s2, { uitlening_id: u2.uitlening_id }).ok, true);
  assert.strictEqual(u2.vervaldatum, '2026-11-20');
  // Uitlening annuleren: weg, borg terug, het boek is weer beschikbaar.
  r = M.annuleerUitlening(s, { uitlening_id: u.uitlening_id }, false);
  assert.ok(r.ok && /borg van 5 euro terug/.test(r.tekst), r.tekst);
  assert.ok(u._verwijderen, 'Uitlening gemarkeerd om te wissen');
  assert.strictEqual(M.beschikbaarheid(s, s.catalogus[0]).code, 'beschikbaar');
  assert.strictEqual(M.annuleerUitlening(s, { uitlening_id: 'U99999' }, false).ok, false);
});

test('uitlening annuleren: reservatie terug open, en oude uitleningen enkel door het bestuur', () => {
  const s = maakStaat('2026-10-23');
  uitleen(s, 'B0001', '1');
  M.reserveren(s, { boek_id: 'B0001', lenersnummer: '2' });
  // Lener 2 haalt het boek op na het terugbrengen.
  M.terugbrengen(s, { uitlening_id: s.uitleningen[0].uitlening_id, borg_terugbetaald: true });
  const r = uitleen(s, 'B0001-1', '2');
  assert.strictEqual(r.ok, true, r.fout);
  assert.strictEqual(s.reservaties[0].status, 'afgehaald');
  const tweede = s.uitleningen[1];
  const a = M.annuleerUitlening(s, { uitlening_id: tweede.uitlening_id }, false);
  assert.ok(a.ok);
  assert.notStrictEqual(s.reservaties[0].status, 'afgehaald', 'Reservatie terug open');
  assert.ok(a.apartLeggen.length === 1, 'Het boek ligt terug apart voor lener 2');
  // Na 7 dagen: enkel het bestuur.
  const oud = maakStaat('2026-11-10');
  oud.uitleningen.push({ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-10-23', vervaldatum: '2026-11-20', datum_terug: '' });
  assert.strictEqual(M.annuleerUitlening(oud, { uitlening_id: 'U00001' }, false).ok, false);
  assert.strictEqual(M.annuleerUitlening(oud, { uitlening_id: 'U00001' }, true).ok, true);
  gelijk([M.ACTIES.vervaldatumAanpassen, M.ACTIES.annuleerUitlening, M.ACTIES.annuleerVerlenging], ['bestuur', 'vrijwilliger', 'vrijwilliger']);
});

test('vaste events: elke maand terug, in de agenda en bij het rooster', () => {
  const lijst = M.vasteEventsUitTekst('Leesavond: tweede vrijdag\nSoepcafé: laatste vrijdag\nfout zonder dubbelpunt\nIets: vijftigste vrijdag');
  gelijk(lijst.map((e) => [e.naam, e.week, e.dag]), [['Leesavond', 2, 5], ['Soepcafé', 5, 5]]);
  gelijk(M.vasteEventsOp('2026-11-13', lijst), ['Leesavond']);
  gelijk(M.vasteEventsOp('2026-11-27', lijst), ['Soepcafé']);
  gelijk(M.vasteEventsOp('2026-11-20', lijst), []);
  const inst = { tekst_vaste_events: 'Leesavond: tweede vrijdag\nSoepcafé: laatste vrijdag' };
  const agenda = M.vasteEventsVoorAgenda(inst, '2026-10-25', [{ datum: '2026-10-30', titel: 'Soepcafé' }]);
  gelijk(agenda.map((e) => e.datum + ' ' + e.titel.nl), ['2026-11-13 Leesavond'], 'Eigen event vervangt de automatische datum');
  const avonden = M.vulVasteEventsAan([{ datum: '2026-11-13', event: '' }, { datum: '2026-11-27', event: 'Eigen event' }], inst);
  gelijk(avonden.map((a) => a.event), ['Leesavond', 'Eigen event']);
});

test('oud rooster: een tabblad per maand wordt het archief Shifts, met cijfers per vrijwilliger', () => {
  const blad = [
    ['', '', '', '', '', "Mei '26", '', '', ''],
    ['', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY', ''],
    ['', '', '', '', '', 1, 2, 3, ''],
    ['events', '', '', '', '', '', '', '', ''],
    ['bib', '', '', '', '', 'GESLOTEN!', '', '', ''],
    ['backup', '', '', '', '', '', '', '', ''],
    ['', 4, 5, 6, 7, 8, 9, 10, ''],
    ['events', '', '', '', '', 'Leesavond', '', '', ''],
    ['bib', '', '', '', '', 'Kim & Ilo', '', '', ''],
    ['backup', '', '', '', '', '(Sam?)', '', '', ''],
    ['', 11, 12, 13, 14, 15, 16, 17, ''],
    ['events', '', '', '', '', '', '', '', ''],
    ['bib', '', '', '', '', 'kim / Jo', '', '', ''],
    ['backup', '', '', '', '', '...', '', '', ''],
    ['', 25, 26, 27, 28, '', '', '', ''],
    ['bib', '', '', '', '', 'Niemand', '', '', '']
  ];
  const shifts = M.shiftsUitMaandblad(blad, 'mei 26');
  gelijk(shifts.map((x) => [x.datum, x.rol, x.naam, x.event]), [
    ['2026-05-01', 'gesloten', '', ''],
    ['2026-05-08', 'bib', 'Kim', 'Leesavond'], ['2026-05-08', 'bib', 'Ilo', 'Leesavond'], ['2026-05-08', 'backup', 'Sam', 'Leesavond'],
    ['2026-05-15', 'bib', 'kim', ''], ['2026-05-15', 'bib', 'Jo', '']
  ]);
  assert.strictEqual(M.shiftsUitMaandblad([['Iets anders']], 'Catalogus'), null);
  gelijk(M.maandUitTitel("Sept '26"), { jaar: 2026, maand: 9 });
  gelijk(M.maandUitTitel('febr 26'), { jaar: 2026, maand: 2 });
  const rijen = [];
  assert.strictEqual(M.voegShiftsToe(rijen, shifts), 6);
  assert.strictEqual(M.voegShiftsToe(rijen, shifts), 0, 'Geen dubbels');
  const c = M.shiftCijfers(rijen, 2026);
  gelijk(c.personen.map((p) => [p.naam, p.bib, p.backup]), [['Kim', 2, 0], ['Ilo', 1, 0], ['Jo', 1, 0], ['Sam', 0, 1]]);
  gelijk(c.dicht, [{ datum: '2026-05-01', rol: 'gesloten' }]);
  gelijk(M.shiftCijfers(rijen, 2025).personen, []);
});

console.log('\n' + geslaagd + ' geslaagd, ' + mislukt.length + ' mislukt');
if (mislukt.length) process.exit(1);
