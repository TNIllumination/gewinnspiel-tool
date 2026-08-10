import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InstagramError,
  hinweisZuAntworten,
  holeBeitraege,
  holeKommentare,
  kuerzelAusLink,
  nichtsGeliefert,
  pruefeZugang,
  sucheBeitragPerLink,
  verlaengereToken,
  zaehleKommentare,
} from "@/platforms/instagram";

// Antwortbeispiele statt Netz. Geprüft wird, was das Tool aus einer Antwort
// macht — nicht, ob Instagram gerade erreichbar ist.

type Antwort = { ok?: boolean; status?: number; body: unknown };

function antworten(...folge: Antwort[]) {
  const aufrufe: URL[] = [];
  let i = 0;
  vi.stubGlobal("fetch", async (url: URL) => {
    aufrufe.push(new URL(url.toString()));
    const a = folge[Math.min(i, folge.length - 1)];
    i += 1;
    return {
      ok: a.ok ?? true,
      status: a.status ?? 200,
      json: async () => a.body,
    } as Response;
  });
  return aufrufe;
}

const kommentar = (id: string, username: string, text: string) => ({
  id,
  username,
  text,
  timestamp: "2026-08-01T10:00:00+0000",
  like_count: 3,
});

afterEach(() => vi.unstubAllGlobals());

describe("holeKommentare", () => {
  it("liest über mehrere Seiten hinweg vollständig und in Reihenfolge", async () => {
    antworten(
      {
        body: {
          data: [kommentar("1", "anna_berg", "Ich bin dabei")],
          paging: { cursors: { after: "CURSOR_A" }, next: "https://…" },
        },
      },
      {
        body: {
          data: [kommentar("2", "ben_wald", "Bin dabei")],
          paging: { cursors: { after: "CURSOR_B" }, next: "https://…" },
        },
      },
      // Letzte Seite: kein `next` mehr — hier muss Schluss sein.
      {
        body: {
          data: [kommentar("3", "carla_stein", "dabei")],
          paging: { cursors: { after: "CURSOR_C" } },
        },
      },
    );

    const { comments, abgeschnitten } = await holeKommentare({
      token: "T",
      mediaId: "42",
    });

    expect(comments.map((c) => c.username)).toEqual([
      "anna_berg",
      "ben_wald",
      "carla_stein",
    ]);
    expect(comments.map((c) => c.externalId)).toEqual(["1", "2", "3"]);
    expect(abgeschnitten).toBe(false);
  });

  it("blättert über den Cursor, nicht über die fertige Adresse", async () => {
    // Die `next`-Adresse traegt den Schluessel im Klartext. Wir bauen die
    // Anfrage selbst — sonst wandert er durch Umleitungen und Protokolle.
    const aufrufe = antworten(
      {
        body: {
          data: [kommentar("1", "anna_berg", "dabei")],
          paging: { cursors: { after: "CURSOR_A" }, next: "https://boese.example/?x=1" },
        },
      },
      { body: { data: [kommentar("2", "ben_wald", "dabei")], paging: {} } },
    );

    await holeKommentare({ token: "T", mediaId: "42" });

    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1].host).toBe("graph.instagram.com");
    expect(aufrufe[1].searchParams.get("after")).toBe("CURSOR_A");
  });

  it("übernimmt den echten Zeitpunkt des Kommentars", async () => {
    antworten({ body: { data: [kommentar("1", "anna_berg", "dabei")], paging: {} } });
    const { comments } = await holeKommentare({ token: "T", mediaId: "42" });
    expect(comments[0].commentedAt.toISOString()).toBe("2026-08-01T10:00:00.000Z");
  });

  // Ohne Namen ist eine Teilnahme wertlos — sie darf nicht als leerer Eintrag
  // im Lostopf landen, aber verschwiegen werden darf sie auch nicht.
  it("überspringt Kommentare ohne Benutzernamen und meldet es", async () => {
    antworten({
      body: {
        data: [
          kommentar("1", "anna_berg", "dabei"),
          { id: "2", text: "dabei", timestamp: "2026-08-01T10:00:00+0000" },
        ],
        paging: {},
      },
    });

    const { comments, warnings } = await holeKommentare({ token: "T", mediaId: "42" });
    expect(comments).toHaveLength(1);
    expect(warnings.join(" ")).toMatch(/1 Kommentar übersprungen/);
  });

  it("liest den Namen auch aus dem Feld from", async () => {
    antworten({
      body: {
        data: [
          {
            id: "1",
            text: "dabei",
            from: { username: "@anna_berg" },
            timestamp: "2026-08-01T10:00:00+0000",
          },
        ],
        paging: {},
      },
    });
    const { comments } = await holeKommentare({ token: "T", mediaId: "42" });
    expect(comments[0].username).toBe("anna_berg");
  });

  it("hört bei der Obergrenze auf und sagt es", async () => {
    antworten({
      body: {
        data: [
          kommentar("1", "anna_berg", "dabei"),
          kommentar("2", "ben_wald", "dabei"),
          kommentar("3", "carla_stein", "dabei"),
        ],
        paging: { cursors: { after: "C" }, next: "https://…" },
      },
    });

    const { comments, abgeschnitten, warnings } = await holeKommentare({
      token: "T",
      mediaId: "42",
      maxComments: 2,
    });

    expect(comments).toHaveLength(2);
    expect(abgeschnitten).toBe(true);
    expect(warnings.join(" ")).toMatch(/ersten 2 Kommentare/);
  });
});

