/**
 * Site.js
 * De inhoud van de startpagina: nieuws, agenda, veelgestelde vragen, aanraders
 * en de contactgegevens. Het bestuur beheert die in de tabbladen Nieuws, Agenda
 * en Veelgestelde vragen, en in Instellingen (adres, openingsuren, mailadressen).
 *
 * Publiek eindpunt: ?actie=site
 * Een rij met "nee" in de kolom publiek verschijnt niet op de website.
 * De kolommen op _en zijn de Engelse versie. Leeg? Dan toont de site het Nederlands.
 */

var SITE_CACHE_SLEUTEL = 'site_v3'; // v3: met de teksten van de pagina Doe mee
var SITE_MAX_NIEUWS = 3;
var SITE_MAX_AANRADERS = 12;

/** Een tekst in beide talen. Lege Engelse versie: de Nederlandse. */
function tweetalig(rij, veld) {
  var nl = schoon(rij[veld]);
  return { nl: nl, en: schoon(rij[veld + '_en']) || nl };
}

/** Een tekst met meerdere regels: enkel spaties aan begin en einde weg. */
function tweetaligLang(rij, veld) {
  var nl = String(rij[veld] || '').trim();
  return { nl: nl, en: String(rij[veld + '_en'] || '').trim() || nl };
}

function isPubliek(rij) {
  return jaNee(rij.publiek) !== 'nee';
}

/**
 * Bouwt de inhoud van de startpagina (zonder de spreadsheet aan te raken).
 * tabellen: { nieuws, agenda, faq } met de rijen van die tabbladen.
 * staat: zoals in Uitlenen.js (voor de aanraders en hun beschikbaarheid).
 */
