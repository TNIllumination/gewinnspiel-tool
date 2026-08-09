// End-to-End-Rauchtest: einmal den kompletten Ablauf durchklicken.
// Start:  node scripts/e2e-smoke.mjs      (Server muss auf :3000 laufen)
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "rauchtest@example.com";
const PASSWORD = "ein-sehr-langes-testpasswort";

const steps = [];
function ok(label, detail = "") {
  steps.push(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail) {
  console.error(`✗ ${label} — ${detail}`);
  process.exitCode = 1;
}

// Auf manchen Rechnern liegt Chromium nicht dort, wo Playwright es erwartet.
// CHROMIUM_PFAD zeigt dann direkt auf die Programmdatei.
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const page = await browser.newPage();
page.setDefaultTimeout(20000);

try {
  // 1. Ersteinrichtung oder Anmeldung
  await page.goto(`${BASE}/admin/login`);
  const isSetup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();

  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: isSetup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok(isSetup ? "Betreiberkonto angelegt" : "Angemeldet");

  // 2. Gewinnspiel anlegen (Testmodus)
  await page.fill('input[name="title"]', "Rauchtest-Verlosung");
  // Seit 0.3.0 sind Plattformen Kästchen, kein Auswahlfeld — der Testmodus
  // ist voreingestellt.
  await page.check('input[name="platform_SANDBOX"]');
  await page.fill('input[name="substituteCount"]', "5");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);
  // Bei wiederholten Läufen hängt an der Adresse eine Nummer — sonst prüft
  // der Test ein altes Gewinnspiel und meldet Fehler, die keine sind.
  const slug = (await page
    .getByRole("link", { name: "Öffentliche Seite" })
    .getAttribute("href"))
    ?.split("/")
    .pop();
  ok("Gewinnspiel angelegt", slug);

  // 3. Erst die Regeln — der Testmodus richtet sich danach, sonst faellt
  //    alles durch. Genau in dieser Reihenfolge steht es jetzt auch auf der
  //    Seite.
  await page.fill('input[name="keywords"]', "dabei");
  await page.fill('input[name="mentionsMin"]', "2");
  await page.getByRole("button", { name: /Regeln speichern/ }).click();
  await page.waitForTimeout(2500);
  await page.reload();
  ok("Teilnahmebedingungen gesetzt");

  // 4. Teilnahmen erzeugen
  await page.getByRole("button", { name: /Testteilnehmer erzeugen/ }).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Einen Moment…"),
    null,
    { timeout: 30000 },
  );
  await page.reload();

  const statsGrid = page.locator("main > div.grid").first();
  ok("Teilnahmen eingelesen", (await statsGrid.innerText()).replace(/\s+/g, " ").trim());

  const stats = await page.locator("main > div.grid").first().innerText();
  const numbers = stats.match(/\d+/g) ?? [];
  const [total, valid, rejected] = numbers.map(Number);
  if (!(valid > 0 && rejected > 0 && valid + rejected === total)) {
    fail("Regelprüfung", `unplausibel: gesamt=${total} gültig=${valid} abgelehnt=${rejected}`);
  } else {
    ok("Regeln geprüft", `${valid} gültig, ${rejected} abgelehnt von ${total}`);
  }

  const hasReasons = await page.getByText("Zuletzt abgelehnt").isVisible();
  if (!hasReasons) fail("Ablehnungsgründe", "werden nicht angezeigt");
  else ok("Ablehnungen werden begründet angezeigt");

  // 5. Gewinn anlegen
  await page.fill('input[name="prizeTitle"]', "Signiertes Shirt");
  await page.getByRole("button", { name: "Gewinn hinzufügen" }).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Einen Moment…"),
    null,
    { timeout: 30000 },
  );
  await page.reload();
  ok("Gewinn angelegt");

  // 6. Liste festschreiben (Commit)
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Teilnahmen festschreiben/ }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes("commit-hash"),
    null,
    { timeout: 30000 },
  );
  const commitHash = (await page.locator("p.font-mono").first().innerText()).trim();
  if (!/^[a-f0-9]{64}$/.test(commitHash)) fail("Commit-Hash", `unerwartet: ${commitHash}`);
  else ok("Liste festgeschrieben", `Hash ${commitHash.slice(0, 16)}…`);

  // Der Seed darf VOR der Ziehung öffentlich nicht sichtbar sein.
  const publicPage = await browser.newPage();
  await publicPage.goto(`${BASE}/gewinnspiel/${slug}`);
  const beforeText = await publicPage.innerText("body");
  const before = beforeText.toLowerCase();
  if (before.includes("nach der ziehung offengelegt")) {
    fail("Seed-Geheimhaltung", "Seed steht schon vor der Ziehung auf der Seite");
  } else if (!before.includes("commit-hash")) {
    fail("Öffentliche Seite", "Commit-Hash fehlt");
  } else {
    ok("Öffentlich: Hash sichtbar, Seed noch geheim");
  }

  // 7. Ziehen
  await page.getByRole("button", { name: /Jetzt ziehen/ }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(
    () => document.body.innerText.includes("Gewinner prüfen"),
    null,
    { timeout: 30000 },
  );
  const candidates = await page.locator("li:has-text('Nachrücker')").count();
  ok("Gezogen", `1 Gewinner + ${candidates} Nachrücker`);

  // 8. Ersten Kandidaten ablehnen → Nachrücker muss nachziehen
  // Die Übersicht oben nennt, wer gerade auf dem 1. Platz steht.
  const platz1 = () => page.locator("div.border-emerald-300").first();
  const vorher = (await platz1().innerText()).trim();

  const pruefliste = () =>
    page.locator("section").filter({ hasText: "Gewinner prüfen" }).last();
  await pruefliste().locator("li").filter({ hasText: "1. Platz —" }).first()
    .getByRole("button", { name: "Ablehnen" }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(
    () => document.body.innerText.includes("Abgelehnt"),
    null,
    { timeout: 30000 },
  );

  const nachher = (await platz1().innerText()).trim();
  if (nachher === vorher) {
    fail("Nachrücker-Automatik", "abgelehnter Kandidat steht weiterhin auf Platz 1");
  } else if (!nachher.includes("Nachgerückt")) {
    fail("Nachrücker-Automatik", `kein Nachrücken erkennbar: ${nachher.replace(/\s+/g, " ")}`);
  } else {
    ok("Nachrücker-Automatik greift", nachher.replace(/\s+/g, " ").trim());
  }

  // 9. Den Nachgerückten bestätigen
  await pruefliste().locator("li").filter({ hasText: "1. Platz —" }).first()
    .getByRole("button", { name: "Bestätigen" }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(
    () => document.body.innerText.includes("Bestätigt"),
    null,
    { timeout: 30000 },
  );
  ok("Kandidat bestätigt");

  // 10. Abschließen und öffentlich prüfen
  await page.reload();
  await page.getByRole("button", { name: /abschließen und veröffentlichen/ }).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Einen Moment…"),
    null,
    { timeout: 30000 },
  );

  await publicPage.reload();
  const afterText = await publicPage.innerText("body");
  if (!afterText.includes("Gewinner")) fail("Öffentliche Gewinnerseite", "kein Gewinner angezeigt");
  else if (!/seed/i.test(afterText)) fail("Seed-Offenlegung", "Seed fehlt nach der Ziehung");
  else ok("Öffentlich: Gewinner und Seed veröffentlicht");

  await publicPage.screenshot({ path: "/tmp/oeffentlich.png", fullPage: true });
  await page.screenshot({ path: "/tmp/admin.png", fullPage: true });
} catch (error) {
  fail("Ablauf abgebrochen", error.message);
  const dump = await page.innerText("body").catch(() => "(kein Text)");
  console.error("\n--- Seiteninhalt ---\n" + dump.slice(0, 1200));
  await page.screenshot({ path: "/tmp/fehler.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(`\n${steps.length} Schritte erfolgreich.`);
}
