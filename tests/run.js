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
  const nieuw = M.vulOnderwerpenAan(rijen, [{ genre: 'Young Adult' }, { genre: 'Young Adult' }, { genre: 'young adult' }, { genre: 'Erotica' }, { genre: 'erotica' }]);
  assert.strictEqual(nieuw, 2);
  const ya = rijen.find((r) => r.genre.toLowerCase() === 'young adult');
  assert.strictEqual(ya.aantal_boeken, 3);
  assert.strictEqual(ya.filtergroepen, 'Young Adult');
  assert.strictEqual(rijen.find((r) => r.genre.toLowerCase() === 'erotica').filtergroepen, 'Erotica en BDSM');
});

test('thema\'s: Geschiedenis, Maatschappij en Religie en Spiritualiteit apart', () => {
  gelijk(M.stelFiltergroepenVoor('Geschiedenis'), ['Geschiedenis']);
  gelijk(M.stelFiltergroepenVoor('Politiek'), ['Politiek']);
  gelijk(M.stelFiltergroepenVoor('Religie'), ['Religie en Spiritualiteit']);
  gelijk(M.stelFiltergroepenVoor('Spiritualiteit'), ['Religie en Spiritualiteit']);
  const rijen = [
    { genre: 'Geschiedenis', filtergroepen: 'Geschiedenis en maatschappij' },
    { genre: 'Essay', filtergroepen: 'Geschiedenis en maatschappij, Feminisme' },
    { genre: 'Religie', filtergroepen: 'Geschiedenis en maatschappij' },
    { genre: 'Verzonnen genre', filtergroepen: 'Geschiedenis en maatschappij' },
    { genre: 'Spiritualiteit', filtergroepen: '' },
    { genre: 'Roman', filtergroepen: 'Fictie' }
  ];
  gelijk(M.verdeelOudeGroep(rijen), { aangepast: 5, religie: 2 });
  gelijk(rijen.map((r) => r.filtergroepen), ['Geschiedenis', 'Feminisme, Maatschappij', 'Religie en Spiritualiteit', 'Maatschappij', 'Religie en Spiritualiteit', 'Fictie']);
  gelijk(M.verdeelOudeGroep(rijen), { aangepast: 0, religie: 0 }, 'Opnieuw: niets meer te doen');
  assert.ok(M.FILTERGROEPEN.indexOf('Geschiedenis en maatschappij') === -1 && M.FILTERGROEPEN.indexOf('Religie en Spiritualiteit') > -1);
});

