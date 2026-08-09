import { redirect } from "next/navigation";
import { getSessionUserId, ownerExists } from "@/lib/auth";
import { login, setupOwner } from "../actions";
import { ActionForm } from "@/components/action-form";
import { Card, CardTitle, Field, Notice, inputClass } from "@/components/ui";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/admin");

  const exists = await ownerExists();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-6 text-center text-2xl font-bold">Gewinnspiel-Tool</h1>

      <Card>
        {exists ? (
          <>
            <CardTitle>Anmelden</CardTitle>
            <ActionForm action={login} submitLabel="Anmelden">
              <div className="space-y-4">
                <Field label="E-Mail">
                  <input
                    className={inputClass}
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                  />
                </Field>
                <Field label="Passwort">
                  <input
                    className={inputClass}
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
              </div>
            </ActionForm>
          </>
        ) : (
          <>
            <CardTitle hint="Es gibt noch kein Konto. Lege jetzt dein Betreiberkonto an — danach ist die Einrichtung abgeschlossen.">
              Ersteinrichtung
            </CardTitle>

            <div className="mb-4">
              <Notice title="Nur ein Konto">
                Das Tool ist für eine Person gedacht. Nach diesem Schritt lässt sich
                kein weiteres Konto mehr anlegen.
              </Notice>
            </div>

            <ActionForm action={setupOwner} submitLabel="Konto anlegen">
              <div className="space-y-4">
                <Field label="E-Mail">
                  <input
                    className={inputClass}
                    type="email"
                    name="email"
                    autoComplete="username"
                    required
                  />
                </Field>
                <Field
                  label="Passwort"
                  hint="Mindestens 12 Zeichen. Am besten ein zufälliges Passwort aus dem Passwortmanager."
                >
                  <input
                    className={inputClass}
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                  />
                </Field>
              </div>
            </ActionForm>
          </>
        )}
      </Card>
    </main>
  );
}
