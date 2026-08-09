import { createHash, randomBytes } from "node:crypto";
import { SeededRandom } from "./random";

export const ALGORITHM_VERSION = "v1";

export interface Entrant {
  /// Interne ID der Teilnahme (fuer die Zuordnung in der Datenbank).
  id: string;
  username: string;
  /// Anzahl Lose. Bonuslose erhoehen die Gewinnchance entsprechend.
  lots: number;
  /// Stabile oeffentliche Referenz: Kommentar-ID der Plattform,
  /// ersatzweise der Zeitstempel.
  ref: string;
}

export interface Commitment {
  algorithmVersion: string;
  /// Kanonische Teilnehmerliste — genau dieser Text geht in den Hash ein.
  canonical: string;
  commitHash: string;
  /// Geheim bis zur Ziehung.
  seed: string;
  entrantCount: number;
  totalLots: number;
}

export interface DrawOutcome {
  /// Index 0 = Gewinner, danach die Nachruecker in Reihenfolge.
  winners: Entrant[];
  algorithmVersion: string;
  commitHash: string;
  seed: string;
}

/// Bringt die Teilnehmerliste in eine eindeutige, von der Datenbank
/// unabhaengige Textform. Grundlage fuer Hash und spaetere Nachpruefung.
export function canonicalize(entrants: Entrant[]): string {
  const lines = entrants
    .map((e) => `${e.username.trim().toLowerCase()}|${e.lots}|${e.ref}`)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const totalLots = entrants.reduce((sum, e) => sum + e.lots, 0);
  return [
    `gewinnspiel-commit/${ALGORITHM_VERSION}`,
    `teilnehmer:${entrants.length}`,
    `lose:${totalLots}`,
    "--",
    ...lines,
  ].join("\n");
}

export function hashCommitment(canonical: string, seed: string): string {
  return createHash("sha256")
    .update(`${canonical}\n--seed--\n${seed}`, "utf8")
    .digest("hex");
}

/// Schritt 1: Liste einfrieren und Hash bilden. Der Hash wird VOR der
/// Ziehung veroeffentlicht, der Seed bleibt bis danach geheim.
export function commit(entrants: Entrant[], seed?: string): Commitment {
  if (entrants.length === 0) {
    throw new Error("Es gibt keine gültigen Teilnahmen, aus denen gezogen werden könnte.");
  }
  for (const e of entrants) {
    if (!Number.isInteger(e.lots) || e.lots < 1) {
      throw new Error(
        `Teilnahme von ${e.username} hat eine ungültige Losanzahl (${e.lots}).`,
      );
    }
  }

  const actualSeed = seed ?? randomBytes(32).toString("hex");
  const canonical = canonicalize(entrants);

  return {
    algorithmVersion: ALGORITHM_VERSION,
    canonical,
    commitHash: hashCommitment(canonical, actualSeed),
    seed: actualSeed,
    entrantCount: entrants.length,
    totalLots: entrants.reduce((sum, e) => sum + e.lots, 0),
  };
}

/// Schritt 2: Ziehen. Gewichtet nach Losen, ohne Zuruecklegen —
/// niemand kann zweimal gezogen werden.
///
/// Deterministisch: gleicher Seed + gleiche Liste = gleiches Ergebnis.
/// Genau das macht die Ziehung ueberpruefbar.
export function draw(
  entrants: Entrant[],
  seed: string,
  count: number,
): DrawOutcome {
  const canonical = canonicalize(entrants);

  // In derselben kanonischen Reihenfolge ziehen, in der auch gehasht wurde.
  const pool = [...entrants].sort((a, b) => {
    const ka = `${a.username.trim().toLowerCase()}|${a.lots}|${a.ref}`;
    const kb = `${b.username.trim().toLowerCase()}|${b.lots}|${b.ref}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const rng = new SeededRandom(seed);
  const winners: Entrant[] = [];
  const remaining = [...pool];
  let remainingLots = remaining.reduce((sum, e) => sum + e.lots, 0);

  const picks = Math.min(count, remaining.length);
  for (let i = 0; i < picks; i++) {
    let ticket = rng.nextBelow(remainingLots);
    let index = 0;
    while (index < remaining.length && ticket >= remaining[index].lots) {
      ticket -= remaining[index].lots;
      index += 1;
    }
    const [winner] = remaining.splice(index, 1);
    remainingLots -= winner.lots;
    winners.push(winner);
  }

  return {
    winners,
    algorithmVersion: ALGORITHM_VERSION,
    commitHash: hashCommitment(canonical, seed),
    seed,
  };
}

/// Schritt 3: Nachpruefung. Rechnet nach, ob veroeffentlichter Hash,
/// Teilnehmerliste, Seed und Ergebnis zusammenpassen.
export function verifyDraw(
  entrants: Entrant[],
  seed: string,
  expectedCommitHash: string,
  expectedWinnerRefs: string[],
): { ok: boolean; reason?: string } {
  const canonical = canonicalize(entrants);
  const hash = hashCommitment(canonical, seed);

  if (hash !== expectedCommitHash) {
    return {
      ok: false,
      reason:
        "Der Hash passt nicht zu Teilnehmerliste und Seed — die Liste wurde nach der Veröffentlichung verändert.",
    };
  }

  const recomputed = draw(entrants, seed, expectedWinnerRefs.length);
  const refs = recomputed.winners.map((w) => w.ref);
  const same =
    refs.length === expectedWinnerRefs.length &&
    refs.every((r, i) => r === expectedWinnerRefs[i]);

  return same
    ? { ok: true }
    : {
        ok: false,
        reason: "Die Ziehung lässt sich mit diesem Seed nicht reproduzieren.",
      };
}