test('filtergroepen: vertaaltabel, extra onderwerpen, klassieker en zines', () => {
  const v2 = M.vertaalTabel([{ genre: 'Politiek', filtergroepen: 'Maatschappij' }]);
  gelijk(M.filtergroepenVan({ genre: '', extra_onderwerpen: 'Politiek, intersex, Iets onbekends, FICTIE', soort: 'boek' }, v2), ['Politiek', 'Gender', 'Intersekse', 'Fictie'], 'enkel vaste thema\'s');
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
    ['toegangscode_balie', 'geheim1', ''],
    ['tekst_toegankelijkheid', '', ''],
    ['code_bestuur', '', '']
  ]);
  const waarde = (s) => r.rijen.find((x) => x[0] === s);
  assert.ok(/Peperfabriek/.test(waarde('tekst_toegankelijkheid')[1]), 'een lege tekst krijgt de standaardtekst');
  assert.strictEqual(waarde('code_bestuur')[1], '', 'een lege code blijft leeg (installeer vult ze apart in)');
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
  gelijk(o.groep.map((x) => x.waarde), ['Fictie', 'Gender', 'Klassiekers', 'Seksualiteit'], 'onderwerpen alfabetisch');
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
test('verlengen van een te laat boek telt vanaf vandaag', () => {
  const s = maakStaat('2026-12-04');
  s.uitleningen.push({ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '1', datum_uit: '2026-10-23', oorspronkelijke_vervaldatum: '2026-11-20', vervaldatum: '2026-11-20', datum_terug: '', aantal_verlengingen: 0 });
  const r = M.verlengen(s, { uitlening_id: 'U00001' });
  gelijk([r.ok, r.vervaldatum, s.uitleningen[0].vorige_vervaldatum], [true, '2027-01-01', '2026-11-20'], 'Niet 18/12 maar 4 weken na vandaag');
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
test('gsm-nummers in één vorm: 0470/00.00.09', () => {
  gelijk(['0470 00 00 09', '+32 470 00 00 09', '0032470000009', '0470000009', '0470/00.00.09', '03 000 00 00', '+31 6 00000000'].map(M.opmaakGsm),
    ['0470/00.00.09', '0470/00.00.09', '0470/00.00.09', '0470/00.00.09', '0470/00.00.09', '03 000 00 00', '+31 6 00000000']);
  const s = maakStaat();
  const r = M.nieuweLener(s, { voornaam: 'Kim', telefoon: '+32 470 00 00 09', toestemming: true });
  assert.strictEqual(s.leners.find((l) => String(l.lenersnummer) === String(r.lenersnummer)).telefoon, '0470/00.00.09', 'Bij inschrijven');
  gelijk([M.gsmNummersOpmaken(s.leners), s.leners[0].telefoon, s.leners[1].telefoon], [2, '0470/00.00.01', ''], 'Bestaande leners');
  assert.strictEqual(M.gsmNummersOpmaken(s.leners), 0, 'Opnieuw: niets meer aan te passen');
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
test('publieke catalogus: categorieën en trefwoorden altijd, triggerwaarschuwingen enkel met de instelling', () => {
  const s = maakStaat();
  s.catalogus[0].categorieen = 'Roman';
  s.catalogus[0].trefwoorden = 'lesbisch, coming-out';
  s.catalogus[0].triggerwaarschuwingen = 'Geweld';
  let b = M.bouwPubliekeCatalogus(s, []).boeken.find((x) => x.id === s.catalogus[0].boek_id);
  gelijk([Array.from(b.ca), Array.from(b.k), b.tw], [['Roman'], ['lesbisch'], undefined]); // Coming-out is een thema: niet dubbel bij de trefwoorden
  s.inst.triggerwaarschuwingen_tonen = true;
  b = M.bouwPubliekeCatalogus(s, []).boeken.find((x) => x.id === s.catalogus[0].boek_id);
  gelijk(Array.from(b.tw), ['Geweld']);
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
  // Schermgroottes hebben enkel een id. Regels met 0 vallen weg, de grootste eerst.
  const t = M.verwerkGoatcounter({ toestellen: { stats: [{ id: 'phone', name: '', count: 13 }, { id: 'tablet', name: '', count: 0 }, { id: 'desktop', name: '', count: 66 }, { id: 'iets', name: '', count: 1 }] } }, 7);
  gelijk(t.toestellen, [{ naam: 'Computer', n: 66 }, { naam: 'Gsm', n: 13 }, { naam: 'iets', n: 1 }]);
  gelijk([c.totaal, c.perWeek, c.verloop.map((d) => d.dag), c.paginas.length, c.bronnen[1].naam, c.toestellen.length, c.landen[0].n],
    [42, false, ['2026-10-24', '2026-10-25'], 1, '(onbekend)', 0, 30]);
  // Foutafhandeling: alles mislukt, onbekende site, of een deel mislukt.
  const alles = M.gcUitkomst({}, [M.gcFoutRegel('totaal', 404, '{"error":"not found"}')], 7, 'x');
  gelijk([alles.ok, /totaal: 404 \(\{"error":"not found"\}\)/.test(alles.fout)], [false, true]);
  assert.ok(/kent de code x niet/.test(M.gcUitkomst({}, [M.gcFoutRegel('totaal', 400, '{"error":"no site at this domain (\\"x.goatcounter.com\\")"}')], 7, 'x').fout));
  // Het totaal ontbreekt (404): een schatting uit de pagina's, zonder waarschuwing.
  const zonder = M.gcUitkomst({ paginas: { hits: [
    { path: '/', count: 5, stats: [{ day: '2026-10-28', daily: 2 }, { day: '2026-10-29', daily: 3 }] },
    { path: '/boeken.html', count: 4, stats: [{ day: '2026-10-29', daily: 4 }] },
    { path: 'klik', event: true, count: 9, stats: [{ day: '2026-10-29', daily: 9 }] }] } }, ['totaal: 404 (Error!)'], 7, 'x');
  gelijk([zonder.ok, zonder.cijfers.geschat, zonder.cijfers.totaal, zonder.cijfers.verloop, zonder.waarschuwing],
    [true, true, 9, [{ dag: '2026-10-28', n: 2 }, { dag: '2026-10-29', n: 7 }], undefined]);
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

test('oud uitleenblad: jaartallen herstellen (datums zonder jaar, formule in datum terug)', () => {
  gelijk([M.dagenUitFormule('=DATEVALUE(I3+28+28)', 3), M.dagenUitFormule('=I3+28', 3), M.dagenUitFormule('=DATEVALUE(I4+28)', 3), M.dagenUitFormule('', 3)], [56, 28, null, null]);
  const kop = ['', 'Boek', '', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR)', 'Gift', 'reminder mail', 'boek terug op...'];
  const rij = (a, boek, uit, terug, terugOp, herinnering) => [a, boek, '', 'Mira Verbeek', 'Robin', '', '', '', uit, terug, '', '', herinnering || '', terugOp || ''];
  // Rij 2 en 3: ontleend "26/11" met het verkeerde jaar (2024 i.p.v. 2023). Datum terug kreeg bij het importeren 2026.
  const waarden = [kop,
    rij('ok', 'De verzonnen zee', '2024-11-26', '2026-01-21', '2024-01-24'),
    rij('ok', 'Stille lichten', '2024-11-26', '2026-01-21', '', 'ok'),
    rij('ok', 'Twee kasten vol', '2024-01-05', '2026-02-02', ''),
    rij('', 'Een lopend boek', '2026-09-25', '2026-11-20', '')];
  const formules = [kop.map(() => ''), ['', '', '', '', '', '', '', '', '', '=DATEVALUE(I2+28+28)'], ['', '', '', '', '', '', '', '', '', '=DATEVALUE(I3+28+28)'], ['', '', '', '', '', '', '', '', '', '=DATEVALUE(I4+28)'], ['', '', '', '', '', '', '', '', '', '=DATEVALUE(I5+28+28)']];
  const r = M.leesOudeUitleningen(waarden, formules);
  gelijk(r.map((o) => [o.datum_uit, o.datum_terug_afgesproken]), [['2023-11-26', '2024-01-21'], ['2023-11-26', '2024-01-21'], ['2024-01-05', '2024-02-02'], ['2026-09-25', '2026-11-20']]);
  assert.strictEqual(r[1].herinnering, '2024-01-21', 'Herinnering "ok": de herstelde afgesproken datum');
  // Zonder formules: de afgesproken datum valt binnen het jaar na de ontlening.
  gelijk(M.leesOudeUitleningen(waarden).map((o) => o.datum_terug_afgesproken).slice(0, 3), ['2024-01-21', '2024-01-21', '2024-02-02']);
  // Al overgenomen met de foute datums: een nieuwe run herstelt ze.
  const s = maakStaat('2026-10-26');
  s.uitleningen = [{ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '', datum_uit: '2024-11-26', oorspronkelijke_vervaldatum: '2026-01-21', vervaldatum: '2026-01-21', datum_terug: '2026-01-21', borg: 0, borg_terugbetaald: '', laatste_herinnering: '', vrijwilliger: 'overgezet', bron: 'oud blad rij 3' }];
  const v = M.verwerkOudeUitleningen(s, r);
  assert.strictEqual(v.hersteld, 1);
  gelijk([s.uitleningen[0].datum_uit, s.uitleningen[0].vervaldatum, s.uitleningen[0].datum_terug], ['2023-11-26', '2024-01-21', '2024-01-21']);
  assert.strictEqual(M.verwerkOudeUitleningen(s, r).hersteld, 0, 'Opnieuw: niets meer te herstellen');
});

test('handleiding en draaiboek: blokken, afspraken uit de instellingen, checklists en vragen aanvullen', () => {
  const b = M.handleidingBlokken('Inleiding zonder titel\n# De sleutel\nVraag het in de groep.\n- Rood: niet lenen\n* Geel: aanrader\n\n# Leeg');
  gelijk(b.map((x) => [x.titel, x.regels.length]), [['', 1], ['De sleutel', 3], ['Leeg', 0]]);
  gelijk(b[1].regels.map((r) => r.punt), [false, true, true]);
  const inst = instellingen({});
  const h = M.handleiding(inst);
  assert.ok(h.nl.length > 5 && h.en.length > 5, 'Standaardtekst in beide talen');
  assert.strictEqual(h.nl[2].titel, 'Afspraken voor lenen', 'Afspraken na het eerste blok');
  assert.ok(/maximaal 2 boeken tegelijk, voor 4 weken/.test(h.nl[2].regels[1].tekst));
  assert.ok(/once, for 4 weeks, unless someone else has reserved/.test(h.en[2].regels[2].tekst));
  assert.ok(/5 euro per boek, cash of QR/.test(h.nl[2].regels[3].tekst));
  // Eigen checklists: enkel wat ontbreekt komt erbij, niets dubbel.
  const eigen = Object.assign({}, inst, { tekst_checklist_openen: 'Licht aan', tekst_checklist_sluiten: 'Licht uit\nVuilbakken leegmaken' });
  const faq = [{ volgorde: 3, vraag: 'Hoe lang mag ik lenen?' }, { volgorde: 4, vraag: 'Wat betekent de rode of gele bol op een boek?' }];
  const r = M.draaiboekAanvullen(eigen, faq);
  assert.ok(/^Sleutel op zak/.test(r.openen) && /Licht aan$/.test(r.openen), 'Sleutel bovenaan');
  gelijk(r.sluiten.split('\n'), ['Licht uit', 'Vuilbakken leegmaken', 'Kassa met de borgen onder de witte kast, uit het zicht', 'Verwarming terug op 1', 'Lokaal goed afgesloten']);
  gelijk([r.punten, r.vragen, faq.length, faq[2].volgorde, faq[3].bron_id], [4, 2, 4, 5, 'draaiboek-borg']);
  const opnieuw = M.draaiboekAanvullen(Object.assign({}, eigen, { tekst_checklist_openen: r.openen, tekst_checklist_sluiten: r.sluiten }), faq);
  gelijk([opnieuw.punten, opnieuw.vragen], [0, 0], 'Opnieuw: niets dubbel');
  // De standaardchecklist bevat het draaiboek al.
  gelijk([M.draaiboekAanvullen(inst, []).punten], [0]);
});

test('oud uitleenblad: giften en doorgeschoven borgen uit vrije tekst', () => {
  const inst = instellingen({});
  const g = (gift, borg) => { const r = M.oudeBorgEnGift({ gift, borg }, inst); return [r.bedrag, r.gift]; };
  gelijk(g('geeft borg als gift', 'cash'), [0, 5]);
  gelijk(g('x', 'cash'), [0, 5]);
  gelijk(g('ja 10', 'gift'), [0, 10]);
  gelijk(g('', 'Een gift'), [0, 5]);
  gelijk(g('voor volgende keer', 'van vorige keer'), [0, 0]);
  gelijk(g('cash teruggegeven', 'cash'), [5, 0]);
  gelijk(g('Geld voor volgende boek', 'cash'), [5, 0]);
  gelijk(g('3', 'QR'), [5, 3]);
  // Al overgenomen zonder gift: een nieuwe run zet de gift en haalt de borg weg.
  const s = maakStaat('2026-10-26');
  s.uitleningen = [{ uitlening_id: 'U00001', exemplaar: 'B0001-1', boek_id: 'B0001', lenersnummer: '', datum_uit: '2026-03-06', oorspronkelijke_vervaldatum: '2026-04-03', vervaldatum: '2026-04-03', datum_terug: '2026-04-03', borg: 5, betaalwijze_borg: 'cash', borg_terugbetaald: '2026-04-03', gift: '', laatste_herinnering: '', vrijwilliger: 'overgezet', bron: 'oud blad rij 2' }];
  const o = { rijnummer: 2, boek: 'De verzonnen zee', auteur: 'Mira Verbeek', datum_uit: '2026-03-06', datum_terug_afgesproken: '2026-04-03', terug_op: 'ok', borg: 'cash', gift: 'x', herinnering: '' };
  gelijk(M.verwerkOudeUitleningen(s, [o]).hersteld, 1);
  gelijk([s.uitleningen[0].borg, s.uitleningen[0].gift, s.uitleningen[0].borg_terugbetaald], [0, 5, '']);
  gelijk(M.verwerkOudeUitleningen(s, [o]).hersteld, 0, 'Opnieuw: niets meer te herstellen');
  gelijk(M.bestuurGegevens(s, []).perMaand.filter((m) => m.giften).map((m) => m.giften), [5]);
  s.uitleningen.push({ uitlening_id: 'U00002', boek_id: 'B0002', datum_uit: '2024-03-01', datum_terug: '2024-03-29', gift: 10 }, { uitlening_id: 'U00003', boek_id: 'B0003', datum_uit: '2024-05-01', datum_terug: '2024-05-29', gift: '' });
  gelijk(M.bestuurGegevens(s, []).perJaar, [{ jaar: 2026, uitleningen: 1, giften: 5 }, { jaar: 2024, uitleningen: 2, giften: 10 }], 'Per jaar, nieuwste eerst');
});

test('oud uitleenblad: zelf het boek kiezen voor een lopende uitlening', () => {
  const s = maakStaat('2026-10-25');
  s.leners = [];
  s.uitleningen = [];
  const waarden = [
    ['', 'Boek', '', 'Auteur', 'Voornaam', 'Achternaam', 'Telefoon', 'E-mail', 'datum ontlening', 'datum terug', 'Borg (cash/QR)', 'Gift', 'reminder mail', 'boek terug op...'],
    ['', 'Een andere titel', '', 'Niemand', 'Sasha', '', '', 'sasha@voorbeeld.test', '11/09/2026', '09/10/2026', 'cash', '', '', '']
  ];
  const r = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden));
  gelijk([r.uitleningen, r.naTeKijken.length, r.naTeKijken[0].veld], [0, 1, 'uitlening']);
  assert.ok(/boek_id/.test(r.naTeKijken[0].opmerking), 'De uitleg noemt de kolom boek_id');
  const gekozen = M.gekozenOudeBoeken([
    { bron: 'Overzetten', veld: 'uitlening', boek_id: 'B0002', waarde_bron: 'Een andere titel / Niemand [oud blad rij 2]', afgehandeld: 'nee' }
  ]);
  gelijk(gekozen, { 'oud blad rij 2': 'B0002' });
  const r2 = M.verwerkOudeUitleningen(s, M.leesOudeUitleningen(waarden), gekozen);
  gelijk([r2.uitleningen, r2.naTeKijken.length], [1, 0], 'Met het gekozen boek komt de uitlening mee');
  const u = s.uitleningen[0];
  gelijk([u.boek_id, u.datum_uit, u.vervaldatum, u.datum_terug, u.bron], ['B0002', '2026-09-11', '2026-10-09', '', 'oud blad rij 2']);
});

console.log('\nVerkoop op standjes');

test('verkoop: standje, boeken klaarzetten, verkopen (ook dubbel doorgestuurd), stock en omzet', () => {
  const t = {
    catalogus: [
      { boek_id: 'B0001', titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', prijs: '8', onderhandelbaar: 'ja', te_koop_aantal: 3 },
      { boek_id: 'B0002', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', prijs: '12,50', onderhandelbaar: 'nee', te_koop_aantal: 1 },
      { boek_id: 'B0003', titel: 'Stille lichten', auteur: 'Aerts, Noor', prijs: '', te_koop_aantal: '' }
    ],
    standjes: [], standjeBoeken: [], verkopen: []
  };
  let n = 0;
  assert.strictEqual(M.standjeBewaren(t.standjes, { naam: '', datum: '2026-06-01' }, () => 'S0001').ok, false);
  let r = M.standjeBewaren(t.standjes, { naam: 'Pride Antwerpen', thema: 'Pride', datum: '2026-08-08', locatie: 'Groenplaats' }, () => 'S' + String(++n).padStart(4, '0'));
  gelijk([r.ok, r.standje_id, t.standjes[0].status], [true, 'S0001', 'voorbereiding']);
  // Klaarzetten: niet meer dan de stock, prijs mag anders voor dit standje.
  assert.ok(/maar 1 exemplaren/.test(M.standjeBoekZetten(t, { standje_id: 'S0001', boek_id: 'B0002', mee: 2 }).fout));
  gelijk(M.standjeBoekZetten(t, { standje_id: 'S0001', boek_id: 'B0001', mee: 2 }).ok, true);
  gelijk(M.standjeBoekZetten(t, { standje_id: 'S0001', boek_id: 'B0002', mee: 1, prijs: '10' }).ok, true);
  gelijk(M.standjeBoekZetten(t, { standje_id: 'S0001', boek_id: 'B0002', mee: 1, prijs: '10' }).ok, true, 'Opnieuw: dezelfde rij');
  gelijk(t.standjeBoeken.length, 2);
  let o = M.verkoopOverzicht(t);
  gelijk(o.teKoop.map((b) => [b.id, b.prijs, b.o, b.stock]), [['B0001', 8, true, 3], ['B0002', 12.5, false, 1]]);
  gelijk(o.standjes[0].boeken.map((b) => [b.boek_id, b.mee, b.prijs, b.verkocht]), [['B0001', 2, 8, 0], ['B0002', 1, 10, 0]]);
  // Verkopen: dezelfde verkoop twee keer doorgestuurd telt één keer. De stock gaat omlaag.
  const v1 = { verkoop_id: 'v-1730000000-a1', standje_id: 'S0001', boek_id: 'B0001', aantal: 1, prijs: 6, betaalwijze: 'cash', tijdstip: '2026-08-08T14:00' };
  const v2 = { verkoop_id: 'v-1730000001-b2', standje_id: 'S0001', boek_id: 'B0002', aantal: 1, prijs: 10, betaalwijze: 'QR', tijdstip: '2026-08-08T14:05' };
  r = M.verkopenToevoegen(t, [v1, v2, { verkoop_id: 'x', standje_id: 'S0001', boek_id: 'B0001', prijs: 1 }], 'Kim');
  gelijk([r.nieuw, r.bewaard, r.fouten.length], [2, ['v-1730000000-a1', 'v-1730000001-b2'], 1]);
  r = M.verkopenToevoegen(t, [v1], 'Kim');
  gelijk([r.nieuw, r.bewaard], [0, ['v-1730000000-a1']], 'Al bekend: niet dubbel');
  gelijk([t.catalogus[0].te_koop_aantal, t.catalogus[1].te_koop_aantal], [2, 0]);
  o = M.verkoopOverzicht(t);
  gelijk(o.standjes[0].boeken.map((b) => [b.boek_id, b.verkocht, b.stock]), [['B0001', 1, 2], ['B0002', 1, 0]]);
  gelijk(o.standjes[0].omzet, { totaal: 16, perBetaalwijze: { cash: 6, QR: 10 } });
  gelijk(o.teKoop.map((b) => b.id), ['B0001'], 'Uitverkocht: niet meer bij de boeken te koop');
  // Afsluiten: daarna kan je niets meer klaarzetten.
  gelijk(M.standjeStatus(t.standjes, { standje_id: 'S0001', status: 'afgesloten' }).ok, true);
  assert.ok(/afgesloten/.test(M.standjeBoekZetten(t, { standje_id: 'S0001', boek_id: 'B0001', mee: 1 }).fout));
  // Een verkoop die pas later doorkomt (geen internet), telt toch nog mee.
  gelijk(M.verkopenToevoegen(t, [Object.assign({}, v1, { verkoop_id: 'v-1730000099-c3' })], 'Kim').nieuw, 1);
  gelijk(t.catalogus[0].te_koop_aantal, 1);
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
  // Twee functies met dezelfde naam in verschillende bestanden: in Apps Script wint er stilletjes één.
  const dubbel = namen.filter((n, i) => namen.indexOf(n) !== i);
  gelijk(dubbel, [], 'Dubbele functienamen');
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
test('website: gevoelig verborgen weg, verloren als niet meer beschikbaar, gevoelig zichtbaar met label', () => {
  const s = maakStaat();
  s.catalogus[0].status = 'verloren';
  s.catalogus[1].status = 'gevoelig verborgen';
  s.catalogus[2].status = 'gevoelig zichtbaar';
  const p = M.bouwPubliekeCatalogus(s, []);
  const ids = p.boeken.map((b) => b.id);
  assert.ok(ids.indexOf('B0001') > -1 && ids.indexOf('B0002') === -1);
  gelijk(p.boeken.filter((b) => b.id === 'B0001')[0].b, { c: 'niet_uitleenbaar', l: 'Niet meer beschikbaar', t: 0, v: 0, x: 1 });
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
  const vrijwilliger = ['beheerLeeslijstBoeken', 'beheerInhoud', 'beheerInhoudBewaren', 'beheerCoversLijst', 'beheerCoversBewaren', 'beheerCoverUpload', 'beheerCoverVanLink', 'beheerCoverLinks', 'beheerTekstUitFoto'];
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
  // Geen uitgave met dit ISBN: dan een uitgave zonder ISBN (Google vond ze op het nummer), nooit een met een ander ISBN.
  const zonder = [{ volumeInfo: { title: 'Ander ISBN', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141199078' }] } },
    { volumeInfo: { title: 'Zonder ISBN', industryIdentifiers: [{ type: 'OTHER', identifier: 'UOM:39015' }] } }];
  gelijk(M.googleItemsMetIsbn(zonder, '9780141439518').map((i) => i.volumeInfo.title), ['Zonder ISBN']);
  gelijk(M.googleItemsMetIsbn(zonder.slice(0, 1), '9780141439518'), []);
  // Een andere uitgave van hetzelfde boek telt enkel als we titel en auteur kennen.
  const ander = [{ volumeInfo: { title: 'Pride and Prejudice (Vintage Classics)', authors: ['Jane Austen'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780099589334' }] } },
    { volumeInfo: { title: 'Pride and Prejudice and Zombies', authors: ['Seth Grahame-Smith'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781594743344' }] } }];
  gelijk(M.googleItemsMetIsbn(ander, '9780141439518'), [], 'Zonder titel: niets');
  gelijk(M.googleItemsMetIsbn(ander, '9780141439518', { titel: 'Pride and prejudice', auteur: 'Austen, Jane' }).map((i) => i.volumeInfo.title), ['Pride and Prejudice (Vintage Classics)']);
  gelijk(M.googleItemsMetIsbn(ander, '9780141439518', { titel: 'Pride and Prejudice', auteur: 'Verzonnen, Vera' }), [], 'Andere auteur: niets');
  assert.ok(M.googleBooksUrl('9780141439518', 'k', 'BE', 'vrij').includes('?q=9780141439518&country=BE&key=k'));
});

test('Google: daglimiet bij de tweede zoekvorm gaat niet verloren, wachttijd tot de reset', () => {
  const oud = M.haalJson;
  const antwoorden = [{ code: 200, data: {} }, { code: 429, data: { error: { message: 'Quota exceeded', errors: [{ reason: 'rateLimitExceeded' }] } } }];
  M.haalJson = () => antwoorden.shift();
  try {
    const r = M.googleBooksZoek('9780141439518', 'k');
    gelijk([r.limiet, r.items.length], [true, 0]);
  } finally { M.haalJson = oud; }
  // Middernacht in Californie: 23:50 daar is 20 minuten wachten, 00:00 een volle dag plus 10 minuten.
  gelijk([M.minutenTotGoogleReset(23, 50), M.minutenTotGoogleReset(0, 0), M.minutenTotGoogleReset(7, 22)], [20, 1450, 1008]);
});

test('Google: de test toont in gewone woorden of Google Books werkt', () => {
  const boek = { items: [{ volumeInfo: { title: 'Verzonnen roman', imageLinks: {}, description: 'x' } }], fout: '', limiet: false };
  const leeg = { items: [], fout: '', limiet: false };
  assert.strictEqual(M.googleTestTekst('9780000000002', boek, 'k', true), 'Google Books werkt.\nISBN 9780000000002: "Verzonnen roman", cover ja, beschrijving ja.');
  assert.strictEqual(M.googleTestTekst('9780000000002', leeg, 'k', true), 'Google Books werkt, maar kent ISBN 9780000000002 niet.');
  assert.ok(/geen enkel boek terug/.test(M.googleTestTekst('9780000000002', leeg, 'k', false)));
  // De controle met bekende boeken: werkt bij het tweede boek, geeft de fout van Google door, of niets.
  gelijk(M.googleBooksControle('k', (isbn) => isbn === '9780061120084' ? boek : leeg), { werkt: true, fout: null, vreemd: false });
  const limiet = { items: [], fout: 'Quota exceeded', limiet: true, code: 429 };
  gelijk(M.googleBooksControle('k', () => limiet), { werkt: false, fout: limiet, vreemd: false });
  gelijk(M.googleBooksControle('k', () => leeg), { werkt: false, fout: null, vreemd: false });
  assert.ok(/daglimiet van je sleutel is op/.test(M.googleTestTekst('9780000000002', M.googleBooksControle('k', () => limiet).fout, 'k', false)));
  assert.ok(/daglimiet van je sleutel is op/.test(M.googleTestTekst('9780000000002', { items: [], fout: 'Quota', limiet: true }, 'k', false)));
  assert.ok(/Google meldt: API key not valid/.test(M.googleTestTekst('9780000000002', { items: [], fout: 'API key not valid', limiet: false }, 'k', false)));
  assert.ok(/geen google_books_api_key/.test(M.googleTestTekst('9780000000002', boek, '', true)));
});

test('Google: een onleesbaar antwoord telt als storing, en de test toont wat Google antwoordde', () => {
  const oud = M.haalJson;
  try {
    M.haalJson = () => ({ code: 200, data: null });
    let r = M.googleBooksVraag('https://voorbeeld.test');
    gelijk([r.code, /onleesbaar/.test(r.fout), r.info], [502, true, 'code 200, onleesbaar']);
    const antwoorden = [{ code: 200, data: { totalItems: 0 } }, { code: 200, data: { totalItems: 0 } }];
    M.haalJson = () => antwoorden.shift();
    r = M.googleBooksZoek('9780141439518', 'k');
    gelijk([r.fout, r.items.length, r.pogingen], ['', 0, ['code 200, 0 gevonden, 0 bruikbaar', 'code 200, 0 gevonden']]);
    // Google vond een andere uitgave en de tweede vraag haperde: niet gevonden, maar Google werkt wel.
    const andere = { totalItems: 2, items: [{ volumeInfo: { title: 'Ander boek', authors: ['Kim Fictief'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780141199078' }] } }] };
    const meer = [{ code: 200, data: andere }, { code: 503, data: { error: { message: 'Service temporarily unavailable.' } } }, { code: 200, data: andere }, { code: 200, data: { totalItems: 0 } }, { code: 200, data: andere }, { code: 200, data: { totalItems: 0 } }];
    M.haalJson = () => meer.shift();
    r = M.googleBooksZoek('9780141439518', 'k');
    gelijk([r.fout, r.totaal], ['', 2]);
    gelijk(r.pogingen[0], 'code 200, 2 gevonden (Ander boek, Kim Fictief, ISBN_13 9780141199078), 0 bruikbaar', 'De test toont welke boeken Google gaf');
    gelijk(M.googleBooksControle('k'), { werkt: false, fout: null, vreemd: true }, 'Google gaf andere boeken: Google zoekt verkeerd');
    assert.ok(/zoekt nu verkeerd/.test(M.googleTestTekst('9780141439518', { items: [], fout: '' }, 'k', false, true)));
  } finally { M.haalJson = oud; }
});
test('Google: het Logboek zegt waarom een ronde stopte en wanneer het verdergaat', () => {
  assert.strictEqual(M.googleRondeReden(false, true, 'Service temporarily unavailable. (backendFailed)', 888), ' (storing bij Google, gaat over 15 minuten vanzelf verder)');
  assert.strictEqual(M.googleRondeReden(true, false, 'Quota exceeded (rateLimitExceeded)', 5), ' (daglimiet van Google bereikt, gaat vanzelf verder rond 9 uur in de ochtend)');
  assert.strictEqual(M.googleRondeReden(true, false, 'API key not valid', 5), ' (Google weigert, gaat vanzelf verder rond 9 uur in de ochtend)');
  gelijk([M.googleRondeReden(false, false, '', 5), M.googleRondeReden(false, true, 'x', 0)], ['', '']);
});

test('voorraad: wat te koop is en wat al verkocht werd, met totalen', () => {
  const catalogus = [
    { boek_id: 'B0002', titel: 'Zee van glas', auteur: 'Vera Verzonnen', te_koop_aantal: 2, prijs: '12,50', onderhandelbaar: 'ja' },
    { boek_id: 'B0001', titel: 'Atlas van niets', auteur: 'Noor Bedacht', te_koop_aantal: 0, prijs: 8, onderhandelbaar: '' },
    { boek_id: 'B0003', titel: 'Niet te koop', auteur: 'Kim Fictief', te_koop_aantal: '', prijs: '' },
    { boek_id: 'B0004', titel: 'Zonder prijs', auteur: '', te_koop_aantal: 1, prijs: '' }
  ];
  const verkopen = [
    { boek_id: 'B0001', aantal: 1, prijs: 8 },
    { boek_id: 'B0001', aantal: 1, prijs: 6 },
    { boek_id: 'B0002', aantal: '', prijs: 10 }
  ];
  const v = M.voorraadRijen(catalogus, verkopen);
  gelijk(v.rijen.map((r) => r[0]), ['B0001', 'B0002', 'B0004'], 'Uitverkocht boek blijft staan, nooit verkocht en geen stock niet');
  gelijk(v.rijen[0], ['B0001', 'Atlas van niets', 'Noor Bedacht', 0, 8, 'nee', 0, 2, 14]);
  gelijk(v.rijen[1], ['B0002', 'Zee van glas', 'Vera Verzonnen', 2, 12.5, 'ja', 25, 1, 10]);
  gelijk(v.rijen[2].slice(3, 7), [1, '', 'nee', '']);
  gelijk(v.totaal, [3, 25, 3, 24]);
});

test('voorraad beheren: aantal, prijs en onderhandelbaar zetten vanuit het verkoopscherm', () => {
  const catalogus = [
    { boek_id: 'B0002', titel: 'Zee van glas', auteur: 'Vera Verzonnen', isbn: '9780000000002', te_koop_aantal: '', prijs: '' },
    { boek_id: 'B0001', titel: 'Atlas van niets', auteur: 'Noor Bedacht', te_koop_aantal: 2, prijs: 8, onderhandelbaar: 'ja' },
    { boek_id: 'F0001', titel: 'Verzonnen film', soort: 'film', type: 'film' }
  ];
  const lijst = M.voorraadCatalogus(catalogus);
  gelijk(lijst.map((b) => [b.id, b.stock, b.prijs, b.o]), [['B0001', 2, 8, true], ['B0002', 0, null, false]], 'Geen films, op titel');
  const b = catalogus[0];
  assert.strictEqual(M.voorraadZetten(catalogus, { boek_id: 'B9999', te_koop_aantal: 1, prijs: 5 }).ok, false);
  assert.strictEqual(M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: 'twee', prijs: 5 }).ok, false);
  assert.strictEqual(M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: 1.5, prijs: 5 }).ok, false);
  assert.strictEqual(M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: 2, prijs: '' }).ok, false, 'Prijs nodig als er iets te koop is');
  assert.strictEqual(M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: 2, prijs: 'veel' }).ok, false);
  let r = M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: '3', prijs: '12,50', onderhandelbaar: true });
  gelijk([r.ok, r.tekst, b.te_koop_aantal, b.prijs, b.onderhandelbaar], [true, '"Zee van glas": 3 te koop aan 12,50 euro.', 3, 12.5, 'ja']);
  r = M.voorraadZetten(catalogus, { boek_id: 'B0002', te_koop_aantal: 0, prijs: '' });
  gelijk([r.ok, r.tekst, b.te_koop_aantal, b.onderhandelbaar], [true, '"Zee van glas" is niet meer te koop.', 0, 'nee']);
});

test('verkoopscherm: cover, korte beschrijving en thema\'s zoals op de website', () => {
  const t = {
    catalogus: [{ boek_id: 'B0001', titel: 'Zee van glas', auteur: 'Vera Verzonnen', genre: 'Queer fictie', extra_onderwerpen: 'Gender', cover_url: 'https://voorbeeld.test/c.jpg',
      beschrijving: 'Een verzonnen zin. '.repeat(40), te_koop_aantal: 2, prijs: 8 },
    { boek_id: 'B0002', titel: 'Atlas van niets', cover_url: 'javascript:alert(1)', te_koop_aantal: 1, prijs: 5, soort: 'zine' }],
    standjes: [{ standje_id: 'S0001', naam: 'Pride', datum: '2026-08-08', status: 'bezig' }],
    standjeBoeken: [{ standje_id: 'S0001', boek_id: 'B0001', mee: 1 }], verkopen: [],
    onderwerpen: [{ genre: 'Queer fictie', filtergroepen: 'Fictie' }]
  };
  const o = M.verkoopOverzicht(t);
  const zee = o.teKoop.find((b) => b.id === 'B0001');
  gelijk([zee.c, zee.g, zee.d.length <= 400, /\.$/.test(zee.d)], ['https://voorbeeld.test/c.jpg', ['Fictie', 'Gender'], true, true]);
  const atlas = o.teKoop.find((b) => b.id === 'B0002');
  gelijk([atlas.c, atlas.d, atlas.s], ['', '', 'zine'], 'Geen onveilige cover');
  gelijk([o.standjes[0].boeken[0].c, o.standjes[0].boeken[0].g], ['https://voorbeeld.test/c.jpg', ['Fictie', 'Gender']]);
  gelijk(M.verkoopOverzicht(Object.assign({}, t, { onderwerpen: undefined })).teKoop[1].g, ['Gender'], 'Zonder Onderwerpen');
});

console.log('\nBoeken van de oude website');
test('oude website: beschrijving en cover gaan voor, behalve eigen werk; niet gevonden naar Na te kijken', () => {
  const basis = 'https://voorbeeld.supabase.test';
  const rij = (id, isbn, titel, auteurs, beschrijving, image) => ({ id, isbn, title: titel, authors: auteurs, description: beschrijving, image });
  const oud = [
    rij(1, '978-0-306-40615-7', 'Zee van glas', [{ name: 'Vera Verzonnen' }], '<p>Een <b>oude</b> beschrijving.</p>', 'abc'),
    rij(2, '', 'Atlas van niets', 'Bedacht, Noor', 'Oude tekst over de atlas.', 'def'),
    rij(3, '9781861972712', 'Stille lichten', 'Kim Fictief', 'Oude tekst.', 'ghi'),
    rij(4, '', 'Niet in de bib', 'Iemand Anders', 'Ergens anders.', ''),
    rij(5, '', 'Gedichten', 'Sam Fictief', 'Gedichten.', 'standaard'),
    rij(6, '', 'Liedjes', 'Sam Fictief', '', 'standaard'),
    rij(7, '', 'Verhalen', 'Sam Fictief', '', 'standaard')
  ].map((r) => M.oudBoekUitRij(r, basis));
  gelijk([oud[0].isbn, oud[0].auteur, oud[0].beschrijving, oud[0].cover], ['9780306406157', 'Vera Verzonnen', 'Een oude beschrijving.', basis + '/storage/v1/object/public/covers/abc.jpg']);
  const catalogus = [
    { boek_id: 'B0001', titel: 'Een andere titel', auteur: 'Verzonnen, Vera', isbn: '9780306406157', beschrijving: 'Van Google.', beschrijving_en: 'From Google.', cover_url: 'https://books.google.test/c', cover_bron: 'Google Books' },
    { boek_id: 'B0002', titel: 'Atlas van niets', auteur: 'Noor Bedacht', isbn: '', beschrijving: 'Met de hand geschreven.', cover_url: 'https://lh3.googleusercontent.com/d/x', cover_bron: 'foto in de bib' },
    { boek_id: 'B0003', titel: 'Stille lichten', auteur: 'Fictief, Kim', isbn: '9781861972712', beschrijving: '', cover_url: '', cover_bron: '' },
    { boek_id: 'B0005', titel: 'Gedichten', auteur: 'Sam Fictief', isbn: '', beschrijving: '', cover_url: '' }
  ];
  const eigen = M.eigenWerkUitLogboek([
    ['', 'Kim', 'boek aangepast', 'B0002: titel, beschrijving'],
    ['', 'Kim', 'voorstel goedgekeurd', 'V0001, boek B0009'],
    ['', 'Kim', 'cover-foto', 'B0007']
  ]);
  gelijk([Object.keys(eigen.beschrijving), Object.keys(eigen.cover)], [['B0002', 'B0009'], ['B0007']]);
  const uit = M.oudeBoekenToepassen(catalogus, oud, eigen);
  gelijk([catalogus[0].beschrijving, catalogus[0].beschrijving_en, catalogus[0].beschrijving_vertaald, catalogus[0].oude_cover, catalogus[0].beschrijving_bron], ['Een oude beschrijving.', '', '', basis + '/storage/v1/object/public/covers/abc.jpg', 'oude website'], 'Gevonden op ISBN: oude website gaat voor');
  gelijk([catalogus[1].beschrijving, catalogus[1].oude_cover], ['Met de hand geschreven.', undefined], 'Eigen beschrijving en eigen cover blijven');
  gelijk([catalogus[2].beschrijving, catalogus[2].oude_cover], ['Oude tekst.', basis + '/storage/v1/object/public/covers/ghi.jpg']);
  gelijk([catalogus[3].beschrijving, catalogus[3].oude_cover], ['Gedichten.', undefined], 'Standaardafbeelding (bij 3 boeken dezelfde) niet');
  gelijk([uit.beschrijvingen, uit.covers, uit.eigen, uit.nietGevonden.map((b) => b.titel)], [3, 2, 2, ['Niet in de bib', 'Liedjes', 'Verhalen']]);
  gelijk([M.heeftOudeCoverNodig(catalogus[0]), M.heeftOudeCoverNodig(catalogus[1])], [true, false]);
  // Daarna overschrijft geen enkele zoektocht dit nog: Google, Wikipedia en afgebroken teksten.
  const b = Object.assign({}, catalogus[0], { isbn: '9780306406157', gb_gecontroleerd: '2026-10-01', beschrijving: 'Oude tekst die eindigt op...', cover_url: 'https://lh3.googleusercontent.com/d/oud', cover_bron: 'oude website' });
  gelijk(M.maakAfgebrokenLeeg([b]), 0, 'Afgebroken tekst van de oude website blijft');
  gelijk(Object.keys(M.verwerkGoogleBooks(b, { description: 'Van Google', imageLinks: { thumbnail: 'https://books.google.test/x' } })), [], 'Google vult niets');
  gelijk([M.heeftWikiNodig(b), M.heeftBeschrijvingNodig(b), M.heeftGoogleBooksNodig(b)], [false, false, false]);
});

test('oude website: boeken terugvinden ook met ondertitel, lidwoord, tikfout, meerdere auteurs of oud ISBN', () => {
  const catalogus = [
    { boek_id: 'B0001', titel: 'Zee van glas', auteur: 'Verzonnen, Vera; Bedacht, Noor', isbn: '' },
    { boek_id: 'B0002', titel: 'De atlas van niets', auteur: 'Fictief, Kim', isbn: '' },
    { boek_id: 'B0003', titel: 'Stille lichten', auteur: 'Fictief, Sam', isbn: '', isbn_origineel: '0-306-40615-2' },
    { boek_id: 'B0004', titel: 'Gedichten voor de nacht', auteur: 'Verzonnen, Vera', isbn: '' },
    { boek_id: 'B0005', titel: 'Een unieke titel', auteur: '', isbn: '' },
    { boek_id: 'B0006', titel: 'Liedjes', auteur: 'Fictief, Sam', isbn: '' }
  ];
  const index = M.oudIndex(catalogus);
  const zoek = (titel, auteur, isbn, ondertitel) => { const r = M.zoekOudBoek({ titel, auteur, isbn: isbn || '', ondertitel: ondertitel || '' }, index); return r ? r.boek.boek_id + ' ' + r.hoe : null; };
  gelijk(zoek('Zee van glas: een roman', 'Noor Bedacht; Vera Verzonnen'), 'B0001 kern', 'Ondertitel en andere volgorde van auteurs');
  gelijk(zoek('Atlas van niets', 'Kim Fictief'), 'B0002 kern', 'Zonder lidwoord');
  gelijk(zoek('Iets anders', 'Iemand', '9780306406157'), 'B0003 isbn', 'Oud ISBN uit isbn_origineel');
  gelijk(zoek('Gedichten voor de nachtt', 'Vera Verzonnen'), 'B0004 bijna', 'Tikfout');
  gelijk(zoek('Een unieke titel', 'Kim Fictief'), null, 'Andere auteur: niet in ronde 1 (wel in ronde 2, zie verder)');
  gelijk(zoek('Liedjes', 'Vera Verzonnen'), null, 'Zelfde titel, andere auteur: niet');
  gelijk(zoek('Gedichten', 'Vera Verzonnen'), null, 'Te weinig gelijk');
  gelijk(M.oudeAchternamen('Verzonnen, Vera; Noor Bedacht & Kim Fictief'), ['verzonnen', 'bedacht', 'fictief']);
  gelijk(M.oudVoorstel({ titel: 'Gedichten voor nacht' }, catalogus).boek_id, 'B0004', 'Voorstel voor Na te kijken');
  gelijk(M.oudBoekUitRij({ id: 1, title: 'X', authors: [{ name: 'Vera Verzonnen' }, { name: 'Noor Bedacht' }] }, 'https://x').auteur, 'Vera Verzonnen; Noor Bedacht');
});

test('oude website ronde 2: vertaling, auteur anders geschreven, uitgever als auteur, & en and', () => {
  const catalogus = [
    { boek_id: 'B0001', titel: 'Nachtzee', auteur: 'Verzonnen, Vera', isbn: '' },
    { boek_id: 'B0002', titel: 'Liefde ontwortelt alles', auteur: 'Eiland, Dichteres van', isbn: '' },
    { boek_id: 'B0003', titel: 'Rechten in het verzonnen land', auteur: 'Bedacht & Fictief', isbn: '' },
    { boek_id: 'B0004', titel: 'Noor & Kim', auteur: 'Schrijver, Sam', isbn: '' },
    { boek_id: 'B0005', titel: 'Van ver gekomen', auteur: 'Hammerechts, Lien', isbn: '' },
    { boek_id: 'B0006', titel: 'De partij in volgevlucht', auteur: 'Partij', isbn: '' },
    { boek_id: 'B0007', titel: 'Gedichten', auteur: 'Twee, Iemand', isbn: '' },
    { boek_id: 'B0008', titel: 'Gedichten', auteur: 'Drie, Iemand', isbn: '' }
  ];
  const oud = [
    { titel: 'Nightsea', auteur: 'Vera Verzonnen', isbn: '9780306406157' },
    { titel: 'Liefde ontwortelt alles', auteur: 'Dichteres', isbn: '' },
    { titel: 'Rechten in het Verzonnen Land', auteur: 'Uitgeverij.be', isbn: '' },
    { titel: 'Noor and Kim', auteur: 'Sam Schrijver', isbn: '' },
    { titel: 'Van ver gekomen', auteur: 'Lien Hemmerechts', isbn: '' },
    { titel: 'Partij in Vogelvlucht', auteur: 'Uitgever.be', isbn: '' },
    { titel: 'Gedichten', auteur: 'Iemand Anders', isbn: '' }
  ].map((o) => Object.assign({ ondertitel: '', beschrijving: 'Tekst.', cover: '', id: o.titel }, o));
  const uit = M.oudeBoekenToepassen(catalogus, oud, { beschrijving: {}, cover: {} });
  gelijk(catalogus.map((c) => c.boek_id + ':' + (c.beschrijving ? 'ja' : '')), ['B0001:ja', 'B0002:ja', 'B0003:ja', 'B0004:ja', 'B0005:ja', 'B0006:ja', 'B0007:', 'B0008:']);
  gelijk(uit.hoe, { 'auteur uniek': 1, titel: 2, 'titel uniek': 1, kern: 1, 'titel bijna': 1 });
  gelijk(uit.nietGevonden.map((b) => b.titel), ['Gedichten'], 'Titel twee keer in de catalogus: niet raden');
  gelijk([M.auteursDelen('Sappho', 'Lesbos, Sappho van'), M.auteursDelen('Chagoll Lydia', 'Chagoll, Lydia'), M.auteursDelen('Lien Hemmerechts', 'Hammerechts, Lien'), M.auteursDelen('Vera van Dijk', 'Noor van Damme')], [true, true, true, false]);
});

test('oude website: titels vergelijken (vertaling, woord meer of minder, nummer, auteur in de titel, naam aan elkaar)', () => {
  const C = (boek_id, titel, auteur) => ({ boek_id, titel, auteur, isbn: '' });
  const catalogus = [
    C('B0001', 'Het moordkondoom', 'Kunig, Ralf'), C('B0002', 'Ander werk', 'Kunig, Ralf'),
    C('B0003', 'In Zee', 'Lynn, Jane De'),
    C('B0004', 'The Critical Reception of Vera Verzonnen', 'Francis, Noor'),
    C('B0005', 'House of Rules', 'Lewisn Heather'), C('B0006', 'Tweede boek', 'Lewis, Heather'),
    C('B0007', 'The Dark Proof', 'Mars-Jones, Adam & White, Edmund'), C('B0008', 'Iets anders', 'White, Edmund'),
    C('B0009', 'Keuze uit de gedichten 1950-1984', 'Rich, Adrienne'), C('B0010', 'Ander bundel', 'Rich, Adrienne'),
    C('B0011', 'Flo: de dagelijkse ergenissen', 'Goede, Floor de'), C('B0012', 'Flo ego', 'Goede, Floor De'), C('B0013', 'Flo groot', 'Goede, Floor de'),
    C('B0014', 'The Mayor of Verzonnen Street: The Life of Kim', 'Shilts, Randy'),
    C('B0015', 'De autobriografie van Alice B. Fictief', 'Stein, Gertrude'), C('B0016', 'Ander', 'Stein, Gertrude')
  ];
  const index = M.oudIndex(catalogus);
  const zoek = (titel, auteur) => { const r = M.zoekOudBoek({ titel, auteur, isbn: '', ondertitel: '' }, index); return r ? r.boek.boek_id + ' ' + r.hoe : null; };
  gelijk(zoek('The Moordcondoom', 'Ralf Kunig'), 'B0001 bijna', 'Vertaling, titel zonder spaties');
  gelijk(zoek('In Zee: A Novel', 'Jane DeLynn'), 'B0003 kern', 'Naam aan elkaar geschreven');
  gelijk(zoek('Critical Reception of Vera Verzonnen, 1963-2010: An Honest Woman', 'Noor Francis'), 'B0004 bijna', 'Jaartallen erbij');
  gelijk(zoek('House Rules', 'Heather Lewis'), 'B0005 bijna', 'Woord minder');
  gelijk(zoek('The Darker Proof: Stories', 'Edmund White; Adam Mars-Jones'), 'B0007 bijna', 'Darker en Dark');
  gelijk(zoek('Keuze uit de gedichten 1950-1984 Adrienne Rich', 'Adrienne Rich'), 'B0009 bijna', 'Naam van de auteur in de titel');
  gelijk(zoek('Flo#3: De dagelijkse ergernissen', 'Floor de Goede'), 'B0011 bijna', 'Nummer in de titel');
  gelijk(zoek('Flo #7 EGO', 'Floor de Goede'), 'B0012 bijna', 'Nummer en hoofdletters');
  gelijk(zoek('The mayor of Verzonnen Street : the life of Kim', ''), 'B0014 titel zonder auteur', 'Geen auteur op de oude website');
  gelijk(zoek('The Autobiography of Alice B. Fictief', 'Gertrude Stein'), 'B0015 bijna', 'Vertaling met gedeelde woorden');
  gelijk(zoek('Flo #9 Nieuw', 'Floor de Goede'), null, 'Ander deel van de reeks: niet raden');
  gelijk(M.auteursDelen('Jane DeLynn', 'Lynn, Jane De'), true);
  // Ronde 2: een boek dat twee keer op de oude website stond, telt als één.
  const cat2 = [C('B0101', 'Out of Control The Zone 2', 'Slayrt, Jacob'), C('B0102', 'Unieke verzonnen titel', 'Iemand, Kim')];
  const oud2 = [
    { titel: 'Out of Control - Bi-sexual Erotica', auteur: 'Jacob Slater' },
    { titel: 'Unieke verzonnen titel', auteur: 'Uitgever.be' }, { titel: 'Unieke verzonnen titel', auteur: 'Uitgever.be' }
  ].map((o) => Object.assign({ isbn: '', ondertitel: '', beschrijving: 'Tekst.', cover: '' }, o));
  const uit = M.oudeBoekenToepassen(cat2, oud2, { beschrijving: {}, cover: {} });
  gelijk([cat2[0].beschrijving, cat2[1].beschrijving, uit.nietGevonden.length], ['Tekst.', 'Tekst.', 0]);
});

test('oude website: delen van een reeks, dubbel in de catalogus of op de oude website, vertaling bij een auteur met meer boeken', () => {
  const C = (boek_id, titel, auteur) => ({ boek_id, titel, auteur, isbn: '' });
  gelijk([M.oudVolgnummer('Hartklop: Volume One (Hartklop, #1)'), M.oudVolgnummer('Hartklop 2'), M.oudVolgnummer('Liefde deel drie'), M.oudVolgnummer('Gedichten 1950-1984'), M.oudVolgnummer('Zonder')], [1, 2, 3, 0, 0]);
  const catalogus = [
    C('B0001', 'Hartklop 1', 'Fictief, Kim'), C('B0002', 'Hartklop 2', 'Fictief, Kim'),
    C('B0003', 'Het portret van niemand', 'Verzonnen, Vera'), C('B0004', 'Het portret van niemand', 'Verzonnen, Vera'),
    C('B0005', 'Liefdespistolen 1', 'Bedacht, Noor'), C('B0006', 'Liefdespistolen 2', 'Bedacht, Noor'),
    C('B0007', 'Meisjes in uniform', 'Winsloe, Chista'),
    C('B0008', 'Nachtwoud', 'Barnes, Djuna'), C('B0009', 'Damesalmanak', 'Barnes, Djuna')
  ];
  const oud = [
    { titel: 'Hartklop: Volume One (Hartklop, #1)', auteur: 'Kim Fictief' },
    { titel: 'Het portret van niemand', auteur: 'Vera Verzonnen', isbn: '9780306406157' },
    { titel: 'Het Portretten van niemand', auteur: 'Vera Verzonnen' },
    { titel: 'Liefdespistolen volume 1', auteur: '' },
    { titel: 'Mädchen in Uniform', auteur: 'Christa Winsloe' },
    { titel: 'Nightwood', auteur: 'Djuna Barnes' },
    { titel: 'Ladies Almanack', auteur: 'Djuna Barnes' },
    { titel: 'Damesalmanak', auteur: 'Djuna Barnes' }
  ].map((o) => Object.assign({ isbn: '', ondertitel: '', beschrijving: 'Tekst ' + o.titel, cover: '' }, o));
  const uit = M.oudeBoekenToepassen(catalogus, oud, { beschrijving: {}, cover: {} });
  gelijk(catalogus.map((c) => c.boek_id + ':' + (c.beschrijving || '')), [
    'B0001:Tekst Hartklop: Volume One (Hartklop, #1)', 'B0002:',
    'B0003:Tekst Het portret van niemand', 'B0004:Tekst Het Portretten van niemand',
    'B0005:Tekst Liefdespistolen volume 1', 'B0006:',
    'B0007:Tekst Mädchen in Uniform', 'B0008:Tekst Nightwood', 'B0009:Tekst Damesalmanak']);
  gelijk(uit.nietGevonden.map((b) => b.titel), ['Ladies Almanack'], 'Twee oude boeken voor een vrij boek: geen gok');
});

test('oude website: ISBN-10 telt, en verborgen boeken die niet gevonden worden komen niet in Na te kijken', () => {
  const b = M.oudBoekUitRij({ id: 1, title: 'X', isbn13: '', isbn10: '0-306-40615-2', hidden: true }, 'https://x');
  gelijk([b.isbn, b.verborgen], ['9780306406157', true]);
  const catalogus = [{ boek_id: 'B0001', titel: 'Iets heel anders', auteur: 'Fictief, Kim', isbn: '9780306406157' }];
  const oud = [Object.assign(M.oudBoekUitRij({ id: 1, title: 'Andere titel', isbn10: '0306406152', description: 'Tekst.' }, 'https://x')),
    M.oudBoekUitRij({ id: 2, title: 'Weg uit de bib', hidden: true }, 'https://x'), M.oudBoekUitRij({ id: 3, title: 'Niet verborgen' }, 'https://x')];
  const uit = M.oudeBoekenToepassen(catalogus, oud, { beschrijving: {}, cover: {} });
  gelijk([catalogus[0].beschrijving, uit.verborgen, uit.nietGevonden.map((x) => x.titel)], ['Tekst.', 1, ['Niet verborgen']]);
});

test('oude website: categorieën en thema\'s blijven bestaan (categorieen, trefwoorden), triggerwaarschuwingen apart', () => {
  const rij = { id: 1, title: 'Zee', tags: [
    { name: 'roman', displayName: 'Roman', isCategory: true, isTw: false, showInFrontend: true },
    { name: 'lesbisch', displayName: 'Lesbisch', isCategory: false, isTw: false, showInFrontend: true },
    { name: 'trans', displayName: 'Transgender', isCategory: false, isTw: false, showInFrontend: true },
    { name: 'tw', displayName: 'geweld', isCategory: false, isTw: true, showInFrontend: false },
    { name: 'intern', displayName: 'Intern', isCategory: false, isTw: false, showInFrontend: false }] };
  const oud = M.oudBoekUitRij(rij, 'https://x');
  gelijk(oud.onderwerpen.map((o) => o.naam + (o.categorie ? '*' : '') + (o.trigger ? '!' : '')), ['Roman*', 'Lesbisch', 'Transgender', 'geweld!']);
  const boek = { boek_id: 'B0001', genre: '', extra_onderwerpen: 'Gender', trefwoorden: 'lesbisch' };
  gelijk(M.oudeOnderwerpenVoorBoek(boek, oud.onderwerpen, {}), {
    extra_onderwerpen: 'Gender, Fictie, Seksualiteit', categorieen: 'Roman', trefwoorden: 'lesbisch, Transgender', triggerwaarschuwingen: 'Geweld' });
  // Non-fictie geeft geen thema, wel een categorie.
  const andere = [{ naam: 'Kookboek', categorie: true }, { naam: 'Non-fictie', categorie: true }];
  gelijk(M.oudeOnderwerpenVoorBoek({ genre: '', extra_onderwerpen: '' }, andere, {}), { categorieen: 'Kookboek, Non-fictie' });
  // Opnieuw uitvoeren verandert niets meer.
  gelijk(M.oudeOnderwerpenVoorBoek({ genre: '', extra_onderwerpen: 'Gender, Fictie, Seksualiteit', categorieen: 'Roman', trefwoorden: 'Lesbisch, Transgender', triggerwaarschuwingen: 'Geweld' }, oud.onderwerpen, {}), {});
  // Het overzicht: oude namen (ook zonder boek) en wat in de Catalogus staat, met het aantal boeken.
  const rijen = M.categorieenOverzicht([{ categorieen: 'Roman, Essay', trefwoorden: 'Lesbisch' }, { categorieen: 'roman' }], rij.tags);
  gelijk(rijen.map((r) => r.soort + ':' + r.naam + ':' + r.aantal_boeken), ['categorie:Essay:1', 'categorie:Roman:2', 'trefwoord:Lesbisch:1', 'trefwoord:Transgender:0', 'triggerwaarschuwing:Geweld:0']);
  // Via oudeBoekenToepassen.
  const catalogus = [{ boek_id: 'B0001', titel: 'Zee', auteur: 'Fictief, Kim', isbn: '9780306406157', genre: '', extra_onderwerpen: '' }];
  const lijst = [{ titel: 'Zee', auteur: 'Kim Fictief', isbn: '9780306406157', ondertitel: '', beschrijving: '', cover: '', onderwerpen: oud.onderwerpen }];
  const uit = M.oudeBoekenToepassen(catalogus, lijst, { beschrijving: {}, cover: {} }, {});
  gelijk([uit.onderwerpen, catalogus[0].extra_onderwerpen, catalogus[0].categorieen, catalogus[0].trefwoorden], [1, 'Fictie, Seksualiteit, Gender', 'Roman', 'Lesbisch, Transgender']);
});

test('categorieën en trefwoorden: de naam van een thema staat niet dubbel', () => {
  gelijk(Array.from(M.zonderThemas(['Roman', 'Feminisme', 'poezie', 'Lesbisch'])), ['Roman', 'Lesbisch']);
  // Bij het overnemen: Feminisme en Poëzie enkel bij de thema's.
  const v = M.oudeOnderwerpenVoorBoek({ extra_onderwerpen: '' }, [{ naam: 'Poëzie', categorie: true }, { naam: 'Feminisme' }, { naam: 'Lesbisch' }], {});
  gelijk([v.extra_onderwerpen, v.categorieen, v.trefwoorden], ['Poëzie, Feminisme, Seksualiteit', undefined, 'Lesbisch']);
  // Opkuisen van wat al in de Catalogus staat.
  const cat = [{ boek_id: 'B1', categorieen: 'Roman, Poëzie', trefwoorden: 'feminisme, Lesbisch', extra_onderwerpen: 'Fictie' }, { boek_id: 'B2', categorieen: 'Essay' }];
  gelijk(Array.from(M.categorieenZonderThemas(cat)), ['B1']);
  gelijk([cat[0].categorieen, cat[0].trefwoorden, cat[0].extra_onderwerpen], ['Roman', 'Lesbisch', 'Fictie, Poëzie, Feminisme']);
  // Het overzicht toont geen thema's.
  gelijk(M.categorieenOverzicht([{ categorieen: 'Roman, Fictie' }], []).map((r) => r.naam), ['Roman']);
});

test('categorieën en trefwoorden: de soort in het tabblad deelt de namen opnieuw in', () => {
  const cat = [
    { boek_id: 'B1', categorieen: 'Crime, Comics', trefwoorden: 'Queer, Lesbisch' },
    { boek_id: 'B2', categorieen: 'Comics', trefwoorden: 'crime' },
    { boek_id: 'B3', trefwoorden: 'Geweld' }
  ];
  const soortVan = { crime: 'trefwoord', queer: 'weg', geweld: 'triggerwaarschuwing' };
  gelijk(Array.from(M.categorieenHerindelen(cat, soortVan)), ['B1', 'B3']);
  gelijk([cat[0].categorieen, cat[0].trefwoorden], ['Comics', 'Lesbisch, Crime']);
  gelijk([cat[1].categorieen, cat[1].trefwoorden], ['Comics', 'crime'], 'B2 stond al juist');
  gelijk([cat[2].trefwoorden, cat[2].triggerwaarschuwingen], ['', 'Geweld']);
  gelijk(M.categorieenHerindelen(cat, soortVan).length, 0, 'opnieuw: niets meer te doen');
});

test('indelen op titel en beschrijving: thema, categorie en trefwoord erbij, nooit iets weg', () => {
  const namen = [
    { naam: 'Roman', soort: 'categorie' }, { naam: 'Crime', soort: 'categorie' }, { naam: 'Sport', soort: 'categorie' },
    { naam: 'Lesbisch', soort: 'trefwoord' }, { naam: 'Coming-out', soort: 'trefwoord' }, { naam: 'Zee', soort: 'trefwoord', zoekwoorden: 'vuurtoren, =golven' },
    { naam: 'Queer', soort: 'weg' }
  ];
  const cat = [
    { boek_id: 'B1', titel: 'De verzonnen moord', beschrijving: 'Een spannende roman over een rechercheur in een kleine stad.', trefwoorden: 'Eigen woord' },
    { boek_id: 'B2', titel: 'Twee lesbiennes op het veld', beschrijving: 'Een verhaal over voetbal en liefde tussen twee lesbische speelsters.' },
    { boek_id: 'B3', titel: 'Licht', beschrijving: 'Een vuurtorenwachter ziet de golven en de vuurtoren elke nacht. Queer en lesbisch.' },
    { boek_id: 'B4', titel: 'Film', soort: 'film', beschrijving: 'Een roman.' },
    { boek_id: 'F1', titel: 'Lesbische zomer', soort: 'film', beschrijving: 'Een film over voetbal en een lesbische liefde, een geschiedenis met geschiedenis en oorlog in de geschiedenis.' }
  ];
  const uit = M.deelBoekenIn(cat, namen);
  gelijk(uit.map((r) => r.boek_id), ['B1', 'B2', 'B3', 'F1']);
  gelijk([cat[4].trefwoorden, !cat[4].categorieen, !cat[4].extra_onderwerpen], ['Lesbisch, Geschiedenis', true, true], 'een film krijgt enkel trefwoorden (een thema als Geschiedenis wordt bij een film een trefwoord)');
  gelijk([cat[0].categorieen, cat[0].trefwoorden], ['Roman, Crime', 'Eigen woord'], 'moord en rechercheur: Crime, en het eigen trefwoord blijft');
  gelijk([cat[1].categorieen, cat[1].trefwoorden], ['Sport', 'Lesbisch'], 'lesbiennes in de titel telt dubbel');
  gelijk([cat[2].trefwoorden], ['Lesbisch, Zee'], 'eigen zoekwoorden tellen, Queer staat op weg, lesbisch één keer is genoeg');
  gelijk(!cat[3].categorieen, true, 'een film krijgt geen categorie');
  gelijk(M.deelBoekenIn(cat, namen).length, 0, 'opnieuw: niets dubbel');
  // Enkel boeken of enkel films (de menu's Boeken en Films).
  const tweede = [{ boek_id: 'B9', titel: 'Een roman' }, { boek_id: 'F9', soort: 'film', titel: 'Lesbische lesbiennes' }];
  gelijk(M.deelBoekenIn(tweede.map((x) => Object.assign({}, x)), namen, 'boeken').map((r) => r.boek_id), ['B9']);
  gelijk(M.deelBoekenIn(tweede.map((x) => Object.assign({}, x)), namen, 'films').map((r) => r.boek_id), ['F9']);
});

test('indelen van films: één treffer genoeg, genre telt mee, AIDS/HIV als twee woorden', () => {
  const namen = [{ naam: 'Lesbisch', soort: 'trefwoord' }, { naam: 'AIDS/HIV', soort: 'trefwoord' }, { naam: 'Sekswerk', soort: 'trefwoord' },
    { naam: 'Coming-out', soort: 'trefwoord' }, { naam: 'Oorlog', soort: 'trefwoord' }];
  const films = [
    { boek_id: 'F1', soort: 'film', titel: 'Zomer', beschrijving_en: 'Two women fall in love in a lesbian summer camp.' },
    { boek_id: 'F2', soort: 'film', titel: 'Act', beschrijving: 'Over de strijd tegen hiv in Parijs.' },
    { boek_id: 'F3', soort: 'film', titel: 'Nacht', beschrijving: 'A young hustler in Los Angeles.' },
    { boek_id: 'F4', soort: 'film', titel: 'Kast', beschrijving: 'Een tiener maakt zijn coming-out op school.' },
    { boek_id: 'F5', soort: 'film', titel: 'Verzonnen', genre: 'Drama, War' },
    { boek_id: 'F6', soort: 'film', titel: 'Warschau', beschrijving: 'Een stad.' }
  ];
  M.deelBoekenIn(films, namen, 'films');
  gelijk(films.map((f) => f.trefwoorden || ''), ['Lesbisch', 'AIDS/HIV', 'Sekswerk', 'Coming-out', 'Oorlog', '']);
  // Boeken: ook één treffer genoeg.
  const boek = [{ boek_id: 'B1', titel: 'Zee', beschrijving: 'Een roman over hiv en een lesbisch personage in de oorlog.' }];
  M.deelBoekenIn(boek, namen, 'boeken');
  gelijk(boek[0].trefwoorden, 'Lesbisch, AIDS/HIV, Oorlog');
});

test('beschrijving op titel en auteur: wanneer, en enkel hetzelfde boek', () => {
  const nodig = (b) => M.heeftTitelZoekNodig(Object.assign({ titel: 'De verzonnen zee', auteur: 'Verbeek, Mira' }, b));
  gelijk([
    nodig({ isbn: '', beschrijving_gezocht: '' }),
    nodig({ isbn: '9780306406157', beschrijving_gezocht: '' }),
    nodig({ isbn: '9780306406157', beschrijving_gezocht: '2026-10-24' }),
    nodig({ isbn: '9780306406157', beschrijving_gezocht: 'OL 20261024' }),
    nodig({ isbn: '', beschrijving_gezocht: 'TA 20261102' }),
    nodig({ isbn: '', beschrijving: 'Al een tekst.' }),
    nodig({ soort: 'film' }), nodig({ soort: 'zine' })
  ], [true, false, true, false, false, false, false, false]);
  const boek = { titel: 'De verzonnen zee: een roman', auteur: 'Verbeek, Mira' };
  const items = [
    { volumeInfo: { title: 'Een ander boek', authors: ['Mira Verbeek'], description: 'Fout.' } },
    { volumeInfo: { title: 'De verzonnen zee', authors: ['Kim Ander'], description: 'Ook fout.' } },
    { volumeInfo: { title: 'De Verzonnen Zee', authors: ['Mira Verbeek'], description: 'Juist.' } }
  ];
  gelijk(M.beschrijvingUitItems(items, boek), 'Juist.');
  gelijk(M.olWerkOpTitel([{ key: '/works/OL1W', title: 'Iets anders', author_name: ['Mira Verbeek'] },
    { key: '/works/OL2W', title: 'De verzonnen zee', author_name: ['M. Verbeek', 'Mira Verbeek'] }], boek), '/works/OL2W');
  gelijk(M.olWerkOpTitel([{ key: '/works/OL3W', title: 'De verzonnen zee', author_name: ['Kim Ander'] }], boek), '');
  assert.ok(decodeURIComponent(M.googleBooksTitelUrl(boek, '')).indexOf('intitle:"de verzonnen zee" inauthor:verbeek') > -1);
});

test('covers op titel en auteur bij Google Books: wanneer, en enkel hetzelfde boek', () => {
  const nodig = (b) => M.heeftGoogleTitelNodig(Object.assign({ titel: 'De verzonnen zee', auteur: 'Verbeek, Mira' }, b));
  gelijk([
    nodig({ isbn: '' }), nodig({ isbn: '9780306406157' }), nodig({ isbn: '9780306406157', gb_gecontroleerd: '2026-10-24' }),
    nodig({ isbn: '', gb_gecontroleerd: 'TA 20261102' }), nodig({ cover_url: 'https://x/c.jpg' }), nodig({ soort: 'film' })
  ], [true, false, true, false, false, false]);
  const boek = { titel: 'De verzonnen zee', auteur: 'Verbeek, Mira', beschrijving: '' };
  const items = [
    { volumeInfo: { title: 'De verzonnen zee', authors: ['Kim Ander'], imageLinks: { thumbnail: 'http://x/fout.jpg' } } },
    { volumeInfo: { title: 'De verzonnen zee', authors: ['Mira Verbeek'], description: 'Juist.', publishedDate: '1999', imageLinks: { thumbnail: 'http://x/juist.jpg&edge=curl' } } }
  ];
  gelijk(M.googleTitelVelden(boek, items), { cover_url: 'https://x/juist.jpg', cover_bron: 'titel en auteur (Google Books)', beschrijving: 'Juist.' });
  gelijk(M.googleTitelVelden(boek, items.slice(0, 1)), {});
});

test('covers bewaren in Google Drive: welke covers, en niet opnieuw na een mislukte poging', () => {
  gelijk(['https://books.google.com/books/content?id=x', 'https://covers.openlibrary.org/b/id/1-M.jpg', 'https://lh3.googleusercontent.com/d/abc',
    'https://projectmadrigal.github.io/icons/x.png', '', 'geen link'].map(M.isExterneCover), [true, true, false, false, false, false]);
  const ol = 'https://covers.openlibrary.org/b/id/1-M.jpg';
  gelijk([M.heeftCoverBewarenNodig({ cover_url: ol }),
    M.heeftCoverBewarenNodig({ cover_url: ol, cover_bewaard: 'mislukt 20261103', cover_origineel: ol }),
    M.heeftCoverBewarenNodig({ cover_url: 'https://archive.org/services/img/x', cover_bewaard: 'mislukt 20261103', cover_origineel: ol }),
    M.heeftCoverBewarenNodig({ cover_url: 'https://lh3.googleusercontent.com/d/abc', cover_bewaard: '2026-11-03' })], [true, false, true, false]);
  gelijk([M.coverBestandsnaam({ boek_id: 'B0012' }, 'image/png'), M.coverBestandsnaam({ boek_id: 'B0012' }, 'image/jpeg')], ['B0012.png', 'B0012.jpg']);
  gelijk([M.coverGrootGenoeg({ breedte: 1, hoogte: 1 }), M.coverGrootGenoeg({ breedte: 128, hoogte: 190 }), M.coverGrootGenoeg(null)], [false, true, true]);
});

test('covers bewaren: een fout bij één cover telt als poging, na drie keer mislukt', () => {
  gelijk([M.coverPogingNaFout('', '20261103'), M.coverPogingNaFout('poging 1', '20261103'), M.coverPogingNaFout('poging 2', '20261103')],
    ['poging 1', 'poging 2', 'mislukt 20261103']);
  // Met "poging" blijft de cover op de lijst, met "mislukt" niet meer.
  const url = 'https://covers.openlibrary.org/b/id/1-M.jpg';
  gelijk([M.heeftCoverBewarenNodig({ cover_url: url, cover_bewaard: 'poging 2', cover_origineel: url }),
    M.heeftCoverBewarenNodig({ cover_url: url, cover_bewaard: 'mislukt 20261103', cover_origineel: url })], [true, false]);
});

test('beveiliging: na 30 foute codes binnen een kwartier is het aanmelden geblokkeerd', () => {
  const opslag = {};
  const cache = { get: (k) => opslag[k] || null, put: (k, v) => { opslag[k] = v; } };
  let begin = 0;
  for (let i = 0; i < 29; i++) if (M.telFouteCode(cache)) begin++;
  gelijk([M.codesGeblokkeerd(cache), begin], [false, 0]);
  gelijk([M.telFouteCode(cache), M.codesGeblokkeerd(cache)], [true, true]);
  gelijk(M.telFouteCode(cache), false, 'het Logboek meldt het maar één keer');
});

test('auteurs: "Achternaam, Voornaam" met de voornamen uit de Catalogus, organisaties en twijfel blijven staan', () => {
  const kennis = M.auteurKennis([
    { auteur: 'Verbeek, Mira' }, { auteur: 'Ander, Kim & Fictief, Nancy' }, { auteur: 'Tempel, Kate' }, { auteur: 'Zandloper, Tor Age' },
    { auteur: 'Noorderlicht, Heather' }, { soort: 'film', auteur: 'Regie, Fout' }
  ]);
  const gevallen = [
    ['Kate Zeemeeuw', 'Kate Zeemeeuw'.split(' ').reverse().join(', ')],
    ['Zeemeeuw Nancy', 'Zeemeeuw, Nancy'],
    ['Lewisn Heather', 'Lewisn, Heather'],
    ['Bringsvaerd Tor Age', 'Bringsvaerd, Tor Age'],
    ['Mira van Beuningen', 'Beuningen, Mira van'],
    ['J.R. Ackerley', 'Ackerley, J.R.'],
    ['Ackerley J.R.', 'Ackerley, J.R.'],
    ['Mira Verbeek; Kim Ander', 'Verbeek, Mira & Ander, Kim'],
    ['Mira Verbeek, Kim Ander', 'Verbeek, Mira & Ander, Kim'],
    ['Cline, Cheryl & Zeemeeuw Nancy & etc.', 'Cline, Cheryl & Zeemeeuw, Nancy & etc.'],
    ['Verbeek, Mira &etc.', 'Verbeek, Mira & etc.'],
    ['Van Bendegem, Jean Paul', 'Van Bendegem, Jean Paul'],
    ['Kate Zeemeeuw Jr.', 'Zeemeeuw, Kate, Jr.'],
    ['Verzonnen Front', 'Verzonnen Front'],
    ['COC Verzonnenstad', 'COC Verzonnenstad'],
    ['Fonds Mira Verbeek', 'Fonds Mira Verbeek'],
    ['Lila Verzonnenbond International', 'Lila Verzonnenbond International'],
    ['Seigneur de Verzonnen', 'Seigneur de Verzonnen'],
    ['Verzonnenpunt 23', 'Verzonnenpunt 23'],
    ['De Verzonnen Was', 'De Verzonnen Was'],
    ['Verzonnen Doe-Front', 'Verzonnen Doe-Front'],
    ['Mira Comics', 'Mira Comics'],
    ['Daila Lama', 'Daila Lama'],
    ['Aurora', 'Aurora'],
    ['', '']
  ];
  gelijk(gevallen.map((g) => M.auteurNetjes(g[0], kennis)), gevallen.map((g) => g[1]));
  // Niet zeker: blijft staan, en het script zegt het.
  const info = M.auteurNetjesInfo('Zandvoort Kristaline', kennis);
  gelijk([info.tekst, Array.from(info.nietZeker)], ['Zandvoort Kristaline', ['Zandvoort Kristaline']]);
  gelijk(Array.from(M.auteurNetjesInfo('Seigneur de Verzonnen', kennis).nietZeker), [], 'een titel is geen twijfel');
  // De Catalogus: herstel van wat de eerste versie verkeerd omdraaide, nieuwe namen netjes, films niet.
  const cat = [
    { boek_id: 'B1', titel: 'Zee', auteur: 'Verbeek, Mira' },
    { boek_id: 'B2', titel: 'Licht', auteur: 'Kate Zeemeeuw' },
    { boek_id: 'B3', titel: 'Zines', auteur: 'Verzonnenstad, COC' },
    { boek_id: 'B4', titel: 'Wind', auteur: 'Heather, Lewisn' },
    { boek_id: 'B5', titel: 'Noord', auteur: 'Noorderlicht, Heather' },
    { boek_id: 'B6', titel: 'Twijfel', auteur: 'Zandvoort Kristaline' },
    { boek_id: 'B7', titel: 'Tempel', auteur: 'Tempel, Kate' },
    { boek_id: 'F1', titel: 'Film', soort: 'film', auteur: 'Noor Verzonnen' }
  ];
  const herstel = { B3: { vroeger: 'COC Verzonnenstad', nu: 'Verzonnenstad, COC' }, B4: { vroeger: 'Lewisn Heather', nu: 'Heather, Lewisn' } };
  const uit = M.auteursOpkuisen(cat, herstel);
  gelijk(cat.map((b) => b.auteur), ['Verbeek, Mira', 'Zeemeeuw, Kate', 'COC Verzonnenstad', 'Lewisn, Heather', 'Noorderlicht, Heather', 'Zandvoort Kristaline', 'Tempel, Kate', 'Noor Verzonnen']);
  gelijk(uit.filter((r) => r.opmerking).map((r) => r.boek_id), ['B6'], 'enkel de twijfel krijgt een opmerking');
  gelijk(M.auteursOpkuisen(cat, {}).filter((r) => r.auteur_nu !== r.auteur_vroeger).length, 0, 'opnieuw: niets meer te veranderen');
});

test('ISBN-10: berekend uit een ISBN dat met 978 begint, niet bij 979', () => {
  const cat = [{ isbn: '9780306406157' }, { isbn: '9791034567890' }, { isbn: '' }, { isbn: '9780306406157', isbn10: '0306406152' }];
  gelijk(M.isbn10Aanvullen(cat).length, 1);
  gelijk(cat.map((b) => b.isbn10 || ''), ['0306406152', '', '', '0306406152']);
});

test('Graphic novel: niet op het woord graphic of striptease, en herstel van wat vroeger fout ging', () => {
  const thema = (titel) => M.onderwerpScores({ titel: titel, beschrijving: '' }).map((s) => s[0]).indexOf('Graphic novel') > -1;
  gelijk(['Graphic verzonnen content', 'Een graphic novel over de zee', 'Striptease in de zee', 'Stripped', 'Een strip over Kim', 'Getekend door het leven', 'Verzonnen manga'].map(thema),
    [false, true, false, false, true, false, true]);
  gelijk([M.stelFiltergroepenVoor('Graphic'), M.stelFiltergroepenVoor('Strips'), M.stelFiltergroepenVoor('Striptease')], [[], ['Graphic novel'], []]);
  const cat = [
    { boek_id: 'B1', titel: 'Graphic verzonnen verhalen', extra_onderwerpen: 'Seksualiteit, Graphic novel' },
    { boek_id: 'B2', titel: 'Een graphic novel over Kim', extra_onderwerpen: 'Graphic novel' },
    { boek_id: 'B3', titel: 'Graphic en zo', categorieen: 'Comics', extra_onderwerpen: 'Graphic novel' },
    { boek_id: 'B4', titel: 'Zee', extra_onderwerpen: 'Graphic novel' }
  ];
  gelijk(Array.from(M.graphicNovelHerstellen(cat, {})), ['B1']);
  gelijk(cat.map((b) => b.extra_onderwerpen), ['Seksualiteit', 'Graphic novel', 'Graphic novel', 'Graphic novel'], 'zonder "graphic" in de tekst (B4) blijft het: dat koos iemand zelf');
});

test('de thema\'s van de bib: Intersekse, Coming-out, Kolonialisme, Marxisme, ... en niet dubbel bij categorieën of trefwoorden', () => {
  ['Intersekse', 'Coming-out', 'Relaties', 'Polyamorie', 'Kolonialisme', 'Cultuur', 'Diversiteit', 'Ecologie', 'Gezondheid', 'Onderzoek', 'Marxisme', 'Cuba']
    .forEach((t) => assert.ok(M.FILTERGROEPEN.indexOf(t) > -1, t));
  gelijk([M.themaExact('coming out'), M.themaExact('Intersekse')], ['Coming-out', 'Intersekse']);
  gelijk(M.themaVan('Marxistische theorie', {}), ['Politiek', 'Marxisme']);
  const cat = [{ boek_id: 'B1', categorieen: 'Roman', trefwoorden: 'Coming out, Lesbisch, Polyamorie', extra_onderwerpen: 'Fictie' },
    { boek_id: 'F1', soort: 'film', trefwoorden: 'Coming-out' }];
  gelijk(Array.from(M.categorieenZonderThemas(cat)), ['B1']);
  gelijk([cat[0].trefwoorden, cat[0].extra_onderwerpen, cat[1].trefwoorden], ['Lesbisch', 'Fictie, Coming-out, Polyamorie', 'Coming-out']);
});

test('Politiek is een apart thema, los van Maatschappij', () => {
  gelijk([M.themaVan('Politiek', {}), M.themaVan('Activisme', {}), M.themaVan('Essay', {})], [['Politiek'], ['Politiek'], ['Maatschappij']]);
  gelijk(M.FILTERGROEPEN.indexOf('Politiek') > -1, true);
});

test('oude website: een lange beschrijving die al overgenomen is, telt de volgende keer als gelijk', () => {
  const lang = 'Een verzonnen zin over een boek. '.repeat(200);
  const catalogus = [{ boek_id: 'B0001', titel: 'Zee', auteur: 'Fictief, Kim', isbn: '9780306406157' }];
  const oud = [{ titel: 'Zee', auteur: 'Kim Fictief', isbn: '9780306406157', ondertitel: '', beschrijving: lang, cover: '' }];
  gelijk(M.oudeBoekenToepassen(catalogus, oud, { beschrijving: {}, cover: {} }).beschrijvingen, 1);
  catalogus[0].beschrijving_en = 'Vertaald';
  const tweede = M.oudeBoekenToepassen(catalogus, oud, { beschrijving: {}, cover: {} });
  gelijk([tweede.beschrijvingen, tweede.gelijk, catalogus[0].beschrijving_en], [0, 1, 'Vertaald']);
});

test('oude website: Na te kijken met een code, al gekoppeld vermelden, en overnemen = ja', () => {
  const catalogus = [{ boek_id: 'B0001', titel: 'Het portret van niemand', auteur: 'Verzonnen, Vera', isbn: '', beschrijving: 'Eigen tekst.', cover_url: '', cover_bron: '' },
    { boek_id: 'B0002', titel: 'Iets anders', auteur: 'Fictief, Kim', isbn: '' }];
  const oud = { id: '77', titel: 'De portretten van niemand', ondertitel: '', auteur: 'Vera Verzonnen', isbn: '', beschrijving: 'Oude tekst.', cover: 'https://x/c.jpg' };
  const rij = M.oudNaTeKijkenRij(oud, catalogus, { B0001: 'Het portret van niemand' });
  gelijk([rij.boek_id, /Al gekoppeld aan "Het portret van niemand"/.test(rij.waarde_catalogus), / \[oud 77\]$/.test(rij.waarde_bron)], ['B0001', true, true]);
  const na = [
    Object.assign({ bron: 'oude website', afgehandeld: 'nee', overnemen: 'ja' }, rij),
    { bron: 'oude website', titel: 'Fout ID', boek_id: 'B9999', waarde_bron: '[oud 77]', afgehandeld: 'nee', overnemen: 'ja' },
    { bron: 'oude website', titel: 'Niet aangeduid', boek_id: 'B0002', waarde_bron: '[oud 77]', afgehandeld: 'nee', overnemen: '' }
  ];
  const uit = M.oudeAangeduideOvernemen(catalogus, na, { 77: oud });
  gelijk([uit.gedaan, uit.covers, uit.fouten.length, catalogus[0].beschrijving, catalogus[0].oude_cover, na[0].afgehandeld, na[0].overnemen, catalogus[1].beschrijving],
    [1, 1, 1, 'Oude tekst.', 'https://x/c.jpg', 'ja', 'gedaan', undefined]);
});

console.log('\nAankooplijst');
test('aankooplijst: voorstellen, dubbels, al in de catalogus en afvinken als binnen', () => {
  const catalogus = [{ boek_id: 'B0001', titel: 'Zee van glas', auteur: 'Verzonnen, Vera', isbn: '9780306406157' }];
  const rijen = [];
  let n = 0;
  const id = () => 'K' + String(++n).padStart(4, '0');
  assert.strictEqual(M.aankoopToevoegen(rijen, catalogus, { titel: '' }, 'Kim', '2026-10-30', id).ok, false, 'Titel nodig');
  assert.strictEqual(M.aankoopToevoegen(rijen, catalogus, { titel: 'X', isbn: '123' }, 'Kim', '2026-10-30', id).ok, false, 'Ongeldig ISBN');
  assert.strictEqual(M.aankoopToevoegen(rijen, catalogus, { titel: 'X', link: 'javascript:alert(1)' }, 'Kim', '2026-10-30', id).ok, false, 'Enkel http(s)');
  assert.ok(/al in de catalogus \(B0001\)/.test(M.aankoopToevoegen(rijen, catalogus, { titel: 'Andere titel', isbn: '978-0-306-40615-7' }, 'Kim', '2026-10-30', id).fout), 'Zelfde ISBN');
  assert.ok(/al in de catalogus/.test(M.aankoopToevoegen(rijen, catalogus, { titel: 'zee van Glas', auteur: 'Vera Verzonnen' }, 'Kim', '2026-10-30', id).fout), 'Zelfde titel en auteur');
  let r = M.aankoopToevoegen(rijen, catalogus, { titel: 'Atlas van niets', auteur: 'Noor Bedacht', link: 'https://voorbeeld.test/atlas', reden: 'Gevraagd door een lener' }, 'Kim', '2026-10-30', id);
  gelijk([r.ok, rijen[0].aankoop_id, rijen[0].status, rijen[0].voorgesteld_door, rijen[0].link], [true, 'K0001', 'open', 'Kim', 'https://voorbeeld.test/atlas']);
  assert.ok(/al op de aankooplijst/.test(M.aankoopToevoegen(rijen, catalogus, { titel: 'ATLAS VAN NIETS', auteur: 'Bedacht, Noor' }, 'Sam', '2026-10-30', id).fout));
  M.aankoopToevoegen(rijen, catalogus, { titel: 'Stille lichten', auteur: 'Kim Fictief', isbn: '9781861972712' }, 'Sam', '2026-10-31', id);
  // Het bestuur duidt aan, past aan en de lijst zet open boeken bovenaan.
  r = M.aankoopAanpassen(rijen, { aankoop_id: 'K0002', gekozen: true });
  gelijk([r.ok, rijen[1].gekozen, /aangeduid voor aankoop/.test(r.tekst)], [true, 'ja', true]);
  assert.strictEqual(M.aankoopAanpassen(rijen, { aankoop_id: 'K0002', prijs: 'veel' }).ok, false);
  M.aankoopAanpassen(rijen, { aankoop_id: 'K0002', prijs: '€ 19,99', genre: 'Poëzie' });
  gelijk([rijen[1].prijs, rijen[1].genre], [19.99, 'Poëzie']);
  // Komt Stille lichten in de catalogus, dan staat het als binnen en niet meer aangeduid.
  catalogus.push({ boek_id: 'B0002', titel: 'Stille lichten', auteur: 'Fictief, Kim', isbn: '9781861972712' });
  gelijk(M.aankoopBijwerken(rijen, catalogus, '2026-11-02'), 1);
  gelijk([rijen[1].status, rijen[1].boek_id, rijen[1].gekozen, rijen[1].datum_binnen], ['in catalogus', 'B0002', '', '2026-11-02']);
  gelijk(M.aankoopBijwerken(rijen, catalogus, '2026-11-03'), 0, 'Niet opnieuw');
  const o = M.aankoopOverzicht(rijen);
  gelijk(o.map((b) => [b.id, b.s, b.k]), [['K0001', 'open', false], ['K0002', 'binnen', false]]);
  // Alles uitvinken en verwijderen.
  M.aankoopAanpassen(rijen, { aankoop_id: 'K0001', gekozen: true });
  gelijk(M.aankoopAllesUitvinken(rijen).tekst, '1 boeken zijn niet meer aangeduid.');
  r = M.aankoopVerwijderen(rijen, { ids: ['K0002'] });
  gelijk([r.ok, rijen[1]._verwijderen, M.aankoopOverzicht(rijen).length], [true, true, 1]);
  assert.strictEqual(M.aankoopVerwijderen(rijen, { aankoop_id: 'K9999' }).ok, false);
});

test('aankooplijst: tekens zoals &#x27; van bol.com worden gewone tekens', () => {
  gelijk([M.htmlTekst('The Lesbiana&#x27;s'), M.htmlTekst('Rock &amp;amp; roll'), M.htmlTekst('Zij&rsquo;s &amp;#x27;n &lt;3'), M.htmlTekst('Caf&#233; &onbekend;')],
    ["The Lesbiana's", 'Rock & roll', "Zij\u2019s 'n <3", 'Café &onbekend;']);
  const rijen = [{ aankoop_id: 'K0001', titel: 'The Lesbiana&#x27;s', auteur: 'Fictief, Kim', genre: 'Fictie &amp; poëzie' }, { aankoop_id: 'K0002', titel: 'Gewoon', auteur: '', genre: '' }];
  gelijk(M.aankoopTekensHerstellen(rijen), 1);
  gelijk([rijen[0].titel, rijen[0].genre, rijen[1]._gewijzigd], ["The Lesbiana's", 'Fictie & poëzie', undefined]);
  const b = M.bolBoekUitHtml('<script type="application/ld+json">{"@type":"Product","name":"The Lesbiana&#x27;s","author":{"name":"Vera &amp; Noor"}}</script>', 'l');
  gelijk([b.titel, b.auteur], ["The Lesbiana's", 'Vera & Noor']);
});

test('aankooplijst: titel van bol.com met auteur, ISBN en categorie erin wordt gesplitst', () => {
  gelijk(M.bolTitelSplitsen({ titel: 'Een verzonnen roman, Kim Fictief | 9780306406157 | Boeken', auteur: '', isbn: '', genre: '' }),
    { titel: 'Een verzonnen roman', auteur: 'Kim Fictief', isbn: '9780306406157', genre: '' });
  gelijk(M.bolTitelSplitsen({ titel: 'Zee, wind en glas, Vera Verzonnen | Poëzie', auteur: 'Vera Verzonnen', isbn: '9781861972712', genre: '' }),
    { titel: 'Zee, wind en glas', auteur: 'Vera Verzonnen', isbn: '9781861972712', genre: 'Poëzie' }, 'Komma in de titel blijft, gekende auteur weg');
  gelijk(M.bolTitelSplitsen({ titel: 'Gewone titel', auteur: '' }).titel, 'Gewone titel');
  const rijen = [{ aankoop_id: 'K0001', titel: 'Een verzonnen roman, Kim Fictief | 9780306406157 | Boeken', auteur: '', isbn: '', genre: '' }];
  gelijk(M.aankoopTekensHerstellen(rijen), 1);
  gelijk([rijen[0].titel, rijen[0].auteur, rijen[0].isbn], ['Een verzonnen roman', 'Kim Fictief', '9780306406157']);
});

test('aankooplijst: wat de bladwijzer op bol.com kopieerde, lezen', () => {
  const pagina1 = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Atlas van niets &amp; meer",' +
    '"gtin13":"9780306406157","author":{"@type":"Person","name":"Noor Bedacht"},"category":"Fictie","offers":{"@type":"Offer","price":"19.99","priceCurrency":"EUR"}}</script>';
  const pagina2 = '<meta property="og:title" content="Stille lichten | bol">\nEAN</dt><dd>9781861972712\n<meta itemprop="price" content="12.50">\n>Auteur</dt><dd><a href="/x">Kim Fictief</a>';
  gelijk(M.bolBoekUitHtml(pagina1, 'l1'), { titel: 'Atlas van niets & meer', auteur: 'Noor Bedacht', isbn: '9780306406157', prijs: 19.99, genre: 'Fictie', link: 'l1' });
  const b2 = M.bolBoekUitHtml(pagina2, 'l2');
  gelijk([b2.titel, b2.isbn, b2.prijs, b2.auteur], ['Stille lichten', '9781861972712', 12.5, 'Kim Fictief']);
  const tekst = 'MADRIGAL1' + JSON.stringify([
    { l: 'https://www.bol.com/nl/nl/p/atlas-van-niets/9300000111111111/', h: pagina1 },
    { l: 'https://www.bol.com/nl/nl/p/stille-lichten/9300000222222222/', h: pagina2 },
    { l: 'https://voorbeeld.test/vreemd', h: pagina1 },
    { l: 'https://www.bol.com/nl/nl/p/leeg/9300000333333333/', h: '<html></html>' }]);
  const r = M.aankoopUitBladwijzer(tekst);
  gelijk([r.ok, r.boeken.map((b) => b.isbn), r.overgeslagen], [true, ['9780306406157', '9781861972712'], 2], 'Enkel links van bol.com, zonder titel overgeslagen');
  assert.ok(/niet wat de bladwijzer/.test(M.aankoopUitBladwijzer('9780306406157').fout));
  assert.ok(/niet volledig/.test(M.aankoopUitBladwijzer('MADRIGAL1[{"l":').fout));
  assert.ok(/geen boeken/.test(M.aankoopUitBladwijzer('MADRIGAL1[]').fout));
  // ISBN's plakken: geldige, uniek, ook ISBN-10.
  gelijk(M.isbnsUitTekst('9780306406157, 978-0-306-40615-7\n0-306-40615-2 en 1234567890123'), ['9780306406157']);
  gelijk(M.aankoopUitGoogle('9780306406157', { title: 'Atlas', subtitle: 'van niets', authors: ['Noor Bedacht'], categories: ['Fiction'] }),
    { isbn: '9780306406157', titel: 'Atlas: van niets', auteur: 'Noor Bedacht', genre: 'Fiction', prijs: '', link: '' });
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
test('cover via een link: afbeelding, webpagina (og:image) en Google Afbeeldingen', () => {
  gelijk(M.echteAfbeeldingLink('https://www.google.com/imgres?imgurl=https%3A%2F%2Fvoorbeeld.test%2Fcover.jpg&imgrefurl=x'), 'https://voorbeeld.test/cover.jpg');
  gelijk(M.echteAfbeeldingLink('http://voorbeeld.test/a.png'), 'https://voorbeeld.test/a.png');
  gelijk(M.afbeeldingUitHtml('<meta property="og:image" content="/img/c.jpg">', 'https://winkel.test/boek/1'), 'https://winkel.test/img/c.jpg');
  gelijk(M.afbeeldingUitHtml('<meta content="//cdn.test/c.webp" property="og:image">', 'https://winkel.test/'), 'https://cdn.test/c.webp');
  const s = maakStaat();
  const opgehaald = [];
  const web = {
    'https://winkel.test/boek/1': { code: 200, type: 'text/html; charset=utf-8', tekst: '<meta property="og:image" content="https://winkel.test/c.jpg">' },
    'https://winkel.test/c.jpg': { code: 200, type: 'image/jpeg', data: 'QUJD' },
    'https://winkel.test/leeg': { code: 200, type: 'text/html', tekst: '<p>niets</p>' },
    'https://winkel.test/pdf': { code: 200, type: 'application/pdf' }
  };
  const haal = (url) => { opgehaald.push(url); return web[url] || { code: 404, type: '' }; };
  const bewaar = (naam, data, mime) => 'https://lh3.googleusercontent.com/d/' + naam;
  let r = M.coverVanLink(s, { boek_id: 'B0001', url: 'https://winkel.test/boek/1' }, haal, bewaar);
  gelijk([r.ok, s.catalogus[0].cover_url, s.catalogus[0].cover_bron], [true, 'https://lh3.googleusercontent.com/d/B0001.jpg', 'link']);
  gelijk(opgehaald, ['https://winkel.test/boek/1', 'https://winkel.test/c.jpg']);
  assert.ok(/geen afbeelding/.test(M.coverVanLink(s, { boek_id: 'B0001', url: 'https://winkel.test/leeg' }, haal, bewaar).fout));
  assert.ok(/geen JPG/.test(M.coverVanLink(s, { boek_id: 'B0001', url: 'https://winkel.test/pdf' }, haal, bewaar).fout));
  assert.ok(/opent niet \(code 404\)/.test(M.coverVanLink(s, { boek_id: 'B0001', url: 'https://winkel.test/weg' }, haal, bewaar).fout));
  assert.strictEqual(M.coverVanLink(s, { boek_id: 'B0001', url: 'ftp://x' }, haal, bewaar).ok, false);
  assert.strictEqual(M.ACTIES.beheerCoverVanLink, 'vrijwilliger');
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
  gelijk([c.mediaanDagen, c.afgesloten, c.actieveLeners, c.langerDanHalfJaar], [17, 2, 2, 0]);
  assert.strictEqual(c.nieuweLeners.length, 12);
  assert.strictEqual(c.nooitUitgeleend, s.catalogus.filter((b) => M.isUitleenbaar(b) && b.boek_id !== 'B0001' && b.boek_id !== 'B0002').length, 'Enkel uitleenbare boeken die nooit weg waren');
  assert.ok(!('nooitVoorbeelden' in c), 'Geen lijst met voorbeelden meer');
  // Een foute datum (een jaar te laat) trekt de mediaan niet scheef, maar wordt wel gemeld.
  s.uitleningen.push({ uitlening_id: 'U3', exemplaar: 'B0003-1', boek_id: 'B0003', lenersnummer: '1', datum_uit: '2024-11-26', datum_terug: '2026-01-21' });
  const c2 = M.extraCijfers(s);
  gelijk([c2.mediaanDagen, c2.langerDanHalfJaar], [20, 1]);
  const r = M.boekenBulk(s, { ids: ['B0001', 'B0002', 'B9999'], veld: 'genre', waarde: 'Poëzie' });
  gelijk([r.ok, r.gelukt, r.fouten.length], [true, 2, 1]);
  gelijk([s.catalogus[0].genre, s.catalogus[1].genre], ['Poëzie', 'Poëzie']);
  assert.strictEqual(M.boekenBulk(s, { ids: ['B0001'], veld: 'titel', waarde: 'X' }).ok, false, 'Titel mag niet in bulk');
  // Lijsten: iets toevoegen of weghalen, de rest blijft.
  s.catalogus[0].trefwoorden = 'Zee, Licht';
  s.catalogus[1].trefwoorden = '';
  gelijk(M.boekenBulk(s, { ids: ['B0001', 'B0002'], veld: 'trefwoorden', waarde: 'Coming-out, zee', modus: 'erbij' }).gelukt, 2);
  gelijk([s.catalogus[0].trefwoorden, s.catalogus[1].trefwoorden], ['Zee, Licht, Coming-out', 'Coming-out, zee']);
  M.boekenBulk(s, { ids: ['B0001', 'B0002'], veld: 'trefwoorden', waarde: 'ZEE', modus: 'weg' });
  gelijk([s.catalogus[0].trefwoorden, s.catalogus[1].trefwoorden], ['Licht, Coming-out', 'Coming-out']);
  gelijk(M.boekenBulk(s, { ids: ['B0001'], veld: 'trefwoorden', waarde: '', modus: 'erbij' }).ok, false, 'leeg toevoegen kan niet');
});

test('bestuursscherm: keuzelijsten voor thema\'s, categorieën en trefwoorden, en films herkend', () => {
  const cat = [
    { boek_id: 'B1', titel: 'Zee', categorieen: 'Roman, Fictie', trefwoorden: 'lesbisch, Zee', triggerwaarschuwingen: 'Geweld' },
    { boek_id: 'B2', titel: 'Licht', categorieen: 'Essay', trefwoorden: 'Lesbisch' },
    { boek_id: 'F1', titel: 'Film', soort: 'film', genre: 'Drama, Komedie' }
  ];
  const k = M.boekKeuzes(cat);
  gelijk([Array.from(k.categorieen), Array.from(k.trefwoorden), Array.from(k.triggerwaarschuwingen), Array.from(k.filmgenres)],
    [['Essay', 'Roman'], ['lesbisch', 'Zee'], ['Geweld'], ['Drama', 'Komedie']]);
  // Namen uit het tabblad Categorieën en trefwoorden komen er ook bij, ook zonder boek.
  const k2 = M.boekKeuzes(cat, [{ naam: 'Kookboek', soort: 'categorie' }, { naam: 'Pride', soort: 'trefwoord' }, { naam: 'Roman', soort: 'categorie' }, { naam: 'Weg', soort: 'weg' }]);
  gelijk([Array.from(k2.categorieen), Array.from(k2.trefwoorden)], [['Essay', 'Kookboek', 'Roman'], ['lesbisch', 'Pride', 'Zee']]);
  assert.ok(k.themas.indexOf('Gender') > -1 && k.themas.indexOf('Politiek') > -1);
  const s = maakStaat();
  s.catalogus.push({ boek_id: 'F0001', soort: 'film', titel: 'Een film', aantal: 1, uitleenbaar: 'ja', publiek: 'ja' });
  const b = M.baliecatalogus(s).filter((x) => x.id === 'F0001')[0];
  gelijk(b.f, 1);
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
  // Een prijs met datumopmaak: 7,50 is 6/1/1900 om 12:00, 12,25 is 11/1/1900 om 6:00.
  assert.strictEqual(M.datumNaarGetal(new Date(1900, 0, 6, 12, 0)), 7.5);
  assert.strictEqual(M.datumNaarGetal(new Date(1900, 0, 11, 6, 0)), 12.25);
  assert.ok(M.GETALKOLOMMEN.indexOf('prijs') > -1);
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

test('boek verloren: uitlening afgesloten, status verloren, borg ingehouden telt niet als terug te betalen', () => {
  const s = maakStaat();
  s.uitleningen = [];
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0002-1', '2');
  const [een, twee] = s.uitleningen;
  let r = M.boekVerloren(s, { uitlening_id: een.uitlening_id, borg: 'ingehouden', opmerking: 'lener betaalt de waarde' });
  assert.ok(r.ok && /ingehouden/.test(r.tekst), r.tekst);
  gelijk([een.datum_terug, een.staat_terug, een.borg_terugbetaald], ['2026-10-23', 'verloren: lener betaalt de waarde', '']);
  const b1 = s.catalogus.find((b) => b.boek_id === 'B0001');
  gelijk([M.boekStatus(b1), M.isUitleenbaar(b1), /verloren bij lener 1/.test(b1.notitie)], ['verloren', false, true]);
  assert.strictEqual(M.boekVerloren(s, { uitlening_id: een.uitlening_id }).ok, false, 'Al afgesloten');
  // Meer exemplaren: status blijft leeg, wel een notitie en de vraag om het aantal te verlagen. Borg terugbetaald.
  r = M.boekVerloren(s, { uitlening_id: twee.uitlening_id, borg: 'terugbetaald' });
  const b2 = s.catalogus.find((b) => b.boek_id === 'B0002');
  gelijk([M.boekStatus(b2), twee.borg_terugbetaald, /verlaag het aantal/.test(r.tekst)], ['', '2026-10-23', true]);
  // Cijfers: geen borg terug te betalen, niet in de uitleenduur, wel in het aantal uitleningen.
  const c = M.bestuurCijfers(s, []);
  gelijk([c.extraCijfers.afgesloten, c.extraCijfers.mediaanDagen], [0, 0]);
  const g = M.bestuurGegevens(s, []);
  gelijk([g.borgen.terugTeBetalen.length, g.borgen.ingehouden.totaal], [0, 0]);
});

test('te vervangen: verloren exemplaren, niet bij Terug te zetten, vervangen of niet', () => {
  const s = maakStaat();
  s.uitleningen = [];
  uitleen(s, 'B0001', '1');
  uitleen(s, 'B0003', '2');
  M.boekVerloren(s, { uitlening_id: s.uitleningen[0].uitlening_id, borg: 'ingehouden' });
  M.terugbrengen(s, { uitlening_id: s.uitleningen[1].uitlening_id });
  s.catalogus.find((b) => b.boek_id === 'B0004').status = 'verloren';
  gelijk(M.vandaagTerug(s, null).map((x) => x.boek_id), ['B0003'], 'Verloren staat niet bij Terug te zetten');
  let lijst = M.teVervangen(s, true);
  gelijk(lijst.map((x) => [x.sleutel.charAt(0), x.boek_id, x.borg || '']), [['U', 'B0001', 'ingehouden'], ['B', 'B0004', '']]);
  assert.ok(!('borg' in M.teVervangen(s, false)[0]), 'Vrijwilligers zien de borg niet');
  // Vervangen: de status verloren gaat weg, het boek is weer uitleenbaar.
  let r = M.boekVervangen(s, { sleutel: lijst[0].sleutel, keuze: 'vervangen' });
  const b1 = s.catalogus.find((b) => b.boek_id === 'B0001');
  gelijk([r.ok, M.boekStatus(b1), M.isUitleenbaar(b1), /vervangen op/.test(s.uitleningen[0].staat_terug)], [true, '', true, true]);
  // Niet vervangen: blijft verloren, verdwijnt uit de lijst.
  r = M.boekVervangen(s, { sleutel: 'B:B0004', keuze: 'niet' });
  gelijk([r.ok, M.boekStatus(s.catalogus.find((b) => b.boek_id === 'B0004')), M.teVervangen(s, true).length], [true, 'verloren', 0]);
  assert.strictEqual(M.boekVervangen(s, { sleutel: 'B:B0004', keuze: 'iets' }).ok, false);
  assert.strictEqual(M.isVerlorenUitlening(s.uitleningen[0]), true, 'Blijft een verloren uitlening voor de cijfers');
});

test('lener markeren: uitlenen en reserveren kunnen niet, de balie ziet de reden nooit', () => {
  const s = maakStaat();
  s.uitleningen = [];
  let r = M.lenerAanpassen(s, { lenersnummer: '1', voornaam: 'Sam', telefoon: '0470 00 00 01', markering: 'boek van maart nog niet terug' });
  const l = s.leners.find((x) => String(x.lenersnummer) === '1');
  gelijk([r.ok, l.markering, l.markering_sinds], [true, 'boek van maart nog niet terug', '2026-10-23']);
  r = uitleen(s, 'B0001', '1');
  gelijk([r.ok, r.gemarkeerd, /contact op te nemen met het bestuur/.test(r.fout), /maart/.test(r.fout)], [false, true, true, false]);
  assert.strictEqual(M.reserveren(s, { boek_id: 'B0001', lenersnummer: '1' }).gemarkeerd, true);
  const balie = M.balieGegevens(s).leners.find((x) => String(x.n) === '1');
  gelijk(balie, { n: '1', v: 'Sam', m: 1 }, 'Enkel dat er een markering is');
  assert.ok(!JSON.stringify(M.balieGegevens(s)).includes('maart'), 'De reden staat nergens in de gegevens van de balie');
  assert.ok(!JSON.stringify(M.vrijwilligerGegevens(s, [])).includes('maart'), 'Ook niet bij de vrijwilligers');
  gelijk(M.bestuurGegevens(s, []).leners.find((x) => String(x.lenersnummer) === '1').markering, 'boek van maart nog niet terug');
  // Weghalen: dan kan het weer.
  M.lenerAanpassen(s, { lenersnummer: '1', voornaam: 'Sam', telefoon: '0470 00 00 01', markering: '' });
  gelijk([l.markering, l.markering_sinds, uitleen(s, 'B0001', '1').ok], ['', '', true]);
});

test('verlengen met een zelf gekozen datum, op een openingsdag', () => {
  const s = maakStaat();
  s.uitleningen = [];
  uitleen(s, 'B0001', '1');
  const u = s.uitleningen[0];
  assert.strictEqual(M.verlengen(s, { uitlening_id: u.uitlening_id, tot: '2026-10-20' }).ok, false, 'Niet in het verleden');
  assert.strictEqual(M.verlengen(s, { uitlening_id: u.uitlening_id, tot: '2027-06-01' }).ok, false, 'Niet verder dan 6 maanden');
  assert.strictEqual(M.verlengen(s, { uitlening_id: u.uitlening_id, tot: 'morgen' }).ok, false);
  const r = M.verlengen(s, { uitlening_id: u.uitlening_id, tot: '2026-12-29' });
  gelijk([r.ok, u.vervaldatum, Number(u.aantal_verlengingen)], [true, '2027-01-01', 1], 'Dinsdag schuift naar vrijdag');
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
  // Met een rij in Vaste events: andere titel op de website, uur, plaats en tekst (ook in het Engels).
  const details = [{ naam: 'leesavond', titel: 'Leesavond, georganiseerd door een verzonnen club', titel_en: 'Reading night', uur: '19u00', locatie: 'Peperfabriek', tekst: 'Lees mee.\nMail naar info@voorbeeld.test', tekst_en: '', link: 'javascript:alert(1)' }];
  const metTekst = M.vasteEventsVoorAgenda(inst, '2026-10-25', [], details);
  const lees = metTekst.find((e) => e.datum === '2026-11-13');
  gelijk([lees.titel, lees.uur, lees.locatie, lees.tekst, lees.link], [{ nl: 'Leesavond, georganiseerd door een verzonnen club', en: 'Reading night' }, '19u00', 'Peperfabriek', { nl: 'Lees mee.\nMail naar info@voorbeeld.test', en: 'Lees mee.\nMail naar info@voorbeeld.test' }, '']);
  gelijk(metTekst.find((e) => e.datum === '2026-10-30').titel.nl, 'Soepcafé', 'Zonder rij: enkel de naam');
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


test('Titels: schrijfwijze per taal', () => {
  const namen = { dorian: true, gray: true, antwerpen: true };
  assert.strictEqual(M.titelSchrijfwijze('the picture of dorian gray', 'Engels', namen), 'The Picture of Dorian Gray');
  assert.strictEqual(M.titelSchrijfwijze('A Room Of One\'s Own', 'Engels', namen), 'A Room of One\'s Own');
  assert.strictEqual(M.titelSchrijfwijze('what we fight for', 'Engels', namen), 'What We Fight For');
  assert.strictEqual(M.titelSchrijfwijze('Het Portret Van Dorian Gray', 'Nederlands', namen), 'Het portret van Dorian Gray');
  assert.strictEqual(M.titelSchrijfwijze('ZOMER IN ANTWERPEN', 'Nederlands', namen), 'Zomer in Antwerpen');
  assert.strictEqual(M.titelSchrijfwijze('Een Gids Voor LGBTQ Ouders', 'Nederlands', namen), 'Een gids voor LGBTQ ouders');
  assert.strictEqual(M.titelSchrijfwijze('Thuis: Verhalen Van Hier', 'Nederlands', namen), 'Thuis: Verhalen van hier', 'ondertitel met een hoofdletter');
  assert.strictEqual(M.titelSchrijfwijze('Brieven aan Mira', 'Nederlands', namen), 'Brieven aan Mira', 'een bewuste hoofdletter blijft');
  assert.strictEqual(M.titelSchrijfwijze('Die Nacht Am See', 'Duits', namen), 'Die Nacht Am See', 'Duits blijft zoals het is');
  assert.strictEqual(M.titelSchrijfwijze('Een Titel', '', namen), 'Een Titel', 'zonder taal niets');
});

test('Titels: nakijklijst en toepassen', () => {
  const cat = [
    { boek_id: 'B1', titel: 'De Blauwe Kamer', taal: 'Nederlands', auteur: 'Fien Verzonnen' },
    { boek_id: 'B2', titel: 'De blauwe kamer', taal: 'Nederlands' },
    { boek_id: 'B3', titel: 'the long road', taal: 'Engels' }
  ];
  const lijst = M.titelNakijklijst(cat);
  gelijk(lijst.map((r) => [r.boek_id, r.titel_nieuw]), [['B1', 'De blauwe kamer'], ['B3', 'The Long Road']]);
  lijst[1].toepassen = 'nee';
  cat[0].titel = 'De Blauwe  Kamer';
  const uit = M.titelsToepassen(cat, lijst);
  gelijk(uit, { gedaan: 1, overgeslagen: 0 });
  assert.strictEqual(cat[0].titel, 'De blauwe kamer');
  assert.strictEqual(cat[2].titel, 'the long road');
  assert.strictEqual(lijst[0].toepassen, 'gedaan');
  const cellen = [['titel', 'taal'], ['De Blauwe Kamer', 'Nederlands'], ['', ''], ['the long road', 'Engels']];
  let schrijfbeurten = 0;
  const blad = { getLastRow: () => cellen.length, getRange: (r, k, n) => ({
    getValues: () => cellen.slice(r - 1, r - 1 + n).map((rij) => [rij[k - 1]]),
    setValues: (w) => { schrijfbeurten++; w.forEach((x, i) => { cellen[r - 1 + i][k - 1] = x[0]; }); }
  }) };
  const tab = { blad, kop: ['titel', 'taal'], rijen: [{ _rij: 2, titel: 'De Blauwe Kamer' }, { _rij: 4, titel: 'the long road' }] };
  M.wijzig(tab.rijen[0], { titel: 'De blauwe kamer' });
  M.wijzig(tab.rijen[1], { titel: 'The Long Road' });
  M.schrijfKolommen(tab, ['titel', 'taal']);
  assert.strictEqual(schrijfbeurten, 1, 'alles in één keer');
  gelijk(cellen.map((r) => r[0]), ['titel', 'De blauwe kamer', '', 'The Long Road']);
  gelijk(cellen.map((r) => r[1]), ['taal', 'Nederlands', '', 'Engels'], 'de taal bleef: die veranderde niet');
  assert.strictEqual(tab.rijen[0]._gewijzigd, false);
  const ander = [{ boek_id: 'B1', titel: 'Een heel andere titel', taal: 'Nederlands' }];
  gelijk(M.titelsToepassen(ander, [{ boek_id: 'B1', titel_nu: 'De Blauwe Kamer', titel_nieuw: 'De blauwe kamer', toepassen: 'ja' }]), { gedaan: 0, overgeslagen: 1 });
});


test('Titels: taal raden uit de titel', () => {
  assert.strictEqual(M.titelTaalRaden('Het geheim van de zee'), 'Nederlands');
  assert.strictEqual(M.titelTaalRaden('Les jours et les nuits'), 'Frans');
  assert.strictEqual(M.titelTaalRaden("L'été des garçons"), 'Frans');
  assert.strictEqual(M.titelTaalRaden('The Long Road Home'), 'Engels');
  assert.strictEqual(M.titelTaalRaden('Der Sommer und das Meer'), 'Duits');
  assert.strictEqual(M.titelTaalRaden("Mira's Room"), '', 'geen kleine woorden: niet raden');
  assert.strictEqual(M.titelTaalRaden('De zee'), '', 'de alleen is niet genoeg');
  assert.strictEqual(M.titelTaalVoorstel('Het geheim van de zee', 'Engels'), 'Nederlands');
  assert.strictEqual(M.titelTaalVoorstel('Het geheim van de zee', 'Nederlands'), '');
  assert.strictEqual(M.titelTaalVoorstel('Het geheim van de zee', ''), 'Nederlands');
  assert.strictEqual(M.titelTaalVoorstel('Het geheim van de zee', 'Nederlands, Engels'), '', 'meer talen: laten staan');
  assert.strictEqual(M.titelTaalVoorstel('Understanding Human Puppy Play', 'Engels'), '');
  assert.strictEqual(M.titelTaalVoorstel('A Man in Love', 'Engels'), '', 'twijfel: Engels blijft');
  assert.strictEqual(M.titelTaalVoorstel('When Sam Met Kim', 'Engels'), '');
  assert.strictEqual(M.titelTaalVoorstel('Over the Rainbow', 'Engels'), '');
  assert.strictEqual(M.titelTaalVoorstel('Jongens zijn wij allemaal', 'Engels'), 'Nederlands');
});

test('Titels: verkeerde taal in de nakijklijst en toepassen', () => {
  const cat = [
    { boek_id: 'B1', titel: 'Het Geheim Van De Zee', taal: 'Engels' },
    { boek_id: 'B2', titel: 'Het geheim van de zee', taal: 'Engels' },
    { boek_id: 'B3', titel: 'The long road home', taal: 'Engels' }
  ];
  const lijst = M.titelNakijklijst(cat);
  gelijk(lijst.map((r) => [r.boek_id, r.taal_nieuw, r.titel_nieuw, r.toepassen]), [
    ['B1', 'Nederlands', 'Het geheim van de zee', 'nee'],
    ['B2', 'Nederlands', 'Het geheim van de zee', 'nee'],
    ['B3', '', 'The Long Road Home', 'ja']
  ]);
  const omgekeerd = M.titelNakijklijst([cat[2], cat[0]]);
  gelijk(omgekeerd.map((r) => r.boek_id), ['B1', 'B3'], 'een andere taal staat bovenaan');
  lijst[0].toepassen = 'ja'; lijst[1].toepassen = 'ja';
  gelijk(M.titelsToepassen(cat, lijst), { gedaan: 3, overgeslagen: 0 });
  gelijk(cat.map((b) => [b.titel, b.taal]), [['Het geheim van de zee', 'Nederlands'], ['Het geheim van de zee', 'Nederlands'], ['The Long Road Home', 'Engels']]);
  gelijk(cat[1]._velden, { taal: true }, 'enkel de taal veranderd');
});


test('Titels: gewone woorden zijn geen namen, ook als een auteur zo heet', () => {
  const cat = [
    { boek_id: 'B1', titel: 'Ik Ben', taal: 'Nederlands', auteur: 'Ben Verzonnen' },
    { boek_id: 'B2', titel: 'Alles Wat Was', taal: 'Nederlands', auteur: 'Fien Was' },
    { boek_id: 'B3', titel: 'Wie ik ben', taal: 'Nederlands', beschrijving: 'Ik ben er niet. Wat ben je? Het was laat en het was koud. Wie was er? Jij ben het.' },
    { boek_id: 'B4', titel: 'Een brief voor Dorian', taal: 'Nederlands', auteur: 'Kim Dorian', beschrijving: 'Een brief aan Dorian. Toen zag ik Dorian.' }
  ];
  const namen = M.titelNamen(cat);
  assert.strictEqual(namen.ben, undefined);
  assert.strictEqual(namen.was, undefined);
  assert.strictEqual(namen.dorian, true);
  assert.strictEqual(M.titelSchrijfwijze('Ik ben', 'Nederlands', namen), 'Ik ben');
  assert.strictEqual(M.titelSchrijfwijze('Alles wat was', 'Nederlands', namen), 'Alles wat was');
  assert.strictEqual(M.titelSchrijfwijze('Een Brief Voor Dorian', 'Nederlands', namen), 'Een brief voor Dorian');
});

test('Titels: een titel die een datum werd, blijft staan', () => {
  const t = 'Mon Jul 24 2023 00:00:00 GMT+0200 (Midden-Europese zomertijd)';
  assert.strictEqual(M.titelSchrijfwijze(t, 'Nederlands', {}), t);
  gelijk(M.titelNakijklijst([{ boek_id: 'B1', titel: t, taal: 'Nederlands' }]), []);
});


test('bewaarAchtergrond: kolom per kolom in één keer, andere cellen blijven zoals ze waren', () => {
  const datum = new Date(2026, 0, 5, 12);
  const cellen = [['boek_id', 'titel', 'cover_url', 'datum_toegevoegd'], ['B1', 'Een', '', datum], ['B2', 'Twee', 'oud', datum], ['B3', 'Drie', '', datum]];
  let schrijfbeurten = 0;
  const blad = {
    getLastRow: () => cellen.length,
    getDataRange: () => ({ getValues: () => cellen.map((r) => r.slice()) }),
    getRange: (r, k, n, m) => ({
      getValues: () => cellen.slice(r - 1, r - 1 + n).map((rij) => rij.slice(k - 1, k - 1 + (m || 1))),
      setValues: (w) => { schrijfbeurten++; w.forEach((x, i) => x.forEach((v, j) => { cellen[r - 1 + i][k - 1 + j] = v; })); }
    })
  };
  const oud = { spreadsheet: M.spreadsheet, LockService: M.LockService };
  M.spreadsheet = () => ({ getSheetByName: () => blad });
  M.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
  try {
    const tabel = M.leesTabel('Catalogus');
    M.wijzig(tabel.rijen[0], { cover_url: 'https://voorbeeld.test/1.jpg' });
    M.wijzig(tabel.rijen[2], { cover_url: 'https://voorbeeld.test/3.jpg' });
    cellen[2][1] = 'Twee (intussen aangepast)';
    assert.strictEqual(M.bewaarAchtergrond(tabel), true);
  } finally {
    M.spreadsheet = oud.spreadsheet; M.LockService = oud.LockService;
  }
  assert.strictEqual(schrijfbeurten, 1);
  gelijk(cellen.map((r) => r[2]), ['cover_url', 'https://voorbeeld.test/1.jpg', 'oud', 'https://voorbeeld.test/3.jpg']);
  assert.strictEqual(cellen[2][1], 'Twee (intussen aangepast)');
  assert.ok(cellen[1][3] instanceof Date || Object.prototype.toString.call(cellen[1][3]) === '[object Date]', 'een datum blijft een datum');
});


test('Titelcontrole: gelijk of echt anders', () => {
  assert.strictEqual(M.controleTitelGelijk('Het Portret', 'het portret!'), true, 'hoofdletters en leestekens tellen niet');
  assert.strictEqual(M.controleTitelGelijk('Zomer: verhalen', 'Zomer'), true, 'een ondertitel erbij telt niet');
  assert.strictEqual(M.controleTitelGelijk('Zomer - verhalen', 'Zomer'), true);
  assert.strictEqual(M.controleTitelGelijk("Mira's Room", 'Miras Room'), false, 'een letter anders telt');
  assert.strictEqual(M.controleTitelGelijk('Zomer: verhalen', 'Zomer: gedichten'), false, 'een andere ondertitel telt');
  assert.strictEqual(M.controleAuteurGelijk('Verzonnen, Fien', 'Fien Verzonnen'), true, 'volgorde van de namen telt niet');
  assert.strictEqual(M.controleAuteurGelijk('Fien Verzonnen & Kim Bedacht', 'Kim Bedacht en Fien Verzonnen'), true);
  assert.strictEqual(M.controleAuteurGelijk('Fien Verzonen', 'Fien Verzonnen'), false);
  assert.strictEqual(M.controleAuteurGelijk('Verzonnen, Fien', 'Fien Verzonen'), true, 'de juiste vorm wint');
  assert.strictEqual(M.controleAuteurGelijk('', 'Fien Verzonnen'), true, 'een lege auteur is geen verschil');
});

test('Titelcontrole: lijst maken uit stock, oude website en Catalogus', () => {
  const stock = [
    { soort: 'boek', isbn: '9780000000011', titel: "Mira's Room", auteur: 'Verzonnen, Fien' },
    { soort: 'boek', isbn: '9780000000028', titel: 'De blauwe kamer', auteur: 'Bedacht, Kim' },
    { soort: 'boek', isbn: '9780000000035', titel: 'Zomer', auteur: 'Uitvinder, Sam' }
  ];
  const cat = stock.map((b, i) => ({ boek_id: 'B' + (i + 1), soort: 'boek', isbn: b.isbn, titel: b.titel, auteur: b.auteur, bron_sleutel: M.bronSleutel(b) }));
  cat[0].titel = 'Miras Room';           // fout overgetypt
  cat[2].titel = 'Zomer: verhalen';      // enkel een ondertitel erbij
  cat.push({ boek_id: 'B4', soort: 'boek', titel: 'Los boek', auteur: 'Iemand, Jo', bron_sleutel: 'boek:ta:los' });
  const oud = [
    { id: '1', isbn: '9780000000028', titel: 'De blauwe kamer', ondertitel: '', auteur: 'Kim Bedagt' },
    { id: '2', isbn: '9780000000035', titel: 'Zomer', ondertitel: 'verhalen', auteur: 'Sam Uitvinder' }
  ];
  const rijen = M.titelcontroleRijen(cat, stock, oud, []);
  gelijk(rijen.map((r) => [r.boek_id, r.titel_nu, r.titel_stock, r.titel_oud, r.auteur_oud]), [
    ['B1', 'Miras Room', "Mira's Room", '', '']
  ], 'B2: de oude website schrijft de auteur niet als Achternaam, Voornaam, dat telt niet');
  oud[0].auteur = 'Bedagt, Kim';
  gelijk(M.titelcontroleRijen(cat, stock, oud, []).map((r) => r.boek_id), ['B1', 'B2'], 'in de juiste vorm telt een andere naam wel');
  gelijk(M.titelcontroleRijen(cat, stock, oud, [{ boek_id: 'B1', status: 'klopt' }]).map((r) => r.boek_id), ['B2'], 'wat nagekeken is, komt niet terug');
});

test('Titelcontrole: kiezen, aanpassen, niet in de kast', () => {
  const cat = [{ boek_id: 'B1', titel: 'Miras Room', auteur: 'Verzonnen, Fien', bron_sleutel: 'boek:isbn:1' }, { boek_id: 'B2', titel: 'Zee', auteur: 'Bedacht, Kim' }];
  const rijen = [
    { boek_id: 'B1', titel_nu: 'Miras Room', titel_stock: "Mira's Room", auteur_stock: 'Verzonnen, Fien', status: '' },
    { boek_id: 'B2', titel_nu: 'Zee', titel_oud: 'De zee', auteur_oud: 'Kim Bedacht', status: '' }
  ];
  let r = M.titelcontroleToepassen(cat, rijen, { boek_id: 'B1', status: 'aangepast', titel: "Mira's Room", auteur: 'Verzonnen, Fien' }, 'Kim', '2026-11-02');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.catalogusGewijzigd, true);
  assert.strictEqual(cat[0].titel, "Mira's Room");
  assert.strictEqual(cat[0].bron_sleutel, 'boek:isbn:1', 'de bron_sleutel blijft');
  gelijk([rijen[0].status, rijen[0].wie, rijen[0].datum], ['aangepast', 'Kim', '2026-11-02']);
  r = M.titelcontroleToepassen(cat, rijen, { boek_id: 'B2', status: 'aangepast', titel: 'Zee', auteur: 'Bedacht, Kim' }, 'Kim', '2026-11-02');
  assert.strictEqual(rijen[1].status, 'klopt', 'niets veranderd: klopt');
  r = M.titelcontroleToepassen(cat, rijen, { boek_id: 'B2', status: 'niet in de kast' }, 'Kim', '2026-11-02');
  assert.strictEqual(rijen[1].status, 'niet in de kast');
  const lijst = M.titelcontroleLijst(cat, rijen);
  gelijk([lijst.open.length, lijst.nietGevonden.map((x) => x.id), lijst.gedaan], [0, ['B2'], 1]);
  assert.strictEqual(M.titelcontroleAantal(rijen), 0);
  assert.strictEqual(M.titelcontroleAantal([{ boek_id: 'B1', status: '' }, { boek_id: 'B2', status: 'klopt' }, { boek_id: '', status: '' }]), 1);
  assert.strictEqual(M.titelcontroleAantal(undefined), 0);
  M.titelcontroleToepassen(cat, rijen, { boek_id: 'B2', status: 'open' }, 'Kim', '2026-11-02');
  gelijk(M.titelcontroleLijst(cat, rijen).open.map((x) => [x.id, x.nu.t, x.oud.t, x.stock]), [['B2', 'Zee', 'De zee', null]]);
  assert.strictEqual(M.titelcontroleToepassen(cat, rijen, { boek_id: 'B1', status: 'aangepast', titel: ' ' }, 'Kim', '2026-11-02').ok, false);
  assert.strictEqual(M.titelcontroleToepassen(cat, rijen, { boek_id: 'B9', status: 'klopt' }, 'Kim', '2026-11-02').ok, false);
});


test('Titelcontrole: auteurs in de vorm Achternaam, Voornaam, zonder dubbels', () => {
  assert.strictEqual(M.controleAuteurGelijk('J.R. Ackerley; J. R. Ackerley', 'Ackerley, J.R'), true, 'dubbele naam telt niet');
  assert.strictEqual(M.controleAuteurZonderDubbels('J.R. Ackerley; J. R. Ackerley'), 'J.R. Ackerley');
  assert.strictEqual(M.controleAuteurZonderDubbels('Verzonnen, Fien; Bedacht, Kim'), 'Verzonnen, Fien; Bedacht, Kim', 'twee echte auteurs blijven');
  assert.strictEqual(M.controleAuteurVerbeterd('J.R. Ackerley; J. R. Ackerley', ['Ackerley, J.R', '']), 'Ackerley, J.R');
  assert.strictEqual(M.controleAuteurVerbeterd('Nir Verzonnen', ['Verzonnen, Nir']), 'Verzonnen, Nir');
  assert.strictEqual(M.controleAuteurVerbeterd('Verzonnen, Nir', ['Nir Verzonnen']), '', 'al juist');
  assert.strictEqual(M.controleAuteurVerbeterd('Nir Verzonnen', ['Nir Verzonnen']), '', 'geen bron met de juiste vorm: niet raden');
  assert.strictEqual(M.controleAuteurVerbeterd('Nir Verzonnen', ['Verzonnen, Kim']), '', 'een andere naam: niet overnemen');
  assert.strictEqual(M.controleAuteurVerbeterd('Nir Verzonnen; Nir Verzonnen', []), 'Nir Verzonnen', 'enkel de dubbel eruit');
  // In de lijst: enkel anders geschreven, dan verbeterd en niet op de lijst.
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: 'Een zomer', auteur: 'Verzonnen, Nir' },
    { soort: 'boek', isbn: '9780000000028', titel: 'De kamer', auteur: 'Bedacht, J.R' }];
  const cat = [
    { boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: 'Een zomer', auteur: 'Nir Verzonnen', bron_sleutel: M.bronSleutel(stock[0]) },
    { boek_id: 'B2', soort: 'boek', isbn: stock[1].isbn, titel: 'De kamers', auteur: 'J.R. Bedacht; J. R. Bedacht', bron_sleutel: M.bronSleutel(stock[1]) }
  ];
  const verbeterd = [];
  const rijen = M.titelcontroleRijen(cat, stock, [], [], verbeterd);
  gelijk(verbeterd, ['B1', 'B2']);
  gelijk(cat.map((b) => b.auteur), ['Verzonnen, Nir', 'Bedacht, J.R']);
  gelijk(rijen.map((r) => [r.boek_id, r.auteur_nu]), [['B2', 'Bedacht, J.R']], 'B2 blijft voor de titel');
  const zonder = [{ boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: 'Een zomer', auteur: 'Nir Verzonnen', bron_sleutel: M.bronSleutel(stock[0]) }];
  M.titelcontroleRijen(zonder, stock, [], []);
  assert.strictEqual(zonder[0].auteur, 'Nir Verzonnen', 'zonder lijst verandert er niets');
});


test('Titelcontrole: meerdere auteurs, een bron met minder namen', () => {
  const vol = 'Verzonnen, Gea van & Bedacht, Tinne Van den';
  assert.strictEqual(M.controleAuteurGelijk(vol, 'Gea van Verzonnen'), true, 'een deel van de namen is geen verschil');
  assert.strictEqual(M.controleAuteurGelijk(vol, 'Gea van Verzonnen & Kim Ander'), true, 'een bron zonder de juiste vorm telt niet');
  assert.strictEqual(M.controleAuteurGelijk(vol, 'Verzonnen, Gea van & Ander, Kim'), false, 'een andere naam in de juiste vorm wel');
  assert.strictEqual(M.controleAuteurGelijk('Kim Bedacht', 'Kim Bedacht en Jo Bos'), true);
  assert.strictEqual(M.controleAuteurVerbeterd('Gea van Verzonnen', [vol, '']), vol, 'de vollediger versie wint');
  assert.strictEqual(M.controleAuteurVerbeterd(vol, ['Gea van Verzonnen']), '', 'nu is al volledig');
  assert.strictEqual(M.controleAuteurVerbeterd('Verzonnen, Gea van', [vol]), vol, 'ook als nu al de juiste vorm heeft');
  assert.strictEqual(M.controleAuteurZonderDubbels('Bos, Jo & Bos, Jo & Dam, Kim'), 'Bos, Jo & Dam, Kim');
  gelijk(M.controleNamen('Bos, Jo & Dam, Kim; Jo Bos'), ['bos jo', 'dam kim']);
  // In de lijst: enkel een auteur minder op de oude website, dan niet op de lijst.
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: "De mama's van Mira", auteur: vol }];
  const cat = [{ boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: "De mama's van Mira", auteur: vol, bron_sleutel: M.bronSleutel(stock[0]) }];
  const oud = [{ id: '1', isbn: stock[0].isbn, titel: "De mama's van Mira", ondertitel: '', auteur: 'Gea van Verzonnen' }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, stock, oud, [], verbeterd), []);
  gelijk(verbeterd, []);
});


test('Titelcontrole: ondertitel van de oude website aanvullen, een naam in een langere naam', () => {
  assert.strictEqual(M.controleTitelGelijk('Een land zonder grenzen', 'Een land zonder grenzen. Een reis door verzonnen gebieden'), true);
  assert.strictEqual(M.controleTitelGelijk('Het kan toch...', 'Het Kan Toch...'), true);
  assert.strictEqual(M.controleTitelAangevuld('Een land zonder grenzen', 'Een land zonder grenzen. Een Reis Door Verzonnen Gebieden', 'Nederlands', {}), 'Een land zonder grenzen: Een reis door verzonnen gebieden');
  assert.strictEqual(M.controleTitelAangevuld('Mira Love Signs', 'Mira Love Signs: An Astrological Guide for Women', 'Engels', {}), 'Mira Love Signs: An Astrological Guide for Women');
  assert.strictEqual(M.controleTitelAangevuld('Zomer: verhalen', 'Zomer: gedichten', 'Nederlands', {}), '', 'nu heeft al een ondertitel');
  assert.strictEqual(M.controleTitelAangevuld('Het kan toch...', 'Het Kan Toch...', 'Nederlands', {}), '', 'drie puntjes zijn geen ondertitel');
  assert.strictEqual(M.controleTitelAangevuld('Zomer', 'Winter: verhalen', 'Nederlands', {}), '', 'een andere titel');
  assert.strictEqual(M.controleAuteurGelijk('Aurora', 'Aurora Staff'), true, 'een naam in een langere naam');
  assert.strictEqual(M.controleAuteurGelijk('Verzonnen, Nir', 'Nir Verzonnen'), true);
  assert.strictEqual(M.controleAuteurGelijk('Aaron, Willem', 'Aaron William'), true, 'de vorm Achternaam, Voornaam wint');
  assert.strictEqual(M.controleAuteurGelijk('Aaron, Willem', 'Aaron, William'), false, 'twee keer de juiste vorm, een ander woord: wel een verschil');
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: 'Een land zonder grenzen', auteur: 'Verzonnen, Nir' },
    { soort: 'boek', isbn: '9780000000028', titel: 'Mira Love Signs', auteur: 'Aurora' }];
  const cat = stock.map((b, i) => ({ boek_id: 'B' + (i + 1), soort: 'boek', isbn: b.isbn, titel: b.titel, auteur: b.auteur, taal: i ? 'Engels' : 'Nederlands', bron_sleutel: M.bronSleutel(b) }));
  const oud = [{ id: '1', isbn: stock[0].isbn, titel: 'Een land zonder grenzen. Een reis door bezette gebieden', ondertitel: '', auteur: 'Nir Verzonnen' },
    { id: '2', isbn: stock[1].isbn, titel: 'Mira Love Signs', ondertitel: 'An Astrological Guide for Women', auteur: 'Aurora Staff' }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, stock, oud, [], verbeterd), []);
  gelijk(verbeterd, ['B1', 'B2']);
  gelijk(cat.map((b) => [b.titel, b.auteur]), [['Een land zonder grenzen: Een reis door bezette gebieden', 'Verzonnen, Nir'], ['Mira Love Signs: An Astrological Guide for Women', 'Aurora']]);
});


test('waakhond oude covers: enkel herstarten als er iets te gaan is en niets gepland of bezig', () => {
  assert.strictEqual(M.oudeCoversHerstarten(300, false, false), true);
  assert.strictEqual(M.oudeCoversHerstarten(0, false, false), false);
  assert.strictEqual(M.oudeCoversHerstarten(300, true, false), false);
  assert.strictEqual(M.oudeCoversHerstarten(300, false, true), false);
});


test('Titelcontrole: de titel met ondertitel wint altijd', () => {
  assert.strictEqual(M.controleTitelGelijk('Respect is verzonnen: Durven opstaan', 'Respect is verzonnen'), true);
  assert.strictEqual(M.controleTitelGelijk('Respect is verzonnen: Durven opstaan', 'Respect is verzonnen. Durven opstaan'), true);
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: 'Respect is verzonnen. Durven opstaan', auteur: 'Bedacht, Kim' }];
  const cat = [{ boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: 'Respect is verzonnen', auteur: 'Bedacht, Kim', taal: 'Nederlands', bron_sleutel: M.bronSleutel(stock[0]) }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, stock, [], [], verbeterd), []);
  assert.strictEqual(cat[0].titel, 'Respect is verzonnen: Durven opstaan', 'ook de ondertitel uit de stocklijst komt erbij');
});


test('Titelcontrole: haakjes en komma als ondertitel, voorletters voluit', () => {
  assert.strictEqual(M.controleTitelGelijk('The Complete Works of Mira', 'The Complete Works of Mira (Verzonnen Reeks 102)'), true);
  assert.strictEqual(M.controleTitelGelijk('Homofilie', 'Homofilie, status of stigma : een verzonnen dilemma'), true);
  assert.strictEqual(M.controleTitelGelijk('Het dagboek van Eefje Fonker', 'Het dagboek van Eefje Jonker'), false, 'een letter anders blijft een verschil');
  assert.strictEqual(M.controleTitelAangevuld('The Complete Works of Mira', 'The Complete Works of Mira (Verzonnen Reeks 102)', 'Engels', {}), 'The Complete Works of Mira (Verzonnen Reeks 102)');
  assert.strictEqual(M.controleTitelAangevuld('Homofilie', 'Homofilie, Status Of Stigma : Een Verzonnen Dilemma Voor De Mens', 'Nederlands', {}), 'Homofilie, status of stigma: Een verzonnen dilemma voor de mens');
  assert.strictEqual(M.controleTitelAangevuld('Het kan toch...', 'Het Kan Toch...', 'Nederlands', {}), '');
  assert.strictEqual(M.controleTitelAangevuld('Zee (deel 1)', 'Zee (deel 1): verhalen', 'Nederlands', {}), '', 'nu heeft al iets tussen haakjes');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, H.', ['Hermanus Bedacht']), 'Bedacht, Hermanus');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, H.', ['Bedacht, Hermanus']), 'Bedacht, Hermanus');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, J.R', ['Jan Rik Bedacht']), 'Bedacht, Jan Rik');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, H.', ['Karel Bedacht']), '', 'andere beginletter');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, H.', ['H. Bedacht']), '', 'ook maar voorletters');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, Hans', ['Hermanus Bedacht']), '', 'al voluit');
  assert.strictEqual(M.controleAuteurVoluit('Bedacht, H. & Bos, Jo', ['Hermanus Bedacht; Jo Bos']), 'Bedacht, Hermanus & Bos, Jo');
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: 'Homofilie', auteur: 'Bedacht, H.' }];
  const cat = [{ boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: 'Homofilie', auteur: 'Bedacht, H.', taal: 'Nederlands', bron_sleutel: M.bronSleutel(stock[0]) }];
  const oud = [{ id: '1', isbn: stock[0].isbn, titel: 'Homofilie, status of stigma : een verzonnen dilemma', ondertitel: '', auteur: 'Hermanus Bedacht' }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, stock, oud, [], verbeterd), []);
  gelijk([cat[0].titel, cat[0].auteur], ['Homofilie, status of stigma: Een verzonnen dilemma', 'Bedacht, Hermanus']);
  // Wat het scherm krijgt: per bron of titel en auteur echt anders zijn.
  const l = M.titelcontroleLijst([{ boek_id: 'B9', titel: 'Het dagboek van Eefje Fonker', auteur: 'Anker, Rob' }],
    [{ boek_id: 'B9', titel_stock: 'Het dagboek van Eefje Fonker', auteur_stock: 'Anker, Rob', titel_oud: 'Het Dagboek van Eefje Jonker', auteur_oud: 'Eefje Jonker', status: '' }]);
  gelijk([l.open[0].stock.ta, l.open[0].stock.aa, l.open[0].oud.ta, l.open[0].oud.aa], [false, false, true, false]);
});


