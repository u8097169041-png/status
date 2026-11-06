import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { badRequest } from '../lib/errors';
import { getLifeCharacter, requestLifeAvatar, toLifeCharacter } from '../life/characters';
import { advanceTime, deleteStory, getMemories, getStoryDto, listStories, requestStoryImage, takeTurn } from '../life/service';
import { cancelSetupJob, createStory, getSetupJob, startSetupJob } from '../life/setup';
import { param, q } from './helpers';

const imageSchema = z.object({ description: z.string().max(300).default('') }).strict();

export function lifeRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/life/stories', (_req, res) => {
    res.json(listStories(ctx));
  });

  r.post('/life/setup-jobs', async (req, res) => {
    res.status(202).json(await startSetupJob(ctx, req.body));
  });
  r.get('/life/setup-jobs/:id', (req, res) => {
    res.json(getSetupJob(param(req, 'id')));
  });
  r.delete('/life/setup-jobs/:id', (req, res) => {
    res.json(cancelSetupJob(param(req, 'id')));
  });

  r.post('/life/stories', (req, res) => {
    res.status(201).json(createStory(ctx, req.body));
  });

  r.get('/life/stories/:id', (req, res) => {
    const before = Number(q(req, 'before', 12));
    res.json(getStoryDto(ctx, param(req, 'id'), Number.isFinite(before) && before > 0 ? before : undefined));
  });

  r.delete('/life/stories/:id', (req, res) => {
    deleteStory(ctx, param(req, 'id'));
    res.status(204).end();
  });

  r.post('/life/stories/:id/turns', async (req, res) => {
    res.json(await takeTurn(ctx, param(req, 'id'), req.body));
  });

  r.post('/life/stories/:id/advance', async (req, res) => {
    res.json(await advanceTime(ctx, param(req, 'id'), 'time'));
  });

  r.get('/life/stories/:id/memories', (req, res) => {
    res.json(getMemories(ctx, param(req, 'id'), q(req, 'q', 200) ?? ''));
  });

  r.post('/life/stories/:id/images', async (req, res) => {
    const parsed = imageSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('invalid_image_request', 'Ungültige Bildbeschreibung.');
    const result = await requestStoryImage(ctx, param(req, 'id'), parsed.data.description, 'user');
    res.status(result.job && result.job.status !== 'done' ? 202 : 200).json(result);
  });

  r.post('/life/characters/:id/avatar', async (req, res) => {
    const id = param(req, 'id');
    const job = await requestLifeAvatar(ctx, id, 'user');
    if (!job) {
      res.status(409).json({ error: { code: 'images_unavailable', message: 'Keine lokale Bild-KI erreichbar.' } });
      return;
    }
    res.status(202).json({ job, character: toLifeCharacter(ctx, getLifeCharacter(ctx, id)) });
  });

  return r;
}
