import type { CommentInput } from "@/rules/engine";

// Import von Hand — der Weg fuer TikTok und als Notnagel fuer alles andere.
//
// Menschen kopieren Kommentare in ganz unterschiedlichen Formaten zusammen.
// Der Parser erkennt deshalb selbststaendig:
//   1. CSV/TSV mit Kopfzeile   (username;text;datum)
//   2. "@name: Text"           (eine Zeile je Teilnahme)
//   3. Bloecke                 (Name in einer Zeile, Text darunter)
//
// Fall 3 ist der Alltag bei TikTok: Was man aus der Weboberflaeche kopiert,
// enthaelt zwischen Name und Text noch Datumsangaben, "Antworten" und
// Like-Zahlen. Diese Zeilen werden als Beiwerk erkannt und uebersprungen —
// sonst wuerde eine Like-Zahl wie "12" als Benutzername gelesen.
//
// Alles, was er nicht zuordnen kann, wird nicht stillschweigend verworfen,
// sondern als Warnung gemeldet.

export interface ImportResult {
  comments: CommentInput[];
  warnings: string[];
  /// Erkanntes Format, wird dem Nutzer zur Kontrolle angezeigt.
  format: "csv" | "inline" | "blocks" | "leer";
}

const USERNAME_HEADERS = ["username", "user", "benutzer", "name", "autor", "author", "handle"];
const TEXT_HEADERS = ["text", "kommentar", "comment", "inhalt", "message", "nachricht"];
const DATE_HEADERS = ["datum", "date", "timestamp", "zeit", "time", "created", "published"];
const ID_HEADERS = ["id", "comment_id", "kommentar_id", "externalid"];
const LIKE_HEADERS = ["likes", "like_count", "likecount", "gefällt"];

export function parseManualImport(
  raw: string,
  fallbackDate = new Date(),
): ImportResult {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { comments: [], warnings: [], format: "leer" };

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const delimiter = detectDelimiter(lines[0]);

  if (delimiter && looksLikeHeader(lines[0], delimiter)) {
    return parseCsv(lines, delimiter, fallbackDate);
  }
  if (lines.some((l) => /^\s*@?[\w.]{1,30}\s*[::]/.test(l))) {
    return parseInline(lines, fallbackDate);
  }
  return parseBlocks(lines, fallbackDate);
}

/// Beiwerk aus der Weboberflaeche: Zeitangaben, Like-Zahlen, Schaltflaechen.
/// Diese Zeilen gehoeren weder zum Namen noch zum Kommentar.
function isNoise(line: string): boolean {
  const l = line.trim().replace(/^[·•|]\s*/, "").toLowerCase();
  if (!l) return true;

  // Reine Zahlen bzw. Like-Zahlen wie "1.2k", "12", "3,4 M"
  if (/^\d+([.,]\d+)?\s*[km]?$/.test(l)) return true;

  // Relative Zeitangaben: "2d", "vor 3 Tagen", "5 hours ago", "1 std."
  if (/^(vor\s+)?\d+\s*(s|m|h|d|w|y|min|std|sek|tag|tage|tagen|woche|wochen|monat|monaten|jahr|jahren|second|minute|hour|day|week|month|year)s?\.?(\s+(ago|her))?$/.test(l))
    return true;

  // Absolute Datumsangaben: "2026-1-15", "15.01.2026", "1/15"
  if (/^\d{1,4}[-./]\d{1,2}([-./]\d{2,4})?$/.test(l)) return true;

  // Schaltflaechen und Hinweise der Oberflaeche
  const CHROME = [
    "antworten", "reply", "mehr anzeigen", "weniger anzeigen", "show more",
    "show less", "übersetzung anzeigen", "see translation", "angeheftet",
    "pinned", "autor", "creator", "gefällt mir", "like", "teilen", "share",
    "melden", "report", "heute", "gestern", "today", "yesterday",
  ];
  if (CHROME.includes(l)) return true;
  if (/^(alle\s+)?\d+\s+antworten( anzeigen)?$/.test(l)) return true;
  if (/^view( all)? \d+ repl(y|ies)$/.test(l)) return true;

  return false;
}

/// Sieht die Zeile nach einem Benutzernamen aus? Handles bestehen aus einem
/// Wort ohne Leerzeichen — Kommentartexte enthalten praktisch immer welche.
function looksLikeHandle(line: string): boolean {
  const l = line.trim().replace(/^@/, "");
  return /^[\w.]{2,30}$/.test(l) && !/^\d+$/.test(l);
}

