/**
 * Aankoop.js
 * De aankooplijst: boeken die de bib wil kopen.
 *
 *   - Vrijwilligers en het bestuur stellen boeken voor (titel, auteur, ISBN, link, waarom).
 *     Vrijwilligers voegen enkel toe. Aanpassen, aanduiden en verwijderen kan enkel het bestuur.
 *   - Het bestuur leest een lijst van bol.com in met de bladwijzer "Naar Madrigal" (zie aankoop.js).
 *     bol.com weigert de servers van Google (code 403), daarom leest de bladwijzer de boekpagina's
 *     in de browser en kopieert hij de nodige stukjes. Dit script haalt daar titel, auteur, ISBN,
 *     prijs en genre uit. Of je plakt ISBN's: dan zoekt het script de rest op bij Google Books.
 *   - Komt een boek in de Catalogus (zelfde ISBN, of zelfde titel en auteur), dan krijgt het de
 *     status "in catalogus". Het blijft bewaard, en het bestuur kan het daarna echt verwijderen.
 *   - Het bestuur duidt boeken aan (kolom gekozen) en trekt daarvan een lijst: afdrukken,
 *     kopiëren of als CSV-bestand.
 *
 * Tabblad Aankooplijst. status: open of in catalogus.
 */

var AANKOOP_STATUS_OPEN = 'open';
var AANKOOP_STATUS_BINNEN = 'in catalogus';
var AANKOOP_MAX_BOL = 80;          // zoveel boeken leest het script hoogstens van één bol.com-lijst

/* ---------- Herkennen ---------- */

/** Een ISBN-13 uit invoer (ook ISBN-10 of met streepjes), of ''. */
function aankoopIsbn(waarde) {
  return normaliseerIsbn(waarde).isbn || '';
}

/** Staat dit boek al in de Catalogus? Zelfde ISBN, of dezelfde titel met dezelfde achternaam van de auteur. */
function aankoopInCatalogus(boek, catalogus) {
  var isbn = aankoopIsbn(boek.isbn);
  var titel = normaliseerTekst(boek.titel);
  var naam = achternaam(boek.auteur);
  return catalogus.filter(function (c) {
    if (isLeeg(c.boek_id)) return false;
    if (isbn && aankoopIsbn(c.isbn) === isbn) return true;
    if (!titel || normaliseerTekst(c.titel) !== titel) return false;
    return !naam || !achternaam(c.auteur) || achternaam(c.auteur) === naam;
  })[0] || null;
}

/** Staat dit boek al op de aankooplijst (zelfde ISBN, of zelfde titel en auteur)? */
function aankoopAlOpLijst(boek, rijen) {
  var isbn = aankoopIsbn(boek.isbn);
  var titel = normaliseerTekst(boek.titel);
  var naam = achternaam(boek.auteur);
  return rijen.filter(function (r) {
    if (isbn && aankoopIsbn(r.isbn) === isbn) return true;
    return titel && normaliseerTekst(r.titel) === titel && (!naam || !achternaam(r.auteur) || achternaam(r.auteur) === naam);
  })[0] || null;
}

/**
 * Zet open boeken die intussen in de Catalogus staan op "in catalogus". Geeft het aantal terug.
 * Het boek blijft op de lijst, zodat je ziet wat via de lijst binnenkwam.
 */
function aankoopBijwerken(rijen, catalogus, vandaag) {
  var n = 0;
  rijen.forEach(function (r) {
    if (normaliseerTekst(r.status) === AANKOOP_STATUS_BINNEN) return;
    var boek = aankoopInCatalogus(r, catalogus);
    if (!boek) return;
    wijzig(r, { status: AANKOOP_STATUS_BINNEN, boek_id: String(boek.boek_id), datum_binnen: vandaag, gekozen: '' });
    n++;
  });
  return n;
}

/* ---------- Toevoegen, aanpassen, verwijderen ---------- */

