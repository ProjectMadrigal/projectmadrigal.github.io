/**
 * Uitlenen.js
 * De regels voor uitlenen, terugbrengen, verlengen en reserveren.
 *
 * Deze functies werken op een "staat": een object met alle gegevens in het geheugen.
 *   staat.inst          instellingen (zie Instellingen.js)
 *   staat.vandaag       "JJJJ-MM-DD"
 *   staat.wie           voornaam van de vrijwilliger
 *   staat.catalogus     rijen van de Catalogus
 *   staat.leners        rijen van Leners
 *   staat.uitleningen   rijen van Uitleningen
 *   staat.reservaties   rijen van Reservaties
 *   staat.uitzonderingen  nieuwe uitzonderingen (worden achteraf weggeschreven)
 *   staat.log           regels voor het Logboek
 * Api.js leest de staat uit de spreadsheet, roept een functie op en schrijft de
 * wijzigingen terug. De tests gebruiken dezelfde functies met verzonnen gegevens.
 *
 * Elke actie geeft een antwoord terug:
 *   { ok: true, ... }                      gelukt
 *   { ok: false, fout: 'uitleg' }          kan niet (bv. boek is al uitgeleend)
 *   { ok: false, grenzen: [ ... ] }        een grens is overschreden: vraag een reden
 */

var STATUS_WACHT = 'wacht';
var STATUS_KLAAR = 'klaar om op te halen';
var STATUS_AFGEHAALD = 'afgehaald';
var STATUS_VERVALLEN = 'vervallen';
var STATUS_GEANNULEERD = 'geannuleerd';

/* ---------- Opzoeken ---------- */

function boekVan(staat, boekId) {
  var id = schoon(boekId).toUpperCase();
  for (var i = 0; i < staat.catalogus.length; i++) {
    if (String(staat.catalogus[i].boek_id).toUpperCase() === id) return staat.catalogus[i];
  }
  return null;
}

/** Aantal exemplaren van een boek (een leeg veld telt als 1). */
function aantalExemplaren(boek) {
  var n = parseerGetal(boek.aantal);
  return n && n > 0 ? Math.round(n) : 1;
}

/** Alle exemplaarnummers van een boek: ["B0012-1", "B0012-2"]. */
function exemplarenVan(boek) {
  var lijst = [];
  for (var i = 1; i <= aantalExemplaren(boek); i++) lijst.push(boek.boek_id + '-' + i);
  return lijst;
}

/** Zoekt boek en exemplaar bij een exemplaarnummer. "B0012" mag ook als er maar één exemplaar is. */
function exemplaarInfo(staat, exemplaar) {
  var t = schoon(exemplaar).toUpperCase();
  var m = t.match(/^([A-Z]\d+)(?:-(\d+))?$/);
  if (!m) return null;
  var boek = boekVan(staat, m[1]);
  if (!boek) return null;
  var nr = m[2] ? Number(m[2]) : 1;
  if (nr < 1 || nr > aantalExemplaren(boek)) return null;
  return { boek: boek, exemplaar: boek.boek_id + '-' + nr };
}

function lenerVan(staat, lenersnummer) {
  var n = String(parseerGetal(lenersnummer));
  for (var i = 0; i < staat.leners.length; i++) {
    if (String(staat.leners[i].lenersnummer) === n) return staat.leners[i];
  }
  return null;
}

/** "12 (Sam)": wat een vrijwilliger van een lener mag zien. */
function lenerNaam(staat, lenersnummer) {
  var l = lenerVan(staat, lenersnummer);
  return lenersnummer + (l && l.voornaam ? ' (' + l.voornaam + ')' : '');
}

function lopendeUitleningen(staat) {
  return staat.uitleningen.filter(function (u) { return u.exemplaar && isLeeg(u.datum_terug) && !u._verwijderen; });
}

function lopendeUitleningenVan(staat, lenersnummer) {
  return lopendeUitleningen(staat).filter(function (u) { return String(u.lenersnummer) === String(lenersnummer); });
}

function uitleningVanExemplaar(staat, exemplaar) {
  return lopendeUitleningen(staat).filter(function (u) { return u.exemplaar === exemplaar; })[0] || null;
}

function uitleningVan(staat, uitleningId) {
  return staat.uitleningen.filter(function (u) { return String(u.uitlening_id) === String(uitleningId); })[0] || null;
}

