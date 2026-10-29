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
const BOEKEN = [{ id: 'B0001', t: 'De verzonnen zee', a: 'Verbeek, Mira', x: 1, u: true, c: false, zb: true, g: ['Fictie'] }, { id: 'B0002', t: 'Twee kasten vol', a: 'Dewit, Rein', x: 1, u: true, c: true, g: ['Maatschappij'] }];
// Veel boeken zonder beschrijving (verzonnen), om Toon er nog 100 te testen.
const VEEL = Array.from({ length: 150 }, (_, i) => ({ id: 'X' + String(i).padStart(3, '0'), t: 'Verzonnen titel ' + String(i).padStart(3, '0'), a: '', c: true, zb: true }));
const UITLENING2 = Object.assign({}, UITLENING, { uitlening_id: 'U0002', exemplaar: 'B0002-1', boek_id: 'B0002', titel: 'Twee kasten vol', lenersnummer: '13', voornaam: 'Jo', aantal_verlengingen: 1, borg: 5, betaalwijze_borg: 'cash' });
const INHOUD = {
  tabbladen: {
    Nieuws: [{ rij: 2, vingerafdruk: 'a', datum: '2026-10-20', titel: 'Voorstel boekenruil', publiek: 'nee', voorgesteld_door: 'Kim' }],
    Agenda: [], 'Veelgestelde vragen': [],
    Leeslijsten: [{ rij: 2, vingerafdruk: 'x', naam: 'Pride-maand', publiek: 'ja', zichtbaar_vanaf: '2027-06-01', zichtbaar_tot: '2027-06-30' }]
  },
  instellingen: [{ titel: 'Website: leeslijsten', instellingen: [{ sleutel: 'leeslijsten_tonen', waarde: 'nee', uitleg: '' }] }]
};

const AANKOOP = [
  { id: 'K0001', t: 'Atlas van niets', a: 'Bedacht, Noor', i: '9781861972712', g: 'Fictie', p: 19.99, l: 'https://voorbeeld.test/atlas', r: 'Gevraagd door een lener', d: '2026-10-28', w: 'Sam', k: false, s: 'open', b: '', db: '' },
  { id: 'K0002', t: 'Gedichten van niemand', a: 'Verzonnen, Vera', i: '', g: 'Poëzie', p: null, l: '', r: '', d: '2026-10-20', w: 'Kim', k: true, s: 'open', b: '', db: '' },
  { id: 'K0003', t: 'Stille lichten', a: 'Fictief, Kim', i: '', g: '', p: 12, l: '', r: '', d: '2026-09-01', w: 'Kim', k: false, s: 'binnen', b: 'B0003', db: '2026-10-01' }
];
const VERKOOP = {
  teKoop: [{ id: 'B0001', t: 'De verzonnen zee', a: 'Verbeek, Mira', prijs: 8, o: true, stock: 3, c: '', g: ['Fictie', 'Gender'], d: 'Een verzonnen verhaal over de zee.' }],
  standjes: [{ standje_id: 'S0001', naam: 'Pride Antwerpen', thema: 'Pride', datum: '2026-08-08', locatie: 'Groenplaats', status: 'bezig',
    boeken: [{ boek_id: 'B0001', t: 'De verzonnen zee', a: 'Verbeek, Mira', mee: 2, verkocht: 0, prijs: 8, o: true, stock: 3, c: '', g: ['Fictie', 'Gender'], d: 'Een verzonnen verhaal over de zee.' }],
    omzet: { totaal: 0, perBetaalwijze: {} }, aantalVerkopen: 0 }],
  betaalwijzen: ['cash', 'QR']
};

