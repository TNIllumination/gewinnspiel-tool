import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { getPlatform, type PlatformId } from "@/platforms/base";
import type { Rejection } from "@/rules/engine";
import { RULE_LABELS } from "@/rules/types";
import {
  addPrize,
  clearEntries,
  commitEntrants,
  completeGiveaway,
  deletePrize,
  importManual,
  importSandbox,
  performDraw,
  saveRules,
  submitVerification,
} from "../actions";
import { ActionForm } from "@/components/action-form";
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

  const platform = getPlatform(giveaway.platform as PlatformId);
  const currentDraw = giveaway.draws[0];

  const [total, valid, lotsAgg] = await Promise.all([
    db.entry.count({ where: { giveawayId: id } }),
    db.entry.count({ where: { giveawayId: id, valid: true } }),
    db.entry.aggregate({
      where: { giveawayId: id, valid: true },
      _sum: { lots: true },
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

  // Wirksamer Gewinner: der niedrigste Rang, der nicht durchgefallen ist.
  const effectiveWinner = currentDraw?.results.find((r) => r.status !== "REJECTED");

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <PageHeader
        title={giveaway.title}
        subtitle={
          <>
            {platform.label}
            {giveaway.postUrl ? (
              <>
                {" · "}
                <a
                  className="underline hover:no-underline"
                  href={giveaway.postUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Beitrag öffnen
                </a>
              </>
            ) : null}
            {" · "}
            <Link className="underline hover:no-underline" href={`/gewinnspiel/${giveaway.slug}`}>
              Öffentliche Seite
            </Link>
          </>
        }
        back={{ href: "/admin", label: "Alle Gewinnspiele" }}
      />

      <Notice title={`Was ${platform.label} hergibt — und was nicht`}>
        {platform.capabilities.notes}
      </Notice>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Kommentare" value={total} />
        <Stat label="Gültig" value={valid} />
        <Stat label="Abgelehnt" value={total - valid} />
        <Stat label="Lose" value={lotsAgg._sum.lots ?? 0} />
      </div>

      {/* ── Teilnahmen einlesen ───────────────────────────────────────── */}
      {beforeCommit ? (
        <Card>
          <CardTitle
            hint={
              platform.capabilities.needsManualImport
                ? "Diese Plattform gibt Kommentare nicht über eine Schnittstelle heraus — deshalb hier einfügen."
                : "Kommentare einlesen."
            }
          >
            Teilnahmen einlesen
          </CardTitle>

          {giveaway.platform === "SANDBOX" ? (
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
          ) : (
            <ActionForm action={importManual.bind(null, id)} submitLabel="Einlesen">
              <Field
                label="Kommentare einfügen"
                hint="Erkannt werden: CSV mit Kopfzeile (Benutzer;Kommentar;Datum), „Name: Text“ pro Zeile, oder Name und Text in abwechselnden Zeilen."
              >
                <textarea
                  className={`${inputClass} h-40 font-mono text-xs`}
                  name="raw"
                  required
                  placeholder={"@anna: Ich bin dabei @ben @carla\n@ben: Auch dabei @anna @dora"}
                />
              </Field>
            </ActionForm>
          )}

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

      {/* ── Regeln ───────────────────────────────────────────────────── */}
      {beforeCommit ? (
        <Card>
          <CardTitle hint="Nach dem Speichern werden alle Teilnahmen sofort neu bewertet.">
            Teilnahmebedingungen
          </CardTitle>

          <ActionForm action={saveRules.bind(null, id)} submitLabel="Regeln speichern & prüfen">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Diese Wörter müssen vorkommen"
                hint="Mit Komma trennen. „Grüße“, „gruesse“ und „grusse“ gelten als dasselbe."
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

              <Field label="Mehrfachteilnahme">
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
                    <p className="font-medium text-slate-800">@{entry.username}</p>
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

      {/* ── Gewinne ──────────────────────────────────────────────────── */}
      <Card>
        <CardTitle hint="Der erste Gewinn geht an den Hauptgewinner, weitere an die folgenden Ränge.">
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
                <ActionForm
                  action={deletePrize.bind(null, prize.id)}
                  submitLabel="Entfernen"
                  variant="danger"
                  className="[&>button]:mt-0"
                />
              </li>
            ))}
          </ul>
        ) : null}

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
                Die Teilnehmerliste wird eingefroren und zu einem Hash verrechnet, den du
                <strong> vor </strong>der Ziehung veröffentlichst. Danach lässt sich nichts
                mehr unbemerkt ändern — und genau das kannst du hinterher beweisen.
              </Notice>
            </div>
            <ActionForm
              action={commitEntrants.bind(null, id)}
              submitLabel={`${valid} Teilnahmen festschreiben`}
              confirm="Danach können keine Teilnahmen mehr hinzukommen oder Regeln geändert werden. Fortfahren?"
            />
          </>
        ) : null}

        {currentDraw && !currentDraw.drawnAt ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Commit-Hash (jetzt veröffentlichen)
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800">
                {currentDraw.commitHash}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {currentDraw.entrantCount} Teilnehmer · {currentDraw.totalLots} Lose ·
                festgeschrieben {formatDateTime(currentDraw.committedAt)}
              </p>
            </div>
            <ActionForm
              action={performDraw.bind(null, id)}
              submitLabel={`Jetzt ziehen (1 Gewinner + ${giveaway.substituteCount} Nachrücker)`}
              variant="success"
            />
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
      {currentDraw?.drawnAt ? (
        <Card>
          <CardTitle
            hint={
              platform.capabilities.canCheckFollow
                ? "Diese Plattform beantwortet den Follow-Check automatisch."
                : "Folgen und Likes gibt keine Schnittstelle heraus — hier prüfst du nur diese wenigen Personen von Hand."
            }
          >
            Gewinner prüfen
          </CardTitle>

          {effectiveWinner ? (
            <div className="mb-4">
              <Notice title={`Aktueller Gewinner: @${effectiveWinner.entry.username}`}>
                {effectiveWinner.rank === 0
                  ? "Direkt gezogen."
                  : `Nachgerückt von Platz ${effectiveWinner.rank + 1}, weil die davor durchgefallen sind.`}
              </Notice>
            </div>
          ) : (
            <div className="mb-4">
              <Notice title="Alle Kandidaten sind durchgefallen" tone="warn">
                Erhöhe die Zahl der Nachrücker oder ziehe neu.
              </Notice>
            </div>
          )}

          <ul className="space-y-3">
            {currentDraw.results.map((result) => {
              const isWinnerSlot = result.id === effectiveWinner?.id;
              return (
                <li
                  key={result.id}
                  className={`rounded-lg border p-4 ${
                    isWinnerSlot ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {result.rank === 0 ? "Gewinner" : `Nachrücker ${result.rank}`} —{" "}
                        <a
                          className="underline hover:no-underline"
                          href={platform.profileUrl(result.entry.username)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          @{result.entry.username}
                        </a>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{result.entry.text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {result.entry.lots} Los(e) · {formatDateTime(result.entry.commentedAt)}
                        {result.prize ? ` · Gewinn: ${result.prize.title}` : ""}
                      </p>
                    </div>

                    {result.status === "CONFIRMED" ? (
                      <Badge tone="good">Bestätigt</Badge>
                    ) : result.status === "REJECTED" ? (
                      <Badge tone="bad">Durchgefallen</Badge>
                    ) : (
                      <Badge tone="warn">Offen</Badge>
                    )}
                  </div>

                  {result.status === "PENDING" ? (
                    <ActionForm
                      action={submitVerification.bind(null, result.id)}
                      submitLabel="Prüfung speichern"
                      variant="secondary"
                      className="mt-3"
                    >
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="follows" className="size-4" />
                          folgt mir
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="liked" className="size-4" />
                          hat geliked
                        </label>
                        <input
                          className={`${inputClass} max-w-xs`}
                          name="note"
                          placeholder="Notiz (optional)"
                        />
                      </div>
                    </ActionForm>
                  ) : result.verification ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Geprüft {formatDateTime(result.verification.checkedAt)} · folgt:{" "}
                      {result.verification.follows ? "ja" : "nein"} · geliked:{" "}
                      {result.verification.liked ? "ja" : "nein"}
                      {result.verification.note ? ` · ${result.verification.note}` : ""}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {giveaway.status !== "COMPLETED" && effectiveWinner?.status === "CONFIRMED" ? (
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
