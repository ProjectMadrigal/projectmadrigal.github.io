/**
 * Backup.js
 * Elke week een kopie van de hele spreadsheet in een map op Google Drive.
 * De oudste kopieën gaan vanzelf naar de prullenbak, zodat er nooit meer dan
 * backup_bewaren kopieën zijn.
 *
 * Een kopie terugzetten? Open ze in Drive en kopieer de rijen die je nodig hebt
 * terug naar de echte spreadsheet. Werk nooit verder in een kopie: de website
 * leest enkel de echte spreadsheet.
 *
 * Let op: een kopie bevat ook de gegevens van leners. Die blijven er dus nog
 * enkele weken in staan nadat de privacy-opruiming ze uit de echte spreadsheet wiste.
 */

var BACKUP_VOORVOEGSEL = 'Madrigal back-up ';

/** De naam van een back-up: "Madrigal back-up 2026-10-24". */
function backupNaam(vandaag) {
  return BACKUP_VOORVOEGSEL + vandaag;
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

/** De map voor de back-ups. Bestaat ze nog niet, dan maken we ze. */
function backupMap(naam) {
  var mappen = DriveApp.getFoldersByName(naam);
  return mappen.hasNext() ? mappen.next() : DriveApp.createFolder(naam);
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