/** Een link mag enkel http(s) zijn. */
function aankoopLink(waarde) {
  var l = schoon(waarde);
  return /^https?:\/\/[^\s"'<>]+$/.test(l) ? l.slice(0, 400) : '';
}

/** Een prijs uit invoer: "12,99" of "€ 12,99" wordt 12.99. Leeg of ongeldig: ''. */
function aankoopPrijs(waarde) {
  var n = verkoopGetal(waarde);
  return n === null || n < 0 || n > 1000 ? '' : Math.round(n * 100) / 100;
}

/**
 * Een boek voorstellen. invoer: { titel, auteur, isbn, link, reden, genre?, prijs? }
 * Geeft { ok, tekst } of { ok: false, fout }.
 */
function aankoopToevoegen(rijen, catalogus, invoer, wie, vandaag, nieuwId, bron) {
  var boek = {
    titel: tekstInvoer(invoer.titel, 200), auteur: tekstInvoer(invoer.auteur, 120), isbn: aankoopIsbn(invoer.isbn),
    link: aankoopLink(invoer.link), reden: schoonMetRegels(invoer.reden).slice(0, 300),
    genre: tekstInvoer(invoer.genre, 80), prijs: aankoopPrijs(invoer.prijs)
  };
  if (!boek.titel) return { ok: false, fout: 'Vul de titel in.' };
  if (!isLeeg(invoer.isbn) && !boek.isbn) return { ok: false, fout: 'Dit ISBN klopt niet. Laat het leeg als je het niet kent.' };
  if (!isLeeg(invoer.link) && !boek.link) return { ok: false, fout: 'De link moet beginnen met https://' };
  var inCat = aankoopInCatalogus(boek, catalogus);
  if (inCat) return { ok: false, fout: '"' + boek.titel + '" staat al in de catalogus (' + inCat.boek_id + ').' };
  var dubbel = aankoopAlOpLijst(boek, rijen);
  if (dubbel) return { ok: false, fout: '"' + boek.titel + '" staat al op de aankooplijst.' };
  voegToe(rijen, Object.assign(boek, {
    aankoop_id: nieuwId(), datum: vandaag, voorgesteld_door: tekstInvoer(wie, 40) || 'onbekend',
    status: AANKOOP_STATUS_OPEN, gekozen: '', bron: bron || ''
  }));
  return { ok: true, tekst: '"' + boek.titel + '" staat op de aankooplijst. Dank je!' };
}

/** Het bestuur past een boek aan, of duidt het aan voor aankoop. invoer: { aankoop_id, ...velden, gekozen? } */
function aankoopAanpassen(rijen, invoer) {
  var rij = rijen.filter(function (r) { return String(r.aankoop_id) === String(invoer.aankoop_id); })[0];
  if (!rij) return { ok: false, fout: 'Dit boek staat niet (meer) op de aankooplijst.' };
  var velden = {};
  if (invoer.hasOwnProperty('gekozen')) velden.gekozen = invoer.gekozen ? 'ja' : '';
  if (invoer.hasOwnProperty('titel')) {
    velden.titel = tekstInvoer(invoer.titel, 200);
    if (!velden.titel) return { ok: false, fout: 'Vul de titel in.' };
  }
  if (invoer.hasOwnProperty('auteur')) velden.auteur = tekstInvoer(invoer.auteur, 120);
  if (invoer.hasOwnProperty('isbn')) {
    velden.isbn = aankoopIsbn(invoer.isbn);
    if (!isLeeg(invoer.isbn) && !velden.isbn) return { ok: false, fout: 'Dit ISBN klopt niet.' };
  }
  if (invoer.hasOwnProperty('genre')) velden.genre = tekstInvoer(invoer.genre, 80);
  if (invoer.hasOwnProperty('prijs')) {
    velden.prijs = aankoopPrijs(invoer.prijs);
    if (!isLeeg(invoer.prijs) && velden.prijs === '') return { ok: false, fout: 'Vul een geldige prijs in, bv. 12,99.' };
  }
  if (invoer.hasOwnProperty('link')) {
    velden.link = aankoopLink(invoer.link);
    if (!isLeeg(invoer.link) && !velden.link) return { ok: false, fout: 'De link moet beginnen met https://' };
  }
  if (invoer.hasOwnProperty('reden')) velden.reden = schoonMetRegels(invoer.reden).slice(0, 300);
  wijzig(rij, velden);
  return { ok: true, tekst: invoer.hasOwnProperty('gekozen') && Object.keys(velden).length === 1
    ? (velden.gekozen ? '"' + schoon(rij.titel) + '" is aangeduid voor aankoop.' : '"' + schoon(rij.titel) + '" is niet meer aangeduid.')
    : '"' + schoon(rij.titel) + '" is bewaard.' };
}

/** Het bestuur verwijdert boeken van de lijst. invoer: { aankoop_id } of { ids: [...] } */
function aankoopVerwijderen(rijen, invoer) {
  var ids = [].concat(invoer.ids || []).concat(invoer.aankoop_id ? [invoer.aankoop_id] : []).map(String);
  var weg = rijen.filter(function (r) { return ids.indexOf(String(r.aankoop_id)) > -1; });
  if (!weg.length) return { ok: false, fout: 'Dit boek staat niet (meer) op de aankooplijst.' };
  weg.forEach(function (r) { r._verwijderen = true; });
  return { ok: true, tekst: weg.length === 1 ? '"' + schoon(weg[0].titel) + '" is verwijderd.' : weg.length + ' boeken zijn verwijderd.' };
}

/** Alle aanduidingen weg (bv. nadat de bestelling de deur uit is). */
function aankoopAllesUitvinken(rijen) {
  var n = 0;
  rijen.forEach(function (r) { if (jaNee(r.gekozen) === 'ja') { wijzig(r, { gekozen: '' }); n++; } });
  return { ok: true, tekst: n ? n + ' boeken zijn niet meer aangeduid.' : 'Er was niets aangeduid.' };
}

/** De lijst voor het scherm: open boeken eerst (nieuwste bovenaan), daarna wat al in de catalogus staat. */
function aankoopOverzicht(rijen) {
  return rijen.filter(function (r) { return !isLeeg(r.aankoop_id) && !r._verwijderen; }).map(function (r) {
    var p = verkoopGetal(r.prijs);
    return {
      id: String(r.aankoop_id), t: schoon(r.titel), a: schoon(r.auteur), i: String(r.isbn || ''), g: schoon(r.genre),
      p: p === null ? null : p, l: aankoopLink(r.link), r: schoonMetRegels(r.reden), d: parseerDatum(r.datum) || '',
      w: schoon(r.voorgesteld_door), k: jaNee(r.gekozen) === 'ja',
      s: normaliseerTekst(r.status) === AANKOOP_STATUS_BINNEN ? 'binnen' : 'open', b: String(r.boek_id || ''),
      db: parseerDatum(r.datum_binnen) || ''
    };
  }).sort(function (a, b) {
    if (a.s !== b.s) return a.s === 'open' ? -1 : 1;
    return String(b.d).localeCompare(String(a.d)) || a.t.localeCompare(b.t);
  });
}

/* ---------- bol.com ---------- */

/** Is dit een link naar bol.com? */
function isBolLink(link) {
  return /^https:\/\/(www\.)?bol\.com\//.test(schoon(link));
}

/** Alle JSON-LD-blokken uit een webpagina, als objecten (ook @graph en lijsten worden platgemaakt). */
function jsonLdUitHtml(html) {
  var uit = [];
  var re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, m;
  function voeg(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(voeg); return; }
    if (typeof o !== 'object') return;
    uit.push(o);
    if (o['@graph']) voeg(o['@graph']);
  }
  while ((m = re.exec(String(html || '')))) {
    try { voeg(JSON.parse(m[1])); } catch (e) { /* een kapot blok slaan we over */ }
  }
  return uit;
}

