import { describe, expect, it } from "vitest";
import { generateSandboxComments } from "@/platforms/sandbox";
import { evaluateEntries, type RuleSpec } from "@/rules/engine";

// Der Testmodus soll den Ablauf vorfuehren. Vorher enthielt jeder gueltige
// Kommentar fest verdrahtet das Wort "dabei" — verlangte man etwas anderes,
// fiel jede der 250 Teilnahmen durch. Genau das prueft diese Datei.

function bewerte(regeln: {
  keywords?: string[];
  keywordMode?: string;
  mentionsMin?: number;
  minLength?: number;
}) {
  const comments = generateSandboxComments({ count: 200, seed: "test", regeln });

  const specs: RuleSpec[] = [];
  if (regeln.keywords?.length) {
    specs.push({
      type: "KEYWORD",
      config: { keywords: regeln.keywords, mode: regeln.keywordMode ?? "any" },
    });
  }
  if (regeln.mentionsMin) {
    specs.push({ type: "MENTIONS", config: { min: regeln.mentionsMin } });
  }
  if (regeln.minLength) {
    specs.push({ type: "MIN_LENGTH", config: { min: regeln.minLength } });
  }

  const zusammenfassung = evaluateEntries(comments, specs);
  return {
    gueltig: zusammenfassung.validCount,
    abgelehnt: zusammenfassung.entries.filter((e) => !e.valid),
    gesamt: zusammenfassung.entries.length,
    gruende: zusammenfassung.rejectionsByRule,
  };
}

describe("Testmodus richtet sich nach den gesetzten Regeln", () => {
  it("erzeugt gültige Teilnahmen bei einem eigenen Schlüsselwort", () => {
    const { gueltig, gesamt } = bewerte({ keywords: ["festival"] });
    // Das ist der Kern: vorher waren es null.
    expect(gueltig).toBeGreaterThan(gesamt * 0.5);
  });

  it("kommt auch mit Markierungen und Mindestlänge zurecht", () => {
    const { gueltig, gesamt } = bewerte({
      keywords: ["sommertour"],
      mentionsMin: 2,
      minLength: 20,
    });
    expect(gueltig).toBeGreaterThan(gesamt * 0.5);
  });

  it("erfüllt bei „alle nötig“ auch alle Wörter", () => {
    const { gueltig, gesamt } = bewerte({
      keywords: ["festival", "sommer"],
      keywordMode: "all",
    });
    expect(gueltig).toBeGreaterThan(gesamt * 0.5);
  });

  // Ohne Abgelehnte sieht man nie, dass die Regelprüfung begruendet ablehnt.
  it("lässt einen Teil absichtlich durchfallen", () => {
    const { gueltig, gesamt } = bewerte({ keywords: ["festival"] });
    expect(gesamt - gueltig).toBeGreaterThan(0);
  });

  it("zeigt jede Ablehnungsart mindestens einmal", () => {
    const { gruende } = bewerte({
      keywords: ["festival"],
      mentionsMin: 2,
      minLength: 20,
    });
    expect(gruende.KEYWORD).toBeGreaterThan(0);
    expect(gruende.MENTIONS).toBeGreaterThan(0);
    expect(gruende.MIN_LENGTH).toBeGreaterThan(0);
  });

  it("bleibt ohne Regeln brauchbar", () => {
    const comments = generateSandboxComments({ count: 50, seed: "x" });
    expect(comments).toHaveLength(50);
    expect(comments.every((c) => c.text.trim().length > 0)).toBe(true);
  });

  it("erzeugt bei gleichem Startwert dasselbe", () => {
    const a = generateSandboxComments({ count: 20, seed: "gleich", regeln: { keywords: ["x"] } });
    const b = generateSandboxComments({ count: 20, seed: "gleich", regeln: { keywords: ["x"] } });
    expect(a.map((c) => c.text)).toEqual(b.map((c) => c.text));
  });
});
