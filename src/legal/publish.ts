import { canonicalize, type Entrant } from "@/draw/commit-reveal";
import { escapeHtml } from "@/docs/render";

// Erzeugt die Seite, die auf GitHub Pages hochgeladen wird.
//
// Zweck: Die Gewinnspielseite laeuft nur auf dem eigenen Rechner — Teilnehmer
// erreichen sie nicht. Ohne veroeffentlichte Teilnehmerliste bleibt „rechne
// selbst nach" aber eine Behauptung, die niemand pruefen kann.
//
// Die Datei ist in sich geschlossen: Stylesheet eingebettet, keine externen
// Ressourcen. Sie funktioniert also auch ohne Internet und ueberall gleich.

export interface PublishInput {
  title: string;
  terms: string;
  organizer: string;
  contact: string;
  impressumUrl?: string | null;
  /// Erst nach der Ziehung gefüllt.
  draw?: {
    commitHash: string;
    entrantCount: number;
    totalLots: number;
    committedAt: Date;
    seed?: string | null;
    drawnAt?: Date | null;
    entrants: Entrant[];
    winners: { platz: number; username: string; prize?: string | null; text: string }[];
    reserves: string[];
  } | null;
}

function formatDe(value: Date) {
  return value.toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
}

export function buildPublishPage(input: PublishInput): string {
  const d = input.draw;

  const winnerBlock = d?.drawnAt
    ? `
<h2 id="gewinner">Gewinner</h2>
<ol class="gewinner">
${d.winners
  .map(
    (w) => `  <li>
    <strong>${escapeHtml(w.username)}</strong>${w.prize ? ` — ${escapeHtml(w.prize)}` : ""}
    <blockquote>${escapeHtml(w.text)}</blockquote>
  </li>`,
  )
  .join("\n")}
</ol>
${
  d.reserves.length > 0
    ? `<p><strong>Nachrücker:</strong> ${d.reserves.map((r) => escapeHtml(r)).join(" · ")}</p>`
    : ""
}
`
    : "";

  // Genau die Form, die auch in den Hash eingegangen ist. Nur so ergibt das
  // Nachrechnen dasselbe Ergebnis.
  const listBlock = d?.drawnAt
    ? `
<h2 id="nachweis">Nachweis der fairen Ziehung</h2>
<p>
  Die Prüfsumme unten wurde <strong>vor</strong> der Ziehung veröffentlicht, die
  Zufallszahl erst danach. Beides zusammen ergibt sich eindeutig aus der
  Teilnehmerliste — wäre nachträglich jemand hinzugefügt oder entfernt worden,
  käme eine andere Prüfsumme heraus.
</p>
<dl>
  <dt>Teilnehmer</dt><dd>${d.entrantCount} · ${d.totalLots} Lose</dd>
  <dt>Liste festgeschrieben</dt><dd>${formatDe(d.committedAt)}</dd>
  <dt>Gezogen</dt><dd>${formatDe(d.drawnAt)}</dd>
  <dt>Prüfsumme (SHA-256)</dt><dd><code>${escapeHtml(d.commitHash)}</code></dd>
  <dt>Zufallszahl</dt><dd><code>${escapeHtml(d.seed ?? "")}</code></dd>
</dl>

<h3 id="teilnehmerliste">Teilnehmerliste</h3>
<p>
  Genau dieser Text ist in die Prüfsumme eingegangen — Zeile für Zeile, in dieser
  Reihenfolge. Wer nachrechnen möchte, bildet den SHA-256-Wert über diesen Text,
  gefolgt von einer Zeile <code>--seed--</code> und der Zufallszahl.
</p>
<pre id="liste">${escapeHtml(canonicalize(d.entrants))}</pre>
`
    : `
<h2 id="nachweis">Nachweis der fairen Ziehung</h2>
<p>Die Ziehung hat noch nicht stattgefunden. Nach der Ziehung stehen hier
Prüfsumme, Zufallszahl und die vollständige Teilnehmerliste zum Nachrechnen.</p>
`;

  return seite({
    titel: `${input.title} — Teilnahmebedingungen`,
    inhalt: `
<h1>${escapeHtml(input.title)}</h1>
${winnerBlock}
<h2 id="bedingungen">Teilnahmebedingungen</h2>
<div class="bedingungen">${escapeHtml(input.terms)}</div>
${listBlock}`,
    fuss: fusszeile(input),
  });
}

