#!/usr/bin/env node
//
// Rechnet eine veroeffentlichte Ziehung nach.
//
//   node pruefen.mjs https://name.github.io/gewinnspiele/verlosung.html
//   node pruefen.mjs gespeicherte-seite.html
//
// Warum es dieses Programm gibt: Die Pruefsumme auf der veroeffentlichten Seite
// belegt, dass an der Teilnehmerliste nichts veraendert wurde. Sie belegt
// **nicht**, dass die genannten Gewinner aus dieser Liste und dieser Zufallszahl
// folgen — dafuer muss man die Ziehung nachrechnen. Genau das passiert hier.
//
// Warum es den Code doppelt: Ein Pruefprogramm, das dieselben Zeilen benutzt wie
// das Tool, beweist nichts — beide waeren auf dieselbe Weise falsch. Deshalb ist
// dies ein eigenstaendiger Nachbau nach der Beschreibung auf der Seite, ohne
// jede Abhaengigkeit und ohne Bezug zum uebrigen Quellcode. Wer misstrauisch
// ist, liest die knapp hundert Zeilen und urteilt selbst.
//
// Verfahren (steht so auch auf der veroeffentlichten Seite):
//   Pruefsumme  = SHA-256 ueber die Teilnehmerliste + "\n--seed--\n" + Zufallszahl
//   Zufall      = HMAC-SHA256(Zufallszahl, "ctr:0"), "ctr:1", … als Bytestrom
//   Ziehung     = gewichtet nach Losen, ohne Zuruecklegen, in der Reihenfolge
//                 der Teilnehmerliste; 6 Byte je Zug, Werte oberhalb der
//                 groessten durch die Losanzahl teilbaren Schranke werden
//                 verworfen (sonst waeren kleine Zahlen minimal haeufiger)

import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";

// ── Seite einlesen ──────────────────────────────────────────────────────────

const quelle = process.argv[2];
if (!quelle) {
  console.error("Aufruf: node pruefen.mjs <Adresse oder Datei>");
  process.exit(2);
}

let html;
try {
  html = /^https?:\/\//i.test(quelle)
    ? await (await fetch(quelle)).text()
    : await readFile(quelle, "utf8");
} catch (fehler) {
  console.error(`\nDie Seite ließ sich nicht laden: ${quelle}`);
  console.error(`Grund: ${fehler.message}\n`);
  process.exit(2);
}

/// Holt den Inhalt eines Elements mit dieser id.
function element(id, tag) {
  const treffer = html.match(
    new RegExp(`<${tag}[^>]*id="${id}"[^>]*>([\\s\\S]*?)</${tag}>`, "i"),
  );
  return treffer ? treffer[1] : null;
}

/// Holt den Wert hinter einer Beschriftung aus der Angabenliste.
///
/// Das <code> ist Pflicht, nicht Zierde: Auf der Seite stehen zwei Zeilen, die
/// mit „Prüfsumme" beginnen — zuerst „Prüfsumme veröffentlicht" mit einem
/// Datum, dann „Prüfsumme (SHA-256)" mit dem Wert. Nur der Wert steht in einem
/// <code>. Ohne diese Bedingung vergleicht man einen Hash mit einem Datum und
/// haelt eine einwandfreie Ziehung fuer gefaelscht.
function angabe(beschriftung) {
  const treffer = html.match(
    new RegExp(`<dt>${beschriftung}[^<]*</dt>\\s*<dd><code>([^<]*)</code>`, "i"),
  );
  return treffer ? treffer[1].trim() : null;
}