function ldType(o, type) {
  return [].concat(o['@type'] || []).some(function (t) { return String(t).toLowerCase() === type; });
}

function ldNaam(w) {
  if (!w) return '';
  if (Array.isArray(w)) return w.map(ldNaam).filter(Boolean).join(', ');
  if (typeof w === 'object') return schoon(w.name || '');
  return schoon(w);
}

/** Tekst uit HTML: entiteiten zoals &amp; en &#39; terug naar tekens. */
function htmlTekst(t) {
  return schoon(String(t || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(Number(n)); }));
}

/**
 * Wat een boekpagina van bol.com over het boek zegt: titel, auteur, ISBN, prijs, genre.
 * Eerst de gestructureerde gegevens (JSON-LD), daarna wat er als tekst op de pagina staat.
 */
function bolBoekUitHtml(html, link) {
  var boek = { titel: '', auteur: '', isbn: '', prijs: '', genre: '', link: link || '' };
  jsonLdUitHtml(html).forEach(function (o) {
    if (!ldType(o, 'product') && !ldType(o, 'book')) return;
    boek.titel = boek.titel || ldNaam(o.name);
    boek.auteur = boek.auteur || ldNaam(o.author);
    boek.isbn = boek.isbn || aankoopIsbn(o.isbn || o.gtin13 || o.gtin || o.sku || '');
    var bod = [].concat(o.offers || [])[0];
    if (bod && boek.prijs === '') boek.prijs = aankoopPrijs(bod.price || bod.lowPrice || '');
    boek.genre = boek.genre || ldNaam(o.genre) || ldNaam(o.category);
    if (o.workExample) {
      [].concat(o.workExample).forEach(function (w) { boek.isbn = boek.isbn || aankoopIsbn(w.isbn || ''); });
    }
  });
  var tekst = String(html || '');
  if (!boek.titel) {
    var og = tekst.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (og) boek.titel = htmlTekst(og[1]).replace(/\s*\|\s*bol(\.com)?\s*$/i, '');
  }
  if (!boek.isbn) {
    var ean = tekst.match(/(?:EAN|ISBN13|ISBN)[^0-9]{0,200}?(97[89]\d{10})/);
    if (ean) boek.isbn = aankoopIsbn(ean[1]);
  }
  if (boek.prijs === '') {
    var prijs = tekst.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i) || tekst.match(/"price"\s*:\s*"?([\d.]+)"?/);
    if (prijs) boek.prijs = aankoopPrijs(prijs[1]);
  }
  if (!boek.auteur) {
    var auteur = tekst.match(/"author"\s*:\s*(?:\[\s*)?\{[^}]*?"name"\s*:\s*"([^"]+)"/) || tekst.match(/>\s*Auteur\s*<[\s\S]{0,300}?<a[^>]*>([^<]+)<\/a>/i);
    if (auteur) boek.auteur = htmlTekst(auteur[1]);
  }
  if (!boek.genre) {
    var genre = tekst.match(/>\s*(?:Hoofdcategorie|Genre|Categorie)\s*<[\s\S]{0,300}?>([^<>]{3,60})</i);
    if (genre) boek.genre = htmlTekst(genre[1]);
  }
  boek.titel = htmlTekst(boek.titel);
  return boek;
}

