# Social-Media Gewinnspiel-Tool ("Gewinnpicker") — Implementierungsplan

## Context

Du willst ein DSGVO-konformes Gewinnspiel-Tool für deine Streaming-Karriere, ähnlich osortoo.com: Kommentare unter Instagram- und TikTok-Beiträgen auslesen, prüfen ob Teilnehmer folgen / geliked / regelkonform kommentiert haben, per Zufall ziehen — mit eigener Homepage, die Gewinne und Gewinner anzeigt.

Das bestehende Repo `TNIllumination/TruthorDare` ist eine native Android-App (Kotlin, Truth-or-Dare-Partyspiel) ohne jeden Bezug dazu — kein Backend, keine Internet-Permission, keine Web-Komponente. **Dieses Projekt bekommt ein neues, eigenes Repository.**

### Die harte Realität der Plattform-APIs (verifiziert, nicht verhandelbar)

Ich habe alle vier Kernfunktionen an den Originalquellen geprüft. Das Ergebnis definiert das Produkt:

| Funktion | Instagram | TikTok | YouTube | Twitch |
|---|---|---|---|---|
| Kommentare automatisch lesen | ✅ **Ja** | ❌ **Nein** | ✅ **Ja, am einfachsten** | – (Live-Chat statt Kommentare) |
| Wer hat geliked (Personenliste) | ❌ Nein | ❌ Nein | ❌ Nein | – |
| Folgt mir Person X | ❌ Nein | ❌ Nein | ❌ Nein | ✅ **Ja, vollautomatisch** |

Quellen: Meta IG Comment Reference · TikTok Scopes Reference · YouTube Data API `commentThreads.list` · Twitch Helix `channels/followers`

**Instagram** liefert über `GET /{ig-media-id}/comments` sauber die Felder `id`, `text`, `username`, `timestamp`, `like_count`, `parent_id`, `replies` — Berechtigung `instagram_basic` + `instagram_manage_comments`, Business-/Creator-Konto und Meta App Review erforderlich. Das trägt das Produkt.

**TikTok ist der Knackpunkt.** Die offizielle Scopes-Referenz kennt genau drei Video-Scopes: `video.list`, `video.publish`, `video.upload`. **Es gibt keinen Scope zum Lesen von Kommentaren.** Die Content Posting API kann es nicht. Die Research API kann es, ist aber Akademikern vorbehalten und liefert *keinen Username*. Und die oft verlinkte Business-API `comment_list` verlangt laut TikToks eigenem SDK zwingend eine `advertiser_id` — das sind **Kommentare unter Werbeanzeigen**, nicht unter organischen Videos.

→ Für TikTok existiert **kein regelkonformer automatisierter Weg**. Das Tool bekommt für TikTok stattdessen einen **manuellen Import** (Einfügen/CSV). Regel-Engine, Ziehung, Verifikation, Gewinnerseite und alle Rechtstexte funktionieren damit identisch — nur das Einsammeln der Kommentare ist ein Handgriff statt eines Klicks.

Genau deshalb wirbt Osortoo auf der von dir verlinkten Seite auch **weder mit Follower- noch mit Like-Prüfung** — nur mit Kommentar-Filtern, Duplikat-Entfernung und Hashtag/@Tag-Filtern.

**YouTube ist die günstigste Ergänzung überhaupt.** `commentThreads.list` kostet 1 von 10.000 kostenlosen Quota-Einheiten pro Tag, braucht **nur einen API-Key — kein OAuth, kein App Review** — und liefert Autorname, Text, `likeCount`, Zeitstempel und Antworten. Gleiche Bauform wie Instagram, aber ohne jede Freigabehürde. **Kommt in den MVP.**

**Twitch ist die einzige Plattform, auf der der Follow-Check automatisch funktioniert.** `GET /helix/channels/followers?user_id=…&broadcaster_id=…` mit *deinem eigenen* Broadcaster-Token und Scope `moderator:read:followers` beantwortet zuverlässig, ob jemand dir folgt — genau dein Anwendungsfall, weil es dein Kanal ist. Sub-Status ebenso. Aber: Twitch kennt keine Kommentare, Teilnahmen kommen aus dem **Live-Chat** (EventSub/IRC, Sammlung während der Sendung). Das ist ein anderer Datenfluss und deshalb **eine eigene Phase, kein Beifang.**

### Das Produktkonzept, das trotzdem liefert (deine Entscheidung: Hybrid)

Automatisch, was geht — manuell, was muss, aber auf 60 Sekunden eingedampft:

