import { describe, expect, it } from "vitest";
import {
  CAPTION_LIMIT,
  MissingOrganizerError,
  buildProofText,
  buildShortTerms,
  buildTerms,
  type GiveawayForTerms,
  type Organizer,
} from "@/legal/teilnahmebedingungen";

const WHO: Organizer = {
  organizer: "Max Mustermann",
  contact: "kontakt@beispiel.de",
  publishBaseUrl: "https://beispiel.github.io/gewinnspiele",
};

function giveaway(overrides: Partial<GiveawayForTerms> = {}): GiveawayForTerms {
  return {
    title: "Merch-Verlosung",
    slug: "merch-verlosung",
    startsAt: new Date(Date.UTC(2026, 7, 10, 8, 0)),
    endsAt: new Date(Date.UTC(2026, 7, 13, 18, 0)),
    substituteCount: 5,
    sources: [
      { platform: "INSTAGRAM", postUrl: "https://instagram.com/p/abc" },
      { platform: "TIKTOK", postUrl: null },
    ],
    prizes: [{ title: "Signiertes Shirt", quantity: 1 }],
    rules: [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "DEDUPE", config: { mode: "one_per_user" } },
    ],
    ...overrides,
  };
}

describe("Pflichtbestandteile der Plattformen", () => {
  // Diese drei verlangt Meta ausdrücklich. Fällt einer unbemerkt heraus,
  // ist das Gewinnspiel angreifbar — deshalb ein Test darauf.
  const text = buildTerms(giveaway(), WHO);

  it("nennt, dass keine Verbindung zur Plattform besteht", () => {
    expect(text).toContain("steht in keiner Verbindung");
    expect(text).toContain("weder gesponsert noch unterstützt oder organisiert");
  });

  it("enthält die Haftungsfreistellung", () => {
    expect(text).toContain("von jeglicher Haftung frei");
  });

  it("benennt den alleinigen Ansprechpartner samt Kontakt", () => {
    expect(text).toContain("Alleiniger Ansprechpartner");
    expect(text).toContain("Max Mustermann");
    expect(text).toContain("kontakt@beispiel.de");
    expect(text).toContain("bitte nicht an");
  });

  it("nennt alle beteiligten Plattformen", () => {
    expect(text).toContain("Instagram");
    expect(text).toContain("TikTok");
  });
});

describe("Gesetzliche Angaben", () => {
  const text = buildTerms(giveaway(), WHO);

  it("kennzeichnet die Aktion als Gewinnspiel mit Werbecharakter", () => {
    expect(text).toContain("Werbecharakter");
  });

  it("nennt Zeitraum und Einsendeschluss", () => {
    expect(text).toContain("Einsendeschluss");
    expect(text).toContain("2026");
  });

  it("enthält den Datenschutzhinweis", () => {
    expect(text).toContain("DSGVO");
    expect(text).toContain("gelöscht");
  });

  it("nennt Altersgrenze, Kostenfreiheit und Rechtsweg", () => {
    expect(text).toContain("ab 18");
    expect(text).toContain("unabhängig von einem Kauf");
    expect(text).toContain("Rechtsweg ist ausgeschlossen");
  });
});

describe("Bedingungen kommen aus den echten Regeln", () => {
  it("übernimmt das geforderte Schlüsselwort", () => {
    expect(buildTerms(giveaway(), WHO)).toContain("„dabei“");
  });

  it("sagt, dass Markieren nicht gefordert ist, wenn es nicht gefordert ist", () => {
    expect(buildTerms(giveaway(), WHO)).toContain("Freunde markieren ist nicht gefordert");
  });

  it("weist bei mehreren Plattformen auf die Mehrfachchance hin", () => {
    expect(buildTerms(giveaway(), WHO)).toContain("mehrfach im Lostopf");
  });

  it("lässt den Hinweis bei nur einer Plattform weg", () => {
    const einzeln = giveaway({ sources: [{ platform: "TIKTOK", postUrl: null }] });
    expect(buildTerms(einzeln, WHO)).not.toContain("mehrfach im Lostopf");
  });
});

describe("Ohne Veranstalterangaben kein Text", () => {
  it("wirft statt einen unvollständigen Rechtstext auszugeben", () => {
    expect(() => buildTerms(giveaway(), { organizer: "", contact: "" })).toThrow(
      MissingOrganizerError,
    );
    expect(() =>
      buildShortTerms(giveaway(), { organizer: "Max", contact: "  " }),
    ).toThrow(MissingOrganizerError);
  });
});

describe("Kurzfassung für die Bildunterschrift", () => {
  const kurz = buildShortTerms(giveaway(), WHO);

  it("passt in eine Bildunterschrift", () => {
    expect(kurz.fitsCaption).toBe(true);
    expect(kurz.length).toBeLessThanOrEqual(CAPTION_LIMIT);
  });

  it("enthält trotz Kürze alle drei Pflichtbestandteile", () => {
    expect(kurz.text).toContain("steht in keiner Verbindung");
    expect(kurz.text).toContain("von jeglicher Haftung frei");
    expect(kurz.text).toContain("Alleiniger Ansprechpartner");
  });

  it("verweist auf die ausführliche Fassung", () => {
    expect(kurz.text).toContain(
      "https://beispiel.github.io/gewinnspiele/merch-verlosung.html",
    );
  });

  it("meldet, wenn der Text zu lang würde", () => {
    const viele = giveaway({
      prizes: Array.from({ length: 60 }, (_, i) => ({
        title: `Sehr ausführlich beschriebener Gewinn Nummer ${i + 1}`,
        quantity: 1,
      })),
    });
    expect(buildShortTerms(viele, WHO).fitsCaption).toBe(false);
  });
});