function reservatieVan(staat, reservatieId) {
  return staat.reservaties.filter(function (r) { return String(r.reservatie_id) === String(reservatieId); })[0] || null;
}

/** Reservaties die nog lopen (wacht of klaar), in volgorde van de wachtrij. */
function actieveReservaties(staat, boekId) {
  return staat.reservaties.filter(function (r) {
    return r.boek_id === boekId && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR);
  }).sort(function (a, b) {
    return String(a.datum_reservatie).localeCompare(String(b.datum_reservatie)) ||
      String(a.reservatie_id).localeCompare(String(b.reservatie_id));
  });
}

/* ---------- Nummers ---------- */

/**
 * Nieuw volgnummer. In de spreadsheet levert Api.js een teller die nooit terugtelt.
 * Zonder teller (in de tests) nemen we het hoogste bestaande nummer plus 1.
 */
function nieuwNummer(staat, soort, bestaande) {
  if (staat.nieuwNummer) return staat.nieuwNummer(soort, bestaande);
  var max = 0;
  bestaande.forEach(function (w) { max = Math.max(max, Number(String(w).replace(/\D/g, '')) || 0); });
  return max + 1;
}

/* ---------- Controle van invoer ---------- */

/** Tekstveld: opgeschoond en ingekort. */
function tekstInvoer(waarde, max) {
  return schoon(waarde).slice(0, max || 100);
}

/** Bedrag: een getal van 0 tot 1000, afgerond op centen. Geeft null bij ongeldige invoer. */
function bedragInvoer(waarde) {
  if (isLeeg(waarde)) return 0;
  var n = parseerGetal(waarde);
  if (n === null || n < 0 || n > 1000) return null;
  return Math.round(n * 100) / 100;
}

function geldigEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Telefoonnummer: cijfers, spaties, +, /, . en - ; minstens 8 cijfers. */
function geldigeTelefoon(t) {
  return /^[+0-9 ()\/.\-]{8,25}$/.test(t) && t.replace(/\D/g, '').length >= 8;
}

/** Telefoon vergelijkbaar maken: +32 470 12 34 56 en 0470/12.34.56 worden gelijk. */
function telefoonSleutel(t) {
  var c = String(t || '').replace(/\D/g, '');
  if (c.indexOf('0032') === 0) c = '0' + c.slice(4);
  else if (c.indexOf('32') === 0 && c.length === 11) c = '0' + c.slice(2);
  return c;
}

/**
 * Een Belgisch gsm-nummer in één vorm: 0495/64.48.48 (ook vanuit +32 495 64 48 48 of 0495644848).
 * Andere nummers (vast, buitenland) blijven zoals ze zijn.
 */
function opmaakGsm(t) {
  var c = telefoonSleutel(t);
  if (!/^04\d{8}$/.test(c)) return schoon(t);
  return c.slice(0, 4) + '/' + c.slice(4, 6) + '.' + c.slice(6, 8) + '.' + c.slice(8);
}

/** Zet de gsm-nummers van de leners in één vorm. Geeft het aantal aangepaste leners. */
function gsmNummersOpmaken(leners) {
  var n = 0;
  leners.forEach(function (l) {
    if (isLeeg(l.telefoon)) return;
    var nieuw = opmaakGsm(l.telefoon);
    if (nieuw !== String(l.telefoon)) { wijzig(l, { telefoon: nieuw }); n++; }
  });
  return n;
}

/* ---------- Grenzen ---------- */

/**
 * Controleert de grenzen. Zijn er overschreden en is er geen reden opgegeven,
 * dan geeft dit het antwoord terug dat de schermen een reden moeten vragen.
 * Met een reden worden de uitzonderingen genoteerd en geeft dit null terug.
 */
