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

const browser = await chromium.launch();
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
  await page.selectOption('select[name="platform"]', "SANDBOX");
  await page.fill('input[name="substituteCount"]', "5");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);
  const giveawayUrl = page.url();
  ok("Gewinnspiel angelegt", giveawayUrl.split("/").pop());

  // 3. Teilnahmen erzeugen
  await page.getByRole("button", { name: /Testteilnehmer erzeugen/ }).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Einen Moment…"),
    null,
    { timeout: 30000 },
  );
  await page.reload();

  const statsGrid = page.locator("main > div.grid").first();
  ok("Teilnahmen eingelesen", (await statsGrid.innerText()).replace(/\s+/g, " ").trim());

  // 4. Regeln setzen
  await page.fill('input[name="keywords"]', "dabei");
  await page.fill('input[name="mentionsMin"]', "2");
  await page.getByRole("button", { name: /Regeln speichern/ }).click();
  await page.waitForFunction(
    () => !document.body.innerText.includes("Einen Moment…"),
    null,
    { timeout: 30000 },
  );
  await page.reload();

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
  const slug = "rauchtest-verlosung";
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
  const firstWinnerName = (await page.locator("li a[href]").first().innerText()).trim();
  await page.locator("li").filter({ hasText: "Gewinner —" }).first()
    .getByRole("button", { name: "Prüfung speichern" }).click();
  await page.waitForTimeout(3000);
  await page.reload();
  await page.waitForFunction(
    () => document.body.innerText.includes("Durchgefallen"),
    null,
    { timeout: 30000 },
  );

  const noticeText = await page.locator("text=Aktueller Gewinner").first().innerText();
  if (noticeText.includes(firstWinnerName)) {
    fail("Nachrücker-Automatik", "abgelehnter Kandidat gilt weiterhin als Gewinner");
  } else {
    ok("Nachrücker-Automatik greift", noticeText.replace(/\s+/g, " ").trim());
  }

  // 9. Nachrücker bestätigen
  const pendingCard = page.locator("li").filter({ hasText: "Nachrücker 1" }).first();
  await pendingCard.locator('input[name="follows"]').check();
  await pendingCard.locator('input[name="liked"]').check();
  await pendingCard.getByRole("button", { name: "Prüfung speichern" }).click();
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