describe("Fehler kommen im Klartext", () => {
  const fehler = (status: number, body: unknown) =>
    antworten({ ok: false, status, body });

  // Wer der Anleitung „mit Facebook-Login" folgt, bekommt einen Schlüssel,
  // den dieser Weg nicht annimmt — und Meta meldet dafür denselben Code wie
  // für „abgelaufen". Beide Ursachen gehören deshalb in die Meldung.
  it("abgelaufener oder falsch erzeugter Schlüssel", async () => {
    fehler(401, { error: { code: 190, message: "Session has expired" } });
    await expect(holeKommentare({ token: "T", mediaId: "42" })).rejects.toThrow(
      /nicht akzeptiert/,
    );
  });

  it("Stundenlimit nennt die Wartezeit", async () => {
    fehler(400, { error: { code: 4, message: "Application request limit reached" } });
    await expect(holeKommentare({ token: "T", mediaId: "42" })).rejects.toThrow(
      /etwa eine Stunde/,
    );
  });

  it("fehlende Berechtigung nennt die Berechtigung", async () => {
    fehler(403, { error: { code: 10, message: "permission" } });
    await expect(holeKommentare({ token: "T", mediaId: "42" })).rejects.toThrow(
      /instagram_business_manage_comments/,
    );
  });

  it("fremder Beitrag wird als solcher erklärt", async () => {
    fehler(404, { error: { code: 100, message: "Unsupported get request" } });
    await expect(holeKommentare({ token: "T", mediaId: "42" })).rejects.toThrow(
      /nur Kommentare unter Beiträgen des verbundenen Kontos/,
    );
  });

  // Der Name ist kein Schmuck: alsErgebnis erkennt den Fehler daran und gibt
  // den Text weiter, statt ihn im Produktionsbau zu „error #441" zu zensieren.
  it("trägt den Namen, an dem alsErgebnis ihn erkennt", async () => {
    fehler(401, { error: { code: 190 } });
    await expect(
      holeKommentare({ token: "T", mediaId: "42" }),
    ).rejects.toMatchObject({ name: "InstagramError" });
    expect(new InstagramError("x").name).toBe("InstagramError");
  });

  it("meldet fehlendes Netz als solches", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network");
    });
    await expect(holeKommentare({ token: "T", mediaId: "42" })).rejects.toThrow(
      /nicht erreichbar/,
    );
  });
});

describe("pruefeZugang", () => {
  it("nennt Konto und Kontotyp", async () => {
    antworten({
      body: { id: "17841400000", username: "tnillumination", account_type: "MEDIA_CREATOR" },
    });
    await expect(pruefeZugang("T")).resolves.toEqual({
      username: "tnillumination",
      kontotyp: "MEDIA_CREATOR",
      userId: "17841400000",
    });
  });

  it("erklärt ein privates Konto, statt leer zu bleiben", async () => {
    antworten({ body: { id: "1" } });
    await expect(pruefeZugang("T")).rejects.toThrow(/Profi-Konto/);
  });
});

describe("verlaengereToken", () => {
  it("rechnet die Restlaufzeit in einen Zeitpunkt um", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));
    antworten({ body: { access_token: "NEU", token_type: "bearer", expires_in: 5183944 } });

    const { token, gueltigBis } = await verlaengereToken("ALT");
    expect(token).toBe("NEU");
    expect(gueltigBis.toISOString().slice(0, 10)).toBe("2026-10-09");
    vi.useRealTimers();
  });

  // Meta verlangt, dass der Schluessel 24 Stunden alt ist. Wer gerade einen
  // erzeugt hat und sofort verlaengert, muss erfahren, warum es nicht geht.
  it("erklärt die 24-Stunden-Regel, statt still zu scheitern", async () => {
    antworten({ body: {} });
    await expect(verlaengereToken("ALT")).rejects.toThrow(/24 Stunden alt/);
  });
});