function entschaerft(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

const liste = element("liste", "pre");
const pruefsumme = angabe("Prüfsumme");
const zufallszahl = angabe("Zufallszahl");
const gezogenBlock = element("gezogen", "ol");

if (!liste || !pruefsumme || !zufallszahl || !gezogenBlock) {
  console.error(
    "Auf dieser Seite fehlen Angaben. Nachrechnen geht erst, wenn die Ziehung\n" +
      "stattgefunden hat und Teilnehmerliste, Prüfsumme, Zufallszahl und die\n" +
      "gezogene Reihenfolge veröffentlicht sind.",
  );
  process.exit(2);
}

const kanonisch = entschaerft(liste).replace(/\r\n/g, "\n").trim();
const gezogen = [...gezogenBlock.matchAll(/<li>([\s\S]*?)<\/li>/gi)].map((m) =>
  entschaerft(m[1]).trim(),
);

// ── 1. Ist die Teilnehmerliste unveraendert? ────────────────────────────────

const eigene = createHash("sha256")
  .update(`${kanonisch}\n--seed--\n${zufallszahl}`, "utf8")
  .digest("hex");

const listeStimmt = eigene === pruefsumme;

// ── 2. Folgt die gezogene Reihenfolge aus Liste und Zufallszahl? ────────────

/// Zufallsbytes aus HMAC-SHA256 im Zaehlerbetrieb.
function* bytestrom(seed) {
  for (let zaehler = 0; ; zaehler++) {
    const block = createHmac("sha256", seed).update(`ctr:${zaehler}`).digest();
    for (const b of block) yield b;
  }
}

function zieher(seed) {
  const strom = bytestrom(seed);
  return (max) => {
    if (max === 1) return 0;
    const RAUM = 2 ** 48;
    const schranke = Math.floor(RAUM / max) * max;
    for (;;) {
      let wert = 0;
      for (let i = 0; i < 6; i++) wert = wert * 256 + strom.next().value;
      if (wert < schranke) return wert % max;
    }
  };
}

// Die Teilnehmerliste steht bereits in der Reihenfolge, in der gezogen wurde:
// Kopfzeilen, dann "--", dann je Zeile "name|lose|kennung".
const zeilen = kanonisch.split("\n");
const trenner = zeilen.indexOf("--");
const topf = zeilen.slice(trenner + 1).map((z) => {
  const [name, lose, kennung] = z.split("|");
  // Verglichen wird ueber Name UND Kennung: Wer auf zwei Plattformen
  // kommentiert hat, steht zweimal in der Liste, und der Name allein ist
  // dann nicht eindeutig.
  return { name, lose: Number(lose), schluessel: `${name}|${kennung}` };
});

const naechste = zieher(zufallszahl);
const uebrig = [...topf];
let loseUebrig = uebrig.reduce((summe, t) => summe + t.lose, 0);
const eigeneReihenfolge = [];

for (let i = 0; i < Math.min(gezogen.length, topf.length); i++) {
  let los = naechste(loseUebrig);
  let index = 0;
  while (index < uebrig.length && los >= uebrig[index].lose) {
    los -= uebrig[index].lose;
    index++;
  }
  const [gewaehlt] = uebrig.splice(index, 1);
  loseUebrig -= gewaehlt.lose;
  eigeneReihenfolge.push(gewaehlt.schluessel);
}

const wieVeroeffentlicht = gezogen.map((n) => n.trim());
const ziehungStimmt =
  eigeneReihenfolge.length === wieVeroeffentlicht.length &&
  eigeneReihenfolge.every((n, i) => n === wieVeroeffentlicht[i]);

// ── Urteil ──────────────────────────────────────────────────────────────────

console.log(`\nTeilnehmer:   ${topf.length}`);
console.log(`Lose:         ${topf.reduce((s, t) => s + t.lose, 0)}`);
console.log(`Prüfsumme:    ${listeStimmt ? "stimmt" : "STIMMT NICHT"}`);
console.log(`Ziehung:      ${ziehungStimmt ? "stimmt" : "STIMMT NICHT"}\n`);

if (listeStimmt && ziehungStimmt) {
  console.log("✅ Alles stimmt.");
  console.log("   Die Teilnehmerliste ist unverändert, und die gezogene");
  console.log("   Reihenfolge folgt genau aus dieser Liste und dieser Zufallszahl.\n");
  process.exit(0);
}

if (!listeStimmt) {
  console.log("❌ Die Prüfsumme passt nicht zu Liste und Zufallszahl.");
  console.log(`   auf der Seite:  ${pruefsumme}`);
  console.log(`   nachgerechnet:  ${eigene}`);
  console.log("   An der Liste wurde nach der Veröffentlichung etwas verändert —");
  console.log("   oder die Seite ist beim Speichern beschädigt worden.\n");
}

if (!ziehungStimmt) {
  console.log("❌ Die gezogene Reihenfolge lässt sich nicht reproduzieren.");
  console.log(`   auf der Seite:  ${wieVeroeffentlicht.slice(0, 5).join(", ")}`);
  console.log(`   nachgerechnet:  ${eigeneReihenfolge.slice(0, 5).join(", ")}\n`);
}

process.exit(1);