function behandelGrenzen(staat, actie, ctx, invoer) {
  ctx.staat = staat;
  ctx.inst = staat.inst;
  ctx.vandaag = staat.vandaag;
  var overschreden = controleerGrenzen(actie, ctx);
  if (!overschreden.length) return null;
  var reden = invoer.uitzondering ? tekstInvoer(invoer.uitzondering.reden, 300) : '';
  if (reden.length < 3) return { ok: false, grenzen: overschreden };
  overschreden.forEach(function (g) {
    staat.uitzonderingen.push({
      datum: staat.vandaag, wie: staat.wie, grens: g.naam,
      lenersnummer: ctx.lener ? ctx.lener.lenersnummer : (ctx.uitlening ? ctx.uitlening.lenersnummer : ''),
      boek_id: ctx.boek ? ctx.boek.boek_id : '',
      exemplaar: ctx.exemplaar || (ctx.uitlening ? ctx.uitlening.exemplaar : ''),
      reden: reden, actie: actie
    });
  });
  return null;
}

/* ---------- Reservaties doorgeven ---------- */

/**
 * Een exemplaar komt vrij (teruggebracht, reservatie vervallen of geannuleerd).
 * Wacht er iemand op dit boek, dan krijgt de eerste in de wachtrij dit exemplaar.
 * Geeft de melding voor de vrijwilliger terug, of null.
 */
function geefExemplaarDoor(staat, boekId, exemplaar) {
  var wachtend = actieveReservaties(staat, boekId).filter(function (r) { return r.status === STATUS_WACHT; });
  if (!wachtend.length) return null;
  var r = wachtend[0];
  wijzig(r, {
    status: STATUS_KLAAR, exemplaar: exemplaar, datum_klaar: staat.vandaag,
    ophalen_tot: berekenOphaalTermijn(staat.vandaag, staat.inst)
  });
  staat.log.push(['reservatie klaar', r.reservatie_id + ' ' + exemplaar + ' voor lener ' + r.lenersnummer]);
  return apartLeggenMelding(staat, r);
}

function apartLeggenMelding(staat, r) {
  return {
    reservatie_id: r.reservatie_id, exemplaar: r.exemplaar, lenersnummer: r.lenersnummer,
    tekst: 'Leg dit boek apart voor lener ' + lenerNaam(staat, r.lenersnummer),
    ophalen_tot: r.ophalen_tot,
    ophalenTekst: 'Ligt klaar tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
  };
}

/**
 * Zet klaarliggende reservaties die niet op tijd afgehaald werden op "vervallen"
 * en geeft het exemplaar door aan de volgende. Geeft de meldingen terug.
 */
function verwerkVervallenReservaties(staat) {
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_KLAAR && r.ophalen_tot && r.ophalen_tot < staat.vandaag) {
      wijzig(r, { status: STATUS_VERVALLEN, datum_afgesloten: staat.vandaag });
      staat.log.push(['reservatie vervallen', r.reservatie_id]);
      var m = geefExemplaarDoor(staat, r.boek_id, r.exemplaar);
      if (m) meldingen.push(m);
    }
  });
  return meldingen;
}

/* ---------- Acties ---------- */

/**
 * Uitlenen.
 * invoer: { exemplaar, lenersnummer, borg, betaalwijze, gift, uitzondering: { reden } }
 */
