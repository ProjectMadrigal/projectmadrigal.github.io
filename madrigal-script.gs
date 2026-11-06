/**
 * madrigal-script.gs
 * Alle code van de catalogus van Project Madrigal in één bestand.
 * Plak dit volledige bestand in Apps Script (Extensies > Apps Script).
 * De functies staan alfabetisch, zodat je ze makkelijk vindt naast "Uitvoeren".
 *
 * PAS DIT BESTAND NIET MET DE HAND AAN. Het wordt gemaakt uit de map
 * apps-script/ met: node tools/bundel.js
 * De uitleg per onderdeel staat bovenaan de bestanden in apps-script/.
 */

/* ==================== Vaste waarden ==================== */

var AANKOOP_STATUS_OPEN = 'open';

var AANKOOP_STATUS_BINNEN = 'in catalogus';

var AANKOOP_MAX_BOL = 80;          // zoveel boeken leest het script hoogstens van één bol.com-lijst

/* ---------- Herkennen ---------- */

var BLADWIJZER_KOP = 'MADRIGAL1'; // zo begint wat de bladwijzer kopieert (zie aankoop.js)

var AANVRAAG_MAX_PER_UUR = 30;

var AANVRAAG_MAX_PER_CONTACT = 3;

var AANVRAAG_NIEUW = 'nieuw';

var AANVRAAG_STATUSSEN = ['nieuw', 'afgehandeld', 'geweigerd'];

var CACHE_SLEUTEL = 'publiek_v1';

var CACHE_DUUR_SECONDEN = 6 * 60 * 60; // het maximum van Google: 6 uur

var CACHE_STUK = 90000;                 // een cachewaarde mag hoogstens 100 kB zijn

/** De rollen, van weinig naar veel rechten. */
var ROL_RANG = { publiek: 0, balie: 1, vrijwilliger: 2, bestuur: 3 };

/** Welke rol nodig is voor elke actie. */
var ACTIES = {
  aanmelden: 'balie',
  balieData: 'balie',
  uitlenen: 'balie',
  terugbrengen: 'balie',
  verlengen: 'balie',
  // Een uitlening aanpassen of annuleren (Uitlenen.js). Annuleren kan ook in het vrijwilligersscherm.
  vervaldatumAanpassen: 'bestuur',
  boekVerloren: 'bestuur',
  boekVervangen: 'bestuur',
  annuleerUitlening: 'vrijwilliger',
  annuleerVerlenging: 'vrijwilliger',
  reserveren: 'balie',
  annuleerReservatie: 'balie',
  nieuweLener: 'balie',
  roosterOverzicht: 'balie',
  bestuurData: 'bestuur',
  // Vrijwilligersscherm (vrijwilliger.html): zonder contactgegevens van leners.
  vrijwilligerData: 'vrijwilliger',
  borgTerugbetaald: 'bestuur',
  herinneringVerstuurd: 'bestuur',
  lenerAanpassen: 'bestuur',
  aanvraagAfhandelen: 'bestuur',
  // Van vrijwilligers naar het bestuur (Vrijwilligers.js).
  voorstelBeschrijving: 'vrijwilliger',
  voorstelBehandelen: 'bestuur',
  meldingMaken: 'vrijwilliger',
  meldingAfhandelen: 'bestuur',
  briefjeMaken: 'vrijwilliger',
  verkoopData: 'vrijwilliger',
  standjeBewaren: 'vrijwilliger',
  standjeBoekZetten: 'vrijwilliger',
  verkopenDoorsturen: 'vrijwilliger',
  standjeStatus: 'vrijwilliger',
  // Boeken aan de voorraad toevoegen vanuit het verkoopscherm: enkel het bestuur.
  voorraadCatalogus: 'bestuur',
  voorraadZetten: 'bestuur',
  voorraadNieuwBoek: 'bestuur',
  // De aankooplijst (Aankoop.js): vrijwilligers voegen toe, het bestuur past aan, duidt aan en verwijdert.
  aankoopData: 'vrijwilliger',
  aankoopToevoegen: 'vrijwilliger',
  aankoopLezen: 'bestuur',
  aankoopImporteren: 'bestuur',
  aankoopAanpassen: 'bestuur',
  aankoopVerwijderen: 'bestuur',
  aankoopUitvinken: 'bestuur',
  briefjeWeg: 'vrijwilliger',
  // Titels en auteurs nakijken in de bib (Titelcontrole.js): iedereen past aan, het bestuur maakt de lijst.
  titelcontroleData: 'vrijwilliger',
  titelcontroleBewaren: 'vrijwilliger',
  titelcontroleMaken: 'bestuur',
  // Zonder code, vanaf de publieke website (Aanvragen.js). Staat uit tot online_reserveren = ja.
  reservatieAanvraag: 'publiek',
  // Beheer van de website (Beheer.js). Wat op 'vrijwilliger' staat, kan ook vanuit het vrijwilligersscherm.
  // Nieuws en agenda van vrijwilligers blijven verborgen tot het bestuur ze goedkeurt (zie inhoudAanpassen).
  beheerBoekOphalen: 'bestuur',
  beheerBoekBewaren: 'bestuur',
  beheerLeeslijstBoeken: 'vrijwilliger',
  bezoekersCijfers: 'bestuur',
  beheerLogboek: 'bestuur',
  beheerCoverLinks: 'vrijwilliger',
  beheerLenerHistoriek: 'bestuur',
  beheerBoekenBulk: 'bestuur',
  bestuurCijfers: 'bestuur',
  // De verborgen filmpagina bekijken (Films.js), zolang films_tonen op nee staat.
  filmsVoorbeeld: 'bestuur',
  beheerBoekToevoegen: 'bestuur',
  beheerIsbnOpzoeken: 'bestuur',
  beheerInhoud: 'vrijwilliger',
  beheerInhoudBewaren: 'vrijwilliger',
  beheerInstellingBewaren: 'bestuur',
  beheerCoversLijst: 'vrijwilliger',
  beheerCoversBewaren: 'vrijwilliger',
  beheerCoverUpload: 'vrijwilliger',
  beheerCoverVanLink: 'vrijwilliger',
  beheerTekstUitFoto: 'vrijwilliger',
  beheerIaCovers: 'bestuur',
  beheerIaCoversWissen: 'bestuur'
};

/* ---------- Staat lezen en bewaren ---------- */

/* Te veel foute codes: na FOUT_MAX foute codes binnen FOUT_VENSTER_S seconden weigert de web-app een tijd
   elke aanmelding, ook de juiste (anders kan wie raadt toch nog verder). Apps Script kent het adres van de
   bezoeker niet: de teller geldt voor iedereen samen. */
var FOUT_MAX = 30;

var FOUT_VENSTER_S = 15 * 60;

var FOUT_SLEUTEL = 'foute_codes';

var AUTEURS_TABBLAD = 'Auteurs aangepast';

var AUTEUR_NIET_ZEKER = 'niet zeker: zet zelf de komma (of laat een organisatie zo staan)';

// Woorden die zeker op een organisatie wijzen: die naam draaien we nooit om.
var AUTEUR_ORGANISATIE = /\b(stichting|vzw|vereniging|collectief|collective|redactie|redaction|uitgeverij|publishing|publishers|press|association|society|group|groep|team|staff|magazine|tijdschrift|foundation|fonds|institute|instituut|museum|centrum|centra|center|centre|network|netwerk|coalition|project|projet|house|editors|redacteurs|various|diverse|diversen|anoniem|anonymous|onbekend|unknown|verzameld|anthology|antologie|international|internationaal|front|verbond|rebellion|comics|jeugd|coc|vlaanderen|nederland|belgie|amsterdam|antwerpen|brussel|gent|lama|dalai|daila|seigneur|paus|pope)\b/i;

// Een getal ("Brandpunt 23") of een lidwoord vooraan ("De Bonte Was") wijst op een organisatie of een titel, niet op een persoon.
var AUTEUR_GEEN_PERSOON = /\d|^(de|het|een|the|a|an|la|le|les|el|los|las|il|lo)\s/i;

// Geen naam maar een aanvulling: blijft zoals ze is.
var AUTEUR_AANVULLING = /^(e\.?a\.?|etc\.?|et al\.?|en anderen|and others|\.\.\.|…)$/i;

var AUTEUR_ACHTERVOEGSEL = /^(jr\.?|sr\.?|ii|iii|iv)$/i;

// Initialen: "J.R.", "J.", "JR".
var AUTEUR_INITIALEN = /^([A-Z]\.){1,4}$|^[A-Z]{1,3}$/;

var AUTEURSNAMEN_TABBLAD = 'Auteursnamen';

var AUTEURSNAMEN_PSEUDONIEM = 'pseudoniem';

var AUTEURSNAMEN_GEKOZEN = 'gekozen naam';

// De voorbeelden van het bestuur: één keer in het tabblad gezet. Daarna beheer je ze in het tabblad zelf.
// Het zijn publiek bekende namen van auteurs, geen gegevens van leners of schenkers.
var AUTEURSNAMEN_STANDAARD = [
  { auteur: 'Califia, Patrick', andere_namen: 'Califia, Pat', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Tempest, Kae', andere_namen: 'Tempest, Kate', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Februari, Maxim', andere_namen: 'Februari, Marjolijn', soort: AUTEURSNAMEN_GEKOZEN },
  { auteur: 'Fraus, Pia', andere_namen: 'Schoeters, Gaea', soort: AUTEURSNAMEN_PSEUDONIEM }
];

var AUTEURSNAMEN_STANDAARD_VERSIE = 'v1';

var BACKUP_VOORVOEGSEL = 'Madrigal back-up ';

/** Velden van een boek die je via de website kan aanpassen. De rest (herkomst, ...) blijft enkel in de spreadsheet. */
var BEHEER_BOEKVELDEN = [
  'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat',
  'aanrader', 'genre', 'extra_onderwerpen', 'categorieen', 'trefwoorden', 'triggerwaarschuwingen', 'klassieker', 'aantal', 'uitleenbaar', 'publiek', 'status',
  'startpagina', 'leeslijsten', 'beschrijving', 'beschrijving_en', 'cover_url', 'notitie',
  'land', 'duur', 'film_tip', 'te_koop', 'originele_titel'
];

/** Velden met ja/nee. Bij startpagina betekent leeg "automatisch". */
var BEHEER_JANEE = ['nieuwstaat', 'klassieker', 'uitleenbaar', 'publiek', 'startpagina', 'film_tip', 'te_koop'];

/** Tabbladen met inhoud van de website, en de kolommen die je via de website kan aanpassen. */
var BEHEER_INHOUD = {
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'online_vanaf'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek'],
  'Leeslijsten': ['volgorde', 'naam', 'naam_en', 'uitleg', 'uitleg_en', 'publiek', 'zichtbaar_vanaf', 'zichtbaar_tot']
};

/** Instellingen die nooit via de website zichtbaar of aanpasbaar zijn. Pas die aan in de spreadsheet. */
var BEHEER_GEHEIM = ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur', 'rooster_code', 'google_books_api_key', 'bol_client_id', 'bol_client_secret', 'goatcounter_api_sleutel'];

/** Lange teksten: meer tekens toegelaten en regeleinden blijven staan. */
var BEHEER_LANG = ['beschrijving', 'beschrijving_en', 'tekst', 'tekst_en', 'antwoord', 'antwoord_en', 'uitleg', 'uitleg_en'];

/** Tabbladen die een vrijwilliger mag aanpassen. Nieuws en Agenda enkel als voorstel. */
var VRIJWILLIGER_INHOUD = ['Nieuws', 'Agenda', 'Leeslijsten'];

var VOORSTEL_TABBLADEN = ['Nieuws', 'Agenda'];

var FOTO_MAX_BYTES = 1500000;

var FOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

var LINK_MAX_BYTES = 4000000;

var OCR_MAX_BYTES = 4000000;

var BS_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

// Een beschrijving blijft volledig tot deze lengte. Is ze langer, dan stopt ze na
// de laatste volledige zin, nooit midden in een zin.
var BS_MAX_LENGTE = 2500;

// Herkenbare naam met een link naar de website: Wikipedia en Open Library vragen dat van elk script,
// en remmen naamloze scripts sneller af.
var BS_USER_AGENT = 'ProjectMadrigal-catalogus/1.0 (https://projectmadrigal.github.io; queer bibliotheek Antwerpen; Google Apps Script)';

/** Al op titel en auteur gezocht (tweede ronde, zie beschrijvingOpTitel). */
var BS_OP_TITEL = 'TA ';

/** Open Library gaf niets terwijl Google weigerde: Google moet het nog opzoeken. */
var BS_ENKEL_OL = 'OL ';

var GC_PERIODES = { '7': 7, '30': 30, '365': 365 };

var GC_CACHE_SECONDEN = 30 * 60;

/** De schermgroottes van GoatCounter: die hebben geen naam, enkel een id. */
var GC_TOESTELLEN = {
  phone: 'Gsm', largephone: 'Grote gsm of kleine tablet', tablet: 'Tablet of kleine laptop',
  desktop: 'Computer', desktophd: 'Groot computerscherm', unknown: 'Onbekend'
};

var BOL_PAUZE_MS = 300;

var BOL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var BOL_API = 'https://api.bol.com/marketing/catalog/v1';

var BC_WEKEN_NL = ['', 'eerste', 'tweede', 'derde', 'vierde', 'laatste'];

var BC_WEKEN_EN = ['', 'first', 'second', 'third', 'fourth', 'last'];

var BC_DAGEN_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Kolomnamen in Stock en Zines, en hoe ze in de Catalogus heten. */
var BRONKOLOMMEN = {
  'titel': 'titel',
  'auteur s': 'auteur', 'auteurs': 'auteur', 'auteur': 'auteur',
  'isbn': 'isbn', 'isbn issn': 'isbn', 'issn': 'isbn', 'isbn of issn': 'isbn',
  'uitgeverij': 'uitgeverij',
  'jaartal': 'jaartal', 'jaar': 'jaartal',
  'taal': 'taal',
  'pagina s': 'paginas', 'paginas': 'paginas',
  'uitvoering': 'uitvoering',
  'nieuwstaat': 'nieuwstaat',
  'aanrader': 'aanrader',
  'genre': 'genre',
  'aantal': 'aantal'
};

/** De standaard filtergroepen op de website, in deze volgorde. */

// De thema's van de bib (zoals in de kasten). Een eigen thema erbij kan ook met de instelling eigen_themas.
var FILTERGROEPEN = ['Gender', 'Intersekse', 'Seksualiteit', 'Coming-out', 'Relaties', 'Polyamorie', 'Feminisme', 'Fictie', 'Klassiekers',
  'Geschiedenis', 'Kolonialisme', 'Fascisme', 'Maatschappij', 'Cultuur', 'Diversiteit', 'Ecologie', 'Gezondheid', 'Onderzoek', 'Politiek', 'Marxisme',
  'Cuba', 'Religie en Spiritualiteit', 'Biografie', 'Poëzie', 'Graphic novel', 'Young Adult', 'Pulp', 'Erotica en BDSM', 'Zines'];

/** Voorstellen voor de vertaaltabel: een genre met dit woord erin gaat naar deze groep. */
var ONDERWERP_VOORSTELLEN = [
  // Elk woord wijst naar één thema: Intersekse is geen Gender, Coming-out geen Seksualiteit, Kolonialisme en Fascisme
  // geen Geschiedenis, Marxisme geen Politiek. Dat zijn aparte thema's.
  [/gender|trans|non ?binair/, 'Gender'],
  [/interseks|intersex/, 'Intersekse'],
  [/seks|sexualiteit|homo|lesb|queer|lgbt|holebi|gay/, 'Seksualiteit'],
  [/coming out|comingout|uit de kast/, 'Coming-out'],
  [/relatie|relationship|huwelijk|liefde/, 'Relaties'],
  [/polyamor/, 'Polyamorie'],
  [/femin|vrouw/, 'Feminisme'],
  [/roman|(?<!non ?)fictie|(?<!non ?)fiction|verhal|verhaal|proza|literatuur|thriller|detective|fantasy|science|kort/, 'Fictie'],
  [/geschied|histor|oorlog|holocaust|middeleeuw|archief/, 'Geschiedenis'],
  [/kolonial|colonial|dekolonis|decolonis|slavernij/, 'Kolonialisme'],
  [/fascis|nazi|extreemrechts|extreem rechts|far right/, 'Fascisme'],
  [/maatschap|sociolog|essay|non ?fictie|non ?fiction|filosof|ecolog|cultuur|onderzoek|racism|migrat|economi/, 'Maatschappij'],
  [/cultuur|culture|kunst/, 'Cultuur'],
  [/divers|inclusi|racism|migrat/, 'Diversiteit'],
  [/ecolog|klimaat|climate|milieu|duurzaam/, 'Ecologie'],
  [/gezond|health|ziekte|medisch|medic|hiv|aids|psychisch|mentale/, 'Gezondheid'],
  [/onderzoek|research|wetenschap|studie/, 'Onderzoek'],
  [/politi|activis|anarch|democrat|verkiezing|protest|revolut/, 'Politiek'],
  [/marx|communis|socialis|kapitalis/, 'Marxisme'],
  [/cuba|havana/, 'Cuba'],
  [/religi|spiritu|geloof|godsdienst|theolog|bijbel|koran|islam|moslim|jood|joods|jodendom|christ|kathol|kerk|boeddh|hindu|heks|wicca|mystiek|zingeving|astrolog|tarot|meditat/, 'Religie en Spiritualiteit'],
  [/biogra|^bio$|memoir|dagboek/, 'Biografie'],
  [/poezie|gedicht|poetry|poem/, 'Poëzie'],
  [/graphic novel|graphic memoir|\bstrips?\b|stripverha|stripboek|stripalbum|\bcomics?\b|manga|beeldroman/, 'Graphic novel'],
  [/young adult|^ya$|jeugd|kinder/, 'Young Adult'],
  [/pulp/, 'Pulp'],
  [/erotic|erotiek|bdsm|kink|fetish|leder|leather/, 'Erotica en BDSM'],
  [/zine/, 'Zines']
];

/**
 * De kolom status in de Catalogus. Leeg = gewoon.
 *   verloren            op de website als "niet meer beschikbaar", niet uitleenbaar
 *   gevoelig verborgen  niet op de website, wel uitleenbaar aan de balie
 *   gevoelig zichtbaar  op de website met het label "Gevoelige inhoud"
 */
var BOEKSTATUSSEN = ['verloren', 'gevoelig verborgen', 'gevoelig zichtbaar'];

// De thema's die in november 2026 bijkwamen (zie FILTERGROEPEN).
var NIEUWE_THEMAS = ['Intersekse', 'Coming-out', 'Relaties', 'Polyamorie', 'Kolonialisme', 'Fascisme', 'Cultuur', 'Diversiteit', 'Ecologie',
  'Gezondheid', 'Onderzoek', 'Marxisme', 'Cuba'];

/**
 * De oude groep "Geschiedenis en maatschappij" werd drie groepen: Geschiedenis, Maatschappij en
 * Religie en Spiritualiteit. Verdeelt de rijen van Onderwerpen op basis van het genre. Past een
 * genre in geen van de drie, dan wordt het Maatschappij. Andere groepen blijven staan.
 * Geeft { aangepast, religie } (aantal rijen, en hoeveel daarvan naar Religie en Spiritualiteit gingen).
 */
var OUDE_GROEP = 'geschiedenis en maatschappij';

var NIEUWE_GROEPEN = ['Geschiedenis', 'Maatschappij', 'Religie en Spiritualiteit'];

// Een specifiek thema en het bredere thema dat het verdringt als een genre ze allebei noemt.
var SPECIFIEK_THEMA = {
  'Kolonialisme': 'Geschiedenis', 'Fascisme': 'Geschiedenis', 'Intersekse': 'Gender', 'Coming-out': 'Seksualiteit',
  'Marxisme': 'Politiek', 'Cultuur': 'Maatschappij', 'Diversiteit': 'Maatschappij', 'Ecologie': 'Maatschappij', 'Onderzoek': 'Maatschappij'
};

// Eigen thema's bovenop FILTERGROEPEN (instelling eigen_themas, gezet door leesInstellingen).
var EIGEN_THEMAS = ['Kunst en Fotoboek'];

var CV_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var CV_PAUZE_MS = 1000; // Open Library vraagt om rustig te zoeken

var CV_ANDERE_UITGAVE = 'andere uitgave (Open Library)';

var CV_TITEL_AUTEUR = 'titel en auteur (Open Library)';

var IA_BRON = 'Internet Archive';

/*
 * Vroeger kwam soms het logo van Internet Archive als cover in de Catalogus (geen afbeelding van het boek).
 * Nieuwe covers kijkt het script meteen na (iaCoverIsEcht). Deze taak kijkt de covers na die er al staan.
 * Stond vroeger in het bestuursscherm, nu enkel in het menu: Madrigal > Covers.
 */
var IA_CONTROLE_SLEUTEL = 'ia_controle_vanaf'; // het laatst nagekeken boek-ID, om in porties verder te gaan

var CB_MAX_LOOPTIJD_MS = 4 * 60 * 1000;

var CB_MISLUKT = 'mislukt ';

var CB_POGING = 'poging ';

var CB_MAX_POGINGEN = 3;     // zo vaak een fout van de site (storing, te druk) voor de cover als mislukt telt

var CB_MAX_FOUTEN_NA_ELKAAR = 5; // zoveel covers na elkaar met een fout: dan is er echt een storing (bv. bij Google), ronde stoppen

var CB_MIN_PIXELS = 50; // kleiner is geen echte cover (bv. een leeg plaatje van 1 op 1)

var WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

var FILM_PAUZE_MS = 400;

var FILM_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var FILM_PORTIE = 20;         // zoveel films per vraag aan Wikidata

var FILM_MAX_GENRES = 4;

var LETTERBOXD_MAX_PAGINAS = 30;

/** Genres van IMDb in het Nederlands. Een onbekend genre blijft in het Engels. */
var FILM_GENRES_NL = {
  action: 'Actie', adventure: 'Avontuur', animation: 'Animatie', biography: 'Biografie', comedy: 'Komedie', crime: 'Misdaad',
  documentary: 'Documentaire', drama: 'Drama', family: 'Familie', fantasy: 'Fantasy', history: 'Geschiedenis', horror: 'Horror',
  music: 'Muziek', musical: 'Musical', mystery: 'Mysterie', romance: 'Romantiek', 'sci fi': 'Sciencefiction', 'science fiction': 'Sciencefiction',
  short: 'Kortfilm', sport: 'Sport', thriller: 'Thriller', war: 'Oorlog', western: 'Western', 'film noir': 'Film noir'
};

/** De kolommen die we herkennen, met de namen bij IMDb en Letterboxd. */
var FILM_KOLOMMEN = {
  titel: ['title', 'name', 'titel'],
  origineel: ['original title', 'originele titel'],
  jaar: ['year', 'jaar', 'jaartal'],
  regie: ['directors', 'director', 'regie'],
  genres: ['genres', 'genre'],
  duur: ['runtime mins', 'runtime', 'duur'],
  imdb: ['const', 'imdb', 'imdb id'],
  soort: ['title type']
};

/** Het deel van de vraag dat voor elke film dezelfde gegevens ophaalt. ?film moet al gekend zijn. */
var FILM_SPARQL_VELDEN =
  '  OPTIONAL { ?film wdt:P577 ?datum . }\n' +
  '  OPTIONAL { ?film wdt:P2047 ?duur . }\n' +
  '  OPTIONAL { ?film wdt:P1476 ?origineel . }\n' +
  '  OPTIONAL { ?film wdt:P57 ?r . ?r rdfs:label ?regieL . FILTER(LANG(?regieL) = "nl" || LANG(?regieL) = "en") }\n' +
  '  OPTIONAL { ?film wdt:P495 ?l . ?l rdfs:label ?landL . FILTER(LANG(?landL) = "nl") }\n' +
  '  OPTIONAL { ?film wdt:P136 ?g . ?g rdfs:label ?genreL . FILTER(LANG(?genreL) = "nl") }\n' +
  '  OPTIONAL { ?film wdt:P364 ?t . ?t rdfs:label ?taalL . FILTER(LANG(?taalL) = "nl") }\n' +
  '  OPTIONAL { ?nlA schema:about ?film ; schema:isPartOf <https://nl.wikipedia.org/> ; schema:name ?nl . }\n' +
  '  OPTIONAL { ?enA schema:about ?film ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en . }\n';

var FILM_SPARQL_KOP = 'SELECT ?film ?lb (MIN(YEAR(?datum)) AS ?jaar) (SAMPLE(?duur) AS ?minuten) ' +
  '(GROUP_CONCAT(DISTINCT ?regieL; separator="|") AS ?regie) (GROUP_CONCAT(DISTINCT ?landL; separator="|") AS ?land) ' +
  '(GROUP_CONCAT(DISTINCT ?genreL; separator="|") AS ?genre) (SAMPLE(?taalL) AS ?taal) (SAMPLE(?origineel) AS ?ot) (SAMPLE(?nl) AS ?nlTitel) (SAMPLE(?en) AS ?enTitel) WHERE {\n';

var GENRES_TABBLAD = 'Genres opkuisen';

// Schrijfwijzen die altijd zo moeten: genre (zoals genreSleutel het maakt) -> correcte schrijfwijze. Vul gerust aan.
var GENRE_SCHRIJFWIJZE_LIJST = {
  'poezie': 'Poëzie', 'seksualiteit': 'Seksualiteit', 'biografie': 'Biografie', 'autobiografie': 'Autobiografie',
  'intersex': 'Intersekse', 'intersekse': 'Intersekse', 'coming out': 'Coming-out', 'comingout': 'Coming-out', 'religie': 'Religie en Spiritualiteit', 'religie en spiritualiteit': 'Religie en Spiritualiteit',
  'fotoboek': 'Kunst en Fotoboek', 'kunst en fotoboek': 'Kunst en Fotoboek',
  'feminisme': 'Feminisme', 'young adult': 'Young Adult', 'graphic novel': 'Graphic novel', 'non fictie': 'Non-fictie',
  'nonfictie': 'Non-fictie', 'bdsm': 'BDSM', 'lgbt': 'LGBT', 'lgbtq': 'LGBTQ', 'lgbtqia': 'LGBTQIA+', 'lhbt': 'LHBT'
};

var GENRE_SCHRIJFWIJZE_CACHE = null;

/** Welke kolom van de Goodreads-export welk veld van de Catalogus aanvult. */
var GOODREADS_VELDEN = {
  uitgeverij: ['Publisher'],
  jaartal: ['Year Published', 'Original Publication Year'],
  paginas: ['Number of Pages']
};

var GB_PAUZE_MS = 400;

var GB_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var GB_TALEN = { nl: 'Nederlands', en: 'Engels', fr: 'Frans', de: 'Duits', es: 'Spaans', it: 'Italiaans', pt: 'Portugees' };

var GB_OP_TITEL = 'TA ';

var GB_TITEL_BRON = 'titel en auteur (Google Books)';

// Boeken die Google zeker kent: Pride and Prejudice (Penguin Classics) en To Kill a Mockingbird (Harper Perennial).
var GB_CONTROLE_ISBNS = ['9780141439518', '9780061120084'];

var GB_CONTROLE_BOEKEN = { '9780141439518': { titel: 'Pride and Prejudice', auteur: 'Austen, Jane' }, '9780061120084': { titel: 'To Kill a Mockingbird', auteur: 'Lee, Harper' } };

var GRENZEN = [
  {
    id: 'max_boeken',
    naam: 'Maximum aantal boeken per lener',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var aantal = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).length;
      var max = ctx.inst.max_boeken_per_lener;
      if (aantal < max) return null;
      return 'Deze lener heeft al ' + aantal + (aantal === 1 ? ' boek' : ' boeken') + '. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'te_laat',
    naam: 'Lener heeft nog een boek te laat',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var telaat = lopendeUitleningenVan(ctx.staat, ctx.lener.lenersnummer).filter(function (u) {
        return u.vervaldatum < ctx.vandaag;
      });
      if (!telaat.length) return null;
      var titels = telaat.map(function (u) {
        var b = boekVan(ctx.staat, u.boek_id);
        return '"' + (b ? b.titel : u.exemplaar) + '" (te laat sinds ' + datumTekst(u.vervaldatum, ctx.vandaag) + ')';
      });
      return 'Deze lener heeft nog een boek te laat: ' + titels.join(', ') + '.';
    }
  },
  {
    id: 'gereserveerd_voor_ander',
    naam: 'Exemplaar gereserveerd voor iemand anders',
    actie: 'uitlenen',
    controleer: function (ctx) {
      var anderen = actieveReservaties(ctx.staat, ctx.boek.boek_id).filter(function (r) {
        if (String(r.lenersnummer) === String(ctx.lener.lenersnummer)) return false;
        // Een klaarliggende reservatie voor een ander exemplaar houdt dit exemplaar niet tegen.
        if (r.status === 'klaar om op te halen' && r.exemplaar && r.exemplaar !== ctx.exemplaar) return false;
        return true;
      });
      if (!anderen.length) return null;
      var r = anderen[0];
      return 'Dit boek is gereserveerd voor lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.';
    }
  },
  {
    id: 'max_verlengingen',
    naam: 'Maximum aantal verlengingen',
    actie: 'verlengen',
    controleer: function (ctx) {
      var aantal = Number(ctx.uitlening.aantal_verlengingen || 0);
      var max = ctx.inst.max_verlengingen;
      if (aantal < max) return null;
      return 'Dit boek is al ' + aantal + ' keer verlengd. Het maximum is ' + max + '.';
    }
  },
  {
    id: 'verlengen_bij_reservatie',
    naam: 'Verlengen terwijl iemand anders wacht',
    actie: 'verlengen',
    controleer: function (ctx) {
      if (!ctx.inst.verlengen_niet_bij_reservatie) return null;
      var wachtenden = actieveReservaties(ctx.staat, ctx.uitlening.boek_id).filter(function (r) {
        return String(r.lenersnummer) !== String(ctx.uitlening.lenersnummer);
      });
      if (!wachtenden.length) return null;
      var r = wachtenden[0];
      return 'Iemand anders wacht op dit boek: lener ' + lenerNaam(ctx.staat, r.lenersnummer) +
        ', sinds ' + datumTekst(r.datum_reservatie, ctx.vandaag) + '.' +
        (wachtenden.length > 1 ? ' Er wachten in totaal ' + wachtenden.length + ' mensen.' : '');
    }
  }
];

/** Lidwoorden die we negeren bij zoeken en vergelijken (Nederlands, Engels, Frans, Duits). */
var LIDWOORDEN = ['de', 'het', 'een', 'the', 'a', 'an', 'le', 'la', 'les', 'l', 'un', 'une', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'el', 'los', 'las'];

/**
 * Tekst uit HTML: zonder tags, en tekens zoals &amp;, &#39;, &#x27; en &rsquo; terug naar gewone tekens.
 * Gebruikt voor Letterboxd (Films.js) en bol.com (Aankoop.js).
 */
var HTML_NAMEN = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', hellip: '\u2026', eacute: '\u00e9', euml: '\u00eb' };

var INDELEN_MIN_CATEGORIE = 1;

var INDELEN_MIN_TREFWOORD = 1;      // één treffer is genoeg: een beschrijving noemt een onderwerp vaak maar één keer

var INDELEN_MIN_TREFWOORD_FILM = 1;

// Thema's die bij een film geen trefwoord worden: dat zijn eigenlijk soorten boeken.
var INDELEN_GEEN_FILMTREFWOORD = ['Fictie', 'Klassiekers', 'Zines', 'Pulp', 'Young Adult', 'Graphic novel', 'Poëzie', 'Biografie', 'Onderzoek', 'Kunst en Fotoboek'];

/*
 * Ingebouwde zoekwoorden per naam (de sleutel is genreSleutel van de naam). Een woord telt als een woord in de
 * tekst ermee begint (lesbi telt voor lesbisch en lesbienne). Met = vooraan: enkel precies dat woord.
 * Met een spatie: twee woorden na elkaar. Een eigen kolom zoekwoorden in het tabblad komt hier bovenop.
 */
var INDELEN_ZOEKWOORDEN = {
  'lesbisch': ['lesbi', 'lesbo', 'sapph', 'saffisch'],
  'lesbian': ['lesbi', 'lesbo', 'sapph', 'saffisch'],
  'homo': ['homoseks', 'homofiel', '=homo', '=homos', '=gay', 'gay man', 'gay men'],
  'gay': ['homoseks', 'homofiel', '=homo', '=homos', '=gay'],
  'biseksueel': ['biseks', 'bisexu', 'biseksualiteit', '=bi'],
  'bisexual': ['biseks', 'bisexu', '=bi'],
  'trans': ['transgender', 'transvrouw', 'transman', 'transitie', 'transition', '=trans'],
  'transgender': ['transgender', 'transvrouw', 'transman', 'transitie', 'transition', '=trans'],
  'non binair': ['nonbinair', 'non binair', 'nonbinary', 'non binary', 'genderqueer', 'genderfluid'],
  'non binary': ['nonbinair', 'non binair', 'nonbinary', 'non binary', 'genderqueer', 'genderfluid'],
  'interseks': ['interseks', 'intersex'],
  'intersekse': ['interseks', 'intersex'],
  'aseksueel': ['aseks', 'asexu', 'aromantisch', 'aromantic', '=ace'],
  'asexual': ['aseks', 'asexu', 'aromantic', '=ace'],
  'coming out': ['coming out', 'comingout', 'uit de kast'],
  'aids': ['=aids', '=hiv', 'aidsepidemie', 'aids epidemie', 'hiv positief', 'hiv positive', 'act up'],
  'hiv': ['=aids', '=hiv'],
  'crime': ['misdaad', 'detective', 'thriller', 'moord', 'murder', 'rechercheur', 'politieonderzoek'],
  'misdaad': ['misdaad', 'detective', 'thriller', 'moord', 'murder', 'rechercheur', 'crime'],
  'thriller': ['thriller', 'spanning', 'suspense'],
  'comic': ['=strip', '=strips', 'stripverhaal', 'stripboek', '=comic', '=comics', 'graphic novel', 'manga', 'beeldroman'],
  'strip': ['=strip', '=strips', 'stripverhaal', 'stripboek', '=comic', '=comics', 'graphic novel', 'manga', 'beeldroman'],
  'manga': ['manga'],
  'roman': ['roman', 'novel', 'debuutroman'],
  'novel': ['roman', 'novel'],
  'verhal': ['verhalenbundel', 'kortverhal', 'short stor', 'verhalen'],
  'short story': ['verhalenbundel', 'kortverhal', 'short stor'],
  'essay': ['essay', 'essaybundel'],
  'kinderboek': ['kinderboek', 'prentenboek', 'voorlezen', 'kleuter', 'picture book', 'children'],
  'children': ['kinderboek', 'prentenboek', 'picture book', 'children'],
  'young adult': ['young adult', 'tiener', 'teen', 'puber', 'middelbare school', 'high school'],
  'sport': ['sport', 'voetbal', 'football', 'soccer', 'atleet', 'athlete', 'olympisch', 'olympic', 'wielren', 'tennis', 'boks', 'zwemm'],
  'fotografie': ['fotograf', 'photograph', 'fotoboek', 'foto s'],
  'kunst': ['kunst', 'kunstenaar', 'schilder', 'artist', '=art'],
  'muziek': ['muziek', 'music', 'muzikant', 'zanger', 'singer', 'opera'],
  'film': ['=film', '=films', 'cinema', 'regisseur', 'filmmaker'],
  'theater': ['theater', 'toneel', 'theatre', 'cabaret'],
  'drag': ['=drag', 'dragqueen', 'drag queen', 'dragking', 'drag king'],
  'romance': ['romance', 'liefdesverhaal', 'liefdesroman', 'love story', 'verliefd', 'falls in love'],
  'liefde': ['liefdesverhaal', 'liefdesroman', 'love story', 'verliefd', 'falls in love'],
  'fantasy': ['fantasy', 'magie', 'magic', 'draken', 'dragon', 'tovenaar', 'wizard', 'elfen'],
  'science fiction': ['science fiction', 'sciencefiction', 'sci fi', 'scifi', 'ruimteschip', 'spaceship', 'dystop'],
  'horror': ['horror', 'griezel', 'spook', 'ghost', 'vampier', 'vampire'],
  'humor': ['humor', 'humour', 'grappig', 'funny', 'hilarisch', 'hilarious', 'komisch'],
  'mentale gezondheid': ['depressie', 'depression', 'angststoornis', 'anxiety', 'mentale gezondheid', 'mental health', 'therapie', 'therapy', 'zelfmoord', 'suicide', 'psychisch', 'trauma'],
  'gezondheid': ['gezondheid', 'health', 'ziekte', 'illness', 'medisch', 'medical'],
  'familie': ['familie', 'gezin', 'family', 'ouderschap', 'parenting', 'regenboogfamilie', 'regenbooggezin', 'adoptie', 'adoption'],
  'ouderschap': ['ouderschap', 'parenting', 'regenboogfamilie', 'regenbooggezin', 'adoptie', 'adoption', 'zwanger', 'pregnan'],
  'relatie': ['relatie', 'relationship', 'huwelijk', 'marriage', 'trouwen', 'scheiding', 'divorce'],
  'polyamorie': ['polyamor', '=poly', 'open relatie', 'open relationship'],
  'racisme': ['racism', 'racist', 'kolonial', 'colonial', 'dekolonis', 'decolonis'],
  'migratie': ['migratie', 'migrant', 'vluchteling', 'refugee', 'asiel', 'asylum', 'diaspora'],
  'reizen': ['reis', 'reizen', 'travel', 'reisgids', 'roadtrip'],
  'kookboek': ['kookboek', 'recept', 'recipe', 'koken', 'cooking'],
  'sprookje': ['sprookje', 'fairy tale', 'fairytale'],
  'oorlog': ['oorlog', '=war', '=wars', 'wartime', 'wereldoorlog', 'world war', '=wwii', '=ww2', 'holocaust', 'nazi', 'soldaat', 'soldier', 'leger', 'army', 'verzet', 'resistance'],
  'sekswerk': ['sekswerk', 'sex work', 'sexwork', 'prostitu', 'escort', 'hustler', 'hooker', 'hoerenloper', 'bordeel', 'brothel', 'rosse buurt', 'red light', 'tippelaar'],
  'sex work': ['sekswerk', 'sex work', 'sexwork', 'prostitu', 'escort', 'hustler', 'hooker', 'bordeel', 'brothel', 'red light'],
  'activisme': ['activis', 'protest', 'betoging', 'demonstratie', 'pride', 'stonewall'],
  'religie': ['religie', 'religion', 'geloof', 'faith', 'kerk', 'church', 'bijbel', 'bible', 'islam', 'joods', 'jewish', 'christen', 'christelijk', 'christian'],
  'bdsm': ['bdsm', 'kink', 'fetish', 'fetisj', 'dominant', 'submissive', 'bondage', '=leder', 'leather'],
  'erotiek': ['erotisch', 'erotiek', 'erotic', 'seks', 'sex'],
  'seks': ['seks', 'sex', 'seksualiteit', 'sexuality']
};

/** De ingebouwde lijst, met als sleutel genreSleutel van de naam (zo werkt Oorlog, Reizen of Biseksueel ook). */
var INDELEN_INDEX = null;

var STANDAARD_INSTELLINGEN = [
  ['uitleentermijn_weken', 4, 'Hoeveel weken een lener een boek mag houden.'],
  ['verlengingstermijn_weken', 4, 'Hoeveel weken er bij een verlenging bijkomen.'],
  ['max_verlengingen', 1, 'Hoe vaak een lener een boek mag verlengen. Meer kan, maar dan als uitzondering met een reden.'],
  ['verlengen_niet_bij_reservatie', 'ja', 'ja: verlengen kan niet (zonder uitzondering) als iemand anders het boek gereserveerd heeft.'],
  ['max_boeken_per_lener', 2, 'Hoeveel boeken een lener tegelijk mag lenen. Meer kan, maar dan als uitzondering met een reden.'],
  ['borg_per_boek', 5, 'Borg in euro per boek. Het uitleenscherm vult dit bedrag voor.'],
  ['borg_betaalwijzen', 'cash, QR', 'Hoe iemand de borg kan betalen, gescheiden door komma\'s.'],
  ['gift_mogelijk', 'ja', 'ja: het uitleenscherm toont een veld voor een vrijwillige gift.'],
  ['openingsdagen', 'vrijdag', 'Op welke weekdagen de bib open is, gescheiden door komma\'s.'],
  ['terugbrengdatum_op_openingsdag', 'ja', 'ja: de terugbrengdatum schuift op naar de eerstvolgende openingsdag.'],
  ['gesloten_data', '', 'Openingsdagen waarop de bib toch dicht is. Schrijf ze als 25/12/2026, gescheiden door komma\'s.'],
  ['waarschuwing_dagen_voor_vervaldatum', 7, 'Vanaf hoeveel dagen voor de vervaldatum een uitlening "vervalt binnenkort" krijgt.'],
  ['ophaaltermijn_openingsdagen', 2, 'Hoeveel openingsdagen een gereserveerd boek apart blijft liggen. Daarna gaat het naar de volgende in de wachtrij.'],
  ['toegangscode_balie', '', 'Code voor de vrijwilligers aan de balie. Wijzig ze als ze uitlekt.'],
  ['rooster_url', '', 'Optioneel. De URL van de web-app van het vrijwilligersrooster (eindigt op /exec). Dan tonen de balie en het bestuur het rooster.'],
  ['rooster_code', '', 'De toegangscode voor vrijwilligers van het rooster. Blijft op de server, de browser ziet ze nooit.'],
  ['rooster_link', 'https://projectmadrigal.github.io/rooster/', 'Adres van de roostertool, voor de knop "Beschikbaarheid invullen".'],
  ['code_bestuur', '', 'Code voor het bestuursscherm. Geef ze enkel aan het bestuur.'],
  ['code_vrijwilliger', '', 'Code voor het vrijwilligersscherm: uitleningen nakijken, covers toevoegen, nieuws en agenda voorstellen, leeslijsten opmaken. Werkt ook aan de balie. Geef ze aan vaste vrijwilligers.'],
  ['leeslijsten_tonen', 'nee', 'ja: de leeslijsten staan op de website, met een eigen plek in het menu. nee: ze staan klaar, maar enkel het bestuursscherm toont ze.'],
  ['online_reserveren', 'nee', 'ja: de website toont bij elk uitleenbaar boek de knop "Reserveer dit boek". De aanvragen verschijnen in het bestuursscherm en in het tabblad Aanvragen.'],
  ['aanvragen_bewaren_dagen', 60, 'Na hoeveel dagen een aanvraag (met voornaam en contactgegevens) gewist wordt.'],
  ['backup_map', 'Project Madrigal back-ups', 'Naam van de map op Google Drive waar elke week een kopie van deze spreadsheet komt.'],
  ['backup_bewaren', 8, 'Hoeveel back-ups je bewaart. De oudste gaan vanzelf naar de prullenbak. Een back-up bevat ook de gegevens van leners.'],
  ['bewaartermijn_afgesloten_uitleningen_maanden', 12, 'Na hoeveel maanden de koppeling tussen een teruggebrachte uitlening en de lener gewist wordt.'],
  ['briefjes_bewaren_dagen', 60, 'Na hoeveel dagen een briefje voor de volgende shift gewist wordt, ook als niemand het weghaalde. Op Vandaag staat een briefje hoogstens 14 dagen.'],
  ['meldingen_bewaren_dagen', 90, 'Na hoeveel dagen een afgehandelde melding van een vrijwilliger gewist wordt. Open meldingen blijven staan.'],
  ['tekst_checklist_openen', 'Sleutel op zak: geen sleutel? Vraag het op tijd in de vrijwilligersgroep\nLicht en verwarming aan\nKassa en borgdoos klaarzetten\nBalie openen op de laptop\nTerugbrengbak leegmaken en boeken terugbrengen in het systeem', 'Checklist voor de vrijwilliger die de bib opent. Een punt per regel (nieuwe regel met Ctrl+Enter).'],
  ['tekst_checklist_uitlenen', 'Geen rode bol op het boek: een boek met een rode bol lees je enkel in de bib\nBladwijzer van Madrigal in het boek, met de terugbrengdatum\nBorg van 5 euro per boek, cash in de kassa of via de QR-code', 'Checklist aan de balie, bij elke uitlening. Een punt per regel (nieuwe regel met Ctrl+Enter).'],
  ['tekst_checklist_sluiten', 'Alle boeken terug in de kast\nBorgen tellen en in de borgdoos\nKassa met de borgen onder de witte kast, uit het zicht\nVuilbakken leeg: restafval in de containers buiten, de pmd-zak in de keuken\nLaptop afmelden en uitzetten\nLicht uit, verwarming terug op 1, ramen dicht\nLokaal goed afgesloten', 'Checklist voor de vrijwilliger die de bib sluit. Een punt per regel (nieuwe regel met Ctrl+Enter).'],
  ['tekst_handleiding', '# Wat is Project Madrigal\nProject Madrigal is de queer bib van Antwerpen. Alle informatie die bewustwording en identiteitsvorming verhoogt, hoort vrij beschikbaar te zijn voor queer personen en hun allies. Daarom werkt de bib zo drempelverlagend mogelijk.\nNa de sluiting van Kartonnen Dozen, de oudste nog overblijvende LGBTQIA+ boekhandel van de Benelux, verdween een culturele pilaar uit Antwerpen. Dankzij Johanna Pas kon Project Madrigal een deel van de tweedehands en nieuwe stock overnemen. Samen kozen ze meer dan 1000 boeken die binnen de community moesten blijven.\nDe focus ligt op gender en seksualiteit, met extra aandacht voor diversiteit. Je vindt er ook de klassiekers uit de gay en lesbische literatuur en veel feministische uitgaven.\n# Wat doe je als vrijwilliger\nJe bent op een afgesproken moment in de bib. Je ontvangt lezers, helpt hen verder waar je kan en registreert uitleningen en teruggebrachte boeken in het uitleenscherm.\n# De sleutel\nEr zijn enkele sleutels in omloop bij de vrijwilligers. Heb je zelf geen sleutel? Vraag dan op tijd in de vrijwilligersgroep op WhatsApp hoe je er een krijgt. Jij zorgt ervoor dat je de sleutel hebt voor je shift begint.\nIs er een workshop, praatavond of infomoment? Dan spreekt het bestuur af hoe de mensen binnen raken.\n# De bollen op de rug\n- Rode bol: dit boek leen je niet uit. Lezers mogen het wel lezen in de bib.\n- Gele bol: dit boek komt van Uitgeverij \'t Verschil of Kartonnen Dozen, of is een persoonlijke aanrader van Johanna Pas.\n# De borg\nBrengt de lezer de boeken in goede staat en op tijd terug, dan krijgt die de borg terug. Vraagt de lezer geen verlenging en reageert die niet op de herinnering? Dan houdt de bib de borg in.\nBetaalt de lezer met de QR-code? De afspraken daarover vind je in de vrijwilligersgroep.\n# Verlies of schade\nRaakt een boek kwijt? Dan vraagt de bib enkel de huidige waarde van het boek terug, tenzij de lezer zelf een vervangend exemplaar brengt. Meld het via Iets melden.\n# Werkt het uitleenscherm niet?\nNoteer de gegevens van het boek en de lezer op het blad in de bib, en laat het weten in de vrijwilligersgroep. Het bestuur verwerkt ze daarna.\n# Iemand wil iets kopen\nMeld het via Iets melden, met de soort Iemand wil iets kopen. Het bestuur neemt contact op als het boek te koop is.\n# Orde en netheid\nDe bib is een plek voor iedereen. Daarom houden we ze samen proper.\n- Kijk of de vloer niet te vuil is. Een borstel of stofzuiger kan je vragen in het gebouw.\n- Neem wat stof af van de boekenrekken. Stofdoeken en natte doekjes liggen op de vensterbank.\n- Zet de boeken netjes in de kast.\n- Maak de vuilbakken op tijd leeg. Restafval gaat in de containers buiten, de pmd-zak in de keuken.\n- Kijk of de posters nog goed hangen. Nieuwe Pritt-gom ligt op het bureau.\n# Vragen?\nStel je vraag in de vrijwilligersgroep op WhatsApp. Wie wanneer in de bib staat, zie je bij Rooster in dit scherm.', 'Handleiding in het vrijwilligersscherm. Een regel met # vooraan is een titel, een regel met - vooraan een opsommingspunt. De afspraken voor lenen (weken, boeken, borg) zet het scherm er zelf bij, uit de instellingen hierboven.'],
  ['tekst_handleiding_en', '# What is Project Madrigal\nProject Madrigal is Antwerp\'s queer library. All information that raises awareness and supports identity formation should be freely available to queer people and their allies. That is why the library strives to be as accessible as possible.\nFollowing the closure of Kartonnen Dozen, the oldest remaining LGBTQIA+ bookshop in the Benelux, a cultural mainstay disappeared from Antwerp. Thanks to Johanna Pas, Project Madrigal was able to take over part of the second-hand and new stock. Together, they selected more than 1,000 books that needed to remain within the community.\nThe focus is on gender and sexuality, with a particular emphasis on diversity. You\'ll also find classics from gay and lesbian literature and many feminist publications.\n# What do you do as a volunteer?\nYou come to the library at an agreed time. You welcome readers, help them where you can, and record loans and returned books on the lending screen.\n# The key\nThere are a few keys in circulation amongst the volunteers. If you don\'t have a key yourself, ask in good time in the volunteers\' WhatsApp group how to get one. Make sure you have the key before your shift starts.\nIs there a workshop, discussion evening or information session? In that case, the board will arrange how people can get in.\n# The dots on the spine\n- Red dot: this book cannot be borrowed. Readers are welcome to read it in the library.\n- Yellow dot: this book comes from \'t Verschil or Kartonnen Dozen, or is a personal recommendation from Johanna Pas.\n# The deposit\nIf the reader returns the books in good condition and on time, they get their deposit back. If the reader does not ask for an extension and does not respond to the reminder, the library keeps the deposit.\nDoes the reader pay with the QR code? You can find the arrangements for this in the volunteers\' group.\n# Loss or damage\nHas a book gone missing? Then the library only asks for the current value of the book, unless the reader brings a replacement copy. Report it via Iets melden (Report something).\n# Is the lending screen not working?\nWrite down the details of the book and the reader on the sheet in the library, and let the volunteers\' group know. The board will process them afterwards.\n# Someone wants to buy something\nReport it via Iets melden (Report something), with the type Iemand wil iets kopen (someone wants to buy something). The board will get in touch if the book is for sale.\n# Keeping the library tidy\nThe library is a place for everyone. That\'s why we keep it clean together.\n- Check that the floor isn\'t too dirty. You can ask for a brush or vacuum cleaner in the building.\n- Dust the bookshelves. Dust cloths and wet wipes are on the windowsill.\n- Put the books back neatly on the shelves.\n- Empty the bins in good time. General waste goes in the containers outside, the PMD bag in the kitchen.\n- Check that the posters are still hanging properly. There\'s new Pritt glue on the desk.\n# Any questions?\nAsk your question in the volunteers\' WhatsApp group. You can see who is in the library and when under Rooster (schedule) on this screen.', 'De handleiding in het Engels, voor vrijwilligers die geen Nederlands lezen. Zelfde opmaak.'],
  ['tekst_toegankelijkheid', '# Welkom\nProject Madrigal is een plek voor iedereen. Hier lees je hoe je bij ons geraakt en wat je binnen kan verwachten. Heb je een vraag of wil je hulp bij je bezoek? In de bib is er altijd een vrijwilliger die je verder helpt.\n# Met het openbaar vervoer\nDe bib ligt in de Peperfabriek, Breughelstraat 31 in Antwerpen (Stadsparkwijk).\n- Tram 4 tot de halte Sint-Vincentius, op ongeveer 100 meter.\n- Tram 15 tot de halte Lange Leemstraat, op ongeveer 300 meter.\n- Tram 7 tot de halte Gounod, op ongeveer 400 meter.\n# Met de fiets of de auto\nJe fiets zet je aan de fietsbeugels voor de Peperfabriek. Het dichtstbijzijnde Velo-station ligt aan het Sint-Vincentiusziekenhuis, op ongeveer 300 meter.\nEen parkeerplaats vinden in de buurt is vaak zoeken. Iemand afzetten kan meestal wel even aan de garagepoort van de Peperfabriek.\n# Zo ziet het gebouw eruit\nDe Peperfabriek is een cultureel centrum in een rustige straat met weinig doorgaand verkeer. De voorgevel is van rode baksteen. Buiten staan fietsbeugels en een posterzuil. De ingang is deels overdekt en heeft een glazen deur met een houten kader. Aan de ingang staan vaak bezoekers van de Peperfabriek buiten te praten en te roken.\nDe ingang is breed genoeg voor een rolstoel. De deur is wel zwaar.\n![De voorgevel van de Peperfabriek: een gebouw in rode baksteen met groene ramen. Rechts is de ingang met glazen deuren in een houten kader, onder een zwart doek met PEPERFABRIEK. Voor de gevel staan fietsen aan de fietsbeugels.](https://lh3.googleusercontent.com/d/14w2eyVnsS1n66ZdCnVi7HxUCezfTafcL)\n# De inkomhal\n- Vooraan in de inkomhal is een trap met een leuning.\n- Verder in de hal is een groene deur met een glasraam. Die gaat naar de bar van de Peperfabriek, en daarachter naar de tuin. In de bar koop je frisdrank, limonade of alcohol, en soms iets te eten. Vraag aan de bar naar vegan opties. Kraantjeswater is gratis.\n- Rechts van de groene deur zijn de toiletten.\n- Links van de groene deur is de lift.\n# Toiletten\nDe toiletten zijn genderneutraal. Er zijn drie kleinere toiletten en rechts is er een breder toilet met een handgreep, waar je met een rolstoel binnen kan. Het water van de wastafels is drinkbaar.\n# Naar de bib op de eerste verdieping\nNeem de lift of de trap naar de eerste verdieping. De lift werkt altijd. Werkt hij toch niet? Meld het aan de bar.\nKom je uit de lift, ga dan om de hoek naar links, door de rode deur. Je komt in een kleine ruimte met de ruilboeken van de Peperfabriek. De deur rechts brengt je in de bib.\n![Binnen in de bib, zicht op de rode deur waarlangs je binnenkomt. Ernaast een rek met folders en een opstapje.](https://projectmadrigal.github.io/assets/bib/rode-deur.jpg)\n# In de bib\nDe bib is meestal een rustige plek. Soms komen mensen er studeren, lezen of knutselen. Je mag er gerust een praatje slaan. Enkel tijdens onze donateursavond kan het druk worden.\n![De bib vanbinnen: hoge houten boekenkasten vol romans, regenboogvlaggetjes aan het plafond, en in de hoek een leeshoek met kussens en een zitzak.](https://projectmadrigal.github.io/assets/bib/kasten-fictie.jpg)\n![Een hoek met zwarte boekenkasten vol non-fictie, met een lichte schommelstoel op een zacht tapijt.](https://projectmadrigal.github.io/assets/bib/kasten-non-fictie.jpg)\n- Er zijn stoelen, een kleine schommelstoel en een strandstoel.\n- De ruimte is goed verlicht. Er zijn ook dimlampen, maar die maken de ruimte erg donker.\n- Er liggen fidgettoys die je mag gebruiken.\n- Is er een event in de Peperfabriek? Dan zoeken bezoekers soms rust in de bib.\n- Assistentiehonden zijn welkom.\n- Je mag met een puppyhood in de bib. Of dat in de bar ook mag, hangt af van de organisatie die er die avond zit.', 'Pagina Bereikbaarheid en toegankelijkheid op de website. Een regel met # vooraan is een titel, een regel met - vooraan een opsommingspunt. Een foto: een regel ![beschrijving van de foto](link naar de foto), bv. een link naar een foto op Google Drive.'],
  ['tekst_toegankelijkheid_en', '# Welcome\nProject Madrigal is a place for everyone. Here you can find out how to get here and what to expect inside. Do you have a question or would you like some help with your visit? There’s always a volunteer at the library to help you.\n# By public transport\nThe library is located in the Peperfabriek, at 31 Breughelstraat in Antwerp (Stadsparkwijk).\n- Take tram 4 to the Sint-Vincentius stop, which is about 100 metres away.\n- Take tram 15 to the Lange Leemstraat stop, which is about 300 metres away.\n- Take tram 7 to the Gounod stop, which is about 400 metres away.\n# By bike or car\nYou can park your bike at the bike racks in front of the Peperfabriek. The nearest Velo station is at St Vincent’s Hospital, about 300 metres away.\nFinding a parking space in the neighbourhood can often be a bit of a struggle. You can usually drop someone off briefly at the Peperfabriek’s garage door.\n# What the building looks like\nThe Peperfabriek is a cultural centre on a quiet street with little through traffic. The façade is made of red brick. Outside, there are cycle racks and a poster stand. The entrance is partially covered and has a glass door with a wooden frame. Visitors to the Peperfabriek can often be found standing outside the entrance, chatting and smoking.\nThe entrance is wide enough for a wheelchair. The door is quite heavy, though.\n![The front façade of the Peperfabriek: a red-brick building with green windows. On the right is the entrance, with glass doors set in a wooden frame, beneath a black banner bearing the words ‘PEPERFABRIEK’. Bicycles are secured to the bike racks in front of the façade.](https://lh3.googleusercontent.com/d/14w2eyVnsS1n66ZdCnVi7HxUCezfTafcL)\n# The entrance hall\n- At the front of the entrance hall is a flight of stairs with a handrail.\n- Further down the hall is a green door with a glass pane. It leads to the Peperfabriek bar, and beyond that to the garden. In the bar, you can buy soft drinks, lemonade or alcohol, and sometimes something to eat. Ask at the bar about vegan options. Tap water is free.\n- To the right of the green door are the toilets.\n- To the left of the green door is the lift.\n# Toilets\nThe toilets are gender-neutral. There are three smaller toilets, and on the right there is a wider toilet with a handrail, which is accessible by wheelchair. The water from the washbasins is drinkable.\n# To the library on the first floor\nTake the lift or the stairs to the first floor. The lift is always working. If it isn’t working, please let the bar staff know.\nWhen you come out of the lift, turn left round the corner and go through the red door. You’ll enter a small room with the Peperfabriek’s book exchange. The door on the right leads into the library.\n![Inside the library, a view of the red door through which you enter. Next to it is a rack with leaflets and a step.](https://projectmadrigal.github.io/assets/bib/rode-deur.jpg)\n# In the library\nThe library is usually a quiet place. Sometimes people come here to study, read or do crafts. Feel free to have a chat. It can only get busy during our donors’ evening.\n![Inside the library: tall wooden bookcases full of novels, rainbow flags hanging from the ceiling, and a reading corner in the corner with cushions and a beanbag.](https://projectmadrigal.github.io/assets/bib/kasten-fictie.jpg)\n![A corner with black bookcases full of non-fiction, with a light-coloured rocking chair on a soft carpet.](https://projectmadrigal.github.io/assets/bib/kasten-non-fictie.jpg)\n- There are chairs, a small rocking chair and a deckchair.\n- The room is well lit. There are also dimmable lights, but these make the room very dark.\n- There are fidget toys you’re welcome to use.\n- Is there an event at the Peperfabriek? If so, visitors sometimes seek a quiet spot in the library.\n- Assistance dogs are welcome.\n- You’re allowed to bring a puppyhood into the library. Whether you’re allowed to bring one into the bar depends on the organisation running the venue that evening.', 'Dezelfde pagina in het Engels. Zelfde opmaak. Leeg: de website toont het Nederlands.'],
  ['goodreads_shelf', '', 'Naam van de Goodreads-shelf met de boeken van Madrigal, precies zoals op Goodreads. Leeg: alle boeken uit de export.'],
  ['goatcounter_code', 'projectmadrigal', 'De code van het GoatCounter-account (projectmadrigal voor projectmadrigal.goatcounter.com). Dezelfde als statistiek in config.js.'],
  ['goatcounter_api_sleutel', '', 'Optioneel. Een API-sleutel van GoatCounter (je naam rechtsboven > Preferences > tabblad API, enkel "Read statistics"). Dan toont het bestuursscherm de bezoekers onder Cijfers. Deel deze sleutel met niemand.'],
  ['google_books_api_key', '', 'Optioneel. Een sleutel voor de Google Books-API, zodat covers sneller opgezocht worden. Leeg werkt ook, maar trager.'],
  ['bol_client_id', '', 'Optioneel. Client ID van een partneraccount bij bol.com (Marketing Catalog API), voor covers van Nederlandstalige boeken.'],
  ['bol_client_secret', '', 'Optioneel. Client Secret van dat partneraccount. Blijft op de server.'],
  ['cover_map', 'Project Madrigal covers', 'Naam van de map op Google Drive voor foto\'s van covers die je in de bib neemt.'],
  ['zines_te_koop_uitleenbaar', 'nee', 'nee: zines met genre "verkoop" zijn niet uitleenbaar.'],
  ['tekst_welkom', 'Welkom in de catalogus van Project Madrigal, de queer bib van Antwerpen. Zoek, snuister en kom langs om te lenen.', 'Welkomsttekst bovenaan de publieke catalogus.'],
  ['tekst_uitleg_lenen', 'Je leent gratis, je betaalt enkel 5 euro borg per boek. Die krijg je terug als je het boek terugbrengt. Je mag 2 boeken tegelijk lenen, voor 4 weken. Kom langs op vrijdag tijdens de openingsuren.', 'Uitleg over lenen in de publieke catalogus: wanneer open, hoe lang, hoeveel.'],
  ['tekst_privacy', 'We bewaren enkel je voornaam, eventueel je achternaam, je telefoonnummer en/of e-mailadres, en je lenersnummer. We gebruiken die enkel om je uitleningen op te volgen en je te herinneren als een boek terug moet. Enkel het bestuur ziet je contactgegevens. Na een teruggebracht boek wissen we de koppeling met jou na 12 maanden. Wil je je gegevens inkijken of laten wissen? Vraag het aan de balie of mail naar [vul het mailadres van het bestuur in].', 'Privacyverklaring bij het inschrijven en in de publieke catalogus.'],
  ['tekst_welkom_en', 'Welcome to the catalogue of Project Madrigal, the queer library of Antwerp. Search, browse and come by to borrow.', 'Welkomsttekst in het Engels.'],
  ['tekst_uitleg_lenen_en', 'Borrowing is free, you only pay a 5 euro deposit per book. You get it back when you return the book. You can borrow 2 books at a time, for 4 weeks. Come by on Friday during opening hours.', 'Uitleg over lenen in het Engels.'],
  ['tekst_privacy_en', 'We only keep your first name, possibly your last name, your phone number and/or email address, and your borrower number. We only use them to follow up on your loans and to remind you when a book is due. Only the board can see your contact details. Twelve months after you return a book, we remove the link with you. Want to see your data or have it deleted? Ask at the desk or email [fill in the board email address].', 'Privacyverklaring in het Engels.'],
  ['tekst_vrijwilliger', '', 'Pagina Doe mee: hoe word je vrijwilliger? Wat doe je, hoeveel tijd vraagt het, hoe meld je je aan. Leeg: dit blok staat niet op de pagina.'],
  ['tekst_vrijwilliger_en', '', 'Pagina Doe mee, vrijwilliger worden, in het Engels.'],
  ['tekst_schenken', '', 'Pagina Doe mee: welke boeken neem je graag aan, en welke niet? Hoe breng je ze binnen? Leeg: dit blok staat niet op de pagina.'],
  ['tekst_schenken_en', '', 'Pagina Doe mee, boeken schenken, in het Engels.'],
  ['tekst_steunen', '', 'Pagina Doe mee: hoe kan iemand Project Madrigal steunen (gift, rekeningnummer, materiaal)? Leeg: dit blok staat niet op de pagina.'],
  ['tekst_steunen_en', '', 'Pagina Doe mee, steunen, in het Engels.'],
  ['bookclub_naam', 'Antwerp Queer Bookclub', 'De naam van de bookclub die in de bib samenkomt. De eerstvolgende keren staan vanzelf in de agenda op de startpagina. Leeg: niets tonen.'],
  ['bookclub_week', 2, 'De hoeveelste week van de maand: 1 tot 4, of 5 voor de laatste.'],
  ['bookclub_dag', 'zondag', 'Op welke weekdag de bookclub samenkomt.'],
  ['bookclub_uur', '', 'Het uur, bv. 14:00 of 14:00 - 16:00. Leeg: enkel de datum.'],
  ['tekst_vaste_events', 'Genderspectrum: tweede vrijdag\nT-café: derde vrijdag\nACA-volkskeuken: vierde vrijdag', 'Events die elke maand terugkomen. Een regel per event: naam, dubbelpunt, en eerste, tweede, derde, vierde of laatste plus de weekdag. Ze komen vanzelf in de agenda van de website en bij het rooster. Een tekst, uur en plaats op de website zet je in het tabblad Vaste events, met dezelfde naam. Geen vaste events? Typ geen.'],
  ['films_tonen', 'nee', 'Ja: de pagina Films staat in het menu van de website. Nee: enkel het bestuur ziet ze, op een toestel waar het aangemeld is.'],
  ['tekst_films', 'Films over queer leven, liefde en geschiedenis. Leen een dvd zoals je een boek leent.', 'Pagina Films: de tekst bovenaan.'],
  ['tekst_films_en', 'Films about queer life, love and history. Borrow a DVD the way you borrow a book.', 'Pagina Films: de tekst bovenaan, in het Engels.'],
  ['letterboxd_lijst', 'https://letterboxd.com/dragonflyk/list/lovertits/', 'Adres van een lijst bij Letterboxd. Madrigal > Films > Haal de Letterboxd-lijst op zet de films ervan in de Catalogus.'],
  ['tekst_bookclub', 'De Antwerp Queer Bookclub komt samen in de bib van Project Madrigal. Hun programma en andere activiteiten vind je op hun Instagram.', 'De tekst bij de bookclub, in de agenda en op Over ons.'],
  ['tekst_bookclub_en', 'The Antwerp Queer Bookclub meets in the Project Madrigal library. You will find their programme and other activities on their Instagram.', 'De tekst bij de bookclub, in het Engels.'],
  ['bookclub_link', '', 'Het adres van hun Instagram, bv. https://www.instagram.com/... Komt bij Meer info.'],
  ['peperfabriek_url', 'https://www.peperfabriek.be/nl/programma', 'Adres van het programma van De Peperfabriek. Het script haalt het elke nacht op voor de pagina Peperfabriek. Leeg: niets ophalen, enkel de tekst en een link.'],
  ['tekst_peperfabriek', 'De bib van Project Madrigal vind je in De Peperfabriek. Dit staat er de komende weken nog op het programma.', 'Pagina Peperfabriek: de tekst bovenaan.'],
  ['tekst_peperfabriek_en', 'You will find the Project Madrigal library in De Peperfabriek. This is what is coming up there.', 'Pagina Peperfabriek, in het Engels.'],
  ['peperfabriek_aantal', 12, 'Hoeveel activiteiten van De Peperfabriek de pagina hoogstens toont.'],
  ['adres', 'Peperfabriek (eerste verdieping)\nBreughelstraat 31\n2018 Antwerpen', 'Adres op de website. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren', 'Elke vrijdag: 18:00 - 20:00', 'Openingsuren op de website, in het Nederlands. Een nieuwe regel maak je met Ctrl+Enter.'],
  ['openingsuren_en', 'Every Friday: 18:00 - 20:00', 'Openingsuren op de website, in het Engels.'],
  ['mail_algemeen', 'info@projectmadrigal.be', 'Algemeen mailadres op de website.'],
  ['mail_events', 'events.madrigal@gmail.com', 'Mailadres voor events op de website.'],
  ['nieuw_op_startpagina_dagen', 60, 'Hoeveel dagen een nieuw toegevoegd boek vooraan in "Nieuw binnen" staat. Zijn er te weinig, dan vult de site aan met de laatst gecatalogiseerde boeken. 0: de sectie Nieuw binnen staat uit.'],
  ['nieuw_op_startpagina_aantal', 8, 'Hoeveel boeken "Nieuw binnen" op de startpagina hoogstens toont. De nieuwste eerst.'],
  ['aanraders_uit_stocklijst', 'Johanna', 'Namen van wie de aanraders uit de oude stocklijst overgenomen worden, gescheiden door komma\'s. Andere namen uit de stocklijst niet. Een aanrader die je zelf typt in de kolom aanrader van de Catalogus, staat altijd op de website.'],
  ['triggerwaarschuwingen_tonen', 'nee', 'ja: de triggerwaarschuwingen (kolom triggerwaarschuwingen in de Catalogus) staan bij het boek op de website, dichtgeklapt. nee: ze blijven enkel in de spreadsheet.'],
  ['eigen_themas', 'Kunst en Fotoboek', 'Thema\'s op de website bovenop de vaste thema\'s (Gender, Fictie, Poëzie, ...), gescheiden door komma\'s. Een genre met dezelfde naam komt vanzelf in dat thema. Andere namen in de kolommen filtergroepen en extra_onderwerpen worden vertaald naar een thema, of vallen weg.'],
  ['aanraders_verbergen', '', 'Namen van wie de aanraders nergens op de website staan, gescheiden door komma\'s (bv. Nance): niet op de startpagina, niet als label bij de boeken en niet in de filter Aanrader. De namen blijven in de Catalogus staan. Leeg: iedereen staat erop.'],
  ['tekst_herinnering', 'Hoi {voornaam}, je leende bij Project Madrigal "{titel}". Dat boek moest terug op {vervaldatum}. Breng je het binnenkort binnen? Lukt dat niet, laat het ons dan even weten. Dank je!', 'Herinnering voor een boek dat te laat is. Gebruik {voornaam}, {titel} en {vervaldatum}.'],
  ['tekst_herinnering_binnenkort', 'Hoi {voornaam}, een vriendelijke herinnering: "{titel}" mag terug naar Project Madrigal op {vervaldatum}. Wil je het langer houden? Laat het ons weten, dan verlengen we het. Veel leesplezier!', 'Herinnering voor een boek dat binnenkort vervalt.']
];

var KOLOM_THEMAS = {
  boek: ['#fff2cc', 'Gegevens van het boek'],
  website: ['#e4d7f5', 'Website'],
  uitlenen: ['#d9eaf7', 'Uitlenen'],
  film: ['#d9ead3', 'Film'],
  verkoop: ['#fce5cd', 'Verkoop'],
  bestuur: ['#f4cccc', 'Bestuur'],
  techniek: ['#eeeeee', 'Techniek (het script)'],
  datum: ['#d9eaf7', 'Datums'],
  borg: ['#fce5cd', 'Borg en gift'],
  wie: ['#e4d7f5', 'Wie en hoe']
};

/**
 * Per tabblad: de vaste kolommen (tot en met deze kolom blijven ze staan) en per kolom [thema, uitleg, niet publiek].
 * Een kolom die hier niet staat, krijgt niets (een kolom die het bestuur zelf toevoegde, blijft zoals ze is).
 */
var KOLOM_INDELING = {
  'Catalogus': {
    vast: ['boek_id', 'titel', 'auteur'],
    kolommen: {
      boek_id: ['boek', 'Uniek nummer van het boek (B0001). Het script geeft het vanzelf. Niet wijzigen.'],
      soort: ['boek', 'boek, zine of film.'],
      titel: ['boek', 'Titel zoals op het boek. Een ondertitel na een dubbelpunt: "Titel: Ondertitel".'],
      auteur: ['boek', 'Achternaam, Voornaam. Meer auteurs met & ertussen.'],
      isbn: ['boek', 'ISBN van 13 cijfers, zonder streepjes.'],
      uitgeverij: ['boek', 'Uitgeverij.'],
      jaartal: ['boek', 'Jaar van uitgave.'],
      taal: ['boek', 'Taal van het boek: Nederlands, Engels, Frans, ...'],
      paginas: ['boek', 'Aantal pagina\'s.'],
      uitvoering: ['boek', 'Hardcover, Paperback of Pocket.'],
      nieuwstaat: ['boek', 'Staat van het boek, uit de stocklijst.'],
      originele_titel: ['boek', 'Titel in de oorspronkelijke taal, als die anders is (vertalingen, films).'],
      auteur_zoeknamen: ['boek', 'Vroegere namen en pseudoniemen van de auteur, enkel om op te zoeken. Het script vult dit uit het tabblad Auteursnamen. Niet zelf invullen.'],
      aanrader: ['website', 'Wie dit boek aanraadt (bv. Johanna). Staat op de website.'],
      genre: ['website', 'Genre uit de stocklijst. Via het tabblad Onderwerpen bepaalt dit in welk thema het boek staat.'],
      extra_onderwerpen: ['website', 'Extra thema\'s voor de filters op de website, met een komma ertussen.'],
      categorieen: ['website', 'Categorieën zoals op de oude website (bv. Roman, Essay), met een komma ertussen. Geel bij het boek, en een filter op de website. Keuzes en indeling: tabblad Categorieën en trefwoorden.'],
      trefwoorden: ['website', 'Thema\'s en trefwoorden zoals op de oude website (bv. Lesbisch, Coming-out), met een komma ertussen. Paars bij het boek, een filter en zoekbaar op de website. Keuzes en indeling: tabblad Categorieën en trefwoorden.'],
      triggerwaarschuwingen: ['website', 'Triggerwaarschuwingen (bv. geweld, zelfdoding), met een komma ertussen. Op de website enkel als de instelling triggerwaarschuwingen_tonen op ja staat.'],
      klassieker: ['website', 'ja = staat bij de klassiekers.'],
      publiek: ['website', 'ja = op de website. nee = verborgen.'],
      status: ['website', 'Leeg = gewoon.\nverloren: niet op de website, niet uitleenbaar.\ngevoelig verborgen: niet op de website, wel uitleenbaar.\ngevoelig zichtbaar: op de website met het label "Gevoelige inhoud".'],
      beschrijving: ['website', 'Beschrijving op de website, in het Nederlands.'],
      beschrijving_en: ['website', 'Beschrijving in het Engels. Leeg: het script vertaalt.'],
      beschrijving_bron: ['website', 'Waar de beschrijving vandaan komt. Leeg bij een eigen tekst.'],
      cover_url: ['website', 'Link naar de cover. Leeg: het script zoekt er een.'],
      startpagina: ['website', 'ja = in de kijker op de startpagina.'],
      leeslijsten: ['website', 'De leeslijsten waarin dit boek staat, met een komma ertussen.'],
      toegevoegd_op: ['website', 'Datum waarop het boek erbij kwam (Nieuw in de bib).'],
      aantal: ['uitlenen', 'Aantal exemplaren in de bib.'],
      uitleenbaar: ['uitlenen', 'ja of nee. nee = enkel lezen in de bib.'],
      land: ['film', 'Film: land.'],
      duur: ['film', 'Film: speelduur in minuten.'],
      film_tip: ['film', 'Film: ja = kijktip.'],
      letterboxd: ['film', 'Film: adres bij Letterboxd.'],
      imdb: ['film', 'Film: nummer bij IMDb (tt...).'],
      wikidata: ['film', 'Film: nummer bij Wikidata.'],
      te_koop: ['verkoop', 'ja = te koop.'],
      prijs: ['verkoop', 'Verkoopprijs in euro.'],
      onderhandelbaar: ['verkoop', 'ja = de prijs is bespreekbaar.'],
      te_koop_aantal: ['verkoop', 'Aantal exemplaren te koop.'],
      notitie: ['bestuur', 'Interne notitie van het bestuur (bv. schade, plaats in de kast).', true],
      herkomst: ['techniek', 'Waar het boek vandaan komt, uit de stocklijst.', true],
      isbn10: ['boek', 'ISBN-10, berekend uit het ISBN (enkel bij nummers die met 978 beginnen). Vult het script vanzelf in. Niet op de website.'],
      isbn_origineel: ['techniek', 'Het ISBN zoals in de stocklijst, als het ongeldig was.', true],
      bron_sleutel: ['techniek', 'Koppeling met de stocklijst. Niet wijzigen.', true],
      ol_gecontroleerd: ['techniek', 'Datum: opgezocht bij Open Library. Leeg = opnieuw zoeken.', true],
      gb_gecontroleerd: ['techniek', 'Datum: opgezocht bij Google Books. Leeg = opnieuw zoeken.', true],
      beschrijving_gezocht: ['techniek', 'Datum: beschrijving gezocht. Leeg = opnieuw zoeken.', true],
      beschrijving_vertaald: ['techniek', 'Datum: beschrijving vertaald. Leeg = opnieuw vertalen.', true],
      cover_bron: ['techniek', 'Waar de cover vandaan komt (foto in de bib, link, oude website, ...).', true],
      cover_gezocht: ['techniek', 'Datum: cover gezocht. Leeg = opnieuw zoeken.', true],
      bol_gezocht: ['techniek', 'Datum: opgezocht bij bol.com. Leeg = opnieuw zoeken.', true],
      ia_gezocht: ['techniek', 'Datum: opgezocht bij Internet Archive. Leeg = opnieuw zoeken.', true],
      wiki_gezocht: ['techniek', 'Datum: opgezocht bij Wikipedia. Leeg = opnieuw zoeken.', true],
      cover_origineel: ['techniek', 'Waar de cover vandaan kwam voor ze naar Google Drive gekopieerd werd (Covers > Bewaar alle covers in Google Drive).', true],
      cover_bewaard: ['techniek', 'Datum: cover naar Google Drive gekopieerd. "poging" + nummer: de site gaf een fout, het script probeert het nog eens. "mislukt" + datum: die link lukte niet. Leeg = opnieuw proberen.', true],
      oude_cover: ['techniek', 'Cover van de oude website die nog naar Drive gekopieerd moet worden. Leeg als het klaar is.', true],
      film_gezocht: ['techniek', 'Datum: film opgezocht bij Wikidata. Leeg = opnieuw zoeken.', true],
      zoek_sleutel: ['techniek', 'Vingerafdruk van ISBN, titel en auteur. Verandert er een, dan zoekt het script opnieuw naar een cover en een beschrijving. Niet zelf invullen.', true]
    }
  },
  'Uitleningen': {
    vast: ['uitlening_id', 'exemplaar', 'boek_id'],
    kolommen: {
      uitlening_id: ['boek', 'Nummer van de uitlening (U0001).'],
      exemplaar: ['boek', 'Welk exemplaar: boek_id met een volgnummer (B0001-1).'],
      boek_id: ['boek', 'Het boek (zie de Catalogus).'],
      lenersnummer: ['boek', 'De lener (zie het tabblad Leners).'],
      datum_uit: ['datum', 'Datum van uitlenen.'],
      oorspronkelijke_vervaldatum: ['datum', 'De eerste vervaldatum, voor elke verlenging.'],
      vervaldatum: ['datum', 'Tegen wanneer het boek terug moet.'],
      vorige_vervaldatum: ['datum', 'De vervaldatum voor de laatste verlenging. Zo kan je een verlenging annuleren.'],
      datum_terug: ['datum', 'Datum waarop het boek terugkwam. Leeg = nog uitgeleend.'],
      aantal_verlengingen: ['datum', 'Hoe vaak verlengd.'],
      datum_verlenging: ['datum', 'Datum van de laatste verlenging.'],
      laatste_herinnering: ['datum', 'Datum van de laatste herinnering.'],
      borg: ['borg', 'Borg in euro.'],
      betaalwijze_borg: ['borg', 'cash of QR-code.'],
      borg_terugbetaald: ['borg', 'ja = de borg is terugbetaald.'],
      gift: ['borg', 'Gift in euro.'],
      vrijwilliger: ['wie', 'Wie de uitlening deed.'],
      bron: ['wie', 'Hoe de uitlening binnenkwam (balie, aanvraag, ...).'],
      staat_terug: ['wie', 'Hoe het boek terugkwam (in orde, licht beschadigd, beschadigd), met een opmerking.']
    }
  }
};

/** Instellingen met een toegangscode: leeg betekent bij het installeren een nieuwe willekeurige code. */
var CODE_INSTELLINGEN = ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur'];

var ONDERWERP_NAKIJKEN = 'Onderwerpen nakijken';

var ONDERWERP_ZEKER_MIN = 3;    // zo vaak moet een thema minstens voorkomen in titel en beschrijving

var ONDERWERP_ZEKER_FACTOR = 2; // en zoveel keer vaker dan het volgende thema

/*
 * Woorden in een titel of beschrijving die op een thema wijzen. Woorden die in bijna elke beschrijving in een queer
 * bib staan (lesbisch, homo, gay, queer, liefde, vrouw), tellen bewust niet: die zeggen niets over het thema.
 * Een woord telt als het ermee begint (roman telt ook voor romans en romancier). Met = vooraan: enkel precies dat
 * woord (=god telt niet voor godin). Met een spatie: twee woorden na elkaar (coming out).
 */
var ONDERWERP_TEKST_WOORDEN = [
  ['Fictie', ['roman', 'novel', 'verhalenbundel', 'kortverhal', 'fictie', 'fiction', 'thriller', 'detective', 'personage', 'hoofdpersonage', 'protagonist']],
  ['Poëzie', ['gedicht', 'poezie', 'poetry', 'poem', 'dichter', 'dichteres', 'poet', 'dichtbundel']],
  // Niet "graphic" alleen (graphic sex, graphic design) en niet "strip" als begin (striptease, stripped).
  ['Graphic novel', ['graphic novel', 'graphic memoir', 'stripverhaal', 'stripboek', 'stripalbum', '=strip', '=strips', '=comic', '=comics', 'manga', 'beeldroman']],
  ['Biografie', ['biografie', 'biography', 'memoir', 'memoires', 'autobiografie', 'autobiography', 'dagboek', 'levensverhaal', 'diary']],
  ['Gender', ['transgender', 'transitie', 'transvrouw', 'transman', 'nonbinair', 'non binair', 'genderidentiteit', 'genderqueer']],
  ['Feminisme', ['feminis', 'patriarchaat', 'patriarchy', 'vrouwenbeweging', 'vrouwenrechten', 'misogyn']],
  ['Geschiedenis', ['geschiedenis', 'history', 'historisch', 'historical', '=eeuw', '=eeuwen', '=century', '=centuries', 'oorlog', 'holocaust', 'archief']],
  ['Maatschappij', ['essay', 'samenleving', 'maatschappij', 'society', 'sociolog', 'filosof', 'philosoph', 'onderzoek', 'research']],
  ['Politiek', ['politiek', 'politics', 'political', 'activis', 'activism', 'protest', 'revolutie', 'revolution']],
  ['Religie en Spiritualiteit', ['religie', 'religion', 'geloof', 'faith', 'kerk', 'church', 'bijbel', 'bible', 'islam', 'spiritualiteit', 'spiritual', 'tarot', 'heks', 'witch', '=god', '=goden', '=gods']],
  ['Young Adult', ['young adult', 'tiener', 'teen', 'jongeren', 'middelbare school', 'high school', 'puber']],
  ['Erotica en BDSM', ['erotisch', 'erotiek', 'erotic', 'bdsm', 'kink', 'fetish', '=leder', 'leather', 'dominant', 'submissive']],
  ['Seksualiteit', ['seksualiteit', 'sexuality', 'seksuele', 'sexual']],
  ['Intersekse', ['intersekse', 'interseks', 'intersex']],
  ['Coming-out', ['coming out', 'comingout', 'uit de kast']],
  ['Relaties', ['relatie', 'relationship', 'huwelijk', 'marriage', 'scheiding', 'divorce']],
  ['Polyamorie', ['polyamor', 'open relatie', 'open relationship']],
  ['Kolonialisme', ['kolonial', 'colonial', 'dekolonis', 'decolonis', 'slavernij', 'slavery']],
  ['Fascisme', ['fascis', 'nazi', 'extreemrechts', 'extreem rechts', 'far right']],
  ['Cultuur', ['cultuur', 'culture', 'kunstenaar', 'artist']],
  ['Diversiteit', ['diversiteit', 'diversity', 'inclusie', 'inclusion', 'racisme', 'racism']],
  ['Ecologie', ['ecolog', 'klimaat', 'climate', 'milieu', 'duurzaam', 'sustainab']],
  ['Gezondheid', ['gezondheid', 'health', 'ziekte', 'illness', 'medisch', 'medical', '=hiv', '=aids']],
  ['Onderzoek', ['onderzoek', 'research', 'wetenschap', 'science', 'studie']],
  ['Marxisme', ['marx', 'communis', 'socialis', 'kapitalis', 'capitalis']],
  ['Cuba', ['cuba', 'cubaan', 'havana']]
];

var ONDERWERP_KOLOMMEN = ['boek_id', 'titel', 'auteur', 'genre', 'voorstel', 'onderwerp_nieuw', 'toepassen'];

var OL_PORTIE = 20;

var OL_PAUZE_MS = 1500;

var OL_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var OL_TALEN = { eng: 'Engels', dut: 'Nederlands', fre: 'Frans', ger: 'Duits', spa: 'Spaans', ita: 'Italiaans', por: 'Portugees' };

/** Velden die Open Library kan aanvullen. */
var OL_VELDEN = ['uitgeverij', 'jaartal', 'paginas', 'taal', 'beschrijving', 'cover_url'];

/** De kolommen van elk tabblad. De volgorde bepaalt enkel de opbouw bij installeren. */
var KOLOMMEN = {
  'Catalogus': [
    'boek_id', 'soort', 'titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas',
    'uitvoering', 'nieuwstaat', 'aanrader', 'genre', 'extra_onderwerpen', 'categorieen', 'trefwoorden', 'triggerwaarschuwingen', 'klassieker', 'aantal',
    'uitleenbaar', 'publiek', 'status', 'beschrijving', 'beschrijving_en', 'beschrijving_bron', 'cover_url', 'startpagina', 'leeslijsten', 'toegevoegd_op',
    // Films (zie Films.js): land, speelduur, kijktip. te_koop werkt voor elk boek of elke film.
    'land', 'duur', 'film_tip', 'te_koop',
    // Verkoop op standjes (Verkoop.js): prijs in euro, onderhandelbaar ja/nee, aantal exemplaren te koop.
    'prijs', 'onderhandelbaar', 'te_koop_aantal',
    // De titel in de oorspronkelijke taal, als die verschilt (vooral films en vertaalde boeken).
    'originele_titel',
    // Vroegere namen en pseudoniemen van de auteur (Auteursnamen.js): enkel om op te zoeken, nooit getoond. Het script vult dit.
    'auteur_zoeknamen',
    // Vanaf hier: nooit publiek.
    'herkomst', 'isbn_origineel', 'isbn10', 'bron_sleutel', 'ol_gecontroleerd', 'gb_gecontroleerd', 'beschrijving_gezocht', 'beschrijving_vertaald',
    'cover_bron', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'wiki_gezocht',
    // Vingerafdruk van ISBN, titel en auteur (ZoekOpnieuw.js): verandert die, dan zoekt het script opnieuw.
    'zoek_sleutel',
    // Een cover van de oude website die nog naar Drive gekopieerd moet worden (OudeBoeken.js). Leeg als het klaar is.
    'oude_cover', 'cover_origineel', 'cover_bewaard',
    'letterboxd', 'imdb', 'wikidata', 'film_gezocht',
    // Interne notitie van het bestuur (bv. schade, plaats in de kast). Nooit publiek.
    'notitie'
  ],
  'Onderwerpen': ['genre', 'filtergroepen', 'aantal_boeken'],
  // notitie: enkel voor het bestuur. Verdwijnt met de lener bij de privacy-opruiming.
  // markering: waarom het bestuur deze lener tegenhoudt (bv. boek nog niet terug). Leeg: geen markering.
  // De balie ziet enkel dat er een markering is, nooit de reden.
  'Leners': ['lenersnummer', 'voornaam', 'achternaam', 'telefoon', 'email', 'datum_inschrijving', 'toestemming_privacy', 'actief', 'notitie', 'markering', 'markering_sinds'],
  'Uitleningen': [
    'uitlening_id', 'exemplaar', 'boek_id', 'lenersnummer', 'datum_uit', 'oorspronkelijke_vervaldatum',
    'vervaldatum', 'datum_terug', 'aantal_verlengingen', 'datum_verlenging', 'borg', 'betaalwijze_borg',
    'borg_terugbetaald', 'gift', 'laatste_herinnering', 'vrijwilliger', 'bron',
    // Hoe het boek terugkwam (in orde, licht beschadigd, beschadigd), met een opmerking.
    'staat_terug',
    // De vervaldatum voor de laatste verlenging: zo kan je een verlenging annuleren.
    'vorige_vervaldatum'
  ],
  'Reservaties': [
    'reservatie_id', 'boek_id', 'lenersnummer', 'datum_reservatie', 'status', 'exemplaar',
    'datum_klaar', 'ophalen_tot', 'datum_afgesloten', 'vrijwilliger'
  ],
  'Uitzonderingen': ['datum', 'wie', 'grens', 'lenersnummer', 'boek_id', 'exemplaar', 'reden', 'actie'],
  // overnemen: ja = het voorstel klopt, het script neemt het over (enkel bij de oude website, zie OudeBoeken.js).
  'Na te kijken': ['datum', 'bron', 'boek_id', 'titel', 'veld', 'waarde_catalogus', 'waarde_bron', 'opmerking', 'afgehandeld', 'sleutel', 'overnemen'],
  'Logboek': ['tijdstip', 'wie', 'actie', 'details'],
  // Online reserveren (Aanvragen.js). Bevat contactgegevens: nooit publiek.
  'Aanvragen': ['aanvraag_id', 'datum', 'boek_id', 'titel', 'voornaam', 'contact', 'opmerking', 'status', 'datum_afgehandeld', 'afgehandeld_door'],
  // Van vrijwilligers (Vrijwilligers.js): voorgestelde beschrijvingen en meldingen voor het bestuur.
  'Voorstellen': ['voorstel_id', 'datum', 'boek_id', 'titel', 'tekst', 'voorgesteld_door', 'status', 'behandeld_door', 'datum_behandeld'],
  'Meldingen': ['melding_id', 'datum', 'wie', 'soort', 'onderwerp', 'bericht', 'status', 'afgehandeld_door', 'datum_afgehandeld'],
  // Archief van de shifts: wie de bib openhield (bib) of back-up was, en gesloten avonden (Shifts.js).
  'Shifts': ['datum', 'rol', 'naam', 'event'],
  // Briefjes van vrijwilligers voor de volgende shift. Staan 14 dagen op Vandaag, gewist na briefjes_bewaren_dagen.
  'Briefjes': ['briefje_id', 'datum', 'wie', 'tekst', 'status', 'weg_door', 'datum_weg'],
  // Inhoud van de website. Kolommen op _en zijn de Engelse versie (mag leeg: dan toont de site het Nederlands).
  // online_vanaf: een bericht met een datum in de toekomst verschijnt pas op die dag.
  // voorgesteld_door: voornaam van de vrijwilliger die dit voorstelde. Leeg zodra het bestuur het online zet.
  'Nieuws': ['datum', 'titel', 'titel_en', 'tekst', 'tekst_en', 'afbeelding', 'link', 'publiek', 'online_vanaf', 'voorgesteld_door', 'bron_id'],
  'Agenda': ['datum', 'uur', 'titel', 'titel_en', 'tekst', 'tekst_en', 'locatie', 'afbeelding', 'link', 'publiek', 'voorgesteld_door', 'bron_id'],
  // Uitleg bij de vaste events (tekst_vaste_events): naam zoals daar, titel op de website, uur, plaats en tekst.
  'Vaste events': ['naam', 'titel', 'titel_en', 'uur', 'locatie', 'tekst', 'tekst_en', 'link', 'afbeelding'],
  'Veelgestelde vragen': ['volgorde', 'vraag', 'vraag_en', 'antwoord', 'antwoord_en', 'publiek', 'bron_id'],
  // Leeslijsten (thema's). Welke boeken erin staan, zet je in de kolom leeslijsten van de Catalogus.
  // zichtbaar_vanaf en zichtbaar_tot: een geplande lijst verschijnt en verdwijnt vanzelf.
  'Leeslijsten': ['volgorde', 'naam', 'naam_en', 'uitleg', 'uitleg_en', 'publiek', 'zichtbaar_vanaf', 'zichtbaar_tot'],
  // Verkoop op standjes (Verkoop.js). Een standje: voorbereiding, bezig of afgesloten.
  'Standjes': ['standje_id', 'naam', 'thema', 'datum', 'locatie', 'status', 'notitie'],
  'Standje boeken': ['standje_id', 'boek_id', 'mee', 'prijs', 'onderhandelbaar'],
  // verkoop_id maakt de gsm zelf (ook zonder internet): zo telt een verkoop nooit dubbel.
  'Verkopen': ['verkoop_id', 'standje_id', 'boek_id', 'aantal', 'prijs', 'betaalwijze', 'tijdstip', 'vrijwilliger'],
  // Boeken die de bib wil kopen (Aankoop.js). status: open of in catalogus. gekozen: ja als het bestuur het aanduidde.
  // Titels en auteurs nakijken in de bib (Titelcontrole.js).
  // Genres opkuisen: overzicht van de genres die een andere naam kregen (Genres.js).
  'Genres opkuisen': ['genre_vroeger', 'aantal_boeken', 'genre_nu'],
  // Gekozen namen en pseudoniemen (Auteursnamen.js). boeken: het script telt de boeken met die naam.
  'Auteursnamen': ['auteur', 'andere_namen', 'soort', 'boeken', 'opmerking'],
  'Auteurs aangepast': ['boek_id', 'titel', 'auteur_vroeger', 'auteur_nu', 'opmerking'],
  // Boeken zonder onderwerp waar het script twijfelt (OnderwerpRaden.js).
  'Categorieën en trefwoorden': ['naam', 'soort', 'aantal_boeken', 'zoekwoorden'],
  'Indeling': ['boek_id', 'titel', 'themas', 'categorieen', 'trefwoorden'],
  'Onderwerpen nakijken': ['boek_id', 'titel', 'auteur', 'genre', 'voorstel', 'onderwerp_nieuw', 'toepassen'],
  'Titelcontrole': ['boek_id', 'titel_nu', 'auteur_nu', 'titel_stock', 'auteur_stock', 'titel_oud', 'auteur_oud', 'status', 'wie', 'datum'],
  'Aankooplijst': ['aankoop_id', 'datum', 'titel', 'auteur', 'isbn', 'genre', 'prijs', 'link', 'reden', 'voorgesteld_door', 'status', 'gekozen', 'boek_id', 'datum_binnen', 'bron']
};

/** Kolommen met een getal. Staat er per ongeluk datumopmaak op, dan leest leesTabel toch het getal. */

// prijs: een nieuwe kolom erft soms de datumopmaak van de kolom ernaast. Dan wordt 7,50 de datum 6/1/1900 12:00.
var GETALKOLOMMEN = ['duur', 'jaartal', 'paginas', 'aantal', 'te_koop_aantal', 'mee', 'prijs'];

// wiki_gezocht staat er bewust niet bij: die datum bewaren we als tekst (zie herstelKolom in Wikipedia.js).
var DATUMKOLOMMEN = [
  'datum_inschrijving', 'markering_sinds', 'datum_uit', 'oorspronkelijke_vervaldatum', 'vervaldatum', 'datum_terug',
  'datum_verlenging', 'borg_terugbetaald', 'laatste_herinnering', 'datum_reservatie', 'datum_klaar',
  'ophalen_tot', 'datum_afgesloten', 'datum', 'ol_gecontroleerd', 'gb_gecontroleerd', 'toegevoegd_op', 'beschrijving_gezocht', 'beschrijving_vertaald', 'datum_afgehandeld', 'datum_behandeld', 'vorige_vervaldatum', 'datum_weg', 'cover_gezocht', 'bol_gezocht', 'ia_gezocht',
  'online_vanaf', 'zichtbaar_vanaf', 'zichtbaar_tot', 'datum_binnen'
];

/*
 * Achtergrondtaken (Wikipedia, vertalen, covers zoeken, ...) lopen tot 4,5 minuut. Hielden ze
 * al die tijd het slot vast, dan kregen de balie en het bestuur "Het is even druk".
 * Daarom:
 *   - startAchtergrond / stopAchtergrond: dezelfde taak loopt nooit twee keer tegelijk
 *     (een vlag in de cache, geen slot);
 *   - bewaarAchtergrond: neemt het slot enkel om te bewaren. Het leest het tabblad opnieuw in
 *     en schrijft enkel de velden die de taak aanpaste. Zo gaat niets verloren van wat
 *     iemand intussen aan de balie of in het bestuursscherm wijzigde.
 */
var ACHTERGROND_DUUR_SECONDEN = 6 * 60;

// Vijf blokken, van vaak naar zelden gebruikt: Uitlenen, Vrijwilligers, Website, Privacy, Techniek.
// De codes staan in Techniek, onderaan: zo staan ze niet meteen in beeld als je het tabblad opent.
var INSTELLING_GROEPEN = [
  ['Uitlenen', ['uitleentermijn_weken', 'verlengingstermijn_weken', 'max_verlengingen', 'verlengen_niet_bij_reservatie',
    'max_boeken_per_lener', 'waarschuwing_dagen_voor_vervaldatum', 'ophaaltermijn_openingsdagen', 'zines_te_koop_uitleenbaar']],
  ['Uitlenen: borg en giften', ['borg_per_boek', 'borg_betaalwijzen', 'gift_mogelijk']],
  ['Uitlenen: openingsdagen en -uren', ['openingsdagen', 'terugbrengdatum_op_openingsdag', 'gesloten_data', 'openingsuren', 'openingsuren_en']],
  ['Uitlenen: herinneringen', ['tekst_herinnering', 'tekst_herinnering_binnenkort']],
  ['Uitlenen: online reserveren', ['online_reserveren']],
  ['Vrijwilligers: shift', ['tekst_checklist_openen', 'tekst_checklist_sluiten', 'tekst_checklist_uitlenen']],
  ['Vrijwilligers: handleiding', ['tekst_handleiding', 'tekst_handleiding_en']],
  ['Vrijwilligers: rooster', ['rooster_link', 'tekst_vaste_events']],
  ['Website: contact', ['adres', 'mail_algemeen', 'mail_events']],
  ['Website: bereikbaarheid en toegankelijkheid', ['tekst_toegankelijkheid', 'tekst_toegankelijkheid_en']],
  ['Website: startpagina en aanraders', ['nieuw_op_startpagina_dagen', 'nieuw_op_startpagina_aantal', 'aanraders_uit_stocklijst', 'aanraders_verbergen']],
  ['Website: onderwerpen', ['eigen_themas', 'triggerwaarschuwingen_tonen']],
  ['Website: teksten bij Boeken', ['tekst_welkom', 'tekst_welkom_en', 'tekst_uitleg_lenen', 'tekst_uitleg_lenen_en', 'tekst_privacy', 'tekst_privacy_en']],
  ['Website: leeslijsten', ['leeslijsten_tonen']],
  ['Website: Doe mee', ['tekst_vrijwilliger', 'tekst_vrijwilliger_en', 'tekst_schenken', 'tekst_schenken_en', 'tekst_steunen', 'tekst_steunen_en']],
  ['Website: Antwerp Queer Bookclub', ['bookclub_naam', 'bookclub_week', 'bookclub_dag', 'bookclub_uur', 'tekst_bookclub', 'tekst_bookclub_en', 'bookclub_link']],
  ['Website: De Peperfabriek', ['peperfabriek_url', 'tekst_peperfabriek', 'tekst_peperfabriek_en', 'peperfabriek_aantal']],
  ['Website: films', ['films_tonen', 'tekst_films', 'tekst_films_en']],
  ['Privacy: bewaartermijnen', ['bewaartermijn_afgesloten_uitleningen_maanden', 'aanvragen_bewaren_dagen', 'meldingen_bewaren_dagen', 'briefjes_bewaren_dagen']],
  ['Techniek: toegang (codes)', ['toegangscode_balie', 'code_vrijwilliger', 'code_bestuur']],
  ['Techniek: koppeling met het rooster', ['rooster_url', 'rooster_code']],
  ['Techniek: boek- en filmgegevens aanvullen', ['goodreads_shelf', 'google_books_api_key', 'bol_client_id', 'bol_client_secret', 'cover_map', 'letterboxd_lijst']],
  ['Techniek: bezoekers van de website', ['goatcounter_code', 'goatcounter_api_sleutel']],
  ['Techniek: back-up', ['backup_map', 'backup_bewaren']]
];

var TABBLAD_GROEPEN = [
  ['#6b3597', ['Uitleningen', 'Reservaties', 'Aanvragen', 'Leners', 'Uitzonderingen', 'Meldingen', 'Briefjes']],      // uitlenen
  // collectie: eerst de tabbladen die je zelf invult, dan de nakijklijsten, dan de overzichten die het script maakt
  ['#ffcd30', ['Catalogus', 'Onderwerpen', 'Categorieën en trefwoorden', 'Voorstellen', 'Aankooplijst',
    'Na te kijken', 'Titels nakijken', 'Titelcontrole', 'Onderwerpen nakijken',
    'Indeling', 'Genres opkuisen', 'Auteurs aangepast', 'Auteursnamen']],
  ['#2a6f73', ['Nieuws', 'Agenda', 'Vaste events', 'Veelgestelde vragen', 'Leeslijsten']],       // website
  ['#d95f3b', ['Voorraad', 'Standjes', 'Standje boeken', 'Verkopen', 'Verkooplijst']],           // verkoop op standjes
  ['#1b1b1c', ['Instellingen', 'Logboek', 'Shifts']],                                      // beheer
  ['#bdbdbd', ['Stock', 'Zines', 'Films', 'Goodreads-export', 'Oud uitleenblad']]          // bronnen, zelden nodig
];
// Een nieuw tabblad van het script: zet het hier in de juiste groep, en maak het aan met maakTabblad (niet insertSheet).
// Dan staat het meteen op zijn plaats, met de kleur van de groep. Een test controleert dat elk tabblad een plaats heeft.

/**
 * Eén keer na een nieuwe indeling van TABBLAD_GROEPEN: de bestaande tabbladen op hun plaats zetten
 * (vanuit verwerkNieuweBoekenAutomatisch). TABBLADEN_VERSIE verhogen als de groepen veranderen.
 */
var TABBLADEN_VERSIE = '2026-11-05';

var OUDE_COVER_BRON = 'oude website';

var OUD_PER_PAGINA = 1000;          // zoveel rijen geeft Supabase hoogstens per vraag

var OUD_STANDAARD_MIN = 3;          // dezelfde cover bij zoveel boeken: een standaardafbeelding

var OUD_MAX_LOOPTIJD_MS = 4 * 60 * 1000; // ruim onder de 6 minuten die Google een taak geeft

var OUD_RONDE_SLEUTEL = 'oude_covers_ronde_start';

var CATEGORIE_SOORTEN = ['categorie', 'trefwoord', 'triggerwaarschuwing', 'weg'];

var CATEGORIE_KOLOM = { categorie: 'categorieen', trefwoord: 'trefwoorden', triggerwaarschuwing: 'triggerwaarschuwingen' };

/**
 * Eén keer na nieuwe thema's (bv. Coming-out, Kolonialisme): namen die nu een thema zijn, verhuizen uit de kolommen
 * categorieen en trefwoorden naar extra_onderwerpen, en verdwijnen uit het tabblad en de keuzelijsten.
 * Vanuit verwerkNieuweBoekenAutomatisch. THEMAS_VERSIE verhogen als er weer thema's bijkomen.
 */
var THEMAS_VERSIE = 'bib-2026-11d';

// Woorden in een naam die niets zeggen over wie het is.
var NAAM_STOPWOORDEN = ['van', 'der', 'den', 'het', 'von', 'and', 'een', 'etc', 'the', 'les', 'des', 'del', 'della', 'ter', 'ten'];

// Woorden die niets zeggen over welk boek het is (naast de lidwoorden).
var TITEL_STOPWOORDEN = ['van', 'and', 'en', 'of', 'in', 'op', 'the', 'een', 'novel', 'roman', 'met', 'for', 'voor'];

/**
 * Hoe gelijk zijn twee titels, van 0 tot 1. De hoogste van:
 *   - de kern (zonder ondertitel), en de volledige titel zonder nummers en auteursnaam;
 *   - dezelfde, zonder spaties ("killer condom" en "killerkondoom");
 *   - 0,9 als alle betekenisvolle woorden van de kortste titel in de langste staan (minstens twee):
 *     "House Rules" en "House of Rules", "Critical Reception of James Baldwin, 1963-2010" en "The Critical Reception of James Baldwin";
 *   - 0,82 als ze minstens twee woorden van 5 letters of meer delen ("Autobiography of Alice B. Toklas" en "De autobriografie van Alice B. Toklas").
 */
var GETALWOORDEN = { een: 1, one: 1, eins: 1, twee: 2, two: 2, drie: 3, three: 3, vier: 4, four: 4, vijf: 5, five: 5, zes: 6, six: 6, zeven: 7, seven: 7, acht: 8, eight: 8, negen: 9, nine: 9, tien: 10, ten: 10 };

var STANDAARD_HASHES_SLEUTEL = 'standaard_cover_hashes';

var STANDAARD_MIN = 3; // hetzelfde bestand bij zoveel boeken: een standaardafbeelding, geen echte cover

var OUDE_SITE = 'https://www.projectmadrigal.be/';

var PF_EIGENSCHAP = 'peperfabriek_programma';

var PF_MAX = 40;

var PF_MAANDEN = { jan: 1, feb: 2, maa: 3, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };

var ROOSTER_CACHE_SLEUTEL = 'rooster_v1';

var ROOSTER_CACHE_SECONDEN = 10 * 60;

var ROOSTER_LAATST_SLEUTEL = 'rooster_laatst';

var RANGWOORDEN = { eerste: 1, tweede: 2, derde: 3, vierde: 4, vijfde: 5, laatste: 5 };

var MAANDEN_KORT = ['jan', 'feb', 'maa', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

var SITE_CACHE_SLEUTEL = 'site_v9'; // v9: tekst voor de pagina Bereikbaarheid en toegankelijkheid

var SITE_MAX_NIEUWS = 6; // de startpagina toont er minstens 3, en meer als ze naast de agenda passen

var SITE_MAX_VOORBIJ = 20; // zoveel voorbije events kan een bezoeker openklikken

var SITE_MAX_AANRADERS = 12;

var LOGBOEK_REGELS = 60; // zoveel regels toont het bestuursscherm

var DAGLIMIET_SLEUTEL = 'daglimiet_urlfetch';

/*
 * De daglimiet van Google (UrlFetch): een gratis account mag per dag maar een beperkt aantal vragen
 * naar buiten sturen. De achtergrondtaken gebruiken er veel zolang er nog veel boeken op te zoeken zijn.
 * Is de limiet op, dan:
 *   - wacht elke taak 6 uur en gaat dan vanzelf verder (geen stilstaande taak meer);
 *   - telt een mislukte vraag nooit als "niets gevonden": het boek komt later opnieuw aan de beurt;
 *   - toont het rooster de laatst opgehaalde versie.
 */
var DAGLIMIET_WACHT_MS = 6 * 60 * 60 * 1000;

// Na de daglimiet krijgen de films voorrang: de andere taken herstarten een half uur later.
// Zo raakt de limiet niet opnieuw op voor de films aan de beurt zijn (die vragen maar weinig).
var VOORRANG_TAKEN = ['vulFilmsAan'];

var VOORRANG_MS = 30 * 60 * 1000;

var HUIDIGE_TAAK = ''; // de achtergrondtaak die nu loopt (zie startAchtergrond)

var BULK_VELDEN = ['genre', 'extra_onderwerpen', 'categorieen', 'trefwoorden', 'triggerwaarschuwingen', 'status', 'aanrader', 'startpagina',
  'publiek', 'uitleenbaar', 'te_koop', 'klassieker', 'leeslijsten'];

// Velden met een lijst (komma's): je kan er iets aan toevoegen of uit weghalen, zonder de rest te overschrijven.
var BULK_LIJSTEN = ['extra_onderwerpen', 'categorieen', 'trefwoorden', 'triggerwaarschuwingen', 'aanrader', 'leeslijsten'];

var TITELCONTROLE_TABBLAD = 'Titelcontrole';

var TITELCONTROLE_STATUSSEN = ['klopt', 'aangepast', 'niet in de kast'];

var CONTROLE_EN_WOORDEN = ['and', 'en', 'et', 'und'];

// Tussen twee auteurs: ; of & of "en" (and, et, und). Een komma hoort bij "Achternaam, Voornaam".
var CONTROLE_AUTEUR_SCHEIDING = /(\s*;\s*|\s*&\s*|\s+(?:en|and|et|und)\s+)/i;

var CONTROLE_TUSSENVOEGSELS = ['van', 'de', 'der', 'den', 'het', 'ten', 'ter', 'te', 'von', 'zu', 'la', 'le', 'du', 'da', 'di', 'del', 'des', 'dos', 'el', 'al', 'bin', 'ibn', 'mc'];

// Een verjaardageditie: "35th Anniversary Edition", "10th anniversary edition", "Anniversary Edition".
var CONTROLE_EDITIE = '(?:\\d+(?:st|nd|rd|th)\\s+)?anniversary\\s+edition';

// Een reeksaanduiding achter de titel: "XXX (Ype, #6)", "Zee (Verhalen #2)".
var CONTROLE_REEKS = /^(.*?)\s*\(([^()]*?)[,;]?\s*#\s*(\d+(?:[.,]\d+)?)\)\s*$/;

// Tussen titel en ondertitel: een dubbelpunt, een streepje met spaties, een punt of komma gevolgd door meer tekst,
// of iets tussen haakjes ("(Sinister Wisdom 102)").
var CONTROLE_ONDERTITEL = /\s*:\s*|\s+[-–—]\s+|\.\s+(?=\S)|\s*,\s+(?=\S)|\s+(?=\()/;

var TITEL_KLEIN_EN = ['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet', 'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs', 'with', 'from', 'into', 'onto', 'over', 'than'];

var TITEL_AFKORTINGEN = ['lgbt', 'lgbtq', 'lgbtqi', 'lgbtqia', 'lgbti', 'lhbt', 'lhbti', 'lhbtiq', 'aids', 'hiv', 'bdsm', 'usa', 'uk', 'vs', 'ok', 'dj', 'tv', 'nyc', 'ii', 'iii', 'iv', 'vi', 'vii', 'viii', 'ix', 'xi', 'xii'];

var TITEL_ZINSTALEN = ['Nederlands', 'Frans', 'Spaans', 'Italiaans', 'Portugees'];

var TITEL_WOORD = /[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’]*/g;

/*
 * De taal raden uit de titel. Google Books en Open Library zetten soms Engels bij een Nederlands of Frans boek.
 * Het script telt kleine woorden die typisch zijn voor een taal (het, een, van, les, und, ...). Woorden die in
 * meer talen voorkomen (de, en, die) tellen half. Korte titels zonder zulke woorden (Giovanni's Room) blijven
 * bij de taal uit de Catalogus.
 */
var TITEL_TAALWOORDEN = {
  Nederlands: ['het', 'een', 'van', 'voor', 'op', 'zijn', 'niet', 'naar', 'uit', 'als', 'wat', 'hoe', 'mijn', 'jouw', 'door', 'bij', 'tot', 'aan', 'ook', 'dat', 'geen', 'nooit', 'meer', 'nog', 'ik', 'wij', 'jij', 'zij', 'onze', 'ons', 'hun', 'wie', 'waar', 'waarom', 'wanneer', 'tussen', 'zonder', 'leven', 'liefde', 'verhalen', 'jongen', 'meisje', 'mannen', 'vrouwen'],
  Engels: ['the', 'of', 'and', 'to', 'with', 'for', 'my', 'your', 'his', 'her', 'our', 'their', 'is', 'are', 'how', 'what', 'why', 'who', 'from', 'about', 'when', 'this', 'that', 'you', 'we', 'they', 'it', 'not', 'an', 'be', 'love', 'life', 'story', 'stories', 'boy', 'girl', 'men', 'women', 'guide'],
  Frans: ['le', 'la', 'les', 'des', 'du', 'une', 'et', 'est', 'pour', 'dans', 'sur', 'au', 'aux', 'avec', 'sans', 'qui', 'ne', 'pas', 'mon', 'ma', 'mes', 'ses', 'amour', 'vie', 'fille', 'garçon', 'femmes', 'hommes'],
  Spaans: ['el', 'los', 'las', 'y', 'por', 'para', 'con', 'sin', 'mi', 'su', 'es', 'al', 'amor', 'vida', 'mujeres', 'hombres'],
  Duits: ['der', 'das', 'und', 'ein', 'eine', 'ist', 'mit', 'für', 'von', 'zu', 'im', 'auf', 'nicht', 'ich', 'wir', 'liebe', 'leben'],
  Italiaans: ['il', 'lo', 'gli', 'della', 'di', 'che', 'nel', 'nella', 'amore', 'vita'],
  Portugees: ['os', 'do', 'da', 'dos', 'um', 'uma', 'em', 'com', 'não', 'amor']
};

// Woorden die in meer talen voorkomen: elke taal krijgt een halve punt.
var TITEL_GEDEELD = { de: ['Nederlands', 'Frans', 'Spaans', 'Portugees'], en: ['Nederlands', 'Frans'], die: ['Nederlands', 'Duits'], den: ['Nederlands', 'Duits'], in: ['Nederlands', 'Engels', 'Duits', 'Italiaans'], un: ['Frans', 'Italiaans'], una: ['Spaans', 'Italiaans'], del: ['Spaans', 'Italiaans'], per: ['Italiaans'], e: ['Italiaans', 'Portugees'], o: ['Portugees'], a: ['Engels'], i: ['Engels'], que: ['Frans', 'Spaans', 'Portugees'], as: ['Engels', 'Portugees'], das: ['Duits', 'Portugees'], on: ['Engels'], no: ['Engels', 'Spaans', 'Portugees'], me: ['Engels', 'Spaans'], te: ['Nederlands', 'Spaans'], om: ['Nederlands'], er: ['Nederlands'], is: ['Engels', 'Nederlands'], was: ['Engels', 'Nederlands'], man: ['Engels', 'Nederlands'], met: ['Nederlands', 'Engels'], over: ['Nederlands', 'Engels'] };

var TITELS_TABBLAD = 'Titels nakijken';

var TITELS_KOLOMMEN = ['boek_id', 'taal', 'taal_nieuw', 'titel_nu', 'titel_nieuw', 'toepassen'];

var STATUS_WACHT = 'wacht';

var STATUS_KLAAR = 'klaar om op te halen';

var STATUS_AFGEHAALD = 'afgehaald';

var STATUS_VERVALLEN = 'vervallen';

var STATUS_GEANNULEERD = 'geannuleerd';

/* ---------- Opzoeken ---------- */

/**
 * Terugbrengen.
 * invoer: { uitlening_id, borg_terugbetaald: true/false }
 */
var STATEN_TERUG = ['in orde', 'licht beschadigd', 'beschadigd'];

var ANNULEREN_MAX_DAGEN = 7; // een vrijwilliger annuleert enkel uitleningen van de laatste 7 dagen

/*
 * Een lener markeren: het bestuur houdt een lener tegen, bv. omdat een boek al lang niet terug is.
 * Uitlenen en reserveren kunnen dan niet, tot het bestuur de markering weghaalt. De balie ziet een
 * neutrale, vriendelijke zin. De reden ziet enkel het bestuur.
 */
var MARKERING_TEKST = 'Voor deze lener kan je nu niets uitlenen of reserveren. Vraag vriendelijk om contact op te nemen met het bestuur. Je hoeft de reden niet te kennen.';

var STANDJE_STATUSSEN = ['voorbereiding', 'bezig', 'afgesloten'];

var VERKOOP_BESCHRIJVING_MAX = 400; // genoeg om een koper iets te vertellen, en klein genoeg voor de gsm zonder internet

var VOORRAAD_KOP = ['boek_id', 'titel', 'auteur', 'te koop', 'prijs', 'onderhandelbaar', 'waarde', 'verkocht', 'opbrengst'];

// Wijzig je een van deze kolommen in de Catalogus, dan schrijft het script de Voorraad opnieuw.
var VOORRAAD_BRON = ['te_koop_aantal', 'prijs', 'onderhandelbaar', 'titel', 'auteur'];

var VERKOOPLIJST_TABBLAD = 'Verkooplijst';

var VERKOOPLIJST_KOP = ['Titel', 'Auteur(s)', 'ISBN', 'Uitgeverij', 'Jaartal', 'Taal', 'Pagina\'s', 'Uitvoering', 'Nieuwstaat', 'Genre', 'Aantal', 'Prijs', 'verwerkt', 'opmerking'];

var VOORSTEL_NIEUW = 'nieuw';

var MELDING_NIEUW = 'nieuw';

var MELDING_SOORTEN = ['boek kapot', 'iets kwijt', 'vraag van een lener', 'wil iets kopen', 'andere'];

var VOORSTEL_MIN_TEKENS = 40;

/* ---------- Beschrijvingen voorstellen ---------- */

/**
 * Wat het draaiboek voor vrijwilligers toevoegt aan de checklists. Een punt komt er enkel bij als
 * geen bestaand punt het trefwoord al bevat.
 */
var DRAAIBOEK_CHECKLIST = {
  openen: [['sleutel', 'Sleutel op zak: geen sleutel? Vraag het op tijd in de vrijwilligersgroep', 'begin']],
  sluiten: [
    ['witte kast', 'Kassa met de borgen onder de witte kast, uit het zicht'],
    ['vuilbak', 'Vuilbakken leeg: restafval in de containers buiten, de pmd-zak in de keuken'],
    ['op 1', 'Verwarming terug op 1'],
    ['afgesloten', 'Lokaal goed afgesloten']
  ]
};

/** De veelgestelde vragen uit het draaiboek. bron_id voorkomt dubbels. */
var DRAAIBOEK_VRAGEN = [
  ['draaiboek-verlies', 'Wat als ik een boek verlies of beschadig?', 'What if I lose or damage a book?',
    'Dan vraagt de bib enkel de huidige waarde van het boek terug. Je mag ook zelf een vervangend exemplaar brengen.',
    'Then the library only asks you to pay the current value of the book. You are also welcome to bring a replacement copy yourself.'],
  ['draaiboek-borg', 'Wanneer krijg ik mijn borg niet terug?', 'When will I not get my deposit back?',
    'Je krijgt je borg terug als je de boeken in goede staat en op tijd terugbrengt. Vraag je geen verlenging en reageer je niet op de herinnering? Dan houdt de bib de borg in.',
    'You get your deposit back if you return the books in good condition and on time. If you do not ask for an extension and do not respond to the reminder, the library keeps your deposit.'],
  ['draaiboek-bollen', 'Wat betekent de rode of gele bol op een boek?', 'What does the red or yellow dot on a book mean?',
    'Een rode bol betekent dat je het boek niet kan lenen. Je mag het wel lezen in de bib tijdens de openingsuren. Een gele bol betekent dat het boek van Uitgeverij \'t Verschil of Kartonnen Dozen komt, of een persoonlijke aanrader is van Johanna Pas.',
    'A red dot means you cannot borrow the book. You are welcome to read it in the library during opening hours. A yellow dot means the book comes from \'t Verschil or Kartonnen Dozen, or is a personal recommendation from Johanna Pas.']
];

var BRIEFJE_ZICHTBAAR_DAGEN = 14; // daarna verdwijnt een briefje vanzelf van Vandaag

var MIJN_DAGEN = 60; // zo ver kijkt "Mijn voorstellen en meldingen" terug

var WIKI_TALEN = ['nl', 'en'];

var WIKI_PAUZE_MS = 500; // rustig zoeken: Wikipedia remt anders sneller af

var WIKI_MAX_LOOPTIJD_MS = 4.5 * 60 * 1000;

var ZOEK_OPNIEUW_COVER = ['cover_gezocht', 'bol_gezocht', 'ia_gezocht', 'gb_gecontroleerd', 'ol_gecontroleerd'];

var ZOEK_OPNIEUW_BESCHRIJVING = ['beschrijving_gezocht', 'wiki_gezocht', 'gb_gecontroleerd', 'ol_gecontroleerd'];

var ZOEK_OPNIEUW_FILM = ['film_gezocht'];

/* ==================== Functies, van A tot Z ==================== */

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

/** De acties van de aankooplijst (binnen het slot). */
function aankoopActie(actie, invoer, wie, rol) {
  var tabel = tabelOfLeeg('Aankooplijst');
  if (!tabel) return { ok: false, fout: 'Het tabblad Aankooplijst ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var catalogus = leesTabel('Catalogus').rijen;
  var vandaag = vandaagTekst();
  var r;
  if (actie === 'aankoopData') {
    // Boeken die intussen in de catalogus staan, vinken we meteen af.
    // En tekens zoals &#x27; die van bol.com meekwamen, maken we terug gewoon.
    var anders = aankoopBijwerken(tabel.rijen, catalogus, vandaag) + aankoopTekensHerstellen(tabel.rijen);
    if (anders) bewaarTabel(tabel);
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

/** Alle aanduidingen weg (bv. nadat de bestelling de deur uit is). */
function aankoopAllesUitvinken(rijen) {
  var n = 0;
  rijen.forEach(function (r) { if (jaNee(r.gekozen) === 'ja') { wijzig(r, { gekozen: '' }); n++; } });
  return { ok: true, tekst: n ? n + ' boeken zijn niet meer aangeduid.' : 'Er was niets aangeduid.' };
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

/** Een ISBN-13 uit invoer (ook ISBN-10 of met streepjes), of ''. */
function aankoopIsbn(waarde) {
  return normaliseerIsbn(waarde).isbn || '';
}

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

/** Een link mag enkel http(s) zijn. */
function aankoopLink(waarde) {
  var l = schoon(waarde);
  return /^https?:\/\/[^\s"'<>]+$/.test(l) ? l.slice(0, 400) : '';
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

/** Een prijs uit invoer: "12,99" of "€ 12,99" wordt 12.99. Leeg of ongeldig: ''. */
function aankoopPrijs(waarde) {
  var n = verkoopGetal(waarde);
  return n === null || n < 0 || n > 1000 ? '' : Math.round(n * 100) / 100;
}

/**
 * Rechtzetten wat van bol.com meekwam: tekens zoals &#x27; of &amp; terug naar gewone tekens, en een titel
 * als "Titel, Auteur | 9780374388416 | Boeken" gesplitst in titel, auteur, ISBN en genre.
 * Geeft het aantal aangepaste rijen.
 */
function aankoopTekensHerstellen(rijen) {
  var n = 0;
  rijen.forEach(function (r) {
    var velden = {};
    ['titel', 'auteur', 'genre'].forEach(function (k) {
      var w = String(r[k] || '');
      if (/&(#x?[0-9a-f]+|[a-z]+);/i.test(w)) velden[k] = htmlTekst(w);
    });
    var titel = velden.titel || String(r.titel || '');
    if (/\s\|\s/.test(titel)) {
      var b = bolTitelSplitsen({ titel: titel, auteur: velden.auteur || String(r.auteur || ''), isbn: aankoopIsbn(r.isbn), genre: velden.genre || String(r.genre || '') });
      velden.titel = b.titel; velden.auteur = b.auteur; velden.isbn = b.isbn; velden.genre = b.genre;
    }
    if (Object.keys(velden).length) { wijzig(r, velden); n++; }
  });
  return n;
}

/**
 * Een boek voorstellen. invoer: { titel, auteur, isbn, link, reden, genre?, prijs? }
 * Geeft { ok, tekst } of { ok: false, fout }.
 */
function aankoopToevoegen(rijen, catalogus, invoer, wie, vandaag, nieuwId, bron) {
  var boek = {
    titel: htmlTekst(tekstInvoer(invoer.titel, 200)), auteur: htmlTekst(tekstInvoer(invoer.auteur, 120)), isbn: aankoopIsbn(invoer.isbn),
    link: aankoopLink(invoer.link), reden: schoonMetRegels(invoer.reden).slice(0, 300),
    genre: htmlTekst(tekstInvoer(invoer.genre, 80)), prijs: aankoopPrijs(invoer.prijs)
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

/** Het bestuur verwijdert boeken van de lijst. invoer: { aankoop_id } of { ids: [...] } */
function aankoopVerwijderen(rijen, invoer) {
  var ids = [].concat(invoer.ids || []).concat(invoer.aankoop_id ? [invoer.aankoop_id] : []).map(String);
  var weg = rijen.filter(function (r) { return ids.indexOf(String(r.aankoop_id)) > -1; });
  if (!weg.length) return { ok: false, fout: 'Dit boek staat niet (meer) op de aankooplijst.' };
  weg.forEach(function (r) { r._verwijderen = true; });
  return { ok: true, tekst: weg.length === 1 ? '"' + schoon(weg[0].titel) + '" is verwijderd.' : weg.length + ' boeken zijn verwijderd.' };
}

/** Aantal exemplaren van een boek (een leeg veld telt als 1). */
function aantalExemplaren(boek) {
  var n = parseerGetal(boek.aantal);
  return n && n > 0 ? Math.round(n) : 1;
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

/** De achtergrondtaken: [functie, naam voor het scherm, welke boeken nog aan de beurt zijn]. */
function achtergrondTaken() {
  return [
    ['zoekBeschrijvingenWikipedia', 'Beschrijvingen bij Wikipedia', heeftWikiNodig],
    ['vulBeschrijvingenAan', 'Beschrijvingen aanvullen (Google, Open Library)', heeftBeschrijvingNodig],
    ['vertaalBeschrijvingen', 'Beschrijvingen vertalen naar het Engels', heeftVertalingNodig],
    ['vulAanUitGoogleBooks', 'Covers bij Google Books', heeftGoogleBooksNodig],
    ['vulAanUitOpenLibrary', 'Gegevens bij Open Library', heeftOpenLibraryNodig],
    ['zoekCoversAndereUitgaven', 'Covers van een andere uitgave', heeftAndereUitgaveNodig],
    ['zoekCoversInternetArchive', 'Covers bij Internet Archive', heeftIaNodig],
    ['zoekCoversBol', 'Covers bij Bol', heeftBolNodig],
    ['vulFilmsAan', 'Films aanvullen (Wikidata en Wikipedia)', heeftFilmGegevensNodig],
    ['kopieerOudeCovers', 'Covers van de oude website naar Drive', heeftOudeCoverNodig]
  ];
}

/**
 * Achternaam uit "Achternaam, Voornaam" of "Voornaam Achternaam", genormaliseerd,
 * zonder tussenvoegsel.
 * Bij meerdere auteurs (gescheiden door ; of &) nemen we de eerste.
 */
function achternaam(auteur) {
  var eerste = schoon(auteur).split(/;|&| en | and /)[0];
  // "van Babylon, Dirk" en "Babylon, Dirk van" geven allebei "babylon":
  // we nemen het laatste woord, zodat tussenvoegsels geen rol spelen.
  var delen = normaliseerTekst(eerste.indexOf(',') > -1 ? eerste.split(',')[0] : eerste).split(' ');
  return delen[delen.length - 1] || '';
}

/** Reservaties die nog lopen (wacht of klaar), in volgorde van de wachtrij. */
function actieveReservaties(staat, boekId) {
  return staat.reservaties.filter(function (r) {
    return r.boek_id === boekId && (r.status === STATUS_WACHT || r.status === STATUS_KLAAR);
  }).sort(function (a, b) {
    return String(a.datum_reservatie).localeCompare(String(b.datum_reservatie)) ||
      String(a.reservatie_id).localeCompare(String(b.reservatie_id));
  });
}

/* ---------- Nummers ---------- */

/**
 * Breedte en hoogte van een JPG, PNG of GIF, uit de eerste bytes. Geeft null als dat niet lukt.
 * bytes: lijst getallen (zoals Blob.getBytes(), mag negatief zijn).
 */
function afbeeldingAfmetingen(bytes) {
  var b = function (i) { return bytes[i] & 255; };
  if (!bytes || bytes.length < 24) return null;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) {           // PNG
    return { breedte: (b(16) << 24 | b(17) << 16 | b(18) << 8 | b(19)) >>> 0, hoogte: (b(20) << 24 | b(21) << 16 | b(22) << 8 | b(23)) >>> 0 };
  }
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) {                             // GIF
    return { breedte: b(6) | b(7) << 8, hoogte: b(8) | b(9) << 8 };
  }
  if (b(0) === 0xFF && b(1) === 0xD8) {                                              // JPG: zoek het SOF-blok
    var i = 2;
    while (i + 9 < bytes.length) {
      if (b(i) !== 0xFF) { i++; continue; }
      var soort = b(i + 1);
      if (soort >= 0xC0 && soort <= 0xCF && soort !== 0xC4 && soort !== 0xC8 && soort !== 0xCC) {
        return { hoogte: b(i + 5) << 8 | b(i + 6), breedte: b(i + 7) << 8 | b(i + 8) };
      }
      i += 2 + (b(i + 2) << 8 | b(i + 3));
    }
  }
  return null;
}

/** Zoekt in de HTML van een webpagina de afbeelding die de pagina zelf als voorbeeld geeft. */
function afbeeldingUitHtml(html, paginaUrl) {
  var patronen = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for (var i = 0; i < patronen.length; i++) {
    var m = String(html || '').match(patronen[i]);
    if (!m) continue;
    var link = m[1].replace(/&amp;/g, '&');
    if (/^\/\//.test(link)) link = 'https:' + link;
    else if (/^\//.test(link)) link = String(paginaUrl).replace(/^(https?:\/\/[^\/]+).*$/, '$1') + link;
    return link.replace(/^http:\/\//i, 'https://');
  }
  return '';
}

/** Alle lopende reservaties, met hun plaats in de wachtrij. */
function alleReservaties(staat) {
  var perBoek = {};
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_WACHT || r.status === STATUS_KLAAR) perBoek[r.boek_id] = true;
  });
  var lijst = [];
  Object.keys(perBoek).forEach(function (boekId) {
    actieveReservaties(staat, boekId).forEach(function (r, i) { lijst.push(reservatieInfo(staat, r, i + 1)); });
  });
  return lijst;
}

/** Alle thema's van de website: de vaste en de eigen. */
function alleThemas() {
  var uit = FILTERGROEPEN.slice();
  EIGEN_THEMAS.forEach(function (t) { if (!uit.some(function (f) { return normaliseerTekst(f) === normaliseerTekst(t); })) uit.push(schoon(t)); });
  return uit;
}

/** De originele titel, of '' als die dezelfde is als de titel (zonder hoofdletters, accenten en leestekens). */
function andereTitel(titel, origineel) {
  var o = schoon(origineel);
  return o && normaliseerTekst(o) !== normaliseerTekst(titel) ? o : '';
}

/** Een reservatie annuleren. Lag het boek al klaar, dan gaat het naar de volgende. */
function annuleerReservatie(staat, invoer) {
  var r = reservatieVan(staat, invoer.reservatie_id);
  if (!r) return { ok: false, fout: 'Deze reservatie bestaat niet.' };
  if (r.status !== STATUS_WACHT && r.status !== STATUS_KLAAR) return { ok: false, fout: 'Deze reservatie is al afgesloten.' };
  var lag = r.status === STATUS_KLAAR ? r.exemplaar : '';
  wijzig(r, { status: STATUS_GEANNULEERD, datum_afgesloten: staat.vandaag });
  staat.log.push(['reservatie geannuleerd', r.reservatie_id]);
  var melding = lag ? geefExemplaarDoor(staat, r.boek_id, lag) : null;
  return { ok: true, tekst: 'Reservatie geannuleerd.' + (lag && !melding ? ' Het boek mag terug in de kast.' : ''), apartLeggen: melding ? [melding] : [] };
}

/**
 * Een uitlening annuleren, bv. na een vergissing aan de balie. De uitlening verdwijnt, alsof ze
 * nooit gebeurde. Een reservatie die ze afsloot, gaat terug open. invoer: { uitlening_id }
 * magOud: het bestuur mag ook oudere uitleningen annuleren, een vrijwilliger enkel die van de laatste 7 dagen.
 */
function annuleerUitlening(staat, invoer, magOud) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht. Een teruggebracht boek annuleer je niet.' };
  var uit = parseerDatum(u.datum_uit);
  if (!magOud && uit && dagenTussen(uit, staat.vandaag) > ANNULEREN_MAX_DAGEN) {
    return { ok: false, fout: 'Deze uitlening is ouder dan ' + ANNULEREN_MAX_DAGEN + ' dagen. Breng het boek terug, of vraag het bestuur om ze te annuleren.' };
  }
  markeerVerwijderen(u);
  // Een reservatie die door deze uitlening afgesloten werd, gaat terug in de wachtrij.
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_AFGEHAALD && String(r.boek_id) === String(u.boek_id) && String(r.lenersnummer) === String(u.lenersnummer) &&
      parseerDatum(r.datum_afgesloten) === uit) {
      wijzig(r, { status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '' });
    }
  });
  // Het exemplaar is terug vrij: wacht er iemand op dit boek, dan ligt het voor die persoon apart.
  var m = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  if (m) meldingen.push(m);
  staat.log.push(['uitlening geannuleerd', u.uitlening_id + ' ' + u.exemplaar + ' (lener ' + u.lenersnummer + ', uit op ' + uit + ')']);
  var borg = Number(u.borg || 0), gift = Number(u.gift || 0);
  var geld = [borg > 0 ? 'de borg van ' + bedragTekst(borg) : '', gift > 0 ? 'de gift van ' + bedragTekst(gift) : ''].filter(Boolean);
  return { ok: true, apartLeggen: meldingen,
    tekst: 'De uitlening van "' + boekTitel(staat, u) + '" is geannuleerd.' + (geld.length ? ' Geef ' + geld.join(' en ') + ' terug.' : '') };
}

/** De laatste verlenging ongedaan maken: de vervaldatum van voor die verlenging komt terug. invoer: { uitlening_id } */
function annuleerVerlenging(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var aantal = Number(u.aantal_verlengingen || 0);
  if (aantal < 1) return { ok: false, fout: 'Deze uitlening werd niet verlengd.' };
  var vorige = parseerDatum(u.vorige_vervaldatum) || (aantal === 1 ? parseerDatum(u.oorspronkelijke_vervaldatum) : '');
  if (!vorige) return { ok: false, fout: 'De datum van voor de verlenging is niet bewaard. Vraag het bestuur om de vervaldatum aan te passen.' };
  var oud = parseerDatum(u.vervaldatum);
  wijzig(u, { vervaldatum: vorige, vorige_vervaldatum: '', aantal_verlengingen: aantal - 1, datum_verlenging: aantal - 1 ? u.datum_verlenging : '' });
  staat.log.push(['verlenging geannuleerd', u.uitlening_id + ' ' + u.exemplaar + ': ' + oud + ' wordt ' + vorige]);
  return { ok: true, tekst: 'De verlenging van "' + boekTitel(staat, u) + '" is geannuleerd. Het moet terug tegen ' + datumTekst(vorige, staat.vandaag) + '.', vervaldatum: vorige };
}

/**
 * Reserveren: zet een lener in de wachtrij voor een boek.
 * invoer: { boek_id, lenersnummer }
 */

function apartLeggenMelding(staat, r) {
  return {
    reservatie_id: r.reservatie_id, exemplaar: r.exemplaar, lenersnummer: r.lenersnummer,
    tekst: 'Leg dit boek apart voor lener ' + lenerNaam(staat, r.lenersnummer),
    ophalen_tot: r.ophalen_tot,
    ophalenTekst: 'Ligt klaar tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
  };
}

/** "Mira Verbeek" wordt "Verbeek, Mira", zoals de rest van de catalogus. */
function auteurAchternaamEerst(naam) {
  var n = schoon(naam);
  if (!n || n.indexOf(',') > -1) return n;
  var delen = n.split(' ');
  if (delen.length < 2) return n;
  return delen.pop() + ', ' + delen.join(' ');
}

/**
 * Wat de Catalogus weet: de voornamen (elk woord en de volledige voornaam) en de achternamen uit alle namen
 * met een komma. Geeft { voornaam: { woord: true }, achternaam: { woord: true } }.
 */
function auteurKennis(catalogus) {
  var k = { voornaam: {}, achternaam: {} };
  (catalogus || []).forEach(function (b) {
    if (isFilm(b)) return;
    String(b.auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
      if (i % 2) return;
      var m = schoon(deel).match(/^([^,]+),\s*([^,]+)/);
      if (!m) return;
      var voor = schoon(m[2]).split(' ').filter(function (w) {
        return w && !AUTEUR_INITIALEN.test(w) && CONTROLE_TUSSENVOEGSELS.indexOf(w.toLowerCase()) === -1;
      });
      voor.forEach(function (w) { k.voornaam[normaliseerTekst(w)] = true; });
      if (voor.length) k.voornaam[normaliseerTekst(voor.join(' '))] = true;
      normaliseerTekst(m[1]).split(' ').forEach(function (w) { if (w) k.achternaam[w] = true; });
    });
  });
  return k;
}

/** Het hele veld netjes. kennis: zie auteurKennis (zonder kennis draait het script enkel om wat zeker is). */
function auteurNetjes(auteur, kennis) {
  return auteurNetjesInfo(auteur, kennis).tekst;
}

/** Het hele veld. Geeft { tekst, nietZeker: [namen] }. */
function auteurNetjesInfo(auteur, kennis) {
  var veld = schoon(auteur).replace(/&(?=\S)/g, '& ');
  var uit = { tekst: veld, nietZeker: [] };
  if (!veld) return uit;
  if (!/;|&|\s(en|and|et|und)\s/i.test(veld) && isKommaLijst(veld, kennis)) veld = veld.split(',').map(schoon).filter(Boolean).join(' & ');
  var namen = [], gezien = [];
  veld.split(CONTROLE_AUTEUR_SCHEIDING).forEach(function (deel, i) {
    if (i % 2 || !schoon(deel)) return;
    var r = eenAuteurNetjes(deel, kennis);
    if (!r.zeker) uit.nietZeker.push(r.naam);
    var k = controleAuteurSleutel(r.naam);
    if (gezien.indexOf(k) > -1) return;
    gezien.push(k);
    namen.push(r.naam);
  });
  uit.tekst = namen.join(' & ');
  return uit;
}

/**
 * Delen twee auteurs een naam? De achternaam van de ene moet een van de namen van de andere zijn:
 * zo telt "Sappho" en "Lesbos, Sappho van", en "Chagoll Lydia" en "Chagoll, Lydia", maar niet
 * twee verschillende mensen met dezelfde voornaam.
 */
function auteursDelen(a, b) {
  var wa = auteurWoorden(a), wb = auteurWoorden(b);
  var past = function (namen, woorden) { return namen.some(function (n) { return woorden.some(function (w) { return oudZelfdeNaam(n, w); }); }); };
  if (past(oudeAchternamen(a), wb) || past(oudeAchternamen(b), wa)) return true;
  // Aan elkaar geschreven: "Jane DeLynn" en "Lynn, Jane De" (alle letters van de naam, in alfabetische volgorde).
  var letters = function (x) { return normaliseerTekst(x).replace(/ /g, '').split('').sort().join(''); };
  return !!normaliseerTekst(a) && !/[;&\/]/.test(a + b) && letters(a).length >= 8 && letters(a) === letters(b);
}

/** Vanzelf, elk uur (vanuit verwerkNieuweBoekenAutomatisch). Schrijft enkel als er iets verandert. */
function auteursnamenAutomatisch() {
  var uit = auteursnamenUitvoeren();
  if (uit.vervangen || uit.zoeknamen) logboek('systeem', 'auteursnamen', auteursnamenTekst(uit));
}

/** Menu: Titels en auteurs > Auteursnamen: pas gekozen namen en pseudoniemen toe. */
function auteursnamenMenu() {
  var tekst = auteursnamenTekst(auteursnamenUitvoeren());
  logboek('menu', 'auteursnamen', tekst);
  meld(tekst);
}

/** De rijen uit AUTEURSNAMEN_STANDAARD die nog niet in het tabblad staan (zelfde getoonde naam). */
function auteursnamenOntbrekend(rijen) {
  var er = {};
  (rijen || []).forEach(function (r) { er[controleAuteurSleutel(r.auteur)] = true; });
  return AUTEURSNAMEN_STANDAARD.filter(function (r) { return !er[controleAuteurSleutel(r.auteur)]; });
}

/** De rijen van het tabblad als regels: [{ toon, pseudoniem, namen: [{ naam, sleutel }] }]. namen[0] is de getoonde naam. */
function auteursnamenRegels(rijen) {
  var uit = [];
  (rijen || []).forEach(function (r) {
    var toon = schoon(r.auteur);
    if (!toon) return;
    var namen = [{ naam: toon, sleutel: controleAuteurSleutel(toon) }];
    String(r.andere_namen || '').split(/\s*[;\n]\s*/).forEach(function (n) {
      n = schoon(n);
      var s = controleAuteurSleutel(n);
      if (n && s && !namen.some(function (x) { return x.sleutel === s; })) namen.push({ naam: n, sleutel: s });
    });
    if (namen.length < 2) return;
    uit.push({ toon: toon, pseudoniem: /pseudo/i.test(String(r.soort || '')), namen: namen });
  });
  return uit;
}

function auteursnamenTekst(uit) {
  return uit.vervangen + ' boeken kregen de gekozen naam van de auteur, bij ' + uit.zoeknamen +
    ' boeken veranderden de namen om op te zoeken. De kolom boeken in het tabblad ' + AUTEURSNAMEN_TABBLAD + ' toont per naam hoeveel boeken er zijn.';
}

/**
 * Past het tabblad toe op de Catalogus (wijzig). Ook films.
 * Geeft { vervangen: boeken met een andere auteur, zoeknamen: boeken met andere zoeknamen, perRegel: [aantal boeken] }.
 */
function auteursnamenToepassen(catalogus, rijen) {
  var regels = auteursnamenRegels(rijen);
  var uit = { vervangen: 0, zoeknamen: 0, perRegel: regels.map(function () { return 0; }) };
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var r = auteursnamenVervang(b.auteur, regels);
    r.regels.forEach(function (i) { uit.perRegel[i]++; });
    var velden = {};
    if (!isLeeg(b.auteur) && r.tekst !== String(b.auteur)) { velden.auteur = r.tekst; uit.vervangen++; }
    var zoek = r.zoek.join('; ');
    if (zoek !== schoon(b.auteur_zoeknamen)) { velden.auteur_zoeknamen = zoek; uit.zoeknamen++; }
    if (Object.keys(velden).length) wijzig(b, velden);
  });
  return uit;
}

/** Doet het werk in de spreadsheet. Geeft het resultaat van auteursnamenToepassen. */
function auteursnamenUitvoeren() {
  zorgVoorTabbladen(['Catalogus', AUTEURSNAMEN_TABBLAD]);
  var eigenschappen = PropertiesService.getScriptProperties();
  var tab = leesTabel(AUTEURSNAMEN_TABBLAD);
  // Eén keer: de voorbeelden van het bestuur erin. Haal je er later een weg, dan komt die niet terug.
  if (eigenschappen.getProperty('auteursnamen_standaard') !== AUTEURSNAMEN_STANDAARD_VERSIE) {
    var erbij = auteursnamenOntbrekend(tab.rijen);
    if (erbij.length) {
      var start = tab.blad.getLastRow() + 1;
      tab.blad.getRange(start, 1, erbij.length, tab.kop.length).setValues(erbij.map(function (r) { return rijNaarWaarden(tab.kop, r); }));
      tab = leesTabel(AUTEURSNAMEN_TABBLAD);
    }
    eigenschappen.setProperty('auteursnamen_standaard', AUTEURSNAMEN_STANDAARD_VERSIE);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    uit = auteursnamenToepassen(catalogus.rijen, tab.rijen);
    if (uit.vervangen || uit.zoeknamen) schrijfKolommen(catalogus, ['auteur', 'auteur_zoeknamen']);
  } finally {
    lock.releaseLock();
  }
  // Per rij in het tabblad: bij hoeveel boeken de naam voorkomt.
  var kolBoeken = tab.kop.indexOf('boeken');
  if (kolBoeken > -1) {
    var i = 0;
    tab.rijen.forEach(function (r) {
      if (!auteursnamenRegels([r]).length) return;
      var n = uit.perRegel[i++];
      if (String(r.boeken) !== String(n)) tab.blad.getRange(r._rij, kolBoeken + 1).setValue(n);
    });
  }
  if (uit.vervangen || uit.zoeknamen) leegCache();
  return uit;
}

/**
 * Past de regels toe op één auteursveld (meer auteurs met ; of & ertussen).
 * Geeft { tekst, zoek: [namen om op te zoeken], regels: [indexen van de regels die pasten] }.
 */
function auteursnamenVervang(auteur, regels) {
  var delen = String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING);
  var zoek = [], gepast = [];
  var voegToe = function (naam) { if (zoek.indexOf(naam) === -1) zoek.push(naam); };
  for (var i = 0; i < delen.length; i += 2) {
    var sleutel = controleAuteurSleutel(delen[i]);
    if (!sleutel) continue;
    for (var r = 0; r < regels.length; r++) {
      var regel = regels[r];
      var j = -1;
      regel.namen.forEach(function (n, k) { if (j === -1 && n.sleutel === sleutel) j = k; });
      if (j === -1) continue;
      if (gepast.indexOf(r) === -1) gepast.push(r);
      if (regel.pseudoniem) {
        // De naam op het boek blijft. De andere namen van dezelfde auteur zijn zoekbaar.
        regel.namen.forEach(function (n, k) { if (k !== j) voegToe(n.naam); });
      } else {
        // Een vroegere naam: de gekozen naam in de plaats. De vroegere namen blijven zoekbaar, nooit zichtbaar.
        var voor = delen[i].match(/^\s*/)[0], na = delen[i].match(/\s*$/)[0];
        delen[i] = voor + regel.toon + na;
        regel.namen.forEach(function (n, k) { if (k > 0) voegToe(n.naam); });
      }
      break;
    }
  }
  return { tekst: delen.join(''), zoek: zoek, regels: gepast };
}

/**
 * Zet alle auteurs in de Catalogus netjes. herstel: { boek_id: { vroeger, nu } } uit het tabblad Auteurs aangepast
 * van een vorige keer: staat de auteur nog zoals het script ze toen zette, dan vertrekt het opnieuw van vroeger.
 * Geeft [{ boek_id, titel, auteur_vroeger, auteur_nu, opmerking }].
 */
function auteursOpkuisen(catalogus, herstel) {
  // De kennis uit de oorspronkelijke namen: een naam die een vorige keer verkeerd omgedraaid werd ("Amsterdam, COC"),
  // mag het script niet leren als voornaam.
  var kennis = auteurKennis(catalogus.map(function (b) {
    var h = herstel && herstel[String(b.boek_id)];
    return h && h.vroeger && schoon(h.nu) === schoon(b.auteur) ? { soort: b.soort, auteur: h.vroeger } : b;
  }));
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.auteur) || isFilm(b)) return;
    var h = herstel && herstel[String(b.boek_id)];
    var vroeger = h && h.vroeger && schoon(h.nu) === schoon(b.auteur) ? schoon(h.vroeger) : schoon(b.auteur);
    var r = auteurNetjesInfo(vroeger, kennis);
    var opmerking = r.nietZeker.length ? AUTEUR_NIET_ZEKER + ': ' + r.nietZeker.join(', ') : '';
    if (r.tekst === schoon(b.auteur) && !opmerking) return;
    uit.push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur_vroeger: vroeger, auteur_nu: r.tekst, opmerking: opmerking });
    if (r.tekst !== schoon(b.auteur)) wijzig(b, { auteur: r.tekst });
  });
  return uit;
}

/** Vanzelf, één keer per dag (vanuit verwerkNieuweBoekenAutomatisch). */
function auteursOpkuisenAutomatisch() {
  var eigenschappen = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  // Versie 2: de fouten van de eerste versie meteen herstellen, ook als die vandaag al liep.
  if (eigenschappen.getProperty('auteurs_laatst') === vandaag + ' v2') return;
  eigenschappen.setProperty('auteurs_laatst', vandaag + ' v2');
  var uit = auteursOpkuisenUitvoeren();
  if (uit.veranderd) logboek('systeem', 'auteursOpkuisen', auteursTekst(uit));
}

/** Menu: Titels en auteurs > Auteurs: zet alles in de vorm Achternaam, Voornaam. */
function auteursOpkuisenMenu() {
  var tekst = auteursTekst(auteursOpkuisenUitvoeren());
  // Enkel de aantallen: wat veranderde, staat in het tabblad.
  logboek('menu', 'auteursOpkuisen', tekst);
  meld(tekst);
}

/** Doet het werk in de spreadsheet. Geeft de rijen van het tabblad. */
function auteursOpkuisenUitvoeren() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit, veranderd = 0;
  try {
    var catalogus = leesTabel('Catalogus');
    // Wat een vorige keer veranderde (ook de fouten van de eerste versie): opnieuw bekijken vanaf de oorspronkelijke naam.
    var herstel = {};
    var blad = spreadsheet().getSheetByName(AUTEURS_TABBLAD);
    if (blad && blad.getLastRow() > 1) {
      leesTabel(AUTEURS_TABBLAD).rijen.forEach(function (r) {
        if (!isLeeg(r.boek_id) && !isLeeg(r.auteur_vroeger)) herstel[String(r.boek_id)] = { vroeger: r.auteur_vroeger, nu: r.auteur_nu };
      });
    }
    var voor = {};
    catalogus.rijen.forEach(function (b) { voor[String(b.boek_id)] = schoon(b.auteur); });
    uit = auteursOpkuisen(catalogus.rijen, herstel);
    veranderd = uit.filter(function (r) { return r.auteur_nu !== voor[r.boek_id]; }).length;
    if (veranderd) schrijfKolommen(catalogus, ['auteur']);
  } finally {
    lock.releaseLock();
  }
  zorgVoorTabbladen([AUTEURS_TABBLAD]);
  var tab = spreadsheet().getSheetByName(AUTEURS_TABBLAD);
  var kop = KOLOMMEN[AUTEURS_TABBLAD];
  tab.clear();
  var waarden = [kop].concat(uit.map(function (r) { return kop.map(function (k) { return r[k]; }); }));
  tab.getRange(1, 1, waarden.length, kop.length).setValues(waarden);
  opmaakKop(tab, kop.length);
  if (veranderd) leegCache();
  uit.veranderd = veranderd;
  return uit;
}

function auteursTekst(uit) {
  var nz = uit.filter(function (r) { return r.opmerking; }).length;
  return uit.veranderd + ' auteurs in de vorm "Achternaam, Voornaam" gezet. ' +
    (nz ? nz + ' namen zijn niet zeker en bleven staan: die staan in het tabblad ' + AUTEURS_TABBLAD + ' met "niet zeker". ' : '') +
    'Het tabblad ' + AUTEURS_TABBLAD + ' toont wat veranderde.';
}

/** Alle woorden van de auteurs (vanaf 3 letters): "Lesbos, Sappho van" geeft ["lesbos", "sappho"]. */
function auteurWoorden(auteur) {
  return normaliseerTekst(auteur).split(' ').filter(function (w) { return w.length >= 3 && NAAM_STOPWOORDEN.indexOf(w) === -1 && !/^\d+$/.test(w); });
}

/** De namen om op te zoeken van een boek (kolom auteur_zoeknamen), als lijst. */
function auteurZoeknamen(rij) {
  return String((rij && rij.auteur_zoeknamen) || '').split(/\s*;\s*/).map(schoon).filter(function (x) { return x; });
}

/** De map voor de back-ups. Bestaat ze nog niet, dan maken we ze. */
function backupMap(naam) {
  var mappen = DriveApp.getFoldersByName(naam);
  return mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
}

/** De naam van een back-up: "Madrigal back-up 2026-10-24". */
function backupNaam(vandaag) {
  return BACKUP_VOORVOEGSEL + vandaag;
}

/** Korte lijst van alle boeken voor het uitleenscherm, ook de niet-publieke. */
function baliecatalogus(staat, vertaal) {
  return staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && !isLeeg(b.titel); }).map(function (b) {
    var info = {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), i: schoon(b.isbn),
      x: aantalExemplaren(b), u: isUitleenbaar(b), c: !isLeeg(b.cover_url)
    };
    // ll: de leeslijsten van het boek, voor het onderdeel Leeslijsten van het bestuursscherm.
    var ll = splitsLijst(b.leeslijsten);
    if (ll.length) info.ll = ll;
    // az: vroegere namen en pseudoniemen van de auteur, enkel om op te zoeken (Auteursnamen.js).
    var az = auteurZoeknamen(b);
    if (az.length) info.az = az;
    // g: de onderwerpen (filtergroepen), enkel voor het bestuursscherm (filter bij Leeslijsten).
    if (vertaal) {
      var g = filtergroepenVan(b, vertaal);
      if (g.length) info.g = g;
      // zb: zonder beschrijving, voor de lijst Boeken zonder beschrijving van het bestuursscherm.
      if (isLeeg(b.beschrijving)) info.zb = true;
    }
    // f: een film. Het bestuursscherm toont films in een eigen onderdeel.
    if (isFilm(b)) info.f = 1;
    // st: zodat de vrijwilliger het weet. Gevoelig (verborgen of zichtbaar) mag je gewoon uitlenen.
    var status = boekStatus(b);
    if (status === 'verloren') info.st = 'verloren';
    else if (status) info.st = 'gevoelig';
    return info;
  });
}

/** Gegevens voor het uitleenscherm. */
function balieGegevens(staat) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, false); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    instellingen: {
      borg_per_boek: staat.inst.borg_per_boek,
      borg_betaalwijzen: staat.inst.borg_betaalwijzen,
      gift_mogelijk: staat.inst.gift_mogelijk,
      max_boeken_per_lener: staat.inst.max_boeken_per_lener,
      verlengingstermijn_weken: staat.inst.verlengingstermijn_weken,
      checklist_uitlenen: checklistPunten(staat.inst.tekst_checklist_uitlenen)
    },
    privacy: staat.inst.tekst_privacy,
    privacy_en: staat.inst.tekst_privacy_en,
    boeken: baliecatalogus(staat),
    leners: staat.leners.filter(function (l) { return jaNee(l.actief) !== 'nee'; }).map(function (l) {
      // m: de lener is gemarkeerd. Enkel dat, nooit de reden.
      return isGemarkeerd(l) ? { n: l.lenersnummer, v: l.voornaam, m: 1 } : { n: l.lenersnummer, v: l.voornaam };
    }),
    lopend: lopend,
    reservaties: alleReservaties(staat)
  };
}

/** Bedrag: een getal van 0 tot 1000, afgerond op centen. Geeft null bij ongeldige invoer. */
function bedragInvoer(waarde) {
  if (isLeeg(waarde)) return 0;
  var n = parseerGetal(waarde);
  if (n === null || n < 0 || n > 1000) return null;
  return Math.round(n * 100) / 100;
}

function bedragTekst(n) {
  var b = Number(n || 0);
  return (b % 1 === 0 ? String(b) : b.toFixed(2).replace('.', ',')) + ' euro';
}

/**
 * Controleert de grenzen. Zijn er overschreden en is er geen reden opgegeven,
 * dan geeft dit het antwoord terug dat de schermen een reden moeten vragen.
 * Met een reden worden de uitzonderingen genoteerd en geeft dit null terug.
 */
function behandelGrenzen(staat, actie, ctx, invoer) {
  ctx.staat = staat;
  ctx.inst = staat.inst;
  ctx.vandaag = staat.vandaag;
  var overschreden = controleerGrenzen(actie, ctx);
  if (!overschreden.length) return null;
  var reden = invoer.uitzondering ? tekstInvoer(invoer.uitzondering.reden, 300) : '';
  if (reden.length < 3) return { ok: false, grenzen: overschreden };
  overschreden.forEach(function (g) {
    staat.uitzonderingen.push({
      datum: staat.vandaag, wie: staat.wie, grens: g.naam,
      lenersnummer: ctx.lener ? ctx.lener.lenersnummer : (ctx.uitlening ? ctx.uitlening.lenersnummer : ''),
      boek_id: ctx.boek ? ctx.boek.boek_id : '',
      exemplaar: ctx.exemplaar || (ctx.uitlening ? ctx.uitlening.exemplaar : ''),
      reden: reden, actie: actie
    });
  });
  return null;
}

/* ---------- Reservaties doorgeven ---------- */

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

/** Een boek zoals het beheerscherm het toont. */
function beheerBoek(rij) {
  var boek = { boek_id: String(rij.boek_id) };
  BEHEER_BOEKVELDEN.forEach(function (v) { boek[v] = isLeeg(rij[v]) ? '' : rij[v]; });
  boek.status = boekStatus(rij).replace('_', ' ');
  boek.toegevoegd_op = rij.toegevoegd_op || '';
  return boek;
}

/** Bewaart een wijziging in Nieuws, Agenda, Veelgestelde vragen of Leeslijsten. */
function beheerInhoudBewaren(invoer, wie, rol) {
  if (!BEHEER_INHOUD[invoer.tabblad]) return { ok: false, fout: 'Onbekend tabblad.' };
  var tabel = leesTabel(invoer.tabblad);
  var oud = invoer.rij ? tabel.rijen.filter(function (r) { return r._rij === Number(invoer.rij); })[0] : null;
  var oudeNaam = oud ? schoon(oud.naam) : '';
  var antwoord = inhoudAanpassen(tabel.rijen, invoer, rol && rol !== 'bestuur' ? (wie || 'vrijwilliger') : '');
  if (antwoord.ok) {
    if (tabel.kop.indexOf('voorgesteld_door') === -1 && tabel.rijen.some(function (r) { return r.voorgesteld_door; })) {
      return { ok: false, fout: 'De kolom voorgesteld_door ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
    }
    bewaarTabel(tabel);
    logboek(wie, 'website aangepast', invoer.tabblad);
    // Een leeslijst hernoemd of verwijderd: ook de boeken in de Catalogus aanpassen.
    if (invoer.tabblad === 'Leeslijsten' && oudeNaam) {
      var nieuweNaam = invoer.verwijderen ? '' : schoon(oud.naam);
      if (nieuweNaam !== oudeNaam) {
        var cat = leesTabel('Catalogus');
        var n = hernoemLeeslijst(cat.rijen, oudeNaam, nieuweNaam);
        if (n) bewaarTabel(cat);
      }
    }
  }
  return antwoord;
}

/* ---------- Leeslijsten: boeken kiezen ---------- */

/**
 * Gegevens voor de onderdelen Nieuws en agenda, Leeslijsten, en Teksten en instellingen.
 * Een vrijwilliger krijgt enkel Nieuws, Agenda en Leeslijsten, en van de instellingen enkel leeslijsten_tonen.
 */
function beheerInhoudGegevens(rol) {
  var vrijwilliger = rol && rol !== 'bestuur';
  var uit = { tabbladen: {} };
  Object.keys(BEHEER_INHOUD).forEach(function (naam) {
    if (vrijwilliger && VRIJWILLIGER_INHOUD.indexOf(naam) === -1) return;
    uit.tabbladen[naam] = spreadsheet().getSheetByName(naam) ? inhoudRijen(naam, leesTabel(naam).rijen) : [];
  });
  var groepen = instellingenVoorBeheer(leesTabel('Instellingen').rijen);
  if (vrijwilliger) {
    groepen = groepen.map(function (g) {
      return { titel: g.titel, instellingen: g.instellingen.filter(function (i) { return i.sleutel === 'leeslijsten_tonen'; }) };
    }).filter(function (g) { return g.instellingen.length; });
  }
  uit.instellingen = groepen;
  return { ok: true, data: uit };
}

/** Bewaart een instelling. */
function beheerInstellingBewaren(invoer, wie) {
  var tabel = leesTabel('Instellingen');
  var antwoord = instellingAanpassen(tabel.rijen, invoer);
  if (antwoord.ok) {
    bewaarTabel(tabel);
    logboek(wie, 'instelling aangepast', schoon(invoer.sleutel));
  }
  return antwoord;
}

/* ---------- Covers zoeken via de browser van het bestuur ---------- */

/*
 * Google Books en Open Library weigeren vaak vragen vanuit Apps Script: die komen van servers
 * van Google, die veel andere scripts delen. Daarom vraagt de browser van het bestuur de covers
 * op, en bewaart het script wat gevonden is. De browser krijgt daarvoor de google_books_api_key: enkel wie de code van het bestuur
 * heeft, ziet die. Beperk de sleutel in de Google Cloud Console tot de Books API.
 */

/** Maakt één ingevuld veld netjes. Geeft { waarde } of { fout }. */
function beheerVeld(veld, ruw) {
  if (BEHEER_LANG.indexOf(veld) > -1) return { waarde: String(ruw === undefined || ruw === null ? '' : ruw).trim().slice(0, 5000) };
  var w = tekstInvoer(ruw, 300);
  if (BEHEER_JANEE.indexOf(veld) > -1) return { waarde: jaNee(w) };
  if (veld === 'soort') return { waarde: soortVan({ soort: w }) };
  if (veld === 'status') {
    var s = boekStatus({ status: w });
    if (w && !s) return { fout: 'Kies als status: leeg, ' + BOEKSTATUSSEN.join(', ') + '.' };
    return { waarde: s ? s.replace('_', ' ') : '' };
  }
  if (veld === 'isbn') {
    if (!w) return { waarde: '' };
    var isbn = normaliseerIsbn(w);
    return { waarde: isbn.isbn || isbn.issn || w };
  }
  if (veld === 'cover_url' || veld === 'afbeelding' || veld === 'link') {
    if (w && !veiligeCoverUrl(w)) return { fout: 'Een link moet beginnen met https://' };
    return { waarde: w };
  }
  if (veld === 'jaartal' || veld === 'paginas' || veld === 'aantal' || veld === 'volgorde' || veld === 'duur') {
    if (!w) return { waarde: '' };
    var n = parseerGetal(w);
    if (n === null || n < 0 || n !== Math.round(n)) return { fout: 'Vul bij ' + veld + ' een geheel getal in.' };
    return { waarde: n };
  }
  if (veld === 'datum' || veld === 'online_vanaf' || veld === 'zichtbaar_vanaf' || veld === 'zichtbaar_tot') {
    if (!w) return { waarde: '' };
    var d = parseerDatum(w);
    if (!d) return { fout: 'Deze datum klopt niet. Schrijf ze als 20/11/2026.' };
    return { waarde: d };
  }
  if (veld === 'taal') return { waarde: normaliseerTaal(w) || w };
  if (veld === 'uitvoering') return { waarde: normaliseerUitvoering(w) || w };
  return { waarde: w };
}

/** Zet de ingevulde velden om. Enkel toegelaten velden. Geeft { velden } of { fout }. */
function beheerVelden(invoer, toegelaten) {
  var velden = {};
  var bron = invoer || {};
  for (var i = 0; i < toegelaten.length; i++) {
    var veld = toegelaten[i];
    if (!bron.hasOwnProperty(veld)) continue;
    var r = beheerVeld(veld, bron[veld]);
    if (r.fout) return { fout: r.fout };
    velden[veld] = r.waarde;
  }
  return { velden: velden };
}

/* ---------- Boeken ---------- */

/**
 * Tot wanneer ligt een gereserveerd boek apart?
 * Tot en met de zoveelste openingsdag na de dag waarop het boek klaarlag.
 */
function berekenOphaalTermijn(datumKlaar, inst) {
  var d = datumKlaar;
  for (var i = 0; i < Math.max(1, inst.ophaaltermijn_openingsdagen); i++) d = volgendeOpeningsdag(d, inst, false);
  return d;
}

/** Nieuwe vervaldatum na verlengen: huidige vervaldatum plus de verlengingstermijn. */
function berekenVerlenging(huidigeVervaldatum, inst) {
  var d = telDagenOp(huidigeVervaldatum, inst.verlengingstermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Vervaldatum van een nieuwe uitlening:
 * uitleendatum plus de uitleentermijn, opgeschoven naar de eerstvolgende openingsdag.
 */
function berekenVervaldatum(datumUit, inst) {
  var d = telDagenOp(datumUit, inst.uitleentermijn_weken * 7);
  return inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(d, inst, true) : d;
}

/**
 * Beschikbaarheid van een boek voor de publieke catalogus.
 * Geeft { code, label, totaal, beschikbaar, terug } terug. Nooit wie het boek heeft.
 *   code: 'beschikbaar', 'uitgeleend', 'gereserveerd' of 'niet_uitleenbaar'
 */
function beschikbaarheid(staat, boek) {
  var totaal = aantalExemplaren(boek);
  if (!isUitleenbaar(boek)) {
    var teKoop = normaliseerTekst(boek.genre) === 'verkoop' || jaNee(boek.te_koop) === 'ja';
    return { code: 'niet_uitleenbaar', label: teKoop ? 'Te koop in de bib, niet uitleenbaar' : 'Niet uitleenbaar', totaal: totaal, beschikbaar: 0, terug: '' };
  }
  var uit = lopendeUitleningen(staat).filter(function (u) { return u.boek_id === boek.boek_id; });
  var reservaties = actieveReservaties(staat, boek.boek_id);
  var apart = reservaties.filter(function (r) { return r.status === STATUS_KLAAR; }).length;
  var wacht = reservaties.length - apart;
  var vrij = Math.max(0, totaal - uit.length - apart);
  var terug = uit.map(function (u) { return u.vervaldatum; }).sort()[0] || '';
  if (vrij > 0) {
    return { code: 'beschikbaar', label: totaal > 1 ? vrij + ' van ' + totaal + ' beschikbaar' : 'Beschikbaar', totaal: totaal, beschikbaar: vrij, terug: '' };
  }
  if (apart > 0 || wacht > 0) {
    return { code: 'gereserveerd', label: 'Gereserveerd', totaal: totaal, beschikbaar: 0, terug: terug };
  }
  var label = terug && terug >= staat.vandaag ? 'Uitgeleend, verwacht terug op ' + datumTekst(terug, staat.vandaag) : 'Uitgeleend';
  return { code: 'uitgeleend', label: label, totaal: totaal, beschikbaar: 0, terug: terug };
}

/**
 * Tweede ronde: zoekt een beschrijving op titel en auteur, bij Google Books en dan Open Library.
 * Enkel een uitgave met (bijna) dezelfde titel en dezelfde achternaam telt: nooit een ander boek.
 * Geeft { tekst }, { limiet: true } (Open Library wil wachten) of { gbLimiet: true } (Google weigert: later opnieuw).
 */
function beschrijvingOpTitel(boek, sleutel, gbLimiet) {
  var uit = { tekst: '' };
  if (!gbLimiet) {
    var g = googleBooksVraag(googleBooksTitelUrl(boek, sleutel));
    // Weigert Google: dit boek later opnieuw, als Google weer antwoordt (niets noteren).
    if (g.limiet) return { gbLimiet: true, tekst: '' };
    uit.tekst = beschrijvingUitItems(g.items, boek);
    if (uit.tekst) return uit;
  }
  Utilities.sleep(1000);
  var naam = achternaam(boek.auteur);
  var s = haalJson('https://openlibrary.org/search.json?title=' + encodeURIComponent(titelKern(boek.titel)) +
    (naam ? '&author=' + encodeURIComponent(naam) : '') + '&limit=10&fields=key,title,author_name');
  if (s.code === 429) return { limiet: true };
  var werk = olWerkOpTitel(s.data && s.data.docs, boek);
  if (!werk) return uit;
  Utilities.sleep(1000);
  var w = haalJson('https://openlibrary.org' + werk + '.json');
  if (w.code === 429) return { limiet: true };
  uit.tekst = maakBeschrijvingNetjes(olTekst(w.data && w.data.description));
  return uit;
}

/** Beschrijving via Google Books. Geeft { tekst } of { limiet: true }. */
function beschrijvingUitGoogleBooks(isbn, sleutel, boek) {
  var r = googleBooksZoek(isbn, sleutel, undefined, boek);
  if (r.code === 429 || r.code === 403 || r.code === 400) return { limiet: true, fout: r.fout };
  var items = r.items;
  for (var i = 0; i < items.length; i++) {
    var tekst = maakBeschrijvingNetjes(items[i].volumeInfo && items[i].volumeInfo.description);
    if (tekst) return { tekst: tekst };
  }
  return { tekst: '' };
}

/** De eerste beschrijving van een uitgave die hetzelfde boek is (zelfde titel en achternaam). */
function beschrijvingUitItems(items, boek) {
  var juist = (items || []).filter(function (it) { return zelfdeBoek(it.volumeInfo || {}, boek); });
  for (var i = 0; i < juist.length; i++) {
    var tekst = maakBeschrijvingNetjes(juist[i].volumeInfo.description);
    if (tekst) return tekst;
  }
  return '';
}

/** Beschrijving via Open Library: eerst de uitgave, dan het werk. */
function beschrijvingUitOpenLibrary(isbn) {
  var uitgave = haalJson('https://openlibrary.org/isbn/' + isbn + '.json');
  if (uitgave.code === 429) return { limiet: true };
  if (!uitgave.data) return { tekst: '' };
  var tekst = maakBeschrijvingNetjes(olTekst(uitgave.data.description));
  if (tekst) return { tekst: tekst };
  var werk = uitgave.data.works && uitgave.data.works.length ? uitgave.data.works[0].key : '';
  if (!/^\/works\/OL\d+W$/.test(String(werk))) return { tekst: '' };
  Utilities.sleep(1000);
  var w = haalJson('https://openlibrary.org' + werk + '.json');
  if (w.code === 429) return { limiet: true };
  return { tekst: maakBeschrijvingNetjes(olTekst(w.data && w.data.description)) };
}

/**
 * De zwaardere cijfers (meest geleend, per filtergroep, leners en collectie). Apart van bestuurData,
 * zodat het bestuursscherm sneller opent: deze cijfers laden pas als je Cijfers opent.
 */
function bestuurCijfers(staat, onderwerpRijen) {
  var perBoek = {}, perGroep = {};
  var vertaal = vertaalTabel(onderwerpRijen);
  staat.uitleningen.forEach(function (u) {
    perBoek[u.boek_id] = (perBoek[u.boek_id] || 0) + 1;
    var boek = boekVan(staat, u.boek_id);
    if (boek) filtergroepenVan(boek, vertaal).forEach(function (g) { perGroep[g] = (perGroep[g] || 0) + 1; });
  });
  var meestGeleend = Object.keys(perBoek).sort(function (a, b) { return perBoek[b] - perBoek[a]; }).slice(0, 10).map(function (id) {
    var b = boekVan(staat, id);
    return { boek_id: id, titel: b ? b.titel : id, auteur: b ? b.auteur : '', aantal: perBoek[id] };
  });
  var groepen = Object.keys(perGroep).sort(function (a, b) { return perGroep[b] - perGroep[a]; }).map(function (g) {
    return { groep: g, aantal: perGroep[g] };
  });
  return { meestGeleend: meestGeleend, groepen: groepen, extraCijfers: extraCijfers(staat) };
}

/** Gegevens voor het bestuursscherm. */
function bestuurGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, true); });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  lopend.forEach(function (info) {
    var sjabloon = info.status.code === 'telaat' ? staat.inst.tekst_herinnering : staat.inst.tekst_herinnering_binnenkort;
    info.herinnering = herinneringTekst(sjabloon, info, staat);
  });

  // Borgen: ingehouden (borg betaald en nog niet terug) per betaalwijze.
  var ingehouden = { totaal: 0, perBetaalwijze: {} };
  var terugTeBetalen = [];
  staat.uitleningen.forEach(function (u) {
    var borg = Number(u.borg || 0);
    // Een borg die bij een verloren boek ingehouden werd, is een vergoeding: die moet niet meer terug.
    if (borg <= 0 || !isLeeg(u.borg_terugbetaald) || isVerlorenUitlening(u)) return;
    var wijze = u.betaalwijze_borg || 'onbekend';
    ingehouden.totaal += borg;
    ingehouden.perBetaalwijze[wijze] = (ingehouden.perBetaalwijze[wijze] || 0) + borg;
    // Boek is terug, maar de borg nog niet: die moet nog terugbetaald worden.
    if (!isLeeg(u.datum_terug)) {
      var info = uitleningInfo(staat, u, true);
      info.datum_terug = u.datum_terug;
      terugTeBetalen.push(info);
    }
  });

  // Giften en uitleningen per maand, voor de laatste 12 maanden.
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), uitleningen: 0, giften: 0 };
  }
  var vertaal = vertaalTabel(onderwerpRijen);
  // Per jaar: alles wat bewaard is (ook ouder dan 12 maanden).
  var perJaar = {};
  staat.uitleningen.forEach(function (u) {
    var datum = parseerDatum(u.datum_uit) || '';
    var maand = datum.slice(0, 7);
    if (perMaand[maand]) {
      perMaand[maand].uitleningen++;
      perMaand[maand].giften += Number(u.gift || 0);
    }
    var jaar = datum.slice(0, 4);
    if (!jaar) return;
    perJaar[jaar] = perJaar[jaar] || { jaar: Number(jaar), uitleningen: 0, giften: 0 };
    perJaar[jaar].uitleningen++;
    perJaar[jaar].giften += Number(u.gift || 0);
  });

  // Uitzonderingen van de laatste 6 maanden, nieuwste eerst.
  var grens = telMaandenOp(staat.vandaag, -6);
  var uitzonderingen = (staat.uitzonderingenTabel || []).filter(function (x) { return String(x.datum) >= grens; }).map(function (x) {
    var b = boekVan(staat, x.boek_id);
    return {
      datum: x.datum, wie: x.wie, grens: x.grens, lenersnummer: x.lenersnummer,
      voornaam: (lenerVan(staat, x.lenersnummer) || {}).voornaam || '',
      titel: b ? b.titel : x.boek_id, reden: x.reden, actie: x.actie
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });

  return {
    vandaag: staat.vandaag,
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    borgen: {
      ingehouden: ingehouden,
      terugTeBetalen: terugTeBetalen
    },
    perMaand: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    perJaar: Object.keys(perJaar).sort().reverse().map(function (k) { return perJaar[k]; }),
    reservaties: alleReservaties(staat),
    uitzonderingen: uitzonderingen,
    boekstatus: boekenMetStatus(staat),
    privacy: staat.inst.tekst_privacy,
    keuzes: boekKeuzes(staat.catalogus, staat.categorieenTab),
    boeken: baliecatalogus(staat, vertaal),
    leners: staat.leners.map(function (l) {
      return {
        lenersnummer: l.lenersnummer, voornaam: l.voornaam, achternaam: l.achternaam, telefoon: l.telefoon,
        email: l.email, datum_inschrijving: l.datum_inschrijving, toestemming_privacy: l.toestemming_privacy,
        actief: jaNee(l.actief) !== 'nee', notitie: schoonMetRegels(l.notitie),
        markering: schoonMetRegels(l.markering), markering_sinds: parseerDatum(l.markering_sinds) || '',
        lopend: lopendeUitleningenVan(staat, l.lenersnummer).length
      };
    })
  };
}

/**
 * Schrijft de aangepaste velden van een tabel weg onder een kort slot. Geeft true als het lukte.
 * Lukt het slot niet, dan blijven de rijen gemarkeerd: de volgende keer probeert de taak opnieuw.
 */
function bewaarAchtergrond(tabel) {
  var gewijzigd = tabel.rijen.filter(function (r) { return r._gewijzigd && !r._nieuw && !r._verwijderen; });
  if (!gewijzigd.length) return true;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return false;
  try {
    var vers = leesTabel(tabel.naam);
    var kolommen = [];
    gewijzigd.forEach(function (r) { Object.keys(r._velden || {}).forEach(function (k) { if (kolommen.indexOf(k) === -1) kolommen.push(k); }); });
    voegVeldenSamen(gewijzigd, vers.rijen);
    // Kolom per kolom in één keer: rij per rij schrijven deed de spreadsheet telkens opnieuw rekenen en tekenen.
    schrijfKolommen(vers, kolommen);
  } finally {
    lock.releaseLock();
  }
  return true;
}

/** Achtergrond: kopieert covers van andere sites naar Drive, in porties. */
function bewaarCoversInDrive() {
  var start = Date.now();
  if (wachtOpDaglimiet('bewaarCoversInDrive')) return;
  if (!startAchtergrond('bewaarCoversInDrive')) {
    planTaak('bewaarCoversInDrive', 10 * 60 * 1000);
    return;
  }
  // Vangnet: breekt Google deze ronde af, dan start ze vanzelf opnieuw.
  planTaak('bewaarCoversInDrive', 10 * 60 * 1000);
  var bewaard = 0, mislukt = 0, later = 0, naElkaar = 0, rest = 0, storing = false, daglimiet = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    var vandaag = vandaagTekst().replace(/-/g, '');
    var teDoen = tabel.rijen.filter(heeftCoverBewarenNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CB_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var url = schoon(boek.cover_url);
      var a = haalCoverLink(url); // zie Beheer.js
      if (a.daglimiet) { daglimiet = true; storing = true; fout = 'daglimiet van Google voor opvragingen'; break; }
      if (a.code === 429 || a.code >= 500 || a.code === 0) {
        // Een fout bij deze ene cover: noteren en verder met de volgende. Pas bij veel fouten na elkaar stoppen.
        naElkaar++;
        var nieuw = coverPogingNaFout(boek.cover_bewaard, vandaag);
        wijzig(boek, { cover_bewaard: nieuw, cover_origineel: url });
        if (nieuw.indexOf(CB_MISLUKT) === 0) mislukt++; else later++;
        if (naElkaar >= CB_MAX_FOUTEN_NA_ELKAAR) { storing = true; break; }
        continue;
      }
      naElkaar = 0;
      var goed = a.code === 200 && a.data && !isStandaardAfbeelding(a.data) &&
        coverGrootGenoeg(afbeeldingAfmetingen(Utilities.base64Decode(a.data)));
      if (!goed) {
        wijzig(boek, { cover_bewaard: CB_MISLUKT + vandaag, cover_origineel: url });
        mislukt++;
      } else {
        var type = a.type.split(';')[0] || 'image/jpeg';
        var link;
        try {
          link = bewaarFotoInDrive(coverBestandsnaam(boek, type), a.data, type);
        } catch (e) {
          fout = String(e && e.message || e).slice(0, 200);
          daglimiet = /too many times|te vaak|limit/i.test(fout);
          storing = true;
          break;
        }
        wijzig(boek, { cover_url: link, cover_origineel: url, cover_bewaard: vandaagTekst() });
        bewaard++;
      }
      if ((bewaard + mislukt) % 25 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(200);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftCoverBewarenNodig).length;
  } finally {
    stopAchtergrond('bewaarCoversInDrive');
  }
  verwijderTriggers('bewaarCoversInDrive');
  if (rest > 0) planTaak('bewaarCoversInDrive', (daglimiet ? 6 * 60 : storing ? 15 : 1) * 60 * 1000);
  if (bewaard) leegCache();
  if (bewaard || mislukt || later) {
    logboek('systeem', 'bewaarCoversInDrive', bewaard + ' covers naar Google Drive gekopieerd, ' + mislukt + ' lukten niet (die blijven zoals ze zijn), ' +
      later + ' gaven een fout van de site (later nog eens), ' +
      rest + ' te gaan' + (daglimiet ? ' (Google Drive: daglimiet, over 6 uur verder)' : storing ? ' (even een storing, over 15 minuten verder)' : '') +
      (fout ? '. Fout: ' + fout : ''));
  }
}

/** Bewaart een foto in de map voor covers op Google Drive en geeft een publieke link terug. */
function bewaarFotoInDrive(bestandsnaam, base64, mime) {
  var naam = leesInstellingen().cover_map || 'Project Madrigal covers';
  var mappen = DriveApp.getFoldersByName(naam);
  var map = mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
  // Een oude foto van hetzelfde boek naar de prullenbak.
  var oud = map.getFilesByName(bestandsnaam);
  while (oud.hasNext()) oud.next().setTrashed(true);
  var bestand = map.createFile(Utilities.newBlob(Utilities.base64Decode(base64), mime, bestandsnaam));
  bestand.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + bestand.getId();
}

/* ---------- Tekst van de achterkant (foto + tekstherkenning) ---------- */

/*
 * Een foto van de achterflap: Google Drive leest de tekst (tekstherkenning, OCR), en die
 * komt in het veld beschrijving van het bestuursscherm. Daar lees je ze na en bewaar je ze.
 * Nodig: in Apps Script de service "Drive API" aanzetten (Services > + > Drive API).
 */

/** Schrijft alle wijzigingen van een staat terug naar de spreadsheet. */
function bewaarStaat(staat) {
  ['Leners', 'Uitleningen', 'Reservaties', 'Uitzonderingen'].forEach(function (naam) {
    if (staat.tabellen[naam]) bewaarTabel(staat.tabellen[naam]);
  });
  if (staat.uitzonderingen.length) {
    var tabel = staat.tabellen.Uitzonderingen || leesTabel('Uitzonderingen');
    staat.uitzonderingen.forEach(function (x) { voegToe(tabel.rijen, x); });
    bewaarTabel(tabel);
  }
  staat.log.forEach(function (regel) { logboek(staat.wie, regel[0], regel[1]); });
}

/* ---------- Publiek eindpunt ---------- */

/**
 * Schrijft de wijzigingen van een tabel terug: gewijzigde rijen op hun plaats,
 * nieuwe rijen onderaan, te verwijderen rijen van onder naar boven.
 */
function bewaarTabel(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  tabel.rijen.forEach(function (rij) {
    if (rij._gewijzigd && !rij._nieuw && !rij._verwijderen) {
      blad.getRange(rij._rij, 1, 1, kop.length).setValues([rijNaarWaarden(kop, rij)]);
      rij._gewijzigd = false;
      rij._velden = {};
    }
  });
  var nieuw = tabel.rijen.filter(function (r) { return r._nieuw; });
  if (nieuw.length) {
    var start = blad.getLastRow() + 1;
    blad.getRange(start, 1, nieuw.length, kop.length).setValues(nieuw.map(function (r) { return rijNaarWaarden(kop, r); }));
    nieuw.forEach(function (r, i) { r._nieuw = false; r._gewijzigd = false; r._rij = start + i; });
  }
  var weg = tabel.rijen.filter(function (r) { return r._verwijderen; }).map(function (r) { return r._rij; });
  weg.sort(function (a, b) { return b - a; }).forEach(function (rijnummer) { blad.deleteRow(rijnummer); });
  if (weg.length) tabel.rijen = tabel.rijen.filter(function (r) { return !r._verwijderen; });
}

/** De tekst als iemand een taak start die al loopt. Zegt sinds wanneer en dat je niets hoeft te doen. */
function bezigTekst(waarde, tijdzone) {
  var sinds = Number(waarde);
  var uur = sinds ? ' (gestart om ' + Utilities.formatDate(new Date(sinds), tijdzone || 'Europe/Brussels', 'HH:mm') + ')' : '';
  return 'Deze bewerking loopt al op de achtergrond' + uur + '. Je hoeft niets te doen: ze gaat vanzelf verder en schrijft na elke ronde een regel in het Logboek.';
}

/** Bestuur: de bezoekerscijfers voor 7, 30 of 365 dagen. invoer: { dagen } */
function bezoekersCijfers(invoer) {
  var dagen = GC_PERIODES[String(invoer.dagen)] || 30;
  var inst = leesInstellingen();
  var basis = gcBasis(inst.goatcounter_code);
  var sleutel = String(inst.goatcounter_api_sleutel || '').trim();
  if (!basis || !sleutel) return { ok: true, nietIngesteld: true };
  var cache = CacheService.getScriptCache();
  var cacheSleutel = 'gc_' + dagen + '_' + vandaagTekst();
  var bewaard = cache.get(cacheSleutel);
  if (bewaard) return { ok: true, cijfers: JSON.parse(bewaard) };

  var vragen = gcVragen(basis, gcPeriode(vandaagTekst(), dagen));
  var sleutels = Object.keys(vragen);
  var antwoorden;
  try {
    antwoorden = UrlFetchApp.fetchAll(sleutels.map(function (k) {
      return { url: vragen[k], headers: { Authorization: 'Bearer ' + sleutel, 'Content-Type': 'application/json' }, muteHttpExceptions: true };
    }));
  } catch (e) {
    return { ok: false, fout: 'GoatCounter is niet bereikbaar. Probeer het later opnieuw.' };
  }
  // Het totaal geeft soms 404. Nog één keer, met als einde het huidige uur in plaats van het einde van de dag.
  var iTotaal = sleutels.indexOf('totaal');
  if (iTotaal > -1 && antwoorden[iTotaal].getResponseCode() === 404) {
    var nu = new Date();
    var einde = Utilities.formatDate(new Date(nu.getTime() - nu.getTime() % 3600000), 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    try {
      antwoorden[iTotaal] = UrlFetchApp.fetch(vragen.totaal.replace(/end=[^&]+/, 'end=' + encodeURIComponent(einde)),
        { headers: { Authorization: 'Bearer ' + sleutel, 'Content-Type': 'application/json' }, muteHttpExceptions: true });
    } catch (e) { /* dan blijft het de eerste 404 */ }
  }
  var data = {}, mislukt = [];
  for (var i = 0; i < sleutels.length; i++) {
    var code = antwoorden[i].getResponseCode();
    var tekst = antwoorden[i].getContentText();
    if (code === 401 || code === 403) return { ok: false, fout: 'GoatCounter weigert de API-sleutel (' + code + '). Kijk na of ze klopt en het recht "Read statistics" heeft.' };
    if (code === 429) return { ok: false, fout: 'GoatCounter vraagt even te wachten. Probeer het over een minuut opnieuw.' };
    var json = null;
    if (code >= 200 && code < 300) { try { json = JSON.parse(tekst); } catch (e) { json = null; } }
    if (json) data[sleutels[i]] = json;
    else mislukt.push(gcFoutRegel(sleutels[i], code, tekst));
  }
  var r = gcUitkomst(data, mislukt, dagen, inst.goatcounter_code);
  if (r.ok && !mislukt.length) {
    try { cache.put(cacheSleutel, JSON.stringify(r.cijfers), GC_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  }
  if (mislukt.length) logboek('bestuur', 'bezoekersCijfers', mislukt.join(' | ').slice(0, 450));
  return r;
}

/** Bij elke wijziging met de hand in Catalogus, Onderwerpen of Instellingen: cache leegmaken. */
function bijWijziging(e) {
  var naam = e && e.range ? e.range.getSheet().getName() : '';
  if (['Catalogus', 'Onderwerpen', 'Instellingen', 'Uitleningen', 'Reservaties', 'Nieuws', 'Agenda', 'Vaste events', 'Veelgestelde vragen', 'Leeslijsten'].indexOf(naam) > -1) leegCache();
  if (naam === 'Catalogus') voorraadBijWijziging(e); // zie Verkoop.js
}

/** Schuift een datum per jaar op tot ze op of na "vanaf" valt en minder dan een jaar later. */
function binnenJaarNa(datum, vanaf) {
  if (!datum || !vanaf) return datum;
  for (var i = 0; i < 5 && dagenTussen(vanaf, datum) < 0; i++) datum = telMaandenOp(datum, 12);
  for (var j = 0; j < 5 && dagenTussen(vanaf, datum) > 365; j++) datum = telMaandenOp(datum, -12);
  return datum;
}

/** Een boek aanpassen. invoer: { boek_id, velden: { ... } } */
function boekAanpassen(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var r = beheerVelden(invoer.velden, BEHEER_BOEKVELDEN);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  if (v.hasOwnProperty('titel') && !v.titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
  // De auteur altijd als "Achternaam, Voornaam" (zie Auteurs.js). Films niet: daar staat de regie.
  if (v.auteur && (v.soort || boek.soort) !== 'film') v.auteur = auteurNetjes(v.auteur, auteurKennis(staat.catalogus));
  if (v.hasOwnProperty('aantal')) {
    if (!v.aantal) v.aantal = 1;
    var inGebruik = hoogsteExemplaarInGebruik(staat, boek.boek_id);
    if (v.aantal < inGebruik) {
      return { ok: false, fout: 'Exemplaar ' + boek.boek_id + '-' + inGebruik + ' is uitgeleend of ligt apart. Het aantal kan niet lager dan ' + inGebruik + '.' };
    }
  }
  if (v.hasOwnProperty('isbn') || v.hasOwnProperty('titel') || v.hasOwnProperty('auteur') || v.hasOwnProperty('soort')) {
    var samen = {};
    ['soort', 'isbn', 'titel', 'auteur'].forEach(function (k) { samen[k] = v.hasOwnProperty(k) ? v[k] : boek[k]; });
    v.bron_sleutel = bronSleutel(samen);
  }
  // Een nieuwe Nederlandse beschrijving: de vertaling opnieuw laten maken.
  if (v.hasOwnProperty('beschrijving') && v.beschrijving !== schoonMetRegels(boek.beschrijving) && !v.hasOwnProperty('beschrijving_en')) {
    v.beschrijving_vertaald = '';
    staat.vertalingNodig = true;
  }
  // Maak je de beschrijving leeg, dan valt ook de bronvermelding weg.
  if (v.hasOwnProperty('beschrijving') && !v.beschrijving) v.beschrijving_bron = '';
  wijzig(boek, v);
  staat.catalogusGewijzigd = true;
  // Welke velden: zo zie je in het Logboek en bij het boek wat er veranderde.
  staat.log.push(['boek aangepast', boek.boek_id + ': ' + Object.keys(v).filter(function (k) { return BEHEER_BOEKVELDEN.indexOf(k) > -1; }).join(', ')]);
  return { ok: true, tekst: '"' + schoon(boek.titel) + '" is bewaard.', boek: beheerBoek(boek) };
}

/** invoer: { ids: [boek_id, ...], veld, waarde }. Past elk boek aan zoals het boekformulier. */
function boekenBulk(staat, invoer) {
  var veld = String(invoer.veld || '');
  if (BULK_VELDEN.indexOf(veld) === -1) return { ok: false, fout: 'Dit veld kan je niet voor meerdere boeken tegelijk aanpassen.' };
  var ids = (invoer.ids || []).map(String).filter(function (id, i, alle) { return id && alle.indexOf(id) === i; });
  if (!ids.length) return { ok: false, fout: 'Kies eerst een of meer boeken.' };
  if (ids.length > 300) return { ok: false, fout: 'Kies hoogstens 300 boeken per keer.' };
  var gelukt = 0, fouten = [];
  // modus: 'erbij' (toevoegen aan de lijst), 'weg' (uit de lijst halen) of leeg (de waarde vervangen).
  var modus = BULK_LIJSTEN.indexOf(veld) > -1 ? String(invoer.modus || '') : '';
  var namen = splitsLijst(invoer.waarde);
  if (modus && !namen.length) return { ok: false, fout: 'Vul in wat erbij moet of weg moet.' };
  ids.forEach(function (id) {
    var velden = {};
    var boek = boekVan(staat, id);
    if (modus === 'erbij' && boek) velden[veld] = voegLijstToe(boek[veld], namen);
    else if (modus === 'weg' && boek) {
      var weg = namen.map(normaliseerTekst);
      velden[veld] = splitsLijst(boek[veld]).filter(function (n) { return weg.indexOf(normaliseerTekst(n)) === -1; }).join(', ');
    } else velden[veld] = invoer.waarde;
    var r = boekAanpassen(staat, { boek_id: id, velden: velden });
    if (r.ok) gelukt++; else fouten.push(id + ': ' + r.fout);
  });
  return { ok: gelukt > 0, fout: gelukt ? '' : fouten.join(' '), gelukt: gelukt, fouten: fouten,
    tekst: gelukt + (gelukt === 1 ? ' boek' : ' boeken') + ' aangepast.' + (fouten.length ? ' Niet gelukt: ' + fouten.join(' ') : '') };
}

/** Boeken met een status, per status, voor het bestuursscherm. */
function boekenMetStatus(staat) {
  var lijsten = { verloren: [], gevoelig_verborgen: [], gevoelig_zichtbaar: [] };
  staat.catalogus.forEach(function (b) {
    var s = boekStatus(b);
    if (!s || isLeeg(b.boek_id)) return;
    lijsten[s].push({ boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur) });
  });
  Object.keys(lijsten).forEach(function (k) {
    lijsten[k].sort(function (a, b) { return a.titel.localeCompare(b.titel); });
  });
  return lijsten;
}

/** Hoe vaak werd dit boek uitgeleend, en wanneer laatst? */
function boekHistoriek(staat, boekId) {
  var eigen = staat.uitleningen.filter(function (u) { return String(u.boek_id) === String(boekId); });
  var laatst = eigen.map(function (u) { return parseerDatum(u.datum_uit); }).filter(Boolean).sort().pop() || '';
  return { keer: eigen.length, laatst: laatst };
}

/**
 * De keuzes voor het formulier van een boek in het bestuursscherm: de thema's van de website, en alle
 * categorieën, trefwoorden, triggerwaarschuwingen en genres die al in de Catalogus staan (alfabetisch).
 * tabRijen: het tabblad Categorieën en trefwoorden (mag leeg zijn), voor namen die nog bij geen boek staan.
 */
function boekKeuzes(catalogus, tabRijen) {
  var lijst = function (kolom, enkelFilms) {
    var gezien = {}, uit = [];
    // Ook de namen uit het tabblad Categorieën en trefwoorden, die nog bij geen boek staan: zo vul je de keuzes aan.
    var soort = { categorieen: 'categorie', trefwoorden: 'trefwoord', triggerwaarschuwingen: 'triggerwaarschuwing' }[kolom];
    (soort ? tabRijen || [] : []).forEach(function (r) {
      var k = normaliseerTekst(r.naam);
      if (k && normaliseerTekst(r.soort) === soort && !gezien[k]) { gezien[k] = true; uit.push(schoon(r.naam)); }
    });
    catalogus.forEach(function (b) {
      if (enkelFilms !== undefined && isFilm(b) !== enkelFilms) return;
      splitsLijst(b[kolom]).forEach(function (n) {
        var k = normaliseerTekst(n);
        if (k && !gezien[k]) { gezien[k] = true; uit.push(schoon(n)); }
      });
    });
    return uit.sort(function (a, b) { return a.localeCompare(b, 'nl'); });
  };
  return {
    themas: alleThemas().slice().sort(function (a, b) { return a.localeCompare(b, 'nl'); }),
    categorieen: zonderThemas(lijst('categorieen')),
    trefwoorden: zonderThemas(lijst('trefwoorden')),
    triggerwaarschuwingen: lijst('triggerwaarschuwingen'),
    filmgenres: lijst('genre', true)
  };
}

/** Een boek ophalen om aan te passen. */
function boekOphalen(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  // sleutel: zodat de browser van het bestuur dit ene boek bij Google Books kan opzoeken (knop in het formulier).
  // keuzes: de thema's, categorieën en trefwoorden, voor de vinkjes en labels in het formulier (snel bewerken op de website).
  return { ok: true, boek: beheerBoek(boek), sleutel: String(staat.inst.google_books_api_key || ''), keuzes: boekKeuzes(staat.catalogus, staat.categorieenTab) };
}

/** Geeft '', 'verloren', 'gevoelig_verborgen' of 'gevoelig_zichtbaar'. Hoofdletters en kleine tikfouten mogen. */
function boekStatus(boek) {
  var s = normaliseerTekst(boek && boek.status);
  if (!s) return '';
  if (/verlor|kwijt/.test(s)) return 'verloren';
  if (/gevoelig/.test(s)) return /(^|\s)zichtbaar|waarschuw/.test(s) ? 'gevoelig_zichtbaar' : 'gevoelig_verborgen';
  return '';
}

function boekTitel(staat, u) {
  var b = boekVan(staat, u.boek_id);
  return b ? schoon(b.titel) : String(u.exemplaar);
}

/**
 * Een nieuw boek toevoegen. invoer: { velden: { ... }, toch: true om een dubbel ISBN toe te laten }
 * nieuwId: functie (soort) -> nieuwe boek-ID.
 */
function boekToevoegen(staat, invoer, nieuwId) {
  var r = beheerVelden(invoer.velden, BEHEER_BOEKVELDEN);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  if (!v.titel) return { ok: false, fout: 'Een boek heeft een titel nodig.' };
  v.soort = v.soort || 'boek';
  if (v.auteur && v.soort !== 'film') v.auteur = auteurNetjes(v.auteur, auteurKennis(staat.catalogus));
  if (v.isbn && !invoer.toch) {
    var dubbel = staat.catalogus.filter(function (b) { return String(b.isbn) === String(v.isbn) && !isLeeg(b.boek_id); })[0];
    if (dubbel) {
      return {
        ok: false, dubbel: String(dubbel.boek_id),
        fout: 'Dit ISBN staat al in de catalogus als ' + dubbel.boek_id + ' ("' + schoon(dubbel.titel) + '"). Is het een extra exemplaar? Verhoog daar het aantal.'
      };
    }
  }
  var boek = {};
  BEHEER_BOEKVELDEN.forEach(function (k) { boek[k] = v.hasOwnProperty(k) ? v[k] : ''; });
  boek.boek_id = nieuwId(v.soort);
  boek.aantal = v.aantal || 1;
  boek.uitleenbaar = v.uitleenbaar || 'ja';
  boek.publiek = v.publiek || 'ja';
  boek.toegevoegd_op = staat.vandaag;
  boek.herkomst = tekstInvoer(invoer.herkomst, 300);
  boek.bron_sleutel = bronSleutel(boek);
  voegToe(staat.catalogus, boek);
  staat.catalogusGewijzigd = true;
  staat.log.push(['boek toegevoegd', boek.boek_id]);
  return { ok: true, tekst: '"' + boek.titel + '" staat in de catalogus als ' + boek.boek_id + '.', boek: beheerBoek(boek) };
}

function boekVan(staat, boekId) {
  var id = schoon(boekId).toUpperCase();
  for (var i = 0; i < staat.catalogus.length; i++) {
    if (String(staat.catalogus[i].boek_id).toUpperCase() === id) return staat.catalogus[i];
  }
  return null;
}

/**
 * Bestuur: het uitgeleende boek is verloren. Sluit de uitlening af (staat_terug "verloren") en zet
 * de status van het boek op verloren, zodat het niet meer op de website staat en niet uitleenbaar is.
 * Heeft het boek meer exemplaren, dan blijft de status leeg en komt het in de notitie van het boek.
 * invoer: { uitlening_id, borg: 'ingehouden' | 'terugbetaald', opmerking }
 * Een ingehouden borg is een vergoeding: die telt niet mee bij de borgen die nog terug moeten.
 */
function boekVerloren(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var opmerking = tekstInvoer(invoer.opmerking, 200);
  var velden = { datum_terug: staat.vandaag, staat_terug: 'verloren' + (opmerking ? ': ' + opmerking : '') };
  var terugbetaald = invoer.borg === 'terugbetaald' && Number(u.borg) > 0;
  if (terugbetaald) velden.borg_terugbetaald = staat.vandaag;
  wijzig(u, velden);
  var boek = boekVan(staat, u.boek_id);
  var enkel = boek && aantalExemplaren(boek) <= 1;
  if (boek) {
    var regel = staat.vandaag + ' ' + u.exemplaar + ': verloren bij lener ' + u.lenersnummer + (opmerking ? ' (' + opmerking + ')' : '');
    var nieuw = { notitie: [schoonMetRegels(boek.notitie), regel].filter(Boolean).join('\n') };
    if (enkel) nieuw.status = 'verloren';
    wijzig(boek, nieuw);
    staat.catalogusGewijzigd = true;
  }
  staat.log.push(['verloren', u.uitlening_id + ' ' + u.exemplaar + (terugbetaald ? ', borg terugbetaald' : ', borg ingehouden')]);
  var titel = boek ? boek.titel : u.exemplaar;
  return {
    ok: true,
    tekst: '"' + titel + '" staat als verloren. De uitlening is afgesloten' +
      (Number(u.borg) > 0 ? (terugbetaald ? ' en de borg is terugbetaald.' : ', de borg van ' + bedragTekst(u.borg) + ' is ingehouden.') : '.') +
      (boek && !enkel ? ' Het boek heeft meer exemplaren: verlaag het aantal in de Catalogus als dit exemplaar niet terugkomt.' : '')
  };
}

/**
 * Bestuur: beslist wat er met een verloren boek gebeurt.
 * invoer: { sleutel: 'U:U00012' of 'B:B0034', keuze: 'vervangen' | 'niet' }
 *   vervangen: er staat een nieuw exemplaar in de kast. De status verloren gaat weg.
 *   niet:      het boek wordt niet vervangen. Het blijft verloren (op de website: niet meer beschikbaar).
 */
function boekVervangen(staat, invoer) {
  var m = String(invoer.sleutel || '').match(/^([UB]):(.+)$/);
  var keuze = invoer.keuze === 'vervangen' ? 'vervangen' : invoer.keuze === 'niet' ? 'niet' : '';
  if (!m || !keuze) return { ok: false, fout: 'Kies of het boek vervangen is of niet.' };
  var u = m[1] === 'U' ? uitleningVan(staat, m[2]) : null;
  var boek = boekVan(staat, u ? u.boek_id : m[2]);
  if (m[1] === 'U' && (!u || !isVerlorenUitlening(u))) return { ok: false, fout: 'Deze uitlening staat niet als verloren.' };
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var stempel = keuze === 'vervangen' ? 'vervangen op ' + korteDatum(staat.vandaag) : 'niet vervangen';
  if (u) wijzig(u, { staat_terug: schoon(u.staat_terug) + ' · ' + stempel });
  var nieuw = { notitie: [schoonMetRegels(boek.notitie), staat.vandaag + ' ' + (u ? u.exemplaar + ': ' : '') + stempel].filter(Boolean).join('\n') };
  if (keuze === 'vervangen' && boekStatus(boek) === 'verloren') nieuw.status = '';
  wijzig(boek, nieuw);
  staat.catalogusGewijzigd = true;
  staat.log.push(['vervangen', (u ? u.exemplaar : boek.boek_id) + ': ' + stempel]);
  var meer = aantalExemplaren(boek) > 1;
  return { ok: true, tekst: '"' + schoon(boek.titel) + '": ' + (keuze === 'vervangen' ? 'vervangen. Het staat weer gewoon in de catalogus.'
    : meer ? 'niet vervangen. Verlaag het aantal exemplaren in de Catalogus.' : 'niet vervangen. Het blijft op de website als niet meer beschikbaar.') };
}

/** De laatste wijzigingen aan een boek volgens het Logboek (waarden: het tabblad Logboek). */
function boekWijzigingen(waarden, boekId) {
  var id = String(boekId);
  return laatsteLogregels(waarden, waarden.length).filter(function (r) {
    return ['boek aangepast', 'boek toegevoegd', 'cover-foto'].indexOf(r.actie) > -1 &&
      (r.details === id || r.details.indexOf(id + ':') === 0 || r.details.indexOf(id + ' ') === 0);
  }).slice(0, 5);
}

/* ---------- Extra cijfers (bestuursscherm, onderdeel Cijfers) ---------- */

/**
 * Zoekt in een antwoord van bol.com de beste link naar een afbeelding. We weten niet zeker hoe
 * het antwoord eruitziet, dus we zoeken overal naar https-links naar afbeeldingen, en nemen
 * die met een breedte het dichtst bij 550 pixels (of anders de eerste).
 */
function bolAfbeelding(data) {
  var kandidaten = [];
  (function zoek(w, breedte) {
    if (!w) return;
    if (typeof w === 'string') {
      if (/^https:\/\/[^\s"'<>]+\.(jpe?g|png|webp)(\?[^\s"'<>]*)?$/i.test(w)) kandidaten.push({ url: w, breedte: breedte || 0 });
      return;
    }
    if (Array.isArray(w)) { w.forEach(function (x) { zoek(x, breedte); }); return; }
    if (typeof w === 'object') {
      var b = Number(w.width || w.breedte || 0) || breedte;
      Object.keys(w).forEach(function (k) { zoek(w[k], b); });
    }
  })(data, 0);
  if (!kandidaten.length) return '';
  kandidaten.sort(function (a, b) {
    var da = a.breedte ? Math.abs(a.breedte - 550) : 9999, db = b.breedte ? Math.abs(b.breedte - 550) : 9999;
    return da - db;
  });
  return kandidaten[0].url;
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
  boek.auteur = htmlTekst(boek.auteur);
  boek.genre = htmlTekst(boek.genre);
  return bolTitelSplitsen(boek);
}

/**
 * bol.com zet soms alles in de titel: "Titel, Auteur | 9780374388416 | Boeken". Dan splitsen we:
 * het ISBN en de categorie (behalve het nietszeggende "Boeken") gaan naar hun eigen veld, en de
 * auteur na de laatste komma, als we die nog niet kenden. Geeft het boek terug.
 */
function bolTitelSplitsen(boek) {
  var delen = String(boek.titel || '').split(/\s+\|\s+/);
  if (delen.length < 2) return boek;
  var titel = delen.shift();
  delen.forEach(function (d) {
    var isbn = /^[\dX -]{10,17}$/i.test(d) ? aankoopIsbn(d) : '';
    if (isbn) { if (!boek.isbn) boek.isbn = isbn; }
    else if (!/^(boeken|books|bol(\.com)?)$/i.test(d) && !boek.genre) boek.genre = d;
  });
  var komma = titel.lastIndexOf(', ');
  if (!boek.auteur && komma > 0) {
    boek.auteur = titel.slice(komma + 2);
    titel = titel.slice(0, komma);
  } else if (boek.auteur && komma > 0 && normaliseerTekst(titel.slice(komma + 2)) === normaliseerTekst(boek.auteur)) {
    titel = titel.slice(0, komma);
  }
  boek.titel = titel;
  return boek;
}

/** Een toegangsbewijs (token) van bol.com, 4 minuten bewaard. Geeft { token } of { fout }. */
function bolToken(inst) {
  if (!inst.bol_client_id || !inst.bol_client_secret) return { fout: 'Vul bol_client_id en bol_client_secret in bij Instellingen.' };
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get('bol_token');
  if (bewaard) return { token: bewaard };
  var r = haalExtern('https://login.bol.com/token?grant_type=client_credentials', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(inst.bol_client_id + ':' + inst.bol_client_secret), Accept: 'application/json' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  if (r.getResponseCode() !== 200 || !data || !data.access_token) {
    return { fout: 'bol.com gaf geen toegang (code ' + r.getResponseCode() + '). Kijk de Client ID en Client Secret na.' };
  }
  cache.put('bol_token', data.access_token, 240);
  return { token: data.access_token };
}

/** Vraagt iets op bij de Marketing Catalog API. Geeft { code, data }. */
function bolVraag(pad, token) {
  var r = haalExtern(BOL_API + pad, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Accept-Language': 'nl' }
  });
  var data = null;
  try { data = JSON.parse(r.getContentText()); } catch (e) { data = null; }
  return { code: r.getResponseCode(), data: data };
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
    // In de agenda enkel de eerstvolgende keer: meerdere kaarten met dezelfde tekst ogen vreemd.
    // Staat die keer al als eigen event in de Agenda, dan komt er niets bij.
    events: datums.slice(0, 1).filter(function (d) { return !eigen[d]; }).map(function (d) {
      return { datum: d, uur: schoon(inst.bookclub_uur), titel: { nl: naam, en: naam }, tekst: tekst, locatie: '', afbeelding: '', link: link };
    })
  };
}

/** De regel in woorden: { nl: "elke tweede zondag van de maand", en: "every second Sunday of the month" }. */
function bookclubRegel(week, dag) {
  return {
    nl: 'elke ' + BC_WEKEN_NL[week] + ' ' + WEEKDAGEN[dag] + ' van de maand',
    en: 'every ' + BC_WEKEN_EN[week] + ' ' + BC_DAGEN_EN[dag] + ' of the month'
  };
}

/** Bestuur: de borg van een uitlening als terugbetaald noteren. */
function borgTerugbetaald(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.borg_terugbetaald)) return { ok: false, fout: 'Deze borg is al terugbetaald.' };
  wijzig(u, { borg_terugbetaald: staat.vandaag });
  staat.log.push(['borg terugbetaald', u.uitlening_id]);
  return { ok: true, tekst: 'Borg genoteerd als terugbetaald.' };
}

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
  var toonTriggers = (staat.inst || {}).triggerwaarschuwingen_tonen === true;
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
    // Een categorie of trefwoord met de naam van een thema staat al bij de thema's: niet dubbel.
    var categorieen = zonderThemas(splitsLijst(rij.categorieen));
    if (categorieen.length) boek.ca = categorieen;
    // Bij een film mag een trefwoord de naam van een thema hebben: een film heeft geen thema's, enkel genres.
    var trefwoorden = film ? splitsLijst(rij.trefwoorden) : zonderThemas(splitsLijst(rij.trefwoorden));
    if (trefwoorden.length) boek.k = trefwoorden;
    var triggers = toonTriggers ? splitsLijst(rij.triggerwaarschuwingen) : [];
    if (triggers.length) boek.tw = triggers;
    // az: vroegere namen en pseudoniemen van de auteur (Auteursnamen.js). Enkel om op te zoeken, nooit getoond.
    var zoeknamen = auteurZoeknamen(rij);
    if (zoeknamen.length) boek.az = zoeknamen;
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
  var groepen = alleThemas();
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
 * Zet de antwoorden van de roostertool (actie "maand") om naar één lijst avonden
 * vanaf vandaag. Een maand zonder gepubliceerd rooster toont enkel de avonden.
 * antwoorden: lijst van { maand, avonden: [{ datum, status, event }], rooster: [...] of null }
 */
function bouwRoosterOverzicht(antwoorden, vandaag) {
  var avonden = [];
  var nietGepubliceerd = [];
  antwoorden.forEach(function (a) {
    if (!a || !a.ok) return;
    var perDatum = {};
    (a.rooster || []).forEach(function (r) { perDatum[r.datum] = r; });
    if (!a.rooster) nietGepubliceerd.push(a.maand);
    (a.avonden || []).forEach(function (av) {
      if (String(av.datum) < vandaag) return;
      var r = perDatum[av.datum] || {};
      avonden.push({
        datum: av.datum,
        status: av.status || 'open',
        event: schoon(av.event),
        vrijwilligers: r.vrijwilligers || [],
        backups: r.backups || [],
        afgemeld: r.afgemeld || [],
        gepubliceerd: !!a.rooster
      });
    });
  });
  avonden.sort(function (x, y) { return x.datum < y.datum ? -1 : 1; });
  return { avonden: avonden, nietGepubliceerd: nietGepubliceerd };
}

/**
 * Bouwt de inhoud van de startpagina (zonder de spreadsheet aan te raken).
 * tabellen: { nieuws, agenda, faq } met de rijen van die tabbladen.
 * staat: zoals in Uitlenen.js (voor de aanraders en hun beschikbaarheid).
 */
function bouwSiteInhoud(staat, tabellen) {
  var inst = staat.inst;

  // online_vanaf: gepland bericht, pas zichtbaar vanaf die dag.
  var nieuws = (tabellen.nieuws || []).filter(function (r) {
    var vanaf = parseerDatum(r.online_vanaf);
    return isPubliek(r) && (r.titel || r.tekst) && (!vanaf || vanaf <= staat.vandaag);
  })
    .sort(function (a, b) { return String(b.datum || '').localeCompare(String(a.datum || '')); })
    .slice(0, SITE_MAX_NIEUWS)
    .map(function (r) {
      return { datum: parseerDatum(r.datum), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link) };
    });

  var events = (tabellen.agenda || []).filter(function (r) { return isPubliek(r) && parseerDatum(r.datum) && r.titel; })
    .map(function (r) {
      return {
        datum: parseerDatum(r.datum), uur: schoon(r.uur), titel: tweetalig(r, 'titel'), tekst: tweetaligLang(r, 'tekst'),
        locatie: schoon(r.locatie), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link)
      };
    });
  // De vaste bijeenkomst van de bookclub (zie Bookclub.js) komt er vanzelf bij.
  var bookclub = bookclubGegevens(inst, staat.vandaag, tabellen.agenda);
  if (bookclub) events = events.concat(bookclub.events);
  // De vaste events van elke maand (zie Shifts.js), telkens de eerstvolgende keer.
  events = events.concat(vasteEventsVoorAgenda(inst, staat.vandaag, tabellen.agenda, tabellen.vasteEvents));
  var komend = events.filter(function (e) { return e.datum >= staat.vandaag; }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
  var voorbij = events.filter(function (e) { return e.datum < staat.vandaag; }).sort(function (a, b) { return b.datum.localeCompare(a.datum); });

  var faq = (tabellen.faq || []).filter(function (r) { return isPubliek(r) && r.vraag; })
    .sort(function (a, b) { return (parseerGetal(a.volgorde) || 999) - (parseerGetal(b.volgorde) || 999); })
    .map(function (r) { return { vraag: tweetalig(r, 'vraag'), antwoord: tweetaligLang(r, 'antwoord') }; });

  // Aanraders op de startpagina. Een boek staat erop als:
  //   - de kolom startpagina "ja" is, of
  //   - iemand het aanraadt (namen uit aanraders_verbergen tellen niet mee).
  // Beschikbare boeken eerst, daarna willekeurig maar vast per week: elke maandag een nieuwe keuze.
  // Nieuw binnen is een aparte lijst (zie verder): zo verdringen de aanraders de nieuwe boeken nooit.
  // "nee" in de kolom startpagina haalt een boek er altijd af.
  // Een boek met gevoelige inhoud komt er enkel op met "ja" in de kolom startpagina.
  var verborgen = splitsLijst(inst.aanraders_verbergen).map(normaliseerTekst);
  var dagenNieuw = parseerGetal(inst.nieuw_op_startpagina_dagen);
  if (dagenNieuw === null) dagenNieuw = 60;
  var isNieuw = function (b) {
    var d = parseerDatum(b.toegevoegd_op);
    if (!d || dagenNieuw <= 0) return false;
    var dagen = dagenTussen(d, staat.vandaag);
    return dagen >= 0 && dagen < dagenNieuw;
  };
  var kandidaten = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && opWebsite(b) && jaNee(b.startpagina) !== 'nee' && !isFilm(b);
  });
  var startpaginaBoek = function (b) {
    var bs = beschikbaarheid(staat, b);
    return {
      id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), c: veiligeCoverUrl(b.cover_url),
      s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : 'boek',
      r: splitsLijst(String(b.aanrader || '').replace(/ en | & /g, ',')).filter(function (naam) {
        return verborgen.indexOf(normaliseerTekst(naam)) === -1;
      }),
      n: isNieuw(b) ? 1 : 0,
      zelf: jaNee(b.startpagina) === 'ja',
      gevoelig: boekStatus(b) === 'gevoelig_zichtbaar',
      vrij: bs.code === 'beschikbaar',
      volgorde: dagVolgorde(String(b.boek_id), weekBegin(staat.vandaag)),
      toegevoegd: parseerDatum(b.toegevoegd_op) || ''
    };
  };
  var opruimen = function (b) { delete b.volgorde; delete b.zelf; delete b.toegevoegd; if (b.gevoelig) b.w = 1; delete b.gevoelig; return b; };
  var aanraders = kandidaten.map(startpaginaBoek)
    .filter(function (b) { return b.zelf || (!b.gevoelig && b.r.length); })
    .sort(function (a, b) { return (b.vrij - a.vrij) || (a.volgorde - b.volgorde); })
    .slice(0, SITE_MAX_AANRADERS)
    .map(opruimen);

  // Nieuw binnen: de laatst toegevoegde boeken, nieuwste eerst.
  var aantalNieuw = parseerGetal(inst.nieuw_op_startpagina_aantal);
  if (aantalNieuw === null) aantalNieuw = 8;
  // Zijn er minder nieuwe boeken dan het aantal, dan vullen we aan met de laatst
  // gecatalogiseerde boeken: het hoogste boek-ID kwam het laatst in de Catalogus.
  // Zo is de sectie nooit leeg, ook niet net na de eerste opbouw (toen kreeg geen
  // enkel boek een datum in toegevoegd_op). 0 dagen: Nieuw binnen staat uit.
  var nieuwsteEerst = function (a, b) { return b.toegevoegd.localeCompare(a.toegevoegd) || idNummer(b.id) - idNummer(a.id); };
  var nieuwBinnen = [];
  if (dagenNieuw > 0) {
    var toonbaar = kandidaten.map(startpaginaBoek).filter(function (b) { return b.zelf || !b.gevoelig; });
    nieuwBinnen = toonbaar.filter(function (b) { return b.n; }).sort(nieuwsteEerst);
    if (nieuwBinnen.length < aantalNieuw) {
      nieuwBinnen = nieuwBinnen.concat(toonbaar.filter(function (b) { return !b.n; }).sort(nieuwsteEerst));
    }
    nieuwBinnen = nieuwBinnen.slice(0, Math.max(0, aantalNieuw)).map(opruimen);
  }

  return {
    bijgewerkt: staat.vandaag,
    contact: {
      adres: String(inst.adres || ''), openingsuren: { nl: String(inst.openingsuren || ''), en: String(inst.openingsuren_en || '') || String(inst.openingsuren || '') },
      mail_algemeen: inst.mail_algemeen, mail_events: inst.mail_events
    },
    nieuws: nieuws,
    // De pagina Bereikbaarheid en toegankelijkheid (toegankelijkheid.html): tekst met # titels en - punten.
    toegankelijkheid: { nl: String(inst.tekst_toegankelijkheid || ''), en: String(inst.tekst_toegankelijkheid_en || '') || String(inst.tekst_toegankelijkheid || '') },
    // voorbij: de voorbije events, nieuwste eerst. De site toont ze ingeklapt. vorig blijft voor oudere versies van de site.
    agenda: { komend: komend.slice(0, 3), vorig: voorbij[0] || null, voorbij: voorbij.slice(0, SITE_MAX_VOORBIJ) },
    faq: faq,
    aanraders: aanraders,
    nieuw: nieuwBinnen,
    // Het menu-item Leeslijsten: enkel als de instelling leeslijsten_tonen op ja staat.
    leeslijsten: inst.leeslijsten_tonen === true || (tabellen.leeslijsten || []).some(function (r) {
      var z = leeslijstZichtbaar(r, staat.vandaag, false);
      return z.gepland && z.zichtbaar;
    }),
    // Pagina Doe mee. Een leeg blok toont de website niet.
    doeMee: {
      vrijwilliger: { nl: String(inst.tekst_vrijwilliger || ''), en: String(inst.tekst_vrijwilliger_en || '') || String(inst.tekst_vrijwilliger || '') },
      schenken: { nl: String(inst.tekst_schenken || ''), en: String(inst.tekst_schenken_en || '') || String(inst.tekst_schenken || '') },
      steunen: { nl: String(inst.tekst_steunen || ''), en: String(inst.tekst_steunen_en || '') || String(inst.tekst_steunen || '') }
    },
    // Blok op de pagina Over ons: de bookclub, met de eerstvolgende datums. null als bookclub_naam leeg is.
    bookclub: bookclub ? { naam: bookclub.naam, regel: bookclub.regel, uur: bookclub.uur, tekst: bookclub.tekst, link: bookclub.link, volgende: bookclub.volgende } : null,
    // Pagina Peperfabriek: de tekst, het adres van hun programma en de komende activiteiten (zie Peperfabriek.js).
    peperfabriek: {
      tekst: { nl: String(inst.tekst_peperfabriek || ''), en: String(inst.tekst_peperfabriek_en || '') || String(inst.tekst_peperfabriek || '') },
      url: veiligeCoverUrl(inst.peperfabriek_url),
      opgehaald: (tabellen.peperfabriek || {}).opgehaald || '',
      activiteiten: pfVoorSite((tabellen.peperfabriek || {}).activiteiten, staat.vandaag, inst.peperfabriek_aantal)
    }
  };
}

/** Acties briefjeMaken en briefjeWeg (binnen het slot). */
function briefjeActie(actie, invoer, wie) {
  var tabel = tabelOfLeeg('Briefjes');
  if (!tabel) return { ok: false, fout: 'Het tabblad Briefjes ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'briefjeMaken'
    ? maakBriefje(tabel.rijen, invoer, wie, vandaagTekst(), nieuwIdVoor(tabel.rijen, 'briefje_id', 'briefje', 'N'))
    : briefjeWeg(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, actie === 'briefjeMaken' ? 'briefje' : 'briefje weg', actie === 'briefjeMaken' ? '' : String(invoer.briefje_id));
  }
  return r;
}

/* ---------- Mijn voorstellen en meldingen ---------- */

/** Iemand haalt een briefje weg (gelezen, opgelost). invoer: { briefje_id } */
function briefjeWeg(rijen, invoer, wie, vandaag) {
  var b = (rijen || []).filter(function (r) { return String(r.briefje_id) === String(invoer.briefje_id); })[0];
  if (!b) return { ok: false, fout: 'Dit briefje bestaat niet meer.' };
  wijzig(b, { status: 'weg', weg_door: tekstInvoer(wie, 40), datum_weg: vandaag });
  return { ok: true, tekst: 'Het briefje is weg.' };
}

/**
 * Sleutel om hetzelfde boek te herkennen: het ISBN, of anders de volledige titel en auteur.
 * Een boek zonder geldig ISBN maar met een ongeldig nummer, gebruikt titel en auteur.
 */
function bronSleutel(boek) {
  if (boek.isbn) return boek.soort + ':isbn:' + boek.isbn;
  // De volledige titel: "Ember: Macht (derde editie)" en "Ember: Bubbels (tweede editie)"
  // zijn verschillende boeken. Enkel hoofdletters, accenten en leestekens tellen niet.
  return boek.soort + ':ta:' + normaliseerTekst(boek.titel) + '|' + normaliseerTekst(boek.auteur);
}

function bytesHash(bytes) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes));
}

/**
 * Deelt de namen in de Catalogus opnieuw in volgens de soort in het tabblad Categorieën en trefwoorden.
 * soortVan: { genormaliseerde naam: 'categorie' | 'trefwoord' | 'triggerwaarschuwing' | 'weg' }.
 * Zet je in het tabblad Crime op trefwoord, dan verhuist Crime bij elk boek van categorieen naar trefwoorden.
 * Met weg verdwijnt de naam bij elk boek. Geeft de boek_id's die veranderden.
 */
function categorieenHerindelen(catalogus, soortVan) {
  var veranderd = [];
  catalogus.forEach(function (b) {
    var nieuw = { categorieen: [], trefwoorden: [], triggerwaarschuwingen: [] };
    // Eerst wat blijft staan, dan wat verhuist: zo blijft de volgorde in elke kolom zoals ze was.
    [true, false].forEach(function (blijft) {
      Object.keys(CATEGORIE_KOLOM).forEach(function (soort) {
        splitsLijst(b[CATEGORIE_KOLOM[soort]]).forEach(function (n) {
          var doel = soortVan[normaliseerTekst(n)] || soort;
          if (doel === 'weg' || (doel === soort) !== blijft) return;
          var lijst = nieuw[CATEGORIE_KOLOM[doel]];
          if (!lijst.some(function (x) { return normaliseerTekst(x) === normaliseerTekst(n); })) lijst.push(n);
        });
      });
    });
    var velden = {};
    Object.keys(nieuw).forEach(function (kol) {
      if (nieuw[kol].join(', ') !== splitsLijst(b[kol]).join(', ')) velden[kol] = nieuw[kol].join(', ');
    });
    if (Object.keys(velden).length) { wijzig(b, velden); veranderd.push(String(b.boek_id)); }
  });
  return veranderd;
}

/**
 * Het tabblad Categorieën en trefwoorden: alle namen, met de soort en het aantal boeken.
 * oudeTags: de tabel tags van de oude website (mag leeg zijn). Namen uit de Catalogus komen er ook in,
 * zodat een categorie die je zelf toevoegt ook in de keuzelijst staat.
 */
function categorieenOverzicht(catalogus, oudeTags) {
  var lijst = {}, volgorde = [];
  var zet = function (naam, soort) {
    var k = normaliseerTekst(naam);
    // De naam van een thema hoort niet in dit overzicht: die staat al bij de thema's.
    if (!k || themaExact(naam)) return null;
    if (!lijst[k]) { lijst[k] = { naam: genreMooi(naam), soort: soort, aantal_boeken: 0 }; volgorde.push(k); }
    return lijst[k];
  };
  oudeOnderwerpen(oudeTags || []).forEach(function (o) { zet(o.naam, o.trigger ? 'triggerwaarschuwing' : (o.categorie ? 'categorie' : 'trefwoord')); });
  [['categorieen', 'categorie'], ['trefwoorden', 'trefwoord'], ['triggerwaarschuwingen', 'triggerwaarschuwing']].forEach(function (paar) {
    catalogus.forEach(function (b) {
      splitsLijst(b[paar[0]]).forEach(function (n) { var r = zet(n, paar[1]); if (r && r.soort === paar[1]) r.aantal_boeken++; });
    });
  });
  var orde = { categorie: 0, trefwoord: 1, triggerwaarschuwing: 2 };
  return volgorde.map(function (k) { return lijst[k]; }).sort(function (a, b) {
    return orde[a.soort] - orde[b.soort] || a.naam.localeCompare(b.naam, 'nl');
  });
}

/** De rijen van het tabblad Categorieën en trefwoorden, of [] als het (nog) niet bestaat. */
function categorieenTabRijen() {
  try {
    var blad = spreadsheet().getSheetByName('Categorieën en trefwoorden');
    return blad && blad.getLastRow() > 1 ? leesTabel('Categorieën en trefwoorden').rijen : [];
  } catch (e) { return []; }
}

/**
 * Haalt de namen van thema's uit de kolommen categorieen en trefwoorden: die horen bij de thema's
 * (extra_onderwerpen), niet dubbel. Geeft de boek_id's die veranderden.
 */
function categorieenZonderThemas(catalogus) {
  var veranderd = [];
  catalogus.forEach(function (b) {
    if (isFilm(b)) return; // een film heeft geen thema's: daar blijft het trefwoord
    var naarThema = [], velden = {};
    ['categorieen', 'trefwoorden'].forEach(function (kol) {
      var lijst = splitsLijst(b[kol]);
      var rest = zonderThemas(lijst);
      if (rest.length === lijst.length) return;
      lijst.forEach(function (n) { if (themaExact(n)) naarThema.push(themaExact(n)); });
      velden[kol] = rest.join(', ');
    });
    if (!naarThema.length) return;
    var themas = voegLijstToe(b.extra_onderwerpen, naarThema);
    if (themas !== splitsLijst(b.extra_onderwerpen).join(', ')) velden.extra_onderwerpen = themas;
    wijzig(b, velden);
    veranderd.push(String(b.boek_id));
  });
  return veranderd;
}

/** Zet een waarde om naar wat we in een cel schrijven. */
function celWaarde(kolom, waarde) {
  if (waarde === undefined || waarde === null) return '';
  if (DATUMKOLOMMEN.indexOf(kolom) > -1 && typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde)) {
    var d = waarde.split('-');
    // Middag, zodat zomer- en wintertijd de dag niet doen verspringen.
    return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]), 12);
  }
  return veiligeCel(waarde);
}

/** Een tekst met een punt per regel wordt een lijst. Lege regels en opsommingstekens vallen weg. */
function checklistPunten(tekst) {
  return String(tekst || '').split('\n').map(function (r) { return schoon(r.replace(/^\s*[-*•\d.)]+\s*/, '')); })
    .filter(Boolean).slice(0, 30);
}

/** Is het aanmelden geblokkeerd? cache: CacheService.getScriptCache() (of een nabootsing in de tests). */
function codesGeblokkeerd(cache) {
  return Number(cache.get(FOUT_SLEUTEL) || 0) >= FOUT_MAX;
}

/** Is de auteur nu leeg? Dan die van de stocklijst, anders van de oude website, in de vorm "Achternaam, Voornaam". */
function controleAuteurAangevuld(nu, anderen) {
  if (schoon(nu)) return '';
  var bron = (anderen || []).filter(function (a) { return schoon(a); })[0];
  return bron ? controleAuteurOmgedraaid(controleAuteurZonderDubbels(bron)) : '';
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

/** Staat elke naam in de vorm "Achternaam, Voornaam"? (Een naam uit één woord telt als goed.) */
function controleAuteurGoedeVorm(auteur) {
  var delen = String(auteur || '').split(CONTROLE_AUTEUR_SCHEIDING).filter(function (d, i) { return !(i % 2) && schoon(d); });
  return delen.length > 0 && delen.every(function (d) { return /,/.test(d) || schoon(d).split(' ').length === 1; });
}

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

/** Sleutel om auteurs te vergelijken: de woorden in alfabetische volgorde ("Melchior, Willem" = "Willem Melchior"). */
function controleAuteurSleutel(auteur) {
  // Elk woord één keer: "J.R. Ackerley; J. R. Ackerley" is dezelfde naam als "Ackerley, J.R".
  var uniek = [];
  normaliseerTekst(String(auteur || '').replace(/\b(en|and|et|und)\b|&/gi, ' ')).split(' ').forEach(function (w) {
    if (w && uniek.indexOf(w) === -1) uniek.push(w);
  });
  return uniek.sort().join(' ');
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

/**
 * Controleert alle grenzen van een actie.
 * Geeft een lijst terug met de overschreden grenzen: [{ id, naam, melding }].
 */
function controleerGrenzen(actie, ctx) {
  var overschreden = [];
  GRENZEN.forEach(function (g) {
    if (g.actie !== actie) return;
    var melding = g.controleer(ctx);
    if (melding) overschreden.push({ id: g.id, naam: g.naam, melding: melding });
  });
  return overschreden;
}

/**
 * Menu: kijkt de covers van Internet Archive na. Is de afbeelding niet staand (het logo, een pictogram),
 * dan wist het script de cover: het boek komt weer in de lijst Boeken zonder cover en Google zoekt opnieuw.
 * Laadt een afbeelding niet, dan blijft ze staan (misschien een storing). Werkt in porties op de achtergrond.
 */
function controleerIaCovers() {
  var start = Date.now();
  if (wachtOpDaglimiet('controleerIaCovers')) return;
  if (!startAchtergrond('controleerIaCovers')) { meldAlBezig('controleerIaCovers'); return; }
  var props = PropertiesService.getScriptProperties();
  var vanaf = props.getProperty(IA_CONTROLE_SLEUTEL) || '';
  var nagekeken = 0, gewist = [], laadtNiet = 0, rest = 0, wachten = false;
  try {
    var tabel = leesTabel('Catalogus');
    var teDoen = iaCoversTeControleren(tabel.rijen, vanaf);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CV_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = null;
      try {
        r = haalExtern(iaControleLink(boek), { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
      } catch (e) {
        if (isDaglimietFout(e)) { wachten = true; break; } // haalExtern plant de herstart al
      }
      var code = r ? r.getResponseCode() : 0;
      if (code === 429 || code >= 500) { wachten = true; break; }
      if (code !== 200) laadtNiet++;
      else {
        var afm = afbeeldingAfmetingen(r.getBlob().getBytes());
        if (afm && !isStaandeCover(afm)) {
          wijzig(boek, { cover_url: '', cover_bron: '', gb_gecontroleerd: '', cover_origineel: '', cover_bewaard: '' });
          gewist.push(String(boek.boek_id));
        }
      }
      nagekeken++;
      vanaf = String(boek.boek_id);
      if (nagekeken % 25 === 0 && bewaarAchtergrond(tabel)) props.setProperty(IA_CONTROLE_SLEUTEL, vanaf);
      Utilities.sleep(CV_PAUZE_MS);
    }
    if (bewaarAchtergrond(tabel)) props.setProperty(IA_CONTROLE_SLEUTEL, vanaf);
    rest = iaCoversTeControleren(tabel.rijen, vanaf).length;
  } finally {
    stopAchtergrond('controleerIaCovers');
  }
  verwijderTriggers('controleerIaCovers');
  if (rest > 0) planTaak('controleerIaCovers', (wachten ? 15 : 1) * 60 * 1000);
  else props.deleteProperty(IA_CONTROLE_SLEUTEL); // klaar: de volgende keer begint het vooraan
  if (gewist.length) leegCache();
  var tekst = nagekeken + ' covers van Internet Archive nagekeken, ' + gewist.length + ' gewist (enkel het logo)' +
    (laadtNiet ? ', ' + laadtNiet + ' laden niet en blijven staan' : '') + ', ' + rest + ' te gaan' + (wachten ? ' (Internet Archive is druk, later verder)' : '') + '.';
  logboek('menu', 'controleerIaCovers', tekst + (gewist.length ? ' Gewist: ' + gewist.join(', ') : ''));
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

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

/** Staan alle namen van a ook in b? */
function controleNamenIn(a, b) {
  var na = controleNamen(a), nb = controleNamen(b);
  return na.length > 0 && na.every(function (k) { return nb.some(function (m) { return controleZelfdeNaam(k, m); }); });
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

/** De woorden van titel en reeks samen (zonder het volumenummer), als de titel een reeksaanduiding heeft. Anders ''. */
function controleReeksWoorden(titel) {
  var m = schoon(titel).match(CONTROLE_REEKS);
  return m ? controleWoordenSet(m[1] + ' ' + m[2]) : '';
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

/** De titel zonder ondertitel. */
function controleTitelKort(titel) {
  return schoon(String(titel || '').split(CONTROLE_ONDERTITEL)[0]);
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

/** Sleutel om titels te vergelijken: enkel letters en cijfers, in kleine letters. */
function controleTitelSleutel(titel) {
  // "&" en "and" (en, et, und) zijn hetzelfde: "Ethics & Homosexuality" = "Ethics and Homosexuality".
  return normaliseerTekst(String(titel || '').replace(/&/g, ' ')).split(' ').filter(function (w) {
    return w && CONTROLE_EN_WOORDEN.indexOf(w) === -1;
  }).join(' ');
}

/** De woorden van een tekst, elk één keer, alfabetisch. */
function controleWoordenSet(tekst) {
  var uniek = [];
  normaliseerTekst(tekst).split(' ').forEach(function (w) { if (w && uniek.indexOf(w) === -1) uniek.push(w); });
  return uniek.sort().join(' ');
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

/** De bestandsnaam in Drive: het boek-ID, zodat je een cover terugvindt. */
function coverBestandsnaam(boek, type) {
  var ext = /png/i.test(type) ? 'png' : /webp/i.test(type) ? 'webp' : /gif/i.test(type) ? 'gif' : 'jpg';
  return String(boek.boek_id || 'boek') + '.' + ext;
}

/** Is deze afbeelding groot genoeg om een cover te zijn? Kent het script de afmetingen niet, dan wel. */
function coverGrootGenoeg(afm) {
  if (!afm || !afm.breedte || !afm.hoogte) return true;
  return afm.breedte >= CB_MIN_PIXELS && afm.hoogte >= CB_MIN_PIXELS;
}

/** Actie beheerCoverLinks: per boek de link naar de cover, voor de kleine covers in de lijsten van het bestuursscherm. */
function coverLinks(rijen) {
  var links = {};
  rijen.forEach(function (r) {
    var url = veiligeCoverUrl(r.cover_url);
    if (!isLeeg(r.boek_id) && url) links[String(r.boek_id)] = url;
  });
  return { ok: true, links: links };
}

/* ---------- Geschiedenis per boek en per lener (bestuursscherm) ---------- */

/**
 * Een site gaf een fout (geen antwoord, te druk, storing) voor deze cover. Geeft de nieuwe waarde voor
 * cover_bewaard: "poging N", of "mislukt" + datum na CB_MAX_POGINGEN keer. Zo blijft het script niet
 * eindeloos op dezelfde cover hangen.
 */
function coverPogingNaFout(coverBewaard, vandaag) {
  var m = String(coverBewaard || '').match(/^poging (\d+)/);
  var n = (m ? Number(m[1]) : 0) + 1;
  return n >= CB_MAX_POGINGEN ? CB_MISLUKT + vandaag : CB_POGING + n;
}

/**
 * Bewaart wat de browser bij Google Books en Open Library vond.
 * invoer.items: [{ boek_id, google, ol, bron, cover, meta: { beschrijving, uitgeverij, jaartal, paginas, taal } }]
 *   google / ol: dit boek werd daar opgezocht (dan krijgt het een datum in gb_gecontroleerd / cover_gezocht)
 *   bron: 'google', 'ol-isbn', 'ol-titel' of 'ia' (Internet Archive)
 * Enkel lege velden worden aangevuld (behalve een beschrijving van Wikipedia: Google vervangt die),
 * en enkel covers van Google, Open Library of Internet Archive.
 * (Oudere versie van de knop: { gezocht, resultaten } met enkel Google.)
 */
function coversBewaren(staat, invoer) {
  var items = invoer.items;
  if (!items && invoer.gezocht) {
    var perId = {};
    (invoer.resultaten || []).forEach(function (r) { perId[String(r.boek_id)] = r; });
    items = invoer.gezocht.map(function (id) {
      var r = perId[String(id)] || {};
      return { boek_id: id, google: true, bron: r.cover ? 'google' : '', cover: r.cover, meta: r };
    });
  }
  var covers = 0, n = 0, beschrijvingen = 0;
  (items || []).slice(0, 200).forEach(function (it) {
    var boek = boekVan(staat, String(it.boek_id));
    if (!boek) return;
    n++;
    var velden = {};
    if (it.google) velden.gb_gecontroleerd = staat.vandaag;
    if (it.ol) velden.cover_gezocht = staat.vandaag;
    if (it.ia) velden.ia_gezocht = staat.vandaag;
    var cover = String(it.cover || '').replace(/^http:/, 'https:');
    var m = it.meta || {};
    if (it.google || it.bron === 'google') {
      var info = {
        imageLinks: it.bron === 'google' && isGoogleCover(cover) ? { thumbnail: cover } : null,
        description: tekstInvoer(m.beschrijving, 5000), publisher: tekstInvoer(m.uitgeverij, 120),
        publishedDate: tekstInvoer(m.jaartal, 20), pageCount: parseerGetal(m.paginas) || 0, language: tekstInvoer(m.taal, 5)
      };
      var gb = verwerkGoogleBooks(boek, info);
      Object.keys(gb).forEach(function (k) { velden[k] = gb[k]; });
      if (gb.cover_url) velden.cover_bron = 'Google Books';
      if (gb.beschrijving) { beschrijvingen++; staat.vertalingNodig = true; }
    }
    if (!velden.cover_url && isLeeg(boek.cover_url) && (it.bron === 'ol-isbn' || it.bron === 'ol-titel') && isOlCover(cover)) {
      velden.cover_url = cover;
      velden.cover_bron = it.bron === 'ol-isbn' ? CV_ANDERE_UITGAVE : CV_TITEL_AUTEUR;
    }
    if (!velden.cover_url && isLeeg(boek.cover_url) && it.bron === 'ia' && /^https:\/\/archive\.org\/services\/img\/[A-Za-z0-9._-]+$/.test(cover)) {
      velden.cover_url = cover;
      velden.cover_bron = IA_BRON;
    }
    if (velden.cover_url) covers++;
    wijzig(boek, velden);
  });
  if (n) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['covers via de browser', n + ' opgezocht, ' + covers + ' covers, ' + beschrijvingen + ' beschrijvingen']);
  }
  return { ok: true, covers: covers, beschrijvingen: beschrijvingen };
}

/* ---------- Foto van een cover, genomen in de bib ---------- */

/*
 * Een bestuurslid neemt in de bib een foto van de cover (gsm). De browser verkleint die
 * en stuurt ze door. Het script bewaart ze in een map op Google Drive (instelling cover_map),
 * deelt ze als "iedereen met de link mag bekijken" en zet de link in cover_url.
 */

/**
 * De boeken zonder cover of zonder beschrijving die de browser nog moet opzoeken.
 * Een beschrijving van Wikipedia telt als ontbrekend voor Google: die vervangt ze.
 *   g: nog niet bij Google opgezocht (enkel met een ISBN): voor een cover en een beschrijving
 *   o: nog niet bij Open Library opgezocht voor een andere uitgave (ISBN, of titel en auteur)
 *   i: nog niet bij Internet Archive opgezocht (enkel met een ISBN)
 */
function coversTeZoeken(staat, metSleutel) {
  var boeken = [];
  staat.catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var zonderCover = isLeeg(b.cover_url);
    if (!zonderCover && !isLeeg(b.beschrijving) && !heeftWikiBeschrijving(b)) return;
    var isbn = /^\d{13}$/.test(String(b.isbn || '')) ? String(b.isbn) : '';
    // Google: voor een cover en voor een beschrijving. Open Library en Internet Archive: enkel voor een cover.
    var g = !!isbn && isLeeg(b.gb_gecontroleerd);
    var o = zonderCover && isLeeg(b.cover_gezocht) && (!!isbn || !isLeeg(b.titel));
    var i = zonderCover && !!isbn && isLeeg(b.ia_gezocht);
    if (g || o || i) boeken.push({ id: String(b.boek_id), isbn: isbn, t: schoon(b.titel), a: schoon(b.auteur), g: g, o: o, i: i });
  });
  // De sleutel van Google Books enkel voor het bestuur. Vrijwilligers zoeken zonder sleutel (trager, wel gratis).
  return { ok: true, boeken: boeken, sleutel: metSleutel === false ? '' : String(staat.inst.google_books_api_key || '') };
}

/**
 * Bewaart een foto als cover van een boek.
 * invoer: { boek_id, data (base64, zonder "data:..."), mime }
 * bewaar: functie (bestandsnaam, base64, mime) -> publieke link (Drive). Apart, zodat de tests zonder Drive kunnen.
 */
function coverUploaden(staat, invoer, bewaar) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var mime = String(invoer.mime || '');
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Enkel een foto als JPG, PNG of WebP.' };
  var data = String(invoer.data || '').replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, fout: 'Deze foto kon niet gelezen worden.' };
  if (data.length * 0.75 > FOTO_MAX_BYTES) return { ok: false, fout: 'Deze foto is te groot. Probeer opnieuw: de site verkleint ze normaal vanzelf.' };
  var url = bewaar(String(boek.boek_id) + '.' + FOTO_TYPES[mime], data, mime);
  if (!/^https:\/\//.test(String(url || ''))) return { ok: false, fout: 'Bewaren op Google Drive lukte niet.' };
  wijzig(boek, { cover_url: url, cover_bron: 'foto in de bib' });
  staat.catalogusGewijzigd = true;
  staat.log.push(['cover-foto', String(boek.boek_id)]);
  return { ok: true, tekst: 'De foto is de cover van "' + schoon(boek.titel) + '".', cover_url: url };
}

/*
 * Een cover via een link. Een link naar een webpagina (bol.com, een uitgeverij, Goodreads) of uit
 * Google Afbeeldingen is geen afbeelding: het script zoekt de afbeelding erachter (bij Google de
 * parameter imgurl, op een webpagina de og:image), haalt ze op en bewaart ze op Google Drive,
 * net als een foto. Zo blijft de cover werken, ook als de andere site de link verandert.
 */

/**
 * Bewaart de afbeelding achter een link als cover van een boek.
 * invoer: { boek_id, url }
 * haal: functie (url) -> { code, type, data (base64), tekst (bij HTML) }. bewaar: zoals bij coverUploaden.
 */
function coverVanLink(staat, invoer, haal, bewaar) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var url = echteAfbeeldingLink(invoer.url);
  if (!/^https:\/\/[^\s"'<>]+$/.test(url)) return { ok: false, fout: 'Plak een link die begint met https://' };
  var r = haal(url);
  if (r && r.code < 300 && /^text\/html/i.test(r.type || '')) {
    var beeld = afbeeldingUitHtml(r.tekst, url);
    if (!beeld) return { ok: false, fout: 'Op deze pagina vond ik geen afbeelding. Klik met de rechtermuisknop op de cover en kies "Adres van afbeelding kopiëren", en plak dat adres.' };
    r = haal(beeld);
  }
  if (r && r.code === 429) return { ok: false, fout: 'Google laat vandaag geen vragen naar buiten meer toe (daglimiet). Probeer het morgen opnieuw, of neem een foto.' };
  if (!r || !r.code || r.code >= 300) return { ok: false, fout: 'Deze link opent niet' + (r && r.code ? ' (code ' + r.code + ')' : '') + '. Probeer een andere link, of neem een foto.' };
  var mime = String(r.type || '').split(';')[0].trim().toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Achter deze link zit geen JPG, PNG of WebP. Kopieer het adres van de afbeelding zelf.' };
  if (String(r.data || '').length * 0.75 > LINK_MAX_BYTES) return { ok: false, fout: 'Deze afbeelding is te groot. Neem een kleinere, of maak een foto.' };
  var link = bewaar(String(boek.boek_id) + '.' + FOTO_TYPES[mime], r.data, mime);
  if (!/^https:\/\//.test(String(link || ''))) return { ok: false, fout: 'Bewaren op Google Drive lukte niet.' };
  wijzig(boek, { cover_url: link, cover_bron: 'link' });
  staat.catalogusGewijzigd = true;
  staat.log.push(['cover-link', String(boek.boek_id)]);
  return { ok: true, tekst: 'De afbeelding is de cover van "' + schoon(boek.titel) + '".', cover_url: link };
}

/** "1 dag" of "5 dagen". */
function dagenTekst(n) {
  return n + (n === 1 ? ' dag' : ' dagen');
}

/** Aantal dagen van datum a tot datum b (positief als b later is). */
function dagenTussen(a, b) {
  return Math.round((naarUtc(b) - naarUtc(a)) / 86400000);
}

/**
 * Het aantal dagen uit een formule als =DATEVALUE(I12+28+28) of =I12+28, als die naar de eigen rij
 * verwijst. Geeft null als het geen zo'n formule is.
 */
function dagenUitFormule(formule, rijnummer) {
  var m = String(formule || '').replace(/\s+/g, '').match(/^=(?:DATEVALUE\()?[A-Z]+(\d+)((?:\+\d+)+)\)?$/i);
  if (!m || Number(m[1]) !== rijnummer) return null;
  return m[2].split('+').filter(Boolean).reduce(function (som, n) { return som + Number(n); }, 0);
}

/** De uitleg als de daglimiet van Google op is. wacht: nog zoveel ms. */
function daglimietFilmTekst(wacht) {
  return 'De daglimiet van Google voor vragen naar andere websites is op. Probeer het over ' + Math.max(1, Math.ceil(wacht / 3600000)) + ' uur opnieuw. ' +
    'Zonder wachten: exporteer de lijst als CSV (bij IMDb of Letterboxd), importeer ze in een nieuw tabblad, open dat tabblad en kies Madrigal > Films > Neem de films over uit dit tabblad.';
}

/** Sinds wanneer (ms) de daglimiet op is, of 0. Een oudere melding in de cache telt ook. */
function daglimietSinds() {
  var props = PropertiesService.getScriptProperties();
  var sinds = Number(props.getProperty(DAGLIMIET_SLEUTEL)) || 0;
  var uitCache = 0;
  try { uitCache = Number(CacheService.getScriptCache().get(DAGLIMIET_SLEUTEL)) || 0; } catch (e) { uitCache = 0; }
  if (uitCache > sinds) { props.setProperty(DAGLIMIET_SLEUTEL, String(uitCache)); sinds = uitCache; }
  return sinds;
}

/** Hoeveel ms nog wachten na een daglimiet die om "sinds" (ms) genoteerd werd. 0: niet meer wachten. */
function daglimietWachttijd(sinds, nu) {
  sinds = Number(sinds) || 0;
  return sinds ? Math.max(0, sinds + DAGLIMIET_WACHT_MS - nu) : 0;
}

/**
 * Een cachesleutel per dag. Zo verschijnt gepland nieuws en een geplande leeslijst
 * vanzelf op de juiste dag, zonder dat iemand iets moet wissen.
 */
function dagSleutel(sleutel) {
  return sleutel + '_' + vandaagTekst().replace(/-/g, '');
}

/** Een getal dat per boek en per periode anders is: zo wisselt de keuze van de aanraders. */
function dagVolgorde(id, dag) {
  // FNV-1a met een eindmenging: een kleine wijziging in de datum geeft een heel andere volgorde.
  var tekst = id + '|' + dag;
  var h = 2166136261;
  for (var i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Het getal achter een datum in de spreadsheet: het aantal dagen sinds 30 december 1899. */
function datumNaarGetal(d) {
  // Met het uur erbij: een prijs van 7,50 is een halve dag (12:00). Afgerond op centen.
  var ms = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - Date.UTC(1899, 11, 30);
  return Math.round(ms / 864000) / 100;
}

/** Kolommen met een datum. Die schrijven we als echte datum in de spreadsheet. */

/**
 * Datum als leesbare tekst: "vrijdag 20 november".
 * Valt de datum in een ander jaar dan vandaag, dan komt het jaar erbij.
 */
function datumTekst(datum, vandaag) {
  if (!datum) return '';
  var d = naarUtc(datum);
  var tekst = WEEKDAGEN[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MAANDEN[d.getUTCMonth()];
  if (vandaag && vandaag.slice(0, 4) !== datum.slice(0, 4)) tekst += ' ' + d.getUTCFullYear();
  return tekst;
}

/**
 * Deelt de boeken in. catalogus wordt aangepast (wijzig). namen: rijen van het tabblad Categorieën en trefwoorden
 * ({ naam, soort, zoekwoorden }). Geeft [{ boek_id, titel, themas, categorieen, trefwoorden }] met wat erbij kwam.
 */
function deelBoekenIn(catalogus, namen, welke) {
  var kandidaten = (namen || []).filter(function (r) {
    var s = normaliseerTekst(r.soort);
    return (s === 'categorie' || s === 'trefwoord') && schoon(r.naam) && !themaExact(r.naam);
  }).map(function (r) {
    var categorie = normaliseerTekst(r.soort) === 'categorie';
    return { naam: schoon(r.naam), kolom: categorie ? 'categorieen' : 'trefwoorden', min: categorie ? INDELEN_MIN_CATEGORIE : INDELEN_MIN_TREFWOORD,
      minFilm: INDELEN_MIN_TREFWOORD_FILM,
      zoekwoorden: indelenZoekwoorden(r.naam, r.zoekwoorden) };
  });
  // Films hebben geen thema's maar genres. Een thema als Coming-out of Kolonialisme kan daarom bij een film
  // een trefwoord zijn (niet de thema's die eigenlijk een soort boek zijn, zoals Fictie of Poëzie).
  var filmKandidaten = kandidaten.filter(function (k) { return k.kolom === 'trefwoorden'; }).concat(alleThemas().filter(function (t) {
    return INDELEN_GEEN_FILMTREFWOORD.indexOf(t) === -1;
  }).map(function (t) {
    return { naam: t, kolom: 'trefwoorden', min: INDELEN_MIN_TREFWOORD_FILM, minFilm: INDELEN_MIN_TREFWOORD_FILM, zoekwoorden: indelenZoekwoorden(t, '') };
  }));
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel)) return;
    // Een film krijgt enkel trefwoorden: thema's en categorieën zijn voor boeken (een film heeft genres).
    var film = isFilm(b);
    // welke: 'boeken' of 'films' (menu), leeg = allebei (vanzelf, elke dag).
    if ((welke === 'boeken' && film) || (welke === 'films' && !film)) return;
    var titelWoorden = normaliseerTekst(b.titel).split(' ').filter(Boolean);
    // De beschrijving (NL en EN) en het genre (bij films bv. War of Drama van IMDb).
    var tekstWoorden = normaliseerTekst([b.beschrijving, b.beschrijving_en, b.genre].join(' ')).split(' ').filter(Boolean);
    var erbij = { extra_onderwerpen: [], categorieen: [], trefwoorden: [] };
    // Thema's: elk thema dat duidelijk voorkomt.
    if (!film) onderwerpScores(b).forEach(function (s) { if (s[1] >= ONDERWERP_ZEKER_MIN) erbij.extra_onderwerpen.push(s[0]); });
    (film ? filmKandidaten : kandidaten).forEach(function (k) {
      if (indelenScore(k.zoekwoorden, titelWoorden, tekstWoorden) >= (film ? k.minFilm : k.min)) erbij[k.kolom].push(k.naam);
    });
    var velden = {}, nieuw = {};
    Object.keys(erbij).forEach(function (kol) {
      var voor = splitsLijst(b[kol]);
      var na = voegLijstToe(b[kol], erbij[kol]);
      if (na !== voor.join(', ')) {
        velden[kol] = na;
        nieuw[kol] = splitsLijst(na).slice(voor.length);
      }
    });
    if (!Object.keys(velden).length) return;
    wijzig(b, velden);
    uit.push({ boek_id: String(b.boek_id), titel: schoon(b.titel), themas: (nieuw.extra_onderwerpen || []).join(', '),
      categorieen: (nieuw.categorieen || []).join(', '), trefwoorden: (nieuw.trefwoorden || []).join(', ') });
  });
  return uit;
}

/**
 * Vanzelf, één keer per dag (vanuit verwerkNieuweBoekenAutomatisch, die elk uur loopt): zo krijgen nieuwe boeken
 * en films hun thema's, categorieën en trefwoorden zodra hun beschrijving er is.
 */
function deelBoekenInAutomatisch() {
  var eigenschappen = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  if (eigenschappen.getProperty('indelen_laatst') === vandaag) return;
  if (!spreadsheet().getSheetByName('Categorieën en trefwoorden') || !spreadsheet().getSheetByName('Indeling')) return;
  eigenschappen.setProperty('indelen_laatst', vandaag);
  var uit = deelBoekenInUitvoeren();
  if (uit.length) logboek('systeem', 'deelBoekenIn', indelingTekst(uit));
}

/** Menu: Boeken > Deel de boeken in op titel en beschrijving. */
function deelBoekenInMenu() {
  zorgVoorTabbladen(['Catalogus', 'Categorieën en trefwoorden', 'Indeling']);
  var tekst = indelingTekst(deelBoekenInUitvoeren('boeken'), 'boeken');
  logboek('menu', 'deelBoekenIn', tekst);
  meld(tekst);
}

/** Deelt in en schrijft het tabblad Indeling. Geeft de rijen van Indeling. */
function deelBoekenInUitvoeren(welke) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var namen = leesTabel('Categorieën en trefwoorden').rijen;
    uit = deelBoekenIn(catalogus.rijen, namen, welke);
    if (uit.length) schrijfKolommen(catalogus, ['extra_onderwerpen', 'categorieen', 'trefwoorden']);
    if (uit.length) {
      var ss = spreadsheet();
      var blad = ss.getSheetByName('Indeling') || maakTabblad('Indeling');
      var kolommen = KOLOMMEN['Indeling'];
      blad.clear();
      var waarden = [kolommen].concat(uit.map(function (r) { return kolommen.map(function (k) { return r[k]; }); }));
      blad.getRange(1, 1, waarden.length, kolommen.length).setValues(waarden);
      opmaakKop(blad, kolommen.length);
    }
  } finally {
    lock.releaseLock();
  }
  // Het aantal boeken per naam bijwerken in Categorieën en trefwoorden.
  vernieuwCategorieen([]);
  leegCache();
  return uit;
}

/** Menu: Films > Deel de films in op titel en beschrijving (trefwoorden). */
function deelFilmsInMenu() {
  zorgVoorTabbladen(['Catalogus', 'Categorieën en trefwoorden', 'Indeling']);
  var tekst = indelingTekst(deelBoekenInUitvoeren('films'), 'films');
  logboek('menu', 'deelFilmsIn', tekst);
  meld(tekst);
}

/** GET: de publieke catalogus. */
function doGet(e) {
  var actie = e && e.parameter ? e.parameter.actie : '';
  if (actie === 'catalogus') return json(publiekeCatalogusJson(), true);
  if (actie === 'site') return json(siteInhoudJson(), true);
  return json(JSON.stringify({ ok: true, info: 'Catalogus Project Madrigal. Gebruik ?actie=catalogus.' }), true);
}

/** POST: acties voor de balie en het bestuur. */
function doPost(e) {
  var invoer;
  try {
    invoer = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, fout: 'Ongeldig verzoek.' });
  }
  if (!invoer || typeof invoer !== 'object') return json({ ok: false, fout: 'Ongeldig verzoek.' });
  var actie = String(invoer.actie || '');
  if (!ACTIES.hasOwnProperty(actie)) return json({ ok: false, fout: 'Onbekende actie.' });

  if (ACTIES[actie] === 'publiek') {
    try {
      return json(publiekeAanvraag(invoer));
    } catch (err) {
      logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
      return json({ ok: false, fout: 'Er ging iets mis. Probeer het later opnieuw of kom langs in de bib.' });
    }
  }

  var cache = CacheService.getScriptCache();
  if (codesGeblokkeerd(cache)) {
    return json({ ok: false, fout: 'Er werden te veel foute codes ingegeven. Probeer het over een kwartier opnieuw.', code: 'te_veel_pogingen' });
  }
  var rol = rolVoorCode(invoer.code, leesInstellingen());
  if (!rol) {
    // Even wachten maakt het raden van codes trager.
    Utilities.sleep(1500);
    if (telFouteCode(cache)) {
      logboek('systeem', 'beveiliging', FOUT_MAX + ' foute codes binnen een kwartier: het aanmelden is een kwartier geblokkeerd. Gebeurt dit vaak? Verander dan de codes in Instellingen.');
    }
    return json({ ok: false, fout: 'De code klopt niet.', code: 'ongeldige_code' });
  }
  // Het bestuur bekijkt het vrijwilligersscherm: dan gelden de rechten van een vrijwilliger.
  var echteRol = rol;
  rol = rolVoorScherm(rol, invoer.alsRol);
  if (actie === 'aanmelden') return json({ ok: true, rol: rol, echteRol: echteRol });
  if (!magActie(rol, actie)) {
    return json({ ok: false, fout: ACTIES[actie] === 'bestuur' ? 'Dit kan enkel met de code van het bestuur.' : 'Dit kan niet met deze code.' });
  }

  try {
    return json(voerActieUit(actie, invoer, rol));
  } catch (err) {
    logboek('systeem', 'fout', actie + ': ' + String(err && err.message || err).slice(0, 200));
    return json({ ok: false, fout: 'Er ging iets mis: ' + String(err && err.message || err) });
  }
}

/**
 * Vult de checklists en de veelgestelde vragen aan met het draaiboek, zonder iets te wissen.
 * Geeft { openen, sluiten (nieuwe teksten), punten (aantal nieuwe punten), vragen (aantal nieuwe vragen) }.
 */
function draaiboekAanvullen(inst, faqRijen) {
  var punten = 0;
  var vul = function (tekst, extra) {
    var regels = String(tekst || '').split('\n').map(function (r) { return r.trim(); }).filter(Boolean);
    extra.forEach(function (e) {
      if (regels.some(function (r) { return normaliseerTekst(r).indexOf(e[0]) > -1; })) return;
      if (e[2] === 'begin') regels.unshift(e[1]); else regels.push(e[1]);
      punten++;
    });
    return regels.join('\n');
  };
  var openen = vul(inst.tekst_checklist_openen, DRAAIBOEK_CHECKLIST.openen);
  var sluiten = vul(inst.tekst_checklist_sluiten, DRAAIBOEK_CHECKLIST.sluiten);
  var bekend = {};
  var volgorde = 0;
  faqRijen.forEach(function (r) {
    if (r.bron_id) bekend[String(r.bron_id)] = true;
    bekend[normaliseerTekst(r.vraag)] = true;
    volgorde = Math.max(volgorde, parseerGetal(r.volgorde) || 0);
  });
  var vragen = 0;
  DRAAIBOEK_VRAGEN.forEach(function (v) {
    if (bekend[v[0]] || bekend[normaliseerTekst(v[1])]) return;
    voegToe(faqRijen, { volgorde: ++volgorde, vraag: v[1], vraag_en: v[2], antwoord: v[3], antwoord_en: v[4], publiek: 'ja', bron_id: v[0] });
    vragen++;
  });
  return { openen: openen, sluiten: sluiten, punten: punten, vragen: vragen };
}

/** Het bestand in Google Drive achter een cover_url (https://lh3.googleusercontent.com/d/ID). Geeft '' als het geen Drive-link is. */
function driveIdUitCover(url) {
  var m = String(url || '').match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/) || String(url || '').match(/drive\.google\.com\/.*(?:id=|\/d\/)([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

/** Haalt uit een link van Google Afbeeldingen of een doorverwijzing van Google het echte adres. */
function echteAfbeeldingLink(url) {
  var u = schoon(url).replace(/^http:\/\//i, 'https://');
  var m = u.match(/^https:\/\/(?:www\.)?google\.[a-z.]+\/(?:imgres|url)\?(.*)$/i);
  if (m) {
    var param = m[1].split('&').map(function (p) { return p.split('='); })
      .filter(function (p) { return p[0] === 'imgurl' || p[0] === 'url' || p[0] === 'q'; })[0];
    if (param && param[1]) {
      try { u = decodeURIComponent(param[1]).replace(/^http:\/\//i, 'https://'); } catch (e) { /* laat zoals het is */ }
    }
  }
  return u;
}

/**
 * Eén naam in de vorm "Achternaam, Voornaam". Geeft { naam, zeker }. zeker = false: de naam bleef zoals hij was,
 * omdat het script niet weet welk woord de voornaam is.
 */
function eenAuteurNetjes(deel, kennis) {
  var naam = schoon(deel).replace(/\s+,/g, ',');
  if (!naam || naam.indexOf(',') > -1 || AUTEUR_AANVULLING.test(naam) || AUTEUR_ORGANISATIE.test(naam) || AUTEUR_GEEN_PERSOON.test(naam)) return { naam: naam, zeker: true };
  var woorden = naam.split(' ');
  if (woorden.length < 2) return { naam: naam, zeker: true };
  var eerste = woorden[0], laatste = woorden[woorden.length - 1];
  // "Ackerley J.R.": de achternaam staat vooraan, met de initialen erachter.
  if (AUTEUR_INITIALEN.test(laatste) && !AUTEUR_INITIALEN.test(eerste)) return { naam: eerste + ', ' + woorden.slice(1).join(' '), zeker: true };
  // "J.R. Ackerley": initialen vooraan.
  if (AUTEUR_INITIALEN.test(eerste)) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
  var rest = woorden.slice(1).join(' ');
  var voorVooraan = isVoornaam(eerste, kennis);
  var voorAchteraan = isVoornaam(rest, kennis) || isVoornaam(laatste, kennis);
  // "Kate Tempest": de voornaam staat vooraan.
  if (voorVooraan && !voorAchteraan) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
  // "Blackett Nancy", "Bringsvaerd Tor Age": de achternaam staat al vooraan, enkel de komma ontbreekt.
  if (voorAchteraan && !voorVooraan) return { naam: eerste + ', ' + rest, zeker: true };
  // Allebei een voornaam ("Thomas Mann"?): is het eerste woord een gekende achternaam en het laatste niet, dan achternaam vooraan.
  if (voorVooraan && voorAchteraan) {
    var achterEerste = !!(kennis && kennis.achternaam[normaliseerTekst(eerste)]);
    var achterLaatste = !!(kennis && kennis.achternaam[normaliseerTekst(laatste)]);
    if (achterLaatste && !achterEerste) return { naam: voornaamVooraanOmdraaien(woorden), zeker: true };
    if (achterEerste && !achterLaatste) return { naam: eerste + ', ' + rest, zeker: true };
  }
  return { naam: naam, zeker: false };
}

/** De eerste niet-lege waarde uit een lijst mogelijke veldnamen. */
function eersteVeld(rij, namen) {
  for (var i = 0; i < namen.length; i++) {
    var w = rij[namen[i]];
    if (w !== undefined && w !== null && String(w).trim() !== '') return w;
  }
  return '';
}

/**
 * Welke boeken eigen werk hebben, uit het Logboek: { beschrijving: { boek_id: true }, cover: { ... } }.
 * logRijen: [tijdstip, wie, actie, details].
 */
function eigenWerkUitLogboek(logRijen) {
  var eigen = { beschrijving: {}, cover: {} };
  (logRijen || []).forEach(function (r) {
    var actie = String(r[2] || ''), details = String(r[3] || '');
    var m = details.match(/^([A-Za-z]\d{3,})\s*:\s*(.*)$/);
    if (actie === 'boek aangepast' && m) {
      if (/\bbeschrijving\b/.test(m[2])) eigen.beschrijving[m[1]] = true;
      if (/\bcover_url\b/.test(m[2])) eigen.cover[m[1]] = true;
    }
    var v = details.match(/boek ([A-Za-z]\d{3,})/);
    if (actie === 'voorstel goedgekeurd' && v) eigen.beschrijving[v[1]] = true;
    if ((actie === 'cover-foto' || actie === 'cover-link') && /^[A-Za-z]\d{3,}$/.test(details.trim())) eigen.cover[details.trim()] = true;
  });
  return eigen;
}

/** Zoekt boek en exemplaar bij een exemplaarnummer. "B0012" mag ook als er maar één exemplaar is. */
function exemplaarInfo(staat, exemplaar) {
  var t = schoon(exemplaar).toUpperCase();
  var m = t.match(/^([A-Z]\d+)(?:-(\d+))?$/);
  if (!m) return null;
  var boek = boekVan(staat, m[1]);
  if (!boek) return null;
  var nr = m[2] ? Number(m[2]) : 1;
  if (nr < 1 || nr > aantalExemplaren(boek)) return null;
  return { boek: boek, exemplaar: boek.boek_id + '-' + nr };
}

/** Alle exemplaarnummers van een boek: ["B0012-1", "B0012-2"]. */
function exemplarenVan(boek) {
  var lijst = [];
  for (var i = 1; i <= aantalExemplaren(boek); i++) lijst.push(boek.boek_id + '-' + i);
  return lijst;
}

/**
 * Nieuwe leners per maand (laatste 12 maanden), hoeveel boeken nooit uitgeleend werden,
 * de gewone uitleenduur (mediaan) en hoeveel leners het voorbije jaar iets leenden.
 * Enkel wat de privacy-opruiming nog niet wiste.
 */
function extraCijfers(staat) {
  var vanaf = telMaandenOp(staat.vandaag, -11).slice(0, 7);
  var perMaand = {};
  for (var m = 0; m < 12; m++) {
    var sleutel = telMaandenOp(vanaf + '-01', m).slice(0, 7);
    perMaand[sleutel] = { maand: maandTekst(sleutel), aantal: 0 };
  }
  staat.leners.forEach(function (l) {
    var maand = String(parseerDatum(l.datum_inschrijving) || '').slice(0, 7);
    if (perMaand[maand]) perMaand[maand].aantal++;
  });
  var geleend = {};
  var dagen = [];
  var jaarGeleden = telMaandenOp(staat.vandaag, -12);
  var actief = {};
  staat.uitleningen.forEach(function (u) {
    geleend[String(u.boek_id)] = true;
    var uit = parseerDatum(u.datum_uit), terug = parseerDatum(u.datum_terug);
    if (uit && terug && !isVerlorenUitlening(u)) dagen.push(Math.round((Date.parse(terug) - Date.parse(uit)) / 86400000));
    if (uit && uit >= jaarGeleden) actief[String(u.lenersnummer)] = true;
  });
  var nooit = staat.catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && isUitleenbaar(b) && boekStatus(b) !== 'verloren' && !geleend[String(b.boek_id)];
  });
  // De mediaan: een paar uitleningen met een foute datum (een jaar te laat) trekken een gemiddelde scheef.
  dagen.sort(function (a, b) { return a - b; });
  var midden = Math.floor(dagen.length / 2);
  var mediaan = !dagen.length ? 0 : dagen.length % 2 ? dagen[midden] : Math.round((dagen[midden - 1] + dagen[midden]) / 2);
  return {
    nieuweLeners: Object.keys(perMaand).sort().map(function (k) { return perMaand[k]; }),
    nooitUitgeleend: nooit.length,
    mediaanDagen: mediaan,
    afgesloten: dagen.length,
    langerDanHalfJaar: dagen.filter(function (d) { return d > 183; }).length,
    actieveLeners: Object.keys(actief).length
  };
}

/* ---------- Meerdere boeken tegelijk aanpassen (bestuursscherm) ---------- */

function filmGenreNl(g) {
  var k = normaliseerTekst(g);
  return FILM_GENRES_NL[k] || schoon(g);
}

/** De filtergroepen van een film: de genres en de extra onderwerpen. */
function filmGroepen(rij) {
  var uit = [];
  filmLijst(rij.genre).concat(filmLijst(rij.extra_onderwerpen)).forEach(function (g) {
    var mooi = g.charAt(0).toUpperCase() + g.slice(1);
    if (uit.indexOf(mooi) === -1) uit.push(mooi);
  });
  return uit;
}

/* ---------- Letterboxd ---------- */

// htmlTekst staat in Hulp.js.

/** Een lijst uit een cel: "Drama, Romantiek" wordt ["Drama", "Romantiek"]. */
function filmLijst(waarde) {
  return splitsLijst(waarde).map(schoon).filter(Boolean);
}

/**
 * Leest de films uit de waarden van een tabblad (eerste rij: de kolomnamen).
 * Geeft [{ titel, jaar, regie, genre, duur, imdb, slug }] of null als het geen lijst met films is.
 * Afleveringen van een reeks laten we weg.
 */
function filmsUitTabel(waarden) {
  if (!waarden || waarden.length < 2) return null;
  var kop = waarden[0].map(normaliseerTekst);
  var kolom = {};
  Object.keys(FILM_KOLOMMEN).forEach(function (k) {
    kolom[k] = -1;
    FILM_KOLOMMEN[k].forEach(function (naam) { if (kolom[k] === -1) kolom[k] = kop.indexOf(naam); });
  });
  if (kolom.titel === -1) return null;
  var w = function (rij, k) { return kolom[k] > -1 ? rij[kolom[k]] : ''; };
  return waarden.slice(1).map(function (rij) {
    var titel = schoon(w(rij, 'titel'));
    if (!titel || /episode/i.test(String(w(rij, 'soort')))) return null;
    var imdb = (String(w(rij, 'imdb')).match(/tt\d{6,10}/) || [])[0] || '';
    return {
      titel: titel, jaar: parseerGetal(w(rij, 'jaar')) || '', imdb: imdb, slug: '', origineel: andereTitel(titel, w(rij, 'origineel')),
      regie: filmLijst(w(rij, 'regie')).slice(0, 3).join(', '),
      genre: filmLijst(w(rij, 'genres')).map(filmGenreNl).slice(0, FILM_MAX_GENRES).join(', '),
      duur: parseerGetal(w(rij, 'duur')) || ''
    };
  }).filter(Boolean);
}

/** Zet het antwoord van Wikidata om. Geeft [{ qid, lb, jaar, duur, regie, land, genre, taal, nl, en }]. */
function filmUitWikidata(data) {
  var w = function (b, k) { return b[k] ? String(b[k].value || '') : ''; };
  var lijst = function (b, k) { return w(b, k).split('|').map(schoon).filter(Boolean); };
  return (((data || {}).results || {}).bindings || []).map(function (b) {
    var qid = (w(b, 'film').match(/(Q\d+)$/) || [])[1] || '';
    return {
      qid: qid, lb: w(b, 'lb'), jaar: Number(w(b, 'jaar')) || '', duur: Math.round(Number(w(b, 'minuten'))) || '',
      regie: lijst(b, 'regie').filter(function (n, i, alle) { return alle.indexOf(n) === i; }),
      land: lijst(b, 'land'), genre: lijst(b, 'genre').slice(0, FILM_MAX_GENRES),
      taal: w(b, 'taal'), nl: w(b, 'nlTitel'), en: w(b, 'enTitel'), origineel: w(b, 'ot')
    };
  }).filter(function (f) { return f.qid; });
}

/**
 * Vult de lege velden van een film aan met wat Wikidata vond. Wat er al staat, blijft.
 * Geeft de velden voor wijzig().
 */
function filmVelden(rij, f) {
  var v = {};
  var leeg = function (k) { return isLeeg(rij[k]); };
  if (f.qid && leeg('wikidata')) v.wikidata = f.qid;
  if (f.regie.length && leeg('auteur')) v.auteur = uniekeNamen(f.regie).slice(0, 3).join(', ');
  if (f.jaar && leeg('jaartal')) v.jaartal = f.jaar;
  if (f.land.length && leeg('land')) v.land = f.land.slice(0, 3).join(', ');
  if (f.genre.length && leeg('genre')) v.genre = f.genre.map(function (g) { return g.charAt(0).toUpperCase() + g.slice(1); }).join(', ');
  if (f.duur && leeg('duur')) v.duur = f.duur;
  if (f.origineel && leeg('originele_titel') && andereTitel(rij.titel, f.origineel)) v.originele_titel = andereTitel(rij.titel, f.origineel);
  if (f.taal && leeg('taal')) v.taal = normaliseerTaal(f.taal) || f.taal;
  return v;
}

/** De vraag voor films met een nummer van IMDb (eigenschap P345). Het nummer komt in ?lb, de sleutel van het antwoord. */
function filmVraagImdb(nummers) {
  return FILM_SPARQL_KOP + '  VALUES ?lb { ' + nummers.map(sparqlTekst).join(' ') + ' }\n  ?film wdt:P345 ?lb .\n' + FILM_SPARQL_VELDEN + '} GROUP BY ?film ?lb';
}

/** De vraag voor films met een Letterboxd-adres (eigenschap P6127 van Wikidata). */
function filmVraagLetterboxd(slugs) {
  return FILM_SPARQL_KOP + '  VALUES ?lb { ' + slugs.map(sparqlTekst).join(' ') + ' }\n  ?film wdt:P6127 ?lb .\n' + FILM_SPARQL_VELDEN + '} GROUP BY ?film ?lb';
}

/** De vraag voor één film zonder Letterboxd-adres: op de titel (Engels of Nederlands), en het jaartal als dat gekend is. */
function filmVraagTitel(titel, jaar) {
  var t = schoon(titel);
  return FILM_SPARQL_KOP +
    '  VALUES ?soort { wd:Q11424 wd:Q24869 wd:Q506240 wd:Q93204 }\n' +
    '  { ?film rdfs:label ' + sparqlTekst(t) + '@en . } UNION { ?film rdfs:label ' + sparqlTekst(t) + '@nl . }\n' +
    '  ?film wdt:P31 ?soort .\n' + FILM_SPARQL_VELDEN +
    (jaar ? '  FILTER(!BOUND(?datum) || ABS(YEAR(?datum) - ' + Number(jaar) + ') <= 1)\n' : '') +
    '} GROUP BY ?film ?lb LIMIT 3';
}

/** De eerste alinea uit het antwoord van Wikipedia. Geeft { tekst, link } of {}. */
function filmWikiTekst(data) {
  var p = (((data || {}).query || {}).pages || [])[0];
  if (!p || p.missing || !p.extract || String(p.extract).length < 80) return {};
  var link = /^https:\/\/[a-z]{2,3}\.wikipedia\.org\/wiki\/[^\s"'<>]+$/.test(String(p.fullurl || '')) ? p.fullurl : '';
  return link ? { tekst: maakBeschrijvingNetjes(p.extract), link: link } : {};
}

/* ---------- Menu en achtergrondtaak (enkel in Apps Script) ---------- */

/** De vraag aan Wikipedia: de eerste alinea van één artikel. */
function filmWikiUrl(taal, titel) {
  return 'https://' + taal + '.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&prop=extracts%7Cinfo&exintro=1&explaintext=1&inprop=url&titles=' + encodeURIComponent(titel);
}

/**
 * Bepaalt de filtergroepen van een boek: via de vertaaltabel, de kolom
 * extra_onderwerpen, het vinkje klassieker en de soort (zines).
 * vertaal: object genre (genormaliseerd) -> lijst filtergroepen.
 */
function filtergroepenVan(boek, vertaal) {
  // Een genre met de naam van een thema (bv. Intersekse) komt enkel in dat thema, niet ook in een ander
  // dat de vertaaltabel er vroeger bij zette (Intersekse is geen Gender).
  var ruw = themaExact(boek.genre) ? [themaExact(boek.genre)] : (vertaal[normaliseerTekst(boek.genre)] || []).slice();
  splitsLijst(boek.extra_onderwerpen).forEach(function (g) { ruw.push(g); });
  if (jaNee(boek.klassieker) === 'ja') ruw.push('Klassiekers');
  if (normaliseerTekst(boek.soort) === 'zine') ruw.push('Zines');
  // Enkel de vaste thema's van de website. Een genre of andere naam wordt vertaald naar het thema
  // (Politiek wordt Maatschappij, Intersekse wordt Gender). Wat niet te vertalen is, valt weg.
  var uniek = [];
  ruw.forEach(function (g) {
    themaVan(g, vertaal).forEach(function (t) { if (uniek.indexOf(t) === -1) uniek.push(t); });
  });
  return uniek;
}

/** Het adres van de API van GoatCounter voor een code. Enkel letters, cijfers en streepjes. */
function gcBasis(code) {
  var c = schoon(code).toLowerCase();
  return /^[a-z0-9-]+$/.test(c) ? 'https://' + c + '.goatcounter.com/api/v0' : '';
}

/** Eén regel over een mislukte vraag: welk onderdeel, de code en het begin van het antwoord. */
function gcFoutRegel(sleutel, code, tekst) {
  var kort = schoon(String(tekst || '').replace(/<[^>]*>/g, ' ')).slice(0, 120);
  return sleutel + ': ' + code + (kort ? ' (' + kort + ')' : '');
}

/** Begin en einde van een periode van zoveel dagen, tot en met vandaag. */
function gcPeriode(vandaag, dagen) {
  var start = parseerDatum(telDagenOp(vandaag, -(dagen - 1)));
  return { start: start + 'T00:00:00Z', end: vandaag + 'T23:59:59Z' };
}

/**
 * Wat het bestuursscherm krijgt. Lukte niets, dan een fout met de details per onderdeel.
 * Lukte een deel, dan de cijfers en een waarschuwing over wat ontbreekt.
 */
function gcUitkomst(data, mislukt, dagen, code) {
  if (!Object.keys(data).length) {
    var geenSite = mislukt.some(function (m) { return /no site at this domain/i.test(m); });
    return {
      ok: false,
      fout: geenSite ? 'GoatCounter kent de code ' + code + ' niet. Kijk de instelling goatcounter_code na.'
        : 'GoatCounter gaf geen cijfers. Antwoord per onderdeel: ' + mislukt.join('; ')
    };
  }
  var r = { ok: true, cijfers: verwerkGoatcounter(data, dagen) };
  // Enkel het totaal ontbrak en de schatting lukte: geen waarschuwing, wel een woordje uitleg in het scherm.
  var rest = mislukt.filter(function (m) { return !(r.cijfers.geschat && /^totaal:/.test(m)); });
  if (rest.length) r.waarschuwing = 'Niet alles kwam binnen: ' + rest.join('; ');
  return r;
}

/** De vragen die we stellen, als { sleutel: url }. */
function gcVragen(basis, periode) {
  var q = 'start=' + encodeURIComponent(periode.start) + '&end=' + encodeURIComponent(periode.end);
  return {
    totaal: basis + '/stats/total?' + q,
    paginas: basis + '/stats/hits?' + q + '&limit=15',
    bronnen: basis + '/stats/toprefs?' + q + '&limit=10',
    toestellen: basis + '/stats/sizes?' + q + '&limit=10',
    landen: basis + '/stats/locations?' + q + '&limit=10'
  };
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

/**
 * Een exemplaar komt vrij (teruggebracht, reservatie vervallen of geannuleerd).
 * Wacht er iemand op dit boek, dan krijgt de eerste in de wachtrij dit exemplaar.
 * Geeft de melding voor de vrijwilliger terug, of null.
 */
function geefExemplaarDoor(staat, boekId, exemplaar) {
  var wachtend = actieveReservaties(staat, boekId).filter(function (r) { return r.status === STATUS_WACHT; });
  if (!wachtend.length) return null;
  var r = wachtend[0];
  wijzig(r, {
    status: STATUS_KLAAR, exemplaar: exemplaar, datum_klaar: staat.vandaag,
    ophalen_tot: berekenOphaalTermijn(staat.vandaag, staat.inst)
  });
  staat.log.push(['reservatie klaar', r.reservatie_id + ' ' + exemplaar + ' voor lener ' + r.lenersnummer]);
  return apartLeggenMelding(staat, r);
}

/**
 * Geeft elke rij zonder boek-ID (maar met een titel) een boek-ID, de datum van
 * vandaag in toegevoegd_op en nette waarden (ISBN, taal, ...). Geeft het aantal terug.
 */
function geefNieuweBoekenEenId() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    tabel.rijen.forEach(function (rij) {
      if (!isLeeg(rij.boek_id) || isLeeg(rij.titel)) return;
      var soort = soortVan(rij);
      var isbn = normaliseerIsbn(rij.isbn);
      var velden = {
        boek_id: ids.nieuw(soort),
        soort: soort,
        titel: schoon(rij.titel), auteur: soort === 'film' ? schoon(rij.auteur) : auteurNetjes(rij.auteur, kennis || (kennis = auteurKennis(tabel.rijen))),
        isbn: isbn.isbn || isbn.issn || schoon(rij.isbn),
        taal: normaliseerTaal(rij.taal),
        uitvoering: normaliseerUitvoering(rij.uitvoering),
        nieuwstaat: jaNee(rij.nieuwstaat),
        aantal: parseerGetal(rij.aantal) || 1,
        uitleenbaar: jaNee(rij.uitleenbaar) || 'ja',
        publiek: jaNee(rij.publiek) || 'ja',
        toegevoegd_op: parseerDatum(rij.toegevoegd_op) || vandaagTekst()
      };
      velden.bron_sleutel = bronSleutel({ soort: soort, isbn: velden.isbn, titel: velden.titel, auteur: velden.auteur });
      wijzig(rij, velden);
      aantal++;
    });
    if (aantal) {
      bewaarTabel(tabel);
      ids.bewaar();
    }
  } finally {
    lock.releaseLock();
  }
  return aantal;
}

/**
 * Boeken die het bestuur zelf koos in Na te kijken: een enkel boek-ID in de kolom boek_id bij een
 * regel van de historiek of van een lopende uitlening. Geeft { 'oud blad rij 12': 'B0034' }.
 */
function gekozenOudeBoeken(naTeKijkenRijen) {
  var uit = {};
  (naTeKijkenRijen || []).forEach(function (r) {
    if (r.bron !== 'Overzetten' || (r.veld !== 'historiek' && r.veld !== 'uitlening') || jaNee(r.afgehandeld) === 'ja') return;
    var m = String(r.waarde_bron || '').match(/\[(oud blad rij \d+)\]/);
    var id = schoon(r.boek_id).toUpperCase();
    if (m && /^[BZF]\d{4,}$/.test(id)) uit[m[1]] = id;
  });
  return uit;
}

/** Hulp voor parseerDatum: controleert of dag en maand bestaan. */
function geldigeDatum(jaar, maand, dag) {
  var d = new Date(Date.UTC(jaar, maand - 1, dag));
  if (d.getUTCFullYear() !== jaar || d.getUTCMonth() !== maand - 1 || d.getUTCDate() !== dag) return '';
  return jaar + '-' + tweeCijfers(maand) + '-' + tweeCijfers(dag);
}

function geldigEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Telefoonnummer: cijfers, spaties, +, /, . en - ; minstens 8 cijfers. */
function geldigeTelefoon(t) {
  return /^[+0-9 ()\/.\-]{8,25}$/.test(t) && t.replace(/\D/g, '').length >= 8;
}

/** Gelijkenis tussen twee teksten, van 0 (niets gemeen) tot 1 (gelijk). */
function gelijkenis(a, b) {
  if (!a && !b) return 1;
  var max = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / max;
}

/** Een mooie schrijfwijze: hoofdletter vooraan, de rest zoals de meest gebruikte variant, korte afkortingen blijven groot. */
function genreMooi(genre) {
  var vast = genreVast(genre);
  if (vast) return vast;
  var t = schoon(genre);
  // Alles in hoofdletters (behalve een afkorting): naar kleine letters.
  if (t.length > 5 && t === t.toUpperCase()) t = t.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** De sleutel om genres te vergelijken: kleine letters, zonder accenten, x = ks, zonder meervoud. */
function genreSleutel(genre) {
  return normaliseerTekst(String(genre || '').replace(/x/gi, 'ks')).split(' ').filter(Boolean).map(genreWoordStam).join(' ');
}

/**
 * Past de opkuislijst toe. rijen: de rijen van Genres opkuisen (toepassen = ja). Daarna de thema's in de juiste
 * schrijfwijze. Geeft { genres: aantal hernoemde genres, boeken: aantal aangepaste boeken, themas: aantal aangepaste cellen }.
 */
function genresOpkuisen(onderwerpRijen, catalogus, rijen) {
  var naar = {};
  (rijen || []).forEach(function (r) {
    if (jaNee(r.toepassen) === 'ja' && !isLeeg(r.genre_nu) && !isLeeg(r.genre_nieuw)) naar[schoon(r.genre_nu)] = schoon(r.genre_nieuw);
  });
  var uit = { genres: Object.keys(naar).length, boeken: 0, themas: 0 };
  catalogus.forEach(function (b) {
    var nieuw = naar[schoon(b.genre)];
    if (nieuw && nieuw !== schoon(b.genre)) { wijzig(b, { genre: nieuw }); uit.boeken++; }
  });
  // Onderwerpen: de varianten samen in één rij, met de thema's van allemaal.
  var perNaam = {};
  onderwerpRijen.forEach(function (r) {
    if (r._verwijderen) return;
    var naam = naar[schoon(r.genre)] || schoon(r.genre);
    if (!naam) return;
    var doel = perNaam[naam];
    if (!doel) {
      perNaam[naam] = r;
      if (naam !== schoon(r.genre)) wijzig(r, { genre: naam });
      return;
    }
    var samen = splitsLijst(doel.filtergroepen);
    splitsLijst(r.filtergroepen).forEach(function (f) { if (samen.indexOf(f) === -1) samen.push(f); });
    wijzig(doel, { filtergroepen: samen.join(', ') });
    markeerVerwijderen(r);
  });
  // Thema's in de juiste schrijfwijze.
  var telling = themaTelling(onderwerpRijen.filter(function (r) { return !r._verwijderen; }), catalogus);
  onderwerpRijen.forEach(function (r) {
    if (r._verwijderen) return;
    var m = themasMooi(r.filtergroepen, telling);
    if (m !== splitsLijst(r.filtergroepen).join(', ')) { wijzig(r, { filtergroepen: m }); uit.themas++; }
  });
  catalogus.forEach(function (b) {
    if (isLeeg(b.extra_onderwerpen)) return;
    var m = themasMooi(b.extra_onderwerpen, telling);
    if (m !== splitsLijst(b.extra_onderwerpen).join(', ')) { wijzig(b, { extra_onderwerpen: m }); uit.themas++; }
  });
  return uit;
}

/* ---------- In Apps Script ---------- */

/** De vaste schrijfwijze van een genre uit GENRE_SCHRIJFWIJZE_LIJST, of ''. */
function genreVast(genre) {
  if (!GENRE_SCHRIJFWIJZE_CACHE) {
    GENRE_SCHRIJFWIJZE_CACHE = {};
    Object.keys(GENRE_SCHRIJFWIJZE_LIJST).forEach(function (k) { GENRE_SCHRIJFWIJZE_CACHE[genreSleutel(k)] = GENRE_SCHRIJFWIJZE_LIJST[k]; });
  }
  return GENRE_SCHRIJFWIJZE_CACHE[genreSleutel(genre)] || '';
}

/**
 * De voorstellen voor de genres: groepen van varianten met één naam. Geeft [{ genre_nu, aantal_boeken, genre_nieuw,
 * toepassen }] voor elk genre dat een andere naam krijgt, gesorteerd op de nieuwe naam.
 */
function genreVoorstellen(onderwerpRijen, catalogus) {
  var tel = {};
  catalogus.forEach(function (b) { if (!isFilm(b) && !isLeeg(b.genre)) { var g = schoon(b.genre); tel[g] = (tel[g] || 0) + 1; } });
  onderwerpRijen.forEach(function (r) { var g = schoon(r.genre); if (g && !tel[g]) tel[g] = 0; });
  // Groepen op sleutel.
  var groepen = {};
  Object.keys(tel).forEach(function (g) { var k = genreSleutel(g); (groepen[k] = groepen[k] || []).push(g); });
  // Tikfouten: een groep met weinig boeken die bijna gelijk is aan een grotere groep, gaat daarin op.
  var sleutels = Object.keys(groepen).sort(function (a, b) { return totaal(groepen[b]) - totaal(groepen[a]); });
  function totaal(lijst) { return lijst.reduce(function (s, g) { return s + tel[g]; }, 0); }
  sleutels.forEach(function (k, i) {
    if (!groepen[k]) return;
    for (var j = 0; j < i; j++) {
      var groot = sleutels[j];
      if (!groepen[groot] || groot === k) continue;
      var max = Math.min(k.length, groot.length) >= 8 ? 2 : Math.min(k.length, groot.length) >= 5 ? 1 : 0;
      if (max && levenshtein(k, groot) <= max) { groepen[groot] = groepen[groot].concat(groepen[k]); delete groepen[k]; return; }
    }
  });
  var uit = [];
  Object.keys(groepen).forEach(function (k) {
    var lijst = groepen[k];
    // De naam: de meest gebruikte variant, bij gelijkspel de kortste (het enkelvoud).
    var beste = lijst.slice().sort(function (a, b) { return tel[b] - tel[a] || a.length - b.length || a.localeCompare(b); })[0];
    var nieuw = genreMooi(beste);
    lijst.forEach(function (g) {
      if (g !== nieuw) uit.push({ genre_nu: g, aantal_boeken: tel[g], genre_nieuw: nieuw, toepassen: 'ja' });
    });
  });
  return uit.sort(function (a, b) { return a.genre_nieuw.localeCompare(b.genre_nieuw, 'nl') || a.genre_nu.localeCompare(b.genre_nu, 'nl'); });
}

/** Een woord zonder meervoud en met enkele klinkers: zo vallen roman/romans en verhaal/verhalen samen. */
function genreWoordStam(w) {
  if (w.length > 6 && /ieen$/.test(w)) w = w.slice(0, -2);        // biografieen -> biografie
  else if (w.length > 5 && /en$/.test(w)) w = w.slice(0, -2);     // gedichten -> gedicht, verhalen -> verhal
  else if (w.length > 4 && /s$/.test(w) && !/(ss|is|us)$/.test(w)) w = w.slice(0, -1); // romans -> roman
  return w.replace(/aa/g, 'a').replace(/ee/g, 'e').replace(/oo/g, 'o').replace(/uu/g, 'u').replace(/(.)\1/g, '$1');
}

/** Goodreads zet ISBN's als ="0123456789". Dit haalt die tekens weg. */
function goodreadsIsbn(waarde) {
  return normaliseerIsbn(String(waarde || '').replace(/[="]/g, '')).isbn;
}

/** De eerste niet-lege waarde uit een lijst Goodreads-kolommen. */
function goodreadsWaarde(rij, kolommen) {
  for (var i = 0; i < kolommen.length; i++) {
    var w = rij[kolommen[i]];
    if (!isLeeg(w) && String(w).trim() !== '0') return w;
  }
  return '';
}

/**
 * Kent Google Books een boek dat het zeker kent? Zo weten we of de verbinding en de sleutel werken.
 * Geeft { werkt, fout, vreemd } terug. fout: het antwoord van Google als dat een fout was (daglimiet, storing, sleutel).
 * vreemd: Google gaf andere boeken terug dan het bekende boek (Google zoekt dan verkeerd, zoals op 29/10/2026).
 * zoek(isbn): standaard googleBooksZoek met de sleutel (een andere functie kan in de tests).
 */
function googleBooksControle(sleutel, zoek) {
  zoek = zoek || function (isbn) { return googleBooksZoek(isbn, sleutel, undefined, GB_CONTROLE_BOEKEN[isbn]); };
  var vreemd = false;
  for (var i = 0; i < GB_CONTROLE_ISBNS.length; i++) {
    var r = zoek(GB_CONTROLE_ISBNS[i]);
    if (r.items.length) return { werkt: true, fout: null, vreemd: false };
    if (r.fout) return { werkt: false, fout: r, vreemd: false };
    // Google gaf wel boeken terug, maar niet dit bekende boek: dan geeft Google verkeerde resultaten.
    if (r.totaal > 0) vreemd = true;
  }
  return { werkt: false, fout: null, vreemd: vreemd };
}

/** Het adres om bij Google Books op titel (en achternaam van de auteur) te zoeken. */
function googleBooksTitelUrl(boek, sleutel) {
  var q = 'intitle:"' + titelKern(boek.titel) + '"' + (achternaam(boek.auteur) ? ' inauthor:' + achternaam(boek.auteur) : '');
  return 'https://www.googleapis.com/books/v1/volumes?q=' + encodeURIComponent(q) + '&maxResults=10&country=BE' +
    (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
}

/**
 * Het adres om een ISBN op te vragen bij Google Books.
 * country=BE: Apps Script draait op servers van Google, zonder gekend land. Zonder
 * land weigert Google met "Cannot determine user location" (unknownLocation).
 */
function googleBooksUrl(isbn, sleutel, land, vorm) {
  return 'https://www.googleapis.com/books/v1/volumes?q=' + (vorm === 'vrij' ? '' : 'isbn:') + encodeURIComponent(isbn) +
    (land === '' ? '' : '&country=' + (land || 'BE')) + (sleutel ? '&key=' + encodeURIComponent(sleutel) : '');
}

/**
 * Eén vraag aan Google Books. Geeft { code, items, limiet, fout, info }.
 * info: kort wat Google antwoordde (code en aantal resultaten), voor de test.
 * Een antwoord dat geen JSON is (bv. een webpagina van Google), telt als storing (code 502).
 */
function googleBooksVraag(url) {
  var a = haalJson(url);
  var r = { code: a.code, items: (a.data && a.data.items) || [], limiet: false, fout: '' };
  if (a.code >= 400) {
    r.fout = googleFout(a.data) || ('code ' + a.code);
    r.limiet = isGoogleLimiet(a.code, r.fout);
  } else if (!a.data) {
    r.fout = 'Google gaf een onleesbaar antwoord (code ' + a.code + ', geen JSON)';
    r.code = 502;
  }
  r.totaal = a.data ? Number(a.data.totalItems) || 0 : 0;
  r.info = 'code ' + a.code + (a.data ? ', ' + r.totaal + ' gevonden' : ', onleesbaar');
  // Welke boeken Google teruggaf (hoogstens 3), zodat de test toont waarom een uitgave niet bruikbaar is.
  if (r.items.length) r.info += ' (' + r.items.slice(0, 3).map(googleItemKort).join('; ') + ')';
  return r;
}

/**
 * Zoekt een ISBN op bij Google Books. Geeft { code, items, limiet, fout } terug.
 * boek (optioneel): { titel, auteur } uit de Catalogus. Dan telt ook een andere uitgave van hetzelfde boek.
 *   limiet: Google zegt dat de daglimiet op is (dan later opnieuw proberen);
 *   fout:   wat Google zelf als reden geeft, bv. "API not enabled" of een probleem met de sleutel.
 */
function googleBooksZoek(isbn, sleutel, land, boek) {
  // Eerst op het ISBN als gewoon getal: dat werkt bij Google het best. We nemen enkel een
  // uitgave met precies dat ISBN. Levert dat niets op, dan als reserve de vorm "isbn:…".
  var r = googleBooksVraag(googleBooksUrl(isbn, sleutel, land, 'vrij'));
  if (!r.fout) {
    r.items = googleItemsMetIsbn(r.items, isbn, boek);
    r.info += ', ' + r.items.length + ' bruikbaar';
  }
  r.pogingen = [r.info];
  if (r.limiet || r.items.length) return r;
  var reserve = googleBooksVraag(googleBooksUrl(isbn, sleutel, land));
  reserve.pogingen = [r.info, reserve.info];
  // totaal: Google vond iets (ook al was het niet dit ISBN). Dan werken de verbinding en de sleutel.
  reserve.totaal = Math.max(r.totaal || 0, reserve.totaal || 0);
  // Is de daglimiet op bij de tweede vraag, dan moet het script dat ook weten (anders lijkt het boek onbekend).
  if (!reserve.fout || reserve.limiet) return reserve;
  // Een storing bij de tweede vraag: als de eerste wel lukte, is het boek gewoon niet gevonden.
  return r.fout ? r : { code: 200, items: [], limiet: false, fout: '', pogingen: reserve.pogingen, totaal: reserve.totaal };
}

/** De foutmelding uit een antwoord van Google, kort. */
function googleFout(data) {
  var e = data && data.error;
  if (!e) return '';
  var reden = e.errors && e.errors[0] && e.errors[0].reason ? ' (' + e.errors[0].reason + ')' : '';
  return String(e.message || e.status || '').replace(/\s+/g, ' ').slice(0, 200) + reden;
}

/** Een uitgave van Google kort: "Titel, Auteur, ISBN 978...". */
function googleItemKort(it) {
  var v = (it && it.volumeInfo) || {};
  var isbn = (v.industryIdentifiers || []).filter(function (id) { return id.type === 'ISBN_13'; })[0] ||
    (v.industryIdentifiers || [])[0];
  return [schoon(v.title) || '?', (v.authors || []).map(schoon).join(' & '), isbn ? String(isbn.type || '') + ' ' + String(isbn.identifier || '') : 'geen ISBN']
    .filter(Boolean).join(', ').slice(0, 120);
}

/**
 * De uitgaven met precies dit ISBN (13 of 10 cijfers). Is er geen, dan de uitgaven zonder enig ISBN:
 * Google vond die op het nummer, maar toont het niet (dat gebeurt soms). Is er ook die niet en kennen
 * we het boek (boek: { titel, auteur }), dan een andere uitgave met dezelfde titel en auteur: de cover
 * en de beschrijving van dezelfde roman in een andere uitgave. Een ander boek nemen we nooit.
 */
function googleItemsMetIsbn(items, isbn, boek) {
  var gezocht = [String(isbn), isbn13Naar10(isbn)].filter(Boolean);
  function isbns(it) {
    return ((it && it.volumeInfo && it.volumeInfo.industryIdentifiers) || []).filter(function (id) { return /^ISBN/.test(String(id.type || '')); })
      .map(function (id) { return String(id.identifier || '').replace(/[^0-9X]/gi, '').toUpperCase(); });
  }
  var juist = (items || []).filter(function (it) { return isbns(it).some(function (i) { return gezocht.indexOf(i) > -1; }); });
  if (juist.length) return juist;
  var zonder = (items || []).filter(function (it) { return !isbns(it).length; });
  if (zonder.length || !boek || !boek.titel) return zonder;
  return (items || []).filter(function (it) { return zelfdeBoek(it.volumeInfo || {}, boek); });
}

/** Waarom een ronde stopte en wanneer het script verdergaat, voor het Logboek. Leeg als het gewoon doorloopt. */
function googleRondeReden(limiet, storing, fout, rest) {
  if (!rest) return '';
  if (limiet) return (!fout || /quota|limit/i.test(fout) ? ' (daglimiet van Google bereikt' : ' (Google weigert') + ', gaat vanzelf verder rond 9 uur in de ochtend)';
  if (storing) return ' (storing bij Google, gaat over 15 minuten vanzelf verder)';
  return '';
}

/** De uitkomst van de test in gewone woorden. r: het antwoord van googleBooksZoek. */
function googleTestTekst(isbn, r, sleutel, werkt, vreemd) {
  var info = r.items.length ? r.items[0].volumeInfo : null;
  var regels = [];
  if (r.fout) {
    regels.push('Google Books werkt niet.');
    regels.push(r.limiet ? 'De daglimiet van je sleutel is op. Het script gaat vanzelf verder rond 9 uur in de ochtend.' : 'Google meldt: ' + r.fout);
  } else if (info) {
    regels.push('Google Books werkt.');
    regels.push('ISBN ' + isbn + ': "' + (info.title || '?') + '", cover ' + (info.imageLinks ? 'ja' : 'nee') + ', beschrijving ' + (info.description ? 'ja' : 'nee') + '.');
  } else if (werkt) {
    regels.push('Google Books werkt, maar kent ISBN ' + isbn + ' niet.');
  } else if (vreemd) {
    regels.push('Google Books zoekt nu verkeerd: op het ISBN van een bekend boek komen andere boeken terug. Dat ligt bij Google, niet bij je sleutel.');
    regels.push('Het script vinkt zolang geen boeken af als "niet gevonden". Probeer de test morgen opnieuw.');
  } else {
    // Geen fout, maar ook geen bekend boek: dat gebeurt soms even bij Google. Later opnieuw proberen.
    regels.push('Google Books gaf geen enkel boek terug, ook geen boek dat het zeker kent, en meldde geen fout. Probeer de test over een uur opnieuw. Blijft het zo, kijk dan de google_books_api_key in Instellingen na.');
  }
  if (!sleutel) regels.push('Er staat geen google_books_api_key in Instellingen.');
  return regels.join('\n');
}

/**
 * Uit de resultaten op titel en auteur: de cover (en beschrijving als die ontbreekt) van een uitgave die
 * hetzelfde boek is (zelfdeBoek: titel en achternaam). Jaartal, uitgeverij en pagina's nemen we niet over:
 * die horen bij een andere uitgave. Geeft de velden, of {}.
 */
function googleTitelVelden(boek, items) {
  var juist = (items || []).filter(function (it) { return zelfdeBoek(it.volumeInfo || {}, boek); });
  var v = {};
  juist.some(function (it) {
    var links = it.volumeInfo.imageLinks || {};
    var cover = links.thumbnail || links.smallThumbnail;
    if (!cover) return false;
    v.cover_url = String(cover).replace(/^http:/, 'https:').replace(/&edge=curl/, '');
    v.cover_bron = GB_TITEL_BRON;
    return true;
  });
  if (isLeeg(boek.beschrijving)) {
    var tekst = beschrijvingUitItems(juist, boek);
    if (tekst) v.beschrijving = tekst;
  }
  return v;
}

/**
 * Herstel: het thema Graphic novel kwam vroeger ook bij boeken met enkel het woord "graphic" in de titel of
 * de beschrijving (graphic sex, graphic design). Haalt het thema weg bij boeken waar "graphic" staat maar
 * niets anders op een graphic novel wijst (geen graphic novel, strip, comic of manga in de tekst, het genre,
 * de categorieën of de trefwoorden). Geeft de boek_id's.
 */
function graphicNovelHerstellen(catalogus, vertaal) {
  var weg = [];
  catalogus.forEach(function (b) {
    var themas = splitsLijst(b.extra_onderwerpen);
    if (!themas.some(function (t) { return normaliseerTekst(t) === 'graphic novel'; })) return;
    var tekst = normaliseerTekst([b.titel, b.beschrijving, b.beschrijving_en].join(' '));
    if (!/\bgraphic\b/.test(tekst)) return;
    var bewijs = onderwerpScores(b).some(function (s) { return s[0] === 'Graphic novel'; }) ||
      [b.genre].concat(splitsLijst(b.categorieen), splitsLijst(b.trefwoorden)).some(function (n) {
        return themaVan(n, vertaal || {}).indexOf('Graphic novel') > -1;
      });
    if (bewijs) return;
    wijzig(b, { extra_onderwerpen: themas.filter(function (t) { return normaliseerTekst(t) !== 'graphic novel'; }).join(', ') });
    weg.push(String(b.boek_id));
  });
  return weg;
}

/** Eén keer (vanuit verwerkNieuweBoekenAutomatisch): het herstel hierboven op de Catalogus. */
function graphicNovelHerstellenEenmalig() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('graphic_novel_hersteld')) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var weg;
  try {
    var catalogus = leesTabel('Catalogus');
    weg = graphicNovelHerstellen(catalogus.rijen, vertaalTabel(leesTabel('Onderwerpen').rijen));
    if (weg.length) schrijfKolommen(catalogus, ['extra_onderwerpen']);
  } finally {
    lock.releaseLock();
  }
  props.setProperty('graphic_novel_hersteld', vandaagTekst());
  if (weg.length) {
    leegCache();
    logboek('systeem', 'graphicNovelHerstellen', 'Het thema Graphic novel weggehaald bij ' + weg.length + ' boeken die het enkel door het woord "graphic" kregen: ' + weg.join(', '));
  }
}

/** Menu: zet de gsm-nummers in het tabblad Leners in één vorm. */
function gsmNummersMenu() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var tabel = leesTabel('Leners');
    var n = gsmNummersOpmaken(tabel.rijen);
    if (n) bewaarTabel(tabel);
    leegCache();
    logboek('menu', 'gsmNummersMenu', n + ' leners aangepast');
    meld(n ? n + ' gsm-nummers staan nu in de vorm 0495/64.48.48. Vaste en buitenlandse nummers bleven zoals ze waren.' : 'Alle gsm-nummers stonden al in de vorm 0495/64.48.48.');
  } finally {
    lock.releaseLock();
  }
}

/** Zet de gsm-nummers van de leners in één vorm. Geeft het aantal aangepaste leners. */
function gsmNummersOpmaken(leners) {
  var n = 0;
  leners.forEach(function (l) {
    if (isLeeg(l.telefoon)) return;
    var nieuw = opmaakGsm(l.telefoon);
    if (nieuw !== String(l.telefoon)) { wijzig(l, { telefoon: nieuw }); n++; }
  });
  return n;
}

/* ---------- Grenzen ---------- */

/** Haalt een link op voor coverVanLink (enkel in Apps Script). */
function haalCoverLink(url) {
  var a;
  try {
    a = haalExtern(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (Project Madrigal)' } });
  } catch (e) {
    // daglimiet: Google zelf (UrlFetch) weigert vandaag, niet de site. Dan ligt het aan geen enkele cover.
    return { code: isDaglimietFout(e) ? 429 : 0, type: '', daglimiet: isDaglimietFout(e) };
  }
  var type = String((a.getHeaders() || {})['Content-Type'] || (a.getHeaders() || {})['content-type'] || '');
  var uit = { code: a.getResponseCode(), type: type };
  if (/^image\//i.test(type)) uit.data = Utilities.base64Encode(a.getBlob().getBytes());
  else if (/html/i.test(type)) uit.tekst = a.getContentText().slice(0, 300000);
  return uit;
}

/** Vraag naar buiten (zoals UrlFetchApp.fetch). Bij de daglimiet: noteren en de lopende taak over 6 uur herstarten. */
function haalExtern(url, opties) {
  try {
    return UrlFetchApp.fetch(url, opties);
  } catch (e) {
    if (isDaglimietFout(e)) {
      noteerDaglimiet();
      if (HUIDIGE_TAAK) planTaak(HUIDIGE_TAAK, herstartNaDaglimiet(HUIDIGE_TAAK, DAGLIMIET_WACHT_MS));
    }
    throw e;
  }
}

/** Haalt JSON op. Geeft { code, data } terug. */
function haalJson(url) {
  // Api-User-Agent: de manier die Wikipedia aanraadt om je script te herkennen.
  var antwoord = haalExtern(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT, 'Api-User-Agent': BS_USER_AGENT } });
  var data = null;
  try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = null; }
  return { code: antwoord.getResponseCode(), data: data };
}

/** Menu: haalt de films van de lijst bij Letterboxd (instelling letterboxd_lijst) en zet nieuwe films in de Catalogus. */
function haalLetterboxdLijst() {
  var url = schoon(leesInstellingen().letterboxd_lijst);
  if (!isLetterboxdLijst(url)) { meld('Vul bij Instellingen letterboxd_lijst het adres van de lijst in, bv. https://letterboxd.com/naam/list/lijst/'); return; }
  var wacht = 0;
  try { wacht = daglimietWachttijd(daglimietSinds(), Date.now()); } catch (e) { wacht = 0; }
  if (wacht) { meld(daglimietFilmTekst(wacht)); return; }
  var films = [], fout = '';
  for (var n = 1; n <= LETTERBOXD_MAX_PAGINAS; n++) {
    var r;
    try {
      r = haalExtern(letterboxdPaginaUrl(url, n), { muteHttpExceptions: true, followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ' + BS_USER_AGENT + ')', 'Accept-Language': 'en' } });
    } catch (e) { fout = String(e.message || e); break; }
    if (r.getResponseCode() === 404 && n > 1) break; // geen pagina meer
    if (r.getResponseCode() !== 200) { fout = 'Letterboxd gaf code ' + r.getResponseCode(); break; }
    var opPagina = letterboxdFilms(r.getContentText());
    var nieuw = opPagina.filter(function (f) { return !films.some(function (x) { return x.slug === f.slug; }); });
    if (!nieuw.length) break;
    films = films.concat(nieuw);
    Utilities.sleep(800);
  }
  if (!films.length && isDaglimietFout(fout)) {
    logboek('menu', 'haalLetterboxdLijst', 'niets gevonden: daglimiet van Google');
    meld(daglimietFilmTekst(DAGLIMIET_WACHT_MS));
    return;
  }
  if (!films.length) {
    logboek('menu', 'haalLetterboxdLijst', 'niets gevonden' + (fout ? ': ' + fout : ''));
    meld('Het script kon de lijst niet lezen' + (fout ? ' (' + fout + ')' : '') + '. Letterboxd laat scripts soms niet binnen. ' +
      'Typ dan de titels en jaartallen in de Catalogus, met soort "film" en zonder boek_id. Kies daarna Madrigal > Films > Vul de films aan.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('letterboxd') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var ids = maakIdGenerator(tabel.rijen);
    aantal = voegFilmsToe(tabel.rijen, films, vandaagTekst(), ids.nieuw);
    if (aantal) { bewaarTabel(tabel); ids.bewaar(); zetGetalopmaak(spreadsheet().getSheetByName('Catalogus'), ['duur']); }
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'haalLetterboxdLijst', films.length + ' films op de lijst, ' + aantal + ' nieuw in de Catalogus' + (fout ? ' (gestopt: ' + fout + ')' : ''));
  if (aantal) planTaak('vulFilmsAan', 60 * 1000);
  meld(films.length + ' films op de lijst gevonden, ' + aantal + ' nieuw in de Catalogus.' + (aantal ? ' Over een minuut zoekt het script regie, land, genre en omschrijving op.' : '') +
    (fout ? ' Let op: het script stopte bij een pagina (' + fout + '). Probeer later opnieuw voor de rest.' : ''));
}

/** Alle boeken van de oude databank, per 1000. Probeert eerst de tabel books, dan de publieke views. */
function haalOudeBoeken(db) {
  var pogingen = [['books', '*,authors(name),tags(*)'], ['books', '*,authors(name)'], ['books', '*'], ['books_public_view_2', '*'], ['books_public_view', '*']];
  for (var p = 0; p < pogingen.length; p++) {
    var alles = [], fout = false;
    for (var van = 0; ; van += OUD_PER_PAGINA) {
      var a = UrlFetchApp.fetch(db.url + '/rest/v1/' + pogingen[p][0] + '?select=' + encodeURIComponent(pogingen[p][1]) + '&order=id&limit=' + OUD_PER_PAGINA + '&offset=' + van, {
        muteHttpExceptions: true, headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
      });
      if (a.getResponseCode() !== 200) { fout = true; break; }
      var deel = [];
      try { deel = JSON.parse(a.getContentText()) || []; } catch (e) { fout = true; break; }
      alles = alles.concat(deel);
      if (deel.length < OUD_PER_PAGINA) break;
    }
    if (!fout && alles.length) return { bron: pogingen[p][0], rijen: alles };
  }
  return { bron: '', rijen: [] };
}

/** Haalt een tabel op uit de oude databank. Geeft [] als die niet bestaat. */
function haalOudeTabel(db, tabel) {
  var antwoord = UrlFetchApp.fetch(db.url + '/rest/v1/' + tabel + '?select=*', {
    muteHttpExceptions: true,
    headers: { apikey: db.sleutel, Authorization: 'Bearer ' + db.sleutel }
  });
  if (antwoord.getResponseCode() !== 200) return [];
  try { return JSON.parse(antwoord.getContentText()) || []; } catch (e) { return []; }
}

/** Planning (elke nacht) en menu: haalt het programma op en bewaart het. */
function haalPeperfabriekOp() {
  var url = String(leesInstellingen().peperfabriek_url || '').trim();
  if (!url) return { ok: true, aantal: 0 };
  var r;
  try { r = pfHaal(url); } catch (e) { logboek('planning', 'peperfabriek', 'niet bereikbaar: ' + e.message); return { ok: false }; }
  var p = pfLeesProgramma(r.html, url, vandaagTekst(), r.ical);
  if (!p.activiteiten.length) {
    // Niets gevonden: het vorige programma blijft staan.
    logboek('planning', 'peperfabriek', 'niets gevonden (code ' + r.code + ')');
    return { ok: false, aantal: 0 };
  }
  PropertiesService.getScriptProperties().setProperty(PF_EIGENSCHAP, JSON.stringify({ opgehaald: vandaagTekst(), manier: p.manier, activiteiten: p.activiteiten.slice(0, PF_MAX) }));
  leegCache();
  return { ok: true, aantal: p.activiteiten.length, manier: p.manier };
}

/** Vraagt één maand op bij de roostertool. */
function haalRoosterMaand(url, code, maand) {
  var antwoord = haalExtern(url, {
    method: 'post',
    contentType: 'text/plain',
    payload: JSON.stringify({ actie: 'maand', code: code, maand: maand }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  try { return JSON.parse(antwoord.getContentText()); } catch (e) { return { ok: false, fout: 'Het rooster gaf een onverwacht antwoord.' }; }
}

/** Voor het vrijwilligersscherm: de handleiding in het Nederlands en het Engels, met de afspraken voor lenen. */
function handleiding(inst) {
  var maak = function (tekst, taal) {
    var blokken = handleidingBlokken(tekst);
    // De afspraken na het eerste blok (wat Madrigal is), anders bovenaan.
    blokken.splice(blokken.length > 1 ? 2 : 0, 0, uitleenAfspraken(inst, taal));
    return blokken;
  };
  return { nl: maak(inst.tekst_handleiding, 'nl'), en: maak(inst.tekst_handleiding_en, 'en') };
}

/**
 * Een tekst met titels (# vooraan) en opsommingen (- vooraan) wordt een lijst blokken:
 * [{ titel, regels: [{ punt: true/false, tekst }] }]. Tekst voor de eerste titel komt in een blok zonder titel.
 */
function handleidingBlokken(tekst) {
  var blokken = [];
  String(tekst || '').split('\n').forEach(function (r) {
    var regel = String(r).trim();
    if (!regel) return;
    if (/^#/.test(regel)) { blokken.push({ titel: schoon(regel.replace(/^#+/, '')), regels: [] }); return; }
    if (!blokken.length) blokken.push({ titel: '', regels: [] });
    var punt = /^[-*•]\s*/.test(regel);
    blokken[blokken.length - 1].regels.push({ punt: punt, tekst: schoon(regel.replace(/^[-*•]\s*/, '')) });
  });
  return blokken.filter(function (b) { return b.titel || b.regels.length; }).slice(0, 40);
}

/** Heeft dit boek nog een cover nodig van een andere uitgave? */
function heeftAndereUitgaveNodig(boek) {
  if (!isLeeg(boek.cover_url) || !isLeeg(boek.cover_gezocht) || isFilm(boek)) return false;
  return /^\d{13}$/.test(String(boek.isbn || '')) || !isLeeg(boek.titel);
}

/** Moet het script voor dit boek nog een beschrijving zoeken? (Ook als enkel Google nog moet.) */
function heeftBeschrijvingNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.beschrijving_gezocht) && !wachtOpGoogle(boek)) return false;
  return isLeeg(boek.beschrijving);
}

/** Heeft dit boek nog een cover van bol.com nodig? */
function heeftBolNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.bol_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** Moet de cover van dit boek nog naar Drive? */
function heeftCoverBewarenNodig(boek) {
  if (!isExterneCover(boek.cover_url)) return false;
  // Mislukt voor precies deze link: niet opnieuw. Een nieuwe link (bv. zelf aangepast) probeert het wel.
  return !(String(boek.cover_bewaard || '').indexOf(CB_MISLUKT) === 0 && schoon(boek.cover_origineel) === schoon(boek.cover_url));
}

/** Heeft deze film nog gegevens van Wikidata of Wikipedia nodig? */
function heeftFilmGegevensNodig(rij) {
  return isFilm(rij) && !isLeeg(rij.titel) && isLeeg(rij.film_gezocht);
}

/** Heeft dit boek nog een cover nodig van Google Books? */
function heeftGoogleBooksNodig(boek) {
  if (!/^\d{13}$/.test(String(boek.isbn || ''))) return false;
  if (!isLeeg(boek.gb_gecontroleerd)) return false;
  return isLeeg(boek.cover_url);
}

/**
 * Tweede ronde: een boek zonder cover dat op ISBN niets opleverde, of dat geen ISBN heeft.
 * gb_gecontroleerd krijgt daarna "TA" + de datum. Films niet.
 */
function heeftGoogleTitelNodig(boek) {
  if (!isLeeg(boek.cover_url) || isLeeg(boek.titel) || isFilm(boek)) return false;
  var gezocht = String(boek.gb_gecontroleerd || '');
  if (gezocht.indexOf(GB_OP_TITEL) === 0) return false;
  return !/^\d{13}$/.test(String(boek.isbn || '')) || !isLeeg(gezocht);
}

/** Heeft dit boek nog een cover van Internet Archive nodig? */
function heeftIaNodig(boek) {
  return isLeeg(boek.cover_url) && isLeeg(boek.ia_gezocht) && /^\d{13}$/.test(String(boek.isbn || ''));
}

/** Heeft dit boek nog iets nodig van Open Library? */
function heeftOpenLibraryNodig(boek) {
  var isbn = String(boek.isbn || '');
  if (!/^\d{13}$/.test(isbn)) return false;
  if (!isLeeg(boek.ol_gecontroleerd)) return false;
  return OL_VELDEN.some(function (v) { return isLeeg(boek[v]); });
}

/** Moet de cover van dit boek nog gekopieerd worden van de oude website? */
function heeftOudeCoverNodig(boek) {
  return !isLeeg(boek.oude_cover);
}

/* ---------- In Apps Script ---------- */

/**
 * Moet het script dit boek nog op titel en auteur zoeken? Een boek zonder beschrijving dat op ISBN niets
 * opleverde, of dat geen ISBN heeft. Films en zines niet: die hebben hun eigen bronnen.
 */
function heeftTitelZoekNodig(boek) {
  if (!isLeeg(boek.beschrijving) || isLeeg(boek.titel) || isFilm(boek)) return false;
  if (normaliseerTekst(boek.soort) === 'zine') return false;
  var gezocht = String(boek.beschrijving_gezocht || '');
  if (gezocht.indexOf(BS_OP_TITEL) === 0 || wachtOpGoogle(boek)) return false;
  // Met een ISBN: eerst de gewone zoektocht op ISBN.
  return !/^\d{13}$/.test(String(boek.isbn || '')) || !isLeeg(gezocht);
}

/** Moet deze beschrijving nog vertaald worden? */
function heeftVertalingNodig(boek) {
  return !isLeeg(boek.beschrijving) && isLeeg(boek.beschrijving_vertaald);
}

/** De beschrijving komt van Wikipedia (dan staat er een link naar Wikipedia in beschrijving_bron). */
function heeftWikiBeschrijving(boek) {
  return !isLeeg(boek.beschrijving) && /^https:\/\/[a-z]{2,3}\.wikipedia\.org\//.test(String(boek.beschrijving_bron || ''));
}

/** Heeft dit boek nog een beschrijving van Wikipedia nodig? */
function heeftWikiNodig(boek) {
  if (isFilm(boek)) return false; // films: zie Films.js
  return isLeeg(boek.beschrijving) && isLeeg(boek.wiki_gezocht) && !isLeeg(boek.titel) && !isLeeg(boek.auteur);
}

/**
 * Menu: wist de Catalogus en bouwt ze opnieuw op uit Stock en Zines.
 * Enkel bedoeld voor de eerste opbouw. Wat je met de hand in de Catalogus
 * aanpaste, gaat verloren. Het script weigert zodra er uitleningen of
 * reservaties zijn, want die verwijzen naar de boek-ID's.
 */
function herbouwCatalogus() {
  if (leesTabel('Uitleningen').rijen.length || leesTabel('Reservaties').rijen.length) {
    meld('De Catalogus opnieuw opbouwen kan niet meer: er zijn al uitleningen of reservaties. Die verwijzen naar de boek-ID\'s.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var antwoord = ui.alert('Catalogus opnieuw opbouwen',
    'Dit wist alle boeken in het tabblad Catalogus, ook wat je er met de hand aanpaste, en bouwt ze opnieuw op uit Stock en Zines. De boek-ID\'s beginnen opnieuw bij B0001. Doorgaan?',
    ui.ButtonSet.YES_NO);
  if (antwoord !== ui.Button.YES) return;
  var blad = spreadsheet().getSheetByName('Catalogus');
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, blad.getLastColumn()).clearContent();
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('teller_boek_B');
  props.deleteProperty('teller_boek_Z');
  logboek('menu', 'herbouwCatalogus', 'Catalogus gewist');
  maakCatalogus();
}

/** Vult de herinneringstekst in voor een uitlening. */
function herinneringTekst(sjabloon, info, staat) {
  return String(sjabloon || '')
    .replace(/\{voornaam\}/g, info.voornaam || '')
    .replace(/\{titel\}/g, info.titel || '')
    .replace(/\{vervaldatum\}/g, datumTekst(info.vervaldatum, staat.vandaag));
}

/** Bestuur: noteren dat een herinnering verstuurd werd. */
function herinneringVerstuurd(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  wijzig(u, { laatste_herinnering: staat.vandaag });
  staat.log.push(['herinnering verstuurd', u.uitlening_id]);
  return { ok: true, tekst: 'Herinnering genoteerd op ' + korteDatum(staat.vandaag) + '.' };
}

/**
 * Hernoemt een leeslijst in alle boeken, of haalt ze weg (nieuw leeg). Geeft het aantal aangepaste boeken.
 */
function hernoemLeeslijst(catalogus, oud, nieuw) {
  var sleutel = normaliseerTekst(oud);
  var n = 0;
  catalogus.forEach(function (b) {
    var namen = splitsLijst(b.leeslijsten);
    var i = namen.map(normaliseerTekst).indexOf(sleutel);
    if (i === -1) return;
    if (nieuw) namen[i] = nieuw; else namen.splice(i, 1);
    namen = namen.filter(function (x, j) { return namen.map(normaliseerTekst).indexOf(normaliseerTekst(x)) === j; });
    wijzig(b, { leeslijsten: leeslijstTekst(namen) });
    n++;
  });
  return n;
}

/** Na hoeveel ms een taak herstart als de daglimiet nog zo lang (wacht) duurt. */
function herstartNaDaglimiet(naam, wacht) {
  return wacht + (VOORRANG_TAKEN.indexOf(naam) > -1 ? 0 : VOORRANG_MS);
}

/** Menu: zoekt de afgebroken beschrijvingen opnieuw op, volledig. */
function herstelAfgebrokenBeschrijvingen() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var tabel = leesTabel('Catalogus');
    n = maakAfgebrokenLeeg(tabel.rijen);
    bewaarTabel(tabel);
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'herstelAfgebrokenBeschrijvingen', n + ' beschrijvingen opnieuw te zoeken');
  if (!n) { meld('Er zijn geen afgebroken beschrijvingen.'); return; }
  meld(n + ' afgebroken beschrijvingen worden opnieuw opgezocht en vertaald. Dat gebeurt in porties en gaat vanzelf verder. Het Logboek toont de stand.');
  vulBeschrijvingenAan();
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

/**
 * Herstelt de jaartallen van het oude blad (zie bovenaan). Van onder naar boven, zodat elke rij
 * vergelijkt met rijen eronder die al hersteld zijn.
 */
function herstelOudeDatums(rijen) {
  for (var i = rijen.length - 1; i >= 0; i--) {
    var o = rijen[i];
    if (!o.datum_uit) continue;
    // 1. Later dan de volgende rijen? Dan een jaar te laat ingevuld.
    var volgende = rijen.slice(i + 1, i + 11).map(function (x) { return x.datum_uit; }).filter(Boolean).sort()[0];
    for (var n = 0; n < 3 && volgende && dagenTussen(volgende, o.datum_uit) > 90; n++) o.datum_uit = telMaandenOp(o.datum_uit, -12);
    // 2. Terug vóór de ontlening? Dan de ontlening een jaar vroeger als dat past, anders de terugdatum later.
    var terug = o.terug_op === 'ok' ? '' : parseerDatum(o.terug_op);
    if (terug && terug < o.datum_uit && telMaandenOp(o.datum_uit, -12) <= terug) o.datum_uit = telMaandenOp(o.datum_uit, -12);
    if (terug) o.terug_op = binnenJaarNa(terug, o.datum_uit);
    // 3. De afgesproken datum: uit de formule, anders binnen het jaar na de ontlening.
    o.datum_terug_afgesproken = o.dagen_formule !== null ? telDagenOp(o.datum_uit, o.dagen_formule) : binnenJaarNa(o.datum_terug_afgesproken, o.datum_uit);
    if (o.herinnering_ok) o.herinnering = o.datum_terug_afgesproken;
  }
  rijen.forEach(function (o) { delete o.dagen_formule; delete o.herinnering_ok; });
  return rijen;
}

/**
 * Een teruggebrachte uitlening die al overgenomen is: zet de herstelde datums erin (zie bovenaan).
 * Enkel bij wat het script zelf overzette. Geeft true als er iets veranderde.
 */
function herstelOudeTerug(u, o, inst) {
  if (u.vrijwilliger !== 'overgezet' || isLeeg(u.datum_terug) || !o.datum_uit) return false;
  var d = oudeTerugDatums(o, inst);
  var nieuw = { datum_uit: o.datum_uit, oorspronkelijke_vervaldatum: d.verval, vervaldatum: d.verval, datum_terug: d.terug };
  var bg = oudeBorgEnGift(o, inst);
  nieuw.borg_terugbetaald = bg.bedrag > 0 ? d.terug : '';
  if (o.herinnering && !isLeeg(u.laatste_herinnering)) nieuw.laatste_herinnering = o.herinnering;
  var anders = Object.keys(nieuw).some(function (k) { return (parseerDatum(u[k]) || '') !== nieuw[k]; }) ||
    Number(u.borg || 0) !== bg.bedrag || Number(u.gift || 0) !== bg.gift;
  if (anders) {
    nieuw.borg = bg.bedrag;
    nieuw.betaalwijze_borg = bg.betaalwijze;
    nieuw.gift = bg.gift || '';
    wijzig(u, nieuw);
  }
  return anders;
}

/** Het hoogste exemplaarnummer dat nu uitgeleend of apart gelegd is. */
function hoogsteExemplaarInGebruik(staat, boekId) {
  var hoogste = 0;
  var tel = function (ex) {
    var m = String(ex || '').match(/-(\d+)$/);
    if (m && String(ex).indexOf(boekId + '-') === 0) hoogste = Math.max(hoogste, Number(m[1]));
  };
  lopendeUitleningen(staat).forEach(function (u) { if (u.boek_id === boekId) tel(u.exemplaar); });
  actieveReservaties(staat, boekId).forEach(function (r) { tel(r.exemplaar); });
  return hoogste;
}

/** HTML uit de oude databank naar gewone tekst met regeleinden. */
function htmlNaarTekst(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlTekst(t) {
  // &amp; eerst: zo wordt ook een dubbel gecodeerd teken (&amp;#x27;) goed. Daarna &#39;, &#x27; en namen zoals &rsquo;.
  return schoon(String(t || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]{1,6});/gi, function (m, n) { return String.fromCharCode(parseInt(n, 16)); })
    .replace(/&#(\d{1,7});/g, function (m, n) { return String.fromCharCode(Number(n)); })
    .replace(/&([a-z]+);/gi, function (m, n) { return HTML_NAMEN.hasOwnProperty(n.toLowerCase()) ? HTML_NAMEN[n.toLowerCase()] : m; }));
}

/** De link om na te kijken: de oorspronkelijke link van Internet Archive als de cover al in Drive staat. */
function iaControleLink(boek) {
  var origineel = schoon(boek.cover_origineel);
  return /archive\.org/i.test(origineel) ? origineel : schoon(boek.cover_url);
}

/** Haalt een afbeelding op en kijkt of het een staande cover is (en niet het logo van Internet Archive). */
function iaCoverIsEcht(url) {
  try {
    var r = haalExtern(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT } });
    if (r.getResponseCode() !== 200) return false;
    return isStaandeCover(afbeeldingAfmetingen(r.getBlob().getBytes()));
  } catch (e) {
    if (isDaglimietFout(e)) throw e; // geen "geen cover": later opnieuw
    return false;
  }
}

/** De boeken met een cover van Internet Archive, om in de browser na te kijken. */
function iaCoversLijst(staat) {
  return {
    ok: true,
    boeken: staat.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && schoon(b.cover_bron) === IA_BRON && !isLeeg(b.cover_url); })
      .map(function (b) { return { id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), cover: String(b.cover_url) }; })
  };
}

/** De boeken met een cover van Internet Archive, op boek-ID, na het boek-ID vanaf (leeg: allemaal). */
function iaCoversTeControleren(rijen, vanaf) {
  return rijen.filter(function (b) {
    return !isLeeg(b.boek_id) && schoon(b.cover_bron) === IA_BRON && !isLeeg(b.cover_url) && (!vanaf || String(b.boek_id) > vanaf);
  }).sort(function (a, b) { return String(a.boek_id) < String(b.boek_id) ? -1 : 1; });
}

/**
 * Wist covers van Internet Archive die enkel het logo tonen. invoer: { ids: [...] }
 * Enkel covers met bron Internet Archive. Het boek komt daarna weer aan de beurt bij Google.
 */
function iaCoversWissen(staat, invoer) {
  var n = 0;
  (invoer.ids || []).slice(0, 2000).forEach(function (id) {
    var boek = boekVan(staat, String(id));
    if (!boek || schoon(boek.cover_bron) !== IA_BRON) return;
    wijzig(boek, { cover_url: '', cover_bron: '', gb_gecontroleerd: '' });
    n++;
  });
  if (n) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['logo van Internet Archive gewist', n + ' covers']);
  }
  return { ok: true, gewist: n, tekst: n + ' covers met het logo van Internet Archive gewist.' };
}

/** Kiest uit het antwoord van Internet Archive de eerste bruikbare link, of ''. */
function iaCoverUitAntwoord(data) {
  var docs = (data && data.response && data.response.docs) || [];
  for (var i = 0; i < docs.length; i++) {
    var url = iaCoverUrl(docs[i].identifier);
    if (url) return url;
  }
  return '';
}

/** De link naar de afbeelding van een boek bij Internet Archive. Enkel veilige namen. */
function iaCoverUrl(identifier) {
  var id = String(identifier || '');
  return /^[A-Za-z0-9._-]+$/.test(id) ? 'https://archive.org/services/img/' + id : '';
}

/** De zoekvraag voor Internet Archive: het ISBN in 13 en in 10 cijfers. */
function iaZoekUrl(isbn) {
  var nummers = [String(isbn), isbn13Naar10(isbn)].filter(Boolean).join(' OR ');
  return 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('isbn:(' + nummers + ')') +
    '&fl%5B%5D=identifier&fl%5B%5D=title&rows=3&output=json';
}

/** Boeken die op deze datum bij Internet Archive opgezocht werden en geen cover kregen. */
function iaZonderCoverOp(rijen, datum) {
  return rijen.filter(function (b) { return isLeeg(b.cover_url) && parseerDatum(b.ia_gezocht) === datum; });
}

/** Het getal in een boek-ID: B0123 wordt 123. */
function idNummer(id) {
  return Number(String(id).replace(/\D/g, '')) || 0;
}

/** Menu: neemt nieuws, agenda en veelgestelde vragen over van de oude website. */
function importeerOudeSite() {
  installeer(); // zorgt dat de tabbladen Nieuws, Agenda en Veelgestelde vragen bestaan
  var db = vindOudeDatabank();
  var posts = haalOudeTabel(db, 'posts');
  if (!posts.length) posts = haalOudeTabel(db, 'view_posts');
  var events = haalOudeTabel(db, 'events');
  var faq = haalOudeTabel(db, 'faq');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var tellers = {};
  try {
    [['Nieuws', zetOudeNieuwsOm(posts, db.url)], ['Agenda', zetOudeEventsOm(events, db.url)], ['Veelgestelde vragen', zetOudeFaqOm(faq)]].forEach(function (paar) {
      var tabel = leesTabel(paar[0]);
      tellers[paar[0]] = voegOudeRijenToe(tabel.rijen, paar[1]);
      bewaarTabel(tabel);
    });
  } finally {
    lock.releaseLock();
  }
  leegCache();
  // Welke velden de oude databank had: handig als er iets ontbreekt.
  var velden = function (rijen) { return rijen.length ? Object.keys(rijen[0]).join(', ') : '(leeg)'; };
  logboek('menu', 'importeerOudeSite', 'nieuws: ' + velden(posts) + ' | events: ' + velden(events) + ' | faq: ' + velden(faq));
  meld('Overgenomen van de oude website: ' + tellers['Nieuws'] + ' nieuwsberichten, ' + tellers['Agenda'] + ' events en ' +
    tellers['Veelgestelde vragen'] + ' veelgestelde vragen. Kijk ze na in de tabbladen. De Engelse kolommen vul je zelf aan waar nodig.');
}

function indelenIndex() {
  if (INDELEN_INDEX) return INDELEN_INDEX;
  INDELEN_INDEX = {};
  Object.keys(INDELEN_ZOEKWOORDEN).forEach(function (k) {
    var sleutel = genreSleutel(k);
    INDELEN_INDEX[sleutel] = (INDELEN_INDEX[sleutel] || []).concat(INDELEN_ZOEKWOORDEN[k]);
  });
  return INDELEN_INDEX;
}

/** Past een zoekwoord op het woord op plaats i? Korte woorden (minder dan 4 letters) enkel precies. */
function indelenRaak(zoekwoord, woorden, i) {
  var w = woorden[i];
  if (zoekwoord.charAt(0) === '=') return w === zoekwoord.slice(1);
  if (zoekwoord.indexOf(' ') > -1) {
    var delen = zoekwoord.split(' ');
    for (var d = 0; d < delen.length; d++) {
      var x = woorden[i + d];
      if (!x || (d < delen.length - 1 ? x !== delen[d] : x.indexOf(delen[d]) !== 0)) return false;
    }
    return true;
  }
  return zoekwoord.length < 4 ? w === zoekwoord : w.indexOf(zoekwoord) === 0;
}

/** Hoeveel keer een naam voorkomt: titel dubbel, beschrijving (NL en EN) enkel. */
function indelenScore(zoekwoorden, titelWoorden, tekstWoorden) {
  var tel = function (woorden) {
    var n = 0;
    for (var i = 0; i < woorden.length; i++) {
      if (zoekwoorden.some(function (z) { return indelenRaak(z, woorden, i); })) n++;
    }
    return n;
  };
  return 2 * tel(titelWoorden) + tel(tekstWoorden);
}

/**
 * De zoekwoorden van een naam: de naam zelf, de ingebouwde lijst en de eigen zoekwoorden. Genormaliseerd.
 * Een naam met / of & (AIDS/HIV, Kunst & Cultuur) telt elk deel apart.
 */
function indelenZoekwoorden(naam, eigen) {
  var lijst = [];
  var delen = String(naam || '').split(/\s*[\/&]\s*/);
  delen.forEach(function (deel) {
    var n = normaliseerTekst(deel);
    if (!n) return;
    var stam = genreSleutel(deel);
    var ingebouwd = indelenIndex()[stam];
    // Staat de naam in de ingebouwde lijst, dan bepaalt die lijst hoe hij telt ("Strip" enkel als woord, niet striptease).
    if (ingebouwd) { ingebouwd.forEach(function (w) { lijst.push(w); }); return; }
    lijst.push(n.length < 4 ? '=' + n : n);
    if (stam && stam !== n && stam.length >= 4) lijst.push(stam);
  });
  splitsLijst(eigen).forEach(function (w) { lijst.push(w.charAt(0) === '=' ? '=' + normaliseerTekst(w.slice(1)) : normaliseerTekst(w)); });
  var uniek = [];
  lijst.forEach(function (w) { if (w && w !== '=' && uniek.indexOf(w) === -1) uniek.push(w); });
  return uniek;
}

function indelingTekst(uit, welke) {
  var tel = function (k) { return uit.filter(function (r) { return r[k]; }).length; };
  return uit.length + ' ' + (welke === 'boeken' ? 'boeken' : welke === 'films' ? 'films' : 'boeken en films') + ' ingedeeld op titel en beschrijving: ' + tel('themas') + ' kregen een thema erbij, ' +
    tel('categorieen') + ' een categorie, ' + tel('trefwoorden') + ' een trefwoord. Wat erbij kwam, staat in het tabblad Indeling. ' +
    'Er werd niets weggehaald.';
}

/**
 * Past een rij van Nieuws, Agenda of Veelgestelde vragen aan, voegt er een toe of verwijdert er een.
 * invoer: { tabblad, rij (leeg = nieuw), vingerafdruk, velden, verwijderen }
 * rijen: de rijen van dat tabblad (worden aangepast).
 */
function inhoudAanpassen(rijen, invoer, vrijwilliger) {
  var tabblad = String(invoer.tabblad || '');
  var kolommen = BEHEER_INHOUD[tabblad];
  if (!kolommen) return { ok: false, fout: 'Onbekend tabblad.' };
  // vrijwilliger: de voornaam als een vrijwilliger dit doet (leeg bij het bestuur).
  if (vrijwilliger && VRIJWILLIGER_INHOUD.indexOf(tabblad) === -1) return { ok: false, fout: 'Dit kan enkel met de code van het bestuur.' };
  var voorstel = !!vrijwilliger && VOORSTEL_TABBLADEN.indexOf(tabblad) > -1;
  var rij = null;
  if (invoer.rij) {
    rij = rijen.filter(function (r) { return r._rij === Number(invoer.rij); })[0];
    if (!rij || vingerafdruk(rij, kolommen) !== String(invoer.vingerafdruk)) {
      return { ok: false, fout: 'Iemand paste dit intussen aan in de spreadsheet. Klik op Vernieuw en probeer opnieuw.' };
    }
  }
  if (invoer.verwijderen) {
    if (!rij) return { ok: false, fout: 'Er is niets om te verwijderen.' };
    if (voorstel && jaNee(rij.publiek) !== 'nee') return { ok: false, fout: 'Dit staat al online. Vraag het bestuur om het te verwijderen.' };
    markeerVerwijderen(rij);
    return { ok: true, tekst: 'Verwijderd uit ' + tabblad + '.' };
  }
  var r = beheerVelden(invoer.velden, kolommen);
  if (r.fout) return { ok: false, fout: r.fout };
  var v = r.velden;
  var hoofd = { 'Veelgestelde vragen': 'vraag', 'Leeslijsten': 'naam' }[tabblad] || 'titel';
  var nieuweWaarde = v.hasOwnProperty(hoofd) ? v[hoofd] : (rij ? rij[hoofd] : '');
  if (isLeeg(nieuweWaarde)) return { ok: false, fout: 'Vul een ' + hoofd + ' in.' };
  if (tabblad === 'Leeslijsten') {
    if (/[,;]/.test(nieuweWaarde)) return { ok: false, fout: 'Een naam van een leeslijst mag geen komma of puntkomma bevatten.' };
    var dubbel = rijen.some(function (r) { return r !== rij && !r._verwijderen && normaliseerTekst(r.naam) === normaliseerTekst(nieuweWaarde); });
    if (dubbel) return { ok: false, fout: 'Er bestaat al een leeslijst met die naam.' };
    var van = v.hasOwnProperty('zichtbaar_vanaf') ? v.zichtbaar_vanaf : (rij ? parseerDatum(rij.zichtbaar_vanaf) : '');
    var tot = v.hasOwnProperty('zichtbaar_tot') ? v.zichtbaar_tot : (rij ? parseerDatum(rij.zichtbaar_tot) : '');
    if (van && tot && tot < van) return { ok: false, fout: 'De einddatum ligt voor de startdatum.' };
  }
  if (tabblad === 'Agenda' && isLeeg(v.hasOwnProperty('datum') ? v.datum : (rij ? rij.datum : ''))) {
    return { ok: false, fout: 'Een event heeft een datum nodig.' };
  }
  if (!v.publiek && !rij) v.publiek = 'ja';
  // Een vrijwilliger stelt voor: het bericht blijft verborgen tot het bestuur het op zichtbaar zet.
  // Ook een aanpassing aan een bericht dat al online stond, gaat eerst langs het bestuur.
  if (voorstel) { v.publiek = 'nee'; v.voorgesteld_door = tekstInvoer(vrijwilliger, 40); }
  else if (VOORSTEL_TABBLADEN.indexOf(tabblad) > -1 && v.publiek === 'ja') v.voorgesteld_door = '';
  if (rij) {
    wijzig(rij, v);
  } else {
    var nieuw = {};
    kolommen.forEach(function (k) { nieuw[k] = v.hasOwnProperty(k) ? v[k] : ''; });
    if (v.voorgesteld_door) nieuw.voorgesteld_door = v.voorgesteld_door;
    if (tabblad === 'Nieuws' && !nieuw.datum) nieuw.datum = vandaagTekst();
    voegToe(rijen, nieuw);
  }
  if (voorstel) return { ok: true, tekst: (rij ? 'Aangepast' : 'Toegevoegd') + ' in ' + tabblad + '. Het bestuur zet het online na nalezen.' };
  return { ok: true, tekst: (rij ? 'Aangepast' : 'Toegevoegd') + ' in ' + tabblad + '.' };
}

/* ---------- Instellingen ---------- */

/** De rijen van een inhoudstabblad, zoals het beheerscherm ze toont. */
function inhoudRijen(tabblad, rijen) {
  var kolommen = BEHEER_INHOUD[tabblad];
  return rijen.map(function (rij) {
    var uit = { rij: rij._rij, vingerafdruk: vingerafdruk(rij, kolommen) };
    kolommen.forEach(function (k) { uit[k] = isLeeg(rij[k]) ? '' : rij[k]; });
    // Voorstel van een vrijwilliger dat nog op goedkeuring wacht (zie inhoudAanpassen).
    if (!isLeeg(rij.voorgesteld_door)) uit.voorgesteld_door = schoon(rij.voorgesteld_door);
    return uit;
  });
}

function installeer() {
  var ss = spreadsheet();

  // Instellingen: sleutel, waarde, uitleg.
  var inst = ss.getSheetByName('Instellingen') || maakTabblad('Instellingen');
  if (inst.getLastRow() === 0) {
    inst.appendRow(['sleutel', 'waarde', 'uitleg']);
    opmaakKop(inst, 3);
  }
  var bestaand = {};
  inst.getDataRange().getValues().slice(1).forEach(function (r) { bestaand[schoon(r[0])] = r[1]; });
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    if (bestaand.hasOwnProperty(rij[0])) {
      // Een lege code vullen we in met een willekeurige code.
      if (CODE_INSTELLINGEN.indexOf(rij[0]) > -1 && isLeeg(bestaand[rij[0]])) {
        zetInstelling(inst, rij[0], willekeurigeCode());
      }
      return;
    }
    var waarde = rij[1];
    if (CODE_INSTELLINGEN.indexOf(rij[0]) > -1) waarde = willekeurigeCode();
    inst.appendRow([rij[0], waarde, rij[2]]);
  });
  ordenInstellingen(ss); // per thema, met tussenkoppen (zie Ordenen.js)
  inst.setColumnWidth(1, 280);
  inst.setColumnWidth(2, 380);
  inst.setColumnWidth(3, 480);
  inst.getRange(1, 2, inst.getLastRow(), 2).setWrap(true);

  // De andere tabbladen met hun kolommen.
  Object.keys(KOLOMMEN).forEach(function (naam) {
    var blad = ss.getSheetByName(naam) || maakTabblad(naam);
    var kolommen = KOLOMMEN[naam];
    var kop = blad.getLastRow() > 0 ? blad.getRange(1, 1, 1, Math.max(1, blad.getLastColumn())).getValues()[0].map(schoon) : [];
    var ontbrekend = kolommen.filter(function (k) { return kop.indexOf(k) === -1; });
    if (ontbrekend.length) {
      var start = blad.getLastColumn() + 1;
      if (!kop.some(function (k) { return k; })) start = 1;
      blad.getRange(1, start, 1, ontbrekend.length).setValues([ontbrekend]);
    }
    opmaakKop(blad, blad.getLastColumn());
  });

  // Tekstopmaak voor kolommen die tekst moeten blijven (ISBN, telefoon, lenersnummer, en titels zoals 24/7 die anders een datum worden).
  zetTekstopmaak(ss.getSheetByName('Catalogus'), ['isbn', 'boek_id', 'wiki_gezocht', 'titel', 'originele_titel', 'auteur']);
  zetGetalopmaak(ss.getSheetByName('Catalogus'), ['duur', 'te_koop_aantal']);
  zetGetalopmaak(ss.getSheetByName('Catalogus'), ['prijs'], '0.00');
  zetGetalopmaak(ss.getSheetByName('Standje boeken'), ['prijs'], '0.00');
  zetGetalopmaak(ss.getSheetByName('Verkopen'), ['prijs'], '0.00');
  zetTekstopmaak(ss.getSheetByName('Leners'), ['telefoon']);

  // Kolom status: een keuzelijst, met uitleg bij de kop.
  var cat = ss.getSheetByName('Catalogus');
  var catKop = cat.getRange(1, 1, 1, cat.getLastColumn()).getValues()[0].map(schoon);
  var si = catKop.indexOf('status');
  if (si > -1) {
    cat.getRange(2, si + 1, Math.max(1, cat.getMaxRows() - 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(BOEKSTATUSSEN, true).setAllowInvalid(true).build());
    cat.getRange(1, si + 1).setNote('Leeg = gewoon.\nverloren: niet op de website, niet uitleenbaar.\n' +
      'gevoelig verborgen: niet op de website, wel uitleenbaar.\ngevoelig zichtbaar: op de website met het label "Gevoelige inhoud".');
  }

  // Brede tabbladen overzichtelijk: vaste eerste kolommen, kleur per thema, uitleg bij elke kop,
  // niet-publieke kolommen schuin en grijs, technische kolommen ingeklapt (Kolommen.js).
  maakTabbladenOverzichtelijk(true);

  // Planning: elke nacht de privacy-opruiming, elke maandagnacht een back-up,
  // en de cache legen bij een wijziging.
  verwijderTriggers('ruimOp');
  verwijderTriggers('bijWijziging');
  verwijderTriggers('maakBackup');
  verwijderTriggers('verwerkNieuweBoekenAutomatisch');
  verwijderTriggers('haalPeperfabriekOp');
  ScriptApp.newTrigger('verwerkNieuweBoekenAutomatisch').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('ruimOp').timeBased().everyDays(1).atHour(3).create();
  ScriptApp.newTrigger('haalPeperfabriekOp').timeBased().everyDays(1).atHour(5).create();
  ScriptApp.newTrigger('maakBackup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(4).create();
  ScriptApp.newTrigger('bijWijziging').forSpreadsheet(ss).onEdit().create();

  // Het tabblad Voorraad (Verkoop.js): een overzicht dat het script zelf schrijft.
  try { schrijfVoorraad(leesTabel('Catalogus').rijen, leesTabel('Verkopen').rijen); } catch (e) { /* later via Madrigal > Verkoop */ }

  ordenTabbladen(ss);
  logboekNieuwsteBoven(ss.getSheetByName('Logboek'));
  naTeKijkenNieuwsteBoven();
  logboek('menu', 'installeer', 'tabbladen klaar');
  meld('De tabbladen staan klaar. Kijk in Instellingen de codes en teksten na.');
}

/** Past één instelling aan. invoer: { sleutel, waarde } */
function instellingAanpassen(rijen, invoer) {
  var sleutel = schoon(invoer.sleutel);
  if (!sleutel || isInstellingKop(sleutel)) return { ok: false, fout: 'Onbekende instelling.' };
  if (BEHEER_GEHEIM.indexOf(sleutel) > -1) return { ok: false, fout: 'Deze instelling pas je enkel in de spreadsheet aan.' };
  var rij = rijen.filter(function (r) { return schoon(r.sleutel) === sleutel; })[0];
  if (!rij) return { ok: false, fout: 'Onbekende instelling.' };
  var waarde = String(invoer.waarde === undefined || invoer.waarde === null ? '' : invoer.waarde).trim().slice(0, 5000);
  wijzig(rij, { waarde: waarde });
  return { ok: true, tekst: 'De instelling ' + sleutel + ' is bewaard.' };
}

/* ---------- Acties die enkel een tabblad lezen of schrijven ---------- */

/** De instellingen per groep, zonder de geheime. rijen: de rijen van het tabblad Instellingen. */
function instellingenVoorBeheer(rijen) {
  var perSleutel = {};
  rijen.forEach(function (r) {
    var s = schoon(r.sleutel);
    if (s && !isInstellingKop(s)) perSleutel[s] = r;
  });
  var groepen = [], gezien = {};
  var maak = function (titel, sleutels) {
    var items = sleutels.filter(function (s) { return perSleutel[s] && BEHEER_GEHEIM.indexOf(s) === -1; }).map(function (s) {
      gezien[s] = true;
      return { sleutel: s, waarde: isLeeg(perSleutel[s].waarde) ? '' : String(perSleutel[s].waarde), uitleg: schoon(perSleutel[s].uitleg) };
    });
    BEHEER_GEHEIM.forEach(function (s) { gezien[s] = true; });
    if (items.length) groepen.push({ titel: titel, instellingen: items });
  };
  INSTELLING_GROEPEN.forEach(function (g) { maak(g[0], g[1]); });
  maak('Overige', Object.keys(perSleutel).filter(function (s) { return !gezien[s]; }));
  return groepen;
}

/** Een tussenkop in het tabblad Instellingen: "── UITLENEN ──". */
function instellingKop(titel) {
  return '── ' + titel.toUpperCase() + ' ──';
}

/** Werd deze beschrijving vroeger afgebroken (eindigt ze op "...")? */
function isAfgebroken(tekst) {
  return /(\.\.\.|…)\s*$/.test(String(tekst || ''));
}

/** Is er al beslist wat er met een verloren boek gebeurt (vervangen of niet)? */
function isAfgehandeldVerloren(tekst) {
  return /vervangen/i.test(String(tekst || ''));
}

/**
 * Vult de kolom isbn10 aan uit het ISBN (978...). Een ISBN dat met 979 begint, heeft geen ISBN-10.
 * Geeft de rijen die veranderden.
 */
function isbn10Aanvullen(catalogus) {
  var veranderd = [];
  catalogus.forEach(function (b) {
    var tien = isbn13Naar10(String(b.isbn || '').replace(/[^0-9X]/gi, ''));
    if (tien && schoon(b.isbn10) !== tien) { wijzig(b, { isbn10: tien }); veranderd.push(b); }
  });
  return veranderd;
}

/** Vanzelf, elk uur (vanuit verwerkNieuweBoekenAutomatisch): enkel als er iets te doen is. */
function isbn10AanvullenAutomatisch() {
  var tabel = leesTabel('Catalogus');
  if (tabel.kop.indexOf('isbn10') === -1) { zorgVoorTabbladen(['Catalogus']); tabel = leesTabel('Catalogus'); }
  if (isbn10Aanvullen(tabel.rijen).length) schrijfKolommen(tabel, ['isbn10']);
}

/** Menu: Boeken > ISBN-10: vul aan uit het ISBN. */
function isbn10AanvullenMenu() {
  zorgVoorTabbladen(['Catalogus']);
  var tabel = leesTabel('Catalogus');
  var n = isbn10Aanvullen(tabel.rijen).length;
  if (n) schrijfKolommen(tabel, ['isbn10']);
  var tekst = n ? n + ' boeken kregen een ISBN-10 in de kolom isbn10.' : 'Alle boeken met een ISBN dat met 978 begint, hebben al een ISBN-10.';
  logboek('menu', 'isbn10', tekst);
  meld(tekst + ' Dit gebeurt ook elk uur vanzelf.');
}

/** Controleert het controlecijfer van een ISBN-10 (10 tekens, laatste mag X zijn). */
function isbn10Geldig(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 10; i++) {
    var c = isbn.charAt(i);
    som += (c === 'X' ? 10 : Number(c)) * (10 - i);
  }
  return som % 11 === 0;
}

/** Zet een (geldig) ISBN-10 om naar ISBN-13: 978 ervoor en een nieuw controlecijfer. */
function isbn10Naar13(isbn10) {
  var basis = '978' + isbn10.slice(0, 9);
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(basis.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return basis + ((10 - (som % 10)) % 10);
}

/** Controleert het controlecijfer van een ISBN-13. */
function isbn13Geldig(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  var som = 0;
  for (var i = 0; i < 12; i++) som += Number(isbn.charAt(i)) * (i % 2 === 0 ? 1 : 3);
  return (10 - (som % 10)) % 10 === Number(isbn.charAt(12));
}

/** ISBN-13 (978…) naar ISBN-10. Geeft '' als dat niet kan. */
function isbn13Naar10(isbn13) {
  var s = String(isbn13 || '');
  if (!/^978\d{10}$/.test(s)) return '';
  var kern = s.slice(3, 12), som = 0;
  for (var i = 0; i < 9; i++) som += (10 - i) * Number(kern.charAt(i));
  var c = (11 - (som % 11)) % 11;
  return kern + (c === 10 ? 'X' : String(c));
}

/** Zoekt een ISBN op bij Open Library en Google Books. Geeft { ok, voorstel } terug. */
function isbnOpzoeken(invoer) {
  var isbn = normaliseerIsbn(invoer.isbn).isbn;
  if (!isbn) return { ok: false, fout: 'Dit ISBN klopt niet. Kijk het nog eens na.' };
  var ol = null, gb = null;
  try {
    var r = haalJson('https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=ISBN:' + isbn);
    ol = r.data && r.data['ISBN:' + isbn] ? r.data['ISBN:' + isbn].details : null;
  } catch (e) { ol = null; }
  try {
    var sleutel = leesInstellingen().google_books_api_key;
    var g = googleBooksZoek(isbn, sleutel); // zie Beschrijvingen.js (met het land erbij)
    gb = g.items.length ? g.items[0].volumeInfo : null;
  } catch (e) { gb = null; }
  var voorstel = isbnVoorstel(ol, gb);
  voorstel.isbn = isbn;
  return { ok: true, voorstel: voorstel, gevonden: !!(ol || gb) };
}

/* ---------- Nieuws, Agenda, Veelgestelde vragen ---------- */

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

/**
 * Voegt wat Open Library en Google Books over een ISBN weten samen tot een voorstel.
 * olDetails: het "details"-object van Open Library, gbInfo: een "volumeInfo" van Google Books.
 */
function isbnVoorstel(olDetails, gbInfo) {
  var leeg = {};
  var v = verwerkOpenLibrary(leeg, olDetails);
  var gb = verwerkGoogleBooks(v, gbInfo);
  Object.keys(gb).forEach(function (k) { if (isLeeg(v[k])) v[k] = gb[k]; });
  var titel = olDetails && olDetails.title ? schoon(olDetails.title) + (olDetails.subtitle ? ': ' + schoon(olDetails.subtitle) : '') : '';
  if (!titel && gbInfo && gbInfo.title) titel = schoon(gbInfo.title) + (gbInfo.subtitle ? ': ' + schoon(gbInfo.subtitle) : '');
  var auteurs = (olDetails && olDetails.authors || []).map(function (a) { return a.name; });
  if (!auteurs.length && gbInfo && gbInfo.authors) auteurs = gbInfo.authors;
  if (titel) v.titel = titel;
  if (auteurs.length) v.auteur = auteurs.map(auteurAchternaamEerst).join(' & ');
  return v;
}

/** Is dit een link naar bol.com? */
function isBolLink(link) {
  return /^https:\/\/(www\.)?bol\.com\//.test(schoon(link));
}

/** Is deze fout de daglimiet van Google? */
function isDaglimietFout(e) {
  return /te vaak|too many times/i.test(String(e && e.message || e || ''));
}

/** Is dit een Date-object (zoals de spreadsheet datums teruggeeft)? */
function isDatumObject(waarde) {
  return Object.prototype.toString.call(waarde) === '[object Date]' && !isNaN(waarde.getTime());
}

/** Een cover die iemand met de hand toevoegde? */
function isEigenCover(boek, eigen) {
  var bron = schoon(boek.cover_bron);
  return bron === 'foto in de bib' || bron === 'link' || !!eigen.cover[String(boek.boek_id)];
}

/**
 * Past de Catalogus aan met de boeken van de oude website.
 * Geeft { beschrijvingen, covers, eigen, gelijk, nietGevonden: [oud boek], hoe: { manier: aantal } }.
 */

/** Komt deze cover nog van een andere site? (niet van Google Drive en niet van deze website) */
function isExterneCover(url) {
  var u = schoon(url);
  if (!/^https?:\/\//i.test(u)) return false;
  if (/^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(u)) return false;   // al in Drive
  if (/^https:\/\/drive\.google\.com\//i.test(u)) return false;
  if (/^https:\/\/projectmadrigal\.github\.io\//i.test(u)) return false;     // op de website zelf
  return true;
}

function isFilm(rij) {
  return normaliseerTekst(rij && rij.soort) === 'film';
}

function isFilmTip(rij) {
  return isFilm(rij) && jaNee(rij.film_tip) === 'ja';
}

function isGemarkeerd(lener) {
  return !!lener && !isLeeg(lener.markering);
}

function isGoogleCover(url) {
  return /^https:\/\/(books\.google\.[a-z.]+|books\.googleusercontent\.com|[a-z0-9-]+\.googleusercontent\.com)\//.test(String(url || ''));
}

/** Gaat een fout van Google over de daglimiet, of over iets anders (sleutel, API uit, ...)? */
function isGoogleLimiet(code, fout) {
  if (code === 429) return true;
  return code === 403 && /quota|rate ?limit|dailyLimit|userRateLimit|limitExceeded/i.test(String(fout || ''));
}

function isInstellingKop(sleutel) {
  return /^──/.test(String(sleutel || ''));
}

/**
 * Is een veld met komma's eigenlijk een lijst van namen zonder komma ("Mira Verbeek, Kim Ander")?
 * Enkel als elk stuk minstens twee woorden heeft, en het eerste woord van elk stuk een gekende voornaam is.
 */
function isKommaLijst(veld, kennis) {
  var stukken = String(veld || '').split(',').map(schoon).filter(Boolean);
  if (stukken.length < 2) return false;
  return stukken.every(function (s) {
    var w = s.split(' ');
    return w.length >= 2 && isVoornaam(w[0], kennis) && !AUTEUR_ACHTERVOEGSEL.test(s);
  });
}

/** Geeft true als een waarde leeg is (niets, lege tekst of enkel spaties). */
function isLeeg(waarde) {
  return waarde === null || waarde === undefined || String(waarde).trim() === '';
}

function isLetterboxdLijst(url) {
  return /^https:\/\/(www\.)?letterboxd\.com\/[^\/\s]+\/list\/[^\/\s]+\/?/.test(String(url || '').trim());
}

/** Enkel covers van Open Library zelf, in het vaste formaat. */
function isOlCover(url) {
  return /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(String(url || ''));
}

/** Is de bib open op deze datum? Juiste weekdag en niet in gesloten_data. */
function isOpeningsdag(datum, inst) {
  return inst.openingsdagen.indexOf(weekdag(datum)) > -1 && inst.gesloten_data.indexOf(datum) === -1;
}

function isPubliek(rij) {
  return jaNee(rij.publiek) !== 'nee';
}

/** Een boekcover is staand. Een logo of pictogram is vierkant of liggend. */
function isStaandeCover(afm) {
  return !!afm && afm.breedte > 0 && afm.hoogte >= afm.breedte * 1.15;
}

/** Is deze afbeelding (base64) een gekende standaardafbeelding? */
function isStandaardAfbeelding(base64) {
  var bekend = [];
  try { bekend = JSON.parse(PropertiesService.getScriptProperties().getProperty(STANDAARD_HASHES_SLEUTEL) || '[]'); } catch (e) { bekend = []; }
  if (!bekend.length) return false;
  return bekend.indexOf(bytesHash(Utilities.base64Decode(base64))) > -1;
}

/** Mag het boek uitgeleend worden? Niet bij uitleenbaar = nee, verloren, te koop, of een kijktip (film die niet in de bib is). */
function isUitleenbaar(boek) {
  return jaNee(boek.uitleenbaar) !== 'nee' && boekStatus(boek) !== 'verloren' && jaNee(boek.te_koop) !== 'ja' && !isFilmTip(boek);
}

/** Is deze uitlening afgesloten omdat het boek verloren is? */
function isVerlorenUitlening(u) {
  return /^verloren/i.test(String(u.staat_terug || ''));
}

function isVoornaam(w, kennis) { return !!(kennis && kennis.voornaam[normaliseerTekst(w)]); }

/** Maakt ja/nee eenvormig. Geeft 'ja', 'nee' of '' terug. */
function jaNee(waarde) {
  if (waarde === true) return 'ja';
  if (waarde === false) return 'nee';
  var t = normaliseerTekst(waarde);
  if (['ja', 'j', 'yes', 'y', 'waar', 'true', 'x', '1'].indexOf(t) > -1) return 'ja';
  if (['nee', 'n', 'no', 'onwaar', 'false', '0'].indexOf(t) > -1) return 'nee';
  return '';
}

/** Een JSON-antwoord. */
function json(tekst) {
  return ContentService.createTextOutput(typeof tekst === 'string' ? tekst : JSON.stringify(tekst))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- Afgeschermde eindpunten ---------- */

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

/** Kiest uit de antwoorden van Wikidata de film die past (op het jaartal als er meerdere zijn). */
function kiesFilm(rij, kandidaten) {
  if (!kandidaten.length) return null;
  var jaar = parseerGetal(rij.jaartal);
  if (!jaar) return kandidaten.length === 1 ? kandidaten[0] : null;
  return kandidaten.filter(function (f) { return !f.jaar || Math.abs(f.jaar - jaar) <= 1; })[0] || null;
}

/**
 * Kiest uit de zoekresultaten van Open Library (search.json) het werk dat bij het boek past.
 * Enkel bij een goede overeenkomst van titel (tot de dubbele punt) en achternaam van de auteur.
 * Geeft het nummer van de cover terug, of 0.
 */
function kiesOlWerk(boek, docs) {
  var titel = titelSleutel(boek.titel);
  var naam = achternaam(boek.auteur);
  for (var i = 0; i < (docs || []).length; i++) {
    var d = docs[i];
    if (!d || !d.cover_i) continue;
    if (gelijkenis(titel, titelSleutel(d.title)) < 0.85) continue;
    if (naam) {
      var namen = (d.author_name || []).map(achternaam);
      if (namen.indexOf(naam) === -1) continue;
    }
    return d.cover_i;
  }
  return 0;
}

/** Kiest uit de zoekresultaten de titels van artikels die goed overeenkomen met de titel van het boek. */
function kiesWikiTitels(boek, titels) {
  var gezocht = titelSleutel(boek.titel);
  return (titels || []).filter(function (t) {
    return gelijkenis(gezocht, titelSleutel(wikiTitelZonderUitleg(t))) >= 0.85;
  });
}

/**
 * De indeling van een tabblad volgens de kopregel. kop: de koppen in hun echte volgorde.
 * Geeft { vast: aantal vaste kolommen, kleuren: [kleur of ''], uitleg: [tekst of ''], nietPubliek: [bool],
 * groepen: [[eerste kolom (1 = A), aantal]] } of null als het tabblad geen indeling heeft.
 */
function kolomIndeling(tabblad, kop) {
  var ind = KOLOM_INDELING[tabblad];
  if (!ind) return null;
  // Vast tot en met de laatste kolom uit "vast", als die vooraan staat (hoogstens de eerste 5 kolommen).
  var vast = 0;
  ind.vast.forEach(function (k) { var i = kop.indexOf(k); if (i > -1 && i < 5) vast = Math.max(vast, i + 1); });
  var uit = { vast: vast, kleuren: [], uitleg: [], nietPubliek: [], groepen: [] };
  var begin = -1;
  kop.forEach(function (k, i) {
    var v = ind.kolommen[k];
    uit.kleuren.push(v ? KOLOM_THEMAS[v[0]][0] : '');
    uit.nietPubliek.push(!!(v && v[2]));
    uit.uitleg.push(v ? KOLOM_THEMAS[v[0]][1] + (v[2] ? '. 🔒 Niet publiek: verschijnt nooit op de website' : '') + '.\n' + v[1] : '');
    // Groepen: aaneengesloten technische kolommen (niet de vaste kolommen).
    var tech = v && v[0] === 'techniek' && i >= vast;
    if (tech && begin === -1) begin = i;
    if ((!tech || i === kop.length - 1) && begin > -1) {
      var einde = tech ? i : i - 1;
      uit.groepen.push([begin + 1, einde - begin + 1]);
      begin = -1;
    }
  });
  return uit;
}

/** Achtergrond: stap 2. Kopieert de covers van de oude website naar Drive, in porties. */
function kopieerOudeCovers() {
  var start = Date.now();
  if (wachtOpDaglimiet('kopieerOudeCovers')) return;
  if (!startAchtergrond('kopieerOudeCovers')) {
    // Een vorige ronde loopt nog (of stopte zonder op te ruimen): later opnieuw proberen in plaats van stil te stoppen.
    planTaak('kopieerOudeCovers', 10 * 60 * 1000);
    meldAlBezig('kopieerOudeCovers');
    return;
  }
  // Vangnet: stopt Google deze ronde onderweg (te lang bezig, of een fout van Drive), dan start ze vanzelf opnieuw.
  planTaak('kopieerOudeCovers', 10 * 60 * 1000);
  // Een ronde die Google afbreekt, schrijft niets meer weg. Daarom noteren we de start: staat die er nog, dan
  // werd de vorige ronde onderbroken en zegt het Logboek dat.
  var props = PropertiesService.getScriptProperties();
  var vorige = Number(props.getProperty(OUD_RONDE_SLEUTEL)) || 0;
  if (vorige) {
    logboek('systeem', 'kopieerOudeCovers', 'De vorige ronde (gestart om ' + Utilities.formatDate(new Date(vorige), Session.getScriptTimeZone(), 'HH:mm') +
      ') werd onderbroken door Google, wellicht omdat ze te lang duurde. Het kopiëren gaat nu verder.');
  }
  props.setProperty(OUD_RONDE_SLEUTEL, String(start));
  var gekopieerd = 0, zonder = 0, rest = 0, storing = false, fout = '', daglimiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    var teDoen = tabel.rijen.filter(heeftOudeCoverNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > OUD_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var a = haalCoverLink(String(boek.oude_cover)); // zie Beheer.js
      if (a.code === 429 || a.code >= 500 || a.code === 0) { storing = true; break; }
      if (a.code === 200 && a.data && (/librarything/i.test(String(boek.oude_cover)) || isStandaardAfbeelding(a.data))) {
        // Een standaardafbeelding (zoals het plaatje van LibraryThing): geen cover.
        wijzig(boek, { oude_cover: '' });
        zonder++;
      } else if (a.code === 200 && a.data) {
        var link;
        try {
          link = bewaarFotoInDrive('oud-' + boek.boek_id + '.jpg', a.data, a.type.split(';')[0] || 'image/jpeg');
        } catch (e) {
          // Google Drive weigert even (bv. te veel bestanden vandaag): bewaren wat al lukte en later verder.
          fout = String(e && e.message || e).slice(0, 200);
          daglimiet = /too many times|te vaak|limit/i.test(fout);
          storing = true;
          break;
        }
        wijzig(boek, { cover_url: link, cover_bron: OUDE_COVER_BRON, oude_cover: '' });
        gekopieerd++;
      } else {
        // Geen afbeelding (bv. 404): de huidige cover blijft.
        wijzig(boek, { oude_cover: '' });
        zonder++;
      }
      if ((gekopieerd + zonder) % 25 === 0) bewaarAchtergrond(tabel);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftOudeCoverNodig).length;
  } finally {
    stopAchtergrond('kopieerOudeCovers');
    props.deleteProperty(OUD_RONDE_SLEUTEL);
  }
  verwijderTriggers('kopieerOudeCovers');
  // Daglimiet van Google Drive: over 6 uur. Andere storing: over 15 minuten. Anders: over een minuut.
  if (rest > 0) planTaak('kopieerOudeCovers', (daglimiet ? 6 * 60 : storing ? 15 : 1) * 60 * 1000);
  if (gekopieerd) leegCache();
  logboek('menu', 'kopieerOudeCovers', gekopieerd + ' covers van de oude website gekopieerd, ' + zonder + ' zonder afbeelding, ' + rest + ' te gaan' +
    (daglimiet ? ' (Google Drive: daglimiet, over 6 uur verder)' : storing ? ' (even een storing, over 15 minuten verder)' : '') + (fout ? '. Fout: ' + fout : ''));
}

/**
 * Koppelt de Catalogus aan de Goodreads-export (zonder de spreadsheet aan te raken).
 * catalogus: rijen van de Catalogus
 * goodreads: rijen uit leesGoodreadsRijen
 * Geeft terug:
 *   aanvullingen: [{ boek, veld, waarde }]   -> mag meteen ingevuld worden
 *   naTeKijken:   [{ boek, veld, waarde_catalogus, waarde_bron, opmerking }]
 */
function koppelGoodreads(catalogus, goodreads) {
  var opIsbn = {}, opTitelAuteur = {}, opTitel = {};
  goodreads.forEach(function (g) {
    [goodreadsIsbn(g.ISBN13), goodreadsIsbn(g.ISBN)].forEach(function (i) { if (i) opIsbn[i] = g; });
    var auteur = g['Author l-f'] || g.Author;
    var t = titelSleutel(g.Title);
    opTitelAuteur[t + '|' + achternaam(auteur)] = g;
    (opTitel[t] = opTitel[t] || []).push(g);
  });

  var aanvullingen = [], naTeKijken = [];
  catalogus.forEach(function (boek) {
    if (isLeeg(boek.boek_id)) return;
    var t = titelSleutel(boek.titel);
    var g = boek.isbn ? opIsbn[boek.isbn] : null;
    if (!g) g = opTitelAuteur[t + '|' + achternaam(boek.auteur)];
    if (!g && opTitel[t] && opTitel[t].length === 1) {
      // Twijfel: enkel de titel komt overeen. Niets invullen, wel voorleggen.
      var kandidaat = opTitel[t][0];
      naTeKijken.push({
        boek: boek, veld: 'koppeling', waarde_catalogus: boek.auteur,
        waarde_bron: kandidaat.Title + ' / ' + (kandidaat.Author || ''),
        opmerking: 'Enkel de titel komt overeen, de auteur verschilt. Is dit hetzelfde boek? Vul dan zelf aan.'
      });
      return;
    }
    if (!g) return;

    Object.keys(GOODREADS_VELDEN).forEach(function (veld) {
      var waarde = goodreadsWaarde(g, GOODREADS_VELDEN[veld]);
      if (isLeeg(waarde)) return;
      if (veld !== 'uitgeverij') waarde = parseerGetal(waarde) || '';
      if (isLeeg(waarde)) return;
      if (isLeeg(boek[veld])) {
        aanvullingen.push({ boek: boek, veld: veld, waarde: veld === 'uitgeverij' ? schoon(waarde) : waarde });
      }
    });
    // Een ISBN vullen we nooit zelf in: het kan van een andere uitgave zijn.
    var grIsbn = goodreadsIsbn(g.ISBN13) || goodreadsIsbn(g.ISBN);
    if (!boek.isbn && grIsbn) {
      naTeKijken.push({
        boek: boek, veld: 'isbn', waarde_catalogus: '', waarde_bron: grIsbn,
        opmerking: 'ISBN uit Goodreads. Klopt het met jouw uitgave? Zet het dan in de Catalogus, zodat Open Library de cover kan vinden.'
      });
    }
  });
  return { aanvullingen: aanvullingen, naTeKijken: naTeKijken };
}

/**
 * Kort een tekst af tot hoogstens max tekens, na de laatste volledige zin.
 * Een zin eindigt op . ! ? of een regeleinde. Is er geen zinseinde, dan stopt
 * de tekst na het laatste volledige woord, met "...".
 */
function kortAfOpZin(tekst, max) {
  var t = String(tekst || '');
  if (t.length <= max) return t;
  var stuk = t.slice(0, max);
  var einde = -1;
  var re = /[.!?»"”')]\s|\n/g, m;
  while ((m = re.exec(stuk))) einde = m.index + 1;
  if (einde > max / 3) return stuk.slice(0, einde).trim();
  return stuk.slice(0, max - 3).replace(/\s+\S*$/, '') + '...';
}

/** Korte datum: "20/11/2026". */
function korteDatum(datum) {
  if (!datum) return '';
  var d = datum.split('-');
  return Number(d[2]) + '/' + Number(d[1]) + '/' + d[0];
}

/**
 * Menu: genres en thema's meteen opkuisen. Het tabblad Genres opkuisen toont achteraf welke genres een andere naam kregen
 * (een overzicht, geen nakijklijst).
 */
function kuisGenresOp() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit, voorstellen;
  try {
    var catalogus = leesTabel('Catalogus');
    var onderwerpen = leesTabel('Onderwerpen');
    voorstellen = genreVoorstellen(onderwerpen.rijen, catalogus.rijen);
    uit = genresOpkuisen(onderwerpen.rijen, catalogus.rijen, voorstellen);
    schrijfKolommen(catalogus, ['genre', 'extra_onderwerpen']);
    bewaarTabel(onderwerpen);
  } finally {
    lock.releaseLock();
  }
  werkOnderwerpenBij(); // de aantallen in Onderwerpen opnieuw tellen
  leegCache();
  // Overzicht van wat veranderde.
  var ss = spreadsheet();
  var blad = ss.getSheetByName(GENRES_TABBLAD) || maakTabblad(GENRES_TABBLAD);
  blad.clear();
  blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
  var kop = ['genre_vroeger', 'aantal_boeken', 'genre_nu'];
  var waarden = [kop].concat(voorstellen.map(function (r) { return [r.genre_nu, r.aantal_boeken, r.genre_nieuw]; }));
  blad.getRange(1, 1, waarden.length, kop.length).setValues(waarden);
  opmaakKop(blad, kop.length);
  var tekst = uit.genres + ' genres samengevoegd of in de juiste schrijfwijze gezet, ' + uit.boeken + ' boeken aangepast, ' +
    uit.themas + ' cellen met thema\'s in de juiste schrijfwijze. Het tabblad ' + GENRES_TABBLAD + ' toont welke genres veranderden.';
  logboek('menu', 'kuisGenresOp', tekst); // wat veranderde, staat in het tabblad
  meld(tekst + ' De website toont het binnen enkele minuten.');
}

/**
 * Leest alle gegevens die de uitleenlogica nodig heeft.
 * wie: voornaam van de vrijwilliger (voor het logboek en de uitzonderingen).
 */
function laadStaat(wie, metUitzonderingen) {
  var tabellen = {
    Catalogus: leesTabel('Catalogus'),
    Leners: leesTabel('Leners'),
    Uitleningen: leesTabel('Uitleningen'),
    Reservaties: leesTabel('Reservaties')
  };
  if (metUitzonderingen) tabellen.Uitzonderingen = leesTabel('Uitzonderingen');
  // Getallen uit de spreadsheet (lenersnummer 12.0) gelijk maken aan tekst ("12").
  tabellen.Leners.rijen.forEach(function (l) { l.lenersnummer = String(l.lenersnummer); });
  tabellen.Uitleningen.rijen.forEach(function (u) { if (!isLeeg(u.lenersnummer)) u.lenersnummer = String(u.lenersnummer); });
  tabellen.Reservaties.rijen.forEach(function (r) { if (!isLeeg(r.lenersnummer)) r.lenersnummer = String(r.lenersnummer); });
  return {
    tabellen: tabellen,
    inst: leesInstellingen(),
    vandaag: vandaagTekst(),
    wie: tekstInvoer(wie, 40) || 'onbekend',
    catalogus: tabellen.Catalogus.rijen,
    leners: tabellen.Leners.rijen,
    uitleningen: tabellen.Uitleningen.rijen,
    reservaties: tabellen.Reservaties.rijen,
    uitzonderingenTabel: tabellen.Uitzonderingen ? tabellen.Uitzonderingen.rijen : [],
    uitzonderingen: [],
    log: [],
    nieuwNummer: function (soort, bestaande) { return volgendNummer(soort, bestaande); }
  };
}

/** De laatste regels van het Logboek, nieuwste eerst (ook als oudere regels nog onderaan staan). */
function laatsteLogregels(waarden, aantal) {
  return waarden.slice(1).filter(function (r) { return r[0] || r[2]; }).map(function (r) {
    var tijd = isDatumObject(r[0]) ? r[0].getTime() : (Date.parse(r[0]) || 0);
    return { tijd: tijd, wie: String(r[1] || ''), actie: String(r[2] || ''), details: String(r[3] || '') };
  }).sort(function (a, b) { return b.tijd - a.tijd; }).slice(0, aantal);
}

/**
 * De laatst opgehaalde versie van het rooster, zonder de avonden die al voorbij zijn.
 * bewaard: de tekst uit ROOSTER_LAATST_SLEUTEL. daglimiet: lag het aan de daglimiet van Google?
 */
function laatsteRooster(bewaard, vandaag, daglimiet) {
  var oud = null;
  try { oud = JSON.parse(bewaard || 'null'); } catch (e) { oud = null; }
  var reden = daglimiet ? 'Google laat vandaag geen nieuwe vragen naar buiten meer toe (daglimiet).' : 'De roostertool antwoordt nu niet.';
  if (!oud || !oud.data) return { ok: false, fout: 'Het rooster kon niet laden. ' + reden + ' Probeer het later opnieuw.' };
  var data = oud.data;
  data.avonden = (data.avonden || []).filter(function (a) { return String(a.datum) >= vandaag; });
  data.vandaag = vandaag;
  data.verouderd = { tijd: Number(oud.tijd) || 0, reden: reden };
  return { ok: true, data: data };
}

function ldNaam(w) {
  if (!w) return '';
  if (Array.isArray(w)) return w.map(ldNaam).filter(Boolean).join(', ');
  if (typeof w === 'object') return schoon(w.name || '');
  return schoon(w);
}

function ldType(o, type) {
  return [].concat(o['@type'] || []).some(function (t) { return String(t).toLowerCase() === type; });
}

/** Maakt de cache van de publieke catalogus leeg, zodat de volgende opvraging vers is. */
function leegCache() {
  try { CacheService.getScriptCache().removeAll([dagSleutel(CACHE_SLEUTEL) + '_n', dagSleutel(SITE_CACHE_SLEUTEL)]); } catch (e) { /* niets aan de hand */ }
}

/** Leest de borg uit tekst als "5 cash", "€5 QR" of "QR". */
function leesBorg(waarde, inst) {
  var bedrag = parseerGetal(waarde);
  var t = normaliseerTekst(waarde);
  var wijze = '';
  inst.borg_betaalwijzen.forEach(function (w) { if (t.indexOf(normaliseerTekst(w)) > -1) wijze = w; });
  if (bedrag === null && wijze) bedrag = inst.borg_per_boek;
  return { bedrag: bedrag || 0, betaalwijze: wijze };
}

/**
 * Zet de ruwe waarden van een tabblad (Stock of Zines) om naar boek-objecten.
 * waarden: tweedimensionale lijst zoals getValues() ze teruggeeft.
 * soort: 'boek' of 'zine'.
 * Lege rijen en herhaalde kopregels slaan we over.
 */
function leesBronRijen(waarden, soort) {
  // Zoek de kopregel: de eerste rij met een cel "Titel".
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var kolom = {};
  var laatsteBenoemde = -1;
  kop.forEach(function (k, i) {
    var veld = BRONKOLOMMEN[k];
    if (veld && kolom[veld] === undefined) { kolom[veld] = i; laatsteBenoemde = Math.max(laatsteBenoemde, i); }
  });
  // De herkomst staat in de eerste kolom zonder kop, rechts van de benoemde kolommen.
  var herkomstKolom = -1;
  for (var c = laatsteBenoemde + 1; c < kop.length + 5; c++) {
    if (kop[c]) continue;
    var heeftData = waarden.slice(kopIndex + 1).some(function (rij) { return !isLeeg(rij[c]); });
    if (heeftData) { herkomstKolom = c; break; }
  }

  var boeken = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var titel = schoon(rij[kolom.titel]);
    if (!titel || normaliseerTekst(titel) === 'titel') continue; // lege rij of herhaalde kop
    var lees = function (veld) { return kolom[veld] === undefined ? '' : rij[kolom[veld]]; };
    var isbnRuw = lees('isbn');
    var isbn = normaliseerIsbn(isbnRuw);
    var aantal = parseerGetal(lees('aantal'));
    var jaar = parseerGetal(lees('jaartal'));
    var paginas = parseerGetal(lees('paginas'));
    boeken.push({
      soort: soort,
      titel: titel,
      auteur: schoon(lees('auteur')),
      isbn: isbn.isbn || isbn.issn,
      isbn_origineel: isbn.geldig || isbn.leeg ? '' : schoon(isbnRuw),
      uitgeverij: schoon(lees('uitgeverij')),
      jaartal: jaar ? Math.round(jaar) : '',
      taal: normaliseerTaal(lees('taal')),
      paginas: paginas ? Math.round(paginas) : '',
      uitvoering: normaliseerUitvoering(lees('uitvoering')),
      nieuwstaat: jaNee(lees('nieuwstaat')),
      aanrader: schoon(lees('aanrader')),
      genre: schoon(lees('genre')),
      aantal: aantal && aantal > 0 ? Math.round(aantal) : 1,
      herkomst: herkomstKolom > -1 ? schoon(rij[herkomstKolom]) : ''
    });
  }
  return boeken;
}

/**
 * Zet de ruwe waarden van het tabblad Goodreads-export om naar objecten.
 * shelf: (optioneel) enkel boeken op deze shelf. De export bevat je volledige
 * bibliotheek; de kolommen "Bookshelves" en "Exclusive Shelf" zeggen op welke
 * shelves een boek staat.
 */
function leesGoodreadsRijen(waarden, shelf) {
  if (!waarden.length) return [];
  var kop = waarden[0].map(schoon);
  var gezocht = normaliseerTekst(shelf);
  return waarden.slice(1).map(function (rij) {
    var obj = {};
    kop.forEach(function (k, i) { if (k) obj[k] = rij[i]; });
    return obj;
  }).filter(function (o) {
    if (isLeeg(o.Title)) return false;
    if (!gezocht) return true;
    var shelves = splitsLijst(o.Bookshelves).concat([schoon(o['Exclusive Shelf'])]);
    return shelves.some(function (s) { return normaliseerTekst(s) === gezocht; });
  });
}

/** Leest het tabblad Instellingen en geeft de verwerkte instellingen terug. */
function leesInstellingen() {
  var blad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Instellingen');
  var ruw = {};
  if (blad) {
    blad.getDataRange().getValues().slice(1).forEach(function (rij) {
      var sleutel = schoon(rij[0]);
      if (sleutel) ruw[sleutel] = rij[1];
    });
  }
  return verwerkInstellingen(ruw);
}

/**
 * Zet boeken in een leeslijst of haalt ze eruit.
 * invoer: { naam, toevoegen: [boek_id], weghalen: [boek_id] }
 */
function leeslijstBoeken(staat, invoer) {
  var naam = tekstInvoer(invoer.naam, 80);
  if (!naam || /[,;]/.test(naam)) return { ok: false, fout: 'Kies eerst een leeslijst.' };
  var sleutel = normaliseerTekst(naam);
  var erbij = 0, eruit = 0;
  function pas(ids, toevoegen) {
    (Array.isArray(ids) ? ids : []).slice(0, 500).forEach(function (id) {
      var boek = boekVan(staat, String(id));
      if (!boek) return;
      var namen = splitsLijst(boek.leeslijsten);
      var i = namen.map(normaliseerTekst).indexOf(sleutel);
      if (toevoegen && i === -1) { namen.push(naam); erbij++; }
      else if (!toevoegen && i > -1) { namen.splice(i, 1); eruit++; }
      else return;
      wijzig(boek, { leeslijsten: leeslijstTekst(namen) });
    });
  }
  pas(invoer.toevoegen, true);
  pas(invoer.weghalen, false);
  if (erbij || eruit) {
    staat.catalogusGewijzigd = true;
    staat.log.push(['leeslijst ' + naam, erbij + ' boeken erbij, ' + eruit + ' eruit']);
  }
  return { ok: true, tekst: 'Leeslijst ' + naam + ': ' + erbij + ' boeken toegevoegd, ' + eruit + ' weggehaald.' };
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

/** Zet de namen in de kolom leeslijsten terug als tekst. */
function leeslijstTekst(namen) {
  return namen.join(', ');
}

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

/**
 * Zet de waarden van het oude blad om naar objecten met vaste namen.
 * formules (getFormulas van hetzelfde bereik) mag ontbreken.
 */
function leesOudeUitleningen(waarden, formules) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(10, waarden.length); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'boek'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(normaliseerTekst);
  var k = {
    boek: oudeKolom(kop, 'boek'), auteur: oudeKolom(kop, 'auteur'), voornaam: oudeKolom(kop, 'voornaam'),
    achternaam: oudeKolom(kop, 'achternaam'), telefoon: oudeKolom(kop, 'telefoon'), email: oudeKolom(kop, 'e mail') > -1 ? oudeKolom(kop, 'e mail') : oudeKolom(kop, 'email'),
    datum_uit: oudeKolom(kop, 'datum ontlening'), datum_terug_afgesproken: oudeKolom(kop, 'datum terug'),
    borg: oudeKolom(kop, 'borg'), gift: oudeKolom(kop, 'gift'), herinnering: oudeKolom(kop, 'reminder'),
    terug_op: oudeKolom(kop, 'boek terug op'),
    // Kolom A (zonder naam, vóór de kolom Boek): "ok" als het boek terug is.
    status: kop[0] === '' && oudeKolom(kop, 'boek') > 0 ? 0 : -1
  };
  var rijen = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (naam) { return k[naam] > -1 ? rij[k[naam]] : ''; };
    if (isLeeg(lees('boek'))) continue;
    var status = normaliseerTekst(lees('status'));
    if (/^vb/.test(status)) continue; // de voorbeeldrij bovenaan
    var herinnering = lees('herinnering');
    var formule = formules && formules[i] && k.datum_terug_afgesproken > -1 ? formules[i][k.datum_terug_afgesproken] : '';
    rijen.push({
      rijnummer: i + 1,
      boek: schoon(lees('boek')), auteur: schoon(lees('auteur')),
      voornaam: schoon(lees('voornaam')), achternaam: schoon(lees('achternaam')),
      telefoon: opmaakGsm(lees('telefoon')), email: schoon(lees('email')).toLowerCase(),
      datum_uit: parseerDatum(lees('datum_uit')), datum_terug_afgesproken: parseerDatum(lees('datum_terug_afgesproken')),
      borg: lees('borg'), gift: lees('gift'),
      herinnering: parseerDatum(herinnering) || (normaliseerTekst(herinnering) === 'ok' ? parseerDatum(lees('datum_terug_afgesproken')) : ''),
      herinnering_ok: !parseerDatum(herinnering) && normaliseerTekst(herinnering) === 'ok',
      terug_op: isLeeg(lees('terug_op')) && status === 'ok' ? 'ok' : lees('terug_op'),
      dagen_formule: dagenUitFormule(formule, i + 1)
    });
  }
  return herstelOudeDatums(rijen);
}

/**
 * Leest een tabblad in.
 * Geeft { naam, blad, kop, rijen } terug. Elke rij heeft een verborgen veld _rij
 * met het rijnummer in de spreadsheet. Volledig lege rijen slaan we over.
 */
function leesTabel(naam) {
  var blad = spreadsheet().getSheetByName(naam);
  if (!blad) throw new Error('Het tabblad "' + naam + '" bestaat niet. Voer eerst "Madrigal > Installeer tabbladen" uit.');
  var waarden = blad.getDataRange().getValues();
  var kop = (waarden[0] || []).map(function (k) { return schoon(k); });
  var rijen = [];
  for (var r = 1; r < waarden.length; r++) {
    var obj = { _rij: r + 1 };
    var leeg = true;
    for (var k = 0; k < kop.length; k++) {
      if (!kop[k]) continue;
      var w = waarden[r][k];
      // Een getal in een kolom met datumopmaak (96 minuten wordt 5/4/1900): terug naar het getal.
      if (isDatumObject(w) && GETALKOLOMMEN.indexOf(kop[k]) > -1) w = datumNaarGetal(w);
      else if (isDatumObject(w)) w = parseerDatum(w);
      // Een datum die iemand als tekst typte (20/11/2026), ook omzetten.
      else if (typeof w === 'string' && w && DATUMKOLOMMEN.indexOf(kop[k]) > -1) w = parseerDatum(w) || w;
      if (!isLeeg(w)) leeg = false;
      obj[kop[k]] = w;
    }
    if (!leeg) rijen.push(obj);
  }
  return { naam: naam, blad: blad, kop: kop, rijen: rijen };
}

/**
 * Leest het tabblad: de kopregel (met "Titel") en de rijen eronder. waarden: getValues().
 * Geeft [{ rij (1-gebaseerd), titel, auteur, isbn, ..., aantalTekst, prijs, verwerkt }].
 */
function leesVerkooplijst(waarden) {
  var kopIndex = -1;
  for (var r = 0; r < Math.min(waarden.length, 20); r++) {
    if (waarden[r].some(function (c) { return normaliseerTekst(c) === 'titel'; })) { kopIndex = r; break; }
  }
  if (kopIndex === -1) return [];
  var kop = waarden[kopIndex].map(function (c) { return normaliseerTekst(c); });
  var k = function (namen) { for (var i = 0; i < namen.length; i++) { var j = kop.indexOf(namen[i]); if (j > -1) return j; } return -1; };
  var kol = {
    titel: k(['titel']), auteur: k(['auteur s', 'auteurs', 'auteur']), isbn: k(['isbn', 'isbn issn']), uitgeverij: k(['uitgeverij']),
    jaartal: k(['jaartal', 'jaar']), taal: k(['taal']), paginas: k(['pagina s', 'paginas']), uitvoering: k(['uitvoering']),
    nieuwstaat: k(['nieuwstaat']), genre: k(['genre']), aantal: k(['aantal']), prijs: k(['prijs']), verwerkt: k(['verwerkt']), opmerking: k(['opmerking'])
  };
  var uit = [];
  for (var i = kopIndex + 1; i < waarden.length; i++) {
    var rij = waarden[i];
    var lees = function (v) { return kol[v] === -1 ? '' : rij[kol[v]]; };
    var titel = schoon(lees('titel'));
    if (!titel || normaliseerTekst(titel) === 'titel') continue;
    uit.push({
      rij: i + 1, titel: titel, auteur: schoon(lees('auteur')), isbn: lees('isbn'), uitgeverij: schoon(lees('uitgeverij')),
      jaartal: parseerGetal(lees('jaartal')) || '', taal: lees('taal'), paginas: parseerGetal(lees('paginas')) || '',
      uitvoering: lees('uitvoering'), nieuwstaat: lees('nieuwstaat'), genre: schoon(lees('genre')),
      aantalTekst: schoon(lees('aantal')), prijs: verkoopGetal(lees('prijs')), verwerkt: schoon(lees('verwerkt'))
    });
  }
  uit.kolommen = kol;
  uit.kopRij = kopIndex + 1;
  return uit;
}

/**
 * Bestuur: gegevens van een lener aanpassen of op inactief zetten.
 * invoer: { lenersnummer, voornaam, achternaam, telefoon, email, actief }
 */
function lenerAanpassen(staat, invoer) {
  var l = lenerVan(staat, invoer.lenersnummer);
  if (!l) return { ok: false, fout: 'Deze lener bestaat niet.' };
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var telefoon = opmaakGsm(tekstInvoer(invoer.telefoon, 25));
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  var velden = {
    voornaam: voornaam, achternaam: tekstInvoer(invoer.achternaam, 80), telefoon: telefoon, email: email,
    actief: invoer.actief === false ? 'nee' : 'ja'
  };
  if (invoer.hasOwnProperty('notitie')) velden.notitie = tekstInvoer(invoer.notitie, 500);
  if (invoer.hasOwnProperty('markering')) {
    var reden = tekstInvoer(invoer.markering, 300);
    if (reden && isLeeg(l.markering)) velden.markering_sinds = staat.vandaag;
    if (!reden) velden.markering_sinds = '';
    velden.markering = reden;
  }
  wijzig(l, velden);
  staat.log.push(['lener aangepast', 'lener ' + l.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + l.lenersnummer + ' is bijgewerkt.' };
}

/* ---------- Informatie voor de schermen ---------- */

/** De afgesloten uitleningen van een lener, nieuwste eerst (wat de privacy-opruiming nog niet wiste). */
function lenerHistoriek(staat, nummer) {
  var lijst = staat.uitleningen.filter(function (u) {
    return String(u.lenersnummer) === String(nummer) && !isLeeg(u.datum_terug);
  }).map(function (u) {
    var boek = boekVan(staat, u.boek_id);
    return { titel: boek ? schoon(boek.titel) : String(u.boek_id), exemplaar: String(u.exemplaar || ''),
      datum_uit: parseerDatum(u.datum_uit), datum_terug: parseerDatum(u.datum_terug) };
  }).sort(function (a, b) { return b.datum_uit.localeCompare(a.datum_uit); });
  return { ok: true, uitleningen: lijst.slice(0, 50), totaal: lijst.length };
}

/** "12 (Sam)": wat een vrijwilliger van een lener mag zien. */
function lenerNaam(staat, lenersnummer) {
  var l = lenerVan(staat, lenersnummer);
  return lenersnummer + (l && l.voornaam ? ' (' + l.voornaam + ')' : '');
}

function lenerVan(staat, lenersnummer) {
  var n = String(parseerGetal(lenersnummer));
  for (var i = 0; i < staat.leners.length; i++) {
    if (String(staat.leners[i].lenersnummer) === n) return staat.leners[i];
  }
  return null;
}

/**
 * Leest de films uit één pagina van een lijst bij Letterboxd. Geeft [{ slug, titel, jaar }].
 * Letterboxd verandert soms de opmaak. Daarom zoeken we breed: elk element met data-film-slug
 * of data-item-slug, en daarbij de naam (data-item-name, data-film-name of de alt van de afbeelding).
 */
function letterboxdFilms(html) {
  var tekst = String(html || '');
  var re = /data-(?:film|item)-slug="([^"]+)"/g, m, plekken = [];
  while ((m = re.exec(tekst))) {
    // Hetzelfde adres twee keer na elkaar (bv. in de afbeelding en de link) is één film.
    if (!plekken.length || plekken[plekken.length - 1].slug !== m[1]) plekken.push({ slug: m[1], plek: m.index });
  }
  var uit = [], gezien = {};
  plekken.forEach(function (p, i) {
    if (gezien[p.slug]) return;
    var begin = tekst.lastIndexOf('<', p.plek);
    // Tot het begin van het element van de volgende film: anders lezen we de naam van die film.
    var einde = i + 1 < plekken.length ? tekst.lastIndexOf('<', plekken[i + 1].plek) : Math.min(tekst.length, p.plek + 2000);
    var stuk = tekst.slice(begin, Math.max(einde, p.plek + 1));
    var naam = (stuk.match(/data-(?:item|film)-name="([^"]+)"/) || stuk.match(/alt="([^"]+)"/) || [])[1] || '';
    naam = htmlTekst(naam).replace(/^Poster for /i, '');
    var jaar = Number((stuk.match(/data-film-release-year="(\d{4})"/) || [])[1]) || 0;
    var mj = naam.match(/^(.*\S)\s*\((\d{4})\)$/);
    if (mj) { naam = mj[1]; jaar = jaar || Number(mj[2]); }
    if (!naam) naam = p.slug.replace(/-\d{4}$/, '').replace(/-/g, ' ');
    gezien[p.slug] = true;
    uit.push({ slug: p.slug, titel: naam, jaar: jaar || '' });
  });
  return uit;
}

/** Het adres van pagina n van een lijst: https://letterboxd.com/naam/list/lijst/page/2/ */
function letterboxdPaginaUrl(lijst, n) {
  var basis = String(lijst || '').trim().replace(/\/page\/\d+\/?$/, '').replace(/\/?$/, '/');
  return n > 1 ? basis + 'page/' + n + '/' : basis;
}

/** Levenshtein-afstand: het aantal tikfouten tussen twee woorden. */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  var vorige = [];
  for (var j = 0; j <= b.length; j++) vorige[j] = j;
  for (var i = 1; i <= a.length; i++) {
    var huidige = [i];
    for (var k = 1; k <= b.length; k++) {
      var kost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      huidige[k] = Math.min(vorige[k] + 1, huidige[k - 1] + 1, vorige[k - 1] + kost);
    }
    vorige = huidige;
  }
  return vorige[b.length];
}

/**
 * Schrijft een regel in het Logboek. Zet hier nooit contactgegevens in,
 * enkel nummers (boek-ID, lenersnummer, uitlening-ID).
 * De nieuwste regel komt bovenaan, net onder de kop: zo hoef je niet te scrollen.
 */
function logboek(wie, actie, details) {
  var blad = spreadsheet().getSheetByName('Logboek');
  if (!blad) return;
  var rij = [new Date(), veiligeCel(schoon(wie) || 'systeem'), actie, veiligeCel(details || '')];
  if (blad.getLastRow() < 2) { blad.appendRow(rij); return; }
  blad.insertRowBefore(2); // neemt de opmaak van een gewone rij over, niet die van de kop
  blad.getRange(2, 1, 1, rij.length).setValues([rij]);
}

/** Zet de bestaande regels van het Logboek eenmalig met de nieuwste bovenaan (bij Installeer tabbladen). */

/** Actie beheerLogboek (enkel het bestuur). */
function logboekEnTaken() {
  var cache = CacheService.getScriptCache();
  var taken = achtergrondTaken();
  var bezig = {};
  taken.forEach(function (t) {
    var w = cache.get('taak_' + t[0]);
    if (w) bezig[t[0]] = Number(w) || Date.now();
  });
  var gepland = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  var stand = takenStand(taken, leesTabel('Catalogus').rijen, gepland, bezig);
  var blad = spreadsheet().getSheetByName('Logboek');
  var regels = blad && blad.getLastRow() > 1 ? laatsteLogregels(blad.getDataRange().getValues(), LOGBOEK_REGELS) : [];
  var sinds = daglimietSinds();
  return { ok: true, taken: stand, logboek: regels, daglimiet: daglimietWachttijd(sinds, Date.now()) ? sinds : 0 };
}

function logboekNieuwsteBoven(blad) {
  if (!blad || blad.getLastRow() < 3) return;
  blad.getRange(2, 1, blad.getLastRow() - 1, Math.max(4, blad.getLastColumn())).sort({ column: 1, ascending: false });
}

function lopendeUitleningen(staat) {
  return staat.uitleningen.filter(function (u) { return u.exemplaar && isLeeg(u.datum_terug) && !u._verwijderen; });
}

function lopendeUitleningenVan(staat, lenersnummer) {
  return lopendeUitleningen(staat).filter(function (u) { return String(u.lenersnummer) === String(lenersnummer); });
}

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

/**
 * Maakt afgebroken beschrijvingen leeg, zodat het script ze opnieuw volledig zoekt
 * en vertaalt. Enkel beschrijvingen die het script zelf vond (met een datum in
 * beschrijving_gezocht, ol_gecontroleerd of gb_gecontroleerd). Geeft het aantal terug.
 */
function maakAfgebrokenLeeg(rijen) {
  var n = 0;
  rijen.forEach(function (rij) {
    var doorScript = !isLeeg(rij.beschrijving_gezocht) || !isLeeg(rij.ol_gecontroleerd) || !isLeeg(rij.gb_gecontroleerd);
    if (!doorScript || !/^\d{13}$/.test(String(rij.isbn || ''))) return;
    // Een tekst van de oude website maken we nooit leeg (zie OudeBoeken.js).
    if (schoon(rij.beschrijving_bron) === OUDE_COVER_BRON) return;
    if (!isAfgebroken(rij.beschrijving) && !isAfgebroken(rij.beschrijving_en)) return;
    wijzig(rij, { beschrijving: '', beschrijving_en: '', beschrijving_gezocht: '', beschrijving_vertaald: '' });
    n++;
  });
  return n;
}

/** Maakt een back-up en ruimt de oudste op. Draait elke week vanzelf (zie Madrigal > Installeer tabbladen). */
function maakBackup() {
  var inst = leesInstellingen();
  var ss = spreadsheet();
  var map = backupMap(inst.backup_map || 'Project Madrigal back-ups');
  var kopie = DriveApp.getFileById(ss.getId()).makeCopy(backupNaam(vandaagTekst()), map);
  var bestanden = [];
  var lijst = map.getFiles();
  while (lijst.hasNext()) {
    var f = lijst.next();
    bestanden.push({ id: f.getId(), naam: f.getName(), datum: f.getDateCreated().getTime() });
  }
  var weg = teVerwijderenBackups(bestanden, inst.backup_bewaren);
  weg.forEach(function (id) { DriveApp.getFileById(id).setTrashed(true); });
  logboek('systeem', 'back-up', kopie.getName() + (weg.length ? ', ' + weg.length + ' oude naar de prullenbak' : ''));
  return { naam: kopie.getName(), map: map.getName(), url: kopie.getUrl(), opgeruimd: weg.length };
}

/** Menu: nu meteen een back-up maken. */
function maakBackupMenu() {
  var r = maakBackup();
  meld('Back-up gemaakt: "' + r.naam + '" in de map "' + r.map + '" op je Google Drive.' + (r.opgeruimd ? ' ' + r.opgeruimd + ' oude back-up(s) gingen naar de prullenbak.' : ''));
}

/**
 * Maakt een beschrijving uit een externe bron netjes: geen HTML, geen
 * bronvermeldingen van Open Library, en hoogstens BS_MAX_LENGTE tekens.
 * Alinea's blijven behouden.
 */
function maakBeschrijvingNetjes(tekst) {
  var t = String(tekst || '');
  // Open Library zet onder een streep vaak bronnen en links: die laten we weg.
  t = t.split(/\n\s*-{3,}/)[0];
  t = t
    .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')       // [tekst](link) wordt tekst
    .replace(/\[([^\]]+)\]\[\d+\]/g, '$1')         // [tekst][1] wordt tekst
    .replace(/^\s*\[\d+\]:.*$/gm, '')              // [1]: https://... weg
    .replace(/\(\s*\[?source\]?[^)]*\)/gi, '')     // (source) weg
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return kortAfOpZin(t, BS_MAX_LENGTE);
}

/**
 * Een vrijwilliger stelt een beschrijving voor.
 * invoer: { boek_id, tekst }. rijen: het tabblad Voorstellen. nieuwId: geeft een nieuw nummer.
 */
function maakBeschrijvingVoorstel(staat, rijen, invoer, nieuwId) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isLeeg(boek.beschrijving)) return { ok: false, fout: 'Dit boek heeft intussen al een beschrijving.' };
  var tekst = schoonMetRegels(invoer.tekst).slice(0, 3000);
  if (tekst.length < VOORSTEL_MIN_TEKENS) return { ok: false, fout: 'Schrijf minstens een paar zinnen (' + VOORSTEL_MIN_TEKENS + ' tekens).' };
  var open = rijen.filter(function (v) { return v.status === VOORSTEL_NIEUW && String(v.boek_id) === String(boek.boek_id); })[0];
  if (open) {
    // Nog niet bekeken: het nieuwe voorstel vervangt het vorige.
    wijzig(open, { datum: staat.vandaag, tekst: tekst, voorgesteld_door: staat.wie });
  } else {
    voegToe(rijen, {
      voorstel_id: nieuwId(), datum: staat.vandaag, boek_id: String(boek.boek_id), titel: schoon(boek.titel),
      tekst: tekst, voorgesteld_door: staat.wie, status: VOORSTEL_NIEUW
    });
  }
  staat.log.push(['beschrijving voorgesteld', String(boek.boek_id)]);
  return { ok: true, tekst: 'Dank je! Het bestuur bekijkt je beschrijving van "' + schoon(boek.titel) + '".' };
}

/** Een vrijwilliger laat een briefje achter voor de volgende shift. invoer: { tekst } */
function maakBriefje(rijen, invoer, wie, vandaag, nieuwId) {
  var tekst = schoonMetRegels(invoer.tekst).slice(0, 300);
  if (tekst.length < 3) return { ok: false, fout: 'Schrijf kort wat de volgende shift moet weten.' };
  voegToe(rijen, { briefje_id: nieuwId(), datum: vandaag, wie: tekstInvoer(wie, 40) || 'onbekend', tekst: tekst, status: 'open' });
  return { ok: true, tekst: 'Je briefje staat bij Vandaag voor de volgende shift.' };
}

/** Menu: bouwt de Catalogus op uit Stock en Zines. */
function maakCatalogus() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = spreadsheet();
    var inst = leesInstellingen();
    var bron = [];
    [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
      var blad = ss.getSheetByName(paar[0]);
      if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
    });
    if (!bron.length) throw new Error('Geen boeken gevonden in de tabbladen Stock en Zines.');
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    var kennis = null;
    var teller = voegBronSamen(tabel.rijen, bron, ids.nieuw, inst, vandaagTekst());
    schrijfVolledig(tabel);
    ids.bewaar();
    var onderwerpen = werkOnderwerpenBij();
    leegCache();
    logboek('menu', 'maakCatalogus', teller.nieuw + ' nieuw, ' + teller.aangevuld + ' aangevuld');
    meld('Catalogus klaar: ' + teller.nieuw + ' nieuwe boeken, ' + teller.aangevuld + ' aangevuld. ' +
      onderwerpen + ' nieuwe genres in Onderwerpen. Kijk de boeken met een ongeldig ISBN na (kolom isbn_origineel).');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Maakt een generator voor nieuwe boek-ID's: B0001 voor boeken, Z0001 voor zines.
 * De teller staat in de scripteigenschappen, zodat een ID nooit twee keer gebruikt wordt,
 * ook niet als je een boek wist. Roep bewaar() op als je klaar bent.
 */
function maakIdGenerator(catalogusRijen) {
  var props = PropertiesService.getScriptProperties();
  var tellers = {};
  ['B', 'Z', 'F'].forEach(function (prefix) {
    var laatste = Number(props.getProperty('teller_boek_' + prefix) || 0);
    catalogusRijen.forEach(function (r) {
      var id = String(r.boek_id || '');
      if (id.charAt(0) === prefix) laatste = Math.max(laatste, Number(id.slice(1)) || 0);
    });
    tellers[prefix] = laatste;
  });
  return {
    nieuw: function (soort) {
      var prefix = soort === 'zine' ? 'Z' : soort === 'film' ? 'F' : 'B';
      tellers[prefix] += 1;
      return prefix + metNullen(tellers[prefix], 4);
    },
    bewaar: function () {
      props.setProperty('teller_boek_B', String(tellers.B));
      props.setProperty('teller_boek_Z', String(tellers.Z));
      props.setProperty('teller_boek_F', String(tellers.F));
    }
  };
}

/** invoer: { soort, onderwerp, bericht }. rijen: het tabblad Meldingen. */
function maakMelding(rijen, invoer, wie, vandaag, nieuwId) {
  var soort = String(invoer.soort || '');
  if (MELDING_SOORTEN.indexOf(soort) === -1) return { ok: false, fout: 'Kies wat je wil melden.' };
  var bericht = schoonMetRegels(invoer.bericht).slice(0, 1000);
  if (bericht.length < 5) return { ok: false, fout: 'Schrijf kort wat er aan de hand is.' };
  voegToe(rijen, {
    melding_id: nieuwId(), datum: vandaag, wie: tekstInvoer(wie, 40) || 'onbekend', soort: soort,
    onderwerp: tekstInvoer(invoer.onderwerp, 120), bericht: bericht, status: MELDING_NIEUW
  });
  return { ok: true, tekst: 'Je melding is doorgegeven aan het bestuur. Dank je!' };
}

/** Maakt herkende tekst netjes: woorden die over twee regels gesplitst werden, terug aan elkaar; alinea's blijven. */
function maakOcrTekstNetjes(ruw) {
  var t = String(ruw || '').replace(/\r/g, '')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')     // ge-\nschiedenis wordt geschiedenis
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\u0000')                   // alinea's even bewaren
    .replace(/\n/g, ' ')                              // gewone regeleinden worden spaties
    .replace(/\u0000/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim();
  return kortAfOpZin(t, BS_MAX_LENGTE);
}

/**
 * Maakt een tabblad aan op zijn vaste plaats (zie TABBLAD_GROEPEN), met de kleur van zijn groep.
 * Bestaat het al, dan geeft het dat tabblad terug. De andere tabbladen blijven waar ze staan.
 */
function maakTabblad(naam) {
  var ss = spreadsheet();
  var bestaand = ss.getSheetByName(naam);
  if (bestaand) return bestaand;
  var namen = ss.getSheets().map(function (b) { return b.getName(); });
  var volgorde = tabbladVolgorde(namen.concat(naam));
  var plaats = volgorde.map(function (t) { return t.naam; }).indexOf(naam);
  // De plaats tussen de bestaande tabbladen: na het laatste bestaande tabblad dat ervoor hoort.
  var voor = volgorde.slice(0, plaats).map(function (t) { return t.naam; });
  var index = 0;
  namen.forEach(function (n, i) { if (voor.indexOf(n) > -1) index = Math.max(index, i + 1); });
  var blad = ss.insertSheet(naam, index);
  var kleur = volgorde[plaats].kleur;
  if (kleur) blad.setTabColor(kleur);
  return blad;
}

/** Menu (en Installeer tabbladen): Catalogus en Uitleningen overzichtelijk maken. */
function maakTabbladenOverzichtelijk(stil) {
  var ss = spreadsheet();
  var gedaan = Object.keys(KOLOM_INDELING).filter(function (naam) { return maakTabbladOverzichtelijk(ss.getSheetByName(naam)); });
  if (!stil) meld('Klaar: ' + gedaan.join(' en ') + '. De eerste kolommen blijven staan als je naar rechts schuift, de kopregel heeft een kleur per thema, ' +
    'en bij elke kop staat uitleg (ga er met de muis over). Niet-publieke kolommen staan in schuine, grijze letters. ' +
    'De kolommen van het script zijn ingeklapt: klik op + boven de kolommen om ze te tonen.');
}

/** Past de indeling toe op een tabblad in de spreadsheet. */
function maakTabbladOverzichtelijk(blad) {
  if (!blad || blad.getLastColumn() < 1) return false;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  var ind = kolomIndeling(blad.getName(), kop);
  if (!ind) return false;
  var n = kop.length;
  var rij = blad.getRange(1, 1, 1, n);
  rij.setBackgrounds([ind.kleuren.map(function (k) { return k || null; })]);
  rij.setFontStyles([ind.nietPubliek.map(function (p) { return p ? 'italic' : 'normal'; })]);
  rij.setFontColors([ind.nietPubliek.map(function (p) { return p ? '#666666' : '#000000'; })]);
  rij.setFontWeight('bold');
  rij.setNotes([ind.uitleg.map(function (u, i) { return u || blad.getRange(1, i + 1).getNote(); })]);
  blad.setFrozenRows(1);
  if (ind.vast) blad.setFrozenColumns(ind.vast);
  // Oude groepen weg, dan de technische kolommen opnieuw groeperen en inklappen.
  for (var d = 0; d < 3; d++) {
    try { blad.getRange(1, 1, 1, blad.getMaxColumns()).shiftColumnGroupDepth(-1); } catch (e) { break; }
  }
  ind.groepen.forEach(function (g) {
    try {
      blad.getRange(1, g[0], 1, g[1]).shiftColumnGroupDepth(1);
      blad.getColumnGroup(g[0], 1).collapse();
    } catch (e) { /* niet erg: dan blijven ze zichtbaar */ }
  });
  return true;
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

/** Menu: stap 1, de nakijklijst maken (het tabblad Titels nakijken wordt opnieuw geschreven). */
function maakTitelNakijklijst() {
  var catalogus = leesTabel('Catalogus').rijen;
  var lijst = titelNakijklijst(catalogus);
  var datums = catalogus.filter(function (b) { return !isLeeg(b.boek_id) && titelIsDatum(b.titel); }).map(function (b) { return String(b.boek_id); });
  var ss = spreadsheet();
  var blad = ss.getSheetByName(TITELS_TABBLAD) || maakTabblad(TITELS_TABBLAD);
  blad.clear();
  // clear() laat keuzelijsten staan: die van een vorige versie (andere kolommen) eerst weghalen.
  blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
  var waarden = [TITELS_KOLOMMEN].concat(lijst.map(function (r) { return TITELS_KOLOMMEN.map(function (k) { return r[k]; }); }));
  blad.getRange(1, 1, waarden.length, TITELS_KOLOMMEN.length).setValues(waarden);
  opmaakKop(blad, TITELS_KOLOMMEN.length);
  blad.setColumnWidth(TITELS_KOLOMMEN.indexOf('titel_nu') + 1, 360);
  blad.setColumnWidth(TITELS_KOLOMMEN.indexOf('titel_nieuw') + 1, 360);
  if (lijst.length) {
    // Keuzelijst ja / nee in de kolom toepassen (gedaan mag ook: dat zet het script na het toepassen).
    blad.getRange(2, TITELS_KOLOMMEN.indexOf('toepassen') + 1, lijst.length, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee', 'gedaan'], true).setAllowInvalid(false).build());
    blad.setFrozenRows(1);
  }
  var talen = lijst.filter(function (r) { return r.taal_nieuw; }).length;
  logboek('menu', 'maakTitelNakijklijst', lijst.length + ' titels met een voorstel, waarvan ' + talen + ' met een andere taal');
  meld(lijst.length + ' titels hebben een voorstel, waarvan ' + talen + ' met een andere taal (kolom taal_nieuw). De rijen met een andere taal staan bovenaan en op nee: kijk na of het boek echt in die taal geschreven is en zet dan ja. Voor de andere rijen: pas titel_nieuw aan waar nodig, of zet toepassen op nee. Kies daarna Madrigal > Titels en auteurs > Schrijfwijze: pas de nakijklijst toe.' +
    (datums.length ? ' Let op: bij ' + datums.join(', ') + ' werd de titel ooit een datum. Verbeter die titels met de hand in de Catalogus (typ een \' voor de titel, bv. \'24/7).' : ''));
}

/**
 * Bepaalt de Nederlandse en de Engelse beschrijving.
 * vertaal(tekst, doeltaal) geeft de vertaling (in Apps Script: LanguageApp).
 *   - Is de tekst al Nederlands (de vertaling naar het Nederlands verandert niets),
 *     dan blijft beschrijving precies zoals ze was.
 *   - Een Engelse versie die je zelf invulde in beschrijving_en, blijft staan.
 */
function maakTweetaligeBeschrijving(boek, vertaal) {
  var origineel = schoonMetRegels(boek.beschrijving);
  var v = {};
  var nl = schoonMetRegels(vertaal(origineel, 'nl'));
  if (nl && !zelfdeTekst(nl, origineel)) v.beschrijving = nl;
  if (isLeeg(boek.beschrijving_en)) {
    var en = schoonMetRegels(vertaal(origineel, 'en'));
    if (en) v.beschrijving_en = en;
  }
  return v;
}

/** "2026-11" naar "november 2026". */
function maandTekst(jjjjmm) {
  var d = jjjjmm.split('-');
  return MAANDEN[Number(d[1]) - 1] + ' ' + d[0];
}

/** "Januari '26", "febr 26", "Sept 2026": { jaar, maand } of null. */
function maandUitTitel(tekst) {
  var t = normaliseerTekst(tekst);
  var m = t.match(/^([a-z]+)\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  var maand = MAANDEN_KORT.indexOf(m[1].slice(0, 3)) + 1;
  if (m[1].slice(0, 3) === 'mrt') maand = 3;
  if (!maand) return null;
  var jaar = Number(m[2]);
  return { jaar: jaar < 100 ? 2000 + jaar : jaar, maand: maand };
}

/** Mag deze rol deze actie? */
function magActie(rol, actie) {
  return ACTIES.hasOwnProperty(actie) && (ROL_RANG[rol] || 0) >= ROL_RANG[ACTIES[actie]];
}

/** Markeert een rij om te verwijderen (enkel gebruikt bij de privacy-opruiming). */
function markeerVerwijderen(rij) {
  rij._verwijderen = true;
}

/** Toont een melding in de spreadsheet (of in het logboek als er geen scherm is). */
function meld(tekst) {
  try {
    SpreadsheetApp.getUi().alert(tekst);
  } catch (e) {
    try { spreadsheet().toast(tekst, 'Madrigal', 10); } catch (e2) { Logger.log(tekst); }
  }
}

function meldAlBezig(naam) {
  var waarde = null;
  try { waarde = CacheService.getScriptCache().get('taak_' + naam); } catch (e) { /* geen cache */ }
  meld(bezigTekst(waarde, Session.getScriptTimeZone()));
}

/** Acties meldingMaken en meldingAfhandelen (binnen het slot). */
function meldingActie(actie, invoer, wie) {
  var tabel = tabelOfLeeg('Meldingen');
  if (!tabel) return { ok: false, fout: 'Het tabblad Meldingen ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'meldingMaken'
    ? maakMelding(tabel.rijen, invoer, wie, vandaagTekst(), nieuwIdVoor(tabel.rijen, 'melding_id', 'melding', 'M'))
    : meldingAfhandelen(tabel.rijen, invoer, wie, vandaagTekst());
  if (r.ok) {
    bewaarTabel(tabel);
    logboek(wie, actie === 'meldingMaken' ? 'melding' : 'melding afgehandeld', actie === 'meldingMaken' ? String(invoer.soort) : String(invoer.melding_id));
  }
  return r;
}

/* ---------- Briefjes voor de volgende shift ---------- */

/** Het bestuur zet een melding op afgehandeld. invoer: { melding_id } */
function meldingAfhandelen(rijen, invoer, wie, vandaag) {
  var m = (rijen || []).filter(function (r) { return String(r.melding_id) === String(invoer.melding_id); })[0];
  if (!m) return { ok: false, fout: 'Deze melding bestaat niet meer.' };
  wijzig(m, { status: 'afgehandeld', afgehandeld_door: tekstInvoer(wie, 40), datum_afgehandeld: vandaag });
  return { ok: true, tekst: 'Melding ' + m.melding_id + ' is afgehandeld.' };
}

/** Vult een nummer aan met nullen: 7 wordt "0007". */
function metNullen(n, breedte) {
  var s = String(n);
  while (s.length < breedte) s = '0' + s;
  return s;
}

/**
 * Wat deze vrijwilliger de laatste MIJN_DAGEN voorstelde en meldde, met de stand.
 * Enkel titel, soort en onderwerp: niet de tekst van de melding zelf.
 */
function mijnBijdragen(voorstelRijen, meldingRijen, wie, vandaag) {
  var recent = function (d) { d = parseerDatum(d); return !!d && dagenTussen(d, vandaag) <= MIJN_DAGEN; };
  var nieuwsteEerst = function (a, b) { return b.datum.localeCompare(a.datum); };
  return {
    voorstellen: (voorstelRijen || []).filter(function (v) { return zelfdeNaam(v.voorgesteld_door, wie) && recent(v.datum); }).map(function (v) {
      return { datum: parseerDatum(v.datum), titel: schoon(v.titel), status: schoon(v.status), datum_behandeld: parseerDatum(v.datum_behandeld) || '' };
    }).sort(nieuwsteEerst),
    meldingen: (meldingRijen || []).filter(function (m) { return zelfdeNaam(m.wie, wie) && recent(m.datum); }).map(function (m) {
      return { datum: parseerDatum(m.datum), soort: schoon(m.soort), onderwerp: schoon(m.onderwerp), status: schoon(m.status), datum_afgehandeld: parseerDatum(m.datum_afgehandeld) || '' };
    }).sort(nieuwsteEerst)
  };
}

/* ---------- Terug te zetten ---------- */

/**
 * Hoeveel minuten tot de daglimiet van Google weer vrij is. Google zet die limiet om middernacht
 * in Californië terug op nul. We wachten tot 10 minuten daarna. uur en minuut: de tijd nu in Californië.
 */
function minutenTotGoogleReset(uur, minuut) {
  return 24 * 60 - (uur * 60 + minuut) + 10;
}

/** "2026-11-20" naar een Date in UTC (enkel om mee te rekenen). */
function naarUtc(datum) {
  var d = datum.split('-');
  return new Date(Date.UTC(Number(d[0]), Number(d[1]) - 1, Number(d[2])));
}

/** Namen uit een cel: "Kim & Ilo", "Kim / Ilo", "(Ilo?)". Plaatshouders als "..." vallen weg. */
function namenUitCel(waarde) {
  return String(waarde || '').split(/\s*(?:&|\/|,|\+|\sen\s|\sand\s)\s*/i).map(function (n) {
    return schoon(n.replace(/[()?!.]/g, ''));
  }).filter(function (n) { return n && /[a-z]/i.test(n); });
}

/** Na te kijken: de nieuwste rijen bovenaan (op datum), zodat je niet naar onder moet scrollen. */
function naTeKijkenNieuwsteBoven() {
  var blad = spreadsheet().getSheetByName('Na te kijken');
  if (!blad || blad.getLastRow() < 3) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  var k = kop.indexOf('datum');
  if (k === -1) return;
  blad.getRange(2, 1, blad.getLastRow() - 1, blad.getLastColumn()).sort({ column: k + 1, ascending: false });
}

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

/** Menu: neemt de rijen van Na te kijken over met overnemen = ja (zie oudeAangeduideOvernemen). */
function neemAangeduideOudeBoekenOver() {
  zorgVoorTabbladen(['Catalogus', 'Na te kijken']); // kolom overnemen
  var db = vindOudeDatabank();
  var oud = haalOudeBoeken(db);
  if (!oud.rijen.length) { meld('Ik kon de boeken van de oude website niet lezen. Er is niets veranderd.'); return; }
  var perId = {};
  oud.rijen.forEach(function (r) { var b = oudBoekUitRij(r, db.url); perId[b.id] = b; });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    uit = oudeAangeduideOvernemen(tabel.rijen, naTeKijken.rijen, perId);
    bewaarTabel(tabel);
    bewaarTabel(naTeKijken);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  if (uit.covers) planTaak('kopieerOudeCovers', 60 * 1000);
  var tekst = uit.gedaan + ' boeken overgenomen uit Na te kijken (' + uit.covers + ' covers komen op de achtergrond).' +
    (uit.fouten.length ? ' Niet gelukt: ' + uit.fouten.join(' ') : '');
  logboek('menu', 'neemAangeduideOudeBoekenOver', tekst);
  meld(tekst);
}

/* ---------- Standaardafbeeldingen (zoals het plaatje van LibraryThing) ---------- */

/** Menu: neemt het draaiboek over in de checklists en de veelgestelde vragen. */
function neemDraaiboekOver() {
  installeer(); // zorgt dat de tabbladen en de nieuwe instellingen bestaan
  var inst = leesInstellingen();
  var faq = leesTabel('Veelgestelde vragen');
  var r = draaiboekAanvullen(inst, faq.rijen);
  var blad = spreadsheet().getSheetByName('Instellingen');
  if (r.openen !== inst.tekst_checklist_openen) zetInstelling(blad, 'tekst_checklist_openen', r.openen);
  if (r.sluiten !== inst.tekst_checklist_sluiten) zetInstelling(blad, 'tekst_checklist_sluiten', r.sluiten);
  if (r.vragen) bewaarTabel(faq);
  leegCache();
  logboek('menu', 'neemDraaiboekOver', r.punten + ' punten in de checklists, ' + r.vragen + ' vragen');
  meld(r.punten + ' nieuwe punten in de checklists en ' + r.vragen + ' nieuwe veelgestelde vragen. Kijk de checklist bij het sluiten na: staat er nog "verwarming uit"? Dat moet nu "verwarming terug op 1" zijn. De handleiding voor vrijwilligers staat in de instellingen tekst_handleiding en tekst_handleiding_en.');
}

/* ---------- Tabbladen lezen en bewaren (enkel in Apps Script) ---------- */

/** Menu: neemt de films over uit het tabblad dat open staat (een import van IMDb of Letterboxd). */
function neemFilmsOverUitTabblad() {
  var blad = SpreadsheetApp.getActiveSheet();
  if (!blad || blad.getName() === 'Catalogus') { meld('Open eerst het tabblad met de geïmporteerde lijst, en kies dan dit menu-item opnieuw.'); return; }
  var films = filmsUitTabel(blad.getDataRange().getValues());
  if (!films) { meld('In dit tabblad staat geen lijst met films. De eerste rij moet de kolomnamen hebben, met minstens Title of Name.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var aantal = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('imdb') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var ids = maakIdGenerator(tabel.rijen);
    aantal = voegFilmsToe(tabel.rijen, films, vandaagTekst(), ids.nieuw);
    if (aantal) { bewaarTabel(tabel); ids.bewaar(); zetGetalopmaak(spreadsheet().getSheetByName('Catalogus'), ['duur']); }
  } finally {
    lock.releaseLock();
  }
  logboek('menu', 'neemFilmsOverUitTabblad', blad.getName() + ': ' + films.length + ' films, ' + aantal + ' nieuw in de Catalogus');
  if (aantal) { leegCache(); planTaak('vulFilmsAan', 60 * 1000); }
  meld(films.length + ' films in dit tabblad, ' + aantal + ' nieuw in de Catalogus.' +
    (aantal ? ' Land en omschrijving zoekt het script daarna op bij Wikidata en Wikipedia (zodra de daglimiet van Google het toelaat). Dit tabblad mag je daarna verwijderen.' : ''));
}

/* ---------- Wikidata en Wikipedia ---------- */

/** Menu: stap 1. Neemt de beschrijvingen over en zet de covers klaar om te kopiëren. */
function neemOudeBoekenOver() {
  zorgVoorTabbladen(['Catalogus', 'Na te kijken', 'Categorieën en trefwoorden']); // kolommen oude_cover, categorieen, ...
  var db = vindOudeDatabank();
  var oud = haalOudeBoeken(db);
  if (!oud.rijen.length) { meld('Ik kon de boeken van de oude website niet lezen. Er is niets veranderd.'); return; }
  var oudeBoeken = oud.rijen.map(function (r) { return oudBoekUitRij(r, db.url); }).filter(function (b) { return b.titel; });
  var logblad = spreadsheet().getSheetByName('Logboek');
  var eigen = eigenWerkUitLogboek(logblad && logblad.getLastRow() > 1 ? logblad.getDataRange().getValues().slice(1) : []);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    uit = oudeBoekenToepassen(tabel.rijen, oudeBoeken, eigen, vertaalTabel(leesTabel('Onderwerpen').rijen));
    bewaarTabel(tabel);
    // Opnieuw uitvoeren: de vorige lijst van de oude website (nog niet afgehandeld) maakt plaats voor de nieuwe.
    var naTeKijken = leesTabel('Na te kijken');
    // Rijen die je al op overnemen = ja zette, blijven staan.
    naTeKijken.rijen.forEach(function (r) { if (schoon(r.bron) === 'oude website' && jaNee(r.afgehandeld) !== 'ja' && jaNee(r.overnemen) !== 'ja') r._verwijderen = true; });
    bewaarTabel(naTeKijken);
    naTeKijken = leesTabel('Na te kijken');
    var bewaard = {};
    naTeKijken.rijen.forEach(function (r) { var m = String(r.waarde_bron || '').match(/\[oud ([^\]]+)\]/); if (m && schoon(r.bron) === 'oude website') bewaard[m[1]] = true; });
    voegNaTeKijkenToe(naTeKijken.rijen, uit.nietGevonden.filter(function (b) { return !bewaard[b.id]; }).map(function (b) {
      return oudNaTeKijkenRij(b, tabel.rijen, uit.gekoppeld);
    }), 'oude website', vandaagTekst());
    bewaarTabel(naTeKijken);
    naTeKijkenNieuwsteBoven();
  } finally {
    lock.releaseLock();
  }
  // Alle categorieën en thema's van de oude website, ook die zonder boek: in het tabblad en de keuzelijsten.
  vernieuwCategorieen(haalOudeTabel(db, 'tags'));
  leegCache();
  if (uit.covers) planTaak('kopieerOudeCovers', 60 * 1000);
  var velden = Object.keys(oud.rijen[0] || {}).join(', ');
  var hoe = Object.keys(uit.hoe).map(function (k) { return uit.hoe[k] + ' op ' + k; }).join(', ');
  var tekst = oudeBoeken.length + ' boeken gelezen op de oude website. Gevonden: ' + hoe + '. ' + uit.beschrijvingen + ' beschrijvingen overgenomen, ' +
    uit.covers + ' covers klaargezet (die kopieert het script nu op de achtergrond naar Drive), ' + uit.onderwerpen + ' boeken kregen thema\'s, trefwoorden of triggerwaarschuwingen van de oude website, ' + uit.eigen + ' keer eigen werk behouden, ' +
    uit.dubbel + ' keer een tweede exemplaar of uitgave van een boek dat al gekoppeld is, ' +
    uit.verborgen + ' boeken die op de oude website verborgen waren en niet in de Catalogus staan (niet in Na te kijken), ' +
    uit.nietGevonden.length + ' boeken niet gevonden in de Catalogus (zie Na te kijken).';
  logboek('menu', 'neemOudeBoekenOver', tekst + ' Bron: ' + oud.bron + ' (' + velden + ')');
  meld(tekst);
}

/** Menu: leest alle tabbladen met een rooster per maand en zet de shifts in het tabblad Shifts. */
function neemRoosterOverUitTabbladen() {
  var ss = spreadsheet();
  var eigen = Object.keys(KOLOMMEN);
  var shifts = [], bladen = [];
  ss.getSheets().forEach(function (blad) {
    if (eigen.indexOf(blad.getName()) > -1) return;
    var s = shiftsUitMaandblad(blad.getDataRange().getValues(), blad.getName());
    if (s && s.length) { shifts = shifts.concat(s); bladen.push(blad.getName()); }
  });
  if (!shifts.length) { meld('Geen tabblad met een rooster per maand gevonden. Importeer eerst het bestand: Bestand > Importeren > Uploaden, en kies Nieuwe bladen invoegen.'); return; }
  var tabel = spreadsheet().getSheetByName('Shifts') ? leesTabel('Shifts') : null;
  if (!tabel) { meld('Het tabblad Shifts ontbreekt nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
  var n = voegShiftsToe(tabel.rijen, shifts);
  if (n) bewaarTabel(tabel);
  var dicht = shifts.filter(function (s) { return s.rol === 'gesloten' || s.rol === 'workshop'; });
  logboek('menu', 'neemRoosterOverUitTabbladen', bladen.length + ' tabbladen, ' + n + ' nieuwe regels in Shifts');
  meld(bladen.length + ' tabbladen gelezen (' + bladen.join(', ') + '). ' + n + ' nieuwe regels in Shifts.' +
    (dicht.length ? ' Dicht of workshop: ' + dicht.map(function (s) { return korteDatum(s.datum) + ' (' + s.rol + ')'; }).join(', ') + '.' : '') +
    ' De tabbladen van het oude rooster mag je nu verwijderen.');
}

/** Menu: vraagt de link naar het oude blad en neemt de lopende uitleningen over. */
function neemUitleningenOver() {
  var ui = SpreadsheetApp.getUi();
  var vraag = ui.prompt('Uitleningen overnemen',
    'Plak de link naar het oude digitale uitleenblad (de Google-spreadsheet). De lopende uitleningen en de historiek komen mee. Opnieuw uitvoeren maakt niets dubbel.',
    ui.ButtonSet.OK_CANCEL);
  if (vraag.getSelectedButton() !== ui.Button.OK) return;
  var link = schoon(vraag.getResponseText());
  var oud;
  try {
    oud = SpreadsheetApp.openByUrl(link);
  } catch (e) {
    meld('Ik kan dat blad niet openen. Kijk of de link klopt en of jouw account het blad mag openen.');
    return;
  }
  // Het eerste tabblad met een kolom "Boek".
  var rijen = [];
  oud.getSheets().some(function (blad) {
    var bereik = blad.getDataRange();
    rijen = leesOudeUitleningen(bereik.getValues(), bereik.getFormulas());
    return rijen.length > 0;
  });
  if (!rijen.length) {
    meld('Ik vond geen tabblad met een kolom "Boek" in het oude blad.');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var staat = laadStaat('overzetten', false);
    var naTeKijken = leesTabel('Na te kijken');
    var gekozen = gekozenOudeBoeken(naTeKijken.rijen);
    var resultaat = verwerkOudeUitleningen(staat, rijen, gekozen);
    // Wat via een gekozen boek-ID overkwam, is afgehandeld.
    naTeKijken.rijen.forEach(function (r) {
      var m = String(r.waarde_bron || '').match(/\[(oud blad rij \d+)\]/);
      if (r.bron === 'Overzetten' && m && gekozen[m[1]] && jaNee(r.afgehandeld) !== 'ja' &&
        staat.uitleningen.some(function (u) { return u.bron === m[1]; })) wijzig(r, { afgehandeld: 'ja' });
    });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken.map(function (x) {
      x.waarde_bron = x.waarde_bron + ' [' + x.sleutel_extra + ']';
      return x;
    }), 'Overzetten', staat.vandaag);
    bewaarStaat(staat);
    bewaarTabel(naTeKijken);
    naTeKijkenNieuwsteBoven();
    leegCache();
    logboek('menu', 'neemUitleningenOver', resultaat.uitleningen + ' lopend, ' + resultaat.historiek + ' historiek, ' + resultaat.nietGevonden + ' boeken niet gevonden, ' + resultaat.leners + ' leners, ' + resultaat.hersteld + ' hersteld, ' + nieuw + ' na te kijken');
    meld(resultaat.uitleningen + ' lopende uitleningen en ' + resultaat.historiek + ' teruggebrachte uitleningen overgenomen, ' + resultaat.leners + ' nieuwe leners aangemaakt. ' +
      (resultaat.hersteld ? 'Bij ' + resultaat.hersteld + ' al overgenomen uitleningen zijn de datums, de borg of de gift hersteld. ' : '') +
      (resultaat.nietGevonden ? resultaat.nietGevonden + ' teruggebrachte boeken vond het script niet in de Catalogus. Ze staan in "Na te kijken" (veld historiek): zet daar het juiste boek-ID en kies dit menu-item opnieuw. ' : '') +
      nieuw + ' twijfelgevallen staan in "Na te kijken". Vraag nieuwe leners bij hun volgende bezoek om toestemming voor de privacyverklaring (kolom toestemming_privacy staat op "onbekend").');
  } finally {
    lock.releaseLock();
  }
}

/** Menu: Verkoop > Neem de verkooplijst over (tabblad Verkooplijst). */
function neemVerkooplijstOver() {
  var ss = spreadsheet();
  var blad = ss.getSheetByName(VERKOOPLIJST_TABBLAD);
  if (!blad || blad.getLastRow() < 2) {
    if (!blad) {
      blad = maakTabblad(VERKOOPLIJST_TABBLAD);
      blad.getRange(1, 1, 1, VERKOOPLIJST_KOP.length).setValues([VERKOOPLIJST_KOP]);
      opmaakKop(blad, VERKOOPLIJST_KOP.length);
    }
    meld('Plak de verkooplijst in het tabblad ' + VERKOOPLIJST_TABBLAD + ', met de kopregel erbij (Titel, Auteur(s), ISBN, ..., Aantal, Prijs). Kies daarna opnieuw dit menu.');
    return;
  }
  var lijst = leesVerkooplijst(blad.getDataRange().getValues());
  if (!lijst.length) { meld('Ik vind geen kopregel met "Titel" in het tabblad ' + VERKOOPLIJST_TABBLAD + '.'); return; }
  zorgVoorTabbladen(['Catalogus']);
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var tabel = leesTabel('Catalogus');
    var ids = maakIdGenerator(tabel.rijen);
    uit = verkooplijstToepassen(tabel.rijen, lijst, function (soort) { return ids.nieuw(soort); }, vandaagTekst());
    if (uit.length) bewaarTabel(tabel);
    // Het resultaat naast elke rij: verwerkt (datum en boek-ID) en een opmerking.
    var kol = lijst.kolommen;
    var kopRij = lijst.kopRij;
    var breedte = blad.getLastColumn();
    var kolVerwerkt = kol.verwerkt > -1 ? kol.verwerkt + 1 : breedte + 1;
    var kolOpmerking = kol.opmerking > -1 ? kol.opmerking + 1 : (kol.verwerkt > -1 ? breedte + 1 : breedte + 2);
    blad.getRange(kopRij, kolVerwerkt).setValue('verwerkt');
    blad.getRange(kopRij, kolOpmerking).setValue('opmerking');
    uit.forEach(function (r) {
      blad.getRange(r.rij, kolVerwerkt).setValue(r.verwerkt);
      blad.getRange(r.rij, kolOpmerking).setValue(r.opmerking);
    });
  } finally {
    lock.releaseLock();
  }
  var verkopen = ss.getSheetByName('Verkopen') ? leesTabel('Verkopen').rijen : [];
  schrijfVoorraad(leesTabel('Catalogus').rijen, verkopen);
  leegCache();
  var nieuw = uit.filter(function (r) { return r.nieuw; }).length;
  var zonderPrijs = uit.filter(function (r) { return /prijs nog/.test(r.opmerking); }).length;
  var tekst = uit.length + ' boeken uit de verkooplijst overgenomen: ' + (uit.length - nieuw) + ' stonden al in de catalogus, ' + nieuw +
    ' kwamen erbij als boek dat enkel te koop is (niet op de website). ' + (zonderPrijs ? zonderPrijs + ' hebben nog geen prijs: vul die in de kolom prijs van de Catalogus in. ' : '') +
    'De Voorraad is bijgewerkt. De kolommen verwerkt en opmerking in het tabblad ' + VERKOOPLIJST_TABBLAD + ' tonen wat er met elke rij gebeurde.';
  logboek('menu', 'neemVerkooplijstOver', uit.length + ' boeken overgenomen, ' + nieuw + ' nieuw, ' + zonderPrijs + ' zonder prijs.');
  meld(tekst);
}

/** Staat er in de herkomst een interne notitie dat het boek niet publiek mag? */
function nietPubliekVolgensHerkomst(herkomst) {
  return /niet\s+(op\s+(de\s+)?)?(site|website|online)|niet\s+publiek/i.test(herkomst || '');
}

/**
 * Voegt de boeken uit Stock en Zines samen met de bestaande Catalogus.
 * bestaand: rijen van de Catalogus (worden aangevuld, nooit overschreven).
 * bron: boek-objecten uit leesBronRijen.
 * nieuwId: functie(soort) die een nieuwe, unieke boek-ID geeft.
 * Geeft { nieuw, aangevuld } terug (aantallen).
 */

/** De foutmelding aan de balie voor een boek dat niet uitleenbaar is. */
function nietUitleenbaarFout(boek) {
  return boekStatus(boek) === 'verloren' ? 'Dit boek staat als verloren. Zet de status in de Catalogus leeg als het terug is.' : 'Dit boek is niet uitleenbaar.';
}

/**
 * Nieuwe lener inschrijven.
 * invoer: { voornaam, achternaam, telefoon, email, toestemming }
 */
function nieuweLener(staat, invoer) {
  var voornaam = tekstInvoer(invoer.voornaam, 50);
  var achternaamWaarde = tekstInvoer(invoer.achternaam, 80);
  var telefoon = opmaakGsm(tekstInvoer(invoer.telefoon, 25));
  var email = tekstInvoer(invoer.email, 100).toLowerCase();
  if (!voornaam) return { ok: false, fout: 'Vul een voornaam in.' };
  if (!telefoon && !email) return { ok: false, fout: 'Vul een telefoonnummer of een e-mailadres in (of allebei).' };
  if (email && !geldigEmail(email)) return { ok: false, fout: 'Dit e-mailadres lijkt niet te kloppen.' };
  if (telefoon && !geldigeTelefoon(telefoon)) return { ok: false, fout: 'Dit telefoonnummer lijkt niet te kloppen.' };
  if (invoer.toestemming !== true) return { ok: false, fout: 'Zonder toestemming voor de privacyverklaring kunnen we geen gegevens bewaren.' };
  var dubbel = staat.leners.filter(function (l) {
    return (email && String(l.email).toLowerCase() === email) || (telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(telefoon));
  })[0];
  if (dubbel) return { ok: false, fout: 'Deze persoon is al ingeschreven als lener ' + lenerNaam(staat, dubbel.lenersnummer) + '.' };
  var nummer = nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }));
  voegToe(staat.leners, {
    lenersnummer: nummer, voornaam: voornaam, achternaam: achternaamWaarde, telefoon: telefoon, email: email,
    datum_inschrijving: staat.vandaag, toestemming_privacy: 'ja', actief: 'ja'
  });
  staat.log.push(['nieuwe lener', 'lener ' + nummer]);
  return { ok: true, lenersnummer: nummer, voornaam: voornaam, tekst: 'Lenersnummer ' + nummer };
}

function nieuwIdVoor(rijen, kolom, sleutel, letter) {
  return function () {
    return letter + metNullen(volgendNummer(sleutel, rijen.map(function (r) { return r[kolom]; })), 4);
  };
}

/**
 * Nieuw volgnummer. In de spreadsheet levert Api.js een teller die nooit terugtelt.
 * Zonder teller (in de tests) nemen we het hoogste bestaande nummer plus 1.
 */
function nieuwNummer(staat, soort, bestaande) {
  if (staat.nieuwNummer) return staat.nieuwNummer(soort, bestaande);
  var max = 0;
  bestaande.forEach(function (w) { max = Math.max(max, Number(String(w).replace(/\D/g, '')) || 0); });
  return max + 1;
}

/* ---------- Controle van invoer ---------- */

/**
 * Normaliseert een ISBN of ISSN zoals het in de stocklijst staat.
 * Geeft een object terug:
 *   isbn:    het ISBN-13 als het geldig is, anders ''
 *   issn:    het ISSN (formaat 1234-5678) als het een ISSN is, anders ''
 *   geldig:  true als het nummer klopt
 *   leeg:    true als er niets ingevuld was
 */
function normaliseerIsbn(waarde) {
  var ruw = schoon(waarde).toUpperCase();
  if (!ruw) return { isbn: '', issn: '', geldig: false, leeg: true };
  // Een getal uit de spreadsheet kan als 9.78E+12 binnenkomen: zet het eerst om.
  if (typeof waarde === 'number') ruw = String(Math.round(waarde));
  var tekens = ruw.replace(/^ISBN|^ISSN/, '').replace(/[^0-9X]/g, '');
  if (tekens.length === 10 && isbn10Geldig(tekens)) return { isbn: isbn10Naar13(tekens), issn: '', geldig: true, leeg: false };
  if (tekens.length === 13 && isbn13Geldig(tekens)) return { isbn: tekens, issn: '', geldig: true, leeg: false };
  if (tekens.length === 8) return { isbn: '', issn: tekens.slice(0, 4) + '-' + tekens.slice(4), geldig: true, leeg: false };
  return { isbn: '', issn: '', geldig: false, leeg: false };
}

/* ---------- Getallen en datums ---------- */

/** Maakt de taal eenvormig: "engels", "EN" en "English" worden "Engels". */
function normaliseerTaal(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  var tabel = {
    'nederlands': 'Nederlands', 'nl': 'Nederlands', 'dutch': 'Nederlands', 'vlaams': 'Nederlands', 'ned': 'Nederlands',
    'engels': 'Engels', 'en': 'Engels', 'english': 'Engels', 'eng': 'Engels',
    'frans': 'Frans', 'fr': 'Frans', 'french': 'Frans', 'francais': 'Frans', 'fre': 'Frans',
    'duits': 'Duits', 'de': 'Duits', 'german': 'Duits', 'deutsch': 'Duits', 'ger': 'Duits',
    'spaans': 'Spaans', 'es': 'Spaans', 'spanish': 'Spaans', 'spa': 'Spaans'
  };
  if (tabel[t]) return tabel[t];
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Kleine letters, zonder accenten en leestekens. "Émile Zola!" wordt "emile zola". */
function normaliseerTekst(waarde) {
  return schoon(waarde)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Maakt de uitvoering eenvormig (Hardcover, Paperback, Pocket). */
function normaliseerUitvoering(waarde) {
  var t = normaliseerTekst(waarde);
  if (!t) return '';
  if (t.indexOf('hard') > -1 || t === 'gebonden') return 'Hardcover';
  if (t.indexOf('pocket') > -1 || t.indexOf('mass market') > -1) return 'Pocket';
  if (t.indexOf('paper') > -1 || t.indexOf('soft') > -1 || t === 'ingenaaid') return 'Paperback';
  var s = schoon(waarde);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- ISBN ---------- */

/**
 * Onthoudt wanneer de daglimiet van Google voor vragen naar buiten op was. In de eigenschappen van
 * het script (die vervallen niet, zoals de cache na 6 uur), zodat de voorrang van de films ook na
 * die 6 uur nog werkt.
 */
function noteerDaglimiet() {
  try { PropertiesService.getScriptProperties().setProperty(DAGLIMIET_SLEUTEL, String(Date.now())); } catch (e) { /* niet erg */ }
  try { CacheService.getScriptCache().put(DAGLIMIET_SLEUTEL, String(Date.now()), 6 * 60 * 60); } catch (e) { /* niet erg */ }
}

/** Tekstherkenning via Google Drive: de foto wordt even een Google Doc, daarna gaat die naar de prullenbak. */
function ocrViaDrive(base64, mime) {
  if (typeof Drive === 'undefined' || !Drive.Files) {
    throw new Error('Zet eerst in Apps Script de service Drive API aan: links naast Services op + klikken, Drive API kiezen en Toevoegen.');
  }
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mime, 'achterkant');
  var bestand = Drive.Files.create
    ? Drive.Files.create({ name: 'Madrigal tekstherkenning', mimeType: 'application/vnd.google-apps.document' }, blob, { ocrLanguage: 'nl', fields: 'id' })
    : Drive.Files.insert({ title: 'Madrigal tekstherkenning', mimeType: 'application/vnd.google-apps.document' }, blob, { ocr: true, ocrLanguage: 'nl' });
  try {
    return DocumentApp.openById(bestand.id).getBody().getText();
  } finally {
    DriveApp.getFileById(bestand.id).setTrashed(true);
  }
}

/* ---------- Covers van Internet Archive nakijken ---------- */

/** Het adres van een cover bij Open Library, uit het nummer van die cover. */
function olCoverUrl(coverId) {
  return 'https://covers.openlibrary.org/b/id/' + coverId + '-M.jpg';
}

/** Een beschrijving uit Open Library: tekst, of een object met value. */
function olTekst(description) {
  if (!description) return '';
  return typeof description === 'string' ? description : String(description.value || '');
}

/** Het werk van Open Library dat hetzelfde boek is, uit search.json. Geeft de sleutel (/works/OL…W) of ''. */
function olWerkOpTitel(docs, boek) {
  var kern = titelKern(boek.titel), naam = achternaam(boek.auteur);
  var doc = (docs || []).filter(function (d) {
    if (gelijkenis(titelKern(d.title), kern) < 0.85) return false;
    return !naam || (d.author_name || []).some(function (a) { return achternaam(a) === naam; });
  })[0];
  return doc && /^\/works\/OL\d+W$/.test(String(doc.key)) ? doc.key : '';
}

/** Zoekt bij Open Library. Geeft { docs } of { limiet: true }. */
function olZoek(parameters) {
  var r = haalJson('https://openlibrary.org/search.json?' + parameters + '&fields=key,title,author_name,cover_i&limit=5');
  if (r.code === 429 || r.code >= 500) return { limiet: true, code: r.code };
  return { docs: (r.data && r.data.docs) || [] };
}

/**
 * De keuzes voor de keuzelijst onderwerp_nieuw: de vaste thema's van de website en de genres uit Onderwerpen
 * (bv. Politiek), elk één keer in de juiste schrijfwijze.
 * Geeft { themas: [...], genres: [...], lijst: [thema's en genres samen, alfabetisch] }.
 */
function onderwerpKeuzes(onderwerpRijen, catalogus) {
  // Enkel de vaste thema's van de website, en de genres elk één keer in de juiste schrijfwijze (zie Genres.js).
  var themas = alleThemas().filter(function (f) { return f !== 'Zines' && f !== 'Klassiekers'; });
  var genres = [], gezien = {};
  (onderwerpRijen || []).forEach(function (r) {
    if (isLeeg(r.genre)) return;
    var k = genreSleutel(r.genre);
    if (gezien[k]) return;
    gezien[k] = true;
    genres.push(genreMooi(r.genre));
  });
  var sorteer = function (x, y) { return x.localeCompare(y, 'nl'); };
  genres.sort(sorteer);
  var alleenGenre = genres.filter(function (g) { return !themas.some(function (t) { return normaliseerTekst(t) === normaliseerTekst(g); }); });
  return { themas: themas.slice().sort(sorteer), genres: genres, lijst: themas.concat(alleenGenre).sort(sorteer) };
}

/**
 * De nakijklijst toepassen bij de rijen met toepassen = ja. Per keuze in onderwerp_nieuw:
 *   - een thema: erbij in extra_onderwerpen;
 *   - een genre uit Onderwerpen (bv. Politiek): wordt het genre van het boek als dat nog leeg is, anders komen de
 *     thema's van dat genre erbij in extra_onderwerpen;
 *   - iets anders (zelf getypt): erbij in extra_onderwerpen, als nieuw thema.
 * Geeft het aantal boeken.
 */
function onderwerpNakijklijstToepassen(catalogus, rijen, onderwerpRijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var keuzes = onderwerpKeuzes(onderwerpRijen, catalogus);
  var vertaal = vertaalTabel(onderwerpRijen || []);
  var zoek = function (lijst, w) { return lijst.filter(function (x) { return normaliseerTekst(x) === normaliseerTekst(w); })[0]; };
  var n = 0;
  rijen.forEach(function (r) {
    if (jaNee(r.toepassen) !== 'ja' || isLeeg(r.onderwerp_nieuw)) return;
    var boek = perId[String(r.boek_id)];
    if (!boek) return;
    var lijst = splitsLijst(boek.extra_onderwerpen);
    var velden = {};
    var erbij = function (o) { if (!lijst.some(function (x) { return normaliseerTekst(x) === normaliseerTekst(o); })) lijst.push(schoon(o)); };
    splitsLijst(r.onderwerp_nieuw).forEach(function (o) {
      var thema = zoek(keuzes.themas, o);
      var genre = zoek(keuzes.genres, o);
      if (thema) erbij(thema);
      else if (genre && isLeeg(boek.genre) && !velden.genre) velden.genre = genre;
      else if (genre) (vertaal[normaliseerTekst(genre)] || []).forEach(erbij);
      else erbij(o);
    });
    if (lijst.join(', ') !== schoon(boek.extra_onderwerpen)) velden.extra_onderwerpen = lijst.join(', ');
    if (Object.keys(velden).length) wijzig(boek, velden);
    wijzig(r, { toepassen: 'gedaan' });
    n++;
  });
  return n;
}

/* ---------- In Apps Script ---------- */

/** Hoe vaak elk thema voorkomt in de titel en de beschrijving van een boek. Geeft [[thema, aantal]], hoogste eerst. */
function onderwerpScores(boek) {
  var woorden = normaliseerTekst([boek.titel, boek.beschrijving, boek.beschrijving_en].join(' ')).split(' ').filter(Boolean);
  var scores = {};
  woorden.forEach(function (w, i) {
    var paar = w + ' ' + (woorden[i + 1] || '');
    ONDERWERP_TEKST_WOORDEN.forEach(function (t) {
      // Een woord telt hoogstens één keer per thema.
      var raak = t[1].some(function (k) {
        if (k.charAt(0) === '=') return w === k.slice(1);
        return k.indexOf(' ') > -1 ? paar.indexOf(k + ' ') === 0 || paar === k : w.indexOf(k) === 0;
      });
      if (raak) scores[t[0]] = (scores[t[0]] || 0) + 1;
    });
  });
  return Object.keys(scores).map(function (t) { return [t, scores[t]]; })
    .sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
}

/**
 * Zet het menu klaar telkens de spreadsheet opent. Bovenaan wat je het vaakst nodig hebt,
 * daarna een deelmenu per onderwerp, en achteraan wat je enkel bij de start gebruikt.
 * Een nieuw menu-item? Zet het in het passende deelmenu, en verwijs in de README en in
 * meldingen naar "Madrigal > Deelmenu > Item".
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Madrigal')
    // Vaak nodig.
    .addItem('Ververs de publieke catalogus', 'verversMenu')
    .addItem('Installeer tabbladen (na een nieuw script)', 'installeer')
    .addSeparator()
    // De collectie: boeken, titels, covers, beschrijvingen, films en verkoop.
    .addSubMenu(ui.createMenu('Boeken')
      .addItem('Nieuwe boeken verwerken', 'verwerkNieuweBoeken')
      .addItem('Vul gegevens aan uit Open Library', 'vulAanUitOpenLibrary')
      .addItem('Werk de vertaaltabel Onderwerpen bij', 'werkOnderwerpenBijMenu')
      .addSeparator()
      .addItem('Onderwerpen: vul ontbrekende aan', 'vulOntbrekendeOnderwerpenMenu')
      .addItem('Onderwerpen: pas de nakijklijst toe', 'pasOnderwerpNakijklijstToe')
      .addItem('Onderwerpen: pas de nieuwe thema\'s toe op de vertaaltabel', 'vertaaltabelNieuweThemasMenu')
      .addSeparator()
      .addItem('Genres en thema\'s: kuis op (zelfde schrijfwijze)', 'kuisGenresOp')
      .addItem('Categorieën en trefwoorden: vernieuw de lijst en de keuzelijsten', 'vernieuwCategorieenMenu')
      .addItem('Deel de boeken in op titel en beschrijving (thema, categorie, trefwoord)', 'deelBoekenInMenu')
      .addItem('ISBN-10: vul aan uit het ISBN', 'isbn10AanvullenMenu'))
    .addSubMenu(ui.createMenu('Titels en auteurs')
      .addItem('Schrijfwijze: maak een nakijklijst', 'maakTitelNakijklijst')
      .addItem('Schrijfwijze: pas de nakijklijst toe', 'pasTitelNakijklijstToe')
      .addSeparator()
      .addItem('Titelcontrole in de bib: maak de lijst', 'maakTitelcontroleMenu')
      .addSeparator()
      .addItem('Auteurs: zet alles in de vorm Achternaam, Voornaam', 'auteursOpkuisenMenu')
      .addItem('Auteursnamen: pas gekozen namen en pseudoniemen toe', 'auteursnamenMenu'))
    .addSubMenu(ui.createMenu('Covers')
      .addItem('Zoek covers bij Google Books', 'vulAanUitGoogleBooks')
      .addItem('Zoek covers bij bol.com', 'zoekCoversBol')
      .addItem('Zoek covers bij Internet Archive', 'zoekCoversInternetArchive')
      .addItem('Zoek covers van andere uitgaven', 'zoekCoversAndereUitgaven')
      .addSeparator()
      .addItem('Zoek opnieuw bij Google', 'zoekCoversOpnieuw')
      .addItem('Zoek opnieuw bij boeken met nieuwe gegevens (cover en beschrijving)', 'zoekOpnieuwMenu')
      .addItem('Internet Archive: zoek de boeken van vandaag opnieuw', 'zoekIaVanVandaagOpnieuw')
      .addItem('Internet Archive: kijk de bewaarde covers na (wist het logo)', 'controleerIaCovers')
      .addItem('Verwijder standaardafbeeldingen (zoals LibraryThing)', 'verwijderStandaardCovers')
      .addSeparator()
      .addItem('Bewaar alle covers in Google Drive (kopie van covers van andere sites)', 'startCoversBewaren'))
    .addSubMenu(ui.createMenu('Beschrijvingen')
      .addItem('Zoek ontbrekende beschrijvingen', 'vulBeschrijvingenAan')
      .addItem('Zoek beschrijvingen bij Wikipedia', 'zoekBeschrijvingenWikipedia')
      .addItem('Zoek afgebroken beschrijvingen opnieuw', 'herstelAfgebrokenBeschrijvingen')
      .addSeparator()
      .addItem('Vertaal de beschrijvingen', 'vertaalBeschrijvingen'))
    .addSubMenu(ui.createMenu('Films')
      .addItem('Haal de Letterboxd-lijst op', 'haalLetterboxdLijst')
      .addItem('Neem de films over uit dit tabblad (CSV van IMDb of Letterboxd)', 'neemFilmsOverUitTabblad')
      .addItem('Vul de films aan (Wikidata en Wikipedia)', 'vulFilmsAan')
      .addItem('Deel de films in op titel en beschrijving (trefwoorden)', 'deelFilmsInMenu'))
    .addSubMenu(ui.createMenu('Verkoop')
      .addItem('Werk de voorraad bij', 'voorraadBijwerkenMenu')
      .addItem('Neem de verkooplijst over (tabblad Verkooplijst)', 'neemVerkooplijstOver'))
    .addSeparator()
    // De spreadsheet zelf.
    .addSubMenu(ui.createMenu('Spreadsheet en onderhoud')
      .addItem('Orden tabbladen en instellingen', 'ordenAlles')
      .addItem('Maak de brede tabbladen overzichtelijk', 'maakTabbladenOverzichtelijk')
      .addSeparator()
      .addItem('Maak nu een back-up', 'maakBackupMenu')
      .addItem('Privacy-opruiming nu uitvoeren', 'ruimOp')
      .addItem('Zet de gsm-nummers van de leners in één vorm (0495/64.48.48)', 'gsmNummersMenu'))
    .addSubMenu(ui.createMenu('Testen')
      .addItem('Test Google Books (kies eerst een cel met een ISBN)', 'testGoogleBooks')
      .addItem('Test bol.com (kies eerst een cel met een ISBN)', 'testBol')
      .addItem('Wikipedia: test het opzoeken', 'testWikipedia')
      .addItem('Wikipedia: test het bewaren', 'testWikipediaBewaren')
      .addItem('Peperfabriek: test het ophalen', 'testPeperfabriek'))
    .addSeparator()
    // Eenmalig: de overstap naar dit systeem en van de oude website.
    .addSubMenu(ui.createMenu('Eenmalig bij de start')
      .addItem('Bouw de catalogus uit Stock en Zines', 'maakCatalogus')
      .addItem('Vul aan uit Goodreads', 'vulAanUitGoodreads')
      .addItem('Neem de uitleningen over (lopend en historiek)', 'neemUitleningenOver')
      .addItem('Neem een oud rooster over uit de tabbladen (een tabblad per maand)', 'neemRoosterOverUitTabbladen')
      .addItem('Neem het draaiboek voor vrijwilligers over (checklists en vragen)', 'neemDraaiboekOver')
      .addItem('Verdeel Geschiedenis en maatschappij in drie thema\'s', 'verdeelOudeGroepMenu')
      .addItem('Wis de aanraders die uit de stocklijst kwamen', 'wisAanradersUitStock')
      .addSeparator()
      .addItem('Oude website: neem nieuws, agenda en vragen over', 'importeerOudeSite')
      .addItem('Oude website: neem beschrijvingen, covers, categorieën en thema\'s van de boeken over', 'neemOudeBoekenOver')
      .addItem('Oude website: neem de rijen uit Na te kijken over met overnemen = ja', 'neemAangeduideOudeBoekenOver')
      .addItem('Oude website: kopieer de covers verder', 'startOudeCovers')
      .addSeparator()
      .addItem('Catalogus wissen en opnieuw opbouwen', 'herbouwCatalogus'))
    .addToUi();
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

/** De briefjes die nog op Vandaag staan, nieuwste eerst. */
function openBriefjes(rijen, vandaag) {
  return (rijen || []).filter(function (b) {
    var d = parseerDatum(b.datum);
    return b.status === 'open' && d && dagenTussen(d, vandaag) <= BRIEFJE_ZICHTBAAR_DAGEN;
  }).map(function (b) {
    return { briefje_id: String(b.briefje_id), datum: parseerDatum(b.datum), wie: schoon(b.wie), tekst: schoonMetRegels(b.tekst) };
  }).sort(function (a, b) { return b.datum.localeCompare(a.datum) || b.briefje_id.localeCompare(a.briefje_id); });
}

/** De open meldingen voor het bestuursscherm, oudste eerst. */
function openMeldingen(rijen) {
  return (rijen || []).filter(function (m) { return m.status === MELDING_NIEUW; }).map(function (m) {
    return { melding_id: String(m.melding_id), datum: parseerDatum(m.datum) || String(m.datum || ''), wie: schoon(m.wie),
      soort: schoon(m.soort), onderwerp: schoon(m.onderwerp), bericht: schoonMetRegels(m.bericht) };
  }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
}

/** De open voorstellen voor het bestuursscherm, oudste eerst. */
function openVoorstellen(rijen) {
  return (rijen || []).filter(function (v) { return v.status === VOORSTEL_NIEUW; }).map(function (v) {
    return { voorstel_id: String(v.voorstel_id), datum: parseerDatum(v.datum) || String(v.datum || ''), boek_id: String(v.boek_id),
      titel: schoon(v.titel), tekst: schoonMetRegels(v.tekst), voorgesteld_door: schoon(v.voorgesteld_door) };
  }).sort(function (a, b) { return a.datum.localeCompare(b.datum); });
}

/**
 * Een Belgisch gsm-nummer in één vorm: 0495/64.48.48 (ook vanuit +32 495 64 48 48 of 0495644848).
 * Andere nummers (vast, buitenland) blijven zoals ze zijn.
 */
function opmaakGsm(t) {
  var c = telefoonSleutel(t);
  if (!/^04\d{8}$/.test(c)) return schoon(t);
  return c.slice(0, 4) + '/' + c.slice(4, 6) + '.' + c.slice(6, 8) + '.' + c.slice(8);
}

/** Opmaak van de kopregel: vet, vastgezet. */
function opmaakKop(blad, kolommen) {
  if (kolommen < 1) return;
  blad.getRange(1, 1, 1, kolommen).setFontWeight('bold');
  blad.setFrozenRows(1);
}

/** Mag het boek op de website? Niet bij publiek = nee of gevoelig verborgen. Een verloren boek staat er als niet meer beschikbaar. */
function opWebsite(boek) {
  return jaNee(boek.publiek) !== 'nee' && boekStatus(boek) !== 'gevoelig_verborgen';
}

/** Menu: orden de tabbladen en de instellingen. */
function ordenAlles() {
  var ss = spreadsheet();
  ordenInstellingen(ss);
  ordenTabbladen(ss);
  leegCache();
  meld('De tabbladen en de instellingen staan nu geordend.');
}

/** Herschikt het tabblad Instellingen per thema. */
function ordenInstellingen(ss) {
  var blad = ss.getSheetByName('Instellingen');
  if (!blad || blad.getLastRow() < 1) return;
  var oud = blad.getLastRow() > 1 ? blad.getRange(2, 1, blad.getLastRow() - 1, 3).getValues() : [];
  var nieuw = ordenInstellingRijen(oud);
  if (!nieuw.rijen.length) return;
  // Eerst alles lezen, dan in één keer schrijven: zo gaat er geen waarde verloren.
  if (blad.getLastRow() > 1) blad.getRange(2, 1, blad.getLastRow() - 1, 3).clear();
  blad.getRange(2, 1, nieuw.rijen.length, 3).setValues(nieuw.rijen).setVerticalAlignment('top');
  blad.getRange(2, 2, nieuw.rijen.length, 2).setWrap(true);
  nieuw.koppen.forEach(function (i) {
    blad.getRange(i + 2, 1, 1, 3).setBackground('#e6dcf2').setFontWeight('bold');
  });
  opmaakKop(blad, 3);
}

/**
 * Zet de rijen van het tabblad Instellingen (zonder kopregel) in de volgorde
 * van INSTELLING_GROEPEN. Elke rij is [sleutel, waarde, uitleg].
 *   - Bestaande waarden blijven staan. Een lege cel krijgt de standaardwaarde. De uitleg komt uit STANDAARD_INSTELLINGEN.
 *   - Ontbrekende instellingen komen erbij met hun standaardwaarde.
 *   - Onbekende sleutels (bv. zelf toegevoegd) gaan naar een groep "Overige".
 *   - Oude tussenkoppen en lege rijen verdwijnen.
 * Geeft { rijen, koppen } terug: koppen zijn de indexen van de tussenkoppen.
 */
function ordenInstellingRijen(bestaand) {
  var perSleutel = {};
  var volgorde = [];
  bestaand.forEach(function (r) {
    var s = schoon(r[0]);
    if (!s || isInstellingKop(s) || perSleutel.hasOwnProperty(s)) return;
    perSleutel[s] = r;
    volgorde.push(s);
  });
  var standaard = {};
  STANDAARD_INSTELLINGEN.forEach(function (r) { standaard[r[0]] = r; });

  var rijen = [], koppen = [], gebruikt = {};
  function groep(titel, sleutels) {
    if (!sleutels.length) return;
    koppen.push(rijen.length);
    rijen.push([instellingKop(titel), '', '']);
    sleutels.forEach(function (s) {
      gebruikt[s] = true;
      var oud = perSleutel[s];
      var std = standaard[s];
      // Een lege cel krijgt de standaardwaarde. De website gebruikte die toch al (zie verwerkInstellingen),
      // zo zie en bewerk je ze ook in de spreadsheet. Een code laten we leeg: die vult installeer apart in.
      var waarde = oud && (!isLeeg(oud[1]) || !std || CODE_INSTELLINGEN.indexOf(s) > -1) ? oud[1] : (std ? std[1] : '');
      rijen.push([s, waarde, std ? std[2] : (oud ? oud[2] || '' : '')]);
    });
  }
  INSTELLING_GROEPEN.forEach(function (g) {
    groep(g[0], g[1].filter(function (s) { return standaard.hasOwnProperty(s) || perSleutel.hasOwnProperty(s); }));
  });
  // Staat een standaardinstelling in geen enkele groep, dan toch niet verliezen.
  var rest = STANDAARD_INSTELLINGEN.map(function (r) { return r[0]; })
    .concat(volgorde)
    .filter(function (s, i, lijst) { return !gebruikt[s] && lijst.indexOf(s) === i; });
  groep('Overige', rest);
  return { rijen: rijen, koppen: koppen };
}

/** Zet de tabbladen in vaste volgorde, met een kleur per groep. */
function ordenTabbladen(ss) {
  var volgorde = tabbladVolgorde(ss.getSheets().map(function (b) { return b.getName(); }));
  volgorde.forEach(function (t, i) {
    var blad = ss.getSheetByName(t.naam);
    ss.setActiveSheet(blad);
    ss.moveActiveSheet(i + 1);
    if (t.kleur) blad.setTabColor(t.kleur);
  });
  ss.setActiveSheet(ss.getSheets()[0]);
}

function ordenTabbladenEenmalig() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('tabbladen_versie') === TABBLADEN_VERSIE) return;
  ordenTabbladen(spreadsheet());
  props.setProperty('tabbladen_versie', TABBLADEN_VERSIE);
  logboek('systeem', 'tabbladen', 'De tabbladen staan in hun vaste volgorde, per groep.');
}

/** Een boek van de oude website: { id, isbn, titel, auteur, beschrijving, cover }. basis: adres van de databank. */
function oudBoekUitRij(r, basis) {
  var auteurs = eersteVeld(r, ['authors', 'author', 'auteurs', 'auteur']);
  // Meerdere auteurs met ; ertussen: een komma hoort bij "Achternaam, Voornaam" (zie oudeAchternamen).
  if (Array.isArray(auteurs)) auteurs = auteurs.map(function (a) { return a && typeof a === 'object' ? (a.name || a.naam || '') : a; }).filter(Boolean).join('; ');
  var beeld = schoon(eersteVeld(r, ['image', 'cover', 'cover_url', 'coverUrl', 'uuid']));
  var cover = '';
  if (beeld) cover = /^https?:\/\//.test(beeld) ? beeld.replace(/^http:/, 'https:') : basis + '/storage/v1/object/public/covers/' + beeld.replace(/^covers\//, '').replace(/\.jpe?g$/i, '') + '.jpg';
  var titel = schoon(eersteVeld(r, ['title', 'titel', 'name']));
  var ondertitel = schoon(eersteVeld(r, ['subtitle', 'ondertitel']));
  return {
    id: String(eersteVeld(r, ['id', 'uuid'])),
    // isbn13 eerst, anders isbn10 (dat wordt een ISBN-13).
    isbn: normaliseerIsbn(eersteVeld(r, ['isbn', 'isbn13', 'isbn10', 'ean'])).isbn,
    // Op de oude website verborgen (hidden): vaak een boek dat er niet meer is.
    verborgen: r.hidden === true || jaNee(r.hidden) === 'ja',
    titel: titel, ondertitel: ondertitel, auteur: schoon(auteurs),
    beschrijving: htmlNaarTekst(eersteVeld(r, ['description', 'beschrijving', 'summary', 'content'])),
    cover: cover,
    onderwerpen: oudeOnderwerpen(r.tags)
  };
}

/**
 * Neemt de rijen van Na te kijken over waar overnemen = ja: de beschrijving en cover van het oude boek
 * gaan naar het boek in de kolom boek_id (dat mag je zelf aanpassen). Jouw keuze gaat voor, ook op eigen werk.
 * oudPerId: { code van de oude website: oud boek }. Geeft { gedaan, covers, fouten: [tekst] }.
 */
function oudeAangeduideOvernemen(catalogus, naRijen, oudPerId) {
  var perId = {};
  catalogus.forEach(function (c) { if (!isLeeg(c.boek_id)) perId[String(c.boek_id).trim()] = c; });
  var uit = { gedaan: 0, covers: 0, fouten: [] };
  naRijen.forEach(function (r) {
    if (schoon(r.bron) !== 'oude website' || jaNee(r.overnemen) !== 'ja' || jaNee(r.afgehandeld) === 'ja') return;
    var code = (String(r.waarde_bron || '').match(/\[oud ([^\]]+)\]/) || [])[1];
    var boek = perId[String(r.boek_id || '').trim()];
    var oud = code ? oudPerId[code] : null;
    if (!boek) { uit.fouten.push('"' + schoon(r.titel) + '": boek-ID ' + (schoon(r.boek_id) || '(leeg)') + ' staat niet in de Catalogus.'); return; }
    if (!oud) { uit.fouten.push('"' + schoon(r.titel) + '": kies eerst nog eens Neem beschrijvingen en covers over, dan krijgt deze rij een code van de oude website.'); return; }
    var velden = {};
    if (oud.beschrijving) {
      velden.beschrijving = maakBeschrijvingNetjes(oud.beschrijving);
      velden.beschrijving_bron = OUDE_COVER_BRON;
      velden.beschrijving_en = '';
      velden.beschrijving_vertaald = '';
    }
    if (oud.cover) { velden.oude_cover = oud.cover; uit.covers++; }
    wijzig(boek, velden);
    wijzig(r, { afgehandeld: 'ja', overnemen: 'gedaan' });
    uit.gedaan++;
  });
  return uit;
}

/**
 * De achternamen van alle auteurs: "Verzonnen, Vera; Noor Bedacht" geeft ["verzonnen", "bedacht"].
 * Auteurs scheiden we met ; & / en "en" of "and". Een komma hoort bij "Achternaam, Voornaam".
 */
function oudeAchternamen(auteur) {
  return schoon(auteur).split(/;|&|\/| en | and /).map(function (deel) { return achternaam(deel); }).filter(Boolean);
}

/** Een afbeelding: een volledige link, of een pad in de opslag van de oude databank. */
function oudeAfbeelding(waarde, basis) {
  var w = schoon(waarde);
  if (!w) return '';
  if (/^https:\/\//.test(w)) return w;
  if (/^http:\/\//.test(w)) return w.replace(/^http:/, 'https:');
  return basis ? basis + '/storage/v1/object/public/' + w.replace(/^\//, '') : w;
}

function oudeBoekenToepassen(catalogus, oudeBoeken, eigen, vertaal) {
  var standaard = oudeStandaardCovers(oudeBoeken);
  var koppeling = oudeParen(catalogus, oudeBoeken);
  var uit = { beschrijvingen: 0, covers: 0, onderwerpen: 0, eigen: 0, gelijk: 0, dubbel: koppeling.dubbel, verborgen: koppeling.verborgen, nietGevonden: koppeling.rest, hoe: {}, gekoppeld: {} };
  koppeling.paren.forEach(function (paar) {
    var oud = paar[0], gevonden = paar[1];
    uit.hoe[gevonden.hoe] = (uit.hoe[gevonden.hoe] || 0) + 1;
    var boek = gevonden.boek;
    var id = String(boek.boek_id);
    uit.gekoppeld[id] = oud.titel; // voor Na te kijken: aan welk oud boek dit boek al hangt
    var velden = {};
    if (oud.beschrijving) {
      if (eigen.beschrijving[id]) uit.eigen++;
      // Vergelijken zoals het in de Catalogus komt (opgekuist en ingekort): anders lijkt een lange tekst elke keer nieuw.
      else if (normaliseerTekst(maakBeschrijvingNetjes(oud.beschrijving)) === normaliseerTekst(boek.beschrijving)) uit.gelijk++;
      else {
        // Een nieuwe Nederlandse tekst: ook de Engelse vertaling opnieuw laten maken.
        velden.beschrijving = maakBeschrijvingNetjes(oud.beschrijving);
        // De bron "oude website": geen enkele zoektocht (Google, Wikipedia, ...) overschrijft deze tekst nog.
        velden.beschrijving_bron = OUDE_COVER_BRON;
        velden.beschrijving_en = '';
        velden.beschrijving_vertaald = '';
        uit.beschrijvingen++;
      }
    }
    if (oud.cover && !standaard[oud.cover] && schoon(boek.cover_bron) !== OUDE_COVER_BRON) {
      if (isEigenCover(boek, eigen)) uit.eigen++;
      else { velden.oude_cover = oud.cover; uit.covers++; }
    }
    var onderwerp = oudeOnderwerpenVoorBoek(boek, oud.onderwerpen, vertaal || {});
    if (Object.keys(onderwerp).length) {
      Object.keys(onderwerp).forEach(function (k) { velden[k] = onderwerp[k]; });
      uit.onderwerpen++;
    }
    if (Object.keys(velden).length) wijzig(boek, velden);
  });
  return uit;
}

/**
 * Borg en gift uit het oude blad. De kolom Gift is vrije tekst:
 *   - "ja", "x", "geeft borg als gift", of "gift" in de kolom Borg: de borg werd een gift.
 *     Dan geen borg (niets terug te betalen) en een gift van de borg, of van het bedrag na "ja" ("ja 10").
 *   - "van vorige keer" in de kolom Borg: de borg schoof door van een vorige uitlening. Geen nieuwe borg.
 *   - "voor volgende keer", "cash teruggegeven" en andere tekst: geen gift.
 *   - Enkel een getal: dat bedrag als gift.
 */
function oudeBorgEnGift(o, inst) {
  var borg = leesBorg(o.borg, inst);
  var gt = normaliseerTekst(o.gift);
  var bt = normaliseerTekst(o.borg);
  var ja = gt.match(/^ja\s*(\d+)?/);
  var borgIsGift = /\bgift\b/.test(bt) || /borg als gift/.test(gt) || gt === 'x' || !!ja;
  if (borgIsGift) {
    var bedrag = ja && ja[1] ? Number(ja[1]) : (borg.bedrag || inst.borg_per_boek);
    return { bedrag: 0, betaalwijze: '', gift: bedrag };
  }
  if (/vorige keer/.test(bt)) return { bedrag: 0, betaalwijze: '', gift: 0 };
  var getal = /^\s*[€]?\s*\d+([.,]\d+)?\s*(euro|eur|€)?\s*$/i.test(String(o.gift || '')) ? parseerGetal(o.gift) : null;
  return { bedrag: borg.bedrag, betaalwijze: borg.betaalwijze, gift: getal || 0 };
}

/**
 * Moet de waakhond het kopiëren opnieuw starten? Enkel als er nog covers te gaan zijn, er geen ronde gepland staat
 * en er geen ronde loopt.
 */
function oudeCoversHerstarten(teGaan, gepland, bezig) {
  return teGaan > 0 && !gepland && !bezig;
}

/** Datum uit een ISO-tijdstip, in de tijdzone van Brussel ("2026-11-20"). */
function oudeDatum(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return parseerDatum(iso);
  return typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'yyyy-MM-dd') : d.toISOString().slice(0, 10);
}

/** Zoekt een kolom in de kop van het oude blad, op het begin van de naam. */
function oudeKolom(kop, begin) {
  for (var i = 0; i < kop.length; i++) if (kop[i].indexOf(begin) === 0) return i;
  return -1;
}

/** De lener van een oude rij: een bestaande (zelfde e-mail of telefoon), of een nieuwe. */
function oudeLener(staat, o, teller) {
  var lener = staat.leners.filter(function (l) {
    return (o.email && String(l.email).toLowerCase() === o.email) ||
      (o.telefoon && l.telefoon && telefoonSleutel(l.telefoon) === telefoonSleutel(o.telefoon));
  })[0];
  if (!lener) {
    lener = voegToe(staat.leners, {
      lenersnummer: String(nieuwNummer(staat, 'lener', staat.leners.map(function (l) { return l.lenersnummer; }))),
      voornaam: o.voornaam || '?', achternaam: o.achternaam, telefoon: o.telefoon, email: o.email,
      datum_inschrijving: o.datum_uit || staat.vandaag,
      toestemming_privacy: 'onbekend', actief: 'ja'
    });
    teller.leners++;
  } else if (o.datum_uit && (!lener.datum_inschrijving || o.datum_uit < parseerDatum(lener.datum_inschrijving))) {
    // Een vroegere uitlening: dan is de lener eigenlijk al van toen.
    wijzig(lener, { datum_inschrijving: o.datum_uit });
  }
  return lener;
}

/**
 * De categorieën, thema's en triggerwaarschuwingen van een oud boek (tabel tags). Tags die de oude
 * website niet toonde (showInFrontend false) vallen weg, behalve triggerwaarschuwingen.
 * Geeft [{ naam, categorie, trigger }].
 */
function oudeOnderwerpen(tags) {
  if (!Array.isArray(tags)) return [];
  var uit = [], gezien = {};
  tags.forEach(function (t) {
    if (!t || typeof t !== 'object') return;
    var trigger = t.isTw === true;
    if (!trigger && t.showInFrontend === false) return;
    var naam = schoon(t.displayName || t.name);
    var k = normaliseerTekst(naam);
    if (!k || gezien[k]) return;
    gezien[k] = true;
    uit.push({ naam: naam, categorie: t.isCategory === true, trigger: trigger });
  });
  return uit;
}

/**
 * Zet de categorieën en thema's van de oude website om naar de Catalogus:
 *   - een oude categorie (Roman, ...) komt in categorieen, een oud thema (Lesbisch, ...) in trefwoorden:
 *     zo blijven de namen van de oude website bestaan, om op te filteren en te zoeken;
 *   - het vaste thema van de website (Fictie, Seksualiteit, ...) komt erbij in extra_onderwerpen;
 *   - een triggerwaarschuwing komt in triggerwaarschuwingen.
 * Geeft de velden die veranderen, of {}.
 */
function oudeOnderwerpenVoorBoek(boek, onderwerpen, vertaal) {
  var themas = [], categorieen = [], trefwoorden = [], triggers = [], velden = {};
  (onderwerpen || []).forEach(function (o) {
    var naam = genreMooi(o.naam);
    if (o.trigger) { triggers.push(naam); return; }
    // Heeft de naam die van een thema (Feminisme, Poëzie, ...), dan staat hij enkel bij de thema's.
    if (!themaExact(naam)) (o.categorie ? categorieen : trefwoorden).push(naam);
    // Non-fictie is te breed voor een thema: dat zegt niets over de inhoud.
    if (!/^non ?fict/.test(normaliseerTekst(o.naam))) themas = themas.concat(themaVan(o.naam, vertaal));
  });
  [['extra_onderwerpen', themas], ['categorieen', categorieen], ['trefwoorden', trefwoorden], ['triggerwaarschuwingen', triggers]].forEach(function (paar) {
    var nieuw = voegLijstToe(boek[paar[0]], paar[1]);
    if (nieuw !== splitsLijst(boek[paar[0]]).join(', ')) velden[paar[0]] = nieuw;
  });
  return velden;
}

/**
 * Koppelt de boeken van de oude website aan de Catalogus. Geeft { paren: [[oud, { boek, hoe }]], rest: [oude boeken
 * zonder koppeling], dubbel: aantal tweede exemplaren of uitgaven, verborgen: aantal verborgen en niet gevonden }.
 */
function oudeParen(catalogus, oudeBoeken) {
  var index = oudIndex(catalogus);
  var uit = { dubbel: 0, verborgen: 0 };
  var gezien = {};
  // Ronde 1: de zekere manieren. Ronde 2: ruimer, enkel voor wat overblijft en enkel als het uniek is.
  var paren = [], rest = [];
  oudeBoeken.forEach(function (oud) {
    var g = zoekOudBoek(oud, index, gezien);
    if (g && !gezien[String(g.boek.boek_id)]) { gezien[String(g.boek.boek_id)] = true; paren.push([oud, g]); }
    else if (g) uit.dubbel++;
    else rest.push(oud);
  });
  var zelfdeOud = function (a, b) { return oudTitelKern(a.titel) === oudTitelKern(b.titel) && normaliseerTekst(a.auteur) === normaliseerTekst(b.auteur); };
  rest.slice().forEach(function (oud) {
    if (rest.indexOf(oud) === -1) return;
    var g = zoekOudBoekRuim(oud, index, gezien, rest);
    if (!g) return;
    gezien[String(g.boek.boek_id)] = true;
    paren.push([oud, g]);
    // Stond het boek twee keer op de oude website, dan is het tweede exemplaar ook gevonden.
    rest = rest.filter(function (o) { return !zelfdeOud(o, oud); });
  });
  // Wat overblijft en sterk lijkt op een boek dat al gekoppeld is (zelfde auteur, of geen auteur), is een tweede
  // exemplaar of uitgave op de oude website: dat boek staat al in de Catalogus en hoeft niet in Na te kijken.
  rest = rest.filter(function (oud) {
    var zonderAuteur = !auteurWoorden(oud.auteur).length;
    var al = index.alle.some(function (c) {
      return gezien[String(c.boek_id)] && (zonderAuteur || auteursDelen(oud.auteur, c.auteur)) && oudTitelGelijk(oud, c) >= 0.9;
    });
    if (al) uit.dubbel++;
    return !al;
  });
  // Verborgen op de oude website en niet gevonden: niet in Na te kijken (de melding telt ze).
  rest = rest.filter(function (oud) { if (oud.verborgen) uit.verborgen++; return !oud.verborgen; });
  return { paren: paren, rest: rest, dubbel: uit.dubbel, verborgen: uit.verborgen };
}

/** Covers die bij OUD_STANDAARD_MIN of meer boeken dezelfde zijn: standaardafbeeldingen. Geeft { link: true }. */
function oudeStandaardCovers(oudeBoeken) {
  var tel = {}, uit = {};
  oudeBoeken.forEach(function (b) { if (b.cover) tel[b.cover] = (tel[b.cover] || 0) + 1; });
  Object.keys(tel).forEach(function (k) { if (tel[k] >= OUD_STANDAARD_MIN) uit[k] = true; });
  return uit;
}

/** De datum terug en de afgesproken datum van een teruggebrachte rij uit het oude blad. */
function oudeTerugDatums(o, inst) {
  var terug = parseerDatum(o.terug_op) || o.datum_terug_afgesproken || o.datum_uit;
  if (terug < o.datum_uit) terug = o.datum_uit;
  return { terug: terug, verval: o.datum_terug_afgesproken || berekenVervaldatum(o.datum_uit, inst) };
}

/** Zoekt een boek van de oude website in de Catalogus. index: van oudIndex. */
function oudIndex(catalogus) {
  var isbn = {}, titel = {}, kern = {}, perWoord = {}, alle = [];
  catalogus.forEach(function (c) {
    if (isLeeg(c.boek_id) || isFilm(c)) return;
    [c.isbn, c.isbn_origineel].forEach(function (w) {
      var i = normaliseerIsbn(w).isbn;
      if (i && !isbn[i]) isbn[i] = c;
    });
    var t = normaliseerTekst(c.titel), k = oudTitelKern(c.titel);
    if (!t) return;
    alle.push(c);
    (titel[t] = titel[t] || []).push(c);
    if (k) (kern[k] = kern[k] || []).push(c);
    auteurWoorden(c.auteur).forEach(function (w) { if ((perWoord[w] = perWoord[w] || []).indexOf(c) === -1) perWoord[w].push(c); });
  });
  return { isbn: isbn, titel: titel, kern: kern, perWoord: perWoord, alle: alle };
}

/** De boeken in de Catalogus die een auteur delen met dit oude boek. */
function oudKandidatenPerAuteur(oud, index) {
  var uit = [];
  auteurWoorden(oud.auteur).forEach(function (w) {
    Object.keys(index.perWoord).forEach(function (x) {
      if (!oudZelfdeNaam(w, x)) return;
      index.perWoord[x].forEach(function (c) { if (uit.indexOf(c) === -1 && auteursDelen(oud.auteur, c.auteur)) uit.push(c); });
    });
  });
  return uit;
}

/**
 * Een rij voor Na te kijken: het oude boek, met het meest gelijkende boek uit de Catalogus als voorstel.
 * Hangt dat boek al aan een ander oud boek, dan staat dat erbij. [oud …] is de code van de oude website.
 */
function oudNaTeKijkenRij(b, catalogus, gekoppeld) {
  var voorstel = oudVoorstel(b, catalogus);
  var al = voorstel && gekoppeld[String(voorstel.boek_id)];
  return {
    boek_id: voorstel ? String(voorstel.boek_id) : '', titel: b.titel + (b.ondertitel ? ': ' + b.ondertitel : ''), veld: 'boek van de oude website',
    waarde_catalogus: voorstel ? 'misschien: ' + schoon(voorstel.titel) + (voorstel.auteur ? ' (' + schoon(voorstel.auteur) + ')' : '') +
      (al ? '. Al gekoppeld aan "' + al + '" van de oude website: een tweede uitgave?' : '') : 'niet gevonden',
    waarde_bron: [b.auteur, b.isbn ? 'ISBN ' + b.isbn : ''].filter(Boolean).join(', ') + ' [oud ' + b.id + ']',
    opmerking: [b.cover ? 'Cover: ' + b.cover : '', b.beschrijving.slice(0, 400)].filter(Boolean).join('\n')
  };
}

function oudTitelGelijk(oud, c) {
  // Twee verschillende delen van een reeks zijn twee boeken. Hetzelfde deel telt als (bijna) gelijk.
  var na = oudVolgnummer(oud.titel), nb = oudVolgnummer(c.titel);
  var basis = oudTitelGelijkZonderNummer(oud, c);
  if (na && nb) return na === nb ? Math.max(basis, oudTitelKern(oud.titel).split(' ')[0] === oudTitelKern(c.titel).split(' ')[0] ? 0.92 : 0) : Math.min(basis, 0.5);
  return basis;
}

function oudTitelGelijkZonderNummer(oud, c) {
  var ka = oudTitelKern(oud.titel), kb = oudTitelKern(c.titel);
  var wa = oudTitelWoorden(oud.titel, oud.auteur), wb = oudTitelWoorden(c.titel, c.auteur);
  var va = wa.join(' '), vb = wb.join(' ');
  var score = Math.max(gelijkenis(ka, kb), va && vb ? gelijkenis(va, vb) : 0,
    gelijkenis(ka.replace(/ /g, ''), kb.replace(/ /g, '')), va && vb ? gelijkenis(va.replace(/ /g, ''), vb.replace(/ /g, '')) : 0);
  var zin = function (lijst) { return lijst.filter(function (w) { return w.length >= 3 && TITEL_STOPWOORDEN.indexOf(w) === -1; }); };
  var za = zin(wa), zb = zin(wb);
  // Ook met enkel de kern (zonder ondertitel): "Out of Control - Bi-sexual Erotica" en "Out of Control The Zone 2".
  var kza = zin(ka.split(' ')), kzb = zin(kb.split(' '));
  var bevat = function (x, y) {
    var kort = x.length <= y.length ? x : y, lang = x.length <= y.length ? y : x;
    return kort.length >= 2 && kort.every(function (w) { return lang.indexOf(w) > -1; });
  };
  if (bevat(za, zb) || bevat(kza, zb) || bevat(za, kzb) || bevat(kza, kzb)) score = Math.max(score, 0.9);
  var gedeeld = za.filter(function (w) { return w.length >= 5 && zb.indexOf(w) > -1; });
  if (gedeeld.length >= 2) score = Math.max(score, 0.82);
  return score;
}

/** De titel om te vergelijken: zonder ondertitel (na ":" of " - "), zonder haakjes, lidwoorden en "en", "and" of "&". */
function oudTitelKern(titel) {
  var k = titelSleutel(String(titel || '').split(/\s[-–—]\s/)[0]);
  var zonder = k.split(' ').filter(function (w) { return ['en', 'and', 'und', 'et'].indexOf(w) === -1; }).join(' ');
  return zonder || k;
}

/** De woorden van de volledige titel, zonder lidwoorden, nummers en de naam van de auteur ("Flo #7 EGO" geeft "flo ego"). */
function oudTitelWoorden(titel, auteur) {
  var namen = auteurWoorden(auteur);
  return woorden(titel).filter(function (w) { return !/^\d+$/.test(w) && namen.indexOf(w) === -1; });
}

/** Uur uit een ISO-tijdstip, in de tijdzone van Brussel ("19:30"). Leeg als het middernacht is. */
function oudUur(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  var uur = typeof Utilities !== 'undefined' ? Utilities.formatDate(d, tz || 'Europe/Brussels', 'HH:mm') : d.toISOString().slice(11, 16);
  return uur === '00:00' ? '' : uur;
}

/** Het deel van een reeks: "Volume One", "#1", "deel 2", "Heartstopper 1". Geeft een getal of 0. */
function oudVolgnummer(titel) {
  var t = normaliseerTekst(String(titel || '').replace(/#\s*(\d+)/g, ' nummer $1 '));
  var m = t.match(/\b(?:volume|vol|deel|tome|band|book|boek|nummer|part)\s+(\d+|[a-z]+)\b/);
  if (m && (/^\d+$/.test(m[1]) || GETALWOORDEN[m[1]])) return /^\d+$/.test(m[1]) ? Number(m[1]) : GETALWOORDEN[m[1]];
  m = t.match(/\s(\d{1,2})$/); // "Heartstopper 1", niet een jaartal
  return m ? Number(m[1]) : 0;
}

/** Voor Na te kijken: het boek in de Catalogus met de meest gelijkende titel (vanaf 60%), of null. */
function oudVoorstel(oud, catalogus) {
  var k = oudTitelKern(oud.titel), best = null, score = 0;
  if (!k) return null;
  catalogus.forEach(function (c) {
    if (isLeeg(c.boek_id) || isFilm(c)) return;
    var g = gelijkenis(k, oudTitelKern(c.titel));
    if (g > score) { score = g; best = c; }
  });
  return score >= 0.6 ? best : null;
}

/** Zelfde naam, of een tikfout in een lange naam (Hemmerechts en Hammerechts). */
function oudZelfdeNaam(x, y) {
  return x === y || (x.length >= 6 && y.length >= 6 && gelijkenis(x, y) >= 0.85);
}

/**
 * Zet een datum om naar tekst "JJJJ-MM-DD".
 * Werkt met een Date-object, "2026-11-20", "20/11/2026", "20-11-2026" of "20.11.26".
 * Geeft '' als het geen datum is.
 */
function parseerDatum(waarde) {
  if (isLeeg(waarde)) return '';
  if (isDatumObject(waarde)) {
    return waarde.getFullYear() + '-' + tweeCijfers(waarde.getMonth() + 1) + '-' + tweeCijfers(waarde.getDate());
  }
  var t = schoon(waarde);
  var m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return geldigeDatum(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    var jaar = Number(m[3]);
    if (jaar < 100) jaar += 2000;
    return geldigeDatum(jaar, Number(m[2]), Number(m[1]));
  }
  return '';
}

/** Zet "5", "5,00", "€ 5" of 5 om naar het getal 5. Geeft null als er geen getal in staat. */
function parseerGetal(waarde) {
  if (typeof waarde === 'number') return isNaN(waarde) ? null : waarde;
  var m = schoon(waarde).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Menu: de nakijklijst toepassen. */
function pasOnderwerpNakijklijstToe() {
  if (!spreadsheet().getSheetByName(ONDERWERP_NAKIJKEN)) { meld('Maak eerst de lijst: Madrigal > Boeken > Onderwerpen: vul ontbrekende aan.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var catalogus = leesTabel('Catalogus');
    var lijst = leesTabel(ONDERWERP_NAKIJKEN);
    n = onderwerpNakijklijstToepassen(catalogus.rijen, lijst.rijen, leesTabel('Onderwerpen').rijen);
    schrijfKolommen(catalogus, ['extra_onderwerpen', 'genre']);
    schrijfKolommen(lijst, ['toepassen']);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  logboek('menu', 'pasOnderwerpNakijklijstToe', n + ' boeken kregen een thema');
  meld(n + ' boeken kregen een thema. Ze staan binnen enkele minuten in dat thema op de website.');
}

/** Menu: stap 2, de nakijklijst toepassen op de Catalogus. */
function pasTitelNakijklijstToe() {
  if (!spreadsheet().getSheetByName(TITELS_TABBLAD)) { meld('Maak eerst de nakijklijst: Madrigal > Titels en auteurs > Schrijfwijze: maak een nakijklijst.'); return; }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var lijst = leesTabel(TITELS_TABBLAD);
    uit = titelsToepassen(catalogus.rijen, lijst.rijen);
    // Eén kolom in één keer schrijven: rij per rij bewaren duurt bij honderden titels langer dan 6 minuten.
    schrijfKolommen(catalogus, ['titel', 'taal']);
    schrijfKolommen(lijst, ['toepassen']);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  var tekst = uit.gedaan + ' boeken aangepast in de Catalogus (titel, taal of allebei).' + (uit.overgeslagen ? ' ' + uit.overgeslagen + ' overgeslagen: de titel in de Catalogus was intussen veranderd.' : '');
  logboek('menu', 'pasTitelNakijklijstToe', tekst);
  meld(tekst);
}

/** Het bewaarde programma, voor ?actie=site. */
function peperfabriekBewaard() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PF_EIGENSCHAP) || '{}'); } catch (e) { return {}; }
}

/** Een link volledig maken: /nl/x wordt https://www.voorbeeld.be/nl/x. Enkel http(s). */
function pfAbsoluut(href, basis) {
  var h = String(href || '').trim().replace(/&amp;/g, '&');
  if (!h || /^(mailto|tel|javascript):/i.test(h) || h.charAt(0) === '#') return '';
  if (/^https?:\/\//i.test(h)) return h.replace(/^http:/i, 'https:');
  var m = String(basis).match(/^(https?:\/\/[^\/]+)(\/.*)?$/i);
  if (!m) return '';
  if (h.indexOf('//') === 0) return 'https:' + h;
  if (h.charAt(0) === '/') return m[1] + h;
  var map = (m[2] || '/').replace(/[^\/]*$/, '');
  return m[1] + map + h;
}

/** Maakt een activiteit netjes: enkel https-links, korte teksten. */
function pfActiviteit(a, basis) {
  var link = pfAbsoluut(a.link, basis);
  var afbeelding = pfAbsoluut(a.afbeelding, basis);
  var tekst = pfTekst(a.tekst);
  if (tekst.length > 280) tekst = tekst.slice(0, 280).replace(/\s+\S*$/, '') + '…';
  return {
    titel: pfTekst(a.titel).slice(0, 140),
    datum: a.datum, uur: a.uur || '', einde: a.einde || '',
    link: veiligeCoverUrl(link), afbeelding: veiligeCoverUrl(afbeelding), tekst: tekst
  };
}

/* ---------- 1. JSON-LD (schema.org Event) ---------- */

/** Een afbeelding uit JSON-LD: tekst, lijst of { url }. */
function pfAfbeelding(img) {
  if (!img) return '';
  if (Array.isArray(img)) return pfAfbeelding(img[0]);
  if (typeof img === 'object') return String(img.url || img.contentUrl || '');
  return String(img);
}

/** Zoekt een datum in een stuk tekst. vandaag: om het jaar te raden als het ontbreekt. */
function pfDatumInTekst(t, vandaag) {
  var iso = String(t).match(/datetime=["'](\d{4}-\d{2}-\d{2}[^"']*)["']/i) || String(t).match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return pfIsoDatum(iso[1]);
  var tekst = pfTekst(t).toLowerCase();
  var uurM = tekst.match(/\b(\d{1,2})[:u.h](\d{2})\b/);
  var uur = uurM && Number(uurM[1]) < 24 ? ('0' + uurM[1]).slice(-2) + ':' + uurM[2] : '';
  var jaar, maand, dag;
  var num = tekst.match(/\b(\d{1,2})[.\/-](\d{1,2})(?:[.\/-](\d{2,4}))?\b/);
  var woord = tekst.match(/\b(\d{1,2})\s+(jan|feb|maa|mrt|mar|apr|mei|may|jun|jul|aug|sep|okt|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/);
  if (woord) { dag = Number(woord[1]); maand = PF_MAANDEN[woord[2]]; jaar = woord[3] ? Number(woord[3]) : 0; }
  else if (num && Number(num[2]) >= 1 && Number(num[2]) <= 12) { dag = Number(num[1]); maand = Number(num[2]); jaar = num[3] ? Number(num[3].length === 2 ? '20' + num[3] : num[3]) : 0; }
  else return null;
  if (!dag || dag > 31 || !maand) return null;
  if (!jaar) {
    // Zonder jaar: het eerstvolgende, of hoogstens een maand geleden.
    var nu = Number(vandaag.slice(0, 4));
    var kandidaat = nu + '-' + ('0' + maand).slice(-2) + '-' + ('0' + dag).slice(-2);
    jaar = kandidaat < telDagenOp(vandaag, -31) ? nu + 1 : nu;
  }
  return { datum: jaar + '-' + ('0' + maand).slice(-2) + '-' + ('0' + dag).slice(-2), uur: uur };
}

/** Haalt de pagina op (en het .ics-bestand als de pagina ernaar verwijst). */
function pfHaal(url) {
  var opties = { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': BS_USER_AGENT, 'Accept-Language': 'nl-BE,nl;q=0.9' } };
  var r = UrlFetchApp.fetch(url, opties);
  var html = r.getResponseCode() === 200 ? r.getContentText() : '';
  var ical = '';
  var icalLink = html ? pfIcalLink(html, url) : '';
  if (icalLink && !pfUitJsonLd(html, url).length) {
    try { var ri = UrlFetchApp.fetch(icalLink, opties); if (ri.getResponseCode() === 200) ical = ri.getContentText(); } catch (e) { /* geen iCal */ }
  }
  return { code: r.getResponseCode(), html: html, ical: ical };
}

/** Een link naar een .ics-bestand in de pagina, of ''. */
function pfIcalLink(html, basis) {
  var m = html.match(/<link[^>]*type=["']text\/calendar["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/href=["']((?:webcal|https?):\/\/[^"']+\.ics[^"']*|[^"']+\.ics(?:\?[^"']*)?)["']/i) ||
    html.match(/href=["']([^"']*(?:ical=1|outlook-ical=1|\/ical\/?)[^"']*)["']/i);
  return m ? pfAbsoluut(m[1].replace(/^webcal:/i, 'https:'), basis) : '';
}

/** Een datum (en uur) uit een tekst als 2026-11-07T20:00:00+01:00. Geeft { datum, uur } of null. */
function pfIsoDatum(w) {
  var m = String(w || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { datum: m[1] + '-' + m[2] + '-' + m[3], uur: m[4] && (m[4] !== '00' || m[5] !== '00') ? m[4] + ':' + m[5] : '' };
}

/**
 * Leest het programma uit de HTML van de pagina (zonder internet: ical is de tekst van het .ics-bestand
 * als die er is). Geeft { manier, activiteiten, icalLink }.
 */
function pfLeesProgramma(html, basis, vandaag, ical) {
  var lijsten = [['schema.org', pfUitJsonLd(html, basis)], ['iCal', ical ? pfUitIcal(ical, basis) : []], ['links', pfUitLinks(html, basis, vandaag)]];
  for (var i = 0; i < lijsten.length; i++) {
    var lijst = lijsten[i][1].filter(function (a) { return a.titel && /^\d{4}-\d{2}-\d{2}$/.test(a.datum); });
    if (lijst.length) return { manier: lijsten[i][0], activiteiten: pfSorteer(lijst), icalLink: pfIcalLink(html, basis) };
  }
  return { manier: '', activiteiten: [], icalLink: pfIcalLink(html, basis) };
}

/** Enkel komende activiteiten (of die nog lopen), de eerste eerst, zonder dubbels. */
function pfSorteer(lijst) {
  var gezien = {};
  return lijst.filter(function (a) {
    var k = a.datum + '|' + a.titel.toLowerCase();
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  }).sort(function (a, b) { return (a.datum + a.uur).localeCompare(b.datum + b.uur); }).slice(0, PF_MAX * 3);
}

function pfTekst(html) {
  return schoon(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&#39;|&rsquo;/g, '\'')
    .replace(/&quot;/g, '"').replace(/&eacute;/g, 'é').replace(/&euml;/g, 'ë').replace(/&[a-z]+;/g, ' '));
}

function pfUitIcal(ics, basis) {
  var regels = String(ics || '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  var uit = [], e = null;
  var waarde = function (r) { return r.slice(r.indexOf(':') + 1).replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';'); };
  regels.forEach(function (r) {
    if (r === 'BEGIN:VEVENT') e = {};
    else if (r === 'END:VEVENT' && e) {
      if (e.titel && e.datum) uit.push(pfActiviteit(e, basis));
      e = null;
    } else if (e) {
      var sleutel = r.split(/[:;]/)[0];
      if (sleutel === 'SUMMARY') e.titel = waarde(r);
      else if (sleutel === 'DTSTART') {
        var d = waarde(r).match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
        if (d) { e.datum = d[1] + '-' + d[2] + '-' + d[3]; e.uur = d[4] && (d[4] !== '00' || d[5] !== '00') ? d[4] + ':' + d[5] : ''; }
      } else if (sleutel === 'URL') e.link = waarde(r);
      else if (sleutel === 'DESCRIPTION') e.tekst = waarde(r);
      else if (sleutel === 'ATTACH' && /\.(jpe?g|png|webp)/i.test(r)) e.afbeelding = waarde(r);
    }
  });
  return uit;
}

/* ---------- 3. Links naar activiteiten, met een datum in de buurt ---------- */

function pfUitJsonLd(html, basis) {
  var uit = [];
  var re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, m;
  function bekijk(x) {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) { x.forEach(bekijk); return; }
    if (x['@graph']) bekijk(x['@graph']);
    if (x.itemListElement) bekijk(x.itemListElement.map(function (i) { return i && i.item ? i.item : i; }));
    var type = [].concat(x['@type'] || []).join(' ');
    if (/Event\b/.test(type) && x.name && x.startDate) {
      var start = pfIsoDatum(x.startDate), einde = pfIsoDatum(x.endDate);
      if (start) uit.push(pfActiviteit({ titel: x.name, datum: start.datum, uur: start.uur, einde: einde && einde.datum !== start.datum ? einde.datum : '',
        link: x.url || '', afbeelding: pfAfbeelding(x.image), tekst: x.description || '' }, basis));
    }
  }
  while ((m = re.exec(html))) {
    try { bekijk(JSON.parse(m[1].trim())); } catch (e) { /* ongeldige JSON: overslaan */ }
  }
  return uit;
}

/* ---------- 2. iCal ---------- */

function pfUitLinks(html, basis, vandaag) {
  var lijstPad = String(basis).replace(/^https?:\/\/[^\/]+/i, '').replace(/\/$/, '');
  var uit = [], gezien = {};
  var re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, m;
  while ((m = re.exec(html))) {
    var link = pfAbsoluut(m[1], basis);
    var pad = link.replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    // Enkel pagina's onder het programma (of een agenda/event-pagina), niet het programma zelf.
    if (!pad || pad === lijstPad || !(pad.indexOf(lijstPad + '/') === 0 || /\/(agenda|events?|activiteit(en)?|programma)\/[^\/]+/.test(pad))) continue;
    if (gezien[link]) continue;
    // Het stuk rond de link: van na de vorige link tot voor de volgende, hoogstens 600 tekens aan elke kant.
    var voor = html.slice(Math.max(0, m.index - 600), m.index);
    var vorige = voor.lastIndexOf('</a>');
    if (vorige > -1) voor = voor.slice(vorige + 4);
    var na = html.slice(m.index + m[0].length, m.index + m[0].length + 600);
    var volgende = na.search(/<a\b/i);
    if (volgende > -1) na = na.slice(0, volgende);
    var stuk = voor + m[0] + na;
    var titel = pfTekst(m[2]);
    if (!titel || titel.length < 3 || /^(meer|lees meer|info|tickets?|more|read more)$/i.test(titel)) {
      var kop = m[0].match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || stuk.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
      titel = kop ? pfTekst(kop[1]) : '';
    }
    // Eerst een datum in de link zelf, dan ervoor (meestal staat de datum boven de titel), pas dan erna.
    var d = pfDatumInTekst(m[0], vandaag) || pfDatumInTekst(voor, vandaag) || pfDatumInTekst(na, vandaag);
    if (!titel || !d) continue;
    var img = m[0].match(/<img[^>]*(?:data-src|src)=["']([^"']+)["']/i);
    gezien[link] = true;
    uit.push(pfActiviteit({ titel: titel, datum: d.datum, uur: d.uur, link: link, afbeelding: img ? img[1] : '' }, basis));
  }
  return uit;
}

/* ---------- Samen ---------- */

/** Wat de website toont: enkel vanaf vandaag (of nog bezig), hoogstens aantal. */
function pfVoorSite(lijst, vandaag, aantal) {
  return (lijst || []).filter(function (a) { return (a.einde || a.datum) >= vandaag; }).slice(0, aantal || 12);
}

function planTaak(naam, ms) {
  try {
    verwijderTriggers(naam);
    ScriptApp.newTrigger(naam).timeBased().after(Math.max(60 * 1000, ms)).create();
  } catch (e) {
    // Lukt het niet (bv. te veel geplande taken), dan staat dat in het Logboek: start de taak dan met de hand.
    try { logboek('fout', naam, 'Kon de volgende ronde niet plannen: ' + String(e && e.message || e).slice(0, 200) + '. Start de taak opnieuw via het menu.'); } catch (e2) { /* geen logboek */ }
  }
}

/** Plant de vertaling over een paar minuten (één keer). */
function planVertaling(minuten) {
  verwijderTriggers('vertaalBeschrijvingen');
  ScriptApp.newTrigger('vertaalBeschrijvingen').timeBased().after(minuten * 60 * 1000).create();
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

/** De publieke catalogus als JSON-tekst, uit de cache als die er is. */
function publiekeCatalogusJson() {
  var cache = CacheService.getScriptCache();
  var sleutel = dagSleutel(CACHE_SLEUTEL);
  var aantal = Number(cache.get(sleutel + '_n') || 0);
  if (aantal > 0) {
    var sleutels = [];
    for (var i = 0; i < aantal; i++) sleutels.push(sleutel + '_' + i);
    var stukken = cache.getAll(sleutels);
    if (Object.keys(stukken).length === aantal) {
      return sleutels.map(function (s) { return stukken[s]; }).join('');
    }
  }
  var staat = laadStaat('publiek', false);
  verwerkVervallenReservatiesStil(staat);
  var lijsten = spreadsheet().getSheetByName('Leeslijsten') ? leesTabel('Leeslijsten').rijen : [];
  var tekst = JSON.stringify(bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen, lijsten));
  var waarden = {};
  var n = Math.ceil(tekst.length / CACHE_STUK);
  for (var j = 0; j < n; j++) waarden[sleutel + '_' + j] = tekst.slice(j * CACHE_STUK, (j + 1) * CACHE_STUK);
  waarden[sleutel + '_n'] = String(n);
  try { cache.putAll(waarden, CACHE_DUUR_SECONDEN); } catch (err) { /* te groot voor de cache: dan zonder */ }
  return tekst;
}

/** Teksten die de publieke catalogus mag tonen. Nooit codes of andere interne waarden. */
function publiekeTeksten(inst) {
  return {
    welkom: inst.tekst_welkom,
    uitleg: inst.tekst_uitleg_lenen,
    privacy: inst.tekst_privacy,
    welkom_en: inst.tekst_welkom_en,
    uitleg_en: inst.tekst_uitleg_lenen_en,
    privacy_en: inst.tekst_privacy_en,
    films: inst.tekst_films,
    films_en: inst.tekst_films_en,
    online_reserveren: inst.online_reserveren === true
  };
}

/** Reservatie zoals de schermen ze tonen. */
function reservatieInfo(staat, r, plaats) {
  var boek = boekVan(staat, r.boek_id);
  return {
    reservatie_id: r.reservatie_id, boek_id: r.boek_id, titel: boek ? boek.titel : r.boek_id,
    lenersnummer: r.lenersnummer, voornaam: (lenerVan(staat, r.lenersnummer) || {}).voornaam || '',
    datum_reservatie: r.datum_reservatie, status: r.status, exemplaar: r.exemplaar,
    ophalen_tot: r.ophalen_tot, plaats: plaats,
    tekst: r.status === STATUS_KLAAR
      ? 'Ligt apart (' + r.exemplaar + ') tot en met ' + datumTekst(r.ophalen_tot, staat.vandaag)
      : 'Wacht sinds ' + datumTekst(r.datum_reservatie, staat.vandaag) + ', plaats ' + plaats + ' in de wachtrij'
  };
}

function reservatieVan(staat, reservatieId) {
  return staat.reservaties.filter(function (r) { return String(r.reservatie_id) === String(reservatieId); })[0] || null;
}

function reserveren(staat, invoer) {
  var boek = boekVan(staat, invoer.boek_id);
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  if (!isUitleenbaar(boek)) return { ok: false, fout: nietUitleenbaarFout(boek) };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief.' };
  if (isGemarkeerd(lener)) return { ok: false, gemarkeerd: true, fout: MARKERING_TEKST };
  var actief = actieveReservaties(staat, boek.boek_id);
  if (actief.some(function (r) { return String(r.lenersnummer) === String(lener.lenersnummer); })) {
    return { ok: false, fout: 'Deze lener staat al in de wachtrij voor dit boek.' };
  }
  if (lopendeUitleningenVan(staat, lener.lenersnummer).some(function (u) { return u.boek_id === boek.boek_id; })) {
    return { ok: false, fout: 'Deze lener heeft dit boek nu zelf in huis.' };
  }
  var b = beschikbaarheid(staat, boek);
  if (b.beschikbaar > 0) return { ok: false, fout: 'Er staat een exemplaar in de bib. Je kan het meteen uitlenen.' };
  var r = voegToe(staat.reservaties, {
    reservatie_id: 'R' + metNullen(nieuwNummer(staat, 'reservatie', staat.reservaties.map(function (x) { return x.reservatie_id; })), 4),
    boek_id: boek.boek_id, lenersnummer: lener.lenersnummer, datum_reservatie: staat.vandaag,
    status: STATUS_WACHT, exemplaar: '', datum_klaar: '', ophalen_tot: '', datum_afgesloten: '', vrijwilliger: staat.wie
  });
  staat.log.push(['reserveren', r.reservatie_id + ' ' + boek.boek_id + ' voor lener ' + lener.lenersnummer]);
  return { ok: true, tekst: 'Lener ' + lenerNaam(staat, lener.lenersnummer) + ' staat op plaats ' + (actief.length + 1) + ' in de wachtrij voor "' + boek.titel + '".' };
}

/** Zet een rij-object om naar een lijst celwaarden volgens de kop. */
function rijNaarWaarden(kop, obj) {
  return kop.map(function (k) { return k ? celWaarde(k, obj[k]) : ''; });
}

/** Welke rol hoort bij een code? '' als de code niet klopt. */
function rolVoorCode(code, inst) {
  var c = schoon(code);
  if (!c) return '';
  if (inst.code_bestuur && c === String(inst.code_bestuur)) return 'bestuur';
  if (inst.code_vrijwilliger && c === String(inst.code_vrijwilliger)) return 'vrijwilliger';
  if (inst.toegangscode_balie && c === String(inst.toegangscode_balie)) return 'balie';
  return '';
}

/** Een hogere rol mag een scherm bekijken met de rechten van een lagere rol (enkel vrijwilliger), nooit omgekeerd. */
function rolVoorScherm(rol, alsRol) {
  return alsRol === 'vrijwilliger' && ROL_RANG[rol] > ROL_RANG.vrijwilliger ? 'vrijwilliger' : rol;
}

function rondAf(n) {
  return Math.round(n * 100) / 100;
}

/** "2026-10" en de maand erna. */
function roosterMaanden(vandaag) {
  var j = Number(vandaag.slice(0, 4)), m = Number(vandaag.slice(5, 7));
  var volgende = m === 12 ? (j + 1) + '-01' : j + '-' + tweeCijfers(m + 1);
  return [vandaag.slice(0, 7), volgende];
}

/** Actie voor balie en bestuur: het rooster van deze en volgende maand. */
function roosterOverzicht() {
  var inst = leesInstellingen();
  var link = schoon(inst.rooster_link) || 'https://projectmadrigal.github.io/rooster/';
  var url = schoon(inst.rooster_url), code = schoon(inst.rooster_code);
  if (!/^https:\/\/script\.google\.com\//.test(url) || !code) {
    return { ok: true, data: { gekoppeld: false, link: link } };
  }
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(ROOSTER_CACHE_SLEUTEL);
  if (bewaard) return { ok: true, data: JSON.parse(bewaard) };
  var props = PropertiesService.getScriptProperties();
  var vandaag = vandaagTekst();
  // De daglimiet van Google is op: niet opnieuw proberen, meteen de laatste versie.
  if (daglimietWachttijd(daglimietSinds(), Date.now())) return laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, true);

  var antwoorden;
  try {
    antwoorden = roosterMaanden(vandaag).map(function (m) { return haalRoosterMaand(url, code, m); });
  } catch (e) {
    return laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, isDaglimietFout(e));
  }
  var fout = antwoorden.filter(function (a) { return !a || !a.ok; })[0];
  if (fout && fout.codeFout) return { ok: false, fout: 'De rooster_code in Instellingen klopt niet. Gebruik de toegangscode voor vrijwilligers van het rooster.' };
  if (fout && antwoorden.every(function (a) { return !a || !a.ok; })) {
    var oud = laatsteRooster(props.getProperty(ROOSTER_LAATST_SLEUTEL), vandaag, false);
    return oud.ok ? oud : { ok: false, fout: 'Het rooster kon niet laden: ' + (fout.fout || 'onbekende fout') };
  }

  var data = bouwRoosterOverzicht(antwoorden, vandaag);
  vulVasteEventsAan(data.avonden, inst);
  data.gekoppeld = true;
  data.link = link;
  data.vandaag = vandaag;
  var tekst = JSON.stringify(data);
  try { cache.put(ROOSTER_CACHE_SLEUTEL, tekst, ROOSTER_CACHE_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  try { props.setProperty(ROOSTER_LAATST_SLEUTEL, JSON.stringify({ tijd: Date.now(), data: data })); } catch (e) { /* te groot: dan zonder reserve */ }
  return { ok: true, data: data };
}

/** Nachtelijke opruiming van de aanvragen (zie Privacy.js). */
function ruimAanvragenOp(inst) {
  if (!spreadsheet().getSheetByName('Aanvragen')) return 0;
  var tabel = leesTabel('Aanvragen');
  var n = ruimAanvragenOpRijen(tabel.rijen, vandaagTekst(), inst.aanvragen_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
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

function ruimBriefjesOp(inst) {
  if (!spreadsheet().getSheetByName('Briefjes')) return 0;
  var tabel = leesTabel('Briefjes');
  var n = ruimBriefjesOpRijen(tabel.rijen, vandaagTekst(), inst.briefjes_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/** Privacy: briefjes ouder dan het aantal dagen (instelling briefjes_bewaren_dagen) gaan weg, ook de open. */
function ruimBriefjesOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (b) {
    var d = parseerDatum(b.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(b); n++; }
  });
  return n;
}

/** Nachtelijke opruiming van de meldingen (zie Privacy.js). */
function ruimMeldingenOp(inst) {
  if (!spreadsheet().getSheetByName('Meldingen')) return 0;
  var tabel = leesTabel('Meldingen');
  var n = ruimMeldingenOpRijen(tabel.rijen, vandaagTekst(), inst.meldingen_bewaren_dagen);
  if (n) bewaarTabel(tabel);
  return n;
}

/* ---------- Checklist voor de shift ---------- */

/** Privacy: afgehandelde meldingen ouder dan het aantal dagen gaan weg. Open meldingen blijven. */
function ruimMeldingenOpRijen(rijen, vandaag, dagen) {
  var n = 0;
  (rijen || []).forEach(function (m) {
    if (m.status === MELDING_NIEUW) return;
    var d = parseerDatum(m.datum_afgehandeld) || parseerDatum(m.datum);
    if (d && dagenTussen(d, vandaag) > dagen) { markeerVerwijderen(m); n++; }
  });
  return n;
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
    var briefjes = ruimBriefjesOp(staat.inst);
    logboek('systeem', 'privacy-opruiming', teller.koppelingen + ' koppelingen gewist, ' + teller.leners + ' leners gewist, ' + aanvragen + ' aanvragen gewist, ' + meldingen + ' meldingen gewist, ' + briefjes + ' briefjes gewist');
  } finally {
    lock.releaseLock();
  }
  leegCache();
}

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

/** Haalt spaties aan begin en einde weg en maakt dubbele spaties enkel. */
function schoon(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\s+/g, ' ').trim();
}

/** Zoals schoon, maar regeleinden en lege regels (alinea's) blijven. */
function schoonMetRegels(waarde) {
  if (waarde === null || waarde === undefined) return '';
  return String(waarde).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Zoals schrijfKolommen, maar cel per cel: sneller als maar een paar rijen veranderden (bv. één boek
 * in Titels en auteurs nakijken). schrijfKolommen leest en schrijft telkens de hele kolom. Bij meer dan
 * vijf gewijzigde rijen gaat het toch kolom per kolom: anders rekent en tekent de spreadsheet te vaak.
 */
function schrijfCellen(tabel, kolommen) {
  var gewijzigd = tabel.rijen.filter(function (r) { return r._gewijzigd && r._velden && r._rij >= 2 && !r._nieuw && !r._verwijderen; });
  if (gewijzigd.length > 5) { schrijfKolommen(tabel, kolommen); return; }
  gewijzigd.forEach(function (r) {
    kolommen.forEach(function (kolom) {
      var nr = tabel.kop.indexOf(kolom) + 1;
      if (nr < 1 || !r._velden[kolom]) return;
      tabel.blad.getRange(r._rij, nr).setValue(celWaarde(kolom, r[kolom]));
    });
    r._gewijzigd = false;
    r._velden = {};
  });
}

/**
 * Schrijft de gewijzigde waarden van enkele kolommen terug, elke kolom in één keer. Enkel de cellen van
 * gewijzigde rijen veranderen: de andere cellen krijgen hun eigen waarde terug (rechtstreeks uit het blad).
 */
function schrijfKolommen(tabel, kolommen) {
  var aantal = tabel.blad.getLastRow() - 1;
  if (aantal < 1) return;
  kolommen.forEach(function (kolom) {
    var nr = tabel.kop.indexOf(kolom) + 1;
    if (nr < 1) return;
    var bereik = tabel.blad.getRange(2, nr, aantal, 1);
    var waarden = bereik.getValues();
    var veranderd = false;
    tabel.rijen.forEach(function (r) {
      if (!r._gewijzigd || !r._velden || !r._velden[kolom] || !r._rij || r._rij < 2 || r._rij > aantal + 1) return;
      waarden[r._rij - 2][0] = celWaarde(kolom, r[kolom]);
      veranderd = true;
    });
    if (veranderd) bereik.setValues(waarden);
  });
  tabel.rijen.forEach(function (r) { if (r._gewijzigd && !r._nieuw && !r._verwijderen) { r._gewijzigd = false; r._velden = {}; } });
}

/** Schrijft een volledige tabel in één keer (gebruikt bij de opbouw van de catalogus). */
function schrijfVolledig(tabel) {
  var blad = tabel.blad;
  var kop = tabel.kop;
  var oud = blad.getLastRow();
  if (tabel.rijen.length) {
    blad.getRange(2, 1, tabel.rijen.length, kop.length).setValues(tabel.rijen.map(function (r) { return rijNaarWaarden(kop, r); }));
  }
  // Wat er vroeger onder stond (bv. lege rijen), maken we leeg.
  if (oud > tabel.rijen.length + 1) {
    blad.getRange(tabel.rijen.length + 2, 1, oud - tabel.rijen.length - 1, kop.length).clearContent();
  }
  tabel.rijen.forEach(function (r, i) { r._rij = i + 2; r._nieuw = false; r._gewijzigd = false; });
}

/** Schrijft het tabblad Voorraad opnieuw. catalogus en verkopen: rijen (zoals leesTabel ze geeft). */
function schrijfVoorraad(catalogus, verkopen) {
  var ss = spreadsheet();
  var blad = ss.getSheetByName('Voorraad') || maakTabblad('Voorraad');
  var v = voorraadRijen(catalogus, verkopen);
  var info = 'Overzicht van het script, bijgewerkt op ' + Utilities.formatDate(new Date(), tijdzone(), 'dd/MM/yyyy HH:mm') +
    '. Pas prijzen en aantallen aan in de Catalogus (te_koop_aantal, prijs, onderhandelbaar): dit tabblad volgt vanzelf.';
  var t = v.totaal;
  var waarden = [[info, '', '', '', '', '', '', '', ''], VOORRAAD_KOP].concat(v.rijen)
    .concat([['', 'Totaal', v.rijen.length + ' boeken', t[0], '', '', t[1], t[2], t[3]]]);
  blad.clear();
  blad.getRange(1, 1, waarden.length, VOORRAAD_KOP.length).setValues(waarden);
  blad.getRange(1, 1).setFontStyle('italic');
  blad.getRange(2, 1, 1, VOORRAAD_KOP.length).setFontWeight('bold');
  blad.getRange(waarden.length, 1, 1, VOORRAAD_KOP.length).setFontWeight('bold');
  blad.setFrozenRows(2);
  [5, 7, 9].forEach(function (k) { blad.getRange(3, k, waarden.length - 2, 1).setNumberFormat('€ #,##0.00'); });
  return v;
}

function shiftChecklist(inst) {
  return { openen: checklistPunten(inst.tekst_checklist_openen), sluiten: checklistPunten(inst.tekst_checklist_sluiten) };
}

/* ---------- Handleiding (draaiboek voor vrijwilligers) ---------- */

/**
 * Voor Cijfers: per vrijwilliger hoeveel avonden in de bib en als back-up, per jaar,
 * en de avonden dat de bib dicht was of een workshop had.
 */
function shiftCijfers(rijen, jaar) {
  var perNaam = {}, dicht = [];
  (rijen || []).forEach(function (r) {
    var d = parseerDatum(r.datum);
    if (!d || d.slice(0, 4) !== String(jaar)) return;
    if (r.rol === 'gesloten' || r.rol === 'workshop') { dicht.push({ datum: d, rol: r.rol }); return; }
    var k = normaliseerTekst(r.naam);
    if (!k) return;
    var p = perNaam[k] = perNaam[k] || { naam: schoon(r.naam), bib: 0, backup: 0, schrijfwijzen: {} };
    p.schrijfwijzen[schoon(r.naam)] = (p.schrijfwijzen[schoon(r.naam)] || 0) + 1;
    if (r.rol === 'bib') p.bib++; else if (r.rol === 'backup') p.backup++;
  });
  var personen = Object.keys(perNaam).map(function (k) {
    var p = perNaam[k];
    // De meest gebruikte schrijfwijze (C-Jay of C-jay).
    p.naam = Object.keys(p.schrijfwijzen).sort(function (a, b) { return p.schrijfwijzen[b] - p.schrijfwijzen[a]; })[0];
    return { naam: p.naam, bib: p.bib, backup: p.backup };
  }).sort(function (a, b) { return b.bib - a.bib || b.backup - a.backup || a.naam.localeCompare(b.naam); });
  return { jaar: Number(jaar), personen: personen, dicht: dicht.sort(function (a, b) { return a.datum.localeCompare(b.datum); }) };
}

/**
 * Leest één tabblad van een oud rooster: een kop met de maand, een rij met de weekdagen,
 * en per week een rij met de dagnummers, gevolgd door de rijen events, bib en backup.
 * Geeft [{ datum, rol: 'bib' | 'backup' | 'gesloten' | 'workshop', naam, event }] of null.
 */
function shiftsUitMaandblad(waarden, bladnaam) {
  var maand = null, kolom = -1;
  for (var r = 0; r < Math.min(6, waarden.length) && !maand; r++) {
    waarden[r].forEach(function (c) { if (!maand && c) maand = maandUitTitel(c); });
  }
  if (!maand) maand = maandUitTitel(bladnaam);
  for (var k = 0; k < Math.min(8, waarden.length) && kolom === -1; k++) {
    kolom = waarden[k].map(normaliseerTekst).indexOf('friday');
    if (kolom === -1) kolom = waarden[k].map(normaliseerTekst).indexOf('vrijdag');
  }
  if (!maand || kolom === -1) return null;
  var uit = [], datum = '', event = '';
  waarden.forEach(function (rij) {
    var label = normaliseerTekst(rij[0]);
    var cel = rij[kolom];
    if (!label) {
      // Een rij met dagnummers: het nummer onder vrijdag is de datum van deze week (leeg: geen vrijdag).
      var nummers = rij.filter(function (c) { return typeof c === 'number' || /^\d{1,2}(\.0)?$/.test(String(c || '').trim()); });
      if (nummers.length) {
        var dag = parseerGetal(cel);
        datum = dag ? maand.jaar + '-' + tweeCijfers(maand.maand) + '-' + tweeCijfers(dag) : '';
        event = '';
      }
      return;
    }
    if (!datum) return;
    if (label === 'events' || label === 'event') { event = schoon(cel); return; }
    if (label !== 'bib' && label !== 'backup' && label !== 'back up') return;
    var tekst = normaliseerTekst(cel);
    if (label === 'bib' && /gesloten|dicht/.test(tekst)) { uit.push({ datum: datum, rol: 'gesloten', naam: '', event: event }); return; }
    if (label === 'bib' && /workshop/.test(tekst)) { uit.push({ datum: datum, rol: 'workshop', naam: '', event: event }); return; }
    namenUitCel(cel).forEach(function (naam) {
      uit.push({ datum: datum, rol: label === 'bib' ? 'bib' : 'backup', naam: naam, event: event });
    });
  });
  return uit;
}

/** De inhoud van de startpagina als JSON-tekst, uit de cache als die er is. */
function siteInhoudJson() {
  var cache = CacheService.getScriptCache();
  var bewaard = cache.get(dagSleutel(SITE_CACHE_SLEUTEL));
  if (bewaard) return bewaard;
  var staat = laadStaat('publiek', false);
  var lees = function (naam) {
    return spreadsheet().getSheetByName(naam) ? leesTabel(naam).rijen : [];
  };
  var tekst = JSON.stringify(bouwSiteInhoud(staat, { nieuws: lees('Nieuws'), agenda: lees('Agenda'), vasteEvents: lees('Vaste events'), faq: lees('Veelgestelde vragen'), leeslijsten: lees('Leeslijsten'), peperfabriek: peperfabriekBewaard() }));
  try { cache.put(dagSleutel(SITE_CACHE_SLEUTEL), tekst, CACHE_DUUR_SECONDEN); } catch (e) { /* te groot: dan zonder cache */ }
  return tekst;
}

/** De soort van een rij in de Catalogus: boek, zine of film. */
function soortVan(rij) {
  var s = normaliseerTekst(rij && rij.soort);
  return s === 'zine' || s === 'film' ? s : 'boek';
}

function sparqlTekst(t) {
  return '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** Splitst een lijst in een cel ("a, b; c") in losse, opgeschoonde waarden. */
function splitsLijst(waarde) {
  return schoon(waarde).split(/[,;\n]+/).map(schoon).filter(function (x) { return x; });
}

/* ---------- Tekst uit HTML ---------- */

/** Het actieve spreadsheetbestand. */
function spreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Welke bestanden zijn standaardafbeeldingen? bestanden: [{ id, hash }]. Een hash die bij STANDAARD_MIN of meer
 * bestanden voorkomt, is er een. Geeft { ids: { id: true }, hashes: [hash] }.
 */
function standaardBestanden(bestanden) {
  var tel = {};
  bestanden.forEach(function (b) { if (b.hash) tel[b.hash] = (tel[b.hash] || 0) + 1; });
  var hashes = Object.keys(tel).filter(function (h) { return tel[h] >= STANDAARD_MIN; });
  var ids = {};
  bestanden.forEach(function (b) { if (hashes.indexOf(b.hash) > -1) ids[b.id] = true; });
  return { ids: ids, hashes: hashes };
}

/** Een nieuw standje, of een bestaand aanpassen. invoer: { standje_id?, naam, thema, datum, locatie, status? } */
function standjeBewaren(rijen, invoer, nieuwId) {
  var naam = tekstInvoer(invoer.naam, 80);
  if (!naam) return { ok: false, fout: 'Geef het standje een naam.' };
  var datum = parseerDatum(invoer.datum);
  if (!datum) return { ok: false, fout: 'Kies een datum.' };
  var velden = { naam: naam, thema: tekstInvoer(invoer.thema, 80), datum: datum, locatie: tekstInvoer(invoer.locatie, 120) };
  if (invoer.status && STANDJE_STATUSSEN.indexOf(invoer.status) > -1) velden.status = invoer.status;
  if (invoer.standje_id) {
    var rij = rijen.filter(function (r) { return String(r.standje_id) === String(invoer.standje_id); })[0];
    if (!rij) return { ok: false, fout: 'Dit standje bestaat niet.' };
    wijzig(rij, velden);
    return { ok: true, standje_id: String(rij.standje_id), tekst: 'Standje bewaard.' };
  }
  velden.standje_id = nieuwId();
  velden.status = velden.status || 'voorbereiding';
  voegToe(rijen, velden);
  return { ok: true, standje_id: velden.standje_id, tekst: 'Standje "' + naam + '" aangemaakt.' };
}

/**
 * Zet een boek klaar voor een standje: hoeveel mee, en eventueel een andere prijs.
 * invoer: { standje_id, boek_id, mee, prijs?, onderhandelbaar? }. mee 0: het boek gaat niet mee.
 */
function standjeBoekZetten(tabellen, invoer) {
  var standje = tabellen.standjes.filter(function (s) { return String(s.standje_id) === String(invoer.standje_id); })[0];
  if (!standje) return { ok: false, fout: 'Dit standje bestaat niet.' };
  if (normaliseerTekst(standje.status) === 'afgesloten') return { ok: false, fout: 'Dit standje is afgesloten.' };
  var boek = tabellen.catalogus.filter(function (b) { return String(b.boek_id) === String(invoer.boek_id); })[0];
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var mee = verkoopGetal(invoer.mee);
  if (mee === null || mee < 0 || mee !== Math.round(mee)) return { ok: false, fout: 'Vul een aantal in, 0 of meer.' };
  if (mee > stockVan(boek)) return { ok: false, fout: 'Er zijn maar ' + stockVan(boek) + ' exemplaren te koop.' };
  var prijs = isLeeg(invoer.prijs) ? null : verkoopGetal(invoer.prijs);
  if (!isLeeg(invoer.prijs) && (prijs === null || prijs < 0)) return { ok: false, fout: 'Vul een geldige prijs in, bv. 8 of 12,50.' };
  var velden = { mee: mee, prijs: prijs === null ? '' : prijs };
  if (invoer.hasOwnProperty('onderhandelbaar')) velden.onderhandelbaar = invoer.onderhandelbaar ? 'ja' : 'nee';
  var rij = tabellen.standjeBoeken.filter(function (r) {
    return String(r.standje_id) === String(standje.standje_id) && String(r.boek_id) === String(boek.boek_id);
  })[0];
  if (rij) wijzig(rij, velden);
  else voegToe(tabellen.standjeBoeken, Object.assign({ standje_id: String(standje.standje_id), boek_id: String(boek.boek_id) }, velden));
  return { ok: true, tekst: mee ? '"' + schoon(boek.titel) + '": ' + mee + ' mee.' : '"' + schoon(boek.titel) + '" gaat niet mee.' };
}

/** Zet de status van een standje: bezig (de verkoop begint) of afgesloten. */
function standjeStatus(rijen, invoer) {
  var rij = rijen.filter(function (r) { return String(r.standje_id) === String(invoer.standje_id); })[0];
  if (!rij) return { ok: false, fout: 'Dit standje bestaat niet.' };
  if (STANDJE_STATUSSEN.indexOf(invoer.status) === -1) return { ok: false, fout: 'Onbekende status.' };
  wijzig(rij, { status: invoer.status });
  return { ok: true, tekst: invoer.status === 'afgesloten' ? 'Standje "' + schoon(rij.naam) + '" is afgesloten.' : 'Standje "' + schoon(rij.naam) + '": ' + invoer.status + '.' };
}

/* ---------- Voorraad beheren (enkel het bestuur) ---------- */

function startAchtergrond(naam) {
  var cache = CacheService.getScriptCache();
  if (cache.get('taak_' + naam)) return false;
  cache.put('taak_' + naam, String(Date.now()), ACHTERGROND_DUUR_SECONDEN);
  HUIDIGE_TAAK = naam;
  return true;
}

/** Menu: Covers > Bewaar alle covers in Google Drive. Start op de achtergrond. */
function startCoversBewaren() {
  zorgVoorTabbladen(['Catalogus']); // kolommen cover_origineel en cover_bewaard
  planTaak('bewaarCoversInDrive', 60 * 1000);
  var n = leesTabel('Catalogus').rijen.filter(heeftCoverBewarenNodig).length;
  meld(n + ' covers komen nog van een andere site. Het kopiëren naar Google Drive start binnen een minuut op de achtergrond ' +
    'en gaat vanzelf verder. Je kan gewoon verder werken. Het Logboek toont elke ronde.');
}

/** Menu: het kopiëren start op de achtergrond, zodat de spreadsheet niet minutenlang bezig is in jouw venster. */
function startOudeCovers() {
  planTaak('kopieerOudeCovers', 60 * 1000);
  meld('Het kopiëren van de covers start binnen een minuut op de achtergrond en gaat vanzelf verder tot alles klaar is. Je kan gewoon verder werken. In het Logboek zie je elke ronde.');
}

/** Stelt filtergroepen voor op basis van woorden in het genre. */
function stelFiltergroepenVoor(genre) {
  var g = normaliseerTekst(genre);
  var groepen = [];
  ONDERWERP_VOORSTELLEN.forEach(function (paar) {
    if (paar[0].test(g) && groepen.indexOf(paar[1]) === -1) groepen.push(paar[1]);
  });
  // Het specifieke thema wint: "Koloniale geschiedenis" wordt Kolonialisme, niet ook Geschiedenis.
  return groepen.filter(function (t) {
    return !groepen.some(function (s) { return SPECIFIEK_THEMA[s] === t; });
  });
}

/** Hoeveel exemplaren de bib te koop heeft. */
function stockVan(boek) {
  return Math.max(0, Math.round(verkoopGetal(boek.te_koop_aantal) || 0));
}

function stopAchtergrond(naam) {
  try { CacheService.getScriptCache().remove('taak_' + naam); } catch (e) { /* vervalt vanzelf */ }
}

/**
 * De volgorde van de tabbladen: eerst die uit TABBLAD_GROEPEN (als ze bestaan),
 * daarna alle andere in hun huidige volgorde. Geeft [{ naam, kleur }] terug.
 */
function tabbladVolgorde(namen) {
  var uit = [], gezien = {};
  TABBLAD_GROEPEN.forEach(function (g) {
    g[1].forEach(function (naam) {
      if (namen.indexOf(naam) > -1) { uit.push({ naam: naam, kleur: g[0] }); gezien[naam] = true; }
    });
  });
  namen.forEach(function (naam) { if (!gezien[naam]) uit.push({ naam: naam, kleur: null }); });
  return uit;
}

/** Leest een tabblad, of geeft een lege tabel als het nog niet bestaat. */
function tabelOfLeeg(naam) {
  return spreadsheet().getSheetByName(naam) ? leesTabel(naam) : null;
}

/**
 * De stand per taak. rijen: de Catalogus. gepland: namen van functies met een geplande herstart.
 * bezig: { functie: tijdstip in ms } van de taken die nu lopen.
 */
function takenStand(taken, rijen, gepland, bezig) {
  return taken.map(function (t) {
    var teGaan = rijen.filter(function (r) { try { return !!t[2](r); } catch (e) { return false; } }).length;
    var status = bezig[t[0]] ? 'loopt' : gepland.indexOf(t[0]) > -1 ? 'gepland' : teGaan ? 'stil' : 'klaar';
    return { functie: t[0], naam: t[1], teGaan: teGaan, status: status, sinds: bezig[t[0]] || 0 };
  });
}

/** Tekstveld: opgeschoond en ingekort. */
function tekstInvoer(waarde, max) {
  return schoon(waarde).slice(0, max || 100);
}

/**
 * Leest de tekst van een foto. invoer: { data (base64), mime }
 * ocr: functie (base64, mime) -> ruwe tekst. Apart, zodat de tests zonder Google kunnen.
 */
function tekstUitFoto(invoer, ocr) {
  var mime = String(invoer.mime || '');
  if (!FOTO_TYPES[mime]) return { ok: false, fout: 'Enkel een foto als JPG, PNG of WebP.' };
  var data = String(invoer.data || '').replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return { ok: false, fout: 'Deze foto kon niet gelezen worden.' };
  if (data.length * 0.75 > OCR_MAX_BYTES) return { ok: false, fout: 'Deze foto is te groot.' };
  var tekst = maakOcrTekstNetjes(ocr(data, mime));
  if (tekst.length < 20) return { ok: false, fout: 'Er stond geen leesbare tekst op de foto. Probeer opnieuw met meer licht, recht van boven.' };
  return { ok: true, tekst: tekst };
}

/** Telt een aantal dagen op bij een datum (negatief mag ook). */
function telDagenOp(datum, dagen) {
  var d = naarUtc(datum);
  d.setUTCDate(d.getUTCDate() + dagen);
  return vanUtc(d);
}

/** Telefoon vergelijkbaar maken: +32 470 12 34 56 en 0470/12.34.56 worden gelijk. */
function telefoonSleutel(t) {
  var c = String(t || '').replace(/\D/g, '');
  if (c.indexOf('0032') === 0) c = '0' + c.slice(4);
  else if (c.indexOf('32') === 0 && c.length === 11) c = '0' + c.slice(2);
  return c;
}

/** Telt een foute code. Geeft true als de blokkering net begint (dan meldt het Logboek het). */
function telFouteCode(cache) {
  var n = Number(cache.get(FOUT_SLEUTEL) || 0) + 1;
  cache.put(FOUT_SLEUTEL, String(n), FOUT_VENSTER_S);
  return n === FOUT_MAX;
}

/** Telt een aantal maanden op (negatief mag ook). 31 maart min 1 maand wordt 28 of 29 februari. */
function telMaandenOp(datum, maanden) {
  var d = naarUtc(datum);
  var dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  var laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, laatste));
  return vanUtc(d);
}

/** Hoeveel nieuwsberichten en events van vrijwilligers nog op goedkeuring wachten. */
function telVoorstellen() {
  return VOORSTEL_TABBLADEN.reduce(function (n, naam) {
    if (!spreadsheet().getSheetByName(naam)) return n;
    return n + leesTabel(naam).rijen.filter(function (r) { return !isLeeg(r.voorgesteld_door) && jaNee(r.publiek) === 'nee'; }).length;
  }, 0);
}

function terugbrengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var velden = { datum_terug: staat.vandaag };
  if (invoer.borg_terugbetaald === true && Number(u.borg) > 0) velden.borg_terugbetaald = staat.vandaag;
  // Staat van het boek: komt bij de uitlening, en bij schade ook in de notitie van het boek.
  var toestand = STATEN_TERUG.indexOf(invoer.staat_boek) > -1 ? invoer.staat_boek : '';
  var opmerking = tekstInvoer(invoer.opmerking, 200);
  if (toestand || opmerking) velden.staat_terug = [toestand, opmerking].filter(Boolean).join(': ');
  wijzig(u, velden);
  staat.log.push(['terugbrengen', u.uitlening_id + ' ' + u.exemplaar + (velden.staat_terug ? ' (' + velden.staat_terug + ')' : '')]);
  if ((toestand && toestand !== 'in orde') || (opmerking && toestand !== 'in orde')) {
    var b = boekVan(staat, u.boek_id);
    if (b) {
      var regel = staat.vandaag + ' ' + u.exemplaar + ': ' + velden.staat_terug;
      wijzig(b, { notitie: [schoonMetRegels(b.notitie), regel].filter(Boolean).join('\n') });
      staat.catalogusGewijzigd = true;
    }
  }
  var melding = geefExemplaarDoor(staat, u.boek_id, u.exemplaar);
  var boek = boekVan(staat, u.boek_id);
  return {
    ok: true,
    tekst: '"' + (boek ? boek.titel : u.exemplaar) + '" is teruggebracht.' +
      (velden.borg_terugbetaald ? ' Borg van ' + bedragTekst(u.borg) + ' terugbetaald.' : (Number(u.borg) > 0 ? ' De borg staat nog open.' : '')),
    apartLeggen: melding ? [melding] : []
  };
}

/** Menu: test bol.com met één ISBN en toont wat bol.com teruggeeft. */
function testBol() {
  var isbn = '9789044641035';
  try {
    var eigen = normaliseerIsbn(String(SpreadsheetApp.getActiveRange().getValue() || '')).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var t = bolToken(leesInstellingen());
  if (t.fout) { meld(t.fout); return; }
  var r = bolVraag('/products/' + isbn + '/media', t.token);
  var tekst = 'bol.com, ISBN ' + isbn + ': code ' + r.code + '. Afbeelding: ' + (bolAfbeelding(r.data) || 'geen gevonden') +
    '. Antwoord (begin): ' + JSON.stringify(r.data || '').slice(0, 400);
  logboek('menu', 'testBol', tekst);
  meld(tekst);
}

/**
 * Menu: test Google Books met één ISBN, op dezelfde manier als het script zoekt (met de sleutel, land BE).
 * Zonder ISBN in de gekozen cel: een boek dat Google zeker kent.
 */
function testGoogleBooks() {
  var isbn = '9780141439518'; // Pride and Prejudice (Penguin Classics): Google kent dit boek zeker
  try {
    var cel = String(SpreadsheetApp.getActiveRange().getValue() || '');
    var eigen = normaliseerIsbn(cel).isbn;
    if (eigen) isbn = eigen;
  } catch (e) { /* geen cel gekozen */ }
  var sleutel = leesInstellingen().google_books_api_key;
  // Wat Google op elke vraag antwoordde, onderaan in de melding: zo zie je wat er gebeurt.
  var details = [];
  // De titel en auteur: van een bekend boek, of uit de Catalogus (dan telt ook een andere uitgave).
  var titels = Object.assign({}, GB_CONTROLE_BOEKEN);
  if (!titels[isbn]) {
    try {
      var rij = leesTabel('Catalogus').rijen.filter(function (b) { return normaliseerIsbn(b.isbn).isbn === isbn; })[0];
      if (rij) titels[isbn] = { titel: rij.titel, auteur: rij.auteur };
    } catch (e) { /* zonder titel */ }
  }
  var zoek = function (x) {
    var antwoord = googleBooksZoek(x, sleutel, undefined, titels[x]);
    details.push(x + ': ' + (antwoord.pogingen || []).join(' / '));
    return antwoord;
  };
  var r = zoek(isbn);
  // Kent Google dit boek niet, dan kijken we of Google wel een bekend boek kent: zo weet je of het aan het boek ligt.
  var controle = r.fout || r.items.length ? { werkt: !r.fout, fout: null } : googleBooksControle(sleutel, zoek);
  var tekst = googleTestTekst(isbn, controle.fout || r, sleutel, controle.werkt, controle.vreemd) + '\nWat Google antwoordde (' + (sleutel ? 'met' : 'zonder') + ' sleutel, land BE): ' + details.join(' | ');
  logboek('menu', 'testGoogleBooks', tekst.replace(/\n/g, ' | '));
  meld(tekst);
}

/** Menu: toont wat het script op de pagina vindt, en bewaart het programma als er iets gevonden is. */
function testPeperfabriek() {
  var url = String(leesInstellingen().peperfabriek_url || '').trim();
  if (!url) { meld('Vul eerst in Instellingen bij peperfabriek_url het adres van hun programma in.'); return; }
  var r = pfHaal(url);
  var p = pfLeesProgramma(r.html, url, vandaagTekst(), r.ical);
  var html = r.html;
  var generator = (html.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']+)/i) || [])[1] || '';
  var regels = [
    'Adres: ' + url, 'Antwoord: ' + r.code + ', ' + html.length + ' tekens' + (generator ? ', gemaakt met ' + generator : ''),
    'Gestructureerde gegevens (schema.org): ' + pfUitJsonLd(html, url).length,
    'Agenda-bestand (iCal): ' + (p.icalLink || 'geen') + (r.ical ? ', ' + pfUitIcal(r.ical, url).length + ' activiteiten' : ''),
    'Links naar activiteiten met een datum: ' + pfUitLinks(html, url, vandaagTekst()).length,
    'Gebruikte manier: ' + (p.manier || 'geen, er is niets gevonden'),
    ''
  ].concat(p.activiteiten.slice(0, 6).map(function (a) { return a.datum + (a.uur ? ' ' + a.uur : '') + ' · ' + a.titel + (a.link ? ' · ' + a.link : '') + (a.afbeelding ? ' · met afbeelding' : ''); }));
  if (!p.activiteiten.length) {
    // Een stukje van de pagina, om te zien hoe ze in elkaar zit.
    var i = html.search(/<main\b/i);
    regels.push('Begin van de inhoud: ' + html.slice(i > -1 ? i : 0, (i > -1 ? i : 0) + 1500).replace(/\s+/g, ' '));
  } else {
    haalPeperfabriekOp();
    regels.push('', 'Het programma is bewaard. De website toont het binnen enkele minuten.');
  }
  logboek('menu', 'testPeperfabriek', regels.slice(0, 7).join(' | ').slice(0, 450));
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

/**
 * Te vervangen: verloren exemplaren waarover nog niet beslist is. Uit de uitleningen die als verloren
 * afgesloten zijn, en uit boeken met de status verloren zonder zo'n uitlening.
 * metBorg: true voor het bestuur (borg ingehouden of terugbetaald).
 */
function teVervangen(staat, metBorg) {
  var lijst = [];
  var gehad = {};
  staat.uitleningen.forEach(function (u) {
    if (!isVerlorenUitlening(u)) return;
    gehad[String(u.boek_id)] = true;
    if (isAfgehandeldVerloren(u.staat_terug)) return;
    var b = boekVan(staat, u.boek_id);
    var item = {
      sleutel: 'U:' + u.uitlening_id, boek_id: String(u.boek_id), exemplaar: String(u.exemplaar || ''),
      titel: b ? schoon(b.titel) : String(u.boek_id), auteur: b ? schoon(b.auteur) : '', isbn: b ? schoon(b.isbn) : '',
      datum: parseerDatum(u.datum_terug), lenersnummer: String(u.lenersnummer || ''),
      opmerking: schoon(String(u.staat_terug).replace(/^verloren:?\s*/i, ''))
    };
    if (metBorg && Number(u.borg) > 0) item.borg = isLeeg(u.borg_terugbetaald) ? 'ingehouden' : 'terugbetaald';
    lijst.push(item);
  });
  staat.catalogus.forEach(function (b) {
    if (boekStatus(b) !== 'verloren' || gehad[String(b.boek_id)]) return;
    // Al beslist: de laatste regel van de notitie zegt "niet vervangen".
    var regels = schoonMetRegels(b.notitie).split('\n');
    if (/niet vervangen$/.test(regels[regels.length - 1])) return;
    lijst.push({ sleutel: 'B:' + b.boek_id, boek_id: String(b.boek_id), exemplaar: '', titel: schoon(b.titel), auteur: schoon(b.auteur),
      isbn: schoon(b.isbn), datum: '', lenersnummer: '', opmerking: '' });
  });
  return lijst.sort(function (a, b) { return a.titel.localeCompare(b.titel); });
}

/**
 * Welke back-ups mogen weg? bestanden: [{ id, naam, datum }] (datum als getal of tekst).
 * Geeft de id's van alles buiten de nieuwste "bewaren" back-ups. Enkel bestanden
 * waarvan de naam met BACKUP_VOORVOEGSEL begint, tellen mee.
 */
function teVerwijderenBackups(bestanden, bewaren) {
  var n = Math.max(1, Math.round(Number(bewaren) || 0));
  return bestanden
    .filter(function (b) { return String(b.naam || '').indexOf(BACKUP_VOORVOEGSEL) === 0; })
    .sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; })
    .slice(n)
    .map(function (b) { return b.id; });
}

/** Het thema met precies deze naam (hoofdletters en accenten tellen niet), of ''. */
function themaExact(naam) {
  var k = normaliseerTekst(naam);
  return k ? alleThemas().filter(function (f) { return normaliseerTekst(f) === k; })[0] || '' : '';
}

/** De juiste schrijfwijze van een thema: die van de website, anders de meest gebruikte. telling: { sleutel: { schrijfwijze: aantal } }. */
function themaMooi(thema, telling) {
  var k = normaliseerTekst(thema);
  var standaard = themaExact(thema);
  if (standaard) return standaard;
  var vormen = telling && telling[k] ? Object.keys(telling[k]) : [schoon(thema)];
  var beste = vormen.sort(function (a, b) { return telling[k][b] - telling[k][a] || (b === genreMooi(b) ? 1 : 0) - (a === genreMooi(a) ? 1 : 0); })[0];
  return genreMooi(beste);
}

/** Een lijst thema's in de juiste schrijfwijze, zonder dubbels. */
function themasMooi(waarde, telling) {
  var uit = [];
  splitsLijst(waarde).forEach(function (t) {
    var m = themaMooi(t, telling);
    if (uit.indexOf(m) === -1) uit.push(m);
  });
  return uit.join(', ');
}

function themasOpnieuwIndelenEenmalig() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('themas_versie') === THEMAS_VERSIE) return;
  // De vertaaltabel: genres die bij een nieuw thema horen (Fascisme, Marxisme, ...), krijgen dat thema.
  var genres = vertaaltabelNieuweThemasUitvoeren();
  if (genres) logboek('systeem', 'vertaaltabel', genres + ' genres in het tabblad Onderwerpen staan nu bij hun nieuwe thema.');
  if (!spreadsheet().getSheetByName('Categorieën en trefwoorden')) { props.setProperty('themas_versie', THEMAS_VERSIE); return; }
  var tabel = leesTabel('Catalogus');
  var voor = categorieenZonderThemas(tabel.rijen.map(function (b) { return Object.assign({}, b); })).length;
  vernieuwCategorieen([]);
  props.setProperty('themas_versie', THEMAS_VERSIE);
  leegCache();
  logboek('systeem', 'thema\'s', 'Nieuwe thema\'s van de bib: ' + voor + ' boeken hadden een categorie of trefwoord met de naam van een thema. Die staat nu bij de thema\'s.');
}

/** Telt hoe vaak elke schrijfwijze van een thema voorkomt, in Onderwerpen en de Catalogus. */
function themaTelling(onderwerpRijen, catalogus) {
  var telling = {};
  var tel = function (w) { var k = normaliseerTekst(w); if (!k) return; telling[k] = telling[k] || {}; telling[k][w] = (telling[k][w] || 0) + 1; };
  onderwerpRijen.forEach(function (r) { splitsLijst(r.filtergroepen).forEach(tel); });
  catalogus.forEach(function (b) { splitsLijst(b.extra_onderwerpen).forEach(tel); });
  return telling;
}

/** De thema's van een naam: het thema zelf, de thema's van een genre, of het voorstel. */
function themaVan(naam, vertaal) {
  var k = normaliseerTekst(naam);
  if (!k) return [];
  var standaard = themaExact(naam);
  if (standaard) return [standaard];
  var viaGenre = [];
  (vertaal && vertaal[k] || []).forEach(function (g) {
    var s = themaExact(g);
    if (s && viaGenre.indexOf(s) === -1) viaGenre.push(s);
  });
  if (viaGenre.length) return viaGenre;
  return stelFiltergroepenVoor(naam);
}

/** Tijdzone van het script, voor datums van vandaag. */
function tijdzone() {
  return Session.getScriptTimeZone() || 'Europe/Brussels';
}

/** Hoeveel boeken nog na te kijken zijn: voor het getal op de knop in het scherm. */
function titelcontroleAantal(rijen) {
  return (rijen || []).filter(function (r) { return !isLeeg(r.boek_id) && !schoon(r.status); }).length;
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

/** Begint dit woord met een hoofdletter? */
function titelGroot(w) {
  return w.charAt(0) !== w.charAt(0).toLowerCase();
}

/** Een woord met de eerste letter groot (de rest blijft zoals het is). */
function titelHoofdletter(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/**
 * Een titel die eigenlijk een datum is ("Mon Jul 24 2023 00:00:00 GMT+0200 ..."): de spreadsheet maakte ooit
 * een datum van de titel (bv. 24/7). Die passen we niet aan: jij verbetert de titel met de hand.
 */
function titelIsDatum(titel) {
  return /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT/.test(schoon(titel));
}

/** Titel zonder ondertitel en zonder wat tussen haakjes staat, voor een vergelijking. */
function titelKern(titel) {
  return normaliseerTekst(String(titel || '').replace(/\(.*?\)/g, ' ').split(':')[0]);
}

/**
 * De voorstellen: elk boek waarvan de titel volgens de regel anders zou zijn, of waarvan de titel duidelijk
 * in een andere taal staat. [{ boek_id, taal, taal_nieuw, titel_nu, titel_nieuw, toepassen }]
 */
function titelNakijklijst(catalogus) {
  var namen = titelNamen(catalogus);
  var uit = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel) || isFilm(b) || titelIsDatum(b.titel)) return;
    var taalNieuw = titelTaalVoorstel(b.titel, b.taal);
    var nieuw = titelSchrijfwijze(b.titel, taalNieuw || b.taal, namen);
    if (taalNieuw || (nieuw && nieuw !== schoon(b.titel))) {
      // Een andere taal is een gok op basis van de titel (een vertaling houdt soms de Engelse titel):
      // die rijen staan op nee tot jij ze nakijkt. De titel hangt dan ook af van die taal.
      uit.push({ boek_id: String(b.boek_id), taal: schoon(b.taal), taal_nieuw: taalNieuw, titel_nu: schoon(b.titel), titel_nieuw: nieuw, toepassen: taalNieuw ? 'nee' : 'ja' });
    }
  });
  // De rijen met een andere taal bovenaan, de rest in de volgorde van de Catalogus.
  return uit.filter(function (r) { return r.taal_nieuw; }).concat(uit.filter(function (r) { return !r.taal_nieuw; }));
}

/**
 * Namen uit de Catalogus: woorden die in de beschrijvingen midden in een zin bijna altijd groot staan
 * (minstens 2 keer, en minstens 4 keer zo vaak groot als klein), en de woorden uit de namen van de auteurs.
 * Geeft { woord in kleine letters: true }.
 */
function titelNamen(catalogus) {
  var groot = {}, klein = {}, namen = {};
  catalogus.forEach(function (b) {
    String(b.beschrijving || '').split(/[.!?:\n]+\s*/).forEach(function (zin) {
      var woorden = zin.match(TITEL_WOORD) || [];
      woorden.slice(1).forEach(function (w) {
        var k = w.toLowerCase();
        if (titelGroot(w)) groot[k] = (groot[k] || 0) + 1; else klein[k] = (klein[k] || 0) + 1;
      });
    });
    (String(b.auteur || '').match(TITEL_WOORD) || []).forEach(function (w) {
      if (titelGroot(w) && w.length >= 3) namen[w.toLowerCase()] = true;
    });
    // Kleine woorden in de titels tellen mee als bewijs dat een woord geen naam is (ik ben, alles wat was).
    (String(b.titel || '').match(TITEL_WOORD) || []).slice(1).forEach(function (w) {
      if (!titelGroot(w)) { var k = w.toLowerCase(); klein[k] = (klein[k] || 0) + 1; }
    });
  });
  Object.keys(groot).forEach(function (k) { if (groot[k] >= 2 && groot[k] >= 4 * (klein[k] || 0)) namen[k] = true; });
  // Een auteur die Ben of Was heet, maakt van ben en was nog geen naam: een woord dat vaak klein staat, is gewoon een woord.
  Object.keys(namen).forEach(function (k) { if ((klein[k] || 0) >= 3 && (klein[k] || 0) >= (groot[k] || 0)) delete namen[k]; });
  // Kleine woorden zijn nooit een naam, ook al staan ze soms groot (De Wever, Van Gogh).
  ['de', 'het', 'een', 'van', 'en', 'in', 'op', 'the', 'and', 'of', 'le', 'la', 'les', 'du', 'des', 'et', 'el', 'y', 'der', 'den', 'ter', 'ten'].forEach(function (k) { delete namen[k]; });
  return namen;
}

/** De taalregel voor een boek: 'en', 'zin' of '' (niets aanpassen). */
function titelRegel(taal) {
  var eerste = normaliseerTaal(String(taal || '').split(/[,;\/&]| en /)[0]);
  if (eerste === 'Engels') return 'en';
  return TITEL_ZINSTALEN.indexOf(eerste) > -1 ? 'zin' : '';
}

/**
 * De titel volgens de regel van de taal. namen: van titelNamen. Geeft de titel terug (ongewijzigd als de taal
 * geen regel heeft).
 */
function titelSchrijfwijze(titel, taal, namen) {
  var regel = titelRegel(taal);
  var t = schoon(titel);
  if (!regel || !t || titelIsDatum(t)) return t;
  namen = namen || {};
  var letters = t.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  var allesGroot = letters.length > 3 && letters === letters.toUpperCase();
  var woorden = t.match(TITEL_WOORD) || [];
  // In Title Case geschreven (de meeste woorden groot, ook kleine woorden): dan zeggen de hoofdletters niets over namen.
  var grootTeller = woorden.slice(1).filter(titelGroot).length;
  var titelCase = allesGroot || (woorden.length > 2 && grootTeller >= 0.6 * (woorden.length - 1));
  var laatste = woorden.length ? woorden[woorden.length - 1] : '';
  var nr = 0, vorigEinde = 0;
  return t.replace(TITEL_WOORD, function (w, plaats) {
    nr++;
    var ervoor = t.slice(vorigEinde, plaats);
    vorigEinde = plaats + w.length;
    var begin = nr === 1 || /[:.!?]\s*$|\s[-–—]\s*$/.test(ervoor);
    var k = w.toLowerCase();
    // Afkortingen en woorden met een hoofdletter in het midden (McCarthy) laten we staan.
    if (TITEL_AFKORTINGEN.indexOf(k.replace(/['’].*$/, '')) > -1) return allesGroot || w === w.toUpperCase() ? w.toUpperCase() : w;
    if (!allesGroot && /[a-zà-öø-ÿ].*[A-ZÀ-ÖØ-Þ]/.test(w)) return w;
    if (!allesGroot && w.length >= 2 && w.length <= 6 && w === w.toUpperCase() && !begin) return w;
    var basis = allesGroot ? k : w;
    if (regel === 'en') {
      if (begin || w === laatste || TITEL_KLEIN_EN.indexOf(k) === -1) return titelHoofdletter(basis);
      return k;
    }
    // Zinsregel: eerste woord groot, namen groot, de rest klein.
    if (begin) return titelHoofdletter(basis);
    if (namen[k]) return titelHoofdletter(basis);
    if (!titelCase && titelGroot(w)) return w; // bewust groot in een titel die verder klein is: wellicht een naam
    return k;
  });
}

/**
 * Sleutel om titels te vergelijken: zonder ondertitel (na ":"), zonder reeksinfo
 * tussen haakjes en zonder lidwoorden.
 */
function titelSleutel(titel) {
  var t = schoon(titel).replace(/\(.*?\)/g, ' ').split(':')[0];
  return woorden(t).join(' ');
}

/**
 * Past de nakijklijst toe: rijen met toepassen = ja. De titel enkel als titel_nieuw alleen in hoofdletters of
 * spaties verschilt van de titel in de Catalogus (een andere titel nemen we niet zomaar over: dat kan een
 * tikfout zijn). De taal als taal_nieuw ingevuld is.
 * Geeft { gedaan, overgeslagen }.
 */
function titelsToepassen(catalogus, rijen) {
  var perId = {};
  catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perId[String(b.boek_id)] = b; });
  var uit = { gedaan: 0, overgeslagen: 0 };
  rijen.forEach(function (r) {
    if (jaNee(r.toepassen) !== 'ja') return;
    var boek = perId[String(r.boek_id)];
    if (!boek) return;
    var nieuw = schoon(r.titel_nieuw);
    var taalNieuw = normaliseerTaal(r.taal_nieuw);
    var velden = {};
    if (nieuw && nieuw !== schoon(boek.titel)) {
      if (normaliseerTekst(nieuw) !== normaliseerTekst(boek.titel) && schoon(r.titel_nu) !== schoon(boek.titel)) { uit.overgeslagen++; return; }
      velden.titel = nieuw;
    }
    if (taalNieuw && taalNieuw !== normaliseerTaal(boek.taal)) velden.taal = taalNieuw;
    if (!Object.keys(velden).length) return;
    wijzig(boek, velden);
    wijzig(r, { toepassen: 'gedaan' });
    uit.gedaan++;
  });
  return uit;
}

/* ---------- In Apps Script ---------- */

/** Punten per taal voor een titel: { Nederlands: 2, Engels: 0.5, ... }. */
function titelTaalPunten(titel) {
  var punten = {};
  Object.keys(TITEL_TAALWOORDEN).forEach(function (t) { punten[t] = 0; });
  var gezien = {};
  String(titel || '').toLowerCase().split(/[^a-zà-öø-ÿ'’]+/).forEach(function (w) {
    if (!w) return;
    if (/^(l|d|qu|j|n|s|c)['’][a-zà-öø-ÿ]/.test(w)) { punten.Frans += 1; return; } // l'amour, d'une
    w = w.replace(/['’].*$/, '');
    if (!w || gezien[w]) return;
    gezien[w] = true;
    Object.keys(TITEL_TAALWOORDEN).forEach(function (t) { if (TITEL_TAALWOORDEN[t].indexOf(w) > -1) punten[t] += 1; });
    (TITEL_GEDEELD[w] || []).forEach(function (t) { punten[t] += 0.5; });
  });
  return punten;
}

/**
 * De taal van een titel, als die duidelijk is: minstens 1 punt en minstens 1 punt meer dan elke andere taal.
 * Anders ''.
 */
function titelTaalRaden(titel) {
  var punten = titelTaalPunten(titel);
  var talen = Object.keys(punten).sort(function (a, b) { return punten[b] - punten[a]; });
  if (punten[talen[0]] >= 1 && punten[talen[0]] - punten[talen[1]] >= 1) return talen[0];
  return '';
}

/**
 * Stelt een andere taal voor als de titel duidelijk in een andere taal staat dan de kolom taal zegt
 * (of als de kolom taal leeg is). Een kolom met meer talen (Nederlands, Engels) laten we staan. Geeft '' of de taal.
 */
function titelTaalVoorstel(titel, taal) {
  if (/[,;\/&]| en /.test(String(taal || ''))) return '';
  var nu = normaliseerTaal(taal);
  var geraden = titelTaalRaden(titel);
  if (!geraden || geraden === nu) return '';
  // De huidige taal moet duidelijk minder punten hebben, anders twijfelen we en laten we ze staan.
  var punten = titelTaalPunten(titel);
  if (nu && punten[nu] !== undefined && punten[geraden] - punten[nu] < 1) return '';
  return geraden;
}

/**
 * Enkel de namen uit de instelling aanraders_uit_stocklijst (bv. Johanna) komen
 * uit de stocklijst. "Nance en Johanna" wordt zo "Johanna". Andere aanraders
 * typ je zelf in de kolom aanrader van de Catalogus.
 */
function toegelatenStockAanrader(waarde, inst) {
  var toegelaten = splitsLijst((inst || {}).aanraders_uit_stocklijst).map(normaliseerTekst);
  return splitsLijst(String(waarde || '').replace(/ en | & /g, ',')).filter(function (naam) {
    return toegelaten.indexOf(normaliseerTekst(naam)) > -1;
  }).join(', ');
}

/** Vult aan met nullen: 7 wordt "07". */
function tweeCijfers(n) {
  return (n < 10 ? '0' : '') + n;
}

/** Een tekst in beide talen. Lege Engelse versie: de Nederlandse. */
function tweetalig(rij, veld) {
  var nl = schoon(rij[veld]);
  return { nl: nl, en: schoon(rij[veld + '_en']) || nl };
}

/** Een tekst met meerdere regels: enkel spaties aan begin en einde weg. */
function tweetaligLang(rij, veld) {
  var nl = String(rij[veld] || '').trim();
  return { nl: nl, en: String(rij[veld + '_en'] || '').trim() || nl };
}

/** De afspraken voor lenen, uit de instellingen, zodat ze altijd kloppen met het uitleenscherm. */
function uitleenAfspraken(inst, taal) {
  var en = taal === 'en';
  var meervoud = function (n, een, meer) { return n + ' ' + (n === 1 ? een : meer); };
  var betalen = inst.borg_betaalwijzen.join(en ? ' or ' : ' of ');
  var regels = en ? [
    'Opening hours: ' + schoon(String(inst.openingsuren_en || '').replace(/\n/g, ', ')) + '.',
    'A reader borrows at most ' + meervoud(inst.max_boeken_per_lener, 'book', 'books') + ' at a time, for ' + meervoud(inst.uitleentermijn_weken, 'week', 'weeks') + '.',
    inst.max_verlengingen ? 'Extending is possible ' + (inst.max_verlengingen === 1 ? 'once' : inst.max_verlengingen + ' times') + ', for ' + meervoud(inst.verlengingstermijn_weken, 'week', 'weeks') + (inst.verlengen_niet_bij_reservatie ? ', unless someone else has reserved the book' : '') + '.' : 'Extending is not possible.',
    'The deposit is ' + inst.borg_per_boek + ' euro per book' + (betalen ? ', paid ' + betalen : '') + '.'
  ] : [
    'Openingsuren: ' + schoon(String(inst.openingsuren || '').replace(/\n/g, ', ')) + '.',
    'Een lezer leent maximaal ' + meervoud(inst.max_boeken_per_lener, 'boek', 'boeken') + ' tegelijk, voor ' + meervoud(inst.uitleentermijn_weken, 'week', 'weken') + '.',
    inst.max_verlengingen ? 'Verlengen kan ' + (inst.max_verlengingen === 1 ? 'één keer' : inst.max_verlengingen + ' keer') + ', voor ' + meervoud(inst.verlengingstermijn_weken, 'week', 'weken') + (inst.verlengen_niet_bij_reservatie ? ', tenzij iemand anders het boek reserveerde' : '') + '.' : 'Verlengen kan niet.',
    'De borg is ' + inst.borg_per_boek + ' euro per boek' + (betalen ? ', ' + betalen : '') + '.'
  ];
  return { titel: en ? 'Borrowing rules' : 'Afspraken voor lenen', regels: regels.map(function (t) { return { punt: true, tekst: t }; }) };
}

/**
 * Status van een lopende uitlening, met kleurcode én tekst.
 * Geeft terug:
 *   code:   'optijd', 'binnenkort' of 'telaat' (de kleur in de schermen)
 *   label:  korte tekst voor een label
 *   tekst:  volledige zin, bv. "Terug tegen vrijdag 20 november (nog 18 dagen)"
 *   verlengd, verlengdTekst: extra label als de uitlening verlengd is
 */
function uitleenStatus(uitlening, vandaag, inst) {
  var verval = uitlening.vervaldatum;
  var dagen = dagenTussen(vandaag, verval);
  var dt = datumTekst(verval, vandaag);
  var status;
  if (dagen < 0) {
    status = { code: 'telaat', label: 'Te laat', tekst: 'Te laat sinds ' + dt + ' (' + dagenTekst(-dagen) + ')' };
  } else if (dagen === 0) {
    status = { code: 'binnenkort', label: 'Vervalt vandaag', tekst: 'Vervalt vandaag, ' + dt };
  } else if (dagen <= inst.waarschuwing_dagen_voor_vervaldatum) {
    status = { code: 'binnenkort', label: 'Vervalt binnenkort', tekst: 'Vervalt ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  } else {
    status = { code: 'optijd', label: 'Op tijd', tekst: 'Terug tegen ' + dt + ' (nog ' + dagenTekst(dagen) + ')' };
  }
  status.dagen = dagen;
  status.verlengd = Number(uitlening.aantal_verlengingen || 0) > 0;
  if (status.verlengd) {
    status.verlengdTekst = 'Verlengd: eerst ' + datumTekst(uitlening.oorspronkelijke_vervaldatum, vandaag) + ', nu ' + dt;
  }
  return status;
}

/**
 * Uitlenen.
 * invoer: { exemplaar, lenersnummer, borg, betaalwijze, gift, uitzondering: { reden } }
 */
function uitlenen(staat, invoer) {
  var ex = exemplaarInfo(staat, invoer.exemplaar);
  if (!ex) return { ok: false, fout: 'Dit exemplaar bestaat niet.' };
  if (!isUitleenbaar(ex.boek)) return { ok: false, fout: nietUitleenbaarFout(ex.boek) };
  if (uitleningVanExemplaar(staat, ex.exemplaar)) return { ok: false, fout: 'Dit exemplaar is al uitgeleend. Kies een ander exemplaar of registreer eerst het terugbrengen.' };
  var lener = lenerVan(staat, invoer.lenersnummer);
  if (!lener) return { ok: false, fout: 'Er is geen lener met nummer ' + tekstInvoer(invoer.lenersnummer, 10) + '.' };
  if (jaNee(lener.actief) === 'nee') return { ok: false, fout: 'Deze lener staat op inactief. Vraag het bestuur om de lener weer actief te zetten.' };
  if (isGemarkeerd(lener)) return { ok: false, gemarkeerd: true, fout: MARKERING_TEKST };
  var borg = bedragInvoer(invoer.borg);
  var gift = bedragInvoer(invoer.gift);
  if (borg === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de borg.' };
  if (gift === null) return { ok: false, fout: 'Vul een geldig bedrag in voor de gift.' };
  var betaalwijze = tekstInvoer(invoer.betaalwijze, 20);
  if (borg > 0 && staat.inst.borg_betaalwijzen.indexOf(betaalwijze) === -1) {
    return { ok: false, fout: 'Kies hoe de borg betaald werd: ' + staat.inst.borg_betaalwijzen.join(' of ') + '.' };
  }

  var stop = behandelGrenzen(staat, 'uitlenen', { lener: lener, boek: ex.boek, exemplaar: ex.exemplaar }, invoer);
  if (stop) return stop;

  var verval = berekenVervaldatum(staat.vandaag, staat.inst);
  var u = voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: ex.exemplaar, boek_id: ex.boek.boek_id, lenersnummer: lener.lenersnummer,
    datum_uit: staat.vandaag, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg, betaalwijze_borg: borg > 0 ? betaalwijze : '',
    borg_terugbetaald: '', gift: gift || '', laatste_herinnering: '', vrijwilliger: staat.wie, bron: ''
  });

  // Had deze lener een reservatie voor dit boek? Dan is die nu afgehaald.
  var meldingen = [];
  actieveReservaties(staat, ex.boek.boek_id).forEach(function (r) {
    if (String(r.lenersnummer) !== String(lener.lenersnummer)) return;
    var vrijExemplaar = r.status === STATUS_KLAAR && r.exemplaar && r.exemplaar !== ex.exemplaar ? r.exemplaar : '';
    wijzig(r, { status: STATUS_AFGEHAALD, datum_afgesloten: staat.vandaag });
    // De lener nam een ander exemplaar mee dan het apart gelegde: dat gaat naar de volgende.
    if (vrijExemplaar) {
      var m = geefExemplaarDoor(staat, ex.boek.boek_id, vrijExemplaar);
      if (m) meldingen.push(m);
    }
  });

  staat.log.push(['uitlenen', u.uitlening_id + ' ' + u.exemplaar + ' aan lener ' + lener.lenersnummer]);
  return {
    ok: true,
    terugTekst: 'Breng terug tegen ' + datumTekst(verval, staat.vandaag),
    vervaldatum: verval,
    uitlening: uitleningInfo(staat, u),
    apartLeggen: meldingen
  };
}

/**
 * Een uitlening zoals de schermen ze tonen.
 * metContact: true enkel voor het bestuur (telefoon, e-mail, achternaam).
 */
function uitleningInfo(staat, u, metContact) {
  var boek = boekVan(staat, u.boek_id);
  var lener = lenerVan(staat, u.lenersnummer);
  var info = {
    uitlening_id: u.uitlening_id, exemplaar: u.exemplaar, boek_id: u.boek_id,
    titel: boek ? boek.titel : '(onbekend boek)', auteur: boek ? boek.auteur : '',
    lenersnummer: u.lenersnummer, voornaam: lener ? lener.voornaam : '',
    datum_uit: u.datum_uit, vervaldatum: u.vervaldatum,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0),
    borg: Number(u.borg || 0), betaalwijze_borg: u.betaalwijze_borg,
    status: isLeeg(u.datum_terug) ? uitleenStatus(u, staat.vandaag, staat.inst) : null
  };
  if (metContact) {
    info.achternaam = lener ? lener.achternaam : '';
    info.telefoon = lener ? lener.telefoon : '';
    info.email = lener ? lener.email : '';
    info.laatste_herinnering = u.laatste_herinnering;
  }
  return info;
}

function uitleningVan(staat, uitleningId) {
  return staat.uitleningen.filter(function (u) { return String(u.uitlening_id) === String(uitleningId); })[0] || null;
}

function uitleningVanExemplaar(staat, exemplaar) {
  return lopendeUitleningen(staat).filter(function (u) { return u.exemplaar === exemplaar; })[0] || null;
}

/** Een regisseur staat bij Wikidata soms in het Nederlands en het Engels: één keer per naam. */
function uniekeNamen(namen) {
  var gezien = {};
  return namen.filter(function (n) { var k = normaliseerTekst(n); if (gezien[k]) return false; gezien[k] = true; return true; });
}

/** De datum van vandaag als "JJJJ-MM-DD". */
function vandaagTekst() {
  return Utilities.formatDate(new Date(), tijdzone(), 'yyyy-MM-dd');
}

/** De boeken die vandaag terugkwamen, met hun onderwerp: zo weet je in welke kast ze horen. Zonder gegevens van leners. */
function vandaagTerug(staat, vertaal) {
  // Een verloren boek kwam niet terug: dat staat bij Te vervangen.
  return staat.uitleningen.filter(function (u) { return parseerDatum(u.datum_terug) === staat.vandaag && !isVerlorenUitlening(u); }).map(function (u) {
    var boek = boekVan(staat, u.boek_id);
    var groepen = boek && vertaal ? filtergroepenVan(boek, vertaal) : [];
    return { uitlening_id: String(u.uitlening_id), exemplaar: String(u.exemplaar || ''), boek_id: String(u.boek_id),
      titel: boek ? schoon(boek.titel) : String(u.boek_id), auteur: boek ? schoon(boek.auteur) : '',
      onderwerp: groepen[0] || (boek ? schoon(boek.genre) : '') || 'Zonder onderwerp', staat_terug: schoon(u.staat_terug) };
  }).sort(function (a, b) { return a.onderwerp.localeCompare(b.onderwerp) || a.auteur.localeCompare(b.auteur); });
}

/** Date in UTC terug naar "JJJJ-MM-DD". */
function vanUtc(d) {
  return d.getUTCFullYear() + '-' + tweeCijfers(d.getUTCMonth() + 1) + '-' + tweeCijfers(d.getUTCDate());
}

/** De namen van de vaste events op een datum (JJJJ-MM-DD). */
function vasteEventsOp(datum, lijst) {
  var jaar = Number(datum.slice(0, 4)), maand = Number(datum.slice(5, 7));
  return (lijst || []).filter(function (e) { return nDeWeekdag(jaar, maand, e.dag, e.week) === datum; }).map(function (e) { return e.naam; });
}

/**
 * Leest de vaste events: een regel per event, "naam: rangwoord weekdag".
 * Bv. "T-café: derde vrijdag" of "Volkskeuken: laatste vrijdag". Geeft [{ naam, week, dag }].
 */
function vasteEventsUitTekst(tekst) {
  return String(tekst || '').split('\n').map(function (regel) {
    var m = regel.match(/^\s*(.+?)\s*:\s*(\S+)\s+(\S+)\s*$/);
    if (!m) return null;
    var week = RANGWOORDEN[normaliseerTekst(m[2])];
    var dag = WEEKDAGEN.indexOf(normaliseerTekst(m[3]));
    return week && dag > -1 ? { naam: schoon(m[1]), week: week, dag: dag } : null;
  }).filter(Boolean);
}

/**
 * Voor de agenda van de website: per vast event de eerstvolgende keer, tenzij er die dag al
 * een eigen event met die naam in de Agenda staat.
 * details: de rijen van het tabblad Vaste events. De kolom naam is de naam uit tekst_vaste_events.
 * Daar staan de titel op de website (mag anders zijn, bv. met de organisatie erbij), uur, locatie,
 * tekst en link, in het Nederlands en het Engels. Zonder rij: enkel de naam.
 */
function vasteEventsVoorAgenda(inst, vandaag, agendaRijen, details) {
  var perNaam = {};
  (details || []).forEach(function (r) { if (!isLeeg(r.naam)) perNaam[normaliseerTekst(r.naam)] = r; });
  var eigen = {};
  (agendaRijen || []).forEach(function (r) {
    var d = parseerDatum(r.datum);
    if (d) eigen[d + '|' + normaliseerTekst(r.titel)] = true;
  });
  return vasteEventsUitTekst(inst.tekst_vaste_events).map(function (e) {
    var d = bookclubDatums(vandaag, e.week, e.dag, 1)[0];
    if (!d || eigen[d + '|' + normaliseerTekst(e.naam)]) return null;
    var r = perNaam[normaliseerTekst(e.naam)];
    if (!r) return { datum: d, uur: '', titel: { nl: e.naam, en: e.naam }, tekst: { nl: '', en: '' }, locatie: '', afbeelding: '', link: '' };
    var titel = schoon(r.titel) || e.naam;
    return {
      datum: d, uur: schoon(r.uur), titel: { nl: titel, en: schoon(r.titel_en) || titel }, tekst: tweetaligLang(r, 'tekst'),
      locatie: schoon(r.locatie), afbeelding: veiligeCoverUrl(r.afbeelding), link: veiligeCoverUrl(r.link)
    };
  }).filter(Boolean);
}

/**
 * Maakt een tekst veilig om in een cel te schrijven.
 * Tekst die met = + - of @ begint, zou de spreadsheet als formule lezen.
 * Telefoonnummers met een 0 vooraan en lange cijferreeksen (ISBN) blijven tekst.
 */
function veiligeCel(waarde) {
  if (typeof waarde !== 'string') return waarde;
  if (/^[=+\-@]/.test(waarde) || /^0\d/.test(waarde) || /^\d{8,}$/.test(waarde)) return "'" + waarde;
  return waarde;
}

/** Enkel https-links naar afbeeldingen. Zo kan er geen vreemde code via een cover binnensluipen. */
function veiligeCoverUrl(url) {
  var u = schoon(url);
  return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}

function verdeelOudeGroep(onderwerpRijen) {
  var aangepast = 0, religie = 0;
  onderwerpRijen.forEach(function (r) {
    var groepen = splitsLijst(r.filtergroepen);
    var g = normaliseerTekst(r.genre);
    var heeftOud = groepen.some(function (x) { return normaliseerTekst(x) === OUDE_GROEP; });
    // Een genre over religie dat nog nergens bij hoorde, krijgt ook de nieuwe groep.
    var isReligie = stelFiltergroepenVoor(g).indexOf('Religie en Spiritualiteit') > -1;
    var heeftReligie = groepen.some(function (x) { return normaliseerTekst(x) === 'religie en spiritualiteit'; });
    if (!heeftOud && !(isReligie && !heeftReligie)) return;
    var nieuw = stelFiltergroepenVoor(g).filter(function (x) { return NIEUWE_GROEPEN.indexOf(x) > -1; });
    if (heeftOud && !nieuw.length) nieuw = ['Maatschappij'];
    var rest = groepen.filter(function (x) { return normaliseerTekst(x) !== OUDE_GROEP; });
    nieuw.forEach(function (x) { if (rest.map(normaliseerTekst).indexOf(normaliseerTekst(x)) === -1) rest.push(x); });
    wijzig(r, { filtergroepen: rest.join(', ') });
    aangepast++;
    if (nieuw.indexOf('Religie en Spiritualiteit') > -1) religie++;
  });
  return { aangepast: aangepast, religie: religie };
}

/** Menu: verdeelt Geschiedenis en maatschappij in de tabel Onderwerpen. */
function verdeelOudeGroepMenu() {
  var tabel = leesTabel('Onderwerpen');
  var r = verdeelOudeGroep(tabel.rijen);
  if (r.aangepast) bewaarTabel(tabel);
  leegCache();
  logboek('menu', 'verdeelOudeGroep', r.aangepast + ' genres, ' + r.religie + ' naar religie');
  meld(r.aangepast + ' genres in Onderwerpen kregen een nieuwe groep, waarvan ' + r.religie + ' bij Religie en Spiritualiteit. Kijk de kolom filtergroepen na: een genre dat verkeerd staat, pas je daar zelf aan.');
}

/** Voert een actie van het verkoopscherm uit (binnen het slot van doPost). */
function verkoopActie(actie, invoer, wie) {
  var nodig = ['Standjes', 'Standje boeken', 'Verkopen'];
  for (var i = 0; i < nodig.length; i++) {
    if (!spreadsheet().getSheetByName(nodig[i])) return { ok: false, fout: 'Het tabblad ' + nodig[i] + ' ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  }
  var catalogus = leesTabel('Catalogus');
  var tabellen = {
    catalogus: catalogus.rijen, standjes: leesTabel('Standjes'), standjeBoeken: leesTabel('Standje boeken'), verkopen: leesTabel('Verkopen')
  };
  var rijen = { catalogus: catalogus.rijen, standjes: tabellen.standjes.rijen, standjeBoeken: tabellen.standjeBoeken.rijen, verkopen: tabellen.verkopen.rijen };
  // De thema's zoals op de website (vertaaltabel Onderwerpen). Ontbreekt het tabblad, dan zonder thema's.
  rijen.onderwerpen = spreadsheet().getSheetByName('Onderwerpen') ? leesTabel('Onderwerpen').rijen : [];
  var betaalwijzen = leesInstellingen().borg_betaalwijzen;
  if (actie === 'verkoopData') return { ok: true, data: Object.assign(verkoopOverzicht(rijen), { betaalwijzen: betaalwijzen }) };
  if (actie === 'voorraadCatalogus') return { ok: true, boeken: voorraadCatalogus(rijen.catalogus) };
  var r;
  if (actie === 'standjeBewaren') {
    r = standjeBewaren(rijen.standjes, invoer, nieuwIdVoor(rijen.standjes, 'standje_id', 'standje', 'S'));
    if (r.ok) bewaarTabel(tabellen.standjes);
  } else if (actie === 'standjeBoekZetten') {
    r = standjeBoekZetten(rijen, invoer);
    if (r.ok) bewaarTabel(tabellen.standjeBoeken);
  } else if (actie === 'verkopenDoorsturen') {
    r = verkopenToevoegen(rijen, invoer.verkopen, wie);
    if (r.nieuw) {
      bewaarTabel(tabellen.verkopen);
      bewaarTabel(catalogus);
      try { schrijfVoorraad(rijen.catalogus, rijen.verkopen); } catch (e) { /* het overzicht is een extraatje */ }
    }
  } else if (actie === 'voorraadZetten' || actie === 'voorraadNieuwBoek') {
    if (actie === 'voorraadZetten') r = voorraadZetten(rijen.catalogus, invoer);
    else {
      var ids = maakIdGenerator(rijen.catalogus);
      r = voorraadNieuwBoek(rijen.catalogus, invoer, function (soort) { return ids.nieuw(soort); }, vandaagTekst());
    }
    if (r.ok) {
      bewaarTabel(catalogus);
      // Staat er datumopmaak op de kolom prijs (dan toont de spreadsheet 7,50 als 6/1/1900)? Meteen rechtzetten.
      try { zetGetalopmaak(catalogus.blad, ['prijs'], '0.00'); } catch (e) { /* enkel opmaak */ }
      try { schrijfVoorraad(rijen.catalogus, rijen.verkopen); } catch (e) { /* het overzicht is een extraatje */ }
    }
  } else if (actie === 'standjeStatus') {
    r = standjeStatus(rijen.standjes, invoer);
    if (r.ok) bewaarTabel(tabellen.standjes);
  } else {
    return { ok: false, fout: 'Onbekende actie.' };
  }
  if (r.ok) {
    logboek(wie, actie, String(invoer.standje_id || invoer.boek_id || '') + (r.nieuw ? ' (' + r.nieuw + ' verkopen)' : ''));
    r.data = Object.assign(verkoopOverzicht(rijen), { betaalwijzen: betaalwijzen });
  }
  return r;
}

/**
 * De gegevens die een koper wil weten, voor de lijst voor kopers in het verkoopscherm. Lege velden vallen weg.
 * i: ISBN, u: uitgeverij, j: jaartal, l: taal, p: pagina's, v: uitvoering, n: nieuw of tweedehands.
 */
function verkoopGegevens(b) {
  var uit = {
    i: schoon(b.isbn), u: schoon(b.uitgeverij), j: parseerGetal(b.jaartal) || '', l: schoon(b.taal), p: parseerGetal(b.paginas) || '',
    v: schoon(b.uitvoering), n: jaNee(b.nieuwstaat) === 'ja' ? 'nieuw' : jaNee(b.nieuwstaat) === 'nee' ? 'tweedehands' : ''
  };
  Object.keys(uit).forEach(function (k) { if (isLeeg(uit[k])) delete uit[k]; });
  return uit;
}

/** Een getal uit een cel of invoer: "12,50" wordt 12.5. Leeg of ongeldig: null. */
function verkoopGetal(w) {
  if (isLeeg(w)) return null;
  var t = String(w).replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (!/\d/.test(t)) return null; // "veel" of "twee" is geen getal (anders zou het 0 worden)
  var n = Number(t);
  return isFinite(n) ? n : null;
}

/**
 * Wat het verkoopscherm toont zoals op de website: cover (c), korte beschrijving (d) en thema's (g).
 * vertaal: de vertaaltabel Onderwerpen (zie vertaalTabel).
 */
function verkoopKaart(b, vertaal) {
  return {
    c: veiligeCoverUrl(b.cover_url),
    d: kortAfOpZin(schoonMetRegels(b.beschrijving), VERKOOP_BESCHRIJVING_MAX),
    g: filtergroepenVan(b, vertaal),
    s: normaliseerTekst(b.soort) === 'zine' ? 'zine' : ''
  };
}

/**
 * Past de verkooplijst toe op de Catalogus (wijzig en voegToe). nieuwId: functie (soort) -> boek-ID.
 * Geeft [{ rij, boek_id, verwerkt, opmerking, nieuw }] voor de rijen die nog niet verwerkt waren.
 */
function verkooplijstToepassen(catalogus, lijst, nieuwId, vandaag) {
  var kennis = auteurKennis(catalogus);
  var opIsbn = {}, opSleutel = {};
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isFilm(b)) return;
    var i = normaliseerIsbn(b.isbn).isbn;
    if (i) opIsbn[i] = b;
    var s = verkoopSleutel(b.titel, b.auteur);
    if (!opSleutel[s]) opSleutel[s] = b;
  });
  var uit = [];
  lijst.forEach(function (r) {
    if (r.verwerkt) return;
    var opmerkingen = [];
    var n = parseerGetal(r.aantalTekst);
    if (!n || n < 0) { n = 1; opmerkingen.push('aantal ontbrak: 1'); }
    n = Math.round(n);
    if (/inkijk/i.test(r.aantalTekst)) opmerkingen.push('inkijkexemplaar niet meegeteld');
    if (r.prijs === null) opmerkingen.push('prijs nog in te vullen');
    var isbn = normaliseerIsbn(r.isbn).isbn;
    var boek = (isbn && opIsbn[isbn]) || opSleutel[verkoopSleutel(r.titel, r.auteur)];
    var nieuw = false;
    if (boek) {
      var velden = { te_koop_aantal: n };
      if (r.prijs !== null) velden.prijs = r.prijs;
      wijzig(boek, velden);
      opmerkingen.unshift('al in de catalogus');
    } else {
      nieuw = true;
      boek = {
        boek_id: nieuwId('boek'), soort: 'boek', titel: r.titel, auteur: auteurNetjes(r.auteur, kennis), isbn: isbn || schoon(r.isbn),
        uitgeverij: r.uitgeverij, jaartal: r.jaartal, taal: normaliseerTaal(r.taal), paginas: r.paginas,
        uitvoering: normaliseerUitvoering(r.uitvoering), nieuwstaat: verkoopNieuwstaat(r.nieuwstaat),
        genre: r.genre ? genreMooi(r.genre) : '', aantal: '', uitleenbaar: 'nee', publiek: 'nee',
        te_koop_aantal: n, prijs: r.prijs === null ? '' : r.prijs, herkomst: 'verkooplijst', toegevoegd_op: vandaag
      };
      boek.bron_sleutel = bronSleutel(boek);
      voegToe(catalogus, boek);
      if (isbn) opIsbn[isbn] = boek;
      opSleutel[verkoopSleutel(boek.titel, boek.auteur)] = boek;
      opmerkingen.unshift('nieuw, enkel te koop (niet op de website)');
    }
    uit.push({ rij: r.rij, boek_id: String(boek.boek_id), verwerkt: vandaag + ' ' + boek.boek_id, opmerking: opmerkingen.join('; '), nieuw: nieuw });
  });
  return uit;
}

/** "nieuw" of "2e hands" naar ja of nee (kolom nieuwstaat in de Catalogus). */
function verkoopNieuwstaat(w) {
  var t = normaliseerTekst(w);
  if (!t) return '';
  if (/^nieuw|^new|^ja$/.test(t)) return 'ja';
  if (/2 ?e ?hands|tweedehands|second|^nee$|gebruikt/.test(t)) return 'nee';
  return '';
}

/** Het overzicht voor het verkoopscherm. tabellen: { catalogus, standjes, standjeBoeken, verkopen, onderwerpen? } (rijen). */
function verkoopOverzicht(tabellen) {
  var vertaal = vertaalTabel(tabellen.onderwerpen || []);
  var perBoek = {};
  tabellen.catalogus.forEach(function (b) { if (!isLeeg(b.boek_id)) perBoek[String(b.boek_id)] = b; });
  var teKoop = tabellen.catalogus.filter(function (b) { return !isLeeg(b.boek_id) && stockVan(b) > 0; }).map(function (b) {
    return Object.assign({ id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), prijs: verkoopGetal(b.prijs), o: jaNee(b.onderhandelbaar) === 'ja', stock: stockVan(b) },
      verkoopKaart(b, vertaal), verkoopGegevens(b));
  }).sort(function (a, b) { return a.t.localeCompare(b.t); });

  var standjes = tabellen.standjes.filter(function (s) { return !isLeeg(s.standje_id); }).map(function (s) {
    var id = String(s.standje_id);
    var verkopen = tabellen.verkopen.filter(function (v) { return String(v.standje_id) === id; });
    var omzet = { totaal: 0, perBetaalwijze: {} };
    verkopen.forEach(function (v) {
      var bedrag = (verkoopGetal(v.prijs) || 0) * (verkoopGetal(v.aantal) || 1);
      omzet.totaal += bedrag;
      var w = schoon(v.betaalwijze) || 'onbekend';
      omzet.perBetaalwijze[w] = (omzet.perBetaalwijze[w] || 0) + bedrag;
    });
    var boeken = tabellen.standjeBoeken.filter(function (r) { return String(r.standje_id) === id && (verkoopGetal(r.mee) || 0) > 0; }).map(function (r) {
      var b = perBoek[String(r.boek_id)] || {};
      var verkocht = verkopen.filter(function (v) { return String(v.boek_id) === String(r.boek_id); })
        .reduce(function (som, v) { return som + (verkoopGetal(v.aantal) || 1); }, 0);
      var prijs = verkoopGetal(r.prijs);
      return Object.assign({
        boek_id: String(r.boek_id), t: schoon(b.titel) || String(r.boek_id), a: schoon(b.auteur),
        mee: verkoopGetal(r.mee), verkocht: verkocht,
        prijs: prijs === null ? verkoopGetal(b.prijs) : prijs,
        o: isLeeg(r.onderhandelbaar) ? jaNee(b.onderhandelbaar) === 'ja' : jaNee(r.onderhandelbaar) === 'ja',
        stock: stockVan(b)
      }, verkoopKaart(b, vertaal));
    }).sort(function (a, b) { return a.t.localeCompare(b.t); });
    return {
      standje_id: id, naam: schoon(s.naam), thema: schoon(s.thema), datum: parseerDatum(s.datum) || '', locatie: schoon(s.locatie),
      status: STANDJE_STATUSSEN.indexOf(normaliseerTekst(s.status)) > -1 ? normaliseerTekst(s.status) : 'voorbereiding',
      boeken: boeken, omzet: omzet, aantalVerkopen: verkopen.length
    };
  }).sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });
  // Afgesloten standjes: enkel de laatste 5, voor de cijfers.
  var open = standjes.filter(function (s) { return s.status !== 'afgesloten'; });
  var dicht = standjes.filter(function (s) { return s.status === 'afgesloten'; }).slice(0, 5);
  return { teKoop: teKoop, standjes: open.concat(dicht) };
}

/** De sleutel om een boek zonder ISBN te herkennen: de titel (zonder ondertitel) en de achternaam. */
function verkoopSleutel(titel, auteur) {
  return titelKern(titel) + '|' + normaliseerTekst(achternaam(auteur));
}

/**
 * Verkopen die de gsm doorstuurt (ook achteraf, na een standje zonder internet).
 * invoer.verkopen: [{ verkoop_id, standje_id, boek_id, aantal, prijs, betaalwijze, tijdstip }]
 * Geeft de verkoop_id's terug die nu bewaard zijn (ook die er al waren), zodat de gsm ze uit de wachtrij haalt.
 */
function verkopenToevoegen(tabellen, lijst, wie) {
  var bekend = {};
  tabellen.verkopen.forEach(function (v) { bekend[String(v.verkoop_id)] = true; });
  var standjes = {};
  tabellen.standjes.forEach(function (s) { standjes[String(s.standje_id)] = s; });
  var boeken = {};
  tabellen.catalogus.forEach(function (b) { boeken[String(b.boek_id)] = b; });
  var bewaard = [], nieuw = 0, fouten = [];
  (lijst || []).slice(0, 200).forEach(function (v) {
    var id = tekstInvoer(v.verkoop_id, 60);
    if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) { fouten.push('Een verkoop zonder geldige code.'); return; }
    if (bekend[id]) { bewaard.push(id); return; }
    var standje = standjes[String(v.standje_id)];
    var boek = boeken[String(v.boek_id)];
    var aantal = verkoopGetal(v.aantal) || 1;
    var prijs = verkoopGetal(v.prijs);
    if (!standje || !boek || aantal < 1 || aantal !== Math.round(aantal) || prijs === null || prijs < 0) {
      fouten.push('Verkoop ' + id + ' klopt niet en is niet bewaard.');
      return;
    }
    voegToe(tabellen.verkopen, {
      verkoop_id: id, standje_id: String(standje.standje_id), boek_id: String(boek.boek_id), aantal: aantal, prijs: prijs,
      betaalwijze: tekstInvoer(v.betaalwijze, 20), tijdstip: tekstInvoer(v.tijdstip, 30), vrijwilliger: wie
    });
    // De stock gaat meteen omlaag. Nooit onder nul.
    wijzig(boek, { te_koop_aantal: Math.max(0, stockVan(boek) - aantal) });
    bekend[id] = true;
    bewaard.push(id);
    nieuw++;
  });
  return { ok: true, bewaard: bewaard, nieuw: nieuw, fouten: fouten };
}

/**
 * Verlengen.
 * invoer: { uitlening_id, uitzondering: { reden } }
 */
function verlengen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var stop = behandelGrenzen(staat, 'verlengen', { uitlening: u, boek: boekVan(staat, u.boek_id), lener: lenerVan(staat, u.lenersnummer) }, invoer);
  if (stop) return stop;
  // Al te laat? Dan telt de termijn vanaf vandaag, anders zou de nieuwe datum al voorbij zijn.
  var oud = parseerDatum(u.vervaldatum) || staat.vandaag;
  var nieuw = berekenVerlenging(oud < staat.vandaag ? staat.vandaag : oud, staat.inst);
  // Zelf een datum gekozen aan de balie (bv. de lener kan pas later komen)? Dan die, op een openingsdag.
  if (!isLeeg(invoer.tot)) {
    var gekozen = parseerDatum(invoer.tot);
    if (!gekozen) return { ok: false, fout: 'Deze datum klopt niet. Kies een datum in de kalender.' };
    if (gekozen <= staat.vandaag) return { ok: false, fout: 'Kies een datum na vandaag.' };
    if (gekozen > telMaandenOp(staat.vandaag, 6)) return { ok: false, fout: 'Kies een datum binnen de 6 maanden. Langer kan enkel het bestuur afspreken.' };
    nieuw = staat.inst.terugbrengdatum_op_openingsdag ? volgendeOpeningsdag(gekozen, staat.inst, true) : gekozen;
  }
  wijzig(u, {
    vervaldatum: nieuw,
    vorige_vervaldatum: u.vervaldatum,
    aantal_verlengingen: Number(u.aantal_verlengingen || 0) + 1,
    datum_verlenging: staat.vandaag,
    oorspronkelijke_vervaldatum: u.oorspronkelijke_vervaldatum || u.vervaldatum
  });
  staat.log.push(['verlengen', u.uitlening_id + ' tot ' + nieuw]);
  return { ok: true, terugTekst: 'Nieuwe datum: breng terug tegen ' + datumTekst(nieuw, staat.vandaag), vervaldatum: nieuw, uitlening: uitleningInfo(staat, u) };
}

/* ---------- Een uitlening aanpassen of annuleren ---------- */

/** In Apps Script: schrijft het tabblad Categorieën en trefwoorden en zet de keuzelijsten in de Catalogus. */
function vernieuwCategorieen(oudeTags) {
  var naam = 'Categorieën en trefwoorden';
  var catalogus = leesTabel('Catalogus');
  var ss = spreadsheet();
  var blad = ss.getSheetByName(naam);
  // De soort in het tabblad wint: zo deel je een naam zelf anders in (of zet je hem op weg).
  var tabRijen = blad && blad.getLastRow() > 1 ? leesTabel(naam).rijen : [];
  var soortVan = {};
  tabRijen.forEach(function (r) {
    var soort = normaliseerTekst(r.soort);
    if (CATEGORIE_SOORTEN.indexOf(soort) > -1) soortVan[normaliseerTekst(r.naam)] = soort;
  });
  var anders = categorieenHerindelen(catalogus.rijen, soortVan);
  var zonderThemas = categorieenZonderThemas(catalogus.rijen);
  if (anders.length || zonderThemas.length) schrijfKolommen(catalogus, ['categorieen', 'trefwoorden', 'triggerwaarschuwingen', 'extra_onderwerpen']);
  // De namen die al in het tabblad staan, blijven (ook als ze aan geen enkel boek hangen). Wat op weg staat, valt weg.
  var bestaand = tabRijen.filter(function (r) { return normaliseerTekst(r.soort) !== 'weg'; }).map(function (r) {
    var soort = soortVan[normaliseerTekst(r.naam)] || 'trefwoord';
    return { displayName: r.naam, isCategory: soort === 'categorie', isTw: soort === 'triggerwaarschuwing' };
  });
  var weg = {};
  Object.keys(soortVan).forEach(function (k) { if (soortVan[k] === 'weg') weg[k] = true; });
  oudeTags = (oudeTags || []).filter(function (t) { return t && !weg[normaliseerTekst(t.displayName || t.name)]; });
  var rijen = categorieenOverzicht(catalogus.rijen, bestaand.concat(oudeTags));
  // Eigen zoekwoorden (kolom zoekwoorden, voor Boeken > Deel de boeken in) blijven bewaard.
  var zoekwoorden = {};
  tabRijen.forEach(function (r) { if (!isLeeg(r.zoekwoorden)) zoekwoorden[normaliseerTekst(r.naam)] = schoon(r.zoekwoorden); });
  rijen.forEach(function (r) { r.zoekwoorden = zoekwoorden[normaliseerTekst(r.naam)] || ''; });
  // Wat op weg staat, blijft onderaan in het tabblad: zo komt het ook na opnieuw overnemen niet terug.
  tabRijen.forEach(function (r) { if (weg[normaliseerTekst(r.naam)]) rijen.push({ naam: schoon(r.naam), soort: 'weg', aantal_boeken: 0, zoekwoorden: schoon(r.zoekwoorden) }); });
  if (!blad) blad = maakTabblad(naam);
  var kolommen = KOLOMMEN[naam];
  blad.clear();
  var waarden = [kolommen].concat(rijen.map(function (r) { return kolommen.map(function (k) { return r[k]; }); }));
  blad.getRange(1, 1, waarden.length, kolommen.length).setValues(waarden);
  opmaakKop(blad, kolommen.length);
  if (rijen.length) blad.getRange(2, kolommen.indexOf('soort') + 1, rijen.length, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CATEGORIE_SOORTEN, true).setAllowInvalid(false).build());
  // Keuzelijsten in de Catalogus. Ongeldige waarden mogen: meerdere namen met een komma ertussen.
  [['categorieen', 'categorie'], ['trefwoorden', 'trefwoord'], ['triggerwaarschuwingen', 'triggerwaarschuwing']].forEach(function (paar) {
    var kol = catalogus.kop.indexOf(paar[0]) + 1;
    var keuzes = rijen.filter(function (r) { return r.soort === paar[1]; }).map(function (r) { return r.naam; }).slice(0, 500);
    if (!kol || !keuzes.length) return;
    catalogus.blad.getRange(2, kol, Math.max(1, catalogus.blad.getMaxRows() - 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(keuzes, true).setAllowInvalid(true).build());
  });
  return rijen;
}

/** Menu: Boeken > Categorieën en trefwoorden: vernieuw de lijst en de keuzelijsten. */
function vernieuwCategorieenMenu() {
  var rijen = vernieuwCategorieen([]);
  var tel = function (s) { return rijen.filter(function (r) { return r.soort === s; }).length; };
  var tekst = tel('categorie') + ' categorieën, ' + tel('trefwoord') + ' trefwoorden en ' + tel('triggerwaarschuwing') +
    ' triggerwaarschuwingen in het tabblad Categorieën en trefwoorden. De kolommen in de Catalogus volgen nu de soort in dat tabblad en hebben een keuzelijst.';
  logboek('menu', 'vernieuwCategorieen', tekst);
  meld(tekst);
}

/** Menu: vertaalt de beschrijvingen naar het Nederlands en het Engels, in porties. */
function vertaalBeschrijvingen() {
  var start = Date.now();
  if (!startAchtergrond('vertaalBeschrijvingen')) {
    // Er loopt al een vertaalronde (vaak vanzelf gestart na het zoeken van beschrijvingen): straks opnieuw.
    planVertaling(5);
    logboek('menu', 'vertaalBeschrijvingen', 'Er loopt al een vertaalronde. Over 5 minuten gaat het vanzelf verder.');
    meldAlBezig('vertaalBeschrijvingen');
    return;
  }
  var verwerkt = 0, rest = 0, limiet = false;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_vertaald') === -1 || tabel.kop.indexOf('beschrijving_en') === -1) {
      meld('De kolommen beschrijving_en en beschrijving_vertaald ontbreken nog in de Catalogus. Voer eerst "installeer" uit.');
      logboek('menu', 'vertaalBeschrijvingen', 'Niet gestart: de kolommen beschrijving_en en beschrijving_vertaald ontbreken. Kies Madrigal > Installeer tabbladen.');
      return;
    }
    var vandaag = vandaagTekst();
    var vertaal = function (tekst, taal) { return LanguageApp.translate(tekst, '', taal); };
    var teDoen = tabel.rijen.filter(heeftVertalingNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var velden;
      try {
        velden = maakTweetaligeBeschrijving(teDoen[i], vertaal);
      } catch (e) {
        // Meestal de daglimiet van Google Translate.
        limiet = true;
        break;
      }
      velden.beschrijving_vertaald = vandaag;
      wijzig(teDoen[i], velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(200);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftVertalingNodig).length;
  } finally {
    stopAchtergrond('vertaalBeschrijvingen');
  }
  verwijderTriggers('vertaalBeschrijvingen');
  if (rest > 0) planVertaling(limiet ? 24 * 60 : 1);
  if (verwerkt) leegCache();
  logboek('menu', 'vertaalBeschrijvingen', verwerkt + ' vertaald, ' + rest + ' te gaan' + (limiet ? ' (daglimiet van Google Translate)' : ''));
  var tekst = verwerkt + ' beschrijvingen vertaald.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google Translate is bereikt: morgen gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is vertaald.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Leest de vertaaltabel als object: genre -> lijst filtergroepen. */
function vertaalTabel(onderwerpRijen) {
  var vertaal = {};
  onderwerpRijen.forEach(function (r) {
    vertaal[normaliseerTekst(r.genre)] = splitsLijst(r.filtergroepen);
  });
  return vertaal;
}

/**
 * De vertaaltabel Onderwerpen bijwerken voor de nieuwe thema's: een genre dat bij een nieuw thema hoort
 * ("Fascisme en nazisme", "Koloniale geschiedenis", ...) krijgt het voorstel volgens de huidige regels
 * (dus Fascisme, niet langer Geschiedenis). Andere genres blijven zoals ze zijn. Geeft de genres die veranderden.
 */
function vertaaltabelNieuweThemas(onderwerpRijen) {
  var uit = [];
  onderwerpRijen.forEach(function (r) {
    if (isLeeg(r.genre)) return;
    var exact = themaExact(r.genre);
    var voorstel = exact ? [exact] : stelFiltergroepenVoor(r.genre);
    if (!voorstel.some(function (t) { return NIEUWE_THEMAS.indexOf(t) > -1; })) return;
    var nu = voorstel.join(', ');
    if (normaliseerTekst(nu) === normaliseerTekst(r.filtergroepen)) return;
    uit.push({ genre: schoon(r.genre), vroeger: schoon(r.filtergroepen), nu: nu });
    wijzig(r, { filtergroepen: nu });
  });
  return uit;
}

/** Menu: Boeken > Onderwerpen: pas de nieuwe thema's toe op de vertaaltabel. */
function vertaaltabelNieuweThemasMenu() {
  var n = vertaaltabelNieuweThemasUitvoeren();
  var tekst = n ? n + ' genres in het tabblad Onderwerpen staan nu bij hun nieuwe thema (bv. Fascisme, Marxisme, Kolonialisme). De website toont het binnen enkele minuten.'
    : 'Alle genres in het tabblad Onderwerpen staan al bij de juiste thema\'s.';
  logboek('menu', 'vertaaltabel', tekst);
  meld(tekst);
}

/** In Apps Script: past vertaaltabelNieuweThemas toe op het tabblad Onderwerpen. Geeft het aantal genres. */
function vertaaltabelNieuweThemasUitvoeren() {
  var tabel = leesTabel('Onderwerpen');
  var uit = vertaaltabelNieuweThemas(tabel.rijen);
  if (uit.length) { bewaarTabel(tabel); leegCache(); }
  return uit.length;
}

/**
 * Het bestuur verschuift de vervaldatum met een aantal dagen (bv. 7 extra, of -7).
 * Staat terugbrengdatum_op_openingsdag aan, dan schuift de datum door naar de eerstvolgende openingsdag.
 * Telt niet als verlenging. invoer: { uitlening_id, dagen }
 */
function vervaldatumAanpassen(staat, invoer) {
  var u = uitleningVan(staat, invoer.uitlening_id);
  if (!u) return { ok: false, fout: 'Deze uitlening bestaat niet.' };
  if (!isLeeg(u.datum_terug)) return { ok: false, fout: 'Dit boek is al teruggebracht.' };
  var dagen = parseerGetal(invoer.dagen);
  if (dagen === null || dagen !== Math.round(dagen) || dagen === 0 || Math.abs(dagen) > 365) return { ok: false, fout: 'Vul een aantal dagen in, bv. 7 (of -7 om in te korten).' };
  var nieuw = telDagenOp(parseerDatum(u.vervaldatum), dagen);
  if (staat.inst.terugbrengdatum_op_openingsdag) nieuw = volgendeOpeningsdag(nieuw, staat.inst, true);
  if (nieuw <= parseerDatum(u.datum_uit)) return { ok: false, fout: 'De nieuwe datum valt voor of op de dag van de uitlening.' };
  var oud = parseerDatum(u.vervaldatum);
  wijzig(u, { vervaldatum: nieuw });
  staat.log.push(['vervaldatum aangepast', u.uitlening_id + ' ' + u.exemplaar + ': ' + oud + ' wordt ' + nieuw + ' (' + (dagen > 0 ? '+' : '') + dagen + ' dagen)']);
  return { ok: true, tekst: '"' + boekTitel(staat, u) + '" moet nu terug tegen ' + datumTekst(nieuw, staat.vandaag) + '.', vervaldatum: nieuw };
}

function verversMenu() {
  leegCache();
  meld('De publieke catalogus haalt bij de volgende opvraging alles vers op.');
}

/**
 * Zet de antwoorden van GoatCounter om naar wat het bestuursscherm toont.
 * antwoorden: { totaal, paginas, bronnen, toestellen, landen } met het JSON-antwoord (of null).
 * Per week bij een lange periode, anders per dag.
 */
function verwerkGoatcounter(antwoorden, dagen) {
  var t = antwoorden.totaal || {};
  var geschat = false;
  // Kwam het totaal niet binnen? Dan een schatting uit de meest bekeken pagina's (hun aantallen per dag).
  if (!antwoorden.totaal && antwoorden.paginas && antwoorden.paginas.hits) {
    geschat = true;
    var dagen0 = {};
    var som = 0;
    antwoorden.paginas.hits.forEach(function (h) {
      if (h.event) return;
      som += Number(h.count) || 0;
      (h.stats || []).forEach(function (s) { var d = String(s.day || ''); dagen0[d] = (dagen0[d] || 0) + (Number(s.daily) || 0); });
    });
    t = { total: som, stats: Object.keys(dagen0).map(function (d) { return { day: d, daily: dagen0[d] }; }) };
  }
  var perDag = (t.stats || []).map(function (s) { return { dag: String(s.day || ''), n: Number(s.daily) || 0 }; })
    .filter(function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(s.dag); })
    .sort(function (a, b) { return a.dag.localeCompare(b.dag); });
  var verloop = perDag;
  if (dagen > 60) {
    var perWeek = [];
    perDag.forEach(function (s, i) {
      if (i % 7 === 0) perWeek.push({ dag: s.dag, n: 0 });
      perWeek[perWeek.length - 1].n += s.n;
    });
    verloop = perWeek;
  }
  // Zonder naam: de id (schermgroottes), anders "(onbekend)". Regels met 0 vallen weg.
  var lijst = function (a, namen) {
    return ((a && a.stats) || []).map(function (s) {
      var id = schoon(s.id);
      return { naam: schoon(s.name) || (namen && namen[id]) || id || '(onbekend)', n: Number(s.count) || 0 };
    }).filter(function (s) { return s.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  };
  return {
    totaal: Number(t.total) || 0,
    geschat: geschat,
    perWeek: dagen > 60,
    verloop: verloop,
    paginas: ((antwoorden.paginas && antwoorden.paginas.hits) || []).filter(function (h) { return !h.event; }).map(function (h) {
      return { pad: String(h.path || ''), titel: schoon(h.title), n: Number(h.count) || 0 };
    }).sort(function (a, b) { return b.n - a.n; }),
    bronnen: lijst(antwoorden.bronnen),
    toestellen: lijst(antwoorden.toestellen, GC_TOESTELLEN),
    landen: lijst(antwoorden.landen)
  };
}

/**
 * Haalt uit het antwoord van Google Books (één "volumeInfo") de velden die nog leeg zijn.
 * Geeft een object veld -> waarde terug.
 */
function verwerkGoogleBooks(boek, info) {
  var v = {};
  if (!info) return v;
  var links = info.imageLinks || {};
  var cover = links.thumbnail || links.smallThumbnail;
  if (isLeeg(boek.cover_url) && cover) {
    // Altijd https, zonder het omgekrulde hoekje dat Google soms toevoegt.
    v.cover_url = String(cover).replace(/^http:/, 'https:').replace(/&edge=curl/, '');
  }
  if (isLeeg(boek.uitgeverij) && info.publisher) v.uitgeverij = schoon(info.publisher);
  if (isLeeg(boek.jaartal) && info.publishedDate) {
    var m = String(info.publishedDate).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && info.pageCount) v.paginas = Number(info.pageCount);
  if (isLeeg(boek.taal) && GB_TALEN[info.language]) v.taal = GB_TALEN[info.language];
  // Google heeft de omschrijving van het boek zelf: die vervangt ook een tekst van Wikipedia.
  var wiki = heeftWikiBeschrijving(boek);
  if ((isLeeg(boek.beschrijving) || wiki) && info.description) {
    var b = schoon(String(info.description).replace(/<[^>]*>/g, ' '));
    if (b) {
      v.beschrijving = maakBeschrijvingNetjes(b);
      if (wiki) { v.beschrijving_bron = ''; v.beschrijving_en = ''; v.beschrijving_vertaald = ''; }
    }
  }
  return v;
}

/**
 * Zet de ruwe waarden uit het tabblad om naar bruikbare instellingen.
 * ruw: object met sleutel -> waarde zoals in de spreadsheet.
 * Ontbrekende of onleesbare waarden krijgen de standaardwaarde.
 */
function verwerkInstellingen(ruw) {
  var inst = {};
  STANDAARD_INSTELLINGEN.forEach(function (rij) {
    var sleutel = rij[0];
    var standaard = rij[1];
    var waarde = ruw.hasOwnProperty(sleutel) && !isLeeg(ruw[sleutel]) ? ruw[sleutel] : standaard;
    if (typeof standaard === 'number') {
      var getal = parseerGetal(waarde);
      inst[sleutel] = getal === null ? standaard : getal;
    } else if (standaard === 'ja' || standaard === 'nee') {
      inst[sleutel] = (jaNee(waarde) || standaard) === 'ja';
    } else {
      // Teksten, adres en openingsuren mogen meerdere regels hebben.
      var meerdereRegels = sleutel.indexOf('tekst_') === 0 || ['adres', 'openingsuren', 'openingsuren_en'].indexOf(sleutel) > -1;
      inst[sleutel] = isDatumObject(waarde) ? parseerDatum(waarde) : (meerdereRegels ? String(waarde).trim() : schoon(waarde));
    }
  });
  inst.openingsdagen = weekdagNummers(inst.openingsdagen);
  inst.borg_betaalwijzen = splitsLijst(inst.borg_betaalwijzen);
  inst.gesloten_data = splitsLijst(inst.gesloten_data).map(parseerDatum).filter(function (d) { return d; });
  // Een enkele datum als Date-object in de cel.
  if (isDatumObject(ruw.gesloten_data)) inst.gesloten_data = [parseerDatum(ruw.gesloten_data)];
  // Eigen thema's: gelden meteen voor filtergroepenVan (Catalogus.js).
  EIGEN_THEMAS = splitsLijst(inst.eigen_themas);
  return inst;
}

/**
 * Menu: verwerkt boeken die je met de hand onderaan de Catalogus toevoegde.
 * Geeft ze een boek-ID, maakt het ISBN en de taal netjes, en vult aan uit
 * Goodreads (als dat tabblad bestaat) en Open Library.
 */
function verwerkNieuweBoeken() {
  var aantal = geefNieuweBoekenEenId();
  werkOnderwerpenBij();
  leegCache();
  if (spreadsheet().getSheetByName('Goodreads-export')) vulAanUitGoodreads(true);
  meld(aantal + ' nieuwe boeken kregen een boek-ID. Open Library vult nu de rest aan.');
  vulAanUitOpenLibrary();
}

/**
 * Elk uur vanzelf (zie Madrigal > Installeer tabbladen): een boek dat je met de hand in de
 * Catalogus typte, krijgt een boek-ID en verschijnt zo op de website en in Nieuw binnen.
 */
function verwerkNieuweBoekenAutomatisch() {
  // Elk uur ook even kijken of het kopiëren van de oude covers niet stilviel (zie OudeBoeken.js).
  try { waakOverOudeCovers(); } catch (e) { /* volgend uur opnieuw */ }
  // Nieuwe covers van een andere site (Google Books, Open Library, ...): een kopie naar Google Drive (CoversBewaren.js).
  try { waakOverCoversBewaren(); } catch (e) { /* volgend uur opnieuw */ }
  // Eén keer per dag: thema's, categorieën en trefwoorden op titel en beschrijving (Indelen.js).
  // Eén keer na een nieuwe indeling: de tabbladen op hun plaats (Ordenen.js).
  try { ordenTabbladenEenmalig(); } catch (e) { logboek('systeem', 'tabbladen', 'Fout: ' + e.message); }
  // Eén keer na nieuwe thema's: dubbels uit categorieën en trefwoorden naar de thema's (OudeBoeken.js).
  try { themasOpnieuwIndelenEenmalig(); } catch (e) { logboek('systeem', 'thema\'s', 'Fout: ' + e.message); }
  // Eén keer: Graphic novel weg bij boeken die het enkel door het woord "graphic" kregen (OnderwerpRaden.js).
  try { graphicNovelHerstellenEenmalig(); } catch (e) { logboek('systeem', 'graphicNovelHerstellen', 'Fout: ' + e.message); }
  // De ISBN-10 bij elk ISBN dat met 978 begint (Beschrijvingen.js).
  try { isbn10AanvullenAutomatisch(); } catch (e) { logboek('systeem', 'isbn10', 'Fout: ' + e.message); }
  // Eén keer per dag: elke auteur als "Achternaam, Voornaam" (Auteurs.js).
  try { auteursOpkuisenAutomatisch(); } catch (e) { logboek('systeem', 'auteursOpkuisen', 'Fout: ' + e.message); }
  // Gekozen namen en pseudoniemen van auteurs (Auteursnamen.js).
  try { auteursnamenAutomatisch(); } catch (e) { logboek('systeem', 'auteursnamen', 'Fout: ' + e.message); }
  // Nieuwe of betere gegevens (ISBN, titel, auteur): opnieuw zoeken naar een cover en een beschrijving (ZoekOpnieuw.js).
  try { zoekOpnieuwAutomatisch(); } catch (e) { logboek('systeem', 'zoekOpnieuw', 'Fout: ' + e.message); }
  try { deelBoekenInAutomatisch(); } catch (e) { logboek('systeem', 'deelBoekenIn', 'Fout: ' + e.message); }
  var aantal = geefNieuweBoekenEenId();
  if (!aantal) return;
  werkOnderwerpenBij();
  leegCache();
  logboek('systeem', 'nieuwe boeken', aantal + ' boeken kregen vanzelf een boek-ID');
}

/**
 * Haalt uit het antwoord van Open Library (jscmd=details) de velden die nog leeg zijn.
 * details: het "details"-object van één ISBN.
 * Geeft een object veld -> waarde terug (enkel voor lege velden).
 */
function verwerkOpenLibrary(boek, details) {
  var v = {};
  if (!details) return v;
  if (isLeeg(boek.uitgeverij) && details.publishers && details.publishers.length) v.uitgeverij = schoon(details.publishers[0]);
  if (isLeeg(boek.jaartal) && details.publish_date) {
    var m = String(details.publish_date).match(/\d{4}/);
    if (m) v.jaartal = Number(m[0]);
  }
  if (isLeeg(boek.paginas) && details.number_of_pages) v.paginas = Number(details.number_of_pages);
  if (isLeeg(boek.taal) && details.languages && details.languages.length) {
    var code = String(details.languages[0].key || '').split('/').pop();
    if (OL_TALEN[code]) v.taal = OL_TALEN[code];
  }
  if (isLeeg(boek.beschrijving) && details.description) {
    var b = typeof details.description === 'string' ? details.description : details.description.value;
    b = schoon(b);
    if (b) v.beschrijving = maakBeschrijvingNetjes(b);
  }
  if (isLeeg(boek.cover_url) && details.covers && details.covers.length && details.covers[0] > 0) {
    v.cover_url = 'https://covers.openlibrary.org/b/id/' + details.covers[0] + '-M.jpg';
  }
  return v;
}

/**
 * Een teruggebrachte uitlening uit het oude blad, voor de cijfers. Met de lener als ze binnen de
 * bewaartermijn terugkwam, anders zonder (zoals de privacy-opruiming het ook zou doen).
 */
function verwerkOudeTerug(staat, o, bron, teller, naTeKijken, gekozen) {
  if (!o.datum_uit) { teller.nietGevonden++; return; }
  // Koos het bestuur het boek zelf in Na te kijken (kolom boek_id)? Dan dat boek.
  var gevonden = gekozen && gekozen[bron] ? { zeker: boekVan(staat, gekozen[bron]) } : zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur, true);
  var boek = gevonden.zeker;
  if (!boek) {
    teller.nietGevonden++;
    naTeKijken.push({
      boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
      titel: o.boek, veld: 'historiek',
      waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
      waarde_bron: o.boek + ' / ' + o.auteur,
      opmerking: 'Teruggebracht, uitgeleend op ' + korteDatum(o.datum_uit) + '. Telt nog niet mee in de cijfers. Staat het boek in de Catalogus? Zet het juiste boek-ID in de kolom boek_id (één ID) en kies het menu-item opnieuw. Staat het er niet in? Zet afgehandeld op ja.',
      sleutel_extra: bron
    });
    return;
  }
  var d = oudeTerugDatums(o, staat.inst);
  var terug = d.terug, verval = d.verval;
  var grens = telMaandenOp(staat.vandaag, -staat.inst.bewaartermijn_afgesloten_uitleningen_maanden);
  var lener = terug >= grens && (o.email || o.telefoon || o.voornaam) ? oudeLener(staat, o, teller) : null;
  var borg = oudeBorgEnGift(o, staat.inst);
  voegToe(staat.uitleningen, {
    uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
    exemplaar: boek.boek_id + '-1', boek_id: boek.boek_id, lenersnummer: lener ? lener.lenersnummer : '',
    datum_uit: o.datum_uit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: terug,
    aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
    borg_terugbetaald: borg.bedrag > 0 ? terug : '', gift: borg.gift || '',
    laatste_herinnering: parseerDatum(o.herinnering) || '', vrijwilliger: 'overgezet', bron: bron
  });
  teller.historiek++;
}

/**
 * Verwerkt de oude rijen in de staat (zonder de spreadsheet aan te raken).
 * Geeft { uitleningen, historiek, nietGevonden, leners, naTeKijken } terug.
 */
function verwerkOudeUitleningen(staat, oudeRijen, gekozen) {
  var teller = { uitleningen: 0, historiek: 0, nietGevonden: 0, leners: 0, hersteld: 0 };
  var naTeKijken = [];
  var bekend = {};
  staat.uitleningen.forEach(function (u) { if (u.bron) bekend[u.bron] = u; });

  oudeRijen.forEach(function (o) {
    var bron = 'oud blad rij ' + o.rijnummer;
    if (bekend[bron]) {
      if (bekend[bron] !== true && herstelOudeTerug(bekend[bron], o, staat.inst)) teller.hersteld++;
      return;
    }
    if (!isLeeg(o.terug_op)) { verwerkOudeTerug(staat, o, bron, teller, naTeKijken, gekozen); bekend[bron] = true; return; }

    // 1. De lener: bestaat die al (zelfde e-mail of telefoon)?
    var lener = oudeLener(staat, o, teller);

    // 2. Het boek: zelf gekozen in Na te kijken (kolom boek_id), of gezocht op titel.
    var gevonden = gekozen && gekozen[bron] ? { zeker: boekVan(staat, gekozen[bron]) } : zoekBoekOpTitel(staat.catalogus, o.boek, o.auteur);
    var boek = gevonden.zeker;
    var exemplaar = '';
    if (boek) {
      exemplaar = exemplarenVan(boek).filter(function (ex) { return !uitleningVanExemplaar(staat, ex); })[0] || '';
    }
    var borg = oudeBorgEnGift(o, staat.inst);
    var context = 'Lener ' + lener.lenersnummer + ', geleend op ' + korteDatum(o.datum_uit) +
      ', terug tegen ' + korteDatum(o.datum_terug_afgesproken) + ', borg ' + bedragTekst(borg.bedrag) + (borg.betaalwijze ? ' (' + borg.betaalwijze + ')' : '') + '.';
    if (!boek || !exemplaar) {
      naTeKijken.push({
        boek_id: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.boek_id; }).join(', ') : '',
        titel: o.boek, veld: 'uitlening', waarde_catalogus: gevonden.twijfel ? gevonden.twijfel.map(function (b) { return b.titel + ' / ' + b.auteur; }).join(' | ') : '(geen boek gevonden)',
        waarde_bron: o.boek + ' / ' + o.auteur,
        opmerking: (boek ? 'Alle exemplaren staan al als uitgeleend. ' + context + ' Registreer deze uitlening zelf via het uitleenscherm.'
          : 'Het boek is niet zeker gevonden. ' + context + ' Zet het juiste boek-ID in de kolom boek_id (één ID) en kies het menu-item opnieuw, of registreer deze uitlening zelf via het uitleenscherm.'),
        sleutel_extra: bron
      });
      bekend[bron] = true;
      return;
    }

    // 3. De uitlening.
    var datumUit = o.datum_uit || staat.vandaag;
    var verval = o.datum_terug_afgesproken || berekenVervaldatum(datumUit, staat.inst);
    var gift = borg.gift;
    voegToe(staat.uitleningen, {
      uitlening_id: 'U' + metNullen(nieuwNummer(staat, 'uitlening', staat.uitleningen.map(function (x) { return x.uitlening_id; })), 5),
      exemplaar: exemplaar, boek_id: boek.boek_id, lenersnummer: lener.lenersnummer,
      datum_uit: datumUit, oorspronkelijke_vervaldatum: verval, vervaldatum: verval, datum_terug: '',
      aantal_verlengingen: 0, datum_verlenging: '', borg: borg.bedrag, betaalwijze_borg: borg.betaalwijze,
      borg_terugbetaald: '', gift: gift || '',
      laatste_herinnering: parseerDatum(o.herinnering) || schoon(o.herinnering),
      vrijwilliger: 'overgezet', bron: bron
    });
    bekend[bron] = true;
    teller.uitleningen++;
  });
  return { uitleningen: teller.uitleningen, historiek: teller.historiek, nietGevonden: teller.nietGevonden, leners: teller.leners, hersteld: teller.hersteld, naTeKijken: naTeKijken };
}

/**
 * Zet klaarliggende reservaties die niet op tijd afgehaald werden op "vervallen"
 * en geeft het exemplaar door aan de volgende. Geeft de meldingen terug.
 */
function verwerkVervallenReservaties(staat) {
  var meldingen = [];
  staat.reservaties.forEach(function (r) {
    if (r.status === STATUS_KLAAR && r.ophalen_tot && r.ophalen_tot < staat.vandaag) {
      wijzig(r, { status: STATUS_VERVALLEN, datum_afgesloten: staat.vandaag });
      staat.log.push(['reservatie vervallen', r.reservatie_id]);
      var m = geefExemplaarDoor(staat, r.boek_id, r.exemplaar);
      if (m) meldingen.push(m);
    }
  });
  return meldingen;
}

/* ---------- Acties ---------- */

/** Vervallen reservaties bijwerken zonder het publieke verzoek te laten mislukken. */
function verwerkVervallenReservatiesStil(staat) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return;
  try {
    verwerkVervallenReservaties(staat);
    bewaarStaat(staat);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menu: zoekt in de map met covers de afbeeldingen die bij drie of meer boeken exact dezelfde zijn (zoals het
 * plaatje van LibraryThing), wist die covers in de Catalogus en zet de bestanden in de prullenbak van Drive.
 * Eerst op grootte (snel), enkel bij gelijke grootte de inhoud vergelijken.
 */
function verwijderStandaardCovers() {
  var start = Date.now();
  var naam = leesInstellingen().cover_map || 'Project Madrigal covers';
  var mappen = DriveApp.getFoldersByName(naam);
  if (!mappen.hasNext()) { meld('De map ' + naam + ' staat niet op Google Drive.'); return; }
  var perGrootte = {};
  var it = mappen.next().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var g = f.getSize();
    (perGrootte[g] = perGrootte[g] || []).push(f);
  }
  var bestanden = [], afgebroken = false;
  Object.keys(perGrootte).forEach(function (g) {
    if (perGrootte[g].length < STANDAARD_MIN || afgebroken) return;
    perGrootte[g].forEach(function (f) {
      if (afgebroken) return;
      if (Date.now() - start > 4 * 60 * 1000) { afgebroken = true; return; }
      bestanden.push({ id: f.getId(), hash: bytesHash(f.getBlob().getBytes()), bestand: f });
    });
  });
  var st = standaardBestanden(bestanden);
  // Onthouden, zodat het kopiëren van de oude covers ze voortaan overslaat.
  var bekend = [];
  try { bekend = JSON.parse(PropertiesService.getScriptProperties().getProperty(STANDAARD_HASHES_SLEUTEL) || '[]'); } catch (e) { bekend = []; }
  st.hashes.forEach(function (h) { if (bekend.indexOf(h) === -1) bekend.push(h); });
  PropertiesService.getScriptProperties().setProperty(STANDAARD_HASHES_SLEUTEL, JSON.stringify(bekend));
  // bewaarAchtergrond neemt zelf het slot en schrijft enkel de gewiste velden.
  var tabel = leesTabel('Catalogus');
  var gewist = wisStandaardCovers(tabel.rijen, st.ids);
  if (gewist.length && !bewaarAchtergrond(tabel)) { meld('Het is even druk in de spreadsheet. Probeer het over een minuut opnieuw.'); return; }
  var weg = 0;
  bestanden.forEach(function (b) { if (st.ids[b.id]) { try { b.bestand.setTrashed(true); weg++; } catch (e) { /* niet erg */ } } });
  if (gewist.length) {
    leegCache();
    // De zoektochten naar een echte cover, na elkaar.
    planTaak('vulAanUitGoogleBooks', 60 * 1000);
    planTaak('zoekCoversBol', 10 * 60 * 1000);
    planTaak('zoekCoversInternetArchive', 20 * 60 * 1000);
  }
  var tekst = gewist.length + ' boeken hadden een standaardafbeelding als cover (zoals het plaatje van LibraryThing). Die cover is weg, de zoektochten zoeken nu een echte cover. ' +
    weg + ' bestanden staan in de prullenbak van Google Drive.' + (afgebroken ? ' Nog niet alles bekeken: kies dit menu nog een keer.' : '');
  logboek('menu', 'verwijderStandaardCovers', tekst + (gewist.length ? ' Boeken: ' + gewist.join(', ') : ''));
  meld(tekst);
}

/** Verwijdert geplande uitvoeringen van een functie. */
function verwijderTriggers(functienaam) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === functienaam) ScriptApp.deleteTrigger(t);
  });
}

/** Zoekt het adres en de publieke sleutel van de databank in de code van de oude website. */
function vindOudeDatabank() {
  var html = UrlFetchApp.fetch(OUDE_SITE).getContentText();
  var main = (html.match(/main\.[a-f0-9]+\.js/) || [])[0];
  if (!main) throw new Error('Ik vond de code van de oude website niet.');
  var code = UrlFetchApp.fetch(OUDE_SITE + main).getContentText();
  var url = (code.match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
  var sleutel = (code.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/) || [])[0];
  if (!url || !sleutel) throw new Error('Ik vond het adres van de oude databank niet.');
  return { url: url, sleutel: sleutel };
}

/** Een korte vingerafdruk van een rij: zo merken we het als iemand ze intussen in de spreadsheet aanpaste. */
function vingerafdruk(rij, kolommen) {
  var tekst = kolommen.map(function (k) { return String(isLeeg(rij[k]) ? '' : rij[k]); }).join('\u0001');
  var h = 5381;
  for (var i = 0; i < tekst.length; i++) h = ((h * 33) ^ tekst.charCodeAt(i)) >>> 0;
  return String(h);
}

function voegBronSamen(bestaand, bron, nieuwId, inst, vandaag) {
  // Bij de eerste opbouw is niets "nieuw binnen". Daarna krijgt een nieuw boek de datum van vandaag.
  var datumNieuw = bestaand.length && vandaag ? vandaag : '';
  // 1. Dubbele rijen in de bron samenvoegen: aantallen optellen, herkomst bundelen.
  var perSleutel = {};
  var volgorde = [];
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (!perSleutel[s]) { perSleutel[s] = b; volgorde.push(s); return; }
    var eerste = perSleutel[s];
    eerste.aantal += b.aantal;
    if (b.herkomst && eerste.herkomst.indexOf(b.herkomst) === -1) {
      eerste.herkomst = eerste.herkomst ? eerste.herkomst + ' | ' + b.herkomst : b.herkomst;
    }
    Object.keys(b).forEach(function (k) { if (isLeeg(eerste[k]) && !isLeeg(b[k])) eerste[k] = b[k]; });
  });

  // 2. Bestaande rijen opzoeken op hun bronsleutel.
  var index = {};
  bestaand.forEach(function (rij) { if (rij.bron_sleutel) index[rij.bron_sleutel] = rij; });

  var teller = { nieuw: 0, aangevuld: 0 };
  var kennis = null; // voornamen en achternamen uit de Catalogus (Auteurs.js), pas opgebouwd bij het eerste nieuwe boek
  volgorde.forEach(function (s) {
    var b = perSleutel[s];
    var rij = index[s];
    if (rij) {
      // Enkel lege velden aanvullen. Wat iemand met de hand invulde, blijft.
      var velden = {};
      ['titel', 'auteur', 'isbn', 'uitgeverij', 'jaartal', 'taal', 'paginas', 'uitvoering', 'nieuwstaat', 'genre', 'herkomst', 'isbn_origineel'].forEach(function (k) {
        if (isLeeg(rij[k]) && !isLeeg(b[k])) velden[k] = b[k];
      });
      // De aanrader: enkel de toegelaten namen (zie toegelatenStockAanrader).
      var aanrader = toegelatenStockAanrader(b.aanrader, inst);
      if (isLeeg(rij.aanrader) && aanrader) velden.aanrader = aanrader;
      if (isLeeg(rij.aantal)) velden.aantal = b.aantal;
      if (Object.keys(velden).length) { wijzig(rij, velden); teller.aangevuld++; }
      return;
    }
    var teKoop = b.soort === 'zine' && normaliseerTekst(b.genre) === 'verkoop';
    var nieuweRij = {
      boek_id: nieuwId(b.soort),
      soort: b.soort,
      titel: b.titel, auteur: auteurNetjes(b.auteur, kennis || (kennis = auteurKennis(bestaand))), isbn: b.isbn, uitgeverij: b.uitgeverij, jaartal: b.jaartal,
      taal: b.taal, paginas: b.paginas, uitvoering: b.uitvoering, nieuwstaat: b.nieuwstaat,
      aanrader: toegelatenStockAanrader(b.aanrader, inst), genre: b.genre, extra_onderwerpen: '', klassieker: '',
      aantal: b.aantal,
      uitleenbaar: teKoop && !inst.zines_te_koop_uitleenbaar ? 'nee' : 'ja',
      publiek: nietPubliekVolgensHerkomst(b.herkomst) ? 'nee' : 'ja',
      beschrijving: '', cover_url: '', startpagina: '', toegevoegd_op: datumNieuw,
      herkomst: b.herkomst, isbn_origineel: b.isbn_origineel, bron_sleutel: s, ol_gecontroleerd: ''
    };
    voegToe(bestaand, nieuweRij);
    index[s] = nieuweRij;
    teller.nieuw++;
  });
  return teller;
}

/**
 * Zet nieuwe films in de Catalogus. Een film die er al staat (zelfde letterboxd, of zelfde titel
 * en jaartal), komt er niet nog eens bij. nieuwId(soort) geeft een nieuw nummer.
 * Geeft het aantal nieuwe films.
 */
function voegFilmsToe(rijen, films, vandaag, nieuwId) {
  var sleutels = {};
  var sleutel = function (titel, jaar) { return normaliseerTekst(titel) + '|' + (jaar || ''); };
  rijen.forEach(function (r) {
    if (!isFilm(r)) return;
    if (!isLeeg(r.letterboxd)) sleutels['lb:' + schoon(r.letterboxd)] = true;
    if (!isLeeg(r.imdb)) sleutels['im:' + schoon(r.imdb)] = true;
    sleutels[sleutel(r.titel, parseerGetal(r.jaartal))] = true;
  });
  var n = 0;
  films.forEach(function (f) {
    if (!f.slug && !f.titel) return;
    if ((f.slug && sleutels['lb:' + f.slug]) || (f.imdb && sleutels['im:' + f.imdb]) || sleutels[sleutel(f.titel, f.jaar)]) return;
    var rij = {
      boek_id: nieuwId('film'), soort: 'film', titel: schoon(f.titel), jaartal: f.jaar || '',
      letterboxd: f.slug || '', imdb: f.imdb || '', auteur: f.regie || '', genre: f.genre || '', duur: f.duur || '', originele_titel: f.origineel || '',
      aantal: 1, uitleenbaar: 'ja', publiek: 'ja', uitvoering: 'dvd', toegevoegd_op: vandaag
    };
    rij.bron_sleutel = bronSleutel(rij);
    voegToe(rijen, rij);
    if (f.slug) sleutels['lb:' + f.slug] = true;
    if (f.imdb) sleutels['im:' + f.imdb] = true;
    sleutels[sleutel(f.titel, f.jaar)] = true;
    n++;
  });
  return n;
}

/* ---------- Een export van IMDb of Letterboxd (CSV in een tabblad) ---------- */

/** Voegt namen toe aan een lijst met komma's, zonder dubbels. Geeft de nieuwe tekst. */
function voegLijstToe(bestaand, namen) {
  var lijst = splitsLijst(bestaand), bekend = {};
  lijst.forEach(function (n) { bekend[normaliseerTekst(n)] = true; });
  namen.forEach(function (n) {
    var k = normaliseerTekst(n);
    if (!k || bekend[k]) return;
    bekend[k] = true;
    lijst.push(n);
  });
  return lijst.join(', ');
}

/**
 * Voegt twijfelgevallen toe aan het tabblad "Na te kijken", zonder dubbels.
 * rijen: rijen van "Na te kijken"; items: [{boek, veld, waarde_catalogus, waarde_bron, opmerking}]
 */
function voegNaTeKijkenToe(rijen, items, bron, vandaag) {
  var bekend = {};
  rijen.forEach(function (r) { bekend[r.sleutel] = true; });
  var nieuw = 0;
  items.forEach(function (item) {
    var sleutel = bron + '|' + (item.boek ? item.boek.boek_id : item.boek_id) + '|' + item.veld + '|' + normaliseerTekst(item.waarde_bron);
    if (bekend[sleutel]) return;
    bekend[sleutel] = true;
    voegToe(rijen, {
      datum: vandaag, bron: bron,
      boek_id: item.boek ? item.boek.boek_id : (item.boek_id || ''),
      titel: item.boek ? item.boek.titel : (item.titel || ''),
      veld: item.veld, waarde_catalogus: item.waarde_catalogus, waarde_bron: item.waarde_bron,
      opmerking: item.opmerking, afgehandeld: 'nee', sleutel: sleutel
    });
    nieuw++;
  });
  return nieuw;
}

/** Voegt rijen toe die er nog niet zijn (op bron_id). Geeft het aantal nieuwe terug. */
function voegOudeRijenToe(bestaande, nieuwe) {
  var bekend = {};
  bestaande.forEach(function (r) { if (r.bron_id) bekend[r.bron_id] = true; });
  var n = 0;
  nieuwe.forEach(function (r) {
    if (bekend[r.bron_id]) return;
    voegToe(bestaande, r);
    bekend[r.bron_id] = true;
    n++;
  });
  return n;
}

/** Voegt shifts toe aan het tabblad Shifts, zonder dubbels. Geeft het aantal nieuwe. */
function voegShiftsToe(rijen, shifts) {
  var gezien = {};
  var sleutel = function (s) { return parseerDatum(s.datum) + '|' + s.rol + '|' + normaliseerTekst(s.naam); };
  rijen.forEach(function (r) { gezien[sleutel(r)] = true; });
  var n = 0;
  shifts.forEach(function (s) {
    if (gezien[sleutel(s)]) return;
    gezien[sleutel(s)] = true;
    voegToe(rijen, { datum: s.datum, rol: s.rol, naam: s.naam, event: s.event || '' });
    n++;
  });
  return n;
}

/** Voegt een nieuwe rij toe aan een lijst en markeert ze als nieuw. */
function voegToe(lijst, obj) {
  obj._nieuw = true;
  lijst.push(obj);
  return obj;
}

/**
 * Zet de aangepaste velden van oude rijen over naar vers ingelezen rijen. Herkenning op boek_id,
 * anders op rijnummer met dezelfde titel. Een rij die intussen weg is, slaan we over.
 */
function voegVeldenSamen(gewijzigd, versRijen) {
  var perId = {}, perRij = {};
  versRijen.forEach(function (r) {
    if (!isLeeg(r.boek_id)) perId[String(r.boek_id)] = r;
    perRij[r._rij] = r;
  });
  gewijzigd.forEach(function (oud) {
    var doel = !isLeeg(oud.boek_id) ? perId[String(oud.boek_id)] : perRij[oud._rij];
    if (doel && isLeeg(oud.boek_id) && schoon(doel.titel) !== schoon(oud.titel)) doel = null;
    if (doel) {
      var velden = {};
      Object.keys(oud._velden || {}).forEach(function (k) { velden[k] = oud[k]; });
      wijzig(doel, velden);
    }
    oud._gewijzigd = false;
    oud._velden = {};
  });
}

/** Voert een actie uit. Wijzigende acties gebeuren onder een slot, zodat twee balies elkaar niet storen. */
function voerActieUit(actie, invoer, rol) {
  if (actie === 'aanmelden') return { ok: true, rol: rol };
  if (actie === 'roosterOverzicht') return roosterOverzicht(); // leest enkel, geen slot nodig
  if (actie === 'beheerIsbnOpzoeken') return isbnOpzoeken(invoer); // leest enkel bij Open Library en Google Books
  if (actie === 'beheerInhoud') return beheerInhoudGegevens(rol);
  if (actie === 'bezoekersCijfers') return bezoekersCijfers(invoer); // leest enkel bij GoatCounter
  if (actie === 'beheerLogboek') return logboekEnTaken(); // leest enkel, geen slot nodig
  if (actie === 'beheerCoverLinks') return coverLinks(leesTabel('Catalogus').rijen); // leest enkel
  if (actie === 'beheerTekstUitFoto') return tekstUitFoto(invoer, ocrViaDrive); // leest enkel, geen slot nodig
  if (actie === 'titelcontroleMaken') return maakTitelcontroleLijst(); // leest de oude website, neemt zelf het slot om te schrijven
  if (actie === 'aankoopLezen') return aankoopLezen(invoer); // leest wat de bladwijzer kopieerde, of zoekt ISBN's op bij Google Books: zonder slot

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, fout: 'Het is even druk. Probeer het over een paar seconden opnieuw.' };
  try {
    var wie = tekstInvoer(invoer.wie, 40) || 'onbekend';
    if (actie === 'aanvraagAfhandelen') return beheerAanvraagAfhandelen(invoer, wie);
    if (actie === 'meldingMaken' || actie === 'meldingAfhandelen') return meldingActie(actie, invoer, wie);
    if (actie === 'briefjeMaken' || actie === 'briefjeWeg') return briefjeActie(actie, invoer, wie);
    if (/^aankoop/.test(actie)) return aankoopActie(actie, invoer, wie, rol);
    if (/^titelcontrole/.test(actie)) return titelcontroleActie(actie, invoer, wie);
    if (['verkoopData', 'standjeBewaren', 'standjeBoekZetten', 'verkopenDoorsturen', 'standjeStatus', 'voorraadCatalogus', 'voorraadZetten', 'voorraadNieuwBoek'].indexOf(actie) > -1) {
      var verkoop = verkoopActie(actie, invoer, wie);
      if (verkoop.ok && ((actie === 'verkopenDoorsturen' && verkoop.nieuw) || actie === 'voorraadZetten' || actie === 'voorraadNieuwBoek')) leegCache();
      return verkoop;
    }
    if (actie === 'beheerInhoudBewaren' || actie === 'beheerInstellingBewaren') {
      var gewijzigd = actie === 'beheerInhoudBewaren' ? beheerInhoudBewaren(invoer, wie, rol) : beheerInstellingBewaren(invoer, wie);
      if (gewijzigd.ok) leegCache();
      return gewijzigd;
    }
    var staat = laadStaat(invoer.wie, actie === 'bestuurData');
    var meldingen = verwerkVervallenReservaties(staat);
    var antwoord;
    switch (actie) {
      case 'balieData':
        antwoord = { ok: true, data: balieGegevens(staat) };
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        break;
      case 'bestuurData':
        staat.categorieenTab = categorieenTabRijen();
        antwoord = { ok: true, data: bestuurGegevens(staat, leesTabel('Onderwerpen').rijen) };
        antwoord.data.aanvragen = openAanvragen(spreadsheet().getSheetByName('Aanvragen') ? leesTabel('Aanvragen').rijen : []);
        antwoord.data.onlineReserveren = staat.inst.online_reserveren === true;
        antwoord.data.voorstellen = telVoorstellen();
        antwoord.data.beschrijvingVoorstellen = openVoorstellen(tabelOfLeeg('Voorstellen') ? leesTabel('Voorstellen').rijen : []);
        antwoord.data.meldingen = openMeldingen(tabelOfLeeg('Meldingen') ? leesTabel('Meldingen').rijen : []);
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        antwoord.data.briefjes = openBriefjes(tabelOfLeeg('Briefjes') ? leesTabel('Briefjes').rijen : [], staat.vandaag);
        antwoord.data.vandaagTerug = vandaagTerug(staat, vertaalTabel(leesTabel('Onderwerpen').rijen));
        antwoord.data.teVervangen = teVervangen(staat, true);
        antwoord.data.titelcontrole = titelcontroleAantal((tabelOfLeeg(TITELCONTROLE_TABBLAD) || {}).rijen);
        break;
      case 'vrijwilligerData':
        var onderwerpRijen = leesTabel('Onderwerpen').rijen;
        var voorstelRijen = tabelOfLeeg('Voorstellen') ? leesTabel('Voorstellen').rijen : [];
        antwoord = { ok: true, data: vrijwilligerGegevens(staat, onderwerpRijen) };
        antwoord.data.voorgesteld = voorgesteldeBoeken(voorstelRijen);
        antwoord.data.checklist = shiftChecklist(staat.inst);
        antwoord.data.handleiding = handleiding(staat.inst);
        antwoord.data.briefjes = openBriefjes(tabelOfLeeg('Briefjes') ? leesTabel('Briefjes').rijen : [], staat.vandaag);
        antwoord.data.vandaagTerug = vandaagTerug(staat, vertaalTabel(onderwerpRijen));
        antwoord.data.teVervangen = teVervangen(staat, false);
        antwoord.data.titelcontrole = titelcontroleAantal((tabelOfLeeg(TITELCONTROLE_TABBLAD) || {}).rijen);
        antwoord.data.mijn = mijnBijdragen(voorstelRijen, tabelOfLeeg('Meldingen') ? leesTabel('Meldingen').rijen : [], staat.wie, staat.vandaag);
        break;
      case 'voorstelBeschrijving':
      case 'voorstelBehandelen': antwoord = voorstelActie(staat, actie, invoer); break;
      case 'uitlenen': antwoord = uitlenen(staat, invoer); break;
      case 'terugbrengen': antwoord = terugbrengen(staat, { uitlening_id: invoer.uitlening_id, borg_terugbetaald: invoer.borg_terugbetaald === true, staat_boek: invoer.staat_boek, opmerking: invoer.opmerking }); break;
      case 'verlengen': antwoord = verlengen(staat, invoer); break;
      case 'vervaldatumAanpassen': antwoord = vervaldatumAanpassen(staat, invoer); break;
      case 'boekVerloren': antwoord = boekVerloren(staat, invoer); break;
      case 'boekVervangen': antwoord = boekVervangen(staat, invoer); break;
      case 'annuleerUitlening': antwoord = annuleerUitlening(staat, invoer, rol === 'bestuur'); break;
      case 'annuleerVerlenging': antwoord = annuleerVerlenging(staat, invoer); break;
      case 'reserveren': antwoord = reserveren(staat, invoer); break;
      case 'annuleerReservatie': antwoord = annuleerReservatie(staat, invoer); break;
      case 'nieuweLener': antwoord = nieuweLener(staat, { voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, toestemming: invoer.toestemming === true }); break;
      case 'borgTerugbetaald': antwoord = borgTerugbetaald(staat, invoer); break;
      case 'herinneringVerstuurd': antwoord = herinneringVerstuurd(staat, invoer); break;
      case 'beheerBoekOphalen':
        staat.categorieenTab = categorieenTabRijen();
        antwoord = boekOphalen(staat, invoer);
        if (antwoord.ok) {
          antwoord.historiek = boekHistoriek(staat, invoer.boek_id);
          var logBlad = spreadsheet().getSheetByName('Logboek');
          antwoord.wijzigingen = logBlad && logBlad.getLastRow() > 1 ? boekWijzigingen(logBlad.getDataRange().getValues(), invoer.boek_id) : [];
        }
        break;
      case 'beheerLenerHistoriek': antwoord = lenerHistoriek(staat, invoer.lenersnummer); break;
      case 'beheerBoekenBulk': antwoord = boekenBulk(staat, invoer); break;
      case 'filmsVoorbeeld':
        var fc = bouwPubliekeCatalogus(staat, leesTabel('Onderwerpen').rijen, [], { enkelFilms: true });
        antwoord = { ok: true, boeken: fc.boeken, teksten: fc.teksten, filmsTonen: staat.inst.films_tonen === true };
        break;
      case 'bestuurCijfers':
        antwoord = { ok: true, cijfers: bestuurCijfers(staat, leesTabel('Onderwerpen').rijen) };
        antwoord.cijfers.shifts = shiftCijfers(spreadsheet().getSheetByName('Shifts') ? leesTabel('Shifts').rijen : [], staat.vandaag.slice(0, 4));
        break;
      case 'beheerCoversLijst': antwoord = coversTeZoeken(staat, rol === 'bestuur'); break;
      case 'beheerCoversBewaren': antwoord = coversBewaren(staat, invoer); break;
      case 'beheerIaCovers': antwoord = iaCoversLijst(staat); break;
      case 'beheerIaCoversWissen': antwoord = iaCoversWissen(staat, invoer); break;
      case 'beheerCoverUpload': antwoord = coverUploaden(staat, invoer, bewaarFotoInDrive); break;
      case 'beheerCoverVanLink': antwoord = coverVanLink(staat, invoer, haalCoverLink, bewaarFotoInDrive); break;
      case 'beheerBoekBewaren': antwoord = boekAanpassen(staat, invoer); break;
      case 'beheerLeeslijstBoeken': antwoord = leeslijstBoeken(staat, invoer); break;
      case 'beheerBoekToevoegen':
        var ids = maakIdGenerator(staat.catalogus);
        antwoord = boekToevoegen(staat, invoer, ids.nieuw);
        if (antwoord.ok) ids.bewaar();
        break;
      case 'lenerAanpassen':
        var lenerInvoer = { lenersnummer: invoer.lenersnummer, voornaam: invoer.voornaam, achternaam: invoer.achternaam, telefoon: invoer.telefoon, email: invoer.email, actief: invoer.actief !== false };
        if (invoer.hasOwnProperty('notitie')) lenerInvoer.notitie = invoer.notitie;
        if (invoer.hasOwnProperty('markering')) lenerInvoer.markering = invoer.markering;
        antwoord = lenerAanpassen(staat, lenerInvoer);
        break;
    }
    // Ook bij een geweigerde actie bewaren we vervallen reservaties.
    bewaarStaat(staat);
    if (staat.vertalingNodig) {
      try { planVertaling(2); } catch (e) { /* lukt het niet, dan vertaalt het menu later */ }
    }
    if (staat.catalogusGewijzigd) {
      bewaarTabel(staat.tabellen.Catalogus);
      werkOnderwerpenBij(); // een nieuw genre komt zo in de vertaaltabel Onderwerpen
    }
    if (meldingen.length || (antwoord.ok && actie !== 'balieData' && actie !== 'bestuurData' && actie !== 'filmsVoorbeeld')) leegCache();
    if (meldingen.length && antwoord.ok) antwoord.apartLeggen = (antwoord.apartLeggen || []).concat(meldingen);
    return antwoord;
  } finally {
    lock.releaseLock();
  }
}

/**
 * De eerstvolgende openingsdag vanaf een datum.
 * inclusief = true: de datum zelf telt mee als die een openingsdag is.
 */
function volgendeOpeningsdag(datum, inst, inclusief) {
  if (!inst.openingsdagen.length) return datum;
  var d = inclusief ? datum : telDagenOp(datum, 1);
  // Veiligheidsgrens: hoogstens een jaar vooruit zoeken.
  for (var i = 0; i < 366; i++) {
    if (isOpeningsdag(d, inst)) return d;
    d = telDagenOp(d, 1);
  }
  return datum;
}

/**
 * Geeft een nieuw, uniek volgnummer. Het laatste nummer staat in de
 * scripteigenschappen, zodat een gewist nummer nooit opnieuw gebruikt wordt.
 * bestaande: lijst met bestaande waarden, om bij de eerste keer verder te tellen.
 */
function volgendNummer(sleutel, bestaande) {
  var props = PropertiesService.getScriptProperties();
  var laatste = Number(props.getProperty('teller_' + sleutel) || 0);
  bestaande.forEach(function (w) {
    var n = Number(String(w).replace(/\D/g, ''));
    if (n > laatste) laatste = n;
  });
  laatste += 1;
  props.setProperty('teller_' + sleutel, String(laatste));
  return laatste;
}

/** De boeken waarvoor al een voorstel klaarligt: die toont het vrijwilligersscherm apart. */
function voorgesteldeBoeken(rijen) {
  return openVoorstellen(rijen).map(function (v) { return v.boek_id; });
}

/** "Voornaam (tussenvoegsels) Achternaam" wordt "Achternaam, Voornaam tussenvoegsels". */
function voornaamVooraanOmdraaien(woorden) {
  woorden = woorden.slice();
  var achter = '';
  if (woorden.length > 2 && AUTEUR_ACHTERVOEGSEL.test(woorden[woorden.length - 1])) achter = ', ' + woorden.pop();
  var achternaam = woorden.pop();
  var tussen = [];
  while (woorden.length > 1 && CONTROLE_TUSSENVOEGSELS.indexOf(woorden[woorden.length - 1].toLowerCase()) > -1) tussen.unshift(woorden.pop());
  return achternaam + ', ' + woorden.concat(tussen).join(' ') + achter;
}

/** Menu: Madrigal > Verkoop > Werk de voorraad bij. */
function voorraadBijwerkenMenu() {
  // Stond er datumopmaak op prijs (7,50 werd 6/1/1900)? Dan eerst terug een getal maken.
  zetGetalopmaak(spreadsheet().getSheetByName('Catalogus'), ['te_koop_aantal']);
  zetGetalopmaak(spreadsheet().getSheetByName('Catalogus'), ['prijs'], '0.00');
  var verkopen = spreadsheet().getSheetByName('Verkopen') ? leesTabel('Verkopen').rijen : [];
  var v = schrijfVoorraad(leesTabel('Catalogus').rijen, verkopen);
  meld('De Voorraad is bijgewerkt: ' + v.rijen.length + ' boeken, ' + v.totaal[0] + ' exemplaren te koop.');
}

/**
 * Wijzig je in de Catalogus het aantal te koop, de prijs of onderhandelbaar, dan volgt de Voorraad vanzelf.
 * Wordt opgeroepen door bijWijziging (Menu.js), bij elke wijziging die iemand met de hand maakt.
 */
function voorraadBijWijziging(e) {
  try {
    var blad = e.range.getSheet();
    if (blad.getName() !== 'Catalogus' || e.range.getRow() === 1) return;
    var kop = blad.getRange(1, e.range.getColumn(), 1, e.range.getNumColumns()).getValues()[0].map(schoon);
    if (!kop.some(function (k) { return VOORRAAD_BRON.indexOf(k) > -1; })) return;
    var verkopen = spreadsheet().getSheetByName('Verkopen') ? leesTabel('Verkopen').rijen : [];
    schrijfVoorraad(leesTabel('Catalogus').rijen, verkopen);
  } catch (err) {
    // Een fout hier mag het bewerken van de Catalogus nooit hinderen. Madrigal > Verkoop > Werk de voorraad bij lost het op.
  }
}

/* ---------- In Apps Script ---------- */

/** Alle boeken uit de Catalogus, om er een te kiezen en aan de voorraad toe te voegen. Geen films. */
function voorraadCatalogus(catalogus) {
  return catalogus.filter(function (b) { return !isLeeg(b.boek_id) && !isLeeg(b.titel) && !isFilm(b); }).map(function (b) {
    return { id: String(b.boek_id), t: schoon(b.titel), a: schoon(b.auteur), i: String(b.isbn || ''), stock: stockVan(b), prijs: verkoopGetal(b.prijs), o: jaNee(b.onderhandelbaar) === 'ja' };
  }).sort(function (a, b) { return a.t.localeCompare(b.t); });
}

/**
 * Een boek aan de voorraad toevoegen vanuit het verkoopscherm, ook een boek dat nog niet in de Catalogus staat.
 * invoer: { titel, auteur, isbn, uitgeverij, jaartal, taal, uitvoering, nieuwstaat, te_koop_aantal, prijs, onderhandelbaar }.
 *   - Staat het boek er al (zelfde ISBN, of zelfde titel en achternaam), dan krijgt dat boek het aantal en de prijs.
 *   - Anders komt het erbij als boek dat enkel te koop is: niet uitleenbaar en niet op de website (zoals de verkooplijst).
 * nieuwId: functie (soort) -> boek-ID. Geeft { ok, tekst, boek_id, nieuw }.
 */
function voorraadNieuwBoek(catalogus, invoer, nieuwId, vandaag) {
  invoer = invoer || {};
  var titel = tekstInvoer(invoer.titel, 200);
  if (!titel) return { ok: false, fout: 'Vul de titel in.' };
  var aantal = verkoopGetal(invoer.te_koop_aantal);
  if (aantal === null || aantal < 1 || aantal > 999 || aantal !== Math.round(aantal)) return { ok: false, fout: 'Vul een aantal in, 1 of meer.' };
  var prijs = verkoopGetal(invoer.prijs);
  if (prijs === null || prijs < 0) return { ok: false, fout: 'Vul een geldige prijs in, bv. 8 of 12,50.' };
  var isbn = tekstInvoer(invoer.isbn, 20);
  if (isbn && !normaliseerIsbn(isbn).isbn) return { ok: false, fout: 'Dit ISBN klopt niet. Kijk het na, of laat het leeg.' };
  var rij = {
    rij: 0, titel: titel, auteur: tekstInvoer(invoer.auteur, 200), isbn: isbn, uitgeverij: tekstInvoer(invoer.uitgeverij, 120),
    jaartal: parseerGetal(invoer.jaartal) || '', taal: tekstInvoer(invoer.taal, 40), paginas: '', uitvoering: tekstInvoer(invoer.uitvoering, 40),
    nieuwstaat: tekstInvoer(invoer.nieuwstaat, 40), genre: '', aantalTekst: String(aantal), prijs: prijs, verwerkt: ''
  };
  var uit = verkooplijstToepassen(catalogus, [rij], nieuwId, vandaag)[0];
  var boek = catalogus.filter(function (b) { return String(b.boek_id) === uit.boek_id; })[0];
  var velden = { onderhandelbaar: invoer.onderhandelbaar ? 'ja' : 'nee' };
  if (uit.nieuw) velden.herkomst = 'verkoopscherm';
  wijzig(boek, velden);
  var prijsTekst = (prijs % 1 ? prijs.toFixed(2) : String(prijs)).replace('.', ',');
  var wat = '"' + schoon(boek.titel) + '": ' + aantal + ' te koop aan ' + prijsTekst + ' euro.';
  return {
    ok: true, boek_id: uit.boek_id, nieuw: uit.nieuw,
    tekst: uit.nieuw ? wat + ' Het boek staat nu in de Catalogus als ' + uit.boek_id + ', enkel te koop (niet uitleenbaar en niet op de website).'
      : wat + ' Dit boek stond al in de Catalogus (' + uit.boek_id + ').'
  };
}

/* ---------- Tabblad Voorraad ---------- */

/**
 * De rijen van het tabblad Voorraad: elk boek met exemplaren te koop, en elk boek dat al eens verkocht werd
 * (ook als het nu uitverkocht is). Waarde: te koop maal prijs. Opbrengst: wat de verkopen echt opbrachten.
 * Geeft { rijen, totaal } terug. totaal: [te koop, waarde, verkocht, opbrengst].
 */
function voorraadRijen(catalogus, verkopen) {
  var verkocht = {}, opbrengst = {};
  (verkopen || []).forEach(function (v) {
    var id = String(v.boek_id || '');
    if (!id) return;
    var aantal = verkoopGetal(v.aantal) || 1;
    verkocht[id] = (verkocht[id] || 0) + aantal;
    opbrengst[id] = (opbrengst[id] || 0) + aantal * (verkoopGetal(v.prijs) || 0);
  });
  var totaal = [0, 0, 0, 0];
  var rijen = catalogus.filter(function (b) {
    return !isLeeg(b.boek_id) && (stockVan(b) > 0 || verkocht[String(b.boek_id)]);
  }).map(function (b) {
    var id = String(b.boek_id), stock = stockVan(b), prijs = verkoopGetal(b.prijs);
    var waarde = prijs === null ? '' : rondAf(stock * prijs);
    totaal[0] += stock; totaal[1] += waarde || 0; totaal[2] += verkocht[id] || 0; totaal[3] += opbrengst[id] || 0;
    return [id, schoon(b.titel), schoon(b.auteur), stock, prijs === null ? '' : prijs, jaNee(b.onderhandelbaar) === 'ja' ? 'ja' : 'nee',
      waarde, verkocht[id] || 0, rondAf(opbrengst[id] || 0)];
  }).sort(function (a, b) { return String(a[1]).localeCompare(String(b[1])); });
  return { rijen: rijen, totaal: [totaal[0], rondAf(totaal[1]), totaal[2], rondAf(totaal[3])] };
}

/**
 * Zet in de Catalogus hoeveel exemplaren van een boek te koop zijn, aan welke prijs, en of de prijs onderhandelbaar is.
 * invoer: { boek_id, te_koop_aantal, prijs, onderhandelbaar }. Aantal 0: het boek is niet meer te koop.
 */
function voorraadZetten(catalogus, invoer) {
  var boek = catalogus.filter(function (b) { return String(b.boek_id) === String(invoer.boek_id); })[0];
  if (!boek) return { ok: false, fout: 'Dit boek bestaat niet.' };
  var aantal = verkoopGetal(invoer.te_koop_aantal);
  if (aantal === null || aantal < 0 || aantal > 999 || aantal !== Math.round(aantal)) return { ok: false, fout: 'Vul een aantal in, 0 of meer.' };
  var prijs = isLeeg(invoer.prijs) ? null : verkoopGetal(invoer.prijs);
  if (!isLeeg(invoer.prijs) && (prijs === null || prijs < 0)) return { ok: false, fout: 'Vul een geldige prijs in, bv. 8 of 12,50.' };
  if (aantal > 0 && prijs === null) return { ok: false, fout: 'Vul een prijs in.' };
  wijzig(boek, { te_koop_aantal: aantal, prijs: prijs === null ? '' : prijs, onderhandelbaar: invoer.onderhandelbaar ? 'ja' : 'nee' });
  var titel = '"' + schoon(boek.titel) + '"';
  return { ok: true, tekst: aantal ? titel + ': ' + aantal + ' te koop aan ' + (prijs % 1 ? prijs.toFixed(2) : String(prijs)).replace('.', ',') + ' euro.' : titel + ' is niet meer te koop.' };
}

/** Acties voorstelBeschrijving en voorstelBehandelen (binnen het slot, met een staat). */
function voorstelActie(staat, actie, invoer) {
  var tabel = tabelOfLeeg('Voorstellen');
  if (!tabel) return { ok: false, fout: 'Het tabblad Voorstellen ontbreekt nog. Vraag het bestuur om Madrigal > Installeer tabbladen uit te voeren.' };
  var r = actie === 'voorstelBeschrijving'
    ? maakBeschrijvingVoorstel(staat, tabel.rijen, invoer, nieuwIdVoor(tabel.rijen, 'voorstel_id', 'voorstel', 'V'))
    : voorstelBehandelen(staat, tabel.rijen, invoer);
  if (r.ok) bewaarTabel(tabel);
  return r;
}

/**
 * Het bestuur keurt een voorstel goed (de tekst mag aangepast zijn) of af.
 * invoer: { voorstel_id, besluit: 'goedgekeurd' | 'afgekeurd', tekst }
 */
function voorstelBehandelen(staat, rijen, invoer) {
  var besluit = String(invoer.besluit || '');
  if (besluit !== 'goedgekeurd' && besluit !== 'afgekeurd') return { ok: false, fout: 'Onbekend besluit.' };
  var v = rijen.filter(function (r) { return String(r.voorstel_id) === String(invoer.voorstel_id); })[0];
  if (!v) return { ok: false, fout: 'Dit voorstel bestaat niet meer.' };
  if (v.status !== VOORSTEL_NIEUW) return { ok: false, fout: 'Dit voorstel is al ' + v.status + '.' };
  if (besluit === 'goedgekeurd') {
    var tekst = isLeeg(invoer.tekst) ? schoonMetRegels(v.tekst) : schoonMetRegels(invoer.tekst);
    var r = boekAanpassen(staat, { boek_id: v.boek_id, velden: { beschrijving: tekst } });
    if (!r.ok) return r;
  }
  wijzig(v, { status: besluit, behandeld_door: staat.wie, datum_behandeld: staat.vandaag });
  staat.log.push(['voorstel ' + besluit, String(v.voorstel_id) + ', boek ' + v.boek_id]);
  return { ok: true, tekst: besluit === 'goedgekeurd' ? 'De beschrijving staat bij "' + schoon(v.titel) + '".' : 'Voorstel afgekeurd.' };
}

/* ---------- Iets melden ---------- */

/**
 * Gegevens voor het vrijwilligersscherm: lopende uitleningen en reservaties zonder contactgegevens
 * of borg, en de boeken (voor covers en leeslijsten). Geen leners, borgen of cijfers.
 */
function vrijwilligerGegevens(staat, onderwerpRijen) {
  var lopend = lopendeUitleningen(staat).map(function (u) {
    var info = uitleningInfo(staat, u, false);
    delete info.borg;
    delete info.betaalwijze_borg;
    return info;
  });
  lopend.sort(function (a, b) { return a.vervaldatum.localeCompare(b.vervaldatum); });
  return {
    vandaagTekst: datumTekst(staat.vandaag),
    telaat: lopend.filter(function (i) { return i.status.code === 'telaat'; }),
    binnenkort: lopend.filter(function (i) { return i.status.code === 'binnenkort'; }),
    lopend: lopend,
    reservaties: alleReservaties(staat),
    boeken: baliecatalogus(staat, vertaalTabel(onderwerpRijen)),
    roosterLink: String(staat.inst.rooster_link || '')
  };
}

/** Menu: vult de Catalogus aan uit het tabblad Goodreads-export. */
function vulAanUitGoodreads(stil) {
  var blad = spreadsheet().getSheetByName('Goodreads-export');
  if (!blad) {
    meld('Er is geen tabblad "Goodreads-export". Plak eerst de export van Goodreads in een nieuw tabblad met die naam.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var shelf = leesInstellingen().goodreads_shelf;
    var goodreads = leesGoodreadsRijen(blad.getDataRange().getValues(), shelf);
    if (!goodreads.length) {
      meld(shelf ? 'Ik vond geen boeken op de shelf "' + shelf + '". Kijk in Instellingen of de naam van goodreads_shelf precies klopt.' : 'Het tabblad Goodreads-export is leeg.');
      return;
    }
    var catalogus = leesTabel('Catalogus');
    var naTeKijken = leesTabel('Na te kijken');
    var resultaat = koppelGoodreads(catalogus.rijen, goodreads);
    resultaat.aanvullingen.forEach(function (a) {
      var v = {}; v[a.veld] = a.waarde;
      wijzig(a.boek, v);
    });
    // Oude rijen van Goodreads die nog niet afgehandeld zijn, vervangen we door de nieuwe.
    naTeKijken.rijen = naTeKijken.rijen.filter(function (r) { return r.bron !== 'Goodreads' || jaNee(r.afgehandeld) === 'ja'; });
    var nieuw = voegNaTeKijkenToe(naTeKijken.rijen, resultaat.naTeKijken, 'Goodreads', vandaagTekst());
    bewaarTabel(catalogus);
    schrijfVolledig(naTeKijken);
    naTeKijkenNieuwsteBoven();
    leegCache();
    logboek('menu', 'vulAanUitGoodreads', resultaat.aanvullingen.length + ' velden aangevuld, ' + nieuw + ' na te kijken');
    if (!stil) meld(goodreads.length + ' boeken van Goodreads gebruikt' + (shelf ? ' (shelf "' + shelf + '")' : '') + '. ' +
      resultaat.aanvullingen.length + ' velden aangevuld. ' + nieuw + ' nieuwe twijfelgevallen in "Na te kijken". ' +
      'Je mag het tabblad Goodreads-export nu verwijderen: het bevat ook de rest van je persoonlijke bibliotheek.');
  } finally {
    lock.releaseLock();
  }
}

/** Menu: vult covers aan uit Google Books, in porties. */
function vulAanUitGoogleBooks() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulAanUitGoogleBooks')) return;
  if (!startAchtergrond('vulAanUitGoogleBooks')) {
    meldAlBezig('vulAanUitGoogleBooks');
    return;
  }
  var verwerkt = 0, aangevuld = 0, opTitelGevonden = 0, rest = 0, limiet = false, fout = '', gekend = 0, storing = false, verdacht = false, vreemd = false;
  var gedaan = [];
  try {
    var sleutel = leesInstellingen().google_books_api_key;
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('gb_gecontroleerd') === -1) {
      meld('De kolom gb_gecontroleerd ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftGoogleBooksNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > GB_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var antwoord = googleBooksZoek(boek.isbn, sleutel, undefined, boek); // zie Beschrijvingen.js
      var code = antwoord.code;
      if (code >= 400) fout = antwoord.fout;
      if (antwoord.limiet || code === 403 || code === 400) { limiet = true; break; } // daglimiet, of Google weigert (zie fout)
      if (code >= 500) { storing = true; break; }                                     // storing bij Google: later verder
      var info = antwoord.items.length ? antwoord.items[0].volumeInfo : null;
      if (info) gekend++;
      var velden = verwerkGoogleBooks(boek, info);
      if (velden.cover_url) aangevuld++;
      velden.gb_gecontroleerd = vandaag;
      wijzig(boek, velden);
      gedaan.push(boek);
      verwerkt++;
      // Kent Google na 20 boeken nog geen enkel boek, dan vragen we een boek dat Google zeker kent.
      // Kent Google ook dat niet: bij de daglimiet of een storing wachten, anders klopt er iets niet (sleutel, land, ...).
      // Kent Google het wel, dan zijn het gewoon moeilijke boeken (bv. Nederlandstalig of oud) en gaan we verder.
      if (verwerkt === 20 && gekend === 0) {
        var controle = googleBooksControle(sleutel);
        if (!controle.werkt) {
          // Niets aanvinken: deze boeken komen later opnieuw aan de beurt.
          gedaan.forEach(function (b) { wijzig(b, { gb_gecontroleerd: '' }); });
          if (controle.fout && controle.fout.limiet) { limiet = true; fout = controle.fout.fout; }
          else if (controle.fout && controle.fout.code >= 500) { storing = true; fout = controle.fout.fout; }
          else { verdacht = true; vreemd = controle.vreemd; }
          break;
        }
      }
      // Om de 25 boeken bewaren: zo gaat er niets verloren als het script stopt.
      if (verwerkt % 25 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(GB_PAUZE_MS);
    }
    // Tweede ronde: op titel en auteur, voor boeken zonder ISBN of waar het ISBN niets gaf.
    if (!limiet && !storing && !verdacht) {
      var opTitel = tabel.rijen.filter(heeftGoogleTitelNodig);
      for (var j = 0; j < opTitel.length; j++) {
        if (Date.now() - start > GB_MAX_LOOPTIJD_MS) break;
        var b = opTitel[j];
        var g = googleBooksVraag(googleBooksTitelUrl(b, sleutel)); // zie Beschrijvingen.js
        if (g.limiet || g.code === 403 || g.code === 400) { limiet = true; fout = g.fout; break; }
        if (g.code >= 500) { storing = true; fout = g.fout; break; }
        var v = googleTitelVelden(b, g.items);
        if (v.cover_url) { aangevuld++; opTitelGevonden++; }
        v.gb_gecontroleerd = GB_OP_TITEL + vandaag.replace(/-/g, '');
        wijzig(b, v);
        verwerkt++;
        if (verwerkt % 25 === 0) bewaarAchtergrond(tabel);
        Utilities.sleep(GB_PAUZE_MS);
      }
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(function (x) { return heeftGoogleBooksNodig(x) || heeftGoogleTitelNodig(x); }).length;
  } finally {
    stopAchtergrond('vulAanUitGoogleBooks');
  }
  verwijderTriggers('vulAanUitGoogleBooks');
  if (verdacht) {
    var waarschuwing = vreemd
      ? 'Google Books zoekt nu verkeerd: op het ISBN van een bekend boek komen andere boeken terug. Het script stopt en vinkt niets aan. Probeer het morgen opnieuw.'
      : 'Google Books kende geen enkel boek van de eerste 20. Er klopt iets niet: het script stopt en vinkt niets aan. Kies Madrigal > Testen > Test Google Books.';
    logboek('menu', 'vulAanUitGoogleBooks', waarschuwing);
    meld(waarschuwing);
    return;
  }
  if (rest > 0) {
    // Daglimiet: wachten tot Google ze terugzet (rond 9 uur 's ochtends bij ons). Storing bij Google: een kwartier. Anders: een minuut.
    var minuten = limiet ? wachtNaGoogleLimiet() : (storing ? 15 : 1);
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after(minuten * 60 * 1000).create();
  } else {
    // Klaar: nu de beschrijvingen die nog ontbreken (zie Beschrijvingen.js).
    verwijderTriggers('vulBeschrijvingenAan');
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after(60 * 1000).create();
  }
  if (aangevuld) leegCache();
  var reden = googleRondeReden(limiet, storing, fout, rest);
  logboek('menu', 'vulAanUitGoogleBooks', verwerkt + ' opgevraagd, ' + gekend + ' gekend bij Google, ' + aangevuld + ' covers gevonden (waarvan ' + opTitelGevonden + ' op titel en auteur), ' + rest + ' te gaan' + reden + (fout ? '. Google meldt: ' + fout : '') + (sleutel ? '' : '. Er staat geen google_books_api_key in Instellingen.'));
  var tekst = verwerkt + ' boeken opgevraagd bij Google Books, ' + aangevuld + ' covers gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet van Google is bereikt: het script gaat vanzelf verder als Google ze terugzet, rond 9 uur in de ochtend.'
    : storing ? ' Google heeft een storing: het script gaat over 15 minuten vanzelf verder.'
    : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt. Het script zoekt nu nog ontbrekende beschrijvingen.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Menu: vult de Catalogus aan uit Open Library, in porties. */
function vulAanUitOpenLibrary() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulAanUitOpenLibrary')) return;
  if (!startAchtergrond('vulAanUitOpenLibrary')) {
    meldAlBezig('vulAanUitOpenLibrary');
    return;
  }
  var verwerkt = 0, aangevuld = 0, rest = 0;
  try {
    var tabel = leesTabel('Catalogus');
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftOpenLibraryNodig);
    for (var i = 0; i < teDoen.length; i += OL_PORTIE) {
      if (Date.now() - start > OL_MAX_LOOPTIJD_MS) break;
      var portie = teDoen.slice(i, i + OL_PORTIE);
      var sleutels = portie.map(function (b) { return 'ISBN:' + b.isbn; }).join(',');
      var url = 'https://openlibrary.org/api/books?format=json&jscmd=details&bibkeys=' + encodeURIComponent(sleutels);
      var antwoord = haalExtern(url, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': BS_USER_AGENT } // zie Beschrijvingen.js
      });
      if (antwoord.getResponseCode() === 429 || antwoord.getResponseCode() >= 500) {
        // Open Library vraagt om trager te gaan of heeft een storing: later verder.
        break;
      }
      var data = {};
      try { data = JSON.parse(antwoord.getContentText()); } catch (e) { data = {}; }
      portie.forEach(function (boek) {
        var gevonden = data['ISBN:' + boek.isbn];
        var velden = verwerkOpenLibrary(boek, gevonden ? gevonden.details : null);
        if (Object.keys(velden).length) aangevuld++;
        velden.ol_gecontroleerd = vandaag;
        wijzig(boek, velden);
        verwerkt++;
      });
      // Na elke portie bewaren: zo gaat er niets verloren als het script stopt.
      bewaarAchtergrond(tabel);
      Utilities.sleep(OL_PAUZE_MS);
    }
    rest = tabel.rijen.filter(heeftOpenLibraryNodig).length;
  } finally {
    stopAchtergrond('vulAanUitOpenLibrary');
  }
  verwijderTriggers('vulAanUitOpenLibrary');
  if (rest > 0) {
    ScriptApp.newTrigger('vulAanUitOpenLibrary').timeBased().after(60 * 1000).create();
  } else {
    leegCache();
    // Klaar: Google Books zoekt nog covers voor de boeken waar Open Library er geen had.
    verwijderTriggers('vulAanUitGoogleBooks');
    ScriptApp.newTrigger('vulAanUitGoogleBooks').timeBased().after(60 * 1000).create();
  }
  logboek('menu', 'vulAanUitOpenLibrary', verwerkt + ' opgevraagd, ' + aangevuld + ' aangevuld, ' + rest + ' te gaan');
  var tekst = verwerkt + ' boeken opgevraagd bij Open Library, ' + aangevuld + ' aangevuld.';
  tekst += rest > 0 ? ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.' : ' Alles is verwerkt. Google Books zoekt nu nog ontbrekende covers.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/** Menu: zoekt beschrijvingen voor boeken waar die nog ontbreekt, in porties. */
function vulBeschrijvingenAan() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulBeschrijvingenAan')) return;
  if (!startAchtergrond('vulBeschrijvingenAan')) {
    meldAlBezig('vulBeschrijvingenAan');
    return;
  }
  var verwerkt = 0, gevonden = 0, opTitelGevonden = 0, rest = 0, limiet = false, gbLimiet = false, gbFout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('beschrijving_gezocht') === -1) {
      meld('De kolom beschrijving_gezocht ontbreekt nog in de Catalogus. Voer eerst "installeer" uit.');
      return;
    }
    var sleutel = leesInstellingen().google_books_api_key;
    var vandaag = vandaagTekst();
    // Eerst de boeken die nog nergens opgezocht zijn, dan die enkel Google nog nodig hebben.
    var teDoen = tabel.rijen.filter(heeftBeschrijvingNodig).sort(function (a, b) { return wachtOpGoogle(a) - wachtOpGoogle(b); });
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var enkelGoogle = wachtOpGoogle(boek);
      if (enkelGoogle && gbLimiet) break; // Google weigert nog: de rest wacht
      // Zit Google aan zijn daglimiet, dan zoeken we verder bij Open Library alleen.
      var r = gbLimiet ? { tekst: '' } : beschrijvingUitGoogleBooks(boek.isbn, sleutel, boek);
      if (r.limiet) { gbLimiet = true; limiet = true; gbFout = r.fout || ''; r = { tekst: '' }; if (enkelGoogle) break; }
      if (!r.tekst && !enkelGoogle) { Utilities.sleep(1000); r = beschrijvingUitOpenLibrary(boek.isbn); }
      if (r.limiet) break; // Open Library vraagt om te wachten
      if (r.tekst) {
        wijzig(boek, { beschrijving: r.tekst, beschrijving_gezocht: vandaag });
        gevonden++;
      } else {
        // Weigerde Google, dan noteren we dat enkel Open Library al zocht: Google volgt later.
        // Zonder streepjes: anders leest het script de cel later als een gewone datum en valt "OL" weg.
        wijzig(boek, { beschrijving_gezocht: gbLimiet ? BS_ENKEL_OL + vandaag.replace(/-/g, '') : vandaag });
      }
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(400);
    }
    // Tweede ronde: op titel en auteur, voor boeken waar het ISBN niets gaf of die geen ISBN hebben.
    var opTitel = tabel.rijen.filter(heeftTitelZoekNodig);
    for (var j = 0; j < opTitel.length; j++) {
      if (Date.now() - start > BS_MAX_LOOPTIJD_MS || gbLimiet) break; // Google weigert: de rest later
      var b = opTitel[j];
      var t = beschrijvingOpTitel(b, sleutel, false);
      if (t.limiet) break; // Open Library vraagt om te wachten
      if (t.gbLimiet) { gbLimiet = true; limiet = true; break; }
      if (t.tekst) {
        wijzig(b, { beschrijving: t.tekst, beschrijving_gezocht: vandaag });
        gevonden++;
        opTitelGevonden++;
      } else {
        // Zonder streepjes, zoals bij OL: anders leest het script de cel als een datum.
        wijzig(b, { beschrijving_gezocht: BS_OP_TITEL + vandaag.replace(/-/g, '') });
      }
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(400);
    }
    bewaarAchtergrond(tabel);
    var nog = tabel.rijen.filter(function (x) { return heeftBeschrijvingNodig(x) || heeftTitelZoekNodig(x); });
    rest = nog.length;
    // Nog boeken die niemand opzocht: over een minuut verder (Open Library werkt nog).
    // Enkel nog Google nodig en Google weigert: over 6 uur.
    // Boeken die Open Library nog kan opzoeken (op ISBN). De ronde op titel begint altijd bij Google: wacht mee.
    var nieuwTeDoen = nog.filter(function (b) { return heeftBeschrijvingNodig(b) && !wachtOpGoogle(b); }).length;
    limiet = limiet && nieuwTeDoen === 0;
  } finally {
    stopAchtergrond('vulBeschrijvingenAan');
  }
  verwijderTriggers('vulBeschrijvingenAan');
  if (rest > 0) {
    ScriptApp.newTrigger('vulBeschrijvingenAan').timeBased().after((limiet ? 6 * 60 : 1) * 60 * 1000).create();
  }
  if (gevonden) leegCache();
  // Nieuwe beschrijvingen gevonden? Dan vertalen (zie onderaan).
  if (gevonden) planVertaling(2);
  logboek('menu', 'vulBeschrijvingenAan', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden (waarvan ' + opTitelGevonden + ' op titel en auteur), ' + rest + ' te gaan' + (limiet ? ' (limiet bereikt)' : '') + (gbFout ? '. Google meldt: ' + gbFout : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' beschrijvingen gevonden.';
  if (rest > 0) tekst += limiet ? ' De daglimiet is bereikt: over 6 uur gaat het script vanzelf verder.' : ' Nog ' + rest + ' te gaan: het script gaat over een minuut vanzelf verder.';
  else tekst += ' Alles is verwerkt.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/* ---------- Vertalen ---------- */

/** Menu en achtergrondtaak: vult films aan uit Wikidata en Wikipedia, in porties. */
function vulFilmsAan() {
  var start = Date.now();
  if (wachtOpDaglimiet('vulFilmsAan')) return;
  if (!startAchtergrond('vulFilmsAan')) { meldAlBezig('vulFilmsAan'); return; }
  var verwerkt = 0, gevonden = 0, teksten = 0, rest = 0, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('film_gezocht') === -1) { meld('De kolommen voor films ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftFilmGegevensNodig);
    while (teDoen.length && Date.now() - start < FILM_MAX_LOOPTIJD_MS && !fout) {
      var portie = teDoen.splice(0, FILM_PORTIE);
      // Eerst op het nummer van IMDb of het adres bij Letterboxd: dat is exact. De rest op de titel.
      var metImdb = portie.filter(function (r) { return !isLeeg(r.imdb); });
      var metSlug = portie.filter(function (r) { return isLeeg(r.imdb) && !isLeeg(r.letterboxd); });
      var perSleutel = {};
      [[metImdb, 'imdb', filmVraagImdb], [metSlug, 'letterboxd', filmVraagLetterboxd]].forEach(function (x) {
        if (!x[0].length || fout) return;
        var a = wikidataVraag(x[2](x[0].map(function (r) { return schoon(r[x[1]]); })));
        if (a.fout) { fout = a.fout; return; }
        a.films.forEach(function (f) { perSleutel[f.lb] = f; });
      });
      if (fout) break;
      for (var i = 0; i < portie.length; i++) {
        var rij = portie[i];
        var f = perSleutel[schoon(rij.imdb)] || perSleutel[schoon(rij.letterboxd)] || null;
        if (!f) {
          Utilities.sleep(FILM_PAUZE_MS);
          var b = wikidataVraag(filmVraagTitel(rij.titel, parseerGetal(rij.jaartal)));
          if (b.fout) { fout = b.fout; break; }
          f = kiesFilm(rij, b.films);
        }
        var velden = { film_gezocht: vandaag };
        if (f) {
          Object.assign(velden, filmVelden(rij, f));
          gevonden++;
          if (isLeeg(rij.beschrijving)) {
            var w = {};
            [['nl', f.nl], ['en', f.en]].forEach(function (x) {
              if (w.tekst || !x[1]) return;
              Utilities.sleep(FILM_PAUZE_MS);
              var ant = haalJson(filmWikiUrl(x[0], x[1]));
              if (ant.code === 200) w = filmWikiTekst(ant.data);
            });
            if (w.tekst) {
              velden.beschrijving = w.tekst;
              velden.beschrijving_bron = w.link;
              velden.beschrijving_vertaald = '';
              teksten++;
            }
          }
        }
        wijzig(rij, velden);
        verwerkt++;
      }
      bewaarAchtergrond(tabel);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftFilmGegevensNodig).length;
  } finally {
    stopAchtergrond('vulFilmsAan');
  }
  verwijderTriggers('vulFilmsAan');
  if (rest > 0) ScriptApp.newTrigger('vulFilmsAan').timeBased().after((fout ? 15 : 1) * 60 * 1000).create();
  if (verwerkt) leegCache();
  if (teksten) planVertaling(2);
  logboek('menu', 'vulFilmsAan', verwerkt + ' films opgezocht, ' + gevonden + ' gevonden bij Wikidata, ' + teksten + ' omschrijvingen, ' + rest + ' te gaan' + (fout ? ' (' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' films opgezocht, ' + gevonden + ' gevonden, ' + teksten + ' omschrijvingen.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/** Pure versie van werkOnderwerpenBij, voor de tests. */
function vulOnderwerpenAan(onderwerpRijen, catalogusRijen) {
  var tellingen = {};
  var schrijfwijzen = {};
  catalogusRijen.forEach(function (b) {
    var g = normaliseerTekst(b.genre);
    if (!g || isFilm(b)) return; // filmgenres staan los van de onderwerpen van de boeken
    tellingen[g] = (tellingen[g] || 0) + 1;
    schrijfwijzen[g] = schrijfwijzen[g] || {};
    var s = schoon(b.genre);
    schrijfwijzen[g][s] = (schrijfwijzen[g][s] || 0) + 1;
  });
  var bekend = {};
  onderwerpRijen.forEach(function (r) {
    var g = normaliseerTekst(r.genre);
    bekend[g] = true;
    if (Number(r.aantal_boeken) !== (tellingen[g] || 0)) wijzig(r, { aantal_boeken: tellingen[g] || 0 });
  });
  var nieuw = 0;
  Object.keys(tellingen).sort().forEach(function (g) {
    if (bekend[g]) return;
    // De meest gebruikte schrijfwijze wordt de naam in de tabel.
    var naam = Object.keys(schrijfwijzen[g]).sort(function (a, b) { return schrijfwijzen[g][b] - schrijfwijzen[g][a]; })[0];
    voegToe(onderwerpRijen, { genre: naam, filtergroepen: stelFiltergroepenVoor(g).join(', '), aantal_boeken: tellingen[g] });
    nieuw++;
  });
  return nieuw;
}

/**
 * Doet het werk zonder spreadsheet. catalogus en onderwerpRijen worden aangepast (wijzig).
 * Geeft { genres: [genres die een thema kregen], boeken: [boek_id met een geraden thema], nakijken: [rijen] }.
 */
function vulOntbrekendeOnderwerpen(catalogus, onderwerpRijen) {
  var uit = { genres: [], boeken: [], nakijken: [] };
  // 1. Genres zonder thema: het voorstel uit het genre.
  onderwerpRijen.forEach(function (r) {
    if (isLeeg(r.genre) || !isLeeg(r.filtergroepen)) return;
    var voorstel = stelFiltergroepenVoor(r.genre);
    if (voorstel.length) { wijzig(r, { filtergroepen: voorstel.join(', ') }); uit.genres.push(schoon(r.genre)); }
  });
  var vertaal = vertaalTabel(onderwerpRijen);
  // 2. Boeken die nog altijd geen thema hebben.
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id) || isLeeg(b.titel) || isFilm(b)) return;
    if (filtergroepenVan(b, vertaal).length) return;
    var scores = onderwerpScores(b);
    var zeker = zekerOnderwerp(scores);
    if (zeker) {
      wijzig(b, { extra_onderwerpen: zeker });
      uit.boeken.push(String(b.boek_id));
      return;
    }
    uit.nakijken.push({
      boek_id: String(b.boek_id), titel: schoon(b.titel), auteur: schoon(b.auteur), genre: schoon(b.genre),
      voorstel: scores.slice(0, 3).map(function (s) { return s[0] + ' (' + s[1] + ')'; }).join(', ') || 'geen aanwijzing',
      onderwerp_nieuw: scores.length ? scores[0][0] : '', toepassen: 'nee'
    });
  });
  return uit;
}

/** Menu: ontbrekende onderwerpen aanvullen waar het zeker is, de rest op de nakijklijst. */
function vulOntbrekendeOnderwerpenMenu() {
  werkOnderwerpenBij(); // nieuwe genres eerst in Onderwerpen
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var uit;
  try {
    var catalogus = leesTabel('Catalogus');
    var onderwerpen = leesTabel('Onderwerpen');
    uit = vulOntbrekendeOnderwerpen(catalogus.rijen, onderwerpen.rijen);
    bewaarTabel(onderwerpen);
    if (uit.boeken.length) schrijfKolommen(catalogus, ['extra_onderwerpen']);
    var ss = spreadsheet();
    var blad = ss.getSheetByName(ONDERWERP_NAKIJKEN) || maakTabblad(ONDERWERP_NAKIJKEN);
    blad.clear();
    blad.getRange(1, 1, blad.getMaxRows(), blad.getMaxColumns()).clearDataValidations();
    var waarden = [ONDERWERP_KOLOMMEN].concat(uit.nakijken.map(function (r) { return ONDERWERP_KOLOMMEN.map(function (k) { return r[k]; }); }));
    blad.getRange(1, 1, waarden.length, ONDERWERP_KOLOMMEN.length).setValues(waarden);
    opmaakKop(blad, ONDERWERP_KOLOMMEN.length);
    if (uit.nakijken.length) {
      var col = function (k) { return ONDERWERP_KOLOMMEN.indexOf(k) + 1; };
      blad.getRange(2, col('toepassen'), uit.nakijken.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(['ja', 'nee', 'gedaan'], true).setAllowInvalid(false).build());
      blad.getRange(2, col('onderwerp_nieuw'), uit.nakijken.length, 1).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(onderwerpKeuzes(onderwerpen.rijen, catalogus.rijen).lijst.slice(0, 500), true).setAllowInvalid(true).build());
    }
  } finally {
    lock.releaseLock();
  }
  leegCache();
  var tekst = uit.genres.length + ' genres kregen een thema in Onderwerpen, ' + uit.boeken.length + ' boeken kregen meteen een thema (zeker). ' +
    uit.nakijken.length + ' boeken staan in het tabblad ' + ONDERWERP_NAKIJKEN + ': kies een thema in onderwerp_nieuw, zet toepassen op ja, ' +
    'en kies daarna Madrigal > Boeken > Onderwerpen: pas de nakijklijst toe.';
  logboek('menu', 'vulOntbrekendeOnderwerpen', tekst + (uit.genres.length ? ' Genres: ' + uit.genres.join(', ') + '.' : '') + (uit.boeken.length ? ' Boeken: ' + uit.boeken.join(', ') : ''));
  meld(tekst);
}

/** Vult bij de avonden van het rooster het vaste event in, als de roostertool er geen vermeldt. */
function vulVasteEventsAan(avonden, inst) {
  var lijst = vasteEventsUitTekst(inst.tekst_vaste_events);
  (avonden || []).forEach(function (a) {
    if (!a.event) a.event = vasteEventsOp(a.datum, lijst).join(', ');
  });
  return avonden;
}

/* ---------- Een oud rooster overnemen (een tabblad per maand) ---------- */

/** Waakhond (elk uur, via verwerkNieuweBoekenAutomatisch): nieuwe covers van een andere site? Dan kopiëren. */
function waakOverCoversBewaren() {
  var gepland = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'bewaarCoversInDrive'; });
  var bezig = false;
  try { bezig = !!CacheService.getScriptCache().get('taak_bewaarCoversInDrive'); } catch (e) { bezig = false; }
  if (gepland || bezig) return;
  var tabel = leesTabel('Catalogus');
  if (tabel.kop.indexOf('cover_bewaard') === -1) return; // nog niet geïnstalleerd
  if (tabel.rijen.some(heeftCoverBewarenNodig)) planTaak('bewaarCoversInDrive', 60 * 1000);
}

/**
 * Waakhond, elk uur (via verwerkNieuweBoekenAutomatisch). Google kan een geplande ronde laten vallen, bv. als de
 * rekentijd voor die dag op is: dan start de taak niet en plant ze ook niets meer. De waakhond ziet dat en start
 * het kopiëren opnieuw. Een terugkerende trigger blijft wel lopen, ook na zo'n dag.
 */
function waakOverOudeCovers() {
  var gepland = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'kopieerOudeCovers'; });
  var bezig = false;
  try { bezig = !!CacheService.getScriptCache().get('taak_kopieerOudeCovers'); } catch (e) { bezig = false; }
  if (gepland || bezig) return;
  var teGaan = leesTabel('Catalogus').rijen.filter(heeftOudeCoverNodig).length;
  if (!oudeCoversHerstarten(teGaan, gepland, bezig)) return;
  planTaak('kopieerOudeCovers', 60 * 1000);
  logboek('systeem', 'kopieerOudeCovers', 'Het kopiëren stond stil met ' + teGaan + ' covers te gaan. De waakhond startte het opnieuw.');
}

/** Hoeveel minuten wachten na de daglimiet van Google Books. Lukt de berekening niet: 6 uur. */
function wachtNaGoogleLimiet() {
  try {
    var t = Utilities.formatDate(new Date(), 'America/Los_Angeles', 'H:m').split(':');
    return minutenTotGoogleReset(Number(t[0]), Number(t[1]));
  } catch (e) {
    return 6 * 60;
  }
}

/**
 * Voor elke achtergrondtaak, helemaal vooraan: is de daglimiet nog op, dan start de taak niet
 * en plant ze zich opnieuw als de limiet voorbij is. Geeft true als de taak moet wachten.
 */
function wachtOpDaglimiet(naam) {
  var sinds = 0;
  try { sinds = daglimietSinds(); } catch (e) { return false; }
  var wacht = wachtVoorTaak(naam, sinds, Date.now());
  if (!wacht) return false;
  planTaak(naam, wacht);
  try { logboek('systeem', naam, 'Wacht op de daglimiet van Google. Gaat vanzelf verder over ' + Math.ceil(wacht / 60000) + ' minuten.'); } catch (e) { /* geen logboek */ }
  try { spreadsheet().toast('De daglimiet van Google voor vragen naar buiten is op. Deze taak gaat vanzelf verder over ' + Math.ceil(wacht / 3600000) + ' uur.', 'Madrigal', 15); } catch (e) { /* geen spreadsheet open */ }
  return true;
}

/** Zocht enkel Open Library al, en moet Google dit boek nog opzoeken? */
function wachtOpGoogle(boek) {
  return String(boek.beschrijving_gezocht || '').indexOf(BS_ENKEL_OL) === 0;
}

/** Hoe lang deze taak nog moet wachten (ms) na een daglimiet die om "sinds" genoteerd werd. 0: meteen. */
function wachtVoorTaak(naam, sinds, nu) {
  sinds = Number(sinds) || 0;
  return sinds ? Math.max(0, herstartNaDaglimiet(naam, sinds + DAGLIMIET_WACHT_MS) - nu) : 0;
}

/** De maandag van de week van een datum ("JJJJ-MM-DD"). Zo wisselen de aanraders elke week. */
function weekBegin(datum) {
  var terug = (weekdag(datum) + 6) % 7; // maandag 0, zondag 6
  return telDagenOp(datum, -terug);
}

/** Weekdag als getal: 0 = zondag, 5 = vrijdag. */
function weekdag(datum) {
  return naarUtc(datum).getUTCDay();
}

/** Weekdagen als tekst naar het getal van de weekdag (0 = zondag). */
function weekdagNummers(waarde) {
  return splitsLijst(waarde).map(function (w) {
    return WEEKDAGEN.indexOf(normaliseerTekst(w));
  }).filter(function (n) { return n > -1; });
}

/**
 * Zet elk genre uit de Catalogus in de vertaaltabel Onderwerpen, met een voorstel
 * voor de filtergroep. Bestaande regels blijven ongemoeid, het aantal boeken wordt bijgewerkt.
 * Geeft het aantal nieuwe genres terug.
 */
function werkOnderwerpenBij() {
  var catalogus = leesTabel('Catalogus');
  var tabel = leesTabel('Onderwerpen');
  var resultaat = vulOnderwerpenAan(tabel.rijen, catalogus.rijen);
  bewaarTabel(tabel);
  return resultaat;
}

function werkOnderwerpenBijMenu() {
  var nieuw = werkOnderwerpenBij();
  leegCache();
  meld(nieuw + ' nieuwe genres toegevoegd aan Onderwerpen. Kijk de kolom filtergroepen na.');
}

/** Past velden van een rij aan en markeert de rij als gewijzigd. */
function wijzig(rij, velden) {
  if (!rij._velden) rij._velden = {};
  Object.keys(velden).forEach(function (k) { rij[k] = velden[k]; rij._velden[k] = true; });
  rij._gewijzigd = true;
  return rij;
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

function wikidataVraag(sparql) {
  // Met POST: in het adres (GET) wordt de vraag voor 20 films te lang voor Google ("Lengte URLFetch-URL").
  var r;
  try {
    r = haalExtern('https://query.wikidata.org/sparql?format=json', {
      method: 'post', contentType: 'application/x-www-form-urlencoded', payload: 'query=' + encodeURIComponent(sparql),
      muteHttpExceptions: true, headers: { 'User-Agent': BS_USER_AGENT, Accept: 'application/sparql-results+json' }
    });
  } catch (e) {
    if (isDaglimietFout(e)) throw e;
    return { fout: 'Wikidata: ' + String(e && e.message || e).slice(0, 150) };
  }
  if (r.getResponseCode() !== 200) return { fout: 'Wikidata gaf code ' + r.getResponseCode() };
  try { return { films: filmUitWikidata(JSON.parse(r.getContentText())) }; } catch (e) { return { fout: 'Wikidata gaf een onverwacht antwoord' }; }
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

/** Is deze samenvatting van Wikipedia bruikbaar voor dit boek? (geen doorverwijspagina, auteur vermeld) */
function wikiSamenvattingOk(boek, s) {
  if (!s || s.type !== 'standard' || !s.extract || String(s.extract).length < 80) return false;
  var naam = achternaam(boek.auteur);
  if (!naam) return false;
  return normaliseerTekst(s.extract + ' ' + (s.description || '')).split(' ').indexOf(naam) > -1;
}

/** Titel van een artikel zonder "(roman)", "(boek)", ... aan het einde. */
function wikiTitelZonderUitleg(titel) {
  return String(titel || '').replace(/\s*\([^)]*\)\s*$/, '');
}

/** De vraag aan Wikipedia: zoeken en meteen de eerste alinea, de link en doorverwijspagina's. */
function wikiVraagUrl(taal, vraag) {
  return 'https://' + taal + '.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1' +
    '&generator=search&gsrlimit=5&gsrsearch=' + encodeURIComponent(vraag) +
    '&prop=extracts%7Cinfo%7Cpageprops%7Cdescription&exintro=1&explaintext=1&exlimit=5&inprop=url&ppprop=disambiguation';
}

/** Een willekeurige code van 8 tekens, zonder tekens die je makkelijk verwart (0/O, 1/l). */
function willekeurigeCode() {
  var tekens = 'abcdefghjkmnpqrstuvwxyz23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += tekens.charAt(Math.floor(Math.random() * tekens.length));
  return code;
}

/** Menu: wist de aanraders die automatisch uit de stocklijst overgenomen werden. */
function wisAanradersUitStock() {
  var ss = spreadsheet();
  var bron = [];
  [['Stock', 'boek'], ['Zines', 'zine']].forEach(function (paar) {
    var blad = ss.getSheetByName(paar[0]);
    if (blad) bron = bron.concat(leesBronRijen(blad.getDataRange().getValues(), paar[1]));
  });
  if (!bron.length) {
    meld('De tabbladen Stock en Zines ontbreken. Wis de namen in de kolom aanrader van de Catalogus dan met de hand.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  var n;
  try {
    var tabel = leesTabel('Catalogus');
    n = wisAanradersUitStockRijen(tabel.rijen, bron, leesInstellingen());
    bewaarTabel(tabel);
  } finally {
    lock.releaseLock();
  }
  leegCache();
  logboek('menu', 'wisAanradersUitStock', n + ' aanraders gewist');
  meld(n + ' boeken kregen een aangepaste aanrader. De namen uit aanraders_uit_stocklijst (zoals Johanna) en wat je zelf invulde, bleven staan. Een andere aanrader typ je voortaan in de kolom aanrader van de Catalogus.');
}

/**
 * Wist de aanraders die uit de stocklijst kwamen, behalve de namen uit de
 * instelling aanraders_uit_stocklijst (bv. Johanna). Een aanrader die je zelf
 * invulde of aanpaste (een andere waarde dan in de stocklijst), blijft staan.
 * catalogusRijen: rijen van de Catalogus. bron: boek-objecten uit leesBronRijen.
 * Geeft het aantal aangepaste boeken terug.
 */
function wisAanradersUitStockRijen(catalogusRijen, bron, inst) {
  var uitStock = {};
  bron.forEach(function (b) {
    var s = bronSleutel(b);
    if (b.aanrader && !uitStock[s]) uitStock[s] = normaliseerTekst(b.aanrader);
  });
  var n = 0;
  catalogusRijen.forEach(function (rij) {
    if (isLeeg(rij.aanrader) || !rij.bron_sleutel) return;
    if (uitStock[rij.bron_sleutel] === normaliseerTekst(rij.aanrader)) {
      var blijft = toegelatenStockAanrader(rij.aanrader, inst);
      if (normaliseerTekst(blijft) === normaliseerTekst(rij.aanrader)) return;
      wijzig(rij, { aanrader: blijft });
      n++;
    }
  });
  return n;
}

/**
 * Wist de covers die een standaardafbeelding zijn (Drive-bestand in ids), of een link naar LibraryThing.
 * De cover wordt leeg, zodat de zoektochten (Google Books, Open Library, bol.com, ...) een echte cover kunnen zoeken.
 * Geeft de boek_id's.
 */
function wisStandaardCovers(catalogus, ids) {
  var gewist = [];
  catalogus.forEach(function (b) {
    if (isLeeg(b.boek_id)) return;
    var velden = {};
    if (!isLeeg(b.cover_url) && (ids[driveIdUitCover(b.cover_url)] || /librarything/i.test(String(b.cover_url)))) {
      velden.cover_url = ''; velden.cover_bron = '';
      // Opnieuw laten zoeken bij Google Books, bol.com en Internet Archive.
      ['gb_gecontroleerd', 'bol_gezocht', 'ia_gezocht', 'cover_gezocht'].forEach(function (k) { if (b.hasOwnProperty(k)) velden[k] = ''; });
    }
    if (/librarything/i.test(String(b.oude_cover || ''))) velden.oude_cover = '';
    if (Object.keys(velden).length) { wijzig(b, velden); gewist.push(String(b.boek_id)); }
  });
  return gewist;
}

/** Woorden van een tekst, zonder lidwoorden (tenzij er dan niets overblijft). */
function woorden(waarde) {
  var alle = normaliseerTekst(waarde).split(' ').filter(function (w) { return w; });
  var zonder = alle.filter(function (w) { return LIDWOORDEN.indexOf(w) === -1; });
  return zonder.length ? zonder : alle;
}

/** Is één thema duidelijk de winnaar? Geeft het thema of ''. */
function zekerOnderwerp(scores) {
  if (!scores.length || scores[0][1] < ONDERWERP_ZEKER_MIN) return '';
  var tweede = scores[1] ? scores[1][1] : 0;
  return scores[0][1] >= ONDERWERP_ZEKER_FACTOR * tweede ? scores[0][0] : '';
}

/** Is deze uitgave van Google (volumeInfo) hetzelfde boek: (bijna) dezelfde titel, en dezelfde achternaam als we een auteur kennen? */
function zelfdeBoek(info, boek) {
  var a = titelKern(info.title), b = titelKern(boek.titel);
  if (!a || !b || gelijkenis(a, b) < 0.85) return false;
  var naam = achternaam(boek.auteur);
  if (!naam) return true;
  return (info.authors || []).some(function (x) { return achternaam(x) === naam; });
}

/** Is deze naam van wie aangemeld is? Op de voornaam, zonder hoofdletters of accenten. */
function zelfdeNaam(a, b) {
  var x = normaliseerTekst(a).split(' ')[0], y = normaliseerTekst(b).split(' ')[0];
  return !!x && x === y;
}

/** Vergelijkt twee teksten zonder hoofdletters, leestekens en spaties. */
function zelfdeTekst(a, b) {
  var kaal = function (t) { return normaliseerTekst(t).replace(/[^a-z0-9]/g, ''); };
  return kaal(a) === kaal(b);
}

/**
 * Zet de opmaak van kolommen op een gewoon getal. Een nieuwe kolom erft soms de datumopmaak van de
 * kolom ernaast: dan wordt 96 minuten 5/4/1900. Een datum die er al staat, wordt terug het getal.
 * opmaak: '0' (standaard, gehele getallen) of bv. '0.00' voor een prijs.
 */
function zetGetalopmaak(blad, kolommen, opmaak) {
  if (!blad || blad.getLastRow() < 2) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  kolommen.forEach(function (k) {
    var i = kop.indexOf(k);
    if (i === -1) return;
    var bereik = blad.getRange(2, i + 1, blad.getLastRow() - 1, 1);
    var waarden = bereik.getValues();
    var anders = false;
    waarden.forEach(function (r) { if (isDatumObject(r[0])) { r[0] = datumNaarGetal(r[0]); anders = true; } });
    bereik.setNumberFormat(opmaak || '0');
    if (anders) bereik.setValues(waarden);
  });
}

/** Past één instelling aan in het tabblad. */
function zetInstelling(blad, sleutel, waarde) {
  var waarden = blad.getDataRange().getValues();
  for (var r = 1; r < waarden.length; r++) {
    if (schoon(waarden[r][0]) === sleutel) {
      blad.getRange(r + 1, 2).setValue(waarde);
      return;
    }
  }
}

function zetOudeEventsOm(rijen, basis) {
  return rijen.map(function (r) {
    var moment = eersteVeld(r, ['eventDate', 'event_date', 'date', 'start']);
    return {
      datum: oudeDatum(moment), uur: oudUur(moment),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'description', 'body', 'text', 'textNl'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'descriptionEn', 'bodyEn', 'textEn', 'text_en'])),
      locatie: schoon(eersteVeld(r, ['location', 'locatie', 'place'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

function zetOudeFaqOm(rijen) {
  return rijen.map(function (r) {
    return {
      volgorde: eersteVeld(r, ['order', 'volgorde', 'position']),
      vraag: schoon(htmlNaarTekst(eersteVeld(r, ['question', 'questionNl', 'title', 'titleNl']))),
      vraag_en: schoon(htmlNaarTekst(eersteVeld(r, ['questionEn', 'question_en', 'titleEn']))),
      antwoord: htmlNaarTekst(eersteVeld(r, ['answer', 'answerNl', 'content', 'contentNl', 'text', 'textNl'])),
      antwoord_en: htmlNaarTekst(eersteVeld(r, ['answerEn', 'answer_en', 'contentEn', 'textEn'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

/** Zet de rijen van de oude databank om naar rijen voor de nieuwe tabbladen. */
function zetOudeNieuwsOm(rijen, basis) {
  return rijen.map(function (r) {
    return {
      datum: oudeDatum(eersteVeld(r, ['date', 'publishedAt', 'published_at', 'created_at', 'createdAt'])),
      titel: schoon(eersteVeld(r, ['title', 'titleNl', 'title_nl', 'name'])),
      titel_en: schoon(eersteVeld(r, ['titleEn', 'title_en'])),
      tekst: htmlNaarTekst(eersteVeld(r, ['content', 'contentNl', 'content_nl', 'body', 'text', 'textNl', 'description'])),
      tekst_en: htmlNaarTekst(eersteVeld(r, ['contentEn', 'content_en', 'bodyEn', 'textEn', 'text_en', 'descriptionEn'])),
      afbeelding: oudeAfbeelding(eersteVeld(r, ['image', 'imageUrl', 'image_url', 'cover', 'picture']), basis),
      link: schoon(eersteVeld(r, ['link', 'url'])),
      publiek: 'ja', bron_id: 'oud-' + r.id
    };
  });
}

/** Zet de opmaak van kolommen op tekst, zodat 0470... en ISBN's niet als getal verminkt worden. */
function zetTekstopmaak(blad, kolommen) {
  if (!blad) return;
  var kop = blad.getRange(1, 1, 1, blad.getLastColumn()).getValues()[0].map(schoon);
  kolommen.forEach(function (k) {
    var i = kop.indexOf(k);
    if (i > -1 && blad.getMaxRows() > 1) blad.getRange(2, i + 1, blad.getMaxRows() - 1, 1).setNumberFormat('@');
  });
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
  if (rest > 0 && !vast) ScriptApp.newTrigger('zoekBeschrijvingenWikipedia').timeBased().after(quotum ? herstartNaDaglimiet('zoekBeschrijvingenWikipedia', DAGLIMIET_WACHT_MS) : (wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) { leegCache(); planVertaling(2); }
  logboek('menu', 'zoekBeschrijvingenWikipedia', verwerkt + ' opgezocht, ' + gevonden + ' beschrijvingen gevonden, ' + rest + ' te gaan volgens de spreadsheet' +
    (fout ? ' (Wikipedia: ' + fout + ', later verder)' : '') + (nietBewaard ? ' (bewaren lukte ' + nietBewaard + ' keer niet: de spreadsheet was bezet)' : '') +
    (controle ? ' | ' + controle : '') + (vast ? ' | GESTOPT: bewaren lukt niet. Start opnieuw via het menu zodra dat opgelost is.' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Wikipedia, ' + gevonden + ' beschrijvingen gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/**
 * Zoekt een boek in de Catalogus op titel en auteur.
 * Geeft { zeker: boek } of { twijfel: [boeken] } of {} terug.
 * soepel (voor de historiek, enkel voor de cijfers): de beste kandidaat met de juiste auteur telt als zeker,
 * ook bij een titel die wat verschilt of als het boek twee keer in de Catalogus staat.
 */
function zoekBoekOpTitel(catalogus, titel, auteur, soepel) {
  var sleutel = titelSleutel(titel);
  var naam = achternaam(auteur);
  if (!sleutel) return {};
  var kandidaten = [];
  catalogus.forEach(function (b) {
    var s = titelSleutel(b.titel);
    if (!s) return;
    var gelijk = gelijkenis(s, sleutel);
    var bevat = (s.length >= 5 && sleutel.indexOf(s) > -1) || (sleutel.length >= 5 && s.indexOf(sleutel) > -1);
    if (gelijk < 0.8 && !bevat) return;
    var auteurOk = !naam || levenshtein(achternaam(b.auteur), naam) <= 1;
    kandidaten.push({ boek: b, score: gelijk, auteurOk: auteurOk });
  });
  var zeker = kandidaten.filter(function (k) { return k.score >= 0.95 && k.auteurOk; });
  if (zeker.length === 1) return { zeker: zeker[0].boek };
  if (soepel && naam) {
    var goed = kandidaten.filter(function (k) { return k.auteurOk; }).sort(function (a, b) { return b.score - a.score; });
    if (goed.length) return { zeker: goed[0].boek };
  }
  if (!kandidaten.length) return {};
  kandidaten.sort(function (a, b) { return b.score - a.score; });
  return { twijfel: kandidaten.slice(0, 3).map(function (k) { return k.boek; }) };
}

/** Menu: zoekt covers van andere uitgaven bij Open Library, in porties. */
function zoekCoversAndereUitgaven() {
  var start = Date.now();
  if (wachtOpDaglimiet('zoekCoversAndereUitgaven')) return;
  if (!startAchtergrond('zoekCoversAndereUitgaven')) {
    meldAlBezig('zoekCoversAndereUitgaven');
    return;
  }
  var verwerkt = 0, gevonden = 0, rest = 0, limiet = false, code = 0;
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('cover_gezocht') === -1 || tabel.kop.indexOf('cover_bron') === -1) {
      meld('De kolommen cover_gezocht en cover_bron ontbreken nog. Voer eerst Madrigal > Installeer tabbladen uit.');
      return;
    }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftAndereUitgaveNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CV_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var cover = 0, bron = '';
      if (/^\d{13}$/.test(String(boek.isbn || ''))) {
        var opIsbn = olZoek('isbn=' + boek.isbn);
        if (opIsbn.limiet) { limiet = true; code = opIsbn.code; break; }
        if (opIsbn.docs.length && opIsbn.docs[0].cover_i) { cover = opIsbn.docs[0].cover_i; bron = CV_ANDERE_UITGAVE; }
        Utilities.sleep(CV_PAUZE_MS);
      }
      if (!cover && !isLeeg(boek.titel)) {
        var vraag = 'title=' + encodeURIComponent(titelSleutel(boek.titel)) + (achternaam(boek.auteur) ? '&author=' + encodeURIComponent(achternaam(boek.auteur)) : '');
        var opTitel = olZoek(vraag);
        if (opTitel.limiet) { limiet = true; code = opTitel.code; break; }
        cover = kiesOlWerk(boek, opTitel.docs);
        if (cover) bron = CV_TITEL_AUTEUR;
        Utilities.sleep(CV_PAUZE_MS);
      }
      var velden = { cover_gezocht: vandaag };
      if (cover) { velden.cover_url = olCoverUrl(cover); velden.cover_bron = bron; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 20 === 0) bewaarAchtergrond(tabel);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftAndereUitgaveNodig).length;
  } finally {
    stopAchtergrond('zoekCoversAndereUitgaven');
  }
  verwijderTriggers('zoekCoversAndereUitgaven');
  if (rest > 0) ScriptApp.newTrigger('zoekCoversAndereUitgaven').timeBased().after((limiet ? 30 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversAndereUitgaven', verwerkt + ' opgezocht, ' + gevonden + ' covers van andere uitgaven gevonden, ' + rest + ' te gaan' + (limiet ? ' (Open Library weigert, code ' + code + ': vanuit Apps Script gaat het traag. Sneller: Bestuursscherm > Boeken > Zoek ontbrekende covers)' : ''));
  var tekst = verwerkt + ' boeken opgezocht, ' + gevonden + ' covers gevonden.';
  tekst += rest > 0 ? ' Nog ' + rest + ' te gaan: het script gaat vanzelf verder.' : ' Alles is verwerkt. Kijk de covers met cover_bron "' + CV_TITEL_AUTEUR + '" even na.';
  try { spreadsheet().toast(tekst, 'Madrigal', 15); } catch (e) { Logger.log(tekst); }
}

/* ---------- Internet Archive ---------- */

/*
 * Internet Archive (archive.org) heeft miljoenen ingescande boeken, ook oudere en tweedehands
 * uitgaven. We zoeken op ISBN (13 en 10 cijfers) en nemen de afbeelding van het gevonden boek:
 * meestal een scan of foto van de voorkant. Elk opgezocht boek krijgt een datum in ia_gezocht.
 */

/** Menu: zoekt covers bij bol.com, in porties. */
function zoekCoversBol() {
  var start = Date.now();
  if (wachtOpDaglimiet('zoekCoversBol')) return;
  var inst = leesInstellingen();
  var t = bolToken(inst);
  if (t.fout) { logboek('menu', 'zoekCoversBol', t.fout); meld(t.fout); return; }
  if (!startAchtergrond('zoekCoversBol')) { meldAlBezig('zoekCoversBol'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('bol_gezocht') === -1) { meld('De kolom bol_gezocht ontbreekt nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftBolNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > BOL_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = bolVraag('/products/' + boek.isbn + '/media', t.token);
      if (r.code === 401) { t = bolToken(inst); if (t.fout) { fout = t.fout; break; } r = bolVraag('/products/' + boek.isbn + '/media', t.token); }
      if (r.code === 429 || r.code >= 500) { wachten = true; fout = 'code ' + r.code; break; }
      if (r.code >= 400 && r.code !== 404) { fout = 'code ' + r.code + (r.data && r.data.title ? ': ' + r.data.title : ''); break; }
      var url = r.code === 200 ? bolAfbeelding(r.data) : '';
      var velden = { bol_gezocht: vandaag };
      if (url) { velden.cover_url = url; velden.cover_bron = 'bol.com'; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 25 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(BOL_PAUZE_MS);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftBolNodig).length;
  } finally {
    stopAchtergrond('zoekCoversBol');
  }
  verwijderTriggers('zoekCoversBol');
  if (rest > 0 && (!fout || wachten)) ScriptApp.newTrigger('zoekCoversBol').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversBol', verwerkt + ' opgezocht, ' + gevonden + ' covers gevonden, ' + rest + ' te gaan' + (fout ? '. bol.com meldt: ' + fout : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij bol.com, ' + gevonden + ' covers gevonden.' + (fout ? ' bol.com meldt: ' + fout : ''), 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/** Menu: zoekt covers bij Internet Archive, in porties. */
function zoekCoversInternetArchive() {
  var start = Date.now();
  if (wachtOpDaglimiet('zoekCoversInternetArchive')) return;
  if (!startAchtergrond('zoekCoversInternetArchive')) { meldAlBezig('zoekCoversInternetArchive'); return; }
  var verwerkt = 0, gevonden = 0, rest = 0, wachten = false, fout = '';
  try {
    var tabel = leesTabel('Catalogus');
    if (tabel.kop.indexOf('ia_gezocht') === -1) { meld('De kolom ia_gezocht ontbreekt nog. Voer eerst Madrigal > Installeer tabbladen uit.'); return; }
    var vandaag = vandaagTekst();
    var teDoen = tabel.rijen.filter(heeftIaNodig);
    for (var i = 0; i < teDoen.length; i++) {
      if (Date.now() - start > CV_MAX_LOOPTIJD_MS) break;
      var boek = teDoen[i];
      var r = haalJson(iaZoekUrl(boek.isbn));
      if (r.code === 429 || r.code >= 500 || !r.data) { wachten = true; fout = 'code ' + r.code; break; }
      var url = iaCoverUitAntwoord(r.data);
      // Heeft het boek bij Internet Archive geen afbeelding, dan toont die het eigen logo: dat nemen we niet.
      if (url && !iaCoverIsEcht(url)) url = '';
      var velden = { ia_gezocht: vandaag };
      if (url) { velden.cover_url = url; velden.cover_bron = IA_BRON; gevonden++; }
      wijzig(boek, velden);
      verwerkt++;
      if (verwerkt % 25 === 0) bewaarAchtergrond(tabel);
      Utilities.sleep(CV_PAUZE_MS);
    }
    bewaarAchtergrond(tabel);
    rest = tabel.rijen.filter(heeftIaNodig).length;
  } finally {
    stopAchtergrond('zoekCoversInternetArchive');
  }
  verwijderTriggers('zoekCoversInternetArchive');
  if (rest > 0) ScriptApp.newTrigger('zoekCoversInternetArchive').timeBased().after((wachten ? 15 : 1) * 60 * 1000).create();
  if (gevonden) leegCache();
  logboek('menu', 'zoekCoversInternetArchive', verwerkt + ' opgezocht, ' + gevonden + ' covers gevonden, ' + rest + ' te gaan' + (fout ? ' (Internet Archive: ' + fout + ', later verder)' : ''));
  try { spreadsheet().toast(verwerkt + ' boeken opgezocht bij Internet Archive, ' + gevonden + ' covers gevonden.', 'Madrigal', 15); } catch (e) { Logger.log(fout); }
}

/* ---------- Bewaarde covers van Internet Archive nakijken ---------- */

/** Menu: boeken zonder cover nog eens laten opzoeken bij Google (maakt gb_gecontroleerd leeg). */
function zoekCoversOpnieuw() {
  var tabel = leesTabel('Catalogus');
  var n = 0;
  tabel.rijen.forEach(function (b) {
    if ((isLeeg(b.cover_url) || isLeeg(b.beschrijving) || heeftWikiBeschrijving(b)) && !isLeeg(b.gb_gecontroleerd) && /^\d{13}$/.test(String(b.isbn || ''))) {
      wijzig(b, { gb_gecontroleerd: '' });
      n++;
    }
  });
  bewaarTabel(tabel);
  logboek('menu', 'zoekCoversOpnieuw', n + ' boeken zonder cover of beschrijving (of met een tekst van Wikipedia) komen opnieuw aan de beurt bij Google');
  meld(n + ' boeken zonder cover of beschrijving (of met een tekst van Wikipedia) komen opnieuw aan de beurt bij Google. Gebruik daarna de knop in het bestuursscherm: Boeken > Zoek ontbrekende covers en beschrijvingen.');
}

/**
 * Menu: zoek de boeken van vandaag opnieuw bij Internet Archive. Raakte de daglimiet van Google op
 * tijdens de controle van een afbeelding, dan kreeg een boek vroeger onterecht "geen cover".
 * We weten niet welk boek, dus we wissen de stempel van alle boeken die vandaag zonder cover bleven.
 */
function zoekIaVanVandaagOpnieuw() {
  var tabel = leesTabel('Catalogus');
  var boeken = iaZonderCoverOp(tabel.rijen, vandaagTekst());
  boeken.forEach(function (b) { wijzig(b, { ia_gezocht: '' }); });
  if (boeken.length && !bewaarAchtergrond(tabel)) { meld('Het is even druk. Probeer het over een minuut opnieuw.'); return; }
  logboek('menu', 'zoekIaVanVandaagOpnieuw', boeken.length + ' boeken opnieuw bij Internet Archive');
  if (boeken.length) planTaak('zoekCoversInternetArchive', 60 * 1000);
  meld(boeken.length ? boeken.length + ' boeken worden opnieuw opgezocht bij Internet Archive. Dat begint over een minuut, of later als de daglimiet van Google nog op is.' : 'Geen boeken van vandaag zonder cover bij Internet Archive.');
}

/** Vanzelf, elk uur (vanuit verwerkNieuweBoekenAutomatisch). */
function zoekOpnieuwAutomatisch() {
  var uit = zoekOpnieuwUitvoeren();
  if (uit.cover || uit.beschrijving || uit.film) logboek('systeem', 'zoekOpnieuw', zoekOpnieuwTekst(uit));
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

/** Menu: Covers > Zoek opnieuw bij boeken met nieuwe gegevens. */
function zoekOpnieuwMenu() {
  var uit = zoekOpnieuwUitvoeren();
  var tekst = uit.cover || uit.beschrijving || uit.film ? zoekOpnieuwTekst(uit) : 'Geen enkel boek kreeg nieuwe gegevens sinds de vorige keer.';
  logboek('menu', 'zoekOpnieuw', tekst);
  meld(tekst);
}

function zoekOpnieuwTekst(uit) {
  return 'Het script zoekt opnieuw: ' + uit.cover + ' boeken naar een cover, ' + uit.beschrijving + ' boeken naar een beschrijving, ' +
    uit.film + ' films. De zoektochten starten vanzelf, na elkaar, binnen het uur.';
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

/**
 * Ronde 1: zoekt het boek in de Catalogus, van zeker naar minder zeker. Geeft { boek, hoe } of null.
 *   isbn:   zelfde ISBN (ook isbn_origineel);
 *   titel:  zelfde titel en een gemeenschappelijke auteur (ook "Sappho" en "Lesbos, Sappho van");
 *   kern:   zelfde titel zonder ondertitel, lidwoorden en "en/and/&", en een gemeenschappelijke auteur;
 *   bijna:  een gemeenschappelijke auteur en een gelijkende titel (zie oudTitelGelijk), duidelijk de beste;
 *   titel zonder auteur: geen auteur op de oude website, en de titel staat maar één keer in de Catalogus.
 */
function zoekOudBoek(oud, index, bezet) {
  bezet = bezet || {};
  if (oud.isbn && index.isbn[oud.isbn]) return { boek: index.isbn[oud.isbn], hoe: 'isbn' };
  var deeltAuteur = function (c) { return auteursDelen(oud.auteur, c.auteur); };
  var t = normaliseerTekst(oud.titel), k = oudTitelKern(oud.titel);
  var titels = [t];
  if (oud.ondertitel) titels.push(normaliseerTekst(oud.titel + ' ' + oud.ondertitel));
  for (var i = 0; i < titels.length; i++) {
    var zelfde = (index.titel[titels[i]] || []).filter(deeltAuteur);
    if (zelfde.length) return { boek: zelfde[0], hoe: 'titel' };
  }
  var kernZelfde = k ? (index.kern[k] || []).filter(deeltAuteur) : [];
  if (kernZelfde.length) return { boek: kernZelfde[0], hoe: 'kern' };
  // Bijna dezelfde titel bij dezelfde auteur. Twee verschillende boeken van die auteur even gelijk: dan niet raden.
  // Staat hetzelfde boek twee keer in de Catalogus (zelfde titel), dan is dat geen twijfel: we nemen het eerste vrije.
  var scores = oudKandidatenPerAuteur(oud, index).map(function (c) { return { c: c, g: oudTitelGelijk(oud, c) }; })
    .sort(function (x, y) { return y.g - x.g; });
  if (scores.length && scores[0].g >= 0.8) {
    var kernBest = oudTitelKern(scores[0].c.titel);
    var zelfdeBoek = scores.filter(function (x) { return oudTitelKern(x.c.titel) === kernBest; });
    var ander = scores.filter(function (x) { return oudTitelKern(x.c.titel) !== kernBest; })[0];
    if (!ander || scores[0].g - ander.g >= 0.05) {
      var vrij = zelfdeBoek.filter(function (x) { return !bezet[String(x.c.boek_id)]; })[0] || zelfdeBoek[0];
      return { boek: vrij.c, hoe: 'bijna' };
    }
  }
  // Geen auteur op de oude website: zelfde titel, als die maar één keer in de Catalogus staat.
  if (!auteurWoorden(oud.auteur).length && k && (index.kern[k] || []).length === 1) return { boek: index.kern[k][0], hoe: 'titel zonder auteur' };
  return null;
}

/**
 * Ronde 2, enkel voor wat ronde 1 niet vond, en enkel bij boeken in de Catalogus die nog vrij zijn
 * (bezet: { boek_id: true }). Telkens moet het antwoord uniek zijn, anders laten we het voor Na te kijken.
 *   titel uniek:  zelfde titel (kern), en die titel staat maar één keer bij de vrije boeken én bij de
 *                 overgebleven oude boeken. Ook als de auteur anders is (bv. de uitgever stond als auteur).
 *   titel bijna:  één enkel vrij boek met een gelijkende titel (oudTitelGelijk vanaf 0,85), minstens 10 letters.
 *   auteur uniek: dezelfde auteur heeft maar één vrij boek in de Catalogus en maar één overgebleven oud boek
 *                 (bv. een vertaling: "Nightwood" en "Nachtwoud" van Djuna Barnes).
 * rest: de oude boeken die na ronde 1 overblijven (om te tellen).
 */
function zoekOudBoekRuim(oud, index, bezet, rest) {
  var vrij = function (c) { return !bezet[String(c.boek_id)]; };
  // Een boek dat twee keer op de oude website stond (zelfde titel en auteur), telt als één.
  var sleutel = function (o) { return oudTitelKern(o.titel) + '|' + normaliseerTekst(o.auteur); };
  var uniek = function (lijst) { var gezien = {}; return lijst.filter(function (o) { var x = sleutel(o); return gezien[x] ? false : (gezien[x] = true); }); };
  var k = oudTitelKern(oud.titel);
  if (k && k.length >= 8) {
    var zelfde = (index.kern[k] || []).filter(vrij);
    var oudZelfde = uniek(rest.filter(function (o) { return oudTitelKern(o.titel) === k; }));
    if (zelfde.length === 1 && oudZelfde.length === 1) return { boek: zelfde[0], hoe: 'titel uniek' };
  }
  if (k && k.length >= 10) {
    var bijna = index.alle.filter(function (c) { return vrij(c) && oudTitelGelijk(oud, c) >= 0.85; });
    if (bijna.length === 1) return { boek: bijna[0], hoe: 'titel bijna' };
  }
  // Dezelfde auteur (meestal een vertaling: "Nightwood" en "Nachtwoud", "Mädchen in Uniform" en "Meisjes in uniform").
  var vanAuteur = oudKandidatenPerAuteur(oud, index).filter(vrij);
  var oudVanAuteur = uniek(rest.filter(function (o) { return auteursDelen(o.auteur, oud.auteur); }));
  if (vanAuteur.length === 1) {
    // Eén vrij boek van die auteur: het gaat naar het oude boek met de meest gelijkende titel, als dat duidelijk is.
    var rang = oudVanAuteur.map(function (o) { return { o: o, g: oudTitelGelijk(o, vanAuteur[0]) }; }).sort(function (x, y) { return y.g - x.g; });
    if (rang.length && sleutel(rang[0].o) === sleutel(oud) && (rang.length === 1 || rang[0].g - rang[1].g >= 0.1)) return { boek: vanAuteur[0], hoe: 'auteur uniek' };
  } else if (vanAuteur.length > 1 && oudVanAuteur.length === 1) {
    // Eén oud boek van die auteur, meerdere vrije: enkel als één titel duidelijk het meest lijkt.
    var keuze = vanAuteur.map(function (c) { return { c: c, g: oudTitelGelijk(oud, c) }; }).sort(function (x, y) { return y.g - x.g; });
    if (keuze[0].g >= 0.6 && keuze[0].g - keuze[1].g >= 0.15) return { boek: keuze[0].c, hoe: 'auteur uniek' };
  }
  return null;
}

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

/** Een lijst namen zonder de namen van een thema (Feminisme, Poëzie, ...): die staan al bij de thema's. */
function zonderThemas(namen) {
  return (namen || []).filter(function (n) { return !themaExact(n); });
}

/**
 * Lichte versie van installeer: maakt enkel de genoemde tabbladen aan en voegt ontbrekende kolommen toe.
 * Andere tabbladen blijven onaangeroerd (installeer ordent en herschikt alles, dat duurt en springt rond).
 */
function zorgVoorTabbladen(namen) {
  var ss = spreadsheet();
  namen.forEach(function (naam) {
    var kolommen = KOLOMMEN[naam];
    if (!kolommen) return;
    var blad = ss.getSheetByName(naam);
    if (!blad) {
      blad = maakTabblad(naam);
      blad.getRange(1, 1, 1, kolommen.length).setValues([kolommen]);
      opmaakKop(blad, kolommen.length);
      return;
    }
    var kop = blad.getLastRow() > 0 ? blad.getRange(1, 1, 1, Math.max(1, blad.getLastColumn())).getValues()[0].map(schoon) : [];
    var ontbrekend = kolommen.filter(function (k) { return kop.indexOf(k) === -1; });
    if (!ontbrekend.length) return;
    var start = kop.some(function (k) { return k; }) ? blad.getLastColumn() + 1 : 1;
    blad.getRange(1, start, 1, ontbrekend.length).setValues([ontbrekend]);
    opmaakKop(blad, blad.getLastColumn());
  });
}