test('Titelcontrole: reeksaanduiding met volumenummer', () => {
  assert.strictEqual(M.controleTitelGelijk('Kim XXX', 'XXX (Kim, #6)'), true);
  assert.strictEqual(M.controleTitelGelijk('XXX (Kim, #6)', 'Kim XXX'), true);
  assert.strictEqual(M.controleTitelGelijk('Kim YYY', 'XXX (Kim, #6)'), false);
  assert.strictEqual(M.controleTitelReeks('Kim XXX', 'XXX (Kim, #6)'), 'XXX (Kim, #6)');
  assert.strictEqual(M.controleTitelReeks('XXX', 'XXX (Kim, #6)'), '', 'zonder de reeks in nu: dat doet de regel voor haakjes');
  assert.strictEqual(M.controleTitelReeks('XXX (Kim, #6)', 'XXX (Kim, #7)'), '', 'nu heeft al een reeksaanduiding');
  const stock = [{ soort: 'boek', isbn: '9780000000011', titel: 'Kim XXX', auteur: 'Bedacht, Kim' }];
  const cat = [{ boek_id: 'B1', soort: 'boek', isbn: stock[0].isbn, titel: 'Kim XXX', auteur: 'Bedacht, Kim', bron_sleutel: M.bronSleutel(stock[0]) }];
  const oud = [{ id: '1', isbn: stock[0].isbn, titel: 'XXX (Kim, #6)', ondertitel: '', auteur: 'Kim Bedacht' }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, stock, oud, [], verbeterd), []);
  assert.strictEqual(cat[0].titel, 'XXX (Kim, #6)');
  // Eén boek met een gewone ondertitel tussen haakjes blijft werken.
  assert.strictEqual(M.controleTitelAangevuld('Zee', 'Zee (Verzonnen reeks 2)', 'Nederlands', {}), 'Zee (Verzonnen reeks 2)');
});


