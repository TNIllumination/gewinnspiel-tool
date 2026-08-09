"use client";

import { useState, useTransition } from "react";
import { Button } from "./ui";

/// Beendet das Tool samt Konsolenfenster.
///
/// Die Verabschiedung kommt bewusst aus dem eigenen Zustand — der Server ist
/// dann schon weg, eine weitere Anfrage würde ins Leere laufen.
export function BeendenButton({
  beenden,
}: {
  beenden: () => Promise<{ fehler?: string } | void>;
}) {
  const [beendet, setBeendet] = useState(false);
  const [pending, startTransition] = useTransition();

  if (beendet) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-6">
        <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-xl">
          <p className="text-2xl font-bold text-slate-900">Beendet</p>
          <p className="mt-3 text-slate-600">
            Das Tool wurde geschlossen. Dieses Fenster kannst du jetzt zumachen.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Zum Weiterarbeiten einfach wieder <strong>start.bat</strong> doppelklicken.
            Deine Gewinnspiele bleiben gespeichert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Tool wirklich beenden? Das Konsolenfenster schließt sich mit.")) {
          return;
        }
        startTransition(async () => {
          try {
            await beenden();
          } catch {
            // Bricht die Verbindung mitten im Herunterfahren ab, ist das
            // kein Fehler — genau das war ja gewollt.
          }
          setBeendet(true);
        });
      }}
    >
      {pending ? "Wird beendet…" : "Beenden"}
    </Button>
  );
}
