/**
 * Api.js
 * De web-app: het publieke eindpunt voor de catalogus en de afgeschermde
 * eindpunten voor de balie en het bestuur.
 *
 * Publiek (GET):   ?actie=catalogus
 *   Geeft enkel de publieke velden terug (zie Publiek.js). Het resultaat staat
 *   in de cache van het script, zodat 2.500 boeken snel laden.
 *
 * Afgeschermd (POST, met een code): { actie, code, wie, ... }
 *   De code bepaalt de rol: "balie", "vrijwilliger" of "bestuur". Elke rol mag alles
 *   van de rol ervoor (zie ROL_RANG). De codes zijn een eenvoudige drempel, geen echte beveiliging.
 */

var CACHE_SLEUTEL = 'publiek_v1';
var CACHE_DUUR_SECONDEN = 6 * 60 * 60; // het maximum van Google: 6 uur
var CACHE_STUK = 90000;                 // een cachewaarde mag hoogstens 100 kB zijn

/** De rollen, van weinig naar veel rechten. */
var ROL_RANG = { publiek: 0, balie: 1, vrijwilliger: 2, bestuur: 3 };

/** Mag deze rol deze actie? */
function magActie(rol, actie) {
  return ACTIES.hasOwnProperty(actie) && (ROL_RANG[rol] || 0) >= ROL_RANG[ACTIES[actie]];
}

/** Welke rol nodig is voor elke actie. */
var ACTIES = {
  aanmelden: 'balie',
  balieData: 'balie',
  uitlenen: 'balie',
  terugbrengen: 'balie',
  verlengen: 'balie',
  // Een uitlening aanpassen of annuleren (Uitlenen.js). Annuleren kan ook in het vrijwilligersscherm.
  vervaldatumAanpassen: 'bestuur',
  annuleerUitlening: 'vrijwilliger',
  annuleerVerlenging: 'vrijwilliger',
  reserveren: 'balie',
  annuleerReservatie: 'balie',
  nieuweLener: 'balie',
  roosterOverzicht: 'balie',
  bestuurData: 'bestuur',
  // Vrijwilligersscherm (vrijwilliger.html): zonder contactgegevens van leners.
  vrijwilligerData: 'vrijwilliger',
  borgTerugbetaald: 'bestuur',
  herinneringVerstuurd: 'bestuur',
  lenerAanpassen: 'bestuur',
  aanvraagAfhandelen: 'bestuur',
  // Van vrijwilligers naar het bestuur (Vrijwilligers.js).
  voorstelBeschrijving: 'vrijwilliger',
  voorstelBehandelen: 'bestuur',
  meldingMaken: 'vrijwilliger',
  meldingAfhandelen: 'bestuur',
  briefjeMaken: 'vrijwilliger',
  briefjeWeg: 'vrijwilliger',
  // Zonder code, vanaf de publieke website (Aanvragen.js). Staat uit tot online_reserveren = ja.
  reservatieAanvraag: 'publiek',
  // Beheer van de website (Beheer.js). Wat op 'vrijwilliger' staat, kan ook vanuit het vrijwilligersscherm.
  // Nieuws en agenda van vrijwilligers blijven verborgen tot het bestuur ze goedkeurt (zie inhoudAanpassen).
  beheerBoekOphalen: 'bestuur',
  beheerBoekBewaren: 'bestuur',
  beheerLeeslijstBoeken: 'vrijwilliger',
  bezoekersCijfers: 'bestuur',
  beheerLogboek: 'bestuur',
  beheerCoverLinks: 'vrijwilliger',
  beheerLenerHistoriek: 'bestuur',
  beheerBoekenBulk: 'bestuur',
  bestuurCijfers: 'bestuur',
  // De verborgen filmpagina bekijken (Films.js), zolang films_tonen op nee staat.
  filmsVoorbeeld: 'bestuur',
  beheerBoekToevoegen: 'bestuur',
  beheerIsbnOpzoeken: 'bestuur',
  beheerInhoud: 'vrijwilliger',
  beheerInhoudBewaren: 'vrijwilliger',
  beheerInstellingBewaren: 'bestuur',
  beheerCoversLijst: 'vrijwilliger',
  beheerCoversBewaren: 'vrijwilliger',
  beheerCoverUpload: 'vrijwilliger',
  beheerTekstUitFoto: 'vrijwilliger',
  beheerIaCovers: 'bestuur',
  beheerIaCoversWissen: 'bestuur'
};

