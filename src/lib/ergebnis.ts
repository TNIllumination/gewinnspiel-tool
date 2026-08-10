// Fehler, die der Betreiber lesen soll.
//
// Der Anlass: Next.js entfernt im Produktionsbau die Texte aller Ausnahmen,
// die aus Server-Aktionen kommen — damit keine internen Details nach aussen
// gelangen. Uebrig bleibt "minified React error #441". Fuer eine Anwendung,
// die nur auf dem eigenen Rechner laeuft, ist das der falsche Kompromiss:
// Da gibt es kein "aussen", aber sehr wohl jemanden, der wissen muss, was
// schiefging.
//
// Rueckgabewerte sind davon nicht betroffen. Also wird aus einem
// Bedienfehler ein Rueckgabewert.

/// Ein Fehler, dessen Text fuer den Betreiber bestimmt ist — kein
/// Programmierfehler, sondern etwas, das er selbst beheben kann.
export class Bedienfehler extends Error {}

export interface MitFehler {
  fehler?: string;
}

/// Fehlerklassen anderer Module, deren Text angezeigt werden darf.
///
/// Eine Liste statt eines einzelnen Namens, weil genau hier schon einmal
/// etwas durchgefallen ist: `InstagramError` kam neu dazu, stand nicht drin,
/// und im Produktionsbau war „error #441" zurück — der Fehler, gegen den
/// dieses Modul überhaupt geschrieben wurde. **Wer eine neue Fehlerklasse
/// dieser Art anlegt, trägt sie hier ein.**
const ANZEIGBAR = new Set(["GitHubError", "InstagramError"]);

/// Next.js signalisiert Weiterleitungen und "nicht gefunden" ueber geworfene
/// Fehler mit besonderem digest. Die duerfen nie abgefangen werden, sonst
/// bleibt der Benutzer stehen, wo er nicht stehen bleiben soll.
export function istSteuerfluss(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && /^(NEXT_REDIRECT|NEXT_NOT_FOUND)/.test(digest);
}

/// Fuehrt eine Aktion aus und macht aus einem Bedienfehler ein Ergebnis.
///
/// Unerwartete Fehler fliegen weiter: Ein Programmierfehler soll auffallen
/// und im schwarzen Fenster stehen, nicht als hoefliche Meldung enden.
export async function alsErgebnis<T>(
  fn: () => Promise<T>,
): Promise<(T & MitFehler) | MitFehler> {
  try {
    return (await fn()) as T & MitFehler;
  } catch (error) {
    if (istSteuerfluss(error)) throw error;
    if (error instanceof Bedienfehler) return { fehler: error.message };
    // Fehler fremder Schichten, die trotzdem fuer den Betreiber gedacht sind,
    // erkennt man am Namen — so muss ergebnis.ts nichts von ihnen wissen.
    if (error instanceof Error && ANZEIGBAR.has(error.name)) {
      return { fehler: error.message };
    }
    throw error;
  }
}
