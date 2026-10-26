/**
 * Overzetten.js
 * Eenmalig: neemt de uitleningen over uit het oude digitale uitleenblad.
 *
 *   - Enkel boeken die nog niet terug zijn, komen mee. Terug is: een datum in "boek terug op...",
 *     of "ok" in de kolom zonder naam vooraan (kolom A van het oude blad). "nok" of leeg: nog niet terug.
 *     De voorbeeldrij (vb.) slaan we over.
 *   - In "reminder mail" staat soms enkel "ok": dan was er een herinnering, maar we weten niet wanneer.
 *     We nemen dan de afgesproken terugbrengdatum als datum van de laatste herinnering.
 *   - Het boek wordt gezocht op titel en auteur, met een tolerante vergelijking.
 *     Twijfel? Dan komt het in "Na te kijken" en registreer je die uitlening
 *     zelf via het uitleenscherm.
 *   - Per persoon komt er één lener, herkend op e-mail of telefoon.
 *   - De borg en de datum van de laatste herinnering komen mee.
 *   - Je mag dit opnieuw uitvoeren: wat al overgenomen is, komt er niet dubbel in.
 *
 *   - Ook de teruggebrachte uitleningen (de historiek) komen mee, voor de cijfers. Zoals het systeem
 *     het zelf zou bewaren: teruggebracht binnen de bewaartermijn (bewaartermijn_afgesloten_uitleningen_maanden)
 *     met de lener, ouder zonder lener (enkel het boek en de datums). Een boek dat het script niet
 *     zeker vindt, slaat het voor de historiek over.
 *
 *   - Datums zonder jaar: in het oude blad staan veel datums als "26/11". Google koos daar zelf een jaar
 *     bij, soms het verkeerde. De kolom "datum terug" is een formule (=DATEVALUE(I12+28+28)) die bij het
 *     importeren het jaar van vandaag kreeg. Het script rekent die datum zelf uit de formule uit, en zet
 *     een datum ontlening die later valt dan de rijen eronder (de lijst is chronologisch) een jaar terug.
 *     Wat al overgenomen is, krijgt bij een nieuwe run de herstelde datums.
 *
 * Dit script past het oude blad niet aan.
 */

/** Zoekt een kolom in de kop van het oude blad, op het begin van de naam. */
function oudeKolom(kop, begin) {
  for (var i = 0; i < kop.length; i++) if (kop[i].indexOf(begin) === 0) return i;
  return -1;
}

/**
 * Het aantal dagen uit een formule als =DATEVALUE(I12+28+28) of =I12+28, als die naar de eigen rij
 * verwijst. Geeft null als het geen zo'n formule is.
 */
function dagenUitFormule(formule, rijnummer) {
  var m = String(formule || '').replace(/\s+/g, '').match(/^=(?:DATEVALUE\()?[A-Z]+(\d+)((?:\+\d+)+)\)?$/i);
  if (!m || Number(m[1]) !== rijnummer) return null;
  return m[2].split('+').filter(Boolean).reduce(function (som, n) { return som + Number(n); }, 0);
}

/** Schuift een datum per jaar op tot ze op of na "vanaf" valt en minder dan een jaar later. */
function binnenJaarNa(datum, vanaf) {
  if (!datum || !vanaf) return datum;
  for (var i = 0; i < 5 && dagenTussen(vanaf, datum) < 0; i++) datum = telMaandenOp(datum, 12);
  for (var j = 0; j < 5 && dagenTussen(vanaf, datum) > 365; j++) datum = telMaandenOp(datum, -12);
  return datum;
}

/**
 * Herstelt de jaartallen van het oude blad (zie bovenaan). Van onder naar boven, zodat elke rij
 * vergelijkt met rijen eronder die al hersteld zijn.
 */
function herstelOudeDatums(rijen) {
  for (var i = rijen.length - 1; i >= 0; i--) {
    var o = rijen[i];
    if (!o.datum_uit) continue;
    // 1. Later dan de volgende rijen? Dan een jaar te laat ingevuld.
    var volgende = rijen.slice(i + 1, i + 11).map(function (x) { return x.datum_uit; }).filter(Boolean).sort()[0];
    for (var n = 0; n < 3 && volgende && dagenTussen(volgende, o.datum_uit) > 90; n++) o.datum_uit = telMaandenOp(o.datum_uit, -12);
    // 2. Terug vóór de ontlening? Dan de ontlening een jaar vroeger als dat past, anders de terugdatum later.
    var terug = o.terug_op === 'ok' ? '' : parseerDatum(o.terug_op);
    if (terug && terug < o.datum_uit && telMaandenOp(o.datum_uit, -12) <= terug) o.datum_uit = telMaandenOp(o.datum_uit, -12);
    if (terug) o.terug_op = binnenJaarNa(terug, o.datum_uit);
    // 3. De afgesproken datum: uit de formule, anders binnen het jaar na de ontlening.
    o.datum_terug_afgesproken = o.dagen_formule !== null ? telDagenOp(o.datum_uit, o.dagen_formule) : binnenJaarNa(o.datum_terug_afgesproken, o.datum_uit);
    if (o.herinnering_ok) o.herinnering = o.datum_terug_afgesproken;
  }
  rijen.forEach(function (o) { delete o.dagen_formule; delete o.herinnering_ok; });
  return rijen;
}

