"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit, slugify } from "@/lib/audit";
import {
  createSession,
  destroySession,
  getSessionUserId,
  hashPassword,
  ownerExists,
  verifyPassword,
} from "@/lib/auth";
import { evaluateEntries, type CommentInput, type RuleSpec } from "@/rules/engine";
import { entryFingerprint } from "@/rules/text";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { commit, draw, type Entrant } from "@/draw/commit-reveal";
import { prizeIdForSlot, resolveWinners } from "@/draw/promotion";
import {
  buildProofText,
  buildShortTerms,
  buildTerms,
} from "@/legal/teilnahmebedingungen";
import {
  buildIndexPage,
  buildPrivacyPage,
  buildPublishPage,
  withScheme,
  type IndexEntry,
  type PublishInput,
} from "@/legal/publish";
import { buildPrivacyPolicy } from "@/legal/datenschutz";
import { GitHubError, checkAccess, ensurePages, normalizeRepo, uploadFiles } from "@/lib/github";
import { decryptOptional, encrypt } from "@/lib/crypto";
import { parseManualImport } from "@/platforms/manual-import";
import { generateSandboxComments } from "@/platforms/sandbox";
import type { PlatformId } from "@/platforms/base";

async function requireUser() {
  const id = await getSessionUserId();
  if (!id) redirect("/admin/login");
  return id;
}

function fail(message: string): never {
  throw new Error(message);
}

// ── Einrichtung und Anmeldung ────────────────────────────────────────────────

export async function setupOwner(formData: FormData) {
  if (await ownerExists()) fail("Es existiert bereits ein Betreiberkonto.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) fail("Bitte eine gültige E-Mail-Adresse angeben.");
  if (password.length < 12)
    fail("Das Passwort muss mindestens 12 Zeichen lang sein.");

  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });

  await audit({ action: "owner.created", entity: "User", entityId: user.id, actor: email });
  await createSession(user.id);
  redirect("/admin");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUnique({ where: { email } });
  // Gleiche Meldung fuer beide Faelle — verraet nicht, ob die Adresse existiert.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    fail("E-Mail oder Passwort stimmt nicht.");
  }

  await createSession(user.id);
  await audit({ action: "login", entity: "User", entityId: user.id, actor: email });
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ── Gewinnspiele ─────────────────────────────────────────────────────────────

const ALL_PLATFORMS: PlatformId[] = [
  "SANDBOX",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
];

export async function createGiveaway(formData: FormData) {
  const userId = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const substituteCount = Number(formData.get("substituteCount") ?? 5);

  // Ein Gewinnspiel läuft in der Regel über mehrere Plattformen.
  const platforms = ALL_PLATFORMS.filter((p) => formData.get(`platform_${p}`) === "on");

  if (title.length < 3) fail("Der Titel muss mindestens 3 Zeichen lang sein.");
  if (platforms.length === 0) {
    fail("Bitte mindestens eine Plattform auswählen.");
  }

  // Slug eindeutig machen, ohne dem Nutzer einen Fehler zuzumuten.
  const base = slugify(title);
  let slug = base;
  for (let n = 2; await db.giveaway.findUnique({ where: { slug } }); n++) {
    slug = `${base}-${n}`;
  }

  const giveaway = await db.giveaway.create({
    data: {
      title,
      slug,
      substituteCount: Math.min(Math.max(substituteCount, 0), 50),
      startsAt: parseLocalDate(formData.get("startsAt")),
      endsAt: parseLocalDate(formData.get("endsAt")),
      status: "COLLECTING",
      sources: {
        create: platforms.map((platform) => ({
          platform,
          postUrl: String(formData.get(`postUrl_${platform}`) ?? "").trim() || null,
        })),
      },
      rules: {
        // Sinnvolle Voreinstellung: ein Los pro Person und Plattform.
        create: [{ type: "DEDUPE", config: { mode: "one_per_user" }, position: 100 }],
      },
    },
  });

  await audit({
    action: "giveaway.created",
    entity: "Giveaway",
    entityId: giveaway.id,
    actor: userId,
    detail: { title, platforms },
  });

  redirect(`/admin/${giveaway.id}`);
}

export async function deleteGiveaway(giveawayId: string) {
  const userId = await requireUser();
  await db.giveaway.delete({ where: { id: giveawayId } });
  await audit({
    action: "giveaway.deleted",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
  });
  redirect("/admin");
}

// ── Teilnahmen importieren ───────────────────────────────────────────────────

export interface StoreResult {
  added: number;
  skipped: number;
}

