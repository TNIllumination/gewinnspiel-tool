import Link from "next/link";
import { redirect } from "next/navigation";
import packageJson from "../../../package.json";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { PLATFORMS, type PlatformId } from "@/platforms/base";
import {
  createGiveaway,
  einstiegsschritte,
  faelligeLoeschungen,
  impressumUebersprungen,
  loescheTeilnehmerdaten,
  logout,
  shutdownServer,
} from "./actions";
import { Einstieg } from "@/components/einstieg";
import { ActionForm } from "@/components/action-form";
import { BeendenButton } from "@/components/beenden-button";
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

const NEW_GIVEAWAY_PLATFORMS = [
  {
    id: "SANDBOX",
    label: "Testmodus",
    hint: "Erfundene Teilnehmer zum gefahrlosen Ausprobieren.",
  },
  {
    id: "INSTAGRAM",
    label: "Instagram",
    hint: "Kommentare einfügen — automatisch erst nach der Meta-Freigabe.",
  },
  {
    id: "TIKTOK",
    label: "TikTok",
    hint: "Kommentare einfügen, in Etappen möglich.",
  },
  {
    id: "YOUTUBE",
    label: "YouTube",
    hint: "Kommentare einfügen.",
  },
] as const;

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

  const schritte = await einstiegsschritte();
  const faellig = await faelligeLoeschungen();

  const giveaways = await db.giveaway.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sources: { orderBy: { platform: "asc" } },
      _count: { select: { entries: true } },
    },
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
            <Link
              href="/admin/einstellungen"
              className="text-sm text-slate-600 underline hover:text-slate-900"
            >
              Einstellungen
            </Link>
            <span className="text-xs text-slate-400">Fassung {VERSION}</span>
            <form action={logout}>
              <Button variant="secondary" type="submit">
                Abmelden
              </Button>
            </form>
            <BeendenButton beenden={shutdownServer} />
          </div>
        }
      />

      <div className="mb-8">
        <Einstieg schritte={schritte} impressumUeberspringen={impressumUebersprungen} />
      </div>

      {/* Die Datenschutzerklärung sagt eine Löschung nach Ablauf der Frist zu.
          Ein Hintergrunddienst geht nicht — das Tool läuft nur, wenn du es
          startest. Also wird hier erinnert, sichtbar genug zum Handeln. */}
      {faellig.length > 0 ? (
        <div className="mb-8">
          <Card className="border-amber-300 bg-amber-50">
            <CardTitle hint="Deine Datenschutzerklärung sagt das zu.">
              Aufbewahrungsfrist abgelaufen
            </CardTitle>
            <p className="mb-4 text-sm text-amber-900">
              Bei {faellig.length === 1 ? "einem Gewinnspiel" : `${faellig.length} Gewinnspielen`} ist
              die Frist überschritten. Gelöscht werden die Teilnahmen aller
              <strong> nicht gezogenen </strong> Personen. Gewinner und Nachrücker
              bleiben samt Prüfsumme und Zufallszahl — sonst ließe sich der
              veröffentlichte Nachweis nicht mehr erzeugen. Sie stehen ohnehin auf
              der veröffentlichten Seite.
            </p>
            <ul className="space-y-3">
              {faellig.map((f) => (
                <li key={f.id} className="rounded-lg border border-amber-300 bg-white p-4">
                  <p className="font-medium text-slate-900">{f.title}</p>
                  <p className="text-sm text-slate-600">
                    {f.entries} löschbare Teilnahmen · Frist seit {f.ueberfaellig} Tag
                    {f.ueberfaellig === 1 ? "" : "en"} abgelaufen
                  </p>
                  <ActionForm
                    action={loescheTeilnehmerdaten.bind(null, f.id)}
                    submitLabel="Teilnehmerdaten jetzt löschen"
                    variant="danger"
                    confirm={`${f.entries} Teilnahmen von „${f.title}" löschen? Gewinner, Nachrücker, Prüfsumme und Zufallszahl bleiben erhalten.`}
                  />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

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
                          {g.sources
                            .map((s) => PLATFORMS[s.platform as PlatformId].label)
                            .join(" + ") || "keine Plattform"}{" "}
                          · {g._count.entries} Teilnahmen · angelegt{" "}
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

              <fieldset>
                <legend className="mb-1 block text-sm font-medium text-slate-800">
                  Plattformen
                </legend>
                <p className="mb-2 text-xs text-slate-500">
                  Mehrere möglich — alle Teilnahmen landen in einem gemeinsamen
                  Lostopf. Wer auf zwei Plattformen kommentiert, ist zweimal dabei.
                </p>
                <div className="space-y-2">
                  {NEW_GIVEAWAY_PLATFORMS.map(({ id, label, hint }) => (
                    <label key={id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        name={`platform_${id}`}
                        defaultChecked={id === "SANDBOX"}
                        className="mt-0.5 size-4"
                      />
                      <span>
                        {label}
                        <span className="block text-xs text-slate-500">{hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Links zu den Beiträgen"
                hint="Optional. Hilft später beim Prüfen und steht in den Teilnahmebedingungen."
              >
                <div className="space-y-2">
                  {NEW_GIVEAWAY_PLATFORMS.filter((p) => p.id !== "SANDBOX").map(
                    ({ id, label }) => (
                      <input
                        key={id}
                        className={inputClass}
                        name={`postUrl_${id}`}
                        placeholder={`${label}: https://…`}
                      />
                    ),
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" hint="Optional.">
                  <input className={inputClass} type="datetime-local" name="startsAt" />
                </Field>
                <Field label="Einsendeschluss" hint="Später zählt nicht mehr.">
                  <input className={inputClass} type="datetime-local" name="endsAt" />
                </Field>
              </div>

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
