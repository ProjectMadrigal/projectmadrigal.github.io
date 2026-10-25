/**
 * DagelijkseMail.js
 * Elke ochtend een korte mail aan het bestuur, enkel als er iets wacht:
 *   - voorstellen van vrijwilligers voor Nieuws en Agenda (nog niet goedgekeurd);
 *   - aanvragen van de website (online reserveren);
 *   - boeken die te laat zijn.
 *
 * Staat uit zolang de instelling dagelijkse_mail leeg is. Vul daar een of meer mailadressen
 * in (gescheiden door komma's). Het uur kies je met dagelijkse_mail_uur. Na een ander uur:
 * Madrigal > Installeer tabbladen, dan plant het script de mail opnieuw.
 *
 * De eerste keer vraagt Google toestemming om mails te versturen: kies
 * Madrigal > Onderhoud > Stuur nu een testmail en volg de stappen.
 */

/**
 * Maakt de mail, zonder iets te versturen. Geeft { onderwerp, tekst } of null als er niets wacht.
 * g: { vandaagTekst, link, voorstellen: [{ tabblad, titel, wie }], aanvragen: [{ titel, datum }],
 *      telaat: [{ titel, lenersnummer, voornaam, vervaldatum }] }
 */
function dagelijkseMailInhoud(g) {
  var delen = [];
  var aantal = 0;
  if ((g.voorstellen || []).length) {
    aantal += g.voorstellen.length;
    delen.push('Voorstellen van vrijwilligers om na te lezen (' + g.voorstellen.length + '):\n' + g.voorstellen.map(function (v) {
      return '- ' + v.tabblad + ': ' + v.titel + (v.wie ? ' (van ' + v.wie + ')' : '');
    }).join('\n'));
  }
  if ((g.aanvragen || []).length) {
    aantal += g.aanvragen.length;
    delen.push('Aanvragen van de website (' + g.aanvragen.length + '):\n' + g.aanvragen.map(function (a) {
      return '- ' + a.titel + (a.datum ? ', sinds ' + korteDatum(a.datum) : '');
    }).join('\n'));
  }
  if ((g.telaat || []).length) {
    aantal += g.telaat.length;
    delen.push('Te laat (' + g.telaat.length + '):\n' + g.telaat.map(function (u) {
      return '- ' + u.titel + ', lener ' + u.lenersnummer + (u.voornaam ? ' (' + u.voornaam + ')' : '') + ', moest terug op ' + korteDatum(u.vervaldatum);
    }).join('\n'));
  }
  if (!aantal) return null;
  return {
    onderwerp: 'Project Madrigal: ' + aantal + (aantal === 1 ? ' ding wacht' : ' dingen wachten') + ' op het bestuur',
    tekst: 'Goeiemorgen,\n\nDit wacht vandaag (' + g.vandaagTekst + ') op het bestuur.\n\n' + delen.join('\n\n') +
      '\n\nAlles afhandelen doe je in het bestuursscherm: ' + g.link +
      '\n\nDeze mail komt enkel als er iets wacht. Uitzetten: maak de instelling dagelijkse_mail leeg.'
  };
}

/** Verzamelt wat wacht, uit de spreadsheet. */
function dagelijkseMailGegevens() {
  var staat = laadStaat('dagelijkse mail', false);
  var voorstellen = [];
  VOORSTEL_TABBLADEN.forEach(function (naam) {
    if (!spreadsheet().getSheetByName(naam)) return;
    leesTabel(naam).rijen.forEach(function (r) {
      if (!isLeeg(r.voorgesteld_door) && jaNee(r.publiek) === 'nee') voorstellen.push({ tabblad: naam, titel: schoon(r.titel) || '(zonder titel)', wie: schoon(r.voorgesteld_door) });
    });
  });
  var aanvragen = spreadsheet().getSheetByName('Aanvragen') ? openAanvragen(leesTabel('Aanvragen').rijen) : [];
  var telaat = lopendeUitleningen(staat).map(function (u) { return uitleningInfo(staat, u, false); })
    .filter(function (i) { return i.status && i.status.code === 'telaat'; })
    .sort(function (a, b) { return String(a.vervaldatum).localeCompare(String(b.vervaldatum)); });
  return {
    vandaagTekst: datumTekst(staat.vandaag),
    link: 'https://projectmadrigal.github.io/bestuur.html',
    voorstellen: voorstellen,
    aanvragen: aanvragen.map(function (a) { return { titel: a.titel, datum: a.datum }; }),
    telaat: telaat
  };
}

/** Planning: elke ochtend. Doet niets zolang dagelijkse_mail leeg is. */
function stuurDagelijkseMail() {
  var aan = splitsLijst(leesInstellingen().dagelijkse_mail).filter(geldigEmail);
  if (!aan.length) return;
  var mail = dagelijkseMailInhoud(dagelijkseMailGegevens());
  if (!mail) return;
  MailApp.sendEmail({ to: aan.join(','), subject: mail.onderwerp, body: mail.tekst, name: 'Project Madrigal' });
  logboek('planning', 'dagelijkse mail', 'verstuurd naar ' + aan.length + ' adres(sen)');
}

/** Menu: stuurt meteen een mail, ook als er niets wacht. Vraagt de eerste keer toestemming. */
function stuurTestmail() {
  var aan = splitsLijst(leesInstellingen().dagelijkse_mail).filter(geldigEmail);
  if (!aan.length) { meld('Vul eerst in Instellingen bij dagelijkse_mail een mailadres in.'); return; }
  var mail = dagelijkseMailInhoud(dagelijkseMailGegevens()) || {
    onderwerp: 'Project Madrigal: testmail', tekst: 'Dit is een testmail. Er wacht vandaag niets op het bestuur.'
  };
  MailApp.sendEmail({ to: aan.join(','), subject: '[test] ' + mail.onderwerp, body: mail.tekst, name: 'Project Madrigal' });
  meld('Testmail verstuurd naar ' + aan.join(', ') + '.');
}