/// Speichert Teilnahmen und überspringt, was schon da ist.
///
/// Beim Einfügen von Hand gibt es keine Kommentar-ID der Plattform — TikTok
/// zeigt immer nur einen Ausschnitt, man muss also in Etappen kopieren.
/// Damit das nicht zu Dubletten führt (und damit zu doppelten Gewinnchancen),
/// wird zusätzlich über einen Fingerabdruck aus Name und Text abgeglichen.
async function storeComments(
  giveawayId: string,
  platform: PlatformId,
  comments: CommentInput[],
): Promise<StoreResult> {
  if (comments.length === 0) return { added: 0, skipped: 0 };

  const stored = await db.entry.findMany({
    where: { giveawayId, platform },
    select: { externalId: true, fingerprint: true },
  });

  const knownIds = new Set(
    stored.map((e) => e.externalId).filter((v): v is string => Boolean(v)),
  );
  const knownPrints = new Set(
    stored.map((e) => e.fingerprint).filter((v): v is string => Boolean(v)),
  );

  const fresh: { comment: CommentInput; fingerprint: string }[] = [];
  let skipped = 0;

  for (const c of comments) {
    const fingerprint = entryFingerprint(c.username, c.text);

    // SQLite kennt kein skipDuplicates — deshalb hier abgleichen, gegen die
    // Datenbank und innerhalb desselben Stapels.
    if (
      (c.externalId && knownIds.has(c.externalId)) ||
      knownPrints.has(fingerprint)
    ) {
      skipped += 1;
      continue;
    }

    if (c.externalId) knownIds.add(c.externalId);
    knownPrints.add(fingerprint);
    fresh.push({ comment: c, fingerprint });
  }

  if (fresh.length === 0) return { added: 0, skipped };

  const result = await db.entry.createMany({
    data: fresh.map(({ comment: c, fingerprint }) => ({
      giveawayId,
      platform,
      externalId: c.externalId ?? null,
      username: c.username.replace(/^@/, ""),
      userRef: c.userRef ?? null,
      text: c.text,
      commentedAt: c.commentedAt,
      likeCount: c.likeCount ?? 0,
      fingerprint,
    })),
  });

  return { added: result.count, skipped };
}

/// Wandelt eine Datumsangabe aus dem Formular (YYYY-MM-DDTHH:mm) in ein Datum.
function parseLocalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function importSandbox(giveawayId: string) {
  const userId = await requireUser();

  const comments = generateSandboxComments({ count: 250, seed: giveawayId });
  const { added, skipped } = await storeComments(giveawayId, "SANDBOX", comments);

  await audit({
    action: "entries.imported",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { source: "sandbox", added, skipped },
  });

  await runEvaluation(giveawayId);
}

export interface ImportPreviewResult {
  format: string;
  count: number;
  /// Die ersten Treffer zur Sichtkontrolle.
  sample: { username: string; text: string }[];
  warnings: string[];
}

const FORMAT_LABELS: Record<string, string> = {
  csv: "Tabelle mit Kopfzeile",
  inline: "„Name: Text“ je Zeile",
  blocks: "Name mit Kommentar darunter",
  leer: "leer",
};

/// Schritt 1: nur lesen und zeigen, was erkannt wurde — nichts speichern.
/// Bei einem Format, das erraten werden muss, gehoert die Sichtkontrolle
/// vor den Schreibzugriff, nicht danach.
export async function previewManualImport(
  raw: string,
): Promise<ImportPreviewResult> {
  await requireUser();

  const parsed = parseManualImport(raw);

  return {
    format: FORMAT_LABELS[parsed.format] ?? parsed.format,
    count: parsed.comments.length,
    sample: parsed.comments.slice(0, 10).map((c) => ({
      username: c.username,
      text: c.text,
    })),
    warnings: parsed.warnings.slice(0, 20),
  };
}

/// Schritt 2: uebernehmen. Erneut geparst, damit nichts aus dem Browser
/// die gespeicherten Daten bestimmt.
///
/// Gibt zurueck, wie viel wirklich neu war — beim Einlesen in Etappen ist
/// genau das die Information, die man braucht.
export async function confirmManualImport(
  giveawayId: string,
  platform: PlatformId,
  raw: string,
): Promise<StoreResult> {
  const userId = await requireUser();

  const parsed = parseManualImport(raw);
  if (parsed.comments.length === 0) {
    fail("Aus der Eingabe ließen sich keine Kommentare lesen.");
  }

  const result = await storeComments(giveawayId, platform, parsed.comments);

  await audit({
    action: "entries.imported",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: {
      source: "manual",
      platform,
      format: parsed.format,
      erkannt: parsed.comments.length,
      ...result,
      warnings: parsed.warnings.length,
    },
  });

  await runEvaluation(giveawayId);
  return result;
}

export async function clearEntries(giveawayId: string) {
  const userId = await requireUser();
  const { count } = await db.entry.deleteMany({ where: { giveawayId } });
  await audit({
    action: "entries.cleared",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { removed: count },
  });
  revalidatePath(`/admin/${giveawayId}`);
}

// ── Regeln ───────────────────────────────────────────────────────────────────

