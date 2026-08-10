"use client";

import { useState, useTransition } from "react";
import { Button, Notice, inputClass } from "./ui";

interface Beitrag {
  externalId: string;
  label: string;
  url: string;
  am: string;
  kommentare: number | null;
}

/// Beitrag auswählen und die Kommentare abrufen.
///
/// Zwei Schritte, weil sie zwei verschiedene Fragen beantworten: *Welcher
/// Beitrag?* klärt man einmal, *jetzt abrufen* womöglich mehrmals — vor dem
/// Einsendeschluss, danach noch einmal.
export function InstagramAbruf({
  beitraege,
  waehlen,
  waehlenPerLink,
  abrufen,
  gewaehlt,
  gewaehltesLabel,
}: {
  beitraege: (
    nach?: string | null,
  ) => Promise<{ beitraege?: Beitrag[]; weiter?: string | null; fehler?: string }>;
  waehlen: (
    externalId: string,
    label: string,
    url: string,
  ) => Promise<{ fehler?: string } | void>;
  waehlenPerLink: (
    url: string,
  ) => Promise<{ gewaehlt?: Beitrag; fehler?: string } | void>;
  abrufen: () => Promise<{
    added?: number;
    skipped?: number;
    warnings?: string[];
    fehler?: string;
  }>;
  gewaehlt: string | null;
  gewaehltesLabel: string | null;
}) {
  const [liste, setListe] = useState<Beitrag[] | null>(null);
  const [weiter, setWeiter] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) => {
    setFehler(null);
    setMeldung(null);
    setHinweise([]);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setFehler(e instanceof Error ? e.message : "Das hat nicht geklappt.");
      }
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">
        Instagram — Kommentare automatisch abrufen
      </p>

      <p className="mt-1 text-sm text-slate-600">
        {gewaehlt ? (
          <>
            Gewählter Beitrag: <strong>{gewaehltesLabel || gewaehlt}</strong>
          </>
        ) : (
          "Wähl zuerst den Beitrag, unter dem die Teilnahmen stehen."
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const ergebnis = await beitraege();
              if (ergebnis.fehler) setFehler(ergebnis.fehler);
              else {
                setListe(ergebnis.beitraege ?? []);
                setWeiter(ergebnis.weiter ?? null);
              }
            })
          }
        >
          {gewaehlt ? "Anderen Beitrag wählen" : "Beitrag auswählen"}
        </Button>

        {gewaehlt ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const ergebnis = await abrufen();
                if (ergebnis.fehler) {
                  setFehler(ergebnis.fehler);
                  return;
                }
                const neu = ergebnis.added ?? 0;
                const schon = ergebnis.skipped ?? 0;
                setMeldung(
                  neu === 0
                    ? `Nichts Neues — alle ${schon} Kommentare waren schon eingelesen.`
                    : `${neu} neue Teilnahme${neu === 1 ? "" : "n"} übernommen` +
                        (schon > 0 ? `, ${schon} waren schon vorhanden.` : "."),
                );
                setHinweise(ergebnis.warnings ?? []);
              })
            }
          >
            Kommentare abrufen
          </Button>
        ) : null}
      </div>

      {/* Der Weg für ältere Beiträge: Statt sich durch die Liste zu blättern,
          fügt man die Adresse ein. Gesucht wird über die eigene Beitragsliste,
          deshalb geht es nur mit eigenen Beiträgen. */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex-1 text-xs text-slate-600">
          <span className="mb-1 block">
            Oder Adresse des Beitrags einfügen — auch für ältere
          </span>
          <input
            className={inputClass}
            name="beitragsLink"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.instagram.com/p/ABC123/"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !link.trim()}
          onClick={() =>
            run(async () => {
              const ergebnis = await waehlenPerLink(link);
              if (ergebnis?.fehler) setFehler(ergebnis.fehler);
              else {
                setListe(null);
                setLink("");
                setMeldung(
                  `Beitrag gewählt: ${ergebnis?.gewaehlt?.label ?? "gefunden"}`,
                );
              }
            })
          }
        >
          Beitrag suchen
        </Button>
      </div>

      {liste ? (
        liste.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Instagram hat keine Beiträge geliefert. Gehört der Schlüssel zum
            richtigen Konto?
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {liste.map((b) => (
              <li key={b.externalId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const ergebnis = await waehlen(b.externalId, b.label, b.url);
                      if (ergebnis?.fehler) setFehler(ergebnis.fehler);
                      else {
                        setListe(null);
                        setMeldung(`Beitrag gewählt: ${b.label}`);
                      }
                    })
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:border-slate-400 disabled:opacity-50 ${
                    b.externalId === gewaehlt
                      ? "border-slate-900 bg-white"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="block font-medium text-slate-900">{b.label}</span>
                  <span className="block text-xs text-slate-500">
                    {new Date(b.am).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    {b.kommentare !== null
                      ? ` · ${b.kommentare} Kommentare laut Instagram`
                      : ""}
                  </span>
                </button>
              </li>
            ))}

            {/* Ohne das war bei 25 Beiträgen Schluss — ein älterer war
                schlicht nicht erreichbar. */}
            {weiter ? (
              <li>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const ergebnis = await beitraege(weiter);
                      if (ergebnis.fehler) setFehler(ergebnis.fehler);
                      else {
                        setListe([...liste, ...(ergebnis.beitraege ?? [])]);
                        setWeiter(ergebnis.weiter ?? null);
                      }
                    })
                  }
                >
                  Ältere Beiträge laden
                </Button>
              </li>
            ) : null}
          </ul>
        )
      ) : null}

      {meldung ? (
        <div className="mt-3">
          <Notice title="Instagram">
            <p>{meldung}</p>
            {/* Die Zahl von Instagram und die eingelesene weichen fast immer
                ab: Antworten auf Kommentare zählt Instagram mit, das Tool
                liest nur die oberste Ebene. Besser hier erklärt als später
                gerätselt. */}
            {hinweise.length > 0 ? (
              <ul className="mt-2 list-inside list-disc">
                {hinweise.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
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
    </div>
  );
}
