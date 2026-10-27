import type { DB } from './db/database';
import type { AppConfig } from './config';
import type { AiService } from './ai/aiService';

/** Gemeinsamer Kontext für alle Services: Datenbank, Konfiguration, Uhr und KI-Anbindung. */
export interface AppContext {
  db: DB;
  config: AppConfig;
  now: () => Date;
  ai: AiService;
}
