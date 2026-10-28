import { LIMITS } from '../../../shared/constants';
import type { SearchResultDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all } from '../db/database';
import { badRequest } from '../lib/errors';
import { cleanText } from '../lib/text';
import { listCharacters } from './characters';
import { activeWorldId } from './players';
import { getPost } from './posts';
import { listWorlds } from './worlds';

/** Maskiert Platzhalter, damit Eingaben wie „%“ wörtlich gesucht werden. */
function likePattern(query: string): string {
  return `%${query.toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/**
 * Durchsucht Welten und Figuren überall, Beiträge aber nur in der aktiven Welt
 * (Feeds sind erst nach dem Beitritt sichtbar).
 */
export function search(ctx: AppContext, raw: string): SearchResultDto {
  const query = cleanText(raw ?? '');
  if (query.length > LIMITS.searchQuery) throw badRequest('invalid_query', 'Der Suchbegriff ist zu lang.');
  if (query.length < 2) return { query, worlds: [], characters: [], posts: [] };
  const needle = query.toLowerCase();
  const worlds = listWorlds(ctx)
    .filter((w) => `${w.name} ${w.tagline}`.toLowerCase().includes(needle))
    .slice(0, 8);
  const characters = listCharacters(ctx)
    .filter((c) => !c.isPlayer && `${c.name} ${c.handle} ${c.tagline} ${c.role}`.toLowerCase().includes(needle))
    .slice(0, 12);
  const worldId = activeWorldId(ctx);
  const posts = worldId
    ? all<{ id: string }>(
        ctx.db,
        `SELECT p.id FROM posts p WHERE p.world_id = ? AND LOWER(p.content) LIKE ? ESCAPE '\\'
          ORDER BY p.created_at DESC LIMIT 15`,
        worldId,
        likePattern(query),
      ).map((r) => getPost(ctx, r.id))
    : [];
  return { query, worlds, characters, posts };
}