var BLADWIJZER_KOP = 'MADRIGAL1'; // zo begint wat de bladwijzer kopieert (zie aankoop.js)

/**
 * Wat de bladwijzer "Naar Madrigal" kopieerde: MADRIGAL1 en een lijst { l: link, h: stukjes van de boekpagina }.
 * Geeft { ok, boeken, overgeslagen } of { ok: false, fout }.
 */
function aankoopUitBladwijzer(tekst) {
  var t = String(tekst || '').trim();
  if (t.indexOf(BLADWIJZER_KOP) !== 0) return { ok: false, fout: 'Dit is niet wat de bladwijzer Naar Madrigal kopieerde. Klik op bol.com op de bladwijzer, daarna op Kopieer voor Madrigal, en plak het hier.' };
  var lijst;
  try { lijst = JSON.parse(t.slice(BLADWIJZER_KOP.length)); } catch (e) { lijst = null; }
  if (!Array.isArray(lijst)) return { ok: false, fout: 'Wat je plakte, is niet volledig. Kopieer het opnieuw met de bladwijzer.' };
  var boeken = [], overgeslagen = 0;
  lijst.slice(0, AANKOOP_MAX_BOL).forEach(function (x) {
    var link = x && isBolLink(x.l) ? schoon(x.l) : '';
    var b = link ? bolBoekUitHtml(String(x.h || ''), link) : null;
    if (b && b.titel) boeken.push(b); else overgeslagen++;
  });
  overgeslagen += Math.max(0, lijst.length - AANKOOP_MAX_BOL);
  if (!boeken.length) return { ok: false, fout: 'Het script vond geen boeken in wat de bladwijzer kopieerde.' };
  return { ok: true, boeken: boeken, overgeslagen: overgeslagen };
}

/** Een boek uit het antwoord van Google Books (volumeInfo), voor ISBN's die je plakt. */
function aankoopUitGoogle(isbn, info) {
  info = info || {};
  return {
    isbn: isbn, titel: schoon(info.title) + (info.subtitle ? ': ' + schoon(info.subtitle) : ''),
    auteur: (info.authors || []).map(schoon).join(', '), genre: schoon((info.categories || [])[0] || ''), prijs: '', link: ''
  };
}

/** ISBN's uit geplakte tekst (gescheiden door komma's, spaties of regels), uniek en geldig. */
function isbnsUitTekst(tekst) {
  var gezien = {}, uit = [];
  (String(tekst || '').match(/[0-9][0-9\- ]{8,16}[0-9Xx]/g) || []).forEach(function (s) {
    var isbn = aankoopIsbn(s.replace(/ /g, ''));
    if (isbn && !gezien[isbn]) { gezien[isbn] = true; uit.push(isbn); }
  });
  return uit.slice(0, AANKOOP_MAX_BOL);
}