/// Das gemeinsame Stylesheet aller erzeugten Seiten.
///
/// Eingebettet, weil die Seiten in sich geschlossen sein sollen: kein
/// Nachladen von fremden Servern. Das ist nicht nur Bequemlichkeit — es ist
/// der Grund, warum die Datenschutzerklaerung „keine fremden Inhalte" sagen
/// darf, ohne zu luegen.
const STIL = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; padding: 2rem 1.25rem 5rem; max-width: 44rem;
    font: 17px/1.7 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1e293b; background: #f8fafc; overflow-wrap: break-word; }
  h1 { font-size: 1.9rem; margin: 0 0 1.5rem; }
  h2 { font-size: 1.3rem; margin: 2.5rem 0 .75rem; padding-top: .75rem;
    border-top: 2px solid #e2e8f0; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; }
  pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px;
    overflow-x: auto; font-size: .8rem; line-height: 1.5; white-space: pre-wrap;
    word-break: break-all; }
  code { background: #e8edf3; padding: .12em .4em; border-radius: 4px;
    font-size: .85em; font-family: ui-monospace, Consolas, monospace; }
  pre code { background: none; padding: 0; }
  .bedingungen { white-space: pre-wrap; background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px; padding: 1.5rem; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; }
  dt { font-weight: 600; color: #475569; }
  dd { margin: 0; }
  dd code { word-break: break-all; }
  blockquote { margin: .4rem 0 0; padding: .5rem .9rem; border-left: 3px solid #cbd5e1;
    background: #f1f5f9; border-radius: 0 6px 6px 0; }
  ol.gewinner { padding-left: 1.3rem; }
  ol.gewinner li { margin: 1rem 0; }
  .unter { color: #64748b; margin: 0 0 2rem; }
  ul.gewinnspiele { list-style: none; padding: 0; margin: 0; }
  ul.gewinnspiele li { background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: .75rem; }
  ul.gewinnspiele a { font-size: 1.1rem; font-weight: 600; color: #1d4ed8;
    text-decoration: none; }
  ul.gewinnspiele a:hover { text-decoration: underline; }
  .zustand { display: block; font-size: .85rem; color: #64748b; margin-top: .2rem; }
  .leer { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 1.25rem; color: #64748b; }
  .hinweis { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;
    font-size: .85rem; color: #64748b; }
  a { color: #1d4ed8; }
  footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0;
    font-size: .85rem; color: #64748b; }
  @media (prefers-color-scheme: dark) {
    body { color: #e2e8f0; background: #0f172a; }
    h2 { border-top-color: #334155; }
    code { background: #1e293b; }
    .bedingungen, ul.gewinnspiele li, .leer { background: #1e293b; border-color: #334155; }
    blockquote { background: #1e293b; border-left-color: #475569; }
    dt { color: #94a3b8; }
    a, ul.gewinnspiele a { color: #93c5fd; }
    footer, .hinweis { border-top-color: #334155; }
  }`;

/// Der gemeinsame Rahmen. Alle drei Seitenarten sollen zusammenpassen —
/// sie liegen schliesslich unter derselben Adresse nebeneinander.
function seite(input: { titel: string; inhalt: string; fuss: string }): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.titel)}</title>
<style>${STIL}
</style>
</head>
<body>
${input.inhalt}
<footer>
  ${input.fuss}
</footer>

</body>
</html>
`;
}

/// Fusszeile mit den Pflichtverweisen.
///
/// Impressum (§ 5 DDG) und Datenschutzerklaerung (Art. 13 DSGVO) muessen von
/// jeder Seite aus erreichbar sein, nicht nur von der Startseite.
function fusszeile(input: {
  organizer: string;
  contact: string;
  impressumUrl?: string | null;
  /// Auf der Datenschutzseite selbst waere ein Verweis auf sie sinnlos.
  ohneDatenschutz?: boolean;
}): string {
  const teile = [
    `Veranstalter: ${escapeHtml(input.organizer)}`,
    `Kontakt: ${escapeHtml(input.contact)}`,
  ];
  const impressum = input.impressumUrl?.trim();
  if (impressum) {
    teile.push(
      `<a href="${escapeHtml(impressum)}" target="_blank" rel="noreferrer">Impressum</a>`,
    );
  }
  if (!input.ohneDatenschutz) {
    teile.push(`<a href="datenschutz.html">Datenschutz</a>`);
  }
  return teile.join(" · ");
}

/// Die Datenschutzerklaerung als eigene Seite.
///
/// Bewusst eine eigene Datei statt eines Abschnitts auf jeder Seite: Sie muss
/// unter einer festen Adresse dauerhaft erreichbar sein, auch wenn ein
/// einzelnes Gewinnspiel laengst weg ist.
export function buildPrivacyPage(input: {
  text: string;
  organizer: string;
  contact: string;
  impressumUrl?: string | null;
}): string {
  return seite({
    titel: `Datenschutzerklärung — ${input.organizer}`,
    inhalt: `
<h1>Datenschutzerklärung</h1>
<div class="bedingungen">${escapeHtml(input.text)}</div>`,
    fuss: fusszeile({ ...input, ohneDatenschutz: true }),
  });
}

/// Ergaenzt ein fehlendes `https://`.
///
/// „mein.online-impressum.de/tobisreise" ohne Schema liest der Browser als
/// relativen Pfad — der Link zeigt dann ins Nichts. Das faellt beim Eintragen
/// niemandem auf, sondern erst dem Teilnehmer, der draufklickt.
export function withScheme(url: string): string {
  const clean = url.trim();
  if (!clean) return "";
  // mailto:, tel: und Konsorten bleiben unberuehrt.
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean)) return clean;
  return `https://${clean}`;
}

export interface IndexEntry {
  /// Dateiname ohne Endung, zugleich der Link.
  slug: string;
  title: string;
  endsAt?: Date | null;
  completed: boolean;
}

/// Die Startseite der Veroeffentlichung.
///
/// Sie hat zwei Aufgaben: Sie ist der erste Inhalt im Repository — ohne den
/// laesst sich GitHub Pages gar nicht einschalten — und sie gibt dir eine
/// dauerhafte Adresse zum Verlinken, statt fuer jedes Gewinnspiel eine neue.
export function buildIndexPage(input: {
  organizer: string;
  contact: string;
  impressumUrl?: string | null;
  entries: IndexEntry[];
}): string {
  const liste =
    input.entries.length === 0
      ? `<p class="leer">Hier erscheinen die Gewinnspiele, sobald das erste
         veröffentlicht ist.</p>`
      : `<ul class="gewinnspiele">
${input.entries
  .map(
    (e) => `  <li>
    <a href="${escapeHtml(e.slug)}.html">${escapeHtml(e.title)}</a>
    <span class="zustand">${e.completed ? "abgeschlossen" : "läuft"}${
      e.endsAt ? ` · Einsendeschluss ${formatDe(e.endsAt)}` : ""
    }</span>
  </li>`,
  )
  .join("\n")}
</ul>`;

  return seite({
    titel: `Gewinnspiele — ${escapeHtml(input.organizer)}`,
    inhalt: `
<h1>Gewinnspiele</h1>
<p class="unter">von ${escapeHtml(input.organizer)}</p>

${liste}

<div class="hinweis">
  <p>
    Hier findest du die vollständigen Teilnahmebedingungen und nach der Ziehung
    den Nachweis, dass fair gezogen wurde — samt Teilnehmerliste zum Nachrechnen.
  </p>
  <p>
    Diese Aktionen stehen in keiner Verbindung zu Instagram, TikTok oder YouTube und
    werden von diesen weder gesponsert noch unterstützt oder organisiert. Mit der
    Teilnahme stellst du diese Plattformen von jeglicher Haftung frei. Fragen bitte
    nicht an die Plattform, sondern an ${escapeHtml(input.organizer)}
    (${escapeHtml(input.contact)}).
  </p>
</div>`,
    fuss: fusszeile(input),
  });
}
