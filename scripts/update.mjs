// Update-Programm.
//
// Holt die neueste Fassung von GitHub und tauscht die Programmdateien aus.
//
// Oberster Grundsatz: DEINE DATEN WERDEN NIE ANGEFASST.
// Weder die Datenbank noch die Schluessel in .env — und bevor ueberhaupt
// etwas passiert, wird beides gesichert. Schlaegt irgendein Schritt fehl,
// bleibt der bisherige Stand unveraendert.

import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { unzip } from "./unzip.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT ?? "3000";

export const REPO = "TNIllumination/gewinnspiel-tool";
export const BRANCH = "main";
const ZIP_URL = `https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}`;
const VERSION_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/package.json`;
const CHANGELOG_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/CHANGELOG.md`;

/// Was unter keinen Umstaenden ueberschrieben oder geloescht wird.
/// Alles andere kommt frisch aus dem Paket — dadurch verschwinden auch
/// Dateien, die es in der neuen Fassung nicht mehr gibt.
const PROTECTED = [
  ".env",
  ".env.local",
  "sicherung",
  // Selbst erzeugte Seiten fuer GitHub Pages — die darf ein Update nie loeschen.
  "veroeffentlichung",
  "node_modules",
  ".git",
  ".next",
];

const isProtected = (name) =>
  PROTECTED.includes(name) || /\.db($|-)/.test(name);

const say = (m) => console.log(m);
const step = (m) => console.log(`\n▶ ${m}`);

function stop(title, hint) {
  console.error(`\n❌ ${title}\n`);
  if (hint) console.error(`${hint}\n`);
  process.exitCode = 1;
}

export function localVersion() {
  try {
    return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  } catch {
    return "0.0.0";
  }
}

