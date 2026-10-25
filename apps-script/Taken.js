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
    ['zoekCoversBol', 'Covers bij Bol', heeftBolNodig],
    ['vulFilmsAan', 'Films aanvullen (Wikidata en Wikipedia)', heeftFilmGegevensNodig]
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

/**
 * Onthoudt wanneer de daglimiet van Google voor vragen naar buiten op was. In de eigenschappen van
 * het script (die vervallen niet, zoals de cache na 6 uur), zodat de voorrang van de films ook na
 * die 6 uur nog werkt.
 */
function noteerDaglimiet() {
  try { PropertiesService.getScriptProperties().setProperty(DAGLIMIET_SLEUTEL, String(Date.now())); } catch (e) { /* niet erg */ }
  try { CacheService.getScriptCache().put(DAGLIMIET_SLEUTEL, String(Date.now()), 6 * 60 * 60); } catch (e) { /* niet erg */ }
}

/** Sinds wanneer (ms) de daglimiet op is, of 0. Een oudere melding in de cache telt ook. */
function daglimietSinds() {
  var props = PropertiesService.getScriptProperties();
  var sinds = Number(props.getProperty(DAGLIMIET_SLEUTEL)) || 0;
  var uitCache = 0;
  try { uitCache = Number(CacheService.getScriptCache().get(DAGLIMIET_SLEUTEL)) || 0; } catch (e) { uitCache = 0; }
  if (uitCache > sinds) { props.setProperty(DAGLIMIET_SLEUTEL, String(uitCache)); sinds = uitCache; }
  return sinds;
}

/*
 * De daglimiet van Google (UrlFetch): een gratis account mag per dag maar een beperkt aantal vragen
 * naar buiten sturen. De achtergrondtaken gebruiken er veel zolang er nog veel boeken op te zoeken zijn.
 * Is de limiet op, dan:
 *   - wacht elke taak 6 uur en gaat dan vanzelf verder (geen stilstaande taak meer);
 *   - telt een mislukte vraag nooit als "niets gevonden": het boek komt later opnieuw aan de beurt;
 *   - toont het rooster de laatst opgehaalde versie.
 */
var DAGLIMIET_WACHT_MS = 6 * 60 * 60 * 1000;
// Na de daglimiet krijgen de films voorrang: de andere taken herstarten een half uur later.
// Zo raakt de limiet niet opnieuw op voor de films aan de beurt zijn (die vragen maar weinig).
var VOORRANG_TAKEN = ['vulFilmsAan'];
var VOORRANG_MS = 30 * 60 * 1000;

/** Na hoeveel ms een taak herstart als de daglimiet nog zo lang (wacht) duurt. */
function herstartNaDaglimiet(naam, wacht) {
  return wacht + (VOORRANG_TAKEN.indexOf(naam) > -1 ? 0 : VOORRANG_MS);
}

/** Hoe lang deze taak nog moet wachten (ms) na een daglimiet die om "sinds" genoteerd werd. 0: meteen. */
function wachtVoorTaak(naam, sinds, nu) {
  sinds = Number(sinds) || 0;
  return sinds ? Math.max(0, herstartNaDaglimiet(naam, sinds + DAGLIMIET_WACHT_MS) - nu) : 0;
}
var HUIDIGE_TAAK = ''; // de achtergrondtaak die nu loopt (zie startAchtergrond)

/** Is deze fout de daglimiet van Google? */
function isDaglimietFout(e) {
  return /te vaak|too many times/i.test(String(e && e.message || e || ''));
}

/** Hoeveel ms nog wachten na een daglimiet die om "sinds" (ms) genoteerd werd. 0: niet meer wachten. */
function daglimietWachttijd(sinds, nu) {
  sinds = Number(sinds) || 0;
  return sinds ? Math.max(0, sinds + DAGLIMIET_WACHT_MS - nu) : 0;
}

/** Vraag naar buiten (zoals UrlFetchApp.fetch). Bij de daglimiet: noteren en de lopende taak over 6 uur herstarten. */
function haalExtern(url, opties) {
  try {
    return UrlFetchApp.fetch(url, opties);
  } catch (e) {
    if (isDaglimietFout(e)) {
      noteerDaglimiet();
      if (HUIDIGE_TAAK) planTaak(HUIDIGE_TAAK, herstartNaDaglimiet(HUIDIGE_TAAK, DAGLIMIET_WACHT_MS));
    }
    throw e;
  }
}

function planTaak(naam, ms) {
  try {
    verwijderTriggers(naam);
    ScriptApp.newTrigger(naam).timeBased().after(Math.max(60 * 1000, ms)).create();
  } catch (e) { /* lukt het niet, dan start je de taak met de hand */ }
}

