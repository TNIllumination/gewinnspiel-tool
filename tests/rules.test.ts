import { describe, expect, it } from "vitest";
import { evaluateEntries, type CommentInput, type RuleSpec } from "@/rules/engine";

function comment(
  username: string,
  text: string,
  minutesAgo = 0,
  externalId?: string,
): CommentInput {
  return {
    username,
    text,
    externalId: externalId ?? `${username}-${minutesAgo}`,
    commentedAt: new Date(Date.UTC(2026, 0, 10, 12, 0, 0) - minutesAgo * 60_000),
  };
}

describe("Regel: Schluesselwort", () => {
  const rules: RuleSpec[] = [
    { type: "KEYWORD", config: { keywords: ["dabei"], mode: "any" } },
  ];

  it("laesst passende Kommentare zu", () => {
    const { entries, validCount } = evaluateEntries(
      [comment("anna", "Ich bin dabei!")],
      rules,
    );
    expect(validCount).toBe(1);
    expect(entries[0].rejections).toEqual([]);
  });

  it("lehnt ab und nennt den Grund", () => {
    const { entries } = evaluateEntries([comment("ben", "Schön!")], rules);
    expect(entries[0].valid).toBe(false);
    expect(entries[0].rejections[0].ruleType).toBe("KEYWORD");
    expect(entries[0].rejections[0].message).toContain("dabei");
  });

  it("verlangt im Modus 'all' jedes Wort und benennt das fehlende", () => {
    const all: RuleSpec[] = [
      { type: "KEYWORD", config: { keywords: ["dabei", "#aktion"], mode: "all" } },
    ];
    const { entries } = evaluateEntries([comment("ben", "Ich bin dabei")], all);
    expect(entries[0].valid).toBe(false);
    expect(entries[0].rejections[0].message).toContain("#aktion");
  });
});

describe("Regel: Freunde markieren", () => {
  const rules: RuleSpec[] = [{ type: "MENTIONS", config: { min: 2 } }];

  it("akzeptiert zwei verschiedene Freunde", () => {
    const { entries } = evaluateEntries(
      [comment("anna", "@ben @carla schaut mal")],
      rules,
    );
    expect(entries[0].valid).toBe(true);
  });

  it("zaehlt denselben Freund nicht doppelt", () => {
    const { entries } = evaluateEntries(
      [comment("anna", "@ben @ben")],
      rules,
    );
    expect(entries[0].valid).toBe(false);
    expect(entries[0].rejections[0].message).toContain("markiert wurde 1");
  });

  it("zaehlt Selbstmarkierung nicht mit", () => {
    const { entries } = evaluateEntries(
      [comment("anna", "@anna @ben")],
      rules,
    );
    expect(entries[0].valid).toBe(false);
  });

  it("zaehlt den Veranstalter nicht mit", () => {
    const { entries } = evaluateEntries(
      [comment("anna", "@veranstalter @ben")],
      rules,
      { ownerHandle: "veranstalter" },
    );
    expect(entries[0].valid).toBe(false);
  });
});

describe("Regel: Mehrfachteilnahme", () => {
  it("laesst pro Person nur den ersten Kommentar zu", () => {
    const rules: RuleSpec[] = [
      { type: "DEDUPE", config: { mode: "one_per_user" } },
    ];
    // 30 Minuten alt = frueher als der 5 Minuten alte.
    const { entries, validCount } = evaluateEntries(
      [
        comment("anna", "Zweiter Versuch", 5, "a2"),
        comment("anna", "Erster Versuch", 30, "a1"),
        comment("ben", "Bin dabei", 10, "b1"),
      ],
      rules,
    );

    expect(validCount).toBe(2);
    const anna1 = entries.find((e) => e.externalId === "a1");
    const anna2 = entries.find((e) => e.externalId === "a2");
    expect(anna1?.valid).toBe(true);
    expect(anna2?.valid).toBe(false);
    expect(anna2?.rejections[0].message).toContain("erste Kommentar");
  });

  it("erlaubt im Modus 'all_comments' jede Teilnahme", () => {
    const rules: RuleSpec[] = [
      { type: "DEDUPE", config: { mode: "all_comments" } },
    ];
    const { validCount, totalLots } = evaluateEntries(
      [comment("anna", "eins", 5, "a1"), comment("anna", "zwei", 3, "a2")],
      rules,
    );
    expect(validCount).toBe(2);
    expect(totalLots).toBe(2);
  });

  it("begrenzt im Modus 'max_per_user' auf die erlaubte Zahl", () => {
    const rules: RuleSpec[] = [
      { type: "DEDUPE", config: { mode: "max_per_user", max: 2 } },
    ];
    const { validCount } = evaluateEntries(
      [
        comment("anna", "eins", 30, "a1"),
        comment("anna", "zwei", 20, "a2"),
        comment("anna", "drei", 10, "a3"),
      ],
      rules,
    );
    expect(validCount).toBe(2);
  });
});

