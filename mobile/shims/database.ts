/** Browser-Ersatz für den Datenbankzugriff: Die Handy-Version speichert im Browser, nicht in SQLite. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
export const run = (): { changes: number; lastInsertRowid: number } => ({ changes: 0, lastInsertRowid: 0 });
export const get = (): undefined => undefined;
export const all = (): never[] => [];
export const tx = <T,>(_db: unknown, fn: () => T): T => fn();
