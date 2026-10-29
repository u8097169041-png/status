# SocialVerse – Architektur

Dieses Dokument beschreibt Aufbau, Datenmodell und die wichtigsten Mechanismen für Entwicklerinnen und Entwickler.

## Überblick

```
┌──────────────────────────┐      /api (JSON, CSRF-Header)      ┌───────────────────────────────┐
│  Frontend (client/)      │  ───────────────────────────────▶  │  Backend (server/)            │
│  React 19 + Vite 7       │                                    │  Express 5 + TypeScript       │
│  React Router, TanStack  │  ◀───────────────────────────────  │  Services (Geschäftslogik)    │
│  Query, eigenes CSS      │                                    │  Scheduler (Simulation/Jobs)  │
└──────────────────────────┘                                    └──────┬─────────────┬──────────┘
                                                                       │             │ KI-Router
                                                          node:sqlite  ▼             ├─▶ lokale KI: Ollama (127.0.0.1:11434)
                                                      data/socialverse.db            ├─▶ Server-KI (HTTPS, nur mit Freigabe)
                                                                                     └─▶ simulierte KI (regelbasiert)
```

- **Ein npm-Projekt** mit drei Quellordnern: `client/` (Oberfläche), `server/` (API, Logik, Daten, KI) und
  `shared/` (gemeinsame Typen, Grenzwerte, Fortschrittsdefinitionen).
- **Entwicklung:** `tsx watch` (Backend) und Vite (Frontend, Proxy auf `/api`).
- **Produktion:** Vite baut nach `dist/client`, esbuild bündelt das Backend nach `dist/server/index.js`; das Backend
  liefert das Frontend als Single-Page-App aus.

## Ordnerstruktur

```
client/src/
  api/            fetch-Wrapper (CSRF-Header, Fehlerklasse) und React-Query-Hooks
  components/     Layout, UI-Bausteine, Feed, Welten, Charaktere, Fortschritt
  i18n/           de.ts (Referenz), en.ts, Provider mit typgeprüften Schlüsseln
  pages/          eine Datei pro Route
  styles/         tokens.css (Designsystem), base, components, layout, pages
server/src/
  ai/             aiService.ts (Router: Auswahl, Limits, Protokoll), providers.ts (lokal/Server/simuliert),
                  ollamaClient.ts, openaiClient.ts, structured.ts (validierte Ergebnisse), prompts.ts, types.ts
  content/        zweisprachige Beispieldaten und Vorlagen (Simulation, Reaktionen, Demo-Chat, Generator)
  db/             database.ts (Zugriff, Transaktionen), migrations.ts, seed.ts
  lib/            Fehler, IDs, Zufall (deterministisch), Text, Zeit
  routes/         dünne HTTP-Schicht je Bereich
  services/       Geschäftslogik (Posts, Charaktere, Chats, Welten, Simulation, Fortschritt, …)
  test/           Vitest-Tests und Test-Hilfen (In-Memory-DB, simulierte Ollama- und Server-KI)
  index.ts        Einstieg (unterdrückt die SQLite-Experimentalwarnung, lädt main.ts)
  main.ts         Konfiguration, Datenbank, App, Scheduler, Serverstart
shared/           Typen (DTOs), Konstanten/Grenzwerte, XP/Quests/Erfolge/Belohnungen, Beziehungsstatus
e2e/              Playwright-Tests sowie lokale Nachbauten von Ollama und einem OpenAI-kompatiblen KI-Server
scripts/          Server-Build, E2E-Serverstart, Startprüfung, KI-Prüfung (ai-check.mjs) für die .bat-Dateien
```

## Schichten

| Schicht | Aufgabe | Beispiel |
| --- | --- | --- |
| Routes | HTTP: Parameter lesen, Service aufrufen, Statuscode setzen | `routes/feed.ts` |
| Services | Validierung (zod), Regeln, Transaktionen, Fortschritt | `services/posts.ts` |
| Datenzugriff | Vorbereitete Statements, Transaktionen mit Savepoints | `db/database.ts` |
| KI | Anbieterzugriff, Limits, Kosten, Fallbacks | `ai/aiService.ts` |