/**
 * Voor elke achtergrondtaak, helemaal vooraan: is de daglimiet nog op, dan start de taak niet
 * en plant ze zich opnieuw als de limiet voorbij is. Geeft true als de taak moet wachten.
 */
function wachtOpDaglimiet(naam) {
  var sinds = 0;
  try { sinds = daglimietSinds(); } catch (e) { return false; }
  var wacht = wachtVoorTaak(naam, sinds, Date.now());
  if (!wacht) return false;
  planTaak(naam, wacht);
  try { spreadsheet().toast('De daglimiet van Google voor vragen naar buiten is op. Deze taak gaat vanzelf verder over ' + Math.ceil(wacht / 3600000) + ' uur.', 'Madrigal', 15); } catch (e) { /* geen spreadsheet open */ }
  return true;
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
  var sinds = daglimietSinds();
  return { ok: true, taken: stand, logboek: regels, daglimiet: daglimietWachttijd(sinds, Date.now()) ? sinds : 0 };
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

/* ---------- Extra cijfers (bestuursscherm, onderdeel Cijfers) ---------- */

/**
 * Nieuwe leners per maand (laatste 12 maanden), boeken die nooit uitgeleend werden,
 * de gemiddelde uitleenduur en hoeveel leners het voorbije jaar iets leenden.
 * Enkel wat de privacy-opruiming nog niet wiste.
 */
function extraCijfers(staat) {
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), aantal: 0 };
  }
  staat.leners.forEach(function (l) {
    var maand = String(parseerDatum(l.datum_inschrijving) || '').slice(0, 7);
    if (perMaand[maand]) perMaand[maand].aantal++;
  });
  var geleend = {};
  var dagen = [];
  var jaarGeleden = telMaandenOp(staat.vandaag, -12);
  var actief = {};
  staat.uitleningen.forEach(function (u) {
    geleend[String(u.boek_id)] = true;
    var uit = parseerDatum(u.datum_uit), terug = parseerDatum(u.datum_terug);
    if (uit && terug) dagen.push(Math.round((Date.parse(terug) - Date.parse(uit)) / 86400000));
    if (uit && uit >= jaarGeleden) actief[String(u.lenersnummer)] = true;
  });
  var nooit = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && isUitleenbaar(b) && boekStatus(b) !== 'verloren' && !geleend[String(b.boek_id)];
  });
  var gemiddeld = dagen.length ? Math.round(dagen.reduce(function (a, b) { return a + b; }, 0) / dagen.length) : 0;
  return {
    nieuweLeners: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    nooitUitgeleend: nooit.length,
    nooitVoorbeelden: nooit.slice(0, 15).map(function (b) { return { boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur) }; }),
    gemiddeldeDagen: gemiddeld,
    afgesloten: dagen.length,
    actieveLeners: Object.keys(actief).length
  };
}

/* ---------- Meerdere boeken tegelijk aanpassen (bestuursscherm) ---------- */

var BULK_VELDEN = ['genre', 'extra_onderwerpen', 'status', 'aanrader', 'startpagina', 'publiek', 'uitleenbaar', 'klassieker'];

/** invoer: { ids: [boek_id, ...], veld, waarde }. Past elk boek aan zoals het boekformulier. */
function boekenBulk(staat, invoer) {
  var veld = String(invoer.veld || '');
  if (BULK_VELDEN.indexOf(veld) === -1) return { ok: false, fout: 'Dit veld kan je niet voor meerdere boeken tegelijk aanpassen.' };
  var ids = (invoer.ids || []).map(String).filter(function (id, i, alle) { return id && alle.indexOf(id) === i; });
  if (!ids.length) return { ok: false, fout: 'Kies eerst een of meer boeken.' };
  if (ids.length > 300) return { ok: false, fout: 'Kies hoogstens 300 boeken per keer.' };
  var gelukt = 0, fouten = [];
  ids.forEach(function (id) {
    var velden = {};
    velden[veld] = invoer.waarde;
    var r = boekAanpassen(staat, { boek_id: id, velden: velden });
    if (r.ok) gelukt++; else fouten.push(id + ': ' + r.fout);
  });
  return { ok: gelukt > 0, fout: gelukt ? '' : fouten.join(' '), gelukt: gelukt, fouten: fouten,
    tekst: gelukt + (gelukt === 1 ? ' boek' : ' boeken') + ' aangepast.' + (fouten.length ? ' Niet gelukt: ' + fouten.join(' ') : '') };
}
