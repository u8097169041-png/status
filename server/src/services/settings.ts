import { z } from 'zod';
import { LIMITS, LANGUAGES, type Lang } from '../../../shared/constants';
import type { AppSettings } from '../../../shared/types';
import { get, run, type DB } from '../db/database';
import { badRequest } from '../lib/errors';

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'de',
  ai: {
    enabled: true,
    chatModel: '',
    worldModel: '',
    fallbackModels: [],
    maxTokens: 400,
    temperature: 0.8,
    timeoutSeconds: 30,
    dailyRequestLimit: 100,
    dailyBudgetUsd: 0.5,
    monthlyBudgetUsd: 5,
    worldActivityEnabled: false,
    worldDailyLimit: 20,
    reactionsEnabled: false,
    summariesEnabled: true,
  },
  simulation: {
    autoEnabled: true,
    intervalMinutes: 15,
    maxEventsPerTick: 2,
    maxAutoTicksPerDay: 24,
    reactionsEnabled: true,
  },
  memory: {
    defaultWindow: 12,
    autoFacts: true,
  },
  privacy: {
    sendDisplayName: true,
  },
};

const modelId = z
  .string()
  .trim()
  .max(LIMITS.modelId)
  .regex(/^$|^[A-Za-z0-9._:/@-]+$/, 'Ungültige Modell-ID');

export const settingsPatchSchema = z
  .object({
    language: z.enum(LANGUAGES),
    ai: z
      .object({
        enabled: z.boolean(),
        chatModel: modelId,
        worldModel: modelId,
        fallbackModels: z.array(modelId.min(1)).max(LIMITS.fallbackModels),
        maxTokens: z.number().int().min(50).max(4000),
        temperature: z.number().min(0).max(2),
        timeoutSeconds: z.number().int().min(5).max(120),
        dailyRequestLimit: z.number().int().min(0).max(10_000),
        dailyBudgetUsd: z.number().min(0).max(1000),
        monthlyBudgetUsd: z.number().min(0).max(10_000),
        worldActivityEnabled: z.boolean(),
        worldDailyLimit: z.number().int().min(0).max(1000),
        reactionsEnabled: z.boolean(),
        summariesEnabled: z.boolean(),
      })
      .partial()
      .strict(),
    simulation: z
      .object({
        autoEnabled: z.boolean(),
        intervalMinutes: z.number().int().min(1).max(24 * 60),
        maxEventsPerTick: z.number().int().min(1).max(5),
        maxAutoTicksPerDay: z.number().int().min(0).max(500),
        reactionsEnabled: z.boolean(),
      })
      .partial()
      .strict(),
    memory: z
      .object({
        defaultWindow: z.number().int().min(LIMITS.memoryWindowMin).max(LIMITS.memoryWindowMax),
        autoFacts: z.boolean(),
      })
      .partial()
      .strict(),
    privacy: z.object({ sendDisplayName: z.boolean() }).partial().strict(),
  })
  .partial()
  .strict();

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export function getSettings(db: DB): AppSettings {
  const row = get<{ value: string }>(db, `SELECT value FROM settings WHERE key = 'app'`);
  let stored: Partial<AppSettings> = {};
  if (row) {
    try {
      stored = JSON.parse(row.value) as Partial<AppSettings>;
    } catch {
      stored = {};
    }
  }
  return {
    language: LANGUAGES.includes(stored.language as Lang) ? (stored.language as Lang) : DEFAULT_SETTINGS.language,
    ai: { ...DEFAULT_SETTINGS.ai, ...stored.ai },
    simulation: { ...DEFAULT_SETTINGS.simulation, ...stored.simulation },
    memory: { ...DEFAULT_SETTINGS.memory, ...stored.memory },
    privacy: { ...DEFAULT_SETTINGS.privacy, ...stored.privacy },
  };
}

export function saveSettings(db: DB, settings: AppSettings): void {
  run(
    db,
    `INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    JSON.stringify(settings),
  );
}

export function updateSettings(db: DB, input: unknown): AppSettings {
  const parsed = settingsPatchSchema.safeParse(input);
  if (!parsed.success) throw badRequest('invalid_settings', 'Ungültige Einstellungen.', parsed.error.issues);
  const patch = parsed.data;
  const current = getSettings(db);
  const next: AppSettings = {
    language: patch.language ?? current.language,
    ai: { ...current.ai, ...patch.ai },
    simulation: { ...current.simulation, ...patch.simulation },
    memory: { ...current.memory, ...patch.memory },
    privacy: { ...current.privacy, ...patch.privacy },
  };
  next.ai.fallbackModels = [...new Set(next.ai.fallbackModels.filter(Boolean))];
  saveSettings(db, next);
  return next;
}

export function getLanguage(db: DB): Lang {
  return getSettings(db).language;
}

// ---- Geheimnisse (lokal gespeicherter API-Schlüssel) ----

export function getSecret(db: DB, key: string): string | null {
  return get<{ value: string }>(db, 'SELECT value FROM secrets WHERE key = ?', key)?.value ?? null;
}

export function setSecret(db: DB, key: string, value: string, now: Date): void {
  run(
    db,
    `INSERT INTO secrets (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    now.toISOString(),
  );
}

export function deleteSecret(db: DB, key: string): void {
  run(db, 'DELETE FROM secrets WHERE key = ?', key);
}