Alle Services erhalten einen `AppContext` (`db`, `config`, `now()`, `ai`). Die Uhr ist injizierbar, damit Tests
Tageswechsel, Stories und Quests zuverlässig prüfen können.

## Datenbank

- **Technik:** `node:sqlite` (in Node.js eingebaut, keine nativen Abhängigkeiten), WAL-Modus, Fremdschlüssel aktiv.
- **Migrationen:** `db/migrations.ts` enthält versionierte SQL-Schritte; `schema_migrations` merkt sich angewendete
  Versionen. Neue Änderungen werden immer als neue Version angehängt.
- **Initialisierung:** Beim ersten Start legt `seedIfEmpty` Profil, Einstellungen und zweisprachige Demo-Inhalte an.

Wichtige Tabellen:

| Tabelle | Inhalt |
| --- | --- |
| `worlds`, `characters`, `relationships`, `groups`, `group_members`, `storylines`, `world_events` | Welten und ihre Gesellschaft; Metriken Harmonie/Spannung/Entdeckung direkt in `worlds`; `storylines.endings`, `path_scores`, `ending_id` für die Enden von Handlungsbögen |
| `posts`, `post_tags`, `comments`, `user_likes`, `character_likes`, `bookmarks`, `stories`, `story_views` | Social-Media-Inhalte |
| `players` | Spielfiguren: Welt, Figur, Modus (eigene/bekannte Figur), Werte (Ansehen, Einfluss, Follower, XP), Archetyp und Hauptziel, aktiv/pausiert |
| `player_skills`, `quests`, `action_uses` | Fähigkeitsstufen je Spielfigur; Quests je Spielfigur (`UNIQUE(player_id, dedupe_key)`); einmalige bzw. tägliche Nutzung von Spielaktionen (`(player_id, action, ref, day)`, `day` = Datum oder `once`) |
| `decisions` | Entscheidungen einer Spielfigur mit gespeicherten Optionen und Auswirkungen, Wahl, Ergebnis und Ereignis |
| `conversations`, `conversation_messages`, `conversation_memories` | Gespräche je (Spielfigur, Figur), gemerkte Fakten und Zusammenfassung |
| `wallet_ledger`, `purchases` | Spielwährung („Funken“) als Buchungsjournal mit eindeutigen Schlüsseln; freigeschaltete Shop-Artikel |
| `activity_log`, `xp_events`, `quest_claims`, `achievements`, `encounters`, `world_visits` | Fortschritt (Weltaufgaben nutzen `quest_claims` mit der Spielfigur als Zeitraum) |
| `ai_usage`, `simulation_log`, `scheduled_jobs`, `notifications`, `settings`, `secrets`, `meta` | Betrieb |

## Spielfiguren und aktive Welt

- **Eine aktive Figur pro Welt:** ein eindeutiger Teilindex `players(world_id) WHERE is_active = 1` erzwingt das in
  der Datenbank. Ein Wechsel (`confirmSwitch`) pausiert die bisherige Figur (`retired_at`) – ihre Beiträge,
  Kommentare, Stories, Gespräche, Entscheidungen und Werte bleiben mit `player_id` verknüpft. Wird eine früher
  gespielte bekannte Figur erneut gewählt, wird ihr alter Spielstand fortgesetzt.
- **Aktive Welt:** `user_profile.active_world_id`; gültig nur, solange dort eine aktive Figur existiert.
- **Weltbindung:** Beiträge, Kommentare und Stories in einer Welt verlangen eine aktive Figur (sonst `409 not_joined`)
  und werden als diese Figur angezeigt. Stories und Gespräche werden nur für die eigene Welt geliefert.
- **Sichtbarkeit vor dem Beitritt:** `GET /api/discover` liefert nur Weltkarten (inkl. Top-Figuren und simulierter
  Aktivität), beliebte Welten, Handlungsbögen und Figuren – keine Stories, Beiträge, Quests oder Ereignisse.
  `listPosts` blendet Beiträge aus Welten ohne Beitritt aus (außer eigenen und gemerkten); Beitragsdetail und
  `GET /api/worlds/:id/events` antworten mit `409 not_joined`; `GET /api/worlds/:id` liefert dann keine Ereignisse.
