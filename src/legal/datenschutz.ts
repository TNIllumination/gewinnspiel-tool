import { getPlatform, type PlatformId } from "@/platforms/base";
import { MissingOrganizerError, type Organizer } from "./teilnahmebedingungen";

// Die Datenschutzerklaerung fuer die veroeffentlichten Seiten.
//
// Warum sie noetig ist — zwei voneinander unabhaengige Gruende:
//   1. Beim Aufruf verarbeitet GitHub als Hoster die IP-Adresse der Besucher
//   2. Auf der Seite selbst stehen die Benutzernamen der Teilnehmer
// Beides ist nach Art. 13 DSGVO informationspflichtig. Das Impressum
// (§ 5 DDG) deckt das nicht ab, das ist eine andere Pflicht.
//
// Erzeugt statt abgeschrieben, aus demselben Grund wie bei den
// Teilnahmebedingungen: Eine Vorlage behauptet Dinge, die hier nicht
// zutreffen — und falsche Angaben sind schlimmer als gar keine.

/// Anschrift laut GitHubs eigener Datenschutzerklaerung.
const GITHUB_ANSCHRIFT =
  "GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA";
const GITHUB_ERKLAERUNG =
  "https://docs.github.com/site-policy/privacy-policies/github-privacy-statement";

export interface PrivacyOptions {
  /// Tage, nach denen die Teilnehmerdaten oertlich geloescht werden.
  retentionDays: number;
  /// Monate, die eine veroeffentlichte Seite online bleibt.
  publishRetentionMonths: number;
  /// Tatsaechlich genutzte Plattformen — ohne den Testmodus.
  platforms: PlatformId[];
}

function platformNames(platforms: PlatformId[]): string {
  const namen = platforms
    .filter((p) => p !== "SANDBOX")
    .map((p) => getPlatform(p).label);
  if (namen.length === 0) return "der jeweiligen Plattform";
  if (namen.length === 1) return namen[0];
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("de-DE", {
    dateStyle: "long",
    timeZone: "Europe/Berlin",
  });
}