function uitlenen(staat, invoer) {
  var ex = exemplaarInfo(staat, invoer.exemplaar);
  if (!ex) return { ok: false, fout: 'Dit exemplaar bestaat niet.' };
  if (!isUitleenbaar(ex.boek)) return { ok: false, fout: nietUitleenbaarFout(ex.boek) };
  if (uitleningVanExemplaar(staat, ex.exemplaar)) return { ok: false, fout: 'Dit exemplaar is al uitgeleend. Kies een ander exemplaar of registreer eerst het terugbrengen.' };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief. Vraag het bestuur om de lener weer actief te zetten.' };
  var borg = bedragInvoer(invoer.borg);
  var gift = bedragInvoer(invoer.gift);
  if (borg === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de borg.' };
  if (gift === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de gift.' };
  var betaalwijze = tekstInvoer(invoer.betaalwijze, 20);
  if (borg > 0 && staat.inst.borg_betaalwijzen.indexOf(betaalwijze) === -1) {
    return { ok: false, fout: 'Kies hoe de borg betaald werd: ' + staat.inst.borg_betaalwijzen.join(' of ') + '.' };
  }

  var stop = behandelGrenzen(staat, 'uitlenen', { lener: lener, boek: ex.boek, exemplaar: ex.exemplaar }, invoer);
  if (stop) return stop;

  var verval = berekenVervaldatum(staat.vandaag, staat.inst);
  var u = voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: ex.exemplaar, boek_id: ex.boek.boek_id, lenersnummer: lener.lenersnummer,
    datum_uit: staat.vandaag, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg, betaalwijze_borg: borg > 0 ? betaalwijze : '',
    borg_terugbetaald: '', gift: gift || '', laatste_herinnering: '', vrijwilliger: staat.wie, bron: ''
  });

  // Had deze lener een reservatie voor dit boek? Dan is die nu afgehaald.
  var meldingen = [];
  actieveReservaties(staat, ex.boek.boek_id).forEach(function (r) {
    if (String(r.lenersnummer) !== String(lener.lenersnummer)) return;
    var vrijExemplaar = r.status === STATUS_KLAAR && r.exemplaar && r.exemplaar !== ex.exemplaar ? r.exemplaar : '';
    wijzig(r, { status: STATUS_AFGEHAALD, datum_afgesloten: staat.vandaag });
    // De lener nam een ander exemplaar mee dan het apart gelegde: dat gaat naar de volgende.
    if (vrijExemplaar) {
      var m = geefExemplaarDoor(staat, ex.boek.boek_id, vrijExemplaar);
      if (m) meldingen.push(m);
    }
  });

  staat.log.push(['uitlenen', u.uitlening_id + ' ' + u.exemplaar + ' aan lener ' + lener.lenersnummer]);
  return {
    ok: true,
    terugTekst: 'Breng terug tegen ' + datumTekst(verval, staat.vandaag),
    vervaldatum: verval,
    uitlening: uitleningInfo(staat, u),
    apartLeggen: meldingen
  };
}

/**
 * Terugbrengen.
 * invoer: { uitlening_id, borg_terugbetaald: true/false }
 */
var STATEN_TERUG = ['in orde', 'licht beschadigd', 'beschadigd'];

function terugbrengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var velden = { datum_terug: staat.vandaag };
  if (invoer.borg_terugbetaald === true && Number(u.borg) > 0) velden.borg_terugbetaald = staat.vandaag;
  // Staat van het boek: komt bij de uitlening, en bij schade ook in de notitie van het boek.
  var toestand = STATEN_TERUG.indexOf(invoer.staat_boek) > -1 ? invoer.staat_boek : '';
  var opmerking = tekstInvoer(invoer.opmerking, 200);
  if (toestand || opmerking) velden.staat_terug = [toestand, opmerking].filter(Boolean).join(': ');
  wijzig(u, velden);
  staat.log.push(['terugbrengen', u.uitlening_id + ' ' + u.exemplaar + (velden.staat_terug ? ' (' + velden.staat_terug + ')' : '')]);
  if ((toestand && toestand !== 'in orde') || (opmerking && toestand !== 'in orde')) {
    var b = boekVan(staat, u.boek_id);
    if (b) {
      var regel = staat.vandaag + ' ' + u.exemplaar + ': ' + velden.staat_terug;
      wijzig(b, { notitie: [schoonMetRegels(b.notitie), regel].filter(Boolean).join('\n') });
      staat.catalogusGewijzigd = true;
    }
  }
  var melding = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  var boek = boekVan(staat, u.boek_id);
  return {
    ok: true,
    tekst: '"' + (boek ? boek.titel : u.exemplaar) + '" is teruggebracht.' +
      (velden.borg_terugbetaald ? ' Borg van ' + bedragTekst(u.borg) + ' terugbetaald.' : (Number(u.borg) > 0 ? ' De borg staat nog open.' : '')),
    apartLeggen: melding ? [melding] : []
  };
}

/**
 * Bestuur: het uitgeleende boek is verloren. Sluit de uitlening af (staat_terug "verloren") en zet
 * de status van het boek op verloren, zodat het niet meer op de website staat en niet uitleenbaar is.
 * Heeft het boek meer exemplaren, dan blijft de status leeg en komt het in de notitie van het boek.
 * invoer: { uitlening_id, borg: 'ingehouden' | 'terugbetaald', opmerking }
 * Een ingehouden borg is een vergoeding: die telt niet mee bij de borgen die nog terug moeten.
 */
