import type { AppContext } from '../context';
import { claimDueJobs, finishJob, resetRunningJobs } from './jobs';
import { runJob } from './reactions';
import { maybeRunAutoTick } from './simulation';
import { purgeExpiredStories } from './stories';

/**
 * Hintergrundaufgaben: verzögerte Reaktionen von Charakteren und die begrenzte automatische Weltsimulation.
 * Läuft nur, solange der Server läuft. Alle Aktivitäten sind über die Einstellungen begrenzt bzw. abschaltbar.
 */
export function startScheduler(ctx: AppContext, opts: { jobIntervalMs?: number; simIntervalMs?: number } = {}): () => void {
  resetRunningJobs(ctx);
  let jobsBusy = false;
  let simBusy = false;

  const processJobs = async () => {
    if (jobsBusy) return;
    jobsBusy = true;
    try {
      for (const job of claimDueJobs(ctx, 5)) {
        try {
          await runJob(ctx, job);
          finishJob(ctx, job.id, true);
        } catch (error) {
          console.warn(`[scheduler] Auftrag ${job.kind} fehlgeschlagen:`, (error as Error).message);
          finishJob(ctx, job.id, false);
        }
      }
    } finally {
      jobsBusy = false;
    }
  };

  const processSimulation = async () => {
    if (simBusy) return;
    simBusy = true;
    try {
      purgeExpiredStories(ctx);
      await maybeRunAutoTick(ctx);
    } catch (error) {
      console.warn('[scheduler] Automatische Simulation fehlgeschlagen:', (error as Error).message);
    } finally {
      simBusy = false;
    }
  };

  const jobTimer = setInterval(() => void processJobs(), opts.jobIntervalMs ?? 5_000);
  const simTimer = setInterval(() => void processSimulation(), opts.simIntervalMs ?? 30_000);
  return () => {
    clearInterval(jobTimer);
    clearInterval(simTimer);
  };
}
