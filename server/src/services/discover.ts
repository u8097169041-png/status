import type { DiscoverDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all } from '../db/database';
import { listCharacters } from './characters';
import { toStoryline } from './society';
import { listWorlds } from './worlds';

/**
 * Entdecken zeigt nur Weltauswahl: Welten, beliebte Welten, bekannte Figuren und Handlungsbögen.
 * Stories, Beiträge, Quests und weltinterne Ereignisse gibt es erst nach dem Beitritt – und nur für die jeweilige Welt.
 */
export function getDiscover(ctx: AppContext): DiscoverDto {
  const worlds = listWorlds(ctx);
  const featuredWorld =
    [...worlds].filter((w) => !w.joined).sort((a, b) => b.postsToday - a.postsToday || (b.lastEventAt ?? '').localeCompare(a.lastEventAt ?? ''))[0] ??
    worlds[0] ??
    null;
  const popular = [...worlds]
    .filter((w) => !w.isCustom)
    .sort((a, b) => b.postsToday - a.postsToday || b.characterCount - a.characterCount || a.name.localeCompare(b.name))
    .slice(0, 8);
  const figures = listCharacters(ctx, { prominent: true })
    .filter((c) => !c.isPlayer)
    .sort((a, b) => b.postCount - a.postCount || a.name.localeCompare(b.name))
    .slice(0, 16);
  const joined = new Set(worlds.filter((w) => w.joined).map((w) => w.id));
  const scenarios = all<Parameters<typeof toStoryline>[0] & { world_name: string; world_hue: number }>(
    ctx.db,
    `SELECT s.*, w.name AS world_name, w.hue AS world_hue FROM storylines s JOIN worlds w ON w.id = s.world_id
      ORDER BY s.status = 'resolved', s.updated_at DESC LIMIT 10`,
  ).map((r) => ({ ...toStoryline(r), worldName: r.world_name, worldHue: r.world_hue, worldJoined: joined.has(r.world_id) }));
  return { featuredWorld, worlds, popular, figures, scenarios };
}