/* ---------- Staat lezen en bewaren ---------- */

/**
 * Leest alle gegevens die de uitleenlogica nodig heeft.
 * wie: voornaam van de vrijwilliger (voor het logboek en de uitzonderingen).
 */
function laadStaat(wie, metUitzonderingen) {
  var tabellen = {
    Catalogus: leesTabel('Catalogus'),
    Leners: leesTabel('Leners'),
    Uitleningen: leesTabel('Uitleningen'),
    Reservaties: leesTabel('Reservaties')
  };
  if (metUitzonderingen) tabellen.Uitzonderingen = leesTabel('Uitzonderingen');
  // Getallen uit de spreadsheet (lenersnummer 12.0) gelijk maken aan tekst ("12").
  tabellen.Leners.rijen.forEach(function (l) { l.lenersnummer = String(l.lenersnummer); });
  tabellen.Uitleningen.rijen.forEach(function (u) { if (!isLeeg(u.lenersnummer)) u.lenersnummer = String(u.lenersnummer); });
  tabellen.Reservaties.rijen.forEach(function (r) { if (!isLeeg(r.lenersnummer)) r.lenersnummer = String(r.lenersnummer); });
  return {
    tabellen: tabellen,
    inst: leesInstellingen(),
    vandaag: vandaagTekst(),
    wie: tekstInvoer(wie, 40) || 'onbekend',
    catalogus: tabellen.Catalogus.rijen,
    leners: tabellen.Leners.rijen,
    uitleningen: tabellen.Uitleningen.rijen,
    reservaties: tabellen.Reservaties.rijen,
    uitzonderingenTabel: tabellen.Uitzonderingen ? tabellen.Uitzonderingen.rijen : [],
    uitzonderingen: [],
    log: [],
    nieuwNummer: function (soort, bestaande) { return volgendNummer(soort, bestaande); }
  };
}

/** Schrijft alle wijzigingen van een staat terug naar de spreadsheet. */
function bewaarStaat(staat) {
  ['Leners', 'Uitleningen', 'Reservaties', 'Uitzonderingen'].forEach(function (naam) {
    if (staat.tabellen[naam]) bewaarTabel(staat.tabellen[naam]);
  });
  if (staat.uitzonderingen.length) {
    var tabel = staat.tabellen.Uitzonderingen || leesTabel('Uitzonderingen');
    staat.uitzonderingen.forEach(function (x) { voegToe(tabel.rijen, x); });
    bewaarTabel(tabel);
  }
  staat.log.forEach(function (regel) { logboek(staat.wie, regel[0], regel[1]); });
}

/* ---------- Publiek eindpunt ---------- */

/** GET: de publieke catalogus. */
function doGet(e) {
  var actie = e && e.parameter ? e.parameter.actie : '';
  if (actie === 'catalogus') return json(publiekeCatalogusJson(), true);
  if (actie === 'site') return json(siteInhoudJson(), true);
  return json(JSON.stringify({ ok: true, info: 'Catalogus Project Madrigal. Gebruik ?actie=catalogus.' }), true);
}

/** De publieke catalogus als JSON-tekst, uit de cache als die er is. */
function publiekeCatalogusJson() {
  var cache = CacheService.getScriptCache();
  var sleutel = dagSleutel(CACHE_SLEUTEL);
  var aantal = Number(cache.get(sleutel + '_n') || 0);
  if (aantal > 0) {
    var sleutels = [];
    for (var i = 0; i < aantal; i++) sleutels.push(sleutel + '_' + i);
    var stukken = cache.getAll(sleutels);
    if (Object.keys(stukken).length === aantal) {
      return sleutels.map(function (s) { return stukken[s]; }).join('');
    }
  }
  var staat = laadStaat('publiek', false);
  verwerkVervallenReservatiesStil(staat);
  var lijsten = spreadsheet().getSheetByName('Leeslijsten') ? leesTabel('Leeslijsten').rijen : [];
  var tekst = JSON.stringify(bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen, lijsten));
  var waarden = {};
  var n = Math.ceil(tekst.length / CACHE_STUK);
  for (var j = 0; j < n; j++) waarden[sleutel + '_' + j] = tekst.slice(j * CACHE_STUK, (j + 1) * CACHE_STUK);
  waarden[sleutel + '_n'] = String(n);
  try { cache.putAll(waarden, CACHE_DUUR_SECONDEN); } catch (err) { /* te groot voor de cache: dan zonder */ }
  return tekst;
}