/**
 * Zet de waarden van het oude blad om naar objecten met vaste namen.
 * formules (getFormulas van hetzelfde bereik) mag ontbreken.
 */
function leesOudeUitleningen(waarden, formules) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(10, waarden.length); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'boek'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(normaliseerTekst);
  var k = {
    boek: oudeKolom(kop, 'boek'), auteur: oudeKolom(kop, 'auteur'), voornaam: oudeKolom(kop, 'voornaam'),
    achternaam: oudeKolom(kop, 'achternaam'), telefoon: oudeKolom(kop, 'telefoon'), email: oudeKolom(kop, 'e mail') > -1 ? oudeKolom(kop, 'e mail') : oudeKolom(kop, 'email'),
    datum_uit: oudeKolom(kop, 'datum ontlening'), datum_terug_afgesproken: oudeKolom(kop, 'datum terug'),
    borg: oudeKolom(kop, 'borg'), gift: oudeKolom(kop, 'gift'), herinnering: oudeKolom(kop, 'reminder'),
    terug_op: oudeKolom(kop, 'boek terug op'),
    // Kolom A (zonder naam, vóór de kolom Boek): "ok" als het boek terug is.
    status: kop[0] === '' && oudeKolom(kop, 'boek') > 0 ? 0 : -1
  };
  var rijen = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (naam) { return k[naam] > -1 ? rij[k[naam]] : ''; };
    if (isLeeg(lees('boek'))) continue;
    var status = normaliseerTekst(lees('status'));
    if (/^vb/.test(status)) continue; // de voorbeeldrij bovenaan
    var herinnering = lees('herinnering');
    var formule = formules && formules[i] && k.datum_terug_afgesproken > -1 ? formules[i][k.datum_terug_afgesproken] : '';
    rijen.push({
      rijnummer: i + 1,
      boek: schoon(lees('boek')), auteur: schoon(lees('auteur')),
      voornaam: schoon(lees('voornaam')), achternaam: schoon(lees('achternaam')),
      telefoon: schoon(lees('telefoon')), email: schoon(lees('email')).toLowerCase(),
      datum_uit: parseerDatum(lees('datum_uit')), datum_terug_afgesproken: parseerDatum(lees('datum_terug_afgesproken')),
      borg: lees('borg'), gift: lees('gift'),
      herinnering: parseerDatum(herinnering) || (normaliseerTekst(herinnering) === 'ok' ? parseerDatum(lees('datum_terug_afgesproken')) : ''),
      herinnering_ok: !parseerDatum(herinnering) && normaliseerTekst(herinnering) === 'ok',
      terug_op: isLeeg(lees('terug_op')) && status === 'ok' ? 'ok' : lees('terug_op'),
      dagen_formule: dagenUitFormule(formule, i + 1)
    });
  }
  return herstelOudeDatums(rijen);
}

/** Leest de borg uit tekst als "5 cash", "€5 QR" of "QR". */
function leesBorg(waarde, inst) {
  var bedrag = parseerGetal(waarde);
  var t = normaliseerTekst(waarde);
  var wijze = '';
  inst.borg_betaalwijzen.forEach(function (w) { if (t.indexOf(normaliseerTekst(w)) > -1) wijze = w; });
  if (bedrag === null && wijze) bedrag = inst.borg_per_boek;
  return { bedrag: bedrag || 0, betaalwijze: wijze };
}

/**
 * Zoekt een boek in de Catalogus op titel en auteur.
 * Geeft { zeker: boek } of { twijfel: [boeken] } of {} terug.
 * soepel (voor de historiek, enkel voor de cijfers): de beste kandidaat met de juiste auteur telt als zeker,
 * ook bij een titel die wat verschilt of als het boek twee keer in de Catalogus staat.
 */
