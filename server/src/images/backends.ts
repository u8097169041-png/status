/**
 * Anbindung lokaler Bildgenerierung über deren HTTP-Schnittstellen:
 * - Stable Diffusion WebUI (AUTOMATIC1111 / Forge), gestartet mit `--api`: POST /sdapi/v1/txt2img
 * - ComfyUI: POST /prompt (Workflow), Abfrage über /history und /view
 * Beide laufen auf dem eigenen Rechner (Standard: nur 127.0.0.1) und verursachen keine Kosten.
 */
import type { FetchFn } from '../ai/types';

export type ImageBackendId = 'sdwebui' | 'comfyui';

export interface ImageRequest {
  prompt: string;
  negative: string;
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
  signal?: AbortSignal;
  timeoutMs: number;
}

export type ImageOutcome =
  | { ok: true; data: Buffer; mime: 'image/png' | 'image/jpeg' | 'image/webp'; model: string }
  | { ok: false; code: 'unreachable' | 'timeout' | 'cancelled' | 'failed' | 'no_model'; message: string };

export interface BackendProbe {
  reachable: boolean;
  model: string | null;
  /** Grobe Modellfamilie für passende Bildgrößen. */
  family: 'sd15' | 'sdxl' | 'unknown';
  error: string | null;
}

export interface ImageBackend {
  readonly id: ImageBackendId;
  probe(): Promise<BackendProbe>;
  generate(req: ImageRequest): Promise<ImageOutcome>;
}

/** SDXL-, Flux- und davon abgeleitete Modelle brauchen größere Bilder als SD 1.5. */
export function familyOf(model: string | null): BackendProbe['family'] {
  if (!model) return 'unknown';
  return /xl|flux|pony|illustrious|sd3|juggernaut|realvis/i.test(model) ? 'sdxl' : 'sd15';
}

async function timed<T>(ms: number, outer: AbortSignal | undefined, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), ms);
  const onAbort = () => controller.abort(new DOMException('cancelled', 'AbortError'));
  outer?.addEventListener('abort', onAbort);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

function failure(error: unknown, outer?: AbortSignal): ImageOutcome {
  if (outer?.aborted) return { ok: false, code: 'cancelled', message: 'Abgebrochen.' };
  const name = (error as Error).name;
  if (name === 'TimeoutError' || name === 'AbortError') return { ok: false, code: 'timeout', message: 'Die Bild-KI hat nicht rechtzeitig geantwortet.' };
  return { ok: false, code: 'unreachable', message: 'Die Bild-KI ist nicht erreichbar.' };
}