describe("holeBeitraege", () => {
  it("macht aus der Antwort eine auswählbare Liste", async () => {
    antworten({
      body: {
        data: [
          {
            id: "18000",
            caption: "Großes Gewinnspiel!",
            media_type: "IMAGE",
            permalink: "https://www.instagram.com/p/ABC/",
            timestamp: "2026-08-01T09:00:00+0000",
            comments_count: 137,
          },
        ],
      },
    });

    const { beitraege: [beitrag] } = await holeBeitraege("T");
    expect(beitrag.externalId).toBe("18000");
    expect(beitrag.caption).toBe("Großes Gewinnspiel!");
    expect(beitrag.commentCount).toBe(137);
    expect(beitrag.publishedAt.toISOString()).toBe("2026-08-01T09:00:00.000Z");
  });

  it("kommt mit einem Beitrag ohne Bildunterschrift zurecht", async () => {
    antworten({ body: { data: [{ id: "1", permalink: "https://…" }] } });
    const { beitraege: [beitrag] } = await holeBeitraege("T");
    expect(beitrag.caption).toBe("");
    expect(beitrag.commentCount).toBeNull();
  });
});

describe("kuerzelAusLink", () => {
  // Dieselbe Aufnahme heißt mal /p/, mal /reel/, mal mit www, mal ohne — und
  // beim Teilen aus der App hängt ?igsh=… dran. Verglichen wird deshalb nur
  // das Kürzel, nie die ganze Adresse.
  const gleiche = [
    "https://www.instagram.com/p/C8xYz_1AbCd/",
    "https://instagram.com/p/C8xYz_1AbCd",
    "http://www.instagram.com/reel/C8xYz_1AbCd/",
    "https://www.instagram.com/reel/C8xYz_1AbCd/?igsh=MTk4Zm0y&img_index=1",
    "instagram.com/tv/C8xYz_1AbCd/",
  ];

  for (const adresse of gleiche) {
    it(`liest das Kürzel aus ${adresse.slice(0, 42)}`, () => {
      expect(kuerzelAusLink(adresse)).toBe("C8xYz_1AbCd");
    });
  }

  it("gibt bei allem anderen null zurück", () => {
    expect(kuerzelAusLink("")).toBeNull();
    expect(kuerzelAusLink("   ")).toBeNull();
    expect(kuerzelAusLink("https://www.instagram.com/tnillumination/")).toBeNull();
    expect(kuerzelAusLink("https://www.tiktok.com/@ich/video/123")).toBeNull();
    expect(kuerzelAusLink("Guck mal hier")).toBeNull();
  });
});

describe("sucheBeitragPerLink", () => {
  const beitrag = (id: string, kuerzel: string) => ({
    id,
    caption: `Beitrag ${id}`,
    permalink: `https://www.instagram.com/p/${kuerzel}/`,
    timestamp: "2026-02-01T09:00:00+0000",
    comments_count: 12,
  });

  const seite = (eintraege: unknown[], weiter: string | null) => ({
    body: {
      data: eintraege,
      paging: weiter
        ? { cursors: { after: weiter }, next: "https://…" }
        : { cursors: { after: "ENDE" } },
    },
  });

  it("findet einen Beitrag auf der ersten Seite", async () => {
    antworten(seite([beitrag("1", "AAA"), beitrag("2", "BBB")], null));
    const treffer = await sucheBeitragPerLink(
      "T",
      "https://www.instagram.com/p/BBB/",
    );
    expect(treffer?.externalId).toBe("2");
  });

  // Der eigentliche Zweck: Ein Beitrag von vor einem halben Jahr steht nicht
  // auf der ersten Seite. Vorher war die Liste bei 25 zu Ende und er war
  // schlicht nicht erreichbar.
  it("blättert weiter, bis der Beitrag gefunden ist", async () => {
    const aufrufe = antworten(
      seite([beitrag("1", "AAA")], "CURSOR_1"),
      seite([beitrag("2", "BBB")], "CURSOR_2"),
      seite([beitrag("3", "ALT")], null),
    );

    const treffer = await sucheBeitragPerLink(
      "T",
      "https://www.instagram.com/reel/ALT/?igsh=xyz",
    );
    expect(treffer?.externalId).toBe("3");
    expect(aufrufe).toHaveLength(3);
    expect(aufrufe[2].searchParams.get("after")).toBe("CURSOR_2");
  });

  it("hört auf, wenn es keine weitere Seite gibt", async () => {
    const aufrufe = antworten(seite([beitrag("1", "AAA")], null));
    expect(
      await sucheBeitragPerLink("T", "https://www.instagram.com/p/GIBTSNICHT/"),
    ).toBeNull();
    expect(aufrufe).toHaveLength(1);
  });

  it("erklärt eine Adresse, die gar kein Beitrag ist", async () => {
    await expect(
      sucheBeitragPerLink("T", "https://www.instagram.com/tnillumination/"),
    ).rejects.toThrow(/Adresse eines Instagram-Beitrags/);
  });
});