/** Vervallen reservaties bijwerken zonder het publieke verzoek te laten mislukken. */
function verwerkVervallenReservatiesStil(staat) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    verwerkVervallenReservaties(staat);
    bewaarStaat(staat);
  } finally {
    lock.releaseLock();
  }
}

/** Maakt de cache van de publieke catalogus leeg, zodat de volgende opvraging vers is. */
function leegCache() {
  try { CacheService.getScriptCache().removeAll([dagSleutel(CACHE_SLEUTEL) + '_n', dagSleutel(SITE_CACHE_SLEUTEL)]); } catch (e) { /* niets aan de hand */ }
}

/**
 * Een cachesleutel per dag. Zo verschijnt gepland nieuws en een geplande leeslijst
 * vanzelf op de juiste dag, zonder dat iemand iets moet wissen.
 */
function dagSleutel(sleutel) {
  return sleutel + '_' + vandaagTekst().replace(/-/g, '');
}

/** Een JSON-antwoord. */
function json(tekst) {
  return ContentService.createTextOutput(typeof tekst === 'string' ? tekst : JSON.stringify(tekst))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Afgeschermde eindpunten ---------- */

/** Welke rol hoort bij een code? '' als de code niet klopt. */
function rolVoorCode(code, inst) {
  var c = schoon(code);
  if (!c) return '';
  if (inst.code_bestuur && c === String(inst.code_bestuur)) return 'bestuur';
  if (inst.code_vrijwilliger && c === String(inst.code_vrijwilliger)) return 'vrijwilliger';
  if (inst.toegangscode_balie && c === String(inst.toegangscode_balie)) return 'balie';
  return '';
}

/** Een hogere rol mag een scherm bekijken met de rechten van een lagere rol (enkel vrijwilliger), nooit omgekeerd. */
function rolVoorScherm(rol, alsRol) {
  return alsRol === 'vrijwilliger' && ROL_RANG[rol] > ROL_RANG.vrijwilliger ? 'vrijwilliger' : rol;
}

/** POST: acties voor de balie en het bestuur. */
function doPost(e) {
  var invoer;
  try {
    invoer = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, fout: 'Ongeldig verzoek.' });
  }
  if (!invoer || typeof invoer !== 'object') return json({ ok: false, fout: 'Ongeldig verzoek.' });
  var actie = String(invoer.actie || '');
  if (!ACTIES.hasOwnProperty(actie)) return json({ ok: false, fout: 'Onbekende actie.' });

  if (ACTIES[actie] === 'publiek') {
    try {
      return json(publiekeAanvraag(invoer));
    } catch (err) {
      logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
      return json({ ok: false, fout: 'Er ging iets mis. Probeer het later opnieuw of kom langs in de bib.' });
    }
  }

  var rol = rolVoorCode(invoer.code, leesInstellingen());
  if (!rol) {
    // Even wachten maakt het raden van codes trager.
    Utilities.sleep(1500);
    return json({ ok: false, fout: 'De code klopt niet.', code: 'ongeldige_code' });
  }
  // Het bestuur bekijkt het vrijwilligersscherm: dan gelden de rechten van een vrijwilliger.
  var echteRol = rol;
  rol = rolVoorScherm(rol, invoer.alsRol);
  if (actie === 'aanmelden') return json({ ok: true, rol: rol, echteRol: echteRol });
  if (!magActie(rol, actie)) {
    return json({ ok: false, fout: ACTIES[actie] === 'bestuur' ? 'Dit kan enkel met de code van het bestuur.' : 'Dit kan niet met deze code.' });
  }

  try {
    return json(voerActieUit(actie, invoer, rol));
  } catch (err) {
    logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
    return json({ ok: false, fout: 'Er ging iets mis: ' + String(err && err.message || err) });
  }
}