/// Speichert die Regeln aus dem einfachen Formular. Bewusst wenige,
/// verstaendliche Schalter statt eines Regel-Baukastens.
export async function saveRules(giveawayId: string, formData: FormData) {
  const userId = await requireUser();

  const rules: { type: RuleSpec["type"]; config: unknown; position: number }[] = [];

  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keywords.length > 0) {
    rules.push({
      type: "KEYWORD",
      config: { keywords, mode: String(formData.get("keywordMode") ?? "any") },
      position: 10,
    });
  }

  const mentionsMin = Number(formData.get("mentionsMin") ?? 0);
  if (mentionsMin > 0) {
    rules.push({ type: "MENTIONS", config: { min: mentionsMin }, position: 20 });
  }

  const minLength = Number(formData.get("minLength") ?? 0);
  if (minLength > 0) {
    rules.push({ type: "MIN_LENGTH", config: { min: minLength }, position: 30 });
  }

  const blocklist = String(formData.get("blocklist") ?? "")
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter(Boolean);
  if (blocklist.length > 0) {
    rules.push({ type: "BLOCKLIST", config: { usernames: blocklist }, position: 40 });
  }

  const bonusLots = Number(formData.get("bonusExtraLots") ?? 0);
  const bonusMentions = Number(formData.get("bonusMentionsAtLeast") ?? 0);
  if (bonusLots > 0 && bonusMentions > 0) {
    rules.push({
      type: "BONUS",
      config: {
        when: "mentions_at_least",
        mentionsAtLeast: bonusMentions,
        extraLots: bonusLots,
      },
      position: 50,
    });
  }

  rules.push({
    type: "DEDUPE",
    config: {
      mode: String(formData.get("dedupeMode") ?? "one_per_user"),
      max: Number(formData.get("dedupeMax") ?? 1),
    },
    position: 100,
  });

  // Teilnahmezeitraum: Ohne Einsendeschluss zählen verspätete Kommentare mit.
  const startsAt = parseLocalDate(formData.get("startsAt"));
  const endsAt = parseLocalDate(formData.get("endsAt"));

  if (startsAt && endsAt && endsAt <= startsAt) {
    fail("Der Einsendeschluss muss nach dem Start liegen.");
  }

  await db.giveaway.update({
    where: { id: giveawayId },
    data: {
      startsAt,
      endsAt,
      customTerms: String(formData.get("customTerms") ?? "").trim() || null,
    },
  });

  if (startsAt || endsAt) {
    rules.push({
      type: "TIMEWINDOW",
      config: {
        from: startsAt?.toISOString(),
        to: endsAt?.toISOString(),
      },
      position: 5,
    });
  }

  await db.$transaction([
    db.rule.deleteMany({ where: { giveawayId } }),
    db.rule.createMany({
      data: rules.map((r) => ({
        giveawayId,
        type: r.type,
        config: r.config as never,
        position: r.position,
      })),
    }),
  ]);

  await audit({
    action: "rules.saved",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { count: rules.length },
  });

  await runEvaluation(giveawayId);
}

/// Wendet die Regeln auf alle Teilnahmen an und schreibt Gueltigkeit,
/// Lose und Ablehnungsgruende zurueck.
export async function runEvaluation(giveawayId: string) {
  const userId = await requireUser();

  const giveaway = await db.giveaway.findUniqueOrThrow({
    where: { id: giveawayId },
    include: { rules: true, entries: true, account: true },
  });

  if (giveaway.status === "DRAWN" || giveaway.status === "COMPLETED") {
    fail("Nach der Ziehung lassen sich die Teilnahmen nicht mehr neu bewerten.");
  }

  const summary = evaluateEntries(
    giveaway.entries.map((e) => ({
      id: e.id,
      externalId: e.externalId,
      username: e.username,
      userRef: e.userRef,
      text: e.text,
      commentedAt: e.commentedAt,
      likeCount: e.likeCount,
      platform: e.platform,
    })),
    giveaway.rules.map((r) => ({
      type: r.type,
      config: r.config,
      enabled: r.enabled,
      position: r.position,
    })),
    { ownerHandle: giveaway.account?.handle ?? null },
  );

  // Zuordnung über die durchgereichte Kennung — eindeutig, auch wenn
  // derselbe Kommentar auf zwei Plattformen steht.
  const byId = new Map(summary.entries.map((e) => [e.id, e]));

  await db.$transaction(
    giveaway.entries.map((entry) => {
      const evaluated = byId.get(entry.id);
      return db.entry.update({
        where: { id: entry.id },
        data: {
          valid: evaluated?.valid ?? false,
          lots: evaluated?.lots ?? 0,
          rejections: (evaluated?.rejections ?? []) as never,
        },
      });
    }),
  );

  await audit({
    action: "entries.evaluated",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: {
      valid: summary.validCount,
      rejected: summary.rejectedCount,
      lots: summary.totalLots,
    },
  });

  revalidatePath(`/admin/${giveawayId}`);
}

// ── Ziehung: erst festschreiben, dann ziehen ─────────────────────────────────

