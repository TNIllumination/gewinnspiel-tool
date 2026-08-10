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
   **Testmodus** ankreuzen, **Anlegen**
2. **Teilnahmebedingungen** → ein Wort eintragen, speichern
3. **Teilnahmen einlesen** → *250 Testteilnehmer erzeugen*
4. **Gewinne** → einen Gewinn hinzufügen
5. **Ziehung** → *Liste festschreiben*, dann *Jetzt ziehen*
6. **Gewinner prüfen** → bestätigen

Danach machst du dasselbe mit deinem echten Beitrag.

> **Erst die Bedingungen, dann die Teilnehmer.** Die erfundenen Kommentare richten sich
> nach deinen Regeln: Rund 70 % erfüllen alles, der Rest scheitert an genau einer
> Bedingung — damit du siehst, wie das Tool begründet ablehnt. Änderst du die Regeln,
> drück einfach nochmal auf *Testteilnehmer erzeugen*; dann kommen passende neue.

> **Du musst nichts auswendig lernen.** Oben im Dashboard steht eine Liste, die dich
> Schritt für Schritt durchführt und abhakt, was erledigt ist.

> Du kannst auch mehrere Gewinne anlegen. Für jeden wird ein eigener Gewinner
> gezogen, Nachrücker kommen zusätzlich obendrauf.

## Teilnahmen einlesen

### TikTok — warum du in Etappen einlesen musst

