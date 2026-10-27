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
                                                                       │             │ nur bei aktivierter KI
                                                          node:sqlite  ▼             ▼
                                                      data/socialverse.db     OpenRouter (HTTPS)
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
  ai/             openrouter.ts (HTTP-Client), aiService.ts (Limits, Fallbacks, Protokoll), prompts.ts
  content/        zweisprachige Beispieldaten und Vorlagen (Simulation, Reaktionen, Demo-Chat, Generator)
  db/             database.ts (Zugriff, Transaktionen), migrations.ts, seed.ts
  lib/            Fehler, IDs, Zufall (deterministisch), Text, Zeit
  routes/         dünne HTTP-Schicht je Bereich
  services/       Geschäftslogik (Posts, Charaktere, Chats, Welten, Simulation, Fortschritt, …)
  test/           Vitest-Tests und Test-Hilfen (In-Memory-DB, simulierter OpenRouter)
  index.ts        Einstieg (unterdrückt die SQLite-Experimentalwarnung, lädt main.ts)
  main.ts         Konfiguration, Datenbank, App, Scheduler, Serverstart
shared/           Typen (DTOs), Konstanten/Grenzwerte, XP/Quests/Erfolge/Belohnungen, Beziehungsstatus
e2e/              Playwright-Tests und lokaler OpenRouter-Nachbau
scripts/          Server-Build, E2E-Serverstart, Startprüfung für die .bat-Dateien
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
| `worlds`, `characters`, `relationships`, `groups`, `group_members`, `storylines`, `world_events` | Welten und ihre Gesellschaft; Metriken Harmonie/Spannung/Entdeckung direkt in `worlds` |
| `posts`, `post_tags`, `comments`, `user_likes`, `character_likes`, `bookmarks`, `stories`, `story_views` | Social-Media-Inhalte |
| `chats`, `chat_messages`, `chat_memories` | Chatverläufe, gemerkte Fakten und Zusammenfassung |
| `activity_log`, `xp_events`, `quest_claims`, `achievements`, `encounters`, `world_visits` | Fortschritt |
| `ai_usage`, `simulation_log`, `scheduled_jobs`, `notifications`, `settings`, `secrets`, `meta` | Betrieb |

## Fortschritt ohne Mehrfachbelohnung

- `activity_log` hat einen eindeutigen Schlüssel `(action, ref, day)` – dieselbe Aktion am selben Ziel zählt pro Tag
  nur einmal für Quests.
- `xp_events.key` ist eindeutig (z. B. `like:<postId>`) – XP für dasselbe Ziel gibt es nur einmal überhaupt
  (Like → Unlike → Like bringt keine weiteren XP).
- Jede Aktion hat ein Tageslimit (`shared/progress.ts`).
- Quests werden über `quest_claims (quest_id, period)` genau einmal eingelöst (Tagesquests pro Tag, Meilensteine einmalig).

## Weltsimulation

Ein Simulationsschritt („ein Tag vergeht“) für eine Welt:

1. Zufallsgenerator mit Seed `weltId:tickNummer` – gleicher Ausgangszustand ⇒ gleiches Ergebnis.
2. 1 bis *maxEventsPerTick* Ereignisse werden aus Vorlagen gewählt. Die Gewichtung hängt von den Weltmetriken ab
   (hohe Spannung ⇒ mehr Konflikte). Manche Vorlagen setzen bestehende Rivalitäten voraus (Eskalation, Versöhnung).
   Dasselbe Paar wird pro Schritt höchstens einmal gewählt.
3. Wirkungen werden gespeichert: Metriken, Zuneigung (−100…100), ggf. Wechsel der Beziehungsart
   (Freundschaft ⇄ Rivalität), Stimmungen der Beteiligten.
4. Beteiligte posten über das Ereignis, andere kommentieren oder liken.
5. Aktive Storylines schreiten mit einer Wahrscheinlichkeit fort (höher, wenn ein Ereignis zum Thema passt);
   das letzte Kapitel schließt sie ab. Gibt es keine aktive Storyline mehr, kann eine neue entstehen.
6. Metriken kehren langsam zur Mitte zurück, damit Welten nicht in Extremen verharren.

**Ereigniskarten** (vom Nutzer ausgelöst) nutzen dieselben Mechanismen, wirken gezielt auf gewählte Charaktere und
treiben passende Storylines gezielt voran.

**Automatik:** `services/scheduler.ts` prüft alle 30 Sekunden, ob ein automatischer Schritt fällig ist
(Intervall, Tageslimit, abschaltbar) und wählt die Welt, in der am längsten nichts passiert ist. Ein Sperrmechanismus
verhindert parallele Simulationen derselben Welt.

**KI-Beteiligung (optional):** Ist „KI für Weltaktivität“ aktiv, formuliert das Modell höchstens 2 Beiträge pro
Schritt neu; das Tageslimit gilt zusätzlich. Ohne KI bleiben die Vorlagentexte.

**Reaktionen auf Nutzerinhalte:** Nach einem eigenen Beitrag bzw. Kommentar wird ein verzögerter Auftrag in
`scheduled_jobs` angelegt (8–35 Sekunden). Passende Charaktere (gleiche Welt, Erwähnung, Interessen) liken und
kommentieren; der Nutzer erhält eine Mitteilung.

## Chat-Erinnerung

Statt den gesamten Verlauf zu senden, besteht der Kontext aus:

1. **Systemprompt** mit Charakterprofil, Schreibstil, Regeln, Beziehungen, Welt und jüngsten Ereignissen.
2. **Gemerkte Fakten** (`chat_memories`, Art `fact`): automatisch per Regeln erkannt („Ich heiße …“, „Ich mag …“,
   „Merk dir: …“) oder manuell hinzugefügt; höchstens 40 pro Chat, einsehbar und löschbar.
3. **Zusammenfassung** (Art `summary`): Sobald 8 Nachrichten aus dem Fenster gefallen sind, wird sie aktualisiert –
   per KI (falls aktiv und erlaubt) oder lokal als Liste früherer Themen.
4. **Nachrichtenfenster:** die letzten *N* Nachrichten (Standard 12, pro Chat einstellbar 4–30).

„Was wird gesendet?“ zeigt diesen Kontext exakt so, wie er an das Modell ginge.

## KI-Anbindung

- `OpenRouterClient` spricht die OpenAI-kompatible Chat-Completions-API an (Zeitlimit per `AbortController`),
  klassifiziert Fehler (401, 402, 403, 404, 408, 429, 5xx, ungültige/leere Antworten) und entfernt schlüsselähnliche
  Zeichenketten aus Fehlermeldungen.
- `AiService` prüft vor jedem Aufruf Tageslimit, Weltaktivitätslimit sowie Tages-/Monatsbudget anhand einer
  Worst-Case-Schätzung (Prompt-Länge + maximale Ausgabetokens × Preis), probiert Fallback-Modelle bei
  wiederholbaren Fehlern und protokolliert jeden Versuch in `ai_usage`.
- Preise stammen aus der öffentlichen Modellliste (1 Stunde zwischengespeichert, bei Fehlern 5 Minuten Pause).
- Der Schlüssel kommt aus `OPENROUTER_API_KEY` oder der Tabelle `secrets`; er wird nie ausgeliefert oder protokolliert.

## Frontend

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