/// Schritt 1: Teilnehmerliste einfrieren und Hash veroeffentlichen.
/// Der Seed bleibt geheim, bis gezogen wurde.
export async function commitEntrants(giveawayId: string) {
  const userId = await requireUser();

  const giveaway = await db.giveaway.findUniqueOrThrow({
    where: { id: giveawayId },
    include: {
      entries: { where: { valid: true } },
      prizes: true,
    },
  });

  if (giveaway.status !== "COLLECTING") {
    fail("Die Teilnehmerliste wurde bereits festgeschrieben.");
  }
  if (giveaway.entries.length === 0) {
    fail("Es gibt keine gültigen Teilnahmen. Bitte zuerst importieren und die Regeln prüfen.");
  }

  // Die Plattform gehört in die Referenz — sonst wären @anna von TikTok und
  // @anna von Instagram in der veröffentlichten Liste nicht unterscheidbar.
  const entrants: Entrant[] = giveaway.entries.map((e) => ({
    id: e.id,
    username: `${e.username}@${e.platform.toLowerCase()}`,
    lots: e.lots,
    ref: e.externalId ?? `${e.platform}-${e.username}-${e.commentedAt.getTime()}`,
  }));

  const c = commit(entrants);

  // So viele Gewinnplätze wie Gewinne — mindestens einer.
  const winnerSlots = Math.max(
    1,
    giveaway.prizes.reduce((sum, p) => sum + Math.max(1, p.quantity), 0),
  );

  await db.$transaction([
    db.draw.create({
      data: {
        giveawayId,
        commitHash: c.commitHash,
        seed: c.seed,
        algorithmVersion: c.algorithmVersion,
        entrantsSnapshot: entrants as never,
        entrantCount: c.entrantCount,
        totalLots: c.totalLots,
        winnerSlots,
      },
    }),
    db.giveaway.update({
      where: { id: giveawayId },
      data: { status: "COMMITTED" },
    }),
  ]);

  await audit({
    action: "draw.committed",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { commitHash: c.commitHash, entrants: c.entrantCount, lots: c.totalLots },
  });

  revalidatePath(`/admin/${giveawayId}`);
}

/// Schritt 2: Ziehen und den Seed offenlegen.
export async function performDraw(giveawayId: string) {
  const userId = await requireUser();

  const giveaway = await db.giveaway.findUniqueOrThrow({
    where: { id: giveawayId },
    include: {
      draws: { orderBy: { committedAt: "desc" }, take: 1 },
      prizes: { orderBy: { rank: "asc" } },
    },
  });

  const pending = giveaway.draws[0];
  if (!pending) fail("Es wurde noch keine Teilnehmerliste festgeschrieben.");
  if (pending.drawnAt) fail("Diese Ziehung wurde bereits durchgeführt.");
  if (!pending.seed) fail("Der Seed dieser Ziehung fehlt.");

  const entrants = pending.entrantsSnapshot as unknown as Entrant[];

  // Erst die Gewinnplätze, danach die Nachrücker. Vorher bekamen Nachrücker
  // fälschlich Preise zugeteilt, weil Rang 1 gleichzeitig „zweiter Preis"
  // und „erster Nachrücker" bedeutete.
  const winnerSlots = pending.winnerSlots;
  const outcome = draw(entrants, pending.seed, winnerSlots + giveaway.substituteCount);

  // Gewinne der Reihe nach auf die Gewinnplätze verteilen; quantity > 1
  // belegt entsprechend mehrere Plätze.
  const prizeBySlot: (string | null)[] = [];
  for (const prize of giveaway.prizes) {
    for (let n = 0; n < Math.max(1, prize.quantity); n++) prizeBySlot.push(prize.id);
  }

  await db.$transaction([
    db.drawResult.createMany({
      data: outcome.winners.map((w, index) => ({
        drawId: pending.id,
        entryId: w.id,
        rank: index,
        // Nur Gewinnplätze tragen einen Gewinn — Nachrücker nicht.
        prizeId: index < winnerSlots ? (prizeBySlot[index] ?? null) : null,
      })),
    }),
    db.draw.update({
      where: { id: pending.id },
      data: { drawnAt: new Date(), seedRevealedAt: new Date() },
    }),
    db.giveaway.update({
      where: { id: giveawayId },
      data: { status: "VERIFYING" },
    }),
  ]);

  await audit({
    action: "draw.performed",
    entity: "Draw",
    entityId: pending.id,
    actor: userId,
    detail: {
      winners: outcome.winners.map((w) => w.username),
      commitHash: pending.commitHash,
    },
  });

  revalidatePath(`/admin/${giveawayId}`);
}

// ── Verifikation von Gewinner und Nachrueckern ───────────────────────────────

/// Bestätigt oder lehnt einen Kandidaten ab.
///
/// Folgen und Liken lassen sich über keine Plattform automatisch prüfen.
/// Deshalb entscheidet hier ausschließlich dein Urteil — das Tool zwingt
/// niemanden, Häkchen für etwas zu setzen, das er nicht geprüft hat.
/// `follows`/`liked` bleiben als freiwillige Stichprobe erhalten.
export async function setVerification(
  drawResultId: string,
  passed: boolean,
  follows: boolean | null = null,
  liked: boolean | null = null,
  note?: string,
) {
  const userId = await requireUser();

  await db.verification.upsert({
    where: { drawResultId },
    create: {
      drawResultId,
      follows,
      liked,
      checkedBy: userId,
      note: note ?? null,
    },
    update: { follows, liked, checkedBy: userId, checkedAt: new Date(), note: note ?? null },
  });

  const result = await db.drawResult.update({
    where: { id: drawResultId },
    data: { status: passed ? "CONFIRMED" : "REJECTED" },
    include: { draw: true },
  });

  await audit({
    action: passed ? "verification.confirmed" : "verification.rejected",
    entity: "DrawResult",
    entityId: drawResultId,
    actor: userId,
    detail: { follows, liked },
  });

  revalidatePath(`/admin/${result.draw.giveawayId}`);
}

