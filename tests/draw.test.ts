import { describe, expect, it } from "vitest";
import {
  canonicalize,
  commit,
  draw,
  hashCommitment,
  verifyDraw,
  type Entrant,
} from "@/draw/commit-reveal";
import { SeededRandom } from "@/draw/random";

function pool(count: number, lots = 1): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    username: `user${String(i).padStart(3, "0")}`,
    lots,
    ref: `c-${i}`,
  }));
}

describe("SeededRandom", () => {
  it("liefert bei gleichem Seed dieselbe Folge", () => {
    const a = new SeededRandom("seed-1");
    const b = new SeededRandom("seed-1");
    const seqA = Array.from({ length: 50 }, () => a.nextBelow(1000));
    const seqB = Array.from({ length: 50 }, () => b.nextBelow(1000));
    expect(seqA).toEqual(seqB);
  });

  it("liefert bei anderem Seed eine andere Folge", () => {
    const a = new SeededRandom("seed-1");
    const b = new SeededRandom("seed-2");
    const seqA = Array.from({ length: 50 }, () => a.nextBelow(1000));
    const seqB = Array.from({ length: 50 }, () => b.nextBelow(1000));
    expect(seqA).not.toEqual(seqB);
  });

  it("bleibt im gueltigen Bereich", () => {
    const rng = new SeededRandom("x");
    for (let i = 0; i < 500; i++) {
      const v = rng.nextBelow(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });

  it("streut halbwegs gleichmaessig", () => {
    const rng = new SeededRandom("verteilung");
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20_000; i++) buckets[rng.nextBelow(10)] += 1;
    // Bei Gleichverteilung ~2000 je Feld. Grosszuegige Schranke,
    // die echte Schieflagen trotzdem auffliegen laesst.
    for (const b of buckets) {
      expect(b).toBeGreaterThan(1700);
      expect(b).toBeLessThan(2300);
    }
  });
});

describe("Commit", () => {
  it("erzeugt eine von der Reihenfolge unabhaengige Liste", () => {
    const a = pool(5);
    const b = [...a].reverse();
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("aendert den Hash, sobald jemand hinzukommt", () => {
    const base = pool(5);
    const seed = "fester-seed";
    const before = hashCommitment(canonicalize(base), seed);
    const after = hashCommitment(
      canonicalize([...base, { id: "x", username: "spaet", lots: 1, ref: "c-x" }]),
      seed,
    );
    expect(before).not.toBe(after);
  });

  it("zaehlt Teilnehmer und Lose", () => {
    const c = commit(pool(4, 3));
    expect(c.entrantCount).toBe(4);
    expect(c.totalLots).toBe(12);
    expect(c.commitHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("lehnt eine leere Teilnehmerliste ab", () => {
    expect(() => commit([])).toThrow(/keine gültigen Teilnahmen/);
  });

  it("lehnt ungueltige Losanzahlen ab", () => {
    expect(() =>
      commit([{ id: "1", username: "anna", lots: 0, ref: "c1" }]),
    ).toThrow(/Losanzahl/);
  });
});

describe("Ziehung", () => {
  it("ist mit gleichem Seed reproduzierbar", () => {
    const entrants = pool(100);
    const first = draw(entrants, "seed-abc", 6);
    const second = draw(entrants, "seed-abc", 6);
    expect(first.winners.map((w) => w.ref)).toEqual(
      second.winners.map((w) => w.ref),
    );
  });

  it("haengt nicht von der Eingabereihenfolge ab", () => {
    const entrants = pool(50);
    const shuffled = [...entrants].reverse();
    expect(draw(entrants, "s", 5).winners.map((w) => w.ref)).toEqual(
      draw(shuffled, "s", 5).winners.map((w) => w.ref),
    );
  });

  it("zieht niemanden zweimal", () => {
    const winners = draw(pool(30), "seed", 10).winners;
    expect(new Set(winners.map((w) => w.id)).size).toBe(10);
  });

  it("zieht hoechstens so viele, wie teilnehmen", () => {
    expect(draw(pool(3), "seed", 10).winners).toHaveLength(3);
  });

  it("gewichtet nach Losen", () => {
    // Ein Teilnehmer mit 90 Losen gegen neun mit je 1 Los.
    const entrants: Entrant[] = [
      { id: "fav", username: "favorit", lots: 90, ref: "c-fav" },
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `n${i}`,
        username: `normal${i}`,
        lots: 1,
        ref: `c-n${i}`,
      })),
    ];

    let favWins = 0;
    const runs = 2000;
    for (let i = 0; i < runs; i++) {
      if (draw(entrants, `seed-${i}`, 1).winners[0].id === "fav") favWins += 1;
    }
    // Erwartung 90/99 ≈ 91 %.
    expect(favWins / runs).toBeGreaterThan(0.85);
    expect(favWins / runs).toBeLessThan(0.96);
  });

  it("zieht bei gleichen Losen ungefaehr gleich haeufig", () => {
    const entrants = pool(4);
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const id = draw(entrants, `s-${i}`, 1).winners[0].id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const id of entrants.map((e) => e.id)) {
      const c = counts.get(id) ?? 0;
      expect(c).toBeGreaterThan(850); // Erwartung 1000
      expect(c).toBeLessThan(1150);
    }
  });
});

describe("Nachpruefung", () => {
  it("bestaetigt eine saubere Ziehung", () => {
    const entrants = pool(20);
    const c = commit(entrants);
    const result = draw(entrants, c.seed, 3);

    expect(
      verifyDraw(
        entrants,
        c.seed,
        c.commitHash,
        result.winners.map((w) => w.ref),
      ),
    ).toEqual({ ok: true });
  });

  it("entlarvt eine nachtraeglich veraenderte Teilnehmerliste", () => {
    const entrants = pool(20);
    const c = commit(entrants);
    const result = draw(entrants, c.seed, 3);

    const manipuliert = [
      ...entrants,
      { id: "cheat", username: "kumpel", lots: 50, ref: "c-cheat" },
    ];

    const check = verifyDraw(
      manipuliert,
      c.seed,
      c.commitHash,
      result.winners.map((w) => w.ref),
    );
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("verändert");
  });

  it("entlarvt ein vorgetaeuschtes Ergebnis", () => {
    const entrants = pool(20);
    const c = commit(entrants);

    const check = verifyDraw(entrants, c.seed, c.commitHash, ["c-0", "c-1", "c-2"]);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("reproduzieren");
  });
});
