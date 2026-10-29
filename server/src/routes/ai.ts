import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { badRequest } from '../lib/errors';

const testSchema = z.object({ target: z.enum(['local', 'server']) }).strict();

/**
 * KI-Status, Diagnose und Verbindungstest. Spieler geben hier keine Schlüssel ein:
 * Zugangsdaten der Server-KI stehen ausschließlich in der Server-Konfiguration (.env bzw. Secret Store).
 */
export function aiRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/ai/status', async (req, res) => {
    // „refresh=1“ prüft die lokale KI sofort neu und hebt eine Fehlersperre der Server-KI auf (ohne Server-Anfrage).
    await ctx.ai.refreshHealth(req.query.refresh === '1');
    res.json(ctx.ai.status());
  });

  r.post('/ai/test', async (req, res) => {
    const parsed = testSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('invalid_target', 'Ungültiges Testziel.');
    res.json(await ctx.ai.testConnection(parsed.data.target));
  });

  // Entfernt einen in Version 1 in der App gespeicherten Schlüssel (wird nicht mehr verwendet).
  r.delete('/ai/key', (_req, res) => {
    ctx.ai.deleteLegacyKey();
    res.json(ctx.ai.status());
  });

  r.get('/ai/usage', (_req, res) => {
    res.json({ status: ctx.ai.status(), entries: ctx.ai.usageEntries(50) });
  });

  return r;
}