TikTok gibt Kommentare **nicht** über eine Schnittstelle heraus (Näheres unter
„Was die Plattformen nicht hergeben"). Du kopierst sie also.

Dabei stößt du auf etwas, das zunächst wie ein Fehler aussieht: **Es kommen nie alle
Kommentare mit.** Bei 98 Kommentaren landen vielleicht 14 in der Zwischenablage.

Das liegt nicht an dir. TikTok hält immer nur einen Ausschnitt der Kommentare in der
Seite und wirft weit weg gescrollte wieder heraus. Markieren erfasst deshalb nur das
gerade Sichtbare — mit keinem Trick mehr.

**Die Lösung ist Einlesen in Etappen:**

1. Beitrag im **Browser am Rechner** öffnen — in der App lässt sich nichts kopieren
2. Kommentarbereich öffnen, ein Stück **nach unten scrollen**
3. Über die Kommentare ziehen, **Strg+C** (Mac: Cmd+C)
4. Im Tool einfügen → **Prüfen** → **Übernehmen**
5. **Weiter scrollen und wiederholen**, bis nichts Neues mehr dazukommt

Das Tool erkennt, was du schon eingelesen hast, und überspringt es. Du darfst dich
also ruhig überlappen — nach jedem Übernehmen steht da, wie viele davon neu waren.
Kommt „0 neu", hast du alles.

Datumsangaben, „Antworten" und Like-Zahlen werden automatisch aussortiert.

### Instagram — automatisch abrufen statt kopieren

Verbindest du dein Instagram-Konto einmal, holt das Tool die Kommentare selbst:
vollständig, mit echtem Zeitstempel und ohne Scrollen. **Eine Freigabe durch Meta
brauchst du dafür nicht** — dazu unten mehr.

So läuft es:

1. Einmalig unter **Einstellungen → Instagram verbinden** einrichten (Anleitung
   steht dort aufklappbar, Schritt für Schritt)
2. Im Gewinnspiel bei **Teilnahmen einlesen** den Beitrag festlegen — auf zwei Wegen:
   - *Beitrag auswählen* listet deine letzten 25 Beiträge mit Bildunterschrift und
     Kommentarzahl. Weiter unten in der Liste steht *Ältere Beiträge laden*
   - Oder die **Adresse des Beitrags einfügen** und auf *Beitrag suchen* drücken.
     Der schnellere Weg bei älteren Beiträgen. Die Adresse bekommst du in der App
     über „Teilen" → „Link kopieren"
3. *Kommentare abrufen* drücken. Mehrfach drücken ist erlaubt: Was schon drin ist,
   wird erkannt und nicht doppelt gezählt

Auch **Kopiertes und Abgerufenes vermischen** sich sauber — hast du vorher etwas
von Hand eingefügt, entsteht dadurch kein zweiter Eintrag.

**Warum keine Prüfung durch Meta nötig ist.** Meta verlangt ein App Review nur,
wenn *fremde* Leute deine App benutzen sollen. Wer in seiner eigenen App als Rolle
eingetragen ist, hat sofort Zugriff auf sein eigenes Konto. Gibst du das Tool an
jemanden weiter, legt diese Person sich ebenfalls eine eigene App an — auch dann
keine Prüfung. Deshalb hat das Tool **keine eingebaute App-Kennung**.

**Zwei Wege bei Meta — nimm den richtigen.** In der Meta-Dokumentation gibt es
„Instagram-API mit Facebook-Login" (verlangt eine verknüpfte Facebook-Seite) und
**„API-Einrichtung mit Instagram-Login"**. Das Tool benutzt den zweiten Weg: keine
Facebook-Seite nötig, und der Schlüssel lässt sich ohne App-Geheimnis verlängern.
Ein Schlüssel aus dem ersten Weg wird abgelehnt — die Fehlermeldung sagt es dann
auch.

**Der Schlüssel hält 60 Tage.** Das Tool rechnet mit und meldet sich ab zwei Wochen
Restlaufzeit im Dashboard. *Schlüssel verlängern* unter Einstellungen setzt die 60
Tage zurück, ohne Umweg über Meta. Ist er einmal abgelaufen, hilft nur ein neuer.
Verlängern klappt erst, wenn der Schlüssel einen Tag alt ist.

**Ein Beitrag je Gewinnspiel.** Instagram hätte nichts dagegen, mehrere abzurufen —
das Tool sieht bisher einen vor. Läuft eine Verlosung mal über zwei Beiträge, sag
Bescheid, dann wird es erweitert.

**Nur eigene Beiträge.** Gesucht wird in deiner eigenen Beitragsliste. Der Link zu
einem fremden Beitrag wird deshalb nicht gefunden — das ist keine Panne, sondern die
Grenze der Schnittstelle: Kommentare unter fremden Beiträgen gibt Instagram
grundsätzlich nicht heraus.

**Was auch mit Anbindung Handarbeit bleibt:** Wer geliked hat und wer dir folgt,
gibt Instagram grundsätzlich nicht heraus. Das wird bei Gewinnern und Nachrückern
von Hand geprüft — dafür gibt es die Verifikations-Checkliste.

### YouTube

Bleibt vorerst beim Einfügen. Nötig wäre nur ein API-Key aus der Google Cloud
Console — weder OAuth noch eine Freigabe.

### Mehrere Plattformen in einem Gewinnspiel

Ein Gewinnspiel kann gleichzeitig auf Instagram, TikTok und YouTube laufen. Beim
Einlesen wählst du, von welcher Plattform der Ausschnitt stammt. Alle Teilnahmen
landen in **einem gemeinsamen Lostopf**.

Wichtig: **Wer auf mehreren Plattformen kommentiert, ist mehrfach im Topf.** Das ist
Absicht — so kannst du „kommentier auch drüben für mehr Chancen" ansagen und
gewinnst Reichweite auf beiden Kanälen. Ob `@anna` auf TikTok dieselbe Person ist
wie `@anna` auf Instagram, kann ohnehin niemand feststellen. Der Punkt steht
automatisch in den Teilnahmebedingungen.

### Warum es eine Vorschau gibt

Nach dem Einfügen zeigt das Tool erst, **was es erkannt hat**: wie viele Teilnahmen,
in welchem Format, und die ersten zehn mit Name und Kommentar. Erst wenn du
**Übernehmen** drückst, wird gespeichert.

Das ist Absicht. Das Tool muss beim Einfügen erraten, wie der Text aufgebaut ist —
und ein Fehlgriff soll auffallen, solange er noch folgenlos ist.

### Welche Formate erkannt werden

| Format | Wie es aussieht |
|---|---|
| **TikTok-Kopie** | Der Name steht **doppelt**, darunter Text, Datum, Like-Zahl, „View 2 replies" |
| **Instagram-Kopie** | `annas Profilbild` ⏎ `anna` ⏎ `2 Tage` ⏎ Text — auf Englisch `annas profile picture` ⏎ `anna` ⏎ `2d` |
| Name mit Kommentar darunter | `anna_berg` ⏎ `Ich bin dabei @ben` |
| Name, Doppelpunkt, Text | `@anna: Ich bin dabei @ben` |
| Tabelle mit Kopfzeile | `Benutzer;Kommentar;Datum` und darunter die Zeilen |

**Du musst nichts nachbearbeiten.** Markieren, einfügen, prüfen, übernehmen — das
Tool erkennt selbst, woher der Text stammt, und sortiert Datumsangaben, Like-Zahlen
und „View 2 replies" aus. In der Vorschau steht, welches Format erkannt wurde.

Aus dem Kopiertext übernimmt das Tool auch den **echten Zeitpunkt** des Kommentars.
Bei Instagram ist er ungefähr, weil dort nur „vor 2 Tagen" steht. Das zählt für die
Regel *Einsendeschluss*.

> **Bei TikTok fehlt die @-Kennung.** Kopiert wird nur der Anzeigename („Alex M."),
> nicht das Handle. Der Profillink bei der Gewinnerprüfung führt deshalb ins Leere —
> such den Gewinner dort von Hand. Bei Instagram stimmt der Name.

Zeilen, die sich nicht zuordnen lassen, werden **gemeldet** statt stillschweigend
verworfen. Mehrzeilige Kommentare bleiben zusammen.

**Wenn ein Kopierformat nicht erkannt wird.** Instagram und TikTok ändern ihre
Oberfläche, und bei anderer Spracheinstellung stehen die Zeilen anders da. Erkennt
das Tool verräterische Merkmale, kann den Text aber nicht als Kopie lesen, warnt es
in der Vorschau ausdrücklich:

> Das sieht nach einer Instagram-Kopie aus, ließ sich aber nicht als solche lesen —
> die Namen unten stimmen dann wahrscheinlich nicht.

Diese Warnung ist ernst zu nehmen: Gelesen wird dann nach dem allgemeinen Format,
und dabei entstehen Teilnehmer mit fremden Texten. Das fällt beim Durchsehen kaum
auf, verfälscht aber die Ziehung. **Übernimm in dem Fall nichts** — nutz lieber die
Instagram-Anbindung oder trag die Teilnahmen als Tabelle ein.

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

### Löschfristen — was du zugesagt hast, halten

In deiner Datenschutzerklärung steht, dass Teilnehmerdaten nach dem Gewinnspiel
gelöscht werden, spätestens nach der eingestellten Frist (Feld **Aufbewahrung** am
Gewinnspiel, voreingestellt 90 Tage). Eine schriftliche Zusage, die niemand einlöst,
ist schlimmer als keine.

Das Tool läuft nur, wenn du es startest — einen Dienst, der nachts löscht, kann es
also nicht geben. Stattdessen **prüft es bei jedem Blick aufs Dashboard**: Ist die
Frist bei einem abgeschlossenen Gewinnspiel abgelaufen, steht dort eine auffällige
Karte mit dem Knopf **Teilnehmerdaten jetzt löschen**.

Gelöscht wird bewusst **nicht automatisch**. Läuft noch ein Fall — ein Gewinner meldet
sich nicht, jemand beschwert sich — wäre stilles Löschen genau falsch. Die
Entscheidung bleibt bei dir, sichtbar genug, dass du sie nicht übersiehst.

**Was gelöscht wird:** alle Teilnahmen, die nicht gezogen wurden — Benutzername,
Kommentartext, Zeitpunkt.
**Was bleibt:** die Ziehung selbst mit Prüfsumme und Zufallszahl sowie die gezogenen
Gewinner und Nachrücker. Löschte man die mit, ließe sich der veröffentlichte Nachweis
nicht mehr nachrechnen — und genau den schuldest du den Teilnehmern.

### Wenn jemand Auskunft oder Löschung verlangt

Teilnehmer dürfen wissen, was du über sie gespeichert hast (Art. 15 DSGVO), und die
Löschung verlangen (Art. 17 DSGVO). Deine Datenschutzerklärung sagt beides zu.

Unter **Einstellungen → Anfrage einer teilnehmenden Person** gibst du den
Benutzernamen ein:

- **Auskunft** listet alle Teilnahmen dieser Person mit Gewinnspiel, Plattform,
  Kommentartext und Datum. Das kannst du so weitergeben.
- **Löschen** entfernt sie aus allen Gewinnspielen. Es folgt eine Rückfrage, denn
  rückgängig geht das nicht.

**Wichtig, wenn die Teilnehmerliste schon veröffentlicht ist:** Veröffentliche die
Seite danach neu, sonst steht der Name weiter online. Die Prüfsumme lässt sich dann
nicht mehr nachrechnen — sie wurde über die vollständige Liste gebildet. Schreib das
auf die Seite oder unter den Beitrag, statt es unerwähnt zu lassen. Das ist kein
Fehler des Verfahrens: Ein Löschverlangen sticht die Nachrechenbarkeit, und ehrlich
vermerkt ist es nachvollziehbar.

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

## Teilnahmebedingungen veröffentlichen

Zwei Dinge musst du bei jedem Gewinnspiel dazuschreiben — beides verlangen die
Plattformen und das Gesetz:

1. Dass die Aktion **in keiner Verbindung** zu Instagram/TikTok steht
2. Dass Teilnehmer die Plattform **von jeglicher Haftung freistellen**
3. Dass **du allein Ansprechpartner** bist und Fragen nicht an die Plattform gehen

Dazu kommt: Teilnahmebedingungen müssen **leicht zugänglich** sein (§ 6 DDG).

Das Tool nimmt dir das ab. Trag einmalig unter **Einstellungen** deinen Namen und
eine Kontaktmöglichkeit ein, dann erzeugt der Knopf **Texte erzeugen** im Gewinnspiel:

- eine **Kurzfassung** für die Bildunterschrift des Beitrags, mit allen drei
  Pflichtbestandteilen und einem Link auf die ausführliche Fassung
- die **vollständigen Teilnahmebedingungen** — erzeugt aus deinen echten Regeln,
  nicht aus einer Vorlage
- den **Nachweis-Text** zur Ziehung zum Einfügen als Kommentar

> Der Text gehört in die **Bildunterschrift**, nicht in einen Kommentar: TikTok-
> Kommentare fassen nur etwa 150 Zeichen. Das Tool zählt mit und warnt, wenn es
> zu lang wird.

### Kostenlos online stellen mit GitHub Pages

Damit Teilnehmer die ausführliche Fassung auch aufrufen können, brauchst du eine
öffentliche Adresse — die kostet aber nichts.

**Einmalig einrichten:**

1. Auf GitHub ein neues **öffentliches** Repository anlegen, z. B. `gewinnspiele`
2. Einen **Zugangsschlüssel** anlegen (siehe nächster Abschnitt) und im Tool unter
   **Einstellungen** zusammen mit dem Repository eintragen
3. Auf **Verbindung prüfen** — das Tool sagt dir, ob alles passt
4. Auf **Übersichtsseite erzeugen und hochladen**

Fertig. Das Tool legt die Dateien an, lädt sie hoch und schaltet GitHub Pages ein.
Nach ein bis zwei Minuten ist die Adresse erreichbar. Eintragen musst du sie nicht —
sie ergibt sich aus dem Repository und steht nach dem Speichern von selbst im Feld
darunter.

Ins Feld **Repository** darf beides: `deinname/gewinnspiele`, die GitHub-Adresse
`github.com/deinname/gewinnspiele` oder die Veröffentlichungsadresse
`deinname.github.io/gewinnspiele`. Versteht das Tool die Eingabe nicht, sagt es das —
und lässt den alten Wert stehen, statt etwas Halbes zu speichern.

Heißt dein Konto `TNIllumination` und das Repository `gewinnspiele`, lautet sie
`https://tnillumination.github.io/gewinnspiele`. **Kleingeschrieben**, auch wenn dein
Kontoname Großbuchstaben hat — die häufigste Stolperstelle beim Abtippen.

**Ab dann** genügt beim Gewinnspiel der Knopf **Veröffentlichen und hochladen**.
Gewinnspielseite, Übersicht und Datenschutzerklärung gehen in einem Zug hoch.

### Den Zugangsschlüssel anlegen

1. Auf GitHub oben rechts aufs Profilbild → **Settings**
2. Ganz unten links **Developer settings**
3. **Personal access tokens → Fine-grained tokens → Generate new token**
4. Name z. B. `Gewinnspiel-Tool`, Laufzeit wählen
5. **Repository access → Only select repositories →** `gewinnspiele`
6. **Permissions → Repository permissions**: **Contents** auf *Read and write*,
   **Pages** auf *Read and write*
7. **Generate token**, kopieren — GitHub zeigt ihn **nur einmal** an
8. Im Tool unter **Einstellungen** einfügen und speichern

Der Schlüssel gilt nur für dieses eine Repository, nicht für dein übriges Konto. Er
liegt verschlüsselt in der Datenbank und wird nie wieder angezeigt. Läuft er ab, legst
du einen neuen an — das Tool sagt dir dann, dass er abgelaufen ist.

### Ohne Zugangsschlüssel

Geht auch. Dann erzeugt das Tool nur die Dateien in den Ordner `veroeffentlichung`,
und du lädst sie selbst hoch: auf GitHub **Add file → Upload files**, alle Dateien
hineinziehen, **Commit changes**. GitHub Pages musst du dann einmalig selbst
einschalten — **erst nach** dem ersten Hochladen, denn ein leeres Repository bietet
unter *Settings → Pages* keinen Branch zur Auswahl an.

Dasselbe gilt, wenn unterwegs kein Internet da ist: Die Dateien sind trotzdem
geschrieben und lassen sich später hochladen.

Lade zweimal hoch: vor dem Start mit den Bedingungen, nach der Ziehung mit dem
Ergebnis. Gleicher Dateiname, gleiche Adresse — der Link im Beitrag bleibt gültig.

### Eigene Bedingungen ergänzen

Unter den Regeln gibt es das Feld **Eigene Bedingungen** — eine Bedingung je Zeile.
Sie erscheinen als eigener Abschnitt „Weitere Bedingungen" in den
Teilnahmebedingungen und auch in der Kurzfassung für den Beitrag. Typisch:

```
Übergabe des Gewinns vor Ort auf dem Festival
Versand nur innerhalb Deutschlands
```

Der Pflichthinweis der Plattformen bleibt davon unberührt und steht weiterhin am Ende.

### Datenschutzerklärung

Sobald die Seiten öffentlich erreichbar sind, brauchst du eine — aus zwei Gründen:
GitHub verarbeitet beim Aufruf die IP-Adresse der Besucher, und auf der Seite stehen
die Benutzernamen der Teilnehmer. Das Impressum deckt das nicht ab.

Das Tool erzeugt sie automatisch als `datenschutz.html`, jedes Mal, wenn du
veröffentlichst — aus deinen echten Angaben: Veranstalter, Kontakt, Impressum,
genutzte Plattformen und den Fristen aus den Einstellungen. Verlinkt ist sie im
Fußbereich jeder Seite.

Unter **Einstellungen** legst du fest, wie lange veröffentlichte Seiten online
bleiben (Voreinstellung: 6 Monate). Diese Frist steht wörtlich in der Erklärung — halt
dich also daran, oder ändere die Zahl.

Wie bei den Teilnahmebedingungen gilt: Das ist keine Rechtsberatung. Einmal von einem
Anwalt gegenlesen lassen, dann steht es.

### Veröffentlichen in drei Stufen

Das passiert nicht auf einmal, und das ist Absicht. Der Knopf unter
**Teilnahmebedingungen und Nachweis** heißt jeweils nach dem, was er gerade tut:

| Wann | Knopf | Was online geht |
|---|---|---|
| am Anfang | *Teilnahmebedingungen veröffentlichen* | nur die Bedingungen |
| nach dem Festschreiben | *Bedingungen und Prüfsumme veröffentlichen* | zusätzlich die Prüfsumme — **keine Namen** |
| nach der Ziehung | *Nachweis veröffentlichen* | Teilnehmerliste, Zufallszahl, Gewinner |

**Die mittlere Stufe ist die wichtigste.** Die Prüfsumme muss veröffentlicht sein,
**bevor** du ziehst. Sonst könnte dir jemand vorwerfen, du hättest sie nachträglich
passend zum Ergebnis erzeugt — und genau darauf beruht der ganze Nachweis.

Deshalb steht in der Ziehungskarte, ob die Prüfsumme schon veröffentlicht ist. Ist sie
es nicht, warnt das Tool und fragt vor dem Ziehen nach. **Verhindert wird es nicht** —
ohne Internet unterwegs musst du ziehen können. Aber versehentlich passiert es nicht
mehr.

Der Zeitpunkt der Veröffentlichung wird festgehalten und steht anschließend auf der
Nachweis-Seite: *festgeschrieben → Prüfsumme veröffentlicht → gezogen*. Diese
Reihenfolge, schwarz auf weiß, ist der eigentliche Beweis.

**Der Ablauf am Stück:**

1. Bedingungen setzen, Teilnahmen einlesen, Gewinne anlegen
2. *Teilnahmen festschreiben*
3. Oben: *Bedingungen und Prüfsumme veröffentlichen*
4. *Jetzt ziehen*
5. Gewinner prüfen und bestätigen
6. Oben: *Nachweis veröffentlichen*

### Was ist online? — die Checkliste

Über der Veröffentlichungs-Karte steht **Was ist online?**. Sie beantwortet die
Frage, die man sich sonst selbst nicht beantworten kann: *Habe ich schon geklickt?*

Denn GitHub Pages baut die Seite nach dem Hochladen erst neu — das dauert **ein bis
zwei Minuten**. In dieser Lücke sieht die Live-Seite noch alt aus. Ohne Hinweis klickt
man ein zweites Mal, oder man wartet auf eine Änderung, die man nie angestoßen hat.

In der Checkliste steht jede der drei Stufen. Erledigte werden durchgestrichen und
ausgegraut, mit Zeitpunkt daneben. Darunter:

- **Zuletzt hochgeladen: vor 12 Sekunden.** Als Spanne, nicht als Uhrzeit — „21:04"
  muss man erst mit der Uhr vergleichen, „vor 12 Sekunden" nicht.
- Liegt das Hochladen weniger als zwei Minuten zurück, steht dort ausdrücklich:
  *GitHub Pages baut die Seite gerade neu. Nicht nochmal drücken.*
- Steht dort **„erzeugt, aber noch nicht hochgeladen"**, liegen die Dateien nur im
  Ordner `veroeffentlichung`. Dann fehlt der Zugangsschlüssel, oder das Hochladen ist
  fehlgeschlagen — online ist dann nichts.
- **Als Nächstes** nennt die nächste offene Stufe. Steht dort nichts, ist gerade
  nichts zu tun.

### Impressum

Die veröffentlichten Seiten sind ein von dir betriebenes Online-Angebot. Sobald
du damit geschäftlich auftrittst — und Reichweite für deinen Kanal zählt dazu —
braucht es ein **Impressum** (§ 5 DDG): leicht erkennbar, unmittelbar erreichbar,
ständig verfügbar. Für eine rein private Verlosung im Freundeskreis gilt das nicht.

Trag die Adresse unter **Einstellungen → Adresse deines Impressums** ein. Sie
erscheint dann automatisch im Fußbereich jeder erzeugten Seite, in den
ausführlichen Teilnahmebedingungen und in der Kurzfassung für den Beitrag. Fehlt
`https://`, ergänzt das Tool es beim Speichern — sonst wäre der Link tot.

Auf der Seite stehen nach der Ziehung auch Prüfsumme, Zufallszahl und die
vollständige Teilnehmerliste. **Erst dadurch kann jemand die Ziehung wirklich
nachrechnen** — sonst bliebe die faire Ziehung eine Behauptung.

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

**Gewinnplatz** — Ein Platz mit eigenem Gewinn (1., 2., 3. Platz). Der Gewinn hängt
am Platz: Rückt jemand auf Platz 1 nach, bekommt er den Hauptgewinn.
