import { describe, expect, it } from "vitest";
import { describeRules } from "@/rules/summary";

describe("Regeln in Klartext", () => {
  it("sagt ausdrücklich, wenn Markieren NICHT gefordert ist", () => {
    // Genau der Fall, der beim Lesen der Formularfelder unklar bleibt:
    // ein leeres Feld sieht aus wie "noch nicht eingestellt".
    const lines = describeRules([
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "DEDUPE", config: { mode: "one_per_user" } },
    ]);

    expect(lines).toContain("Freunde markieren ist nicht gefordert.");
    expect(lines[0]).toContain("„dabei“");
  });

  it("beschreibt geforderte Markierungen", () => {
    const lines = describeRules([{ type: "MENTIONS", config: { min: 2 } }]);
    expect(lines).toContain("Es müssen 2 verschiedene Freunde markiert werden.");
  });

  it("unterscheidet Einzahl bei einem Freund", () => {
    const lines = describeRules([{ type: "MENTIONS", config: { min: 1 } }]);
    expect(lines).toContain("Es muss eine Freundin oder ein Freund markiert werden.");
  });

  it("unterscheidet 'alle' von 'eines genügt'", () => {
    const alle = describeRules([
      { type: "KEYWORD", config: { keywords: ["dabei", "#aktion"], mode: "all" } },
    ]);
    expect(alle[0]).toContain("alle davon");

    const eines = describeRules([
      { type: "KEYWORD", config: { keywords: ["dabei", "#aktion"], mode: "any" } },
    ]);
    expect(eines[0]).toContain("eines genügt");
  });

  it("meldet, wenn gar kein Wort gefordert ist", () => {
    const lines = describeRules([{ type: "DEDUPE", config: { mode: "all_comments" } }]);
    expect(lines).toContain("Es ist kein bestimmtes Wort gefordert.");
    expect(lines).toContain("Jeder Kommentar ist ein eigenes Los.");
  });

  it("erklärt Mehrfachteilnahme und Zusatzlose", () => {
    const lines = describeRules([
      { type: "DEDUPE", config: { mode: "max_per_user", max: 3 } },
      { type: "BONUS", config: { when: "mentions_at_least", mentionsAtLeast: 3, extraLots: 2 } },
    ]);
    expect(lines).toContain("Pro Person zählen höchstens 3 Kommentare.");
    expect(lines.some((l) => l.includes("2 Zusatzlos"))).toBe(true);
  });

  it("ignoriert abgeschaltete Regeln", () => {
    const lines = describeRules([
      { type: "MENTIONS", config: { min: 2 }, enabled: false },
    ]);
    expect(lines).toContain("Freunde markieren ist nicht gefordert.");
  });
});
