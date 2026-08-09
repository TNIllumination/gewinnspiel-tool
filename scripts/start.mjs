// Ein-Klick-Start.
//
// Erledigt alles, was sonst von Hand in der Konsole passieren muesste:
// Abhaengigkeiten installieren, Geheimnisse erzeugen, Datenbank anlegen,
// bauen, starten, Browser oeffnen.
//
// Grundsatz: Jeder Fehler wird auf Deutsch erklaert und sagt, was zu tun
// ist. Ein Stacktrace hilft niemandem, der nur sein Gewinnspiel auslosen will.

import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchChangelogHead, fetchLatest, isNewer, localVersion } from "./update.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT ?? "3000";
const URL = `http://localhost:${PORT}`;
// Geoeffnet wird die Verwaltung — dort kann man etwas tun. Die oeffentliche
// Startseite ist fuer Teilnehmer gedacht und beim ersten Start eine Sackgasse.
const ADMIN_URL = `${URL}/admin`;

const say = (msg) => console.log(msg);
const step = (msg) => console.log(`\n▶ ${msg}`);

function stop(title, hint) {
  console.error(`\n❌ ${title}\n`);
  if (hint) console.error(`${hint}\n`);
  console.error("Das Fenster kannst du jetzt schließen.\n");
  process.exit(1);
}

/// Fuehrt einen Befehl aus und bricht mit verstaendlicher Meldung ab.
function run(command, args, { title, hint }) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) stop(title, hint);
}

say("\n╭──────────────────────────────────────────╮");
say("│  Gewinnspiel-Tool wird gestartet …       │");
say("╰──────────────────────────────────────────╯");

// ── 1. Node vorhanden und aktuell genug? ─────────────────────────────────────
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  stop(
    `Node.js ist zu alt (Version ${process.versions.node}).`,
    "Bitte die aktuelle LTS-Version von https://nodejs.org installieren\n" +
      "und danach start.bat erneut doppelklicken.",
  );
}

// ── 1b. Gibt es eine neuere Fassung? ─────────────────────────────────────────
// Bewusst hier, VOR dem Serverstart: Jetzt ist noch keine Datei gesperrt,
// ein Austausch kann also nicht auf halbem Weg abbrechen.
if (!process.env.SKIP_UPDATE_CHECK && process.stdin.isTTY) {
  const here = localVersion();
  const latest = await fetchLatest(); // ohne Internet: null, ohne Meldung

  if (latest && isNewer(latest, here)) {
    say(`\n▶ Neue Fassung ${latest} verfügbar (du hast ${here})`);

    const news = await fetchChangelogHead();
    if (news) say(`  Was ist neu:\n  ${news}`);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question("\n  Jetzt aktualisieren? [j/n] "))
      .trim()
      .toLowerCase();
    rl.close();

    if (answer === "j" || answer === "ja") {
      say("\n  Alles klar — das Update-Programm übernimmt.\n");
      // Eigener Vorgang, und dieser hier beendet sich sofort: So haelt
      // niemand mehr eine Datei offen, die gleich ersetzt wird.
      spawn(process.execPath, [join(ROOT, "scripts", "update.mjs")], {
        cwd: ROOT,
        stdio: "inherit",
      }).on("exit", (code) => process.exit(code ?? 0));

      // Nichts weiter tun — der Rest passiert im Update-Programm.
      await new Promise(() => {});
    }

    say("  Übersprungen. Du kannst später jederzeit update.bat ausführen.");
  }
}

// ── 2. Abhaengigkeiten ───────────────────────────────────────────────────────
if (!existsSync(join(ROOT, "node_modules"))) {
  step("Bausteine werden installiert (nur beim ersten Mal, dauert ein paar Minuten) …");
  run("npm", ["install"], {
    title: "Die Installation ist fehlgeschlagen.",
    hint:
      "Meistens fehlt einfach die Internetverbindung — prüf sie und versuch es erneut.\n" +
      "Falls die Meldung etwas von „better-sqlite3“ oder „node-gyp“ sagt, schreib mir das:\n" +
      "dann braucht dein Gerät eine andere Datenbank-Bibliothek.",
  });
}

