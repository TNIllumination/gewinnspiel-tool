import { describe, expect, it } from "vitest";
import {
  hasUnfillableSlot,
  isSettled,
  prizeIdForSlot,
  resolveWinners,
  type Candidate,
} from "@/draw/promotion";

/// Drei Gewinne, zwei Nachrücker — die typische Festival-Verlosung.
function gezogen(...stati: string[]): Candidate[] {
  return stati.map((status, rank) => ({ id: `k${rank}`, rank, status }));
}

describe("Gewinnplätze verteilen", () => {
  it("besetzt die Plätze in gezogener Reihenfolge", () => {
    const { winners, reserves } = resolveWinners(
      gezogen("PENDING", "PENDING", "PENDING", "PENDING", "PENDING"),
      3,
    );

    expect(winners.map((w) => w.candidate?.id)).toEqual(["k0", "k1", "k2"]);
    expect(winners.every((w) => !w.promoted)).toBe(true);
    expect(reserves.map((r) => r.id)).toEqual(["k3", "k4"]);
  });

  it("lässt den Nachrücker GENAU den Platz des Abgelehnten erben", () => {
    // Das ist der Kern: Fällt der erste Platz durch, rückt der nächste auf
    // den ERSTEN Platz — und bekommt damit den Hauptgewinn, nicht den letzten.
    const { winners } = resolveWinners(
      gezogen("REJECTED", "PENDING", "PENDING", "PENDING", "PENDING"),
      3,
    );

    expect(winners[0].candidate?.id).toBe("k1");
    expect(winners[0].promoted).toBe(true);
    expect(winners[1].candidate?.id).toBe("k2");
    expect(winners[2].candidate?.id).toBe("k3");
  });

  it("verkraftet mehrere Ablehnungen hintereinander", () => {
    const { winners, reserves } = resolveWinners(
      gezogen("REJECTED", "REJECTED", "PENDING", "PENDING", "PENDING"),
      3,
    );

    expect(winners.map((w) => w.candidate?.id)).toEqual(["k2", "k3", "k4"]);
    expect(reserves).toEqual([]);
  });

  it("verkraftet eine Ablehnung in der Mitte", () => {
    const { winners } = resolveWinners(
      gezogen("CONFIRMED", "REJECTED", "PENDING", "PENDING"),
      3,
    );

    expect(winners.map((w) => w.candidate?.id)).toEqual(["k0", "k2", "k3"]);
    expect(winners[0].promoted).toBe(false);
    expect(winners[1].promoted).toBe(true);
  });

  it("lässt einen Platz leer, wenn die Nachrücker ausgehen", () => {
    const resolved = resolveWinners(
      gezogen("REJECTED", "REJECTED", "REJECTED", "PENDING"),
      3,
    );

    expect(resolved.winners[0].candidate?.id).toBe("k3");
    expect(resolved.winners[1].candidate).toBeNull();
    expect(resolved.winners[2].candidate).toBeNull();
    expect(hasUnfillableSlot(resolved)).toBe(true);
  });

  it("kommt mit einem einzigen Gewinn klar", () => {
    const { winners, reserves } = resolveWinners(
      gezogen("PENDING", "PENDING", "PENDING"),
      1,
    );
    expect(winners).toHaveLength(1);
    expect(reserves).toHaveLength(2);
  });

  it("verlässt sich nicht auf die Eingabereihenfolge", () => {
    const durcheinander: Candidate[] = [
      { id: "k2", rank: 2, status: "PENDING" },
      { id: "k0", rank: 0, status: "REJECTED" },
      { id: "k1", rank: 1, status: "PENDING" },
    ];
    const { winners } = resolveWinners(durcheinander, 2);
    expect(winners.map((w) => w.candidate?.id)).toEqual(["k1", "k2"]);
  });
});

describe("Der Gewinn gehört zum Platz, nicht zur Person", () => {
  // Dieser Fehler fiel erst im Praxistest auf: Der Nachrücker behielt den
  // Gewinn, der bei der Ziehung zufällig an SEINEM Rang hing — stand also
  // auf Platz 1 und bekam trotzdem den zweiten Preis.
  const gezogenMitPreisen = [
    { id: "k0", rank: 0, status: "REJECTED", prizeId: "shirt" },
    { id: "k1", rank: 1, status: "PENDING", prizeId: "cap" },
    { id: "k2", rank: 2, status: "PENDING", prizeId: "sticker" },
    { id: "k3", rank: 3, status: "PENDING", prizeId: null },
  ];

  it("gibt dem Nachrücker auf Platz 1 den Hauptgewinn", () => {
    const { winners } = resolveWinners(gezogenMitPreisen, 3);

    expect(winners[0].candidate?.id).toBe("k1");
    // Entscheidend: nicht "cap", obwohl k1 selbst mit "cap" gezogen wurde.
    expect(prizeIdForSlot(gezogenMitPreisen, 0)).toBe("shirt");
  });

  it("hält die übrigen Plätze bei ihren Gewinnen", () => {
    expect(prizeIdForSlot(gezogenMitPreisen, 1)).toBe("cap");
    expect(prizeIdForSlot(gezogenMitPreisen, 2)).toBe("sticker");
  });

  it("liefert für Nachrückerplätze keinen Gewinn", () => {
    expect(prizeIdForSlot(gezogenMitPreisen, 3)).toBeNull();
    expect(prizeIdForSlot(gezogenMitPreisen, 99)).toBeNull();
  });
});

describe("Abschluss erkennen", () => {
  it("gilt erst als fertig, wenn jeder Platz bestätigt ist", () => {
    expect(isSettled(resolveWinners(gezogen("CONFIRMED", "PENDING"), 2))).toBe(false);
    expect(isSettled(resolveWinners(gezogen("CONFIRMED", "CONFIRMED"), 2))).toBe(true);
  });

  it("gilt nicht als fertig, wenn ein Platz leer bleibt", () => {
    expect(isSettled(resolveWinners(gezogen("REJECTED"), 1))).toBe(false);
  });
});
