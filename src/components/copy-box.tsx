"use client";

import { useState } from "react";
import { Button } from "./ui";

/// Textblock mit Kopierknopf. Einen 64-stelligen Hash oder einen ganzen
/// Rechtstext tippt sonst niemand ab.
export function CopyBox({
  title,
  text,
  hint,
  warning,
}: {
  title: string;
  text: string;
  hint?: string;
  warning?: string | null;
}) {
  const [kopiert, setKopiert] = useState(false);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ältere Browser oder fehlende Berechtigung: Der Text steht sichtbar
      // daneben und lässt sich von Hand markieren.
      return;
    }
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2000);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <Button
          type="button"
          variant={kopiert ? "success" : "secondary"}
          onClick={kopieren}
          className="!mt-0"
        >
          {kopiert ? "Kopiert ✓" : "Kopieren"}
        </Button>
      </div>

      {hint ? <p className="mb-2 text-xs text-slate-600">{hint}</p> : null}

      {warning ? (
        <p className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warning}
        </p>
      ) : null}

      <textarea
        readOnly
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        className="h-48 w-full rounded border border-slate-300 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800"
      />
    </div>
  );
}