test('Titelcontrole: een lege auteur aanvullen, als Achternaam, Voornaam', () => {
  assert.strictEqual(M.controleAuteurOmgedraaid('Matt Verzonnen'), 'Verzonnen, Matt');
  assert.strictEqual(M.controleAuteurOmgedraaid('Gea van Bedacht'), 'Bedacht, Gea van');
  assert.strictEqual(M.controleAuteurOmgedraaid('Tinne Van den Bos'), 'Bos, Tinne Van den');
  assert.strictEqual(M.controleAuteurOmgedraaid('Gea van Bedacht & Kim Bos'), 'Bedacht, Gea van & Bos, Kim');
  assert.strictEqual(M.controleAuteurOmgedraaid('Bos, Kim'), 'Bos, Kim');
  assert.strictEqual(M.controleAuteurOmgedraaid('Aurora'), 'Aurora');
  assert.strictEqual(M.controleAuteurAangevuld('', ['', 'Matt Verzonnen']), 'Verzonnen, Matt');
  assert.strictEqual(M.controleAuteurAangevuld('', ['Bos, Kim', 'Kim Bos']), 'Bos, Kim', 'de stocklijst eerst');
  assert.strictEqual(M.controleAuteurAangevuld('Bos, Kim', ['Jo Dam']), '', 'nu niet leeg');
  const cat = [{ boek_id: 'B1', soort: 'boek', titel: 'Verzonnen Magazine Issue One', auteur: '', bron_sleutel: 'x' }];
  const oud = [{ id: '1', isbn: '', titel: 'Verzonnen Magazine Issue One', ondertitel: '', auteur: 'Matt Verzonnen' }];
  const verbeterd = [];
  M.titelcontroleRijen(cat, [], oud, [], verbeterd);
  assert.strictEqual(cat[0].auteur, 'Verzonnen, Matt');
});


