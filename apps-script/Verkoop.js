/**
 * Verkoop.js
 * Verkopen op een standje (bv. Pride of een boekenbeurs).
 *
 *   - In de Catalogus: prijs (euro), onderhandelbaar (ja/nee) en te_koop_aantal (hoeveel exemplaren
 *     de bib te koop heeft). Die exemplaren staan los van de uitleenbare (kolom aantal).
 *   - Tabblad Standjes: naam, thema, datum, plaats en status (voorbereiding, bezig, afgesloten).
 *   - Tabblad Standje boeken: welke boeken mee gaan naar welk standje, hoeveel, en aan welke prijs.
 *     Hetzelfde boek mag op meerdere standjes staan.
 *   - Tabblad Verkopen: elke verkoop, met een eigen code (verkoop_id). Die code maakt de gsm zelf,
 *     ook zonder internet. Komt dezelfde verkoop twee keer binnen, dan telt ze één keer.
 *
 * Bij elke verkoop gaat te_koop_aantal in de Catalogus omlaag. Zo klopt de stock altijd, ook als
 * een verkoop pas later doorkomt (geen internet op het standje).
 *
 * Het scherm is verkoop.html (verkoop.js). Vrijwilligers zetten boeken klaar en verkopen.
 */

var STANDJE_STATUSSEN = ['voorbereiding', 'bezig', 'afgesloten'];

/** Een getal uit een cel of invoer: "12,50" wordt 12.5. Leeg of ongeldig: null. */
function verkoopGetal(w) {
  if (isLeeg(w)) return null;
  var n = Number(String(w).replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : null;
}

/** Hoeveel exemplaren de bib te koop heeft. */
function stockVan(boek) {
  return Math.max(0, Math.round(verkoopGetal(boek.te_koop_aantal) || 0));
}

/** Het overzicht voor het verkoopscherm. tabellen: { catalogus, standjes, standjeBoeken, verkopen } (rijen). */
function verkoopOverzicht(tabellen) {
  var perBoek = {};
  tabellen.catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perBoek[String(b.boek_id)] = b; });
  var teKoop = tabellen.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && stockVan(b) > 0; }).map(function (b) {
    return { id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), prijs: verkoopGetal(b.prijs), o: jaNee(b.onderhandelbaar) === 'ja', stock: stockVan(b) };
  }).sort(function (a, b) { return a.t.localeCompare(b.t); });

  var standjes = tabellen.standjes.filter(function (s) { return !isLeeg(s.standje_id); }).map(function (s) {
    var id = String(s.standje_id);
    var verkopen = tabellen.verkopen.filter(function (v) { return String(v.standje_id) === id; });
    var omzet = { totaal: 0, perBetaalwijze: {} };
    verkopen.forEach(function (v) {
      var bedrag = (verkoopGetal(v.prijs) || 0) * (verkoopGetal(v.aantal) || 1);
      omzet.totaal += bedrag;
      var w = schoon(v.betaalwijze) || 'onbekend';
      omzet.perBetaalwijze[w] = (omzet.perBetaalwijze[w] || 0) + bedrag;
    });
    var boeken = tabellen.standjeBoeken.filter(function (r) { return String(r.standje_id) === id && (verkoopGetal(r.mee) || 0) > 0; }).map(function (r) {
      var b = perBoek[String(r.boek_id)] || {};
      var verkocht = verkopen.filter(function (v) { return String(v.boek_id) === String(r.boek_id); })
        .reduce(function (som, v) { return som + (verkoopGetal(v.aantal) || 1); }, 0);
      var prijs = verkoopGetal(r.prijs);
      return {
        boek_id: String(r.boek_id), t: schoon(b.titel) || String(r.boek_id), a: schoon(b.auteur),
        mee: verkoopGetal(r.mee), verkocht: verkocht,
        prijs: prijs === null ? verkoopGetal(b.prijs) : prijs,
        o: isLeeg(r.onderhandelbaar) ? jaNee(b.onderhandelbaar) === 'ja' : jaNee(r.onderhandelbaar) === 'ja',
        stock: stockVan(b)
      };
    }).sort(function (a, b) { return a.t.localeCompare(b.t); });
    return {
      standje_id: id, naam: schoon(s.naam), thema: schoon(s.thema), datum: parseerDatum(s.datum) || '', locatie: schoon(s.locatie),
      status: STANDJE_STATUSSEN.indexOf(normaliseerTekst(s.status)) > -1 ? normaliseerTekst(s.status) : 'voorbereiding',
      boeken: boeken, omzet: omzet, aantalVerkopen: verkopen.length
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });
  // Afgesloten standjes: enkel de laatste 5, voor de cijfers.
  var open = standjes.filter(function (s) { return s.status !== 'afgesloten'; });
  var dicht = standjes.filter(function (s) { return s.status === 'afgesloten'; }).slice(0, 5);
  return { teKoop: teKoop, standjes: open.concat(dicht) };
}

