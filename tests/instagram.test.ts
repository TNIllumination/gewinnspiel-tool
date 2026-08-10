import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InstagramError,
  holeBeitraege,
  holeKommentare,
  pruefeZugang,
  verlaengereToken,
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

    const [beitrag] = await holeBeitraege("T");
    expect(beitrag.externalId).toBe("18000");
    expect(beitrag.caption).toBe("Großes Gewinnspiel!");
    expect(beitrag.commentCount).toBe(137);
    expect(beitrag.publishedAt.toISOString()).toBe("2026-08-01T09:00:00.000Z");
  });

  it("kommt mit einem Beitrag ohne Bildunterschrift zurecht", async () => {
    antworten({ body: { data: [{ id: "1", permalink: "https://…" }] } });
    const [beitrag] = await holeBeitraege("T");
    expect(beitrag.caption).toBe("");
    expect(beitrag.commentCount).toBeNull();
  });
});
