/**
 * Titelcontrole.js
 * Een lijst om in de bib na te kijken of de titel en de auteur van een boek juist geschreven zijn.
 *
 *   - Het script vergelijkt drie bronnen: de stocklijst (tabbladen Stock en Zines), de oude website
 *     (projectmadrigal.be) en de Catalogus (wat nu op de website staat).
 *   - Enkel echte verschillen tellen: andere letters of woorden. Hoofdletters, leestekens, de volgorde
 *     van voornaam en achternaam, dezelfde naam twee keer, en een ondertitel die er bij de ene bron wel en bij
 *     de andere niet staat, tellen niet.
 *   - Een auteur die enkel anders geschreven is, zet het script meteen in de juiste vorm in de Catalogus:
 *     "Achternaam, Voornaam" (de vorm uit de stocklijst of de oude website), elke naam één keer.
 *   - Heeft de oude website (of de stocklijst) dezelfde titel met een ondertitel, dan komt die ondertitel erbij:
 *     "Titel: Ondertitel". Een titel met ondertitel wint altijd: een bron zonder ondertitel is geen verschil.
 *   - Een naam die volledig in een andere naam zit ("Aurora" en "Aurora Staff"), is geen verschil.
 *   - Voorletters worden voluit geschreven als een andere bron de voornaam geeft ("Bade, H." wordt "Bade, Hermanus").
 *   - Iets tussen haakjes of na een komma achter dezelfde titel telt ook als ondertitel en komt erbij.
 *   - Staat er geen auteur in de Catalogus, dan komt die van de stocklijst of de oude website erbij, als
 *     "Achternaam, Voornaam" (het laatste woord is de achternaam, tussenvoegsels achter de voornaam).
 *   - Een ondertitel zonder leesteken ervoor (zelfde woorden, met minstens twee woorden erachter) telt ook, bij
 *     titels van minstens twee woorden. Die komt erbij als "Titel: Ondertitel".
 *   - Een verjaardageditie staat altijd achteraan: "The Latecomer, 35th Anniversary Edition".
 *   - Een reeksaanduiding ("XXX (Ype, #6)") met dezelfde woorden als nu ("Ype XXX") wordt overgenomen.
 *   - De vorm "Achternaam, Voornaam" wint altijd: een auteur zonder die vorm telt niet als verschil met een auteur
 *     die wel in die vorm staat.
 *   - De lijst staat in het tabblad Titelcontrole. In het bestuurs- en vrijwilligersscherm (Titels en auteurs
 *     nakijken) neem je de boeken een voor een door, kast per kast: een versie kiezen, zelf typen, "klopt" of
 *     "niet in de kast".
 *   - Opnieuw maken mag: wat al nagekeken is (status ingevuld), blijft staan en komt niet opnieuw op de lijst.
 *   - De bron_sleutel van het boek verandert niet. Zo vindt Catalogus opbouwen het boek in Stock nog terug.
 */

var TITELCONTROLE_TABBLAD = 'Titelcontrole';
var TITELCONTROLE_STATUSSEN = ['klopt', 'aangepast', 'niet in de kast'];

/** Sleutel om titels te vergelijken: enkel letters en cijfers, in kleine letters. */
function controleTitelSleutel(titel) {
  // "&" en "and" (en, et, und) zijn hetzelfde: "Ethics & Homosexuality" = "Ethics and Homosexuality".
  return normaliseerTekst(String(titel || '').replace(/&/g, ' ')).split(' ').filter(function (w) {
    return w && CONTROLE_EN_WOORDEN.indexOf(w) === -1;
  }).join(' ');
}
var CONTROLE_EN_WOORDEN = ['and', 'en', 'et', 'und'];

/** Sleutel om auteurs te vergelijken: de woorden in alfabetische volgorde ("Melchior, Willem" = "Willem Melchior"). */
function controleAuteurSleutel(auteur) {
  // Elk woord één keer: "J.R. Ackerley; J. R. Ackerley" is dezelfde naam als "Ackerley, J.R".
  var uniek = [];
  normaliseerTekst(String(auteur || '').replace(/\b(en|and|et|und)\b|&/gi, ' ')).split(' ').forEach(function (w) {
    if (w && uniek.indexOf(w) === -1) uniek.push(w);
  });
  return uniek.sort().join(' ');
}

// Tussen twee auteurs: ; of & of "en" (and, et, und). Een komma hoort bij "Achternaam, Voornaam".
var CONTROLE_AUTEUR_SCHEIDING = /(\s*;\s*|\s*&\s*|\s+(?:en|and|et|und)\s+)/i;