- **Gesteuerte Figuren:** eigene Spielfiguren (`characters.is_player = 1`) und aktuell gespielte bekannte Figuren
  werden von Simulation, Reaktionen und Ereigniskarten nicht automatisch bewegt.
- **Chats:** Ein Gespräch gehört zu (Spielfigur, Figur). Gespräche aus Version 1 (ohne Spielfigur) übernimmt die erste
  Spielfigur, die der Welt beitritt. Der Systemprompt beschreibt die Spielfigur (Rolle, Hintergrund, Ziele; Name nur
  mit Erlaubnis).

## Entscheidungen

- **Entstehung:** Einstiegsentscheidung beim Beitritt; während der Simulation mit einer Wahrscheinlichkeit
  (Bitte einer Figur, Streit zweier Figuren – bevorzugt mit tatsächlicher Rivalität –, Gelegenheit) und an Wendepunkten
  laufender Geschichten. Höchstens 3 offene Entscheidungen je Figur.
- **Vorlagen:** `content/decisionTemplates.ts` (zweisprachig). Beim Anlegen werden konkrete Figuren, Texte und
  Auswirkungen festgeschrieben und gespeichert – die Oberfläche zeigt sie vor der Wahl an.
- **Wahl (`POST /api/decisions/:id/choose`):** genau einmal (`409 already_decided`), nur für die aktive Figur. In einer
  Transaktion: Spielwerte anpassen, Weltmetriken ändern, Zuneigung zwischen Spielfigur und Figuren ändern (inkl.
  Beziehungsart), ggf. Geschichte um ein Kapitel voranbringen, Ereignis `decision` schreiben, öffentliche Reaktion
  einer beteiligten Figur posten. Danach XP (`decide`) und Funken (Schlüssel `decision:<id>`).

## Rollen, Quests, Level und Fähigkeiten

- **Rolle:** `shared/skills.ts` leitet aus Rolle/Beruf und Weltkategorie einen Archetyp ab (`archetypeFor`). Er legt
  die beiden Kernfähigkeiten (1 Punkt je Stufe, sonst 2) und das vorgeschlagene Hauptziel fest. Bekannte Figuren haben
  ein festes Hauptziel (`CHARACTER_GOAL_TYPES`). Archetyp und Ziel werden beim Beitritt bzw. bei alten Spielständen
  beim ersten Zugriff gespeichert (`ensureRole`).
- **Level:** Das Charakterlevel ergibt sich aus `players.xp` (dieselbe Kurve wie das Profillevel). Fähigkeitspunkte =
  Charakterlevel + abgeschlossene Hauptquest-Stufen − ausgegebene Punkte. Stufe 1/2/3 erfordert Charakterlevel 1/3/5.
- **Fähigkeitswirkungen** sind zentral in `SKILL_RULES`/`CHAT_ACTION_RULES` definiert und werden serverseitig geprüft
  (`requireSkill` → `403 skill_required`): Reichweite von Beiträgen und Stories, Statement-Beiträge, Reaktion auf
  Ereignisse, Dialogoptionen im Chat (`services/chatActions.ts`), Kooperationsschwelle, gesperrte
  Entscheidungsoptionen (`requires`), Ergebnisvorschau und Bogenprognose (Strategie 2), doppelte Gewichtung für
  Enden (Strategie 3) sowie alternative Questwege.
- **Quests (`services/quests.ts`, Vorlagen in `content/questTemplates.ts`):** Hauptquest-Kette mit drei Stufen je
  Hauptziel, Nebenquests aus der Lage der Welt (Vorstellung, Rivalität, Versöhnung nach einer Entscheidung, Bitte,
  Kooperation, Handlungsbogen, Kontakte, Aufmerksamkeit) und Ereignis-Quests, die nach zwei Welttagen ablaufen.
  Jede Quest hat einen oder mehrere Wege mit Zielen; Kennzahlen werden aus gespeicherten Daten seit `created_at`
  gemessen. `recordAction` ruft nach jeder Spielaktion `evaluateQuests` auf. Abschluss per
  `UPDATE … WHERE status = 'active'` und Belohnungen mit eindeutigen Schlüsseln – jede Quest zahlt genau einmal.
  Folgen von Entscheidungen erhalten einen Vorrangplatz (Nebenquest-Limit + 1).