test('Titelcontrole: een verjaardageditie altijd achteraan', () => {
  assert.strictEqual(M.controleEditieNetjes('35th Anniversary Edition of The Verzonnen'), 'The Verzonnen, 35th Anniversary Edition');
  assert.strictEqual(M.controleEditieNetjes('The Verzonnen: 35th Anniversary Edition'), 'The Verzonnen, 35th Anniversary Edition');
  assert.strictEqual(M.controleEditieNetjes('The Verzonnen (10th anniversary edition)'), 'The Verzonnen, 10th anniversary edition');
  assert.strictEqual(M.controleEditieNetjes('The Verzonnen, 35th Anniversary Edition'), 'The Verzonnen, 35th Anniversary Edition');
  assert.strictEqual(M.controleEditieNetjes('Een gewone titel'), 'Een gewone titel');
  assert.strictEqual(M.controleTitelGelijk('The Verzonnen', '35th Anniversary Edition of The Verzonnen'), true);
  const cat = [
    { boek_id: 'B1', soort: 'boek', titel: 'The Verzonnen', auteur: 'Bedacht, Sarah', taal: 'Engels', bron_sleutel: 'x' },
    { boek_id: 'B2', soort: 'boek', titel: '20th Anniversary Edition of Stille Zee', auteur: 'Bos, Kim', taal: 'Engels', bron_sleutel: 'y' }
  ];
  const oud = [{ id: '1', isbn: '', titel: '35th Anniversary Edition of The Verzonnen', ondertitel: '', auteur: 'Sarah Bedacht' }];
  const verbeterd = [];
  gelijk(M.titelcontroleRijen(cat, [], oud, [], verbeterd), []);
  gelijk(cat.map((b) => b.titel), ['The Verzonnen, 35th Anniversary Edition', 'Stille Zee, 20th Anniversary Edition']);
});


