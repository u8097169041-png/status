/**
 * Bilddienst: erkennt die lokale Bild-KI, verarbeitet Aufträge nacheinander (schont GPU/CPU), speichert Bilder
 * dauerhaft und vermeidet doppelte Generierung über einen Cache-Schlüssel (gleicher Prompt + Seed + Größe + Modell).
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ImageJobDto, ImageStatusDto } from '../../../shared/types';
import type { FetchFn } from '../ai/types';
import type { AppConfig } from '../config';
import { get, run, type DB } from '../db/database';
import { newId } from '../lib/ids';
import { ComfyUiBackend, SdWebUiBackend, type BackendProbe, type ImageBackend, type ImageBackendId } from './backends';
import { PHOTO_NEGATIVE, sizeFor } from './prompts';

export type ImageKind = 'avatar' | 'cover' | 'scene';

export interface ImageRequestInput {
  kind: ImageKind;
  ownerType: string;
  ownerId: string;
  prompt: string;
  negative?: string;
  caption?: string;
  seed: number;
  size: 'portrait' | 'scene' | 'cover';
  /** Vom Spieler ausgelöst (vorne in der Warteschlange) oder automatisch im Hintergrund. */
  priority: 'user' | 'background';
  /** Wird nach dem Speichern aufgerufen (z. B. Bild der Figur zuordnen, Nachricht im Chat anlegen). */
  onDone?: (imageId: string) => void;
}

interface Job {
  id: string;
  input: ImageRequestInput;
  status: ImageJobDto['status'];
  imageId: string | null;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  controller: AbortController;
}

export interface ImageRow {
  id: string;
  kind: ImageKind;
  owner_type: string;
  owner_id: string;
  prompt: string;
  caption: string;
  seed: number;
  width: number;
  height: number;
  backend: string;
  model: string;
  file: string | null;
  created_at: string;
}

const FILE_RE = /^img_[a-f0-9]{16}-[a-f0-9]{8}\.(png|jpg|webp)$/;
const PROBE_TTL_MS = 30_000;
const MAX_BACKGROUND_QUEUE = 6;
const MAX_JOBS = 200;

export function imageUrlOf(file: string | null | undefined): string | null {
  return file && FILE_RE.test(file) ? `/api/media/images/${file}` : null;
}

export class ImageService {
  private readonly backends: ImageBackend[];
  private probe: { at: number; id: ImageBackendId | null; result: BackendProbe } | null = null;
  private probing: Promise<void> | null = null;
  private readonly jobs = new Map<string, Job>();
  private queue: Job[] = [];
  private running: Job | null = null;
  private lastError: { message: string; at: string } | null = null;

  constructor(
    private readonly db: DB,
    private readonly config: AppConfig,
    private readonly now: () => Date,
    fetchFn?: FetchFn,
    pollMs?: number,
  ) {
    const cfg = config.imageAi;
    const sd = new SdWebUiBackend(cfg.sdwebuiUrl, fetchFn);
    const comfy = new ComfyUiBackend(cfg.comfyuiUrl, cfg.comfyCheckpoint, fetchFn, pollMs);
    this.backends = cfg.backend === 'none' ? [] : cfg.backend === 'sdwebui' ? [sd] : cfg.backend === 'comfyui' ? [comfy] : [sd, comfy];
  }

  private get dir(): string {
    return join(this.config.uploadsDir, 'images');
  }

  /** Prüft (kostenlos, kurze Zeitlimits), welche Bild-KI erreichbar ist. Ergebnis 30 s zwischengespeichert. */
  async refresh(force = false): Promise<void> {
    if (this.backends.length === 0) return;
    if (!force && this.probe && Date.now() - this.probe.at < PROBE_TTL_MS) return;
    if (this.probing) return this.probing;
    this.probing = (async () => {
      let found: { id: ImageBackendId; result: BackendProbe } | null = null;
      let last: BackendProbe = { reachable: false, model: null, family: 'unknown', error: 'Nicht erreichbar' };
      for (const backend of this.backends) {
        const result = await backend.probe();
        last = result;
        if (result.reachable && result.model) {
          found = { id: backend.id, result };
          break;
        }
        if (result.reachable && !found) found = { id: backend.id, result };
      }
      this.probe = { at: Date.now(), id: found?.id ?? null, result: found?.result ?? last };
      this.probing = null;
    })();
    return this.probing;
  }

  /** True, wenn eine Bild-KI mit Modell bereitsteht (nach letztem Kenntnisstand). */
  available(): boolean {
    return Boolean(this.probe?.id && this.probe.result.reachable && this.probe.result.model);
  }

  private backend(): ImageBackend | null {
    return this.backends.find((b) => b.id === this.probe?.id) ?? null;
  }

