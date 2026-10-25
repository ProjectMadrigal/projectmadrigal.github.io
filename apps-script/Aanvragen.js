/**
 * Aanvragen.js
 * Online reserveren: een bezoeker vraagt via de website een boek aan. Het bestuur
 * ziet de aanvraag in het bestuursscherm, neemt contact op en maakt aan de balie
 * een echte reservatie.
 *
 * Staat standaard uit. Zet de instelling online_reserveren op "ja" om de knop
 * "Reserveer dit boek" op de website te tonen.
 *
 * Bescherming tegen misbruik:
 *   - een verborgen veld dat enkel robots invullen;
 *   - hoogstens AANVRAAG_MAX_PER_UUR aanvragen per uur, en 3 open aanvragen per contact;
 *   - enkel boeken die op de website staan en uitleenbaar zijn.
 * Privacy: de privacy-opruiming wist aanvragen na aanvragen_bewaren_dagen.
 */

var AANVRAAG_MAX_PER_UUR = 30;
var AANVRAAG_MAX_PER_CONTACT = 3;
var AANVRAAG_NIEUW = 'nieuw';
var AANVRAAG_STATUSSEN = ['nieuw', 'afgehandeld', 'geweigerd'];

/**
 * Maakt een aanvraag, zonder de spreadsheet aan te raken.
 * omgeving: { inst, vandaag, catalogus, aanvragen }
 * nieuwId: functie die een nieuw aanvraagnummer geeft.
 * Geeft { ok, tekst } of { ok: false, fout }. stil: true als een robot het verborgen veld invulde.
 */
function maakAanvraag(omgeving, invoer, nieuwId) {
  if (!omgeving.inst.online_reserveren) return { ok: false, fout: 'Online reserveren kan nog niet. Kom langs in de bib.' };
  // Een robot vult elk veld in, ook het verborgen. We doen alsof het lukte.
  if (!isLeeg(invoer.website)) return { ok: true, stil: true, tekst: 'Je aanvraag is verstuurd.' };
  var boek = omgeving.catalogus.filter(function (b) { return String(b.boek_id) === String(invoer.boek_id); })[0];
  if (!boek || !opWebsite(boek) || (isFilm(boek) && omgeving.inst.films_tonen !== true)) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isUitleenbaar(boek)) return { ok: false, fout: 'Dit boek is niet uitleenbaar.' };
  var voornaam = tekstInvoer(invoer.voornaam, 40);
  if (!voornaam) return { ok: false, fout: 'Vul je voornaam in.' };
  var contact = tekstInvoer(invoer.contact, 80);
  if (!geldigEmail(contact) && !geldigeTelefoon(contact)) return { ok: false, fout: 'Vul een geldig telefoonnummer of e-mailadres in.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Geef toestemming om je gegevens te bewaren, anders kunnen we je niet contacteren.' };
  var zelfde = normaliseerTekst(contact);
  var open = omgeving.aanvragen.filter(function (a) { return a.status === AANVRAAG_NIEUW && normaliseerTekst(a.contact) === zelfde; });
  if (open.length >= AANVRAAG_MAX_PER_CONTACT) return { ok: false, fout: 'Je hebt al ' + open.length + ' aanvragen lopen. Wacht tot het bestuur je contacteert.' };
  if (open.some(function (a) { return String(a.boek_id) === String(boek.boek_id); })) return { ok: false, fout: 'Je vroeg dit boek al aan. Het bestuur neemt contact met je op.' };
  voegToe(omgeving.aanvragen, {
    aanvraag_id: nieuwId(), datum: omgeving.vandaag, boek_id: String(boek.boek_id), titel: schoon(boek.titel),
    voornaam: voornaam, contact: contact, opmerking: tekstInvoer(invoer.opmerking, 300), status: AANVRAAG_NIEUW
  });
  return { ok: true, tekst: 'Je aanvraag is verstuurd. Het bestuur neemt contact met je op om af te spreken wanneer je het boek kan ophalen.' };
}

