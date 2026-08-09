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
export function TextePanel({
  texte,
  veroeffentlichen,
  slug,
}: {
  texte: () => Promise<TextsResult>;
  veroeffentlichen: () => Promise<{ fileName: string; url: string | null }>;
  slug: string;
}) {
  const [result, setResult] = useState<TextsResult | null>(null);
  const [datei, setDatei] = useState<{ fileName: string; url: string | null } | null>(null);
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
          onClick={() => run(async () => setResult(await texte()))}
        >
          Texte erzeugen
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => run(async () => setDatei(await veroeffentlichen()))}
        >
          Seite für GitHub erzeugen
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {datei ? (
        <Notice title={`Datei erzeugt: ${datei.fileName}`}>
          Sie liegt im Ordner <code>veroeffentlichung</code> neben start.bat.
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Auf GitHub dein Veröffentlichungs-Repo öffnen</li>
            <li><strong>Add file → Upload files</strong>, die Datei hineinziehen</li>
            <li>Unten auf <strong>Commit changes</strong></li>
          </ol>
          {datei.url ? (
            <p className="mt-2">
              Danach erreichbar unter:{" "}
              <span className="font-mono text-xs break-all">{datei.url}</span>
            </p>
          ) : (
            <p className="mt-2">
              Trag unter <strong>Einstellungen</strong> die Adresse deiner
              veröffentlichten Seiten ein, dann baut das Tool den fertigen Link
              für den Beitrag.
            </p>
          )}
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