/// Formularvariante: „Bestätigen" oder „Ablehnen" als bewusste Entscheidung.
export async function submitVerification(
  drawResultId: string,
  passed: boolean,
  formData: FormData,
) {
  await setVerification(
    drawResultId,
    passed,
    formData.get("follows") === "on" ? true : null,
    formData.get("liked") === "on" ? true : null,
    String(formData.get("note") ?? "").trim() || undefined,
  );
}

/// Nimmt die Festschreibung zurück, solange noch nicht gezogen wurde.
///
/// Nach der Ziehung bleibt die Liste unantastbar — sonst wäre der ganze
/// Nachweis wertlos.
export async function releaseCommit(giveawayId: string) {
  const userId = await requireUser();

  const pending = await db.draw.findFirst({
    where: { giveawayId },
    orderBy: { committedAt: "desc" },
  });

  if (!pending) fail("Es gibt keine festgeschriebene Liste.");
  if (pending.drawnAt) {
    fail(
      "Es wurde bereits gezogen. Die Liste bleibt jetzt unverändert — sonst wäre der veröffentlichte Nachweis wertlos.",
    );
  }

  await db.$transaction([
    db.draw.delete({ where: { id: pending.id } }),
    db.giveaway.update({
      where: { id: giveawayId },
      data: { status: "COLLECTING" },
    }),
  ]);

  await audit({
    action: "draw.released",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { commitHash: pending.commitHash, entrants: pending.entrantCount },
  });

  revalidatePath(`/admin/${giveawayId}`);
}

/// Fährt das Tool herunter. Die Antwort geht noch raus, danach endet der
/// Serverprozess — und mit ihm schließt sich das Konsolenfenster.
export async function shutdownServer() {
  const userId = await requireUser();

  await audit({ action: "app.shutdown", entity: "App", actor: userId });

  setTimeout(() => process.exit(0), 700);
}

// ── Rechtstexte und Veröffentlichung ─────────────────────────────────────────

const PUBLISH_DIR = "veroeffentlichung";
const EIGENE_SEITEN = ["index.html", "datenschutz.html"];

/// Schreibt die Startseite des Veroeffentlichungsordners neu.
///
/// Grundlage sind die Dateien, die tatsaechlich im Ordner liegen — nicht die
/// Gewinnspiele in der Datenbank. Aufgelistet wird damit nur, was auch
/// hochgeladen werden kann.
async function writeIndexPage() {
  const dir = join(process.cwd(), PUBLISH_DIR);
  await mkdir(dir, { recursive: true });

  let files: string[] = [];
  try {
    // Startseite und Datenschutzerklaerung sind keine Gewinnspiele.
    files = (await readdir(dir)).filter(
      (name) => name.endsWith(".html") && !EIGENE_SEITEN.includes(name),
    );
  } catch {
    files = [];
  }

  const slugs = files.map((name) => name.slice(0, -".html".length));
  const giveaways =
    slugs.length > 0
      ? await db.giveaway.findMany({ where: { slug: { in: slugs } } })
      : [];
  const bySlug = new Map(giveaways.map((g) => [g.slug, g]));

  const entries: IndexEntry[] = slugs.map((slug) => {
    const giveaway = bySlug.get(slug);
    return {
      slug,
      // Fehlt das Gewinnspiel in der Datenbank, bleibt die Datei trotzdem
      // erreichbar — sie liegt ja online. Nur der Titel fehlt dann.
      title: giveaway?.title ?? slug,
      endsAt: giveaway?.endsAt ?? null,
      completed: giveaway?.status === "COMPLETED",
    };
  });

  entries.sort((a, b) => a.title.localeCompare(b.title, "de"));

  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  const html = buildIndexPage({
    organizer: settings?.organizer ?? "",
    contact: settings?.contact ?? "",
    impressumUrl: settings?.impressumUrl ?? "",
    entries,
  });

  await writeFile(join(dir, "index.html"), html, "utf8");

  // Die Datenschutzerklaerung gehoert zu jeder Veroeffentlichung dazu und
  // wird jedes Mal neu geschrieben — sonst haengt sie hinterher, sobald sich
  // Kontakt oder Fristen aendern.
  await writeFile(join(dir, "datenschutz.html"), await buildPrivacyHtml(), "utf8");

  return { fileName: "index.html", count: entries.length };
}

/// Die Datenschutzerklaerung als fertige Seite.
async function buildPrivacyHtml() {
  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  const sources = await db.giveawaySource.findMany({
    distinct: ["platform"],
    select: { platform: true },
  });

  const who = {
    organizer: settings?.organizer ?? "",
    contact: settings?.contact ?? "",
    publishBaseUrl: settings?.publishBaseUrl ?? "",
    impressumUrl: settings?.impressumUrl ?? "",
  };

  const text = buildPrivacyPolicy(who, {
    // Die Aufbewahrung steht je Gewinnspiel; genannt wird die laengste, denn
    // eine kuerzere Angabe waere zu optimistisch.
    retentionDays: await longestRetention(),
    publishRetentionMonths: settings?.publishRetentionMonths ?? 6,
    platforms: sources.map((s) => s.platform as PlatformId),
  });

  return buildPrivacyPage({ text, ...who });
}