/** De namen in een veld, elk als sleutel (zie controleAuteurSleutel), zonder dubbels. */
function controleNamen(auteur) {
  var uit = [];
  String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
    if (i % 2) return; // de scheidingstekens
    var k = controleAuteurSleutel(deel);
    if (k && uit.indexOf(k) === -1) uit.push(k);
  });
  return uit;
}

/** Dezelfde naam twee keer in één veld ("J.R. Ackerley; J. R. Ackerley") wordt één keer. De scheidingstekens blijven. */
function controleAuteurZonderDubbels(auteur) {
  var stukken = String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING);
  var gezien = [], uit = '';
  for (var i = 0; i < stukken.length; i += 2) {
    var k = controleAuteurSleutel(stukken[i]);
    if (!k || gezien.indexOf(k) > -1) continue;
    gezien.push(k);
    uit += (uit ? (i ? stukken[i - 1] : '; ') : '') + schoon(stukken[i]);
  }
  return schoon(uit);
}

/** Staat elke naam in de vorm "Achternaam, Voornaam"? (Een naam uit één woord telt als goed.) */
function controleAuteurGoedeVorm(auteur) {
  var delen = String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).filter(function (d, i) { return !(i % 2) && schoon(d); });
  return delen.length > 0 && delen.every(function (d) { return /,/.test(d) || schoon(d).split(' ').length === 1; });
}

/** Staan alle namen van a ook in b? */
function controleNamenIn(a, b) {
  var na = controleNamen(a), nb = controleNamen(b);
  return na.length > 0 && na.every(function (k) { return nb.some(function (m) { return controleZelfdeNaam(k, m); }); });
}

/**
 * Twee namen (sleutels) zijn dezelfde als de woorden van de ene allemaal in de andere staan: "Aurora" en
 * "Aurora Staff", "Ackerley" en "Ackerley J R". Een ander woord ("Willem" tegenover "William") is een verschil.
 */
function controleZelfdeNaam(k, m) {
  if (k === m) return true;
  var x = k.split(' '), y = m.split(' ');
  var deel = function (p, q) { return p.every(function (w) { return q.indexOf(w) > -1; }); };
  return deel(x, y) || deel(y, x);
}

/**
 * De auteur in de juiste vorm, als de bronnen dezelfde namen geven maar anders geschreven: "Achternaam, Voornaam",
 * elke naam één keer. Geeft een andere bron alle namen van nu (en eventueel meer: een tweede auteur die nu ontbreekt)
 * in de juiste vorm, dan nemen we die. Anders enkel de dubbels eruit (de achternaam raden we niet: van, de, ...
 * maken dat onzeker). Geeft '' als er niets te verbeteren valt.
 */
function controleAuteurVerbeterd(nu, anderen) {
  var schoonNu = controleAuteurZonderDubbels(nu);
  if (!schoonNu) return '';
  var beste = '';
  (anderen || []).forEach(function (a) {
    var v = controleAuteurZonderDubbels(a);
    if (!v || !controleAuteurGoedeVorm(v) || !controleNamenIn(schoonNu, v)) return;
    // De vollediger versie wint (meer namen). Bij gelijk aantal: de eerste (de stocklijst).
    if (!beste || controleNamen(v).length > controleNamen(beste).length) beste = v;
  });
  // Nu is al goed en volledig: niets te doen.
  if (controleAuteurGoedeVorm(schoonNu) && (!beste || controleNamen(beste).length === controleNamen(schoonNu).length)) beste = schoonNu;
  if (!beste) beste = schoonNu;
  return beste !== schoon(nu) ? beste : '';
}

var CONTROLE_TUSSENVOEGSELS = ['van', 'de', 'der', 'den', 'het', 'ten', 'ter', 'te', 'von', 'zu', 'la', 'le', 'du', 'da', 'di', 'del', 'des', 'dos', 'el', 'al', 'bin', 'ibn', 'mc'];

/**
 * Een naam zonder komma in de vorm "Achternaam, Voornaam": het laatste woord is de achternaam, tussenvoegsels
 * komen achter de voornaam ("Gea van Beuningen" wordt "Beuningen, Gea van", zoals in de stocklijst).
 * Een naam met een komma of uit één woord blijft zoals hij is. Per naam in het veld.
 */
function controleAuteurOmgedraaid(auteur) {
  return schoon(String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).map(function (deel, i) {
    if (i % 2) return deel;
    var naam = schoon(deel);
    var woorden = naam.split(' ');
    if (!naam || naam.indexOf(',') > -1 || woorden.length < 2) return naam;
    var achternaam = woorden.pop();
    var tussen = [];
    while (woorden.length > 1 && CONTROLE_TUSSENVOEGSELS.indexOf(woorden[woorden.length - 1].toLowerCase()) > -1) tussen.unshift(woorden.pop());
    return achternaam + ', ' + woorden.concat(tussen).join(' ');
  }).join(''));
}

