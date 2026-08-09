import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GitHubError,
  checkAccess,
  ensurePages,
  normalizeRepo,
  pagesUrl,
  uploadFiles,
} from "@/lib/github";

const REPO = "TNIllumination/gewinnspiele";
const TOKEN = "geheim";

interface Aufruf {
  pfad: string;
  method: string;
  body: Record<string, unknown> | null;
}

/// Ersetzt fetch durch eine Liste von Antworten, in der Reihenfolge der
/// erwarteten Aufrufe. Zeichnet auf, was das Werkzeug wirklich gefragt hat.
function fakeFetch(antworten: [number, Record<string, unknown>][]) {
  const aufrufe: Aufruf[] = [];
  let i = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    aufrufe.push({
      pfad: String(url).replace("https://api.github.com", ""),
      method: init.method ?? "GET",
      body: init.body ? JSON.parse(String(init.body)) : null,
    });
    const [status, data] = antworten[i++] ?? [500, {}];
    return {
      status,
      json: async () => data,
    } as Response;
  });
  return aufrufe;
}

afterEach(() => vi.unstubAllGlobals());

const REPO_OK: [number, Record<string, unknown>] = [
  200,
  { full_name: REPO, default_branch: "main", permissions: { push: true } },
];

describe("normalizeRepo", () => {
  // Kaum jemand tippt das ab — kopiert wird eine Adresse. Und es gibt zwei.
  it("nimmt die GitHub-Adresse an", () => {
    for (const eingabe of [
      "https://github.com/TNIllumination/gewinnspiele",
      "https://github.com/TNIllumination/gewinnspiele.git",
      "https://www.github.com/TNIllumination/gewinnspiele",
      "github.com/TNIllumination/gewinnspiele/tree/main",
      "git@github.com:TNIllumination/gewinnspiele.git",
      "https://github.com/TNIllumination/gewinnspiele?tab=readme",
    ]) {
      expect(normalizeRepo(eingabe)).toBe(REPO);
    }
  });

  // Das ist die Adresse, die man staendig vor Augen hat — und genau die hat
  // frueher zu "https:/tnillumination.github.io" gefuehrt.
  it("nimmt die Veröffentlichungsadresse an", () => {
    expect(normalizeRepo("https://tnillumination.github.io/gewinnspiele")).toBe(
      "tnillumination/gewinnspiele",
    );
    expect(normalizeRepo("tnillumination.github.io/gewinnspiele/")).toBe(
      "tnillumination/gewinnspiele",
    );
  });

  it("erkennt die persönliche Seite als eigenes Repository", () => {
    expect(normalizeRepo("https://tnillumination.github.io")).toBe(
      "tnillumination/tnillumination.github.io",
    );
  });

  it("lässt die Kurzform in Ruhe und verträgt Leerzeichen", () => {
    expect(normalizeRepo("  TNIllumination/gewinnspiele  ")).toBe(REPO);
    expect(normalizeRepo("TNIllumination/gewinnspiele/settings/pages")).toBe(REPO);
  });

  // Der eigentliche Regressionstest: lieber nichts als ein halbes Ergebnis.
  // Ein verstuemmelter Wert saehe fast richtig aus und fiele erst beim
  // Hochladen auf.
  it("gibt bei Unlesbarem nichts zurück, statt zu raten", () => {
    for (const eingabe of [
      "",
      "   ",
      "gewinnspiele",
      "https://github.com/TNIllumination",
      "https://beispiel.de",
      "besitzer/na me",
    ]) {
      expect(normalizeRepo(eingabe)).toBe("");
    }
  });
});

describe("pagesUrl", () => {
  // Die häufigste Stolperstelle beim Abtippen.
  it("schreibt den Kontonamen klein", () => {
    expect(pagesUrl(REPO)).toBe("https://tnillumination.github.io/gewinnspiele");
  });
});

describe("Hochladen in ein Repository mit Stand", () => {
  it("legt alle Dateien in einem einzigen Commit ab", async () => {
    const aufrufe = fakeFetch([
      REPO_OK,
      [200, { object: { sha: "basis123" } }],
      [201, { sha: "blobA" }],
      [201, { sha: "blobB" }],
      [201, { sha: "baum1" }],
      [201, { sha: "commit1", html_url: "https://github.com/x/y/commit/1" }],
      [200, {}],
    ]);

    const ergebnis = await uploadFiles({
      repo: REPO,
      token: TOKEN,
      message: "Gewinnspiel veröffentlicht",
      files: [
        { path: "index.html", content: "<html>1</html>" },
        { path: "verlosung.html", content: "<html>2</html>" },
      ],
    });

    expect(ergebnis.erstellt).toBe(false);
    expect(ergebnis.commitUrl).toContain("/commit/1");

    // Genau ein Commit, nicht einer je Datei.
    const commits = aufrufe.filter((a) => a.pfad.endsWith("/git/commits"));
    expect(commits).toHaveLength(1);
    expect(commits[0].body?.parents).toEqual(["basis123"]);

    const baum = aufrufe.find((a) => a.pfad.endsWith("/git/trees"));
    expect(baum?.body?.base_tree).toBe("basis123");
    expect((baum?.body?.tree as unknown[]).length).toBe(2);

    // Der Branch wird auf den neuen Commit geschoben.
    const ref = aufrufe.at(-1);
    expect(ref?.method).toBe("PATCH");
    expect(ref?.body?.sha).toBe("commit1");
  });

  it("schickt den Inhalt base64-kodiert", async () => {
    const aufrufe = fakeFetch([
      REPO_OK,
      [200, { object: { sha: "basis" } }],
      [201, { sha: "blob" }],
      [201, { sha: "baum" }],
      [201, { sha: "commit" }],
      [200, {}],
    ]);
    await uploadFiles({
      repo: REPO,
      token: TOKEN,
      message: "x",
      files: [{ path: "index.html", content: "Grüße" }],
    });
    const blob = aufrufe.find((a) => a.pfad.endsWith("/git/blobs"));
    expect(blob?.body?.encoding).toBe("base64");
    expect(
      Buffer.from(String(blob?.body?.content), "base64").toString("utf8"),
    ).toBe("Grüße");
  });
});

