// Praxistest: TikTok-Copy-Paste importieren und Regeln ohne Markieren setzen.
// Start:  node scripts/e2e-tiktok-import.mjs      (Server muss auf :3000 laufen)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "rauchtest@example.com";
const PASSWORD = "ein-sehr-langes-testpasswort";

// So sieht ein Ausschnitt aus der TikTok-Weboberflaeche wirklich aus.
const PASTE = [
  "anna_berg",
  "Ich bin dabei @ben @carla",
  "2026-1-15",
  "Antworten",
  "12",
  "ben_wald",
  "Mega Aktion, ich bin dabei",
  "und drücke die Daumen",
  "vor 2 Tagen",
  "Antworten",
  "1.2k",
  "carla_stein",
  "Schönes Video!",
  "3d",
  "Antworten",
  "5",
].join("\n");

let failed = false;
const ok = (l, d = "") => console.log(`✓ ${l}${d ? ` — ${d}` : ""}`);
const bad = (l, d) => {
  failed = true;
  console.error(`✗ ${l} — ${d}`);
};

// Auf manchen Rechnern liegt Chromium nicht dort, wo Playwright es erwartet.
// CHROMIUM_PFAD zeigt dann direkt auf die Programmdatei.
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const page = await browser.newPage();
page.setDefaultTimeout(20000);

try {
  // Anmelden bzw. einrichten
  await page.goto(`${BASE}/admin/login`);
  const isSetup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: isSetup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok("Angemeldet");

  // TikTok-Gewinnspiel anlegen
  await page.fill('input[name="title"]', `TikTok-Import ${Date.now()}`);
  // Seit 0.3.0 sind Plattformen Kästchen, kein Auswahlfeld.
  await page.uncheck('input[name="platform_SANDBOX"]');
  await page.check('input[name="platform_TIKTOK"]');
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);
  ok("TikTok-Gewinnspiel angelegt");

  // Der Hinweis, was TikTok nicht hergibt, muss sichtbar sein
  const body = await page.innerText("body");
  if (!body.includes("keinen Zugriff auf Kommentare")) {
    bad("Ehrlichkeitshinweis", "fehlt auf der TikTok-Seite");
  } else {
    ok("TikTok-Einschränkung wird offen erklärt");
  }

  // Anleitung vorhanden?
  if (!body.includes("So kommst du an die Kommentare")) {
    bad("Anleitung", "fehlt");
  } else {
    ok("Kurzanleitung vorhanden");
  }

  // Einfügen und PRÜFEN (darf noch nichts speichern)
  await page.fill('textarea[name="importText"]', PASTE);
  await page.getByRole("button", { name: "Prüfen", exact: true }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Teilnahmen erkannt"),
    null,
    { timeout: 30000 },
  );

  const previewText = await page.innerText("body");
  const namesOk =
    previewText.includes("@anna_berg") &&
    previewText.includes("@ben_wald") &&
    previewText.includes("@carla_stein");
  if (!namesOk) bad("Vorschau", "erwartete Namen fehlen");
  else if (/@12\b/.test(previewText)) bad("Vorschau", "Like-Zahl 12 wurde als Teilnehmerin gelesen");
  else ok("Vorschau zeigt 3 Namen, Like-Zahlen und Datum aussortiert");

  // Mehrzeiliger Kommentar muss zusammengeblieben sein
  if (!previewText.includes("Mega Aktion, ich bin dabei und drücke die Daumen")) {
    bad("Mehrzeiliger Kommentar", "wurde zerrissen");
  } else {
    ok("Mehrzeiliger Kommentar bleibt zusammen");
  }

  // Vor dem Übernehmen darf nichts in der Datenbank stehen
  const statsBefore = await page.locator("main > div.grid").first().innerText();
  if (!/KOMMENTARE\s*0/i.test(statsBefore.replace(/\s+/g, " "))) {
    bad("Vorschau", `speichert vorzeitig: ${statsBefore.replace(/\s+/g, " ")}`);
  } else {
    ok("Nichts gespeichert, solange nur geprüft wurde");
  }

  // Übernehmen
  await page.getByRole("button", { name: /Teilnahmen übernehmen/ }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  const statsAfter = (await page.locator("main > div.grid").first().innerText()).replace(/\s+/g, " ");
  if (!/KOMMENTARE 3/i.test(statsAfter)) bad("Übernehmen", `unerwartet: ${statsAfter}`);
  else ok("Übernommen", statsAfter);

  // Regeln OHNE Markieren: nur ein Wort
  await page.fill('input[name="keywords"]', "dabei");
  await page.fill('input[name="mentionsMin"]', "0");
  await page.getByRole("button", { name: /Regeln speichern/ }).click();
  await page.waitForTimeout(3000);
  await page.reload();

  const afterRules = await page.innerText("body");
  if (!afterRules.includes("Freunde markieren ist nicht gefordert.")) {
    bad("Regel-Zusammenfassung", "sagt nicht, dass Markieren entfällt");
  } else {
    ok("Zusammenfassung: Markieren ist nicht gefordert");
  }

  const finalStats = (await page.locator("main > div.grid").first().innerText()).replace(/\s+/g, " ");
  // anna und ben schreiben "dabei", carla nicht → 2 gültig, 1 abgelehnt
  if (!/GÜLTIG 2/i.test(finalStats) || !/ABGELEHNT 1/i.test(finalStats)) {
    bad("Regelprüfung ohne Markieren", `erwartet 2 gültig / 1 abgelehnt, war: ${finalStats}`);
  } else {
    ok("Ohne Markier-Pflicht gültig", "2 gültig, 1 abgelehnt (nur Schlüsselwort zählt)");
  }

  await page.screenshot({ path: "/tmp/tiktok-import.png", fullPage: true });
} catch (error) {
  bad("Abgebrochen", error.message);
  const dump = await page.innerText("body").catch(() => "(kein Text)");
  console.error("\n--- Seiteninhalt ---\n" + dump.slice(0, 1500));
} finally {
  await browser.close();
  console.log(failed ? "\nFEHLGESCHLAGEN" : "\nAlles grün.");
  process.exitCode = failed ? 1 : 0;
}
