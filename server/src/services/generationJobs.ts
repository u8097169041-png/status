/**
 * Weltentwürfe als Hintergrundauftrag. Eine lokale KI braucht auf einem Prozessor dafür oft Minuten;
 * statt eine HTTP-Anfrage so lange offen zu halten, startet der Client einen Auftrag, fragt den Fortschritt ab
 * und kann ihn abbrechen. Scheitert die KI, liefert der Auftrag den regelbasierten Entwurf mit dem Grund.
 */
import type { GenerationJobDto, WorldDraft } from '../../../shared/types';
import type { AppContext } from '../context';
import { AppError, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { expectedDraftTokens, generateDraft, localDraftFor, parseGenerateInput } from './worldgen';

interface Job {
  id: string;
  status: GenerationJobDto['status'];
  provider: GenerationJobDto['provider'];
  model: string | null;
  startedAt: number;
  finishedAt: number | null;
  tokens: number;
  expectedTokens: number;
  draft: WorldDraft | null;
  notice: string | null;
  controller: AbortController;
  /** Lokaler Entwurf als sofort verfügbarer Ersatz (z. B. beim Abbrechen). */
  fallback: WorldDraft;
}

const jobs = new Map<string, Job>();
/** Abgeschlossene Aufträge werden nach dieser Zeit verworfen. */
const JOB_TTL_MS = 30 * 60_000;
const MAX_JOBS = 20;

function prune(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
  }
  while (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].filter((j) => j.finishedAt).sort((a, b) => a.startedAt - b.startedAt)[0];
    if (!oldest) break;
    jobs.delete(oldest.id);
  }
}

function toDto(job: Job): GenerationJobDto {
  return {
    id: job.id,
    status: job.status,
    provider: job.provider,
    model: job.model,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.startedAt,
    tokens: job.tokens,
    expectedTokens: job.expectedTokens,
    draft: job.draft,
    notice: job.notice,
  };
}

function finish(job: Job, draft: WorldDraft, status: GenerationJobDto['status']): void {
  if (job.status !== 'running') return;
  job.status = status;
  job.draft = draft;
  job.notice = draft.notice ?? null;
  job.finishedAt = Date.now();
}

/** Startet einen Auftrag. Ohne verfügbare KI ist er sofort mit dem regelbasierten Entwurf fertig. */
export async function startGenerationJob(ctx: AppContext, input: unknown): Promise<GenerationJobDto> {
  prune();
  const data = parseGenerateInput(input);
  if ([...jobs.values()].some((j) => j.status === 'running')) {
    throw new AppError(409, 'generation_running', 'Es wird bereits ein Entwurf erzeugt.');
  }
  await ctx.ai.refreshHealth();
  const useAi = data.useAi && ctx.ai.isActive('world');
  const status = ctx.ai.status();
  const job: Job = {
    id: newId('gen'),
    status: 'running',
    provider: useAi ? (ctx.ai.activeProvider('world') === 'server' ? 'server' : 'local') : 'fallback',
    model: useAi ? ctx.ai.modelFor('world') || null : null,
    startedAt: Date.now(),
    finishedAt: null,
    tokens: 0,
    expectedTokens: expectedDraftTokens(data.characterCount),
    draft: null,
    notice: null,
    controller: new AbortController(),
    fallback: localDraftFor(ctx, data),
  };
  jobs.set(job.id, job);
  if (!useAi) {
    // Bewusst abgeschaltete KI ist kein Fehler – dann ohne Hinweis.
    const reason =
      data.useAi && status.reason && status.reason !== 'mode-fallback' && status.reason !== 'local-disabled' ? status.reason : undefined;
    finish(job, reason ? { ...job.fallback, notice: reason } : job.fallback, 'done');
    return toDto(job);
  }
  void generateDraft(ctx, { ...data, seed: data.seed ?? job.id }, {
    signal: job.controller.signal,
    onProgress: (tokens) => {
      job.tokens = tokens;
    },
  })
    .then((draft) => finish(job, draft, 'done'))
    .catch((error: unknown) => {
      console.warn('[generator] Entwurf fehlgeschlagen:', (error as Error).message);
      finish(job, { ...job.fallback, notice: 'server_error' }, 'failed');
    });
  return toDto(job);
}

export function getGenerationJob(id: string): GenerationJobDto {
  const job = jobs.get(id);
  if (!job) throw notFound('Auftrag');
  return toDto(job);
}

/** Bricht die KI-Generierung ab und liefert sofort den regelbasierten Entwurf. */
export function cancelGenerationJob(id: string): GenerationJobDto {
  const job = jobs.get(id);
  if (!job) throw notFound('Auftrag');
  if (job.status === 'running') {
    job.controller.abort();
    finish(job, { ...job.fallback, notice: 'cancelled' }, 'cancelled');
  }
  return toDto(job);
}

/** Für Tests und beim Löschen aller Daten: laufende Aufträge beenden. */
export function resetGenerationJobs(): void {
  for (const job of jobs.values()) job.controller.abort();
  jobs.clear();
}
