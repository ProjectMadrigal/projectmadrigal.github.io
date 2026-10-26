/**
 * Publiek.js
 * Stelt de publieke catalogus samen. Hier staat de lijst met velden die de
 * website mag zien. Alles wat hier niet staat (herkomst, leners, codes, ...)
 * verlaat de spreadsheet nooit via het publieke eindpunt.
 *
 * Om bandbreedte te sparen gebruiken we korte sleutels:
 *   id  boek-ID          t  titel           a  auteur        i  ISBN
 *   u   uitgeverij       j  jaartal         l  taal          p  pagina's
 *   v   uitvoering       n  nieuw/tweedehands                r  aanraders (lijst)
 *   g   filtergroepen    s  soort (boek/zine/film)           d  beschrijving
 *   ot  originele titel (enkel als die verschilt van de titel)
 *   la  land (films)     du speelduur in minuten (films)    tip 1 als het een kijktip is (film niet in de bib)
 *   de  beschrijving in het Engels (enkel als die verschilt)
 *   ta  datum waarop het boek in de catalogus kwam (om te sorteren op laatst toegevoegd)
 *   db  link naar de bron van de beschrijving (enkel Wikipedia: die licentie vraagt een bronvermelding)
 *   w   1 als het boek gevoelige inhoud heeft (label op de website)
 *   ll  leeslijsten (namen zoals in het tabblad Leeslijsten)
 *   c   cover-URL        b  beschikbaarheid { c: code, l: label, t: totaal, v: vrij,
 *                                           d: verwacht terug (datum), k: 1 als te koop }
 */

/**
 * Bouwt het object dat het publieke eindpunt teruggeeft.
 * Films staan er enkel in als de instelling films_tonen op ja staat. opties.enkelFilms: alleen de
 * films, ook als ze nog verborgen zijn (voor het voorbeeld van het bestuur, actie filmsVoorbeeld).
 */
