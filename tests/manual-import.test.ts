import { describe, expect, it } from "vitest";
import { parseManualImport } from "@/platforms/manual-import";
import { generateSandboxComments } from "@/platforms/sandbox";
import { evaluateEntries } from "@/rules/engine";

const FALLBACK = new Date(Date.UTC(2026, 0, 10, 12, 0, 0));

describe("Import: CSV", () => {
  it("liest Semikolon-CSV mit deutscher Kopfzeile", () => {
    const r = parseManualImport(
      [
        "Benutzer;Kommentar;Datum",
        "anna;Ich bin dabei @ben;24.12.2026 18:30",
        "@ben;Auch dabei;25.12.2026",
      ].join("\n"),
      FALLBACK,
    );

    expect(r.format).toBe("csv");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[0].username).toBe("anna");
    expect(r.comments[1].username).toBe("ben"); // @ entfernt
    expect(r.comments[0].commentedAt.toISOString()).toBe("2026-12-24T18:30:00.000Z");
  });

  it("kommt mit Anfuehrungszeichen und Kommas im Text klar", () => {
    const r = parseManualImport(
      ['username,text', 'anna,"Ich bin dabei, klar! ""super"""'].join("\n"),
      FALLBACK,
    );
    expect(r.comments[0].text).toBe('Ich bin dabei, klar! "super"');
  });

  it("meldet unvollstaendige Zeilen, statt sie stillschweigend zu schlucken", () => {
    const r = parseManualImport(
      ["username;text", "anna;dabei", ";kein name", "ben;"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain("Zeile 3");
  });

  it("nimmt den Importzeitpunkt, wenn das Datum unverstaendlich ist", () => {
    const r = parseManualImport(
      ["username;text;datum", "anna;dabei;irgendwann"].join("\n"),
      FALLBACK,
    );
    expect(r.comments[0].commentedAt).toEqual(FALLBACK);
    expect(r.warnings[0]).toContain("nicht verstanden");
  });
});

describe("Import: Name-Doppelpunkt-Text", () => {
  it("erkennt das Zeilenformat", () => {
    const r = parseManualImport(
      ["@anna: Ich bin dabei @ben", "ben: Auch dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.format).toBe("inline");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[0].username).toBe("anna");
    expect(r.comments[0].text).toBe("Ich bin dabei @ben");
  });

  it("haelt die Reihenfolge der Zeilen als Reihenfolge der Kommentare", () => {
    const r = parseManualImport(["a: erster", "b: zweiter"].join("\n"), FALLBACK);
    expect(r.comments[0].commentedAt.getTime()).toBeLessThan(
      r.comments[1].commentedAt.getTime(),
    );
  });
});

describe("Import: Blöcke (TikTok-Copy-Paste)", () => {
  it("paart Name und Text", () => {
    const r = parseManualImport(
      ["@anna", "Ich bin dabei", "@ben", "Auch dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.format).toBe("blocks");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[1]).toMatchObject({ username: "ben", text: "Auch dabei" });
  });

  it("überlebt echtes TikTok-Copy-Paste mit Datum, Antworten und Like-Zahlen", () => {
    // So sieht ein Ausschnitt aus der TikTok-Weboberfläche wirklich aus.
    const paste = [
      "anna_berg",
      "Ich bin dabei @ben @carla",
      "2026-1-15",
      "Antworten",
      "12",
      "ben_wald",
      "Mega, ich bin dabei @anna @dora",
      "vor 2 Tagen",
      "Antworten",
      "1.2k",
      "Alle 3 Antworten anzeigen",
      "carla_stein",
      "Bin dabei @ben @anna",
      "3d",
      "Antworten",
      "5",
    ].join("\n");

    const r = parseManualImport(paste, FALLBACK);

    expect(r.comments).toHaveLength(3);
    expect(r.comments.map((c) => c.username)).toEqual([
      "anna_berg",
      "ben_wald",
      "carla_stein",
    ]);
    // Entscheidend: die Like-Zahl "12" darf kein Teilnehmer geworden sein.
    expect(r.comments.map((c) => c.username)).not.toContain("12");
    expect(r.comments[1].text).toBe("Mega, ich bin dabei @anna @dora");
  });

  it("hält mehrzeilige Kommentare zusammen", () => {
    const r = parseManualImport(
      ["anna_berg", "Ich bin dabei", "und drücke die Daumen @ben @carla", "Antworten", "3"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0].text).toBe("Ich bin dabei und drücke die Daumen @ben @carla");
  });

  it("meldet Text ohne vorangehenden Namen", () => {
    const r = parseManualImport(
      ["Kommentare (243)", "anna_berg", "Ich bin dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.warnings[0]).toContain("kein Benutzername");
  });
});

describe("Import: Randfaelle", () => {
  it("behandelt leere Eingabe", () => {
    const r = parseManualImport("   ", FALLBACK);
    expect(r.format).toBe("leer");
    expect(r.comments).toEqual([]);
  });
});

describe("Testmodus", () => {
  it("ist bei gleichem Seed reproduzierbar", () => {
    const a = generateSandboxComments({ count: 50, seed: "x" });
    const b = generateSandboxComments({ count: 50, seed: "x" });
    expect(a.map((c) => c.username)).toEqual(b.map((c) => c.username));
  });

  it("erzeugt gueltige und ungueltige Teilnahmen", () => {
    const comments = generateSandboxComments({ count: 300, seed: "demo" });
    const summary = evaluateEntries(comments, [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "MENTIONS", config: { min: 2 } },
      { type: "DEDUPE", config: { mode: "one_per_user" } },
    ]);

    // Beide Seiten muessen vorkommen, sonst taugt der Testmodus nichts.
    expect(summary.validCount).toBeGreaterThan(0);
    expect(summary.rejectedCount).toBeGreaterThan(0);
    expect(summary.validCount + summary.rejectedCount).toBe(300);
  });
});
