/**
 * ZoekOpnieuw.js
 * Een boek met nieuwe of betere gegevens (ISBN, titel, auteur) opnieuw laten zoeken naar een cover en een beschrijving.
 *
 *   - Elk boek krijgt in de kolom zoek_sleutel een vingerafdruk van het ISBN, de titel en de auteur (en de originele
 *     titel). Verandert een van die gegevens, dan klopt de vingerafdruk niet meer.
 *   - Mist zo'n boek nog een cover, dan maakt het script de vinkjes van de cover-zoektochten leeg (Google Books,
 *     Open Library, bol.com, Internet Archive). Mist het een beschrijving, dan die van de beschrijvingen (Google
 *     Books, Open Library, Wikipedia). Bij een film: film_gezocht.
 *   - Daarna starten de zoektochten vanzelf, na elkaar.
 *   - De eerste keer heeft geen enkel boek een vingerafdruk: dan zoekt het script opnieuw bij alle boeken die
 *     nog een cover of beschrijving missen.
 *   - Uitgeverij, jaartal en taal tellen niet mee: die vullen de zoektochten zelf aan, en dan zou het blijven herbeginnen.
 *   - Werkt elk uur vanzelf, en via Madrigal > Covers.
 */

var ZOEK_OPNIEUW_COVER = ['cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'gb_gecontroleerd', 'ol_gecontroleerd'];
var ZOEK_OPNIEUW_BESCHRIJVING = ['beschrijving_gezocht', 'wiki_gezocht', 'gb_gecontroleerd', 'ol_gecontroleerd'];
var ZOEK_OPNIEUW_FILM = ['film_gezocht'];

/** De vingerafdruk van de gegevens waarop de zoektochten zoeken. Kort, zodat de kolom klein blijft. */
function zoekSleutel(boek) {
  var tekst = [normaliseerIsbn(boek.isbn).isbn || schoon(boek.isbn), normaliseerTekst(boek.titel),
    controleAuteurSleutel(boek.auteur), normaliseerTekst(boek.originele_titel)].join('|');
  var h1 = 5381, h2 = 52711;
  for (var i = 0; i < tekst.length; i++) {
    var c = tekst.charCodeAt(i);
    h1 = (h1 * 33) ^ c;
    h2 = (h2 * 33) ^ c;
    h1 |= 0; h2 |= 0;
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

/**
 * Vergelijkt de vingerafdruk van elk boek. Maakt de vinkjes leeg waar nodig (wijzig).
 * Geeft { cover, beschrijving, film } (aantal boeken waarvoor het script opnieuw zoekt) en { nieuw } (nieuwe vingerafdrukken).
 */
function zoekOpnieuwBijNieuweInfo(catalogus) {
  var uit = { cover: 0, beschrijving: 0, film: 0, nieuw: 0 };
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel)) return;
    var sleutel = zoekSleutel(b);
    if (schoon(b.zoek_sleutel) === sleutel) return;
    var velden = { zoek_sleutel: sleutel };
    var leeg = function (namen) {
      var iets = false;
      namen.forEach(function (n) { if (!isLeeg(b[n])) { velden[n] = ''; iets = true; } });
      return iets;
    };
    if (isFilm(b)) {
      if ((isLeeg(b.cover_url) || isLeeg(b.beschrijving)) && leeg(ZOEK_OPNIEUW_FILM)) uit.film++;
    } else {
      if (isLeeg(b.cover_url) && leeg(ZOEK_OPNIEUW_COVER)) uit.cover++;
      if (isLeeg(b.beschrijving) && leeg(ZOEK_OPNIEUW_BESCHRIJVING)) uit.beschrijving++;
    }
    wijzig(b, velden);
    uit.nieuw++;
  });
  return uit;
}

/** Doet het werk in de spreadsheet en plant de zoektochten. Geeft het resultaat. */
function zoekOpnieuwUitvoeren() {
  zorgVoorTabbladen(['Catalogus']); // kolom zoek_sleutel
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    uit = zoekOpnieuwBijNieuweInfo(tabel.rijen);
    if (uit.nieuw) {
      var kolommen = ['zoek_sleutel'].concat(ZOEK_OPNIEUW_COVER, ZOEK_OPNIEUW_BESCHRIJVING, ZOEK_OPNIEUW_FILM)
        .filter(function (k, i, a) { return a.indexOf(k) === i && tabel.kop.indexOf(k) > -1; });
      schrijfKolommen(tabel, kolommen);
    }
  } finally {
    lock.releaseLock();
  }
  // De zoektochten na elkaar, zodat ze elkaar niet in de weg zitten. Open Library start daarna zelf
  // Google Books, en Google Books daarna de beschrijvingen.
  if (uit.cover || uit.beschrijving) {
    planTaak('vulAanUitOpenLibrary', 60 * 1000);
    if (uit.cover) {
      planTaak('zoekCoversAndereUitgaven', 15 * 60 * 1000);
      planTaak('zoekCoversBol', 25 * 60 * 1000);
      planTaak('zoekCoversInternetArchive', 35 * 60 * 1000);
    }
    if (uit.beschrijving) planTaak('zoekBeschrijvingenWikipedia', 45 * 60 * 1000);
  }
  if (uit.film) planTaak('vulFilmsAan', 55 * 60 * 1000);
  return uit;
}

function zoekOpnieuwTekst(uit) {
  return 'Het script zoekt opnieuw: ' + uit.cover + ' boeken naar een cover, ' + uit.beschrijving + ' boeken naar een beschrijving, ' +
    uit.film + ' films. De zoektochten starten vanzelf, na elkaar, binnen het uur.';
}

/** Menu: Covers > Zoek opnieuw bij boeken met nieuwe gegevens. */
function zoekOpnieuwMenu() {
  var uit = zoekOpnieuwUitvoeren();
  var tekst = uit.cover || uit.beschrijving || uit.film ? zoekOpnieuwTekst(uit) : 'Geen enkel boek kreeg nieuwe gegevens sinds de vorige keer.';
  logboek('menu', 'zoekOpnieuw', tekst);
  meld(tekst);
}

/** Vanzelf, elk uur (vanuit verwerkNieuweBoekenAutomatisch). */
function zoekOpnieuwAutomatisch() {
  var uit = zoekOpnieuwUitvoeren();
  if (uit.cover || uit.beschrijving || uit.film) logboek('systeem', 'zoekOpnieuw', zoekOpnieuwTekst(uit));
}
