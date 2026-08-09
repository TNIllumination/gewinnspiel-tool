"use client";

import { useActionState } from "react";
import { Button } from "./ui";
import { istSteuerfluss } from "@/lib/ergebnis";
import type { ReactNode } from "react";

type State = { error?: string };

/// Was von einer geworfenen Ausnahme uebrig bleibt, ist im Produktionsbau
/// zensiert ("An error occurred in the Server Components render…"). Solche
/// Texte dem Betreiber zu zeigen, hilft niemandem.
function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (!text || /omitted in production|Server Components render|error #\d+/i.test(text)) {
    return (
      "Da ist etwas schiefgegangen. Die genaue Meldung steht im schwarzen " +
      "Fenster, in dem das Tool läuft."
    );
  }
  return text;
}

/// Formular, das Fehler aus einer Server-Action lesbar anzeigt, statt in
/// eine Fehlerseite zu laufen.
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "primary",
  className = "",
  confirm,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children?: ReactNode;
  submitLabel: string;
  variant?: "primary" | "secondary" | "danger" | "success";
  className?: string;
  /// Rueckfrage vor dem Absenden — fuer alles, was sich nicht zurueckholen laesst.
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      try {
        // Bedienfehler kommen als Rueckgabewert — nur der uebersteht die
        // Grenze zum Browser mit unveraendertem Text.
        const ergebnis = (await action(formData)) as { fehler?: string } | undefined;
        return ergebnis?.fehler ? { error: ergebnis.fehler } : {};
      } catch (error) {
        if (istSteuerfluss(error)) throw error;
        return { error: messageOf(error) };
      }
    },
    {},
  );

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state.error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant={variant} disabled={pending} className="mt-4">
        {pending ? "Einen Moment…" : submitLabel}
      </Button>
    </form>
  );
}
