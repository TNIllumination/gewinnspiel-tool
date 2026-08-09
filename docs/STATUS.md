# Stand der Arbeit

> Diese Datei wird am Ende jedes Arbeitsblocks aktualisiert. Sie ist der
> Wiedereinstiegspunkt — egal ob am Handy, am PC oder in einer neuen Sitzung.

**Letzte Aktualisierung:** 9. August 2026
**Aktuelle Phase:** 1 — lauffähig ohne jede Plattform-Freigabe

## Fertig

- **Fundament**: Next.js 16 (App Router, TypeScript), Tailwind 4, Prisma 7 mit
  PostgreSQL, Docker Compose, Vitest.
- **Datenmodell** vollständig migriert (`prisma/schema.prisma`): Account, Giveaway,
  Rule, Entry, Prize, Draw, DrawResult, Verification, Claim, AuditLog, DataRequest.
- **Regel-Engine** (`src/rules/`) mit begründeter Ablehnung. Regeltypen: KEYWORD,
  MENTIONS, MIN_LENGTH, TIMEWINDOW, BLOCKLIST, DEDUPE, BONUS.
  Deutsche Schreibweisen werden toleriert („Grüße" = „gruesse" = „grusse"),
  unsichtbare Zeichen greifen als Umgehung nicht.
- **Ziehung** (`src/draw/`) nach Commit-Reveal: SHA-256-Commit, deterministische
  gewichtete Ziehung ohne Zurücklegen, Nachprüfung erkennt manipulierte Listen
  und vorgetäuschte Ergebnisse.
- **Plattform-Adapter** (`src/platforms/base.ts`) mit ehrlichen Capabilities —
  was eine Plattform nicht kann, wird in der Oberfläche gar nicht erst angeboten.
- **Import von Hand** (`src/platforms/manual-import.ts`): CSV/TSV mit Kopfzeile,
  „Name: Text" und abwechselnde Zeilen (TikTok-Copy-Paste). Nicht zuordenbare
  Zeilen werden gemeldet, nicht verschluckt.
- **Testmodus** (`src/platforms/sandbox.ts`): erfundene Teilnehmer für den
  kompletten Ablauf ohne echte Daten.
- **59 Tests**, alle grün (`npm test`).

- **Oberfläche Phase 1 vollständig**: Ersteinrichtung und Login (Cookie-Session
  mit `jose`, bcrypt-Hash), Dashboard, Gewinnspiel-Detailseite mit Import, Regeln,
  Gewinnen, zweistufiger Ziehung und Verifikations-Checkliste; öffentliche
  Startseite und Gewinnspielseite mit Fairness-Nachweis.
- **End-to-End-Rauchtest** (`scripts/e2e-smoke.mjs`, Playwright): fährt den
  kompletten Ablauf durch — 12 von 12 Schritten grün, inklusive Prüfung, dass der
  Seed vor der Ziehung geheim bleibt und die Nachrücker-Automatik greift.
- **TikTok-Import gehärtet**: `parseBlocks` erkennt Like-Zahlen, Datumsangaben und
  „Antworten" als Beiwerk und sortiert sie aus. Mehrzeilige Kommentare bleiben
  zusammen. Vorher wäre eine Like-Zahl wie „12" als Teilnehmerin importiert worden.
- **Import-Vorschau**: Einfügen → Prüfen → Übernehmen. Vor dem Übernehmen wird
  nichts gespeichert; angezeigt werden erkanntes Format, Trefferzahl, die ersten
  zehn Zeilen und alle nicht zuordenbaren Zeilen.
- **Klartext-Zusammenfassung der Regeln** (`src/rules/summary.ts`): „Das gilt gerade"
  sagt ausdrücklich auch, was NICHT gefordert ist — ein leeres Feld sieht sonst aus
  wie „noch nicht eingestellt".
- **Zweiter E2E-Test** (`scripts/e2e-tiktok-import.mjs`): TikTok-Paste importieren,
  Vorschau prüfen, Regeln ohne Markier-Pflicht setzen — 10 von 10 grün.

- **Läuft lokal ohne Server**: Umstellung von PostgreSQL auf **SQLite** — Docker und
  Datenbankserver entfallen, die Datenbank ist die Datei `gewinnspiel.db`.
  `start.bat` / `start.sh` erledigen Installation, Schlüsselerzeugung, Migration,
  Build und Serverstart per Doppelklick (`scripts/start.mjs`).
  Anleitung ohne Konsolenwissen in `docs/HANDBUCH.md`.

- **Fassung 0.2.0**: Update per Knopfdruck (`update.bat`, abhängigkeitsfrei entpackt
  über `scripts/unzip.mjs`), Fassungsprüfung beim Start, Handbuch mit
  Inhaltsverzeichnis als `ANLEITUNG.html` und unter `/admin/hilfe`, Start öffnet
  jetzt die Verwaltung. `docs/SURFACE.md` ist in `docs/HANDBUCH.md` aufgegangen.

- **Fassung 0.3.0**: Import in Etappen mit Dublettenerkennung über
  `entryFingerprint`; mehrere Plattformen je Gewinnspiel (`GiveawaySource`,
  `Entry.platform`) mit gemeinsamem Lostopf und plattformweiser Mehrfachteilnahme;
  mehrere Gewinne korrekt über `src/draw/promotion.ts` (Gewinn hängt am Platz, nicht
  an der Person); Teilnahmebedingungen und Nachweis aus `src/legal/`; Veröffentlichung
  als HTML für GitHub Pages inklusive nachrechenbarer Teilnehmerliste; Einsendeschluss,
  `releaseCommit`, Beenden-Knopf, `npm run passwort-neu`.

- **Fassung 0.3.1**: Übersichtsseite `veroeffentlichung/index.html`
  (`buildIndexPage` in `src/legal/publish.ts`), geschrieben bei jeder
  Veröffentlichung und einzeln über `publishIndex()` — nötig, weil GitHub Pages
  sich erst einschalten lässt, wenn im Repository Inhalt liegt.
  `Settings.impressumUrl` samt `withScheme()`; der Verweis erscheint im
  Fußbereich beider erzeugter Seitentypen, in beiden Fassungen der
  Teilnahmebedingungen und auf den örtlichen öffentlichen Seiten.

- **Fassung 0.4.0**: `src/lib/github.ts` lädt die erzeugten Seiten selbst hoch
  (Git-Datenschnittstelle für ein Repository mit Stand, Inhalts-Endpunkt fürs leere)
  und schaltet Pages ein; Zugangsschlüssel AES-verschlüsselt in `Settings`.
  `src/legal/datenschutz.ts` erzeugt die Datenschutzerklärung, `buildPrivacyPage`
  rendert sie; alle drei Seitentypen teilen sich jetzt `seite()` und `fusszeile()`
  in `src/legal/publish.ts`. `Giveaway.customTerms` als Freifeld für eigene
  Bedingungen.

- **Fassung 0.4.1**: `src/lib/ergebnis.ts` (`Bedienfehler`, `alsErgebnis`,
  `istSteuerfluss`) — Next.js zensiert im Produktionsbau die Texte geworfener
  Ausnahmen aus Server-Aktionen; Bedienfehler kommen deshalb als Rückgabewert.
  Alle 27 Aktionen in `actions.ts` sind umschlossen, `error.tsx` und
  `global-error.tsx` fangen den Rest ab. `scripts/e2e-030.mjs` prüft jetzt eine
  Fehlermeldung gegen den Produktionsbau — genau das fehlte.

## Als Nächstes

1. PDF-Ziehungsprotokoll als Rechtsnachweis.
2. Verarbeitungsverzeichnis und automatische Löschfristen.
3. Instagram-Anbindung (Phase 2) und YouTube (Phase 2b).

## Zurück zu PostgreSQL (falls später Hosting gewünscht)

Nötig wäre: `provider` im Schema auf `postgresql`, `Account.scopes` wieder auf
`String[]`, `PrismaBetterSqlite3` → `PrismaPg` in `src/lib/db.ts`, frische Migration.
Zusätzlich zwei Stellen, die auf SQLite anders gelöst sind und dort wieder vereinfacht
werden könnten: der Duplikat-Abgleich in `storeComments` (SQLite kennt kein
`skipDuplicates`) und die Suche in `eraseParticipant` (kein `mode: "insensitive"`).

## Offen / zu beachten

- **Login**: Statt Auth.js ist eine schlanke Cookie-Session mit `jose` vorgesehen —
  bei genau einem Benutzer ist das weniger fehleranfällig als ein volles Auth-Framework.
- **Instagram** braucht ein Meta App Review (1–4 Wochen). Phase 1 funktioniert
  unabhängig davon, deshalb blockiert das nichts.
- **YouTube** braucht nur einen API-Key aus der Google Cloud Console.
- **TikTok** bleibt beim Import von Hand, solange es keinen Kommentar-Scope gibt.
