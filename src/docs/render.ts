import { marked } from "marked";
import { slugify } from "@/lib/audit";

// Ein Text, zwei Ausgaben: die Datei ANLEITUNG.html zum Doppelklicken und
// die Hilfe-Seite im Tool. Beide gehen durch diese Funktion, damit sie gar
// nicht auseinanderlaufen koennen.

export interface TocEntry {
  /// 2 = Hauptabschnitt, 3 = Unterabschnitt
  level: number;
  title: string;
  /// Sprungmarke, auf die der Link im Inhaltsverzeichnis zeigt
  id: string;
}

export interface RenderedHandbook {
  html: string;
  toc: TocEntry[];
}

/// Wandelt das Handbuch in HTML um und sammelt dabei das Inhaltsverzeichnis.
export function renderHandbook(markdown: string): RenderedHandbook {
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();

  /// Sprungmarken muessen eindeutig sein — sonst springt der zweite
  /// gleichnamige Eintrag immer zum ersten. slugify kommt aus dem Projekt
  /// und behandelt Umlaute und ß bereits richtig.
  const uniqueId = (title: string) => {
    const base = slugify(title);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const renderer = new marked.Renderer();

  renderer.heading = function ({ text, depth, tokens }) {
    // Überschriften können selbst Markdown enthalten (etwa Fettdruck).
    const inline = this.parser.parseInline(tokens);
    const plain = text.replace(/[*_`]/g, "").trim();

    if (depth === 2 || depth === 3) {
      const id = uniqueId(plain);
      toc.push({ level: depth, title: plain, id });
      // Ziel ist der Seitenanfang, nicht das Inhaltsverzeichnis: In der
      // Tool-Ansicht steht das Verzeichnis seitlich und klebt fest — ein
      // Sprung dorthin bewegt die Seite sichtbar überhaupt nicht.
      return `<h${depth} id="${id}">${inline}<a class="rueck" href="#seitenanfang">↑ nach oben</a></h${depth}>\n`;
    }

    return `<h${depth}>${inline}</h${depth}>\n`;
  };

  const html = marked.parse(markdown, {
    renderer,
    gfm: true,
    async: false,
  }) as string;

  return { html, toc };
}

/// Baut das Inhaltsverzeichnis als verschachtelte Liste.
export function tocHtml(toc: TocEntry[]): string {
  if (toc.length === 0) return "";

  const items: string[] = [];
  let inSublist = false;
  let itemOpen = false;

  const link = (entry: TocEntry) =>
    `<a href="#${entry.id}">${escapeHtml(entry.title)}</a>`;

  for (const entry of toc) {
    if (entry.level === 2) {
      if (inSublist) {
        items.push("</ul>");
        inSublist = false;
      }
      if (itemOpen) items.push("</li>");
      items.push(`<li>${link(entry)}`);
      itemOpen = true;
    } else {
      // Unterabschnitt ohne vorangehenden Hauptabschnitt: trotzdem einhängen.
      if (!itemOpen) {
        items.push("<li>");
        itemOpen = true;
      }
      if (!inSublist) {
        items.push("<ul>");
        inSublist = true;
      }
      items.push(`<li>${link(entry)}</li>`);
    }
  }

  if (inSublist) items.push("</ul>");
  if (itemOpen) items.push("</li>");

  return `<ul class="inhalt">${items.join("")}</ul>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
