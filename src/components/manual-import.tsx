"use client";

import { useState, useTransition } from "react";
import { Button, Field, Notice, inputClass } from "./ui";
import type { ImportPreviewResult } from "@/app/admin/actions";

/// Zweistufiger Import: erst zeigen, was erkannt wurde, dann uebernehmen.
/// Der Parser muss das Format erraten — deshalb gehoert die Sichtkontrolle
/// vor den Schreibzugriff. Sonst faellt ein Fehlgriff erst auf, wenn die
/// Teilnehmerliste schon festgeschrieben ist.
export function ManualImport({
  preview,
  confirm,
  platformLabel,
}: {
  preview: (raw: string) => Promise<ImportPreviewResult>;
  confirm: (raw: string) => Promise<void>;
  platformLabel: string;
}) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ImportPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = () => {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await preview(raw));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Das Prüfen ist fehlgeschlagen.");
      }
    });
  };

  const apply = () => {
    setError(null);
    startTransition(async () => {
      try {
        await confirm(raw);
        setRaw("");
        setResult(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Das Übernehmen ist fehlgeschlagen.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">
          So kommst du an die {platformLabel}-Kommentare
        </summary>
        <ol className="mt-3 list-inside list-decimal space-y-1 text-sm text-slate-700">
          <li>Beitrag im <strong>Browser am Rechner</strong> öffnen — in der App lässt sich nichts kopieren.</li>
          <li>Kommentarbereich öffnen und <strong>bis ganz unten scrollen</strong>, bis alle geladen sind.</li>
          <li>Mit der Maus über die Kommentare ziehen und <strong>Strg+C</strong> (Mac: Cmd+C).</li>
          <li>Hier einfügen und <strong>Prüfen</strong> — du siehst erst, was erkannt wurde.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-600">
          Datumsangaben, „Antworten" und Like-Zahlen werden automatisch aussortiert.
          Auch eine Tabelle mit Kopfzeile (<code>Benutzer;Kommentar;Datum</code>) wird gelesen.
        </p>
      </details>

      <Field label="Kommentare einfügen">
        <textarea
          className={`${inputClass} h-40 font-mono text-xs`}
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setResult(null);
          }}
          placeholder={"anna_berg\nIch bin dabei @ben @carla\nAntworten\n12"}
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {result ? (
        result.count === 0 ? (
          <Notice title="Es wurde keine einzige Teilnahme erkannt" tone="warn">
            Erkannt werden drei Formate: eine Tabelle mit Kopfzeile
            (<code>Benutzer;Kommentar;Datum</code>), „Name: Text" je Zeile, oder der
            Name in einer Zeile mit dem Kommentar darunter. Prüf am besten, ob beim
            Kopieren die Namen mitgekommen sind.
          </Notice>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">
              {result.count} Teilnahmen erkannt
              <span className="font-normal text-slate-600"> · Format: {result.format}</span>
            </p>

            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-1 pr-4 font-medium">Name</th>
                  <th className="pb-1 font-medium">Kommentar</th>
                </tr>
              </thead>
              <tbody>
                {result.sample.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1 pr-4 align-top font-medium whitespace-nowrap">
                      @{row.username}
                    </td>
                    <td className="py-1 align-top text-slate-700">{row.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.count > result.sample.length ? (
              <p className="mt-2 text-xs text-slate-500">
                … und {result.count - result.sample.length} weitere.
              </p>
            ) : null}

            {result.warnings.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-amber-800">
                  {result.warnings.length} Zeile(n) konnten nicht zugeordnet werden
                </summary>
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-amber-800">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={check} disabled={pending || !raw.trim()}>
          {pending && !result ? "Prüfe…" : "Prüfen"}
        </Button>

        {result && result.count > 0 ? (
          <Button type="button" onClick={apply} disabled={pending}>
            {pending ? "Übernehme…" : `Diese ${result.count} Teilnahmen übernehmen`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
