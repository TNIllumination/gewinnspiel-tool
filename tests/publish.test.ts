import { describe, expect, it } from "vitest";
import { buildIndexPage, withScheme, type IndexEntry } from "@/legal/publish";

const WHO = {
  organizer: "Max Mustermann",
  contact: "kontakt@beispiel.de",
};

function entries(): IndexEntry[] {
  return [
    {
      slug: "merch-verlosung",
      title: "Merch-Verlosung",
      endsAt: new Date(Date.UTC(2026, 7, 13, 18, 0)),
      completed: false,
    },
    {
      slug: "festival-tickets",
      title: "Festival-Tickets",
      endsAt: null,
      completed: true,
    },
  ];
}

describe("Übersichtsseite", () => {
  it("nennt einen Hinweis statt einer leeren Liste", () => {
    const html = buildIndexPage({ ...WHO, entries: [] });
    expect(html).toContain("sobald das erste");
    expect(html).not.toContain("<ul class=\"gewinnspiele\">");
  });

  it("verlinkt jedes Gewinnspiel auf seine Datei", () => {
    const html = buildIndexPage({ ...WHO, entries: entries() });
    expect(html).toContain('href="merch-verlosung.html"');
    expect(html).toContain('href="festival-tickets.html"');
    expect(html).toContain("Merch-Verlosung");
    expect(html).toContain("Festival-Tickets");
  });

  it("unterscheidet laufende von abgeschlossenen Gewinnspielen", () => {
    const html = buildIndexPage({ ...WHO, entries: entries() });
    expect(html).toContain("läuft");
    expect(html).toContain("abgeschlossen");
  });

  // Die Startseite ist für viele der erste Kontakt — der Pflichthinweis der
  // Plattformen gehört deshalb auch dorthin, nicht nur auf die Unterseiten.
  it("enthält den Pflichthinweis zu den Plattformen", () => {
    const html = buildIndexPage({ ...WHO, entries: [] });
    expect(html).toContain("in keiner Verbindung");
    expect(html).toContain("weder gesponsert noch unterstützt oder organisiert");
    expect(html).toContain("von jeglicher Haftung frei");
    expect(html).toContain("Max Mustermann");
  });

  it("verlinkt das Impressum nur, wenn eines hinterlegt ist", () => {
    const ohne = buildIndexPage({ ...WHO, entries: [] });
    expect(ohne).not.toContain("Impressum");

    const mit = buildIndexPage({
      ...WHO,
      impressumUrl: "https://mein.online-impressum.de/tobisreise",
      entries: [],
    });
    expect(mit).toContain(
      '<a href="https://mein.online-impressum.de/tobisreise"',
    );
    expect(mit).toContain(">Impressum</a>");
  });

  it("maskiert spitze Klammern in Titeln", () => {
    const html = buildIndexPage({
      ...WHO,
      entries: [{ slug: "x", title: "<script>alert(1)</script>", completed: false }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ist in sich geschlossen — keine externen Ressourcen", () => {
    const html = buildIndexPage({ ...WHO, entries: entries() });
    expect(html).not.toMatch(/<link[^>]+href="http/);
    expect(html).not.toMatch(/<script[^>]+src=/);
  });
});

describe("withScheme", () => {
  // Ohne Schema liest der Browser die Eingabe als relativen Pfad — der Link
  // im Fußbereich zeigt dann ins Nichts.
  it("ergänzt https:// bei einer nackten Adresse", () => {
    expect(withScheme("mein.online-impressum.de/tobisreise")).toBe(
      "https://mein.online-impressum.de/tobisreise",
    );
  });

  it("lässt ein vorhandenes Schema unangetastet", () => {
    expect(withScheme("https://beispiel.de")).toBe("https://beispiel.de");
    expect(withScheme("http://beispiel.de")).toBe("http://beispiel.de");
    expect(withScheme("mailto:kontakt@beispiel.de")).toBe(
      "mailto:kontakt@beispiel.de",
    );
  });

  it("macht aus leer nicht https://", () => {
    expect(withScheme("")).toBe("");
    expect(withScheme("   ")).toBe("");
  });
});