describe("Hochladen in ein leeres Repository", () => {
  // Das ist der allererste Knopfdruck — und der Grund, warum GitHub Pages
  // sich vorher nicht einschalten ließ.
  it("legt die Dateien über den Inhalts-Endpunkt an, der den Branch mitbringt", async () => {
    const aufrufe = fakeFetch([
      REPO_OK,
      [404, { message: "Not Found" }],
      [201, {}],
      [201, {}],
    ]);

    const ergebnis = await uploadFiles({
      repo: REPO,
      token: TOKEN,
      message: "Erste Seiten",
      files: [
        { path: "index.html", content: "<html>1</html>" },
        { path: "datenschutz.html", content: "<html>2</html>" },
      ],
    });

    expect(ergebnis.erstellt).toBe(true);
    // Keine Git-Datenschnittstelle — die greift ohne Branch nicht.
    expect(aufrufe.some((a) => a.pfad.includes("/git/blobs"))).toBe(false);
    const puts = aufrufe.filter((a) => a.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[0].pfad).toContain("/contents/index.html");
    expect(puts[0].body?.branch).toBe("main");
  });

  it("erkennt auch die Antwort 409 als leeres Repository", async () => {
    fakeFetch([REPO_OK, [409, { message: "Git Repository is empty." }], [201, {}]]);
    const ergebnis = await uploadFiles({
      repo: REPO,
      token: TOKEN,
      message: "x",
      files: [{ path: "index.html", content: "<html></html>" }],
    });
    expect(ergebnis.erstellt).toBe(true);
  });
});

describe("Verständliche Fehler", () => {
  const versuch = () =>
    uploadFiles({
      repo: REPO,
      token: TOKEN,
      message: "x",
      files: [{ path: "index.html", content: "x" }],
    });

  it("sagt bei 401, dass der Schlüssel abgelaufen sein dürfte", async () => {
    fakeFetch([[401, { message: "Bad credentials" }]]);
    await expect(versuch()).rejects.toThrow(/abgelaufen/);
  });

  it("nennt bei 403 die fehlende Berechtigung beim Namen", async () => {
    fakeFetch([[403, {}]]);
    await expect(versuch()).rejects.toThrow(/Read and write/);
  });

  it("erklärt bei 404 beide möglichen Ursachen", async () => {
    fakeFetch([[404, {}]]);
    await expect(versuch()).rejects.toThrow(/Name|Repository access/);
  });

  it("sagt bei fehlendem Netz, dass die Dateien nicht verloren sind", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    await expect(versuch()).rejects.toThrow(/veroeffentlichung/);
  });

  it("wirft einen GitHubError, dessen Text angezeigt werden darf", async () => {
    fakeFetch([[401, {}]]);
    await expect(versuch()).rejects.toBeInstanceOf(GitHubError);
  });
});

describe("GitHub Pages einschalten", () => {
  it("rührt nichts an, wenn Pages schon läuft", async () => {
    const aufrufe = fakeFetch([
      [200, { html_url: "https://tnillumination.github.io/gewinnspiele/" }],
    ]);
    const ergebnis = await ensurePages({ repo: REPO, token: TOKEN });
    expect(ergebnis.an).toBe(true);
    expect(aufrufe.filter((a) => a.method === "POST")).toHaveLength(0);
  });

  it("schaltet es ein, wenn es noch aus ist", async () => {
    const aufrufe = fakeFetch([
      [404, {}],
      REPO_OK,
      [201, { html_url: "https://tnillumination.github.io/gewinnspiele/" }],
    ]);
    const ergebnis = await ensurePages({ repo: REPO, token: TOKEN });
    expect(ergebnis.an).toBe(true);
    const post = aufrufe.find((a) => a.method === "POST");
    expect(post?.body?.source).toEqual({ branch: "main", path: "/" });
  });

  // Wichtig: Die Dateien sind dann schon oben. Ein Abbruch wäre schlimmer
  // als der Hinweis, den Schalter einmal selbst umzulegen.
  it("bricht nicht ab, wenn die Berechtigung fehlt", async () => {
    fakeFetch([[403, {}]]);
    const ergebnis = await ensurePages({ repo: REPO, token: TOKEN });
    expect(ergebnis.an).toBe(false);
    expect(ergebnis.hinweis).toMatch(/Settings → Pages/);
  });
});

describe("Verbindung prüfen", () => {
  it("meldet Schreibrecht und den Zustand von Pages", async () => {
    fakeFetch([
      REPO_OK,
      [200, { html_url: "https://tnillumination.github.io/gewinnspiele/" }],
    ]);
    const ergebnis = await checkAccess({ repo: REPO, token: TOKEN });
    expect(ergebnis.darfSchreiben).toBe(true);
    expect(ergebnis.pagesAn).toBe(true);
    expect(ergebnis.repo).toBe(REPO);
  });

  it("meldet einen falschen Schlüssel verständlich", async () => {
    fakeFetch([[401, {}]]);
    await expect(checkAccess({ repo: REPO, token: TOKEN })).rejects.toThrow(
      /Zugangsschlüssel/,
    );
  });
});