function zoekBoekOpTitel(catalogus, titel, auteur, soepel) {
  var sleutel = titelSleutel(titel);
  var naam = achternaam(auteur);
  if (!sleutel) return {};
  var kandidaten = [];
  catalogus.forEach(function (b) {
    var s = titelSleutel(b.titel);
    if (!s) return;
    var gelijk = gelijkenis(s, sleutel);
    var bevat = (s.length >= 5 && sleutel.indexOf(s) > -1) || (sleutel.length >= 5 && s.indexOf(sleutel) > -1);
    if (gelijk < 0.8 && !bevat) return;
    var auteurOk = !naam || levenshtein(achternaam(b.auteur), naam) <= 1;
    kandidaten.push({ boek: b, score: gelijk, auteurOk: auteurOk });
  });
  var zeker = kandidaten.filter(function (k) { return k.score >= 0.95 && k.auteurOk; });
  if (zeker.length === 1) return { zeker: zeker[0].boek };
  if (soepel && naam) {
    var goed = kandidaten.filter(function (k) { return k.auteurOk; }).sort(function (a, b) { return b.score - a.score; });
    if (goed.length) return { zeker: goed[0].boek };
  }
  if (!kandidaten.length) return {};
  kandidaten.sort(function (a, b) { return b.score - a.score; });
  return { twijfel: kandidaten.slice(0, 3).map(function (k) { return k.boek; }) };
}

/**
 * Boeken die het bestuur zelf koos in Na te kijken: een enkel boek-ID in de kolom boek_id bij een
 * regel van de historiek of van een lopende uitlening. Geeft { 'oud blad rij 12': 'B0034' }.
 */
function gekozenOudeBoeken(naTeKijkenRijen) {
  var uit = {};
  (naTeKijkenRijen || []).forEach(function (r) {
    if (r.bron !== 'Overzetten' || (r.veld !== 'historiek' && r.veld !== 'uitlening') || jaNee(r.afgehandeld) === 'ja') return;
    var m = String(r.waarde_bron || '').match(/\[(oud blad rij \d+)\]/);
    var id = schoon(r.boek_id).toUpperCase();
    if (m && /^[BZF]\d{4,}$/.test(id)) uit[m[1]] = id;
  });
  return uit;
}

/** De lener van een oude rij: een bestaande (zelfde e-mail of telefoon), of een nieuwe. */
function oudeLener(staat, o, teller) {
  var lener = staat.leners.filter(function (l) {
    return (o.email && String(l.email).toLowerCase() === o.email) ||
      (o.telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(o.telefoon));
  })[0];
  if (!lener) {
    lener = voegToe(staat.leners, {
      lenersnummer: String(nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }))),
      voornaam: o.voornaam || '?', achternaam: o.achternaam, telefoon: o.telefoon, email: o.email,
      datum_inschrijving: o.datum_uit || staat.vandaag,
      toestemming_privacy: 'onbekend', actief: 'ja'
    });
    teller.leners++;
  } else if (o.datum_uit && (!lener.datum_inschrijving || o.datum_uit < parseerDatum(lener.datum_inschrijving))) {
    // Een vroegere uitlening: dan is de lener eigenlijk al van toen.
    wijzig(lener, { datum_inschrijving: o.datum_uit });
  }
  return lener;
}

/** De datum terug en de afgesproken datum van een teruggebrachte rij uit het oude blad. */
function oudeTerugDatums(o, inst) {
  var terug = parseerDatum(o.terug_op) || o.datum_terug_afgesproken || o.datum_uit;
  if (terug < o.datum_uit) terug = o.datum_uit;
  return { terug: terug, verval: o.datum_terug_afgesproken || berekenVervaldatum(o.datum_uit, inst) };
}

/**
 * Een teruggebrachte uitlening die al overgenomen is: zet de herstelde datums erin (zie bovenaan).
 * Enkel bij wat het script zelf overzette. Geeft true als er iets veranderde.
 */
function herstelOudeTerug(u, o, inst) {
  if (u.vrijwilliger !== 'overgezet' || isLeeg(u.datum_terug) || !o.datum_uit) return false;
  var d = oudeTerugDatums(o, inst);
  var nieuw = { datum_uit: o.datum_uit, oorspronkelijke_vervaldatum: d.verval, vervaldatum: d.verval, datum_terug: d.terug };
  if (!isLeeg(u.borg_terugbetaald)) nieuw.borg_terugbetaald = d.terug;
  if (o.herinnering && !isLeeg(u.laatste_herinnering)) nieuw.laatste_herinnering = o.herinnering;
  var anders = Object.keys(nieuw).some(function (k) { return parseerDatum(u[k]) !== nieuw[k]; });
  if (anders) wijzig(u, nieuw);
  return anders;
}