- **Handlungsbögen (`services/arcs.ts`):** Jede Geschichte hat drei Enden (`bold`, `diplomatic`, `neutral`;
  Texte in `content/arcEndings.ts`). Entscheidungsoptionen tragen einen `arcPath`; die Wahl addiert Punkte in
  `path_scores`. Beim Abschluss bestimmt der führende Weg das Ende (Gleichstand oder keine Beteiligung → neutral),
  es entsteht ein Ereignis `storyline-ending`, und jede beteiligte Figur erhält einmalig XP und Funken
  (Schlüssel `arc:<storylineId>:<playerId>`).
- **Trennung:** Quests, Fähigkeiten, Level und Nutzungen hängen an `player_id` – also an Welt und Figur. Ein Wechsel
  von Welt oder Figur beeinflusst keine anderen Spielstände.

## Spielwährung und Shop

- Funken entstehen nur durch Spielen: Entscheidungen, Quests/Weltaufgaben, Level-Aufstiege, Erfolge. Jede Gutschrift
  hat einen eindeutigen Schlüssel in `wallet_ledger` – doppelte Gutschriften sind ausgeschlossen.
- Der Shop (`shared/economy.ts`) verkauft nur Kosmetik (Rahmen, Banner) und Premium-Ereigniskarten. Käufe sind
  Buchungen mit negativem Betrag; der Kontostand ist die Summe des Journals. Es gibt keine Echtgeld-Anbindung.

## Inhaltsaktualisierung bestehender Datenbanken

`meta.content_version` merkt sich den Stand der Beispielinhalte. Beim Start ergänzt `applyContentUpdates` fehlende
neue Welten samt Figuren, Beziehungen, Gruppen, Geschichten, Beiträgen und Stories sowie Ziele und „bekannt“-Markierung
der alten Figuren. Welten, deren Figuren-IDs oder Handles bereits belegt sind, werden übersprungen.
Inhaltsstand 3 ergänzt die Welt „Trendwelle“ und füllt die Enden bestehender Geschichten; Migration 3
(`quests-skills-arcs`) legt die neuen Spalten und Tabellen an. Bestehende Spielstände behalten XP und Werte;
Archetyp, Hauptziel und Quests werden beim ersten Zugriff ergänzt.
Inhaltsstand 4 ergänzt die Dating-Welt „Herzklopfen“ (`content/seedWorlds4.ts`) mit eigenen Enden
(`ARC_ENDINGS_V4`); Migration 5 (`world-cover-images`) ergänzt `worlds.cover_image`.

## Dating-Kategorie

- `dating` ist Genre und Weltkategorie (`shared/constants.ts`); passender Generator-Pool und Bildstil `romance`.
- Für Welten der Kategorie Dating wählt `services/decisions.ts` eigene Vorlagen (`content/datingDecisions.ts`):
  - Einstieg
  - Date-Einladung
  - Missverständnis
  - Eifersucht
  - Liebesdreieck
  - zweite Chance
  - Speed-Dating
  - Wendepunkte der Geschichten mit Weg zu einem Ende
- Zuneigungseffekte können eine Beziehungsart setzen (`becomes`, z. B. `romance` oder `friend`). Das geschieht erst ab
  einer Mindest-Zuneigung (`minAffinity`) und über die Spielregel in `chooseOption`, als eigenes Ereignis-Effekt
  `relationshipKind`.
- Quests, Level und Fähigkeiten laufen unverändert: Rollen ohne Stichwort erhalten den Archetyp „local“ mit
  Hauptziel „Beziehungen“.