/** Is de auteur nu leeg? Dan die van de stocklijst, anders van de oude website, in de vorm "Achternaam, Voornaam". */
function controleAuteurAangevuld(nu, anderen) {
  if (schoon(nu)) return '';
  var bron = (anderen || []).filter(function (a) { return schoon(a); })[0];
  return bron ? controleAuteurOmgedraaid(controleAuteurZonderDubbels(bron)) : '';
}

// Een verjaardageditie: "35th Anniversary Edition", "10th anniversary edition", "Anniversary Edition".
var CONTROLE_EDITIE = '(?:\\d+(?:st|nd|rd|th)\\s+)?anniversary\\s+edition';

/**
 * Een verjaardageditie komt altijd achter de titel, na een komma: "35th Anniversary Edition of The Latecomer" en
 * "The Latecomer: 35th Anniversary Edition" worden "The Latecomer, 35th Anniversary Edition".
 */
function controleEditieNetjes(titel) {
  var t = schoon(titel);
  var m = t.match(new RegExp('^(' + CONTROLE_EDITIE + ')\\s+of\\s+(.+)$', 'i'));
  if (m) return schoon(m[2]) + ', ' + schoon(m[1]);
  m = t.match(new RegExp('^(.+?)\\s*(?:[:(]|\\s[-–—]|,)\\s*(' + CONTROLE_EDITIE + ')\\)?$', 'i'));
  if (m) return schoon(m[1]) + ', ' + schoon(m[2]);
  return t;
}

/** Zijn twee titels gelijk? Ook als de ene een ondertitel heeft (na ":" of " - ") en de andere niet. */
function controleTitelGelijk(a, b) {
  a = controleEditieNetjes(a); b = controleEditieNetjes(b);
  var x = controleTitelSleutel(a), y = controleTitelSleutel(b);
  if (!x || !y || x === y) return true;
  if (controleTitelSleutel(controleTitelKort(a)) === y || controleTitelSleutel(controleTitelKort(b)) === x) return true;
  if (controleOndertitelZonderTeken(a, b) || controleOndertitelZonderTeken(b, a)) return true;
  // Dezelfde titel met de reeks ervoor of tussen haakjes erachter: "Ype XXX" en "XXX (Ype, #6)".
  var ra = controleReeksWoorden(a), rb = controleReeksWoorden(b);
  return (!!ra && ra === controleWoordenSet(b)) || (!!rb && rb === controleWoordenSet(a));
}

