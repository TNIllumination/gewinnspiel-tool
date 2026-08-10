"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardTitle, Notice, inputClass } from "./ui";

interface Auskunft {
  gefunden: number;
  eintraege: { gewinnspiel: string; plattform: string; text: string; am: string }[];
  fehler?: string;
}

/// Auskunft und Löschung für eine teilnehmende Person.
///
/// Die erzeugte Datenschutzerklärung sagt beides zu (Art. 15 und 17 DSGVO).
/// Bis 0.7.0 gab es die Aktion zwar im Code, aber keinen Knopf — die Zusage
/// war damit nur über die Datenbank einlösbar.
export function PersonenAnfrage({
  auskunft,
  loeschen,
}: {
  auskunft: (username: string) => Promise<Auskunft | { fehler?: string }>;
  loeschen: (username: string) => Promise<{ fehler?: string } | void>;
}) {
  const [name, setName] = useState("");
  const [ergebnis, setErgebnis] = useState<Auskunft | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) => {
    setFehler(null);
    setMeldung(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      }
    });
  };

  return (
    <Card>
      <CardTitle hint="Auskunft nach Art. 15, Löschung nach Art. 17 DSGVO.">
        Anfrage einer teilnehmenden Person
      </CardTitle>

      <p className="mb-3 text-sm text-slate-600">
        Fragt jemand, welche Daten du zu ihm gespeichert hast — oder verlangt die
        Löschung — erledigst du das hier. Deine Datenschutzerklärung sagt beides zu.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Benutzername, z. B. anna_berg"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !name.trim()}
          onClick={() =>
            run(async () => {
              const r = await auskunft(name);
              if ("fehler" in r && r.fehler) setFehler(r.fehler);
              else setErgebnis(r as Auskunft);
            })
          }
        >
          Auskunft
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={pending || !name.trim()}
          onClick={() => {
            if (
              !window.confirm(
                `Alle Teilnahmen von „${name}“ löschen? Das lässt sich nicht rückgängig machen.`,
              )
            ) {
              return;
            }
            run(async () => {
              const r = await loeschen(name);
              if (r?.fehler) setFehler(r.fehler);
              else {
                setErgebnis(null);
                setMeldung(`Alle Teilnahmen von „${name}“ wurden gelöscht.`);
              }
            });
          }}
        >
          Löschen
        </Button>
      </div>

      {ergebnis ? (
        <div className="mt-4 text-sm">
          <p className="font-medium text-slate-900">
            {ergebnis.gefunden} Teilnahme{ergebnis.gefunden === 1 ? "" : "n"} gefunden
          </p>
          <ul className="mt-2 space-y-1 text-slate-700">
            {ergebnis.eintraege.map((e, i) => (
              <li key={i} className="rounded border border-slate-200 px-3 py-2">
                <span className="text-xs text-slate-500">
                  {e.gewinnspiel} · {e.plattform} · {e.am.slice(0, 10)}
                </span>
                <br />
                {e.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {meldung ? (
        <div className="mt-3">
          <Notice title="Erledigt" tone="warn">
            <p>{meldung}</p>
            {/* Die Prüfsumme wurde über die vollständige Liste gebildet. Wer
                nachträglich jemanden entfernt, macht sie unbrauchbar — das
                sagt die Datenschutzerklärung bereits zu, hier steht, was
                dann zu tun ist. */}
            <p className="mt-2">
              War die Teilnehmerliste schon veröffentlicht: Seite unter dem
              Gewinnspiel <strong>neu veröffentlichen</strong>. Die Prüfsumme lässt
              sich danach nicht mehr nachrechnen — vermerk das auf der Seite oder im
              Beitrag, statt es unerwähnt zu lassen.
            </p>
          </Notice>
        </div>
      ) : null}

      {fehler ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {fehler}
        </p>
      ) : null}
    </Card>
  );
}
