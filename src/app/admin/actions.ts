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
import { commit, draw, type Entrant } from "@/draw/commit-reveal";
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

export async function createGiveaway(formData: FormData) {
  const userId = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const platform = String(formData.get("platform") ?? "SANDBOX") as PlatformId;
  const substituteCount = Number(formData.get("substituteCount") ?? 5);

  if (title.length < 3) fail("Der Titel muss mindestens 3 Zeichen lang sein.");

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
      platform,
      substituteCount: Math.min(Math.max(substituteCount, 0), 50),
      postUrl: String(formData.get("postUrl") ?? "").trim() || null,
      status: "COLLECTING",
      rules: {
        // Sinnvolle Voreinstellung: ein Los pro Person.
        create: [{ type: "DEDUPE", config: { mode: "one_per_user" }, position: 100 }],
      },
    },
  });

  await audit({
    action: "giveaway.created",
    entity: "Giveaway",
    entityId: giveaway.id,
    actor: userId,
    detail: { title, platform },
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

async function storeComments(giveawayId: string, comments: CommentInput[]) {
  if (comments.length === 0) return 0;

  // Doppelimport derselben Kommentare soll harmlos sein. SQLite kennt kein
  // skipDuplicates, deshalb wird vorher abgeglichen — gegen die Datenbank
  // und innerhalb des Stapels selbst.
  const stored = await db.entry.findMany({
    where: { giveawayId, externalId: { not: null } },
    select: { externalId: true },
  });

  const seen = new Set(stored.map((e) => e.externalId));
  const fresh: CommentInput[] = [];

  for (const c of comments) {
    // Kommentare ohne Plattform-ID (Einfuegen von Hand) lassen sich nicht
    // zuverlaessig abgleichen — sie kommen durch.
    if (c.externalId) {
      if (seen.has(c.externalId)) continue;
      seen.add(c.externalId);
    }
    fresh.push(c);
  }

  if (fresh.length === 0) return 0;

  const result = await db.entry.createMany({
    data: fresh.map((c) => ({
      giveawayId,
      externalId: c.externalId ?? null,
      username: c.username.replace(/^@/, ""),
      userRef: c.userRef ?? null,
      text: c.text,
      commentedAt: c.commentedAt,
      likeCount: c.likeCount ?? 0,
    })),
  });

  return result.count;
}

export async function importSandbox(giveawayId: string) {
  const userId = await requireUser();

  const comments = generateSandboxComments({ count: 250, seed: giveawayId });
  const added = await storeComments(giveawayId, comments);

  await audit({
    action: "entries.imported",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: { source: "sandbox", added },
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
export async function confirmManualImport(giveawayId: string, raw: string) {
  const userId = await requireUser();

  const parsed = parseManualImport(raw);
  if (parsed.comments.length === 0) {
    fail("Aus der Eingabe ließen sich keine Kommentare lesen.");
  }

  const added = await storeComments(giveawayId, parsed.comments);

  await audit({
    action: "entries.imported",
    entity: "Giveaway",
    entityId: giveawayId,
    actor: userId,
    detail: {
      source: "manual",
      format: parsed.format,
      erkannt: parsed.comments.length,
      added,
      warnings: parsed.warnings.length,
    },
  });

  await runEvaluation(giveawayId);
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
      externalId: e.externalId,
      username: e.username,
      userRef: e.userRef,
      text: e.text,
      commentedAt: e.commentedAt,
      likeCount: e.likeCount,
    })),
    giveaway.rules.map((r) => ({
      type: r.type,
      config: r.config,
      enabled: r.enabled,
      position: r.position,
    })),
    { ownerHandle: giveaway.account?.handle ?? null },
  );

  // Zuordnung ueber externalId, ersatzweise Name + Zeitpunkt.
  const byKey = new Map(
    summary.entries.map((e) => [
      e.externalId ?? `${e.username}@${e.commentedAt.getTime()}`,
      e,
    ]),
  );

  await db.$transaction(
    giveaway.entries.map((entry) => {
      const key = entry.externalId ?? `${entry.username}@${entry.commentedAt.getTime()}`;
      const evaluated = byKey.get(key);
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
    include: { entries: { where: { valid: true } } },
  });

  if (giveaway.status !== "COLLECTING") {
    fail("Die Teilnehmerliste wurde bereits festgeschrieben.");
  }
  if (giveaway.entries.length === 0) {
    fail("Es gibt keine gültigen Teilnahmen. Bitte zuerst importieren und die Regeln prüfen.");
  }

  const entrants: Entrant[] = giveaway.entries.map((e) => ({
    id: e.id,
    username: e.username,
    lots: e.lots,
    ref: e.externalId ?? `${e.username}-${e.commentedAt.getTime()}`,
  }));

  const c = commit(entrants);

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
  const outcome = draw(entrants, pending.seed, 1 + giveaway.substituteCount);

  await db.$transaction([
    db.drawResult.createMany({
      data: outcome.winners.map((w, index) => ({
        drawId: pending.id,
        entryId: w.id,
        rank: index,
        // Hauptgewinn an Rang 0, weitere Preise an die naechsten Raenge.
        prizeId: giveaway.prizes[index]?.id ?? null,
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

export async function setVerification(
  drawResultId: string,
  follows: boolean,
  liked: boolean,
  note?: string,
) {
  const userId = await requireUser();

  const passed = follows && liked;

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

/// Formularvariante der Verifikation — beide Häkchen müssen gesetzt sein,
/// sonst gilt der Kandidat als durchgefallen und der Nachrücker zieht nach.
export async function submitVerification(
  drawResultId: string,
  formData: FormData,
) {
  await setVerification(
    drawResultId,
    formData.get("follows") === "on",
    formData.get("liked") === "on",
    String(formData.get("note") ?? "").trim() || undefined,
  );
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
