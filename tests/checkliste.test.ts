import { describe, expect, it } from "vitest";
import { BAUZEIT_MS, seit, stand, type Stufe } from "@/lib/checkliste";

const JETZT = new Date("2026-08-10T21:04:00Z").getTime();
const vorSekunden = (n: number) => new Date(JETZT - n * 1000);

/// Die drei Stufen der Detailseite. `gezogen` entscheidet, ob der Nachweis
/// schon an der Reihe ist — vor der Ziehung ist er es nie.
const stufen = (
  am: (string | null)[] = [],
  gezogen = false,
): Stufe[] => [
  { titel: "Teilnahmebedingungen veröffentlicht", am: am[0] ?? null, inhalt: "…" },
  { titel: "Prüfsumme veröffentlicht", am: am[1] ?? null, inhalt: "…" },
  {
    titel: "Nachweis mit Gewinnern veröffentlicht",
    am: am[2] ?? null,
    inhalt: "…",
    spaeter: !gezogen,
  },
];

describe("stand", () => {
  it("nennt die erste offene Stufe als Nächstes", () => {
    expect(stand(stufen(), null, JETZT).naechste?.titel).toBe(
      "Teilnahmebedingungen veröffentlicht",
    );
  });

  it("überspringt Stufen, die noch nicht an der Reihe sind", () => {
    // Bedingungen und Prüfsumme sind raus, der Nachweis kommt erst nach der
    // Ziehung — dann steht nichts an, statt „Nachweis" zu drängeln.
    const s = stufen(["2026-08-10T20:00:00Z", "2026-08-10T20:30:00Z"]);
    expect(stand(s, null, JETZT).naechste).toBeNull();
  });

  it("drängelt nach der Ziehung zum Nachweis", () => {
    const s = stufen(["2026-08-10T20:00:00Z", "2026-08-10T20:30:00Z"], true);
    expect(stand(s, null, JETZT).naechste?.titel).toBe(
      "Nachweis mit Gewinnern veröffentlicht",
    );
  });

  it("unterscheidet erzeugt von hochgeladen", () => {
    const s = stufen(["2026-08-10T20:00:00Z"]);
    expect(stand(s, null, JETZT).nurErzeugt).toBe(true);
    expect(stand(s, vorSekunden(10), JETZT).nurErzeugt).toBe(false);
  });

  it("meldet nichts als erzeugt, solange nichts veröffentlicht wurde", () => {
    expect(stand(stufen(), null, JETZT).nurErzeugt).toBe(false);
  });

  it("warnt vor dem zweiten Druck, solange Pages baut", () => {
    expect(stand(stufen(), vorSekunden(12), JETZT).baut).toBe(true);
  });

  it("hört mit der Warnung auf, sobald die Bauzeit vorbei ist", () => {
    const alt = new Date(JETZT - BAUZEIT_MS - 1);
    expect(stand(stufen(), alt, JETZT).baut).toBe(false);
  });

  // Auf dem Server gibt es keine Uhr — sonst wichen Server- und Browserfassung
  // voneinander ab und React meldete einen Hydrationsfehler.
  it("warnt ohne Uhr nicht", () => {
    expect(stand(stufen(), vorSekunden(12), null).baut).toBe(false);
  });
});

describe("seit", () => {
  it("zählt Sekunden im Singular und Plural", () => {
    expect(seit(vorSekunden(1), JETZT)).toBe("vor 1 Sekunde");
    expect(seit(vorSekunden(12), JETZT)).toBe("vor 12 Sekunden");
  });

  it("geht auf Minuten, Stunden und Tage über", () => {
    expect(seit(vorSekunden(90), JETZT)).toBe("vor 2 Minuten");
    expect(seit(vorSekunden(3 * 3600), JETZT)).toBe("vor 3 Stunden");
    expect(seit(vorSekunden(50 * 3600), JETZT)).toBe("vor 2 Tagen");
  });

  // Eine leicht nachlaufende Uhr darf nicht „vor -1 Sekunden" ergeben.
  it("wird bei Zeitpunkten in der Zukunft nicht negativ", () => {
    expect(seit(new Date(JETZT + 5000), JETZT)).toBe("vor 0 Sekunden");
  });
});
