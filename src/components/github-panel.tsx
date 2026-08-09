"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardTitle, Notice } from "./ui";

/// Zugang zu GitHub prüfen und den Schlüssel wieder loswerden.
///
/// Die Prüfung gibt es, damit ein falscher oder abgelaufener Schlüssel
/// auffällt, bevor es darauf ankommt — und nicht kurz vor der Ziehung.
export function GitHubPanel({
  pruefen,
  entfernen,
  repo,
  hatSchluessel,
}: {
  pruefen: () => Promise<{ meldung: string }>;
  entfernen: () => Promise<void>;
  repo: string;
  hatSchluessel: boolean;
}) {
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
      <CardTitle>Hochladen auf GitHub</CardTitle>

      {hatSchluessel && repo ? (
        <p className="text-sm text-slate-600">
          Eingerichtet für <strong>{repo}</strong>. Beim Veröffentlichen lädt das
          Tool die Seiten selbst hoch und schaltet GitHub Pages beim ersten Mal ein.
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Noch nicht eingerichtet. Trag oben Repository und Zugangsschlüssel ein —
          dann entfällt das Hochladen von Hand. Ohne beides bleibt alles wie bisher:
          Das Tool erzeugt die Dateien, hochladen musst du sie selbst.
        </p>
      )}

      <details className="mt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">
          So legst du den Zugangsschlüssel an
        </summary>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>Auf GitHub oben rechts aufs Profilbild → <strong>Settings</strong></li>
          <li>Ganz unten links <strong>Developer settings</strong></li>
          <li>
            <strong>Personal access tokens → Fine-grained tokens → Generate new
            token</strong>
          </li>
          <li>Name z. B. „Gewinnspiel-Tool“, Laufzeit wählen</li>
          <li>
            <strong>Repository access → Only select repositories</strong> → dein
            Repository
          </li>
          <li>
            <strong>Permissions → Repository permissions</strong>:{" "}
            <strong>Contents</strong> auf <em>Read and write</em>,{" "}
            <strong>Pages</strong> auf <em>Read and write</em>
          </li>
          <li>
            <strong>Generate token</strong> und kopieren — GitHub zeigt ihn{" "}
            <strong>nur einmal</strong>
          </li>
          <li>Oben einfügen und speichern</li>
        </ol>
        <p className="mt-2">
          Der Schlüssel gilt nur für dieses eine Repository, nicht für dein übriges
          Konto. Er liegt verschlüsselt in der Datenbank und wird nie wieder
          angezeigt. Läuft er ab, legst du einen neuen an.
        </p>
      </details>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => run(async () => setMeldung((await pruefen()).meldung))}
        >
          Verbindung prüfen
        </Button>
        {hatSchluessel ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Zugangsschlüssel entfernen?")) return;
              run(async () => {
                await entfernen();
                setMeldung("Zugangsschlüssel entfernt.");
              });
            }}
          >
            Schlüssel entfernen
          </Button>
        ) : null}
      </div>

      {meldung ? (
        <div className="mt-3">
          <Notice title="GitHub">{meldung}</Notice>
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
