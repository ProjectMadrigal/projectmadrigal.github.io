/**
 * tests/browser.js
 * Opent de site in een echte browser (Chromium, via Playwright) en kijkt na of alles werkt:
 *   - de publieke pagina's laden zonder fouten, in licht en donker, en zonder toegankelijkheidsfouten (axe);
 *   - de catalogus, een boekpagina met "Lees ook" (covers in de verhouding 2:3) en de leeslijsten;
 *   - het bestuursscherm, het vrijwilligersscherm en het uitleenscherm, met een nagebootste web-app.
 * Enkel verzonnen gegevens: de voorbeeldboeken uit voorbeeld/ en verzonnen antwoorden hieronder.
 *
 * Draaien: node tests/browser.js
 * Nodig: Playwright met Chromium (npx playwright install chromium) en axe-core (npm install axe-core).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
// ZXing (lokaal geïnstalleerd met npm) vervangt in de test het CDN.
const ZXING = require.resolve('@zxing/library/umd/index.min.js');
const { chromium } = require('playwright');

const MAP = path.join(__dirname, '..');
const AXE = require.resolve('axe-core');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };

let geslaagd = 0, mislukt = 0;
async function test(naam, fn) {
  try { await fn(); geslaagd++; console.log('  ok   ' + naam); }
  catch (e) { mislukt++; console.log('  FOUT ' + naam + '\n       ' + String(e.message || e).split('\n').join('\n       ')); }
}
function verwacht(voorwaarde, tekst) { if (!voorwaarde) throw new Error(tekst); }

/** Een eenvoudige webserver voor de map van de site. */
function startServer() {
  const server = http.createServer((req, res) => {
    const pad = decodeURIComponent(req.url.split('?')[0]);
    const bestand = path.join(MAP, pad === '/' ? 'index.html' : pad);
    if (!bestand.startsWith(MAP) || !fs.existsSync(bestand) || fs.statSync(bestand).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(bestand)] || 'application/octet-stream' });
    fs.createReadStream(bestand).pipe(res);
  });
  return new Promise((klaar) => server.listen(0, '127.0.0.1', () => klaar(server)));
}

/* ---------- Nagebootste web-app (verzonnen gegevens) ---------- */

const STATUS = (code, label) => ({ code, label, tekst: label });
const UITLENING = { uitlening_id: 'U0001', exemplaar: 'B0001-1', boek_id: 'B0001', titel: 'De verzonnen zee', lenersnummer: '12', voornaam: 'Sam', datum_uit: '2026-09-20', vervaldatum: '2026-10-18', status: STATUS('telaat', 'Te laat') };
const BOEKEN = [{ id: 'B0001', t: 'De verzonnen zee', a: 'Verbeek, Mira', c: false, zb: true, g: ['Fictie'] }, { id: 'B0002', t: 'Twee kasten vol', a: 'Dewit, Rein', c: true, g: ['Geschiedenis en maatschappij'] }];
// Veel boeken zonder beschrijving (verzonnen), om Toon er nog 100 te testen.
const VEEL = Array.from({ length: 150 }, (_, i) => ({ id: 'X' + String(i).padStart(3, '0'), t: 'Verzonnen titel ' + String(i).padStart(3, '0'), a: '', c: true, zb: true }));
const UITLENING2 = Object.assign({}, UITLENING, { uitlening_id: 'U0002', exemplaar: 'B0002-1', boek_id: 'B0002', titel: 'Twee kasten vol', lenersnummer: '13', voornaam: 'Jo' });
const INHOUD = {
  tabbladen: {
    Nieuws: [{ rij: 2, vingerafdruk: 'a', datum: '2026-10-20', titel: 'Voorstel boekenruil', publiek: 'nee', voorgesteld_door: 'Kim' }],
    Agenda: [], 'Veelgestelde vragen': [],
    Leeslijsten: [{ rij: 2, vingerafdruk: 'x', naam: 'Pride-maand', publiek: 'ja', zichtbaar_vanaf: '2027-06-01', zichtbaar_tot: '2027-06-30' }]
  },
  instellingen: [{ titel: 'Website: leeslijsten', instellingen: [{ sleutel: 'leeslijsten_tonen', waarde: 'nee', uitleg: '' }] }]
};