function boekVerloren(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var opmerking = tekstInvoer(invoer.opmerking, 200);
  var velden = { datum_terug: staat.vandaag, staat_terug: 'verloren' + (opmerking ? ': ' + opmerking : '') };
  var terugbetaald = invoer.borg === 'terugbetaald' && Number(u.borg) > 0;
  if (terugbetaald) velden.borg_terugbetaald = staat.vandaag;
  wijzig(u, velden);
  var boek = boekVan(staat, u.boek_id);
  var enkel = boek && aantalExemplaren(boek) <= 1;
  if (boek) {
    var regel = staat.vandaag + ' ' + u.exemplaar + ': verloren bij lener ' + u.lenersnummer + (opmerking ? ' (' + opmerking + ')' : '');
    var nieuw = { notitie: [schoonMetRegels(boek.notitie), regel].filter(Boolean).join('\n') };
    if (enkel) nieuw.status = 'verloren';
    wijzig(boek, nieuw);
    staat.catalogusGewijzigd = true;
  }
  staat.log.push(['verloren', u.uitlening_id + ' ' + u.exemplaar + (terugbetaald ? ', borg terugbetaald' : ', borg ingehouden')]);
  var titel = boek ? boek.titel : u.exemplaar;
  return {
    ok: true,
    tekst: '"' + titel + '" staat als verloren. De uitlening is afgesloten' +
      (Number(u.borg) > 0 ? (terugbetaald ? ' en de borg is terugbetaald.' : ', de borg van ' + bedragTekst(u.borg) + ' is ingehouden.') : '.') +
      (boek && !enkel ? ' Het boek heeft meer exemplaren: verlaag het aantal in de Catalogus als dit exemplaar niet terugkomt.' : '')
  };
}

/** Is deze uitlening afgesloten omdat het boek verloren is? */
function isVerlorenUitlening(u) {
  return /^verloren/i.test(String(u.staat_terug || ''));
}

/**
 * Verlengen.
 * invoer: { uitlening_id, uitzondering: { reden } }
 */
function verlengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var stop = behandelGrenzen(staat, 'verlengen', { uitlening: u, boek: boekVan(staat, u.boek_id), lener: lenerVan(staat, u.lenersnummer) }, invoer);
  if (stop) return stop;
  var nieuw = berekenVerlenging(u.vervaldatum, staat.inst);
  wijzig(u, {
    vervaldatum: nieuw,
    vorige_vervaldatum: u.vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0) + 1,
    datum_verlenging: staat.vandaag,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum || u.vervaldatum
  });
  staat.log.push(['verlengen', u.uitlening_id + ' tot ' + nieuw]);
  return { ok: true, terugTekst: 'Nieuwe datum: breng terug tegen ' + datumTekst(nieuw, staat.vandaag), vervaldatum: nieuw, uitlening: uitleningInfo(staat, u) };
}

/* ---------- Een uitlening aanpassen of annuleren ---------- */

var ANNULEREN_MAX_DAGEN = 7; // een vrijwilliger annuleert enkel uitleningen van de laatste 7 dagen

/**
 * Het bestuur verschuift de vervaldatum met een aantal dagen (bv. 7 extra, of -7).
 * Staat terugbrengdatum_op_openingsdag aan, dan schuift de datum door naar de eerstvolgende openingsdag.
 * Telt niet als verlenging. invoer: { uitlening_id, dagen }
 */
function vervaldatumAanpassen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var dagen = parseerGetal(invoer.dagen);
  if (dagen === null || dagen !== Math.round(dagen) || dagen === 0 || Math.abs(dagen) > 365) return { ok: false, fout: 'Vul een aantal dagen in, bv. 7 (of -7 om in te korten).' };
  var nieuw = telDagenOp(parseerDatum(u.vervaldatum), dagen);
  if (staat.inst.terugbrengdatum_op_openingsdag) nieuw = volgendeOpeningsdag(nieuw, staat.inst, true);
  if (nieuw <= parseerDatum(u.datum_uit)) return { ok: false, fout: 'De nieuwe datum valt voor of op de dag van de uitlening.' };
  var oud = parseerDatum(u.vervaldatum);
  wijzig(u, { vervaldatum: nieuw });
  staat.log.push(['vervaldatum aangepast', u.uitlening_id + ' ' + u.exemplaar + ': ' + oud + ' wordt ' + nieuw + ' (' + (dagen > 0 ? '+' : '') + dagen + ' dagen)']);
  return { ok: true, tekst: '"' + boekTitel(staat, u) + '" moet nu terug tegen ' + datumTekst(nieuw, staat.vandaag) + '.', vervaldatum: nieuw };
}

