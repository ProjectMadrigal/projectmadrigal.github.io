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
const INHOUD = {
  tabbladen: {
    Nieuws: [{ rij: 2, vingerafdruk: 'a', datum: '2026-10-20', titel: 'Voorstel boekenruil', publiek: 'nee', voorgesteld_door: 'Kim' }],
    Agenda: [], 'Veelgestelde vragen': [],
    Leeslijsten: [{ rij: 2, vingerafdruk: 'x', naam: 'Pride-maand', publiek: 'ja', zichtbaar_vanaf: '2027-06-01', zichtbaar_tot: '2027-06-30' }]
  },
  instellingen: [{ titel: 'Website: leeslijsten', instellingen: [{ sleutel: 'leeslijsten_tonen', waarde: 'nee', uitleg: '' }] }]
};

function antwoord(rol, actie) {
  const basis = { vandaagTekst: 'zondag 25 oktober', telaat: [UITLENING], binnenkort: [], lopend: [UITLENING], reservaties: [], boeken: BOEKEN };
  return {
    aanmelden: { ok: true, rol },
    vrijwilligerData: { ok: true, data: basis },
    bestuurData: { ok: true, data: Object.assign({}, basis, {
      telaat: [Object.assign({}, UITLENING, { telefoon: '0400000000', herinnering: 'Hoi Sam' })], aanvragen: [], uitzonderingen: [], leners: [],
      boekstatus: { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] }, borgen: { ingehouden: { totaal: 0, perBetaalwijze: {} }, terugTeBetalen: [] },
      perMaand: [{ maand: 'oktober 2026', uitleningen: 1, giften: 0 }], meestGeleend: [], groepen: [], voorstellen: 1
    }) },
    balieData: { ok: true, data: Object.assign({}, basis, { vandaag: '2026-10-25', instellingen: { borg_per_boek: 5, borg_betaalwijzen: ['cash'] }, leners: [] }) },
    beheerInhoud: { ok: true, data: INHOUD },
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
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(antwoord(opties.rol, b.actie)) });
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
    await page.click('button:has-text("Boeken zonder beschrijving (1)")');
    const titels = await page.$$eval('.kaartlijst strong', (x) => x.map((e) => e.textContent));
    verwacht(JSON.stringify(titels) === JSON.stringify(['De verzonnen zee']), 'Lijst: ' + titels.join(', '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('vrijwilligersscherm: enkel de eigen onderdelen, geen contactgegevens', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(page, basis, 'vrijwilliger.html');
    const knoppen = await page.$$eval('#sectienav button', (x) => x.map((e) => e.textContent.replace(/ \(.*\)$/, '')));
    verwacht(JSON.stringify(knoppen) === JSON.stringify(['Te laat', 'Vervalt binnenkort', 'Alle uitleningen', 'Reservaties', 'Boeken zonder cover', 'Nieuws en agenda', 'Leeslijsten', 'Rooster']), 'Onderdelen: ' + knoppen.join(', '));
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
