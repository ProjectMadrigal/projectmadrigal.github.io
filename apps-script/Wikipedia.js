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
  // Elk ander antwoord dan 200 (geweigerd, te druk, storing) is geen "niet gevonden": later opnieuw proberen.
  if (z.code !== 200 || !z.data || !z.data.query) return { fout: 'zoeken gaf code ' + z.code };
  var titels = ((z.data && z.data.query && z.data.query.search) || []).map(function (r) { return r.title; });
  var kandidaten = kiesWikiTitels(boek, titels);
  for (var i = 0; i < kandidaten.length && i < 3; i++) {
    Utilities.sleep(WIKI_PAUZE_MS);
    var s = haalJson(basis + '/api/rest_v1/page/summary/' + encodeURIComponent(kandidaten[i].replace(/ /g, '_')));
    // 404: dit artikel bestaat niet, dan het volgende. Een ander antwoord dan 200: later opnieuw.
    if (s.code === 404) continue;
    if (s.code !== 200) return { fout: 'samenvatting gaf code ' + s.code };
    if (wikiSamenvattingOk(boek, s.data) && wikiLink(s.data)) {
      return { tekst: maakBeschrijvingNetjes(s.data.extract), link: wikiLink(s.data) };
    }
  }
  return {};
}

/** Menu: zoekt beschrijvingen bij Wikipedia, in porties. */
function zoekBeschrijvingenWikipedia() {
  var start = Date.now();
  if (!startAchtergrond('zoekBeschrijvingenWikipedia')) { meldAlBezig('zoekBeschrijvingenWikipedia'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '', nietBewaard = 0, laatste = null, controle = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('wiki_gezocht') === -1 || tabel.kop.indexOf('beschrijving_bron') === -1) {
      meld('De kolommen wiki_gezocht en beschrijving_bron ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.');
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
      laatste = boek;
      verwerkt++;
      if (verwerkt % 20 === 0 && !bewaarAchtergrond(tabel)) nietBewaard++;
      Utilities.sleep(WIKI_PAUZE_MS);
    }
    if (!bewaarAchtergrond(tabel)) nietBewaard++;
    // Controle: hoeveel boeken heeft de spreadsheet zelf nog nodig? Zo zien we of het bewaren lukte.
    rest = leesTabel('Catalogus').rijen.filter(heeftWikiNodig).length;
    if (laatste) controle = wikiControle(tabel, laatste);
  } finally {
    stopAchtergrond('zoekBeschrijvingenWikipedia');
  }
  verwijderTriggers('zoekBeschrijvingenWikipedia');
  if (rest > 0) ScriptApp.newTrigger('zoekBeschrijvingenWikipedia').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) { leegCache(); planVertaling(2); }
  logboek('menu', 'zoekBeschrijvingenWikipedia', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan volgens de spreadsheet' +
    (fout ? ' (Wikipedia: ' + fout + ', later verder)' : '') + (nietBewaard ? ' (bewaren lukte ' + nietBewaard + ' keer niet: de spreadsheet was bezet)' : '') +
    (controle ? ' | ' + controle : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Wikipedia, ' + gevonden + ' beschrijvingen gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/**
 * Controle na het bewaren: wat staat er echt in de cel van het laatst opgezochte boek?
 * Meldt ook dubbele kolommen en dubbele boek_id's, want die sturen het bewaren naar een andere rij.
 */
function wikiControle(tabel, boek) {
  var kop = tabel.kop;
  var kolom = kop.indexOf('wiki_gezocht');
  var cel = tabel.blad.getRange(boek._rij, kolom + 1).getValue();
  return 'controle rij ' + boek._rij + ' (' + (boek.boek_id || 'zonder boek_id') + '): wiki_gezocht is "' + (isDatumObject(cel) ? parseerDatum(cel) : String(cel)) + '"' +
    wikiDubbels(kop, tabel.rijen);
}

/** Tekst over dubbele kolommen wiki_gezocht en dubbele boek_id's, of ''. */
function wikiDubbels(kop, rijen) {
  var kolommen = kop.filter(function (k) { return k === 'wiki_gezocht'; }).length;
  var gezien = {}, dubbel = 0;
  rijen.forEach(function (r) {
    if (isLeeg(r.boek_id)) return;
    var id = String(r.boek_id);
    if (gezien[id]) dubbel++;
    gezien[id] = true;
  });
  return (kolommen > 1 ? ', ' + kolommen + ' kolommen wiki_gezocht' : '') + (dubbel ? ', ' + dubbel + ' dubbele boek_id\'s' : '');
}

/** Menu: zoekt één bekend boek op en toont wat Wikipedia antwoordt. Zo zie je of Wikipedia het script weigert. */
function testWikipedia() {
  var boek = { titel: 'Giovanni\'s Room', auteur: 'Baldwin, James' };
  var regels = [];
  WIKI_TALEN.forEach(function (taal) {
    var z = haalJson('https://' + taal + '.wikipedia.org/w/api.php?action=query&list=search&srlimit=5&srprop=&format=json&srsearch=' + encodeURIComponent('Giovanni Baldwin'));
    var titels = ((z.data && z.data.query && z.data.query.search) || []).map(function (r) { return r.title; });
    regels.push(taal + ': zoeken gaf code ' + z.code + ', ' + titels.length + ' resultaten' + (titels.length ? ' (' + titels.slice(0, 3).join(', ') + ')' : ''));
    var r = zoekWikipedia(boek, taal);
    regels.push(taal + ': ' + (r.fout ? 'fout, ' + r.fout : r.tekst ? 'beschrijving gevonden: ' + r.tekst.slice(0, 80) + '...' : 'geen passende beschrijving'));
  });
  logboek('menu', 'testWikipedia', regels.join(' | ').slice(0, 450));
  meld(regels.join('\n'));
}
