import { describe, expect, it } from "vitest";
import { parseManualImport } from "@/platforms/manual-import";
import { generateSandboxComments } from "@/platforms/sandbox";
import { evaluateEntries } from "@/rules/engine";

const FALLBACK = new Date(Date.UTC(2026, 0, 10, 12, 0, 0));

describe("Import: CSV", () => {
  it("liest Semikolon-CSV mit deutscher Kopfzeile", () => {
    const r = parseManualImport(
      [
        "Benutzer;Kommentar;Datum",
        "anna;Ich bin dabei @ben;24.12.2026 18:30",
        "@ben;Auch dabei;25.12.2026",
      ].join("\n"),
      FALLBACK,
    );

    expect(r.format).toBe("csv");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[0].username).toBe("anna");
    expect(r.comments[1].username).toBe("ben"); // @ entfernt
    expect(r.comments[0].commentedAt.toISOString()).toBe("2026-12-24T18:30:00.000Z");
  });

  it("kommt mit Anfuehrungszeichen und Kommas im Text klar", () => {
    const r = parseManualImport(
      ['username,text', 'anna,"Ich bin dabei, klar! ""super"""'].join("\n"),
      FALLBACK,
    );
    expect(r.comments[0].text).toBe('Ich bin dabei, klar! "super"');
  });

  it("meldet unvollstaendige Zeilen, statt sie stillschweigend zu schlucken", () => {
    const r = parseManualImport(
      ["username;text", "anna;dabei", ";kein name", "ben;"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.warnings).toHaveLength(2);
    expect(r.warnings[0]).toContain("Zeile 3");
  });

  it("nimmt den Importzeitpunkt, wenn das Datum unverstaendlich ist", () => {
    const r = parseManualImport(
      ["username;text;datum", "anna;dabei;irgendwann"].join("\n"),
      FALLBACK,
    );
    expect(r.comments[0].commentedAt).toEqual(FALLBACK);
    expect(r.warnings[0]).toContain("nicht verstanden");
  });
});

