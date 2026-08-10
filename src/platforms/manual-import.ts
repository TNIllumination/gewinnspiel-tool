import type { CommentInput } from "@/rules/engine";

// Import von Hand — der Weg fuer TikTok und als Notnagel fuer alles andere.
//
// Menschen kopieren Kommentare in ganz unterschiedlichen Formaten zusammen.
// Der Parser erkennt deshalb selbststaendig:
//   1. CSV/TSV mit Kopfzeile   (username;text;datum)
//   2. "@name: Text"           (eine Zeile je Teilnahme)
//   3. TikTok-Kopie            (Name steht doppelt)
//   4. Instagram-Kopie         ("<name>s Profilbild", dann der Name)
//   5. Bloecke                 (Name in einer Zeile, Text darunter)
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
  format: "csv" | "inline" | "tiktok" | "instagram" | "blocks" | "leer";
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

  // Die beiden Kopierformate zuerst: Sie haben einen eindeutigen Anker, und
  // parseBlocks wuerde sie falsch lesen — den doppelten Namen als Text, die
  // Profilbild-Zeile als Teilnehmer.
  const tiktok = tiktokAnker(lines);
  if (tiktok.length >= 2) return parseTikTok(lines, tiktok, fallbackDate);

  const insta = instagramAnker(lines);
  if (insta.length >= 2) return parseInstagram(lines, insta, fallbackDate);

  // Hier ist kein Anker gegriffen — gelesen wird also nach dem allgemeinen
  // Format. Sieht der Text aber nach einer Kopie aus, ist das Ergebnis mit
  // hoher Wahrscheinlichkeit falsch, und zwar unauffaellig falsch: Es
  // entstehen Teilnehmer mit fremden Texten. Das muss vornedran stehen.
  const ergebnis = parseBlocks(lines, fallbackDate);
  const verdacht = wirktWieKopie(lines);
  if (verdacht) {
    ergebnis.warnings.unshift(
      `Das sieht nach einer ${verdacht}-Kopie aus, ließ sich aber nicht als solche ` +
        "lesen — die Namen unten stimmen dann wahrscheinlich nicht. Prüf die " +
        "Vorschau genau, bevor du übernimmst.",
    );
  }
  return ergebnis;
}

/// Verraeterische Merkmale einer Kopie aus der App.
///
/// Absichtlich streng: Ein falscher Alarm bei einer ordentlichen CSV-Datei
/// waere schlimmer als gar keiner, weil man ihn nach dem zweiten Mal
/// wegklickt. Deshalb zaehlen nur Zeilen, die **fuer sich allein** stehen —
/// im Fliesstext eines Kommentars kommen sie so nicht vor — und es braucht
/// mindestens zwei davon.
export function wirktWieKopie(lines: string[]): "Instagram" | "TikTok" | null {
  let insta = 0;
  let tiktok = 0;

  for (const roh of lines) {
    const zeile = roh.trim();
    if (!zeile) continue;

    if (INSTA_PROFILBILD.test(zeile)) insta += 2; // das deutlichste Merkmal
    else if (INSTA_ALTER.test(zeile)) insta += 1;
    else if (/^(Antworten|Reply|Antwort)$/i.test(zeile)) insta += 1;
    else if (/^(Gefällt \d+ Mal|\d+ likes?)$/i.test(zeile)) insta += 1;

    if (ANTWORTEN.test(zeile)) tiktok += 1;
    else if (TIKTOK_DATUM.test(zeile) && MONATE.includes(zeile.split(/\s+/)[0])) {
      tiktok += 1;
    }
  }

  if (insta >= 2 && insta >= tiktok) return "Instagram";
  if (tiktok >= 2) return "TikTok";
  return null;
}

// ── Kopiert aus der Weboberflaeche ───────────────────────────────────────────
//
// Beide Formate werden **erkannt, nicht gezaehlt**. Feste Abstaende ("das
// Datum steht in Zeile 4") brechen an echten Daten: Ein Kommentar ohne Text
// verschiebt alles um eine Zeile, ein mehrzeiliger Kommentar ebenso. Das
// Ergebnis waeren Teilnehmer mit fremden Texten — schlimmer als gar kein
// Import, weil es niemandem auffaellt.

const TIKTOK_DATUM = /^([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s*(\d{4}))?$/;
const MONATE = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LIKE_ZAHL = /^\d+([.,]\d+)?\s*[km]?$/i;
const ANTWORTEN = /^view( all)? \d+ repl(y|ies)$/i;
// Die deutsche und die englische Fassung derselben Zeile. Wer die App auf
// Englisch benutzt, kopiert „annas profile picture" statt „annas Profilbild" —
// ohne den zweiten Fall greift der Anker nicht und der Text landet beim
// allgemeinen Format, das ihn falsch liest.
const INSTA_PROFILBILD = /^(.*?)(?:s Profilbild|'s profile picture)$/i;
// Bearbeitete Kommentare haengen einen Zusatz an: „1 Wo. · Bearbeitet".
// Englisch stehen die Einheiten ohne Punkt und einbuchstabig: 3d, 1w, 5h.
const INSTA_ALTER =
  /^(\d+)\s*(Min|Sek|Std|Tag|Tage|Wo|Monat|Monate|Jahr|Jahre|s|m|h|d|w|y)\.?(\s*[·|]\s*(Bearbeitet|Edited))?$/i;

/// TikTok wiederholt den Namen: zwei gleiche Zeilen hintereinander eroeffnen
/// eine Teilnahme. Ein sehr verlaesslicher Anker — Kommentartexte wiederholen
/// sich praktisch nie wortgleich direkt hintereinander.
function tiktokAnker(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i].trim();
    if (!a || a !== lines[i + 1].trim() || a.length > 60) continue;
    if (isNoise(a)) continue;
    // Drei gleiche Zeilen hintereinander sind kein zweiter Anker.
    if (out.length > 0 && i - out[out.length - 1] < 2) continue;
    out.push(i);
  }
  return out;
}

