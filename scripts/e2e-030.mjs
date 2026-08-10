// Praxistest für Fassung 0.3.1: mehrere Plattformen, Import in Etappen,
// mehrere Gewinne, Nachrücken pro Gewinnplatz, Rechtstexte, Veröffentlichung.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const B = "http://localhost:3000";
const EMAIL = "rauchtest@example.com";
const PASSWORD = "ein-sehr-langes-testpasswort";

let bad = false;
const ok = (m, d = "") => console.log(`✓ ${m}${d ? " — " + d : ""}`);
const no = (m, d) => {
  bad = true;
  console.error(`✗ ${m} — ${d}`);
};

// Zwei sich überlappende Ausschnitte — genau wie beim Scrollen bei TikTok.
const AUSSCHNITT_1 = [
  "anna_berg", "Ich bin dabei", "Antworten", "12",
  "ben_wald", "Bin dabei", "3d", "Antworten", "5",
].join("\n");

const AUSSCHNITT_2 = [
  "ben_wald", "Bin dabei", "3d", "Antworten", "5",
  "carla_stein", "Ich bin dabei auch", "2d", "Antworten", "1",
  "dora_mond", "Ich bin dabei", "1d", "Antworten", "0",
].join("\n");

const INSTAGRAM_TEIL = [
  "anna_berg", "Ich bin dabei", "Antworten",
  "erik_falke", "Ich bin dabei", "Antworten",
].join("\n");

// Auf manchen Rechnern liegt Chromium nicht dort, wo Playwright es erwartet.
// CHROMIUM_PFAD zeigt dann direkt auf die Programmdatei.
const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const page = await browser.newPage();
page.setDefaultTimeout(20000);

const settle = async () => {
  await page.waitForTimeout(2500);
  await page.reload();
};

