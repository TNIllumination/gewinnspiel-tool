// Der Fremden-Test: Kommt jemand ohne Handbuch durch, nur über die
// Einstiegsliste im Dashboard?
//
// Start: node scripts/e2e-einstieg.mjs   (Server muss auf :3000 laufen)
import { chromium } from "playwright";

// Braucht eine FRISCHE Datenbank — bei eingerichtetem Tool ist die Liste
// zu Recht schon abgehakt und es gaebe nichts zu pruefen.
//   rm -f frisch.db
//   DATABASE_URL="file:./frisch.db" npx prisma migrate deploy
//   DATABASE_URL="file:./frisch.db" npx next start -p 3100
//   BASE_URL=http://localhost:3100 node scripts/e2e-einstieg.mjs
const B = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "einstieg@example.com";
const PASSWORD = "ein-sehr-langes-testpasswort";

let bad = false;
const ok = (m, d = "") => console.log(`✓ ${m}${d ? " — " + d : ""}`);
const no = (m, d) => {
  bad = true;
  console.error(`✗ ${m} — ${d}`);
};

// Auf manchen Rechnern liegt Chromium nicht dort, wo Playwright es erwartet.
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const page = await browser.newPage();
page.setDefaultTimeout(20000);

/// Was die Liste gerade als nächsten Schritt nennt.
const naechster = async () => {
  await page.goto(`${B}/admin`);
  const kasten = page.locator("div.bg-sky-50").first();
  if ((await kasten.count()) === 0) return null;
  return (await kasten.innerText()).replace(/\s+/g, " ").trim();
};

try {
  await page.goto(`${B}/admin/login`);
  const setup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: setup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok("Angemeldet");

  const erster = await naechster();
  if (!erster) {
    no("Einstiegsliste", "keine Liste sichtbar — bei eingerichtetem Tool ok, hier nicht");
  } else {
    ok("Einstiegsliste zeigt den nächsten Schritt", erster.slice(0, 70));
  }

  // Jeder offene Schritt muss erklären, WARUM — sonst ist es nur eine
  // Aufgabenliste ohne Anleitung.
  if (erster && erster.length < 60) {
    no("Begründung", `zu knapp, keine Erklärung: ${erster}`);
  } else if (erster) {
    ok("Der Schritt erklärt sich selbst");
  }

  // Der Knopf muss irgendwohin führen, wo man den Schritt auch erledigen kann.
  const kasten = page.locator("div.bg-sky-50").first();
  if ((await kasten.count()) > 0) {
    const vorher = page.url();
    await kasten.getByRole("button").first().click();
    await page.waitForTimeout(2000);
    if (page.url() === vorher && !page.url().includes("/admin")) {
      no("Sprungknopf", "führt nirgendwohin");
    } else {
      ok("Sprungknopf führt zum passenden Ort", page.url().replace(B, ""));
    }
  }

  // Die Liste hakt ab, was schon erledigt ist — sie zählt nicht bei null los,
  // nur weil sie neu ist.
  await page.goto(`${B}/admin`);
  const haken = await page.locator("li:has-text('✓')").count();
  const gesamt = await page.locator("ol li").count();
  if (gesamt < 8) no("Liste", `nur ${gesamt} Schritte, erwartet 8`);
  else ok("Alle acht Schritte gelistet", `${haken} bereits erledigt`);
} catch (e) {
  no("Abgebrochen", e.message);
  const dump = await page.innerText("body").catch(() => "(kein Text)");
  console.error("\n--- Seiteninhalt ---\n" + dump.slice(0, 1200));
} finally {
  await browser.close();
  console.log(bad ? "\nFEHLGESCHLAGEN" : "\nAlles grün.");
  process.exitCode = bad ? 1 : 0;
}