/* ---------- In Apps Script ---------- */

/** Actie aankoopLezen (bestuur, zonder slot: leest enkel): { bladwijzer } of { isbns }. Geeft boeken om na te kijken. */
function aankoopLezen(invoer) {
  var r;
  if (!isLeeg(invoer.isbns)) {
    var isbns = isbnsUitTekst(invoer.isbns);
    if (!isbns.length) return { ok: false, fout: 'Het script vond geen geldig ISBN in wat je plakte.' };
    var sleutel = leesInstellingen().google_books_api_key;
    var boeken = isbns.map(function (isbn) {
      var g = googleBooksZoek(isbn, sleutel);
      Utilities.sleep(200);
      return aankoopUitGoogle(isbn, g.items.length ? g.items[0].volumeInfo : null);
    });
    r = { ok: true, boeken: boeken, overgeslagen: 0 };
  } else {
    r = aankoopUitBladwijzer(invoer.bladwijzer);
  }
  if (!r.ok) return r;
  // Wat al in de catalogus of op de lijst staat, krijgt een vlag: dat voegt het scherm niet nog eens toe.
  var catalogus = leesTabel('Catalogus').rijen;
  var tabel = tabelOfLeeg('Aankooplijst');
  r.boeken.forEach(function (b) {
    var c = aankoopInCatalogus(b, catalogus);
    if (c) b.al = 'in de catalogus (' + c.boek_id + ')';
    else if (tabel && aankoopAlOpLijst(b, tabel.rijen)) b.al = 'al op de aankooplijst';
  });
  return r;
}

/** De acties van de aankooplijst (binnen het slot). */
function aankoopActie(actie, invoer, wie, rol) {
  var tabel = tabelOfLeeg('Aankooplijst');
  if (!tabel) return { ok: false, fout: 'Het tabblad Aankooplijst ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var catalogus = leesTabel('Catalogus').rijen;
  var vandaag = vandaagTekst();
  var r;
  if (actie === 'aankoopData') {
    // Boeken die intussen in de catalogus staan, vinken we meteen af.
    if (aankoopBijwerken(tabel.rijen, catalogus, vandaag)) bewaarTabel(tabel);
    return { ok: true, lijst: aankoopOverzicht(tabel.rijen) };
  }
  var nieuwId = nieuwIdVoor(tabel.rijen, 'aankoop_id', 'aankoop', 'K');
  if (actie === 'aankoopToevoegen') {
    r = aankoopToevoegen(tabel.rijen, catalogus, invoer, wie, vandaag, nieuwId);
  } else if (actie === 'aankoopImporteren') {
    // Na het nalezen van een bol.com-lijst of ISBN's: alles in één keer. Wat al bestaat, slaan we over.
    var gelukt = 0, fouten = [];
    (invoer.boeken || []).slice(0, AANKOOP_MAX_BOL).forEach(function (b) {
      var x = aankoopToevoegen(tabel.rijen, catalogus, b, wie, vandaag, nieuwId, isBolLink(b.link) ? 'bol.com' : 'isbn');
      if (x.ok) gelukt++; else fouten.push(x.fout);
    });
    r = { ok: gelukt > 0 || !fouten.length, gelukt: gelukt, fouten: fouten,
      tekst: gelukt + (gelukt === 1 ? ' boek staat' : ' boeken staan') + ' nu op de aankooplijst.' + (fouten.length ? ' ' + fouten.length + ' overgeslagen.' : ''),
      fout: gelukt ? '' : (fouten[0] || 'Niets toegevoegd.') };
  } else if (actie === 'aankoopAanpassen') {
    r = aankoopAanpassen(tabel.rijen, invoer);
  } else if (actie === 'aankoopVerwijderen') {
    r = aankoopVerwijderen(tabel.rijen, invoer);
  } else if (actie === 'aankoopUitvinken') {
    r = aankoopAllesUitvinken(tabel.rijen);
  } else {
    return { ok: false, fout: 'Onbekende actie.' };
  }
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, actie, String(invoer.aankoop_id || invoer.titel || (invoer.boeken ? invoer.boeken.length + ' boeken' : '')).slice(0, 80));
    r.lijst = aankoopOverzicht(tabel.rijen);
  }
  return r;
}
