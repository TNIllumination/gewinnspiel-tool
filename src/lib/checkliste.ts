// Was ist gerade online? — die Rechnung dahinter.
//
// GitHub Pages braucht nach dem Hochladen ein bis zwei Minuten, bis die Seite
// neu gebaut ist. In dieser Luecke weiss man nicht, ob man schon geklickt hat:
// Man klickt ein zweites Mal, oder man wartet auf eine Aenderung, die man nie
// angestossen hat. Diese Datei entscheidet, was die Karte dazu sagt.

export interface Stufe {
  titel: string;
  /// Wann veroeffentlicht — null, solange offen.
  am: string | null;
  /// Was diese Stufe online stellt, in einem Halbsatz.
  inhalt: string;
  /// Noch nicht an der Reihe (z. B. Nachweis vor der Ziehung).
  spaeter?: boolean;
}

/// Wie lange GitHub Pages ueblicherweise fuer den Neubau braucht.
export const BAUZEIT_MS = 2 * 60 * 1000;

export interface Stand {
  /// Der Upload laeuft noch durch — jetzt nicht nochmal druecken.
  baut: boolean;
  /// Dateien erzeugt, aber nie hochgeladen (kein Schluessel, kein Netz).
  nurErzeugt: boolean;
  /// Die naechste offene Stufe, oder null, wenn nichts ansteht.
  naechste: Stufe | null;
}

export function stand(
  stufen: Stufe[],
  zuletztHochgeladen: Date | null,
  jetzt: number | null,
): Stand {
  const baut =
    zuletztHochgeladen !== null &&
    jetzt !== null &&
    jetzt - zuletztHochgeladen.getTime() < BAUZEIT_MS;

  return {
    baut,
    // „Erzeugt" ist nicht „online" — der Unterschied ist genau der, an dem
    // man sonst vergeblich auf die Live-Seite starrt.
    nurErzeugt: zuletztHochgeladen === null && stufen.some((s) => s.am),
    naechste: stufen.find((s) => !s.am && !s.spaeter) ?? null,
  };
}

/// „vor 12 Sekunden" statt „21:04" — eine Uhrzeit muss man erst mit der Uhr
/// vergleichen, eine Spanne nicht.
export function seit(zeitpunkt: Date, jetzt: number): string {
  const s = Math.max(0, Math.round((jetzt - zeitpunkt.getTime()) / 1000));
  if (s < 60) return `vor ${s} Sekunde${s === 1 ? "" : "n"}`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Minute${m === 1 ? "" : "n"}`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Stunde${h === 1 ? "" : "n"}`;
  return `vor ${Math.round(h / 24)} Tagen`;
}