describe("Import: Name-Doppelpunkt-Text", () => {
  it("erkennt das Zeilenformat", () => {
    const r = parseManualImport(
      ["@anna: Ich bin dabei @ben", "ben: Auch dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.format).toBe("inline");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[0].username).toBe("anna");
    expect(r.comments[0].text).toBe("Ich bin dabei @ben");
  });

  it("haelt die Reihenfolge der Zeilen als Reihenfolge der Kommentare", () => {
    const r = parseManualImport(["a: erster", "b: zweiter"].join("\n"), FALLBACK);
    expect(r.comments[0].commentedAt.getTime()).toBeLessThan(
      r.comments[1].commentedAt.getTime(),
    );
  });
});

describe("Import: Blöcke (TikTok-Copy-Paste)", () => {
  it("paart Name und Text", () => {
    const r = parseManualImport(
      ["@anna", "Ich bin dabei", "@ben", "Auch dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.format).toBe("blocks");
    expect(r.comments).toHaveLength(2);
    expect(r.comments[1]).toMatchObject({ username: "ben", text: "Auch dabei" });
  });

  it("überlebt echtes TikTok-Copy-Paste mit Datum, Antworten und Like-Zahlen", () => {
    // So sieht ein Ausschnitt aus der TikTok-Weboberfläche wirklich aus.
    const paste = [
      "anna_berg",
      "Ich bin dabei @ben @carla",
      "2026-1-15",
      "Antworten",
      "12",
      "ben_wald",
      "Mega, ich bin dabei @anna @dora",
      "vor 2 Tagen",
      "Antworten",
      "1.2k",
      "Alle 3 Antworten anzeigen",
      "carla_stein",
      "Bin dabei @ben @anna",
      "3d",
      "Antworten",
      "5",
    ].join("\n");

    const r = parseManualImport(paste, FALLBACK);

    expect(r.comments).toHaveLength(3);
    expect(r.comments.map((c) => c.username)).toEqual([
      "anna_berg",
      "ben_wald",
      "carla_stein",
    ]);
    // Entscheidend: die Like-Zahl "12" darf kein Teilnehmer geworden sein.
    expect(r.comments.map((c) => c.username)).not.toContain("12");
    expect(r.comments[1].text).toBe("Mega, ich bin dabei @anna @dora");
  });

  it("hält mehrzeilige Kommentare zusammen", () => {
    const r = parseManualImport(
      ["anna_berg", "Ich bin dabei", "und drücke die Daumen @ben @carla", "Antworten", "3"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.comments[0].text).toBe("Ich bin dabei und drücke die Daumen @ben @carla");
  });

  it("meldet Text ohne vorangehenden Namen", () => {
    const r = parseManualImport(
      ["Kommentare (243)", "anna_berg", "Ich bin dabei"].join("\n"),
      FALLBACK,
    );
    expect(r.comments).toHaveLength(1);
    expect(r.warnings[0]).toContain("kein Benutzername");
  });
});

describe("Import: Randfaelle", () => {
  it("behandelt leere Eingabe", () => {
    const r = parseManualImport("   ", FALLBACK);
    expect(r.format).toBe("leer");
    expect(r.comments).toEqual([]);
  });
});

describe("Testmodus", () => {
  it("ist bei gleichem Seed reproduzierbar", () => {
    const a = generateSandboxComments({ count: 50, seed: "x" });
    const b = generateSandboxComments({ count: 50, seed: "x" });
    expect(a.map((c) => c.username)).toEqual(b.map((c) => c.username));
  });

  it("erzeugt gueltige und ungueltige Teilnahmen", () => {
    // Die Regeln muessen mit — sonst prueft man gegen Bedingungen, von denen
    // der Testmodus nichts weiss, und alles faellt durch.
    const comments = generateSandboxComments({
      count: 300,
      seed: "demo",
      regeln: { keywords: ["dabei"], mentionsMin: 2 },
    });
    const summary = evaluateEntries(comments, [
      { type: "KEYWORD", config: { keywords: ["dabei"] } },
      { type: "MENTIONS", config: { min: 2 } },
      { type: "DEDUPE", config: { mode: "one_per_user" } },
    ]);

    // Beide Seiten muessen vorkommen, sonst taugt der Testmodus nichts.
    expect(summary.validCount).toBeGreaterThan(0);
    expect(summary.rejectedCount).toBeGreaterThan(0);
    expect(summary.validCount + summary.rejectedCount).toBe(300);
  });
});

// Nachgebaut aus zwei echten Kopien, aber mit erfundenen Namen und Texten —
// die Vorlagen enthielten Daten echter Personen. Alle vier Sonderfaelle, die
// dort vorkamen, sind hier abgebildet.

describe("TikTok-Kopie: der Name steht doppelt", () => {
  const PASTE = [
    "AnnaBerg", "AnnaBerg", "ganz liebe Grüße, war wunderbar", "Jul 28, 2026", "19", "View 2 replies",
    "Bob.Metal", "Bob.Metal", "Rockharz!", "Jul 29, 2026", "1",
    "Alex M.", "Alex M.", "Mehrzeilig geht auch", "und die zweite Zeile", "Jul 30, 2026", "8", "View 1 reply",
  ].join("\n");

  const r = parseManualImport(PASTE);

  it("erkennt das Format", () => {
    expect(r.format).toBe("tiktok");
  });

  it("liest Name, Text und Likes richtig", () => {
    expect(r.comments).toHaveLength(3);
    expect(r.comments[0].username).toBe("AnnaBerg");
    expect(r.comments[0].text).toBe("ganz liebe Grüße, war wunderbar");
    expect(r.comments[0].likeCount).toBe(19);
  });

  it("übernimmt das echte Datum statt des Einfügezeitpunkts", () => {
    expect(r.comments[0].commentedAt.getFullYear()).toBe(2026);
    expect(r.comments[0].commentedAt.getMonth()).toBe(6); // Juli
    expect(r.comments[0].commentedAt.getDate()).toBe(28);
  });

  it("verschluckt weder Datum, Likes noch „View … replies“", () => {
    const alles = r.comments.map((c) => `${c.username}|${c.text}`).join(" ");
    expect(alles).not.toMatch(/View \d+ repl/);
    expect(alles).not.toMatch(/Jul \d+, 2026/);
    expect(alles).not.toMatch(/\|19$/);
  });

  it("hält mehrzeilige Kommentare zusammen", () => {
    expect(r.comments[2].text).toBe("Mehrzeilig geht auch und die zweite Zeile");
  });

  // Kam echt vor: ein Kommentar ganz ohne Text. Feste Zeilenabstaende haetten
  // hier das Datum als Kommentar gelesen.
  it("überspringt Blöcke ohne Text und meldet es", () => {
    const ohne = parseManualImport(
      ["Erik", "Erik", "Jul 29, 2026", "1", "View 1 reply",
       "Frida", "Frida", "Bin dabei", "Jul 29, 2026", "2",
       "Gustav", "Gustav", "Auch dabei", "Jul 29, 2026", "3"].join("\n"),
    );
    expect(ohne.comments.map((c) => c.username)).toEqual(["Frida", "Gustav"]);
    expect(ohne.warnings.join(" ")).toMatch(/Erik.*kein Kommentartext/);
  });

  it("nimmt einen abgeschnittenen letzten Block trotzdem mit", () => {
    const kurz = parseManualImport(
      ["Anna", "Anna", "Erster", "Jul 29, 2026", "1",
       "Bob", "Bob", "Zweiter", "Jul 29, 2026", "2",
       "Carla", "Carla", "Abgeschnitten"].join("\n"),
    );
    expect(kurz.comments).toHaveLength(3);
    expect(kurz.comments[2].text).toBe("Abgeschnitten");
  });
});

describe("Instagram-Kopie: Profilbild-Zeile vor dem Namen", () => {
  const PASTE = [
    "anna.bergs Profilbild", "anna.berg", "", "2 Tage", "Beste Crew, immer top",
    "bob_metals Profilbild", "bob_metal", "", "1 Wo.", "Mega Job, danke.",
    "carla99s Profilbild", "carla99", "", "3 Tage",
    "Erste Zeile des Kommentars", "und noch eine zweite",
  ].join("\n");

  const r = parseManualImport(PASTE);

  it("erkennt das Format", () => {
    expect(r.format).toBe("instagram");
  });

  it("nimmt den Namen ohne das angehängte „s“", () => {
    expect(r.comments.map((c) => c.username)).toEqual(["anna.berg", "bob_metal", "carla99"]);
  });

  it("macht aus der Profilbild-Zeile keinen Teilnehmer", () => {
    expect(r.comments.some((c) => /Profilbild/.test(c.username + c.text))).toBe(false);
  });

  it("hält mehrzeilige Kommentare zusammen", () => {
    expect(r.comments[2].text).toBe("Erste Zeile des Kommentars und noch eine zweite");
  });

  it("rechnet die Altersangabe in einen Zeitpunkt um", () => {
    const abstand = r.comments[0].commentedAt.getTime();
    const zweiTage = Date.now() - 2 * 24 * 60 * 60 * 1000;
    expect(Math.abs(abstand - zweiTage)).toBeLessThan(60_000);
    // „1 Wo." liegt weiter zurück als „2 Tage".
    expect(r.comments[1].commentedAt.getTime()).toBeLessThan(abstand);
  });

  // Kam echt vor: bearbeitete Kommentare haengen einen Zusatz an.
  it("versteht „1 Wo. · Bearbeitet“ als Altersangabe, nicht als Text", () => {
    const bearbeitet = parseManualImport(
      ["as Profilbild", "a", "1 Wo. · Bearbeitet", "Mein Text",
       "bs Profilbild", "b", "2 Tage", "Anderer Text"].join("\n"),
    );
    expect(bearbeitet.comments[0].text).toBe("Mein Text");
  });

  it("überspringt Einträge ohne Text und meldet es", () => {
    const leer = parseManualImport(
      ["as Profilbild", "a", "",
       "bs Profilbild", "b", "", "2 Tage", "Hat Text",
       "cs Profilbild", "c", "", "3 Tage", "Auch Text"].join("\n"),
    );
    expect(leer.comments.map((c) => c.username)).toEqual(["b", "c"]);
    expect(leer.warnings.join(" ")).toMatch(/kein Kommentartext/);
  });
});

describe("Die Erkennung greift nicht zu früh", () => {
  it("lässt einen gewöhnlichen Block-Paste in Ruhe", () => {
    const r = parseManualImport(["anna", "Ich bin dabei", "ben", "Bin dabei"].join("\n"));
    expect(r.format).toBe("blocks");
  });

  it("lässt „Name: Text“ in Ruhe", () => {
    expect(parseManualImport("@anna: dabei\n@ben: auch").format).toBe("inline");
  });
});
