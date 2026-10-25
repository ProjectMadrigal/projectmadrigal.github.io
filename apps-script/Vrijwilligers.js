/**
 * Vrijwilligers.js
 * Wat vrijwilligers vanuit het vrijwilligersscherm doorgeven aan het bestuur:
 *   - een beschrijving voorstellen voor een boek zonder beschrijving (tabblad Voorstellen).
 *     Het bestuur keurt goed of af. Pas na goedkeuring komt de tekst in de Catalogus.
 *   - iets melden: een boek kapot, iets kwijt, een vraag van een lener (tabblad Meldingen).
 *     Het bestuur zet een melding op afgehandeld.
 * En de checklist voor het openen en sluiten van de bib (instellingen tekst_checklist_...).
 *
 * Privacy: de privacy-opruiming wist afgehandelde meldingen na meldingen_bewaren_dagen.
 */

var VOORSTEL_NIEUW = 'nieuw';
var MELDING_NIEUW = 'nieuw';
var MELDING_SOORTEN = ['boek kapot', 'iets kwijt', 'vraag van een lener', 'wil iets kopen', 'andere'];
var VOORSTEL_MIN_TEKENS = 40;

/* ---------- Beschrijvingen voorstellen ---------- */

/**
 * Een vrijwilliger stelt een beschrijving voor.
 * invoer: { boek_id, tekst }. rijen: het tabblad Voorstellen. nieuwId: geeft een nieuw nummer.
 */
function maakBeschrijvingVoorstel(staat, rijen, invoer, nieuwId) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isLeeg(boek.beschrijving)) return { ok: false, fout: 'Dit boek heeft intussen al een beschrijving.' };
  var tekst = schoonMetRegels(invoer.tekst).slice(0, 3000);
  if (tekst.length < VOORSTEL_MIN_TEKENS) return { ok: false, fout: 'Schrijf minstens een paar zinnen (' + VOORSTEL_MIN_TEKENS + ' tekens).' };
  var open = rijen.filter(function (v) { return v.status === VOORSTEL_NIEUW && String(v.boek_id) === String(boek.boek_id); })[0];
  if (open) {
    // Nog niet bekeken: het nieuwe voorstel vervangt het vorige.
    wijzig(open, { datum: staat.vandaag, tekst: tekst, voorgesteld_door: staat.wie });
  } else {
    voegToe(rijen, {
      voorstel_id: nieuwId(), datum: staat.vandaag, boek_id: String(boek.boek_id), titel: schoon(boek.titel),
      tekst: tekst, voorgesteld_door: staat.wie, status: VOORSTEL_NIEUW
    });
  }
  staat.log.push(['beschrijving voorgesteld', String(boek.boek_id)]);
  return { ok: true, tekst: 'Dank je! Het bestuur bekijkt je beschrijving van "' + schoon(boek.titel) + '".' };
}