/// Instagram stellt dem Namen die Bildbeschreibung voran: „annas Profilbild"
/// gefolgt von „anna". Beides zusammen ist der Anker — die Zeile allein
/// koennte auch im Kommentartext stehen.
function instagramAnker(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const treffer = lines[i].trim().match(INSTA_PROFILBILD);
    if (treffer && treffer[1] && treffer[1] === lines[i + 1].trim()) out.push(i);
  }
  return out;
}

/// Die Zeilen eines Blocks, ohne die beiden Kopfzeilen.
function bloecke(lines: string[], anker: number[], kopf: number) {
  return anker.map((start, k) => ({
    start,
    zeilen: lines.slice(start + kopf, k + 1 < anker.length ? anker[k + 1] : lines.length),
  }));
}

function parseTikTok(
  lines: string[],
  anker: number[],
  fallbackDate: Date,
): ImportResult {
  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  for (const { start, zeilen } of bloecke(lines, anker, 2)) {
    const username = lines[start].trim();
    const teile: string[] = [];
    let datum: Date | null = null;
    let likes = 0;

    for (const roh of zeilen) {
      const zeile = roh.trim();
      if (!zeile || ANTWORTEN.test(zeile)) continue;

      const d = zeile.match(TIKTOK_DATUM);
      if (d && MONATE.includes(d[1])) {
        datum = new Date(
          Number(d[3] ?? new Date().getFullYear()),
          MONATE.indexOf(d[1]),
          Number(d[2]),
          12,
        );
        continue;
      }
      if (LIKE_ZAHL.test(zeile)) {
        likes = Math.round(Number(zeile.replace(",", ".").replace(/[km]$/i, "")));
        continue;
      }
      teile.push(zeile);
    }

    const text = teile.join(" ").trim();
    if (!text) {
      warnings.push(`„${truncate(username)}“ übersprungen — kein Kommentartext dabei.`);
      continue;
    }
    comments.push({
      username,
      text,
      externalId: null,
      commentedAt: datum ?? new Date(fallbackDate.getTime() + comments.length * 1000),
      likeCount: Number.isFinite(likes) ? likes : 0,
    });
  }

  return { comments, warnings, format: "tiktok" };
}

function parseInstagram(
  lines: string[],
  anker: number[],
  fallbackDate: Date,
): ImportResult {
  const comments: CommentInput[] = [];
  const warnings: string[] = [];

  for (const { start, zeilen } of bloecke(lines, anker, 2)) {
    const username = lines[start].trim().match(INSTA_PROFILBILD)![1];
    const teile: string[] = [];
    let alter: Date | null = null;

    for (const roh of zeilen) {
      const zeile = roh.trim();
      if (!zeile) continue;

      const a = zeile.match(INSTA_ALTER);
      if (a && !alter) {
        alter = new Date(fallbackDate.getTime() - Number(a[1]) * spanne(a[2]));
        continue;
      }

      // „Antworten", „Gefällt mir", „Übersetzung anzeigen": Bedienelemente,
      // keine Kommentare. Die deutsche Beispielkopie enthielt sie zufaellig
      // nicht — deshalb ist es lange nicht aufgefallen, obwohl sie sonst
      // hinten an jedem Kommentartext geklebt haetten.
      if (isNoise(zeile)) continue;

      teile.push(zeile);
    }

    // Mehrzeilige Kommentare bleiben zusammen — sie stehen als mehrere
    // Zeilen da, sind aber ein Kommentar.
    const text = teile.join(" ").trim();
    if (!text) {
      warnings.push(`„${truncate(username)}“ übersprungen — kein Kommentartext dabei.`);
      continue;
    }
    comments.push({
      username,
      text,
      externalId: null,
      commentedAt: alter ?? new Date(fallbackDate.getTime() - comments.length * 1000),
      likeCount: 0,
    });
  }

  return { comments, warnings, format: "instagram" };
}

/// Laenge einer Instagram-Zeiteinheit in Millisekunden. Naeherung — genauer
/// gibt Instagram es beim Kopieren nicht her.
function spanne(einheit: string): number {
  const e = einheit.toLowerCase();
  const MIN = 60_000, STD = 60 * MIN, TAG = 24 * STD;
  // Die einbuchstabigen Formen sind die englischen: 30s, 5m, 3h, 2d, 1w, 1y.
  // „m" ist dort die Minute, nicht der Monat — der heisst „mo" oder steht
  // ausgeschrieben. Falsch geraten waeren aus fuenf Minuten fuenf Monate.
  if (e === "s" || e.startsWith("sek")) return 1000;
  if (e === "m" || e.startsWith("min")) return MIN;
  if (e === "h" || e.startsWith("std")) return STD;
  if (e === "d" || e.startsWith("tag")) return TAG;
  if (e === "w" || e.startsWith("wo")) return 7 * TAG;
  if (e.startsWith("monat")) return 30 * TAG;
  return 365 * TAG;
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