function bouwSiteInhoud(staat, tabellen) {
  var inst = staat.inst;

  // online_vanaf: gepland bericht, pas zichtbaar vanaf die dag.
  var nieuws = (tabellen.nieuws || []).filter(function (r) {
    var vanaf = parseerDatum(r.online_vanaf);
    return isPubliek(r) && (r.titel || r.tekst) && (!vanaf || vanaf <= staat.vandaag);
  })
    .sort(function (a, b) { return String(b.datum || '').localeCompare(String(a.datum || '')); })
    .slice(0, SITE_MAX_NIEUWS)
    .map(function (r) {
      return { datum: parseerDatum(r.datum), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link) };
    });

  var events = (tabellen.agenda || []).filter(function (r) { return isPubliek(r) && parseerDatum(r.datum) && r.titel; })
    .map(function (r) {
      return {
        datum: parseerDatum(r.datum), uur: schoon(r.uur), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'),
        locatie: schoon(r.locatie), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link)
      };
    });
  var komend = events.filter(function (e) { return e.datum >= staat.vandaag; }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
  var voorbij = events.filter(function (e) { return e.datum < staat.vandaag; }).sort(function (a, b) { return b.datum.localeCompare(a.datum); });

  var faq = (tabellen.faq || []).filter(function (r) { return isPubliek(r) && r.vraag; })
    .sort(function (a, b) { return (parseerGetal(a.volgorde) || 999) - (parseerGetal(b.volgorde) || 999); })
    .map(function (r) { return { vraag: tweetalig(r, 'vraag'), antwoord: tweetaligLang(r, 'antwoord') }; });

  // Aanraders op de startpagina. Een boek staat erop als:
  //   - de kolom startpagina "ja" is, of
  //   - iemand het aanraadt (namen uit aanraders_verbergen tellen niet mee).
  // Beschikbare boeken eerst, daarna willekeurig maar vast per week: elke maandag een nieuwe keuze.
  // Nieuw binnen is een aparte lijst (zie verder): zo verdringen de aanraders de nieuwe boeken nooit.
  // "nee" in de kolom startpagina haalt een boek er altijd af.
  // Een boek met gevoelige inhoud komt er enkel op met "ja" in de kolom startpagina.
  var verborgen = splitsLijst(inst.aanraders_verbergen).map(normaliseerTekst);
  var dagenNieuw = parseerGetal(inst.nieuw_op_startpagina_dagen);
  if (dagenNieuw === null) dagenNieuw = 60;
  var isNieuw = function (b) {
    var d = parseerDatum(b.toegevoegd_op);
    if (!d || dagenNieuw <= 0) return false;
    var dagen = dagenTussen(d, staat.vandaag);
    return dagen >= 0 && dagen < dagenNieuw;
  };
  var kandidaten = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && opWebsite(b) && jaNee(b.startpagina) !== 'nee';
  });
  var startpaginaBoek = function (b) {
    var bs = beschikbaarheid(staat, b);
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), c: veiligeCoverUrl(b.cover_url),
      s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : 'boek',
      r: splitsLijst(String(b.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
        return verborgen.indexOf(normaliseerTekst(naam)) === -1;
      }),
      n: isNieuw(b) ? 1 : 0,
      zelf: jaNee(b.startpagina) === 'ja',
      gevoelig: boekStatus(b) === 'gevoelig_zichtbaar',
      vrij: bs.code === 'beschikbaar',
      volgorde: dagVolgorde(String(b.boek_id), weekBegin(staat.vandaag)),
      toegevoegd: parseerDatum(b.toegevoegd_op) || ''
    };
  };
  var opruimen = function (b) { delete b.volgorde; delete b.zelf; delete b.toegevoegd; if (b.gevoelig) b.w = 1; delete b.gevoelig; return b; };
  var aanraders = kandidaten.map(startpaginaBoek)
    .filter(function (b) { return b.zelf || (!b.gevoelig && b.r.length); })
    .sort(function (a, b) { return (b.vrij - a.vrij) || (a.volgorde - b.volgorde); })
    .slice(0, SITE_MAX_AANRADERS)
    .map(opruimen);

  // Nieuw binnen: de laatst toegevoegde boeken, nieuwste eerst.
  var aantalNieuw = parseerGetal(inst.nieuw_op_startpagina_aantal);
  if (aantalNieuw === null) aantalNieuw = 8;
  // Zijn er minder nieuwe boeken dan het aantal, dan vullen we aan met de laatst
  // gecatalogiseerde boeken: het hoogste boek-ID kwam het laatst in de Catalogus.
  // Zo is de sectie nooit leeg, ook niet net na de eerste opbouw (toen kreeg geen
  // enkel boek een datum in toegevoegd_op). 0 dagen: Nieuw binnen staat uit.
  var nieuwsteEerst = function (a, b) { return b.toegevoegd.localeCompare(a.toegevoegd) || idNummer(b.id) - idNummer(a.id); };
  var nieuwBinnen = [];
  if (dagenNieuw > 0) {
    var toonbaar = kandidaten.map(startpaginaBoek).filter(function (b) { return b.zelf || !b.gevoelig; });
    nieuwBinnen = toonbaar.filter(function (b) { return b.n; }).sort(nieuwsteEerst);
    if (nieuwBinnen.length < aantalNieuw) {
      nieuwBinnen = nieuwBinnen.concat(toonbaar.filter(function (b) { return !b.n; }).sort(nieuwsteEerst));
    }
    nieuwBinnen = nieuwBinnen.slice(0, Math.max(0, aantalNieuw)).map(opruimen);
  }

  return {
    bijgewerkt: staat.vandaag,
    contact: {
      adres: String(inst.adres || ''), openingsuren: { nl: String(inst.openingsuren || ''), en: String(inst.openingsuren_en || '') || String(inst.openingsuren || '') },
      mail_algemeen: inst.mail_algemeen, mail_events: inst.mail_events
    },
    nieuws: nieuws,
    agenda: { komend: komend.slice(0, 3), vorig: voorbij[0] || null },
    faq: faq,
    aanraders: aanraders,
    nieuw: nieuwBinnen,
    // Het menu-item Leeslijsten: enkel als de instelling leeslijsten_tonen op ja staat.
    leeslijsten: inst.leeslijsten_tonen === true || (tabellen.leeslijsten || []).some(function (r) {
      var z = leeslijstZichtbaar(r, staat.vandaag, false);
      return z.gepland && z.zichtbaar;
    }),
    // Pagina Doe mee. Een leeg blok toont de website niet.
    doeMee: {
      vrijwilliger: { nl: String(inst.tekst_vrijwilliger || ''), en: String(inst.tekst_vrijwilliger_en || '') || String(inst.tekst_vrijwilliger || '') },
      schenken: { nl: String(inst.tekst_schenken || ''), en: String(inst.tekst_schenken_en || '') || String(inst.tekst_schenken || '') },
      steunen: { nl: String(inst.tekst_steunen || ''), en: String(inst.tekst_steunen_en || '') || String(inst.tekst_steunen || '') }
    }
  };
}

/** Het getal in een boek-ID: B0123 wordt 123. */
function idNummer(id) {
  return Number(String(id).replace(/\D/g, '')) || 0;
}

/** De maandag van de week van een datum ("JJJJ-MM-DD"). Zo wisselen de aanraders elke week. */
function weekBegin(datum) {
  var terug = (weekdag(datum) + 6) % 7; // maandag 0, zondag 6
  return telDagenOp(datum, -terug);
}

/** Een getal dat per boek en per periode anders is: zo wisselt de keuze van de aanraders. */
function dagVolgorde(id, dag) {
  // FNV-1a met een eindmenging: een kleine wijziging in de datum geeft een heel andere volgorde.
  var tekst = id + '|' + dag;
  var h = 2166136261;
  for (var i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** De inhoud van de startpagina als JSON-tekst, uit de cache als die er is. */
function siteInhoudJson() {
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(dagSleutel(SITE_CACHE_SLEUTEL));
  if (bewaard) return bewaard;
  var staat = laadStaat('publiek', false);
  var lees = function (naam) {
    return spreadsheet().getSheetByName(naam) ? leesTabel(naam).rijen : [];
  };
  var tekst = JSON.stringify(bouwSiteInhoud(staat, { nieuws: lees('Nieuws'), agenda: lees('Agenda'), faq: lees('Veelgestelde vragen'), leeslijsten: lees('Leeslijsten') }));
  try { cache.put(dagSleutel(SITE_CACHE_SLEUTEL), tekst, CACHE_DUUR_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return tekst;
}