/** De open voorstellen voor het bestuursscherm, oudste eerst. */
function openVoorstellen(rijen) {
  return (rijen || []).filter(function (v) { return v.status === VOORSTEL_NIEUW; }).map(function (v) {
    return { voorstel_id: String(v.voorstel_id), datum: parseerDatum(v.datum) || String(v.datum || ''), boek_id: String(v.boek_id),
      titel: schoon(v.titel), tekst: schoonMetRegels(v.tekst), voorgesteld_door: schoon(v.voorgesteld_door) };
  }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
}

/** De boeken waarvoor al een voorstel klaarligt: die toont het vrijwilligersscherm apart. */
function voorgesteldeBoeken(rijen) {
  return openVoorstellen(rijen).map(function (v) { return v.boek_id; });
}

/**
 * Het bestuur keurt een voorstel goed (de tekst mag aangepast zijn) of af.
 * invoer: { voorstel_id, besluit: 'goedgekeurd' | 'afgekeurd', tekst }
 */
function voorstelBehandelen(staat, rijen, invoer) {
  var besluit = String(invoer.besluit || '');
  if (besluit !== 'goedgekeurd' && besluit !== 'afgekeurd') return { ok: false, fout: 'Onbekend besluit.' };
  var v = rijen.filter(function (r) { return String(r.voorstel_id) === String(invoer.voorstel_id); })[0];
  if (!v) return { ok: false, fout: 'Dit voorstel bestaat niet meer.' };
  if (v.status !== VOORSTEL_NIEUW) return { ok: false, fout: 'Dit voorstel is al ' + v.status + '.' };
  if (besluit === 'goedgekeurd') {
    var tekst = isLeeg(invoer.tekst) ? schoonMetRegels(v.tekst) : schoonMetRegels(invoer.tekst);
    var r = boekAanpassen(staat, { boek_id: v.boek_id, velden: { beschrijving: tekst } });
    if (!r.ok) return r;
  }
  wijzig(v, { status: besluit, behandeld_door: staat.wie, datum_behandeld: staat.vandaag });
  staat.log.push(['voorstel ' + besluit, String(v.voorstel_id) + ', boek ' + v.boek_id]);
  return { ok: true, tekst: besluit === 'goedgekeurd' ? 'De beschrijving staat bij "' + schoon(v.titel) + '".' : 'Voorstel afgekeurd.' };
}

/* ---------- Iets melden ---------- */

/** invoer: { soort, onderwerp, bericht }. rijen: het tabblad Meldingen. */
function maakMelding(rijen, invoer, wie, vandaag, nieuwId) {
  var soort = String(invoer.soort || '');
  if (MELDING_SOORTEN.indexOf(soort) === -1) return { ok: false, fout: 'Kies wat je wil melden.' };
  var bericht = schoonMetRegels(invoer.bericht).slice(0, 1000);
  if (bericht.length < 5) return { ok: false, fout: 'Schrijf kort wat er aan de hand is.' };
  voegToe(rijen, {
    melding_id: nieuwId(), datum: vandaag, wie: tekstInvoer(wie, 40) || 'onbekend', soort: soort,
    onderwerp: tekstInvoer(invoer.onderwerp, 120), bericht: bericht, status: MELDING_NIEUW
  });
  return { ok: true, tekst: 'Je melding is doorgegeven aan het bestuur. Dank je!' };
}

/** De open meldingen voor het bestuursscherm, oudste eerst. */
function openMeldingen(rijen) {
  return (rijen || []).filter(function (m) { return m.status === MELDING_NIEUW; }).map(function (m) {
    return { melding_id: String(m.melding_id), datum: parseerDatum(m.datum) || String(m.datum || ''), wie: schoon(m.wie),
      soort: schoon(m.soort), onderwerp: schoon(m.onderwerp), bericht: schoonMetRegels(m.bericht) };
  }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
}

/** Het bestuur zet een melding op afgehandeld. invoer: { melding_id } */
function meldingAfhandelen(rijen, invoer, wie, vandaag) {
  var m = (rijen || []).filter(function (r) { return String(r.melding_id) === String(invoer.melding_id); })[0];
  if (!m) return { ok: false, fout: 'Deze melding bestaat niet meer.' };
  wijzig(m, { status: 'afgehandeld', afgehandeld_door: tekstInvoer(wie, 40), datum_afgehandeld: vandaag });
  return { ok: true, tekst: 'Melding ' + m.melding_id + ' is afgehandeld.' };
}

/** Privacy: afgehandelde meldingen ouder dan het aantal dagen gaan weg. Open meldingen blijven. */
function ruimMeldingenOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (m) {
    if (m.status === MELDING_NIEUW) return;
    var d = parseerDatum(m.datum_afgehandeld) || parseerDatum(m.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(m); n++; }
  });
  return n;
}