async function longestRetention() {
  const max = await db.giveaway.aggregate({ _max: { retentionDays: true } });
  return max._max.retentionDays ?? 30;
}

/// Alle Dateien des Ordners — zum Hochladen.
async function publishedFiles() {
  const dir = join(process.cwd(), PUBLISH_DIR);
  const namen = (await readdir(dir)).filter((n) => n.endsWith(".html"));
  return Promise.all(
    namen.map(async (path) => ({
      path,
      content: await readFile(join(dir, path), "utf8"),
    })),
  );
}

/// Zugang zu GitHub, sofern hinterlegt.
async function githubZugang() {
  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  const repo = settings?.githubRepo?.trim();
  const token = decryptOptional(settings?.githubToken || null);
  if (!repo || !token) return null;
  return { repo, token };
}

export interface UploadErgebnis {
  hochgeladen: boolean;
  commitUrl?: string;
  pagesUrl?: string;
  hinweis?: string;
}

/// Laedt hoch, wenn ein Schluessel hinterlegt ist.
///
/// Schlaegt es fehl, ist das kein Grund abzubrechen: Die Dateien sind bereits
/// geschrieben. Der Fehler wird als Hinweis weitergereicht, damit niemand
/// glaubt, die Arbeit sei verloren.
async function ladeHoch(
  files: { path: string; content: string }[],
  message: string,
): Promise<UploadErgebnis> {
  const zugang = await githubZugang();
  if (!zugang) return { hochgeladen: false };

  try {
    const ergebnis = await uploadFiles({ ...zugang, files, message });
    const pages = await ensurePages(zugang);
    return {
      hochgeladen: true,
      commitUrl: ergebnis.commitUrl,
      pagesUrl: pages.url,
      hinweis: pages.hinweis,
    };
  } catch (error) {
    return {
      hochgeladen: false,
      hinweis:
        error instanceof GitHubError
          ? error.message
          : "Das Hochladen hat nicht geklappt. Die Dateien liegen im Ordner veroeffentlichung.",
    };
  }
}

/// Erzeugt allein die Übersichtsseite.
///
/// Gebraucht wird das vor dem ersten Gewinnspiel: GitHub Pages laesst sich
/// erst einschalten, wenn im Repository ueberhaupt etwas liegt.
export async function publishIndex() {
  const userId = await requireUser();
  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  if (!settings?.organizer?.trim() || !settings?.contact?.trim()) {
    fail(
      "Für die Übersichtsseite fehlen die Veranstalterangaben. " +
        "Bitte oben Name und Kontakt eintragen und speichern.",
    );
  }

  const result = await writeIndexPage();
  // Alle Dateien mitnehmen: repariert nebenbei, was einmal ohne Netz entstand.
  const upload = await ladeHoch(await publishedFiles(), "Übersichtsseite aktualisiert");

  await audit({
    action: "index.published",
    entity: "Settings",
    entityId: "settings",
    actor: userId,
    detail: { count: result.count, hochgeladen: upload.hochgeladen },
  });

  revalidatePath("/admin/einstellungen");
  return { ...result, ...upload };
}

async function loadForTerms(giveawayId: string) {
  const giveaway = await db.giveaway.findUniqueOrThrow({
    where: { id: giveawayId },
    include: {
      sources: { orderBy: { platform: "asc" } },
      prizes: { orderBy: { rank: "asc" } },
      rules: { orderBy: { position: "asc" } },
      draws: {
        orderBy: { committedAt: "desc" },
        take: 1,
        include: {
          results: {
            orderBy: { rank: "asc" },
            include: { entry: true, prize: true },
          },
        },
      },
    },
  });

  const settings = await db.settings.findUnique({ where: { id: "settings" } });

  return {
    giveaway,
    who: {
      organizer: settings?.organizer ?? "",
      contact: settings?.contact ?? "",
      publishBaseUrl: settings?.publishBaseUrl ?? "",
      impressumUrl: settings?.impressumUrl ?? "",
    },
    forTerms: {
      title: giveaway.title,
      slug: giveaway.slug,
      description: giveaway.description,
      startsAt: giveaway.startsAt,
      endsAt: giveaway.endsAt,
      substituteCount: giveaway.substituteCount,
      customTerms: giveaway.customTerms,
      sources: giveaway.sources.map((s) => ({
        platform: s.platform,
        postUrl: s.postUrl,
      })),
      prizes: giveaway.prizes.map((p) => ({
        title: p.title,
        description: p.description,
        quantity: p.quantity,
      })),
      rules: giveaway.rules.map((r) => ({
        type: r.type,
        config: r.config,
        enabled: r.enabled,
      })),
    },
  };
}

export interface TextsResult {
  lang: string;
  kurz: string;
  kurzLaenge: number;
  kurzPasst: boolean;
  nachweis: string | null;
}

