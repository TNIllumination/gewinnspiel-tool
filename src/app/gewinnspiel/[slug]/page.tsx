import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { maskUsername } from "@/lib/audit";
import { prizeIdForSlot, resolveWinners } from "@/draw/promotion";
import { Badge, Card, CardTitle, Notice, formatDateTime } from "@/components/ui";
import { ImpressumLink } from "@/components/impressum-link";

export const dynamic = "force-dynamic";

export default async function PublicGiveawayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const giveaway = await db.giveaway.findUnique({
    where: { slug },
    include: {
      prizes: { orderBy: { rank: "asc" } },
      rules: true,
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

  if (!giveaway || !giveaway.publicResults) notFound();

  const draw = giveaway.draws[0];
  const revealed = Boolean(draw?.seedRevealedAt);
  const show = (name: string) =>
    giveaway.maskUsernames ? maskUsername(name) : `@${name}`;

  // Wer belegt welchen Gewinnplatz? Nachrücker erben den Platz des
  // Abgelehnten — und damit dessen Gewinn.
  const resolved = draw
    ? resolveWinners(
        draw.results.map((r) => ({ id: r.id, rank: r.rank, status: r.status, prizeId: r.prizeId })),
        draw.winnerSlots,
      )
    : null;
  const resultById = new Map((draw?.results ?? []).map((r) => [r.id, r]));
  const prizeById = new Map(giveaway.prizes.map((p) => [p.id, p]));
  const slotCandidates = (draw?.results ?? []).map((r) => ({
    id: r.id,
    rank: r.rank,
    status: r.status,
    prizeId: r.prizeId,
  }));

  const keywordRule = giveaway.rules.find((r) => r.type === "KEYWORD");
  const mentionsRule = giveaway.rules.find((r) => r.type === "MENTIONS");
  const keywords = (keywordRule?.config as { keywords?: string[] } | null)?.keywords ?? [];
  const mentionsMin = (mentionsRule?.config as { min?: number } | null)?.min ?? 0;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <header>
        <h1 className="text-3xl font-bold">{giveaway.title}</h1>
        {giveaway.description ? (
          <p className="mt-2 text-slate-600">{giveaway.description}</p>
        ) : null}
      </header>

      {giveaway.prizes.length > 0 ? (
        <Card>
          <CardTitle>Das gibt es zu gewinnen</CardTitle>
          <ul className="grid gap-4 sm:grid-cols-2">
            {giveaway.prizes.map((prize, index) => (
              <li key={prize.id} className="rounded-lg border border-slate-200 p-4">
                {prize.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prize.imageUrl}
                    alt={prize.title}
                    className="mb-3 h-32 w-full rounded object-cover"
                  />
                ) : null}
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {index + 1}. Platz
                </p>
                <p className="font-semibold">{prize.title}</p>
                {prize.description ? (
                  <p className="mt-1 text-sm text-slate-600">{prize.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Teilnahmebedingungen</CardTitle>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
          {keywords.length > 0 ? (
            <li>
              Kommentiere unter dem Beitrag mit{" "}
              {keywords.map((k) => `„${k}“`).join(" bzw. ")}.
            </li>
          ) : (
            <li>Kommentiere unter dem Beitrag.</li>
          )}
          {mentionsMin > 0 ? (
            <li>
              Markiere {mentionsMin}{" "}
              {mentionsMin === 1 ? "Freundin oder Freund" : "verschiedene Freunde"}.
            </li>
          ) : null}
          {giveaway.endsAt ? (
            <li>Einsendeschluss ist {formatDateTime(giveaway.endsAt)}.</li>
          ) : null}
          <li>Teilnahme ab 18 Jahren. Der Rechtsweg ist ausgeschlossen.</li>
          <li>
            Personenbezogene Daten werden ausschließlich zur Durchführung der Verlosung
            verarbeitet und danach gelöscht.
          </li>
        </ul>
      </Card>

      {draw ? (
        <Card>
          <CardTitle hint="Nachrechnen statt vertrauen.">Nachweis der fairen Ziehung</CardTitle>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Commit-Hash — veröffentlicht vor der Ziehung
              </p>
              <p className="break-all font-mono text-xs">{draw.commitHash}</p>
            </div>

            <p className="text-slate-600">
              {draw.entrantCount} Teilnehmer · {draw.totalLots} Lose · festgeschrieben{" "}
              {formatDateTime(draw.committedAt)}
            </p>

            {revealed ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Seed — nach der Ziehung offengelegt
                </p>
                <p className="break-all font-mono text-xs">{draw.seed}</p>
              </div>
            ) : (
              <Notice title="Der Seed bleibt bis zur Ziehung geheim">
                Der Hash oben bindet Teilnehmerliste und Seed bereits jetzt aneinander.
                Nach der Ziehung wird der Seed veröffentlicht — dann lässt sich prüfen,
                dass an der Liste nichts verändert wurde.
              </Notice>
            )}
          </div>
        </Card>
      ) : null}

      {revealed && resolved ? (
        <Card>
          <CardTitle>Gewinner</CardTitle>

          <ol className="space-y-4">
            {resolved.winners.map((w) => {
              const result = w.candidate ? resultById.get(w.candidate.id) : null;
              if (!result) return null;
              return (
                <li key={w.slot}>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {w.slot + 1}. Platz
                    {(() => {
                      // Der Gewinn gehört zum Platz, nicht zur Person.
                      const prize = prizeById.get(
                        prizeIdForSlot(slotCandidates, w.slot) ?? "",
                      );
                      return prize ? ` — ${prize.title}` : "";
                    })()}
                  </p>
                  <p className="text-2xl font-bold">{show(result.entry.username)}</p>
                  {/* Der Kommentar macht nachvollziehbar, womit gewonnen wurde. */}
                  <blockquote className="mt-2 rounded-r-lg border-l-4 border-slate-300 bg-slate-50 px-4 py-2 text-slate-700">
                    {result.entry.text}
                  </blockquote>
                </li>
              );
            })}
          </ol>

          {resolved.reserves.length > 0 ? (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">Nachrücker</p>
              <ul className="flex flex-wrap gap-2">
                {resolved.reserves.map((r) => {
                  const result = resultById.get(r.id);
                  return result ? (
                    <li key={r.id}>
                      <Badge>{show(result.entry.username)}</Badge>
                    </li>
                  ) : null;
                })}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      <footer className="flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p className="max-w-xl">
          Diese Aktion steht in keiner Verbindung zu Instagram, TikTok oder YouTube und
          wird von diesen weder gesponsert noch unterstützt oder organisiert. Mit der
          Teilnahme stellst du diese Plattformen von jeglicher Haftung frei; Fragen
          zum Gewinnspiel richte bitte an den Veranstalter, nicht an die Plattform.
        </p>
        <span className="flex shrink-0 gap-4">
          <ImpressumLink />
          <Link href="/admin" className="shrink-0 underline hover:text-slate-800">
            Verwaltung
          </Link>
        </span>
      </footer>
    </main>
  );
}
