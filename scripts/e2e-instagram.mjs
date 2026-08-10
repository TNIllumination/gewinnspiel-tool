// Praxistest für Fassung 0.8.0: Instagram-Anbindung.
//
// Ohne echtes Konto lässt sich der Abruf nicht durchspielen — aber genau die
// Fälle, in denen etwas fehlt, sind die, an denen man sonst hängenbleibt:
// kein Schlüssel, falscher Schlüssel, kein Beitrag gewählt. Die müssen im
// **Produktionsbau** einen lesbaren Satz ergeben und keine Fehlernummer.
import { chromium } from "playwright";

const B = "http://localhost:3000";
const EMAIL = process.env.E2E_EMAIL ?? "rauchtest@example.com";
const PASSWORD = "ein-sehr-langes-testpasswort";

let bad = false;
const ok = (m, d = "") => console.log(`✓ ${m}${d ? " — " + d : ""}`);
const no = (m, d) => {
  bad = true;
  console.error(`✗ ${m} — ${d}`);
};

/// Zensierte Meldungen sind der Fehler aus Fassung 0.4.1: Next.js entfernt im
/// fertigen Bau die Texte geworfener Ausnahmen.
const lesbar = (text, wo) => {
  if (/error #\d+|omitted in production|Server Components render/i.test(text)) {
    no(wo, `zensierte Meldung statt Klartext: ${text.slice(0, 90)}`);
    return false;
  }
  return true;
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {},
);
const page = await browser.newPage();
page.setDefaultTimeout(20000);
page.on("dialog", (d) => d.accept());

