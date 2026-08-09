import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, formatDateTime } from "@/components/ui";
import { ImpressumLink } from "@/components/impressum-link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const giveaways = await db.giveaway.findMany({
    where: {
      publicResults: true,
      status: { in: ["COMMITTED", "DRAWN", "VERIFYING", "COMPLETED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { prizes: { orderBy: { rank: "asc" } } },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">Gewinnspiele</h1>
        <p className="mt-2 text-slate-600">
          Alle Verlosungen samt Gewinnen und Ergebnissen. Jede Ziehung ist
          nachrechenbar — der Nachweis steht auf der jeweiligen Seite.
        </p>
      </header>

      {giveaways.length === 0 ? (
        <Card>
          <p className="text-slate-600">Aktuell läuft kein Gewinnspiel.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {giveaways.map((g) => (
            <Link key={g.id} href={`/gewinnspiel/${g.slug}`} className="block">
              <Card className="transition hover:border-slate-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{g.title}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {g.prizes.length > 0
                        ? g.prizes.map((p) => p.title).join(" · ")
                        : "Gewinne werden noch bekannt gegeben"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Angelegt {formatDateTime(g.createdAt)}
                    </p>
                  </div>
                  <Badge tone={g.status === "COMPLETED" ? "good" : "info"}>
                    {g.status === "COMPLETED" ? "Abgeschlossen" : "Läuft"}
                  </Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <footer className="mt-12 flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500">
        <p className="max-w-xl">
          Diese Aktionen stehen in keiner Verbindung zu Instagram, TikTok oder YouTube
          und werden von diesen weder gesponsert noch unterstützt oder organisiert.
        </p>
        <span className="flex shrink-0 gap-4">
          <ImpressumLink />
          {/* Ohne diesen Link ist die Seite beim ersten Start eine Sackgasse:
              Es gäbe keinen Weg zur Ersteinrichtung. */}
          <Link href="/admin" className="shrink-0 underline hover:text-slate-800">
            Verwaltung
          </Link>
        </span>
      </footer>
    </main>
  );
}
