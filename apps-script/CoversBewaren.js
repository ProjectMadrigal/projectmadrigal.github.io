/**
 * CoversBewaren.js
 * Kopieert covers die nog van een andere site komen (Google Books, Open Library, Internet Archive, bol.com, ...)
 * naar de map met covers op Google Drive (instelling cover_map), zoals de covers van de oude website.
 *
 *   - Waarom: een andere site kan een afbeelding weghalen of verplaatsen. Een kopie in Drive blijft.
 *   - De oorspronkelijke link komt in de kolom cover_origineel. cover_bron blijft zoals het was.
 *   - Een link naar Google Drive of naar deze website kopieert het script niet: die staat al goed.
 *   - Lukt het niet (de afbeelding bestaat niet meer, of is te klein of een standaardplaatje), dan blijft de cover
 *     zoals ze is en krijgt cover_bewaard "mislukt" + de datum: het script probeert die link niet opnieuw.
 *     Opnieuw proberen? Maak die cel leeg. Een nieuwe link in cover_url probeert het vanzelf.
 *   - Werkt in porties op de achtergrond. De waakhond (elk uur) start het vanzelf als er nieuwe covers van
 *     een andere site bijkomen.
 */

var CB_MAX_LOOPTIJD_MS = 4 * 60 * 1000;
var CB_MISLUKT = 'mislukt ';
var CB_POGING = 'poging ';
var CB_MAX_POGINGEN = 3;     // zo vaak een fout van de site (storing, te druk) voor de cover als mislukt telt
var CB_MAX_FOUTEN_NA_ELKAAR = 5; // zoveel covers na elkaar met een fout: dan is er echt een storing (bv. bij Google), ronde stoppen
var CB_MIN_PIXELS = 50; // kleiner is geen echte cover (bv. een leeg plaatje van 1 op 1)

/** Komt deze cover nog van een andere site? (niet van Google Drive en niet van deze website) */
function isExterneCover(url) {
  var u = schoon(url);
  if (!/^https?:\/\//i.test(u)) return false;
  if (/^https:\/\/lh3\.googleusercontent\.com\/d\//i.test(u)) return false;   // al in Drive
  if (/^https:\/\/drive\.google\.com\//i.test(u)) return false;
  if (/^https:\/\/projectmadrigal\.github\.io\//i.test(u)) return false;     // op de website zelf
  return true;
}

/** Moet de cover van dit boek nog naar Drive? */
function heeftCoverBewarenNodig(boek) {
  if (!isExterneCover(boek.cover_url)) return false;
  // Mislukt voor precies deze link: niet opnieuw. Een nieuwe link (bv. zelf aangepast) probeert het wel.
  return !(String(boek.cover_bewaard || '').indexOf(CB_MISLUKT) === 0 && schoon(boek.cover_origineel) === schoon(boek.cover_url));
}

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

/** Menu: Covers > Bewaar alle covers in Google Drive. Start op de achtergrond. */
function startCoversBewaren() {
  zorgVoorTabbladen(['Catalogus']); // kolommen cover_origineel en cover_bewaard
  planTaak('bewaarCoversInDrive', 60 * 1000);
  var n = leesTabel('Catalogus').rijen.filter(heeftCoverBewarenNodig).length;
  meld(n + ' covers komen nog van een andere site. Het kopiëren naar Google Drive start binnen een minuut op de achtergrond ' +
    'en gaat vanzelf verder. Je kan gewoon verder werken. Het Logboek toont elke ronde.');
}

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
