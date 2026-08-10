import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFiles } from "@/lib/github";

// Löschen einer veröffentlichten Seite: Im Verzeichnisbaum bekommt der Pfad
// `sha: null` — so nimmt Git ihn im selben Commit heraus, in dem die übrigen
// Dateien neu geschrieben werden.

type Aufruf = { pfad: string; body: unknown };

/// Spielt die Antworten der GitHub-Schnittstelle nach und merkt sich, was
/// geschickt wurde.
function githubAntwortet() {
  const aufrufe: Aufruf[] = [];

  vi.stubGlobal("fetch", async (url: URL | string, init?: RequestInit) => {
    const pfad = new URL(url.toString()).pathname;
    aufrufe.push({
      pfad,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    const antwort = (status: number, data: unknown) =>
      ({ ok: status < 300, status, json: async () => data }) as Response;

    if (/\/repos\/[^/]+\/[^/]+$/.test(pfad)) {
      return antwort(200, { default_branch: "main", private: false });
    }
    if (pfad.includes("/git/ref/heads/")) {
      return antwort(200, { object: { sha: "BASIS" } });
    }
    if (pfad.endsWith("/git/blobs")) return antwort(201, { sha: "BLOB" });
    if (pfad.endsWith("/git/trees")) return antwort(201, { sha: "BAUM" });
    if (pfad.endsWith("/git/commits")) {
      return antwort(201, { sha: "COMMIT", html_url: "https://github.com/x/y" });
    }
    if (pfad.includes("/git/refs/heads/")) return antwort(200, {});
    return antwort(200, {});
  });

  return aufrufe;
}

afterEach(() => vi.unstubAllGlobals());

describe("uploadFiles mit deletePaths", () => {
  it("nimmt den Pfad mit sha: null in den Baum auf", async () => {
    const aufrufe = githubAntwortet();

    await uploadFiles({
      repo: "ich/gewinnspiele",
      token: "T",
      files: [{ path: "index.html", content: "<html>" }],
      message: "Gewinnspiel entfernt",
      deletePaths: ["verlosung.html"],
    });

    const baum = aufrufe.find((a) => a.pfad.endsWith("/git/trees"));
    const eintraege = (baum?.body as { tree: { path: string; sha: string | null }[] })
      .tree;

    expect(eintraege).toContainEqual(
      expect.objectContaining({ path: "verlosung.html", sha: null }),
    );
    expect(eintraege).toContainEqual(
      expect.objectContaining({ path: "index.html", sha: "BLOB" }),
    );
  });

  // Beim Löschen wird die Übersicht ohnehin neu geschrieben — aber ein Commit,
  // der nur entfernt, muss genauso durchgehen.
  it("lässt einen Commit zu, der ausschließlich löscht", async () => {
    githubAntwortet();
    await expect(
      uploadFiles({
        repo: "ich/gewinnspiele",
        token: "T",
        files: [],
        message: "nur entfernen",
        deletePaths: ["verlosung.html"],
      }),
    ).resolves.toBeTruthy();
  });

  it("lehnt einen Commit ohne jeden Inhalt ab", async () => {
    githubAntwortet();
    await expect(
      uploadFiles({
        repo: "ich/gewinnspiele",
        token: "T",
        files: [],
        message: "nichts",
      }),
    ).rejects.toThrow(/nichts hochzuladen/);
  });
});
