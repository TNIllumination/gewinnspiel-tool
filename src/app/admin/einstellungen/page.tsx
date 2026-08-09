import { redirect } from "next/navigation";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { publishIndex, saveSettings } from "../actions";
import { ActionForm } from "@/components/action-form";
import {
  Card,
  CardTitle,
  Field,
  Notice,
  PageHeader,
  formatDateTime,
  inputClass,
} from "@/components/ui";

export const dynamic = "force-dynamic";

/// Wann die Übersichtsseite zuletzt geschrieben wurde — oder null, wenn es
/// sie noch nicht gibt. Das ist die ehrlichste Rückmeldung: es zählt, was
/// im Ordner liegt, nicht was das Tool gemeldet hat.
async function indexWrittenAt(): Promise<Date | null> {
  try {
    const info = await stat(join(process.cwd(), "veroeffentlichung", "index.html"));
    return info.mtime;
  } catch {
    return null;
  }
}

export default async function EinstellungenPage() {
  if (!(await getSessionUserId())) redirect("/admin/login");

  const settings = await db.settings.findUnique({ where: { id: "settings" } });
  const indexAt = await indexWrittenAt();
  const angaben = Boolean(settings?.organizer?.trim() && settings?.contact?.trim());

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <PageHeader
        title="Einstellungen"
        subtitle="Angaben, die in jeden Rechtstext einfließen."
        back={{ href: "/admin", label: "Zurück zur Verwaltung" }}
      />

      <Notice title="Warum das gebraucht wird">
        Instagram und TikTok verlangen, dass in den Teilnahmebedingungen ein
        <strong> alleiniger Ansprechpartner </strong> benannt wird und Rückfragen
        ausdrücklich nicht an die Plattform gehen. Ohne diese Angaben kann das Tool
        keinen vollständigen Text erzeugen.
      </Notice>

      <Card>
        <CardTitle>Veranstalter</CardTitle>

        <ActionForm action={saveSettings} submitLabel="Speichern">
          <div className="space-y-4">
            <Field
              label="Name oder Firma"
              hint="Wer das Gewinnspiel veranstaltet — so, wie es öffentlich genannt werden soll."
            >
              <input
                className={inputClass}
                name="organizer"
                required
                defaultValue={settings?.organizer ?? ""}
                placeholder="z. B. Max Mustermann"
              />
            </Field>

            <Field
              label="Kontakt für Rückfragen"
              hint="E-Mail-Adresse oder dein Profilname. Erscheint in den Teilnahmebedingungen."
            >
              <input
                className={inputClass}
                name="contact"
                required
                defaultValue={settings?.contact ?? ""}
                placeholder="z. B. kontakt@beispiel.de"
              />
            </Field>

            <Field
              label="Adresse deines Impressums"
              hint="Die veröffentlichten Seiten sind ein eigenes Online-Angebot und müssen ein Impressum erreichbar machen (§ 5 DDG). Fehlt „https://“, wird es beim Speichern ergänzt."
            >
              <input
                className={inputClass}
                name="impressumUrl"
                defaultValue={settings?.impressumUrl ?? ""}
                placeholder="https://mein.online-impressum.de/deinname"
              />
            </Field>

            <Field
              label="Adresse deiner veröffentlichten Seiten"
              hint="Optional. Wenn du die ausführlichen Teilnahmebedingungen auf GitHub Pages ablegst, trag hier die Basisadresse ein — dann baut das Tool den fertigen Link für den Beitrag."
            >
              <input
                className={inputClass}
                name="publishBaseUrl"
                defaultValue={settings?.publishBaseUrl ?? ""}
                placeholder="https://deinname.github.io/gewinnspiele"
              />
            </Field>
          </div>
        </ActionForm>
      </Card>

      {!settings?.impressumUrl?.trim() ? (
        <Notice title="Kein Impressum hinterlegt" tone="warn">
          Sobald du geschäftlich auftrittst — und dazu zählt Reichweite, die deiner
          Streaming-Tätigkeit dient — brauchen die veröffentlichten Seiten ein
          Impressum. Für eine rein private Verlosung im Freundeskreis gilt das nicht.
          Diese Einschätzung liegt bei dir, deshalb blockiert das Tool hier nichts.
        </Notice>
      ) : null}

      <Card>
        <CardTitle>Übersichtsseite</CardTitle>
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Erzeugt <code className="rounded bg-slate-100 px-1">index.html</code> im
            Ordner <strong>veroeffentlichung</strong> — eine Startseite, die alle
            bereits veröffentlichten Gewinnspiele auflistet.
          </p>
          <p>
            Lade sie als <strong>Erstes</strong> in dein GitHub-Repository. Bei einem
            leeren Repository bietet GitHub Pages keinen Branch zur Auswahl an — die
            Einstellung bleibt grau. Erst mit dieser Datei lässt sich Pages
            einschalten. Danach schreibt das Tool die Übersicht bei jeder
            Veröffentlichung von selbst neu.
          </p>
          <p className={indexAt ? "text-slate-600" : "text-slate-500"}>
            {indexAt
              ? `Zuletzt erzeugt: ${formatDateTime(indexAt)}`
              : "Noch nicht erzeugt."}
          </p>
        </div>
        <ActionForm
          action={publishIndex}
          submitLabel="Übersichtsseite erzeugen"
          variant="secondary"
        />
        {!angaben ? (
          <p className="mt-2 text-xs text-slate-500">
            Dafür müssen Name und Kontakt oben gespeichert sein.
          </p>
        ) : null}
      </Card>

      <p className="text-xs text-slate-500">
        Das Tool erzeugt die Texte nach den Vorgaben der Plattformen und den
        gesetzlichen Informationspflichten. Die einmalige Freigabe des fertigen
        Wortlauts gehört trotzdem zu einem Anwalt — dies ist keine Rechtsberatung.
      </p>
    </main>
  );
}
