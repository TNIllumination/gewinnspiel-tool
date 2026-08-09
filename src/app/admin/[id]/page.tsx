import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getPlatform, type PlatformId } from "@/platforms/base";
import type { Rejection } from "@/rules/engine";
import { RULE_LABELS } from "@/rules/types";
import { describeRules } from "@/rules/summary";
import { prizeIdForSlot, resolveWinners } from "@/draw/promotion";
import {
  addPrize,
  buildTexts,
  clearEntries,
  commitEntrants,
  completeGiveaway,
  confirmManualImport,
  deletePrize,
  importSandbox,
  performDraw,
  previewManualImport,
  publishPage,
  releaseCommit,
  saveRules,
  submitVerification,
} from "../actions";
import { ActionForm } from "@/components/action-form";
import { ManualImport } from "@/components/manual-import";
import { TextePanel } from "@/components/texte-panel";
import {
  Badge,
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  Stat,
  formatDateTime,
  inputClass,
} from "@/components/ui";

/// Wandelt ein Datum in den Wert, den <input type="datetime-local"> erwartet.
function toLocalInput(value: Date | null | undefined) {
  if (!value) return "";
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export default async function GiveawayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await getSessionUserId())) redirect("/admin/login");
  const { id } = await params;

  const giveaway = await db.giveaway.findUnique({
    where: { id },
    include: {
      sources: { orderBy: { platform: "asc" } },
      rules: { orderBy: { position: "asc" } },
      prizes: { orderBy: { rank: "asc" } },
      draws: {
        orderBy: { committedAt: "desc" },
        take: 1,
        include: {
          results: {
            orderBy: { rank: "asc" },
            include: { entry: true, prize: true, verification: true },
          },
        },
      },
    },
  });

  if (!giveaway) notFound();

  const currentDraw = giveaway.draws[0];
  const isSandbox = giveaway.sources.some((s) => s.platform === "SANDBOX");
  const importPlatforms = giveaway.sources
    .filter((s) => s.platform !== "SANDBOX")
    .map((s) => ({
      id: s.platform,
      label: getPlatform(s.platform as PlatformId).label,
    }));

  const settings = await db.settings.findUnique({ where: { id: "settings" } });

  const [total, valid, lotsAgg, perPlatform] = await Promise.all([
    db.entry.count({ where: { giveawayId: id } }),
    db.entry.count({ where: { giveawayId: id, valid: true } }),
    db.entry.aggregate({
      where: { giveawayId: id, valid: true },
      _sum: { lots: true },
    }),
    db.entry.groupBy({
      by: ["platform"],
      where: { giveawayId: id },
      _count: { _all: true },
    }),
  ]);

  const rejectedSample = await db.entry.findMany({
    where: { giveawayId: id, valid: false },
    orderBy: { commentedAt: "desc" },
    take: 8,
  });

  const ruleConfig = Object.fromEntries(
    giveaway.rules.map((r) => [r.type, r.config as Record<string, unknown>]),
  );

  const beforeCommit = giveaway.status === "COLLECTING" || giveaway.status === "DRAFT";

  // Wer belegt aktuell welchen Gewinnplatz? Nachrücker erben den Platz des
  // Abgelehnten — und damit dessen Gewinn, nicht irgendeinen.
  const resolved = currentDraw
    ? resolveWinners(
        currentDraw.results.map((r) => ({
          id: r.id,
          rank: r.rank,
          status: r.status,
          prizeId: r.prizeId,
        })),
        currentDraw.winnerSlots,
      )
    : null;

  const resultById = new Map((currentDraw?.results ?? []).map((r) => [r.id, r]));
  const prizeById = new Map(giveaway.prizes.map((p) => [p.id, p]));
  const winnerSlotOf = new Map<string, number>();
  resolved?.winners.forEach((w) => {
    if (w.candidate) winnerSlotOf.set(w.candidate.id, w.slot);
  });

  const allConfirmed =
    resolved !== null &&
    resolved.winners.length > 0 &&
    resolved.winners.every((w) => w.candidate?.status === "CONFIRMED");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <PageHeader
        title={giveaway.title}
        subtitle={
          <>
            {giveaway.sources
              .map((s) => getPlatform(s.platform as PlatformId).label)
              .join(" + ")}
            {" · "}
            <Link className="underline hover:no-underline" href={`/gewinnspiel/${giveaway.slug}`}>
              Öffentliche Seite
            </Link>
          </>
        }
        back={{ href: "/admin", label: "Alle Gewinnspiele" }}
      />

      {giveaway.sources
        .filter((s) => s.platform !== "SANDBOX")
        .map((s) => {
          const platform = getPlatform(s.platform as PlatformId);
          return (
            <Notice key={s.id} title={`Was ${platform.label} hergibt — und was nicht`}>
              {platform.capabilities.notes}
              {s.postUrl ? (
                <>
                  {" "}
                  <a className="underline" href={s.postUrl} target="_blank" rel="noreferrer">
                    Beitrag öffnen
                  </a>
                </>
              ) : null}
            </Notice>
          );
        })}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Kommentare" value={total} />
        <Stat label="Gültig" value={valid} />
        <Stat label="Abgelehnt" value={total - valid} />
        <Stat label="Lose" value={lotsAgg._sum.lots ?? 0} />
      </div>

      {perPlatform.length > 1 ? (
        <p className="text-sm text-slate-600">
          Herkunft:{" "}
          {perPlatform
            .map(
              (p) =>
                `${getPlatform(p.platform as PlatformId).label}: ${p._count._all}`,
            )
            .join(" · ")}
        </p>
      ) : null}

      {/* ── Regeln ───────────────────────────────────────────────────── */}
      {beforeCommit ? (
        <Card>
          <CardTitle hint="Nach dem Speichern werden alle Teilnahmen sofort neu bewertet.">
            Teilnahmebedingungen
          </CardTitle>

          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Das gilt gerade
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
              {describeRules(
                giveaway.rules.map((r) => ({
                  type: r.type,
                  config: r.config,
                  enabled: r.enabled,
                })),
              ).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
              {giveaway.sources.filter((s) => s.platform !== "SANDBOX").length > 1 ? (
                <li>Wer auf mehreren Plattformen kommentiert, ist mehrfach im Topf.</li>
              ) : null}
            </ul>
          </div>

          <ActionForm action={saveRules.bind(null, id)} submitLabel="Regeln speichern & prüfen">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start" hint="Frühere Kommentare zählen nicht.">
                <input
                  className={inputClass}
                  type="datetime-local"
                  name="startsAt"
                  defaultValue={toLocalInput(giveaway.startsAt)}
                />
              </Field>

              <Field label="Einsendeschluss" hint="Spätere Kommentare zählen nicht.">
                <input
                  className={inputClass}
                  type="datetime-local"
                  name="endsAt"
                  defaultValue={toLocalInput(giveaway.endsAt)}
                />
              </Field>

              <Field
                label="Eigene Bedingungen"
                hint="Eine je Zeile. Kommt als eigener Abschnitt in die Teilnahmebedingungen — z. B. „Übergabe nur vor Ort“ oder „Versand nur innerhalb Deutschlands“."
              >
                <textarea
                  className={`${inputClass} min-h-24`}
                  name="customTerms"
                  defaultValue={giveaway.customTerms ?? ""}
                  placeholder={"Übergabe des Gewinns vor Ort auf dem Festival\nVersand nur innerhalb Deutschlands"}
                />
              </Field>

              <Field
                label="Diese Wörter müssen vorkommen"
                hint="Mit Komma trennen. „Grüße“, „gruesse“ und „grusse“ gelten als dasselbe. Mehrfach genannt bringt keinen Vorteil."
              >
                <input
                  className={inputClass}
                  name="keywords"
                  defaultValue={((ruleConfig.KEYWORD?.keywords as string[]) ?? []).join(", ")}
                  placeholder="dabei, #meineaktion"
                />
              </Field>

              <Field label="Davon müssen vorkommen">
                <select
                  className={inputClass}
                  name="keywordMode"
                  defaultValue={(ruleConfig.KEYWORD?.mode as string) ?? "any"}
                >
                  <option value="any">Mindestens eines</option>
                  <option value="all">Alle</option>
                </select>
              </Field>

              <Field label="Freunde markieren (Anzahl)" hint="0 = nicht gefordert.">
                <input
                  className={inputClass}
                  type="number"
                  name="mentionsMin"
                  min={0}
                  max={10}
                  defaultValue={(ruleConfig.MENTIONS?.min as number) ?? 0}
                />
              </Field>

              <Field label="Mindestlänge der Antwort" hint="0 = keine Mindestlänge.">
                <input
                  className={inputClass}
                  type="number"
                  name="minLength"
                  min={0}
                  max={500}
                  defaultValue={(ruleConfig.MIN_LENGTH?.min as number) ?? 0}
                />
              </Field>

              <Field label="Mehrfachteilnahme" hint="Gilt je Plattform.">
                <select
                  className={inputClass}
                  name="dedupeMode"
                  defaultValue={(ruleConfig.DEDUPE?.mode as string) ?? "one_per_user"}
                >
                  <option value="one_per_user">Ein Los pro Person</option>
                  <option value="max_per_user">Höchstens X pro Person</option>
                  <option value="all_comments">Jeder Kommentar zählt</option>
                </select>
              </Field>

              <Field label="Höchstens X pro Person">
                <input
                  className={inputClass}
                  type="number"
                  name="dedupeMax"
                  min={1}
                  max={20}
                  defaultValue={(ruleConfig.DEDUPE?.max as number) ?? 1}
                />
              </Field>

              <Field
                label="Ausgeschlossene Accounts"
                hint="Eigene Zweitkonten, Team, frühere Gewinner. Komma- oder zeilengetrennt."
              >
                <input
                  className={inputClass}
                  name="blocklist"
                  defaultValue={((ruleConfig.BLOCKLIST?.usernames as string[]) ?? []).join(", ")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Zusatzlose ab … Tags">
                  <input
                    className={inputClass}
                    type="number"
                    name="bonusMentionsAtLeast"
                    min={0}
                    max={10}
                    defaultValue={(ruleConfig.BONUS?.mentionsAtLeast as number) ?? 0}
                  />
                </Field>
                <Field label="… so viele extra">
                  <input
                    className={inputClass}
                    type="number"
                    name="bonusExtraLots"
                    min={0}
                    max={20}
                    defaultValue={(ruleConfig.BONUS?.extraLots as number) ?? 0}
                  />
                </Field>
              </div>
            </div>
          </ActionForm>

          {rejectedSample.length > 0 ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Zuletzt abgelehnt — jeweils mit Grund
              </h3>
              <ul className="space-y-2">
                {rejectedSample.map((entry) => (
                  <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium text-slate-800">
                      @{entry.username}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {getPlatform(entry.platform as PlatformId).label}
                      </span>
                    </p>
                    <p className="text-slate-600">{entry.text}</p>
                    <ul className="mt-1 space-y-0.5">
                      {(entry.rejections as unknown as Rejection[]).map((r, i) => (
                        <li key={i} className="text-xs text-red-700">
                          {RULE_LABELS[r.ruleType]}: {r.message}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── Teilnahmen einlesen ───────────────────────────────────────── */}
      {beforeCommit ? (
        <Card>
          <CardTitle hint="Kommentare einlesen — bei TikTok und Instagram in Etappen.">
            Teilnahmen einlesen
          </CardTitle>

          {giveaway.rules.length === 0 ? (
            <div className="mb-4">
              <Notice title="Erst die Teilnahmebedingungen" tone="warn">
                Oben sind noch keine Regeln gesetzt — dann zählt jeder Kommentar als
                gültig. Im Testmodus richten sich die erzeugten Teilnahmen außerdem
                nach deinen Regeln, also lohnt es sich, sie vorher einzutragen.
              </Notice>
            </div>
          ) : null}

          {isSandbox ? (
            <div className="mb-6">
              <ActionForm
                action={importSandbox.bind(null, id)}
                submitLabel="250 Testteilnehmer erzeugen"
                variant="secondary"
              >
                <p className="text-sm text-slate-600">
                  Erzeugt erfundene Teilnehmer, davon absichtlich einige, die die Regeln
                  nicht erfüllen — so siehst du, wie die Prüfung begründet ablehnt.
                </p>
              </ActionForm>
            </div>
          ) : null}

          {importPlatforms.length > 0 ? (
            <ManualImport
              preview={previewManualImport}
              confirm={confirmManualImport.bind(null, id) as (
                platform: string,
                raw: string,
              ) => ReturnType<typeof confirmManualImport>}
              platforms={importPlatforms}
            />
          ) : null}

          {total > 0 ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <ActionForm
                action={clearEntries.bind(null, id)}
                submitLabel="Alle Teilnahmen löschen"
                variant="danger"
                confirm="Wirklich alle eingelesenen Teilnahmen löschen?"
              />
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* ── Gewinne ──────────────────────────────────────────────────── */}
      <Card>
        <CardTitle hint="Für jeden Gewinn wird ein eigener Gewinner gezogen — Nachrücker kommen zusätzlich.">
          Gewinne
        </CardTitle>

        {giveaway.prizes.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {giveaway.prizes.map((prize, index) => (
              <li
                key={prize.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {index + 1}. Platz — {prize.title}
                  </p>
                  {prize.description ? (
                    <p className="text-xs text-slate-600">{prize.description}</p>
                  ) : null}
                </div>
                {beforeCommit ? (
                  <ActionForm
                    action={deletePrize.bind(null, prize.id)}
                    submitLabel="Entfernen"
                    variant="danger"
                    className="[&>button]:mt-0"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {beforeCommit ? (
          <ActionForm action={addPrize.bind(null, id)} submitLabel="Gewinn hinzufügen" variant="secondary">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name">
                <input className={inputClass} name="prizeTitle" required placeholder="Signiertes Shirt" />
              </Field>
              <Field label="Beschreibung">
                <input className={inputClass} name="prizeDescription" />
              </Field>
              <Field label="Bild-URL">
                <input className={inputClass} name="prizeImageUrl" placeholder="https://…" />
              </Field>
            </div>
          </ActionForm>
        ) : null}
      </Card>

      {/* ── Texte und Veröffentlichung ───────────────────────────────── */}
      <Card id="veroeffentlichen">
        <CardTitle hint="Für den Beitrag und für die öffentliche Seite auf GitHub.">
          Teilnahmebedingungen und Nachweis
        </CardTitle>
        <p className="mb-4 text-sm text-slate-600">
          Veröffentlicht wird in <strong>drei Stufen</strong>, und der Knopf heißt
          jeweils danach: erst die <strong>Teilnahmebedingungen</strong>, nach dem
          Festschreiben zusätzlich die <strong>Prüfsumme</strong>, nach der Ziehung der
          <strong> Nachweis</strong> mit Teilnehmerliste, Zufallszahl und Gewinnern.
          Bis zur Ziehung geht <strong>kein einziger Name</strong> online.
        </p>
        <TextePanel
          texte={buildTexts.bind(null, id)}
          veroeffentlichen={publishPage.bind(null, id)}
          slug={giveaway.slug}
          hochladen={Boolean(settings?.githubToken)}
          stufe={
            currentDraw?.seedRevealedAt
              ? "nachweis"
              : currentDraw
                ? "pruefsumme"
                : "bedingungen"
          }
        />
      </Card>

      {/* ── Ziehung ──────────────────────────────────────────────────── */}
      <Card>
        <CardTitle hint="Zwei Schritte, damit die Ziehung nachweisbar fair bleibt.">
          Ziehung
        </CardTitle>

        {beforeCommit ? (
          <>
            <div className="mb-4">
              <Notice title="Schritt 1: Liste festschreiben">
                Die Teilnehmerliste wird eingefroren und zu einer Prüfsumme verrechnet,
                die du <strong>vor</strong> der Ziehung veröffentlichst. Danach lässt sich
                nichts mehr unbemerkt ändern — und genau das kannst du hinterher beweisen.
              </Notice>
            </div>
            <ActionForm
              action={commitEntrants.bind(null, id)}
              submitLabel={`${valid} Teilnahmen festschreiben`}
              confirm="Danach können keine Teilnahmen mehr hinzukommen. Zurücknehmen geht nur, solange nicht gezogen wurde. Fortfahren?"
            />
          </>
        ) : null}

        {currentDraw && !currentDraw.drawnAt ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {currentDraw.commitPublishedAt
                  ? `Prüfsumme — veröffentlicht ${formatDateTime(currentDraw.commitPublishedAt)}`
                  : "Prüfsumme — noch nicht veröffentlicht"}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">
                {currentDraw.commitHash}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {currentDraw.entrantCount} Teilnehmer · {currentDraw.totalLots} Lose ·{" "}
                {currentDraw.winnerSlots} Gewinnplatz
                {currentDraw.winnerSlots === 1 ? "" : "ätze"} · festgeschrieben{" "}
                {formatDateTime(currentDraw.committedAt)}
              </p>
            </div>

            {/* Der Kern des Verfahrens: Die Prüfsumme beweist nur etwas, wenn
                sie VOR der Ziehung öffentlich war. Sonst hätte sie
                nachträglich passend erzeugt werden können. */}
            {!currentDraw.commitPublishedAt ? (
              <Notice title="Erst die Prüfsumme veröffentlichen" tone="warn">
                <p>
                  Sie muss <strong>vor</strong> der Ziehung öffentlich sein — sonst
                  ließe sich hinterher behaupten, sie sei passend zum Ergebnis
                  erzeugt worden. Genau darauf beruht der ganze Nachweis.
                </p>
                <p className="mt-2">
                  Geh dazu oben auf{" "}
                  <a href="#veroeffentlichen" className="underline">
                    Teilnahmebedingungen und Nachweis
                  </a>{" "}
                  und drück auf <strong>Bedingungen und Prüfsumme veröffentlichen</strong>.
                  Es gehen dabei noch keine Namen online.
                </p>
              </Notice>
            ) : null}

            <ActionForm
              action={performDraw.bind(null, id)}
              submitLabel={`Jetzt ziehen (${currentDraw.winnerSlots} Gewinner + ${giveaway.substituteCount} Nachrücker)`}
              variant="success"
              confirm={
                currentDraw.commitPublishedAt
                  ? undefined
                  : "Die Prüfsumme ist noch nicht veröffentlicht. Dann lässt sich hinterher nicht belegen, dass sie vor der Ziehung feststand — der Nachweis ist damit wertlos. Trotzdem ziehen?"
              }
            />

            <div className="border-t border-slate-200 pt-4">
              <ActionForm
                action={releaseCommit.bind(null, id)}
                submitLabel="Festschreibung zurücknehmen"
                variant="secondary"
                confirm="Die eingefrorene Liste wird aufgelöst, damit du weitere Kommentare einlesen kannst. Fortfahren?"
              >
                <p className="text-sm text-slate-600">
                  Fehlen noch Kommentare? Solange nicht gezogen wurde, kannst du die
                  Liste wieder auflösen und nachträglich importieren.
                </p>
              </ActionForm>
            </div>
          </div>
        ) : null}

        {currentDraw?.drawnAt ? (
          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="text-slate-600">
              Gezogen am {formatDateTime(currentDraw.drawnAt)} ·{" "}
              {currentDraw.entrantCount} Teilnehmer · {currentDraw.totalLots} Lose
            </p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Commit-Hash</p>
            <p className="break-all font-mono text-xs">{currentDraw.commitHash}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
              Seed (jetzt offengelegt)
            </p>
            <p className="break-all font-mono text-xs">{currentDraw.seed}</p>
          </div>
        ) : null}
      </Card>

      {/* ── Verifikation ─────────────────────────────────────────────── */}
      {currentDraw?.drawnAt && resolved ? (
        <Card>
          <CardTitle hint="Folgen und Liken gibt keine Plattform heraus. Du entscheidest — das Tool verlangt keine Häkchen für Ungeprüftes.">
            Gewinner prüfen
          </CardTitle>

          <div className="mb-4 space-y-2">
            {resolved.winners.map((w) => {
              const result = w.candidate ? resultById.get(w.candidate.id) : null;
              // Der Gewinn hängt am Platz — wer nachrückt, erbt ihn.
              const prize = prizeById.get(
                prizeIdForSlot(
                  currentDraw.results.map((r) => ({
                    id: r.id,
                    rank: r.rank,
                    status: r.status,
                    prizeId: r.prizeId,
                  })),
                  w.slot,
                ) ?? "",
              );
              return (
                <div
                  key={w.slot}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-emerald-900">
                    {w.slot + 1}. Platz
                    {prize ? ` — ${prize.title}` : ""}
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {result ? `@${result.entry.username}` : "— noch offen —"}
                  </p>
                  {w.promoted ? (
                    <p className="text-xs text-emerald-800">
                      Nachgerückt, weil die davor durchgefallen sind.
                    </p>
                  ) : null}
                  {!result ? (
                    <p className="text-xs text-amber-800">
                      Alle Kandidaten durchgefallen — erhöhe die Nachrücker oder ziehe neu.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>

          <ul className="space-y-3">
            {currentDraw.results.map((result) => {
              const slot = winnerSlotOf.get(result.id);
              const istGewinner = slot !== undefined;
              const platform = getPlatform(result.entry.platform as PlatformId);

              return (
                <li
                  key={result.id}
                  className={`rounded-lg border p-4 ${
                    istGewinner ? "border-emerald-400 bg-emerald-50/50" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {istGewinner
                          ? `${slot + 1}. Platz`
                          : `Nachrücker ${result.rank - currentDraw.winnerSlots + 1}`}{" "}
                        —{" "}
                        <a
                          className="underline hover:no-underline"
                          href={platform.profileUrl(result.entry.username)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{result.entry.username}
                        </a>
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {platform.label}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{result.entry.text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {result.entry.lots} Los(e) · {formatDateTime(result.entry.commentedAt)}
                      </p>
                    </div>

                    {result.status === "CONFIRMED" ? (
                      <Badge tone="good">Bestätigt</Badge>
                    ) : result.status === "REJECTED" ? (
                      <Badge tone="bad">Abgelehnt</Badge>
                    ) : (
                      <Badge tone="warn">Offen</Badge>
                    )}
                  </div>

                  {result.status === "PENDING" ? (
                    <div className="mt-3 flex flex-wrap items-end gap-3">
                      <ActionForm
                        action={submitVerification.bind(null, result.id, true)}
                        submitLabel="Bestätigen"
                        variant="success"
                        className="[&>button]:mt-0"
                      >
                        <input type="hidden" name="note" value="" />
                      </ActionForm>
                      <ActionForm
                        action={submitVerification.bind(null, result.id, false)}
                        submitLabel="Ablehnen"
                        variant="danger"
                        className="[&>button]:mt-0"
                        confirm="Diesen Kandidaten ablehnen? Der nächste Nachrücker erbt diesen Platz."
                      >
                        <input
                          className={`${inputClass} max-w-xs`}
                          name="note"
                          placeholder="Grund (optional)"
                        />
                      </ActionForm>
                    </div>
                  ) : result.verification ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Geprüft {formatDateTime(result.verification.checkedAt)}
                      {result.verification.note ? ` · ${result.verification.note}` : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {giveaway.status !== "COMPLETED" && allConfirmed ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <ActionForm
                action={completeGiveaway.bind(null, id)}
                submitLabel="Gewinnspiel abschließen und veröffentlichen"
                variant="success"
              />
            </div>
          ) : null}
        </Card>
      ) : null}
    </main>
  );
}
