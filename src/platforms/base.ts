import type { CommentInput } from "@/rules/engine";

export type PlatformId =
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "TWITCH"
  | "SANDBOX";

/// Was eine Plattform tatsaechlich hergibt — nicht, was man sich wuenscht.
///
/// Diese Angaben steuern die Oberflaeche: Was hier `false` ist, wird gar
/// nicht erst als Knopf angeboten, sondern mit Begruendung erklaert.
/// So entstehen keine Versprechen, die die API nicht halten kann.
export interface PlatformCapabilities {
  /// Kann die API Kommentare zum eigenen Beitrag lesen?
  canFetchComments: boolean;
  /// Kann die API die eigenen Beitraege auflisten?
  canListMedia: boolean;
  /// Kann automatisch geprueft werden, ob jemand folgt?
  canCheckFollow: boolean;
  /// Kann automatisch geprueft werden, ob jemand geliked hat?
  canCheckLike: boolean;
  /// Muessen Teilnahmen von Hand importiert werden?
  needsManualImport: boolean;
  /// Klartext fuer die Oberflaeche.
  notes: string;
}

export interface MediaItem {
  externalId: string;
  caption: string;
  url: string;
  thumbnailUrl?: string | null;
  publishedAt: Date;
  commentCount?: number | null;
}

export interface FetchCommentsOptions {
  postExternalId: string;
  accessToken?: string;
  /// Sicherheitsnetz gegen ausufernde Importe.
  maxComments?: number;
}

export interface PlatformAdapter {
  id: PlatformId;
  label: string;
  capabilities: PlatformCapabilities;
  /// Direktlink zum Profil — Grundlage der Verifikations-Checkliste.
  profileUrl(username: string): string;
  listMedia?(accessToken: string): Promise<MediaItem[]>;
  fetchComments?(options: FetchCommentsOptions): Promise<CommentInput[]>;
}

const INSTAGRAM: PlatformAdapter = {
  id: "INSTAGRAM",
  label: "Instagram",
  capabilities: {
    canFetchComments: true,
    canListMedia: true,
    canCheckFollow: false,
    canCheckLike: false,
    needsManualImport: false,
    notes:
      "Kommentare inklusive Benutzername kommen automatisch, sobald ein eigenes " +
      "Profi-Konto verbunden ist — ohne Freigabe durch Meta und ohne Facebook-Seite. " +
      "Ohne Verbindung bleibt der Weg über Einfügen offen. " +
      "Wer geliked hat und wer folgt, gibt Instagram seit 2018 nicht mehr heraus — " +
      "das wird bei Gewinner und Nachrückern von Hand geprüft.",
  },
  profileUrl: (u) => `https://www.instagram.com/${clean(u)}/`,
};

const TIKTOK: PlatformAdapter = {
  id: "TIKTOK",
  label: "TikTok",
  capabilities: {
    canFetchComments: false,
    canListMedia: true,
    canCheckFollow: false,
    canCheckLike: false,
    needsManualImport: true,
    notes:
      "TikTok bietet keinen Zugriff auf Kommentare unter eigenen Videos: " +
      "Die offiziellen Berechtigungen umfassen nur video.list, video.publish und video.upload. " +
      "Die Kommentare werden deshalb eingefügt oder als CSV importiert.",
  },
  profileUrl: (u) => `https://www.tiktok.com/@${clean(u)}`,
};

const YOUTUBE: PlatformAdapter = {
  id: "YOUTUBE",
  label: "YouTube",
  capabilities: {
    canFetchComments: true,
    canListMedia: true,
    canCheckFollow: false,
    canCheckLike: false,
    needsManualImport: false,
    notes:
      "Kommentare kommen automatisch über die YouTube Data API — dafür genügt ein API-Key, " +
      "es braucht weder OAuth noch eine Freigabe. Abos und Likes sind nicht personenbezogen abrufbar.",
  },
  profileUrl: (u) => `https://www.youtube.com/@${clean(u)}`,
};

const TWITCH: PlatformAdapter = {
  id: "TWITCH",
  label: "Twitch",
  capabilities: {
    canFetchComments: false,
    canListMedia: false,
    canCheckFollow: true,
    canCheckLike: false,
    needsManualImport: false,
    notes:
      "Twitch kennt keine Kommentare — Teilnahmen kommen aus dem Live-Chat. " +
      "Dafür lässt sich hier als einziger Plattform automatisch prüfen, ob jemand folgt.",
  },
  profileUrl: (u) => `https://www.twitch.tv/${clean(u)}`,
};

const SANDBOX: PlatformAdapter = {
  id: "SANDBOX",
  label: "Testmodus",
  capabilities: {
    canFetchComments: true,
    canListMedia: true,
    canCheckFollow: false,
    canCheckLike: false,
    needsManualImport: false,
    notes:
      "Testmodus mit erfundenen Teilnehmern. Zum Ausprobieren des gesamten Ablaufs, " +
      "ohne echte Daten und ohne Zugang zu einer Plattform.",
  },
  profileUrl: (u) => `#profil-${clean(u)}`,
};

export const PLATFORMS: Record<PlatformId, PlatformAdapter> = {
  INSTAGRAM,
  TIKTOK,
  YOUTUBE,
  TWITCH,
  SANDBOX,
};

export function getPlatform(id: PlatformId): PlatformAdapter {
  const adapter = PLATFORMS[id];
  if (!adapter) throw new Error(`Unbekannte Plattform: ${id}`);
  return adapter;
}

function clean(username: string) {
  return username.trim().replace(/^@/, "");
}
