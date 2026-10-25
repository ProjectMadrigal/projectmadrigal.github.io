/**
 * Shifts.js
 * Twee dingen rond de vrijdagavonden in de bib:
 *
 * 1. Vaste events (instelling tekst_vaste_events), bv. "Genderspectrum: tweede vrijdag".
 *    Het script zet de eerstvolgende keer vanzelf in de agenda van de website (zoals de bookclub),
 *    en toont het event bij het rooster en bij Jouw shift als de roostertool er geen vermeldt.
 *    Een eigen event met dezelfde naam in de Agenda vervangt de automatische datum van die dag.
 *
 * 2. Het archief van de shifts (tabblad Shifts): wie de bib openhield en wie back-up was.
 *    Madrigal > Rooster > Neem een oud rooster over uit de tabbladen leest een rooster per maand,
 *    zoals het rooster "Opening bib" van 2026 (een tabblad per maand). Het bestuursscherm toont
 *    onder Cijfers hoeveel avonden elke vrijwilliger deed, en welke avonden de bib dicht was.
 *    Namen van vrijwilligers staan nooit op de website.
 */

var RANGWOORDEN = { eerste: 1, tweede: 2, derde: 3, vierde: 4, vijfde: 5, laatste: 5 };

/**
 * Leest de vaste events: een regel per event, "naam: rangwoord weekdag".
 * Bv. "T-café: derde vrijdag" of "Volkskeuken: laatste vrijdag". Geeft [{ naam, week, dag }].
 */
function vasteEventsUitTekst(tekst) {
  return String(tekst || '').split('\n').map(function (regel) {
    var m = regel.match(/^\s*(.+?)\s*:\s*(\S+)\s+(\S+)\s*$/);
    if (!m) return null;
    var week = RANGWOORDEN[normaliseerTekst(m[2])];
    var dag = WEEKDAGEN.indexOf(normaliseerTekst(m[3]));
    return week && dag > -1 ? { naam: schoon(m[1]), week: week, dag: dag } : null;
  }).filter(Boolean);
}

/** De namen van de vaste events op een datum (JJJJ-MM-DD). */
function vasteEventsOp(datum, lijst) {
  var jaar = Number(datum.slice(0, 4)), maand = Number(datum.slice(5, 7));
  return (lijst || []).filter(function (e) { return nDeWeekdag(jaar, maand, e.dag, e.week) === datum; }).map(function (e) { return e.naam; });
}

/**
 * Voor de agenda van de website: per vast event de eerstvolgende keer, tenzij er die dag al
 * een eigen event met die naam in de Agenda staat.
 */
function vasteEventsVoorAgenda(inst, vandaag, agendaRijen) {
  var eigen = {};
  (agendaRijen || []).forEach(function (r) {
    var d = parseerDatum(r.datum);
    if (d) eigen[d + '|' + normaliseerTekst(r.titel)] = true;
  });
  return vasteEventsUitTekst(inst.tekst_vaste_events).map(function (e) {
    var d = bookclubDatums(vandaag, e.week, e.dag, 1)[0];
    if (!d || eigen[d + '|' + normaliseerTekst(e.naam)]) return null;
    return { datum: d, uur: '', titel: { nl: e.naam, en: e.naam }, tekst: { nl: '', en: '' }, locatie: '', afbeelding: '', link: '' };
  }).filter(Boolean);
}

/** Vult bij de avonden van het rooster het vaste event in, als de roostertool er geen vermeldt. */
function vulVasteEventsAan(avonden, inst) {
  var lijst = vasteEventsUitTekst(inst.tekst_vaste_events);
  (avonden || []).forEach(function (a) {
    if (!a.event) a.event = vasteEventsOp(a.datum, lijst).join(', ');
  });
  return avonden;
}

/* ---------- Een oud rooster overnemen (een tabblad per maand) ---------- */

