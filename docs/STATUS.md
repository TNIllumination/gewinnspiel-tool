# Stand der Arbeit

> Diese Datei wird am Ende jedes Arbeitsblocks aktualisiert. Sie ist der
> Wiedereinstiegspunkt — egal ob am Handy, am PC oder in einer neuen Sitzung.

**Letzte Aktualisierung:** 11. August 2026
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
- **290 Tests**, alle grün (`npm test`).

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

- **Fassung 0.4.2**: `normalizeRepo` entscheidet am Gastgebernamen statt blind an den
  ersten zwei Pfadteilen — `besitzer.github.io/name` wird verstanden, Unlesbares gibt
  `""` und `saveSettings` lehnt es mit Meldung ab. `publishBaseUrl` wird aus dem
  Repository abgeleitet, weil zwei Felder für dieselbe Sache verwirrt haben.

- **Fassung 0.5.0**: `generateSandboxComments` bekommt die gesetzten Regeln und baut
  die Texte daraus; `importSandbox` loescht alte Testteilnehmer vorher, damit erneutes
  Druecken wirkt. Karten „Teilnahmebedingungen" und „Teilnahmen einlesen" getauscht.
  Veroeffentlichen in zwei benannten Schritten; `buildPublishPage` zeigt die Pruefsumme
  schon nach dem Festschreiben. `einstiegsschritte()` + `src/components/einstieg.tsx`
  als Einstiegsliste, `Settings.impressumGeklaert` als Merkfeld. `LICENSE` (MIT) und
  README mit Startschritten. Neue Reihe `scripts/e2e-einstieg.mjs` (braucht eine
  frische Datenbank).

- **Fassung 0.5.1**: `Draw.commitPublishedAt` samt Migration — ohne diesen Zeitpunkt
  liess sich nicht belegen, dass die Pruefsumme vor der Ziehung feststand. `publishPage`
  setzt ihn beim ersten Veroeffentlichen einer festgeschriebenen, ungezogenen Liste;
  `buildPublishPage` und `buildProofText` weisen ihn aus. TextePanel kennt drei Stufen
  (`bedingungen` / `pruefsumme` / `nachweis`), die Ziehungskarte meldet den Zustand,
  verweist auf `#veroeffentlichen` und fragt vor dem Ziehen zurueck.

- **Fassung 0.6.0**: `parseTikTok` und `parseInstagram` in
  `src/platforms/manual-import.ts`. Anker sind der doppelte Name (TikTok) und
  „<name>s Profilbild" + Name (Instagram); die Zeilen dazwischen werden **nach ihrer
  Art erkannt**, nicht nach Position — an echten Kopien scheiterte das Zaehlen an
  Kommentaren ohne Text und mehrzeiligen Kommentaren. Echte Zeitstempel aus Datum
  bzw. Altersangabe. Gegen zwei echte Kopien geprueft: 36 von 37 und 64 von 65
  Bloecken, null Fehlgriffe.

- **Fassung 0.7.0**: `src/lib/checkliste.ts` (`stand`, `seit`) und die Karte
  `veroeffentlicht-checkliste.tsx` — `Giveaway.termsPublishedAt`, `proofPublishedAt`
  und `lastUploadAt` samt Migration `20260810080000_checkliste`. `lastUploadAt` wird
  **nur** bei geglücktem Upload gesetzt; „erzeugt" ist nicht „online". Die Uhr kommt
  über `useSyncExternalStore` (sonst Hydrationsfehler bzw. React-Compiler-Verstoss).
  `src/lib/aufbewahrung.ts` (`faelligkeit`) loest die Loeschfrist ein, die im
  Datenmodell stand und nirgends gelesen wurde; `loescheTeilnehmerdaten` nimmt die
  gezogenen Eintraege **aus** — `DrawResult` haengt per Fremdschluessel am `Entry`
  und haette Gewinner und Nachruecker mitgerissen. `personen-anfrage.tsx` macht
  Auskunft und Loeschung nach Art. 15/17 DSGVO endlich bedienbar.