test('Titelcontrole: een ondertitel zonder leesteken ervoor', () => {
  const nu = 'Wie had gedacht dat we met zovelen zijn';
  const oud = 'Wie had gedacht dat we met zovelen zijn lesbische vrouwen in de kerk';
  assert.strictEqual(M.controleOndertitelZonderTeken(nu, oud), 'lesbische vrouwen in de kerk');
  assert.strictEqual(M.controleTitelGelijk(nu, oud), true);
  assert.strictEqual(M.controleTitelAangevuld(nu, oud, 'Nederlands', {}), nu + ': Lesbische vrouwen in de kerk');
  assert.strictEqual(M.controleOndertitelZonderTeken('Over normaal verzonnen', 'Over normaal verzonnen hedendaagse homopolitiek'), 'hedendaagse homopolitiek');
  assert.strictEqual(M.controleTitelAangevuld('Over normaal verzonnen', 'Over normaal verzonnen hedendaagse homopolitiek', 'Nederlands', {}), 'Over normaal verzonnen: Hedendaagse homopolitiek');
  assert.strictEqual(M.controleOndertitelZonderTeken('Zee', 'Zee van verhalen'), '', 'een titel van één woord: te onzeker');
  assert.strictEqual(M.controleOndertitelZonderTeken('Een heel lange verzonnen titel', 'Een heel lange verzonnen titel twee'), '', 'een woord erbij is te weinig');
});


