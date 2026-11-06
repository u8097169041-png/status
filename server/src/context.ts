import type { DB } from './db/database';
import type { AppConfig } from './config';
import type { AiService } from './ai/aiService';
import type { ImageService } from './images/imageService';

/** Gemeinsamer Kontext für alle Services: Datenbank, Konfiguration, Uhr, Text-KI und Bild-KI. */
export interface AppContext {
  db: DB;
  config: AppConfig;
  now: () => Date;
  ai: AiService;
  images: ImageService;
}
