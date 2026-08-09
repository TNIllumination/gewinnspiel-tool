"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Card, CardTitle } from "./ui";
import type { Einstiegsschritt } from "@/app/admin/actions";

/// Die Einstiegsliste im Dashboard.
///
/// Ein Handbuch liest niemand vor dem ersten Start. Also steht die Anleitung
/// dort, wo man ohnehin hinsieht — und zwar als Liste, die den Zustand aus
/// der Datenbank ableitet, nicht als Klickstrecke, die einen einsperrt. Wer
/// die Reihenfolge umgeht oder Wochen spaeter weitermacht, findet sie
/// trotzdem richtig vor.
export function Einstieg({
  schritte,
  impressumUeberspringen,
}: {
  schritte: Einstiegsschritt[];
  impressumUeberspringen: () => Promise<{ fehler?: string } | void>;
}) {
  const offen = schritte.filter((s) => !s.erledigt);
  const fertig = schritte.length - offen.length;
  const [zeigen, setZeigen] = useState(offen.length > 0);
  const [pending, startTransition] = useTransition();

  if (!zeigen) {
    return (
      <p className="text-sm text-slate-500">
        Alles eingerichtet.{" "}
        <button
          type="button"
          onClick={() => setZeigen(true)}
          className="underline hover:text-slate-800"
        >
          Einstiegsliste anzeigen
        </button>
      </p>
    );
  }

  const naechster = offen[0];

  return (
    <Card>
      <CardTitle hint={`${fertig} von ${schritte.length} erledigt`}>
        {offen.length > 0 ? "So kommst du zum ersten Gewinnspiel" : "Alles erledigt"}
      </CardTitle>

      {naechster ? (
        <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-800">
            Als Nächstes
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{naechster.titel}</p>
          <p className="mt-1 text-sm text-slate-700">{naechster.warum}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={naechster.ziel}>
              <Button type="button">{naechster.knopf}</Button>
            </Link>
            {/* Nicht jeder braucht ein Impressum — sonst haengt die Liste ewig. */}
            {naechster.id === "impressum" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await impressumUeberspringen();
                  })
                }
              >
                Brauche ich nicht
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <ol className="space-y-1 text-sm">
        {schritte.map((s) => (
          <li
            key={s.id}
            className={`flex items-start gap-2 ${
              s.erledigt ? "text-slate-500" : "text-slate-800"
            }`}
          >
            <span aria-hidden className="mt-0.5">
              {s.erledigt ? "✓" : "○"}
            </span>
            <span className={s.erledigt ? "line-through" : ""}>{s.titel}</span>
          </li>
        ))}
      </ol>

      {offen.length === 0 ? (
        <button
          type="button"
          onClick={() => setZeigen(false)}
          className="mt-4 text-sm text-slate-500 underline hover:text-slate-800"
        >
          Liste ausblenden
        </button>
      ) : null}
    </Card>
  );
}
