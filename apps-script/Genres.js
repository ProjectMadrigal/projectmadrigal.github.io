/**
 * Genres.js
 * Genres en thema's opkuisen: dezelfde naam in verschillende schrijfwijzen wordt één naam.
 *
 *   - Thema's (filtergroepen in Onderwerpen, extra_onderwerpen in de Catalogus): "fictie", "FICTIE" en "Fictie"
 *     worden de schrijfwijze van de website (FILTERGROEPEN). Een eigen thema krijgt de meest gebruikte schrijfwijze,
 *     met een hoofdletter vooraan. Dat gebeurt meteen bij het toepassen, het is altijd veilig.
 *   - Genres (kolom genre in de Catalogus en in Onderwerpen): varianten worden één genre. Varianten zijn: hoofdletters,
 *     enkelvoud en meervoud (romans, roman), accenten (poezie, poëzie), x of ks (sexualiteit, seksualiteit), en een
 *     tikfout van een letter of twee. Het script voert dat meteen uit. Het tabblad "Genres opkuisen" en het Logboek
 *     tonen achteraf wat veranderde.
 *   - Bij het samenvoegen krijgt het genre in Onderwerpen de thema's van alle varianten samen.
 */

var GENRES_TABBLAD = 'Genres opkuisen';

// Schrijfwijzen die altijd zo moeten: genre (zoals genreSleutel het maakt) -> correcte schrijfwijze. Vul gerust aan.
var GENRE_SCHRIJFWIJZE_LIJST = {
  'poezie': 'Poëzie', 'seksualiteit': 'Seksualiteit', 'biografie': 'Biografie', 'autobiografie': 'Autobiografie',
  'feminisme': 'Feminisme', 'young adult': 'Young adult', 'graphic novel': 'Graphic novel', 'non fictie': 'Non-fictie',
  'nonfictie': 'Non-fictie', 'bdsm': 'BDSM', 'lgbt': 'LGBT', 'lgbtq': 'LGBTQ', 'lgbtqia': 'LGBTQIA+', 'lhbt': 'LHBT'
};
var GENRE_SCHRIJFWIJZE_CACHE = null;
/** De vaste schrijfwijze van een genre uit GENRE_SCHRIJFWIJZE_LIJST, of ''. */
function genreVast(genre) {
  if (!GENRE_SCHRIJFWIJZE_CACHE) {
    GENRE_SCHRIJFWIJZE_CACHE = {};
    Object.keys(GENRE_SCHRIJFWIJZE_LIJST).forEach(function (k) { GENRE_SCHRIJFWIJZE_CACHE[genreSleutel(k)] = GENRE_SCHRIJFWIJZE_LIJST[k]; });
  }
  return GENRE_SCHRIJFWIJZE_CACHE[genreSleutel(genre)] || '';
}

/** Een woord zonder meervoud en met enkele klinkers: zo vallen roman/romans en verhaal/verhalen samen. */
function genreWoordStam(w) {
  if (w.length > 6 && /ieen$/.test(w)) w = w.slice(0, -2);        // biografieen -> biografie
  else if (w.length > 5 && /en$/.test(w)) w = w.slice(0, -2);     // gedichten -> gedicht, verhalen -> verhal
  else if (w.length > 4 && /s$/.test(w) && !/(ss|is|us)$/.test(w)) w = w.slice(0, -1); // romans -> roman
  return w.replace(/aa/g, 'a').replace(/ee/g, 'e').replace(/oo/g, 'o').replace(/uu/g, 'u').replace(/(.)\1/g, '$1');
}

/** De sleutel om genres te vergelijken: kleine letters, zonder accenten, x = ks, zonder meervoud. */
function genreSleutel(genre) {
  return normaliseerTekst(String(genre || '').replace(/x/gi, 'ks')).split(' ').filter(Boolean).map(genreWoordStam).join(' ');
}

