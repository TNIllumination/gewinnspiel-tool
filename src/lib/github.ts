// Hochladen der erzeugten Seiten zu GitHub Pages.
//
// Warum ueberhaupt: Die Dateien von Hand in den Browser zu ziehen ist der
// letzte umstaendliche Schritt im ganzen Ablauf — und er passiert unter
// Zeitdruck, kurz vor oder nach der Ziehung.
//
// Bewusst ohne Bibliothek: Node bringt fetch mit, und die drei Endpunkte,
// die wir brauchen, sind ueberschaubar. Eine Abhaengigkeit weniger, die bei
// einem Update kaputtgehen kann.

const API = "https://api.github.com";
const TIMEOUT = 30000;

/// Ein Fehler, dessen Text so, wie er ist, angezeigt werden darf.
export class GitHubError extends Error {
  // alsErgebnis erkennt ihn am Namen, ohne dieses Modul kennen zu muessen.
  name = "GitHubError";
}

export interface UploadFile {
  /// Pfad im Repository, z. B. "index.html".
  path: string;
  content: string;
}

interface Zugang {
  repo: string;
  token: string;
}

/// Macht aus allem, was man kopieren kann, `besitzer/name`.
///
/// Die wenigsten tippen das ab — sie kopieren eine Adresse. Und es gibt
/// **zwei**: die GitHub-Seite (github.com/besitzer/name) und die
/// Veroeffentlichungsadresse (besitzer.github.io/name). Die zweite ist die,
/// die man staendig vor Augen hat — also muss sie zuerst funktionieren.
///
/// Gibt "" zurueck, wenn sich nichts Verlaessliches herauslesen laesst. Ein
/// halb geratenes Ergebnis waere schlimmer als keines: Es wuerde gespeichert,
/// saehe fast richtig aus und schlueg erst beim Hochladen fehl.
export function normalizeRepo(input: string): string {
  let s = input.trim();
  if (!s) return "";

  s = s.replace(/^git@github\.com:/i, "");
  // Jedes Schema, nicht nur github.com — sonst bleibt "https:" stehen und
  // wird spaeter fuer den Besitzernamen gehalten.
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  s = s.replace(/^www\./i, "");
  s = s.replace(/[?#].*$/, "");
  s = s.replace(/\.git$/i, "");
  s = s.replace(/^\/+|\/+$/g, "");

  const teile = s.split("/").filter(Boolean);
  if (teile.length === 0) return "";
  const host = teile[0].toLowerCase();

  // github.com/besitzer/name — alles dahinter (/tree/main, /settings) faellt weg.
  if (host === "github.com") {
    return teile.length >= 3 ? pruefeForm(teile[1], teile[2]) : "";
  }

  // besitzer.github.io/name — die Veroeffentlichungsadresse.
  const pages = host.match(/^([a-z0-9-]+)\.github\.io$/);
  if (pages) {
    // Ohne Pfad ist es die persoenliche Seite; deren Repository heisst wie
    // der Gastgebername selbst.
    return teile.length >= 2
      ? pruefeForm(pages[1], teile[1])
      : pruefeForm(pages[1], host);
  }

  // Schon in der Kurzform eingegeben.
  if (teile.length >= 2) return pruefeForm(teile[0], teile[1]);

  // Ein einzelnes Wort ist kein Repository — GitHub braucht immer beides.
  return "";
}

const NAME = /^[A-Za-z0-9._-]+$/;

function pruefeForm(besitzer: string, name: string): string {
  if (!NAME.test(besitzer) || !NAME.test(name)) return "";
  return `${besitzer}/${name}`;
}

interface Antwort {
  status: number;
  data: Record<string, unknown>;
}

/// Eine Anfrage an GitHub. Wirft nur bei Netzproblemen — HTTP-Fehler kommen
/// als Status zurueck, weil ein 404 je nach Stelle etwas anderes bedeutet.
async function request(
  token: string,
  pfad: string,
  init: RequestInit = {},
): Promise<Antwort> {
  let res: Response;
  try {
    res = await fetch(`${API}${pfad}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gewinnspiel-tool",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    throw new GitHubError(
      "GitHub war nicht erreichbar. Prüf die Internetverbindung — " +
        "die Dateien liegen im Ordner veroeffentlichung und lassen sich " +
        "später hochladen.",
    );
  }

  let data: Record<string, unknown> = {};
  if (res.status !== 204) {
    try {
      data = (await res.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  return { status: res.status, data };
}

/// Uebersetzt einen HTTP-Status in einen Satz, mit dem jemand etwas anfangen
/// kann. „401 Unauthorized" hilft niemandem weiter.
function uebersetze(status: number, repo: string): string {
  if (status === 401) {
    return (
      "Der Zugangsschlüssel wird von GitHub nicht akzeptiert. " +
      "Wahrscheinlich ist er abgelaufen — leg unter GitHub einen neuen an " +
      "und trag ihn hier ein."
    );
  }
  if (status === 403) {
    return (
      `Der Zugangsschlüssel darf in ${repo} nicht schreiben. ` +
      "Prüf beim Schlüssel unter Permissions, ob Contents auf " +
      "„Read and write“ steht."
    );
  }
  if (status === 404) {
    return (
      `Das Repository ${repo} wurde nicht gefunden. Entweder stimmt der Name ` +
      "nicht, oder der Zugangsschlüssel gilt nicht für dieses Repository " +
      "(beim Schlüssel unter „Repository access“ auswählen)."
    );
  }
  if (status === 422) {
    return (
      "GitHub hat die Anfrage abgelehnt. Prüf, ob das Repository schon " +
      "einen anderen Stand hat, und versuch es noch einmal."
    );
  }
  return `GitHub hat mit dem Fehler ${status} geantwortet.`;
}

/// Prueft Zugang und Zustand — fuer den Knopf „Verbindung prüfen".
export async function checkAccess({ repo, token }: Zugang) {
  const info = await request(token, `/repos/${repo}`);
  if (info.status !== 200) throw new GitHubError(uebersetze(info.status, repo));

  const branch = String(info.data.default_branch ?? "main");
  const perms = (info.data.permissions ?? {}) as Record<string, boolean>;
  const pages = await request(token, `/repos/${repo}/pages`);

  return {
    repo: String(info.data.full_name ?? repo),
    privat: Boolean(info.data.private),
    branch,
    darfSchreiben: Boolean(perms.push),
    pagesAn: pages.status === 200,
    pagesUrl: pages.status === 200 ? String(pages.data.html_url ?? "") : "",
    // Ohne Pages-Berechtigung antwortet GitHub mit 403 statt 404.
    pagesUnbekannt: pages.status === 403,
  };
}

/// Laedt alle Dateien hoch — in einem einzigen Commit, wenn das Repository
/// schon einen Stand hat.
///
/// Beim allerersten Mal ist das Repository leer. Dann gibt es weder Branch
/// noch Basis-Baum, und die Git-Datenschnittstelle greift nicht; dafuer
/// legt der Inhalts-Endpunkt den Branch gleich mit an. Genau dieser Fall
/// ist der erste Knopfdruck ueberhaupt — er darf nicht der ungetestete sein.
export async function uploadFiles({
  repo,
  token,
  files,
  message,
}: Zugang & { files: UploadFile[]; message: string }) {
  if (files.length === 0) throw new GitHubError("Es gibt nichts hochzuladen.");

  const info = await request(token, `/repos/${repo}`);
  if (info.status !== 200) throw new GitHubError(uebersetze(info.status, repo));
  const branch = String(info.data.default_branch ?? "main");

  const ref = await request(token, `/repos/${repo}/git/ref/heads/${branch}`);
  const leer = ref.status === 404 || ref.status === 409;
  if (ref.status !== 200 && !leer) {
    throw new GitHubError(uebersetze(ref.status, repo));
  }

  if (leer) {
    await bootstrap({ repo, token, files, message, branch });
    return { branch, erstellt: true, commitUrl: repoUrl(repo, branch) };
  }

  const baseCommit = String(
    (ref.data.object as Record<string, unknown> | undefined)?.sha ?? "",
  );

  // 1. Inhalte ablegen
  const blobs: { path: string; sha: string }[] = [];
  for (const file of files) {
    const res = await request(token, `/repos/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: Buffer.from(file.content, "utf8").toString("base64"),
        encoding: "base64",
      }),
    });
    if (res.status !== 201) throw new GitHubError(uebersetze(res.status, repo));
    blobs.push({ path: file.path, sha: String(res.data.sha) });
  }

  // 2. Verzeichnisbaum auf Basis des bisherigen Standes
  const tree = await request(token, `/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: baseCommit,
      tree: blobs.map((b) => ({
        path: b.path,
        mode: "100644",
        type: "blob",
        sha: b.sha,
      })),
    }),
  });
  if (tree.status !== 201) throw new GitHubError(uebersetze(tree.status, repo));

  // 3. Ein Commit fuer alle Dateien zusammen
  const commit = await request(token, `/repos/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message,
      tree: String(tree.data.sha),
      parents: [baseCommit],
    }),
  });
  if (commit.status !== 201) {
    throw new GitHubError(uebersetze(commit.status, repo));
  }

  // 4. Branch weiterschieben
  const update = await request(token, `/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: String(commit.data.sha) }),
  });
  if (update.status !== 200) {
    throw new GitHubError(uebersetze(update.status, repo));
  }

  return {
    branch,
    erstellt: false,
    commitUrl: String(commit.data.html_url ?? repoUrl(repo, branch)),
  };
}

/// Erste Dateien in ein leeres Repository. Der Inhalts-Endpunkt legt den
/// Branch mit an; dafuer gibt es je Datei einen Commit — was genau einmal
/// passiert und danach nie wieder.
async function bootstrap({
  repo,
  token,
  files,
  message,
  branch,
}: Zugang & { files: UploadFile[]; message: string; branch: string }) {
  for (const file of files) {
    const res = await request(
      token,
      `/repos/${repo}/contents/${encodeURIComponent(file.path)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: Buffer.from(file.content, "utf8").toString("base64"),
          branch,
        }),
      },
    );
    if (res.status !== 201 && res.status !== 200) {
      throw new GitHubError(uebersetze(res.status, repo));
    }
  }
}

