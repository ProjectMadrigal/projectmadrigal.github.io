/**
 * Bookclub.js
 * De Antwerp Queer Bookclub komt op een vaste dag in de bib samen (standaard elke tweede zondag
 * van de maand). Het script zet de eerstvolgende keren vanzelf in de agenda op de startpagina,
 * en geeft de gegevens mee voor het blok op de pagina Over ons. Hun eigen programma staat op Instagram.
 *
 * Instellingen (groep "Website: Antwerp Queer Bookclub"):
 *   bookclub_naam (leeg = niets tonen), bookclub_week (1 tot 4, of 5 voor de laatste), bookclub_dag,
 *   bookclub_uur, tekst_bookclub(_en), bookclub_link (hun Instagram).
 * Zet je zelf een event met de naam van de bookclub in de Agenda, dan vervangt dat de automatische
 * datum van die dag (bijvoorbeeld voor een uitzonderlijk uur of een speciale editie).
 */

var BC_WEKEN_NL = ['', 'eerste', 'tweede', 'derde', 'vierde', 'laatste'];
var BC_WEKEN_EN = ['', 'first', 'second', 'third', 'fourth', 'last'];
var BC_DAGEN_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** De n-de weekdag (0 = zondag) van een maand, als JJJJ-MM-DD. n = 5: de laatste. */
function nDeWeekdag(jaar, maand, dag, n) {
  var eerste = jaar + '-' + ('0' + maand).slice(-2) + '-01';
  var d = telDagenOp(eerste, (dag - weekdag(eerste) + 7) % 7);
  if (n >= 5) {
    while (telDagenOp(d, 7).slice(0, 7) === d.slice(0, 7)) d = telDagenOp(d, 7);
    return d;
  }
  d = telDagenOp(d, 7 * (n - 1));
  return d.slice(0, 7) === eerste.slice(0, 7) ? d : '';
}

/** De eerstvolgende datums (vandaag inbegrepen). */
function bookclubDatums(vandaag, week, dag, aantal) {
  var uit = [];
  var jaar = Number(vandaag.slice(0, 4)), maand = Number(vandaag.slice(5, 7));
  for (var i = 0; uit.length < aantal && i < 24; i++) {
    var d = nDeWeekdag(jaar, maand, dag, week);
    if (d && d >= vandaag) uit.push(d);
    maand++;
    if (maand > 12) { maand = 1; jaar++; }
  }
  return uit;
}

/** De regel in woorden: { nl: "elke tweede zondag van de maand", en: "every second Sunday of the month" }. */
function bookclubRegel(week, dag) {
  return {
    nl: 'elke ' + BC_WEKEN_NL[week] + ' ' + WEEKDAGEN[dag] + ' van de maand',
    en: 'every ' + BC_WEKEN_EN[week] + ' ' + BC_DAGEN_EN[dag] + ' of the month'
  };
}

/**
 * Alles over de bookclub voor ?actie=site, of null als bookclub_naam leeg is.
 * agendaRijen: om datums over te slaan waarvoor al een eigen event met de naam van de bookclub bestaat.
 */
function bookclubGegevens(inst, vandaag, agendaRijen) {
  var naam = schoon(inst.bookclub_naam);
  if (!naam) return null;
  var week = Math.min(5, Math.max(1, Math.round(Number(inst.bookclub_week) || 2)));
  var dag = WEEKDAGEN.indexOf(normaliseerTekst(inst.bookclub_dag));
  if (dag < 0) dag = 0;
  var eigen = {};
  (agendaRijen || []).forEach(function (r) {
    var d = parseerDatum(r.datum);
    if (d && normaliseerTekst(r.titel).indexOf(normaliseerTekst(naam)) > -1) eigen[d] = true;
  });
  var tekst = { nl: String(inst.tekst_bookclub || '').trim(), en: String(inst.tekst_bookclub_en || '').trim() || String(inst.tekst_bookclub || '').trim() };
  var link = veiligeCoverUrl(inst.bookclub_link);
  var datums = bookclubDatums(vandaag, week, dag, 3);
  return {
    naam: naam, regel: bookclubRegel(week, dag), uur: schoon(inst.bookclub_uur), tekst: tekst, link: link, volgende: datums,
    events: datums.filter(function (d) { return !eigen[d]; }).map(function (d) {
      return { datum: d, uur: schoon(inst.bookclub_uur), titel: { nl: naam, en: naam }, tekst: tekst, locatie: '', afbeelding: '', link: link };
    })
  };
}
