import type { DiscoverDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all } from '../db/database';
import { addHours } from '../lib/time';
import { listCharacters } from './characters';
import { getPost, trendingTags } from './posts';
import { toStoryline } from './society';
import { listWorlds, recentEventsAll } from './worlds';

export function getDiscover(ctx: AppContext): DiscoverDto {
  const worlds = listWorlds(ctx);
  const featuredWorld =
    [...worlds].sort((a, b) => (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? ''))[0] ?? null;
  const characters = listCharacters(ctx)
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
    .slice(0, 12);
  const storylines = all<Parameters<typeof toStoryline>[0] & { world_name: string; world_hue: number }>(
    ctx.db,
    `SELECT s.*, w.name AS world_name, w.hue AS world_hue FROM storylines s JOIN worlds w ON w.id = s.world_id
      WHERE s.status = 'active' ORDER BY s.updated_at DESC LIMIT 6`,
  ).map((r) => ({ ...toStoryline(r), worldName: r.world_name, worldHue: r.world_hue }));
  const highlightIds = all<{ id: string }>(
    ctx.db,
    `SELECT p.id FROM posts p
      WHERE p.created_at >= ? AND p.repost_of IS NULL
      ORDER BY (SELECT COUNT(*) FROM character_likes cl WHERE cl.post_id = p.id)
             + (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) DESC, p.created_at DESC
      LIMIT 3`,
    addHours(ctx.now(), -72).toISOString(),
  );
  return {
    featuredWorld,
    worlds,
    characters,
    trendingTags: trendingTags(ctx, 10),
    storylines,
    recentEvents: recentEventsAll(ctx, 6),
    highlightPosts: highlightIds.map((r) => getPost(ctx, r.id)),
  };
}