/** Nachtelijke opruiming van de meldingen (zie Privacy.js). */
function ruimMeldingenOp(inst) {
  if (!spreadsheet().getSheetByName('Meldingen')) return 0;
  var tabel = leesTabel('Meldingen');
  var n = ruimMeldingenOpRijen(tabel.rijen, vandaagTekst(), inst.meldingen_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/* ---------- Checklist voor de shift ---------- */

/** Een tekst met een punt per regel wordt een lijst. Lege regels en opsommingstekens vallen weg. */
function checklistPunten(tekst) {
  return String(tekst || '').split('\n').map(function (r) { return schoon(r.replace(/^\s*[-*•\d.)]+\s*/, '')); })
    .filter(Boolean).slice(0, 30);
}

function shiftChecklist(inst) {
  return { openen: checklistPunten(inst.tekst_checklist_openen), sluiten: checklistPunten(inst.tekst_checklist_sluiten) };
}

/* ---------- Tabbladen lezen en bewaren (enkel in Apps Script) ---------- */

/** Leest een tabblad, of geeft een lege tabel als het nog niet bestaat. */
function tabelOfLeeg(naam) {
  return spreadsheet().getSheetByName(naam) ? leesTabel(naam) : null;
}

function nieuwIdVoor(rijen, kolom, sleutel, letter) {
  return function () {
    return letter + metNullen(volgendNummer(sleutel, rijen.map(function (r) { return r[kolom]; })), 4);
  };
}

/** Acties voorstelBeschrijving en voorstelBehandelen (binnen het slot, met een staat). */
function voorstelActie(staat, actie, invoer) {
  var tabel = tabelOfLeeg('Voorstellen');
  if (!tabel) return { ok: false, fout: 'Het tabblad Voorstellen ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'voorstelBeschrijving'
    ? maakBeschrijvingVoorstel(staat, tabel.rijen, invoer, nieuwIdVoor(tabel.rijen, 'voorstel_id', 'voorstel', 'V'))
    : voorstelBehandelen(staat, tabel.rijen, invoer);
  if (r.ok) bewaarTabel(tabel);
  return r;
}

/** Acties meldingMaken en meldingAfhandelen (binnen het slot). */
function meldingActie(actie, invoer, wie) {
  var tabel = tabelOfLeeg('Meldingen');
  if (!tabel) return { ok: false, fout: 'Het tabblad Meldingen ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'meldingMaken'
    ? maakMelding(tabel.rijen, invoer, wie, vandaagTekst(), nieuwIdVoor(tabel.rijen, 'melding_id', 'melding', 'M'))
    : meldingAfhandelen(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, actie === 'meldingMaken' ? 'melding' : 'melding afgehandeld', actie === 'meldingMaken' ? String(invoer.soort) : String(invoer.melding_id));
  }
  return r;
}

/* ---------- Briefjes voor de volgende shift ---------- */

var BRIEFJE_ZICHTBAAR_DAGEN = 14; // daarna verdwijnt een briefje vanzelf van Vandaag

/** Een vrijwilliger laat een briefje achter voor de volgende shift. invoer: { tekst } */
function maakBriefje(rijen, invoer, wie, vandaag, nieuwId) {
  var tekst = schoonMetRegels(invoer.tekst).slice(0, 300);
  if (tekst.length < 3) return { ok: false, fout: 'Schrijf kort wat de volgende shift moet weten.' };
  voegToe(rijen, { briefje_id: nieuwId(), datum: vandaag, wie: tekstInvoer(wie, 40) || 'onbekend', tekst: tekst, status: 'open' });
  return { ok: true, tekst: 'Je briefje staat bij Vandaag voor de volgende shift.' };
}

/** De briefjes die nog op Vandaag staan, nieuwste eerst. */
function openBriefjes(rijen, vandaag) {
  return (rijen || []).filter(function (b) {
    var d = parseerDatum(b.datum);
    return b.status === 'open' && d && dagenTussen(d, vandaag) <= BRIEFJE_ZICHTBAAR_DAGEN;
  }).map(function (b) {
    return { briefje_id: String(b.briefje_id), datum: parseerDatum(b.datum), wie: schoon(b.wie), tekst: schoonMetRegels(b.tekst) };
  }).sort(function (a, b) { return b.datum.localeCompare(a.datum) || b.briefje_id.localeCompare(a.briefje_id); });
}

/** Iemand haalt een briefje weg (gelezen, opgelost). invoer: { briefje_id } */
function briefjeWeg(rijen, invoer, wie, vandaag) {
  var b = (rijen || []).filter(function (r) { return String(r.briefje_id) === String(invoer.briefje_id); })[0];
  if (!b) return { ok: false, fout: 'Dit briefje bestaat niet meer.' };
  wijzig(b, { status: 'weg', weg_door: tekstInvoer(wie, 40), datum_weg: vandaag });
  return { ok: true, tekst: 'Het briefje is weg.' };
}

/** Privacy: briefjes ouder dan het aantal dagen (instelling briefjes_bewaren_dagen) gaan weg, ook de open. */
function ruimBriefjesOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (b) {
    var d = parseerDatum(b.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(b); n++; }
  });
  return n;
}