- KI: Der Systemprompt verlangt respektvolle, nicht explizite Romantik mit erwachsenen Figuren. Der Weltgenerator
  bekommt dieselben Vorgaben für Dating.
- Ohne KI antworten Figuren aus Dating-Welten auf Liebes- und Beziehungsthemen mit eigenen regelbasierten Antworten
  (`ROMANCE_REPLIES`).

## Eigene Weltbilder

- **Client (`lib/images.ts`, `components/worlds/CoverPicker.tsx`):**
  - Prüft Typ (JPEG/PNG/WebP), Größe (≤ 15 MB) und Mindestmaße.
  - Verkleinert auf ≤ 1600 × 1000 px und kodiert neu: WebP, sonst JPEG. Das entfernt auch Metadaten.
  - Zeigt eine Vorschau als `blob:`-URL. Die CSP erlaubt dafür `img-src blob:`.
- **Speichern:** Erst zusammen mit der Welt (neu oder bearbeitet). Scheitert das Bild, bleibt die Welt erhalten.
- **Server (`services/covers.ts`):**
  - `PUT /api/worlds/:id/cover` nimmt Rohdaten an. Der Service prüft Content-Type, Dateisignatur (Magic Bytes),
    Größe (≤ 3 MB) und dass es sich um eine eigene Welt handelt.
  - Gespeichert wird atomar (temporäre Datei, dann Umbenennen) unter einem vom Server erzeugten Namen in
    `data/uploads/covers`. Danach wird `worlds.cover_image` gesetzt und die alte Datei gelöscht.
  - Speicherfehler, z. B. `ENOSPC`, ergeben `507 storage_failed`, und die Datenbank bleibt unverändert.
- **Ausliefern:** `GET /api/media/covers/:file`
  - liefert nur Namen, die zum Server-Muster passen (kein Pfad-Traversal);
  - mit `nosniff`, `default-src 'none'` und dauerhaftem Caching, weil sich der Name bei jedem neuen Bild ändert.
- **Aufräumen:** Dateien werden beim Ersetzen, Entfernen, Löschen der Welt und bei „Alle Daten löschen“ entfernt.
- **Anzeige:** `coverUrl` steht in `WorldSummary`, `WorldDetail` und den Fortschritts-Stempeln. `WorldArt` zeigt das
  Bild oder die generierte Grafik.

## Fortschritt ohne Mehrfachbelohnung

- `activity_log` hat einen eindeutigen Schlüssel `(action, ref, day)` – dieselbe Aktion am selben Ziel zählt pro Tag
  nur einmal für Quests.
- `xp_events.key` ist eindeutig (z. B. `like:<postId>`) – XP für dasselbe Ziel gibt es nur einmal überhaupt
  (Like → Unlike → Like bringt keine weiteren XP).
- Jede Aktion hat ein Tageslimit (`shared/progress.ts`).
- Quests werden über `quest_claims (quest_id, period)` genau einmal eingelöst (Tagesquests pro Tag, Meilensteine einmalig).

## Weltsimulation

Ein Simulationsschritt („ein Tag vergeht“) für eine Welt:

1. Zufallsgenerator mit Seed `weltId:tickNummer` – gleicher Ausgangszustand ⇒ gleiches Ergebnis. Beteiligt sind nur
   Figuren, die nicht vom Nutzer gesteuert werden. Negative Vorlagen (Konflikt, Gerücht, Rivalität, Rückschlag)
   schließen Simulationen realer Personen aus.
2. 1 bis *maxEventsPerTick* Ereignisse werden aus Vorlagen gewählt. Die Gewichtung hängt von den Weltmetriken ab
   (hohe Spannung ⇒ mehr Konflikte). Manche Vorlagen setzen bestehende Rivalitäten voraus (Eskalation, Versöhnung).
   Dasselbe Paar wird pro Schritt höchstens einmal gewählt.
3. Wirkungen werden gespeichert: Metriken, Zuneigung (−100…100), ggf. Wechsel der Beziehungsart
   (Freundschaft ⇄ Rivalität), Stimmungen der Beteiligten.
