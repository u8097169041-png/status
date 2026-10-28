# SocialVerse

**SocialVerse** ist eine lokal laufende, interaktive KI-Weltsimulation im Stil eines sozialen Netzwerks.
Du trittst einer Welt bei – Promis, Politik, Internet, Fantasy, Wirtschaft, Sport, Unterhaltung, alternative Szenarien oder Fiktion –
und spielst dort eine **eigene Figur** oder übernimmst eine **bekannte Figur** dieser Welt. Du postest, chattest,
triffst Entscheidungen und beeinflusst damit Beziehungen, Ansehen und den Verlauf der Geschichten. Die Figuren
handeln auch selbstständig weiter – im kostenlosen Demo-Modus komplett ohne KI-Anbieter.

![Startseite: Weltauswahl mit Kategorien, beliebten Welten und Handlungsbögen](docs/screenshots/discover.jpg)

> **Hinweis:** SocialVerse ist eine lokale Einzelplatz-Anwendung. Es gibt keine Benutzerkonten, keine
> Online-Infrastruktur und keine Zahlungsfunktionen. Die App ist nicht dafür gedacht, im Internet betrieben zu werden.

---

## Inhalt

1. [Funktionen](#funktionen)
   - [So funktioniert das Spiel](#so-funktioniert-das-spiel)
2. [Voraussetzungen](#voraussetzungen)
3. [Schnellstart unter Windows 11](#schnellstart-unter-windows-11)
4. [Entwicklungsmodus mit Hot Reload](#entwicklungsmodus-mit-hot-reload)
5. [Start unter macOS/Linux und alle Befehle](#start-unter-macoslinux-und-alle-befehle)
6. [KI einrichten (optional, OpenRouter)](#ki-einrichten-optional-openrouter)
7. [Konfiguration (.env)](#konfiguration-env)
8. [Daten, Export, Backup und Löschen](#daten-export-backup-und-löschen)
9. [Sicherheit und Datenschutz](#sicherheit-und-datenschutz)
10. [Tests und Qualitätsprüfung](#tests-und-qualitätsprüfung)
11. [Fehlerbehebung](#fehlerbehebung)
12. [Bekannte Einschränkungen](#bekannte-einschränkungen)

Technische Details zu Aufbau, Datenmodell, Simulation und Erinnerungsstrategie stehen in
[docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

---

## Funktionen

| Bereich | Was du tun kannst |
| --- | --- |
| **Startseite / Weltauswahl** | Dunkles, mobil optimiertes Layout: Kopfzeile mit Logo, Rollen- und Weltwechsler, Mitteilungen und Einstellungen; Kategorien (Promis, Politik, Internet, Fantasy, … und „Eigene Welten“); horizontal scrollbare Weltkarten mit Titelbild, Kategorie, Beschreibung, Figuren und (simulierter) Aktivität; „Deine Welten“, beliebte Welten, interaktive Handlungsbögen mit möglichen Enden, eigene Welt erstellen, bekannte Figuren. Vor dem Beitritt gibt es **nur** Entdeckung – keine Stories, Beiträge, Quests oder Ereignisse |
| **Beitritt** | Eigene Figur (Name, Beruf/Rolle, Hintergrund, Persönlichkeit, Ziele, **Hauptziel**, Avatar) oder bekannte Figur der Welt übernehmen; optional als klar gekennzeichnete Simulation einer realen öffentlichen Person; kontrollierter Figurenwechsel mit Bestätigung, ohne Datenverlust |
| **Quests** | Hauptquest (3 Stufen, passend zu Rolle und Hauptziel), Nebenquests (Beziehungen, Rivalitäten, Kooperationen, Handlungsbögen, Folgen deiner Entscheidungen) und zeitlich begrenzte Ereignis-Quests; Fortschritt, Ziele, alternative Lösungswege und Belohnungen sichtbar |
| **Level & Fähigkeiten** | Charakterlevel je Spielfigur mit XP-Balken; Fähigkeitspunkte für Charisma, Medienkompetenz, Verhandlung und Strategie mit konkreten Spielwirkungen je Stufe |
| **Feed** (Welt) | Statusleiste deiner Figur (Ansehen, Einfluss, Follower, Funken, offene Entscheidungen), Stories **nur dieser Welt**, Beiträge als deine Figur; Likes, Kommentare, Reposts, Lesezeichen; Filter nach Figur und Thema |
| **Aufgaben** | Charakterlevel, hervorgehobene Hauptquest, Entscheidungen mit offen angezeigten Auswirkungen (inkl. fähigkeitsabhängiger Optionen und Weg zum Ende eines Handlungsbogens), Nebenquests, Ereignis-Quests, abgeschlossene Quests, Verlauf, Tagesquests und Meilensteine |
| **Chats** (Welt) | Gespräche deiner Figur mit Figuren derselben Welt; Dialogoptionen (Smalltalk, Kompliment, persönliches Gespräch, Verhandeln, Kooperation, Fürsprache) mit Zuneigungsanzeige; eigene Verläufe und Erinnerung je Spielfigur; „Was wird gesendet?“ |
| **Aktivität** | Mitteilungen, Weltgeschehen und deine Entscheidungen |
| **Profil** | Deine aktive Figur mit Zielen und Werten, alle Spielfiguren mit Spielverlauf („Wieder spielen“), lokales Profil, Beiträge, Lesezeichen, Erfolge |
| **Weitere Bereiche** | Charaktere, Suche, Shop (Rahmen, Banner, Premium-Ereigniskarten gegen Spielwährung – kein Echtgeld), Weltanpassung, Welten (Generator, Beziehungen, Gruppen, Storylines, Ereigniskarten), Fortschritt, Einstellungen, Datenschutz |
| **Welten & Figuren** | 12 vorgefertigte, frei erfundene Welten (u. a. Regierungsviertel, Spotlight Boulevard, Trendwelle, Unicorn Valley, FC Hafenstadt, Late Night Live, Analog 2026) mit 44 Figuren, Zielen, Beziehungen und Geschichten mit je drei möglichen Enden; eigene Welten und Figuren |
| **Einstellungen** | Sprache (Deutsch/Englisch), OpenRouter-Schlüssel, Modellwahl mit Fallbacks, Token-/Anfrage-/Kostenlimits, Verbindungstest, Verbrauchsprotokoll, Simulationssteuerung, Erinnerungsoptionen, Datenexport und vollständiges Löschen |

**Lebendige Welten:** Solange SocialVerse läuft, vergeht in regelmäßigen Abständen in einer Welt nach der anderen
ein Tag (abschaltbar, begrenzt); die Welt, in der du gerade spielst, ist dabei jeden zweiten Schritt an der Reihe.
Figuren freunden sich an, streiten, versöhnen sich, posten darüber und reagieren auf deine Beiträge. Alles läuft
standardmäßig **lokal, deterministisch und kostenlos**. KI-Aktivität in den Welten ist optional, begrenzt und
standardmäßig ausgeschaltet.

### So funktioniert das Spiel

1. **Welt wählen:** Auf der Startseite siehst du Vorschauen. Feed, Stories, Chats, Quests und Ereignisse einer Welt
   öffnen sich erst nach dem Beitritt – und zeigen dann nur Inhalte dieser Welt.
2. **Figur wählen:** eigene Figur erstellen oder eine Figur der Welt übernehmen. Pro Welt spielst du genau eine
   Figur; ein Wechsel pausiert die bisherige Figur – Beiträge, Chats, Entscheidungen und Werte bleiben gespeichert,
   und du kannst im Profil jederzeit zurückwechseln.
3. **Mitspielen:** Beim Beitritt wartet die erste Entscheidung. Weitere entstehen beim Simulieren (Bitten,
   Streitfälle, Gelegenheiten) und an Wendepunkten der Geschichten. Jede Option zeigt vorher, was sie bewirkt
   (Ansehen, Einfluss, Follower, Weltzustand, Beziehungen, Fortschritt der Geschichte). Die Auswirkungen werden
   gespeichert, erzeugen ein Ereignis und Reaktionen der Figuren.
4. **Belohnungen:** XP, Level und Erfolge wie bisher; dazu **Funken** (Spielwährung) für Entscheidungen, Quests,
   Level-Aufstiege und Erfolge. Funken lassen sich nur im Spiel verdienen und nur für kosmetische Artikel und
   Premium-Ereigniskarten ausgeben. Es gibt keine Echtgeld-Käufe.
5. **Gespielte Figuren** handeln nicht autonom: Die Simulation lässt sie weder posten noch an Ereignissen teilnehmen –
   das übernimmst du.
6. **Rolle und Ziel:** Aus Rolle bzw. Beruf und Weltkategorie ergibt sich ein Archetyp (z. B. Politik, Star, Gründung,
   Creator, Presse). Er bestimmt, welche Fähigkeiten „zur Rolle passen“ (1 statt 2 Punkte pro Stufe). Das Hauptziel
   (Reichweite, Unterstützung, Kooperationen, Beziehungen, Rivalitäten lösen, politischer Einfluss) bestimmt die
   Hauptquest; bekannte Figuren bringen ein passendes Ziel mit.
7. **Quests:** Beiträge, Kommentare, Stories, Chats, Dialogoptionen, Kooperationen, Reaktionen auf Ereignisse und
   Entscheidungen bringen Quests voran. Gemessen wird aus den gespeicherten Daten seit Questbeginn; jede Quest wird
   genau einmal abgeschlossen und belohnt (XP, Funken, Werte). Nebenquests entstehen aus der Lage der Welt:
   Rivalitäten, angespannte Beziehungen, laufende Handlungsbögen, Folgen deiner Entscheidungen. Ereignis-Quests laufen
   nach zwei Welttagen ab.
8. **Level und Fähigkeiten:** Pro Charakterlevel und pro abgeschlossener Hauptquest-Stufe gibt es einen
   Fähigkeitspunkt (je Welt und Figur getrennt). Stufe 2 und 3 einer Fähigkeit erfordern Charakterlevel 3 bzw. 5.

   | Fähigkeit | Stufe 1 | Stufe 2 | Stufe 3 |
   | --- | --- | --- | --- |
   | **Charisma** | Dialogoption „Kompliment“ (+6 Zuneigung, täglich), Charme-Optionen in Entscheidungen; Chats/Kommentare stärken Beziehungen stärker (+1 je Stufe) | „Persönliches Gespräch“ (+8, verrät Ziele der Figur) | „Um Fürsprache bitten“ ab Zuneigung 40 (+100 Follower, +4 Ansehen); alternative Questwege |
   | **Medienkompetenz** | +10 Follower pro Beitrag je Stufe und eine Reaktion mehr; „Öffentlich reagieren“ auf Ereignisse; Option „Medienkampagne“ | Beitrag als „Statement“ (einmal täglich, +3 Einfluss, mehr Reaktionen); Option „Klug Stellung beziehen“ | Stories bringen +20 Follower; alternativer Weg der Reichweiten-Hauptquest |
   | **Verhandlung** | Dialogoption „Verhandeln“ bei angespannten Beziehungen; Optionen „Fairer Deal“ und „Kompromiss“ | Kooperationen ab Zuneigung 20 statt 50; Option „Alle Seiten an einen Tisch“ (zählt doppelt für ein diplomatisches Ende) | Stärkeres „Verhandeln“; alternativer Weg der Einfluss-Hauptquest |
   | **Strategie** | Optionen „Vorbereitet eingreifen“ und „Den perfekten Zeitpunkt abwarten“ | Vorschau der Ergebnisse vor jeder Entscheidung; Prognose des Endes eines Handlungsbogens | Entscheidungen zählen doppelt für das Ende eines Handlungsbogens |

9. **Handlungsbögen:** Jede Geschichte hat drei mögliche Enden (mutig, diplomatisch, neutral). Deine Entscheidungen
   in dieser Geschichte verschieben das Ergebnis; am Ende entsteht ein Ereignis, und alle Beteiligten erhalten einmalig
   eine Belohnung.
10. **Reale öffentliche Personen:** Vorgefertigte Figuren sind frei erfunden. Eine Simulation einer realen
    öffentlichen Person kannst du selbst anlegen; sie wird dauerhaft als „Fiktive KI-Simulation“ gekennzeichnet,
    erfordert eine Bestätigung, soll sich nur auf öffentlich bekannte Informationen stützen und ist vor negativen
    Ereignissen geschützt. Private Absichten werden nicht als Tatsachen dargestellt.
11. **Simulierte Aktivität:** Angaben wie „Beiträge in 24 h“ oder Ereignisse stammen aus der lokalen Simulation und
    sind keine Live-Daten.

![Feed einer Welt mit Statusleiste der Spielfigur und Stories dieser Welt](docs/screenshots/feed.jpg)

![Aufgaben: Charakterlevel, Hauptquest und Entscheidungen mit fähigkeitsabhängigen Optionen](docs/screenshots/aufgaben.jpg)

![Fähigkeiten mit konkreten Auswirkungen je Stufe](docs/screenshots/faehigkeiten.jpg)

![Mobile Startseite mit Kategorien, Weltkarten und unterer Navigation](docs/screenshots/mobil.jpg)

---

## Voraussetzungen

| Was | Details |
| --- | --- |
| **Betriebssystem** | Windows 11 (getestet wurde unter Linux; siehe [Einschränkungen](#bekannte-einschränkungen)), macOS oder Linux |
| **Node.js** | **Version 22.13 oder neuer**, empfohlen: aktuelle **LTS-Version** (z. B. 24.x) von <https://nodejs.org>. SocialVerse nutzt die in Node.js eingebaute SQLite-Datenbank – es muss **nichts kompiliert** werden (kein Python, keine Visual-Studio-Build-Tools). |
| **Internet** | Nur für die einmalige Installation der Abhängigkeiten (`npm install`) und – optional – für die KI-Anbindung. |
| **Speicher** | ca. 400 MB für Abhängigkeiten, die Datenbank bleibt klein (wenige MB). |
| **Kosten** | Keine. Die KI-Anbindung ist optional; OpenRouter bietet auch kostenlose Modelle an. |

Prüfen, ob Node.js installiert ist: Eingabeaufforderung öffnen (Windows-Taste, `cmd` eingeben) und `node -v` ausführen.

---

## Schnellstart unter Windows 11

1. **Node.js installieren:** Auf <https://nodejs.org> die **LTS-Version** herunterladen und mit den Standardeinstellungen installieren.
2. **Projekt herunterladen:** Auf GitHub „Code“ → „Download ZIP“ wählen und die ZIP-Datei entpacken – oder per Git: `git clone <Repository-URL>`.
3. **Starten:** Im Projektordner auf **`start.bat`** doppelklicken.

`start.bat` erledigt automatisch:

- prüft, ob Node.js installiert ist und die Version passt,
- installiert beim ersten Start (oder nach einem Update) die Abhängigkeiten mit `npm install` (dauert einige Minuten),
- legt eine `.env` aus `.env.example` an – **eine vorhandene `.env` wird nie überschrieben**,
- baut die Anwendung und startet sie,
- öffnet den Browser unter **<http://127.0.0.1:3001>**.

Das schwarze Fenster muss geöffnet bleiben, solange du SocialVerse nutzt. **Beenden:** `Strg + C` im Fenster
oder das Fenster schließen. Deine Daten bleiben in `data/socialverse.db` erhalten.

> **Windows-Sicherheitswarnung:** Beim ersten Doppelklick kann Windows SmartScreen warnen („Der Computer wurde
> durch Windows geschützt“). Über „Weitere Informationen“ → „Trotzdem ausführen“ startest du die Datei. Du kannst
> `start.bat` vorher mit einem Texteditor öffnen und prüfen – sie enthält nur die oben beschriebenen Schritte.

Beim ersten Öffnen führt ein kurzes **Onboarding** durch Sprache, Namen und die Erklärung des Demo-Modus.

---

## Entwicklungsmodus mit Hot Reload

Für Änderungen am Code: **`dev.bat`** doppelklicken (oder `npm run dev`).

- Frontend (Vite, Hot Reload): <http://127.0.0.1:5173>
- Backend (Neustart bei Änderungen): <http://127.0.0.1:3001>

Das Frontend leitet `/api`-Anfragen automatisch an das Backend weiter.

---

## Start unter macOS/Linux und alle Befehle

```bash
npm install          # Abhängigkeiten installieren (einmalig / nach Updates)
cp .env.example .env # optional, Konfiguration anlegen
npm run build        # Frontend und Backend bauen
npm start            # Produktionsstart: http://localhost:3001
```

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsmodus mit Hot Reload (Frontend :5173, Backend :3001) |
| `npm run build` | Produktionsbuild nach `dist/` (Frontend + Backend) |
| `npm start` | Startet den Produktionsbuild (liefert auch das Frontend aus) |
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run test:e2e` | Baut die App und führt Ende-zu-Ende-Tests im Browser aus (Playwright) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript-Prüfung (Server, Client, E2E) |
| `npm run check` | Typprüfung, Lint, Tests und Build in einem Schritt |

Für die Ende-zu-Ende-Tests wird einmalig ein Browser benötigt: `npx playwright install chromium`.

---

## KI einrichten (optional, OpenRouter)

Ohne Einrichtung läuft SocialVerse im **Demo-Modus**: Chat-Antworten, Reaktionen und Weltereignisse werden lokal
erzeugt und sind als „Demo“ bzw. „Simulation“ gekennzeichnet. Für echte KI-Gespräche:

1. Konto auf <https://openrouter.ai> anlegen und unter **Keys** einen API-Schlüssel erstellen.
2. In SocialVerse **Einstellungen → KI & Modelle** öffnen und den Schlüssel eintragen
   – oder in der Datei `.env` setzen: `OPENROUTER_API_KEY=sk-or-...` (hat Vorrang; danach neu starten).
3. **Modell wählen:** „Modell wählen“ lädt die aktuelle Modellliste live von OpenRouter (mit Preisen und
   Kontextlänge). Mit dem Filter „Nur kostenlose“ findest du Modelle ohne Kosten. Modell-IDs lassen sich auch
   manuell eingeben. Optional: separates Modell für Weltaktivität/Generator und bis zu 3 Fallback-Modelle.
4. **Verbindung testen.** Ohne gewähltes Modell wird nur der Schlüssel geprüft (kostenlos).

### Kosten und Limits

| Einstellung | Standard | Wirkung |
| --- | --- | --- |
| Max. Tokens pro Antwort | 400 | Begrenzt Länge und Kosten jeder Antwort (Weltgenerator: max. 1500) |
| KI-Anfragen pro Tag | 100 | Danach wird automatisch der Demo-Modus verwendet |
| Tagesbudget / Monatsbudget | 0,50 $ / 5 $ | Anfragen werden vorab geschätzt und blockiert, wenn das Budget überschritten würde. **Budget 0 = nur Modelle mit nachweislich Preis 0** |
| KI für Weltaktivität | aus | Wenn an: max. 2 KI-Aufrufe pro Simulationsschritt |
| KI für Reaktionen | aus | Wenn an: ein KI-Kommentar pro Beitrag/Antwort |
| KI-Aufrufe Welt & Reaktionen pro Tag | 20 | Gemeinsames Tageslimit für automatische KI-Aktivität |
| KI-Zusammenfassungen | an | Nur wenn ein Modell aktiv ist; sonst lokale Stichwort-Zusammenfassung |

Kosten werden aus den Angaben von OpenRouter übernommen. Fehlen sie, werden sie anhand der Preisliste
geschätzt und als „geschätzt“ markiert. Das **Verbrauchsprotokoll** in den Einstellungen zeigt jede Anfrage
mit Zweck, Modell, Tokens, Kosten und Status. Preise und Verfügbarkeit von Modellen ändern sich – SocialVerse
verlässt sich nicht auf fest eingebaute Modelle oder Preise.

**Fehlerbehandlung:** Zeitüberschreitungen, Ratenlimits, nicht verfügbare Modelle und ungültige Antworten werden
abgefangen; Fallback-Modelle werden der Reihe nach versucht. Schlägt alles fehl, antwortet der Charakter im
Demo-Modus und die App zeigt den Grund an (z. B. „Schlüssel ungültig“, „Guthaben aufgebraucht“).

---

## Konfiguration (.env)

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `3001` | Port des Servers (im Produktionsstart auch die Adresse der App) |
| `HOST` | `127.0.0.1` | Netzwerkadresse. `127.0.0.1` = nur auf diesem Computer erreichbar (empfohlen) |
| `DATA_DIR` | `./data` | Ordner der SQLite-Datenbank |
| `OPENROUTER_API_KEY` | leer | Optionaler API-Schlüssel (Vorrang vor dem in der App gespeicherten) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Nur für Tests/Sonderfälle ändern |
| `ALLOWED_HOSTS` | leer | Zusätzliche erlaubte Hostnamen (kommagetrennt), z. B. für Zugriff im Heimnetz zusammen mit `HOST=0.0.0.0` – **nicht empfohlen**, da es keine Anmeldung gibt |

Die Datei `.env` ist in `.gitignore` eingetragen und wird nie in Git gespeichert.

---

## Daten, Export, Backup und Löschen

- **Speicherort:** `data/socialverse.db` (SQLite). Beim ersten Start wird die Datenbank angelegt, migriert und mit
  Demo-Inhalten gefüllt. Spätere Schema-Änderungen werden über versionierte Migrationen eingespielt.
- **Update einer bestehenden Installation:** Beim ersten Start nach dem Update wird die Datenbank automatisch
  migriert. Eigene Beiträge, Charaktere, Welten, Fortschritt und Chats bleiben erhalten; neue vorgefertigte Welten
  werden ergänzt (eine Welt wird übersprungen, falls ein eigener Charakter bereits denselben Handle nutzt). Bisherige
  Chats übernimmt die erste Spielfigur, mit der du der jeweiligen Welt beitrittst. Vorsichtshalber vorher `data/`
  sichern.
- **Export:** Einstellungen → Datenschutz & Daten → **Daten exportieren** lädt alle lokalen Daten als JSON herunter
  (ohne API-Schlüssel).
- **Backup:** SocialVerse beenden und den Ordner `data/` kopieren.
- **Alles löschen:** Einstellungen → Datenschutz & Daten → `RESET` eingeben → **Endgültig löschen**. Gelöscht
  werden Beiträge, Kommentare, Chats, Erinnerungen, Fortschritt, eigene Welten und Charaktere, Nutzungsprotokoll,
  Einstellungen und der lokal gespeicherte Schlüssel; die Datenbankdatei wird anschließend verdichtet (`VACUUM`).
  Danach werden die Demo-Inhalte neu angelegt. Ein Schlüssel in `.env` bleibt bestehen (Datei selbst bearbeiten).
- **Komplett zurücksetzen:** SocialVerse beenden und den Ordner `data/` löschen.

---

## Sicherheit und Datenschutz

- **Lokal:** Der Server lauscht standardmäßig nur auf `127.0.0.1`.
- **API-Schutz:** Schreibende Anfragen benötigen einen eigenen Header und eine erlaubte Herkunft (Schutz vor CSRF);
  unbekannte Hostnamen werden abgelehnt (Schutz vor DNS-Rebinding). Teure Endpunkte sind zusätzlich ratenbegrenzt.
- **Eingaben:** Alle Eingaben werden serverseitig mit Schemas (zod) geprüft und in der Länge begrenzt.
- **Ausgabe:** Nutzer- und KI-Texte werden ausschließlich als Text dargestellt, nie als HTML (Schutz vor XSS).
  Zusätzlich gilt eine strenge Content-Security-Policy.
- **API-Schlüssel:** Wird nur im Backend verwendet, nie an den Browser zurückgegeben (nur maskiert angezeigt) und nie
  protokolliert. Ein in der App eingegebener Schlüssel liegt **unverschlüsselt** in der lokalen Datenbank – wer
  Zugriff auf deinen Computer hat, kann ihn lesen. Alternativ `.env` verwenden.
- **Was wird an OpenRouter gesendet?** Nur bei aktivierter KI: Charakterprofil, Weltbeschreibung, gemerkte Fakten,
  Zusammenfassung, die letzten *N* Chatnachrichten sowie Rolle, Hintergrund und Ziele deiner Spielfigur (ihr Name nur,
  wenn „Namen an die KI senden“ eingeschaltet ist). Im Chat zeigt
  **„Was wird gesendet?“** die exakte nächste Anfrage. Details: Seite **Datenschutz** in der App.
- **Keine Tracking-Dienste**, keine externen Schriften oder Bilder – alles wird lokal ausgeliefert.
- **Fiktion:** Alle vorgefertigten Welten und Figuren sind frei erfunden (auch in den realitätsnahen Kategorien wie
  Politik oder Promis) und als KI-Charaktere gekennzeichnet. Reale Persönlichkeiten können nur als eigene Figur mit
  der Kennzeichnung „Fiktive KI-Simulation“ angelegt werden; ihr Systemprompt verbietet, sich als die echte Person
  auszugeben oder erfundene Zitate als echt darzustellen. Solche Figuren werden zusätzlich nicht in negative
  Ereignisse (Konflikt, Gerücht, Rivalität, Rückschlag) verwickelt – weder automatisch noch per Ereigniskarte.

---

## Tests und Qualitätsprüfung

```bash
npm run check        # Typprüfung + Lint + Unit-/Integrationstests + Build
npm run test:e2e     # Ende-zu-Ende-Tests im Browser (Chromium)
```

- **Unit-/Integrationstests (Vitest):** Beitritt mit eigener und bekannter Figur, Figurenwechsel ohne Datenverlust,
  weltgebundene Stories/Beiträge/Chats, Entscheidungen (einmalig, dauerhaft, Storyverlauf), Weltaufgaben, Shop und
  Funken, Schutz von Real-Person-Simulationen, Migration bestehender Datenbanken (Chats → Gespräche) und das
  Ergänzen neuer Welten, Suche; außerdem XP/Level/Quests (inkl. Schutz vor Mehrfachbelohnung), Simulation und
  Ereigniskarten (inkl. Determinismus), Chats und Erinnerung, Demo-Antworten, KI-Anbindung mit simuliertem
  OpenRouter (Fallbacks, Limits, Budget, Kostenschätzung, Zeitüberschreitung), API-Endpunkte (CSRF/Host-Schutz,
  Schlüssel nie im Frontend, Beitrags-Lebenszyklus, Export/Löschen), Übersetzungsvollständigkeit, XSS-sichere Darstellung;
  außerdem Quests passend zu Rolle und Hauptziel, Neben- und Ereignis-Quests (inkl. Ablauf), einmalige
  Quest- und Bogenbelohnungen, Charakterlevel und Fähigkeitspunkte, Wirkung jeder Fähigkeit (Reichweite,
  Dialogoptionen, Kooperationsschwelle, gesperrte/freigeschaltete Entscheidungsoptionen, Prognose, alternative
  Questwege, doppelte Gewichtung), Enden von Handlungsbögen, Persistenz nach Neustart und Trennung zwischen Welten
  sowie Sperre weltinterner Inhalte ohne Beitritt.
- **Ende-zu-Ende (Playwright):** Startseite/Weltauswahl (Kategorien, Weltkarten, Navigation vor dem Beitritt,
  keine weltinternen Inhalte), Quests/Level/Fähigkeiten (Hauptquest, gesperrte Optionen, Fähigkeit steigern,
  Dialogoption mit Wirkung, Persistenz), Weltvorschau und Beitritt, eigene und bekannte Figur,
  weltgebundene Stories/Feed/Chats, Entscheidung mit Neuladen, Welt- und Figurenwechsel, Navigation (Desktop und
  mobil, ohne horizontales Scrollen), Onboarding, Beiträge (erstellen, liken, merken, bearbeiten, kommentieren),
  Filter, Demo-Chat mit Erinnerung, Weltsimulation, Ereigniskarten, Beziehungen, Storylines, Charakter- und
  Weltgenerator, Quests, Sprachwechsel, Schlüsselschutz, mobile Ansicht, vollständiges Löschen sowie der KI-Pfad
  gegen einen lokalen OpenRouter-Nachbau (`e2e/mock-openrouter.mjs`).
- **Barrierefreiheit:** Während der Entwicklung wurden alle Seiten (Desktop und Mobil) mit axe-core auf WCAG 2 A/AA
  geprüft; gefundene Probleme wurden behoben. Diese Prüfung ist nicht Teil der automatischen Testsuite.

---

## Fehlerbehebung

| Problem | Lösung |
| --- | --- |
| „Node.js wurde nicht gefunden“ | Node.js LTS von <https://nodejs.org> installieren, Fenster schließen und `start.bat` erneut starten. |
| „Node.js … ist zu alt“ | Neuere LTS-Version installieren (mindestens 22.13). |
| `npm install` schlägt fehl | Internetverbindung/Proxy prüfen, `node_modules` löschen und erneut starten. |
| „Port 3001 ist bereits belegt“ | Läuft SocialVerse schon (anderes Fenster)? Sonst in `.env` z. B. `PORT=3005` setzen. |
| Browser zeigt „Server nicht erreichbar“ | Das schwarze Fenster wurde geschlossen oder der Start ist fehlgeschlagen – Meldungen im Fenster lesen. |
| Browser öffnet sich nicht automatisch | Manuell <http://127.0.0.1:3001> aufrufen. |
| KI antwortet nicht, Hinweis „KI nicht verfügbar“ | In Einstellungen → KI & Modelle „Verbindung testen“; Grund und Protokoll beachten (Schlüssel, Guthaben, Limit, Modell). |
| Inhalte in falscher Sprache | Demo-Inhalte entstehen in der Sprache des ersten Starts. Einstellungen → Allgemein → „Demo-Inhalte … neu laden“ (löscht alle Daten). |

---

## Bekannte Einschränkungen

- **Windows-Start nicht auf Windows getestet:** `start.bat` und `dev.bat` wurden sorgfältig geschrieben, die
  Entwicklung und alle Tests liefen jedoch unter Linux. Die übrige Anwendung ist plattformunabhängig.
- **Keine echte KI-Anfrage verifiziert:** In der Entwicklungsumgebung war OpenRouter nicht erreichbar. Der komplette
  KI-Pfad ist gegen einen originalgetreuen lokalen Nachbau der API getestet; die Anbindung an den echten Dienst sollte
  einmal mit „Verbindung testen“ geprüft werden.
- **Einzelplatz:** Ein lokales Profil, keine Benutzerkonten, keine Synchronisation zwischen Geräten.
- **Layout nach Beschreibung:** Die Oberfläche (Startseite, Navigation, Feed, Chats, Statusanzeigen) wurde nach der
  textlichen Vorgabe gestaltet; die Referenz-Screenshots (Status AI) lagen nicht vor. Abweichungen im Detail sind daher möglich.
- **Entscheidungen und Quests aus Vorlagen:** Entscheidungen, Quests, Enden von Handlungsbögen und ihre Auswirkungen
  entstehen aus festen, zweisprachigen Vorlagen und Regeln (nachvollziehbar und kostenlos), nicht frei per KI.
- **Keine vorgefertigten realen Personen:** Aktuelle Ämter und Aussagen realer Personen lassen sich lokal nicht
  zuverlässig prüfen. Deshalb sind alle mitgelieferten Figuren erfunden; Simulationen realer Personen legst du selbst
  an (gekennzeichnet, mit Bestätigung).
- **Demo-Modus:** Lokale Antworten folgen Regeln und Vorlagen – sie sind bewusst einfach und ersetzen keine KI.
- **Inhaltssprache:** Bereits vorhandene Inhalte werden beim Sprachwechsel nicht übersetzt.
- **Import:** Ein Datenexport ist möglich, ein Import (Wiederherstellen aus JSON) noch nicht – Backups über den Ordner `data/`.
- **`node:sqlite`** ist in Node.js als „experimentell“ markiert (stabil nutzbar; die Warnung wird unterdrückt).
- Kein eigenständiger HTML-Prototyp mit `localStorage`: Er hätte die Anwendung doppelt implementiert; die App selbst
  ist ohne Konto und ohne KI sofort lokal nutzbar.
