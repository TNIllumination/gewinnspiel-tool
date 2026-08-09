import { describeRules } from "@/rules/summary";
import type { RuleType } from "@/rules/types";
import { getPlatform, type PlatformId } from "@/platforms/base";

// Erzeugt die Teilnahmebedingungen aus dem echten Gewinnspiel — nicht aus
// einer Vorlage. Was im Aushang steht, ist damit immer das, wonach auch
// geprueft wird.
//
// Pflichtbestandteile, die die Plattformen verlangen:
//   1. Hinweis, dass die Aktion in keiner Verbindung zur Plattform steht
//   2. Haftungsfreistellung der Plattform durch jeden Teilnehmer
//   3. Benennung des alleinigen Ansprechpartners
// Dazu die gesetzliche Pflicht (§ 6 DDG), die Bedingungen klar und
// leicht zugaenglich anzugeben.

/// Bildunterschriften fassen auf Instagram und TikTok rund so viele Zeichen.
/// Ein abgeschnittener Rechtstext waere schlimmer als gar keiner.
export const CAPTION_LIMIT = 2200;

export interface GiveawayForTerms {
  title: string;
  slug: string;
  description?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  substituteCount: number;
  /// Eigene Bedingungen, eine je Zeile.
  customTerms?: string | null;
  sources: { platform: string; postUrl?: string | null }[];
  prizes: { title: string; description?: string | null; quantity: number }[];
  rules: { type: RuleType; config: unknown; enabled?: boolean }[];
}

export interface Organizer {
  organizer: string;
  contact: string;
  publishBaseUrl?: string;
  /// Adresse des Impressums. Leer, wenn keines hinterlegt ist — ob eines
  /// noetig ist, entscheidet der Veranstalter, nicht das Werkzeug.
  impressumUrl?: string;
}

/// Zerlegt das Freifeld in einzelne Bedingungen. Leerzeilen und fuehrende
/// Aufzaehlungszeichen fliegen raus — sonst steht spaeter "• • Text" da.
export function customTermLines(raw?: string | null): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

export class MissingOrganizerError extends Error {
  constructor() {
    super(
      "Für die Teilnahmebedingungen fehlen die Veranstalterangaben. " +
        "Bitte unter Einstellungen Name und Kontakt eintragen.",
    );
  }
}

function formatDe(value: Date) {
  return value.toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
}

/// Namen der beteiligten Plattformen, ohne den Testmodus.
function realPlatforms(giveaway: GiveawayForTerms): PlatformId[] {
  return giveaway.sources
    .map((s) => s.platform as PlatformId)
    .filter((p) => p !== "SANDBOX");
}

function platformNames(giveaway: GiveawayForTerms): string {
  const names = realPlatforms(giveaway).map((p) => getPlatform(p).label);
  if (names.length === 0) return "der jeweiligen Plattform";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}

/// Der Pflichtblock der Plattformen. Bewusst wörtlich und vollständig.
export function platformDisclaimer(
  giveaway: GiveawayForTerms,
  who: Organizer,
): string {
  const names = platformNames(giveaway);
  return [
    `Diese Aktion steht in keiner Verbindung zu ${names} und wird von ${names} weder gesponsert noch unterstützt oder organisiert.`,
    `Mit der Teilnahme stellt der Teilnehmer ${names} von jeglicher Haftung frei.`,
    `Alleiniger Ansprechpartner und Verantwortlicher ist ${who.organizer} (${who.contact}). Fragen zum Gewinnspiel bitte nicht an ${names} richten.`,
  ].join(" ");
}