4. Beteiligte posten über das Ereignis, andere kommentieren oder liken.
5. Aktive Storylines schreiten mit einer Wahrscheinlichkeit fort (höher, wenn ein Ereignis zum Thema passt);
   das letzte Kapitel schließt sie ab. Gibt es keine aktive Storyline mehr, kann eine neue entstehen.
6. Metriken kehren langsam zur Mitte zurück, damit Welten nicht in Extremen verharren.
7. Hat der Nutzer in der Welt eine Figur, entsteht ggf. eine Entscheidung (siehe oben).

**Ereigniskarten** (vom Nutzer ausgelöst) nutzen dieselben Mechanismen, wirken gezielt auf gewählte Charaktere und
treiben passende Storylines gezielt voran.

**Automatik:** `services/scheduler.ts` prüft alle 30 Sekunden, ob ein automatischer Schritt fällig ist
(Intervall, Tageslimit, abschaltbar). Die aktive Welt ist jeden zweiten Schritt an der Reihe, sonst die Welt, in der
am längsten nichts passiert ist. Ein Sperrmechanismus
verhindert parallele Simulationen derselben Welt.

**KI-Beteiligung (optional):** Ist „KI für Weltaktivität“ aktiv, formuliert das Modell höchstens 2 Beiträge pro
Schritt neu; das Tageslimit gilt zusätzlich. Ohne KI bleiben die Vorlagentexte.

**Reaktionen auf Nutzerinhalte:** Nach einem eigenen Beitrag bzw. Kommentar wird ein verzögerter Auftrag in
`scheduled_jobs` angelegt (8–35 Sekunden). Passende Charaktere (gleiche Welt, Erwähnung, Interessen) liken und
kommentieren; der Nutzer erhält eine Mitteilung.

## Chat-Erinnerung

Statt den gesamten Verlauf zu senden, besteht der Kontext aus:

1. **Systemprompt** mit Charakterprofil, Schreibstil, Regeln, Beziehungen, Welt und jüngsten Ereignissen.
2. **Gemerkte Fakten** (`conversation_memories`, Art `fact`): automatisch per Regeln erkannt („Ich heiße …“, „Ich mag …“,
   „Merk dir: …“) oder manuell hinzugefügt; höchstens 40 pro Chat, einsehbar und löschbar.
3. **Zusammenfassung** (Art `summary`): Sobald 8 Nachrichten aus dem Fenster gefallen sind, wird sie aktualisiert –
   per KI (falls aktiv und erlaubt) oder lokal als Liste früherer Themen.
4. **Nachrichtenfenster:** die letzten *N* Nachrichten (Standard 12, pro Chat einstellbar 4–30).

„Was wird gesendet?“ zeigt diesen Kontext exakt so, wie er an das Modell ginge.

## KI-Anbindung (Hybrid)

Drei austauschbare Provider hinter einer gemeinsamen Schnittstelle (`ai/types.ts`, `AiProvider`):

| Provider | Klasse | Bereitschaft | Kosten |
| --- | --- | --- | --- |
| Lokal | `LocalProvider` → `OllamaClient` (`/api/version`, `/api/tags`, `/api/chat`) | Laufzeit erreichbar und ein Chat-Modell installiert (Einbettungsmodelle werden ausgefiltert) | keine |
| Server | `ServerProvider` → `OpenAiCompatibleClient` (`/chat/completions`) | `SERVER_AI_ENABLED`, Schlüssel und Modell in `.env` **und** `serverConsent` in den Einstellungen; keine Sperre; Limits nicht erreicht | laut Anbieter |
| Simuliert | `FallbackProvider` | immer | keine |

**Auswahl (`AiService.selection`):**

- Modus `auto`: lokal → Server nur mit Freigabe → simuliert.
- Modus `server`: Server → lokal (kostenlos) → simuliert.
- Modus `fallback`: nur simuliert, ohne jeden Netzwerkzugriff.

Jeder Aufruf fragt höchstens **einen** echten Provider **genau einmal** an. Bei einem Fehler liefert die vom
Aufrufer übergebene regelbasierte Ersatzfunktion (`fallback`) das Ergebnis, mit einem Hinweis auf den Grund.

