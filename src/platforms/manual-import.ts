import type { CommentInput } from "@/rules/engine";

// Import von Hand — der Weg fuer TikTok und als Notnagel fuer alles andere.
//
// Menschen kopieren Kommentare in ganz unterschiedlichen Formaten zusammen.
// Der Parser erkennt deshalb selbststaendig:
//   1. CSV/TSV mit Kopfzeile   (username;text;datum)
//   2. "@name: Text"           (eine Zeile je Teilnahme)
//   3. "@name" / "Text"        (Name und Text in abwechselnden Zeilen)
//
// Alles, was er nicht zuordnen kann, wird nicht stillschweigend verworfen,
// sondern als Warnung gemeldet.

export interface ImportResult {
  comments: CommentInput[];
  warnings: string[];
  /// Erkanntes Format, wird dem Nutzer zur Kontrolle angezeigt.
  format: "csv" | "inline" | "alternating" | "leer";
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
  return parseAlternating(lines, fallbackDate);
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

/// Name in einer Zeile, Text in der naechsten — so sieht ein Copy-Paste
/// aus der TikTok-Weboberflaeche typischerweise aus.
function parseAlternating(lines: string[], fallbackDate: Date): ImportResult {
  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  for (let i = 0; i + 1 < lines.length; i += 2) {
    const username = lines[i].trim().replace(/^@/, "");
    const body = lines[i + 1].trim();

    if (!/^[\w.]{1,30}$/.test(username)) {
      warnings.push(
        `Zeile ${i + 1} übersprungen — „${truncate(lines[i])}“ sieht nicht wie ein Benutzername aus.`,
      );
      i -= 1; // Nur diese Zeile verwerfen, nicht den Takt verlieren.
      continue;
    }

    comments.push({
      username,
      text: body,
      externalId: null,
      commentedAt: new Date(fallbackDate.getTime() + i * 1000),
      likeCount: 0,
    });
  }

  if (lines.length % 2 !== 0) {
    warnings.push("Die letzte Zeile hatte kein Gegenstück und wurde ignoriert.");
  }

  return { comments, warnings, format: "alternating" };
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
