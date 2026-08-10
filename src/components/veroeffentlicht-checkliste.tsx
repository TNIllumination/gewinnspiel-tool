"use client";

import { useSyncExternalStore } from "react";
import { seit, stand, type Stufe } from "@/lib/checkliste";
import { Card, CardTitle, Notice, formatDateTime } from "./ui";

// Was ist gerade online?
//
// Das Tool weiss, was hochgeladen wurde — hier sagt es es auch. Gerechnet
// wird in `src/lib/checkliste.ts`, damit sich die Zustaende ohne Browser
// pruefen lassen.

export type { Stufe };

// Die Uhr ist eine aeussere Quelle, kein Zustand dieser Komponente. Genau
// dafuer gibt es useSyncExternalStore: Der Wert bleibt zwischen den Takten
// stabil (sonst gaebe es eine Endlosschleife), auf dem Server ist er 0, und
// nach dem Anmelden steht er sofort — nicht erst nach einer Sekunde.
let aktuell = 0;
const hoerer = new Set<() => void>();
let takt: ReturnType<typeof setInterval> | null = null;

function anmelden(melde: () => void) {
  hoerer.add(melde);
  if (!takt) {
    aktuell = Date.now();
    takt = setInterval(() => {
      aktuell = Date.now();
      for (const h of hoerer) h();
    }, 5000);
  }
  return () => {
    hoerer.delete(melde);
    if (hoerer.size === 0 && takt) {
      clearInterval(takt);
      takt = null;
    }
  };
}

function useJetzt(): number | null {
  const wert = useSyncExternalStore(
    anmelden,
    () => aktuell,
    () => 0,
  );
  return wert === 0 ? null : wert;
}

export function VeroeffentlichtCheckliste({
  stufen,
  zuletztHochgeladen,
  seiteUrl,
}: {
  stufen: Stufe[];
  /// Letzter erfolgreicher Upload — null, wenn nur Dateien erzeugt wurden.
  zuletztHochgeladen: string | null;
  seiteUrl: string | null;
}) {
  // „vor X Sekunden" veraltet, wenn man die Seite offen liegen lässt.
  const jetzt = useJetzt();

  const upload = zuletztHochgeladen ? new Date(zuletztHochgeladen) : null;
  const { baut, nurErzeugt, naechste } = stand(stufen, upload, jetzt);

  return (
    <Card>
      <CardTitle hint="Damit du nicht zweimal drückst oder vergeblich wartest.">
        Was ist online?
      </CardTitle>

      <ol className="space-y-2 text-sm">
        {stufen.map((s) => (
          <li key={s.titel} className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5">
              {s.am ? "✓" : s.spaeter ? "·" : "○"}
            </span>
            <span className={s.am ? "text-slate-500" : "text-slate-800"}>
              <span className={s.am ? "line-through" : ""}>{s.titel}</span>
              <span className="block text-xs text-slate-500">
                {s.am
                  ? `${jetzt !== null ? `${seit(new Date(s.am), jetzt)} · ` : ""}${formatDateTime(new Date(s.am))}`
                  : s.spaeter
                    ? "kommt später"
                    : s.inhalt}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-3 text-sm">
        {upload ? (
          <p className="text-slate-600">
            Zuletzt hochgeladen:{" "}
            <strong>
              {jetzt !== null ? seit(upload, jetzt) : formatDateTime(upload)}
            </strong>
          </p>
        ) : nurErzeugt ? (
          <p className="text-slate-600">
            Erzeugt, aber <strong>noch nicht hochgeladen</strong> — die Dateien liegen
            im Ordner <code className="rounded bg-slate-100 px-1">veroeffentlichung</code>.
          </p>
        ) : null}

        {baut ? (
          <Notice title="GitHub Pages baut die Seite gerade neu">
            Das dauert ein bis zwei Minuten. <strong>Nicht nochmal drücken</strong> — es
            ändert nichts und lädt dieselbe Datei erneut hoch.
          </Notice>
        ) : null}

        {seiteUrl ? (
          <p>
            <a
              href={seiteUrl}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-slate-900"
            >
              Veröffentlichte Seite ansehen
            </a>
          </p>
        ) : null}

        {naechste ? (
          <p className="text-slate-600">
            Als Nächstes: <strong>{naechste.titel}</strong>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
