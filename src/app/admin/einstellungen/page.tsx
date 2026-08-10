import { redirect } from "next/navigation";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import {
  auskunftZuPerson,
  eraseParticipant,
  publishIndex,
  removeGitHubToken,
  saveSettings,
  testGitHubConnection,
} from "../actions";
import { GitHubPanel } from "@/components/github-panel";
import { PersonenAnfrage } from "@/components/personen-anfrage";
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
              label="Wie lange bleiben veröffentlichte Seiten online?"
              hint="In Monaten nach Abschluss des Gewinnspiels. Steht so in der Datenschutzerklärung — dort ist eine konkrete Frist Pflicht."
            >
              <input
                className={inputClass}
                name="publishRetentionMonths"
                type="number"
                min={1}
                max={120}
                defaultValue={settings?.publishRetentionMonths ?? 6}
              />
            </Field>

            <Field
              label="Repository — wohin hochgeladen wird"
              hint="Dein öffentliches Repository, z. B. deinname/gewinnspiele. Beide Adressen aus dem Browser gehen auch: github.com/deinname/gewinnspiele oder deinname.github.io/gewinnspiele."
            >
              <input
                className={inputClass}
                name="githubRepo"
                defaultValue={settings?.githubRepo ?? ""}
                placeholder="deinname/gewinnspiele"
              />
            </Field>

            <Field
              label="Zugangsschlüssel für GitHub"
              hint={
                settings?.githubToken
                  ? "Hinterlegt ✓ — leer lassen, um ihn zu behalten. Nur ausfüllen, wenn du ihn ersetzen willst."
                  : "Noch keiner hinterlegt. Ohne ihn erzeugt das Tool nur die Dateien, das Hochladen machst du selbst."
              }
            >
              <input
                className={inputClass}
                name="githubToken"
                type="password"
                autoComplete="off"
                placeholder={settings?.githubToken ? "unverändert" : "github_pat_…"}
              />
            </Field>

            <Field
              label="Adresse — wo die Teilnehmer lesen"
              hint="Ergibt sich aus dem Repository — lass es leer, dann trägt das Tool die Adresse beim Speichern selbst ein. Aus ihr baut es den Link für den Beitrag."
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

      <GitHubPanel
        pruefen={testGitHubConnection}
        entfernen={removeGitHubToken}
        repo={settings?.githubRepo ?? ""}
        hatSchluessel={Boolean(settings?.githubToken)}
      />

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
            Dabei entsteht auch{" "}
            <code className="rounded bg-slate-100 px-1">datenschutz.html</code> — die
            Datenschutzerklärung, die eine öffentliche Seite braucht.
          </p>
          {settings?.githubToken ? (
            <p>
              Beides wird gleich hochgeladen und GitHub Pages beim ersten Mal
              eingeschaltet. Danach hältst du die Übersicht mit jedem
              Veröffentlichen von selbst aktuell.
            </p>
          ) : (
            <p>
              Lade die Dateien als <strong>Erstes</strong> in dein
              GitHub-Repository. Bei einem leeren Repository bietet GitHub Pages
              keinen Branch zur Auswahl an — die Einstellung bleibt grau. Erst mit
              einer Datei darin lässt sich Pages einschalten.
            </p>
          )}
          <p className={indexAt ? "text-slate-600" : "text-slate-500"}>
            {indexAt
              ? `Zuletzt erzeugt: ${formatDateTime(indexAt)}`
              : "Noch nicht erzeugt."}
          </p>
        </div>
        <ActionForm
          action={publishIndex}
          submitLabel={
            settings?.githubToken
              ? "Übersichtsseite erzeugen und hochladen"
              : "Übersichtsseite erzeugen"
          }
          variant="secondary"
        />
        {!angaben ? (
          <p className="mt-2 text-xs text-slate-500">
            Dafür müssen Name und Kontakt oben gespeichert sein.
          </p>
        ) : null}
      </Card>

      <PersonenAnfrage auskunft={auskunftZuPerson} loeschen={eraseParticipant} />

      <p className="text-xs text-slate-500">
        Das Tool erzeugt die Texte nach den Vorgaben der Plattformen und den
        gesetzlichen Informationspflichten. Die einmalige Freigabe des fertigen
        Wortlauts gehört trotzdem zu einem Anwalt — dies ist keine Rechtsberatung.
      </p>
    </main>
  );
}