try {
  // ── Anmelden ──────────────────────────────────────────────────────────────
  await page.goto(`${B}/admin/login`);
  const setup = await page.getByRole("heading", { name: "Ersteinrichtung" }).isVisible();
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: setup ? "Konto anlegen" : "Anmelden" }).click();
  await page.waitForURL("**/admin");
  ok("Angemeldet");

  // ── Ohne Schlüssel: sagen, was fehlt ──────────────────────────────────────
  await page.goto(`${B}/admin/einstellungen`);

  // Die Anleitung steckt in einem zugeklappten <details>. Zugeklappt liefert
  // innerText nichts — also aufklappen, genau wie ein Mensch es täte.
  await page.getByText("So richtest du den Zugang ein").click();
  const anleitung = await page
    .locator("section", { hasText: "Instagram verbinden" })
    .innerText();
  if (!/App Review/i.test(anleitung)) {
    no("Anleitung", "sagt nicht, dass keine Meta-Prüfung nötig ist");
  } else if (!/instagram_business_manage_comments/.test(anleitung)) {
    no("Anleitung", "nennt die nötigen Berechtigungen nicht");
  } else {
    ok("Anleitung nennt Berechtigungen und die entfallende Prüfung");
  }

  await page
    .locator("section", { hasText: "Instagram verbinden" })
    .getByRole("button", { name: "Verbindung prüfen" })
    .click();
  await page.waitForTimeout(2500);

  const ohneSchluessel = await page
    .locator("section", { hasText: "Instagram verbinden" })
    .locator('[role="alert"]')
    .first()
    .innerText();
  if (!lesbar(ohneSchluessel, "Verbindung prüfen ohne Schlüssel")) {
    // Meldung schon ausgegeben
  } else if (!/kein Instagram-Schlüssel hinterlegt/i.test(ohneSchluessel)) {
    no("Verbindung prüfen", `unerwarteter Text: ${ohneSchluessel.slice(0, 90)}`);
  } else {
    ok("Ohne Schlüssel steht der Grund da", ohneSchluessel.slice(0, 55));
  }

  // ── Mit erfundenem Schlüssel: Metas Absage im Klartext ────────────────────
  // Der Schlüssel ist Unsinn, Instagram lehnt ihn ab. Was ankommen muss, ist
  // ein Satz — nicht „OAuthException, code 190" und erst recht keine Nummer.
  await page.fill('input[name="organizer"]', "Max Mustermann");
  await page.fill('input[name="contact"]', "kontakt@beispiel.de");
  await page.fill('input[name="instagramToken"]', "IGAA_erfunden_ungueltig");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(2500);
  await page.reload();

  const gespeichert = await page
    .locator("section", { hasText: "Instagram verbinden" })
    .innerText();
  if (!/Schlüssel hinterlegt|Verbunden als/.test(gespeichert)) {
    no("Speichern", "der Schlüssel wurde nicht übernommen");
  } else {
    ok("Schlüssel hinterlegt");
  }

  await page
    .locator("section", { hasText: "Instagram verbinden" })
    .getByRole("button", { name: "Verbindung prüfen" })
    .click();
  await page.waitForTimeout(8000);

  const absage = await page
    .locator("section", { hasText: "Instagram verbinden" })
    .locator('[role="alert"]')
    .first()
    .innerText();
  if (!lesbar(absage, "Verbindung prüfen mit falschem Schlüssel")) {
    // Meldung schon ausgegeben
  } else if (/OAuthException|code 190|\bnull\b|undefined/i.test(absage)) {
    no("Fehlermeldung", `Rohtext von Meta durchgereicht: ${absage.slice(0, 90)}`);
  } else if (absage.trim().length < 30) {
    no("Fehlermeldung", `zu knapp, um zu helfen: ${absage}`);
  } else {
    ok("Metas Absage kommt als deutscher Satz", absage.slice(0, 60));
  }

  // ── Im Gewinnspiel: erst Beitrag wählen, dann abrufen ─────────────────────
  await page.goto(`${B}/admin`);
  await page.fill('input[name="title"]', "Instagram-Verlosung");
  await page.uncheck('input[name="platform_SANDBOX"]');
  await page.check('input[name="platform_INSTAGRAM"]');
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);
  ok("Instagram-Gewinnspiel angelegt");

  const abrufKarte = await page.innerText("body");
  if (!/Kommentare automatisch abrufen/i.test(abrufKarte)) {
    no("Abruf", "die Karte fehlt, obwohl ein Schlüssel hinterlegt ist");
  } else if (/Kommentare abrufen/.test(abrufKarte)) {
    // Ohne gewählten Beitrag darf der Abruf-Knopf gar nicht dastehen —
    // sonst führt er zwangsläufig in einen Fehler.
    no("Abruf", "Abrufen wird angeboten, obwohl kein Beitrag gewählt ist");
  } else if (!/Wähl zuerst den Beitrag/i.test(abrufKarte)) {
    no("Abruf", "es steht nicht da, was zuerst zu tun ist");
  } else {
    ok("Ohne gewählten Beitrag wird Abrufen nicht angeboten");
  }

  await page.getByRole("button", { name: "Beitrag auswählen" }).click();
  await page.waitForTimeout(8000);
  const beitragsFehler = await page.locator('[role="alert"]').first().innerText();
  if (!lesbar(beitragsFehler, "Beitrag auswählen")) {
    // Meldung schon ausgegeben
  } else if (beitragsFehler.trim().length < 30) {
    no("Beitragsliste", `zu knappe Meldung: ${beitragsFehler}`);
  } else {
    ok("Auch die Beitragsliste scheitert lesbar", beitragsFehler.slice(0, 55));
  }

  // ── TikTok bietet den Abruf gar nicht erst an ─────────────────────────────
  // Die Capabilities steuern die Oberfläche — was die Schnittstelle nicht
  // hergibt, darf nicht als Knopf dastehen.
  await page.goto(`${B}/admin`);
  await page.fill('input[name="title"]', "TikTok-Verlosung");
  await page.uncheck('input[name="platform_SANDBOX"]');
  await page.check('input[name="platform_TIKTOK"]');
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await page.waitForURL(/\/admin\/[a-z0-9]+$/);

  const tiktokSeite = await page.innerText("body");
  if (/Kommentare automatisch abrufen/i.test(tiktokSeite)) {
    no("TikTok", "Abruf wird angeboten, obwohl TikTok keine Kommentare hergibt");
  } else {
    ok("TikTok bietet keinen Abruf an");
  }
} catch (error) {
  no("Abgebrochen", error.message);
  const dump = await page.innerText("body").catch(() => "(kein Text)");
  console.error("\n--- Seiteninhalt ---\n" + dump.slice(0, 1200));
} finally {
  await browser.close();
  console.log(bad ? "\nFEHLGESCHLAGEN" : "\nAlles grün.");
  process.exitCode = bad ? 1 : 0;
}