test('Titelcontrole: de ondertitel komt erbij, ook bij een tikfout in de hoofdtitel', () => {
  assert.strictEqual(M.controleTitelAangevuld('Amarican Verzonnen', 'American Verzonnen: Community and Perversity', 'Engels', {}), 'Amarican Verzonnen: Community and Perversity');
  assert.strictEqual(M.controleTitelAangevuld('Zee', 'Zon: verhalen', 'Nederlands', {}), '', 'korte titel met een andere letter: niet');
  assert.strictEqual(M.controleTitelAangevuld('De blauwe kamer', 'De groene kamer: verhalen', 'Nederlands', {}), '', 'een ander woord: niet');
  // De tikfout blijft op de lijst, met de ondertitel er al bij.
  const cat = [{ boek_id: 'B1', soort: 'boek', titel: 'Amarican Verzonnen', auteur: 'Bedacht, Jef', taal: 'Engels', bron_sleutel: 'x' }];
  const oud = [{ id: '1', isbn: '', titel: 'American Verzonnen: Community and Perversity', ondertitel: '', auteur: 'Jef Bedacht' }];
  const rijen = M.titelcontroleRijen(cat, [], oud, [], []);
  assert.strictEqual(cat[0].titel, 'Amarican Verzonnen: Community and Perversity');
  gelijk(rijen.map((r) => [r.boek_id, r.titel_nu, r.titel_oud]), [['B1', 'Amarican Verzonnen: Community and Perversity', 'American Verzonnen: Community and Perversity']]);
});


test('Titelcontrole: & en and zijn hetzelfde, ook bij het aanvullen van de ondertitel', () => {
  assert.strictEqual(M.controleTitelGelijk('Verzonnen Ethics & Mira', 'Verzonnen Ethics and Mira'), true);
  assert.strictEqual(M.controleTitelGelijk('Zon & zee', 'Zon en zee'), true);
  assert.strictEqual(M.controleTitelAangevuld('Verzonnen Ethics & Mira', 'Verzonnen Ethics and Mira: Listening to Scripture', 'Engels', {}), 'Verzonnen Ethics & Mira: Listening to Scripture');
  assert.strictEqual(M.controleTitelAangevuld('Well of Verzonnen', 'The Well of Verzonnen: A Novel', 'Engels', {}), 'Well of Verzonnen: A Novel', 'een lidwoord vooraan');
  assert.strictEqual(M.controleTitelAangevuld('Goden zonen', 'Godenzonen: verhalen over mannen', 'Nederlands', {}), 'Goden zonen: Verhalen over mannen', 'een spatie meer');
  assert.strictEqual(M.controleTitelGelijk('Goden zonen: Verhalen over mannen', 'Godenzonen: verhalen over mannen'), false, 'de spatie blijft een verschil op de lijst');
  const cat = [{ boek_id: 'B1', soort: 'boek', titel: 'Verzonnen Ethics & Mira', auteur: 'Bedacht, Rob L.', taal: 'Engels', bron_sleutel: 'x' }];
  const oud = [{ id: '1', isbn: '', titel: 'Verzonnen Ethics and Mira: Listening to Scripture', ondertitel: '', auteur: 'Rob L. Bedacht' }];
  gelijk(M.titelcontroleRijen(cat, [], oud, [], []), [], 'enkel & tegenover and en een ondertitel: niet op de lijst');
  assert.strictEqual(cat[0].titel, 'Verzonnen Ethics & Mira: Listening to Scripture');
});