function bouwPubliekeCatalogus(staat, onderwerpRijen, lijstRijen, opties) {
  opties = opties || {};
  var filmsTonen = (staat.inst || {}).films_tonen === true;
  var vertaal = vertaalTabel(onderwerpRijen);
  // Leeslijsten: zie leeslijstZichtbaar. Een geplande lijst volgt haar data, de rest de instelling leeslijsten_tonen.
  var schakelaar = (staat.inst || {}).leeslijsten_tonen === true;
  var lijsten = leeslijstInfo(lijstRijen, staat.vandaag, schakelaar);
  var toonLijsten = schakelaar || lijsten.geplandZichtbaar;
  // Namen in de instelling aanraders_verbergen verschijnen nergens op de website.
  var verborgen = splitsLijst((staat.inst || {}).aanraders_verbergen).map(normaliseerTekst);
  var boeken = [];
  staat.catalogus.forEach(function (rij) {
    if (isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
    if (!opWebsite(rij)) return;
    var film = isFilm(rij);
    if (opties.enkelFilms ? !film : (film && !filmsTonen)) return;
    var b = beschikbaarheid(staat, rij);
    var boek = {
      id: String(rij.boek_id),
      t: schoon(rij.titel),
      a: schoon(rij.auteur),
      g: film ? filmGroepen(rij) : filtergroepenVan(rij, vertaal),
      s: soortVan(rij),
      b: { c: b.code, l: b.label, t: b.totaal, v: b.beschikbaar }
    };
    if (isFilmTip(rij)) { boek.tip = 1; boek.b = { c: 'tip', l: 'Kijktip', t: 0, v: 0 }; }
    // Datum van verwachte terugkeer en "te koop": zo maakt de website het label in elke taal op.
    if (b.code === 'uitgeleend' && b.terug && b.terug >= staat.vandaag) boek.b.d = b.terug;
    if (b.code === 'niet_uitleenbaar' && !boek.tip && (normaliseerTekst(rij.genre) === 'verkoop' || jaNee(rij.te_koop) === 'ja')) boek.b.k = 1;
    if (boekStatus(rij) === 'gevoelig_zichtbaar') boek.w = 1;
    // Verloren: blijft op de website, met het label "Niet meer beschikbaar".
    if (boekStatus(rij) === 'verloren' && !boek.tip) { boek.b = { c: 'niet_uitleenbaar', l: 'Niet meer beschikbaar', t: 0, v: 0, x: 1 }; }
    // Lege velden laten we weg: dat maakt de lijst kleiner.
    var extra = {
      i: schoon(rij.isbn), u: schoon(rij.uitgeverij), j: parseerGetal(rij.jaartal) || '',
      l: schoon(rij.taal), p: parseerGetal(rij.paginas) || '', v: schoon(rij.uitvoering),
      ot: andereTitel(rij.titel, rij.originele_titel),
      la: film ? filmLijst(rij.land).join(', ') : '', du: film ? parseerGetal(rij.duur) || '' : '',
      n: jaNee(rij.nieuwstaat) === 'ja' ? 'nieuw' : (jaNee(rij.nieuwstaat) === 'nee' ? 'tweedehands' : ''),
      d: schoonMetRegels(rij.beschrijving), c: veiligeCoverUrl(rij.cover_url), ta: parseerDatum(rij.toegevoegd_op),
      db: /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(schoon(rij.beschrijving_bron)) && schoonMetRegels(rij.beschrijving) ? schoon(rij.beschrijving_bron) : ''
    };
    var en = schoonMetRegels(rij.beschrijving_en);
    if (en && en !== extra.d) extra.de = en;
    Object.keys(extra).forEach(function (k) { if (!isLeeg(extra[k])) boek[k] = extra[k]; });
    var aanraders = splitsLijst(String(rij.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
      return verborgen.indexOf(normaliseerTekst(naam)) === -1;
    });
    if (aanraders.length) boek.r = aanraders;
    var ll = toonLijsten ? leeslijstenVan(rij, lijsten, schakelaar) : [];
    if (ll.length) boek.ll = ll;
    boeken.push(boek);
  });
  // Filtergroepen: eerst de standaardvolgorde, dan eventuele eigen groepen.
  var groepen = FILTERGROEPEN.slice();
  boeken.forEach(function (b) { b.g.forEach(function (g) { if (groepen.indexOf(g) === -1) groepen.push(g); }); });
  var uit = {
    bijgewerkt: staat.vandaag,
    teksten: publiekeTeksten(staat.inst),
    filtergroepen: groepen,
    boeken: boeken
  };
  // Zo weet de website of het menu-item Films mag verschijnen.
  if (filmsTonen) uit.filmsTonen = true;
  // Enkel als ze getoond worden: zo weet de website of het menu-item Leeslijsten mag verschijnen.
  if (toonLijsten) uit.leeslijsten = gebruikteLeeslijsten(lijsten, boeken);
  return uit;
}

/*
 * Leeslijsten: een thema, zoals "Pride-maand" of "Eerste keer over gender lezen".
 *   - Tabblad Leeslijsten: naam, Engelse naam, uitleg, volgorde. publiek "nee" verbergt een lijst.
 *   - Catalogus, kolom leeslijsten: de namen van de lijsten waarin het boek staat, gescheiden door komma's.
 * Een naam die niet in het tabblad staat, verschijnt toch (als de instelling aan staat), zonder uitleg.
 */

/**
 * Staat een lijst vandaag op de website?
 *   - publiek "nee": nooit;
 *   - met zichtbaar_vanaf of zichtbaar_tot (gepland): enkel in die periode, ook als leeslijsten_tonen op nee staat;
 *   - zonder data: als leeslijsten_tonen op ja staat.
 * Geeft { zichtbaar, gepland }.
 */
function leeslijstZichtbaar(r, vandaag, schakelaar) {
  if (jaNee(r.publiek) === 'nee') return { zichtbaar: false, gepland: false };
  var van = parseerDatum(r.zichtbaar_vanaf), tot = parseerDatum(r.zichtbaar_tot);
  if (!van && !tot) return { zichtbaar: schakelaar, gepland: false };
  return { zichtbaar: (!van || van <= vandaag) && (!tot || vandaag <= tot), gepland: true };
}

function leeslijstInfo(rijen, vandaag, schakelaar) {
  var info = { perSleutel: {}, volgorde: [], geplandZichtbaar: false };
  (rijen || []).forEach(function (r, i) {
    var naam = schoon(r.naam);
    if (!naam) return;
    var sleutel = normaliseerTekst(naam);
    if (info.perSleutel[sleutel]) return;
    var z = leeslijstZichtbaar(r, vandaag, schakelaar);
    if (z.gepland && z.zichtbaar) info.geplandZichtbaar = true;
    info.perSleutel[sleutel] = {
      n: naam, ne: schoon(r.naam_en), u: schoonMetRegels(r.uitleg), ue: schoonMetRegels(r.uitleg_en),
      verborgen: !z.zichtbaar, volgorde: parseerGetal(r.volgorde) || 0, rij: i
    };
  });
  return info;
}

/** De publieke leeslijsten van een boek, met de naam zoals in het tabblad. */
function leeslijstenVan(rij, info, schakelaar) {
  var namen = [];
  splitsLijst(rij.leeslijsten).forEach(function (naam) {
    var l = info.perSleutel[normaliseerTekst(naam)];
    if (l ? l.verborgen : !schakelaar) return;
    var echt = l ? l.n : schoon(naam);
    if (echt && namen.indexOf(echt) === -1) namen.push(echt);
  });
  return namen;
}

/** De lijsten met minstens één boek, in de volgorde van het tabblad. Lege velden laten we weg. */
function gebruikteLeeslijsten(info, boeken) {
  var gezien = {};
  boeken.forEach(function (b) { (b.ll || []).forEach(function (n) { gezien[n] = true; }); });
  var lijst = Object.keys(gezien).map(function (n) {
    return info.perSleutel[normaliseerTekst(n)] || { n: n, volgorde: 0, rij: 9999 };
  });
  lijst.sort(function (a, b) {
    return (a.volgorde || 9999) - (b.volgorde || 9999) || a.rij - b.rij || a.n.localeCompare(b.n);
  });
  return lijst.map(function (l) {
    var uit = { n: l.n };
    ['ne', 'u', 'ue'].forEach(function (k) { if (l[k]) uit[k] = l[k]; });
    return uit;
  });
}

/** De originele titel, of '' als die dezelfde is als de titel (zonder hoofdletters, accenten en leestekens). */
function andereTitel(titel, origineel) {
  var o = schoon(origineel);
  return o && normaliseerTekst(o) !== normaliseerTekst(titel) ? o : '';
}

/** Enkel https-links naar afbeeldingen. Zo kan er geen vreemde code via een cover binnensluipen. */
function veiligeCoverUrl(url) {
  var u = schoon(url);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}