function antwoord(rol, actie, vraag) {
  const basis = { vandaagTekst: 'zondag 25 oktober', telaat: [UITLENING], binnenkort: [], lopend: [UITLENING], reservaties: [], boeken: BOEKEN };
  return {
    aanmelden: { ok: true, rol },
    vrijwilligerData: { ok: true, data: basis },
    bestuurData: { ok: true, data: Object.assign({}, basis, {
      boeken: BOEKEN.concat(VEEL),
      telaat: [Object.assign({}, UITLENING, { telefoon: '0400000000', herinnering: 'Hoi Sam' }), Object.assign({}, UITLENING2, { email: 'jo@voorbeeld.test', herinnering: 'Hoi Jo' })],
      lopend: [UITLENING, UITLENING2], aanvragen: [], uitzonderingen: [],
      leners: [{ lenersnummer: '12', voornaam: 'Sam', achternaam: 'Verzonnen', telefoon: '0400000000', email: '', actief: true, toestemming_privacy: 'ja', lopend: 1, datum_inschrijving: '2026-01-01' }],
      boekstatus: { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] }, borgen: { ingehouden: { totaal: 0, perBetaalwijze: {} }, terugTeBetalen: [] },
      perMaand: [{ maand: 'oktober 2026', uitleningen: 1, giften: 0 }], meestGeleend: [], groepen: [], voorstellen: 1,
      privacy: 'Verzonnen privacyverklaring.',
      extraCijfers: { nieuweLeners: [{ maand: 'oktober 2026', aantal: 2 }], nooitUitgeleend: 1, nooitVoorbeelden: [{ boek_id: 'B0003', titel: 'Stille lichten', auteur: 'Aerts, Noor' }], gemiddeldeDagen: 17, afgesloten: 2, actieveLeners: 2 }
    }) },
    balieData: { ok: true, data: Object.assign({}, basis, { vandaag: '2026-10-25', instellingen: { borg_per_boek: 5, borg_betaalwijzen: ['cash'] }, leners: [{ n: '12', v: 'Sam' }] }) },
    nieuweLener: { ok: true, lenersnummer: '14', voornaam: 'Alex', tekst: 'Alex is ingeschreven met lenersnummer 14.' },
    terugbrengen: { ok: true, tekst: '"De verzonnen zee" is terug.' },
    verlengen: { ok: true, tekst: '"De verzonnen zee" is verlengd.' },
    beheerBoekenBulk: { ok: true, gelukt: 1, fouten: [], tekst: '1 boek aangepast.' },
    beheerBoekToevoegen: { ok: true, tekst: 'Toegevoegd als B0005.', boek: { boek_id: 'B0005' } },
    beheerInhoud: { ok: true, data: INHOUD },
    beheerBoekBewaren: { ok: true, tekst: 'Bewaard.' },
    herinneringVerstuurd: { ok: true },
    beheerLenerHistoriek: { ok: true, totaal: 1, uitleningen: [{ titel: 'Stille lichten', exemplaar: 'B0003-1', datum_uit: '2026-02-01', datum_terug: '2026-03-01' }] },
    beheerCoverLinks: { ok: true, links: { B0002: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' } },
    beheerLogboek: { ok: true, daglimiet: 0,
      taken: [{ functie: 'zoekBeschrijvingenWikipedia', naam: 'Beschrijvingen bij Wikipedia', teGaan: 12, status: 'gepland', sinds: 0 }],
      logboek: [{ tijd: Date.UTC(2026, 9, 25, 10, 0), wie: 'menu', actie: 'zoekBeschrijvingenWikipedia', details: '20 opgezocht' }, { tijd: Date.UTC(2026, 9, 25, 9, 0), wie: 'Kim', actie: 'uitlenen', details: 'B0001-1' }] },
    beheerBoekOphalen: { ok: true, historiek: { keer: 3, laatst: '2026-09-20' }, wijzigingen: [{ tijd: Date.UTC(2026, 9, 24, 9), wie: 'Kim', actie: 'boek aangepast', details: 'B0001: beschrijving' }], boek: { boek_id: (vraag || {}).boek_id, titel: (BOEKEN.concat(VEEL).find((b) => b.id === (vraag || {}).boek_id) || {}).t, auteur: '', cover_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', beschrijving: '' } },
    bezoekersCijfers: { ok: true, nietIngesteld: true },
    roosterOverzicht: { ok: true, data: { avonden: [] } }
  }[actie] || { ok: false, fout: 'Niet nagebootst: ' + actie };
}

async function nieuweContext(browser, opties) {
  const ctx = await browser.newContext(Object.assign({ locale: 'nl-BE', serviceWorkers: 'block' }, opties.context || {}));
  const apiUrl = opties.rol ? 'https://web-app.test/exec' : '';
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MADRIGAL_CONFIG={apiUrl:' + JSON.stringify(apiUrl) + ",naam:'Project Madrigal',statistiek:''};" }));
  if (opties.rol) {
    await ctx.route('https://web-app.test/**', (r) => {
      const b = JSON.parse(r.request().postData() || '{}');
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(antwoord(opties.rol, b.actie, b)) });
    });
  }
  if (opties.covers) {
    // Een vierkante afbeelding als cover voor de helft van de boeken: de site moet ze in 2:3 tonen.
    await ctx.route('**/voorbeeld/catalogus.json', (r) => {
      const d = JSON.parse(fs.readFileSync(path.join(MAP, 'voorbeeld/catalogus.json')));
      d.boeken.forEach((b, i) => { if (i % 2) b.c = opties.basis + '/icons/icoon-192.png'; });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) });
    });
  }
  const page = await ctx.newPage();
  const fouten = [];
  page.on('pageerror', (e) => fouten.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fouten.push(m.text()); });
  return { ctx, page, fouten };
}

