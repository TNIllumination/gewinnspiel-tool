"use client";

import { useState, useTransition } from "react";
import { Button, Notice } from "./ui";
import { CopyBox } from "./copy-box";
import type { TextsResult } from "@/app/admin/actions";

/// Erzeugt Teilnahmebedingungen, Nachweis und die Datei für GitHub Pages.
///
/// Bewusst auf Knopfdruck statt beim Seitenaufbau: Ohne Veranstalterangaben
/// gäbe es sonst bei jedem Aufruf einen Fehler, statt eines Hinweises an
/// der Stelle, wo er hingehört.
interface DateiErgebnis {
  fehler?: string;
  fileName: string;
  url: string | null;
  hochgeladen?: boolean;
  commitUrl?: string;
  pagesUrl?: string;
  hinweis?: string;
}

export function TextePanel({
  texte,
  veroeffentlichen,
  slug,
  hochladen,
}: {
  texte: () => Promise<TextsResult | { fehler?: string }>;
  veroeffentlichen: () => Promise<DateiErgebnis | { fehler?: string }>;
  slug: string;
  /// Ist ein Zugangsschlüssel hinterlegt, geht die Datei gleich online.
  hochladen: boolean;
}) {
  const [result, setResult] = useState<TextsResult | null>(null);
  const [datei, setDatei] = useState<DateiErgebnis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Das hat leider nicht geklappt.",
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const ergebnis = await texte();
              if ("fehler" in ergebnis && ergebnis.fehler) setError(ergebnis.fehler);
              else setResult(ergebnis as TextsResult);
            })
          }
        >
          Texte erzeugen
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            // Ab hier stehen die Teilnehmernamen im Netz. Das soll ein
            // bewusster Klick sein, kein versehentlicher.
            if (
              hochladen &&
              !window.confirm(
                "Damit werden die Seite und die Teilnehmerliste öffentlich sichtbar. Fortfahren?",
              )
            ) {
              return;
            }
            run(async () => {
              const ergebnis = await veroeffentlichen();
              if (!("fileName" in ergebnis)) setError(ergebnis.fehler ?? "");
              else setDatei(ergebnis);
            });
          }}
        >
          {hochladen ? "Veröffentlichen und hochladen" : "Seite für GitHub erzeugen"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {datei ? (
        <Notice
          title={
            datei.hochgeladen
              ? `Hochgeladen: ${datei.fileName}`
              : `Datei erzeugt: ${datei.fileName}`
          }
        >
          {datei.hochgeladen ? (
            <>
              <p>
                Die Seite, die Übersicht und die Datenschutzerklärung liegen jetzt
                in deinem Repository — in einem Commit.
              </p>
              {datei.pagesUrl ? (
                <p className="mt-2">
                  Erreichbar unter:{" "}
                  <span className="font-mono text-xs break-all">{datei.pagesUrl}</span>
                  {" "}(nach dem ersten Mal dauert es ein bis zwei Minuten)
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p>
                Sie liegt im Ordner <code>veroeffentlichung</code> neben start.bat —
                zusammen mit <code>index.html</code> und{" "}
                <code>datenschutz.html</code>.
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1">
                <li>Auf GitHub dein Veröffentlichungs-Repo öffnen</li>
                <li>
                  <strong>Add file → Upload files</strong>, <strong>alle</strong>{" "}
                  Dateien hineinziehen
                </li>
                <li>Unten auf <strong>Commit changes</strong></li>
              </ol>
              <p className="mt-2">
                Das geht auch auf Knopfdruck: unter <strong>Einstellungen</strong>{" "}
                einen Zugangsschlüssel hinterlegen.
              </p>
            </>
          )}
          {datei.hinweis ? (
            <p className="mt-2 font-medium">{datei.hinweis}</p>
          ) : null}
          {!datei.hochgeladen && datei.url ? (
            <p className="mt-2">
              Nach dem Hochladen erreichbar unter:{" "}
              <span className="font-mono text-xs break-all">{datei.url}</span>
            </p>
          ) : null}
        </Notice>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <CopyBox
            title="Kurzfassung für die Bildunterschrift"
            hint={`${result.kurzLaenge} Zeichen. Gehört unter den Beitrag — nicht in einen Kommentar, dort ist bei TikTok nach etwa 150 Zeichen Schluss.`}
            warning={
              result.kurzPasst
                ? null
                : "Der Text ist länger als 2200 Zeichen und würde in der Bildunterschrift abgeschnitten. Kürze die Gewinnbeschreibungen oder verweise nur auf die ausführliche Fassung."
            }
            text={result.kurz}
          />

          <CopyBox
            title="Vollständige Teilnahmebedingungen"
            hint={`Für die veröffentlichte Seite (${slug}.html) oder als Aushang.`}
            text={result.lang}
          />

          {result.nachweis ? (
            <CopyBox
              title="Nachweis zur fairen Ziehung"
              hint="Als Kommentar unter den Beitrag — vor der Ziehung mit der Prüfsumme, danach zusätzlich mit der Zufallszahl."
              text={result.nachweis}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
