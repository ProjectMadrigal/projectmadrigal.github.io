/**
 * Taken.js
 * Voor het bestuursscherm (onderdeel Logboek en taken): hoe staan de achtergrondtaken ervoor,
 * en wat staat er laatst in het Logboek. Zo hoef je daarvoor de spreadsheet niet te openen.
 * Alles hier leest enkel. Er verandert niets in de spreadsheet.
 */

var LOGBOEK_REGELS = 60; // zoveel regels toont het bestuursscherm
var DAGLIMIET_SLEUTEL = 'daglimiet_urlfetch';

/** De achtergrondtaken: [functie, naam voor het scherm, welke boeken nog aan de beurt zijn]. */
function achtergrondTaken() {
  return [
    ['zoekBeschrijvingenWikipedia', 'Beschrijvingen bij Wikipedia', heeftWikiNodig],
    ['vulBeschrijvingenAan', 'Beschrijvingen aanvullen (Google, Open Library)', heeftBeschrijvingNodig],
    ['vertaalBeschrijvingen', 'Beschrijvingen vertalen naar het Engels', heeftVertalingNodig],
    ['vulAanUitGoogleBooks', 'Covers bij Google Books', heeftGoogleBooksNodig],
    ['vulAanUitOpenLibrary', 'Gegevens bij Open Library', heeftOpenLibraryNodig],
    ['zoekCoversAndereUitgaven', 'Covers van een andere uitgave', heeftAndereUitgaveNodig],
    ['zoekCoversInternetArchive', 'Covers bij Internet Archive', heeftIaNodig],
    ['zoekCoversBol', 'Covers bij Bol', heeftBolNodig]
  ];
}

/**
 * De stand per taak. rijen: de Catalogus. gepland: namen van functies met een geplande herstart.
 * bezig: { functie: tijdstip in ms } van de taken die nu lopen.
 */
function takenStand(taken, rijen, gepland, bezig) {
  return taken.map(function (t) {
    var teGaan = rijen.filter(function (r) { try { return !!t[2](r); } catch (e) { return false; } }).length;
    var status = bezig[t[0]] ? 'loopt' : gepland.indexOf(t[0]) > -1 ? 'gepland' : teGaan ? 'stil' : 'klaar';
    return { functie: t[0], naam: t[1], teGaan: teGaan, status: status, sinds: bezig[t[0]] || 0 };
  });
}

/** De laatste regels van het Logboek, nieuwste eerst (ook als oudere regels nog onderaan staan). */
function laatsteLogregels(waarden, aantal) {
  return waarden.slice(1).filter(function (r) { return r[0] || r[2]; }).map(function (r) {
    var tijd = isDatumObject(r[0]) ? r[0].getTime() : (Date.parse(r[0]) || 0);
    return { tijd: tijd, wie: String(r[1] || ''), actie: String(r[2] || ''), details: String(r[3] || '') };
  }).sort(function (a, b) { return b.tijd - a.tijd; }).slice(0, aantal);
}

/** Onthoudt 6 uur lang dat de daglimiet van Google voor vragen naar buiten op is. */
function noteerDaglimiet() {
  try { CacheService.getScriptCache().put(DAGLIMIET_SLEUTEL, String(Date.now()), 6 * 60 * 60); } catch (e) { /* niet erg */ }
}

/** Actie beheerLogboek (enkel het bestuur). */
function logboekEnTaken() {
  var cache = CacheService.getScriptCache();
  var taken = achtergrondTaken();
  var bezig = {};
  taken.forEach(function (t) {
    var w = cache.get('taak_' + t[0]);
    if (w) bezig[t[0]] = Number(w) || Date.now();
  });
  var gepland = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  var stand = takenStand(taken, leesTabel('Catalogus').rijen, gepland, bezig);
  var blad = spreadsheet().getSheetByName('Logboek');
  var regels = blad && blad.getLastRow() > 1 ? laatsteLogregels(blad.getDataRange().getValues(), LOGBOEK_REGELS) : [];
  return { ok: true, taken: stand, logboek: regels, daglimiet: Number(cache.get(DAGLIMIET_SLEUTEL)) || 0 };
}

/** Actie beheerCoverLinks: per boek de link naar de cover, voor de kleine covers in de lijsten van het bestuursscherm. */
function coverLinks(rijen) {
  var links = {};
  rijen.forEach(function (r) {
    var url = veiligeCoverUrl(r.cover_url);
    if (!isLeeg(r.boek_id) && url) links[String(r.boek_id)] = url;
  });
  return { ok: true, links: links };
}

/* ---------- Geschiedenis per boek en per lener (bestuursscherm) ---------- */

/** Hoe vaak werd dit boek uitgeleend, en wanneer laatst? */
function boekHistoriek(staat, boekId) {
  var eigen = staat.uitleningen.filter(function (u) { return String(u.boek_id) === String(boekId); });
  var laatst = eigen.map(function (u) { return parseerDatum(u.datum_uit); }).filter(Boolean).sort().pop() || '';
  return { keer: eigen.length, laatst: laatst };
}

/** De afgesloten uitleningen van een lener, nieuwste eerst (wat de privacy-opruiming nog niet wiste). */
function lenerHistoriek(staat, nummer) {
  var lijst = staat.uitleningen.filter(function (u) {
    return String(u.lenersnummer) === String(nummer) && !isLeeg(u.datum_terug);
  }).map(function (u) {
    var boek = boekVan(staat, u.boek_id);
    return { titel: boek ? schoon(boek.titel) : String(u.boek_id), exemplaar: String(u.exemplaar || ''),
      datum_uit: parseerDatum(u.datum_uit), datum_terug: parseerDatum(u.datum_terug) };
  }).sort(function (a, b) { return b.datum_uit.localeCompare(a.datum_uit); });
  return { ok: true, uitleningen: lijst.slice(0, 50), totaal: lijst.length };
}

/** De laatste wijzigingen aan een boek volgens het Logboek (waarden: het tabblad Logboek). */
function boekWijzigingen(waarden, boekId) {
  var id = String(boekId);
  return laatsteLogregels(waarden, waarden.length).filter(function (r) {
    return ['boek aangepast', 'boek toegevoegd', 'cover-foto'].indexOf(r.actie) > -1 &&
      (r.details === id || r.details.indexOf(id + ':') === 0 || r.details.indexOf(id + ' ') === 0);
  }).slice(0, 5);
}
