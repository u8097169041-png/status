import type { NotificationDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, parseJson, run } from '../db/database';
import { newId } from '../lib/ids';

const MAX_NOTIFICATIONS = 200;

export function notify(
  ctx: AppContext,
  kind: string,
  params: Record<string, string | number> = {},
  link: string | null = null,
): void {
  run(
    ctx.db,
    `INSERT INTO notifications (id, kind, params, link, read, created_at) VALUES (?, ?, ?, ?, 0, ?)`,
    newId('n'),
    kind,
    JSON.stringify(params),
    link,
    ctx.now().toISOString(),
  );
  run(
    ctx.db,
    `DELETE FROM notifications WHERE id NOT IN (SELECT id FROM notifications ORDER BY created_at DESC LIMIT ?)`,
    MAX_NOTIFICATIONS,
  );
}

export function listNotifications(ctx: AppContext, limit = 50): NotificationDto[] {
  return all<{ id: string; kind: string; params: string; link: string | null; read: number; created_at: string }>(
    ctx.db,
    `SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`,
    limit,
  ).map((n) => ({
    id: n.id,
    kind: n.kind,
    params: parseJson(n.params, {}),
    link: n.link,
    read: Boolean(n.read),
    createdAt: n.created_at,
  }));
}

export function unreadCount(ctx: AppContext): number {
  return get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM notifications WHERE read = 0`)?.n ?? 0;
}

export function markAllRead(ctx: AppContext): void {
  run(ctx.db, `UPDATE notifications SET read = 1 WHERE read = 0`);
}