/// Ausführliche Fassung — für die veröffentlichte Seite.
export function buildTerms(
  giveaway: GiveawayForTerms,
  who: Organizer,
): string {
  if (!who.organizer?.trim() || !who.contact?.trim()) {
    throw new MissingOrganizerError();
  }

  const lines: string[] = [];
  const add = (...parts: string[]) => lines.push(...parts);

  add(`Teilnahmebedingungen — ${giveaway.title}`, "");
  add("Dies ist ein Gewinnspiel mit Werbecharakter.", "");

  add(`Veranstalter: ${who.organizer}`);
  add(`Kontakt für Rückfragen: ${who.contact}`);
  if (who.impressumUrl?.trim()) add(`Impressum: ${who.impressumUrl.trim()}`);
  add("");

  // Zeitraum
  if (giveaway.startsAt || giveaway.endsAt) {
    add("Teilnahmezeitraum");
    if (giveaway.startsAt) add(`Beginn: ${formatDe(giveaway.startsAt)}`);
    if (giveaway.endsAt)
      add(`Einsendeschluss: ${formatDe(giveaway.endsAt)}. Später eingehende Kommentare nehmen nicht teil.`);
    add("");
  }

  // Was zu tun ist — aus den tatsaechlich gesetzten Regeln
  add("So nimmst du teil");
  for (const line of describeRules(giveaway.rules)) add(`• ${line}`);

  const platforms = realPlatforms(giveaway);
  if (platforms.length > 1) {
    add(
      "• Die Aktion läuft auf mehreren Plattformen. Wer auf mehreren kommentiert, ist entsprechend mehrfach im Lostopf.",
    );
  }
  for (const source of giveaway.sources) {
    if (source.postUrl) {
      add(`• ${getPlatform(source.platform as PlatformId).label}: ${source.postUrl}`);
    }
  }
  add("");

  // Gewinne
  if (giveaway.prizes.length > 0) {
    add("Das gibt es zu gewinnen");
    giveaway.prizes.forEach((prize, index) => {
      const menge = prize.quantity > 1 ? ` (${prize.quantity}×)` : "";
      add(`• ${index + 1}. Platz: ${prize.title}${menge}`);
    });
    add("");
  }

  add("Teilnahmeberechtigung");
  add("• Teilnahme ab 18 Jahren.");
  add("• Die Teilnahme ist kostenlos und unabhängig von einem Kauf.");
  add("• Mitarbeitende des Veranstalters und deren Angehörige sind ausgeschlossen.", "");

  add("Ermittlung der Gewinner");
  add(
    `• Die Gewinner werden nach dem Einsendeschluss unter allen gültigen Teilnahmen per Zufall ermittelt. Zusätzlich werden ${giveaway.substituteCount} Nachrücker gezogen.`,
  );
  add(
    "• Die Ziehung ist nachrechenbar: Vor der Ziehung wird eine Prüfsumme der Teilnehmerliste veröffentlicht, danach die Zufallszahl. Damit lässt sich das Ergebnis jederzeit überprüfen.",
  );
  add(
    "• Gewinner werden über die Plattform benachrichtigt. Meldet sich ein Gewinner nicht innerhalb von 7 Tagen, rückt der nächste Nachrücker nach.",
  );
  add("• Der Rechtsweg ist ausgeschlossen. Eine Barauszahlung der Gewinne ist nicht möglich.", "");

  add("Datenschutz");
  add(
    "• Verarbeitet werden ausschließlich der öffentlich sichtbare Benutzername, der Kommentartext und dessen Zeitpunkt — allein zur Durchführung und zum Nachweis der Verlosung (Art. 6 Abs. 1 lit. b und f DSGVO).",
  );
  add(
    "• Zur Nachvollziehbarkeit der Ziehung kann die Teilnehmerliste mit den Benutzernamen veröffentlicht werden.",
  );
  add(
    "• Die Daten werden nach Abschluss des Gewinnspiels gelöscht. Auskunft und Löschung jederzeit über den oben genannten Kontakt.",
  );
  if (who.publishBaseUrl?.trim()) {
    add(
      `• Vollständige Datenschutzerklärung: ${who.publishBaseUrl.replace(/\/+$/, "")}/datenschutz.html`,
    );
  }
  add("");

  // Eigene Bedingungen stehen bewusst VOR dem Plattform-Hinweis: Der ist
  // Pflichttext der Plattformen und bleibt der Schlussstein.
  const eigene = customTermLines(giveaway.customTerms);
  if (eigene.length > 0) {
    add("Weitere Bedingungen");
    for (const line of eigene) add(`• ${line}`);
    add("");
  }

  add("Hinweis zu den Plattformen");
  add(platformDisclaimer(giveaway, who));

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/// Kurzfassung für die Bildunterschrift des Beitrags.
export function buildShortTerms(
  giveaway: GiveawayForTerms,
  who: Organizer,
): { text: string; length: number; fitsCaption: boolean } {
  if (!who.organizer?.trim() || !who.contact?.trim()) {
    throw new MissingOrganizerError();
  }

  const lines: string[] = [];
  lines.push(`🎁 GEWINNSPIEL — ${giveaway.title}`, "");

  lines.push("So bist du dabei:");
  for (const line of describeRules(giveaway.rules)) lines.push(`• ${line}`);
  if (realPlatforms(giveaway).length > 1) {
    lines.push("• Auf mehreren Plattformen kommentieren = mehrfach im Lostopf.");
  }
  lines.push("");

  if (giveaway.prizes.length > 0) {
    lines.push(
      `Zu gewinnen: ${giveaway.prizes.map((p) => p.title).join(" · ")}`,
      "",
    );
  }

  // Auch in der Kurzfassung: "Uebergabe nur vor Ort" ist wesentlich. Es
  // stillschweigend wegzulassen, sobald es eng wird, waere die schlechtere
  // Ueberraschung — die Laengenwarnung greift ohnehin.
  const eigene = customTermLines(giveaway.customTerms);
  if (eigene.length > 0) {
    for (const line of eigene) lines.push(`• ${line}`);
    lines.push("");
  }

  if (giveaway.endsAt) {
    lines.push(`Einsendeschluss: ${formatDe(giveaway.endsAt)}`, "");
  }

  lines.push(platformDisclaimer(giveaway, who));

  if (who.publishBaseUrl?.trim()) {
    lines.push(
      "",
      `Vollständige Teilnahmebedingungen: ${who.publishBaseUrl.replace(/\/+$/, "")}/${giveaway.slug}.html`,
    );
  }

  // Kurz genug, um in die Bildunterschrift zu passen — und es staerkt die
  // Position des Veranstalters, wenn das Impressum direkt daneben steht.
  if (who.impressumUrl?.trim()) {
    lines.push(`Impressum: ${who.impressumUrl.trim()}`);
  }

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text, length: text.length, fitsCaption: text.length <= CAPTION_LIMIT };
}

