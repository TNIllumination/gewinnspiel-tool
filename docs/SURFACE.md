# Auf dem eigenen Rechner starten (Surface, Laptop, PC)

Das Tool läuft **auf deinem Gerät**. Kein Server, keine monatlichen Kosten,
kein Docker. Die Teilnehmerdaten verlassen dein Gerät nie — datenschutzrechtlich
ist das der sauberste Weg, den es gibt.

Internet brauchst du nur, um bei TikTok und Instagram die Kommentare zu holen.
Das Tool selbst läuft auch offline.

---

## Einmalig einrichten

### 1. Node.js installieren

Auf [nodejs.org](https://nodejs.org) die große grüne Schaltfläche anklicken
(Variante **LTS**), Datei ausführen, Weiter–Weiter–Fertig. Das ist die einzige
Installation, die du brauchst.

### 2. Das Tool herunterladen

Auf der GitHub-Seite des Projekts auf **Code → Download ZIP**, danach die
ZIP-Datei entpacken — zum Beispiel nach `Dokumente\gewinnspiel-tool`.

> **Wichtig:** Nicht nach „Programme" entpacken. Dort darf das Tool seine
> Datenbank nicht anlegen. Ein normaler Ordner unter „Dokumente" ist ideal.

### 3. Starten

**`start.bat` doppelklicken.**

Beim ersten Mal dauert es ein paar Minuten — es werden Bausteine geladen, die
Zugangsschlüssel erzeugt, die Datenbank angelegt und die Anwendung gebaut.
Danach geht es in wenigen Sekunden.

Ein schwarzes Fenster öffnet sich und zeigt den Fortschritt. Wenn dort
`✅ Läuft` steht, öffnet sich der Browser automatisch. Falls nicht, ruf
**http://localhost:3000** von Hand auf.

### 4. Konto anlegen

Beim allerersten Aufruf erscheint die **Ersteinrichtung**: E-Mail und ein
Passwort mit mindestens 12 Zeichen. Das ist dein Zugang — es gibt nur dieses
eine Konto, ein zweites lässt sich nicht anlegen.

---

## Ab jetzt: jedes Mal

1. `start.bat` doppelklicken
2. Warten, bis der Browser aufgeht
3. Anmelden

**Zum Beenden** das schwarze Fenster schließen. Solange es offen ist, läuft das
Tool. Das ist kein Fehler — das Fenster *ist* der Server.

Doppelklickst du `start.bat` versehentlich ein zweites Mal, merkt das Tool das
und schickt dich einfach zur laufenden Version.

---

## Deine Daten sichern

Alles steckt in **einer einzigen Datei** im Projektordner:

```
gewinnspiel.db
```

Sichern heißt: diese Datei kopieren — auf einen USB-Stick, in die Cloud, egal
wohin. Zurückspielen heißt: Datei zurückkopieren. Mehr ist es nicht.

Sinnvoll ist eine Kopie **direkt nach einer Ziehung**, solange die Nachweise
noch frisch sind.

> Die Datei enthält personenbezogene Daten (Benutzernamen und Kommentare).
> Sie gehört nicht in ein öffentliches Repository — das Projekt schließt sie
> deshalb automatisch aus.

---

## Die Datei `.env`

Beim ersten Start legt das Tool eine Datei `.env` an. Darin stehen zwei
zufällig erzeugte Schlüssel.

**Den `ENCRYPTION_KEY` niemals ändern.** Mit ihm sind gespeicherte Zugangsdaten
und Gewinner-Angaben verschlüsselt — ist er weg oder verändert, sind diese
Daten unwiederbringlich verloren. Sicherst du die Datenbank, sichere die `.env`
gleich mit.

---

## Wenn etwas klemmt

| Meldung im schwarzen Fenster | Was zu tun ist |
|---|---|
| „Node.js ist noch nicht installiert" | Schritt 1 nachholen |
| „Die Installation ist fehlgeschlagen" | Internetverbindung prüfen, erneut doppelklicken |
| Etwas mit **better-sqlite3** oder **node-gyp** | Gerät braucht eine andere Datenbank-Bibliothek — meld dich, das ist schnell umgestellt |
| „Die Datenbank konnte nicht angelegt werden" | Ordner ist schreibgeschützt — nach „Dokumente" verschieben |
| Browser zeigt nichts | Läuft das schwarze Fenster noch? Sonst `start.bat` erneut |

Bei allem anderen: die letzten Zeilen aus dem schwarzen Fenster kopieren und
schicken. Daraus lässt sich die Ursache fast immer direkt ablesen.

---

## Und wenn es doch mal öffentlich sein soll?

Solange du nur auslosen willst, brauchst du kein Hosting. Erst wenn Teilnehmer
die Gewinner-Seite **selbst aufrufen** können sollen, wäre ein Server nötig.
Der Weg dorthin ist überschaubar und in `docs/STATUS.md` beschrieben — er
kostet dann etwa 5–7 € im Monat.