/** Een nieuw standje, of een bestaand aanpassen. invoer: { standje_id?, naam, thema, datum, locatie, status? } */
function standjeBewaren(rijen, invoer, nieuwId) {
  var naam = tekstInvoer(invoer.naam, 80);
  if (!naam) return { ok: false, fout: 'Geef het standje een naam.' };
  var datum = parseerDatum(invoer.datum);
  if (!datum) return { ok: false, fout: 'Kies een datum.' };
  var velden = { naam: naam, thema: tekstInvoer(invoer.thema, 80), datum: datum, locatie: tekstInvoer(invoer.locatie, 120) };
  if (invoer.status && STANDJE_STATUSSEN.indexOf(invoer.status) > -1) velden.status = invoer.status;
  if (invoer.standje_id) {
    var rij = rijen.filter(function (r) { return String(r.standje_id) === String(invoer.standje_id); })[0];
    if (!rij) return { ok: false, fout: 'Dit standje bestaat niet.' };
    wijzig(rij, velden);
    return { ok: true, standje_id: String(rij.standje_id), tekst: 'Standje bewaard.' };
  }
  velden.standje_id = nieuwId();
  velden.status = velden.status || 'voorbereiding';
  voegToe(rijen, velden);
  return { ok: true, standje_id: velden.standje_id, tekst: 'Standje "' + naam + '" aangemaakt.' };
}

/**
 * Zet een boek klaar voor een standje: hoeveel mee, en eventueel een andere prijs.
 * invoer: { standje_id, boek_id, mee, prijs?, onderhandelbaar? }. mee 0: het boek gaat niet mee.
 */
function standjeBoekZetten(tabellen, invoer) {
  var standje = tabellen.standjes.filter(function (s) { return String(s.standje_id) === String(invoer.standje_id); })[0];
  if (!standje) return { ok: false, fout: 'Dit standje bestaat niet.' };
  if (normaliseerTekst(standje.status) === 'afgesloten') return { ok: false, fout: 'Dit standje is afgesloten.' };
  var boek = tabellen.catalogus.filter(function (b) { return String(b.boek_id) === String(invoer.boek_id); })[0];
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var mee = verkoopGetal(invoer.mee);
  if (mee === null || mee < 0 || mee !== Math.round(mee)) return { ok: false, fout: 'Vul een aantal in, 0 of meer.' };
  if (mee > stockVan(boek)) return { ok: false, fout: 'Er zijn maar ' + stockVan(boek) + ' exemplaren te koop.' };
  var prijs = isLeeg(invoer.prijs) ? null : verkoopGetal(invoer.prijs);
  if (!isLeeg(invoer.prijs) && (prijs === null || prijs < 0)) return { ok: false, fout: 'Vul een geldige prijs in, bv. 8 of 12,50.' };
  var velden = { mee: mee, prijs: prijs === null ? '' : prijs };
  if (invoer.hasOwnProperty('onderhandelbaar')) velden.onderhandelbaar = invoer.onderhandelbaar ? 'ja' : 'nee';
  var rij = tabellen.standjeBoeken.filter(function (r) {
    return String(r.standje_id) === String(standje.standje_id) && String(r.boek_id) === String(boek.boek_id);
  })[0];
  if (rij) wijzig(rij, velden);
  else voegToe(tabellen.standjeBoeken, Object.assign({ standje_id: String(standje.standje_id), boek_id: String(boek.boek_id) }, velden));
  return { ok: true, tekst: mee ? '"' + schoon(boek.titel) + '": ' + mee + ' mee.' : '"' + schoon(boek.titel) + '" gaat niet mee.' };
}

/**
 * Verkopen die de gsm doorstuurt (ook achteraf, na een standje zonder internet).
 * invoer.verkopen: [{ verkoop_id, standje_id, boek_id, aantal, prijs, betaalwijze, tijdstip }]
 * Geeft de verkoop_id's terug die nu bewaard zijn (ook die er al waren), zodat de gsm ze uit de wachtrij haalt.
 */