describe("zaehleKommentare", () => {
  it("liest Instagrams eigene Zahl", async () => {
    antworten({ body: { id: "42", comments_count: 137 } });
    await expect(zaehleKommentare("T", "42")).resolves.toBe(137);
  });

  // Der Unterschied zwischen „Instagram sagt null" und „Instagram sagt gar
  // nichts" trägt die ganze Meldung — 0 statt null wäre hier eine Lüge.
  it("gibt null zurück, wenn keine Zahl mitkommt", async () => {
    antworten({ body: { id: "42" } });
    await expect(zaehleKommentare("T", "42")).resolves.toBeNull();
  });

  it("unterscheidet die echte Null davon", async () => {
    antworten({ body: { id: "42", comments_count: 0 } });
    await expect(zaehleKommentare("T", "42")).resolves.toBe(0);
  });
});

describe("nichtsGeliefert", () => {
  // Der Fall aus dem ersten echten Versuch: Instagram zeigte die Zahl an,
  // lieferte aber nichts — und die alte Meldung schickte zum Suchen an den
  // Beitrag, an dem nichts falsch war.
  it("nennt Zahl und wahren Grund, wenn Instagram zählt aber nichts liefert", () => {
    const text = nichtsGeliefert(137);
    expect(text).toMatch(/137 Kommentare/);
    expect(text).toMatch(/Am Beitrag liegt es also nicht/);
    expect(text).toMatch(/instagram_business_manage_comments/);
    expect(text).toMatch(/Tester-Einladungen/);
    expect(text).not.toMatch(/Ist es der richtige Beitrag/);

    // Die Verwechslung, die Meta selbst nahelegt: App-Review und der Schalter
    // „Entwicklung / Live" sind zwei verschiedene Dinge.
    expect(text).toMatch(/anderer Schalter als die App-Review/);
  });

  it("beugt den Singular", () => {
    expect(nichtsGeliefert(1)).toMatch(/1 Kommentar unter/);
  });

  it("fragt nach dem Beitrag nur, wenn Instagram selbst null zählt", () => {
    const text = nichtsGeliefert(0);
    expect(text).toMatch(/Ist es der richtige Beitrag/);
    expect(text).toMatch(/eigenen Zählung/);
    expect(text).not.toMatch(/Instagram-Tester/);
    expect(text).not.toMatch(/App-Review/);
  });

  it("behauptet ohne Zahl nichts, nennt aber einen Weg", () => {
    const text = nichtsGeliefert(null);
    expect(text).toMatch(/keine Zahl dazu/);
    expect(text).toMatch(/instagram_business_manage_comments/);
  });
});

describe("hinweisZuAntworten", () => {
  it("erklärt einen deutlichen Unterschied", () => {
    const text = hinweisZuAntworten(137, 64);
    expect(text).toMatch(/137 Kommentare, eingelesen wurden 64/);
    expect(text).toMatch(/Antworten auf Kommentare zählt Instagram mit/);
  });

  // Kleine Abweichungen sind Alltag. Eine Warnung, die bei jedem Abruf
  // erscheint, liest beim zweiten Mal niemand mehr — auch die nicht, die zählt.
  it("schweigt bei kleinem Abstand", () => {
    expect(hinweisZuAntworten(66, 64)).toBeNull();
    expect(hinweisZuAntworten(64, 64)).toBeNull();
  });

  it("schweigt ohne Zahl von Instagram", () => {
    expect(hinweisZuAntworten(null, 64)).toBeNull();
  });

  it("schweigt, wenn mehr ankam als Instagram zählt", () => {
    expect(hinweisZuAntworten(60, 64)).toBeNull();
  });
});
