// Textvergleich, der deutschen Schreibgewohnheiten standhaelt.
//
// Das Problem: Schreibt jemand "Grüße" und die Regel verlangt "Gruesse",
// oder umgekehrt, darf die Teilnahme nicht durchfallen. Beide Schreibweisen
// sind fuer Menschen dasselbe Wort.
//
// Loesung: Jeder Text wird in ZWEI kanonische Formen ueberfuehrt —
//   "expand": ä→ae, ö→oe, ü→ue, ß→ss   ("grüße" → "gruesse")
//   "strip":  Diakritika entfernen      ("grüße" → "grusse")
// Ein Treffer in einer der beiden Formen genuegt. Damit werden
// "grüße", "gruesse" und "grusse" gleich behandelt.

const EXPANSIONS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  æ: "ae",
  ø: "oe",
  å: "aa",
};

/// Unsichtbare Zeichen (Zero-Width Space/Joiner, BOM, Word Joiner),
/// mit denen Filter gern umgangen werden.
const INVISIBLE = /[\u200B-\u200D\uFEFF\u2060]/g;

function base(input: string): string {
  return input
    .normalize("NFC")
    .toLowerCase()
    .replace(INVISIBLE, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function foldExpand(input: string): string {
  return base(input).replace(/[äöüßæøå]/g, (c) => EXPANSIONS[c] ?? c);
}

export function foldStrip(input: string): string {
  return base(input)
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "");
}

/// Enthaelt `haystack` das Wort/die Wendung `needle`? Tolerant gegenueber
/// Gross-/Kleinschreibung, Umlautschreibweise und unsichtbaren Zeichen.
export function containsText(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return true;
  return (
    foldExpand(haystack).includes(foldExpand(n)) ||
    foldStrip(haystack).includes(foldStrip(n))
  );
}

/// @-Erwaehnungen aus einem Kommentar ziehen, kleingeschrieben und ohne Duplikate.
/// Instagram/TikTok-Handles: Buchstaben, Ziffern, Punkt, Unterstrich.
export function extractMentions(text: string): string[] {
  const matches = text.replace(INVISIBLE, "").matchAll(/@([a-z0-9._]{1,30})/gi);
  const seen = new Set<string>();
  for (const m of matches) {
    // Endpunkte gehoeren meist zur Satzzeichensetzung, nicht zum Handle.
    const handle = m[1].replace(/\.+$/, "").toLowerCase();
    if (handle) seen.add(handle);
  }
  return [...seen];
}

/// Vergleicht zwei Benutzernamen plattformtolerant (fuehrendes @ egal).
export function sameUser(a: string, b: string): boolean {
  const clean = (s: string) => s.trim().replace(/^@/, "").toLowerCase();
  return clean(a) === clean(b);
}

/// Fingerabdruck einer Teilnahme aus Benutzername und Text.
///
/// Beim Einfuegen von Hand gibt es keine Kommentar-ID der Plattform. Damit
/// etappenweises Einlesen (scrollen, kopieren, einfuegen, wiederholen) nicht
/// zu Dubletten fuehrt, wird stattdessen ueber den Inhalt abgeglichen.
/// Wer doppelt in der Liste steht, haette doppelte Gewinnchancen — deshalb
/// ist das ein Fairness- und kein Schoenheitsthema.
export function entryFingerprint(username: string, text: string): string {
  return `${foldExpand(username.replace(/^@/, ""))}|${foldExpand(text)}`;
}

/// Zaehlt echte Zeichen (Emojis zaehlen als eins, nicht als zwei).
export function graphemeLength(text: string): number {
  return [...text.trim()].length;
}
