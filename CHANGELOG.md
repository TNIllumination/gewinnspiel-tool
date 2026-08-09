# Was sich geändert hat

## 0.5.0

- **Der Testmodus erfüllt jetzt deine eigenen Regeln.** Bisher enthielt jeder erfundene Kommentar fest das Wort „dabei" — verlangtest du etwas anderes, fiel jede der 250 Teilnahmen durch
- Nochmal drücken erzeugt frische Testteilnehmer, passend zu den aktuellen Bedingungen
- **Teilnahmebedingungen stehen jetzt über dem Einlesen** — in der Reihenfolge, in der man sie braucht
- **Veröffentlichen in zwei Schritten, klar benannt**: vor der Ziehung „Teilnahmebedingungen veröffentlichen" (keine Namen), danach „Nachweis veröffentlichen"
- Die **Prüfsumme steht ab sofort schon vor der Ziehung** auf der Seite — nur so beweist sie überhaupt etwas
- **Einstiegsliste im Dashboard**: acht Schritte vom leeren Tool bis zur fertigen Ziehung, jeder mit Begründung und Sprungknopf. Kein Handbuch nötig
- **MIT-Lizenz** und ein README, das mit den drei Startschritten beginnt — damit andere das Tool ausprobieren können

## 0.4.2

- **Das Repository-Feld versteht jetzt auch deine Veröffentlichungsadresse.** `https://deinname.github.io/gewinnspiele` wird richtig gelesen — vorher fiel der Name hinten weg und es blieb nur `https:/deinname.github.io` stehen
- Unlesbare Eingaben werden abgelehnt und gemeldet, statt stillschweigend gekürzt zu werden. Der bisherige Wert bleibt dann stehen
- **Ein Feld weniger zu grübeln**: Die Adresse deiner veröffentlichten Seiten ergibt sich aus dem Repository und wird beim Speichern selbst eingetragen

## 0.4.1

- **Fehlermeldungen sagen wieder, was los ist.** Statt „minified React error #441" steht da der Satz, der gemeint war — etwa „Es ist noch kein Zugangsschlüssel hinterlegt"
- Betraf alle Meldungen des Tools: Next.js entfernt im fertigen Bau die Texte geworfener Fehler. Sie kommen jetzt als Ergebnis statt als Ausnahme
- „Verbindung prüfen" nennt jeden Ausgang beim Namen, auch den Fall einer ausgetauschten .env
- Eigene Fehlerseite statt einer Nummer, mit Kennung zum Wiederfinden im schwarzen Fenster

## 0.4.0

- **Hochladen auf Knopfdruck**: Ein Zugangsschlüssel unter Einstellungen genügt — das Tool lädt die Seiten selbst zu GitHub und schaltet GitHub Pages beim ersten Mal ein
- Alle Dateien gehen in einem Commit hoch; ohne Schlüssel oder ohne Internet bleibt der Weg von Hand wie bisher
- **Datenschutzerklärung** wird als eigene Seite erzeugt und im Fußbereich jeder Seite verlinkt — erzeugt aus deinen echten Angaben, nicht aus einer Vorlage
- **Eigene Bedingungen** je Gewinnspiel: ein Freifeld, das als eigener Abschnitt in beiden Fassungen der Teilnahmebedingungen erscheint
- Knopf „Verbindung prüfen": sagt vor dem Gewinnspiel, ob Schlüssel und Berechtigungen stimmen

## 0.3.1

- Übersichtsseite für die veröffentlichten Gewinnspiele — sie kommt bei jeder Veröffentlichung automatisch mit
- Sie lässt sich unter „Einstellungen" auch einzeln erzeugen: GitHub Pages lässt sich erst einschalten, wenn im Repository etwas liegt
- Feld für die Adresse des Impressums; es erscheint im Fußbereich der erzeugten Seiten und in beiden Fassungen der Teilnahmebedingungen
- Fehlt beim Eintragen „https://", wird es ergänzt — sonst wäre der Link tot
- Anleitung zu GitHub Pages in der richtigen Reihenfolge: erst hochladen, dann einschalten

## 0.3.0

- Einlesen in Etappen: schon Vorhandenes wird erkannt und übersprungen — nötig, weil TikTok nie alle Kommentare auf einmal herausgibt
- Ein Gewinnspiel über mehrere Plattformen mit gemeinsamem Lostopf; wer auf zweien kommentiert, ist zweimal dabei
- Mehrere Gewinne funktionieren jetzt richtig: Nachrücker erben den Platz samt zugehörigem Gewinn
- Teilnahmebedingungen und Nachweis zum Kopieren, mit allen Pflichtangaben der Plattformen
- Seite für GitHub Pages erzeugen — samt Teilnehmerliste zum Nachrechnen
- Einsendeschluss festlegen, Festschreibung zurücknehmen, Beenden-Knopf
- „nach oben" in der Hilfe springt jetzt wirklich; Gewinnerkommentar öffentlich sichtbar

## 0.2.0

- Update per Knopfdruck: `update.bat` holt neue Fassungen selbst von GitHub
- Beim Start wird geprüft, ob es etwas Neues gibt — du entscheidest, ob aktualisiert wird
- Datenbank und Zugangsschlüssel werden vor jedem Update gesichert und nie überschrieben
- Handbuch mit Inhaltsverzeichnis als `ANLEITUNG.html` und im Tool unter „Hilfe"
- Der Start öffnet jetzt direkt die Verwaltung statt der leeren Teilnehmerseite

## 0.1.0

- Erste Fassung: Kommentare einlesen, Regeln prüfen, nachweisbar fair ziehen
- Läuft lokal ohne Server und ohne laufende Kosten
