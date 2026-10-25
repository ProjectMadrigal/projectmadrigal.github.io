/**
 * Overzetten.js
 * Eenmalig: neemt de lopende uitleningen over uit het oude digitale uitleenblad.
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
 * De historiek blijft in het oude blad. Dit script past het oude blad niet aan.
 */

/** Zoekt een kolom in de kop van het oude blad, op het begin van de naam. */
function oudeKolom(kop, begin) {
  for (var i = 0; i < kop.length; i++) if (kop[i].indexOf(begin) === 0) return i;
  return -1;
}

/** Zet de waarden van het oude blad om naar objecten met vaste namen. */
function leesOudeUitleningen(waarden) {
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
    rijen.push({
      rijnummer: i + 1,
      boek: schoon(lees('boek')), auteur: schoon(lees('auteur')),
      voornaam: schoon(lees('voornaam')), achternaam: schoon(lees('achternaam')),
      telefoon: schoon(lees('telefoon')), email: schoon(lees('email')).toLowerCase(),
      datum_uit: parseerDatum(lees('datum_uit')), datum_terug_afgesproken: parseerDatum(lees('datum_terug_afgesproken')),
      borg: lees('borg'), gift: lees('gift'),
      herinnering: parseerDatum(herinnering) || (normaliseerTekst(herinnering) === 'ok' ? parseerDatum(lees('datum_terug_afgesproken')) : ''),
      terug_op: isLeeg(lees('terug_op')) && status === 'ok' ? 'ok' : lees('terug_op')
    });
  }
  return rijen;
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
 */
function zoekBoekOpTitel(catalogus, titel, auteur) {
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
  if (!kandidaten.length) return {};
  kandidaten.sort(function (a, b) { return b.score - a.score; });
  return { twijfel: kandidaten.slice(0, 3).map(function (k) { return k.boek; }) };
}

/**
 * Verwerkt de oude rijen in de staat (zonder de spreadsheet aan te raken).
 * Geeft { uitleningen, leners, naTeKijken } terug.
 */
function verwerkOudeUitleningen(staat, oudeRijen) {
  var teller = { uitleningen: 0, leners: 0 };
  var naTeKijken = [];
  var bekend = {};
  staat.uitleningen.forEach(function (u) { if (u.bron) bekend[u.bron] = true; });

  oudeRijen.forEach(function (o) {
    if (!isLeeg(o.terug_op)) return; // al teruggebracht: blijft in het oude blad
    var bron = 'oud blad rij ' + o.rijnummer;
    if (bekend[bron]) return;

    // 1. De lener: bestaat die al (zelfde e-mail of telefoon)?
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
    }

    // 2. Het boek.
    var gevonden = zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur);
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
        opmerking: (boek ? 'Alle exemplaren staan al als uitgeleend. ' : 'Het boek is niet zeker gevonden. ') + context +
          ' Registreer deze uitlening zelf via het uitleenscherm.',
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
  return { uitleningen: teller.uitleningen, leners: teller.leners, naTeKijken: naTeKijken };
}

/** Menu: vraagt de link naar het oude blad en neemt de lopende uitleningen over. */
function neemUitleningenOver() {
  var ui = SpreadsheetApp.getUi();
  var vraag = ui.prompt('Lopende uitleningen overnemen',
    'Plak de link naar het oude digitale uitleenblad (de Google-spreadsheet). Enkel boeken die nog niet terug zijn, komen mee.',
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
    rijen = leesOudeUitleningen(blad.getDataRange().getValues());
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
    var resultaat = verwerkOudeUitleningen(staat, rijen);
    var naTeKijken = leesTabel('Na te kijken');
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken.map(function (x) {
      x.waarde_bron = x.waarde_bron + ' [' + x.sleutel_extra + ']';
      return x;
    }), 'Overzetten', staat.vandaag);
    bewaarStaat(staat);
    bewaarTabel(naTeKijken);
    leegCache();
    logboek('menu', 'neemUitleningenOver', resultaat.uitleningen + ' uitleningen, ' + resultaat.leners + ' leners, ' + nieuw + ' na te kijken');
    meld(resultaat.uitleningen + ' lopende uitleningen overgenomen, ' + resultaat.leners + ' nieuwe leners aangemaakt. ' +
      nieuw + ' twijfelgevallen staan in "Na te kijken". Vraag nieuwe leners bij hun volgende bezoek om toestemming voor de privacyverklaring (kolom toestemming_privacy staat op "onbekend").');
  } finally {
    lock.releaseLock();
  }
}
