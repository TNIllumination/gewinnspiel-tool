// Setzt das Passwort des Betreiberkontos neu.
//
// Ohne diesen Weg waeren bei einem vergessenen Passwort alle Gewinnspiele
// eingeschlossen. Das Skript laeuft nur oertlich, wo ohnehin voller Zugriff
// auf die Datenbankdatei besteht — es schafft also keine neue Angriffsflaeche.
//
// Aufruf: npm run passwort-neu

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const file = (process.env.DATABASE_URL ?? "file:./gewinnspiel.db").replace(
  /^file:/,
  "",
);
const dbPath = join(ROOT, file);

console.log("\n╭──────────────────────────────────────────╮");
console.log("│  Passwort neu setzen                     │");
console.log("╰──────────────────────────────────────────╯\n");

let db;
try {
  db = new DatabaseSync(dbPath);
} catch {
  console.error(`❌ Datenbank nicht gefunden: ${dbPath}`);
  console.error("   Starte zuerst einmal start.bat.\n");
  process.exit(1);
}

const users = db.prepare("SELECT id, email FROM User ORDER BY createdAt").all();

if (users.length === 0) {
  console.error("❌ Es gibt noch kein Konto.");
  console.error("   Starte start.bat und lege es über die Ersteinrichtung an.\n");
  process.exit(1);
}

const user = users[0];
console.log(`  Konto: ${user.email}\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const passwort = (await rl.question("  Neues Passwort (mind. 12 Zeichen): ")).trim();

if (passwort.length < 12) {
  rl.close();
  console.error("\n❌ Zu kurz — mindestens 12 Zeichen.\n");
  process.exit(1);
}

const wiederholung = (await rl.question("  Noch einmal zur Sicherheit: ")).trim();
rl.close();

if (passwort !== wiederholung) {
  console.error("\n❌ Die beiden Eingaben stimmen nicht überein.\n");
  process.exit(1);
}

db.prepare("UPDATE User SET passwordHash = ? WHERE id = ?").run(
  bcrypt.hashSync(passwort, 12),
  user.id,
);

console.log("\n✅ Passwort geändert. Deine Gewinnspiele sind unverändert.");
console.log("   Melde dich mit dem neuen Passwort an.\n");