  status(): ImageStatusDto {
    const family = this.probe?.result.family ?? 'unknown';
    const override = { portrait: this.config.imageAi.portraitSize, scene: this.config.imageAi.sceneSize };
    return {
      configured: this.config.imageAi.backend,
      backend: this.available() ? (this.probe?.id ?? null) : null,
      reachable: this.probe ? Boolean(this.probe.id && this.probe.result.reachable) : null,
      model: this.probe?.result.model ?? null,
      family,
      error: this.probe?.result.reachable ? (this.probe.result.model ? null : this.probe.result.error) : (this.probe?.result.error ?? null),
      urls: { sdwebui: this.config.imageAi.sdwebuiUrl, comfyui: this.config.imageAi.comfyuiUrl },
      sizes: { portrait: sizeFor('portrait', family, override), scene: sizeFor('scene', family, override) },
      steps: this.config.imageAi.steps,
      queue: { waiting: this.queue.length, running: this.running ? 1 : 0 },
      checkedAt: this.probe ? new Date(this.probe.at).toISOString() : null,
      lastError: this.lastError,
    };
  }

  private cacheKey(backend: string, model: string, input: ImageRequestInput, w: number, h: number, negative: string): string {
    return createHash('sha256').update([backend, model, w, h, input.seed, input.prompt, negative].join('\u0000')).digest('hex');
  }

  getImage(id: string | null | undefined): ImageRow | null {
    if (!id) return null;
    const row = get<ImageRow>(this.db, 'SELECT * FROM images WHERE id = ?', id) ?? null;
    if (!row?.file || !existsSync(join(this.dir, row.file))) return null;
    return row;
  }

  filePath(file: string): string | null {
    if (!FILE_RE.test(file)) return null;
    const path = join(this.dir, file);
    return existsSync(path) ? path : null;
  }

  toDto(job: Job): ImageJobDto {
    const row = this.getImage(job.imageId);
    return {
      id: job.id,
      kind: job.input.kind,
      status: job.status,
      position: job.status === 'queued' ? this.queue.indexOf(job) + 1 : 0,
      elapsedMs: (job.finishedAt ?? Date.now()) - (job.startedAt ?? job.createdAt),
      imageId: job.imageId,
      imageUrl: imageUrlOf(row?.file),
      error: job.error,
    };
  }

  getJob(id: string): ImageJobDto | null {
    const job = this.jobs.get(id);
    return job ? this.toDto(job) : null;
  }

  /** Läuft bereits ein Auftrag für dieses Ziel (z. B. Profilbild einer Figur)? */
  pendingFor(ownerType: string, ownerId: string, kind: ImageKind): ImageJobDto | null {
    const job = [...this.jobs.values()].find(
      (j) => (j.status === 'queued' || j.status === 'running') && j.input.ownerType === ownerType && j.input.ownerId === ownerId && j.input.kind === kind,
    );
    return job ? this.toDto(job) : null;
  }

  /**
   * Stellt einen Bildauftrag ein. Gibt null zurück, wenn keine Bild-KI bereitsteht oder die Hintergrund-Warteschlange voll ist.
   * Ein bereits vorhandenes, identisches Bild (Cache) wird sofort zurückgegeben.
   */
  async request(input: ImageRequestInput): Promise<ImageJobDto | null> {
    await this.refresh();
    if (!this.available()) return null;
    const backendId = this.probe!.id!;
    const model = this.probe!.result.model ?? '';
    const negative = input.negative ?? PHOTO_NEGATIVE;
    const { width, height } = sizeFor(input.size, this.probe!.result.family, { portrait: this.config.imageAi.portraitSize, scene: this.config.imageAi.sceneSize });
    const key = this.cacheKey(backendId, model, input, width, height, negative);
    const cached = get<{ id: string; file: string | null }>(this.db, 'SELECT id, file FROM images WHERE cache_key = ?', key);
    if (cached?.file && existsSync(join(this.dir, cached.file))) {
      const job = this.addJob(input, 'done');
      job.imageId = cached.id;
      job.finishedAt = Date.now();
      input.onDone?.(cached.id);
      return this.toDto(job);
    }
    if (input.priority === 'background' && this.queue.filter((j) => j.input.priority === 'background').length >= MAX_BACKGROUND_QUEUE) return null;
    const existing = this.pendingFor(input.ownerType, input.ownerId, input.kind);
    if (existing && input.kind === 'avatar') return existing;
    const job = this.addJob(input, 'queued');
    if (input.priority === 'user') {
      const firstBackground = this.queue.findIndex((j) => j.input.priority === 'background');
      if (firstBackground >= 0) this.queue.splice(firstBackground, 0, job);
      else this.queue.push(job);
    } else {
      this.queue.push(job);
    }
    void this.pump();
    return this.toDto(job);
  }

