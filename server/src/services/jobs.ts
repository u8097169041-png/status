import type { AppContext } from '../context';
import { all, run } from '../db/database';
import { newId } from '../lib/ids';
import { addMinutes } from '../lib/time';

export type JobKind = 'reactToPost' | 'replyToComment';

export function scheduleJob(ctx: AppContext, kind: JobKind, payload: Record<string, string>, delaySeconds: number): void {
  run(
    ctx.db,
    `INSERT INTO scheduled_jobs (id, kind, payload, due_at, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`,
    newId('job'),
    kind,
    JSON.stringify(payload),
    addMinutes(ctx.now(), delaySeconds / 60).toISOString(),
    ctx.now().toISOString(),
  );
}

export interface DueJob {
  id: string;
  kind: JobKind;
  payload: string;
}

/** Holt fällige Aufträge und markiert sie atomar als in Bearbeitung. */
export function claimDueJobs(ctx: AppContext, limit: number): DueJob[] {
  const jobs = all<DueJob>(
    ctx.db,
    `SELECT id, kind, payload FROM scheduled_jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at LIMIT ?`,
    ctx.now().toISOString(),
    limit,
  );
  for (const job of jobs) run(ctx.db, `UPDATE scheduled_jobs SET status = 'running' WHERE id = ?`, job.id);
  return jobs;
}

export function finishJob(ctx: AppContext, id: string, ok: boolean): void {
  run(ctx.db, `UPDATE scheduled_jobs SET status = ? WHERE id = ?`, ok ? 'done' : 'failed', id);
  // Alte erledigte Aufträge aufräumen.
  run(
    ctx.db,
    `DELETE FROM scheduled_jobs WHERE status IN ('done', 'failed') AND created_at < ?`,
    addMinutes(ctx.now(), -24 * 60).toISOString(),
  );
}

/** Nach einem Neustart hängengebliebene Aufträge wieder freigeben. */
export function resetRunningJobs(ctx: AppContext): void {
  run(ctx.db, `UPDATE scheduled_jobs SET status = 'pending' WHERE status = 'running'`);
}
