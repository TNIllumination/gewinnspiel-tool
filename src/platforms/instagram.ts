// Kommentare unter eigenen Instagram-Beitraegen abrufen.
//
// Warum ueberhaupt: Der Kopierimport funktioniert, verlangt aber Handarbeit —
// bei ein paar hundert Kommentaren scrollt und kopiert man in Etappen, und
// jede Etappe ist eine Gelegenheit, etwas zu uebersehen.
//
// Welche Schnittstelle: Meta bietet zwei Wege zu denselben Kommentaren.
// Hier laeuft alles ueber „Instagram API with Instagram Login"
// (graph.instagram.com), nicht ueber den Weg mit Facebook-Anmeldung. Zwei
// Gruende, beide praktisch:
//
//   1. Es braucht **keine** verknuepfte Facebook-Seite.
//   2. Der Zugangsschluessel laesst sich **ohne App-Geheimnis** verlaengern.
//      Damit muss das Tool nie ein Geheimnis der App kennen — nur den
//      Schluessel, den es ohnehin hat.
//
// Bewusst ohne Bibliothek, wie schon bei GitHub: Node bringt fetch mit, und
// es sind vier Endpunkte. Eine Abhaengigkeit weniger, die bei einem Update
// kaputtgehen kann.
//
// Meta benennt seine Schnittstellen regelmaessig um. Deshalb steht der Host
// samt Fassung **an genau einer Stelle** — aendert sich etwas, ist es eine
// Zeile.

import type { CommentInput } from "@/rules/engine";
import type { MediaItem } from "./base";

const API = "https://graph.instagram.com/v25.0";
const TIMEOUT = 30000;

/// Sicherheitsnetz gegen einen Abruf, der nicht mehr aufhoert.
const MAX_KOMMENTARE = 5000;
/// Instagram liefert hoechstens 50 je Seite — mehr zu verlangen bringt nichts.
const SEITENGROESSE = 50;

/// Ein Fehler, dessen Text so, wie er ist, angezeigt werden darf.
export class InstagramError extends Error {
  // alsErgebnis erkennt ihn am Namen, ohne dieses Modul kennen zu muessen.
  // Ohne das zensiert Next.js im Produktionsbau den Text und uebrig bleibt
  // „minified React error #441" — genau der Fehler aus Fassung 0.4.1.
  name = "InstagramError";
}

export interface Zugangsinfo {
  /// Kontoname ohne @.
  username: string;
  /// BUSINESS, MEDIA_CREATOR, … — Instagram schreibt es gross.
  kontotyp: string;
  userId: string;
}

export interface NeuerSchluessel {
  token: string;
  /// Wann er ablaeuft. Instagram gibt Sekunden, hier steht ein Zeitpunkt.
  gueltigBis: Date;
}

// ── Der eine Weg nach draussen ──────────────────────────────────────────────

interface Antwort {
  status: number;
  data: Record<string, unknown>;
  /// Die angefragte Adresse **mit** Schluessel — nur fuer den Aufrufer.
  /// Vor jeder Anzeige durch `ohneSchluessel` schicken.
  url: string;
}

