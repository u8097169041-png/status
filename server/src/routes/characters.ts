import { Router } from 'express';
import type { AppContext } from '../context';
import { createCharacter, deleteCharacter, getCharacter, listCharacters, updateCharacter } from '../services/characters';
import {
  addMemory,
  clearChat,
  deleteMemory,
  getChat,
  listChats,
  promptPreview,
  requestChatImage,
  sendMessage,
  updateChatSettings,
} from '../services/chats';
import { activeWorldId } from '../services/players';
import { ensureAvatarInBackground } from '../services/appearances';
import { getSettings } from '../services/settings';
import { param, q } from './helpers';

export function characterRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/characters', (req, res) => {
    res.json(
      listCharacters(ctx, {
        worldId: q(req, 'world'),
        custom: q(req, 'custom') === '1',
        prominent: q(req, 'prominent') === '1',
        npcOnly: q(req, 'npc') === '1',
      }),
    );
  });
  r.post('/characters', (req, res) => {
    res.status(201).json(createCharacter(ctx, req.body));
  });
  r.get('/characters/:id', (req, res) => {
    res.json(getCharacter(ctx, param(req, 'id'), { recordVisit: q(req, 'visit') === '1' }));
  });
  r.put('/characters/:id', (req, res) => {
    res.json(updateCharacter(ctx, param(req, 'id'), req.body));
  });
  r.delete('/characters/:id', (req, res) => {
    deleteCharacter(ctx, param(req, 'id'));
    res.status(204).end();
  });

  r.get('/chats', (req, res) => {
    const worldId = q(req, 'world') ?? activeWorldId(ctx);
    res.json(worldId ? listChats(ctx, worldId) : []);
  });
  r.get('/chats/:characterId', (req, res) => {
    const id = param(req, 'characterId');
    const chat = getChat(ctx, id);
    // Profilfoto bei Bedarf im Hintergrund erzeugen (nur mit Bild-KI; höchstens einmal je Figur).
    ensureAvatarInBackground(ctx, id);
    res.json(chat);
  });
  r.post('/chats/:characterId/images', async (req, res) => {
    const result = await requestChatImage(ctx, param(req, 'characterId'), req.body);
    res.status(result.job && result.job.status !== 'done' ? 202 : 200).json(result);
  });
  r.post('/chats/:characterId/messages', async (req, res) => {
    res.status(201).json(await sendMessage(ctx, param(req, 'characterId'), req.body));
  });
  r.patch('/chats/:characterId', (req, res) => {
    res.json(updateChatSettings(ctx, param(req, 'characterId'), req.body));
  });
  r.delete('/chats/:characterId', (req, res) => {
    clearChat(ctx, param(req, 'characterId'));
    res.status(204).end();
  });
  r.post('/chats/:characterId/memories', (req, res) => {
    res.status(201).json(addMemory(ctx, param(req, 'characterId'), req.body));
  });
  r.delete('/chats/:characterId/memories/:memoryId', (req, res) => {
    res.json(deleteMemory(ctx, param(req, 'characterId'), param(req, 'memoryId')));
  });
  r.get('/chats/:characterId/prompt-preview', (req, res) => {
    const placeholder = getSettings(ctx.db).language === 'de' ? '[Deine nächste Nachricht]' : '[Your next message]';
    res.json(promptPreview(ctx, param(req, 'characterId'), placeholder));
  });

  return r;
}