test('standaardafbeeldingen: dezelfde afbeelding bij drie boeken weg, ook een link naar LibraryThing', () => {
  const st = M.standaardBestanden([{ id: 'a', hash: 'h1' }, { id: 'b', hash: 'h1' }, { id: 'c', hash: 'h1' }, { id: 'd', hash: 'h2' }, { id: 'e', hash: 'h2' }]);
  gelijk(Object.keys(st.ids).sort(), ['a', 'b', 'c']);
  gelijk(st.hashes, ['h1']);
  assert.strictEqual(M.driveIdUitCover('https://lh3.googleusercontent.com/d/a'), 'a');
  assert.strictEqual(M.driveIdUitCover('https://voorbeeld.test/cover.jpg'), '');
  const cat = [
    { boek_id: 'B1', cover_url: 'https://lh3.googleusercontent.com/d/a', cover_bron: 'oude website', gb_gecontroleerd: 'ja' },
    { boek_id: 'B2', cover_url: 'https://lh3.googleusercontent.com/d/d', cover_bron: 'oude website' },
    { boek_id: 'B3', cover_url: 'https://pics.librarything.test/picsizes/x.jpg', cover_bron: 'link' },
    { boek_id: 'B4', cover_url: '', oude_cover: 'https://covers.librarything.test/x.jpg' }
  ];
  gelijk(M.wisStandaardCovers(cat, st.ids), ['B1', 'B3', 'B4']);
  gelijk(cat.map((b) => b.cover_url), ['', 'https://lh3.googleusercontent.com/d/d', '', '']);
  assert.strictEqual(cat[0].gb_gecontroleerd, '', 'Google Books zoekt opnieuw');
  assert.strictEqual(cat[3].oude_cover, '');
});


test('brede tabbladen: vaste kolommen, kleur, uitleg, niet publiek en ingeklapte technische kolommen', () => {
  const kop = ['boek_id', 'soort', 'titel', 'auteur', 'isbn', 'herkomst', 'bron_sleutel', 'beschrijving', 'eigen_kolom', 'notitie', 'cover_bron', 'oude_cover'];
  const ind = M.kolomIndeling('Catalogus', kop);
  assert.strictEqual(ind.vast, 4, 'tot en met auteur');
  assert.strictEqual(ind.kleuren[0], '#fff2cc');
  assert.strictEqual(ind.kleuren[8], '', 'een eigen kolom blijft zoals ze is');
  gelijk(ind.nietPubliek.map((p, i) => p ? kop[i] : '').filter(Boolean), ['herkomst', 'bron_sleutel', 'notitie', 'cover_bron', 'oude_cover']);
  assert.ok(/Niet publiek/.test(ind.uitleg[9]) && /Bestuur/.test(ind.uitleg[9]));
  assert.ok(/Achternaam, Voornaam/.test(ind.uitleg[3]));
  gelijk(ind.groepen, [[6, 2], [11, 2]], 'notitie (bestuur) wordt niet ingeklapt');
  assert.strictEqual(M.kolomIndeling('Catalogus', ['soort', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'titel']).vast, 0, 'titel ver naar rechts: niets vast');
  assert.strictEqual(M.kolomIndeling('Uitleningen', ['uitlening_id', 'exemplaar', 'boek_id', 'lenersnummer']).vast, 3);
  assert.strictEqual(M.kolomIndeling('Logboek', ['tijdstip']), null);
  // Elke kolom van de Catalogus en Uitleningen heeft een uitleg.
  ['Catalogus', 'Uitleningen'].forEach((t) => M.KOLOMMEN[t].forEach((k) => assert.ok(M.KOLOM_INDELING[t].kolommen[k], t + ': ' + k + ' heeft geen uitleg')));
});


test('agenda: voorbije events, nieuwste eerst, voor de knop Voorbije events', () => {
  const s = maakStaat('2026-10-25');
  s.inst.tekst_vaste_events = 'geen';
  s.inst.bookclub_tonen = false;
  const agenda = [
    { datum: '2026-09-01', titel: 'Verzonnen event A', publiek: 'ja' },
    { datum: '2026-10-01', titel: 'Verzonnen event B', publiek: 'ja' },
    { datum: '2026-10-02', titel: 'Verborgen event', publiek: 'nee' },
    { datum: '2026-11-20', titel: 'Verzonnen event C', publiek: 'ja' }
  ];
  const d = M.bouwSiteInhoud(s, { agenda: agenda });
  const voorbij = d.agenda.voorbij.map((e) => e.titel.nl).filter((t) => /Verzonnen|Verborgen/.test(t));
  gelijk(voorbij, ['Verzonnen event B', 'Verzonnen event A']);
  assert.ok(d.agenda.komend.some((e) => e.titel.nl === 'Verzonnen event C'));
});


test('onderwerpen raden: genre eerst, dan enkel een duidelijk thema uit de tekst, de rest op de nakijklijst', () => {
  const onderwerpen = [{ genre: 'Lesbische roman', filtergroepen: '' }, { genre: 'Roman', filtergroepen: 'Fictie' }, { genre: 'Varia', filtergroepen: '' }];
  const cat = [
    { boek_id: 'B1', soort: 'boek', titel: 'Een verzonnen zomer', genre: 'Lesbische roman', beschrijving: '' },
    { boek_id: 'B2', soort: 'boek', titel: 'Stille dagen', genre: '', beschrijving: 'Deze roman volgt een personage door de jaren. Een roman over liefde, en een tweede roman van de schrijver. Een lesbische en queer roman.' },
    { boek_id: 'B3', soort: 'boek', titel: 'Brieven', genre: 'Varia', beschrijving: 'Een essay over de geschiedenis van de beweging. Politiek en geschiedenis.' },
    { boek_id: 'B4', soort: 'boek', titel: 'Zonder iets', genre: '', beschrijving: 'Een mooi boek over liefde en vriendschap tussen twee vrouwen.' },
    { boek_id: 'B5', soort: 'boek', titel: 'Al goed', genre: 'Roman', beschrijving: '' },
    { boek_id: 'B6', soort: 'zine', titel: 'Een zine', genre: '', beschrijving: '' },
    { boek_id: 'F1', soort: 'film', titel: 'Een film', genre: '', beschrijving: '' }
  ];
  const uit = M.vulOntbrekendeOnderwerpen(cat, onderwerpen);
  gelijk(uit.genres, ['Lesbische roman']);
  assert.ok(/Fictie/.test(onderwerpen[0].filtergroepen) && /Seksualiteit/.test(onderwerpen[0].filtergroepen));
  gelijk(uit.boeken, ['B2'], 'enkel B2 is zeker (roman, geen telling voor lesbisch of queer)');
  assert.strictEqual(cat[1].extra_onderwerpen, 'Fictie');
  gelijk(uit.nakijken.map((r) => [r.boek_id, r.onderwerp_nieuw, r.toepassen]), [['B3', 'Geschiedenis', 'nee'], ['B4', '', 'nee']]);
  assert.ok(/Geschiedenis \(2\)/.test(uit.nakijken[0].voorstel) && /Maatschappij/.test(uit.nakijken[0].voorstel));
  assert.strictEqual(uit.nakijken[1].voorstel, 'geen aanwijzing');
  // Toepassen
  const rij = uit.nakijken[0];
  rij.toepassen = 'ja'; rij.onderwerp_nieuw = 'Maatschappij, Geschiedenis';
  assert.strictEqual(M.onderwerpNakijklijstToepassen(cat, uit.nakijken, onderwerpen), 1);
  assert.strictEqual(cat[2].extra_onderwerpen, 'Maatschappij, Geschiedenis');
  assert.strictEqual(rij.toepassen, 'gedaan');
  // Woorden
  assert.strictEqual(M.zekerOnderwerp(M.onderwerpScores({ titel: 'Godin', beschrijving: 'over de godin en het eeuwige' })), '', '=god en =eeuw tellen niet voor godin en eeuwig');
  gelijk(M.onderwerpScores({ titel: '', beschrijving: 'Over coming out en seksualiteit.' }), [['Seksualiteit', 2], ['Coming-out', 1]]);
});


test('onderwerpen raden: de keuzelijst bevat thema\'s en genres, een genre wordt het genre van het boek', () => {
  const onderwerpen = [{ genre: 'Politiek', filtergroepen: 'Maatschappij' }, { genre: 'Roman', filtergroepen: 'Fictie' }, { genre: 'Lokaal', filtergroepen: 'Antwerpen' }];
  const cat = [
    { boek_id: 'B1', soort: 'boek', titel: 'Een', genre: '', extra_onderwerpen: '' },
    { boek_id: 'B2', soort: 'boek', titel: 'Twee', genre: 'Varia', extra_onderwerpen: 'Eigen thema' },
    { boek_id: 'B3', soort: 'boek', titel: 'Drie', genre: '', extra_onderwerpen: '' }
  ];
  const k = M.onderwerpKeuzes(onderwerpen, cat);
  assert.ok(k.lijst.includes('Politiek') && k.lijst.includes('Gender'));
  assert.ok(!k.lijst.includes('Antwerpen') && !k.lijst.includes('Eigen thema'), 'enkel de vaste thema\'s en de genres');
  assert.ok(!k.lijst.includes('Zines') && !k.lijst.includes('Klassiekers'));
  gelijk(k.lijst, k.lijst.slice().sort((a, b) => a.localeCompare(b, 'nl')), 'één lijst, alfabetisch');
  const rijen = [
    { boek_id: 'B1', onderwerp_nieuw: 'Roman', toepassen: 'ja' },
    { boek_id: 'B2', onderwerp_nieuw: 'Roman, Gender', toepassen: 'ja' },
    { boek_id: 'B3', onderwerp_nieuw: 'Iets nieuws', toepassen: 'ja' }
  ];
  assert.strictEqual(M.onderwerpNakijklijstToepassen(cat, rijen, onderwerpen), 3);
  gelijk([cat[0].genre, cat[0].extra_onderwerpen], ['Roman', ''], 'zonder genre: het genre wordt Roman');
  gelijk([cat[1].genre, cat[1].extra_onderwerpen], ['Varia', 'Eigen thema, Fictie, Gender'], 'met genre: de thema\'s van Roman erbij');
  assert.strictEqual(cat[2].extra_onderwerpen, 'Iets nieuws');
});


test('genres opkuisen: varianten worden één genre, thema\'s in de juiste schrijfwijze', () => {
  assert.strictEqual(M.genreSleutel('Romans'), M.genreSleutel('roman'));
  assert.strictEqual(M.genreSleutel('Verhalen'), M.genreSleutel('verhaal'));
  assert.strictEqual(M.genreSleutel('Gedichten'), M.genreSleutel('gedicht'));
  assert.strictEqual(M.genreSleutel('Sexualiteit'), M.genreSleutel('seksualiteit'));
  assert.strictEqual(M.genreSleutel('poëzie'), M.genreSleutel('Poezie'));
  assert.strictEqual(M.genreSleutel('Biografieën'), M.genreSleutel('biografie'));
  assert.notStrictEqual(M.genreSleutel('Gender'), M.genreSleutel('Genre'));
  assert.strictEqual(M.genreMooi('poezie'), 'Poëzie');
  assert.strictEqual(M.genreMooi('THRILLERS EN SPANNING'), 'Thrillers en spanning');
  assert.strictEqual(M.genreMooi('bdsm'), 'BDSM');
  const onderwerpen = [
    { genre: 'Roman', filtergroepen: 'Fictie' }, { genre: 'romans', filtergroepen: 'fictie, Liefde' }, { genre: 'Gedichten', filtergroepen: 'Poëzie' },
    { genre: 'gedicht', filtergroepen: '' }, { genre: 'Politiek', filtergroepen: 'maatschappij' }, { genre: 'Politiekk', filtergroepen: '' }
  ];
  const cat = [
    { boek_id: 'B1', soort: 'boek', genre: 'Roman', extra_onderwerpen: '' }, { boek_id: 'B2', soort: 'boek', genre: 'Roman', extra_onderwerpen: 'GENDER' },
    { boek_id: 'B3', soort: 'boek', genre: 'romans', extra_onderwerpen: 'liefde, Liefde' }, { boek_id: 'B4', soort: 'boek', genre: 'Gedichten', extra_onderwerpen: '' },
    { boek_id: 'B5', soort: 'boek', genre: 'gedicht', extra_onderwerpen: '' }, { boek_id: 'B6', soort: 'boek', genre: 'Gedichten', extra_onderwerpen: '' },
    { boek_id: 'B7', soort: 'boek', genre: 'Politiek', extra_onderwerpen: '' }, { boek_id: 'B8', soort: 'boek', genre: 'Politiekk', extra_onderwerpen: '' }
  ];
  const v = M.genreVoorstellen(onderwerpen, cat);
  gelijk(v.map((r) => [r.genre_nu, r.genre_nieuw]), [['gedicht', 'Gedichten'], ['Politiekk', 'Politiek'], ['romans', 'Roman']]);
  const uit = M.genresOpkuisen(onderwerpen, cat, v);
  gelijk(cat.map((b) => b.genre), ['Roman', 'Roman', 'Roman', 'Gedichten', 'Gedichten', 'Gedichten', 'Politiek', 'Politiek']);
  gelijk(onderwerpen.filter((r) => !r._verwijderen).map((r) => [r.genre, r.filtergroepen]), [['Roman', 'Fictie, Liefde'], ['Gedichten', 'Poëzie'], ['Politiek', 'Maatschappij']]);
  gelijk([cat[1].extra_onderwerpen, cat[2].extra_onderwerpen], ['Gender', 'Liefde']);
  gelijk([uit.genres, uit.boeken], [3, 3]);
});


test('genres opkuisen: vaste namen (Intersekse, Religie en Spiritualiteit, Young Adult, Kunst en Fotoboek)', () => {
  gelijk(['Intersex', 'religie', 'young adult', 'Fotoboeken', 'Religie en spiritualiteit'].map(M.genreMooi), ['Intersekse', 'Religie en Spiritualiteit', 'Young Adult', 'Kunst en Fotoboek', 'Religie en Spiritualiteit']);
  const onderwerpen = [{ genre: 'Religie', filtergroepen: 'Religie en spiritualiteit' }, { genre: 'Intersex', filtergroepen: 'gender' }];
  const cat = [{ boek_id: 'B1', soort: 'boek', genre: 'Religie', extra_onderwerpen: 'young adult' }, { boek_id: 'B2', soort: 'boek', genre: 'Intersex', extra_onderwerpen: '' }];
  M.genresOpkuisen(onderwerpen, cat, M.genreVoorstellen(onderwerpen, cat));
  gelijk(cat.map((b) => [b.genre, b.extra_onderwerpen]), [['Religie en Spiritualiteit', 'Young Adult'], ['Intersekse', '']]);
  gelijk(onderwerpen.map((r) => [r.genre, r.filtergroepen]), [['Religie en Spiritualiteit', 'Religie en Spiritualiteit'], ['Intersekse', 'Gender']]);
});


test('films: filter op trefwoord, en enkel trefwoorden die bij een film horen', () => {
  const films = [{ id: 'F1', g: ['Drama'], k: ['Lesbisch'] }, { id: 'F2', g: ['Komedie'] }];
  const o = F.optiesSamen(films, {}, null, F.FILMFILTERS);
  gelijk(o.trefwoord.map((x) => x.waarde + x.aantal), ['Lesbisch1']);
  gelijk(F.pasToe(films, { trefwoord: 'Lesbisch' }, F.FILMFILTERS).map((b) => b.id), ['F1']);
});

test('sorteren op dikte en duur, zonder waarde achteraan', () => {
  const lijst = [{ id: 'a', t: 'A', p: 300, du: 90 }, { id: 'b', t: 'B', p: 80, du: 120 }, { id: 'c', t: 'C' }, { id: 'd', t: 'D', p: 500, du: 45 }];
  gelijk(F.sorteer(lijst, 'dikte-dun').map((b) => b.id), ['b', 'a', 'd', 'c']);
  gelijk(F.sorteer(lijst, 'dikte-dik').map((b) => b.id), ['d', 'a', 'b', 'c']);
  gelijk(F.sorteer(lijst, 'duur-kort').map((b) => b.id), ['d', 'a', 'b', 'c']);
  gelijk(F.sorteer(lijst, 'duur-lang').map((b) => b.id), ['b', 'a', 'd', 'c']);
});

test('filters samen: elke keuzelijst toont enkel wat met de andere filters nog boeken geeft', () => {
  const boeken = [
    { id: 'a', g: ['Biografie'], ca: ['Sport'], k: ['Lesbisch'] },
    { id: 'b', g: ['Biografie'], ca: ['Roman'], k: ['Lesbisch'] },
    { id: 'c', g: ['Fictie'], ca: ['Sport'], k: ['Trans'] }
  ];
  const keuzes = { groep: 'Biografie', categorie: 'Sport', trefwoord: 'Lesbisch' };
  gelijk(F.pasToe(boeken, keuzes).map((b) => b.id), ['a']);
  const o = F.optiesSamen(boeken, { groep: 'Biografie' });
  gelijk(o.categorie.map((x) => x.waarde + x.aantal), ['Roman1', 'Sport1']);
  gelijk(o.trefwoord.map((x) => x.waarde + x.aantal), ['Lesbisch2']);
  gelijk(o.groep.map((x) => x.waarde + x.aantal), ['Biografie2', 'Fictie1'], 'de eigen filter telt zonder zichzelf');
  // Een gekozen waarde die niets meer geeft, blijft zichtbaar (met 0).
  gelijk(F.optiesSamen(boeken, { groep: 'Fictie', trefwoord: 'Lesbisch' }).trefwoord.map((x) => x.waarde + x.aantal), ['Lesbisch0', 'Trans1']);
});

test('dikte: vier groepen op het aantal pagina\'s, in vaste volgorde', () => {
  gelijk([0, 40, 80, 90, 150, 151, 300, 450, 501, ''].map(F.dikteVan), ['', 'Heel dun (tot 80 bladzijden)', 'Heel dun (tot 80 bladzijden)', 'Dun (80 tot 150 bladzijden)', 'Dun (80 tot 150 bladzijden)', 'Gemiddeld (150 tot 300 bladzijden)', 'Gemiddeld (150 tot 300 bladzijden)', 'Dik (300 tot 500 bladzijden)', 'Heel dik (meer dan 500 bladzijden)', '']);
  gelijk([0, 45, 60, 61, 90, 110, 121, ''].map(F.duurVan), ['', 'Kort (tot 60 minuten)', 'Kort (tot 60 minuten)', 'Gemiddeld (60 tot 90 minuten)', 'Gemiddeld (60 tot 90 minuten)', 'Lang (90 tot 120 minuten)', 'Heel lang (meer dan 120 minuten)', '']);
  gelijk(F.FILMFILTERS.map((f) => f.sleutel).indexOf('duur') > -1, true);
  const o = F.opties([{ p: 600 }, { p: 100 }, { p: 200 }, { p: 120 }, {}]);
  gelijk(o.dikte.map((x) => [x.waarde, x.aantal]), [['Dun (80 tot 150 bladzijden)', 2], ['Gemiddeld (150 tot 300 bladzijden)', 1], ['Heel dik (meer dan 500 bladzijden)', 1]]);
  gelijk(F.pasToe([{ id: 'a', p: 100 }, { id: 'b', p: 400 }], { dikte: 'Dun (80 tot 150 bladzijden)' }).map((b) => b.id), ['a']);
});

test('eigen thema\'s: Kunst en Fotoboek blijft een thema, ook als genre', () => {
  M.verwerkInstellingen({ eigen_themas: 'Kunst en Fotoboek' });
  const v = M.vertaalTabel([]);
  gelijk(M.filtergroepenVan({ genre: 'Kunst en fotoboek', extra_onderwerpen: '', soort: 'boek' }, v), ['Kunst en Fotoboek']);
  gelijk(M.filtergroepenVan({ genre: '', extra_onderwerpen: 'kunst en fotoboek, gender', soort: 'boek' }, v), ['Kunst en Fotoboek', 'Gender']);
  assert.ok(M.onderwerpKeuzes([], []).lijst.includes('Kunst en Fotoboek'));
});

test('schrijfCellen: één boek cel per cel, meer dan vijf rijen kolom per kolom', () => {
  const geschreven = [];
  let kolomBeurten = 0;
  const blad = {
    getLastRow: () => 8,
    getRange: (r, k, n) => ({
      setValue: (w) => geschreven.push([r, k, w]),
      getValues: () => { kolomBeurten++; return Array.from({ length: n || 1 }, () => ['']); },
      setValues: () => { kolomBeurten++; }
    })
  };
  const rijen = Array.from({ length: 7 }, (_, i) => ({ _rij: i + 2, boek_id: 'B' + i, status: '', wie: '' }));
  const tabel = { blad, kop: ['boek_id', 'status', 'wie'], rijen };
  M.wijzig(rijen[3], { status: 'klopt', wie: 'Sam' });
  M.schrijfCellen(tabel, ['status', 'wie']);
  gelijk(geschreven, [[5, 2, 'klopt'], [5, 3, 'Sam']]);
  assert.strictEqual(kolomBeurten, 0);
  assert.strictEqual(rijen[3]._gewijzigd, false);
  rijen.forEach((r) => M.wijzig(r, { status: 'klopt' }));
  M.schrijfCellen(tabel, ['status']);
  assert.ok(kolomBeurten > 0, 'bij veel rijen kolom per kolom');
});

test('controleerIaCovers: enkel covers van Internet Archive, op boek-ID, na het laatst nagekeken boek', () => {
  const rijen = [
    { boek_id: 'B0003', cover_bron: 'Internet Archive', cover_url: 'https://archive.org/c3.jpg' },
    { boek_id: 'B0001', cover_bron: 'Internet Archive', cover_url: 'https://archive.org/c1.jpg' },
    { boek_id: 'B0002', cover_bron: 'Google Books', cover_url: 'https://books.google.com/c2.jpg' },
    { boek_id: 'B0004', cover_bron: 'Internet Archive', cover_url: '' }
  ];
  gelijk(M.iaCoversTeControleren(rijen, '').map((b) => b.boek_id), ['B0001', 'B0003']);
  gelijk(M.iaCoversTeControleren(rijen, 'B0001').map((b) => b.boek_id), ['B0003']);
  assert.strictEqual(M.iaControleLink({ cover_url: 'https://lh3.googleusercontent.com/d/x', cover_origineel: 'https://archive.org/c1.jpg' }), 'https://archive.org/c1.jpg');
  assert.strictEqual(M.iaControleLink({ cover_url: 'https://archive.org/c1.jpg', cover_origineel: '' }), 'https://archive.org/c1.jpg');
});

console.log('\n' + geslaagd + ' geslaagd, ' + mislukt.length + ' mislukt');
if (mislukt.length) process.exit(1);