// ── 3. Geheimnisse erzeugen ──────────────────────────────────────────────────
// Auf Windows gibt es kein openssl — deshalb erzeugt Node die Schluessel selbst.
const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) {
  step("Zugangsschlüssel werden erzeugt …");
  const key = () => randomBytes(32).toString("base64");
  writeFileSync(
    envPath,
    [
      "# Automatisch erzeugt beim ersten Start. Nicht weitergeben.",
      'DATABASE_URL="file:./gewinnspiel.db"',
      `SESSION_SECRET="${key()}"`,
      // Achtung: Wird dieser Wert spaeter geaendert, sind gespeicherte
      // Zugangsdaten und Gewinner-Angaben nicht mehr lesbar.
      `ENCRYPTION_KEY="${key()}"`,
      `NEXT_PUBLIC_BASE_URL="${URL}"`,
      "",
    ].join("\n"),
    "utf8",
  );
  say("  Erledigt. Die Schlüssel stehen in der Datei .env und bleiben auf diesem Gerät.");
} else {
  // Aeltere .env aus der Postgres-Zeit sanft korrigieren.
  const env = readFileSync(envPath, "utf8");
  if (env.includes("postgresql://")) {
    writeFileSync(
      envPath,
      env.replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL="file:./gewinnspiel.db"'),
      "utf8",
    );
    say("  Alte Datenbank-Einstellung auf die neue Datei umgestellt.");
  }
}

// ── 4. Datenbank ─────────────────────────────────────────────────────────────
step("Datenbank wird vorbereitet …");
run("npx", ["prisma", "migrate", "deploy"], {
  title: "Die Datenbank konnte nicht angelegt werden.",
  hint: "Prüf, ob der Ordner beschreibbar ist — also nicht in „Programme“ oder auf einem schreibgeschützten Laufwerk liegt.",
});

// ── 5. Bauen ─────────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  step("Anwendung wird gebaut (nur beim ersten Mal) …");
  run("npx", ["prisma", "generate"], {
    title: "Der Datenbank-Zugriff konnte nicht vorbereitet werden.",
  });
  run("npm", ["run", "build"], {
    title: "Das Bauen ist fehlgeschlagen.",
    hint: "Schick mir bitte die letzten Zeilen von oben, dann finde ich die Ursache.",
  });
}

// ── 6. Starten ───────────────────────────────────────────────────────────────
// Laeuft das Tool schon? Dann nicht ein zweites Mal starten, sondern
// einfach dorthin schicken — sonst sieht der Nutzer nur "EADDRINUSE".
try {
  const res = await fetch(URL, { signal: AbortSignal.timeout(1500) });
  if (res.ok || res.status === 307) {
    say(`\n✅ Das Tool läuft bereits: ${ADMIN_URL}`);
    say("   Ruf die Adresse einfach im Browser auf.\n");
    process.exit(0);
  }
} catch {
  // Nichts da — also normal starten.
}

step(`Server startet auf ${URL} …`);
say("  Zum Beenden dieses Fenster schließen oder Strg+C drücken.\n");

const server = spawn("npm", ["run", "start"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, PORT },
});

// Browser oeffnen, sobald der Server antwortet — nicht blind nach Zeit.
(async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(URL, { signal: AbortSignal.timeout(1500) });
      if (res.ok || res.status === 307) break;
    } catch {
      continue;
    }
  }

  const opener =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", ADMIN_URL]]
      : process.platform === "darwin"
        ? ["open", [ADMIN_URL]]
        : ["xdg-open", [ADMIN_URL]];

  // Laesst sich kein Browser oeffnen, ist das kein Grund, den Server
  // mitzureissen — ohne diesen Handler beendet ein fehlendes Programm
  // den ganzen Prozess.
  try {
    const child = spawn(opener[0], opener[1], { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // bewusst still: die Adresse steht unten ohnehin
  }

  say(`\n✅ Läuft. Falls sich kein Browser öffnet: ${ADMIN_URL} von Hand aufrufen.\n`);
  say("   Beim ersten Mal legst du dort dein Konto an.\n");
})();

server.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => server.kill("SIGINT"));