**Verfügbarkeit:**

- Die lokale Laufzeit wird beim Start und danach höchstens alle 30 s (erreichbar) bzw. 15 s (nicht erreichbar) mit
  kurzen Zeitlimits geprüft.
- Nur nach Verbindungsfehlern wird sie bis zur nächsten Prüfung übersprungen. Eine Zeitüberschreitung bedeutet
  „langsam“, nicht „nicht erreichbar“: Sie erscheint als letzte Zeitüberschreitung in der Diagnose. Während einer
  laufenden Generierung entfällt die Prüfung, weil eine ausgelastete Laufzeit sonst fälschlich als fehlend gälte.
- **Streaming mit drei Zeitlimits** (`ollamaClient.ts`): bis zum ersten Token inklusive Laden des Modells
  (`LOCAL_AI_LOAD_TIMEOUT_MS`), die längste Pause zwischen Tokens (`LOCAL_AI_IDLE_TIMEOUT_MS`) und die Gesamtdauer.
  Die Gesamtdauer ist für Chats `LOCAL_AI_TIMEOUT_MS`, für lange Generierungen (`long: true`) `LOCAL_AI_LONG_TIMEOUT_MS`.
- Der Fortschritt in Tokens wird gemeldet, und ein `AbortSignal` bricht ab. Die gemessene Geschwindigkeit
  (`eval_count/eval_duration`) erscheint in der Diagnose.
- `format` ist ab Ollama 0.5 ein JSON-Schema, sonst `"json"`. `num_ctx` ist 4096. `done_reason = "length"` wird als
  `truncated` gemeldet.
- **Weltentwurf als Hintergrundauftrag** (`services/generationJobs.ts`):
  - `POST /api/worlds/generate-jobs` startet (es läuft höchstens ein Auftrag), `GET …/:id` liefert Fortschritt und
    Ergebnis, `DELETE …/:id` bricht ab.
  - Ohne verfügbare KI ist der Auftrag sofort fertig: regelbasierter Entwurf, Grund in `notice`.
  - Aufträge liegen nur im Arbeitsspeicher und verfallen nach 30 Minuten.
  - Das Schema des Entwurfs begrenzt alle Feldlängen. Das Token-Limit richtet sich nach der Zahl der Figuren.
- Ein Slot begrenzt sie auf eine Anfrage gleichzeitig. Chats warten darauf, Hintergrundaufgaben (Welt, Reaktionen,
  Zusammenfassungen) verzichten bei Belegung auf KI.

**Server-Schutz:**

- Vor jedem Aufruf prüft der Router Tages- und Minutenlimit, das Weltaktivitätslimit und das Tages- und
  Monatsbudget. Es gilt jeweils das Minimum aus Einstellung und `.env`.
- Die Kosten werden als Worst Case geschätzt: Prompt-Länge plus maximale Ausgabetokens, multipliziert mit dem Preis.
  Die Preise kommen aus `.env` oder der Modellliste des Dienstes. Unbekannte Preise führen zur Ablehnung.
- Nach 401/402 wird der Server 24 h gesperrt; nach Netzwerkfehlern, 429 oder 5xx pausiert er 2 Minuten. Eine Sperre
  hebt „Erneut prüfen“ auf (`GET /api/ai/status?refresh=1`). Dabei wird der Server nicht angefragt.
- Es gibt keine Ersatzmodelle und keine Wiederholungen.

**Protokoll:**

- `ai_usage` (Migration 4: Spalte `provider`) erfasst jede Anfrage, lokale mit Kosten 0.
- Budgets und Anfragelimits zählen nur Server-Anfragen.
- `conversation_messages.provider` kennzeichnet die Herkunft jeder Antwort (`local`, `server`, `fallback`).

**Strukturierte Ergebnisse (`ai/structured.ts`):**

