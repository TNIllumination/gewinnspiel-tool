import { chromium } from "playwright";
const B = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(20000);
let bad = false;
const ok = (m,d="") => console.log(`✓ ${m}${d?" — "+d:""}`);
const no = (m,d) => { bad = true; console.error(`✗ ${m} — ${d}`); };
try {
  await page.goto(`${B}/admin/login`);
  const setup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();
  await page.fill('input[name="email"]', "rauchtest@example.com");
  await page.fill('input[name="password"]', "ein-sehr-langes-testpasswort");
  await page.getByRole("button", { name: setup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok("Angemeldet");

  const body = await page.innerText("body");
  for (const l of ["Hilfe", "Öffentliche Seite", "Fassung"])
    body.includes(l) ? ok(`Dashboard zeigt „${l}“`) : no("Dashboard", `„${l}“ fehlt`);

  await page.getByRole("link", { name: "Hilfe" }).click();
  await page.waitForURL("**/admin/hilfe");
  ok("Hilfe-Seite geöffnet");

  const links = await page.locator('nav#inhalt a').count();
  ok("Einträge im Inhaltsverzeichnis", String(links));
  if (links < 30) no("Inhaltsverzeichnis", `nur ${links} Einträge`);

  // Springt jeder Link auf eine existierende Stelle?
  const kaputt = await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll('nav#inhalt a')].map(a => a.getAttribute('href'));
    return hrefs.filter(h => h && !document.querySelector(h.replace('#', '#')) && !document.getElementById(h.slice(1)));
  });
  kaputt.length === 0 ? ok("Alle Sprungmarken treffen ihr Ziel")
                      : no("Sprungmarken", "ins Leere: " + kaputt.join(", "));

  // Beispielhaft einen Umlaut-Anker anspringen
  await page.locator('nav#inhalt a[href="#gewinner-pruefen-und-nachruecker"]').click();
  await page.waitForTimeout(400);
  const sichtbar = await page.locator('#gewinner-pruefen-und-nachruecker').isVisible();
  sichtbar ? ok("Sprung zu „Gewinner prüfen und Nachrücker“ klappt") : no("Sprung", "Ziel nicht sichtbar");

  const inhalt = await page.innerText("article.handbuch");
  for (const t of ["Commit-Hash", "Seed", "Was die Plattformen nicht hergeben", "Fachbegriffe"])
    inhalt.includes(t) ? ok(`Handbuch enthält „${t}“`) : no("Handbuch", `„${t}“ fehlt`);

  await page.screenshot({ path: "/tmp/hilfe.png", fullPage: false });
} catch (e) {
  no("Abgebrochen", e.message);
} finally {
  await browser.close();
  console.log(bad ? "\nFEHLGESCHLAGEN" : "\nAlles grün.");
  process.exitCode = bad ? 1 : 0;
}
