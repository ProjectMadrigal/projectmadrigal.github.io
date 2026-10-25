# Ontwikkelen aan de website van Project Madrigal

Voor wie aan de code werkt. De handleiding voor het bestuur en de vrijwilligers staat in [README.md](README.md).

Queer bibliotheek in Antwerpen, gedragen door vrijwilligers. Deze repository is de volledige website op https://projectmadrigal.github.io/ (GitHub Pages, branch `main`, map root). Het bestuur bestaat niet uit ontwikkelaars: leg wijzigingen uit in het Nederlands, kort en concreet, en zeg bij elke wijziging wat die in de spreadsheet nog vraagt.

## Harde regels
- De repository is **publiek**. Nooit gegevens van boeken, leners of schenkers, codes, sleutels of mailadressen van leners in code, tests of voorbeelden. Tests en `voorbeeld/` gebruiken verzonnen namen.
- Alle gegevens blijven in de Google-spreadsheet. De codes (`toegangscode_balie`, `code_vrijwilliger`, `code_bestuur`) zijn een drempel, geen beveiliging. Sleutels (`google_books_api_key`, `goatcounter_api_sleutel`, `bol_client_secret`) blijven op de server: zet ze in `BEHEER_GEHEIM` (`Beheer.js`).
- Geen framework, geen build-stap: gewone HTML, CSS en JavaScript, zodat vrijwilligers het later kunnen aanpassen.
- Toegankelijkheid: echte knoppen en labels, focus, `prefers-reduced-motion`, contrast in licht én donker. Let op: `.knop` negeert het attribuut `hidden`, gebruik `disabled` of haal het element weg.
- Schrijfstijl in teksten: jij-vorm (nooit u), actief, kort, geen gedachtestreepjes, geen puntkomma's.
- Commits en pull requests: auteur "Project Madrigal Beheer <info@projectmadrigal.be>", zonder extra regels zoals Co-Authored-By of een vermelding van een hulpmiddel.

## Opbouw
- **Publiek:** `index.html` + `home.js` (startpagina), `boeken.html` + `app.js`, `zoeken.js`, `filters.js` (catalogus, leeslijsten op `#/leeslijsten`, "Lees ook" in `filters.gelijkaardig`), `over-ons.html`, `doe-mee.html` + `doemee.js`, `404.html` (oude adressen doorsturen). `sw.js`: offline en installeerbaar, altijd eerst het net, `/rooster/` blijft erbuiten.
- **Gedeeld:** `layout.js` (kop, menu met verborgen item Leeslijsten, taalknop, donkere modus, voet, GoatCounter), `i18n.js` (alle vaste teksten NL/EN), `dom.js` (hulpfuncties, `plaatshouder()` voor covers), `api.js`, `config.js` (URL van de web-app, code van GoatCounter).
- **Afgeschermd:** `balie.html` + `balie.js` (uitleenscherm), `bestuur.html` en `vrijwilliger.html` (zelfde `bestuur.js` + `bestuur-beheer.js`, het attribuut `data-scherm="vrijwilliger"` filtert de onderdelen), `beheer.js` (aanmelden, rooster-weergave, opnieuw proberen bij "even druk"). Script-tags hebben `?v=N`: verhoog N als je zo'n bestand wijzigt.
- **Rollen:** `balie < vrijwilliger < bestuur` (`ROL_RANG` en `ACTIES` in `Api.js`). Vrijwilligers zien geen contactgegevens (`vrijwilligerData`), stellen nieuws en agenda enkel voor (`voorgesteld_door`, verborgen tot het bestuur goedkeurt) en zetten de leeslijsten niet zelf online.
- **Stijl:** `styles.css`. Kleurtokens bovenaan (`--kleur-…`), met een donkere variant onder zowel `prefers-color-scheme: dark` als `[data-theme="dark"]`. Huisstijl: geel `#FFCD30`, paars `#6B3597`/`#9C59D1`, donker `#1B1B1C`, lettertype Geist Mono.
- **Backend:** `apps-script/*.js` (Google Apps Script, web-app met `doGet`/`doPost` in `Api.js`). Belangrijk: `Instellingen.js` (standaardinstellingen), `Ordenen.js` (groepen in Instellingen, volgorde tabbladen), `Opslag.js` (kolommen per tabblad, `wijzig`, `bewaarAchtergrond`), `Site.js` (`?actie=site`), `Publiek.js` (`?actie=catalogus`, leeslijsten), `Beheer.js` (alles wat het bestuursscherm aanpast), `Bezoekers.js` (GoatCounter), `Rooster.js`.
- **Achtergrondtaken** (Wikipedia, vertalen, covers zoeken) houden het script-slot niet vast: `startAchtergrond`/`stopAchtergrond` en `bewaarAchtergrond`. Nieuwe lange taken volgen datzelfde patroon, anders krijgen balie en bestuur "Het is even druk".
- **Cache:** publieke catalogus en startpagina per dag (`dagSleutel`), zodat geplande inhoud op de juiste dag verschijnt. `leegCache()` na elke wijziging.

## Werkwijze bij een wijziging
1. Wijzig in `apps-script/` en voer daarna **`node tools/bundel.js`** uit: dat maakt `madrigal-script.gs`. Nooit met de hand aanpassen.
2. Tests: `node tests/run.js` en `BUNDEL=1 node tests/run.js`. Nieuwe logica in Apps Script krijgt een test in `tests/run.js` (nieuw bestand toevoegen in `tests/laad.js`). Browsertests: `node tests/browser.js` (Playwright, met nagebootste web-app).
3. Nieuwe instelling? Toevoegen in `STANDAARD_INSTELLINGEN` (`Instellingen.js`) **én** in een groep in `Ordenen.js`. Een test controleert dat. Een nieuwe toegangscode ook in `CODE_INSTELLINGEN` (`Menu.js`).
4. Nieuwe tekst op de publieke site? In `i18n.js`, in `nl` en `en`. Bestuurs- en vrijwilligersscherm zijn enkel Nederlands.
5. Werk op een branch (niet `claude/...`), open een pull request en merge pas als de GitHub-tests slagen. Daarna de lokale branch verwijderen.
6. **Apps Script wordt automatisch bijgewerkt** door `.github/workflows/apps-script.yml` bij elke push naar `main` (clasp, nieuwe versie van dezelfde implementatie). Niets meer plakken of publiceren.
7. Vertel de gebruiker wat nog met de hand moet: meestal **Madrigal > Installeer tabbladen** (nieuwe kolommen of instellingen) en Ctrl+F5.
8. **Nieuwe Google-dienst** (MailApp, GmailApp, CalendarApp, ...) vraagt een nieuwe toestemming. Tot de eigenaar die geeft, werkt de web-app niet. Zo'n wijziging nooit zomaar mergen: eerst met de gebruiker afspreken wanneer die meteen toestemming geeft.

## Wat de gebruiker zelf beheert, zonder code
Nieuws, Agenda, Veelgestelde vragen, Leeslijsten (ook via het bestuursscherm), Instellingen (teksten, adres, openingsuren, aanraders), Catalogus (boeken, `aanrader`, `startpagina`, `leeslijsten`, covers, beschrijvingen). Verwijs daarheen voor je code schrijft.

## Verwante repository
`ProjectMadrigal/rooster`: het vrijwilligersrooster, een aparte tool met eigen spreadsheet en script, online op `/rooster/`. De catalogus leest het rooster via de instelling `rooster_url`.