async function hole(pfad: string, params: Record<string, string>): Promise<Antwort> {
  const url = new URL(`${API}${pfad}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    throw new InstagramError(
      "Instagram war nicht erreichbar. Prüf die Internetverbindung und " +
        "versuch es noch einmal — es wurde nichts gespeichert.",
    );
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) throw new InstagramError(uebersetze(res.status, data));
  return { status: res.status, data, url: url.toString() };
}

/// Uebersetzt Metas Fehler in einen Satz, mit dem jemand etwas anfangen kann.
/// „OAuthException, code 190" hilft niemandem weiter.
function uebersetze(status: number, data: Record<string, unknown>): string {
  const fehler = (data.error ?? {}) as Record<string, unknown>;
  const code = Number(fehler.code ?? 0);
  const subcode = Number(fehler.error_subcode ?? 0);
  const meldung = String(fehler.message ?? "").trim();

  // 190 ist der Sammelcode fuer alles rund um den Schluessel. Der Unterfall
  // sagt, ob er abgelaufen ist oder zurueckgezogen wurde — fuer die Bedienung
  // ist der Weg derselbe, deshalb eine Meldung.
  if (code === 190 || status === 401) {
    return (
      "Der Instagram-Zugangsschlüssel wird nicht akzeptiert. Zwei Ursachen sind " +
      "häufig: Er ist abgelaufen (er hält 60 Tage) — dann hol dir einen neuen. " +
      "Oder er stammt aus der Einrichtung „mit Facebook-Login“; das Tool " +
      "benutzt „API-Einrichtung mit Instagram-Login“, dafür brauchst du keine " +
      "Facebook-Seite. Es wurde nichts gespeichert."
    );
  }

  // 4 = App-Limit, 17 = Nutzer-Limit, 32 = Seiten-Limit, 613 = zu viele Aufrufe.
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) {
    return (
      "Instagram lässt gerade keine weiteren Abrufe zu (Stundenlimit). " +
      "Warte etwa eine Stunde und ruf dann erneut ab — bereits eingelesene " +
      "Kommentare bleiben erhalten, es werden keine doppelt."
    );
  }

  if (code === 10 || code === 200 || subcode === 2018001) {
    return (
      "Die App darf die Kommentare nicht lesen. Im Meta-Zugangsbereich müssen " +
      "die Berechtigungen instagram_business_basic und " +
      "instagram_business_manage_comments gesetzt sein — danach einen neuen " +
      "Schlüssel erzeugen, denn die alten Berechtigungen hängen am alten Schlüssel."
    );
  }

  if (status === 404 || code === 100) {
    return (
      "Diesen Beitrag gibt Instagram nicht heraus. Abrufen lassen sich nur " +
      "Kommentare unter Beiträgen des verbundenen Kontos — wähl den Beitrag " +
      "am besten aus der Liste, statt eine Kennung einzutippen." +
      (meldung ? ` (Instagram meldet: ${meldung})` : "")
    );
  }

  return (
    `Instagram hat den Abruf abgelehnt (Status ${status}).` +
    (meldung ? ` Meldung: ${meldung}` : "") +
    " Es wurde nichts gespeichert."
  );
}

// ── Zugang ──────────────────────────────────────────────────────────────────

/// Wer ist da verbunden? Die Probe, die vor der Ziehung auffliegen laesst,
/// was sonst mittendrin auffliegt.
export async function pruefeZugang(token: string): Promise<Zugangsinfo> {
  const { data } = await hole("/me", {
    fields: "id,username,account_type",
    access_token: token,
  });

  const username = String(data.username ?? "").trim();
  if (!username) {
    throw new InstagramError(
      "Instagram hat geantwortet, aber keinen Kontonamen mitgeschickt. " +
        "Das passiert bei privaten Konten — für den Abruf braucht es ein " +
        "Profi-Konto (Creator oder Business).",
    );
  }

  return {
    username,
    kontotyp: String(data.account_type ?? "").trim() || "unbekannt",
    userId: String(data.id ?? ""),
  };
}

/// Verlaengert den Schluessel um 60 Tage.
///
/// Geht ohne App-Geheimnis — der Schluessel verlaengert sich selbst. Meta
/// verlangt allerdings, dass er **mindestens 24 Stunden alt** ist; einen
/// frisch erzeugten lehnt es ab. Das steht deshalb auch in der Meldung.
export async function verlaengereToken(token: string): Promise<NeuerSchluessel> {
  const { data } = await hole("/refresh_access_token", {
    grant_type: "ig_refresh_token",
    access_token: token,
  });

  const neu = String(data.access_token ?? "");
  const sekunden = Number(data.expires_in ?? 0);
  if (!neu || !Number.isFinite(sekunden) || sekunden <= 0) {
    throw new InstagramError(
      "Instagram hat keinen neuen Schlüssel geliefert. Verlängern geht erst, " +
        "wenn der Schlüssel mindestens 24 Stunden alt ist — bei einem gerade " +
        "erzeugten also morgen.",
    );
  }

  return { token: neu, gueltigBis: new Date(Date.now() + sekunden * 1000) };
}

// ── Beitraege ───────────────────────────────────────────────────────────────

export interface Beitragsseite {
  beitraege: MediaItem[];
  /// Cursor der naechsten Seite — null, wenn es keine mehr gibt.
  weiter: string | null;
}

/// Eine Seite der eigenen Beitraege, zum Anklicken.
///
/// Geblaettert wird bewusst seitenweise statt alles auf einmal: Wer 800
/// Beitraege hat, wartet sonst beim ersten Klick minutenlang auf eine Liste,
/// aus der er ohnehin den obersten waehlt.
export async function holeBeitraege(
  token: string,
  optionen: { anzahl?: number; nach?: string | null } = {},
): Promise<Beitragsseite> {
  return holeMediaSeite(token, optionen.anzahl ?? 25, optionen.nach ?? null);
}

async function holeMediaSeite(
  token: string,
  anzahl: number,
  nach: string | null,
): Promise<Beitragsseite> {
  const params: Record<string, string> = {
    fields: "id,caption,media_type,permalink,timestamp,comments_count",
    limit: String(Math.min(Math.max(anzahl, 1), 50)),
    access_token: token,
  };
  if (nach) params.after = nach;

  const { data } = await hole("/me/media", params);

  const roh = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : [];
  const paging = (data.paging ?? {}) as Record<string, unknown>;
  const cursors = (paging.cursors ?? {}) as Record<string, unknown>;

  return {
    beitraege: roh.map((m) => ({
      externalId: String(m.id ?? ""),
      caption: String(m.caption ?? "").trim(),
      url: String(m.permalink ?? ""),
      publishedAt: datum(m.timestamp) ?? new Date(),
      commentCount: zahlOderNull(m.comments_count),
    })),
    weiter: paging.next && cursors.after ? String(cursors.after) : null,
  };
}

/// Das Kuerzel aus einer Beitragsadresse: `.../p/ABC123/` → `ABC123`.
///
/// Verglichen wird nur dieses Kuerzel, nie die ganze Adresse. Dieselbe
/// Aufnahme heisst mal `/p/`, mal `/reel/`, mal mit `www`, mal ohne, und beim
/// Teilen aus der App haengt `?igsh=…` daran. Ein Vergleich der vollen
/// Adressen wuerde an jeder dieser Kleinigkeiten scheitern.
export function kuerzelAusLink(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const treffer = s.match(
    /instagram\.com\/(?:[^/?#]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i,
  );
  return treffer ? treffer[1] : null;
}

/// Wie viele Seiten beim Suchen hoechstens durchgeblaettert werden.
/// 20 × 50 sind 1000 Beitraege — wer mehr hat, waehlt aus der Liste.
const MAX_SUCHSEITEN = 20;

/// Sucht den Beitrag zu einer eingefuegten Adresse.
///
/// Aus der Adresse allein laesst sich die Kennung nicht gewinnen, die die
/// Schnittstelle braucht — dafuer gibt es keinen offiziellen Weg. Man braucht
/// ihn aber auch nicht: Die eigene Beitragsliste liefert zu jedem Beitrag
/// seine Adresse gleich mit. Also wird sie durchgeblaettert, bis das Kuerzel
/// passt. Nebenbei loest das die zweite Grenze — auch ein Beitrag von vor
/// einem halben Jahr wird so gefunden, ohne sich durch die Liste zu klicken.
export async function sucheBeitragPerLink(
  token: string,
  url: string,
): Promise<MediaItem | null> {
  const kuerzel = kuerzelAusLink(url);
  if (!kuerzel) {
    throw new InstagramError(
      "Das sieht nicht nach der Adresse eines Instagram-Beitrags aus. Erwartet " +
        "wird etwas wie https://www.instagram.com/p/ABC123/ oder .../reel/ABC123/ — " +
        "in der App bekommst du sie über „Teilen“ → „Link kopieren“.",
    );
  }

  let nach: string | null = null;
  for (let seite = 0; seite < MAX_SUCHSEITEN; seite++) {
    const { beitraege, weiter }: Beitragsseite = await holeMediaSeite(token, 50, nach);
    const treffer = beitraege.find((b) => kuerzelAusLink(b.url) === kuerzel);
    if (treffer) return treffer;
    if (!weiter) return null;
    nach = weiter;
  }
  return null;
}

// ── Kommentare ──────────────────────────────────────────────────────────────

/// Wie viele Kommentare zaehlt Instagram selbst unter diesem Beitrag?
///
/// Der Unterschied zwischen „Instagram zaehlt 137 und liefert 0" und
/// „Instagram zaehlt selbst 0" ist der zwischen einem Berechtigungsproblem
/// und dem falschen Beitrag. Ohne diese Zahl lassen sich beide Faelle nicht
/// auseinanderhalten — und genau daran ist der erste echte Versuch
/// gescheitert: Die Meldung fragte nach dem richtigen Beitrag, obwohl der
/// Beitrag stimmte.
///
/// `null`, wenn Instagram die Zahl nicht mitgibt. Dann wird nichts behauptet.
export async function zaehleKommentare(
  token: string,
  mediaId: string,
): Promise<number | null> {
  const { data } = await hole(`/${mediaId}`, {
    fields: "comments_count",
    access_token: token,
  });
  return zahlOderNull(data.comments_count);
}

/// Was sagt man, wenn kein einziger Kommentar ankam?
///
/// Das haengt vollstaendig an Instagrams eigener Zahl. Zaehlt Instagram
/// welche und liefert keinen, darf die App die Kommentare des Kontos noch
/// nicht sehen — Meta antwortet dann mit einer **leeren Liste statt einer
/// Fehlermeldung**, weshalb die Fehleruebersetzung nicht greift. Zaehlt
/// Instagram selbst null, ist die Frage nach dem Beitrag berechtigt.
///
/// Beim ersten echten Versuch stand hier nur die zweite Meldung. Sie schickte
/// zum Suchen an eine Stelle, an der nichts zu finden war.
export function nichtsGeliefert(gezaehlt: number | null): string {
  // Nach Wahrscheinlichkeit sortiert, nicht nach Reihenfolge in der Konsole.
  // Wer eine Liste abarbeitet, faengt oben an — dort muss stehen, was am
  // haeufigsten stimmt.
  const schritte =
    "Zu prüfen, in dieser Reihenfolge: " +
    "1. Trägt dein Schlüssel die Berechtigung für Kommentare? Beim Erzeugen " +
    "müssen instagram_business_basic UND instagram_business_manage_comments " +
    "angehakt sein. Sie hängen am Schlüssel, nicht am Konto — nachträglich " +
    "angehakt wirkt erst mit einem neu erzeugten Schlüssel. " +
    "2. Bist du als Instagram-Tester eingetragen (Meta-Konsole → App-Rollen) " +
    "und hast die Einladung in der Instagram-App bestätigt? " +
    "Einstellungen → Apps und Websites → Tester-Einladungen. Dieser zweite " +
    "Schritt wird fast immer übersehen. " +
    "3. Steht die App auf „Entwicklung“, versuch „Live“. Achtung: Das ist ein " +
    "anderer Schalter als die App-Review — die brauchst du für dein eigenes " +
    "Konto nicht, das sagt Meta selbst.";

  if (gezaehlt !== null && gezaehlt > 0) {
    return (
      `Instagram zählt ${gezaehlt} Kommentar${gezaehlt === 1 ? "" : "e"} unter ` +
      "diesem Beitrag, liefert aber keinen einzigen. Am Beitrag liegt es also " +
      "nicht — die App darf die Kommentare deines Kontos noch nicht sehen. " +
      schritte
    );
  }

  if (gezaehlt === 0) {
    return (
      "Unter diesem Beitrag hat Instagram keine Kommentare — auch nach seiner " +
      "eigenen Zählung nicht. Ist es der richtige Beitrag?"
    );
  }

  return (
    "Instagram hat keine Kommentare geliefert und auch keine Zahl dazu. Falls " +
    "unter dem Beitrag welche stehen, darf die App sie noch nicht sehen. " +
    schritte
  );
}

/// Instagram zaehlt mehr, als eingelesen wurde — ein Hinweis, kein Fehler.
///
/// Instagram zaehlt Antworten auf Kommentare mit, das Tool liest nur die
/// oberste Ebene. Ohne Erklaerung sieht der Unterschied nach einem
/// verschluckten Import aus.
///
/// Nur bei deutlichem Abstand: Eine Warnung, die bei jedem Abruf erscheint,
/// liest man beim zweiten Mal nicht mehr — und dann auch nicht die, die zaehlt.
export function hinweisZuAntworten(
  gezaehlt: number | null,
  geliefert: number,
): string | null {
  if (gezaehlt === null || gezaehlt <= geliefert * 1.2 + 5) return null;
  return (
    `Instagram zählt ${gezaehlt} Kommentare, eingelesen wurden ${geliefert}. ` +
    "Das ist normal: Antworten auf Kommentare zählt Instagram mit, für die " +
    "Teilnahme zählt nur der Kommentar selbst."
  );
}

export interface AbrufErgebnis {
  comments: CommentInput[];
  /// Was uebersprungen wurde und warum — dieselbe Ehrlichkeit wie beim
  /// Kopierimport, wo nicht zuordenbare Zeilen gemeldet statt verschluckt werden.
  warnings: string[];
  /// Wurde bei MAX_KOMMENTARE abgeschnitten?
  abgeschnitten: boolean;
  /// Gesetzt, wenn nichts gespeichert werden darf — mit dem Grund im Klartext.
  /// `comments` ist dann leer.
  abbruch: string | null;
  /// Was Instagram tatsaechlich geantwortet hat.
  diagnose: Diagnose;
}

/// Die Rohantwort, so weit sie gezeigt werden darf.
///
/// Entstanden aus zwei Runden Raterei: Instagram lieferte erst gar keine
/// Kommentare, dann welche ohne Namen — beides ohne Fehlermeldung. Beide Male
/// haette ein Blick in die tatsaechliche Antwort sofort gezeigt, welche Felder
/// ankommen und welche fehlen.
export interface Diagnose {
  /// Angefragte Adresse **ohne** den Zugangsschluessel.
  url: string;
  status: number;
  seiten: number;
  /// Wie viele Eintraege Instagram insgesamt geliefert hat.
  eintraege: number;
  /// Die erste Antwort, gekuerzt.
  antwort: string;
}

/// Wie viel der ersten Antwort gezeigt wird. Genug, um die Feldnamen zu sehen.
const DIAGNOSE_LAENGE = 2000;

/// Entfernt den Zugangsschluessel aus einer Adresse.
///
/// Der Schluessel darf nirgends im Browser landen — nicht im Diagnosekasten,
/// nicht in einer Fehlermeldung, nirgends. Wer ihn hat, kann im Namen des
/// Kontos handeln.
export function ohneSchluessel(url: string): string {
  try {
    const u = new URL(url);
    // Bewusst ein ASCII-Wort: Ein „…" wuerde beim Zusammenbauen der Adresse
    // zu %E2%80%A6 und waere im Diagnosekasten nicht mehr als Platzhalter
    // zu erkennen.
    if (u.searchParams.has("access_token")) {
      u.searchParams.set("access_token", "entfernt");
    }
    return u.toString();
  } catch {
    return url.replace(/access_token=[^&]*/g, "access_token=entfernt");
  }
}

/// Alle Kommentare unter einem Beitrag, ueber alle Seiten hinweg.
export async function holeKommentare(optionen: {
  token: string;
  mediaId: string;
  maxComments?: number;
  /// Kontoname des verbundenen Kontos — dessen eigene Kommentare zaehlen nicht.
  eigenerName?: string;
}): Promise<AbrufErgebnis> {
  const grenze = Math.min(optionen.maxComments ?? MAX_KOMMENTARE, MAX_KOMMENTARE);
  const eigenerName = (optionen.eigenerName ?? "").trim().replace(/^@/, "").toLowerCase();

  const comments: CommentInput[] = [];
  const warnings: string[] = [];
  let ohneNamen = 0;
  let eigene = 0;
  let antworten = 0;
  let eintraege = 0;
  let abgeschnitten = false;
  let diagnose: Diagnose | null = null;

  // Instagram blaettert ueber einen Cursor. Die erste Seite kommt ueber den
  // Pfad, jede weitere ueber `after` — die vollstaendige `next`-Adresse
  // absichtlich nicht: Die traegt den Schluessel im Klartext mit sich herum.
  let after: string | null = null;
  let seiten = 0;

  do {
    const params: Record<string, string> = {
      // `user` liefert Meta nur bei eigenen Kommentaren — der verlaessliche
      // Weg, sie zu erkennen. `parent_id` markiert Antworten auf Kommentare.
      // `from` ist die zweite Schreibweise des Namens.
      fields: "id,text,timestamp,like_count,username,parent_id,from{id,username},user",
      limit: String(SEITENGROESSE),
      access_token: optionen.token,
    };
    if (after) params.after = after;

    const antwort: Antwort = await hole(`/${optionen.mediaId}/comments`, params);
    const { data } = antwort;
    const seite = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : [];
    eintraege += seite.length;

    // Nur die erste Antwort — sie zeigt bereits, welche Felder ankommen.
    if (!diagnose) {
      diagnose = {
        url: ohneSchluessel(antwort.url),
        status: antwort.status,
        seiten: 0,
        eintraege: 0,
        antwort: kuerze(JSON.stringify(data), DIAGNOSE_LAENGE),
      };
    }

    for (const k of seite) {
      if (comments.length >= grenze) {
        abgeschnitten = true;
        break;
      }

      // Antworten auf Kommentare sind keine Teilnahme: Teilnahme ist ein
      // Kommentar **unter dem Beitrag**. Sonst kaeme jemand in den Topf, weil
      // er unter einem fremden Kommentar „dabei" geschrieben hat.
      if (String(k.parent_id ?? "").trim()) {
        antworten += 1;
        continue;
      }

      const username = benutzername(k);
      const text = String(k.text ?? "").trim();

      // Fehlt der Name, laesst sich der Kommentar niemandem zuordnen. Warum er
      // fehlt, entscheidet `namenFehlen` — nicht jeder Fall ist derselbe.
      if (!username) {
        ohneNamen += 1;
        continue;
      }

      // Der Veranstalter kann sein eigenes Gewinnspiel nicht gewinnen.
      // `user` setzt Meta nur bei eigenen Kommentaren; der Namensvergleich ist
      // die Rueckfalllinie, falls das Feld fehlt.
      if (String(k.user ?? "").trim() || username.toLowerCase() === eigenerName) {
        eigene += 1;
        continue;
      }

      if (!text) continue;

      comments.push({
        username,
        text,
        externalId: String(k.id ?? "") || null,
        commentedAt: datum(k.timestamp) ?? new Date(),
        likeCount: zahlOderNull(k.like_count) ?? 0,
        platform: "INSTAGRAM",
      });
    }

    const paging = (data.paging ?? {}) as Record<string, unknown>;
    const cursors = (paging.cursors ?? {}) as Record<string, unknown>;
    // Nur weiterblaettern, wenn Instagram wirklich eine naechste Seite meldet.
    after = paging.next && cursors.after ? String(cursors.after) : null;
    seiten += 1;

    // Reissleine: 5000 Kommentare sind 100 Seiten. Kommt mehr, stimmt etwas
    // nicht, und ein endloses Blaettern waere das Schlimmste.
    if (seiten > 200) {
      abgeschnitten = true;
      break;
    }
  } while (after && !abgeschnitten);

  // Fehlen die Namen reihenweise, ist ein Teilimport schlimmer als keiner:
  // Er fuellt den Lostopf mit den falschen Leuten, und das faellt beim
  // Durchsehen nicht auf. Bewusst als Rueckgabewert statt als Ausnahme —
  // sonst ginge die Diagnose verloren, und die wird genau hier gebraucht.
  const abbruch = namenFehlen(ohneNamen, ohneNamen + comments.length + eigene);

  if (ohneNamen > 0) {
    warnings.push(
      `${ohneNamen} Kommentar${ohneNamen === 1 ? "" : "e"} übersprungen — ` +
        "Instagram hat dazu keinen Benutzernamen mitgeschickt.",
    );
  }
  if (eigene > 0) {
    warnings.push(
      `${eigene} eigene Kommentar${eigene === 1 ? "" : "e"} übersprungen — ` +
        "wer das Gewinnspiel veranstaltet, nimmt daran nicht teil.",
    );
  }
  if (antworten > 0) {
    warnings.push(
      `${antworten} Antwort${antworten === 1 ? "" : "en"} auf Kommentare übersprungen — ` +
        "als Teilnahme zählt ein Kommentar unter dem Beitrag.",
    );
  }
  if (abgeschnitten) {
    warnings.push(
      `Es wurden die ersten ${comments.length} Kommentare eingelesen. ` +
        "Mehr lässt das Tool bewusst nicht auf einmal zu.",
    );
  }

  return {
    comments: abbruch ? [] : comments,
    warnings,
    abgeschnitten,
    abbruch,
    diagnose: { ...(diagnose ?? LEERE_DIAGNOSE), seiten, eintraege },
  };
}

const LEERE_DIAGNOSE: Diagnose = {
  url: "",
  status: 0,
  seiten: 0,
  eintraege: 0,
  antwort: "(keine Antwort)",
};

function kuerze(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… (gekürzt)` : text;
}

/// Fehlen die Benutzernamen so haeufig, dass der Import unbrauchbar waere?
///
/// Ein einzelnes geloeschtes Konto darf einen sauberen Abruf nicht blockieren —
/// deshalb eine Schwelle statt „einer reicht". Ueber der Schwelle stimmt aber
/// etwas Grundsaetzliches nicht, und dann ist ein Teilimport die schlechteste
/// aller Moeglichkeiten: Er sieht aus wie ein Erfolg.
///
/// Die Meldung behauptet **keine** Ursache als sicher. Bei genau dieser Frage
/// habe ich mehrfach danebengelegen — die Antwort steht im Diagnosekasten,
/// nicht in einer Vermutung.
export function namenFehlen(ohneNamen: number, gesamt: number): string | null {
  if (gesamt === 0 || ohneNamen === 0) return null;
  if (ohneNamen <= gesamt / 4) return null;

  return (
    `Bei ${ohneNamen} von ${gesamt} Kommentaren hat Instagram keinen ` +
    "Benutzernamen mitgeschickt. Ohne Namen lässt sich niemand zuordnen, " +
    "deshalb wurde **nichts** gespeichert — ein halber Lostopf wäre schlimmer " +
    "als keiner. Der wahrscheinlichste Grund: Dein Zugangsschlüssel trägt die " +
    "Berechtigung instagram_business_manage_comments nicht. Sie hängt am " +
    "Schlüssel, nicht am Konto — erzeug in der Meta-Konsole einen neuen, auch " +
    "wenn die Berechtigung dort längst angehakt ist. Was Instagram genau " +
    "geantwortet hat, steht unter „Was hat Instagram geantwortet?“."
  );
}

/// Der Name steht je nach Schnittstellenfassung direkt drin oder unter `from`.
/// Beides zu lesen kostet drei Zeilen und erspart einen leeren Import.
function benutzername(k: Record<string, unknown>): string {
  const direkt = String(k.username ?? "").trim();
  if (direkt) return direkt.replace(/^@/, "");
  const from = (k.from ?? {}) as Record<string, unknown>;
  return String(from.username ?? "").trim().replace(/^@/, "");
}

function datum(wert: unknown): Date | null {
  if (typeof wert !== "string" || !wert) return null;
  const d = new Date(wert);
  return Number.isNaN(d.getTime()) ? null : d;
}

function zahlOderNull(wert: unknown): number | null {
  const n = Number(wert);
  return Number.isFinite(n) ? n : null;
}