/** Een mooie schrijfwijze: hoofdletter vooraan, de rest zoals de meest gebruikte variant, korte afkortingen blijven groot. */
function genreMooi(genre) {
  var vast = genreVast(genre);
  if (vast) return vast;
  var t = schoon(genre);
  // Alles in hoofdletters (behalve een afkorting): naar kleine letters.
  if (t.length > 5 && t === t.toUpperCase()) t = t.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** De juiste schrijfwijze van een thema: die van de website, anders de meest gebruikte. telling: { sleutel: { schrijfwijze: aantal } }. */
function themaMooi(thema, telling) {
  var k = normaliseerTekst(thema);
  var standaard = FILTERGROEPEN.filter(function (f) { return normaliseerTekst(f) === k; })[0];
  if (standaard) return standaard;
  var vormen = telling && telling[k] ? Object.keys(telling[k]) : [schoon(thema)];
  var beste = vormen.sort(function (a, b) { return telling[k][b] - telling[k][a] || (b === genreMooi(b) ? 1 : 0) - (a === genreMooi(a) ? 1 : 0); })[0];
  return genreMooi(beste);
}

/** Telt hoe vaak elke schrijfwijze van een thema voorkomt, in Onderwerpen en de Catalogus. */
function themaTelling(onderwerpRijen, catalogus) {
  var telling = {};
  var tel = function (w) { var k = normaliseerTekst(w); if (!k) return; telling[k] = telling[k] || {}; telling[k][w] = (telling[k][w] || 0) + 1; };
  onderwerpRijen.forEach(function (r) { splitsLijst(r.filtergroepen).forEach(tel); });
  catalogus.forEach(function (b) { splitsLijst(b.extra_onderwerpen).forEach(tel); });
  return telling;
}

/** Een lijst thema's in de juiste schrijfwijze, zonder dubbels. */
function themasMooi(waarde, telling) {
  var uit = [];
  splitsLijst(waarde).forEach(function (t) {
    var m = themaMooi(t, telling);
    if (uit.indexOf(m) === -1) uit.push(m);
  });
  return uit.join(', ');
}

/**
 * De voorstellen voor de genres: groepen van varianten met één naam. Geeft [{ genre_nu, aantal_boeken, genre_nieuw,
 * toepassen }] voor elk genre dat een andere naam krijgt, gesorteerd op de nieuwe naam.
 */
function genreVoorstellen(onderwerpRijen, catalogus) {
  var tel = {};
  catalogus.forEach(function (b) { if (!isFilm(b) && !isLeeg(b.genre)) { var g = schoon(b.genre); tel[g] = (tel[g] || 0) + 1; } });
  onderwerpRijen.forEach(function (r) { var g = schoon(r.genre); if (g && !tel[g]) tel[g] = 0; });
  // Groepen op sleutel.
  var groepen = {};
  Object.keys(tel).forEach(function (g) { var k = genreSleutel(g); (groepen[k] = groepen[k] || []).push(g); });
  // Tikfouten: een groep met weinig boeken die bijna gelijk is aan een grotere groep, gaat daarin op.
  var sleutels = Object.keys(groepen).sort(function (a, b) { return totaal(groepen[b]) - totaal(groepen[a]); });
  function totaal(lijst) { return lijst.reduce(function (s, g) { return s + tel[g]; }, 0); }
  sleutels.forEach(function (k, i) {
    if (!groepen[k]) return;
    for (var j = 0; j < i; j++) {
      var groot = sleutels[j];
      if (!groepen[groot] || groot === k) continue;
      var max = Math.min(k.length, groot.length) >= 8 ? 2 : Math.min(k.length, groot.length) >= 5 ? 1 : 0;
      if (max && levenshtein(k, groot) <= max) { groepen[groot] = groepen[groot].concat(groepen[k]); delete groepen[k]; return; }
    }
  });
  var uit = [];
  Object.keys(groepen).forEach(function (k) {
    var lijst = groepen[k];
    // De naam: de meest gebruikte variant, bij gelijkspel de kortste (het enkelvoud).
    var beste = lijst.slice().sort(function (a, b) { return tel[b] - tel[a] || a.length - b.length || a.localeCompare(b); })[0];
    var nieuw = genreMooi(beste);
    lijst.forEach(function (g) {
      if (g !== nieuw) uit.push({ genre_nu: g, aantal_boeken: tel[g], genre_nieuw: nieuw, toepassen: 'ja' });
    });
  });
  return uit.sort(function (a, b) { return a.genre_nieuw.localeCompare(b.genre_nieuw, 'nl') || a.genre_nu.localeCompare(b.genre_nu, 'nl'); });
}

/**
 * Past de opkuislijst toe. rijen: de rijen van Genres opkuisen (toepassen = ja). Daarna de thema's in de juiste
 * schrijfwijze. Geeft { genres: aantal hernoemde genres, boeken: aantal aangepaste boeken, themas: aantal aangepaste cellen }.
 */
function genresOpkuisen(onderwerpRijen, catalogus, rijen) {
  var naar = {};
  (rijen || []).forEach(function (r) {
    if (jaNee(r.toepassen) === 'ja' && !isLeeg(r.genre_nu) && !isLeeg(r.genre_nieuw)) naar[schoon(r.genre_nu)] = schoon(r.genre_nieuw);
  });
  var uit = { genres: Object.keys(naar).length, boeken: 0, themas: 0 };
  catalogus.forEach(function (b) {
    var nieuw = naar[schoon(b.genre)];
    if (nieuw && nieuw !== schoon(b.genre)) { wijzig(b, { genre: nieuw }); uit.boeken++; }
  });
  // Onderwerpen: de varianten samen in één rij, met de thema's van allemaal.
  var perNaam = {};
  onderwerpRijen.forEach(function (r) {
    if (r._verwijderen) return;
    var naam = naar[schoon(r.genre)] || schoon(r.genre);
    if (!naam) return;
    var doel = perNaam[naam];
    if (!doel) {
      perNaam[naam] = r;
      if (naam !== schoon(r.genre)) wijzig(r, { genre: naam });
      return;
    }
    var samen = splitsLijst(doel.filtergroepen);
    splitsLijst(r.filtergroepen).forEach(function (f) { if (samen.indexOf(f) === -1) samen.push(f); });
    wijzig(doel, { filtergroepen: samen.join(', ') });
    markeerVerwijderen(r);
  });
  // Thema's in de juiste schrijfwijze.
  var telling = themaTelling(onderwerpRijen.filter(function (r) { return !r._verwijderen; }), catalogus);
  onderwerpRijen.forEach(function (r) {
    if (r._verwijderen) return;
    var m = themasMooi(r.filtergroepen, telling);
    if (m !== splitsLijst(r.filtergroepen).join(', ')) { wijzig(r, { filtergroepen: m }); uit.themas++; }
  });
  catalogus.forEach(function (b) {
    if (isLeeg(b.extra_onderwerpen)) return;
    var m = themasMooi(b.extra_onderwerpen, telling);
    if (m !== splitsLijst(b.extra_onderwerpen).join(', ')) { wijzig(b, { extra_onderwerpen: m }); uit.themas++; }
  });
  return uit;
}

/* ---------- In Apps Script ---------- */

/**
 * Menu: genres en thema's meteen opkuisen. Het tabblad Genres opkuisen toont achteraf welke genres een andere naam kregen
 * (een overzicht, geen nakijklijst).
 */
function kuisGenresOp() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit, voorstellen;
  try {
    var catalogus = leesTabel('Catalogus');
    var onderwerpen = leesTabel('Onderwerpen');
    voorstellen = genreVoorstellen(onderwerpen.rijen, catalogus.rijen);
    uit = genresOpkuisen(onderwerpen.rijen, catalogus.rijen, voorstellen);
    schrijfKolommen(catalogus, ['genre', 'extra_onderwerpen']);
    bewaarTabel(onderwerpen);
  } finally {
    lock.releaseLock();
  }
  werkOnderwerpenBij(); // de aantallen in Onderwerpen opnieuw tellen
  leegCache();
  // Overzicht van wat veranderde.
  var ss = spreadsheet();
  var blad = ss.getSheetByName(GENRES_TABBLAD) || ss.insertSheet(GENRES_TABBLAD);
  blad.clear();
  blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
  var kop = ['genre_vroeger', 'aantal_boeken', 'genre_nu'];
  var waarden = [kop].concat(voorstellen.map(function (r) { return [r.genre_nu, r.aantal_boeken, r.genre_nieuw]; }));
  blad.getRange(1, 1, waarden.length, kop.length).setValues(waarden);
  opmaakKop(blad, kop.length);
  var tekst = uit.genres + ' genres samengevoegd of in de juiste schrijfwijze gezet, ' + uit.boeken + ' boeken aangepast, ' +
    uit.themas + ' cellen met thema\'s in de juiste schrijfwijze. Het tabblad ' + GENRES_TABBLAD + ' toont welke genres veranderden.';
  logboek('menu', 'kuisGenresOp', tekst + (voorstellen.length ? ' ' + voorstellen.map(function (r) { return r.genre_nu + ' > ' + r.genre_nieuw; }).join('; ') : ''));
  meld(tekst + ' De website toont het binnen enkele minuten.');
}