- **Fassung 0.8.0**: `src/platforms/instagram.ts` ruft Kommentare selbst ab —
  ueber **„Instagram API with Instagram Login"** (`graph.instagram.com`, v25.0),
  nicht ueber den Weg mit Facebook-Anmeldung. Zwei Gruende: keine verknuepfte
  Facebook-Seite noetig, und `refresh_access_token` verlaengert **ohne
  App-Geheimnis**. Kein App Review, solange man sein eigenes Konto abruft und in
  der eigenen App als Rolle eingetragen ist — deshalb hat das Tool **keine
  eingebaute App-Kennung**, jeder traegt seine eigene ein.
  Blaettern ueber den `after`-Cursor statt ueber die fertige `next`-Adresse: die
  traegt den Schluessel im Klartext. `InstagramError` mit gesetztem `name`, damit
  `alsErgebnis` greift (sonst wieder „error #441"). `storeComments` wird
  unveraendert weiterbenutzt — die Dublettenpruefung ueber `externalId` lag schon
  bereit, und `entryFingerprint` faengt die Mischung aus Kopie und Abruf ab.
  `tokenFrist` in `src/lib/aufbewahrung.ts` meldet den Ablauf ab 14 Tagen.
  `GiveawaySource.externalId`/`postLabel` samt Migration `20260810210000_instagram`.
  Die `PlatformCapabilities` aus `base.ts` steuern **endlich wirklich** die
  Oberflaeche — bis 0.7.0 wurden sie nirgends gelesen.
  Im Kopierimport: englische Anker (`'s profile picture`, `2d`/`1w`) und
  `wirktWieKopie`, das eine nicht gelesene Kopie meldet statt sie als allgemeines
  Format zu verhunzen. Dabei gefunden: `parseInstagram` filterte `isNoise` nicht —
  „Antworten" klebte hinten am Kommentartext, in der deutschen Beispieldatei nur
  zufaellig nicht sichtbar.

- **Fassung 0.8.1**: `kuerzelAusLink` und `sucheBeitragPerLink` in
  `src/platforms/instagram.ts`. Aus der Beitragsadresse laesst sich die Kennung
  offiziell nicht gewinnen — man braucht es aber nicht: Die eigene Beitragsliste
  liefert zu jedem Beitrag den `permalink` mit, also wird sie durchgeblaettert, bis
  das Kuerzel passt (hoechstens 20 Seiten à 50). Verglichen wird nur das Kuerzel,
  nie die volle Adresse: `/p/` gegen `/reel/`, fehlendes `www`, angehaengtes
  `?igsh=…`.
  `holeBeitraege` gibt jetzt `{ beitraege, weiter }` zurueck und blaettert —
  vorher endete die Auswahlliste nach einer Seite bei 25 Beitraegen, und ein
  aelterer war **gar nicht** erreichbar. Das war eine Luecke, kein Limit von
  Instagram; beim Abrufen der Kommentare wurde von Anfang an sauber geblaettert.
  Ein Beitrag je Gewinnspiel bleibt bewusst so (`@@unique([giveawayId, platform])`).

- **Fassung 0.8.2**: `zaehleKommentare`, `nichtsGeliefert` und
  `hinweisZuAntworten` in `src/platforms/instagram.ts`. Beim ersten echten Versuch
  lieferte Instagram **null Kommentare ohne Fehler** — die Fehleruebersetzung hatte
  nichts zu uebersetzen, und die Meldung fragte nach dem richtigen Beitrag, obwohl
  der Beitrag stimmte. Entscheidend ist Instagrams eigene Zahl: zaehlt es 137 und
  liefert 0, ist es die fehlende Freigabe; zaehlt es selbst 0, ist die Frage nach
  dem Beitrag berechtigt. Die Schritte in der Meldung sind nach Wahrscheinlichkeit
  sortiert, und sie trennt **App-Review vom Schalter Entwicklung/Live** — Meta legt
  diese Verwechslung selbst nahe. Beide Textbausteine liegen als reine Funktionen
  im Modul statt in `actions.ts`, damit sie ohne Datenbank pruefbar sind.

- **Fassung 0.9.0**: Der erste echte Abruf lieferte 66 **eigene** Kommentare und
  uebersprang 90 fremde — bei denen fehlte der Benutzername. Metas Referenz erklaert
  beides: `user` setzt Meta nur bei Kommentaren des App-Nutzers selbst, und der
  Zugriff auf `username` verlangt seit 27.08.2024 `instagram_business_manage_comments`.
  Fehlt die Berechtigung am **Schluessel**, kommen die Kommentare trotzdem — nur ohne
  Namen und ohne Fehler. `holeKommentare` fordert jetzt `user`, `parent_id` und
  `from{id,username}` mit an, sortiert eigene Kommentare und Antworten aus und bricht
  ueber `namenFehlen` ab, sobald mehr als ein Viertel der Namen fehlt (Rueckgabewert
  statt Ausnahme, sonst ginge die Diagnose verloren). `Diagnose` samt
  `ohneSchluessel` zeigt die Rohantwort im Aufklappkasten — **ohne** Zugangsschluessel,
  durch Modultest und E2E abgesichert. Zwei Runden Raterei waeren damit entfallen.

- **Fassung 0.9.1**: An einer echten Antwort abgelesen — bei **fremden** Kommentaren
  steht der Name ausschliesslich unter `from`, das blosse `username` liefert Meta nur
  bei den eigenen. Metas Referenz behauptet das Gegenteil. Damit war die Ursache aus
  0.9.0 falsch dokumentiert („neuen Schluessel erzeugen"); behoben hatte es bereits
  das mitangeforderte Feld `from{id,username}`. `istEigener` prueft `user` jetzt
  ausdruecklich als Objekt (es kommt als `{"id":"…"}`, der Wahrheitswert stimmte nur
  zufaellig), und Eigene werden vor Antworten gezaehlt — die eigenen Kommentare sind
  ueberwiegend Antworten, sonst stuende „0 eigene". Testbeispiele stammen aus dem
  echten Abruf (157 Eintraege, 4 Seiten).

## Als Nächstes

1. PDF-Ziehungsprotokoll als Rechtsnachweis.
2. Verarbeitungsverzeichnis.
3. YouTube (nur ein API-Key aus der Google Cloud Console noetig).

## Zurück zu PostgreSQL (falls später Hosting gewünscht)

Nötig wäre: `provider` im Schema auf `postgresql`, `Account.scopes` wieder auf
`String[]`, `PrismaBetterSqlite3` → `PrismaPg` in `src/lib/db.ts`, frische Migration.
Zusätzlich zwei Stellen, die auf SQLite anders gelöst sind und dort wieder vereinfacht
werden könnten: der Duplikat-Abgleich in `storeComments` (SQLite kennt kein
`skipDuplicates`) und die Suche in `eraseParticipant` (kein `mode: "insensitive"`).

## Offen / zu beachten

- **Login**: Statt Auth.js ist eine schlanke Cookie-Session mit `jose` vorgesehen —
  bei genau einem Benutzer ist das weniger fehleranfällig als ein volles Auth-Framework.
- **Instagram** laeuft seit 0.8.0 ohne App Review — das braucht nur, wer Fremde
  auf die eigene Meta-App laesst. Wichtig: Der Zugangsschluessel haelt 60 Tage.
- **YouTube** braucht nur einen API-Key aus der Google Cloud Console.
- **TikTok** bleibt beim Import von Hand, solange es keinen Kommentar-Scope gibt.