function ruimBriefjesOp(inst) {
  if (!spreadsheet().getSheetByName('Briefjes')) return 0;
  var tabel = leesTabel('Briefjes');
  var n = ruimBriefjesOpRijen(tabel.rijen, vandaagTekst(), inst.briefjes_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/** Acties briefjeMaken en briefjeWeg (binnen het slot). */
function briefjeActie(actie, invoer, wie) {
  var tabel = tabelOfLeeg('Briefjes');
  if (!tabel) return { ok: false, fout: 'Het tabblad Briefjes ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'briefjeMaken'
    ? maakBriefje(tabel.rijen, invoer, wie, vandaagTekst(), nieuwIdVoor(tabel.rijen, 'briefje_id', 'briefje', 'N'))
    : briefjeWeg(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, actie === 'briefjeMaken' ? 'briefje' : 'briefje weg', actie === 'briefjeMaken' ? '' : String(invoer.briefje_id));
  }
  return r;
}

/* ---------- Mijn voorstellen en meldingen ---------- */

var MIJN_DAGEN = 60; // zo ver kijkt "Mijn voorstellen en meldingen" terug

/** Is deze naam van wie aangemeld is? Op de voornaam, zonder hoofdletters of accenten. */
function zelfdeNaam(a, b) {
  var x = normaliseerTekst(a).split(' ')[0], y = normaliseerTekst(b).split(' ')[0];
  return !!x && x === y;
}

/**
 * Wat deze vrijwilliger de laatste MIJN_DAGEN voorstelde en meldde, met de stand.
 * Enkel titel, soort en onderwerp: niet de tekst van de melding zelf.
 */
function mijnBijdragen(voorstelRijen, meldingRijen, wie, vandaag) {
  var recent = function (d) { d = parseerDatum(d); return !!d && dagenTussen(d, vandaag) <= MIJN_DAGEN; };
  var nieuwsteEerst = function (a, b) { return b.datum.localeCompare(a.datum); };
  return {
    voorstellen: (voorstelRijen || []).filter(function (v) { return zelfdeNaam(v.voorgesteld_door, wie) && recent(v.datum); }).map(function (v) {
      return { datum: parseerDatum(v.datum), titel: schoon(v.titel), status: schoon(v.status), datum_behandeld: parseerDatum(v.datum_behandeld) || '' };
    }).sort(nieuwsteEerst),
    meldingen: (meldingRijen || []).filter(function (m) { return zelfdeNaam(m.wie, wie) && recent(m.datum); }).map(function (m) {
      return { datum: parseerDatum(m.datum), soort: schoon(m.soort), onderwerp: schoon(m.onderwerp), status: schoon(m.status), datum_afgehandeld: parseerDatum(m.datum_afgehandeld) || '' };
    }).sort(nieuwsteEerst)
  };
}

/* ---------- Terug te zetten ---------- */

/** De boeken die vandaag terugkwamen, met hun onderwerp: zo weet je in welke kast ze horen. Zonder gegevens van leners. */
function vandaagTerug(staat, vertaal) {
  return staat.uitleningen.filter(function (u) { return parseerDatum(u.datum_terug) === staat.vandaag; }).map(function (u) {
    var boek = boekVan(staat, u.boek_id);
    var groepen = boek && vertaal ? filtergroepenVan(boek, vertaal) : [];
    return { uitlening_id: String(u.uitlening_id), exemplaar: String(u.exemplaar || ''), boek_id: String(u.boek_id),
      titel: boek ? schoon(boek.titel) : String(u.boek_id), auteur: boek ? schoon(boek.auteur) : '',
      onderwerp: groepen[0] || (boek ? schoon(boek.genre) : '') || 'Zonder onderwerp', staat_terug: schoon(u.staat_terug) };
  }).sort(function (a, b) { return a.onderwerp.localeCompare(b.onderwerp) || a.auteur.localeCompare(b.auteur); });
}