try {
  // ── Anmelden ──────────────────────────────────────────────────────────────
  await page.goto(`${B}/admin/login`);
  const setup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: setup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok("Angemeldet");

  // ── Veranstalterangaben ───────────────────────────────────────────────────
  await page.goto(`${B}/admin/einstellungen`);
  await page.fill('input[name="organizer"]', "Max Mustermann");
  await page.fill('input[name="contact"]', "kontakt@beispiel.de");
  await page.fill('input[name="publishBaseUrl"]', "https://beispiel.github.io/gewinnspiele");
  // Bewusst ohne https:// — das Tool muss es ergänzen, sonst wird daraus ein
  // relativer und damit toter Link.
  await page.fill('input[name="impressumUrl"]', "mein.online-impressum.de/beispiel");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(2000);
  await page.reload();
  const impressum = await page.inputValue('input[name="impressumUrl"]');
  if (impressum !== "https://mein.online-impressum.de/beispiel") {
    no("Impressum", `nicht ergänzt: ${impressum}`);
  } else {
    ok("Veranstalterangaben gespeichert", "https:// ergänzt");
  }

  // ── Fehlermeldungen müssen lesbar sein ────────────────────────────────────
  // Im Produktionsbau zensiert Next.js den Text geworfener Ausnahmen. Kommt
  // hier eine Nummer statt eines Satzes, ist das kaputt — genau daran ist
  // Fassung 0.4.0 gescheitert.
  const lesbar = (text, wo) => {
    if (/error #\d+|omitted in production|Server Components render/i.test(text)) {
      no(wo, `zensierte Meldung statt Klartext: ${text.slice(0, 90)}`);
      return false;
    }
    return true;
  };

  // Seit Fassung 0.8.0 gibt es zwei Karten mit „Verbindung prüfen" — GitHub
  // und Instagram. Hier ist GitHub gemeint.
  const githubKarte = page.locator("section", { hasText: "Hochladen auf GitHub" });
  await githubKarte.getByRole("button", { name: "Verbindung prüfen" }).click();
  await page.waitForTimeout(2500);
  const pruefText = await githubKarte.locator('[role="alert"]').first().innerText();
  if (!lesbar(pruefText, "Verbindung prüfen")) {
    // Meldung schon ausgegeben
  } else if (!/Zugangsschlüssel|Repository/.test(pruefText)) {
    no("Verbindung prüfen", `unerwarteter Text: ${pruefText.slice(0, 90)}`);
  } else {
    ok("Fehlermeldung im Klartext", pruefText.slice(0, 60));
  }

  // ── Übersichtsseite vor dem ersten Gewinnspiel ────────────────────────────
  // Genau der Weg, der GitHub Pages überhaupt erst einschaltbar macht.
  await page.getByRole("button", { name: "Übersichtsseite erzeugen" }).click();
  await page.waitForTimeout(2000);
  const uebersicht = readFileSync("veroeffentlichung/index.html", "utf8");
  // Ohne Zugangsschlüssel bleibt der Weg von Hand — nichts darf ins Netz gehen.
  const datenschutz = readFileSync("veroeffentlichung/datenschutz.html", "utf8");
  if (!datenschutz.includes("Art. 6 Abs. 1 lit. f DSGVO")) {
    no("Datenschutzerklärung", "Rechtsgrundlagen fehlen");
  } else if (!uebersicht.includes('href="datenschutz.html"')) {
    no("Datenschutzerklärung", "im Fußbereich der Übersicht nicht verlinkt");
  } else if (uebersicht.includes('href="datenschutz.html">Datenschutzerklärung')) {
    no("Übersicht", "Datenschutzseite steht fälschlich in der Gewinnspielliste");
  } else {
    ok("Datenschutzerklärung erzeugt und verlinkt");
  }
  if (!uebersicht.includes("https://mein.online-impressum.de/beispiel")) {
    no("Übersichtsseite", "Impressum-Link fehlt im Fußbereich");
  } else {
    ok("Übersichtsseite ohne Gewinnspiel erzeugt");
  }

  // ── Gewinnspiel über ZWEI Plattformen ─────────────────────────────────────
  await page.goto(`${B}/admin`);
  await page.fill('input[name="title"]', "Festival-Verlosung");
  await page.uncheck('input[name="platform_SANDBOX"]');
  await page.check('input[name="platform_TIKTOK"]');
  await page.check('input[name="platform_INSTAGRAM"]');
  await page.fill('input[name="postUrl_TIKTOK"]', "https://tiktok.com/@ich/video/1");
  await page.fill('input[name="substituteCount"]', "2");
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);
  const slug = (await page
    .getByRole("link", { name: "Öffentliche Seite" })
    .getAttribute("href"))
    ?.split("/")
    .pop();
  ok("Gewinnspiel über TikTok + Instagram angelegt", `/${slug}`);

  // ── Import in Etappen ─────────────────────────────────────────────────────
  const importieren = async (plattform, text) => {
    await page.selectOption('select[name="importPlatform"]', { label: plattform });
    await page.fill('textarea[name="importText"]', text);
    await page.getByRole("button", { name: "Prüfen", exact: true }).click();
    await page.waitForFunction(
      () => document.body.innerText.includes("Teilnahmen erkannt"),
      null,
      { timeout: 30000 },
    );
    await page.getByRole("button", { name: /Teilnahmen übernehmen/ }).click();
    await page.waitForFunction(
      () => /übernommen|Nichts Neues/.test(document.body.innerText),
      null,
      { timeout: 30000 },
    );
    return page.innerText("body");
  };

  await importieren("TikTok", AUSSCHNITT_1);
  ok("Erster TikTok-Ausschnitt eingelesen");

  const zweiter = await importieren("TikTok", AUSSCHNITT_2);
  if (!/1 war schon vorhanden|1 waren schon vorhanden/.test(zweiter)) {
    no("Etappen-Import", `Dublette nicht erkannt: ${zweiter.match(/.{0,80}vorhanden.{0,40}/)?.[0] ?? "?"}`);
  } else {
    ok("Überlappung erkannt", "doppelter Kommentar wurde übersprungen");
  }

  await importieren("Instagram", INSTAGRAM_TEIL);
  ok("Instagram-Kommentare eingelesen");

  await page.reload();
  const stats = (await page.locator("main > div.grid").first().innerText()).replace(/\s+/g, " ");
  // 4 von TikTok (anna, ben, carla, dora) + 2 von Instagram (anna, erik) = 6
  if (!/KOMMENTARE 6/.test(stats)) no("Gesamtzahl", `erwartet 6, war: ${stats}`);
  else ok("Alle Teilnahmen zusammengeführt", stats);

  // anna kommentiert auf BEIDEN Plattformen → muss 2 Lose haben
  const body = await page.innerText("body");
  if (!/LOSE 6/.test(stats)) {
    no("Plattform-Trennung", `anna sollte je Plattform ein Los haben: ${stats}`);
  } else {
    ok("Gleicher Name auf zwei Plattformen = zwei Lose");
  }
  if (!body.includes("TikTok: 4") || !body.includes("Instagram: 2")) {
    no("Herkunft", "Aufschlüsselung fehlt");
  } else {
    ok("Herkunft wird ausgewiesen", "TikTok: 4 · Instagram: 2");
  }

  // ── Regeln mit Einsendeschluss ────────────────────────────────────────────
  await page.fill('input[name="keywords"]', "dabei");
  await page.fill('input[name="mentionsMin"]', "0");
  await page.fill('input[name="endsAt"]', "2030-01-01T12:00");
  await page.getByRole("button", { name: /Regeln speichern/ }).click();
  await settle();
  if (!(await page.innerText("body")).includes("mehrfach im Topf")) {
    no("Regel-Zusammenfassung", "Hinweis auf Mehrfachchance fehlt");
  } else {
    ok("Zusammenfassung nennt die Mehrfachchance");
  }

  // ── Drei Gewinne ──────────────────────────────────────────────────────────
  for (const gewinn of ["Signiertes Shirt", "Cap", "Sticker-Set"]) {
    await page.fill('input[name="prizeTitle"]', gewinn);
    await page.getByRole("button", { name: "Gewinn hinzufügen" }).click();
    await settle();
  }
  ok("Drei Gewinne angelegt");

  // ── Texte erzeugen ────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Texte erzeugen" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Kurzfassung für die Bildunterschrift"),
    null,
    { timeout: 30000 },
  );
  const felder = await page.locator("textarea[readonly]").allTextContents();
  const texte = felder.join("\n");
  const fehlend = [
    "steht in keiner Verbindung",
    "von jeglicher Haftung frei",
    "Alleiniger Ansprechpartner",
  ].filter((pflicht) => !texte.includes(pflicht));

  if (fehlend.length > 0) no("Pflichtbestandteile", fehlend.join(", ") + " fehlt");
  else ok("Teilnahmebedingungen enthalten alle drei Pflichtbestandteile");

  if (!/Vollständige Teilnahmebedingungen: https:\/\//.test(texte)) {
    no("Kurzfassung", "Link auf die ausführliche Fassung fehlt");
  } else {
    ok("Kurzfassung verweist auf die veröffentlichte Seite");
  }

  // ── Festschreiben, zurücknehmen, wieder festschreiben ─────────────────────
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Teilnahmen festschreiben/ }).click();
  await settle();
  // Kleinschreiben: Die Überschrift steht per CSS in Großbuchstaben, und
  // innerText liefert sie genau so.
  if (!(await page.innerText("body")).toLowerCase().includes("prüfsumme")) {
    no("Festschreiben", "keine Prüfsumme sichtbar");
  } else {
    ok("Liste festgeschrieben");
  }

  await page.getByRole("button", { name: "Festschreibung zurücknehmen" }).click();
  await settle();
  if (!(await page.innerText("body")).includes("Teilnahmen festschreiben")) {
    no("Zurücknehmen", "Gewinnspiel ist nicht zurück im Sammelzustand");
  } else {
    ok("Festschreibung zurückgenommen");
  }

  await page.getByRole("button", { name: /Teilnahmen festschreiben/ }).click();
  await settle();

  // ── Prüfsumme VOR der Ziehung veröffentlichen ─────────────────────────────
  // Der Kern des Verfahrens: Danach erst darf gezogen werden.
  const vorZiehung = (await page.innerText("body")).toLowerCase();
  if (!vorZiehung.includes("noch nicht veröffentlicht")) {
    no("Prüfsumme", "Zustand wird nicht ausgewiesen");
  } else if (!vorZiehung.includes("erst die prüfsumme veröffentlichen")) {
    no("Prüfsumme", "keine Warnung vor dem Ziehen");
  } else {
    ok("Prüfsumme als unveröffentlicht ausgewiesen, mit Warnung");
  }

  await page
    .getByRole("button", { name: "Seite mit Bedingungen und Prüfsumme erzeugen" })
    .click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Datei erzeugt"),
    null,
    { timeout: 30000 },
  );

  const vorher = readFileSync(`veroeffentlichung/${slug}.html`, "utf8");
  if (!/Prüfsumme \(SHA-256\)/.test(vorher)) {
    no("Prüfsumme", "steht nicht auf der Seite");
  } else if (/anna_berg|ben_wald|carla_stein/.test(vorher)) {
    no("Prüfsumme", "Namen sind vor der Ziehung öffentlich!");
  } else {
    ok("Prüfsumme veröffentlicht, ohne einen einzigen Namen");
  }

  await settle();
  if (!(await page.innerText("body")).toLowerCase().includes("prüfsumme — veröffentlicht")) {
    no("Zeitpunkt", "Veröffentlichung wird nicht festgehalten");
  } else {
    ok("Zeitpunkt der Veröffentlichung festgehalten");
  }

  // ── Checkliste: was ist online? ───────────────────────────────────────────
  // Ohne Zugangsschlüssel wird die Datei nur erzeugt, nicht hochgeladen. Genau
  // dieser Unterschied muss dastehen — sonst wartet man auf eine Live-Seite,
  // die nie kommt.
  const checkliste = page.locator("section", { hasText: "Was ist online?" }).last();
  const abgehakt = await checkliste.locator(".line-through").allInnerTexts();
  const checkText = (await checkliste.innerText()).toLowerCase();

  if (!abgehakt.some((t) => /teilnahmebedingungen/i.test(t))) {
    no("Checkliste", "erledigte Stufe wird nicht durchgestrichen");
  } else if (abgehakt.some((t) => /nachweis/i.test(t))) {
    no("Checkliste", "offene Stufe ist fälschlich abgehakt");
  } else if (!checkText.includes("noch nicht hochgeladen")) {
    no("Checkliste", "erzeugt und hochgeladen werden nicht unterschieden");
  } else {
    ok("Checkliste hakt Erledigtes ab und trennt erzeugt von hochgeladen");
  }

  // ── Ziehen ────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: /Jetzt ziehen/ }).click();
  await settle();
  const nachZiehung = await page.innerText("body");
  if (!nachZiehung.includes("1. Platz") || !nachZiehung.includes("3. Platz")) {
    no("Mehrere Gewinne", "Plätze nicht korrekt beschriftet");
  } else if (!nachZiehung.includes("Nachrücker 1")) {
    no("Nachrücker", "keine Nachrücker ausgewiesen");
  } else {
    ok("Gezogen", "3 Gewinnplätze + Nachrücker sauber getrennt");
  }

  // ── Ersten Platz ablehnen → Nachrücker erbt Platz 1 ───────────────────────
  const ersterName = (await page.locator("div.border-emerald-300").first().innerText())
    .split("\n")
    .find((l) => l.startsWith("@"));

  const pruefliste = page.locator("section").filter({ hasText: "Gewinner prüfen" }).last();
  await pruefliste.locator("li").filter({ hasText: "1. Platz —" }).first()
    .getByRole("button", { name: "Ablehnen" }).click();
  await settle();

  const nachAblehnung = await page.locator("div.border-emerald-300").first().innerText();
  if (nachAblehnung.includes(ersterName ?? "@@@")) {
    no("Nachrücken", "abgelehnter Kandidat belegt Platz 1 weiterhin");
  } else if (!nachAblehnung.includes("Nachgerückt")) {
    no("Nachrücken", "kein Hinweis auf das Nachrücken");
  } else {
    ok("Nachrücker erbt Platz 1", nachAblehnung.replace(/\s+/g, " ").slice(0, 60));
  }

  // ── Alle bestätigen ───────────────────────────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const offen = page.getByRole("button", { name: "Bestätigen" }).first();
    await page.waitForTimeout(200);
    if ((await offen.count()) === 0) break;
    await offen.click();
    await settle();
  }
  ok("Alle Gewinnplätze bestätigt");

  // ── Veröffentlichen und Hash nachrechnen ──────────────────────────────────
  // Nach der Ziehung heißt der Knopf nach dem, was er tut.
  await page.getByRole("button", { name: "Nachweis-Seite erzeugen" }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes("Datei erzeugt"),
    null,
    { timeout: 30000 },
  );
  ok("Nachweis-Seite erzeugt");

  const html = readFileSync(`veroeffentlichung/${slug}.html`, "utf8");
  const liste = html.match(/<pre id="liste">([\s\S]*?)<\/pre>/)?.[1] ?? "";
  const seed = html.match(/Zufallszahl<\/dt><dd><code>([a-f0-9]+)</)?.[1] ?? "";
  const hash = html.match(/SHA-256\)<\/dt><dd><code>([a-f0-9]{64})</)?.[1] ?? "";

  const entschluesselt = liste
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"');

  const nachgerechnet = createHash("sha256")
    .update(`${entschluesselt}\n--seed--\n${seed}`, "utf8")
    .digest("hex");

  if (!hash || !seed || !liste) {
    no("Veröffentlichung", "Hash, Seed oder Liste fehlen in der Datei");
  } else if (nachgerechnet !== hash) {
    no("Nachrechnen", `Hash stimmt nicht: ${nachgerechnet.slice(0, 16)}… statt ${hash.slice(0, 16)}…`);
  } else {
    ok("Hash aus der veröffentlichten Datei nachgerechnet", hash.slice(0, 16) + "…");
  }

  // ── Übersichtsseite kommt mit ─────────────────────────────────────────────
  // Ohne sie lässt sich GitHub Pages gar nicht erst einschalten.
  const index = readFileSync("veroeffentlichung/index.html", "utf8");
  if (!index.includes(`href="${slug}.html"`)) {
    no("Übersichtsseite", `verlinkt ${slug}.html nicht`);
  } else if (!index.includes("in keiner Verbindung")) {
    no("Übersichtsseite", "Pflichthinweis zu den Plattformen fehlt");
  } else {
    ok("Übersichtsseite verlinkt die Gewinnspielseite");
  }

  // ── Öffentliche Seite ─────────────────────────────────────────────────────
  const pub = await browser.newPage();
  await pub.goto(`${B}/gewinnspiel/${slug}`);
  const pubText = await pub.innerText("body");
  if (!pubText.includes("Ich bin dabei")) no("Öffentlich", "Gewinnerkommentar fehlt");
  else if (!pubText.includes("Verwaltung")) no("Öffentlich", "Rückweg fehlt");
  else if (!pubText.includes("Impressum")) no("Öffentlich", "Impressum fehlt im Fußbereich");
  else ok("Öffentliche Seite zeigt Kommentar, Impressum und Rückweg");

  await pub.screenshot({ path: "/tmp/030-public.png", fullPage: true });
  await page.screenshot({ path: "/tmp/030-admin.png", fullPage: true });
} catch (e) {
  no("Abgebrochen", e.message);
  const dump = await page.innerText("body").catch(() => "(kein Text)");
  console.error("\n--- Seiteninhalt ---\n" + dump.slice(0, 1500));
} finally {
  await browser.close();
  console.log(bad ? "\nFEHLGESCHLAGEN" : "\nAlles grün.");
  process.exitCode = bad ? 1 : 0;
}
