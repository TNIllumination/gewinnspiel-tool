import { describe, expect, it } from "vitest";
import { evaluateEntries, type CommentInput, type RuleSpec } from "@/rules/engine";
import { entryFingerprint } from "@/rules/text";

// Diese Tests halten bewusst Entscheidungen fest, die im Gespräch getroffen
// wurden. Sie beschreiben, was fair sein soll — nicht nur, was der Code tut.

function comment(
  username: string,
  text: string,
  platform: string,
  minutesAgo = 0,
): CommentInput {
  return {
    username,
    text,
    platform,
    externalId: `${platform}-${username}-${minutesAgo}`,
    commentedAt: new Date(Date.UTC(2026, 0, 10, 12, 0, 0) - minutesAgo * 60_000),
  };
}

const EIN_LOS: RuleSpec[] = [
  { type: "DEDUPE", config: { mode: "one_per_user" } },
];

describe("Mehrfachteilnahme über Plattformen hinweg", () => {
  it("gibt demselben Namen auf zwei Plattformen zwei Lose", () => {
    // Angesagt wird: „kommentiere auch drüben für mehr Chancen".
    // Genau das muss auch passieren.
    const { validCount, totalLots } = evaluateEntries(
      [
        comment("anna", "Ich bin dabei", "TIKTOK", 20),
        comment("anna", "Ich bin dabei", "INSTAGRAM", 10),
      ],
      EIN_LOS,
    );

    expect(validCount).toBe(2);
    expect(totalLots).toBe(2);
  });

  it("gibt derselben Person auf derselben Plattform nur ein Los", () => {
    const { validCount, entries } = evaluateEntries(
      [
        comment("anna", "Erster Versuch", "TIKTOK", 20),
        comment("anna", "Zweiter Versuch", "TIKTOK", 10),
      ],
      EIN_LOS,
    );

    expect(validCount).toBe(1);
    const abgelehnt = entries.find((e) => !e.valid);
    expect(abgelehnt?.rejections[0].message).toContain("dieser Plattform");
  });

  it("trennt auch drei Plattformen sauber", () => {
    const { totalLots } = evaluateEntries(
      [
        comment("anna", "dabei", "TIKTOK"),
        comment("anna", "dabei", "INSTAGRAM"),
        comment("anna", "dabei", "YOUTUBE"),
      ],
      EIN_LOS,
    );
    expect(totalLots).toBe(3);
  });
});

describe("Kein Schlupfloch durch Wiederholung", () => {
  const rules: RuleSpec[] = [
    { type: "KEYWORD", config: { keywords: ["test"] } },
    ...EIN_LOS,
  ];

  it("wer das Wort doppelt schreibt, bleibt gültig und bekommt ein Los", () => {
    // Beide Hälften sind wichtig: nicht ablehnen UND nicht bevorteilen.
    // Ein Test nur auf „kein Zusatzlos" wäre auch dann grün, wenn die
    // Teilnahme fälschlich abgelehnt würde — null ist schließlich auch
    // kein Zusatzlos.
    const { entries } = evaluateEntries(
      [comment("ben", "Test Test", "TIKTOK")],
      rules,
    );

    expect(entries[0].valid).toBe(true);
    expect(entries[0].rejections).toEqual([]);
    expect(entries[0].lots).toBe(1);
  });

  it("stellt einfach und doppelt genannt gleich", () => {
    const { entries } = evaluateEntries(
      [
        comment("anna", "Test", "TIKTOK"),
        comment("ben", "Test Test Test", "TIKTOK"),
      ],
      rules,
    );

    expect(entries.every((e) => e.valid)).toBe(true);
    expect(entries.map((e) => e.lots)).toEqual([1, 1]);
  });

  it("zählt dieselbe Person doppelt markiert einmal, lehnt aber nicht ab", () => {
    const mitTags: RuleSpec[] = [{ type: "MENTIONS", config: { min: 2 } }];

    const doppelt = evaluateEntries(
      [comment("anna", "@ben @ben", "TIKTOK")],
      mitTags,
    );
    // Zu wenig verschiedene Freunde — Ablehnung ist hier richtig,
    // aber wegen der Anzahl, nicht wegen der Wiederholung.
    expect(doppelt.entries[0].valid).toBe(false);
    expect(doppelt.entries[0].rejections[0].ruleType).toBe("MENTIONS");

    const echtZwei = evaluateEntries(
      [comment("anna", "@ben @carla @ben", "TIKTOK")],
      mitTags,
    );
    expect(echtZwei.entries[0].valid).toBe(true);
    expect(echtZwei.entries[0].lots).toBe(1);
  });
});

describe("Fingerabdruck für den Import in Etappen", () => {
  it("erkennt denselben Kommentar wieder", () => {
    expect(entryFingerprint("anna", "Ich bin dabei")).toBe(
      entryFingerprint("@anna", "Ich bin dabei"),
    );
  });

  it("übersieht Schreibvarianten nicht als neue Teilnahme", () => {
    // Beim zweiten Kopieren kann sich die Formatierung leicht unterscheiden.
    expect(entryFingerprint("Anna", "Ich  bin   dabei")).toBe(
      entryFingerprint("anna", "Ich bin dabei"),
    );
    expect(entryFingerprint("anna", "Liebe Grüße")).toBe(
      entryFingerprint("anna", "Liebe Gruesse"),
    );
  });

  it("hält verschiedene Teilnahmen auseinander", () => {
    expect(entryFingerprint("anna", "Ich bin dabei")).not.toBe(
      entryFingerprint("ben", "Ich bin dabei"),
    );
    expect(entryFingerprint("anna", "Ich bin dabei")).not.toBe(
      entryFingerprint("anna", "Doch nicht"),
    );
  });
});