/// Bloeckeweise lesen: eine Handle-Zeile eroeffnet eine Teilnahme, alle
/// folgenden Textzeilen gehoeren dazu, bis der naechste Handle kommt.
/// Dadurch ueberleben auch mehrzeilige Kommentare den Import.
function parseBlocks(lines: string[], fallbackDate: Date): ImportResult {
  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  const relevant = lines.filter((l) => !isNoise(l));
  let current: { username: string; parts: string[] } | null = null;
  let index = 0;

  const flush = () => {
    if (!current) return;
    const text = current.parts.join(" ").trim();
    if (!text) {
      warnings.push(`„${truncate(current.username)}“ übersprungen — kein Kommentartext gefunden.`);
    } else {
      comments.push({
        username: current.username,
        text,
        externalId: null,
        // Reihenfolge der Bloecke = Reihenfolge der Kommentare.
        commentedAt: new Date(fallbackDate.getTime() + index++ * 1000),
        likeCount: 0,
      });
    }
    current = null;
  };

  for (const line of relevant) {
    if (looksLikeHandle(line)) {
      flush();
      current = { username: line.trim().replace(/^@/, ""), parts: [] };
    } else if (current) {
      current.parts.push(line.trim());
    } else {
      warnings.push(`„${truncate(line)}“ übersprungen — davor stand kein Benutzername.`);
    }
  }
  flush();

  return { comments, warnings, format: "blocks" };
}

function detectDelimiter(line: string): string | null {
  for (const d of [";", "\t", ","]) {
    if (line.split(d).length >= 2) return d;
  }
  return null;
}

function looksLikeHeader(line: string, delimiter: string): boolean {
  const cells = splitRow(line, delimiter).map((c) => c.trim().toLowerCase());
  return (
    cells.some((c) => USERNAME_HEADERS.includes(c)) &&
    cells.some((c) => TEXT_HEADERS.includes(c))
  );
}

/// CSV-Zeile zerlegen, inklusive Anfuehrungszeichen und doppelter
/// Anfuehrungszeichen als Escape ("" innerhalb eines Feldes).
function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function indexOfHeader(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.includes(h));
}

function parseCsv(
  lines: string[],
  delimiter: string,
  fallbackDate: Date,
): ImportResult {
  const headers = splitRow(lines[0], delimiter).map((h) =>
    h.trim().toLowerCase(),
  );
  const iUser = indexOfHeader(headers, USERNAME_HEADERS);
  const iText = indexOfHeader(headers, TEXT_HEADERS);
  const iDate = indexOfHeader(headers, DATE_HEADERS);
  const iId = indexOfHeader(headers, ID_HEADERS);
  const iLikes = indexOfHeader(headers, LIKE_HEADERS);

  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  for (let row = 1; row < lines.length; row++) {
    const cells = splitRow(lines[row], delimiter);
    const username = cells[iUser]?.trim().replace(/^@/, "");
    const body = cells[iText]?.trim();

    if (!username || !body) {
      warnings.push(`Zeile ${row + 1} übersprungen — Name oder Text fehlt.`);
      continue;
    }

    comments.push({
      username,
      text: body,
      externalId: iId >= 0 ? cells[iId]?.trim() || null : null,
      commentedAt: parseDate(cells[iDate], fallbackDate, row, warnings),
      likeCount: iLikes >= 0 ? Number(cells[iLikes]?.trim()) || 0 : 0,
    });
  }

  return { comments, warnings, format: "csv" };
}

/// "@name: Text" oder "name - Text"
function parseInline(lines: string[], fallbackDate: Date): ImportResult {
  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  lines.forEach((line, i) => {
    const match = line.match(/^\s*@?([\w.]{1,30})\s*[::]\s*(.+)$/);
    if (!match) {
      warnings.push(`Zeile ${i + 1} übersprungen — kein „Name: Text“ erkennbar.`);
      return;
    }
    comments.push({
      username: match[1],
      text: match[2].trim(),
      externalId: null,
      // Reihenfolge der Zeilen = Reihenfolge der Kommentare.
      commentedAt: new Date(fallbackDate.getTime() + i * 1000),
      likeCount: 0,
    });
  });

  return { comments, warnings, format: "inline" };
}

function parseDate(
  value: string | undefined,
  fallback: Date,
  row: number,
  warnings: string[],
): Date {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  // Deutsches Format zuerst: 24.12.2026 oder 24.12.2026 18:30
  const de = trimmed.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/,
  );
  if (de) {
    const [, d, m, y, hh = "0", mm = "0"] = de;
    return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    warnings.push(
      `Zeile ${row + 1}: Datum „${truncate(trimmed)}“ nicht verstanden, Importzeitpunkt verwendet.`,
    );
    return fallback;
  }
  return parsed;
}

function truncate(value: string, max = 30) {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max)}…` : v;
}
