import Link from "next/link";
import { redirect } from "next/navigation";
import packageJson from "../../../package.json";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { PLATFORMS, type PlatformId } from "@/platforms/base";
import { createGiveaway, logout } from "./actions";
import { ActionForm } from "@/components/action-form";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  PageHeader,
  formatDateTime,
  inputClass,
} from "@/components/ui";

// Die Fassungsnummer steht in der package.json — eine Quelle, kein zweiter Ort,
// der beim Aktualisieren vergessen werden könnte.
const VERSION = process.env.npm_package_version ?? packageJson.version;

const STATUS_LABELS: Record<string, { label: string; tone: "neutral" | "info" | "good" | "warn" }> = {
  DRAFT: { label: "Entwurf", tone: "neutral" },
  COLLECTING: { label: "Teilnahmen sammeln", tone: "info" },
  COMMITTED: { label: "Liste festgeschrieben", tone: "warn" },
  DRAWN: { label: "Gezogen", tone: "good" },
  VERIFYING: { label: "Verifikation läuft", tone: "warn" },
  COMPLETED: { label: "Abgeschlossen", tone: "good" },
  CANCELLED: { label: "Abgebrochen", tone: "neutral" },
};

export default async function AdminPage() {
  if (!(await getSessionUserId())) redirect("/admin/login");

  const giveaways = await db.giveaway.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { entries: true } } },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Meine Gewinnspiele"
        subtitle="Anlegen, auswerten, ziehen — und nachweisen, dass es fair war."
        action={
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/admin/hilfe"
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Hilfe
            </Link>
            <Link
              href="/"
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Öffentliche Seite
            </Link>
            <span className="text-xs text-slate-400">Fassung {VERSION}</span>
            <form action={logout}>
              <Button variant="secondary" type="submit">
                Abmelden
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {giveaways.length === 0 ? (
            <Card>
              <p className="text-slate-600">
                Noch kein Gewinnspiel angelegt. Fang rechts an — im Testmodus kannst du
                den ganzen Ablauf gefahrlos ausprobieren, ohne echte Daten.
              </p>
            </Card>
          ) : (
            giveaways.map((g) => {
              const status = STATUS_LABELS[g.status] ?? STATUS_LABELS.DRAFT;
              return (
                <Link key={g.id} href={`/admin/${g.id}`} className="block">
                  <Card className="transition hover:border-slate-400">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{g.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          {PLATFORMS[g.platform as PlatformId].label} ·{" "}
                          {g._count.entries} Teilnahmen · angelegt{" "}
                          {formatDateTime(g.createdAt)}
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <Card className="h-fit">
          <CardTitle hint="Der Testmodus braucht keinen Plattform-Zugang.">
            Neues Gewinnspiel
          </CardTitle>

          <ActionForm action={createGiveaway} submitLabel="Anlegen">
            <div className="space-y-4">
              <Field label="Titel">
                <input
                  className={inputClass}
                  name="title"
                  required
                  minLength={3}
                  placeholder="z. B. Merch-Verlosung Januar"
                />
              </Field>

              <Field label="Plattform">
                <select className={inputClass} name="platform" defaultValue="SANDBOX">
                  <option value="SANDBOX">Testmodus (erfundene Teilnehmer)</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                </select>
              </Field>

              <Field label="Link zum Beitrag" hint="Optional, hilft später beim Prüfen.">
                <input className={inputClass} name="postUrl" placeholder="https://…" />
              </Field>

              <Field
                label="Nachrücker"
                hint="Werden mitgezogen. Fällt jemand bei der Prüfung durch, rückt der Nächste automatisch nach."
              >
                <input
                  className={inputClass}
                  type="number"
                  name="substituteCount"
                  defaultValue={5}
                  min={0}
                  max={50}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      </div>
    </main>
  );
}
