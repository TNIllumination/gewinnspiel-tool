import { describe, expect, it } from "vitest";
import {
  containsText,
  extractMentions,
  graphemeLength,
  sameUser,
} from "@/rules/text";

describe("containsText — deutsche Schreibweisen", () => {
  it("erkennt Umlaute in beiden Schreibweisen", () => {
    // Wer "Grüße" schreibt, erfuellt eine Regel auf "gruesse" wie auf "grusse".
    expect(containsText("Liebe Grüße!", "gruesse")).toBe(true);
    expect(containsText("Liebe Grüße!", "grusse")).toBe(true);
    expect(containsText("Liebe Grüße!", "Grüße")).toBe(true);

    // Und umgekehrt.
    expect(containsText("Liebe Gruesse!", "grüße")).toBe(true);
    expect(containsText("Liebe Grusse!", "grüße")).toBe(true);
  });

  it("behandelt ß und ss gleich", () => {
    expect(containsText("Ich bin dabei, Spaß!", "spass")).toBe(true);
    expect(containsText("Ich bin dabei, Spass!", "Spaß")).toBe(true);
  });

  it("ignoriert Gross-/Kleinschreibung", () => {
    expect(containsText("ICH BIN DABEI", "dabei")).toBe(true);
  });

  it("laesst sich nicht mit unsichtbaren Zeichen austricksen", () => {
    // Zero-Width Space mitten im Wort — fuer Menschen unsichtbar.
    expect(containsText("da\u200Bbei", "dabei")).toBe(true);
  });

  it("meldet fehlende Woerter als nicht enthalten", () => {
    expect(containsText("Schönes Gewinnspiel", "dabei")).toBe(false);
  });

  it("behandelt ein leeres Suchwort als erfuellt", () => {
    expect(containsText("egal", "  ")).toBe(true);
  });
});

describe("extractMentions", () => {
  it("findet Erwaehnungen und entfernt Duplikate", () => {
    expect(extractMentions("@anna @ben @anna schaut mal")).toEqual([
      "anna",
      "ben",
    ]);
  });

  it("nimmt Satzzeichen am Ende nicht in den Handle auf", () => {
    expect(extractMentions("Hey @anna.")).toEqual(["anna"]);
  });

  it("erlaubt Punkte und Unterstriche im Handle", () => {
    expect(extractMentions("@max_mustermann @a.b.c")).toEqual([
      "max_mustermann",
      "a.b.c",
    ]);
  });

  it("liefert nichts, wenn niemand markiert wurde", () => {
    expect(extractMentions("Tolle Aktion!")).toEqual([]);
  });
});

describe("sameUser", () => {
  it("ignoriert @ und Gross-/Kleinschreibung", () => {
    expect(sameUser("@Anna", "anna")).toBe(true);
    expect(sameUser("anna", "ben")).toBe(false);
  });
});

describe("graphemeLength", () => {
  it("zaehlt Emojis als ein Zeichen", () => {
    expect(graphemeLength("ok😀")).toBe(3);
  });
});
