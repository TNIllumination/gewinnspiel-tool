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

## Als Nächstes

1. Oberfläche Phase 1: Gewinnspiel anlegen → importieren → Regeln → ziehen →
   Verifikations-Checkliste mit Nachrücker-Automatik → öffentliche Gewinnerseite.
2. Login (Single-User, Cookie-Session + Passwort-Hash).
3. PDF-Ziehungsprotokoll.
4. Rechtstexte und Löschautomatik (Phase 4).

## Offen / zu beachten

- **Repo-Anlage**: Das GitHub-Token dieser Sitzung darf keine Repositories anlegen
  (403). Das Repo muss einmalig von Hand angelegt werden, danach läuft das Pushen.
- **Login**: Statt Auth.js ist eine schlanke Cookie-Session mit `jose` vorgesehen —
  bei genau einem Benutzer ist das weniger fehleranfällig als ein volles Auth-Framework.
- **Instagram** braucht ein Meta App Review (1–4 Wochen). Phase 1 funktioniert
  unabhängig davon, deshalb blockiert das nichts.
- **YouTube** braucht nur einen API-Key aus der Google Cloud Console.
- **TikTok** bleibt beim Import von Hand, solange es keinen Kommentar-Scope gibt.
