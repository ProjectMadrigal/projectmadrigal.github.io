/* Zet het gekozen thema (licht of donker) meteen, voor de pagina tekent: zo flitst ze niet. Staat in een
   apart bestand (niet in de pagina) zodat de beveiligingsregel (Content-Security-Policy) geen inline scripts hoeft toe te laten. */
try { var t = localStorage.getItem('madrigal_thema'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
