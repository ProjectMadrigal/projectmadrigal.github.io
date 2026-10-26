/**
 * Bestuur.js
 * De gegevens voor het uitleenscherm (balie) en het bestuursscherm.
 * De balie ziet van een lener enkel voornaam en lenersnummer.
 * Het bestuur ziet ook de contactgegevens.
 */

/** Korte lijst van alle boeken voor het uitleenscherm, ook de niet-publieke. */
function baliecatalogus(staat, vertaal) {
  return staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && !isLeeg(b.titel); }).map(function (b) {
    var info = {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), i: schoon(b.isbn),
      x: aantalExemplaren(b), u: isUitleenbaar(b), c: !isLeeg(b.cover_url)
    };
    // ll: de leeslijsten van het boek, voor het onderdeel Leeslijsten van het bestuursscherm.
    var ll = splitsLijst(b.leeslijsten);
    if (ll.length) info.ll = ll;
    // g: de onderwerpen (filtergroepen), enkel voor het bestuursscherm (filter bij Leeslijsten).
    if (vertaal) {
      var g = filtergroepenVan(b, vertaal);
      if (g.length) info.g = g;
      // zb: zonder beschrijving, voor de lijst Boeken zonder beschrijving van het bestuursscherm.
      if (isLeeg(b.beschrijving)) info.zb = true;
    }
    // st: zodat de vrijwilliger het weet. Gevoelig (verborgen of zichtbaar) mag je gewoon uitlenen.
    var status = boekStatus(b);
    if (status === 'verloren') info.st = 'verloren';
    else if (status) info.st = 'gevoelig';
    return info;
  });
}

/** Boeken met een status, per status, voor het bestuursscherm. */
function boekenMetStatus(staat) {
  var lijsten = { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] };
  staat.catalogus.forEach(function (b) {
    var s = boekStatus(b);
    if (!s || isLeeg(b.boek_id)) return;
    lijsten[s].push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur) });
  });
  Object.keys(lijsten).forEach(function (k) {
    lijsten[k].sort(function (a, b) { return a.titel.localeCompare(b.titel); });
  });
  return lijsten;
}

/** Reservatie zoals de schermen ze tonen. */
function reservatieInfo(staat, r, plaats) {
  var boek = boekVan(staat, r.boek_id);
  return {
    reservatie_id: r.reservatie_id, boek_id: r.boek_id, titel: boek ? boek.titel : r.boek_id,
    lenersnummer: r.lenersnummer, voornaam: (lenerVan(staat, r.lenersnummer) || {}).voornaam || '',
    datum_reservatie: r.datum_reservatie, status: r.status, exemplaar: r.exemplaar,
    ophalen_tot: r.ophalen_tot, plaats: plaats,
    tekst: r.status === STATUS_KLAAR
      ? 'Ligt apart (' + r.exemplaar + ') tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
      : 'Wacht sinds ' + datumTekst(r.datum_reservatie, staat.vandaag) + ', plaats ' + plaats + ' in de wachtrij'
  };
}

/** Alle lopende reservaties, met hun plaats in de wachtrij. */
function alleReservaties(staat) {
  var perBoek = {};
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_WACHT || r.status === STATUS_KLAAR) perBoek[r.boek_id] = true;
  });
  var lijst = [];
  Object.keys(perBoek).forEach(function (boekId) {
    actieveReservaties(staat, boekId).forEach(function (r, i) { lijst.push(reservatieInfo(staat, r, i + 1)); });
  });
  return lijst;
}

/** Gegevens voor het uitleenscherm. */
function balieGegevens(staat) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, false); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    instellingen: {
      borg_per_boek: staat.inst.borg_per_boek,
      borg_betaalwijzen: staat.inst.borg_betaalwijzen,
      gift_mogelijk: staat.inst.gift_mogelijk,
      max_boeken_per_lener: staat.inst.max_boeken_per_lener,
      checklist_uitlenen: checklistPunten(staat.inst.tekst_checklist_uitlenen)
    },
    privacy: staat.inst.tekst_privacy,
    boeken: baliecatalogus(staat),
    leners: staat.leners.filter(function (l) { return jaNee(l.actief) !== 'nee'; }).map(function (l) {
      return { n: l.lenersnummer, v: l.voornaam };
    }),
    lopend: lopend,
    reservaties: alleReservaties(staat)
  };
}

/** Vult de herinneringstekst in voor een uitlening. */
function herinneringTekst(sjabloon, info, staat) {
  return String(sjabloon || '')
    .replace(/\{voornaam\}/g, info.voornaam || '')
    .replace(/\{titel\}/g, info.titel || '')
    .replace(/\{vervaldatum\}/g, datumTekst(info.vervaldatum, staat.vandaag));
}

/** "2026-11" naar "november 2026". */
function maandTekst(jjjjmm) {
  var d = jjjjmm.split('-');
  return MAANDEN[Number(d[1]) - 1] + ' ' + d[0];
}

/**
 * Gegevens voor het vrijwilligersscherm: lopende uitleningen en reservaties zonder contactgegevens
 * of borg, en de boeken (voor covers en leeslijsten). Geen leners, borgen of cijfers.
 */
function vrijwilligerGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) {
    var info = uitleningInfo(staat, u, false);
    delete info.borg;
    delete info.betaalwijze_borg;
    return info;
  });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    reservaties: alleReservaties(staat),
    boeken: baliecatalogus(staat, vertaalTabel(onderwerpRijen)),
    roosterLink: String(staat.inst.rooster_link || '')
  };
}