function boekTitel(staat, u) {
  var b = boekVan(staat, u.boek_id);
  return b ? schoon(b.titel) : String(u.exemplaar);
}

/**
 * Een uitlening annuleren, bv. na een vergissing aan de balie. De uitlening verdwijnt, alsof ze
 * nooit gebeurde. Een reservatie die ze afsloot, gaat terug open. invoer: { uitlening_id }
 * magOud: het bestuur mag ook oudere uitleningen annuleren, een vrijwilliger enkel die van de laatste 7 dagen.
 */
function annuleerUitlening(staat, invoer, magOud) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht. Een teruggebracht boek annuleer je niet.' };
  var uit = parseerDatum(u.datum_uit);
  if (!magOud && uit && dagenTussen(uit, staat.vandaag) > ANNULEREN_MAX_DAGEN) {
    return { ok: false, fout: 'Deze uitlening is ouder dan ' + ANNULEREN_MAX_DAGEN + ' dagen. Breng het boek terug, of vraag het bestuur om ze te annuleren.' };
  }
  markeerVerwijderen(u);
  // Een reservatie die door deze uitlening afgesloten werd, gaat terug in de wachtrij.
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_AFGEHAALD && String(r.boek_id) === String(u.boek_id) && String(r.lenersnummer) === String(u.lenersnummer) &&
      parseerDatum(r.datum_afgesloten) === uit) {
      wijzig(r, { status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '' });
    }
  });
  // Het exemplaar is terug vrij: wacht er iemand op dit boek, dan ligt het voor die persoon apart.
  var m = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  if (m) meldingen.push(m);
  staat.log.push(['uitlening geannuleerd', u.uitlening_id + ' ' + u.exemplaar + ' (lener ' + u.lenersnummer + ', uit op ' + uit + ')']);
  var borg = Number(u.borg || 0), gift = Number(u.gift || 0);
  var geld = [borg > 0 ? 'de borg van ' + bedragTekst(borg) : '', gift > 0 ? 'de gift van ' + bedragTekst(gift) : ''].filter(Boolean);
  return { ok: true, apartLeggen: meldingen,
    tekst: 'De uitlening van "' + boekTitel(staat, u) + '" is geannuleerd.' + (geld.length ? ' Geef ' + geld.join(' en ') + ' terug.' : '') };
}

/** De laatste verlenging ongedaan maken: de vervaldatum van voor die verlenging komt terug. invoer: { uitlening_id } */
function annuleerVerlenging(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var aantal = Number(u.aantal_verlengingen || 0);
  if (aantal < 1) return { ok: false, fout: 'Deze uitlening werd niet verlengd.' };
  var vorige = parseerDatum(u.vorige_vervaldatum) || (aantal === 1 ? parseerDatum(u.oorspronkelijke_vervaldatum) : '');
  if (!vorige) return { ok: false, fout: 'De datum van voor de verlenging is niet bewaard. Vraag het bestuur om de vervaldatum aan te passen.' };
  var oud = parseerDatum(u.vervaldatum);
  wijzig(u, { vervaldatum: vorige, vorige_vervaldatum: '', aantal_verlengingen: aantal - 1, datum_verlenging: aantal - 1 ? u.datum_verlenging : '' });
  staat.log.push(['verlenging geannuleerd', u.uitlening_id + ' ' + u.exemplaar + ': ' + oud + ' wordt ' + vorige]);
  return { ok: true, tekst: 'De verlenging van "' + boekTitel(staat, u) + '" is geannuleerd. Het moet terug tegen ' + datumTekst(vorige, staat.vandaag) + '.', vervaldatum: vorige };
}

/**
 * Reserveren: zet een lener in de wachtrij voor een boek.
 * invoer: { boek_id, lenersnummer }
 */