function antwoord(rol, actie, vraag) {
  const basis = { vandaagTekst: 'zondag 25 oktober', telaat: [UITLENING], binnenkort: [], lopend: [UITLENING], reservaties: [], boeken: BOEKEN };
  return {
    aanmelden: { ok: true, rol: rol === 'bestuur' && (vraag || {}).alsRol === 'vrijwilliger' ? 'vrijwilliger' : rol, echteRol: rol },
    vrijwilligerData: { ok: true, data: Object.assign({}, basis, { voorgesteld: [], checklist: { openen: ['Licht aan', 'Balie openen'], sluiten: ['Licht uit'] },
      handleiding: { nl: [{ titel: 'De sleutel', regels: [{ punt: false, tekst: 'Vraag het in de groep.' }, { punt: true, tekst: 'Rode bol: niet uitlenen.' }] }], en: [{ titel: 'The key', regels: [{ punt: false, tekst: 'Ask in the group.' }] }] },
      briefjes: [{ briefje_id: 'N0001', datum: '2026-10-23', wie: 'Ilo', tekst: 'De printer is stuk.' }],
      vandaagTerug: [{ uitlening_id: 'U0009', exemplaar: 'B0002-1', boek_id: 'B0002', titel: 'Twee kasten vol', auteur: 'Dewit, Rein', onderwerp: 'Maatschappij', staat_terug: 'licht beschadigd' }],
      reservaties: [{ reservatie_id: 'R0001', boek_id: 'B0001', lenersnummer: '13', voornaam: 'Jo', status: 'wacht', tekst: 'Wacht' }],
      mijn: { voorstellen: [{ datum: '2026-10-20', titel: 'Stille lichten', status: 'goedgekeurd', datum_behandeld: '2026-10-21' }], meldingen: [{ datum: '2026-10-22', soort: 'boek kapot', onderwerp: 'B0001', status: 'nieuw', datum_afgehandeld: '' }] } }) },
    bestuurData: { ok: true, data: Object.assign({}, basis, {
      boeken: BOEKEN.concat(VEEL),
      telaat: [Object.assign({}, UITLENING, { telefoon: '0400000000', herinnering: 'Hoi Sam' }), Object.assign({}, UITLENING2, { email: 'jo@voorbeeld.test', herinnering: 'Hoi Jo' })],
      lopend: [UITLENING, UITLENING2], aanvragen: [], uitzonderingen: [],
      leners: [{ lenersnummer: '12', voornaam: 'Sam', achternaam: 'Verzonnen', telefoon: '0400000000', email: '', actief: true, toestemming_privacy: 'ja', lopend: 1, datum_inschrijving: '2026-01-01' }],
      boekstatus: { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] }, borgen: { ingehouden: { totaal: 0, perBetaalwijze: {} }, terugTeBetalen: [] },
      perMaand: [{ maand: 'oktober 2026', uitleningen: 1, giften: 0 }], perJaar: [{ jaar: 2025, uitleningen: 30, giften: 20 }, { jaar: 2024, uitleningen: 40, giften: 10 }], voorstellen: 1,
      teVervangen: [{ sleutel: 'U:U0009', boek_id: 'B0003', exemplaar: 'B0003-1', titel: 'Stille lichten', auteur: 'Aerts, Noor', isbn: '', datum: '2026-10-20', lenersnummer: '12', opmerking: '', borg: 'ingehouden' }],
      meldingen: [{ melding_id: 'M0001', datum: '2026-10-24', wie: 'Kim', soort: 'boek kapot', onderwerp: 'B0001', bericht: 'De rug is gescheurd.' }],
      beschrijvingVoorstellen: [{ voorstel_id: 'V0001', datum: '2026-10-24', boek_id: 'B0001', titel: 'De verzonnen zee', tekst: 'Een verzonnen roman over een zee die niet bestaat.', voorgesteld_door: 'Kim' }],
      privacy: 'Verzonnen privacyverklaring.'
    }) },
    balieData: { ok: true, data: Object.assign({}, basis, { vandaag: '2026-10-25', instellingen: { borg_per_boek: 5, borg_betaalwijzen: ['cash'], checklist_uitlenen: ['Geen rode bol op het boek', 'Bladwijzer in het boek'] }, leners: [{ n: '12', v: 'Sam' }, { n: '14', v: 'Robin', m: 1 }], privacy: 'Verzonnen privacytekst.', privacy_en: 'Made-up privacy text.',
      checklist: { openen: ['Licht aan'], sluiten: ['Licht uit'] }, handleiding: { nl: [{ titel: 'De sleutel', regels: [{ punt: false, tekst: 'Vraag het in de groep.' }] }], en: [{ titel: 'The key', regels: [{ punt: false, tekst: 'Ask in the group.' }] }] } }) },
    bestuurCijfers: { ok: true, cijfers: { meestGeleend: [], groepen: [],
      shifts: { jaar: 2026, personen: [{ naam: 'Kim', bib: 3, backup: 1 }], dicht: [{ datum: '2026-05-01', rol: 'gesloten' }] },
      extraCijfers: { nieuweLeners: [{ maand: 'oktober 2026', aantal: 2 }], nooitUitgeleend: 1, mediaanDagen: 17, afgesloten: 2, langerDanHalfJaar: 0, actieveLeners: 2 } } },
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
    bezoekersCijfers: { ok: true, cijfers: { totaal: 31, perWeek: false, verloop: [{ dag: '2026-09-27', n: 0 }, { dag: '2026-09-28', n: 0 }, { dag: '2026-10-24', n: 24 }, { dag: '2026-10-25', n: 0 }, { dag: '2026-10-26', n: 7 }], paginas: [], bronnen: [], toestellen: [], landen: [] } },
    filmsVoorbeeld: { ok: true, filmsTonen: false, teksten: { films: 'Verzonnen tekst over films.' },
      boeken: JSON.parse(fs.readFileSync(path.join(MAP, 'voorbeeld/catalogus.json'))).boeken.filter((x) => x.s === 'film') },
    roosterOverzicht: { ok: true, data: { gekoppeld: true, vandaag: '2026-10-25', link: 'https://voorbeeld.test/rooster', nietGepubliceerd: [], avonden: [
      { datum: '2026-10-30', status: '', event: '', vrijwilligers: ['Ilo', 'Kim V.'], backups: [], afgemeld: [], gepubliceerd: true },
      { datum: '2026-11-06', status: 'gesloten', event: '', vrijwilligers: [], backups: [], afgemeld: [], gepubliceerd: true }],
      verouderd: { tijd: Date.UTC(2026, 9, 25, 16, 5), reden: 'Google laat vandaag geen nieuwe vragen naar buiten meer toe (daglimiet).' } } },
    voorstelBeschrijving: { ok: true, tekst: 'Dank je! Het bestuur bekijkt je beschrijving.' },
    voorstelBehandelen: { ok: true, tekst: 'De beschrijving staat bij "De verzonnen zee".' },
    meldingMaken: { ok: true, tekst: 'Je melding is doorgegeven aan het bestuur. Dank je!' },
    meldingAfhandelen: { ok: true, tekst: 'Melding M0001 is afgehandeld.' },
    vervaldatumAanpassen: { ok: true, tekst: '"Twee kasten vol" moet nu terug tegen vrijdag 25 oktober.' },
    annuleerVerlenging: { ok: true, tekst: 'De verlenging van "Twee kasten vol" is geannuleerd.' },
    annuleerUitlening: { ok: true, tekst: 'De uitlening van "Twee kasten vol" is geannuleerd. Geef de borg van 5 euro terug.' },
    beheerCoverVanLink: { ok: true, tekst: 'De afbeelding is de cover van "Stille lichten".', cover_url: 'https://lh3.googleusercontent.com/d/test' },
    verkoopData: { ok: true, data: VERKOOP },
    aankoopData: { ok: true, lijst: AANKOOP },
    aankoopToevoegen: { ok: true, tekst: '"' + ((vraag || {}).titel || '') + '" staat op de aankooplijst. Dank je!', lijst: AANKOOP },
    aankoopAanpassen: { ok: true, tekst: 'Bewaard.', lijst: AANKOOP.map((b) => b.id === (vraag || {}).aankoop_id && (vraag || {}).hasOwnProperty('gekozen') ? Object.assign({}, b, { k: vraag.gekozen }) : b) },
    aankoopVerwijderen: { ok: true, tekst: 'Verwijderd.', lijst: AANKOOP },
    aankoopLezen: { ok: true, overgeslagen: 0, boeken: [{ titel: 'Nieuwe verzonnen roman', auteur: 'Fictief, Kim', isbn: '9780306406157', prijs: 21.5, genre: 'Fictie', link: 'https://www.bol.com/nl/nl/p/x/9300000111111111/' },
      { titel: 'Stille lichten', auteur: 'Fictief, Kim', isbn: '', prijs: '', genre: '', link: '', al: 'in de catalogus (B0003)' }] },
    aankoopImporteren: { ok: true, gelukt: ((vraag || {}).boeken || []).length, tekst: ((vraag || {}).boeken || []).length + ' boek staat nu op de aankooplijst.', lijst: AANKOOP },
    voorraadCatalogus: { ok: true, boeken: [{ id: 'B0001', t: 'De verzonnen zee', a: 'Verbeek, Mira', i: '', stock: 3, prijs: 8, o: true }, { id: 'B0002', t: 'Stille lichten', a: 'Fictief, Kim', i: '9780000000002', stock: 0, prijs: null, o: false }] },
    voorraadZetten: { ok: true, tekst: '"Stille lichten": 2 te koop aan 7,50 euro.', data: VERKOOP },
    verkopenDoorsturen: { ok: true, bewaard: ((vraag || {}).verkopen || []).map((v) => v.verkoop_id), nieuw: ((vraag || {}).verkopen || []).length, fouten: [], data: VERKOOP },
    boekVervangen: { ok: true, tekst: '"Stille lichten": vervangen. Het staat weer gewoon in de catalogus.' },
    boekVerloren: { ok: true, tekst: '"Twee kasten vol" staat als verloren. De uitlening is afgesloten, de borg van 5 euro is ingehouden.' },
    briefjeMaken: { ok: true, tekst: 'Je briefje staat bij Vandaag voor de volgende shift.' },
    briefjeWeg: { ok: true, tekst: 'Het briefje is weg.' }
  }[actie] || { ok: false, fout: 'Niet nagebootst: ' + actie };
}