describe("Nachweis-Text", () => {
  const basis = {
    title: "Merch-Verlosung",
    commitHash: "a".repeat(64),
    entrantCount: 137,
    totalLots: 137,
    committedAt: new Date(Date.UTC(2026, 7, 13, 18, 5)),
  };

  it("nennt den Zeitpunkt der Veröffentlichung, sobald er feststeht", () => {
    const text = buildProofText({
      ...basis,
      commitPublishedAt: new Date(Date.UTC(2026, 7, 13, 18, 30)),
    });
    expect(text).toContain("Prüfsumme veröffentlicht:");
    // Muss vor dem Ziehungszeitpunkt stehen — das ist die Aussage.
    expect(text.indexOf("Prüfsumme veröffentlicht:")).toBeLessThan(
      text.indexOf("Prüfsumme (SHA-256)"),
    );
  });

  it("lässt die Zeile weg, solange nicht veröffentlicht wurde", () => {
    expect(buildProofText(basis)).not.toContain("Prüfsumme veröffentlicht:");
  });

  it("nennt vor der Ziehung nur die Prüfsumme", () => {
    const text = buildProofText(basis);
    expect(text).toContain("a".repeat(64));
    expect(text).toContain("137");
    expect(text).not.toContain("Zufallszahl:");
  });

  it("legt nach der Ziehung die Zufallszahl offen und erklärt das Nachrechnen", () => {
    const text = buildProofText({
      ...basis,
      seed: "b".repeat(64),
      drawnAt: new Date(Date.UTC(2026, 7, 13, 19, 0)),
      listUrl: "https://beispiel.github.io/gewinnspiele/merch-verlosung.html",
    });
    expect(text).toContain("Zufallszahl: " + "b".repeat(64));
    expect(text).toContain("nachrechnen");
    expect(text).toContain("VOR der Ziehung");
    expect(text).toContain("merch-verlosung.html");
  });
});

describe("Impressum", () => {
  const MIT: Organizer = {
    ...WHO,
    impressumUrl: "https://mein.online-impressum.de/tobisreise",
  };

  it("erscheint in den ausführlichen Bedingungen, sobald es hinterlegt ist", () => {
    expect(buildTerms(giveaway(), MIT)).toContain(
      "Impressum: https://mein.online-impressum.de/tobisreise",
    );
  });

  it("erscheint auch in der Kurzfassung für den Beitrag", () => {
    expect(buildShortTerms(giveaway(), MIT).text).toContain(
      "Impressum: https://mein.online-impressum.de/tobisreise",
    );
  });

  // Für eine rein private Verlosung gilt die Pflicht nicht — das Tool
  // erfindet dann auch keine Zeile.
  it("fehlt vollständig, wenn keines hinterlegt ist", () => {
    expect(buildTerms(giveaway(), WHO)).not.toContain("Impressum");
    expect(buildShortTerms(giveaway(), WHO).text).not.toContain("Impressum");
  });

  it("sprengt die Bildunterschrift nicht", () => {
    expect(buildShortTerms(giveaway(), MIT).length).toBeLessThanOrEqual(
      CAPTION_LIMIT,
    );
  });
});

describe("Eigene Bedingungen", () => {
  const eigen = giveaway({
    customTerms: "Übergabe nur vor Ort auf dem Festival\n• Versand nur innerhalb Deutschlands\n\n",
  });

  it("erscheinen als eigener Abschnitt in der Langfassung", () => {
    const text = buildTerms(eigen, WHO);
    expect(text).toContain("Weitere Bedingungen");
    expect(text).toContain("• Übergabe nur vor Ort auf dem Festival");
    expect(text).toContain("• Versand nur innerhalb Deutschlands");
  });

  // Der Pflichttext der Plattformen bleibt der Schlussstein.
  it("stehen vor dem Hinweis zu den Plattformen", () => {
    const text = buildTerms(eigen, WHO);
    expect(text.indexOf("Weitere Bedingungen")).toBeLessThan(
      text.indexOf("Hinweis zu den Plattformen"),
    );
  });

  it("kommen auch in die Kurzfassung", () => {
    expect(buildShortTerms(eigen, WHO).text).toContain("• Übergabe nur vor Ort");
  });

  it("räumen leere Zeilen und doppelte Aufzählungszeichen weg", () => {
    expect(buildTerms(eigen, WHO)).not.toContain("• • ");
  });

  it("erzeugen ohne Eingabe keinen leeren Abschnitt", () => {
    expect(buildTerms(giveaway(), WHO)).not.toContain("Weitere Bedingungen");
  });
});
