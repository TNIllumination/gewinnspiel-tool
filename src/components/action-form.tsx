"use client";

import { useActionState } from "react";
import { Button } from "./ui";
import type { ReactNode } from "react";

type State = { error?: string };

/// Next.js signalisiert Weiterleitungen und "not found" ueber geworfene
/// Fehler mit besonderem digest. Die duerfen wir nicht abfangen, sonst
/// bleibt der Nutzer auf der Seite stehen.
function isControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && /^(NEXT_REDIRECT|NEXT_NOT_FOUND)/.test(digest);
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Das hat leider nicht geklappt. Bitte noch einmal versuchen.";
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
        await action(formData);
        return {};
      } catch (error) {
        if (isControlFlow(error)) throw error;
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