function reserveren(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isUitleenbaar(boek)) return { ok: false, fout: nietUitleenbaarFout(boek) };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief.' };
  var actief = actieveReservaties(staat, boek.boek_id);
  if (actief.some(function (r) { return String(r.lenersnummer) === String(lener.lenersnummer); })) {
    return { ok: false, fout: 'Deze lener staat al in de wachtrij voor dit boek.' };
  }
  if (lopendeUitleningenVan(staat, lener.lenersnummer).some(function (u) { return u.boek_id === boek.boek_id; })) {
    return { ok: false, fout: 'Deze lener heeft dit boek nu zelf in huis.' };
  }
  var b = beschikbaarheid(staat, boek);
  if (b.beschikbaar > 0) return { ok: false, fout: 'Er staat een exemplaar in de bib. Je kan het meteen uitlenen.' };
  var r = voegToe(staat.reservaties, {
    reservatie_id: 'R' + metNullen(nieuwNummer(staat, 'reservatie', staat.reservaties.map(function (x) { return x.reservatie_id; })), 4),
    boek_id: boek.boek_id, lenersnummer: lener.lenersnummer, datum_reservatie: staat.vandaag,
    status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '', vrijwilliger: staat.wie
  });
  staat.log.push(['reserveren', r.reservatie_id + ' ' + boek.boek_id + ' voor lener ' + lener.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + lenerNaam(staat, lener.lenersnummer) + ' staat op plaats ' + (actief.length + 1) + ' in de wachtrij voor "' + boek.titel + '".' };
}

/** Een reservatie annuleren. Lag het boek al klaar, dan gaat het naar de volgende. */
function annuleerReservatie(staat, invoer) {
  var r = reservatieVan(staat, invoer.reservatie_id);
  if (!r) return { ok: false, fout: 'Deze reservatie bestaat niet.' };
  if (r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR) return { ok: false, fout: 'Deze reservatie is al afgesloten.' };
  var lag = r.status === STATUS_KLAAR ? r.exemplaar : '';
  wijzig(r, { status: STATUS_GEANNULEERD, datum_afgesloten: staat.vandaag });
  staat.log.push(['reservatie geannuleerd', r.reservatie_id]);
  var melding = lag ? geefExemplaarDoor(staat, r.boek_id, lag) : null;
  return { ok: true, tekst: 'Reservatie geannuleerd.' + (lag && !melding ? ' Het boek mag terug in de kast.' : ''), apartLeggen: melding ? [melding] : [] };
}

/**
 * Nieuwe lener inschrijven.
 * invoer: { voornaam, achternaam, telefoon, email, toestemming }
 */
function nieuweLener(staat, invoer) {
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var achternaamWaarde = tekstInvoer(invoer.achternaam, 80);
  var telefoon = opmaakGsm(tekstInvoer(invoer.telefoon, 25));
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Zonder toestemming voor de privacyverklaring kunnen we geen gegevens bewaren.' };
  var dubbel = staat.leners.filter(function (l) {
    return (email && String(l.email).toLowerCase() === email) || (telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(telefoon));
  })[0];
  if (dubbel) return { ok: false, fout: 'Deze persoon is al ingeschreven als lener ' + lenerNaam(staat, dubbel.lenersnummer) + '.' };
  var nummer = nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }));
  voegToe(staat.leners, {
    lenersnummer: nummer, voornaam: voornaam, achternaam: achternaamWaarde, telefoon: telefoon, email: email,
    datum_inschrijving: staat.vandaag, toestemming_privacy: 'ja', actief: 'ja'
  });
  staat.log.push(['nieuwe lener', 'lener ' + nummer]);
  return { ok: true, lenersnummer: nummer, voornaam: voornaam, tekst: 'Lenersnummer ' + nummer };
}

/** Bestuur: de borg van een uitlening als terugbetaald noteren. */
function borgTerugbetaald(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.borg_terugbetaald)) return { ok: false, fout: 'Deze borg is al terugbetaald.' };
  wijzig(u, { borg_terugbetaald: staat.vandaag });
  staat.log.push(['borg terugbetaald', u.uitlening_id]);
  return { ok: true, tekst: 'Borg genoteerd als terugbetaald.' };
}

/** Bestuur: noteren dat een herinnering verstuurd werd. */
function herinneringVerstuurd(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  wijzig(u, { laatste_herinnering: staat.vandaag });
  staat.log.push(['herinnering verstuurd', u.uitlening_id]);
  return { ok: true, tekst: 'Herinnering genoteerd op ' + korteDatum(staat.vandaag) + '.' };
}

