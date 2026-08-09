import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { saveSettings } from "../actions";
import { ActionForm } from "@/components/action-form";
import { Card, CardTitle, Field, Notice, PageHeader, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  if (!(await getSessionUserId())) redirect("/admin/login");

  const settings = await db.settings.findUnique({ where: { id: "settings" } });

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

      <p className="text-xs text-slate-500">
        Das Tool erzeugt die Texte nach den Vorgaben der Plattformen und den
        gesetzlichen Informationspflichten. Die einmalige Freigabe des fertigen
        Wortlauts gehört trotzdem zu einem Anwalt — dies ist keine Rechtsberatung.
      </p>
    </main>
  );
}