async function nieuweContext(browser, opties) {
  const ctx = await browser.newContext(Object.assign({ locale: 'nl-BE', serviceWorkers: 'block' }, opties.context || {}));
  const apiUrl = opties.rol ? 'https://web-app.test/exec' : '';
  await ctx.route('**/config.js', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MADRIGAL_CONFIG={apiUrl:' + JSON.stringify(apiUrl) + ",naam:'Project Madrigal',statistiek:''};" }));
  if (opties.rol) {
    await ctx.route('https://web-app.test/**', (r) => {
      // De publieke catalogus (GET): het voorbeeld, met de films nog verborgen.
      if (r.request().method() === 'GET') {
        const d = JSON.parse(fs.readFileSync(path.join(MAP, 'voorbeeld/catalogus.json')));
        delete d.filmsTonen;
        d.boeken = d.boeken.filter((x) => x.s !== 'film');
        r.fulfill({ contentType: 'application/json', body: JSON.stringify(d) });
        return;
      }
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
    for (const pagina of ['index.html', 'boeken.html', 'boeken.html#/boek/B0008', 'boeken.html#/leeslijsten', 'films.html', 'films.html#/film/F0002', 'over-ons.html', 'doe-mee.html', 'peperfabriek.html']) {
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
    const ids = JSON.parse(fs.readFileSync(path.join(MAP, 'voorbeeld/catalogus.json'))).boeken.filter((b) => b.s !== 'film').map((b) => b.id);
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

  await test('films: eigen pagina met filters en detail, niet tussen de boeken', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, {});
    await page.goto(basis + '/films.html');
    await page.waitForSelector('#resultaten li');
    const titels = await page.$$eval('#resultaten .boek-titel a', (x) => x.map((e) => e.textContent));
    verwacht(titels.length === 4 && titels.indexOf('Glitter op de dijk') > -1, 'Films: ' + titels.join(', '));
    verwacht(/Regie: Noor Aerts/.test(await page.textContent('#resultaten')), 'Regie ontbreekt in de lijst');
    verwacht(/Kijktip/.test(await page.textContent('#resultaten')), 'Label Kijktip ontbreekt');
    await page.click('#filters summary');
    await page.selectOption('#filter-genre', 'Romantiek');
    verwacht((await page.$$('#resultaten > li')).length === 2, 'Filter op genre');
    await page.selectOption('#filter-genre', '');
    await page.selectOption('#filter-land', 'België');
    verwacht((await page.$$('#resultaten > li')).length === 2, 'Filter op land (ook bij twee landen)');
    await page.evaluate(() => { location.hash = '#/film/F0002'; });
    await page.waitForSelector('.detail h1');
    const detail = await page.textContent('.detail');
    verwacht(/Regie: Ilo Claes/.test(detail) && /Nederland, België/.test(detail) && /104 min/.test(detail) && /1987/.test(detail), 'Detail: ' + detail.slice(0, 300));
    verwacht(/Kijk ook/.test(await page.textContent('#detail-scherm')), 'Kijk ook ontbreekt');
    await page.evaluate(() => { location.hash = '#/film/F0003'; });
    await page.waitForSelector('.detail .originele-titel');
    verwacht(/Originele titel: Voix dans la nuit/.test(await page.textContent('.detail')), 'Originele titel ontbreekt');
    await page.evaluate(() => { location.hash = '#/?q=voix'; });
    await page.waitForSelector('#resultaten > li');
    verwacht((await page.$$('#resultaten > li')).length === 1, 'Zoeken op de originele titel');
    verwacht(!!(await page.$('#hoofdmenu [data-menu="films"]:not([hidden])')), 'Menu-item Films ontbreekt');
    // Op de pagina Boeken staan geen films.
    await page.goto(basis + '/boeken.html#/?q=glitter op de dijk');
    await page.waitForSelector('#aantal');
    await page.waitForTimeout(300);
    verwacht(!(await page.$('#resultaten a[data-id^="F"]')), 'Een film tussen de boeken');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('films: verborgen voor bezoekers, wel zichtbaar voor het bestuur', async () => {
    let r = await nieuweContext(browser, { rol: 'bestuur' });
    await r.page.goto(basis + '/films.html');
    await r.page.waitForSelector('text=Deze pagina is nog niet beschikbaar.');
    verwacht(!(await r.page.$('#hoofdmenu [data-menu="films"]:not([hidden])')), 'Menu-item Films zichtbaar voor een bezoeker');
    verwacht(!(await r.page.$('#resultaten li')), 'Films zichtbaar voor een bezoeker');
    await r.ctx.close();
    // Op een toestel met de bestuurscode: de films, met een melding en "Films (verborgen)" in het menu.
    r = await nieuweContext(browser, { rol: 'bestuur' });
    await r.ctx.addInitScript(() => { localStorage.setItem('madrigal_code_bestuur', 'verzonnen-code'); localStorage.setItem('madrigal_wie', 'Kim'); });
    const vragen = [];
    r.page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await r.page.goto(basis + '/films.html');
    await r.page.waitForSelector('#resultaten li');
    verwacht(!(await r.page.$('#films-voorbeeld[hidden]')), 'Melding voorbeeld ontbreekt');
    verwacht(vragen.some((v) => v.actie === 'filmsVoorbeeld' && v.code === 'verzonnen-code'), 'Geen vraag om het voorbeeld');
    verwacht(/Films \(verborgen\)/.test(await r.page.textContent('#hoofdmenu')), 'Menu toont Films (verborgen) niet');
    verwacht(/4 films gevonden/.test(await r.page.textContent('#aantal')), 'Teller zegt geen films: ' + await r.page.textContent('#aantal'));
    verwacht(!(await axe(r.page)).length, 'Toegankelijkheid: ' + (await axe(r.page)).join(' | '));
    await r.ctx.close();
    verwacht(!r.fouten.length, r.fouten.join(' | '));
  });
  await test('films: voorbeeld zonder films zegt hoe je ze toevoegt', async () => {
    const r = await nieuweContext(browser, { rol: 'bestuur' });
    await r.ctx.addInitScript(() => { localStorage.setItem('madrigal_code_bestuur', 'verzonnen-code'); localStorage.setItem('madrigal_wie', 'Kim'); });
    await r.ctx.route('https://web-app.test/**', (q) => {
      if (q.request().method() === 'GET') { q.fallback(); return; }
      q.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, boeken: [], teksten: {}, filmsTonen: false }) });
    });
    await r.page.goto(basis + '/films.html');
    await r.page.waitForSelector('text=Er staan nog geen films in de Catalogus');
    await r.ctx.close();
    verwacht(!r.fouten.length, r.fouten.join(' | '));
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
    await page.check('input[value="beschadigd"]');
    await page.fill('input[id$="-opmerking"]', 'koffievlek');
    const verstuurd = page.waitForRequest((v) => /terugbrengen/.test(v.postData() || ''));
    await page.click('button:has-text("Bevestig: boek is terug")');
    const terugVraag = JSON.parse((await verstuurd).postData());
    verwacht(terugVraag.staat_boek === 'beschadigd' && terugVraag.opmerking === 'koffievlek', 'Staat meegestuurd: ' + JSON.stringify(terugVraag));
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
    await page.waitForSelector('h4:has-text("Nooit uitgeleend")');
    const bezoek = await page.textContent('#sectie');
    verwacht(/24\/10\/2026|24-10-2026|24 okt/.test(bezoek) && !/27\/9\/2026|27-09-2026|27 sep/.test(bezoek) && /25\/10\/2026|25-10-2026|25 okt/.test(bezoek), 'Bezoekers: geen lege dagen voor de eerste telling, wel daarna');
    verwacht(/17 dagen duurt een uitlening meestal[\s\S]*1 uitleenbare boeken werden nog nooit uitgeleend\./.test(await page.textContent('#sectie')) && !/Stille lichten · B0003/.test(await page.textContent('#sectie')), 'Extra cijfers');
    verwacht(/Shifts in 2026[\s\S]*Kim[\s\S]*1\/5\/2026: gesloten/.test(await page.textContent('#sectie')), 'Shifts per vrijwilliger ontbreken');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('uitleenscherm: vanuit het bestuursscherm meteen uitlenen aan een lener', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    await meldAan(page, basis, 'balie.html');
    await page.goto('about:blank');
    await page.goto(basis + '/balie.html#uitlenen=12');
    await page.waitForSelector('text=Bevestig de uitlening');
    verwacht(/Niet vergeten/.test(await page.textContent('#werkvlak')) && /Geen rode bol op het boek/.test(await page.textContent('#werkvlak')), 'Checklist bij uitlenen ontbreekt');
    verwacht(/Sam/.test(await page.textContent('#werkvlak')), 'Lener Sam staat klaar');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('vrijwilligersscherm: enkel de eigen onderdelen, geen contactgegevens', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(page, basis, 'vrijwilliger.html');
    const knoppen = await page.$$eval('#sectienav button', (x) => x.map((e) => e.textContent.replace(/ \(.*\)$/, '')));
    verwacht(JSON.stringify(knoppen) === JSON.stringify(['Vandaag', 'Handleiding', 'Checklist voor de shift', 'Iets melden', 'Mijn voorstellen en meldingen', 'Te laat', 'Vervalt binnenkort', 'Alle uitleningen', 'Reservaties', 'Terug te zetten', 'Te vervangen', 'Boek opzoeken', 'Boeken zonder cover', 'Boeken zonder beschrijving', 'Kastcontrole', 'Aankooplijst', 'Nieuws en agenda', 'Leeslijsten', 'Rooster']), 'Onderdelen: ' + knoppen.join(', '));
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
  await test('vrijwilligersscherm: shift, rondleiding, checklist, melden, beschrijving en kastcontrole', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen = [];
    page.on('request', (r) => { if (r.url().indexOf('web-app.test') > -1) vragen.push(JSON.parse(r.postData() || '{}')); });
    await meldAan(page, basis, 'vrijwilliger.html');
    // Jouw shift: Kim staat als "Kim V." op het rooster.
    await page.waitForSelector('text=Je volgende shift: vrijdag 30 oktober');
    verwacht(/Dit is het rooster zoals het 25\/10 om/.test(await page.textContent('#sectie')), 'Uitleg bij een ouder rooster ontbreekt');
    verwacht(/Ilo, Kim V\./.test(await page.textContent('#sectie')), 'Deze week ontbreekt');
    // Rondleiding de eerste keer, daarna niet meer.
    await page.click('button:has-text("Start de rondleiding")');
    await page.click('button:has-text("Volgende")');
    verwacht(/stap 2 van/.test(await page.textContent('#sectie')), 'Rondleiding stap 2');
    await page.click('button:has-text("Sluit de rondleiding")');
    verwacht(!(await page.$('text=Start de rondleiding')), 'Welkom blijft staan na de rondleiding');
    verwacht(!!(await page.$('button:has-text("Bekijk de rondleiding")')), 'Knop om de rondleiding opnieuw te bekijken');
    // Handleiding: Nederlands, en na de keuze Engels (blijft bewaard).
    await page.click('#sectienav button:has-text("Handleiding")');
    verwacht(/De sleutel[\s\S]*Vraag het in de groep[\s\S]*Rode bol/.test(await page.textContent('#sectie')) && !!(await page.$('#sectie li')), 'Handleiding in het Nederlands, met opsomming');
    await page.click('#sectie button:has-text("English")');
    verwacht(/The key[\s\S]*Ask in the group/.test(await page.textContent('#sectie')) && (await page.getAttribute('#sectie button[lang="en"]', 'aria-pressed')) === 'true', 'Handleiding in het Engels');
    await page.click('#sectie button:has-text("Nederlands")');
    // Knop English: het hele scherm in het Engels, ook na herladen. Terug naar Nederlands herlaadt.
    await page.click('.taal-knop');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    const engels = await page.$$eval('#sectienav button', (b) => b.map((x) => x.textContent.trim()));
    verwacht(engels.indexOf('Today') > -1 && engels.indexOf('Manual') > -1 && engels.indexOf('Shift checklist') > -1 && engels.indexOf('Report something') > -1, 'Menu in het Engels: ' + engels.join(', '));
    await page.click('#sectienav button:has-text("Manual")');
    verwacht(/The key/.test(await page.textContent('#sectie')), 'Handleiding volgt de taal van het scherm');
    await page.click('#sectienav button:has-text("Shift checklist")');
    verwacht(/When opening[\s\S]*0 of 2 done\./.test(await page.textContent('#sectie')), 'Checklist in het Engels, met teller');
    await page.click('#sectienav button:has-text("All loans")');
    verwacht(/books? on loan, sorted by due date\./.test(await page.textContent('#sectie')), 'Alle uitleningen in het Engels');
    await page.reload();
    await page.waitForSelector('#sectienav button');
    await page.waitForFunction(() => /Today/.test(document.querySelector('#sectienav').textContent));
    verwacht((await page.textContent('.taal-knop')) === 'Nederlands', 'Engels blijft na herladen');
    await Promise.all([page.waitForNavigation(), page.click('.taal-knop')]);
    await page.waitForSelector('#sectienav button');
    verwacht(/Vandaag/.test(await page.textContent('#sectienav')) && (await page.textContent('.taal-knop')) === 'English', 'Terug naar het Nederlands');
    // Checklist: blijft afgevinkt na herladen.
    await page.click('#sectienav button:has-text("Checklist voor de shift")');
    await page.check('#check-openen-0');
    verwacht(/1 van 2 gedaan/.test(await page.textContent('#sectie')), 'Teller checklist');
    await page.reload();
    await page.waitForSelector('#check-openen-0');
    verwacht(await page.isChecked('#check-openen-0'), 'Vinkje onthouden');
    // Iets melden.
    await page.click('#sectienav button:has-text("Iets melden")');
    await page.check('input[value="wil iets kopen"]');
    verwacht(/telefoonnummer of e-mailadres, als die daarmee akkoord gaat/.test(await page.textContent('#melden-privacy')), 'Uitleg bij kopen ontbreekt');
    await page.check('input[value="iets kwijt"]');
    await page.fill('#melden-bericht', 'De stempel is weg.');
    await page.click('button:has-text("Verstuur naar het bestuur")');
    await page.waitForSelector('text=Je melding is doorgegeven');
    verwacht(vragen.some((v) => v.actie === 'meldingMaken' && v.soort === 'iets kwijt' && v.bericht === 'De stempel is weg.'), 'Melding niet verstuurd');
    // Beschrijving voorstellen.
    await page.click('#sectienav button:has-text("Boeken zonder beschrijving")');
    verwacht(!(await page.$('text=Zoek beschrijvingen automatisch')), 'Vrijwilliger ziet de automatische zoekknop');
    await page.click('.kaartlijst button:has-text("De verzonnen zee")');
    await page.fill('#vb-tekst', 'Een roman over een zee die niet bestaat, verteld door drie vrienden.');
    await page.click('button:has-text("Stel voor")');
    await page.waitForSelector('text=Dank je! Het bestuur bekijkt');
    verwacht(vragen.some((v) => v.actie === 'voorstelBeschrijving' && v.boek_id === 'B0001'), 'Voorstel niet verstuurd');
    verwacht(/Beschrijving voorgesteld/.test(await page.textContent('#sectie')), 'Label Beschrijving voorgesteld ontbreekt');
    // Kastcontrole: een onbekend ISBN typen, B0002 met de hand aanvinken. B0001 is uitgeleend.
    await page.click('#sectienav button:has-text("Kastcontrole")');
    await page.click('button:has-text("Begin de controle")');
    await page.fill('#kast-isbn', '9780306406157');
    await page.click('button:has-text("Voeg toe")');
    verwacht(/Niet in de catalogus \(1\)/.test(await page.textContent('#sectie')), 'Onbekend ISBN niet getoond');
    await page.check('#kast-B0002');
    const tekst = await page.textContent('#sectie');
    verwacht(/Ontbreekt \(0\)/.test(tekst) && /Uitgeleend \(1\)/.test(tekst) && /Gevonden \(1\)/.test(tekst), 'Resultaat kastcontrole: ' + tekst.slice(0, 300));
    verwacht(!(await axe(page)).length, 'Toegankelijkheid kastcontrole: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('vrijwilligersscherm: briefjes, mijn voorstellen, terug te zetten en boek opzoeken', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen = [];
    page.on('request', (r) => { if (r.url().indexOf('web-app.test') > -1) vragen.push(JSON.parse(r.postData() || '{}')); });
    await meldAan(page, basis, 'vrijwilliger.html');
    await page.waitForSelector('text=De printer is stuk.');
    await page.click('summary:has-text("Schrijf een briefje")');
    await page.fill('#briefje-tekst', 'Sleutel ligt in de schuif.');
    await page.click('button:has-text("Laat het briefje achter")');
    await page.waitForSelector('text=Je briefje staat bij Vandaag');
    verwacht(vragen.some((v) => v.actie === 'briefjeMaken' && v.tekst === 'Sleutel ligt in de schuif.'), 'Briefje niet verstuurd');
    await page.click('button:has-text("Gelezen, haal weg")');
    await page.waitForSelector('text=Het briefje is weg');
    verwacht(vragen.some((v) => v.actie === 'briefjeWeg' && v.briefje_id === 'N0001'), 'Briefje niet weggehaald');
    await page.click('#sectienav button:has-text("Mijn voorstellen en meldingen")');
    const mijn = await page.textContent('#sectie');
    verwacht(/Stille lichten/.test(mijn) && /Goedgekeurd/.test(mijn) && /Wacht op het bestuur/.test(mijn), 'Mijn voorstellen: ' + mijn.slice(0, 200));
    await page.click('#sectienav button:has-text("Terug te zetten (1)")');
    verwacht(/Maatschappij \(1\)/.test(await page.textContent('#sectie')), 'Onderwerp ontbreekt');
    await page.check('#gezet-U0009');
    await page.reload();
    await page.click('#sectienav button:has-text("Terug te zetten")');
    verwacht(await page.isChecked('#gezet-U0009'), 'Teruggezet niet onthouden');
    await page.click('#sectienav button:has-text("Boek opzoeken")');
    await page.fill('#opzoeken-zoek', 'zee');
    const kaart = await page.textContent('#sectie .kaartlijst');
    verwacht(/Niet beschikbaar/.test(kaart) && /B0001-1: moet terug op 18\/10\/2026 \(te laat\)/.test(kaart) && /1 persoon wacht/.test(kaart), 'Boek opzoeken: ' + kaart);
    verwacht(!/Jo\b|Sam/.test(kaart), 'Naam van een lener zichtbaar');
    await page.fill('#opzoeken-zoek', 'b0002');
    verwacht(/Beschikbaar/.test(await page.textContent('#sectie .kaartlijst')), 'Zoeken op boek-ID');
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('bestuursscherm: meldingen afhandelen en voorgestelde beschrijvingen goedkeuren', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    const vragen = [];
    page.on('request', (r) => { if (r.url().indexOf('web-app.test') > -1) vragen.push(JSON.parse(r.postData() || '{}')); });
    await meldAan(page, basis, 'bestuur.html');
    verwacht(/melding van een vrijwilliger/.test(await page.textContent('#sectie')), 'Vandaag toont de melding niet');
    await page.click('#sectienav button:has-text("Meldingen (1)")');
    await page.click('button:has-text("Afgehandeld")');
    await page.waitForSelector('text=Melding M0001 is afgehandeld');
    await page.click('#sectienav button:has-text("Voorgestelde beschrijvingen (1)")');
    await page.fill('#voorstel-V0001', 'Aangepaste tekst van het bestuur.');
    await page.click('button:has-text("Keur goed")');
    await page.waitForSelector('text=De beschrijving staat bij');
    verwacht(vragen.some((v) => v.actie === 'voorstelBehandelen' && v.besluit === 'goedgekeurd' && v.tekst === 'Aangepaste tekst van het bestuur.'), 'Goedkeuring niet verstuurd');
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('uitlening aanpassen: termijn (bestuur), verlenging en uitlening annuleren (ook vrijwilligers)', async () => {
    let r = await nieuweContext(browser, { rol: 'bestuur' });
    const vragen = [];
    r.page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    r.page.on('dialog', (d) => d.accept());
    await meldAan(r.page, basis, 'bestuur.html');
    await r.page.click('#sectienav button:has-text("Alle uitleningen")');
    const kaart = r.page.locator('.kaartlijst > li', { hasText: 'Twee kasten vol' });
    await kaart.locator('summary:has-text("Meer opties")').click();
    await kaart.locator('input[type="number"]').fill('7');
    await kaart.locator('button:has-text("Pas de termijn aan")').click();
    await r.page.waitForSelector('text=moet nu terug tegen');
    verwacht(vragen.some((v) => v.actie === 'vervaldatumAanpassen' && v.uitlening_id === 'U0002' && String(v.dagen) === '7'), 'Termijn niet verstuurd');
    await r.page.click('#sectienav button:has-text("Alle uitleningen")');
    await kaart.locator('summary:has-text("Meer opties")').click();
    await kaart.locator('button:has-text("Annuleer de verlenging")').click();
    await r.page.waitForSelector('text=De verlenging van');
    // Boek verloren: borg terugbetaald gekozen, met een opmerking.
    await r.page.click('#sectienav button:has-text("Alle uitleningen")');
    await kaart.locator('summary:has-text("Meer opties")').click();
    await kaart.locator('input[value="terugbetaald"]').check();
    await kaart.locator('input[placeholder^="bv. lener betaalde"]').fill('nieuw exemplaar gebracht');
    await kaart.locator('button:has-text("Noteer als verloren")').click();
    await r.page.waitForSelector('text=staat als verloren');
    verwacht(vragen.some((v) => v.actie === 'boekVerloren' && v.uitlening_id === 'U0002' && v.borg === 'terugbetaald' && v.opmerking === 'nieuw exemplaar gebracht'), 'Verloren niet verstuurd');
    // Te vervangen: teller in het menu, en Vervangen stuurt de keuze door.
    verwacht(/Te vervangen \(1\)/.test(await r.page.textContent('#sectienav')), 'Teller Te vervangen');
    await r.page.click('#sectienav button:has-text("Te vervangen")');
    verwacht(/Stille lichten[\s\S]*verloren op 20\/10\/2026 · lener 12 · borg ingehouden/.test(await r.page.textContent('#sectie')), 'Kaart Te vervangen');
    await r.page.click('#sectie button:has-text("Vervangen")');
    await r.page.waitForSelector('text=vervangen. Het staat weer gewoon in de catalogus');
    verwacht(vragen.some((v) => v.actie === 'boekVervangen' && v.sleutel === 'U:U0009' && v.keuze === 'vervangen'), 'Vervangen niet verstuurd');
    await r.page.click('#sectienav button:has-text("Borgen en giften")');
    verwacht(/Giften per jaar[\s\S]*2025\s*30\s*€\s?20[\s\S]*2024\s*40\s*€\s?10/.test(await r.page.textContent('#sectie')), 'Giften per jaar: ' + (await r.page.textContent('#sectie')).slice(-200));
    verwacht(!(await axe(r.page)).length, 'Toegankelijkheid: ' + (await axe(r.page)).join(' | '));
    await r.ctx.close();
    verwacht(!r.fouten.length, r.fouten.join(' | '));
    // Vrijwilliger: geen termijn aanpassen, wel annuleren.
    r = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen2 = [];
    r.page.on('request', (q) => { if (q.method() === 'POST') vragen2.push(JSON.parse(q.postData() || '{}')); });
    r.page.on('dialog', (d) => d.accept());
    await meldAan(r.page, basis, 'vrijwilliger.html');
    await r.page.click('#sectienav button:has-text("Alle uitleningen")');
    await r.page.click('.kaartlijst > li summary:has-text("Meer opties")');
    verwacht(!(await r.page.$('button:has-text("Pas de termijn aan")')), 'Vrijwilliger kan de termijn aanpassen');
    verwacht(!(await r.page.$('button:has-text("Noteer als verloren")')), 'Vrijwilliger kan een boek op verloren zetten');
    await r.page.click('.kaartlijst > li button:has-text("Annuleer de uitlening")');
    await r.page.waitForSelector('text=Geef de borg van 5 euro terug');
    verwacht(vragen2.some((v) => v.actie === 'annuleerUitlening'), 'Annuleren niet verstuurd');
    await r.ctx.close();
    verwacht(!r.fouten.length, r.fouten.join(' | '));
  });
  await test('bestuur bekijkt het vrijwilligersscherm met de rechten van een vrijwilliger', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    const vragen = [];
    page.on('request', (r) => { if (r.url().indexOf('web-app.test') > -1) vragen.push(JSON.parse(r.postData() || '{}')); });
    await meldAan(page, basis, 'bestuur.html');
    verwacht(vragen.every((v) => !v.alsRol), 'Bestuursscherm vraagt als vrijwilliger');
    await page.click('a:has-text("Bekijk als vrijwilliger")');
    await page.waitForSelector('#als-vrijwilliger:not([hidden])');
    await page.waitForSelector('text=Jouw shift');
    verwacht(vragen.some((v) => v.actie === 'vrijwilligerData' && v.alsRol === 'vrijwilliger'), 'Geen alsRol bij vrijwilligerData');
    verwacht((await page.getAttribute('#als-vrijwilliger a', 'href')) === 'bestuur.html', 'Link terug ontbreekt');
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
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
  await test('verkoopscherm: verkopen, ook zonder internet, en daarna doorsturen', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await meldAan(page, basis, 'verkoop.html');
    await page.click('#werkvlak button:has-text("Open")');
    verwacht(/Mee: 2 · verkocht: 0 · nog hier: 2 · thuis: 1/.test(await page.textContent('#werkvlak')), 'Stand van het boek');
    // Zoals op de website: een kaart met (tijdelijke) cover, thema's en de beschrijving om open te klappen.
    verwacht(await page.$('#werkvlak .boekenlijst .boek .plaatshouder'), 'Geen cover of plaatshouder');
    verwacht((await page.textContent('#werkvlak .labels')).includes('Gender'), 'Thema\'s ontbreken');
    await page.click('#werkvlak summary:has-text("Beschrijving")');
    verwacht(await page.isVisible('text=Een verzonnen verhaal over de zee.'), 'Beschrijving gaat niet open');
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.click('#werkvlak button:has-text("Verkocht")');
    await page.fill('#vk-prijs-B0001', '6');
    await page.check('#werkvlak input[value="QR"]');
    await page.click('button:has-text("Bevestig de verkoop")');
    await page.waitForSelector('text=1 verkoop wacht om doorgestuurd te worden.');
    verwacht(/Geen internet/.test(await page.textContent('#verbinding')), 'Melding zonder internet');
    verwacht(/Mee: 2 · verkocht: 1 · nog hier: 1 · thuis: 1/.test(await page.textContent('#werkvlak')), 'Verkoop telt al mee');
    verwacht(!vragen.some((v) => v.actie === 'verkopenDoorsturen'), 'Mag niet doorsturen zonder internet');
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => !/wacht om doorgestuurd/.test(document.getElementById('verbinding').textContent));
    const v = vragen.filter((x) => x.actie === 'verkopenDoorsturen').pop();
    verwacht(v && v.verkopen.length === 1 && v.verkopen[0].prijs === 6 && v.verkopen[0].betaalwijze === 'QR' && /^v-\d+-[a-z0-9]+$/.test(v.verkopen[0].verkoop_id), 'Doorgestuurd: ' + JSON.stringify(v));
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('verkoopscherm: iedereen ziet de voorraad, en Klaarzetten toont alles wat te koop is', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(page, basis, 'verkoop.html');
    await page.click('#werkvlak button:has-text("Bekijk de voorraad (1 boek)")');
    await page.waitForSelector('#st-zoek');
    const tekst = await page.textContent('#werkvlak');
    verwacht(/1 boek, 3 exemplaren te koop/.test(tekst) && /De verzonnen zee/.test(tekst) && /Klaargezet voor Pride Antwerpen: 2/.test(tekst), 'Voorraad: ' + tekst);
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await page.fill('#st-zoek', 'bestaat niet');
    await page.waitForSelector('text=Geen boek te koop gevonden.');
    await page.click('#werkvlak button:has-text("Alle standjes")');
    await page.click('#werkvlak button:has-text("Open")');
    await page.click('#werkvlak button:has-text("Klaarzetten")');
    verwacht(await page.$('#kz-mee-B0001'), 'Klaarzetten toont het boek niet zonder te zoeken');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('verkoopscherm: het bestuur zet een boek uit de Catalogus in de voorraad, een vrijwilliger niet', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await meldAan(page, basis, 'verkoop.html');
    await page.click('#werkvlak button:has-text("Voorraad beheren")');
    await page.waitForSelector('#vr-zoek');
    verwacht(/De verzonnen zee/.test(await page.textContent('#werkvlak')) && !/Stille lichten/.test(await page.textContent('#werkvlak')), 'Zonder zoekterm: enkel wat te koop is');
    // Ook vanuit Bekijk de voorraad: Pas aan op de kaart.
    await page.click('#werkvlak button:has-text("Alle standjes")');
    await page.click('#werkvlak button:has-text("Bekijk de voorraad")');
    await page.click('#werkvlak button:has-text("Pas aan")');
    await page.fill('#vr-prijs-B0001', '9');
    await page.click('#werkvlak .boek button:has-text("Bewaar")');
    await page.waitForFunction(() => document.querySelectorAll('#werkvlak .melding').length > 0);
    verwacht(vragen.some((x) => x.actie === 'voorraadZetten' && x.boek_id === 'B0001' && x.prijs === '9'), 'Pas aan stuurt niets door');
    await page.click('#werkvlak button:has-text("Alle standjes")');
    await page.click('#werkvlak button:has-text("Voorraad beheren")');
    await page.waitForSelector('#vr-zoek');
    await page.fill('#vr-zoek', '9780000000002');
    await page.fill('#vr-aantal-B0002', '2');
    await page.fill('#vr-prijs-B0002', '7,50');
    await page.check('#vr-o-B0002');
    await page.click('#werkvlak li:has-text("Stille lichten") button:has-text("Bewaar")');
    await page.waitForSelector('text=2 te koop aan 7,50 euro');
    const v = vragen.filter((x) => x.actie === 'voorraadZetten').pop();
    verwacht(v && v.boek_id === 'B0002' && v.te_koop_aantal === '2' && v.prijs === '7,50' && v.onderhandelbaar === true, 'Doorgestuurd: ' + JSON.stringify(v));
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    const vw = await nieuweContext(browser, { rol: 'vrijwilliger' });
    await meldAan(vw.page, basis, 'verkoop.html');
    await vw.page.waitForSelector('text=Boeken aan de voorraad toevoegen kan enkel met de code van het bestuur.');
    verwacht(!(await vw.page.$('#werkvlak button:has-text("Voorraad beheren")')), 'Een vrijwilliger ziet de knop niet');
    await vw.ctx.close();
    verwacht(!fouten.length && !vw.fouten.length, fouten.concat(vw.fouten).join(' | '));
  });
  await test('aankooplijst: een vrijwilliger stelt een boek voor, maar kan niets aanduiden of verwijderen', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await meldAan(page, basis, 'vrijwilliger.html');
    await page.click('#sectienav button:has-text("Aankooplijst")');
    await page.waitForSelector('text=Atlas van niets');
    verwacht(!(await page.$('#sectie button:has-text("Verwijder")')) && !(await page.$('text=Aanduiden voor aankoop')) && !(await page.$('text=Lijst van bol.com inlezen')), 'Een vrijwilliger ziet bestuursknoppen');
    await page.fill('#ak-titel', 'Een verzonnen nieuw boek');
    await page.fill('#ak-reden', 'Gevraagd aan de balie');
    await page.click('button:has-text("Zet op de aankooplijst")');
    await page.waitForSelector('text=staat op de aankooplijst. Dank je!');
    const v = vragen.filter((x) => x.actie === 'aankoopToevoegen').pop();
    verwacht(v && v.titel === 'Een verzonnen nieuw boek' && v.reden === 'Gevraagd aan de balie', 'Doorgestuurd: ' + JSON.stringify(v));
    await page.click('#sectie button:has-text("In de catalogus (1)")');
    verwacht(/In de catalogus als B0003/.test(await page.textContent('#sectie')), 'Binnen-lijst');
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('aankooplijst: het bestuur leest bol.com in, duidt aan en trekt een lijst', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'bestuur' });
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await meldAan(page, basis, 'bestuur.html');
    await page.click('#sectienav button:has-text("Aankooplijst")');
    await page.waitForSelector('text=1 boek aangeduid voor aankoop');
    verwacht((await page.textContent('#ak-totaal')) === '2 boeken te kopen, samen € 19,99 (1 boek nog zonder prijs).', 'Totaal: ' + await page.textContent('#ak-totaal'));
    // Aanduiden
    await page.check('#ak-kies-K0001');
    await page.waitForSelector('text=2 boeken aangeduid voor aankoop');
    verwacht(vragen.some((x) => x.actie === 'aankoopAanpassen' && x.aankoop_id === 'K0001' && x.gekozen === true), 'Aanduiden stuurt niets door');
    // bol.com inlezen: wat al in de catalogus staat, is niet aangevinkt.
    await page.click('summary:has-text("Lijst van bol.com inlezen")');
    // Hier op de bladwijzer klikken doet niets, behalve uitleggen dat je hem moet slepen.
    await page.click('#ak-bladwijzer-link');
    await page.waitForSelector('text=Sleep deze knop naar je bladwijzerbalk');
    // De bladwijzer op een (nagebootste) lijst bij bol.com: leest de boekpagina's en kopieert.
    const code = decodeURIComponent((await page.getAttribute('#ak-bladwijzer-link', 'href')).slice('javascript:'.length));
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://www.bol.com' });
    await ctx.route('https://www.bol.com/**', (r) => {
      const u = r.request().url();
      const body = /lijst/.test(u) ? '<html><body><a href="/nl/nl/p/nieuwe-roman/9300000111111111/?x=1">Nieuwe roman</a><a href="/nl/nl/p/nieuwe-roman/9300000111111111/">dubbel</a><a href="/nl/nl/p/stille-lichten/9300000222222222/">Stille lichten</a></body></html>'
        : /nieuwe-roman/.test(u) ? '<html><head><script type="application/ld+json">{"@type":"Product","name":"Nieuwe verzonnen roman","gtin13":"9780306406157","offers":{"price":"21.50"}}</script></head><body>' + 'x'.repeat(5000) + '</body></html>'
        : '<html><head><meta property="og:title" content="Stille lichten | bol"></head><body>EAN</dt><dd>9781861972712</body></html>';
      r.fulfill({ contentType: 'text/html', body });
    });
    const bol = await ctx.newPage();
    await bol.goto('https://www.bol.com/nl/nl/lijst/verzonnen');
    await bol.evaluate(code);
    await bol.waitForSelector('text=Madrigal las 2 van de 2 boeken');
    await bol.click('button:has-text("Kopieer voor Madrigal")');
    await bol.waitForSelector('text=Gekopieerd!');
    const gekopieerd = await bol.evaluate(() => navigator.clipboard.readText());
    verwacht(/^MADRIGAL1\[/.test(gekopieerd) && gekopieerd.includes('9780306406157') && gekopieerd.includes('og:title') && gekopieerd.length < 3000, 'Gekopieerd: ' + gekopieerd.slice(0, 200));
    await bol.close();
    await page.fill('#ak-bladwijzer', 'iets anders');
    await page.fill('#ak-bladwijzer', gekopieerd);
    await page.click('button:has-text("Lees in")');
    await page.waitForSelector('text=2 boeken gelezen');
    const lees = vragen.filter((x) => x.actie === 'aankoopLezen').pop();
    verwacht(lees && lees.bladwijzer === gekopieerd, 'Niet doorgestuurd');
    verwacht(await page.isChecked('#ak-lees-0') && !(await page.isChecked('#ak-lees-1')), 'Vinkjes na het inlezen');
    await page.click('button:has-text("Zet de aangevinkte op de aankooplijst")');
    await page.waitForSelector('text=1 boek staat nu op de aankooplijst.');
    const imp = vragen.filter((x) => x.actie === 'aankoopImporteren').pop();
    verwacht(imp && imp.boeken.length === 1 && imp.boeken[0].isbn === '9780306406157', 'Importeren: ' + JSON.stringify(imp));
    // Lijst trekken
    await page.click('button:has-text("Trek de aankooplijst")');
    await page.waitForSelector('text=Aankooplijst trekken');
    verwacht(/Gedichten van niemand/.test(await page.textContent('#sectie table')) && /Totaal \(1 boek\)/.test(await page.textContent('#sectie table')), 'Tabel: ' + await page.textContent('#sectie table'));
    const csv = await page.evaluate(() => window.MadrigalAankoop.csvTekst([{ t: 'Atlas; van niets', a: 'Bedacht, Noor', i: '9781861972712', g: 'Fictie', p: 19.99, l: '', w: 'Sam' }]));
    verwacht(csv.split('\r\n')[1] === '"Atlas; van niets";Bedacht, Noor;\'9781861972712;Fictie;19,99;;Sam', 'CSV: ' + csv);
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Download als CSV")')]);
    verwacht(/^aankooplijst-\d{4}-\d{2}-\d{2}\.csv$/.test(download.suggestedFilename()), 'Bestandsnaam: ' + download.suggestedFilename());
    verwacht(!(await axe(page)).length, 'Toegankelijkheid: ' + (await axe(page)).join(' | '));
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('cover via een link: plakken en bewaren', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'vrijwilliger' });
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await meldAan(page, basis, 'vrijwilliger.html');
    await page.click('#sectienav button:has-text("Boeken zonder cover")');
    await page.click('#sectie [data-id]');
    await page.fill('#bb-cover-link', 'https://winkel.test/boek/1');
    await page.click('button:has-text("Gebruik deze link")');
    await page.waitForSelector('text=De afbeelding is de cover van');
    verwacht(vragen.some((v) => v.actie === 'beheerCoverVanLink' && v.url === 'https://winkel.test/boek/1'), 'Link niet verstuurd');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });
  await test('uitleenscherm: checklist, handleiding en de knop English', async () => {
    const { ctx, page, fouten } = await nieuweContext(browser, { rol: 'balie' });
    await meldAan(page, basis, 'balie.html');
    await page.click('#werkvlak button:has-text("Checklist")');
    verwacht(/Bij het openen[\s\S]*Licht aan[\s\S]*Bij het sluiten/.test(await page.textContent('#werkvlak')), 'Checklist aan de balie');
    await page.click('button:has-text("← Terug naar het menu")');
    await page.click('#werkvlak button:has-text("Handleiding")');
    verwacht(/De sleutel/.test(await page.textContent('#werkvlak')), 'Handleiding aan de balie');
    // Een gemarkeerde lener: neutrale melding, uitlenen kan niet, geen reden te zien.
    await page.click('button:has-text("← Terug naar het menu")');
    await page.click('#werkvlak nav button:has-text("Uitlenen")');
    await page.fill('#uit-lener', 'Robin');
    await page.click('#werkvlak .keuzeknop:has-text("Robin")');
    verwacht(/Vraag vriendelijk om contact op te nemen met het bestuur/.test(await page.textContent('#werkvlak')), 'Neutrale melding ontbreekt');
    verwacht(await page.isDisabled('button:has-text("Bevestig de uitlening")'), 'Uitlenen kan nog');
    // Verlengen met een andere datum.
    const vragen = [];
    page.on('request', (q) => { if (q.method() === 'POST') vragen.push(JSON.parse(q.postData() || '{}')); });
    await page.click('button:has-text("← Terug naar het menu")');
    await page.click('#werkvlak nav button:has-text("Verlengen")');
    await page.fill('#verleng-zoek', 'verzonnen');
    await page.click('#werkvlak .keuzeknop');
    // De uitlening is al te laat: het voorstel telt 4 weken vanaf vandaag, niet vanaf de oude datum.
    const voorstel = new Date(Date.now() + 28 * 864e5).toISOString().slice(0, 10);
    verwacht((await page.inputValue('#verleng-datum')) === voorstel, 'Voorgestelde datum: ' + (await page.inputValue('#verleng-datum')));
    await page.fill('#verleng-datum', '2026-11-27');
    await page.click('button:has-text("Bevestig de verlenging")');
    await page.waitForSelector('text=Verlengd');
    verwacht(vragen.some((v) => v.actie === 'verlengen' && v.tot === '2026-11-27'), 'Gekozen datum niet verstuurd');
    await page.click('button:has-text("Klaar")');
    await page.click('#werkvlak button:has-text("Handleiding")');
    await page.click('.taal-knop');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.click('#werkvlak button:has-text("English")');
    verwacht(/The key/.test(await page.textContent('#werkvlak')), 'Handleiding in het Engels');
    await page.click('button:has-text("← Back to the menu")');
    const menu = await page.$$eval('#werkvlak nav button', (b) => b.map((x) => x.textContent.replace(/^\W+/, '').trim()));
    verwacht(['Lending', 'Return', 'Extend', 'Reserve', 'Look up a borrower', 'New borrower', 'Schedule', 'Checklist', 'Manual'].every((k) => menu.indexOf(k) > -1), 'Menu in het Engels: ' + menu.join(', '));
    verwacht(/Lending screen/.test(await page.textContent('h1')), 'Titel in het Engels');
    await page.click('#werkvlak nav button:has-text("New borrower")');
    await page.waitForSelector('text=Made-up privacy text.');
    await page.click('button:has-text("Back to the menu")');
    await Promise.all([page.waitForNavigation(), page.click('.taal-knop')]);
    await page.waitForSelector('#werkvlak nav button');
    verwacht(/Uitlenen/.test(await page.textContent('#werkvlak')), 'Terug naar het Nederlands');
    await ctx.close();
    verwacht(!fouten.length, fouten.join(' | '));
  });

  await browser.close();
  server.close();
  console.log('\n' + geslaagd + ' geslaagd, ' + mislukt + ' mislukt');
  process.exit(mislukt ? 1 : 0);
})();
