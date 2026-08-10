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
