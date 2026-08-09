import { describe, expect, it } from "vitest";
import { buildPrivacyPolicy } from "@/legal/datenschutz";
import { MissingOrganizerError, type Organizer } from "@/legal/teilnahmebedingungen";

const WHO: Organizer = {
  organizer: "Max Mustermann",
  contact: "kontakt@beispiel.de",
  publishBaseUrl: "https://beispiel.github.io/gewinnspiele",
  impressumUrl: "https://mein.online-impressum.de/beispiel",
};

const OPT = {
  retentionDays: 30,
  publishRetentionMonths: 6,
  platforms: ["INSTAGRAM", "TIKTOK", "SANDBOX"] as const,
};

const text = buildPrivacyPolicy(WHO, { ...OPT, platforms: [...OPT.platforms] });

describe("Pflichtangaben nach Art. 13 DSGVO", () => {
  it("benennt den Verantwortlichen samt Kontakt und Impressum", () => {
    expect(text).toContain("Max Mustermann");
    expect(text).toContain("kontakt@beispiel.de");
    expect(text).toContain("https://mein.online-impressum.de/beispiel");
  });

  it("nennt Zwecke und Rechtsgrundlagen", () => {
    expect(text).toContain("Art. 6 Abs. 1 lit. b DSGVO");
    expect(text).toContain("Art. 6 Abs. 1 lit. f DSGVO");
  });

  it("nennt die Speicherdauer konkret", () => {
    expect(text).toContain("30 Tage");
    expect(text).toContain("6 Monate");
  });

  it("zählt die Betroffenenrechte samt Beschwerderecht auf", () => {
    for (const artikel of ["Art. 15", "Art. 16", "Art. 17", "Art. 18", "Art. 20", "Art. 21", "Art. 77"]) {
      expect(text).toContain(artikel);
    }
    expect(text).toContain("Aufsichtsbehörde");
  });

  it("erklärt den Hoster und die Übermittlung in die USA", () => {
    expect(text).toContain("GitHub Pages");
    expect(text).toContain("Data Privacy Framework");
    // Traegt auch, falls der Angemessenheitsbeschluss kippt.
    expect(text).toContain("Standardvertragsklauseln");
  });
});

describe("Aus den echten Angaben, nicht aus einer Vorlage", () => {
  it("nennt nur die tatsächlich genutzten Plattformen, ohne Testmodus", () => {
    expect(text).toContain("Instagram und TikTok");
    expect(text).not.toContain("Testmodus");
    expect(text).not.toContain("YouTube");
  });

  it("übernimmt geänderte Fristen", () => {
    const anders = buildPrivacyPolicy(WHO, {
      ...OPT,
      platforms: ["TIKTOK"],
      retentionDays: 14,
      publishRetentionMonths: 12,
    });
    expect(anders).toContain("14 Tage");
    expect(anders).toContain("12 Monate");
  });

  it("lässt die Impressum-Zeile weg, wenn keines hinterlegt ist", () => {
    const ohne = buildPrivacyPolicy(
      { organizer: "A", contact: "b@c.de" },
      { ...OPT, platforms: ["TIKTOK"] },
    );
    expect(ohne).not.toContain("Impressum:");
  });

  it("verlangt Veranstalterangaben", () => {
    expect(() =>
      buildPrivacyPolicy({ organizer: "", contact: "" }, { ...OPT, platforms: [] }),
    ).toThrow(MissingOrganizerError);
  });
});

// Ein entfernter Name macht die Pruefsumme wertlos. Das zu verschweigen
// waere bequem und falsch.
it("sagt offen, was ein Widerspruch für die Nachrechenbarkeit bedeutet", () => {
  expect(text).toContain("nicht mehr nachrechnen");
});