describe("Regel: Zusatzlose", () => {
  it("erhoeht die Lose bei erfuellter Bedingung", () => {
    const rules: RuleSpec[] = [
      { type: "BONUS", config: { when: "mentions_at_least", mentionsAtLeast: 2, extraLots: 2 } },
    ];
    const { entries } = evaluateEntries(
      [comment("anna", "@ben @carla"), comment("ben", "kein tag")],
      rules,
    );
    expect(entries.find((e) => e.username === "anna")?.lots).toBe(3);
    expect(entries.find((e) => e.username === "ben")?.lots).toBe(1);
  });

  it("gibt ungueltigen Teilnahmen keine Lose", () => {
    const rules: RuleSpec[] = [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "BONUS", config: { when: "always", extraLots: 5 } },
    ];
    const { entries, totalLots } = evaluateEntries(
      [comment("ben", "kein schluesselwort")],
      rules,
    );
    expect(entries[0].valid).toBe(false);
    expect(entries[0].lots).toBe(0);
    expect(totalLots).toBe(0);
  });
});

describe("Regel: Zeitfenster und Ausschlussliste", () => {
  it("lehnt Kommentare nach Einsendeschluss ab", () => {
    const rules: RuleSpec[] = [
      { type: "TIMEWINDOW", config: { to: new Date(Date.UTC(2026, 0, 10, 11, 0, 0)).toISOString() } },
    ];
    const { entries } = evaluateEntries([comment("anna", "zu spät")], rules);
    expect(entries[0].valid).toBe(false);
    expect(entries[0].rejections[0].message).toContain("Einsendeschluss");
  });

  it("schliesst gesperrte Accounts aus", () => {
    const rules: RuleSpec[] = [
      { type: "BLOCKLIST", config: { usernames: ["@team_account"] } },
    ];
    const { entries } = evaluateEntries(
      [comment("team_account", "Ich bin dabei")],
      rules,
    );
    expect(entries[0].valid).toBe(false);
    expect(entries[0].rejections[0].ruleType).toBe("BLOCKLIST");
  });
});

describe("Zusammenfassung", () => {
  it("zaehlt Ablehnungen je Regel", () => {
    const rules: RuleSpec[] = [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "MENTIONS", config: { min: 1 } },
    ];
    const summary = evaluateEntries(
      [
        comment("anna", "dabei @ben"),
        comment("ben", "nichts passendes"),
        comment("carla", "dabei, aber ohne Tag"),
      ],
      rules,
    );

    expect(summary.validCount).toBe(1);
    expect(summary.rejectedCount).toBe(2);
    expect(summary.rejectionsByRule.KEYWORD).toBe(1);
    expect(summary.rejectionsByRule.MENTIONS).toBe(2);
  });

  it("sammelt mehrere Gruende pro Teilnahme", () => {
    const rules: RuleSpec[] = [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "MENTIONS", config: { min: 1 } },
    ];
    const { entries } = evaluateEntries([comment("ben", "hi")], rules);
    expect(entries[0].rejections).toHaveLength(2);
  });

  it("wirft bei falsch konfigurierter Regel eine lesbare Meldung", () => {
    const rules: RuleSpec[] = [{ type: "KEYWORD", config: { keywords: [] } }];
    expect(() => evaluateEntries([comment("anna", "x")], rules)).toThrow(
      /falsch konfiguriert/,
    );
  });

  it("ignoriert deaktivierte Regeln", () => {
    const rules: RuleSpec[] = [
      { type: "KEYWORD", config: { keywords: ["dabei"] }, enabled: false },
    ];
    const { validCount } = evaluateEntries([comment("ben", "hi")], rules);
    expect(validCount).toBe(1);
  });
});
