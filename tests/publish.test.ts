import { describe, expect, it } from "vitest";
import {
  buildIndexPage,
  buildPublishPage,
  withScheme,
  type IndexEntry,
} from "@/legal/publish";

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

describe("Zwei Schritte beim Veröffentlichen", () => {
  const festgeschrieben = {
    commitHash: "a".repeat(64),
    entrantCount: 137,
    totalLots: 140,
    committedAt: new Date(Date.UTC(2026, 7, 13, 18, 0)),
    seed: null,
    drawnAt: null,
    entrants: [{ id: "e1", username: "anna_berg", lots: 1, ref: "c1" }],
    winners: [],
    reserves: [],
  };

  const basis = { title: "Merch", terms: "Bedingungen", ...WHO };

  // Eine Prüfsumme beweist nur etwas, wenn sie VOR der Ziehung öffentlich war.
  it("zeigt die Prüfsumme schon vor der Ziehung", () => {
    const html = buildPublishPage({ ...basis, draw: festgeschrieben });
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("festgeschrieben");
  });

  it("verrät vor der Ziehung weder Namen noch Zufallszahl", () => {
    const html = buildPublishPage({ ...basis, draw: festgeschrieben });
    expect(html).not.toContain("anna_berg");
    expect(html).not.toContain("Zufallszahl</dt>");
  });

  it("ergänzt nach der Ziehung Liste und Zufallszahl", () => {
    const html = buildPublishPage({
      ...basis,
      draw: {
        ...festgeschrieben,
        seed: "b".repeat(64),
        drawnAt: new Date(Date.UTC(2026, 7, 13, 19, 0)),
        winners: [{ platz: 1, username: "@anna_berg", prize: "Shirt", text: "dabei" }],
        reserves: ["@ben_wald"],
      },
    });
    expect(html).toContain("anna_berg");
    expect(html).toContain("b".repeat(64));
  });

  it("sagt ohne Festschreibung, dass noch nichts vorliegt", () => {
    const html = buildPublishPage({ ...basis, draw: null });
    expect(html).toContain("noch nicht stattgefunden");
    expect(html).not.toContain("Prüfsumme (SHA-256)");
  });
});
