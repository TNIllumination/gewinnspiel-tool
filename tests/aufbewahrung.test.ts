import { describe, expect, it } from "vitest";
import { TAG_MS, faelligkeit, tokenFrist } from "@/lib/aufbewahrung";

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

describe("tokenFrist", () => {
  const inTagen = (n: number) => new Date(JETZT + n * TAG_MS);

  it("schweigt ohne hinterlegten Schlüssel", () => {
    expect(tokenFrist(null, JETZT)).toBeNull();
  });

  it("schweigt, solange reichlich Zeit ist", () => {
    expect(tokenFrist(inTagen(45), JETZT)).toEqual({
      tage: 45,
      abgelaufen: false,
      warnen: false,
    });
  });

  it("warnt ab zwei Wochen Restlaufzeit", () => {
    expect(tokenFrist(inTagen(15), JETZT)?.warnen).toBe(false);
    expect(tokenFrist(inTagen(14), JETZT)?.warnen).toBe(true);
  });

  // Ein abgelaufener Schluessel darf nicht als „noch 0 Tage" durchgehen —
  // das liest sich wie „heute noch".
  it("meldet einen abgelaufenen Schlüssel als abgelaufen", () => {
    const stand = tokenFrist(inTagen(-3), JETZT);
    expect(stand?.abgelaufen).toBe(true);
    expect(stand?.tage).toBe(-3);
    expect(stand?.warnen).toBe(true);
  });

  // Aufrunden statt abschneiden: Ein halber Tag Rest ist „1 Tag", nicht „0".
  it("rundet angebrochene Tage auf", () => {
    expect(tokenFrist(new Date(JETZT + TAG_MS / 2), JETZT)?.tage).toBe(1);
  });
});
