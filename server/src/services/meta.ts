import type { Lang } from '../../../shared/constants';
import type { AppContext } from '../context';
import { get } from '../db/database';

export function contentLanguage(ctx: AppContext): Lang {
  const value = get<{ value: string }>(ctx.db, `SELECT value FROM meta WHERE key = 'content_language'`)?.value;
  return value === 'en' ? 'en' : 'de';
}

/** True, sobald der Nutzer eigene Inhalte erstellt oder Fortschritt gesammelt hat. */
export function hasUserActivity(ctx: AppContext): boolean {
  return Boolean(
    get(ctx.db, `SELECT 1 FROM activity_log LIMIT 1`) ||
      get(ctx.db, `SELECT 1 FROM players LIMIT 1`) ||
      get(ctx.db, `SELECT 1 FROM posts WHERE author_type = 'user' LIMIT 1`) ||
      get(ctx.db, `SELECT 1 FROM conversation_messages LIMIT 1`),
  );
}
