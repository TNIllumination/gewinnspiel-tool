// Aufbewahrungsfrist — die Rechnung dahinter.
//
// Die erzeugte Datenschutzerklaerung sagt zu, dass Teilnehmerdaten spaetestens
// X Tage nach dem Gewinnspiel geloescht werden. Ob dieser Zeitpunkt erreicht
// ist, entscheidet allein diese Funktion; die Aktion in `actions.ts` holt nur
// die Zahlen aus der Datenbank. So laesst sich die Frist pruefen, ohne eine
// Datenbank hochzufahren.

export const TAG_MS = 24 * 60 * 60 * 1000;

export interface Aufbewahrung {
  /// Wie viele Teilnahmen liegen insgesamt vor?
  entries: number;
  /// Wie viele davon wurden gezogen? Die bleiben stehen.
  gezogen: number;
  /// Ab wann laeuft die Frist — Ziehung, sonst Abschluss.
  ab: Date;
  /// Aufbewahrungsdauer in Tagen aus dem Gewinnspiel.
  retentionDays: number;
}

export interface Faellig {
  /// Wie viele Teilnahmen sich tatsaechlich loeschen lassen.
  loeschbar: number;
  /// Um wie viele Tage die Frist ueberschritten ist (0 = heute erreicht).
  ueberfaellig: number;
}

// ── Ablauf des Instagram-Schluessels ────────────────────────────────────────
//
// Derselbe Gedanke wie oben, andere Frist: Der Zugangsschluessel haelt 60
// Tage. Ein Tool, das nur laeuft, wenn man es startet, kann nicht im
// Hintergrund verlaengern — also wird beim Blick aufs Dashboard gerechnet
// und gemeldet, bevor es mitten im Gewinnspiel auffaellt.

/// Ab wann gewarnt wird. Zwei Wochen sind genug Vorlauf, um es in Ruhe zu
/// erledigen, und selten genug, dass die Meldung nicht zur Tapete wird.
export const WARNFRIST_TAGE = 14;

export interface TokenStand {
  /// Verbleibende Tage. Negativ, wenn der Schluessel schon abgelaufen ist.
  tage: number;
  abgelaufen: boolean;
  /// Soll das Dashboard etwas sagen?
  warnen: boolean;
}

/// `null`, wenn gar kein Schluessel hinterlegt ist — dann gibt es nichts zu
/// warnen, sondern hoechstens etwas einzurichten.
export function tokenFrist(gueltigBis: Date | null, jetzt: number): TokenStand | null {
  if (!gueltigBis) return null;

  // Aufgerundet: Sind es noch 12 Stunden, ist das „1 Tag" und nicht „0".
  const tage = Math.ceil((gueltigBis.getTime() - jetzt) / TAG_MS);
  const abgelaufen = gueltigBis.getTime() <= jetzt;

  return { tage, abgelaufen, warnen: abgelaufen || tage <= WARNFRIST_TAGE };
}

/// `null`, solange nichts zu tun ist.
export function faelligkeit(a: Aufbewahrung, jetzt: number): Faellig | null {
  // Gezogene Teilnahmen bleiben stehen, sonst waere der veroeffentlichte
  // Nachweis wertlos. Sind nur noch die uebrig, gibt es nichts mehr zu
  // loeschen — und die Meldung im Dashboard waere endlos.
  const loeschbar = a.entries - a.gezogen;
  if (loeschbar <= 0) return null;

  const ueberfaellig = Math.floor((jetzt - a.ab.getTime()) / TAG_MS) - a.retentionDays;
  if (ueberfaellig < 0) return null;

  return { loeschbar, ueberfaellig };
}
