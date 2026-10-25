/**
 * laad.js
 * Laadt de Apps Script-bestanden en de zoek- en filterbestanden van de website
 * in een afgesloten omgeving, zodat de tests ze kunnen gebruiken zonder Google.
 * Alle gegevens in de tests zijn verzonnen.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/** Bestanden met logica die geen Google-diensten nodig heeft bij het laden. */
const SCRIPTS = [
  'apps-script/Hulp.js',
  'apps-script/Datums.js',
  'apps-script/Instellingen.js',
  'apps-script/Opslag.js',
  'apps-script/Catalogus.js',
  'apps-script/Goodreads.js',
  'apps-script/OpenLibrary.js',
  'apps-script/GoogleBooks.js',
  'apps-script/Beschrijvingen.js',
  'apps-script/Covers.js',
  'apps-script/Bol.js',
  'apps-script/Wikipedia.js',
  'apps-script/Films.js',
  'apps-script/Taken.js',
  'apps-script/Rooster.js',
  'apps-script/Ordenen.js',
  'apps-script/Grenzen.js',
  'apps-script/Uitlenen.js',
  'apps-script/Publiek.js',
  'apps-script/Site.js',
  'apps-script/Bestuur.js',
  'apps-script/Bezoekers.js',
  'apps-script/Peperfabriek.js',
  'apps-script/Bookclub.js',
  'apps-script/Beheer.js',
  'apps-script/Backup.js',
  'apps-script/Aanvragen.js',
  'apps-script/Vrijwilligers.js',
  'apps-script/Privacy.js',
  'apps-script/Overzetten.js',
  'apps-script/OudeSite.js',
  'apps-script/Api.js',
  'apps-script/Menu.js',
  'zoeken.js',
  'agenda.js',
  'filters.js'
];

/**
 * Laadt de code. Met de omgevingsvariabele BUNDEL=1 gebruiken de tests het
 * samengevoegde madrigal-script.gs in plaats van de losse bestanden, zodat we
 * zeker zijn dat ook dat bestand correct werkt.
 */
function laad() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  const lijst = process.env.BUNDEL === '1'
    ? ['madrigal-script.gs'].concat(SCRIPTS.filter((f) => f.indexOf('apps-script/') !== 0))
    : SCRIPTS;
  for (const bestand of lijst) {
    const code = fs.readFileSync(path.join(ROOT, bestand), 'utf8');
    vm.runInContext(code, context, { filename: bestand });
  }
  return context;
}

module.exports = { laad };
