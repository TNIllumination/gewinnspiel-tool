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

## Als Nächstes

1. PDF-Ziehungsprotokoll als Rechtsnachweis.
2. Rechtstexte (Impressum, Datenschutzerklärung, Verarbeitungsverzeichnis) und
   automatische Löschfristen.
3. Instagram-Anbindung (Phase 2) und YouTube (Phase 2b).

## Bekannter Fehler — als Nächstes dran

**Mehrere Gewinne funktionieren noch nicht.** `performDraw` zieht `1 + substituteCount`
Personen und verteilt die Gewinne über `giveaway.prizes[index]` auf die Ränge 0, 1, 2 …
Die Ränge ab 1 sind aber die **Nachrücker**. Bei drei Gewinnen entstehen dadurch zwei
Personen, die als „Nachrücker" beschriftet sind, aber einen Preis zugeteilt bekommen —
auch auf der öffentlichen Seite. Für den 2. und 3. Preis gibt es zudem keine Nachrücker.

Mit **einem** Gewinn ist alles korrekt. Lösung: `winnerSlots` auf `Draw` speichern,
`winnerSlots + substituteCount` ziehen und das Nachrücken pro Gewinnplatz in einer
testbaren Funktion `src/draw/promotion.ts` lösen.

## Zurück zu PostgreSQL (falls später Hosting gewünscht)

Nötig wäre: `provider` im Schema auf `postgresql`, `Account.scopes` wieder auf
`String[]`, `PrismaBetterSqlite3` → `PrismaPg` in `src/lib/db.ts`, frische Migration.
Zusätzlich zwei Stellen, die auf SQLite anders gelöst sind und dort wieder vereinfacht
werden könnten: der Duplikat-Abgleich in `storeComments` (SQLite kennt kein
`skipDuplicates`) und die Suche in `eraseParticipant` (kein `mode: "insensitive"`).

## Offen / zu beachten

- **Aufzuräumen**: Solange dieses Repo noch nicht existierte, lag eine Sicherungskopie
  im Branch `claude/social-media-giveaway-picker-fecfse` von `TNIllumination/TruthorDare`.
  Sie wird nicht mehr gebraucht. Der Git-Proxy dieser Sitzung lässt das Löschen von
  Branches nicht zu — bitte einmalig auf GitHub entfernen
  (Branches → Papierkorb-Symbol).
- **Login**: Statt Auth.js ist eine schlanke Cookie-Session mit `jose` vorgesehen —
  bei genau einem Benutzer ist das weniger fehleranfällig als ein volles Auth-Framework.
- **Instagram** braucht ein Meta App Review (1–4 Wochen). Phase 1 funktioniert
  unabhängig davon, deshalb blockiert das nichts.
- **YouTube** braucht nur einen API-Key aus der Google Cloud Console.
- **TikTok** bleibt beim Import von Hand, solange es keinen Kommentar-Scope gibt.