var MAANDEN_KORT = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "Januari '26", "febr 26", "Sept 2026": { jaar, maand } of null. */
function maandUitTitel(tekst) {
  var t = normaliseerTekst(tekst);
  var m = t.match(/^([a-z]+)\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  var maand = MAANDEN_KORT.indexOf(m[1].slice(0, 3)) + 1;
  if (m[1].slice(0, 3) === 'mrt') maand = 3;
  if (!maand) return null;
  var jaar = Number(m[2]);
  return { jaar: jaar < 100 ? 2000 + jaar : jaar, maand: maand };
}

/** Namen uit een cel: "Kim & Ilo", "Kim / Ilo", "(Ilo?)". Plaatshouders als "..." vallen weg. */
function namenUitCel(waarde) {
  return String(waarde || '').split(/\s*(?:&|\/|,|\+|\sen\s|\sand\s)\s*/i).map(function (n) {
    return schoon(n.replace(/[()?!.]/g, ''));
  }).filter(function (n) { return n && /[a-z]/i.test(n); });
}

/**
 * Leest één tabblad van een oud rooster: een kop met de maand, een rij met de weekdagen,
 * en per week een rij met de dagnummers, gevolgd door de rijen events, bib en backup.
 * Geeft [{ datum, rol: 'bib' | 'backup' | 'gesloten' | 'workshop', naam, event }] of null.
 */
function shiftsUitMaandblad(waarden, bladnaam) {
  var maand = null, kolom = -1;
  for (var r = 0; r < Math.min(6, waarden.length) && !maand; r++) {
    waarden[r].forEach(function (c) { if (!maand && c) maand = maandUitTitel(c); });
  }
  if (!maand) maand = maandUitTitel(bladnaam);
  for (var k = 0; k < Math.min(8, waarden.length) && kolom === -1; k++) {
    kolom = waarden[k].map(normaliseerTekst).indexOf('friday');
    if (kolom === -1) kolom = waarden[k].map(normaliseerTekst).indexOf('vrijdag');
  }
  if (!maand || kolom === -1) return null;
  var uit = [], datum = '', event = '';
  waarden.forEach(function (rij) {
    var label = normaliseerTekst(rij[0]);
    var cel = rij[kolom];
    if (!label) {
      // Een rij met dagnummers: het nummer onder vrijdag is de datum van deze week (leeg: geen vrijdag).
      var nummers = rij.filter(function (c) { return typeof c === 'number' || /^\d{1,2}(\.0)?$/.test(String(c || '').trim()); });
      if (nummers.length) {
        var dag = parseerGetal(cel);
        datum = dag ? maand.jaar + '-' + tweeCijfers(maand.maand) + '-' + tweeCijfers(dag) : '';
        event = '';
      }
      return;
    }
    if (!datum) return;
    if (label === 'events' || label === 'event') { event = schoon(cel); return; }
    if (label !== 'bib' && label !== 'backup' && label !== 'back up') return;
    var tekst = normaliseerTekst(cel);
    if (label === 'bib' && /gesloten|dicht/.test(tekst)) { uit.push({ datum: datum, rol: 'gesloten', naam: '', event: event }); return; }
    if (label === 'bib' && /workshop/.test(tekst)) { uit.push({ datum: datum, rol: 'workshop', naam: '', event: event }); return; }
    namenUitCel(cel).forEach(function (naam) {
      uit.push({ datum: datum, rol: label === 'bib' ? 'bib' : 'backup', naam: naam, event: event });
    });
  });
  return uit;
}

/** Voegt shifts toe aan het tabblad Shifts, zonder dubbels. Geeft het aantal nieuwe. */
function voegShiftsToe(rijen, shifts) {
  var gezien = {};
  var sleutel = function (s) { return parseerDatum(s.datum) + '|' + s.rol + '|' + normaliseerTekst(s.naam); };
  rijen.forEach(function (r) { gezien[sleutel(r)] = true; });
  var n = 0;
  shifts.forEach(function (s) {
    if (gezien[sleutel(s)]) return;
    gezien[sleutel(s)] = true;
    voegToe(rijen, { datum: s.datum, rol: s.rol, naam: s.naam, event: s.event || '' });
    n++;
  });
  return n;
}

/**
 * Voor Cijfers: per vrijwilliger hoeveel avonden in de bib en als back-up, per jaar,
 * en de avonden dat de bib dicht was of een workshop had.
 */
function shiftCijfers(rijen, jaar) {
  var perNaam = {}, dicht = [];
  (rijen || []).forEach(function (r) {
    var d = parseerDatum(r.datum);
    if (!d || d.slice(0, 4) !== String(jaar)) return;
    if (r.rol === 'gesloten' || r.rol === 'workshop') { dicht.push({ datum: d, rol: r.rol }); return; }
    var k = normaliseerTekst(r.naam);
    if (!k) return;
    var p = perNaam[k] = perNaam[k] || { naam: schoon(r.naam), bib: 0, backup: 0, schrijfwijzen: {} };
    p.schrijfwijzen[schoon(r.naam)] = (p.schrijfwijzen[schoon(r.naam)] || 0) + 1;
    if (r.rol === 'bib') p.bib++; else if (r.rol === 'backup') p.backup++;
  });
  var personen = Object.keys(perNaam).map(function (k) {
    var p = perNaam[k];
    // De meest gebruikte schrijfwijze (C-Jay of C-jay).
    p.naam = Object.keys(p.schrijfwijzen).sort(function (a, b) { return p.schrijfwijzen[b] - p.schrijfwijzen[a]; })[0];
    return { naam: p.naam, bib: p.bib, backup: p.backup };
  }).sort(function (a, b) { return b.bib - a.bib || b.backup - a.backup || a.naam.localeCompare(b.naam); });
  return { jaar: Number(jaar), personen: personen, dicht: dicht.sort(function (a, b) { return a.datum.localeCompare(b.datum); }) };
}

/** Menu: leest alle tabbladen met een rooster per maand en zet de shifts in het tabblad Shifts. */
function neemRoosterOverUitTabbladen() {
  var ss = spreadsheet();
  var eigen = Object.keys(KOLOMMEN);
  var shifts = [], bladen = [];
  ss.getSheets().forEach(function (blad) {
    if (eigen.indexOf(blad.getName()) > -1) return;
    var s = shiftsUitMaandblad(blad.getDataRange().getValues(), blad.getName());
    if (s && s.length) { shifts = shifts.concat(s); bladen.push(blad.getName()); }
  });
  if (!shifts.length) { meld('Geen tabblad met een rooster per maand gevonden. Importeer eerst het bestand: Bestand > Importeren > Uploaden, en kies Nieuwe bladen invoegen.'); return; }
  var tabel = spreadsheet().getSheetByName('Shifts') ? leesTabel('Shifts') : null;
  if (!tabel) { meld('Het tabblad Shifts ontbreekt nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
  var n = voegShiftsToe(tabel.rijen, shifts);
  if (n) bewaarTabel(tabel);
  var dicht = shifts.filter(function (s) { return s.rol === 'gesloten' || s.rol === 'workshop'; });
  logboek('menu', 'neemRoosterOverUitTabbladen', bladen.length + ' tabbladen, ' + n + ' nieuwe regels in Shifts');
  meld(bladen.length + ' tabbladen gelezen (' + bladen.join(', ') + '). ' + n + ' nieuwe regels in Shifts.' +
    (dicht.length ? ' Dicht of workshop: ' + dicht.map(function (s) { return korteDatum(s.datum) + ' (' + s.rol + ')'; }).join(', ') + '.' : '') +
    ' De tabbladen van het oude rooster mag je nu verwijderen.');
}