function verkopenToevoegen(tabellen, lijst, wie) {
  var bekend = {};
  tabellen.verkopen.forEach(function (v) { bekend[String(v.verkoop_id)] = true; });
  var standjes = {};
  tabellen.standjes.forEach(function (s) { standjes[String(s.standje_id)] = s; });
  var boeken = {};
  tabellen.catalogus.forEach(function (b) { boeken[String(b.boek_id)] = b; });
  var bewaard = [], nieuw = 0, fouten = [];
  (lijst || []).slice(0, 200).forEach(function (v) {
    var id = tekstInvoer(v.verkoop_id, 60);
    if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) { fouten.push('Een verkoop zonder geldige code.'); return; }
    if (bekend[id]) { bewaard.push(id); return; }
    var standje = standjes[String(v.standje_id)];
    var boek = boeken[String(v.boek_id)];
    var aantal = verkoopGetal(v.aantal) || 1;
    var prijs = verkoopGetal(v.prijs);
    if (!standje || !boek || aantal < 1 || aantal !== Math.round(aantal) || prijs === null || prijs < 0) {
      fouten.push('Verkoop ' + id + ' klopt niet en is niet bewaard.');
      return;
    }
    voegToe(tabellen.verkopen, {
      verkoop_id: id, standje_id: String(standje.standje_id), boek_id: String(boek.boek_id), aantal: aantal, prijs: prijs,
      betaalwijze: tekstInvoer(v.betaalwijze, 20), tijdstip: tekstInvoer(v.tijdstip, 30), vrijwilliger: wie
    });
    // De stock gaat meteen omlaag. Nooit onder nul.
    wijzig(boek, { te_koop_aantal: Math.max(0, stockVan(boek) - aantal) });
    bekend[id] = true;
    bewaard.push(id);
    nieuw++;
  });
  return { ok: true, bewaard: bewaard, nieuw: nieuw, fouten: fouten };
}

/** Zet de status van een standje: bezig (de verkoop begint) of afgesloten. */
function standjeStatus(rijen, invoer) {
  var rij = rijen.filter(function (r) { return String(r.standje_id) === String(invoer.standje_id); })[0];
  if (!rij) return { ok: false, fout: 'Dit standje bestaat niet.' };
  if (STANDJE_STATUSSEN.indexOf(invoer.status) === -1) return { ok: false, fout: 'Onbekende status.' };
  wijzig(rij, { status: invoer.status });
  return { ok: true, tekst: invoer.status === 'afgesloten' ? 'Standje "' + schoon(rij.naam) + '" is afgesloten.' : 'Standje "' + schoon(rij.naam) + '": ' + invoer.status + '.' };
}

/* ---------- In Apps Script ---------- */

/** Voert een actie van het verkoopscherm uit (binnen het slot van doPost). */
function verkoopActie(actie, invoer, wie) {
  var nodig = ['Standjes', 'Standje boeken', 'Verkopen'];
  for (var i = 0; i < nodig.length; i++) {
    if (!spreadsheet().getSheetByName(nodig[i])) return { ok: false, fout: 'Het tabblad ' + nodig[i] + ' ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  }
  var catalogus = leesTabel('Catalogus');
  var tabellen = {
    catalogus: catalogus.rijen, standjes: leesTabel('Standjes'), standjeBoeken: leesTabel('Standje boeken'), verkopen: leesTabel('Verkopen')
  };
  var rijen = { catalogus: catalogus.rijen, standjes: tabellen.standjes.rijen, standjeBoeken: tabellen.standjeBoeken.rijen, verkopen: tabellen.verkopen.rijen };
  if (actie === 'verkoopData') return { ok: true, data: verkoopOverzicht(rijen) };
  var r;
  if (actie === 'standjeBewaren') {
    r = standjeBewaren(rijen.standjes, invoer, nieuwIdVoor(rijen.standjes, 'standje_id', 'standje', 'S'));
    if (r.ok) bewaarTabel(tabellen.standjes);
  } else if (actie === 'standjeBoekZetten') {
    r = standjeBoekZetten(rijen, invoer);
    if (r.ok) bewaarTabel(tabellen.standjeBoeken);
  } else if (actie === 'verkopenDoorsturen') {
    r = verkopenToevoegen(rijen, invoer.verkopen, wie);
    if (r.nieuw) { bewaarTabel(tabellen.verkopen); bewaarTabel(catalogus); }
  } else if (actie === 'standjeStatus') {
    r = standjeStatus(rijen.standjes, invoer);
    if (r.ok) bewaarTabel(tabellen.standjes);
  } else {
    return { ok: false, fout: 'Onbekende actie.' };
  }
  if (r.ok) {
    logboek(wie, actie, String(invoer.standje_id || '') + (r.nieuw ? ' (' + r.nieuw + ' verkopen)' : ''));
    r.data = verkoopOverzicht(rijen);
  }
  return r;
}
