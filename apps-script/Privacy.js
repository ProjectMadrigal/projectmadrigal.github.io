/**
 * Privacy.js
 * Wist persoonsgegevens na de bewaartermijn. Dit draait elke nacht vanzelf
 * (de planning maakt installeer() aan) en kan ook via het menu.
 *
 *   - Uitleningen die langer dan de bewaartermijn terug zijn: het lenersnummer
 *     wordt gewist. De uitlening zelf blijft, voor de cijfers.
 *   - Afgesloten reservaties en uitzonderingen ouder dan de bewaartermijn:
 *     het lenersnummer wordt gewist.
 *   - Een lener die op inactief staat, niets meer in huis heeft en al langer
 *     dan de bewaartermijn niets leende, wordt volledig gewist.
 */

/**
 * Pure versie van de opruiming, voor de tests.
 * staat: zoals in Uitlenen.js, plus staat.uitzonderingenTabel.
 * Geeft het aantal gewiste koppelingen en leners terug.
 */
function ruimOpStaat(staat) {
  var grens = telMaandenOp(staat.vandaag, -staat.inst.bewaartermijn_afgesloten_uitleningen_maanden);
  var teller = { koppelingen: 0, leners: 0 };

  staat.uitleningen.forEach(function (u) {
    if (!isLeeg(u.datum_terug) && u.datum_terug < grens && !isLeeg(u.lenersnummer)) {
      wijzig(u, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  staat.reservaties.forEach(function (r) {
    var afgesloten = r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR;
    var datum = r.datum_afgesloten || r.datum_reservatie;
    if (afgesloten && datum && datum < grens && !isLeeg(r.lenersnummer)) {
      wijzig(r, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });
  (staat.uitzonderingenTabel || []).forEach(function (x) {
    if (x.datum && x.datum < grens && !isLeeg(x.lenersnummer)) {
      wijzig(x, { lenersnummer: '' });
      teller.koppelingen++;
    }
  });

  staat.leners.forEach(function (l) {
    if (jaNee(l.actief) !== 'nee') return;
    var nr = String(l.lenersnummer);
    var laatste = String(l.datum_inschrijving || '');
    var nogIets = false;
    staat.uitleningen.forEach(function (u) {
      if (String(u.lenersnummer) !== nr) return;
      if (isLeeg(u.datum_terug)) nogIets = true;
      [u.datum_uit, u.datum_terug].forEach(function (d) { if (d && d > laatste) laatste = d; });
    });
    staat.reservaties.forEach(function (r) {
      if (String(r.lenersnummer) === nr && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR)) nogIets = true;
    });
    if (!nogIets && laatste < grens) {
      markeerVerwijderen(l);
      teller.leners++;
    }
  });
  return teller;
}

/** Menu en nachtelijke planning: voert de opruiming uit op de spreadsheet. */
function ruimOp() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('systeem', true);
    // Vervallen reservaties doorgeven gebeurt ook hier, zodat de wachtrij elke nacht klopt.
    verwerkVervallenReservaties(staat);
    var teller = ruimOpStaat(staat);
    bewaarStaat(staat);
    var aanvragen = ruimAanvragenOp(staat.inst);
    var meldingen = ruimMeldingenOp(staat.inst);
    logboek('systeem', 'privacy-opruiming', teller.koppelingen + ' koppelingen gewist, ' + teller.leners + ' leners gewist, ' + aanvragen + ' aanvragen gewist, ' + meldingen + ' meldingen gewist');
  } finally {
    lock.releaseLock();
  }
  leegCache();
}
