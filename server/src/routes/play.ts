import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { badRequest } from '../lib/errors';
import { getActivity } from '../services/activity';
import { chooseOption, listDecisions } from '../services/decisions';
import {
  activatePlayer,
  activeWorldId,
  getActivePlayerRow,
  getPlayerRow,
  joinWorld,
  requireActivePlayer,
  leaveWorld,
  listPlayers,
  setActiveWorld,
  toPlayer,
} from '../services/players';
import { getChatActions, performChatAction } from '../services/chatActions';
import { reactToEvent } from '../services/posts';
import { getQuestBoard } from '../services/quests';
import { search } from '../services/search';
import { listSkills, upgradeSkill } from '../services/skills';
import { buyItem, equipItem, getWallet, listShop } from '../services/wallet';
import { claimWorldQuest, listWorldQuests } from '../services/worldQuests';
import { param, q } from './helpers';

/** Spiel-Endpunkte: Beitritt, Spielfiguren, Entscheidungen, Weltaufgaben, Shop, Suche und Aktivität. */
export function playRoutes(ctx: AppContext): Router {
  const r = Router();

  const worldOf = (value: string | undefined): string => {
    const id = value ?? activeWorldId(ctx);
    if (!id) throw badRequest('no_world', 'Keine Welt ausgewählt.');
    return id;
  };

  r.post('/worlds/:id/join', (req, res) => {
    res.status(201).json(joinWorld(ctx, param(req, 'id'), req.body));
  });
  r.post('/worlds/:id/leave', (req, res) => {
    leaveWorld(ctx, param(req, 'id'));
    res.json({ ok: true });
  });
  r.get('/worlds/:id/players', (req, res) => {
    res.json(listPlayers(ctx, param(req, 'id')));
  });
  r.get('/players', (_req, res) => {
    res.json(listPlayers(ctx));
  });
  r.post('/players/:id/activate', (req, res) => {
    res.json(activatePlayer(ctx, param(req, 'id')));
  });

  r.put('/session/world', (req, res) => {
    const parsed = z.object({ worldId: z.string().max(80).nullable() }).safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid_world', 'Ungültige Welt.');
    setActiveWorld(ctx, parsed.data.worldId);
    const worldId = activeWorldId(ctx);
    const player = worldId ? getActivePlayerRow(ctx, worldId) : undefined;
    res.json({ worldId, player: player ? toPlayer(ctx, player) : null });
  });

  r.get('/decisions', (req, res) => {
    const worldId = worldOf(q(req, 'world'));
    const player = getActivePlayerRow(ctx, worldId);
    const status = q(req, 'status');
    res.json(
      player
        ? listDecisions(ctx, {
            worldId,
            playerId: player.id,
            status: status === 'pending' || status === 'resolved' ? status : undefined,
          })
        : [],
    );
  });
  r.post('/decisions/:id/choose', (req, res) => {
    res.json(chooseOption(ctx, param(req, 'id'), req.body));
  });

  r.get('/world-quests', (req, res) => {
    res.json(listWorldQuests(ctx, worldOf(q(req, 'world'))));
  });
  r.post('/world-quests/:id/claim', (req, res) => {
    const worldId = worldOf(q(req, 'world'));
    res.json({ progress: claimWorldQuest(ctx, param(req, 'id'), worldId), quests: listWorldQuests(ctx, worldId) });
  });

  // ---- Quests, Fähigkeiten, Dialogoptionen, Reaktionen ----

  const playerOf = (value: string | undefined) => requireActivePlayer(ctx, worldOf(value));

  r.get('/quests', (req, res) => {
    res.json(getQuestBoard(ctx, worldOf(q(req, 'world')), playerOf(q(req, 'world'))));
  });
  r.get('/skills', (req, res) => {
    const player = playerOf(q(req, 'world'));
    res.json({ player: toPlayer(ctx, player), skills: listSkills(ctx, player) });
  });
  r.post('/skills/:id/upgrade', (req, res) => {
    const player = playerOf(q(req, 'world'));
    const skills = upgradeSkill(ctx, player, param(req, 'id'));
    res.json({ player: toPlayer(ctx, getPlayerRow(ctx, player.id)), skills });
  });
  r.get('/chats/:characterId/actions', (req, res) => {
    res.json(getChatActions(ctx, param(req, 'characterId')));
  });
  r.post('/chats/:characterId/actions/:actionId', async (req, res) => {
    res.json(await performChatAction(ctx, param(req, 'characterId'), param(req, 'actionId')));
  });
  r.post('/events/:id/react', (req, res) => {
    res.status(201).json(reactToEvent(ctx, param(req, 'id'), req.body));
  });

  r.get('/wallet', (_req, res) => {
    res.json(getWallet(ctx));
  });
  r.get('/shop', (_req, res) => {
    res.json(listShop(ctx));
  });
  r.post('/shop/:id/buy', (req, res) => {
    res.json({ items: buyItem(ctx, param(req, 'id')), wallet: getWallet(ctx) });
  });
  r.post('/shop/:id/equip', (req, res) => {
    const parsed = z.object({ slot: z.enum(['frame', 'banner']), unequip: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid_slot', 'Ungültiger Platz.');
    res.json(equipItem(ctx, parsed.data.unequip ? '' : param(req, 'id'), parsed.data.slot));
  });

  r.get('/search', (req, res) => {
    res.json(search(ctx, q(req, 'q', 200) ?? ''));
  });
  r.get('/activity', (req, res) => {
    res.json(getActivity(ctx, q(req, 'world')));
  });

  return r;
}
