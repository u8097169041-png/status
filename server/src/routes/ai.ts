import { Router } from 'express';
import { z } from 'zod';
import { LIMITS } from '../../../shared/constants';
import { API_KEY_SECRET } from '../ai/aiService';
import type { AppContext } from '../context';
import { AppError, badRequest } from '../lib/errors';
import { deleteSecret, setSecret } from '../services/settings';
import { q } from './helpers';

const keySchema = z.object({
  key: z
    .string()
    .trim()
    .min(10)
    .max(LIMITS.apiKeyLength)
    .regex(/^[\x21-\x7E]+$/, 'Ungültige Zeichen im Schlüssel'),
});

export function aiRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/ai/status', (_req, res) => {
    res.json(ctx.ai.status());
  });

  // Der Schlüssel wird nur entgegengenommen und lokal gespeichert – er wird nie zurückgegeben.
  r.put('/ai/key', (req, res) => {
    const parsed = keySchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid_key', 'Der API-Schlüssel hat kein gültiges Format.');
    setSecret(ctx.db, API_KEY_SECRET, parsed.data.key, ctx.now());
    res.json(ctx.ai.status());
  });
  r.delete('/ai/key', (_req, res) => {
    deleteSecret(ctx.db, API_KEY_SECRET);
    res.json(ctx.ai.status());
  });

  r.get('/ai/models', async (req, res) => {
    try {
      res.json(await ctx.ai.listModels(q(req, 'refresh') === '1'));
    } catch (error) {
      throw new AppError(502, 'models_unavailable', `Modellliste konnte nicht geladen werden: ${(error as Error).message}`);
    }
  });

  r.post('/ai/test', async (_req, res) => {
    res.json(await ctx.ai.testConnection());
  });

  r.get('/ai/usage', (_req, res) => {
    res.json({ status: ctx.ai.status(), entries: ctx.ai.usageEntries(50) });
  });

  return r;
}