1. Kommentare rein (IG automatisch, TikTok per Import).
2. Regel-Engine prüft alles Textbasierte automatisch und **begründet jede Ablehnung**.
3. Ziehung mit nachweisbar fairem Verfahren → **1 Gewinner + N Nachrücker**.
4. **Verifikations-Checkliste**: nur für diese Handvoll Kandidaten zeigt das Tool Direktlinks zu Profil und Beitrag. Du klickst je "folgt ✓ / folgt ✗" und "geliked ✓ / ✗". Fällt jemand durch, rückt automatisch der nächste nach — alles revisionssicher protokolliert.

Statt tausend Profile prüfst du fünf. Legal, kein Sperrrisiko, DSGVO-fest.

### Rahmenentscheidungen

- Plattformen MVP: **Instagram + TikTok + YouTube**. **Twitch** als eigene Phase 5.
- **Single-User**, nur du. Code aber mandantenfähig geschnitten für später.
- Bedienung komplett über Weboberfläche, **keine Konsole**, alles auf Deutsch.
- Dein Instagram-Konto ist ein **Professional Account** — Voraussetzung erfüllt. ✅
- Priorität ist **einfach und schnell in der Bedienung**, nicht Funktionsfülle.

---

## Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Homepage, Dashboard, öffentliche Gewinnerseiten und API in *einem* Projekt — ein Deployment statt drei |
| DB | **PostgreSQL + Prisma** | Migrationen, typsicher, überall in der EU hostbar |
| Auth (du) | **Auth.js**, Single-User + TOTP-2FA | Nur ein Konto — kein Nutzerverwaltungs-Overhead |
| Plattform-OAuth | eigener Adapter-Layer | Meta/TikTok-Tokens getrennt von deinem Login |
| UI | **Tailwind + shadcn/ui**, Sprache Deutsch | Schnell, barrierearm, sauberes Standard-Design |
| Jobs | **pg-boss** (Queue in Postgres) | Kommentar-Import läuft im Hintergrund, ohne extra Redis-Server |
| Hosting | **Hetzner (DE) via Coolify**, Docker Compose | EU-Datenhaltung ohne US-Transfer, AV-Vertrag verfügbar, ca. 5 €/Monat, Deploy per Klick |

Bewusst **gegen Vercel/AWS-US** entschieden: würde Drittlandtransfer und zusätzliche DSGVO-Begründung erzwingen — genau das, was du nicht willst.

---

## Datenmodell (Kern)

```
Account          Verbundene Plattformkonten (platform, handle, verschlüsselte Tokens, Ablauf)
Giveaway         Titel, Plattform, Post-Ref, Zeitfenster, Status, Nachrücker-Anzahl
Rule             Zu Giveaway: Typ (keyword|mentions|dedupe|blocklist|timewindow|bonus), Konfig-JSON, Reihenfolge
Entry            username, userRef, Text, Zeitstempel, Lose-Anzahl, gültig?, Ablehnungsgründe[]
Prize            Titel, Beschreibung, Bild, Rang, Anzahl
Draw             commitHash, seed, Algorithmus-Version, Zeitpunkt, Teilnehmer-Snapshot
DrawResult       Draw→Entry, Rang (Gewinner/Nachrücker N), Status (offen|bestätigt|abgelehnt|nachgerückt)
Verification     Zu DrawResult: folgt?, geliked?, wer, wann, Notiz  ← Audit-Nachweis
Claim            Token-Link, verschlüsselte Versanddaten, Löschdatum
AuditLog         Wer/was/wann — jede Verarbeitung
DataRequest      Auskunft/Löschung nach Art. 15/17
```

## Repo-Struktur

```
src/
  app/(dashboard)/      Deine Oberfläche: Gewinnspiele, Regeln, Ziehung, Verifikation
  app/(public)/         Homepage, Gewinne, Gewinner, Teilnahmebedingungen, Impressum, Datenschutz
  app/(claim)/          Gewinner-Einlöselink
  app/api/              OAuth-Callbacks, Jobs, Webhooks
  platforms/            base.ts (Interface) | instagram/ | tiktok/ | _fixtures/
  rules/                engine.ts + je Regeltyp eine Datei
  draw/                 commit-reveal.ts, protocol.ts (PDF-Export)
  privacy/              retention.ts, export.ts, erasure.ts, legal-texts/
  lib/                  crypto.ts, db.ts, audit.ts
prisma/  docs/  tests/
```

**Plattform-Adapter** — ein Interface, drei Implementierungen:
`listMedia()` · `fetchComments()` · `normalize()` · `capabilities()`
`capabilities()` meldet ehrlich, was die Plattform kann (`canFetchComments`, `canCheckFollow` …). Die UI blendet daraufhin automatisch das Richtige ein und erklärt, warum etwas manuell ist — und blendet bei Twitch den Verifikationsschritt ganz aus, weil er dort automatisch läuft.