/** Gegevens voor het bestuursscherm. */
function bestuurGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, true); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  lopend.forEach(function (info) {
    var sjabloon = info.status.code === 'telaat' ? staat.inst.tekst_herinnering : staat.inst.tekst_herinnering_binnenkort;
    info.herinnering = herinneringTekst(sjabloon, info, staat);
  });

  // Borgen: ingehouden (borg betaald en nog niet terug) per betaalwijze.
  var ingehouden = { totaal: 0, perBetaalwijze: {} };
  var terugTeBetalen = [];
  staat.uitleningen.forEach(function (u) {
    var borg = Number(u.borg || 0);
    // Een borg die bij een verloren boek ingehouden werd, is een vergoeding: die moet niet meer terug.
    if (borg <= 0 || !isLeeg(u.borg_terugbetaald) || isVerlorenUitlening(u)) return;
    var wijze = u.betaalwijze_borg || 'onbekend';
    ingehouden.totaal += borg;
    ingehouden.perBetaalwijze[wijze] = (ingehouden.perBetaalwijze[wijze] || 0) + borg;
    // Boek is terug, maar de borg nog niet: die moet nog terugbetaald worden.
    if (!isLeeg(u.datum_terug)) {
      var info = uitleningInfo(staat, u, true);
      info.datum_terug = u.datum_terug;
      terugTeBetalen.push(info);
    }
  });

  // Giften en uitleningen per maand, voor de laatste 12 maanden.
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), uitleningen: 0, giften: 0 };
  }
  var vertaal = vertaalTabel(onderwerpRijen);
  // Per jaar: alles wat bewaard is (ook ouder dan 12 maanden).
  var perJaar = {};
  staat.uitleningen.forEach(function (u) {
    var datum = parseerDatum(u.datum_uit) || '';
    var maand = datum.slice(0, 7);
    if (perMaand[maand]) {
      perMaand[maand].uitleningen++;
      perMaand[maand].giften += Number(u.gift || 0);
    }
    var jaar = datum.slice(0, 4);
    if (!jaar) return;
    perJaar[jaar] = perJaar[jaar] || { jaar: Number(jaar), uitleningen: 0, giften: 0 };
    perJaar[jaar].uitleningen++;
    perJaar[jaar].giften += Number(u.gift || 0);
  });

  // Uitzonderingen van de laatste 6 maanden, nieuwste eerst.
  var grens = telMaandenOp(staat.vandaag, -6);
  var uitzonderingen = (staat.uitzonderingenTabel || []).filter(function (x) { return String(x.datum) >= grens; }).map(function (x) {
    var b = boekVan(staat, x.boek_id);
    return {
      datum: x.datum, wie: x.wie, grens: x.grens, lenersnummer: x.lenersnummer,
      voornaam: (lenerVan(staat, x.lenersnummer) || {}).voornaam || '',
      titel: b ? b.titel : x.boek_id, reden: x.reden, actie: x.actie
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });

  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    borgen: {
      ingehouden: ingehouden,
      terugTeBetalen: terugTeBetalen
    },
    perMaand: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    perJaar: Object.keys(perJaar).sort().reverse().map(function (k) { return perJaar[k]; }),
    reservaties: alleReservaties(staat),
    uitzonderingen: uitzonderingen,
    boekstatus: boekenMetStatus(staat),
    privacy: staat.inst.tekst_privacy,
    boeken: baliecatalogus(staat, vertaal),
    leners: staat.leners.map(function (l) {
      return {
        lenersnummer: l.lenersnummer, voornaam: l.voornaam, achternaam: l.achternaam, telefoon: l.telefoon,
        email: l.email, datum_inschrijving: l.datum_inschrijving, toestemming_privacy: l.toestemming_privacy,
        actief: jaNee(l.actief) !== 'nee', notitie: schoonMetRegels(l.notitie),
        lopend: lopendeUitleningenVan(staat, l.lenersnummer).length
      };
    })
  };
}

/**
 * De zwaardere cijfers (meest geleend, per filtergroep, leners en collectie). Apart van bestuurData,
 * zodat het bestuursscherm sneller opent: deze cijfers laden pas als je Cijfers opent.
 */
function bestuurCijfers(staat, onderwerpRijen) {
  var perBoek = {}, perGroep = {};
  var vertaal = vertaalTabel(onderwerpRijen);
  staat.uitleningen.forEach(function (u) {
    perBoek[u.boek_id] = (perBoek[u.boek_id] || 0) + 1;
    var boek = boekVan(staat, u.boek_id);
    if (boek) filtergroepenVan(boek, vertaal).forEach(function (g) { perGroep[g] = (perGroep[g] || 0) + 1; });
  });
  var meestGeleend = Object.keys(perBoek).sort(function (a, b) { return perBoek[b] - perBoek[a]; }).slice(0, 10).map(function (id) {
    var b = boekVan(staat, id);
    return { boek_id: id, titel: b ? b.titel : id, auteur: b ? b.auteur : '', aantal: perBoek[id] };
  });
  var groepen = Object.keys(perGroep).sort(function (a, b) { return perGroep[b] - perGroep[a]; }).map(function (g) {
    return { groep: g, aantal: perGroep[g] };
  });
  return { meestGeleend: meestGeleend, groepen: groepen, extraCijfers: extraCijfers(staat) };
}