/// Nachweis-Text zum Einfügen unter den Beitrag.
export function buildProofText(params: {
  title: string;
  commitHash: string;
  entrantCount: number;
  totalLots: number;
  committedAt: Date;
  /// Wann die Pruefsumme oeffentlich wurde.
  commitPublishedAt?: Date | null;
  seed?: string | null;
  drawnAt?: Date | null;
  listUrl?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Nachweis zur fairen Ziehung — ${params.title}`, "");
  lines.push(`Teilnehmer: ${params.entrantCount} · Lose: ${params.totalLots}`);
  lines.push(`Liste festgeschrieben: ${formatDe(params.committedAt)}`);
  if (params.commitPublishedAt) {
    lines.push(`Prüfsumme veröffentlicht: ${formatDe(params.commitPublishedAt)}`);
  }
  lines.push(`Prüfsumme (SHA-256): ${params.commitHash}`);

  if (params.seed && params.drawnAt) {
    lines.push("", `Gezogen: ${formatDe(params.drawnAt)}`);
    lines.push(`Zufallszahl: ${params.seed}`);
    lines.push(
      "",
      "So kannst du nachrechnen: Die Prüfsumme oben wurde VOR der Ziehung veröffentlicht. " +
        "Aus der Teilnehmerliste und der Zufallszahl ergibt sie sich eindeutig — wäre die Liste " +
        "nachträglich verändert worden, käme eine andere Prüfsumme heraus.",
    );
    if (params.listUrl) lines.push("", `Teilnehmerliste: ${params.listUrl}`);
  } else {
    lines.push(
      "",
      "Die Zufallszahl wird nach der Ziehung veröffentlicht. Die Prüfsumme oben bindet " +
        "Teilnehmerliste und Zufallszahl bereits jetzt aneinander.",
    );
  }

  return lines.join("\n").trim();
}