/// Vergleicht Fassungsnummern wie 0.10.0 richtig — also nicht als Text,
/// sonst waere "0.9.0" groesser als "0.10.0".
export function isNewer(remote, local) {
  const parts = (v) => String(v).split(".").map((n) => parseInt(n, 10) || 0);
  const [a, b] = [parts(remote), parts(local)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

/// Fragt GitHub nach der neuesten Fassung. Ohne Internet: null, keine Fehlermeldung.
export async function fetchLatest() {
  try {
    const res = await fetch(VERSION_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const { version } = await res.json();
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/// Erste Zeilen des obersten Changelog-Eintrags — damit sichtbar ist,
/// was das Update bringt.
export async function fetchChangelogHead() {
  try {
    const res = await fetch(CHANGELOG_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split("\n");
    const start = lines.findIndex((l) => l.startsWith("## "));
    if (start === -1) return null;
    return lines
      .slice(start + 1)
      .filter((l) => l.trim() && !l.startsWith("## "))
      .slice(0, 4)
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .join("\n  ");
  } catch {
    return null;
  }
}

async function isRunning() {
  try {
    const res = await fetch(`http://localhost:${PORT}`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok || res.status === 307;
  } catch {
    return false;
  }
}

function run(command, args, { title, hint }) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    stop(title, hint);
    process.exit(1);
  }
}

// ── Ab hier nur ausfuehren, wenn direkt gestartet ────────────────────────────
const startedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (startedDirectly) {
  await main();
}

async function main() {
  say("\n╭──────────────────────────────────────────╮");
  say("│  Gewinnspiel-Tool wird aktualisiert …    │");
  say("╰──────────────────────────────────────────╯");

  // ── 1. Laeuft das Tool noch? ───────────────────────────────────────────────
  if (await isRunning()) {
    stop(
      "Das Tool läuft gerade noch.",
      "Bitte zuerst das schwarze Fenster schließen, in dem das Tool läuft,\n" +
        "und danach update.bat erneut doppelklicken.\n\n" +
        "Grund: Solange es läuft, sind die Dateien gesperrt und ein Austausch\n" +
        "würde auf halbem Weg abbrechen.",
    );
    process.exit(1);
  }

  const before = localVersion();
  const latest = await fetchLatest();

  if (!latest) {
    stop(
      "Die neueste Fassung konnte nicht abgefragt werden.",
      "Prüf bitte die Internetverbindung und versuch es noch einmal.",
    );
    process.exit(1);
  }

  if (!isNewer(latest, before)) {
    say(`\n✅ Alles aktuell — du hast bereits Fassung ${before}.\n`);
    return;
  }

  say(`\n  Vorhanden: ${before}   →   Neu: ${latest}`);

  // ── 2. Sicherung ───────────────────────────────────────────────────────────
  step("Deine Daten werden gesichert …");
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace("T", "-")
    .replace(":", "");
  const backupDir = join(ROOT, "sicherung", stamp);
  mkdirSync(backupDir, { recursive: true });

  let savedAnything = false;
  for (const name of readdirSync(ROOT)) {
    if (name === ".env" || /\.db($|-)/.test(name)) {
      cpSync(join(ROOT, name), join(backupDir, name));
      savedAnything = true;
    }
  }
  say(
    savedAnything
      ? `  Kopie liegt in: sicherung\\${stamp}`
      : "  Nichts zu sichern (frische Installation).",
  );

  // ── 3. Herunterladen ───────────────────────────────────────────────────────
  step("Neue Fassung wird geladen …");
  let zipBytes;
  try {
    const res = await fetch(ZIP_URL, { signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    zipBytes = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    stop(
      "Der Download ist fehlgeschlagen.",
      `Es wurde nichts verändert — deine bisherige Fassung läuft weiter.\n(${error.message})`,
    );
    process.exit(1);
  }
  say(`  ${(zipBytes.length / 1024 / 1024).toFixed(1)} MB geladen.`);

  // ── 4. Entpacken ───────────────────────────────────────────────────────────
  step("Dateien werden entpackt …");
  const staging = join(tmpdir(), `gewinnspiel-update-${Date.now()}`);
  let fileCount = 0;
  try {
    const files = unzip(zipBytes);
    for (const [path, data] of Object.entries(files)) {
      // GitHub packt alles in einen Ordner "repo-branch/" — der faellt weg.
      const rel = path.split("/").slice(1).join("/");
      if (!rel || path.endsWith("/")) continue;
      const target = join(staging, rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
      fileCount += 1;
    }
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    stop(
      "Das Entpacken ist fehlgeschlagen.",
      `Es wurde nichts verändert.\n(${error.message})`,
    );
    process.exit(1);
  }
  say(`  ${fileCount} Dateien bereit.`);

  // ── 5. Austauschen ─────────────────────────────────────────────────────────
  step("Programmdateien werden ausgetauscht …");

  // Vorabprüfung: Lieber jetzt abbrechen als mitten im Austausch. Ein halb
  // getauschter Ordner wäre schlimmer als gar kein Update.
  if (!existsSync(join(staging, "package.json"))) {
    rmSync(staging, { recursive: true, force: true });
    stop(
      "Das geladene Paket sieht unvollständig aus.",
      "Es wurde nichts verändert. Bitte später noch einmal versuchen.",
    );
    process.exit(1);
  }

  try {
    for (const name of readdirSync(staging)) {
      if (isProtected(name)) continue; // niemals deine Daten anfassen

      const target = join(ROOT, name);
      // Erst weg, dann neu: Sonst scheitert das Kopieren an allem, was am
      // Zielort kein gewöhnlicher Ordner ist — etwa einer Verknüpfung.
      rmSync(target, { recursive: true, force: true });
      cpSync(join(staging, name), target, { recursive: true });
    }
  } catch (error) {
    stop(
      "Beim Austauschen ist etwas schiefgegangen.",
      `Deine Sicherung liegt in sicherung\\${stamp}.\n(${error.message})`,
    );
    process.exit(1);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  say("  Erledigt. .env und Datenbank wurden nicht angerührt.");

  // ── 6. Nacharbeiten ────────────────────────────────────────────────────────
  step("Bausteine werden nachgezogen …");
  run("npm", ["install"], {
    title: "Die Bausteine konnten nicht nachgezogen werden.",
    hint: "Internetverbindung prüfen und update.bat erneut ausführen.",
  });

  step("Datenbank wird angepasst …");
  run("npx", ["prisma", "generate"], {
    title: "Der Datenbank-Zugriff konnte nicht vorbereitet werden.",
  });
  run("npx", ["prisma", "migrate", "deploy"], {
    title: "Die Datenbank konnte nicht angepasst werden.",
    hint: `Deine Sicherung liegt in sicherung\\${stamp}.`,
  });

  // Alten Build verwerfen, damit beim naechsten Start frisch gebaut wird.
  rmSync(join(ROOT, ".next"), { recursive: true, force: true });

  // ── 7. Fertig ──────────────────────────────────────────────────────────────
  say("\n╭──────────────────────────────────────────╮");
  say(`│  ✅ Aktualisiert auf Fassung ${latest.padEnd(11)} │`);
  say("╰──────────────────────────────────────────╯");
  say(`\n  Deine Gewinnspiele und Teilnehmer sind unverändert.`);
  if (savedAnything) say(`  Sicherheitskopie: sicherung\\${stamp}`);

  if (!process.stdin.isTTY) {
    say("\n  Starte das Tool jetzt mit start.bat.\n");
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question("\n  Tool jetzt starten? [j/n] ")).trim().toLowerCase();
  rl.close();

  if (answer === "j" || answer === "ja" || answer === "") {
    spawn(process.execPath, [join(ROOT, "scripts", "start.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, SKIP_UPDATE_CHECK: "1" },
    });
  } else {
    say("\n  Alles klar. Doppelklick auf start.bat, wenn du soweit bist.\n");
  }
}
