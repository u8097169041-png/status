import type { ActivityDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all } from '../db/database';
import { listDecisions } from './decisions';
import { listNotifications } from './notifications';
import { activeWorldId } from './players';
import { toEvent } from './worlds';

/** Aktivitäten der aktiven Welt: Mitteilungen, Ereignisse und getroffene Entscheidungen. */
export function getActivity(ctx: AppContext, worldId?: string | null): ActivityDto {
  const world = worldId ?? activeWorldId(ctx);
  const notifications = listNotifications(ctx, 60).filter((n) => !world || !n.worldId || n.worldId === world);
  if (!world) return { notifications, events: [], decisions: [] };
  const events = all<Parameters<typeof toEvent>[0]>(
    ctx.db,
    'SELECT * FROM world_events WHERE world_id = ? ORDER BY created_at DESC, id DESC LIMIT 30',
    world,
  ).map(toEvent);
  return {
    notifications,
    events,
    decisions: listDecisions(ctx, { worldId: world, status: 'resolved', limit: 20 }),
  };
}