  private addJob(input: ImageRequestInput, status: Job['status']): Job {
    const job: Job = {
      id: newId('imgjob'),
      input,
      status,
      imageId: null,
      error: null,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      controller: new AbortController(),
    };
    this.jobs.set(job.id, job);
    if (this.jobs.size > MAX_JOBS) {
      for (const [id, j] of this.jobs) {
        if (j.finishedAt) {
          this.jobs.delete(id);
          if (this.jobs.size <= MAX_JOBS) break;
        }
      }
    }
    return job;
  }

  cancel(id: string): ImageJobDto | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === 'queued') {
      this.queue = this.queue.filter((j) => j !== job);
      job.status = 'cancelled';
      job.finishedAt = Date.now();
    } else if (job.status === 'running') {
      job.controller.abort();
    }
    return this.toDto(job);
  }

  /** Wartet, bis ein Auftrag fertig ist (für Tests und Hintergrundaufgaben). */
  async waitFor(id: string, timeoutMs = 10_000): Promise<ImageJobDto | null> {
    const started = Date.now();
    for (;;) {
      const job = this.jobs.get(id);
      if (!job) return null;
      if (job.status !== 'queued' && job.status !== 'running') return this.toDto(job);
      if (Date.now() - started > timeoutMs) return this.toDto(job);
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    job.status = 'running';
    job.startedAt = Date.now();
    try {
      await this.process(job);
    } finally {
      this.running = null;
      void this.pump();
    }
  }

  private async process(job: Job): Promise<void> {
    const backend = this.backend();
    if (!backend || !this.probe) {
      job.status = 'failed';
      job.error = 'Keine Bild-KI erreichbar.';
      job.finishedAt = Date.now();
      return;
    }
    const input = job.input;
    const negative = input.negative ?? PHOTO_NEGATIVE;
    const { width, height } = sizeFor(input.size, this.probe.result.family, { portrait: this.config.imageAi.portraitSize, scene: this.config.imageAi.sceneSize });
    const outcome = await backend.generate({
      prompt: input.prompt,
      negative,
      width,
      height,
      seed: input.seed,
      steps: this.config.imageAi.steps,
      cfg: this.config.imageAi.cfg,
      signal: job.controller.signal,
      timeoutMs: this.config.imageAi.timeoutMs,
    });
    if (!outcome.ok) {
      job.status = outcome.code === 'cancelled' ? 'cancelled' : 'failed';
      job.error = outcome.message;
      job.finishedAt = Date.now();
      if (outcome.code !== 'cancelled') {
        this.lastError = { message: outcome.message, at: this.now().toISOString() };
        console.warn(`[images] ${backend.id}: ${outcome.code} – ${outcome.message}`);
        // Nicht erreichbar: beim nächsten Auftrag neu prüfen statt erneut zu warten.
        if (outcome.code === 'unreachable') this.probe = null;
      }
      return;
    }
    const id = newId('img');
    const ext = outcome.mime === 'image/png' ? 'png' : outcome.mime === 'image/jpeg' ? 'jpg' : 'webp';
    const file = `img_${randomBytes(8).toString('hex')}-${randomBytes(4).toString('hex')}.${ext}`;
    const target = join(this.dir, file);
    try {
      mkdirSync(this.dir, { recursive: true });
      writeFileSync(`${target}.tmp`, outcome.data, { flag: 'wx' });
      renameSync(`${target}.tmp`, target);
    } catch (error) {
      rmSync(`${target}.tmp`, { force: true });
      job.status = 'failed';
      job.error = (error as NodeJS.ErrnoException).code === 'ENOSPC' ? 'Nicht genug Speicherplatz für das Bild.' : 'Das Bild konnte nicht gespeichert werden.';
      job.finishedAt = Date.now();
      return;
    }
    const model = outcome.model || this.probe.result.model || '';
    run(
      this.db,
      `INSERT INTO images (id, cache_key, kind, owner_type, owner_id, prompt, negative_prompt, caption, seed, width, height, backend, model, file, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET file = excluded.file, created_at = excluded.created_at`,
      id,
      this.cacheKey(backend.id, this.probe.result.model ?? '', input, width, height, negative),
      input.kind,
      input.ownerType,
      input.ownerId,
      input.prompt,
      negative,
      input.caption ?? '',
      input.seed,
      width,
      height,
      backend.id,
      model,
      file,
      this.now().toISOString(),
    );
    const stored = get<{ id: string }>(this.db, 'SELECT id FROM images WHERE file = ?', file);
    job.imageId = stored?.id ?? id;
    job.status = 'done';
    job.finishedAt = Date.now();
    this.lastError = null;
    try {
      input.onDone?.(job.imageId);
    } catch (error) {
      console.warn('[images] Zuordnung fehlgeschlagen:', (error as Error).message);
    }
  }

  /** Beim Löschen aller Daten: Warteschlange leeren und Bilddateien entfernen. */
  reset(): void {
    for (const job of this.queue) job.status = 'cancelled';
    this.queue = [];
    this.running?.controller.abort();
    this.jobs.clear();
    rmSync(this.dir, { recursive: true, force: true });
  }
}