export function buildPrivacyPolicy(
  who: Organizer,
  options: PrivacyOptions,
  stand: Date = new Date(),
): string {
  if (!who.organizer?.trim() || !who.contact?.trim()) {
    throw new MissingOrganizerError();
  }

  const plattformen = platformNames(options.platforms);
  const lines: string[] = [];
  const add = (...parts: string[]) => lines.push(...parts);

  add(`Datenschutzerklärung`, `Stand: ${formatDate(stand)}`, "");

  add("1. Verantwortlicher");
  add(`${who.organizer}`);
  add(`Kontakt: ${who.contact}`);
  if (who.impressumUrl?.trim()) add(`Impressum: ${who.impressumUrl.trim()}`);
  if (who.publishBaseUrl?.trim()) {
    add(
      `Diese Erklärung gilt für die unter ${who.publishBaseUrl.replace(/\/+$/, "")} erreichbaren Seiten zu meinen Gewinnspielen.`,
    );
  } else {
    add("Diese Erklärung gilt für die veröffentlichten Seiten zu meinen Gewinnspielen.");
  }
  add("");

  add("2. Beim Aufruf dieser Seiten");
  add(
    `Die Seiten werden über GitHub Pages bereitgestellt (${GITHUB_ANSCHRIFT}). ` +
      "Beim Aufruf überträgt dein Browser technisch notwendige Daten an GitHub — " +
      "insbesondere IP-Adresse, Zeitpunkt, aufgerufene Adresse, übertragene " +
      "Datenmenge, Browsertyp und Betriebssystem. GitHub verarbeitet diese Daten, " +
      "um die Seite auszuliefern und den Betrieb abzusichern. Rechtsgrundlage ist " +
      "Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im sicheren und " +
      "störungsfreien Betrieb. Auf diese Protokolle habe ich keinen Zugriff.",
  );
  add(
    "Die Verarbeitung findet auch in den USA statt. Sie stützt sich auf den " +
      "EU-US Data Privacy Framework, soweit dieser gilt, und im Übrigen auf " +
      "Standardvertragsklauseln nach Art. 46 Abs. 2 lit. c DSGVO.",
  );
  add(`Datenschutzerklärung von GitHub: ${GITHUB_ERKLAERUNG}`, "");

  add("3. Keine Cookies, keine Analyse, keine fremden Inhalte");
  add(
    "Diese Seiten setzen keine Cookies, verwenden keine Analyse- oder " +
      "Reichweitenmessung und laden nichts von fremden Servern nach — keine " +
      "Schriftarten, keine Karten, keine Videos. Es findet keine Profilbildung statt.",
    "",
  );

  add("4. Daten der Teilnehmer am Gewinnspiel");
  add(
    "Verarbeitet werden der öffentlich sichtbare Benutzername, der Kommentartext, " +
      "dessen Zeitpunkt und die Plattform, auf der er abgegeben wurde.",
  );
  add(
    `Herkunft: die öffentlich sichtbaren Kommentare unter dem jeweiligen Beitrag auf ${plattformen}.`,
  );
  add(
    "Zwecke: Durchführung des Gewinnspiels, Prüfung der Teilnahmebedingungen, " +
      "Ermittlung und Benachrichtigung der Gewinner sowie der Nachweis einer " +
      "ordnungsgemäßen Ziehung.",
  );
  add(
    "Rechtsgrundlagen: Art. 6 Abs. 1 lit. b DSGVO für die Durchführung des " +
      "Teilnahmeverhältnisses und Art. 6 Abs. 1 lit. f DSGVO für den Nachweis; " +
      "das berechtigte Interesse liegt in einer nachvollziehbaren, " +
      "manipulationssicheren Verlosung.",
  );
  add(
    "Veröffentlichung: Zum Nachweis der fairen Ziehung werden auf diesen Seiten " +
      "die Teilnehmerliste mit den Benutzernamen, eine Prüfsumme, die verwendete " +
      "Zufallszahl und die Gewinner veröffentlicht. Ohne diese Angaben ließe sich " +
      "die Ziehung nicht überprüfen.",
  );
  add("Eine Weitergabe an weitere Dritte findet nicht statt.", "");

  add("5. Speicherdauer");
  add(
    `Die Teilnehmerdaten werden nach Abschluss des Gewinnspiels gelöscht, ` +
      `spätestens ${options.retentionDays} Tage danach. Die veröffentlichten Seiten ` +
      `bleiben aus Nachweisgründen längstens ${options.publishRetentionMonths} Monate ` +
      "nach Abschluss online und werden anschließend entfernt.",
    "",
  );

  add("6. Verarbeitung durch die Plattformen");
  add(
    `Die Kommentare entstehen auf ${plattformen}. Für die dortige Verarbeitung sind ` +
      "allein die jeweiligen Anbieter verantwortlich; darauf habe ich keinen " +
      "Einfluss. Es gelten deren Datenschutzhinweise.",
    "",
  );

  add("7. Deine Rechte");
  add(
    "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), " +
      "Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und " +
      "Datenübertragbarkeit (Art. 20).",
  );
  add(
    "Gegen Verarbeitungen, die auf Art. 6 Abs. 1 lit. f DSGVO gestützt sind, " +
      "kannst du nach Art. 21 DSGVO Widerspruch einlegen — insbesondere gegen die " +
      "Veröffentlichung deines Benutzernamens. Dein Name wird dann unverzüglich von " +
      "diesen Seiten entfernt.",
  );
  // Ehrlich bleiben: Ein entfernter Name macht die Pruefsumme wertlos. Das
  // hier zu verschweigen waere bequem und falsch.
  add(
    "Ein Hinweis dazu: Die Prüfsumme wurde über die vollständige Teilnehmerliste " +
      "gebildet. Wird nachträglich ein Name entfernt, lässt sich die Ziehung nicht " +
      "mehr nachrechnen; auf der betroffenen Seite wird das vermerkt.",
  );
  add(
    "Außerdem steht dir ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde " +
      "zu (Art. 77 DSGVO), insbesondere bei der für deinen Wohnort zuständigen.",
  );
  add(`Für alle Anliegen: ${who.contact}`, "");

  add("8. Freiwilligkeit");
  add(
    "Die Teilnahme ist freiwillig. Ohne Kommentar ist keine Teilnahme möglich; " +
      "weitere Nachteile entstehen nicht.",
    "",
  );

  add("9. Automatisierte Entscheidungen");
  add(
    "Die Gewinner werden durch ein Zufallsverfahren ermittelt. Eine automatisierte " +
      "Entscheidung mit rechtlicher Wirkung oder eine Profilbildung findet nicht statt.",
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