function repoUrl(repo: string, branch: string) {
  return `https://github.com/${repo}/tree/${branch}`;
}

/// Schaltet GitHub Pages ein, falls es noch aus ist.
///
/// Fehlt dem Schluessel die Berechtigung, ist das ausdruecklich kein Fehler:
/// Die Dateien sind dann hochgeladen, nur der Schalter muss einmal von Hand
/// umgelegt werden. Ein Abbruch an dieser Stelle waere schlimmer als der
/// Hinweis.
export async function ensurePages({ repo, token }: Zugang) {
  const vorhanden = await request(token, `/repos/${repo}/pages`);
  if (vorhanden.status === 200) {
    return { an: true, url: String(vorhanden.data.html_url ?? pagesUrl(repo)) };
  }
  if (vorhanden.status === 403) {
    return { an: false, url: "", hinweis: PAGES_VON_HAND };
  }

  const info = await request(token, `/repos/${repo}`);
  const branch =
    info.status === 200 ? String(info.data.default_branch ?? "main") : "main";

  const angelegt = await request(token, `/repos/${repo}/pages`, {
    method: "POST",
    body: JSON.stringify({ source: { branch, path: "/" } }),
  });
  if (angelegt.status === 201 || angelegt.status === 204) {
    return { an: true, url: String(angelegt.data.html_url ?? pagesUrl(repo)) };
  }
  if (angelegt.status === 409) {
    // Lief bereits — nur die Leseberechtigung fehlte.
    return { an: true, url: pagesUrl(repo) };
  }
  return { an: false, url: "", hinweis: PAGES_VON_HAND };
}

const PAGES_VON_HAND =
  "Die Dateien sind hochgeladen. GitHub Pages konnte das Tool nicht " +
  "einschalten — dem Zugangsschlüssel fehlt die Berechtigung „Pages: Read " +
  "and write“. Schalt es einmalig selbst ein: im Repository unter " +
  "Settings → Pages, Branch main, Ordner / (root), Save.";

/// Die Adresse, unter der GitHub Pages ausliefert. Immer kleingeschrieben —
/// eine beliebte Stolperstelle, wenn der Kontoname Grossbuchstaben hat.
export function pagesUrl(repo: string): string {
  const [besitzer, name] = repo.split("/");
  if (!besitzer || !name) return "";
  return `https://${besitzer.toLowerCase()}.github.io/${name}`;
}