| Adapter | Kommentare | Follow-Check |
|---|---|---|
| `instagram/` | API | manuell (Checkliste) |
| `youtube/` | API (nur Key) | manuell (Checkliste) |
| `tiktok/` | Import | manuell (Checkliste) |
| `twitch/` | Live-Chat (Phase 5) | **automatisch** |

## Nachweisbar faire Ziehung (Commit-Reveal)

1. Teilnehmerliste einfrieren → `commitHash = SHA256(Teilnehmerliste + geheimer Seed)`
2. **Hash vor der Ziehung veröffentlichen** (öffentliche Gewinnspielseite)
3. Ziehen mit `crypto.randomBytes`, deterministisch aus dem Seed
4. **Nach der Ziehung Seed + Liste offenlegen** → jeder kann nachrechnen
5. **Ziehungsprotokoll als PDF** (Teilnehmerzahl, Hash, Seed, Zeitpunkt, Ergebnis) — dein Rechtsnachweis nach §661 BGB

Damit kann dir niemand Manipulation vorwerfen — ein echtes Vertrauensargument für deinen Stream.

## Verschlüsselung

- Plattform-Tokens und Gewinner-Versanddaten: **AES-256-GCM**, Schlüssel aus ENV, niemals im Repo
- Versanddaten nur entschlüsselt anzeigen, wenn du sie aktiv aufrufst (jeder Zugriff im AuditLog)
- Automatische Löschjobs: Nicht-Gewinner kurz nach Ziehung, Versanddaten nach Versand + Aufbewahrungsfrist

## DSGVO & Rechtstexte (eingebaut, nicht nachgerüstet)

- Rechtsgrundlagen dokumentiert: Art. 6 Abs. 1 lit. b (Teilnahme = Vertrag), lit. f (Durchführung/Nachweis)
- Generator für **Teilnahmebedingungen** inkl. Pflicht-Disclaimer *"Diese Aktion steht in keiner Verbindung zu Instagram/TikTok…"*
- **Impressum** (§5 DDG), **Datenschutzerklärung**, **Verarbeitungsverzeichnis** (Art. 30), **TOM-Dokument**, **AVV-Checkliste** für Hetzner
- Betroffenenrechte per Klick: Datenexport und Löschung einzelner Teilnehmer
- Datensparsamkeit: kein Profilbild, keine Followerzahl, keine Speicherung fremder Beiträge

> Ich baue rechtssichere Strukturen und Vorlagen — die finale Freigabe der Texte gehört einmalig zu einem Anwalt oder Datenschutzbeauftragten. Das ersetzt keine Rechtsberatung.

---

## Bau-Reihenfolge (jede Phase ist für sich nutzbar)

**Phase 0 — Fundament**
Neues Repo `TNIllumination/gewinnspiel-tool` anlegen, Next.js + Prisma + Docker + Auth aufsetzen, CI (Lint/Typecheck/Test), deutsche Grundoberfläche.

**Phase 1 — Komplett lauffähig ohne jede API** ⭐
Manueller Import (Einfügen/CSV) + **Sandbox-Modus mit Demo-Daten** → Regel-Engine, Ziehung, Nachrücker, Verifikations-Checkliste, Gewinner-/Gewinneseite, PDF-Protokoll.
*Ergebnis: Du kannst nach dieser Phase echte Gewinnspiele durchführen — auf beiden Plattformen, Kommentare per Copy-Paste. Kein Warten auf Meta.*

**Phase 2 — Instagram automatisch**
Meta-App anlegen, OAuth, Kommentar-Import mit Pagination/Rate-Limits/Resume, Beitrags-Picker. Parallel **Meta App Review einreichen** (erfahrungsgemäß 1–4 Wochen — deshalb kommt Phase 1 zuerst).

**Phase 2b — YouTube automatisch** (klein, direkt im Anschluss)
API-Key hinterlegen, Video-Picker, `commentThreads.list` mit Pagination. Kein OAuth, kein Review — deshalb schnell erledigt und sofort produktiv nutzbar, unabhängig von Metas Freigabe.

**Phase 3 — TikTok**
`video.list` für den Video-Picker (das geht offiziell), Kommentare weiterhin per geführtem Import. Erneute Prüfung, ob TikTok inzwischen einen Kommentar-Scope freigegeben hat.

**Phase 4 — Recht & Betrieb**
Alle Rechtstexte, Betroffenenrechte-UI, Löschautomatik, Backups, Monitoring, deutsche Bedienanleitung.

