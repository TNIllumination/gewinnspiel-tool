import { describe, expect, it } from "vitest";
import { TAG_MS, faelligkeit } from "@/lib/aufbewahrung";

const JETZT = new Date("2026-08-10T12:00:00Z").getTime();
const vorTagen = (n: number) => new Date(JETZT - n * TAG_MS);

describe("faelligkeit", () => {
  it("meldet nichts, solange die Frist laeuft", () => {
    expect(
      faelligkeit({ entries: 100, gezogen: 3, ab: vorTagen(10), retentionDays: 30 }, JETZT),
    ).toBeNull();
  });

  it("meldet am letzten Tag der Frist noch nichts", () => {
    expect(
      faelligkeit({ entries: 100, gezogen: 3, ab: vorTagen(29), retentionDays: 30 }, JETZT),
    ).toBeNull();
  });

  it("meldet, sobald die Frist erreicht ist", () => {
    expect(
      faelligkeit({ entries: 100, gezogen: 3, ab: vorTagen(30), retentionDays: 30 }, JETZT),
    ).toEqual({ loeschbar: 97, ueberfaellig: 0 });
  });

  it("zaehlt die Tage der Ueberschreitung", () => {
    const f = faelligkeit(
      { entries: 10, gezogen: 0, ab: vorTagen(37), retentionDays: 30 },
      JETZT,
    );
    expect(f?.ueberfaellig).toBe(7);
  });

  // Gezogene Teilnahmen bleiben stehen. Zaehlte man sie mit, meldete das
  // Dashboard nach dem Loeschen unveraendert weiter — eine Warnung, die man
  // nicht abstellen kann, lernt man zu uebersehen.
  it("zaehlt nur die loeschbaren Teilnahmen", () => {
    const f = faelligkeit(
      { entries: 250, gezogen: 6, ab: vorTagen(60), retentionDays: 30 },
      JETZT,
    );
    expect(f?.loeschbar).toBe(244);
  });

  it("schweigt, wenn nur noch Gezogene uebrig sind", () => {
    expect(
      faelligkeit({ entries: 6, gezogen: 6, ab: vorTagen(60), retentionDays: 30 }, JETZT),
    ).toBeNull();
  });

  it("schweigt bei einem Gewinnspiel ganz ohne Teilnahmen", () => {
    expect(
      faelligkeit({ entries: 0, gezogen: 0, ab: vorTagen(99), retentionDays: 30 }, JETZT),
    ).toBeNull();
  });

  // Frist 0 heisst „sofort" — das braucht man zum Ausprobieren, und es darf
  // nicht erst am naechsten Tag greifen.
  it("ist bei Frist 0 sofort faellig", () => {
    expect(
      faelligkeit(
        { entries: 5, gezogen: 0, ab: new Date(JETZT - 60 * 1000), retentionDays: 0 },
        JETZT,
      ),
    ).toEqual({ loeschbar: 5, ueberfaellig: 0 });
  });
});
