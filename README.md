# Gewinnspiel-Tool

DSGVO-konformes Werkzeug, um Gewinnspiele auf **Instagram**, **TikTok** und **YouTube**
auszuwerten: Kommentare einlesen, Teilnahmebedingungen automatisch prüfen und
**nachweisbar fair** ziehen.

Es läuft **auf deinem eigenen Rechner**. Kein Server, keine Anmeldung irgendwo, keine
laufenden Kosten. Die Daten der Teilnehmer verlassen dein Gerät nur, wenn du selbst
etwas veröffentlichst.

## In drei Schritten loslegen

1. **[Node.js installieren](https://nodejs.org)** — große grüne Schaltfläche, Variante
   **LTS**, Weiter–Weiter–Fertig
2. Hier oben auf **Code → Download ZIP**, entpacken (z. B. nach `Dokumente`) —
   **nicht** nach „Programme", dort darf das Tool nichts anlegen
3. **`start.bat`** doppelklicken (Mac/Linux: `start.sh`)

Beim ersten Mal dauert es ein paar Minuten. Danach öffnet sich der Browser von selbst,
und du legst dein Konto an. Im Tool führt dich eine Liste durch alles Weitere — das
Handbuch brauchst du dafür nicht.

**Fang mit dem Testmodus an.** Der erzeugt 250 erfundene Teilnehmer, du siehst den
kompletten Ablauf, und es kann nichts schiefgehen.

Ausführlich: **[Handbuch](docs/HANDBUCH.md)** — oder im Tool unter „Hilfe".

## Was das Tool kann — und was keine Plattform hergibt

Ehrlichkeit an dieser Stelle spart später Ärger:

| | Instagram | TikTok | YouTube | Twitch |
|---|---|---|---|---|
| Kommentare automatisch lesen | ✅ | ❌ Import von Hand | ✅ am einfachsten | Live-Chat |
| Wer hat geliked | ❌ | ❌ | ❌ | – |
| Folgt mir die Person | ❌ | ❌ | ❌ | ✅ automatisch |

**Like- und Follower-Prüfung sind über die offiziellen Schnittstellen nicht möglich.**
Instagram hat den Follower-Endpunkt 2018 abgeschaltet, TikTok gibt Follower-Daten
kommerziell nicht heraus, und eine Liste der Likenden existiert nirgends — nur die Anzahl.
Werkzeuge, die das versprechen, greifen inoffiziell zu; das verstößt gegen die
Nutzungsbedingungen, riskiert die Sperrung des Kontos und hat keine Rechtsgrundlage
nach DSGVO.

Deshalb arbeitet dieses Tool **hybrid**: Alles Textbasierte wird automatisch geprüft,
danach werden Gewinner **und Nachrücker** gezogen. Nur für diese Handvoll Kandidaten
zeigt das Tool eine Prüfliste mit Direktlinks — ein Klick je „folgt" und „geliked",
und bei Ablehnung rückt automatisch der Nächste nach. Statt tausend Profilen prüfst du fünf.

Bei TikTok fehlt zusätzlich jede Berechtigung zum Lesen von Kommentaren: Die offizielle
Scope-Liste kennt nur `video.list`, `video.publish` und `video.upload`. Kommentare werden
dort deshalb eingefügt oder als CSV importiert — alles Weitere läuft identisch.

## Nachweisbar faire Ziehung

Die Ziehung folgt einem **Commit-Reveal-Verfahren**:

1. Die Teilnehmerliste wird eingefroren und mit einem geheimen Seed zu einem
   SHA-256-Hash verrechnet.
2. Dieser Hash wird **vor** der Ziehung veröffentlicht.
3. Gezogen wird deterministisch aus dem Seed, gewichtet nach Losen, ohne Zurücklegen.
4. **Nach** der Ziehung werden Seed und Liste offengelegt — jeder kann nachrechnen.

Wird die Liste nachträglich verändert, passt der Hash nicht mehr. Das ist der
Unterschied zwischen „vertrau mir" und „rechne selbst nach".

## Starten

**Auf dem eigenen Rechner — ohne Server, ohne Docker, ohne laufende Kosten.**

Node.js installieren, Projekt herunterladen, dann:

| System | Start |
|---|---|
| Windows | `start.bat` doppelklicken |
| Mac / Linux | `./start.sh` |

Das Skript erledigt alles selbst: Bausteine installieren, Zugangsschlüssel erzeugen,
Datenbank anlegen, bauen, starten und den Browser öffnen. Beim ersten Mal dauert es
ein paar Minuten, danach Sekunden.

**Handbuch:** `ANLEITUNG.html` im Projektordner doppelklicken (öffnet sich im Browser,
kein Programm nötig) — oder im Tool oben rechts auf **Hilfe**.
Quelle: [`docs/HANDBUCH.md`](docs/HANDBUCH.md)

Die Datenbank ist **eine einzelne Datei** (`gewinnspiel.db`) im Projektordner.
Sichern heißt: Datei kopieren. Die Daten verlassen dein Gerät nie.

Ohne Zugang zu einer Plattform lässt sich alles im **Testmodus** ausprobieren —
er erzeugt erfundene Teilnehmer und durchläuft den kompletten Ablauf.

## Befehle

| Befehl | Zweck |
|---|---|
| `node scripts/start.mjs` | Alles-in-einem-Start (das tun auch `start.bat`/`start.sh`) |
| `npm run dev` | Entwicklungsserver |
| `npm test` | Testsuite |
| `npm run typecheck` | Typprüfung |
| `npm run lint` | Linter |
| `npx prisma migrate dev` | Datenbank aktualisieren |
| `npx prisma studio` | Daten im Browser ansehen |
| `npm run docs` | `ANLEITUNG.html` neu erzeugen |
| `npm run update` | Auf die neueste Fassung aktualisieren |

## Datenschutz

Das Tool ist auf Datensparsamkeit gebaut: keine Profilbilder, keine Followerzahlen,
keine Speicherung fremder Beiträge. Nicht-Gewinner werden nach der Ziehung automatisch
gelöscht, Versanddaten der Gewinner liegen AES-256-GCM-verschlüsselt und verfallen nach
einer einstellbaren Frist. Jede Verarbeitung landet im Audit-Log.

> Das Tool schafft die technischen Voraussetzungen und liefert Textvorlagen.
> Die finale Freigabe von Datenschutzerklärung und Teilnahmebedingungen gehört
> einmalig zu einem Anwalt oder Datenschutzbeauftragten. Dies ist keine Rechtsberatung.

## Dokumentation

- [`docs/HANDBUCH.md`](docs/HANDBUCH.md) — Handbuch für die Bedienung
- [`docs/PLAN.md`](docs/PLAN.md) — Gesamtplan und Begründung der Architektur
- [`docs/STATUS.md`](docs/STATUS.md) — aktueller Stand, nächste Schritte