**Phase 5 — Twitch** (eigenständiger Umfang)
OAuth als Broadcaster, Teilnahme-Sammlung aus dem Live-Chat per EventSub (z. B. Schlüsselwort im Chat), **automatischer Follower- und Sub-Check** über `channels/followers`. Hier entfällt der manuelle Verifikationsschritt vollständig — die einzige Plattform, auf der das geht.

**Phase 6 — Kür**
Öffentliche Gewinne-Showcase mit Countdown, Gewinner-Einlöseflow, Archiv, Overlay für den Live-Stream (Ziehung on-stream einblenden).

## Tests

- **Unit**: Regel-Engine (Umlaute, Emojis, @-Mentions, Duplikate) und Ziehungs-Determinismus
- **Fixtures statt Live-API**: echte API-Antworten einmal als JSON einfrieren, dagegen testen
- **Sandbox-Modus**: erzeugt realistische Fake-Teilnehmer — die gesamte App ist demonstrierbar, bevor irgendeine Freigabe existiert
- **E2E** (Playwright): Import → Regeln → Ziehung → Verifikation → Gewinnerseite

## Risiken

| Risiko | Umgang |
|---|---|
| Meta App Review dauert/scheitert | Phase 1 ist API-frei → du bist nie blockiert |
| TikTok bleibt ohne Kommentar-Scope | Manueller Import ist von vornherein der geplante Weg, kein Nachrüsten |
| Instagram Rate-Limits | Jobs mit Backoff, wiederaufnehmbar, Zwischenstand persistent |
| Erwartung "vollautomatischer Follow-Check" | Oben offengelegt; Hybrid-Modell ist die einzige regelkonforme Lösung |

## Verifikation

1. `docker compose up` → App startet lokal mit Postgres
2. Sandbox-Gewinnspiel anlegen, 500 Demo-Kommentare erzeugen
3. Regeln setzen (Keyword + 2 Freunde taggen + 1 Los pro Person) → geprüft wird: jede abgelehnte Teilnahme zeigt ihren Grund
4. Ziehen → Commit-Hash vor Ziehung sichtbar, Seed danach, PDF-Protokoll rechnet nach
5. Kandidaten ablehnen → Nachrücker springt korrekt ein, Audit-Log vollständig
6. Öffentliche Seiten prüfen; Teilnehmer löschen → Daten wirklich weg
7. `npm test` und Playwright-Suite grün

---

## Arbeitsweise: Handy ↔ PC, geräteübergreifend

Die Entwicklung läuft in einer Cloud-Session, nicht auf deinem Gerät. Du erreichst sie unter **claude.ai/code** von überall — Handy-Browser, Desktop-App, PC. Du kannst mitten in einer Sitzung das Gerät wechseln.

Wichtig zu wissen: Der Container, in dem gearbeitet wird, ist **flüchtig**. Nach längerer Inaktivität wird er recycelt und beim nächsten Mal frisch aus GitHub neu aufgesetzt. Die Wahrheit liegt deshalb immer im **Git-Repository**, nie im Container.

Daraus folgt die verbindliche Regel für dieses Projekt:

1. **Alles landet sofort im Repo** — Code, Doku, Rechtstexte, dieser Plan (als `docs/PLAN.md`).
2. **Ich committe und pushe am Ende jedes Arbeitsblocks**, nicht erst wenn etwas "fertig" ist. Auch Zwischenstände.
3. **Jeder Arbeitsblock endet mit einem kurzen Statusvermerk** in `docs/STATUS.md`: was fertig ist, was als Nächstes dran ist, was gerade offen/kaputt ist.

Damit gilt: Du kannst morgen am PC entweder **dieselbe Sitzung** weiterführen (sie steht in deiner Session-Liste) oder eine **komplett neue** starten — in beiden Fällen ist der Stand vollständig da, weil `STATUS.md` und die Git-Historie den Faden aufnehmen. Nichts hängt daran, dass eine bestimmte Sitzung am Leben bleibt.

Praktisch heißt das für dich: Am Handy in der Bahn kurz etwas anstoßen oder Feedback geben, am PC in Ruhe weitermachen — ohne Übergabeaufwand.

## Offene Punkte für dich

- **Repo-Name**: Vorschlag `TNIllumination/gewinnspiel-tool`, privat. Sag Bescheid, wenn du etwas anderes willst.
- **Von dir gebraucht, sobald Phase 2 ansteht**: Meta-App anlegen (ich führe dich durch), YouTube-API-Key aus der Google Cloud Console (5 Minuten, kostenlos).
- Screenshot ist nicht nötig — die Osortoo-Seite habe ich ausgewertet, der Funktionsumfang ist im Plan abgedeckt.
