// Wer gewinnt am Ende wirklich?
//
// Gezogen werden mehr Leute als es Gewinne gibt: erst die Gewinnplaetze,
// danach Nachruecker. Faellt ein Gewinner bei der Pruefung durch, erbt der
// erste noch offene Nachruecker **genau dessen Gewinn** — nicht irgendeinen.
//
// Bewusst als reine Funktion ohne Datenbank, damit sich das Nachruecken
// vollstaendig testen laesst.

export interface Candidate {
  id: string;
  rank: number;
  /// PENDING | CONFIRMED | REJECTED | PROMOTED
  status: string;
}

export interface WinnerSlot<T extends Candidate = Candidate> {
  /// 0 = erster Platz, 1 = zweiter Platz, …
  slot: number;
  /// Wer diesen Platz aktuell belegt. null, wenn alle Kandidaten
  /// durchgefallen sind.
  candidate: T | null;
  /// true, wenn hier jemand nachgerueckt ist statt direkt gezogen zu sein.
  promoted: boolean;
}

export interface ResolvedDraw<T extends Candidate = Candidate> {
  winners: WinnerSlot<T>[];
  /// Nachruecker, die (noch) keinen Platz belegen.
  reserves: T[];
}

/// Der Gewinn gehoert zum PLATZ, nicht zur Person.
///
/// Rueckt jemand von Platz 2 auf Platz 1 nach, bekommt er den Hauptgewinn —
/// nicht den Gewinn, der bei der Ziehung zufaellig an seinem eigenen Rang hing.
/// Beim Ziehen entspricht Rang = Platz, deshalb traegt der Kandidat mit
/// `rank === slot` den richtigen Gewinn.
export function prizeIdForSlot<T extends Candidate & { prizeId?: string | null }>(
  candidates: T[],
  slot: number,
): string | null {
  return candidates.find((c) => c.rank === slot)?.prizeId ?? null;
}

/// Verteilt die gezogenen Kandidaten auf die Gewinnplaetze.
///
/// `candidates` muss nach `rank` aufsteigend sortiert sein — so, wie gezogen
/// wurde. Abgelehnte fallen heraus, alle anderen ruecken der Reihe nach auf.
export function resolveWinners<T extends Candidate>(
  candidates: T[],
  winnerSlots: number,
): ResolvedDraw<T> {
  const ordered = [...candidates].sort((a, b) => a.rank - b.rank);
  const available = ordered.filter((c) => c.status !== "REJECTED");

  const winners: WinnerSlot<T>[] = [];
  let next = 0;

  for (let slot = 0; slot < Math.max(winnerSlots, 0); slot++) {
    const candidate = available[next] ?? null;
    if (candidate) next += 1;

    winners.push({
      slot,
      candidate,
      // Nachgerueckt ist, wer urspruenglich weiter hinten gezogen wurde,
      // als der Platz es verlangt.
      promoted: candidate ? candidate.rank > slot : false,
    });
  }

  return { winners, reserves: available.slice(next) };
}

/// Sind alle Gewinnplaetze besetzt und bestaetigt?
export function isSettled<T extends Candidate>(resolved: ResolvedDraw<T>): boolean {
  return (
    resolved.winners.length > 0 &&
    resolved.winners.every((w) => w.candidate?.status === "CONFIRMED")
  );
}

/// Gibt es Plaetze, die niemand mehr besetzen kann?
export function hasUnfillableSlot<T extends Candidate>(
  resolved: ResolvedDraw<T>,
): boolean {
  return resolved.winners.some((w) => w.candidate === null);
}
