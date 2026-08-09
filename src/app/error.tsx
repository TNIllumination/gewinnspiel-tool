"use client";

import Link from "next/link";

/// Was zu sehen ist, wenn wirklich etwas Unerwartetes passiert.
///
/// Next.js zeigt sonst „minified React error #441" — eine Nummer, mit der
/// niemand etwas anfangen kann. Die echte Meldung steht im schwarzen
/// Fenster; die Kennung unten hilft, sie dort wiederzufinden.
export default function Fehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">Da ist etwas schiefgegangen</h1>

      <p className="mt-4 text-slate-700">
        Deine Gewinnspiele und Teilnehmer sind unversehrt — es ist nichts verloren
        gegangen. Nur diese Seite ließ sich nicht aufbauen.
      </p>

      <p className="mt-4 text-slate-700">
        Die genaue Meldung steht im <strong>schwarzen Fenster</strong>, in dem das
        Tool läuft. Die letzten Zeilen daraus helfen weiter.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nochmal versuchen
        </button>
        <Link
          href="/admin"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Zurück zur Verwaltung
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 text-xs text-slate-500">
          Kennung zum Wiederfinden im schwarzen Fenster:{" "}
          <code className="rounded bg-slate-100 px-1 font-mono">{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
