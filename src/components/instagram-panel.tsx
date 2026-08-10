"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardTitle, Notice } from "./ui";

/// Zugang zu Instagram einrichten, prüfen, verlängern und wieder loswerden.
///
/// Gebaut wie `github-panel.tsx` — die Anleitung im aufklappbaren Kasten hat
/// sich dort bewährt: Man braucht sie einmal und danach nie wieder, also
/// steht sie da, wo sie gebraucht wird, ohne die Seite zu füllen.
export function InstagramPanel({
  pruefen,
  verlaengern,
  entfernen,
  handle,
  hatSchluessel,
  gueltigBis,
  tageRest,
}: {
  pruefen: () => Promise<{ meldung?: string; fehler?: string }>;
  verlaengern: () => Promise<{ meldung?: string; fehler?: string }>;
  entfernen: () => Promise<{ fehler?: string } | void>;
  handle: string;
  hatSchluessel: boolean;
  gueltigBis: string | null;
  /// Verbleibende Tage — negativ, wenn abgelaufen. null ohne Schlüssel.
  tageRest: number | null;
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

  const abgelaufen = tageRest !== null && tageRest <= 0;

  return (
    <Card>
      <CardTitle hint="Kommentare abrufen, statt sie zu kopieren.">
        Instagram verbinden
      </CardTitle>

      {hatSchluessel ? (
        <p className="text-sm text-slate-600">
          {handle ? (
            <>
              Verbunden als <strong>@{handle}</strong>.{" "}
            </>
          ) : (
            <>Schlüssel hinterlegt — drück auf „Verbindung prüfen“, um zu sehen, mit
            welchem Konto. </>
          )}
          {gueltigBis ? (
            abgelaufen ? (
              <span className="text-red-700">
                Der Schlüssel ist <strong>abgelaufen</strong>.
              </span>
            ) : (
              <>
                Gültig noch <strong>{tageRest} Tage</strong> (bis {gueltigBis}).
              </>
            )
          ) : null}
        </p>
      ) : (
        <p className="text-sm text-slate-600">
          Noch nicht verbunden. Ohne Verbindung bleibt alles wie bisher: Kommentare
          kopierst du aus der App und fügst sie ein. Mit Verbindung holt das Tool sie
          selbst — auch die, die beim Scrollen durchgerutscht wären.
        </p>
      )}

      <details className="mt-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">
          So richtest du den Zugang ein
        </summary>

        {/* Der wichtigste Satz zuerst: Es braucht keine Freigabe von Meta.
            Genau davor schrecken die meisten zurück. */}
        <Notice title="Keine Prüfung durch Meta nötig">
          Solange du <strong>dein eigenes</strong> Konto abrufst und in deiner eigenen
          App als Rolle eingetragen bist, brauchst du kein App Review und keine
          Unternehmensverifizierung. Die dauern Wochen — hier entfallen sie.
        </Notice>

        <ol className="mt-3 list-inside list-decimal space-y-1">
          <li>
            Instagram-App → Einstellungen →{" "}
            <strong>Konto auf Profi-Konto umstellen</strong> (Creator oder Business).
            Kostenlos, jederzeit rückgängig
          </li>
          <li>
            Auf <strong>developers.facebook.com</strong> anmelden → <strong>Meine
            Apps</strong> → <strong>App erstellen</strong>
          </li>
          <li>
            Als Verwendungszweck <strong>Andere</strong>, als Typ{" "}
            <strong>Business</strong> wählen
          </li>
          <li>
            Produkt <strong>Instagram</strong> hinzufügen →{" "}
            <strong>API-Einrichtung mit Instagram-Login</strong>
          </li>
          <li>
            Dein Instagram-Konto verknüpfen und dich unter{" "}
            <strong>App-Rollen</strong> als <strong>Instagram-Tester</strong>{" "}
            eintragen
          </li>
          {/* Der mit Abstand häufigste Stolperstein — und einer, der sich nicht
              als Fehler zeigt: Ohne bestätigte Einladung liefert Instagram
              einfach leere Kommentarlisten. */}
          <li>
            <strong>Die Einladung in der Instagram-App bestätigen:</strong>{" "}
            Einstellungen → Apps und Websites → Tester-Einladungen. Ohne diesen
            Schritt kommen später <strong>leere Kommentarlisten</strong>, ohne dass
            Instagram einen Fehler meldet
          </li>
          <li>
            Berechtigungen setzen:{" "}
            <code className="rounded bg-slate-100 px-1">instagram_business_basic</code>{" "}
            und{" "}
            <code className="rounded bg-slate-100 px-1">
              instagram_business_manage_comments
            </code>
          </li>
          <li>
            <strong>Zugriffsschlüssel generieren</strong> und kopieren
          </li>
          <li>Oben im Feld „Zugangsschlüssel für Instagram“ einfügen und speichern</li>
        </ol>

        <p className="mt-2">
          Der Schlüssel liegt verschlüsselt in der Datenbank und wird nie wieder
          angezeigt. Er hält <strong>60 Tage</strong> — danach hier verlängern, das
          geht ohne den Umweg über Meta. Verlängern klappt erst, wenn er einen Tag
          alt ist.
        </p>
        <p className="mt-2">
          Eine <strong>Facebook-Seite brauchst du nicht</strong>. Wer geliked hat und
          wer dir folgt, gibt Instagram grundsätzlich nicht heraus — das bleibt
          Handprüfung bei den Gewinnern.
        </p>
      </details>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const ergebnis = await pruefen();
              if (ergebnis.fehler) setFehler(ergebnis.fehler);
              else setMeldung(ergebnis.meldung ?? "");
            })
          }
        >
          Verbindung prüfen
        </Button>

        {hatSchluessel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const ergebnis = await verlaengern();
                if (ergebnis.fehler) setFehler(ergebnis.fehler);
                else setMeldung(ergebnis.meldung ?? "");
              })
            }
          >
            Schlüssel verlängern
          </Button>
        ) : null}

        {hatSchluessel ? (
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Instagram-Schlüssel entfernen?")) return;
              run(async () => {
                const ergebnis = await entfernen();
                if (ergebnis?.fehler) setFehler(ergebnis.fehler);
                else setMeldung("Instagram-Schlüssel entfernt.");
              });
            }}
          >
            Schlüssel entfernen
          </Button>
        ) : null}
      </div>

      {meldung ? (
        <div className="mt-3">
          <Notice title="Instagram">{meldung}</Notice>
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