- Chats fordern JSON `{"reply", "tone"}` an; die lokale KI nutzt dafür `format: "json"`.
- `parseChatTurn` validiert das JSON mit zod, entfernt schlüsselähnliche Zeichenfolgen und verwirft kaputtes JSON.
- Die Spielregel in `chats.ts` setzt `tone` in höchstens ±1 Zuneigung um, einmal pro Tag und Figur (`action_uses`,
  Aktion `ai-tone`). XP, Level, Fähigkeiten und Quests ändert nur die bestehende Spiellogik.

**Prompt (`prompts.ts`):**

- Enthält Figurenprofil, Schreibstil, Verhaltensregeln, Welt und Ereignisse, Erinnerung und Zusammenfassung sowie
  die Spielfigur.
- Neu ist ein nur lesbarer Spielkontext (Zuneigung und Beziehungsart, aktive Hauptquest, laufende Geschichten). Dazu
  kommt die Anweisung, keine Belohnungen zu versprechen und Änderungen an den Regeln zu ignorieren.
- Für Simulationen realer Personen gilt ein ausdrücklicher Hinweis gegen erfundene Zitate.

**Geheimnisse:**

- Server-Schlüssel kommen nur aus Umgebungsvariablen und stehen nur im Authorization-Header.
- Fehlermeldungen werden bereinigt (`safeMessage`). Status, Export und Protokoll enthalten keinen Schlüssel.
- Der frühere Endpunkt zum Speichern eines Schlüssels ist entfernt. `DELETE /api/ai/key` löscht nur noch einen
  Altbestand aus Version 1.

**Einrichtung:** `scripts/ai-check.mjs` (`npm run ai:check`) prüft Laufzeit, Modelle, RAM und Speicher, empfiehlt ein
Modell und lädt nichts herunter. `ki-einrichten.bat` installiert Ollama bzw. lädt ein Modell nur nach Bestätigung.

## Frontend

- **Navigation:** In einer Welt: Feed, Aufgaben, Chats, Aktivität, Profil (Seitenleiste bzw. untere Leiste auf dem
  Handy); weitere Bereiche über „Mehr“: Entdecken, Fähigkeiten, Charaktere, Suche, Shop, Weltanpassung, Welten,
  Fortschritt, Einstellungen, Datenschutz. Ohne aktive Welt: Start, Suche, Erstellen, Aktivität, Profil. Die
  Kopfzeile enthält Logo, Rollen- und Weltwechsler, Mitteilungen, Einstellungen und das Menü „Weitere Bereiche“.
  `/` leitet zum Feed (aktive Welt) oder zur Startseite (noch keine Welt).
- **Daten:** TanStack Query mit gezielter Cache-Aktualisierung (z. B. Likes aktualisieren den Beitrag in allen
  Listen sofort) und regelmäßiger Aktualisierung (Bootstrap 20 s, Feed 30 s), damit Reaktionen sichtbar werden.
- **Designsystem:** CSS-Variablen in `tokens.css` (Farben, Abstände, Radien, Typografie); Akzentfarbe per
  Belohnung austauschbar (`data-accent`). Schriften werden lokal über `@fontsource` ausgeliefert.
- **Grafiken:** Welt- und Avatarbilder entstehen prozedural als SVG (deterministisch je Seed) – keine externen Bilder.
- **Barrierefreiheit:** semantische Landmarken, Skip-Link, Tastaturbedienung (Tabs mit Pfeiltasten, Menüs,
  Fokusfalle in Dialogen), `aria`-Attribute, ausreichende Kontraste, `prefers-reduced-motion`.
- **i18n:** `de.ts` ist die Referenz; `en.ts` muss dieselben Schlüssel haben (TypeScript + Test prüfen das).

## Sicherheit (Backend)

- Sicherheits-Header inkl. Content-Security-Policy, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- Host-Prüfung (DNS-Rebinding), CSRF-Schutz über Pflicht-Header `X-SocialVerse: 1` und Origin-Prüfung.
- JSON-Körper auf 200 kB begrenzt, alle Eingaben per zod validiert und längenbegrenzt.
- Ratenbegrenzung für Chat, Generator, Simulation, Ereignisse und Verbindungstest.
