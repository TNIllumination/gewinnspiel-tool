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

const TEMPLATES = [
  "Ich bin dabei! {tags}",
  "Mega Aktion, ich bin dabei {tags}",
  "Da mache ich mit {tags}",
  "Ich bin dabei — {tags} schaut mal",
  "Bin dabei! Drücke die Daumen {tags}",
  "Sehr cool, ich bin dabei {tags}",
];

/// Kommentare, die absichtlich durchfallen — damit sichtbar wird,
/// dass die Regel-Engine begruendet ablehnt.
const INVALID_TEMPLATES = [
  "Schön!",
  "Toll gemacht 👍",
  "Ich bin dabei",
  "Wo gibt es das zu kaufen?",
  "@nur_einer ich bin dabei",
  "❤️❤️❤️",
];

export interface SandboxOptions {
  count?: number;
  /// Anteil der Teilnahmen, die die Regeln erfuellen (0..1).
  validShare?: number;
  /// Anteil Mehrfachteilnahmen.
  duplicateShare?: number;
  seed?: string;
  endsAt?: Date;
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
  } = options;

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

    const valid = rng.nextBelow(100) < validShare * 100;
    const text = valid
      ? pick(TEMPLATES).replace(
          "{tags}",
          `@${pick(FIRST)}_${pick(LAST)} @${pick(FIRST)}_${pick(LAST)}`,
        )
      : pick(INVALID_TEMPLATES);

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
