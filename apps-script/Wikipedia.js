/**
 * Wikipedia.js
 * Beschrijvingen van bekende boeken uit Wikipedia: de eerste alinea van het artikel over het
 * boek, eerst in het Nederlands, anders in het Engels (die vertaalt het script daarna).
 *
 *   - Enkel boeken zonder beschrijving, met een titel en een auteur.
 *   - Enkel als de titel van het artikel goed overeenkomt met de titel van het boek, en de
 *     achternaam van de auteur in de samenvatting staat. Zo vermijden we een verkeerd artikel.
 *   - De tekst van Wikipedia valt onder de licentie CC BY-SA 4.0. Daarom bewaren we de link
 *     naar het artikel in beschrijving_bron, en toont de website "Bron: Wikipedia".
 *   - Elk opgezocht boek krijgt een datum in wiki_gezocht. Opnieuw laten zoeken? Maak die cel leeg.
 */

var WIKI_TALEN = ['nl', 'en'];
var WIKI_PAUZE_MS = 500; // rustig zoeken: Wikipedia remt anders sneller af
var WIKI_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

/** Heeft dit boek nog een beschrijving van Wikipedia nodig? */
function heeftWikiNodig(boek) {
  return isLeeg(boek.beschrijving) && isLeeg(boek.wiki_gezocht) && !isLeeg(boek.titel) && !isLeeg(boek.auteur);
}

/** Titel van een artikel zonder "(roman)", "(boek)", ... aan het einde. */
function wikiTitelZonderUitleg(titel) {
  return String(titel || '').replace(/\s*\([^)]*\)\s*$/, '');
}

/** Kiest uit de zoekresultaten de titels van artikels die goed overeenkomen met de titel van het boek. */
function kiesWikiTitels(boek, titels) {
  var gezocht = titelSleutel(boek.titel);
  return (titels || []).filter(function (t) {
    return gelijkenis(gezocht, titelSleutel(wikiTitelZonderUitleg(t))) >= 0.85;
  });
}

/** Is deze samenvatting van Wikipedia bruikbaar voor dit boek? (geen doorverwijspagina, auteur vermeld) */
function wikiSamenvattingOk(boek, s) {
  if (!s || s.type !== 'standard' || !s.extract || String(s.extract).length < 80) return false;
  var naam = achternaam(boek.auteur);
  if (!naam) return false;
  return normaliseerTekst(s.extract + ' ' + (s.description || '')).split(' ').indexOf(naam) > -1;
}

/** Een veilige link naar een artikel van Wikipedia, of ''. */
function wikiLink(s) {
  var url = s && s.content_urls && s.content_urls.desktop && s.content_urls.desktop.page;
  return /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(String(url || '')) ? url : '';
}

/** Zoekt een boek op bij Wikipedia in één taal. Geeft { tekst, link }, {} of { fout }. */
function zoekWikipedia(boek, taal) {
  var basis = 'https://' + taal + '.wikipedia.org';
  var vraag = titelSleutel(boek.titel) + ' ' + achternaam(boek.auteur);
  var z = haalJson(basis + '/w/api.php?action=query&list=search&srlimit=5&srprop=&format=json&srsearch=' + encodeURIComponent(vraag));
  if (z.code === 429 || z.code >= 500) return { fout: 'code ' + z.code };
  var titels = ((z.data && z.data.query && z.data.query.search) || []).map(function (r) { return r.title; });
  var kandidaten = kiesWikiTitels(boek, titels);
  for (var i = 0; i < kandidaten.length && i < 3; i++) {
    Utilities.sleep(WIKI_PAUZE_MS);
    var s = haalJson(basis + '/api/rest_v1/page/summary/' + encodeURIComponent(kandidaten[i].replace(/ /g, '_')));
    if (s.code === 429 || s.code >= 500) return { fout: 'code ' + s.code };
    if (wikiSamenvattingOk(boek, s.data) && wikiLink(s.data)) {
      return { tekst: maakBeschrijvingNetjes(s.data.extract), link: wikiLink(s.data) };
    }
  }
  return {};
}

/** Menu: zoekt beschrijvingen bij Wikipedia, in porties. */
function zoekBeschrijvingenWikipedia() {
  var start = Date.now();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { meld('Er loopt al een andere bewerking. Probeer het zo meteen opnieuw.'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('wiki_gezocht') === -1 || tabel.kop.indexOf('beschrijving_bron') === -1) {
      meld('De kolommen wiki_gezocht en beschrijving_bron ontbreken nog. Voer eerst Madrigal > 1. Installeer tabbladen uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftWikiNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > WIKI_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = {};
      for (var t = 0; t < WIKI_TALEN.length && !r.tekst && !r.fout; t++) r = zoekWikipedia(boek, WIKI_TALEN[t]);
      if (r.fout) { wachten = true; fout = r.fout; break; }
      var velden = { wiki_gezocht: vandaag };
      if (r.tekst) {
        velden.beschrijving = r.tekst;
        velden.beschrijving_bron = r.link;
        velden.beschrijving_vertaald = '';
        gevonden++;
      }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarTabel(tabel);
      Utilities.sleep(WIKI_PAUZE_MS);
    }
    bewaarTabel(tabel);
    rest = tabel.rijen.filter(heeftWikiNodig).length;
  } finally {
    lock.releaseLock();
  }
  verwijderTriggers('zoekBeschrijvingenWikipedia');
  if (rest > 0) ScriptApp.newTrigger('zoekBeschrijvingenWikipedia').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) { leegCache(); planVertaling(2); }
  logboek('menu', 'zoekBeschrijvingenWikipedia', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan' + (fout ? ' (Wikipedia: ' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Wikipedia, ' + gevonden + ' beschrijvingen gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}