/// Liefert Teilnahmebedingungen (lang und kurz) sowie den Nachweis-Text.
export async function buildTexts(giveawayId: string): Promise<TextsResult> {
  await requireUser();
  const { giveaway, who, forTerms } = await loadForTerms(giveawayId);

  const lang = buildTerms(forTerms, who);
  const kurz = buildShortTerms(forTerms, who);

  const draw = giveaway.draws[0];
  const listUrl = who.publishBaseUrl
    ? `${who.publishBaseUrl}/${giveaway.slug}.html`
    : null;

  return {
    lang,
    kurz: kurz.text,
    kurzLaenge: kurz.length,
    kurzPasst: kurz.fitsCaption,
    nachweis: draw
      ? buildProofText({
          title: giveaway.title,
          commitHash: draw.commitHash,
          entrantCount: draw.entrantCount,
          totalLots: draw.totalLots,
          committedAt: draw.committedAt,
          seed: draw.seedRevealedAt ? draw.seed : null,
          drawnAt: draw.drawnAt,
          listUrl,
        })
      : null,
  };
}

/// Erzeugt die Datei für GitHub Pages.
export async function publishPage(giveawayId: string) {
  const userId = await requireUser();
  const { giveaway, who, forTerms } = await loadForTerms(giveawayId);

  const terms = buildTerms(forTerms, who);
  const draw = giveaway.draws[0];

  let drawData: PublishInput["draw"] = null;
  if (draw) {
    const slotCandidates = draw.results.map((r) => ({
      id: r.id,
      rank: r.rank,
      status: r.status,
      prizeId: r.prizeId,
    }));
    const resolved = resolveWinners(slotCandidates, draw.winnerSlots);
    const byId = new Map(draw.results.map((r) => [r.id, r]));
    const prizeById = new Map(giveaway.prizes.map((p) => [p.id, p]));

    drawData = {
      commitHash: draw.commitHash,
      entrantCount: draw.entrantCount,
      totalLots: draw.totalLots,
      committedAt: draw.committedAt,
      seed: draw.seedRevealedAt ? draw.seed : null,
      drawnAt: draw.drawnAt,
      entrants: draw.entrantsSnapshot as unknown as Entrant[],
      winners: resolved.winners.flatMap((w) => {
        const result = w.candidate ? byId.get(w.candidate.id) : null;
        if (!result) return [];
        return [
          {
            platz: w.slot + 1,
            username: `@${result.entry.username}`,
            // Der Gewinn hängt am Platz — Nachrücker erben ihn.
            prize:
              prizeById.get(prizeIdForSlot(slotCandidates, w.slot) ?? "")?.title ??
              null,
            text: result.entry.text,
          },
        ];
      }),
      reserves: resolved.reserves.flatMap((r) => {
        const result = byId.get(r.id);
        return result ? [`@${result.entry.username}`] : [];
      }),
    };
  }

  const html = buildPublishPage({
    title: giveaway.title,
    terms,
    organizer: who.organizer,
    contact: who.contact,
    impressumUrl: who.impressumUrl,
    draw: drawData,
  });

  const dir = join(process.cwd(), PUBLISH_DIR);
  await mkdir(dir, { recursive: true });
  const fileName = `${giveaway.slug}.html`;
  await writeFile(join(dir, fileName), html, "utf8");

  // Die Übersicht wird jedes Mal neu geschrieben, damit sie nicht
  // hinterherhinkt.
  await writeIndexPage();

  const upload = await ladeHoch(
    await publishedFiles(),
    `Gewinnspiel veröffentlicht: ${giveaway.title}`,
  );

  await audit({
    action: "giveaway.published",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: {
      fileName,
      withResults: Boolean(drawData?.drawnAt),
      hochgeladen: upload.hochgeladen,
    },
  });

  return {
    fileName,
    url: who.publishBaseUrl ? `${who.publishBaseUrl}/${fileName}` : null,
    ...upload,
  };
}

// ── Veranstalterangaben ──────────────────────────────────────────────────────