async function axe(page) {
  await page.addScriptTag({ path: AXE });
  const r = await page.evaluate(() => window.axe.run({ runOnly: ['wcag2a', 'wcag2aa'] }));
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id + ' (' + v.nodes.length + 'x): ' + v.nodes[0].target.join(' '));
}

async function meldAan(page, basis, pagina) {
  await page.goto(basis + '/' + pagina);
  await page.fill('#code', 'verzonnen-code');
  await page.fill('#wie', 'Kim');
  await page.click('#aanmeldformulier button[type="submit"]');
  await page.waitForSelector('#app:not([hidden])');
}

(async () => {
  const server = await startServer();
  const basis = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  console.log('\nPublieke pagina\'s');
  for (const thema of ['light', 'dark']) {
    for (const pagina of ['index.html', 'boeken.html', 'boeken.html#/boek/B0008', 'boeken.html#/leeslijsten', 'over-ons.html', 'doe-mee.html', 'peperfabriek.html']) {
      await test(pagina + ' (' + (thema === 'light' ? 'licht' : 'donker') + '): laadt zonder fouten, geen ernstige toegankelijkheidsfouten', async () => {
        const { ctx, page, fouten } = await nieuweContext(browser, { context: { colorScheme: thema } });
        await page.goto(basis + '/' + pagina);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        const problemen = await axe(page);
        await ctx.close();
        verwacht(!fouten.length, 'Fouten in de pagina: ' + fouten.join(' | '));
        verwacht(!problemen.length, 'Toegankelijkheid: ' + problemen.join(' | '));
      });
    }
  }

  console.log('\nCatalogus');
  await test('lijst, zoeken en boekpagina met Lees ook', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, {});
    await page.goto(basis + '/boeken.html');
    await page.waitForSelector('#resultaten li');
    await page.fill('#zoek', 'verzonnen zee');
    await page.waitForTimeout(400);
    verwacht((await page.$$('#resultaten li')).length >= 1, 'Zoeken vond niets');
    await page.goto(basis + '/boeken.html#/boek/B0008');
    await page.waitForSelector('.lees-ook li');
    verwacht((await page.$$('.lees-ook li')).length === 6, 'Lees ook toont geen 6 boeken');
    verwacht(!!(await page.$('.detail h1')), 'Geen titel op de boekpagina');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('covers in Lees ook en in de lijst: verhouding 2:3', async () => {
    const { ctx, page } = await nieuweContext(browser, { covers: true, basis });
    await page.goto(basis + '/boeken.html#/boek/B0014');
    await page.waitForSelector('.lees-ook img');
    await page.waitForTimeout(300);
    const maten = await page.$$eval('.lees-ook img.cover, #resultaten img.cover', (x) => x.map((e) => e.getBoundingClientRect()).map((r) => r.height / r.width));
    await ctx.close();
    verwacht(maten.length && maten.every((m) => Math.abs(m - 1.5) < 0.05), 'Verhouding klopt niet: ' + maten.map((m) => m.toFixed(2)).join(', '));
  });
  await test('leeslijst: kop met uitleg en filter', async () => {
    const { ctx, page } = await nieuweContext(browser, {});
    await page.goto(basis + '/boeken.html#/leeslijsten');
    await page.click('#leeslijsten-scherm .leeslijst h2 a');
    await page.waitForSelector('#leeslijst-kop:not([hidden])');
    verwacht(!!(await page.$eval('#filter-lijst', (s) => s.value)), 'Filter Leeslijst niet gezet');
    await ctx.close();
  });
  await test('elk boek heeft Lees ook', async () => {
    const { ctx, page } = await nieuweContext(browser, {});
    const ids = JSON.parse(fs.readFileSync(path.join(MAP, 'voorbeeld/catalogus.json'))).boeken.map((b) => b.id);
    await page.goto(basis + '/boeken.html');
    await page.waitForSelector('#resultaten li');
    const zonder = [];
    for (const id of ids) {
      await page.evaluate((i) => { location.hash = '#/boek/' + i; }, id);
      await page.waitForSelector('.detail h1');
      if (!(await page.$('.lees-ook li'))) zonder.push(id);
    }
    await ctx.close();
    verwacht(!zonder.length, 'Zonder Lees ook: ' + zonder.join(', '));
  });

  console.log('\nAfgeschermde schermen (nagebootste web-app)');
  await test('bestuursscherm: alle onderdelen openen zonder fouten', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'bestuur.html');
    const knoppen = await page.$$eval('#sectienav button', (x) => x.map((e) => e.textContent));
    verwacht(knoppen.some((k) => /te keuren/.test(k)), 'Geen teller voor voorstellen');
    for (const k of knoppen) {
      await page.click('#sectienav button:has-text("' + k.replace(/ \(.*\)$/, '') + '")');
      await page.waitForTimeout(150);
    }
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: lijst van boeken zonder beschrijving', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'bestuur.html');
    await page.click('#sectienav button:has-text("Boeken")');
    await page.click('button:has-text("Boeken zonder beschrijving (151)")');
    let titels = await page.$$eval('.kaartlijst strong', (x) => x.map((e) => e.textContent));
    verwacht(titels.length === 100 && titels[0] === 'Verzonnen titel 000', 'Eerste 100: ' + titels.length + ', ' + titels[0]);
    await page.click('button:has-text("Toon er nog 51")');
    titels = await page.$$eval('.kaartlijst strong', (x) => x.map((e) => e.textContent));
    verwacht(titels.length === 151 && titels.indexOf('De verzonnen zee') > -1, 'Na Toon er nog: ' + titels.length);
    await page.fill('#zonder-beschrijving-zoek', 'zee');
    titels = await page.$$eval('.kaartlijst strong', (x) => x.map((e) => e.textContent));
    verwacht(JSON.stringify(titels) === JSON.stringify(['De verzonnen zee']), 'Gefilterd: ' + titels.join(', '));
    await page.fill('#zonder-beschrijving-zoek', '');
    await page.click('.kaartlijst button');
    await page.waitForSelector('img[alt="Huidige cover"]', { state: 'attached' }); await page.waitForTimeout(300);
    const zichtbaar = await page.$eval('img[alt="Huidige cover"]', (e) => !e.hidden);
    verwacht(zichtbaar, 'De huidige cover staat niet in het formulier');
    const voorbeeldVerborgen = await page.$eval('img[alt="Voorbeeld van de foto"]', (e) => getComputedStyle(e).display === 'none');
    verwacht(voorbeeldVerborgen, 'Het lege voorbeeld van de foto is zichtbaar');
    // Bladeren: het eerste boek heeft enkel Volgend, het tweede ook Vorig.
    verwacht(!(await page.$('button:has-text("Vorig boek")')) && !!(await page.$('button:has-text("Bewaar en volgend boek")')), 'Knoppen bij het eerste boek');
    await page.click('button:has-text("Volgend boek ›"):not(:has-text("Bewaar"))');
    await page.waitForSelector('button:has-text("‹ Vorig boek")');
    // Bewaar en volgend boek: X001 krijgt een beschrijving, je komt bij X002 en X001 verdwijnt uit de lijst.
    await page.fill('#bb-beschrijving', 'Een verzonnen beschrijving.');
    await page.click('button:has-text("Bewaar en volgend boek")');
    await page.waitForFunction(() => /Verzonnen titel 002/.test([...document.querySelectorAll('h2')].map((h) => h.textContent).join(' | ')));
    await page.click('button:has-text("‹ Vorig boek")');
    await page.waitForFunction(() => /Verzonnen titel 001/.test([...document.querySelectorAll('h2')].map((h) => h.textContent).join(' | ')));
    // Terug naar de lijst: de zoekterm en de plaats blijven bewaard.
    await page.click('button:has-text("Terug naar de lijst zonder beschrijving")');
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-id'));
    verwacht(focus === null, 'X001 heeft nu een beschrijving en staat niet meer in de lijst, focus: ' + focus);
    verwacht(/\(150\)/.test(await page.evaluate(() => [...document.querySelectorAll('h2')].map((h) => h.textContent).join(' | '))), 'Aantal na bewaren: ' + await page.textContent('h2'));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: Vandaag, Logboek, adres, kleine covers en zoeken op het internet', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    // Google Books nagebootst: één verzonnen uitgave met beschrijving en cover.
    await ctx.route('https://www.googleapis.com/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [{ volumeInfo: {
      title: 'De verzonnen zee', description: 'Een verzonnen beschrijving uit Google.', publisher: 'Uitgeverij Fictief', publishedDate: '2001-05-01', pageCount: 210,
      industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] }) }));
    await ctx.route('https://openlibrary.org/**', (r) => r.fulfill({ contentType: 'application/json', body: '{"docs":[]}' }));
    await meldAan(page, basis, 'bestuur.html');
    // Vandaag
    const vandaag = await page.textContent('#sectie');
    verwacht(/2\s*uitleningen zijn te laat/.test(vandaag) && /te keuren|wacht op goedkeuring/.test(vandaag), 'Vandaag: ' + vandaag.slice(0, 200));
    // Logboek en taken
    await page.click('#sectie button:has-text("Logboek en achtergrondtaken bekijken")');
    await page.waitForSelector('#logboek-filter');
    verwacht(/Beschrijvingen bij Wikipedia/.test(await page.textContent('#sectie')), 'Taak ontbreekt');
    await page.selectOption('#logboek-filter', 'uitlenen');
    const regels = await page.$$eval('.logboek li', (x) => x.length);
    verwacht(regels === 1, 'Filter op actie: ' + regels);
    verwacht(/#logboek$/.test(page.url()), 'Adres: ' + page.url());
    // Herladen: je blijft bij hetzelfde onderdeel. Terug brengt je naar Vandaag.
    await page.reload();
    await page.waitForSelector('#logboek-filter');
    await page.goBack();
    await page.waitForFunction(() => /Vandaag/.test(document.querySelector('#sectie h2').textContent));
    // Kleine cover bij een boek met cover
    await page.click('#sectienav button:has-text("Boeken")');
    await page.fill('#beheer-boek-zoek', 'kasten');
    await page.waitForSelector('.mini-cover img');
    // Zoek dit boek op het internet: vult de lege beschrijving in
    await page.fill('#beheer-boek-zoek', 'zee');
    await page.click('.kaartlijst button');
    await page.waitForSelector('#bb-isbn');
    await page.fill('#bb-isbn', '9780306406157');
    await page.click('button:has-text("Zoek dit boek op het internet")');
    await page.waitForFunction(() => document.querySelector('#bb-beschrijving').value === 'Een verzonnen beschrijving uit Google.');
    // Gsm: een keuzelijst in plaats van de knoppen
    await page.setViewportSize({ width: 375, height: 800 });
    verwacht(await page.isVisible('#sectiekeuze') && !(await page.isVisible('#sectienav .navgroep')), 'Keuzelijst op de gsm');
    await page.selectOption('#sectiekeuze', 'telaat');
    await page.waitForFunction(() => /Te laat/.test(document.querySelector('#sectie h2').textContent));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: lener, boek, uitleningen zoeken, herinneringen na elkaar, ISBN lezen', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    // ZXing van het CDN vervangen door het lokale pakket (de test heeft geen internet nodig).
    await ctx.route('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', (r) => r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(ZXING) }));
    await meldAan(page, basis, 'bestuur.html');
    // Lener: nu in huis en vroeger
    await page.click('#sectienav button:has-text("Leners")');
    await page.click('.kaartlijst button');
    verwacht(/Nu in huis[\s\S]*De verzonnen zee/.test(await page.textContent('#sectie')), 'Lener: nu in huis');
    await page.click('button:has-text("Toon wat deze lener vroeger leende")');
    await page.waitForSelector('text=Stille lichten');
    // Alle uitleningen: zoeken
    await page.click('#sectienav button:has-text("Alle uitleningen")');
    await page.fill('#lopend-zoek', 'kasten');
    verwacht(/1 van 2 uitleningen/.test(await page.textContent('#sectie')), 'Zoeken in uitleningen');
    // Herinneringen een voor een
    await page.click('#sectienav button:has-text("Te laat")');
    await page.click('button:has-text("Verstuur de herinneringen een voor een")');
    verwacht(await page.isVisible('a:has-text("Open in WhatsApp")'), 'WhatsApp-knop');
    await page.click('button:has-text("Herinnering verstuurd")');
    await page.waitForFunction(() => /Herinnering 2 van 2/.test(document.querySelector('#sectie h2').textContent));
    verwacht(await page.isVisible('a:has-text("Open in je mail")'), 'Mail-knop bij de tweede');
    // Boek: overzicht met uitleningen en laatst aangepast
    await page.click('#sectienav button:has-text("Boeken")');
    await page.fill('#beheer-boek-zoek', 'zee');
    await page.click('.kaartlijst button');
    await page.waitForSelector('.boek-overzicht');
    await page.click('.boek-overzicht summary');
    const overzicht = await page.textContent('.boek-overzicht');
    verwacht(/nu uitgeleend/.test(overzicht) && /3 keer uitgeleend/.test(overzicht) && /Kim: boek aangepast \(beschrijving\)/.test(overzicht), 'Boekoverzicht: ' + overzicht);
    // ISBN lezen uit een getekende streepjescode (EAN-13)
    const gelezen = await page.evaluate(() => {
      const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
      const G = L.map((c) => c.split('').map((b) => (b === '1' ? '0' : '1')).reverse().join(''));
      const R = L.map((c) => c.split('').map((b) => (b === '1' ? '0' : '1')).join(''));
      const PAR = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
      const code = '9780306406157';
      let bits = '101';
      for (let i = 1; i <= 6; i++) bits += (PAR[+code[0]][i - 1] === 'L' ? L : G)[+code[i]];
      bits += '01010';
      for (let i = 7; i <= 12; i++) bits += R[+code[i]];
      bits += '101';
      const doek = document.createElement('canvas');
      const m = 4, rand = 40;
      doek.width = bits.length * m + 2 * rand; doek.height = 160;
      const c = doek.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, doek.width, doek.height);
      c.fillStyle = '#000';
      for (let i = 0; i < bits.length; i++) if (bits[i] === '1') c.fillRect(rand + i * m, 20, m, 120);
      return window.MadrigalBestuurBeheer.leesIsbn(doek);
    });
    verwacht(gelezen === '9780306406157', 'Gelezen: ' + gelezen);
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: na een uur zonder gebruik afgemeld, behalve op je eigen toestel', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'bestuur.html');
    await page.evaluate(() => localStorage.setItem('madrigal_laatst_actief', String(Date.now() - 2 * 60 * 60 * 1000)));
    await page.reload();
    await page.waitForSelector('#aanmelden:not([hidden])');
    verwacht(/een uur niet gebruikt/.test(await page.textContent('#aanmeld-melding')), 'Melding na afmelden');
    await meldAan(page, basis, 'bestuur.html');
    await page.check('#mijn-toestel-app');
    await page.evaluate(() => localStorage.setItem('madrigal_laatst_actief', String(Date.now() - 2 * 60 * 60 * 1000)));
    await page.reload();
    await page.waitForSelector('#app:not([hidden])');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: lener inschrijven, terugbrengen, verlengen, bulk, schenking, CSV, cijfers, weergave, uitleg', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'bestuur.html');
    // Uitleg per onderdeel
    verwacht(await page.isVisible('#hulp summary:has-text("Hoe werkt dit?")'), 'Uitleg bij Vandaag');
    // Donkere modus en grotere letters
    await page.click('#thema-knop');
    const thema1 = await page.getAttribute('html', 'data-theme');
    await page.click('#thema-knop');
    verwacht(thema1 !== await page.getAttribute('html', 'data-theme'), 'Thema wisselt');
    await page.click('#letter-knop');
    verwacht(await page.evaluate(() => document.documentElement.classList.contains('groot-lettertype')), 'Grotere letters');
    await page.click('#letter-knop');
    // Nieuwe lener
    await page.click('#sectienav button:has-text("Leners")');
    await page.click('button:has-text("+ Nieuwe lener")');
    await page.fill('#nl-voornaam', 'Alex');
    await page.fill('#nl-email', 'alex@voorbeeld.test');
    await page.check('#nl-toestemming');
    await page.click('button:has-text("Schrijf in")');
    await page.waitForSelector('a:has-text("Meteen een boek uitlenen")');
    verwacht(/balie\.html#uitlenen=14$/.test(await page.getAttribute('a:has-text("Meteen een boek uitlenen")', 'href')), 'Link naar uitlenen');
    // Terugbrengen en verlengen
    await page.click('button:has-text("Klaar")');
    await page.click('#sectienav button:has-text("Alle uitleningen")');
    await page.click('.kaart >> nth=0 >> button:has-text("Teruggebracht")');
    await page.click('button:has-text("Bevestig: boek is terug")');
    await page.waitForSelector('#melding :text("is terug")');
    await page.click('#sectienav button:has-text("Alle uitleningen")');
    await page.click('.kaart >> nth=0 >> button:has-text("Verleng")');
    await page.waitForSelector('#melding :text("verlengd")');
    // CSV van de catalogus
    await page.click('#sectienav button:has-text("Boeken")');
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download de catalogus (CSV)")')]);
    const inhoud = fs.readFileSync(await download.path(), 'utf8');
    verwacht(download.suggestedFilename() === 'catalogus.csv' && /boek_id;titel;auteur/.test(inhoud) && /De verzonnen zee/.test(inhoud), 'CSV: ' + inhoud.slice(0, 80));
    // Meerdere boeken tegelijk
    await page.click('button:has-text("Meerdere boeken tegelijk aanpassen")');
    await page.fill('#bulk-zoek', 'zee');
    await page.check('.vinklijst input[type="checkbox"] >> nth=0');
    await page.fill('#bulk-waarde', 'Poëzie');
    page.once('dialog', (d) => d.accept());
    await page.click('button:has-text("Pas aan")');
    await page.waitForSelector('#melding :text("1 boek aangepast")');
    // Schenking boek na boek
    await page.click('#sectienav button:has-text("Boeken")');
    await page.click('button:has-text("Schenking invoeren")');
    await page.fill('#reeks-herkomst', 'Schenking van een verzonnen naam');
    await page.click('button:has-text("Start")');
    verwacht(await page.inputValue('#bb-herkomst') === 'Schenking van een verzonnen naam', 'Herkomst ingevuld');
    await page.fill('#bb-titel', 'Een verzonnen schenking');
    await page.click('button:has-text("Voeg toe en volgend boek")');
    await page.waitForSelector(':text("1 boek toegevoegd")');
    verwacht(await page.inputValue('#bb-titel') === '', 'Leeg formulier voor het volgende boek');
    await page.click('button:has-text("Stop de reeks")');
    // Cijfers
    await page.click('#sectienav button:has-text("Cijfers")');
    verwacht(/Nooit uitgeleend[\s\S]*Stille lichten/.test(await page.textContent('#sectie')), 'Extra cijfers');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('uitleenscherm: vanuit het bestuursscherm meteen uitlenen aan een lener', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'balie.html');
    await page.goto('about:blank');
    await page.goto(basis + '/balie.html#uitlenen=12');
    await page.waitForSelector('text=Bevestig de uitlening');
    verwacht(/Sam/.test(await page.textContent('#werkvlak')), 'Lener Sam staat klaar');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('vrijwilligersscherm: enkel de eigen onderdelen, geen contactgegevens', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(page, basis, 'vrijwilliger.html');
    const knoppen = await page.$$eval('#sectienav button', (x) => x.map((e) => e.textContent.replace(/ \(.*\)$/, '')));
    verwacht(JSON.stringify(knoppen) === JSON.stringify(['Vandaag', 'Te laat', 'Vervalt binnenkort', 'Alle uitleningen', 'Reservaties', 'Boeken zonder cover', 'Nieuws en agenda', 'Leeslijsten', 'Rooster']), 'Onderdelen: ' + knoppen.join(', '));
    verwacht(!/Logboek/.test(await page.textContent('#sectie')), 'Vandaag toont het Logboek aan een vrijwilliger');
    await page.click('#sectienav button:has-text("Te laat")');
    verwacht(!/0400000000|Kopieer herinnering/.test(await page.textContent('#sectie')), 'Contactgegevens zichtbaar');
    await page.click('#sectienav button:has-text("Nieuws en agenda")');
    await page.click('button:has-text("+ Nieuw bericht")');
    verwacht(!(await page.$('#bi-publiek')), 'Een vrijwilliger kan zelf publiceren');
    await page.click('#sectienav button:has-text("Leeslijsten")');
    await page.waitForSelector('text=Pride-maand');
    verwacht(!(await page.$('text=Zet de leeslijsten op de website')), 'Knop om leeslijsten online te zetten zichtbaar');
    for (const k of knoppen) await page.click('#sectienav button:has-text("' + k + '")');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('uitleenscherm: aanmelden met de vrijwilligerscode, knop naar het vrijwilligersscherm', async () => {
    const { ctx, page } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(page, basis, 'balie.html');
    await page.waitForSelector('#naar-scherm');
    verwacht((await page.getAttribute('#naar-scherm', 'href')) === 'vrijwilliger.html', 'Verkeerde link');
    await ctx.close();
  });

  await browser.close();
  server.close();
  console.log('\n' + geslaagd + ' geslaagd, ' + mislukt + ' mislukt');
  process.exit(mislukt ? 1 : 0);
})();