/**
 * Een teruggebrachte uitlening uit het oude blad, voor de cijfers. Met de lener als ze binnen de
 * bewaartermijn terugkwam, anders zonder (zoals de privacy-opruiming het ook zou doen).
 */
function verwerkOudeTerug(staat, o, bron, teller, naTeKijken, gekozen) {
  if (!o.datum_uit) { teller.nietGevonden++; return; }
  // Koos het bestuur het boek zelf in Na te kijken (kolom boek_id)? Dan dat boek.
  var gevonden = gekozen && gekozen[bron] ? { zeker: boekVan(staat, gekozen[bron]) } : zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur, true);
  var boek = gevonden.zeker;
  if (!boek) {
    teller.nietGevonden++;
    naTeKijken.push({
      boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
      titel: o.boek, veld: 'historiek',
      waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
      waarde_bron: o.boek + ' / ' + o.auteur,
      opmerking: 'Teruggebracht, uitgeleend op ' + korteDatum(o.datum_uit) + '. Telt nog niet mee in de cijfers. Staat het boek in de Catalogus? Zet het juiste boek-ID in de kolom boek_id (één ID) en kies het menu-item opnieuw. Staat het er niet in? Zet afgehandeld op ja.',
      sleutel_extra: bron
    });
    return;
  }
  var d = oudeTerugDatums(o, staat.inst);
  var terug = d.terug, verval = d.verval;
  var grens = telMaandenOp(staat.vandaag, -staat.inst.bewaartermijn_afgesloten_uitleningen_maanden);
  var lener = terug >= grens && (o.email || o.telefoon || o.voornaam) ? oudeLener(staat, o, teller) : null;
  var borg = leesBorg(o.borg, staat.inst);
  voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: boek.boek_id + '-1', boek_id: boek.boek_id, lenersnummer: lener ? lener.lenersnummer : '',
    datum_uit: o.datum_uit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: terug,
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
    borg_terugbetaald: borg.bedrag > 0 ? terug : '', gift: parseerGetal(o.gift) || '',
    laatste_herinnering: parseerDatum(o.herinnering) || '', vrijwilliger: 'overgezet', bron: bron
  });
  teller.historiek++;
}

/**
 * Verwerkt de oude rijen in de staat (zonder de spreadsheet aan te raken).
 * Geeft { uitleningen, historiek, nietGevonden, leners, naTeKijken } terug.
 */
function verwerkOudeUitleningen(staat, oudeRijen, gekozen) {
  var teller = { uitleningen: 0, historiek: 0, nietGevonden: 0, leners: 0, hersteld: 0 };
  var naTeKijken = [];
  var bekend = {};
  staat.uitleningen.forEach(function (u) { if (u.bron) bekend[u.bron] = u; });

  oudeRijen.forEach(function (o) {
    var bron = 'oud blad rij ' + o.rijnummer;
    if (bekend[bron]) {
      if (bekend[bron] !== true && herstelOudeTerug(bekend[bron], o, staat.inst)) teller.hersteld++;
      return;
    }
    if (!isLeeg(o.terug_op)) { verwerkOudeTerug(staat, o, bron, teller, naTeKijken, gekozen); bekend[bron] = true; return; }

    // 1. De lener: bestaat die al (zelfde e-mail of telefoon)?
    var lener = oudeLener(staat, o, teller);

    // 2. Het boek: zelf gekozen in Na te kijken (kolom boek_id), of gezocht op titel.
    var gevonden = gekozen && gekozen[bron] ? { zeker: boekVan(staat, gekozen[bron]) } : zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur);
    var boek = gevonden.zeker;
    var exemplaar = '';
    if (boek) {
      exemplaar = exemplarenVan(boek).filter(function (ex) { return !uitleningVanExemplaar(staat, ex); })[0] || '';
    }
    var borg = leesBorg(o.borg, staat.inst);
    var context = 'Lener ' + lener.lenersnummer + ', geleend op ' + korteDatum(o.datum_uit) +
      ', terug tegen ' + korteDatum(o.datum_terug_afgesproken) + ', borg ' + bedragTekst(borg.bedrag) + (borg.betaalwijze ? ' (' + borg.betaalwijze + ')' : '') + '.';
    if (!boek || !exemplaar) {
      naTeKijken.push({
        boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
        titel: o.boek, veld: 'uitlening', waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
        waarde_bron: o.boek + ' / ' + o.auteur,
        opmerking: (boek ? 'Alle exemplaren staan al als uitgeleend. ' + context + ' Registreer deze uitlening zelf via het uitleenscherm.'
          : 'Het boek is niet zeker gevonden. ' + context + ' Zet het juiste boek-ID in de kolom boek_id (één ID) en kies het menu-item opnieuw, of registreer deze uitlening zelf via het uitleenscherm.'),
        sleutel_extra: bron
      });
      bekend[bron] = true;
      return;
    }

    // 3. De uitlening.
    var datumUit = o.datum_uit || staat.vandaag;
    var verval = o.datum_terug_afgesproken || berekenVervaldatum(datumUit, staat.inst);
    var gift = parseerGetal(o.gift);
    voegToe(staat.uitleningen, {
      uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
      exemplaar: exemplaar, boek_id: boek.boek_id, lenersnummer: lener.lenersnummer,
      datum_uit: datumUit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
      aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
      borg_terugbetaald: '', gift: gift || '',
      laatste_herinnering: parseerDatum(o.herinnering) || schoon(o.herinnering),
      vrijwilliger: 'overgezet', bron: bron
    });
    bekend[bron] = true;
    teller.uitleningen++;
  });
  return { uitleningen: teller.uitleningen, historiek: teller.historiek, nietGevonden: teller.nietGevonden, leners: teller.leners, hersteld: teller.hersteld, naTeKijken: naTeKijken };
}

