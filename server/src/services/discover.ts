import type { DiscoverDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all } from '../db/database';
import { listCharacters } from './characters';
import { toStoryline } from './society';
import { listWorlds, recentEventsAll } from './worlds';

/**
 * Entdecken zeigt nur Vorschauen: Welten, bekannte Figuren, Szenarien und Ereignisse.
 * Stories und Feeds gibt es erst nach dem Beitritt – und dann nur für die jeweilige Welt.
 */
export function getDiscover(ctx: AppContext): DiscoverDto {
  const worlds = listWorlds(ctx);
  const featuredWorld =
    [...worlds].filter((w) => !w.joined).sort((a, b) => (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? ''))[0] ??
    worlds[0] ??
    null;
  const figures = listCharacters(ctx, { prominent: true })
    .filter((c) => !c.isPlayer)
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
    .slice(0, 16);
  const scenarios = all<Parameters<typeof toStoryline>[0] & { world_name: string; world_hue: number }>(
    ctx.db,
    `SELECT s.*, w.name AS world_name, w.hue AS world_hue FROM storylines s JOIN worlds w ON w.id = s.world_id
      WHERE s.status = 'active' ORDER BY s.updated_at DESC LIMIT 8`,
  ).map((r) => ({ ...toStoryline(r), worldName: r.world_name, worldHue: r.world_hue }));
  return {
    featuredWorld,
    worlds,
    figures,
    scenarios,
    recentEvents: recentEventsAll(ctx, 8),
  };
}
