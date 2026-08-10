import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { commit, draw } from "@/draw/commit-reveal";
import { buildPublishPage } from "@/legal/publish";

// Das Prüfprogramm ist ein **unabhängiger Nachbau** — es teilt keine Zeile mit
// src/draw. Genau das ist sein Wert: Ein Prüfer, der dieselbe Bibliothek
// benutzt wie der Geprüfte, prüft nichts.
//
// Diese Reihe hält beide aneinander. Weichen sie ab, ist einer von beiden
// falsch, und das muss auffallen, bevor es jemand von außen merkt.

const TEILNEHMER = Array.from({ length: 40 }, (_, i) => ({
  id: `e${i}`,
  username: `teilnehmer_${String(i).padStart(2, "0")}`,
  // Unterschiedliche Losanzahlen, sonst bliebe die Gewichtung ungeprüft.
  lots: (i % 3) + 1,
  ref: `c${1000 + i}`,
}));

/// Baut eine veröffentlichte Seite wie das Tool sie erzeugt.
function seite(seed: string, anzahl = 6) {
  const c = commit(TEILNEHMER, seed);
  const ergebnis = draw(TEILNEHMER, seed, anzahl);

  return {
    html: buildPublishPage({
      title: "Prüfbare Verlosung",
      terms: "Kommentiere unter dem Beitrag.",
      organizer: "Max Mustermann",
      contact: "kontakt@beispiel.de",
      draw: {
        commitHash: c.commitHash,
        entrantCount: c.entrantCount,
        totalLots: c.totalLots,
        committedAt: new Date("2026-08-01T10:00:00Z"),
        commitPublishedAt: new Date("2026-08-01T10:05:00Z"),
        seed,
        drawnAt: new Date("2026-08-02T10:00:00Z"),
        entrants: TEILNEHMER,
        winners: ergebnis.winners.slice(0, 1).map((w) => ({
          platz: 1,
          username: `@${w.username}`,
          text: "Ich bin dabei",
        })),
        reserves: ergebnis.winners.slice(1).map((w) => `@${w.username}`),
        gezogeneReihenfolge: ergebnis.winners.map((w) => `${w.username}|${w.ref}`),
      },
    }),
    ergebnis,
  };
}

/// Führt das Prüfprogramm gegen eine Datei aus.
function pruefe(html: string) {
  const dir = mkdtempSync(join(tmpdir(), "pruefen-"));
  const datei = join(dir, "seite.html");
  writeFileSync(datei, html, "utf8");

  try {
    const ausgabe = execFileSync("node", ["pruefen.mjs", datei], {
      encoding: "utf8",
    });
    return { code: 0, ausgabe };
  } catch (e) {
    const fehler = e as { status: number; stdout: string; stderr: string };
    return { code: fehler.status, ausgabe: fehler.stdout + fehler.stderr };
  }
}

describe("pruefen.mjs", () => {
  it("erklärt eine echte Ziehung für stimmig", () => {
    const { ausgabe, code } = pruefe(seite("aa11bb22cc33dd44").html);
    expect(code).toBe(0);
    expect(ausgabe).toMatch(/Prüfsumme:\s+stimmt/);
    expect(ausgabe).toMatch(/Ziehung:\s+stimmt/);
    expect(ausgabe).toMatch(/Alles stimmt/);
  });

  // Der entscheidende Gleichlauf: Nachbau und src/draw müssen für denselben
  // Seed dieselbe Reihenfolge liefern.
  it("kommt für mehrere Seeds auf dieselbe Reihenfolge wie das Tool", () => {
    for (const seed of ["00", "ff", "abcdef0123456789", "z-seed-mit-text"]) {
      const { ausgabe, code } = pruefe(seite(seed, 8).html);
      expect(code, `Seed ${seed}`).toBe(0);
      expect(ausgabe, `Seed ${seed}`).toMatch(/Ziehung:\s+stimmt/);
    }
  });

  it("erkennt eine nachträglich veränderte Teilnehmerliste", () => {
    const { html } = seite("aa11bb22cc33dd44");
    const manipuliert = html.replace("teilnehmer_07", "eingeschmuggelt");

    const { ausgabe, code } = pruefe(manipuliert);
    expect(code).toBe(1);
    expect(ausgabe).toMatch(/Prüfsumme:\s+STIMMT NICHT/);
    expect(ausgabe).toMatch(/nach der Veröffentlichung etwas verändert/);
  });

  // Der Fall, auf den es ankommt: Die Liste ist echt, aber es werden andere
  // Gewinner behauptet, als die Zufallszahl ergibt.
  it("erkennt eine vorgetäuschte Gewinnerreihenfolge", () => {
    const { html, ergebnis } = seite("aa11bb22cc33dd44");
    const echt = `<li>${ergebnis.winners[0].username}|${ergebnis.winners[0].ref}</li>`;
    const gefaelscht = `<li>teilnehmer_39|c1039</li>`;
    expect(html).toContain(echt);

    const { ausgabe, code } = pruefe(html.replace(echt, gefaelscht));
    expect(code).toBe(1);
    expect(ausgabe).toMatch(/Prüfsumme:\s+stimmt/);
    expect(ausgabe).toMatch(/Ziehung:\s+STIMMT NICHT/);
  });

  it("sagt Bescheid, wenn die Seite die Angaben gar nicht enthält", () => {
    const { ausgabe, code } = pruefe("<html><body>Nichts hier.</body></html>");
    expect(code).toBe(2);
    expect(ausgabe).toMatch(/fehlen Angaben/);
  });
});