// Een reeksaanduiding achter de titel: "XXX (Ype, #6)", "Zee (Verhalen #2)".
var CONTROLE_REEKS = /^(.*?)\s*\(([^()]*?)[,;]?\s*#\s*(\d+(?:[.,]\d+)?)\)\s*$/;

/** De woorden van een tekst, elk één keer, alfabetisch. */
function controleWoordenSet(tekst) {
  var uniek = [];
  normaliseerTekst(tekst).split(' ').forEach(function (w) { if (w && uniek.indexOf(w) === -1) uniek.push(w); });
  return uniek.sort().join(' ');
}

/** De woorden van titel en reeks samen (zonder het volumenummer), als de titel een reeksaanduiding heeft. Anders ''. */
function controleReeksWoorden(titel) {
  var m = schoon(titel).match(CONTROLE_REEKS);
  return m ? controleWoordenSet(m[1] + ' ' + m[2]) : '';
}

/**
 * Heeft de andere titel dezelfde woorden met een reeksaanduiding ("XXX (Ype, #6)") en nu niet ("Ype XXX")?
 * Dan de titel met de reeksaanduiding. Geeft '' als dat niet zo is.
 */
function controleTitelReeks(nu, ander) {
  nu = schoon(nu); ander = schoon(ander);
  if (!nu || !ander || CONTROLE_REEKS.test(nu)) return '';
  var r = controleReeksWoorden(ander);
  return r && r === controleWoordenSet(nu) ? ander : '';
}

// Tussen titel en ondertitel: een dubbelpunt, een streepje met spaties, een punt of komma gevolgd door meer tekst,
// of iets tussen haakjes ("(Sinister Wisdom 102)").
var CONTROLE_ONDERTITEL = /\s*:\s*|\s+[-–—]\s+|\.\s+(?=\S)|\s*,\s+(?=\S)|\s+(?=\()/;

/** De titel zonder ondertitel. */
function controleTitelKort(titel) {
  return schoon(String(titel || '').split(CONTROLE_ONDERTITEL)[0]);
}

/**
 * Is de hoofdtitel dezelfde, of bijna? Een tikfout van hoogstens twee letters ("Amarican Homo" en "American Homo"),
 * een spatie meer of minder ("Goden zonen" en "Godenzonen"), & of and, of een lidwoord vooraan dat ontbreekt.
 * Dan mag de ondertitel erbij. Een tikfout of spatie zelf blijft een verschil op de lijst.
 */
function controleTitelBijna(a, b) {
  var x = controleTitelSleutel(a), y = controleTitelSleutel(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // Een lidwoord vooraan dat bij de ene bron ontbreekt: "Well of Loneliness" en "The Well of Loneliness".
  var zonder = function (t) { return t.replace(/^(the|a|an|de|het|een|le|la|les|l|der|die|das|el|il)\s+/, ''); };
  if (zonder(x) === zonder(y)) return true;
  // Een spatie meer of minder ("Goden zonen" en "Godenzonen"), of een tikfout van hoogstens twee letters.
  var xs = zonder(x).replace(/ /g, ''), ys = zonder(y).replace(/ /g, '');
  if (xs === ys) return true;
  return Math.min(xs.length, ys.length) >= 6 && levenshtein(xs, ys) <= 2;
}

/**
 * De andere titel begint met dezelfde woorden als nu en heeft er meer woorden achter, zonder leesteken ertussen?
 * Geeft die extra woorden (de ondertitel), anders ''. Enkel bij een titel van minstens twee woorden en een
 * ondertitel van minstens twee. Het boek op de oude website is al gekoppeld aan dit boek (ISBN, of titel en
 * auteur): een langere titel is dan bijna altijd een ondertitel.
 */
function controleOndertitelZonderTeken(nu, ander) {
  var woordenNu = controleTitelSleutel(nu).split(' ').filter(Boolean);
  var woorden = schoon(ander).split(' ');
  if (woordenNu.length < 2) return '';
  for (var k = 1; k < woorden.length; k++) {
    if (controleTitelSleutel(woorden.slice(0, k).join(' ')) === woordenNu.join(' ')) {
      var rest = woorden.slice(k);
      return rest.length >= 2 ? rest.join(' ') : '';
    }
  }
  return '';
}

/**
 * Heeft de andere titel dezelfde titel plus een ondertitel, en heeft nu nog geen ondertitel? Dan de titel van nu
 * met die ondertitel erbij: "Titel: Ondertitel". namen en taal: voor de schrijfwijze van de ondertitel (Titels.js).
 * Geeft '' als er niets aan te vullen valt.
 */
function controleTitelAangevuld(nu, ander, taal, namen) {
  nu = schoon(nu); ander = schoon(ander);
  if (!nu || !ander || CONTROLE_ONDERTITEL.test(nu)) return '';
  // De eerste plaats in de andere titel waar wat ervoor staat, gelijk is aan de titel van nu.
  var zoek = new RegExp(CONTROLE_ONDERTITEL.source, 'g'), m, gevonden = null;
  while ((m = zoek.exec(ander))) {
    if (!m[0].length) zoek.lastIndex++;
    if (controleTitelBijna(ander.slice(0, m.index), nu)) { gevonden = m; break; }
  }
  var teken, rest;
  if (gevonden) {
    teken = gevonden[0].trim();
    rest = schoon(ander.slice(gevonden.index + gevonden[0].length)).replace(/\s+:\s*/g, ': ');
  } else {
    // Een ondertitel zonder leesteken ervoor: "Wie had gedacht dat we met zovelen zijn lesbische vrouwen in de kerk".
    teken = ':';
    rest = controleOndertitelZonderTeken(nu, ander);
  }
  if (!rest) return '';
  // Tussen haakjes: zoals het er staat.
  if (!teken && rest.charAt(0) === '(') return nu + ' ' + rest;
  // Een verjaardageditie: zoals ze er staat, na een komma.
  if (new RegExp('^' + CONTROLE_EDITIE + '$', 'i').test(rest)) return nu + ', ' + rest;
  var onder = titelSchrijfwijze(rest, taal, namen || {});
  // Na een komma loopt de titel gewoon door ("Homofilie, status of stigma").
  if (teken === ',') return nu + ', ' + (titelGroot(rest) && namen && namen[rest.split(' ')[0].toLowerCase()] ? onder : onder.charAt(0).toLowerCase() + onder.slice(1));
  return nu + ': ' + onder.charAt(0).toUpperCase() + onder.slice(1);
}

/**
 * Voorletters voluit: "Bade, H." wordt "Bade, Hermanus" als een andere bron dezelfde achternaam geeft met een
 * voornaam die met dezelfde letter begint ("Hermanus Bade" of "Bade, Hermanus"). Per naam in het veld.
 * Geeft '' als er niets aan te vullen valt.
 */
function controleAuteurVoluit(nu, anderen) {
  var stukken = String(nu || '').split(CONTROLE_AUTEUR_SCHEIDING);
  var veranderd = false;
  for (var i = 0; i < stukken.length; i += 2) {
    var deel = schoon(stukken[i]);
    if (deel.indexOf(',') === -1) continue;
    var achternaam = schoon(deel.split(',')[0]);
    var letters = deel.split(',').slice(1).join(' ').split(/[\s.]+/).filter(Boolean);
    // Enkel voorletters: elk stukje hoogstens twee tekens ("H.", "J.R", "Th.").
    if (!letters.length || letters.some(function (l) { return l.length > 2; })) continue;
    var achterWoorden = normaliseerTekst(achternaam).split(' ');
    var voluit = '';
    (anderen || []).some(function (ander) {
      return String(ander || '').split(CONTROLE_AUTEUR_SCHEIDING).some(function (naam, j) {
        if (j % 2 || !schoon(naam)) return false;
        var voornamen;
        if (naam.indexOf(',') > -1) {
          if (normaliseerTekst(naam.split(',')[0]) !== achterWoorden.join(' ')) return false;
          voornamen = schoon(naam.split(',').slice(1).join(' ')).split(' ');
        } else {
          var woorden = schoon(naam).split(' ');
          var klein = woorden.map(normaliseerTekst);
          var p = -1;
          for (var q = 0; q + achterWoorden.length <= klein.length; q++) {
            if (achterWoorden.every(function (w, k) { return klein[q + k] === w; })) { p = q; break; }
          }
          if (p < 0) return false;
          voornamen = woorden.slice(0, p).concat(woorden.slice(p + achterWoorden.length));
        }
        voornamen = voornamen.filter(Boolean);
        // Echte voornamen (niet weer voorletters), even veel of meer dan de voorletters, met dezelfde beginletters.
        if (!voornamen.length || voornamen.every(function (v) { return v.replace(/\./g, '').length <= 2; })) return false;
        if (voornamen.length < letters.length) return false;
        var past = letters.every(function (l, k) { return normaliseerTekst(voornamen[k]).charAt(0) === normaliseerTekst(l).charAt(0); });
        if (past) voluit = achternaam + ', ' + voornamen.join(' ');
        return past;
      });
    });
    if (voluit && voluit !== deel) { stukken[i] = voluit; veranderd = true; }
  }
  return veranderd ? schoon(stukken.join('')) : '';
}

/**
 * Zijn twee auteurs gelijk? Een lege auteur telt niet als verschil. Staan bij de ene bron minder namen, maar zijn
 * die allemaal ook bij de andere, dan is dat geen verschil ("Gea van Beuningen" en "Beuningen, Gea van & Bossche, Tinne").
 */
function controleAuteurGelijk(a, b) {
  var x = controleAuteurSleutel(a), y = controleAuteurSleutel(b);
  if (!x || !y || x === y || controleNamenIn(a, b) || controleNamenIn(b, a)) return true;
  // Voorletters tegenover de voluit geschreven voornaam ("Bade, H." en "Bade, Hermanus"): geen verschil.
  var voluitA = controleAuteurVoluit(a, [b]), voluitB = controleAuteurVoluit(b, [a]);
  if ((voluitA && controleAuteurGelijk(voluitA, b)) || (voluitB && controleAuteurGelijk(a, voluitB))) return true;
  // De vorm "Achternaam, Voornaam" wint altijd: een bron die niet in die vorm staat ("Aaron William"),
  // telt niet als verschil met een bron die wel in die vorm staat ("Aaron, Willem").
  return controleAuteurGoedeVorm(a) !== controleAuteurGoedeVorm(b);
}

/**
 * Maakt de lijst. catalogus: rijen van de Catalogus. stock: boeken uit leesBronRijen (Stock en Zines).
 * oudeBoeken: boeken van de oude website (oudBoekUitRij). bestaand: rijen van het tabblad Titelcontrole.
 * verbeterd: een lijst. Is ze er, dan zet het script een auteur die enkel anders geschreven is meteen in de juiste
 * vorm (zie controleAuteurVerbeterd) en komt de boek_id in de lijst.
 * Geeft de nieuwe open rijen: { boek_id, titel_nu, auteur_nu, titel_stock, auteur_stock, titel_oud, auteur_oud, status: '' }.
 */
function titelcontroleRijen(catalogus, stock, oudeBoeken, bestaand, verbeterd, auteursnamen) {
  // Een vroegere naam in de stocklijst of op de oude website: eerst de gekozen naam (tabblad Auteursnamen).
  // Zo zet het script nooit een vroegere naam terug, en is die naam geen verschil.
  var regels = auteursnamenRegels(auteursnamen || []);
  var gekozen = function (auteur) { return auteur ? auteursnamenVervang(auteur, regels).tekst : auteur; };
  var perSleutel = {};
  stock.forEach(function (b) { var s = bronSleutel(b); if (!perSleutel[s]) perSleutel[s] = b; });
  var oudPerId = {};
  if (oudeBoeken.length) oudeParen(catalogus, oudeBoeken).paren.forEach(function (p) { oudPerId[String(p[1].boek.boek_id)] = p[0]; });
  var klaar = {};
  (bestaand || []).forEach(function (r) { if (TITELCONTROLE_STATUSSEN.indexOf(schoon(r.status)) > -1) klaar[String(r.boek_id)] = true; });
  var uit = [];
  var namen = verbeterd ? titelNamen(catalogus) : {};
  catalogus.forEach(function (b) {
    var id = String(b.boek_id || '');
    if (!id || isLeeg(b.titel) || isFilm(b) || klaar[id]) return;
    var st = perSleutel[b.bron_sleutel];
    var oud = oudPerId[id];
    if (st) st = Object.assign({}, st, { auteur: gekozen(st.auteur) });
    if (oud) oud = Object.assign({}, oud, { auteur: gekozen(oud.auteur) });
    var oudeTitel = oud ? controleEditieNetjes(schoon(oud.titel) + (oud.ondertitel ? ': ' + schoon(oud.ondertitel) : '')) : '';
    var stockTitel = st ? controleEditieNetjes(st.titel) : '';
    // Een verjaardageditie altijd achteraan: "The Latecomer, 35th Anniversary Edition".
    var nuTitel = controleEditieNetjes(b.titel);
    // Dezelfde auteur, enkel anders geschreven: meteen in de juiste vorm in de Catalogus, niet op de lijst.
    var beter = controleAuteurVerbeterd(b.auteur, [st && st.auteur, oud && oud.auteur]);
    // Voorletters voluit als een andere bron de voornaam geeft.
    beter = controleAuteurVoluit(beter || b.auteur, [st && st.auteur, oud && oud.auteur]) || beter;
    // Geen auteur in de Catalogus: die van een andere bron.
    beter = beter || controleAuteurAangevuld(b.auteur, [st && st.auteur, oud && oud.auteur]);
    // Dezelfde titel, met een ondertitel op de oude website: de ondertitel erbij in de Catalogus.
    // Uit de oude website, anders uit de stocklijst: een titel met ondertitel wint altijd.
    var aangevuld = controleTitelReeks(nuTitel, oudeTitel) || controleTitelReeks(nuTitel, stockTitel) ||
      controleTitelAangevuld(nuTitel, oudeTitel, b.taal, namen) || controleTitelAangevuld(nuTitel, stockTitel, b.taal, namen) ||
      (nuTitel !== schoon(b.titel) ? nuTitel : '');
    if (verbeterd && (beter || aangevuld)) {
      var velden = {};
      if (beter) velden.auteur = beter;
      if (aangevuld) velden.titel = aangevuld;
      wijzig(b, velden);
      verbeterd.push(id);
    }
    var nu = { titel: schoon(b.titel), auteur: schoon(b.auteur) };
    var bronnen = [nu];
    if (st) bronnen.push({ titel: stockTitel, auteur: schoon(st.auteur) });
    if (oud) bronnen.push({ titel: oudeTitel, auteur: schoon(oud.auteur) });
    var anders = false;
    for (var i = 0; i < bronnen.length && !anders; i++) {
      for (var j = i + 1; j < bronnen.length && !anders; j++) {
        if (!controleTitelGelijk(bronnen[i].titel, bronnen[j].titel) || !controleAuteurGelijk(bronnen[i].auteur, bronnen[j].auteur)) anders = true;
      }
    }
    if (!anders) return;
    uit.push({
      boek_id: id, titel_nu: nu.titel, auteur_nu: nu.auteur,
      titel_stock: st ? schoon(st.titel) : '', auteur_stock: st ? schoon(st.auteur) : '',
      titel_oud: oud ? bronnen[bronnen.length - 1].titel : '', auteur_oud: oud ? schoon(oud.auteur) : '',
      status: ''
    });
  });
  return uit;
}

/** De open rijen voor het scherm, met de huidige titel en auteur uit de Catalogus. Plus de boeken die niet in de kast stonden. */
function titelcontroleLijst(catalogus, rijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var open = [], nietGevonden = [], gedaan = 0;
  rijen.forEach(function (r) {
    var b = perId[String(r.boek_id)];
    if (!b) return;
    var status = schoon(r.status);
    var nu = { t: schoon(b.titel), a: schoon(b.auteur) };
    // ta en aa: is de titel of de auteur van deze bron echt anders dan nu (volgens dezelfde regels als de lijst)?
    var bron = function (t, a) {
      t = schoon(t); a = schoon(a);
      return t || a ? { t: t, a: a, ta: !!t && !controleTitelGelijk(t, nu.t), aa: !!a && !controleAuteurGelijk(a, nu.a) } : null;
    };
    var item = { id: String(r.boek_id), isbn: schoon(b.isbn), nu: nu, stock: bron(r.titel_stock, r.auteur_stock), oud: bron(r.titel_oud, r.auteur_oud) };
    if (!status) open.push(item);
    else if (status === 'niet in de kast') { item.wie = schoon(r.wie); item.datum = parseerDatum(r.datum) || schoon(r.datum); nietGevonden.push(item); }
    else gedaan++;
  });
  return { open: open, nietGevonden: nietGevonden, gedaan: gedaan };
}

/** Hoeveel boeken nog na te kijken zijn: voor het getal op de knop in het scherm. */
function titelcontroleAantal(rijen) {
  return (rijen || []).filter(function (r) { return !isLeeg(r.boek_id) && !schoon(r.status); }).length;
}

/**
 * Bewaart wat iemand bij een boek koos. invoer: { boek_id, status: klopt | aangepast | niet in de kast | open, titel, auteur }.
 * Bij aangepast: titel en auteur in de Catalogus (de bron_sleutel blijft). Geeft { ok, tekst, catalogusGewijzigd } of { ok: false, fout }.
 */
function titelcontroleToepassen(catalogus, rijen, invoer, wie, vandaag) {
  var id = String(invoer.boek_id || '');
  var rij = rijen.filter(function (r) { return String(r.boek_id) === id; })[0];
  var boek = catalogus.filter(function (b) { return String(b.boek_id) === id; })[0];
  if (!rij || !boek) return { ok: false, fout: 'Dit boek staat niet (meer) op de lijst. Laad de lijst opnieuw.' };
  var status = schoon(invoer.status);
  if (status === 'open') { wijzig(rij, { status: '', wie: '', datum: '' }); return { ok: true, tekst: '"' + schoon(boek.titel) + '" staat terug op de lijst.' }; }
  if (TITELCONTROLE_STATUSSEN.indexOf(status) === -1) return { ok: false, fout: 'Onbekende keuze.' };
  var veranderd = false;
  if (status === 'aangepast') {
    var titel = tekstInvoer(invoer.titel, 300);
    var auteur = tekstInvoer(invoer.auteur, 300);
    if (!titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
    var velden = {};
    if (titel !== schoon(boek.titel)) velden.titel = titel;
    if (auteur !== schoon(boek.auteur)) velden.auteur = auteur;
    if (Object.keys(velden).length) { wijzig(boek, velden); veranderd = true; } else status = 'klopt';
  }
  wijzig(rij, { status: status, wie: wie, datum: vandaag, titel_nu: schoon(boek.titel), auteur_nu: schoon(boek.auteur) });
  var tekst = status === 'niet in de kast' ? '"' + schoon(boek.titel) + '" staat op de lijst voor het bestuur: niet gevonden in de kast.'
    : veranderd ? '"' + schoon(boek.titel) + '" is aangepast.' : '"' + schoon(boek.titel) + '" klopt.';
  return { ok: true, tekst: tekst, catalogusGewijzigd: veranderd };
}

/* ---------- In Apps Script ---------- */

/** Het tabblad Titelcontrole, met de juiste kop (maakt het aan als het nog niet bestaat). */
function titelcontroleTabel() {
  var ss = spreadsheet();
  if (!ss.getSheetByName(TITELCONTROLE_TABBLAD)) {
    var blad = maakTabblad(TITELCONTROLE_TABBLAD);
    var kop = KOLOMMEN[TITELCONTROLE_TABBLAD];
    blad.getRange(1, 1, 1, kop.length).setValues([kop]);
    opmaakKop(blad, kop.length);
    blad.setFrozenRows(1);
  }
  return leesTabel(TITELCONTROLE_TABBLAD);
}

/**
 * Maakt de lijst (opnieuw). De open rijen gaan weg en komen opnieuw, wat nagekeken is blijft.
 * Geeft { ok, tekst }. Gebruikt door het menu en de knop in het bestuursscherm.
 */
function maakTitelcontroleLijst() {
  // Eerst de oude website lezen, zonder slot: dat duurt even.
  var oudeBoeken = [];
  try {
    var db = vindOudeDatabank();
    var oud = haalOudeBoeken(db);
    oudeBoeken = oud.rijen.map(function (r) { return oudBoekUitRij(r, db.url); }).filter(function (b) { return b.titel; });
  } catch (e) { oudeBoeken = []; }
  var ss = spreadsheet();
  var stock = [];
  [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
    var blad = ss.getSheetByName(paar[0]);
    if (blad) stock = stock.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var nieuw, verbeterd;
  try {
    var catalogus = leesTabel('Catalogus');
    var tabel = titelcontroleTabel();
    verbeterd = [];
    var namenBlad = ss.getSheetByName(AUTEURSNAMEN_TABBLAD);
    var auteursnamen = namenBlad && namenBlad.getLastRow() > 1 ? leesTabel(AUTEURSNAMEN_TABBLAD).rijen : [];
    nieuw = titelcontroleRijen(catalogus.rijen, stock, oudeBoeken, tabel.rijen, verbeterd, auteursnamen);
    if (verbeterd.length) schrijfKolommen(catalogus, ['titel', 'auteur']);
    // Wat nagekeken is, blijft. De open rijen maken plaats voor de nieuwe. Alles in één keer schrijven.
    var blijft = tabel.rijen.filter(function (r) { return schoon(r.status); });
    var waarden = blijft.concat(nieuw).map(function (r) { return rijNaarWaarden(tabel.kop, r); });
    var blad = tabel.blad;
    if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, tabel.kop.length).clearContent();
    if (waarden.length) blad.getRange(2, 1, waarden.length, tabel.kop.length).setValues(waarden);
  } finally {
    lock.releaseLock();
  }
  if (verbeterd.length) leegCache();
  var tekst = nieuw.length + ' boeken om na te kijken: de titel of auteur verschilt tussen de stocklijst, de oude website en de Catalogus. ' +
    verbeterd.length + ' boeken meteen verbeterd in de Catalogus: de auteur als "Achternaam, Voornaam" zonder dubbele naam, of de ondertitel van de oude website erbij.' +
    (oudeBoeken.length ? '' : ' Let op: de oude website kon ik niet lezen, enkel de stocklijst telde.') +
    (stock.length ? '' : ' Let op: de tabbladen Stock en Zines ontbreken.');
  logboek('menu', 'maakTitelcontroleLijst', tekst + (verbeterd.length ? ' Verbeterde boeken: ' + verbeterd.join(', ') : ''));
  return { ok: true, tekst: tekst };
}

/** Menu: de lijst maken. */
function maakTitelcontroleMenu() {
  meld(maakTitelcontroleLijst().tekst + ' Je vindt ze in het bestuurs- en vrijwilligersscherm bij Titels en auteurs nakijken.');
}

/** Acties van het scherm. titelcontroleData en titelcontroleBewaren: vrijwilligers en bestuur. titelcontroleMaken: bestuur. */
function titelcontroleActie(actie, invoer, wie) {
  var catalogus = leesTabel('Catalogus');
  var tabel = spreadsheet().getSheetByName(TITELCONTROLE_TABBLAD) ? leesTabel(TITELCONTROLE_TABBLAD) : null;
  if (!tabel) return { ok: true, lijst: { open: [], nietGevonden: [], gedaan: 0, leeg: true } };
  if (actie === 'titelcontroleBewaren') {
    var r = titelcontroleToepassen(catalogus.rijen, tabel.rijen, invoer, wie, vandaagTekst());
    if (!r.ok) return r;
    // Cel per cel: enkel dit boek veranderde. Dat is veel sneller dan de hele kolom (zie schrijfCellen).
    if (r.catalogusGewijzigd) {
      schrijfCellen(catalogus, ['titel', 'auteur']);
      logboek(wie, 'titelcontrole', String(invoer.boek_id) + ': titel of auteur aangepast');
      leegCache();
    }
    schrijfCellen(tabel, ['status', 'wie', 'datum', 'titel_nu', 'auteur_nu']);
    return { ok: true, tekst: r.tekst };
  }
  return { ok: true, lijst: titelcontroleLijst(catalogus.rijen, tabel.rijen) };
}
