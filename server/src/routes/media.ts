import { Router, type Response } from 'express';
import type { AppContext } from '../context';
import { AppError, notFound } from '../lib/errors';
import {
  avatarResponse,
  getCharacterAppearance,
  removeCharacterPhoto,
  requestCharacterAvatar,
  setCharacterAppearance,
} from '../services/appearances';
import { lifeAvatarResponse } from '../life/characters';
import { param } from './helpers';

/** Bilder werden mit eigenem, strengem Inhaltsschutz ausgeliefert (kein Skript, kein Nachladen). */
function imageHeaders(res: Response): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
}

function sendAvatar(res: Response, req: { headers: Record<string, unknown> }, result: ReturnType<typeof avatarResponse>): void {
  imageHeaders(res);
  // Profilbilder können sich ändern (neues Foto, geändertes Aussehen): kurz prüfen, dann aus dem Cache.
  res.setHeader('Cache-Control', 'private, no-cache');
  res.setHeader('ETag', result.etag);
  if (req.headers['if-none-match'] === result.etag) {
    res.status(304).end();
    return;
  }
  if (result.kind === 'file') res.sendFile(result.path);
  else res.type('image/svg+xml').send(result.svg);
}

export function mediaRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/media/images/:file', (req, res) => {
    const path = ctx.images.filePath(param(req, 'file'));
    if (!path) throw notFound('Bild');
    imageHeaders(res);
    // Dateinamen sind eindeutig und ändern sich nie – dauerhaft zwischenspeicherbar.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.sendFile(path);
  });

  r.get('/media/avatars/:id', (req, res) => {
    sendAvatar(res, req, avatarResponse(ctx, param(req, 'id')));
  });
  r.get('/media/life-avatars/:id', (req, res) => {
    sendAvatar(res, req, lifeAvatarResponse(ctx, param(req, 'id')));
  });

  r.get('/images/status', async (req, res) => {
    await ctx.images.refresh(req.query.refresh === '1');
    res.json(ctx.images.status());
  });
  r.get('/images/jobs/:id', (req, res) => {
    const job = ctx.images.getJob(param(req, 'id'));
    if (!job) throw notFound('Bildauftrag');
    res.json(job);
  });
  r.delete('/images/jobs/:id', (req, res) => {
    const job = ctx.images.cancel(param(req, 'id'));
    if (!job) throw notFound('Bildauftrag');
    res.json(job);
  });

  r.get('/characters/:id/appearance', (req, res) => {
    res.json(getCharacterAppearance(ctx, param(req, 'id')));
  });
  r.put('/characters/:id/appearance', (req, res) => {
    res.json(setCharacterAppearance(ctx, param(req, 'id'), req.body));
  });
  r.post('/characters/:id/avatar', async (req, res) => {
    const job = await requestCharacterAvatar(ctx, param(req, 'id'), 'user');
    if (!job) throw new AppError(409, 'images_unavailable', 'Keine lokale Bild-KI erreichbar – es wird das gezeichnete Porträt verwendet.');
    res.status(202).json(job);
  });
  r.delete('/characters/:id/avatar', (req, res) => {
    res.json(removeCharacterPhoto(ctx, param(req, 'id')));
  });

  return r;
}