/** Voert een actie uit. Wijzigende acties gebeuren onder een slot, zodat twee balies elkaar niet storen. */
function voerActieUit(actie, invoer, rol) {
  if (actie === 'aanmelden') return { ok: true, rol: rol };
  if (actie === 'roosterOverzicht') return roosterOverzicht(); // leest enkel, geen slot nodig
  if (actie === 'beheerIsbnOpzoeken') return isbnOpzoeken(invoer); // leest enkel bij Open Library en Google Books
  if (actie === 'beheerInhoud') return beheerInhoudGegevens(rol);
  if (actie === 'bezoekersCijfers') return bezoekersCijfers(invoer); // leest enkel bij GoatCounter
  if (actie === 'beheerLogboek') return logboekEnTaken(); // leest enkel, geen slot nodig
  if (actie === 'beheerCoverLinks') return coverLinks(leesTabel('Catalogus').rijen); // leest enkel
  if (actie === 'beheerTekstUitFoto') return tekstUitFoto(invoer, ocrViaDrive); // leest enkel, geen slot nodig

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var wie = tekstInvoer(invoer.wie, 40) || 'onbekend';
    if (actie === 'aanvraagAfhandelen') return beheerAanvraagAfhandelen(invoer, wie);
    if (actie === 'meldingMaken' || actie === 'meldingAfhandelen') return meldingActie(actie, invoer, wie);
    if (actie === 'briefjeMaken' || actie === 'briefjeWeg') return briefjeActie(actie, invoer, wie);
    if (actie === 'beheerInhoudBewaren' || actie === 'beheerInstellingBewaren') {
      var gewijzigd = actie === 'beheerInhoudBewaren' ? beheerInhoudBewaren(invoer, wie, rol) : beheerInstellingBewaren(invoer, wie);
      if (gewijzigd.ok) leegCache();
      return gewijzigd;
    }
    var staat = laadStaat(invoer.wie, actie === 'bestuurData');
    var meldingen = verwerkVervallenReservaties(staat);
    var antwoord;
    switch (actie) {
      case 'balieData':
        antwoord = { ok: true, data: balieGegevens(staat) };
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        break;
      case 'bestuurData':
        antwoord = { ok: true, data: bestuurGegevens(staat, leesTabel('Onderwerpen').rijen) };
        antwoord.data.aanvragen = openAanvragen(spreadsheet().getSheetByName('Aanvragen') ? leesTabel('Aanvragen').rijen : []);
        antwoord.data.onlineReserveren = staat.inst.online_reserveren === true;
        antwoord.data.voorstellen = telVoorstellen();
        antwoord.data.beschrijvingVoorstellen = openVoorstellen(tabelOfLeeg('Voorstellen') ? leesTabel('Voorstellen').rijen : []);
        antwoord.data.meldingen = openMeldingen(tabelOfLeeg('Meldingen') ? leesTabel('Meldingen').rijen : []);
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        antwoord.data.briefjes = openBriefjes(tabelOfLeeg('Briefjes') ? leesTabel('Briefjes').rijen : [], staat.vandaag);
        antwoord.data.vandaagTerug = vandaagTerug(staat, vertaalTabel(leesTabel('Onderwerpen').rijen));
        break;
      case 'vrijwilligerData':
        var onderwerpRijen = leesTabel('Onderwerpen').rijen;
        var voorstelRijen = tabelOfLeeg('Voorstellen') ? leesTabel('Voorstellen').rijen : [];
        antwoord = { ok: true, data: vrijwilligerGegevens(staat, onderwerpRijen) };
        antwoord.data.voorgesteld = voorgesteldeBoeken(voorstelRijen);
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        antwoord.data.briefjes = openBriefjes(tabelOfLeeg('Briefjes') ? leesTabel('Briefjes').rijen : [], staat.vandaag);
        antwoord.data.vandaagTerug = vandaagTerug(staat, vertaalTabel(onderwerpRijen));
        antwoord.data.mijn = mijnBijdragen(voorstelRijen, tabelOfLeeg('Meldingen') ? leesTabel('Meldingen').rijen : [], staat.wie, staat.vandaag);
        break;
      case 'voorstelBeschrijving':
      case 'voorstelBehandelen': antwoord = voorstelActie(staat, actie, invoer); break;
      case 'uitlenen': antwoord = uitlenen(staat, invoer); break;
      case 'terugbrengen': antwoord = terugbrengen(staat, { uitlening_id: invoer.uitlening_id, borg_terugbetaald: invoer.borg_terugbetaald === true, staat_boek: invoer.staat_boek, opmerking: invoer.opmerking }); break;
      case 'verlengen': antwoord = verlengen(staat, invoer); break;
      case 'vervaldatumAanpassen': antwoord = vervaldatumAanpassen(staat, invoer); break;
      case 'annuleerUitlening': antwoord = annuleerUitlening(staat, invoer, rol === 'bestuur'); break;
      case 'annuleerVerlenging': antwoord = annuleerVerlenging(staat, invoer); break;
      case 'reserveren': antwoord = reserveren(staat, invoer); break;
      case 'annuleerReservatie': antwoord = annuleerReservatie(staat, invoer); break;
      case 'nieuweLener': antwoord = nieuweLener(staat, { voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, toestemming: invoer.toestemming === true }); break;
      case 'borgTerugbetaald': antwoord = borgTerugbetaald(staat, invoer); break;
      case 'herinneringVerstuurd': antwoord = herinneringVerstuurd(staat, invoer); break;
      case 'beheerBoekOphalen':
        antwoord = boekOphalen(staat, invoer);
        if (antwoord.ok) {
          antwoord.historiek = boekHistoriek(staat, invoer.boek_id);
          var logBlad = spreadsheet().getSheetByName('Logboek');
          antwoord.wijzigingen = logBlad && logBlad.getLastRow() > 1 ? boekWijzigingen(logBlad.getDataRange().getValues(), invoer.boek_id) : [];
        }
        break;
      case 'beheerLenerHistoriek': antwoord = lenerHistoriek(staat, invoer.lenersnummer); break;
      case 'beheerBoekenBulk': antwoord = boekenBulk(staat, invoer); break;
      case 'filmsVoorbeeld':
        var fc = bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen, [], { enkelFilms: true });
        antwoord = { ok: true, boeken: fc.boeken, teksten: fc.teksten, filmsTonen: staat.inst.films_tonen === true };
        break;
      case 'bestuurCijfers':
        antwoord = { ok: true, cijfers: bestuurCijfers(staat, leesTabel('Onderwerpen').rijen) };
        antwoord.cijfers.shifts = shiftCijfers(spreadsheet().getSheetByName('Shifts') ? leesTabel('Shifts').rijen : [], staat.vandaag.slice(0, 4));
        break;
      case 'beheerCoversLijst': antwoord = coversTeZoeken(staat, rol === 'bestuur'); break;
      case 'beheerCoversBewaren': antwoord = coversBewaren(staat, invoer); break;
      case 'beheerIaCovers': antwoord = iaCoversLijst(staat); break;
      case 'beheerIaCoversWissen': antwoord = iaCoversWissen(staat, invoer); break;
      case 'beheerCoverUpload': antwoord = coverUploaden(staat, invoer, bewaarFotoInDrive); break;
      case 'beheerBoekBewaren': antwoord = boekAanpassen(staat, invoer); break;
      case 'beheerLeeslijstBoeken': antwoord = leeslijstBoeken(staat, invoer); break;
      case 'beheerBoekToevoegen':
        var ids = maakIdGenerator(staat.catalogus);
        antwoord = boekToevoegen(staat, invoer, ids.nieuw);
        if (antwoord.ok) ids.bewaar();
        break;
      case 'lenerAanpassen':
        var lenerInvoer = { lenersnummer: invoer.lenersnummer, voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, actief: invoer.actief !== false };
        if (invoer.hasOwnProperty('notitie')) lenerInvoer.notitie = invoer.notitie;
        antwoord = lenerAanpassen(staat, lenerInvoer);
        break;
    }
    // Ook bij een geweigerde actie bewaren we vervallen reservaties.
    bewaarStaat(staat);
    if (staat.vertalingNodig) {
      try { planVertaling(2); } catch (e) { /* lukt het niet, dan vertaalt het menu later */ }
    }
    if (staat.catalogusGewijzigd) {
      bewaarTabel(staat.tabellen.Catalogus);
      werkOnderwerpenBij(); // een nieuw genre komt zo in de vertaaltabel Onderwerpen
    }
    if (meldingen.length || (antwoord.ok && actie !== 'balieData' && actie !== 'bestuurData' && actie !== 'filmsVoorbeeld')) leegCache();
    if (meldingen.length && antwoord.ok) antwoord.apartLeggen = (antwoord.apartLeggen || []).concat(meldingen);
    return antwoord;
  } finally {
    lock.releaseLock();
  }
}
