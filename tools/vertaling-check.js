/**
 * vertaling-check.js
 * Toont welke vaste teksten van het vrijwilligersscherm en het uitleenscherm nog geen Engelse vertaling hebben in vertaal.js.
 * Gebruik: node tools/vertaling-check.js
 *
 * Het zoekt de teksten tussen enkele aanhalingstekens in de scripts van het scherm. Ook namen van
 * klassen of stukken van langere zinnen kunnen in de lijst staan: die mag je negeren.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BESTANDEN = ['vrijwilligers.js', 'bestuur.js', 'beheer.js', 'bestuur-beheer.js', 'dom.js', 'balie.js'];

global.window = {};
global.document = { querySelector: () => null, documentElement: {} };
global.localStorage = { getItem: () => '' };
require(path.join(ROOT, 'vertaal.js'));
const vertaal = window.MadrigalVertaal.vertaal;

const LETTER = /[A-Za-zÀ-ÿ]{3,}/;
const GEEN_TEKST = /madrigal_|\.js|\.html|\.csv|https?:|[{}<>=#_;\/]|^\W|\\u|^[a-z-]+:|:\($|\\n$/;

const ontbreekt = new Set();
BESTANDEN.forEach((f) => {
  const code = fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
  const re = /'((?:[^'\\\n]|\\.)*)'/g;
  let m;
  while ((m = re.exec(code))) {
    const t = m[1].replace(/\\'/g, "'");
    if (!LETTER.test(t) || GEEN_TEKST.test(t)) continue;
    if (/^[a-z][a-zA-Z0-9-]*$/.test(t)) continue; // namen in de code
    if (/^[a-z-]+( [a-z-]+){0,2} ?$/.test(t) && t.length < 26) continue; // klassen zoals 'knop tweede'
    if (/^[A-Z][A-Za-z]+$/.test(t) && !/[aeiou]/.test(t.slice(1))) continue; // afkortingen zoals NFD
    if (vertaal(t) === null) ontbreekt.add(f + ': ' + t);
  }
});

// Vaste tekst in de HTML van beide schermen.
['vrijwilliger.html', 'balie.html'].forEach((f) => {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const stukken = (html.match(/>([^<>]+)</g) || []).map((x) => x.slice(1, -1))
    .concat((html.match(/(?:aria-label|placeholder|title|alt)="([^"]+)"/g) || []).map((x) => x.replace(/^[^"]*"|"$/g, '')));
  stukken.forEach((x) => {
    const t = x.replace(/\s+/g, ' ').trim();
    if (LETTER.test(t) && vertaal(t) === null) ontbreekt.add(f + ': ' + t);
  });
});

if (!ontbreekt.size) {
  console.log('Alle vaste teksten hebben een vertaling.');
} else {
  console.log(ontbreekt.size + ' teksten zonder vertaling (voeg ze toe aan TEKST in vertaal.js):\n');
  [...ontbreekt].sort().forEach((t) => console.log('  ' + t));
}
