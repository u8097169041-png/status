import { Router } from 'express';
import type { AppContext } from '../context';
import { requireActivePlayer } from '../services/players';
import { listEventCards, simulateWorld, triggerEvent } from '../services/simulation';
import {
  createGroup,
  createRelationship,
  createStoryline,
  deleteGroup,
  deleteRelationship,
  removeGroupMember,
  setGroupMember,
  updateRelationship,
} from '../services/society';
import { cancelGenerationJob, getGenerationJob, startGenerationJob } from '../services/generationJobs';
import { createWorldWithCharacters, generateDraft } from '../services/worldgen';
import { deleteWorld, getWorld, listEvents, listWorlds, updateWorld } from '../services/worlds';
import { param, q } from './helpers';

export function worldRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/worlds', (_req, res) => {
    res.json(listWorlds(ctx));
  });
  // Asynchron: Start, Fortschritt, Abbruch (lange lokale Generierungen ohne offene HTTP-Anfrage).
  r.post('/worlds/generate-jobs', async (req, res) => {
    res.status(202).json(await startGenerationJob(ctx, req.body));
  });
  r.get('/worlds/generate-jobs/:jobId', (req, res) => {
    res.json(getGenerationJob(param(req, 'jobId')));
  });
  r.delete('/worlds/generate-jobs/:jobId', (req, res) => {
    res.json(cancelGenerationJob(param(req, 'jobId')));
  });

  r.post('/worlds/generate', async (req, res) => {
    res.json(await generateDraft(ctx, req.body));
  });
  r.post('/worlds', (req, res) => {
    const { worldId, progress } = createWorldWithCharacters(ctx, req.body);
    res.status(201).json({ world: getWorld(ctx, worldId).world, progress });
  });
  r.get('/worlds/:id', (req, res) => {
    res.json(getWorld(ctx, param(req, 'id'), { recordVisit: q(req, 'visit') === '1' }));
  });
  r.put('/worlds/:id', (req, res) => {
    res.json(updateWorld(ctx, param(req, 'id'), req.body));
  });
  r.delete('/worlds/:id', (req, res) => {
    deleteWorld(ctx, param(req, 'id'));
    res.status(204).end();
  });
  r.get('/worlds/:id/events', (req, res) => {
    // Weltinterne Ereignisse erst nach dem Beitritt.
    requireActivePlayer(ctx, param(req, 'id'));
    res.json(listEvents(ctx, param(req, 'id'), 30, q(req, 'before', 40)));
  });
  r.post('/worlds/:id/simulate', async (req, res) => {
    res.json(await simulateWorld(ctx, param(req, 'id'), 'manual'));
  });
  r.post('/worlds/:id/events', async (req, res) => {
    res.status(201).json(await triggerEvent(ctx, param(req, 'id'), req.body));
  });
  r.get('/event-cards', (_req, res) => {
    res.json(listEventCards(ctx));
  });

  r.post('/worlds/:id/relationships', (req, res) => {
    res.status(201).json(createRelationship(ctx, param(req, 'id'), req.body));
  });
  r.patch('/relationships/:id', (req, res) => {
    res.json(updateRelationship(ctx, param(req, 'id'), req.body));
  });
  r.delete('/relationships/:id', (req, res) => {
    deleteRelationship(ctx, param(req, 'id'));
    res.status(204).end();
  });

  r.post('/worlds/:id/groups', (req, res) => {
    res.status(201).json(createGroup(ctx, param(req, 'id'), req.body));
  });
  r.delete('/groups/:id', (req, res) => {
    deleteGroup(ctx, param(req, 'id'));
    res.status(204).end();
  });
  r.put('/groups/:id/members/:characterId', (req, res) => {
    res.json(setGroupMember(ctx, param(req, 'id'), param(req, 'characterId'), req.body));
  });
  r.delete('/groups/:id/members/:characterId', (req, res) => {
    removeGroupMember(ctx, param(req, 'id'), param(req, 'characterId'));
    res.status(204).end();
  });

  r.post('/worlds/:id/storylines', (req, res) => {
    res.status(201).json(createStoryline(ctx, param(req, 'id'), req.body));
  });

  return r;
}
