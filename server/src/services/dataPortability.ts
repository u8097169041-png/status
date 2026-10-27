import { z } from 'zod';
import { LANGUAGES } from '../../../shared/constants';
import type { AppContext } from '../context';
import { all, schemaVersion } from '../db/database';
import { DATA_TABLES, seedDatabase, wipeAllData } from '../db/seed';
import { badRequest } from '../lib/errors';
import { getSettings } from './settings';

/** Tabellen, die nie exportiert werden (lokal gespeicherter API-Schlüssel). */
const EXCLUDED_FROM_EXPORT = new Set(['secrets']);

export function exportData(ctx: AppContext): Record<string, unknown> {
  const tables: Record<string, unknown[]> = {};
  for (const table of DATA_TABLES) {
    if (EXCLUDED_FROM_EXPORT.has(table)) continue;
    tables[table] = all<Record<string, unknown>>(ctx.db, `SELECT * FROM ${table}`).map((row) => ({ ...row }));
  }
  return {
    app: 'SocialVerse',
    version: ctx.config.version,
    schemaVersion: schemaVersion(ctx.db),
    exportedAt: ctx.now().toISOString(),
    note: 'Lokaler Datenexport. Ein lokal gespeicherter API-Schlüssel ist nicht enthalten.',
    tables,
  };
}

const resetSchema = z.object({
  confirm: z.literal('RESET'),
  language: z.enum(LANGUAGES).optional(),
});

/**
 * Löscht alle lokalen Daten (inklusive lokal gespeichertem API-Schlüssel, Chats, Fortschritt und Nutzungsprotokoll)
 * und legt anschließend die Demo-Inhalte neu an.
 */
export function resetAllData(ctx: AppContext, input: unknown): void {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) throw badRequest('confirmation_required', 'Bitte bestätige das Löschen mit „RESET“.');
  const language = parsed.data.language ?? getSettings(ctx.db).language;
  wipeAllData(ctx.db);
  // Gelöschte Inhalte auch physisch aus der Datenbankdatei entfernen.
  ctx.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  ctx.db.exec('VACUUM;');
  seedDatabase(ctx.db, ctx.now(), language);
}