/** Menu: vraagt de link naar het oude blad en neemt de lopende uitleningen over. */
function neemUitleningenOver() {
  var ui = SpreadsheetApp.getUi();
  var vraag = ui.prompt('Uitleningen overnemen',
    'Plak de link naar het oude digitale uitleenblad (de Google-spreadsheet). De lopende uitleningen en de historiek komen mee. Opnieuw uitvoeren maakt niets dubbel.',
    ui.ButtonSet.OK_CANCEL);
  if (vraag.getSelectedButton() !== ui.Button.OK) return;
  var link = schoon(vraag.getResponseText());
  var oud;
  try {
    oud = SpreadsheetApp.openByUrl(link);
  } catch (e) {
    meld('Ik kan dat blad niet openen. Kijk of de link klopt en of jouw account het blad mag openen.');
    return;
  }
  // Het eerste tabblad met een kolom "Boek".
  var rijen = [];
  oud.getSheets().some(function (blad) {
    var bereik = blad.getDataRange();
    rijen = leesOudeUitleningen(bereik.getValues(), bereik.getFormulas());
    return rijen.length > 0;
  });
  if (!rijen.length) {
    meld('Ik vond geen tabblad met een kolom "Boek" in het oude blad.');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('overzetten', false);
    var naTeKijken = leesTabel('Na te kijken');
    var gekozen = gekozenOudeBoeken(naTeKijken.rijen);
    var resultaat = verwerkOudeUitleningen(staat, rijen, gekozen);
    // Wat via een gekozen boek-ID overkwam, is afgehandeld.
    naTeKijken.rijen.forEach(function (r) {
      var m = String(r.waarde_bron || '').match(/\[(oud blad rij \d+)\]/);
      if (r.bron === 'Overzetten' && m && gekozen[m[1]] && jaNee(r.afgehandeld) !== 'ja' &&
        staat.uitleningen.some(function (u) { return u.bron === m[1]; })) wijzig(r, { afgehandeld: 'ja' });
    });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken.map(function (x) {
      x.waarde_bron = x.waarde_bron + ' [' + x.sleutel_extra + ']';
      return x;
    }), 'Overzetten', staat.vandaag);
    bewaarStaat(staat);
    bewaarTabel(naTeKijken);
    leegCache();
    logboek('menu', 'neemUitleningenOver', resultaat.uitleningen + ' lopend, ' + resultaat.historiek + ' historiek, ' + resultaat.nietGevonden + ' boeken niet gevonden, ' + resultaat.leners + ' leners, ' + resultaat.hersteld + ' hersteld, ' + nieuw + ' na te kijken');
    meld(resultaat.uitleningen + ' lopende uitleningen en ' + resultaat.historiek + ' teruggebrachte uitleningen overgenomen, ' + resultaat.leners + ' nieuwe leners aangemaakt. ' +
      (resultaat.hersteld ? 'Bij ' + resultaat.hersteld + ' al overgenomen uitleningen zijn de datums hersteld. ' : '') +
      (resultaat.nietGevonden ? resultaat.nietGevonden + ' teruggebrachte boeken vond het script niet in de Catalogus. Ze staan in "Na te kijken" (veld historiek): zet daar het juiste boek-ID en kies dit menu-item opnieuw. ' : '') +
      nieuw + ' twijfelgevallen staan in "Na te kijken". Vraag nieuwe leners bij hun volgende bezoek om toestemming voor de privacyverklaring (kolom toestemming_privacy staat op "onbekend").');
  } finally {
    lock.releaseLock();
  }
}
