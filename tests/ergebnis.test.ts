import { describe, expect, it } from "vitest";
import { Bedienfehler, alsErgebnis, istSteuerfluss } from "@/lib/ergebnis";
import { GitHubError } from "@/lib/github";

// Der Hintergrund: Next.js entfernt im Produktionsbau die Texte geworfener
// Ausnahmen aus Server-Aktionen. Uebrig bleibt "minified React error #441".
// Rueckgabewerte sind davon nicht betroffen — deshalb diese Umleitung.

describe("alsErgebnis", () => {
  it("reicht das Ergebnis unverändert durch", async () => {
    expect(await alsErgebnis(async () => ({ meldung: "geht" }))).toEqual({
      meldung: "geht",
    });
  });

  it("macht aus einem Bedienfehler einen Rückgabewert", async () => {
    const ergebnis = await alsErgebnis(async () => {
      throw new Bedienfehler("Trag zuerst das Repository ein.");
    });
    expect(ergebnis).toEqual({ fehler: "Trag zuerst das Repository ein." });
  });

  it("behandelt einen GitHubError genauso", async () => {
    const ergebnis = await alsErgebnis(async () => {
      throw new GitHubError("Der Zugangsschlüssel ist abgelaufen.");
    });
    expect(ergebnis).toEqual({ fehler: "Der Zugangsschlüssel ist abgelaufen." });
  });

  // Sonst bliebe der Benutzer nach dem Anmelden auf der Anmeldeseite stehen.
  it("lässt Weiterleitungen durch", async () => {
    const weiterleitung = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/admin;307;",
    });
    await expect(
      alsErgebnis(async () => {
        throw weiterleitung;
      }),
    ).rejects.toBe(weiterleitung);
  });

  // Ein Programmierfehler soll auffallen, nicht als höfliche Meldung enden.
  it("lässt unerwartete Fehler durch", async () => {
    await expect(
      alsErgebnis(async () => {
        throw new TypeError("undefined is not a function");
      }),
    ).rejects.toThrow(TypeError);
  });
});

describe("istSteuerfluss", () => {
  it("erkennt Weiterleitung und nicht-gefunden", () => {
    expect(istSteuerfluss({ digest: "NEXT_REDIRECT;push;/admin;307;" })).toBe(true);
    expect(istSteuerfluss({ digest: "NEXT_NOT_FOUND" })).toBe(true);
  });

  it("hält einen gewöhnlichen Fehler nicht dafür", () => {
    expect(istSteuerfluss(new Error("kaputt"))).toBe(false);
    expect(istSteuerfluss({ digest: 1234567 })).toBe(false);
  });
});

// Jede Fehlerklasse, die einen Text für den Betreiber trägt, muss in
// `ANZEIGBAR` stehen. Fehlt sie, ist im Produktionsbau „error #441" zurück —
// genau das ist beim Hinzufügen von Instagram passiert, und der E2E-Test hat
// es gefangen. Hier steht es billiger.
describe("Fehler fremder Schichten", () => {
  const benannt = (name: string, text: string) => {
    const e = new Error(text);
    e.name = name;
    return e;
  };

  for (const name of ["GitHubError", "InstagramError"]) {
    it(`gibt den Text von ${name} weiter`, async () => {
      const r = await alsErgebnis(async () => {
        throw benannt(name, "Der Zugangsschlüssel gilt nicht mehr.");
      });
      expect(r.fehler).toBe("Der Zugangsschlüssel gilt nicht mehr.");
    });
  }

  it("gibt den Text einer unbekannten Fehlerklasse nicht weiter", async () => {
    await expect(
      alsErgebnis(async () => {
        throw benannt("DatenbankError", "SQLITE_CONSTRAINT: users.email");
      }),
    ).rejects.toThrow(/SQLITE_CONSTRAINT/);
  });
});
