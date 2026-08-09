import type { CommentInput } from "@/rules/engine";
import { SeededRandom } from "@/draw/random";

// Testmodus: erzeugt realistische, frei erfundene Teilnahmen.
//
// Damit laesst sich der komplette Ablauf vorfuehren und pruefen, bevor
// irgendeine Plattform-Freigabe vorliegt — und ohne echte personenbezogene
// Daten zu verarbeiten.

const FIRST = [
  "anna", "ben", "carla", "david", "elena", "felix", "greta", "hannes",
  "ida", "jonas", "klara", "lukas", "mia", "noah", "olivia", "paul",
  "quirin", "rosa", "simon", "tina", "ulrich", "vera", "walter", "yara",
];

const LAST = [
  "berg", "wald", "stein", "fluss", "sonne", "mond", "stern", "blume",
  "koch", "weber", "schmidt", "fischer", "meyer", "wolf", "adler", "falke",
];

/// Satzanfaenge ohne Schluesselwort — das kommt aus den echten Regeln dazu.
const RUEMPFE = [
  "Ich bin dabei",
  "Mega Aktion, da mache ich mit",
  "Sehr cool, ich mache mit",
  "Das klingt großartig",
  "Genau mein Ding",
  "Da bin ich sofort dabei",
];

/// Zu kurz, egal welche Regel — fuer den Fall "Mindestlaenge".
const ZU_KURZ = ["Top", "👍", "Cool", "Nice", "Ja!"];

export interface SandboxOptions {
  count?: number;
  /// Anteil der Teilnahmen, die die Regeln erfuellen (0..1).
  validShare?: number;
  /// Anteil Mehrfachteilnahmen.
  duplicateShare?: number;
  seed?: string;
  endsAt?: Date;
  /// Die tatsaechlich gesetzten Regeln.
  ///
  /// Ohne sie erzeugte der Testmodus frueher immer denselben Text mit dem
  /// Wort "dabei" — verlangte man etwas anderes, fiel jede einzelne der 250
  /// Teilnahmen durch. Ein Testmodus, der vorfuehrt, dass nichts
  /// funktioniert, ist schlimmer als keiner.
  regeln?: SandboxRules;
}

export interface SandboxRules {
  keywords?: string[];
  /// "any" = eines genuegt, "all" = alle muessen vorkommen.
  keywordMode?: string;
  mentionsMin?: number;
  minLength?: number;
}

export function generateSandboxComments(
  options: SandboxOptions = {},
): CommentInput[] {
  const {
    count = 250,
    validShare = 0.7,
    duplicateShare = 0.1,
    seed = "sandbox",
    endsAt = new Date(),
    regeln = {},
  } = options;

  const keywords = (regeln.keywords ?? []).filter(Boolean);
  // Bei "alle noetig" muessen alle Woerter rein, sonst genuegt eines.
  const noetig =
    regeln.keywordMode === "all" ? keywords : keywords.slice(0, 1);
  const mentionsMin = Math.max(regeln.mentionsMin ?? 0, 0);
  const minLength = Math.max(regeln.minLength ?? 0, 0);

  const rng = new SeededRandom(seed);
  const pick = <T>(arr: T[]) => arr[rng.nextBelow(arr.length)];

  const usernames: string[] = [];
  const comments: CommentInput[] = [];

  for (let i = 0; i < count; i++) {
    const reuse = usernames.length > 0 && rng.nextBelow(100) < duplicateShare * 100;
    const username = reuse
      ? pick(usernames)
      : uniqueName(usernames, () => `${pick(FIRST)}_${pick(LAST)}${rng.nextBelow(90) + 10}`);

    if (!reuse) usernames.push(username);

    const markierungen = (anzahl: number) =>
      Array.from({ length: anzahl }, () => `@${pick(FIRST)}_${pick(LAST)}`).join(" ");

    /// Baut einen Kommentar, der wahlweise an genau einer Bedingung scheitert.
    const baue = (fehler: "keins" | "wort" | "markierung" | "laenge") => {
      if (fehler === "laenge") return pick(ZU_KURZ);

      const woerter = fehler === "wort" ? [] : noetig;
      const tags = markierungen(
        fehler === "markierung" ? Math.max(mentionsMin - 1, 0) : mentionsMin,
      );
      let text = [pick(RUEMPFE), ...woerter, tags].filter(Boolean).join(" ");

      // Mindestlaenge auffuellen, damit nicht versehentlich zwei Regeln
      // gleichzeitig greifen — sonst waere die Begruendung nicht eindeutig.
      if (minLength > 0) {
        while (text.length < minLength) text += " und ich freue mich riesig";
      }
      return text;
    };

    const valid = rng.nextBelow(100) < validShare * 100;
    // Nur Bedingungen scheitern lassen, die es auch gibt.
    const moeglich: ("wort" | "markierung" | "laenge")[] = [
      ...(noetig.length > 0 ? (["wort"] as const) : []),
      ...(mentionsMin > 0 ? (["markierung"] as const) : []),
      ...(minLength > 0 ? (["laenge"] as const) : []),
    ];
    const text = valid
      ? baue("keins")
      : moeglich.length > 0
        ? baue(pick(moeglich))
        : pick(ZU_KURZ);

    // Kommentare ueber die letzten 7 Tage verteilen.
    const minutesBack = rng.nextBelow(7 * 24 * 60);

    comments.push({
      externalId: `sandbox-${i}`,
      username,
      text,
      commentedAt: new Date(endsAt.getTime() - minutesBack * 60_000),
      likeCount: rng.nextBelow(25),
    });
  }

  return comments;
}

function uniqueName(taken: string[], make: () => string): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = make();
    if (!taken.includes(candidate)) return candidate;
  }
  return `${make()}_${taken.length}`;
}
