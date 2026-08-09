# Handbuch

Alles, was du über das Gewinnspiel-Tool wissen musst — von der Installation bis
zur Ziehung. Geschrieben für jemanden, der mit dem technischen Hintergrund nichts
zu tun haben will.

## Was das Tool macht

Du veranstaltest ein Gewinnspiel auf TikTok, Instagram oder YouTube. Die Leute
kommentieren unter deinem Beitrag. Dieses Tool liest die Kommentare ein, prüft
automatisch, wer die Bedingungen erfüllt hat, und zieht daraus einen Gewinner —
**nachweisbar fair**, sodass dir niemand Manipulation vorwerfen kann.

Es läuft **auf deinem eigenen Rechner**. Kein Server, keine monatlichen Kosten.
Die Daten der Teilnehmer verlassen dein Gerät nie.

## Einrichten

Das machst du einmal, danach nie wieder.

### Node.js installieren

Auf [nodejs.org](https://nodejs.org) die große grüne Schaltfläche anklicken
(Variante **LTS**), Datei ausführen, Weiter–Weiter–Fertig.

### Das Tool herunterladen

Auf der GitHub-Seite des Projekts auf **Code → Download ZIP**, danach die ZIP-Datei
entpacken — zum Beispiel nach `Dokumente\gewinnspiel-tool`.

> **Wichtig:** Nicht nach „Programme" entpacken. Dort darf das Tool seine Datenbank
> nicht anlegen. Ein normaler Ordner unter „Dokumente" ist ideal.

### Starten

**`start.bat` doppelklicken.**

Beim ersten Mal dauert es ein paar Minuten — Bausteine werden geladen, Schlüssel
erzeugt, die Datenbank angelegt und die Anwendung gebaut. Danach geht es in Sekunden.

Ein schwarzes Fenster zeigt den Fortschritt. Steht dort `✅ Läuft`, öffnet sich der
Browser automatisch. Falls nicht: **http://localhost:3000/admin** von Hand aufrufen.

Beim allerersten Aufruf legst du dein Konto an: E-Mail und ein Passwort mit
mindestens 12 Zeichen. Es gibt nur dieses eine Konto.

**Zum Beenden** das schwarze Fenster schließen. Solange es offen ist, läuft das Tool —
das Fenster *ist* der Server.

## Dein erstes Gewinnspiel

**Mach den ersten Durchlauf im Testmodus.** Der erzeugt 250 erfundene Teilnehmer,
du siehst den kompletten Ablauf, und es kann nichts schiefgehen.

1. **Neues Gewinnspiel** (rechts im Dashboard): Titel eintragen, als Plattform
   **Testmodus** wählen, **Anlegen**
2. **Teilnahmen einlesen** → *250 Testteilnehmer erzeugen*
3. **Teilnahmebedingungen** → ein Wort eintragen, speichern
4. **Gewinne** → einen Gewinn hinzufügen
5. **Ziehung** → *Liste festschreiben*, dann *Jetzt ziehen*
6. **Gewinner prüfen** → bestätigen

Danach machst du dasselbe mit deinem echten Beitrag.

> Bleib beim ersten Mal bei **einem** Gewinn. Mehrere Gewinne funktionieren derzeit
> noch nicht richtig — siehe „Bekannte Einschränkungen".

## Teilnahmen einlesen

### TikTok

TikTok gibt Kommentare **nicht** über eine Schnittstelle heraus (Näheres unter
„Was die Plattformen nicht hergeben"). Deshalb kopierst du sie:

1. Beitrag im **Browser am Rechner** öffnen — in der App lässt sich nichts kopieren
2. Kommentarbereich öffnen und **bis ganz unten scrollen**, bis alle geladen sind
3. Mit der Maus über die Kommentare ziehen und **Strg+C** drücken (Mac: Cmd+C)
4. Im Tool einfügen und auf **Prüfen** klicken

Datumsangaben, „Antworten" und Like-Zahlen werden dabei automatisch aussortiert.

### Instagram und YouTube

Genauso wie bei TikTok. Später sollen Instagram und YouTube die Kommentare
automatisch abholen — dafür braucht Instagram allerdings eine Freigabe von Meta,
die einige Wochen dauert.

### Warum es eine Vorschau gibt

Nach dem Einfügen zeigt das Tool erst, **was es erkannt hat**: wie viele Teilnahmen,
in welchem Format, und die ersten zehn mit Name und Kommentar. Erst wenn du
**Übernehmen** drückst, wird gespeichert.

Das ist Absicht. Das Tool muss beim Einfügen erraten, wie der Text aufgebaut ist —
und ein Fehlgriff soll auffallen, solange er noch folgenlos ist.

### Welche Formate erkannt werden

| Format | Wie es aussieht |
|---|---|
| Name mit Kommentar darunter | `anna_berg` ⏎ `Ich bin dabei @ben` — der Normalfall beim Kopieren |
| Name, Doppelpunkt, Text | `@anna: Ich bin dabei @ben` |
| Tabelle mit Kopfzeile | `Benutzer;Kommentar;Datum` und darunter die Zeilen |

Zeilen, die sich nicht zuordnen lassen, werden **gemeldet** statt stillschweigend
verworfen. Mehrzeilige Kommentare bleiben zusammen.

## Teilnahmebedingungen

Über den Eingabefeldern steht **„Das gilt gerade"** — dort siehst du in ganzen Sätzen,
welche Regeln aktuell greifen. Auch das, was *nicht* gefordert ist.

Nach dem Speichern werden alle bereits eingelesenen Teilnahmen sofort neu bewertet.

### Diese Wörter müssen vorkommen

Mehrere mit Komma trennen. Darunter wählst du, ob **eines** genügt oder **alle**
vorkommen müssen.

Groß- und Kleinschreibung ist egal. Umlaute ebenso: Wer „Grüße" schreibt, erfüllt
eine Regel auf „gruesse" genauso wie auf „grusse". Auch unsichtbare Zeichen, mit
denen man Filter austricksen könnte, werden erkannt.

### Freunde markieren

Die Anzahl verschiedener Personen, die im Kommentar mit `@` markiert sein müssen.

**Trag `0` ein, wenn du das nicht verlangst.** Dieselbe Person doppelt zu markieren
zählt einmal; sich selbst oder dich zu markieren zählt nicht.

### Mindestlänge der Antwort

Nützlich, wenn du eine echte Antwort willst statt nur ein Emoji. `0` heißt: keine
Mindestlänge.

### Mehrfachteilnahme

| Einstellung | Bedeutung |
|---|---|
| Ein Los pro Person | Fairste Variante. Kommentiert jemand mehrfach, zählt der erste |
| Höchstens X pro Person | Mehrfachteilnahme erlaubt, aber gedeckelt |
| Jeder Kommentar zählt | Jeder Kommentar ist ein eigenes Los |

### Ausgeschlossene Accounts

Eigene Zweitkonten, Team, frühere Gewinner. Komma- oder zeilengetrennt.

### Zusatzlose

Wer mindestens die angegebene Zahl an Freunden markiert, bekommt zusätzliche Lose
und damit eine höhere Gewinnchance.

### Warum Ablehnungen begründet werden

Unter den Regeln siehst du die zuletzt abgelehnten Teilnahmen — **jeweils mit Grund**,
zum Beispiel: *„Es müssen 2 verschiedene Freunde markiert werden, markiert wurde 1."*

So kannst du bei Nachfragen jederzeit belegen, warum jemand nicht dabei war.

## Gewinne anlegen

Name, optional Beschreibung und ein Bild-Link. Die Gewinne erscheinen auch auf der
öffentlichen Seite deines Gewinnspiels.

## Die Ziehung

Die Ziehung läuft in **zwei Schritten**. Das wirkt umständlich, ist aber der ganze
Trick — dadurch wird sie nachrechenbar.

### Schritt 1: Liste festschreiben

Die Teilnehmerliste wird eingefroren und zusammen mit einer geheimen Zufallszahl
(dem **Seed**) zu einer Prüfsumme verrechnet, dem **Commit-Hash**.

Diesen Hash **veröffentlichst du vor der Ziehung** — etwa als Kommentar unter deinem
Beitrag. Er ist eine Art Fingerabdruck der Teilnehmerliste.

### Schritt 2: Ziehen

Erst jetzt wird gezogen, und der Seed wird offengelegt.

### Warum das etwas beweist

Aus Liste und Seed lässt sich der Hash jederzeit nachrechnen. Hättest du die Liste
nachträglich verändert — jemanden hinzugefügt oder entfernt — käme ein völlig
anderer Hash heraus als der, den du vorher veröffentlicht hast.

Und weil das Ziehen selbst nur vom Seed abhängt, kann jeder mit Liste und Seed
dasselbe Ergebnis nachrechnen. Du kannst also weder die Liste noch das Ergebnis
manipulieren, ohne dass es auffällt.

Das ist der Unterschied zwischen „vertrau mir" und „rechne selbst nach" — ein
starkes Argument, wenn jemand die Fairness anzweifelt.

## Gewinner prüfen und Nachrücker

Gezogen wird der Gewinner **plus mehrere Nachrücker** (Standard: 5).

Zu jedem Kandidaten gibt es einen Direktlink auf sein Profil. Du bestätigst den
Gewinner mit einem Klick. Lehnst du ihn ab — etwa weil er nicht erreichbar ist —
rückt automatisch der nächste nach.

Jede Entscheidung wird mit Zeitpunkt protokolliert.

## Was die Plattformen nicht hergeben

Hier ist Ehrlichkeit wichtiger als Wunschdenken:

| | Instagram | TikTok | YouTube |
|---|---|---|---|
| Kommentare automatisch lesen | ja | **nein** | ja |
| Wer hat geliked | **nein** | **nein** | **nein** |
| Folgt mir die Person | **nein** | **nein** | **nein** |

**Es gibt bei keiner Plattform eine Möglichkeit, automatisch zu prüfen, wer dir folgt
oder wer geliked hat.** Instagram hat diese Abfrage 2018 abgeschaltet, TikTok gibt
Follower-Daten kommerziell gar nicht heraus, und eine Liste der Likenden existiert
nirgends — nur die Gesamtzahl.

Werkzeuge, die das trotzdem versprechen, greifen inoffiziell zu. Das verstößt gegen
die Nutzungsbedingungen, riskiert die Sperrung deines Kontos und hat datenschutz&shy;rechtlich
keine Grundlage.

**Bei TikTok kommt hinzu**, dass es überhaupt keine Berechtigung zum Lesen von
Kommentaren gibt — die offizielle Liste kennt nur das Hochladen und Auflisten von
Videos. Deshalb der Weg über Kopieren und Einfügen.

### Warum du es trotzdem verlangen solltest

Schreib ruhig „folgen, liken, kommentieren" in deine Bedingungen. Das pusht deinen
Beitrag im Algorithmus und bringt dir Reichweite — auch wenn niemand es einzeln
nachprüft. Das Tool zwingt dich nur nicht dazu, Häkchen zu setzen für etwas, das du
gar nicht geprüft hast.

## Datenschutz

Das Tool ist auf Datensparsamkeit gebaut: Es speichert Benutzername, Kommentartext
und Zeitpunkt — keine Profilbilder, keine Followerzahlen, keine fremden Beiträge.

Alles steckt in **einer einzigen Datei** im Projektordner:

```
gewinnspiel.db
```

**Sichern** heißt: diese Datei kopieren — auf einen USB-Stick, in die Cloud, wohin
auch immer. **Zurückspielen** heißt: Datei zurückkopieren. Sinnvoll ist eine Kopie
direkt nach einer Ziehung.

Die Datei enthält personenbezogene Daten und gehört nicht in ein öffentliches
Repository — das Projekt schließt sie automatisch aus.

### Die Datei `.env`

Beim ersten Start erzeugt das Tool zwei zufällige Schlüssel und legt sie dort ab.

**Den `ENCRYPTION_KEY` niemals ändern.** Mit ihm sind gespeicherte Zugangsdaten und
Gewinner-Angaben verschlüsselt — ist er weg oder verändert, sind diese Daten
unwiederbringlich verloren. Sicherst du die Datenbank, sichere die `.env` gleich mit.

## Aktualisieren

Beim Start schaut das Tool kurz nach, ob es eine neuere Fassung gibt:

```
▶ Neue Fassung 0.3.0 verfügbar (du hast 0.2.0)
  Jetzt aktualisieren? [j/n]
```

Drückst du **j**, schließt sich der Start und das Update-Programm übernimmt: Es
sichert deine Daten, lädt die neue Fassung, tauscht die Programmdateien und meldet
sich mit einer Bestätigung.

Du kannst es auch jederzeit von Hand starten: **`update.bat` doppelklicken** — aber
nur, wenn das Tool geschlossen ist. Läuft es noch, weigert sich das Update-Programm
und sagt dir das.

**Deine Datenbank und deine Schlüssel werden dabei nie überschrieben.** Vor jedem
Update landet eine datierte Kopie im Ordner `sicherung`.

Ohne Internet wird die Prüfung stillschweigend übersprungen.

## Bekannte Einschränkungen

- **Mehrere Gewinne** funktionieren noch nicht richtig: Nachrücker bekommen
  fälschlich Preise zugeteilt. Mit **einem** Gewinn ist alles korrekt. Die Korrektur
  kommt in einer der nächsten Fassungen.
- Die öffentliche Gewinner-Seite ist nur auf deinem Rechner erreichbar. Damit
  Teilnehmer sie selbst aufrufen können, bräuchte es einen Server im Internet.

## Wenn etwas klemmt

| Meldung | Was zu tun ist |
|---|---|
| „Node.js ist noch nicht installiert" | Node installieren, siehe „Einrichten" |
| „Die Installation ist fehlgeschlagen" | Internetverbindung prüfen, erneut doppelklicken |
| Etwas mit **better-sqlite3** oder **node-gyp** | Dein Gerät braucht eine andere Datenbank-Bibliothek — meld dich |
| „Die Datenbank konnte nicht angelegt werden" | Ordner ist schreibgeschützt — nach „Dokumente" verschieben |
| „Das Tool läuft gerade noch" | Schwarzes Fenster schließen, dann `update.bat` erneut |
| Browser zeigt nichts | Läuft das schwarze Fenster noch? Sonst `start.bat` erneut |
| Seite „Aktuell läuft kein Gewinnspiel" | Das ist die Teilnehmer-Seite. Die Verwaltung liegt unter `/admin` |

Bei allem anderen: die letzten Zeilen aus dem schwarzen Fenster kopieren und
schicken.

## Fachbegriffe kurz erklärt

**Los** — Ein Ticket in der Lostrommel. Normalerweise hat jede gültige Teilnahme ein
Los; über Zusatzlose kann jemand mehrere bekommen und damit bessere Chancen.

**Nachrücker** — Gleichzeitig mit dem Gewinner gezogene Ersatzpersonen, der Reihe
nach. Fällt der Gewinner aus, rückt der erste Nachrücker auf.

**Seed** — Eine geheime Zufallszahl, aus der die Ziehung berechnet wird. Wird nach
der Ziehung veröffentlicht, damit jeder nachrechnen kann.

**Commit-Hash** — Eine Prüfsumme über Teilnehmerliste und Seed, veröffentlicht *vor*
der Ziehung. Ändert sich die Liste nachträglich, passt der Hash nicht mehr.

**Migration** — Anpassung der Datenbank an eine neue Fassung des Programms.
Passiert beim Start automatisch, deine Daten bleiben erhalten.

**API / Schnittstelle** — Der offizielle Weg, auf dem Programme Daten von einer
Plattform abrufen dürfen. Was dort nicht vorgesehen ist, geht schlicht nicht.

**Testmodus** — Betriebsart mit erfundenen Teilnehmern zum gefahrlosen Ausprobieren.
