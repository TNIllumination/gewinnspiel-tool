// Erzeugt ANLEITUNG.html aus docs/HANDBUCH.md.
//
// Die Datei ist bewusst in sich geschlossen: Stylesheet eingebettet, keine
// externen Ressourcen. So laesst sie sich per Doppelklick oeffnen, auch ohne
// Internet und ohne dass irgendein Programm installiert sein muss.
//
// Aufruf: npm run docs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderHandbook, tocHtml } from "../src/docs/render.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const markdown = readFileSync(join(ROOT, "docs", "HANDBUCH.md"), "utf8");
const { html, toc } = renderHandbook(markdown);
const version = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
).version;

const page = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gewinnspiel-Tool — Handbuch</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 2rem 1.25rem 6rem; max-width: 46rem;
    font: 17px/1.7 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #1e293b; background: #f8fafc;
    overflow-wrap: break-word;
  }
  h1 { font-size: 2rem; margin: 0 0 .5rem; }
  h2 { font-size: 1.4rem; margin: 2.5rem 0 .75rem; padding-top: .75rem;
       border-top: 2px solid #e2e8f0; scroll-margin-top: 1rem; }
  h3 { font-size: 1.12rem; margin: 1.75rem 0 .5rem; scroll-margin-top: 1rem; }
  p, ul, ol { margin: .75rem 0; }
  li { margin: .3rem 0; }
  code { background: #e8edf3; padding: .12em .4em; border-radius: 4px;
         font-size: .9em; font-family: ui-monospace, Consolas, monospace; }
  pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px;
        overflow-x: auto; }
  pre code { background: none; color: inherit; padding: 0; }
  a { color: #1d4ed8; }
  blockquote { margin: 1rem 0; padding: .75rem 1rem; border-left: 4px solid #f59e0b;
               background: #fffbeb; border-radius: 0 6px 6px 0; }
  blockquote p { margin: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; display: block;
          overflow-x: auto; }
  th, td { border: 1px solid #cbd5e1; padding: .5rem .7rem; text-align: left;
           vertical-align: top; }
  th { background: #e8edf3; }
  .kopf { padding: 1.25rem 1.5rem; background: #fff; border: 1px solid #e2e8f0;
          border-radius: 12px; margin-bottom: 2rem; }
  .kopf p { margin: .25rem 0 0; color: #64748b; font-size: .95rem; }
  .inhalt-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
                padding: 1.25rem 1.5rem; margin-bottom: 2.5rem; }
  .inhalt-box > h2 { border: none; margin: 0 0 .5rem; padding: 0; font-size: 1.15rem; }
  ul.inhalt, ul.inhalt ul { list-style: none; padding-left: 0; margin: 0; }
  ul.inhalt > li { margin: .45rem 0; font-weight: 600; }
  ul.inhalt ul { padding-left: 1.1rem; margin: .25rem 0 .6rem; }
  ul.inhalt ul li { font-weight: 400; font-size: .95rem; }
  ul.inhalt a { text-decoration: none; }
  ul.inhalt a:hover { text-decoration: underline; }
  .rueck { float: right; font-size: .8rem; text-decoration: none; font-weight: 400;
           color: #64748b; padding: .35rem .6rem; border-radius: 6px;
           background: #eef2f7; white-space: nowrap; }
  .rueck:hover { background: #dbe3ec; color: #1e293b; }
  @media (prefers-color-scheme: dark) {
    body { color: #e2e8f0; background: #0f172a; }
    h2 { border-top-color: #334155; }
    code { background: #1e293b; }
    a { color: #93c5fd; }
    th { background: #1e293b; }
    th, td { border-color: #334155; }
    .kopf, .inhalt-box { background: #1e293b; border-color: #334155; }
    blockquote { background: #422006; border-left-color: #f59e0b; }
  }
</style>
</head>
<body>

<div class="kopf" id="seitenanfang">
  <h1>Gewinnspiel-Tool</h1>
  <p>Handbuch zur Fassung ${version}</p>
</div>

<div class="inhalt-box" id="inhalt">
  <h2>Inhalt</h2>
  ${tocHtml(toc)}
</div>

${html}

</body>
</html>
`;

const target = join(ROOT, "ANLEITUNG.html");
writeFileSync(target, page, "utf8");

console.log(
  `ANLEITUNG.html erzeugt — ${toc.length} Einträge im Inhaltsverzeichnis, ` +
    `${(page.length / 1024).toFixed(0)} KB.`,
);