function detectMime(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export class SdWebUiBackend implements ImageBackend {
  readonly id = 'sdwebui' as const;
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
  ) {}

  async probe(): Promise<BackendProbe> {
    try {
      return await timed(4_000, undefined, async (signal) => {
        const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/options`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { sd_model_checkpoint?: unknown };
        const model = typeof body.sd_model_checkpoint === 'string' ? body.sd_model_checkpoint.slice(0, 160) : null;
        return { reachable: true, model, family: familyOf(model), error: null };
      });
    } catch (error) {
      return { reachable: false, model: null, family: 'unknown', error: (error as Error).name === 'TimeoutError' ? 'Zeitüberschreitung' : 'Nicht erreichbar' };
    }
  }

  async generate(req: ImageRequest): Promise<ImageOutcome> {
    try {
      return await timed(req.timeoutMs, req.signal, async (signal) => {
        const res = await this.fetchFn(`${this.baseUrl}/sdapi/v1/txt2img`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: req.prompt,
            negative_prompt: req.negative,
            width: req.width,
            height: req.height,
            seed: req.seed,
            steps: req.steps,
            cfg_scale: req.cfg,
            sampler_name: 'DPM++ 2M',
            batch_size: 1,
            n_iter: 1,
            send_images: true,
            save_images: false,
          }),
        });
        if (!res.ok) return { ok: false, code: 'failed', message: `Bild-KI meldet HTTP ${res.status}.` } as const;
        const body = (await res.json()) as { images?: unknown; info?: unknown };
        const first = Array.isArray(body.images) ? body.images[0] : null;
        if (typeof first !== 'string') return { ok: false, code: 'failed', message: 'Die Bild-KI hat kein Bild geliefert.' } as const;
        const data = Buffer.from(first.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const mime = detectMime(data);
        if (!mime) return { ok: false, code: 'failed', message: 'Die Bild-KI hat ein unbekanntes Format geliefert.' } as const;
        let model = '';
        try {
          const info = typeof body.info === 'string' ? (JSON.parse(body.info) as { sd_model_name?: string }) : null;
          model = info?.sd_model_name ?? '';
        } catch {
          model = '';
        }
        return { ok: true, data, mime, model } as const;
      });
    } catch (error) {
      return failure(error, req.signal);
    }
  }
}

/** Minimaler Text-zu-Bild-Workflow für ComfyUI (Standard-Knoten, keine Erweiterungen nötig). */
export function comfyWorkflow(req: ImageRequest, checkpoint: string): Record<string, unknown> {
  return {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: req.width, height: req.height, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: req.prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: req.negative, clip: ['4', 1] } },
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: req.seed,
        steps: req.steps,
        cfg: req.cfg,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'socialverse', images: ['8', 0] } },
  };
}

export class ComfyUiBackend implements ImageBackend {
  readonly id = 'comfyui' as const;
  constructor(
    private readonly baseUrl: string,
    private readonly checkpoint: string,
    private readonly fetchFn: FetchFn = globalThis.fetch.bind(globalThis),
    private readonly pollMs = 1_000,
  ) {}

  private async checkpoints(signal: AbortSignal): Promise<string[]> {
    const res = await this.fetchFn(`${this.baseUrl}/object_info/CheckpointLoaderSimple`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { CheckpointLoaderSimple?: { input?: { required?: { ckpt_name?: unknown[] } } } };
    const list = body.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  }

  async probe(): Promise<BackendProbe> {
    try {
      return await timed(4_000, undefined, async (signal) => {
        const stats = await this.fetchFn(`${this.baseUrl}/system_stats`, { signal });
        if (!stats.ok) throw new Error(`HTTP ${stats.status}`);
        const list = await this.checkpoints(signal);
        const model = this.checkpoint && list.includes(this.checkpoint) ? this.checkpoint : (list[0] ?? null);
        return { reachable: true, model, family: familyOf(model), error: model ? null : 'Kein Checkpoint installiert' };
      });
    } catch (error) {
      return { reachable: false, model: null, family: 'unknown', error: (error as Error).name === 'TimeoutError' ? 'Zeitüberschreitung' : 'Nicht erreichbar' };
    }
  }

  async generate(req: ImageRequest): Promise<ImageOutcome> {
    try {
      return await timed(req.timeoutMs, req.signal, async (signal) => {
        const list = await this.checkpoints(signal);
        const checkpoint = this.checkpoint && list.includes(this.checkpoint) ? this.checkpoint : list[0];
        if (!checkpoint) return { ok: false, code: 'no_model', message: 'In ComfyUI ist kein Checkpoint installiert.' } as const;
        const queued = await this.fetchFn(`${this.baseUrl}/prompt`, {
          method: 'POST',
          signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: comfyWorkflow(req, checkpoint), client_id: 'socialverse' }),
        });
        if (!queued.ok) return { ok: false, code: 'failed', message: `ComfyUI meldet HTTP ${queued.status}.` } as const;
        const { prompt_id: promptId } = (await queued.json()) as { prompt_id?: string };
        if (!promptId) return { ok: false, code: 'failed', message: 'ComfyUI hat den Auftrag nicht angenommen.' } as const;
        for (;;) {
          await new Promise((r) => setTimeout(r, this.pollMs));
          if (signal.aborted) throw signal.reason;
          const res = await this.fetchFn(`${this.baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
          if (!res.ok) continue;
          const history = (await res.json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>; status?: { status_str?: string } }>;
          const entry = history[promptId];
          if (!entry) continue;
          if (entry.status?.status_str === 'error') return { ok: false, code: 'failed', message: 'ComfyUI meldet einen Fehler im Workflow.' } as const;
          const image = Object.values(entry.outputs ?? {}).flatMap((o) => o.images ?? [])[0];
          if (!image) continue;
          const view = await this.fetchFn(
            `${this.baseUrl}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder ?? '')}&type=${encodeURIComponent(image.type ?? 'output')}`,
            { signal },
          );
          if (!view.ok) return { ok: false, code: 'failed', message: 'Das Bild konnte nicht aus ComfyUI geladen werden.' } as const;
          const data = Buffer.from(await view.arrayBuffer());
          const mime = detectMime(data);
          if (!mime) return { ok: false, code: 'failed', message: 'ComfyUI hat ein unbekanntes Format geliefert.' } as const;
          return { ok: true, data, mime, model: checkpoint } as const;
        }
      });
    } catch (error) {
      return failure(error, req.signal);
    }
  }
}
