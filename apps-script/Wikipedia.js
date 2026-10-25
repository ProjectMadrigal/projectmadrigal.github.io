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

/**
 * Zet de pagina's uit één antwoord van Wikipedia (zoeken + eerste alinea in één vraag) om naar
 * de vorm die wikiSamenvattingOk en wikiLink verwachten. Volgorde zoals Wikipedia ze rangschikt.
 */
function wikiPaginas(data) {
  var paginas = ((data && data.query && data.query.pages) || []).slice();
  paginas.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
  return paginas.map(function (p) {
    var doorverwijs = !!(p.pageprops && p.pageprops.disambiguation !== undefined);
    return { titel: p.title, type: doorverwijs ? 'disambiguation' : 'standard', extract: p.extract || '',
      description: p.description || '', content_urls: { desktop: { page: p.fullurl || '' } } };
  });
}

/** Kiest uit de pagina's de eerste die past bij het boek. Geeft { tekst, link } of {}. */
function wikiKies(boek, paginas) {
  var goed = kiesWikiTitels(boek, paginas.map(function (p) { return p.titel; }));
  for (var i = 0; i < paginas.length; i++) {
    var s = paginas[i];
    if (goed.indexOf(s.titel) > -1 && wikiSamenvattingOk(boek, s) && wikiLink(s)) {
      return { tekst: maakBeschrijvingNetjes(s.extract), link: wikiLink(s) };
    }
  }
  return {};
}

/** De vraag aan Wikipedia: zoeken en meteen de eerste alinea, de link en doorverwijspagina's. */
function wikiVraagUrl(taal, vraag) {
  return 'https://' + taal + '.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&generator=search&gsrlimit=5&gsrsearch=' + encodeURIComponent(vraag) +
    '&prop=extracts%7Cinfo%7Cpageprops%7Cdescription&exintro=1&explaintext=1&exlimit=5&inprop=url&ppprop=disambiguation';
}

/** Zoekt een boek op bij Wikipedia in één taal. Geeft { tekst, link }, {} of { fout }. */
function zoekWikipedia(boek, taal) {
  var vraag = titelSleutel(boek.titel) + ' ' + achternaam(boek.auteur);
  var z;
  try {
    z = haalJson(wikiVraagUrl(taal, vraag));
  } catch (e) {
    // Google laat per dag maar een beperkt aantal vragen naar buiten toe. Op is op, tot morgen.
    if (/te vaak|too many times/i.test(e.message)) { noteerDaglimiet(); return { fout: 'dagelijkse limiet van Google voor vragen naar buiten bereikt', quotum: true }; }
    return { fout: e.message };
  }
  // Elk ander antwoord dan 200 (geweigerd, te druk, storing) is geen "niet gevonden": later opnieuw proberen.
  if (z.code !== 200 || !z.data) return { fout: 'zoeken gaf code ' + z.code };
  if (z.data.error) return { fout: 'Wikipedia meldt ' + (z.data.error.code || 'een fout') };
  return wikiKies(boek, wikiPaginas(z.data));
}