/** Publiek eindpunt: een aanvraag van de website. */
function publiekeAanvraag(invoer) {
  var inst = leesInstellingen();
  if (!inst.online_reserveren) return { ok: false, fout: 'Online reserveren kan nog niet. Kom langs in de bib.' };
  var cache = CacheService.getScriptCache();
  var teller = Number(cache.get('aanvragen_uur') || 0);
  if (teller >= AANVRAAG_MAX_PER_UUR) return { ok: false, fout: 'Er kwamen net veel aanvragen binnen. Probeer het over een uur opnieuw.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var tabel = leesTabel('Aanvragen');
    var omgeving = { inst: inst, vandaag: vandaagTekst(), catalogus: leesTabel('Catalogus').rijen, aanvragen: tabel.rijen };
    var nieuwId = function () {
      return 'A' + metNullen(volgendNummer('aanvraag', tabel.rijen.map(function (a) { return a.aanvraag_id; })), 4);
    };
    var r = maakAanvraag(omgeving, invoer, nieuwId);
    if (r.ok && !r.stil) {
      bewaarTabel(tabel);
      cache.put('aanvragen_uur', String(teller + 1), 3600);
      var nieuw = tabel.rijen[tabel.rijen.length - 1];
      logboek('website', 'reservatieaanvraag', nieuw.aanvraag_id + ', boek ' + nieuw.boek_id);
    }
    return { ok: r.ok, tekst: r.tekst, fout: r.fout };
  } finally {
    lock.releaseLock();
  }
}

/** De open aanvragen voor het bestuursscherm, oudste eerst. */
function openAanvragen(rijen) {
  return (rijen || []).filter(function (a) { return a.status === AANVRAAG_NIEUW; }).map(function (a) {
    return {
      aanvraag_id: String(a.aanvraag_id), datum: a.datum, boek_id: String(a.boek_id), titel: schoon(a.titel),
      voornaam: schoon(a.voornaam), contact: schoon(a.contact), opmerking: schoon(a.opmerking)
    };
  }).sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
}

/** Zet een aanvraag op afgehandeld of geweigerd. invoer: { aanvraag_id, status } */
function aanvraagAfhandelen(rijen, invoer, wie, vandaag) {
  var status = String(invoer.status || '');
  if (status !== 'afgehandeld' && status !== 'geweigerd') return { ok: false, fout: 'Onbekende status.' };
  var a = (rijen || []).filter(function (r) { return String(r.aanvraag_id) === String(invoer.aanvraag_id); })[0];
  if (!a) return { ok: false, fout: 'Deze aanvraag bestaat niet meer.' };
  wijzig(a, { status: status, datum_afgehandeld: vandaag, afgehandeld_door: tekstInvoer(wie, 40) });
  return { ok: true, tekst: 'Aanvraag ' + a.aanvraag_id + ' staat op ' + status + '.' };
}

/** Privacy: aanvragen ouder dan het aantal dagen gaan weg, ook de open. Geeft het aantal terug. */
function ruimAanvragenOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (a) {
    var d = parseerDatum(a.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(a); n++; }
  });
  return n;
}

/** Nachtelijke opruiming van de aanvragen (zie Privacy.js). */
function ruimAanvragenOp(inst) {
  if (!spreadsheet().getSheetByName('Aanvragen')) return 0;
  var tabel = leesTabel('Aanvragen');
  var n = ruimAanvragenOpRijen(tabel.rijen, vandaagTekst(), inst.aanvragen_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/** Bestuur: een aanvraag afhandelen in het tabblad. */
function beheerAanvraagAfhandelen(invoer, wie) {
  var tabel = leesTabel('Aanvragen');
  var r = aanvraagAfhandelen(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, 'aanvraag ' + invoer.status, String(invoer.aanvraag_id));
  }
  return r;
}