export async function saveSettings(formData: FormData) {
  const userId = await requireUser();

  const organizer = String(formData.get("organizer") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const publishBaseUrl = withScheme(
    String(formData.get("publishBaseUrl") ?? "").trim().replace(/\/+$/, ""),
  );
  const impressumUrl = withScheme(String(formData.get("impressumUrl") ?? "").trim());
  const githubRepo = normalizeRepo(String(formData.get("githubRepo") ?? ""));
  const publishRetentionMonths = Math.min(
    Math.max(Number(formData.get("publishRetentionMonths") ?? 6), 1),
    120,
  );

  if (!organizer) fail("Bitte den Namen des Veranstalters angeben.");
  if (!contact) fail("Bitte eine Kontaktmöglichkeit angeben.");

  // Ein leeres Feld heisst „unveraendert", nicht „loeschen" — sonst waere
  // der Schluessel nach jedem Speichern der uebrigen Angaben weg.
  const eingegeben = String(formData.get("githubToken") ?? "").trim();
  const githubToken = eingegeben ? encrypt(eingegeben) : undefined;

  const gemeinsam = {
    organizer,
    contact,
    publishBaseUrl,
    impressumUrl,
    githubRepo,
    publishRetentionMonths,
  };

  await db.settings.upsert({
    where: { id: "settings" },
    create: { id: "settings", ...gemeinsam, githubToken: githubToken ?? "" },
    update: { ...gemeinsam, ...(githubToken ? { githubToken } : {}) },
  });

  await audit({
    action: "settings.saved",
    entity: "Settings",
    entityId: "settings",
    actor: userId,
  });

  revalidatePath("/admin/einstellungen");
}

/// Prueft Zugang und Zustand, bevor es darauf ankommt.
///
/// Ein falscher Schluessel faellt sonst erst beim Veroeffentlichen auf —
/// also genau dann, wenn es eilt.
export async function testGitHubConnection() {
  await requireUser();
  const zugang = await githubZugang();
  if (!zugang) {
    fail(
      "Trag zuerst Repository und Zugangsschlüssel ein und speichere sie.",
    );
  }

  const ergebnis = await checkAccess(zugang);
  const teile = [`Verbunden mit ${ergebnis.repo}.`];
  teile.push(
    ergebnis.darfSchreiben
      ? "Schreiben ist erlaubt."
      : "Achtung: Der Schlüssel darf nicht schreiben — prüf die Berechtigung „Contents“.",
  );
  if (ergebnis.pagesAn) {
    teile.push(`GitHub Pages läuft: ${ergebnis.pagesUrl}`);
  } else if (ergebnis.pagesUnbekannt) {
    teile.push(
      "Ob GitHub Pages läuft, lässt sich nicht sagen — dem Schlüssel fehlt die Berechtigung „Pages“.",
    );
  } else {
    teile.push(
      "GitHub Pages ist noch aus. Das Tool schaltet es beim nächsten Hochladen ein.",
    );
  }
  if (ergebnis.privat) {
    teile.push(
      "Hinweis: Das Repository ist privat. GitHub Pages braucht dafür ein bezahltes Konto — für ein öffentliches ist es kostenlos.",
    );
  }
  return { meldung: teile.join(" ") };
}

/// Entfernt den hinterlegten Schluessel.
export async function removeGitHubToken() {
  const userId = await requireUser();
  await db.settings.update({
    where: { id: "settings" },
    data: { githubToken: "" },
  });
  await audit({
    action: "settings.token_removed",
    entity: "Settings",
    entityId: "settings",
    actor: userId,
  });
  revalidatePath("/admin/einstellungen");
}

export async function completeGiveaway(giveawayId: string) {
  const userId = await requireUser();
  await db.giveaway.update({
    where: { id: giveawayId },
    data: { status: "COMPLETED" },
  });
  await audit({
    action: "giveaway.completed",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
  });
  revalidatePath(`/admin/${giveawayId}`);
}

// ── Preise ───────────────────────────────────────────────────────────────────

export async function addPrize(giveawayId: string, formData: FormData) {
  const userId = await requireUser();

  const title = String(formData.get("prizeTitle") ?? "").trim();
  if (!title) fail("Der Gewinn braucht einen Namen.");

  const count = await db.prize.count({ where: { giveawayId } });

  await db.prize.create({
    data: {
      giveawayId,
      title,
      description: String(formData.get("prizeDescription") ?? "").trim() || null,
      imageUrl: String(formData.get("prizeImageUrl") ?? "").trim() || null,
      rank: count,
    },
  });

  await audit({
    action: "prize.added",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { title },
  });

  revalidatePath(`/admin/${giveawayId}`);
}

export async function deletePrize(prizeId: string) {
  const userId = await requireUser();
  const prize = await db.prize.delete({ where: { id: prizeId } });
  await audit({
    action: "prize.deleted",
    entity: "Prize",
    entityId: prizeId,
    actor: userId,
  });
  revalidatePath(`/admin/${prize.giveawayId}`);
}

// ── Betroffenenrechte (Art. 15 / 17 DSGVO) ───────────────────────────────────

/// Loescht alle Teilnahmen einer Person ueber alle Gewinnspiele hinweg.
export async function eraseParticipant(username: string) {
  const userId = await requireUser();
  const clean = username.trim().replace(/^@/, "");
  if (!clean) fail("Bitte einen Benutzernamen angeben.");

  // SQLite kennt kein "mode: insensitive". Deshalb erst grob per LIKE
  // vorfiltern (auf SQLite ohnehin ohne Ruecksicht auf Gross-/Kleinschreibung)
  // und dann exakt vergleichen — sonst wuerde @Anna neben @anna stehenbleiben.
  const candidates = await db.entry.findMany({
    where: { username: { contains: clean } },
    select: { id: true, username: true },
  });

  const ids = candidates
    .filter((e) => e.username.toLowerCase() === clean.toLowerCase())
    .map((e) => e.id);

  const { count } = await db.entry.deleteMany({ where: { id: { in: ids } } });

  await db.dataRequest.create({
    data: {
      type: "ERASURE",
      subject: clean,
      status: "DONE",
      note: `${count} Teilnahmen gelöscht.`,
      completedAt: new Date(),
    },
  });

  await audit({
    action: "gdpr.erasure",
    entity: "Entry",
    actor: userId,
    detail: { subject: clean, removed: count },
  });

  revalidatePath("/admin/datenschutz");
  return count;
}