/**
 * Bestuur: gegevens van een lener aanpassen of op inactief zetten.
 * invoer: { lenersnummer, voornaam, achternaam, telefoon, email, actief }
 */
function lenerAanpassen(staat, invoer) {
  var l = lenerVan(staat, invoer.lenersnummer);
  if (!l) return { ok: false, fout: 'Deze lener bestaat niet.' };
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var telefoon = opmaakGsm(tekstInvoer(invoer.telefoon, 25));
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  var velden = {
    voornaam: voornaam, achternaam: tekstInvoer(invoer.achternaam, 80), telefoon: telefoon, email: email,
    actief: invoer.actief === false ? 'nee' : 'ja'
  };
  if (invoer.hasOwnProperty('notitie')) velden.notitie = tekstInvoer(invoer.notitie, 500);
  wijzig(l, velden);
  staat.log.push(['lener aangepast', 'lener ' + l.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + l.lenersnummer + ' is bijgewerkt.' };
}

/* ---------- Informatie voor de schermen ---------- */

function bedragTekst(n) {
  var b = Number(n || 0);
  return (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ',')) + ' euro';
}

/**
 * Een uitlening zoals de schermen ze tonen.
 * metContact: true enkel voor het bestuur (telefoon, e-mail, achternaam).
 */
function uitleningInfo(staat, u, metContact) {
  var boek = boekVan(staat, u.boek_id);
  var lener = lenerVan(staat, u.lenersnummer);
  var info = {
    uitlening_id: u.uitlening_id, exemplaar: u.exemplaar, boek_id: u.boek_id,
    titel: boek ? boek.titel : '(onbekend boek)', auteur: boek ? boek.auteur : '',
    lenersnummer: u.lenersnummer, voornaam: lener ? lener.voornaam : '',
    datum_uit: u.datum_uit, vervaldatum: u.vervaldatum,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0),
    borg: Number(u.borg || 0), betaalwijze_borg: u.betaalwijze_borg,
    status: isLeeg(u.datum_terug) ? uitleenStatus(u, staat.vandaag, staat.inst) : null
  };
  if (metContact) {
    info.achternaam = lener ? lener.achternaam : '';
    info.telefoon = lener ? lener.telefoon : '';
    info.email = lener ? lener.email : '';
    info.laatste_herinnering = u.laatste_herinnering;
  }
  return info;
}

/**
 * Beschikbaarheid van een boek voor de publieke catalogus.
 * Geeft { code, label, totaal, beschikbaar, terug } terug. Nooit wie het boek heeft.
 *   code: 'beschikbaar', 'uitgeleend', 'gereserveerd' of 'niet_uitleenbaar'
 */
function beschikbaarheid(staat, boek) {
  var totaal = aantalExemplaren(boek);
  if (!isUitleenbaar(boek)) {
    var teKoop = normaliseerTekst(boek.genre) === 'verkoop' || jaNee(boek.te_koop) === 'ja';
    return { code: 'niet_uitleenbaar', label: teKoop ? 'Te koop in de bib, niet uitleenbaar' : 'Niet uitleenbaar', totaal: totaal, beschikbaar: 0, terug: '' };
  }
  var uit = lopendeUitleningen(staat).filter(function (u) { return u.boek_id === boek.boek_id; });
  var reservaties = actieveReservaties(staat, boek.boek_id);
  var apart = reservaties.filter(function (r) { return r.status === STATUS_KLAAR; }).length;
  var wacht = reservaties.length - apart;
  var vrij = Math.max(0, totaal - uit.length - apart);
  var terug = uit.map(function (u) { return u.vervaldatum; }).sort()[0] || '';
  if (vrij > 0) {
    return { code: 'beschikbaar', label: totaal > 1 ? vrij + ' van ' + totaal + ' beschikbaar' : 'Beschikbaar', totaal: totaal, beschikbaar: vrij, terug: '' };
  }
  if (apart > 0 || wacht > 0) {
    return { code: 'gereserveerd', label: 'Gereserveerd', totaal: totaal, beschikbaar: 0, terug: terug };
  }
  var label = terug && terug >= staat.vandaag ? 'Uitgeleend, verwacht terug op ' + datumTekst(terug, staat.vandaag) : 'Uitgeleend';
  return { code: 'uitgeleend', label: label, totaal: totaal, beschikbaar: 0, terug: terug };
}