/** Menu: zoekt beschrijvingen bij Wikipedia, in porties. */
function zoekBeschrijvingenWikipedia() {
  var start = Date.now();
  if (wachtOpDaglimiet('zoekBeschrijvingenWikipedia')) return;
  if (!startAchtergrond('zoekBeschrijvingenWikipedia')) { meldAlBezig('zoekBeschrijvingenWikipedia'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, quotum = false, vast = false, fout = '', nietBewaard = 0, laatste = null, controle = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('wiki_gezocht') === -1 || tabel.kop.indexOf('beschrijving_bron') === -1) {
      meld('De kolommen wiki_gezocht en beschrijving_bron ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.');
      return;
    }
    var vandaag = vandaagTekst();
    herstelKolom(tabel, 'wiki_gezocht');
    var teDoen = tabel.rijen.filter(heeftWikiNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > WIKI_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = {};
      for (var t = 0; t < WIKI_TALEN.length && !r.tekst && !r.fout; t++) r = zoekWikipedia(boek, WIKI_TALEN[t]);
      if (r.fout) { wachten = true; quotum = !!r.quotum; fout = r.fout; break; }
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
    if (laatste) {
      controle = wikiControle(tabel, laatste);
      // Blijft de cel leeg, dan zoeken we telkens dezelfde boeken op. Stoppen, anders is de limiet van Google zo op.
      vast = wikiCelWaarde(tabel, laatste) === '';
    }
  } finally {
    stopAchtergrond('zoekBeschrijvingenWikipedia');
  }
  verwijderTriggers('zoekBeschrijvingenWikipedia');
  if (rest > 0 && !vast) ScriptApp.newTrigger('zoekBeschrijvingenWikipedia').timeBased().after((quotum ? 6 * 60 : wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) { leegCache(); planVertaling(2); }
  logboek('menu', 'zoekBeschrijvingenWikipedia', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan volgens de spreadsheet' +
    (fout ? ' (Wikipedia: ' + fout + ', later verder)' : '') + (nietBewaard ? ' (bewaren lukte ' + nietBewaard + ' keer niet: de spreadsheet was bezet)' : '') +
    (controle ? ' | ' + controle : '') + (vast ? ' | GESTOPT: bewaren lukt niet. Start opnieuw via het menu zodra dat opgelost is.' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Wikipedia, ' + gevonden + ' beschrijvingen gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/**
 * Een technische kolom hoort geen keuzelijst en geen samengevoegde cellen te hebben. Een regel
 * die er per ongeluk op terechtkwam, halen we weg, samengevoegde cellen maken we los.
 * De kolom krijgt de opmaak tekst: in deze kolom bleef een datum (als datum geschreven) nooit
 * staan, gewone tekst wel. Daarom bewaren we de dag als tekst, bv. 2026-10-25.
 */
function herstelKolom(tabel, naam) {
  var kolom = tabel.kop.indexOf(naam) + 1;
  if (!kolom || tabel.blad.getMaxRows() < 2) return;
  var bereik = tabel.blad.getRange(2, kolom, tabel.blad.getMaxRows() - 1, 1);
  bereik.clearDataValidations();
  bereik.getMergedRanges().forEach(function (m) { m.breakApart(); });
  bereik.setNumberFormat('@');
}

/** Wat staat er echt in de cel wiki_gezocht van dit boek? Een datum als 2026-10-25, anders de tekst. */
function wikiCelWaarde(tabel, boek) {
  var cel = tabel.blad.getRange(boek._rij, tabel.kop.indexOf('wiki_gezocht') + 1).getValue();
  return isDatumObject(cel) ? parseerDatum(cel) : String(cel);
}

/**
 * Controle na het bewaren: wat staat er echt in de cel van het laatst opgezochte boek?
 * Meldt ook dubbele kolommen en dubbele boek_id's, want die sturen het bewaren naar een andere rij.
 */
function wikiControle(tabel, boek) {
  return 'controle rij ' + boek._rij + ' (' + (boek.boek_id || 'zonder boek_id') + '): wiki_gezocht is "' + wikiCelWaarde(tabel, boek) + '"' +
    wikiDubbels(tabel.kop, tabel.rijen);
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

/**
 * Menu: probeert stap voor stap wiki_gezocht te bewaren bij het eerste boek dat nog aan de beurt is,
 * en zet de cel daarna terug leeg. Zo zien we waar het bewaren misloopt.
 */
function testWikipediaBewaren() {
  var tabel = leesTabel('Catalogus');
  var boek = tabel.rijen.filter(heeftWikiNodig)[0];
  if (!boek) { meld('Er is geen boek meer dat op Wikipedia wacht.'); return; }
  var kolom = tabel.kop.indexOf('wiki_gezocht') + 1;
  var cel = tabel.blad.getRange(boek._rij, kolom);
  var lees = function () { SpreadsheetApp.flush(); var w = cel.getValue(); return isDatumObject(w) ? parseerDatum(w) : '"' + String(w) + '"'; };
  var regels = ['rij ' + boek._rij + ' (' + (boek.boek_id || 'zonder boek_id') + '), kolom ' + kolom + ' met kop "' + tabel.blad.getRange(1, kolom).getValue() + '"',
    'voor: ' + lees() + ', formule: "' + cel.getFormula() + '", opmaak: ' + cel.getNumberFormat() + ', regel: ' + (cel.getDataValidation() ? 'ja' : 'nee') +
    ', beveiligd: ' + tabel.blad.getProtections(SpreadsheetApp.ProtectionType.RANGE).length + ' bereiken, ' + tabel.blad.getProtections(SpreadsheetApp.ProtectionType.SHEET).length + ' tabblad'];
  try {
    wijzig(boek, { wiki_gezocht: vandaagTekst() });
    regels.push('bewaren zoals de run: ' + (bewaarAchtergrond(tabel) ? 'gelukt' : 'slot bezet') + ', daarna: ' + lees());
    cel.setValue(new Date());
    regels.push('rechtstreeks in de cel: ' + lees());
    cel.setValue('test');
    regels.push('tekst "test" in de cel: ' + lees() + ', weergave: "' + cel.getDisplayValue() + '"');
    var samen = cel.getMergedRanges();
    regels.push('samengevoegd: ' + (cel.isPartOfMerge() ? 'ja, ' + samen.map(function (m) { return m.getA1Notation(); }).join(', ') : 'nee') +
      ', cel ' + cel.getA1Notation() + ', tabblad ' + tabel.blad.getMaxRows() + ' rijen en ' + tabel.blad.getMaxColumns() + ' kolommen, filter: ' + (tabel.blad.getFilter() ? 'ja' : 'nee'));
    if (samen.length) {
      samen.forEach(function (m) { m.breakApart(); });
      cel.setValue(new Date());
      regels.push('losgemaakt, rechtstreeks: ' + lees());
    }
    var regel = cel.getDataValidation();
    if (regel) {
      regels.push('regel: ' + regel.getCriteriaType() + ' ' + JSON.stringify(regel.getCriteriaValues()).slice(0, 120) + ', ongeldig toegelaten: ' + regel.getAllowInvalid());
      cel.clearDataValidations();
      cel.setValue(new Date());
      regels.push('zonder regel, rechtstreeks: ' + lees());
    }
  } catch (e) {
    regels.push('fout: ' + e.message);
  } finally {
    cel.setValue('');
    regels.push('teruggezet: ' + lees());
  }
  logboek('menu', 'testWikipediaBewaren', regels.join(' | ').slice(0, 450));
  meld(regels.join('\n'));
}

/** Menu: zoekt één bekend boek op en toont wat Wikipedia antwoordt. Zo zie je of Wikipedia het script weigert. */
function testWikipedia() {
  var boek = { titel: 'Giovanni\'s Room', auteur: 'Baldwin, James' };
  var regels = [];
  WIKI_TALEN.forEach(function (taal) {
    var z = haalJson(wikiVraagUrl(taal, titelSleutel(boek.titel) + ' ' + achternaam(boek.auteur)));
    var paginas = wikiPaginas(z.data);
    regels.push(taal + ': code ' + z.code + ', ' + paginas.length + ' pagina\'s' + (paginas.length ? ' (' + paginas.slice(0, 3).map(function (p) {
      return p.titel + ', ' + String(p.extract).length + ' tekens';
    }).join('; ') + ')' : '') + (z.data && z.data.error ? ', fout ' + z.data.error.code : ''));
    var r = zoekWikipedia(boek, taal);
    regels.push(taal + ': ' + (r.fout ? 'fout, ' + r.fout : r.tekst ? 'beschrijving gevonden: ' + r.tekst.slice(0, 80) + '...' : 'geen passende beschrijving'));
  });
  logboek('menu', 'testWikipedia', regels.join(' | ').slice(0, 450));
  meld(regels.join('\n'));
}
