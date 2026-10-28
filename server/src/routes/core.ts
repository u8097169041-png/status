import { Router } from 'express';
import type { BootstrapDto } from '../../../shared/types';
import { levelInfo } from '../../../shared/progress';
import type { AppContext } from '../context';
import { exportData, resetAllData } from '../services/dataPortability';
import { getDiscover } from '../services/discover';
import { listNotifications, markAllRead, unreadCount } from '../services/notifications';
import { getProfile, updateProfile } from '../services/profile';
import { claimQuest, currentXp, getProgress } from '../services/progress';
import { getSettings, updateSettings } from '../services/settings';
import { simulationStatus } from '../services/simulation';
import { contentLanguage, hasUserActivity } from '../services/meta';
import { activeWorldId, getActivePlayerRow, listPlayers, toPlayer } from '../services/players';
import { coinBalance } from '../services/wallet';
import { listWorlds } from '../services/worlds';
import { param } from './helpers';

export function coreRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true, version: ctx.config.version });
  });

  r.get('/bootstrap', (_req, res) => {
    const worldId = activeWorldId(ctx);
    const activeRow = worldId ? getActivePlayerRow(ctx, worldId) : undefined;
    const activePlayer = activeRow ? toPlayer(ctx, activeRow) : null;
    const players = listPlayers(ctx).filter((p) => p.isActive);
    const worlds = new Map(listWorlds(ctx).map((w) => [w.id, w]));
    const body: BootstrapDto = {
      activeWorld: worldId ? (worlds.get(worldId) ?? null) : null,
      activePlayer,
      joinedWorlds: players.filter((p) => worlds.has(p.worldId)).map((p) => ({ world: worlds.get(p.worldId)!, player: p })),
      coins: coinBalance(ctx),
      pendingDecisions: activePlayer?.pendingDecisions ?? 0,
      profile: getProfile(ctx),
      settings: getSettings(ctx.db),
      ai: ctx.ai.status(),
      level: levelInfo(currentXp(ctx)),
      unreadNotifications: unreadCount(ctx),
      version: ctx.config.version,
      contentLanguage: contentLanguage(ctx),
      hasUserActivity: hasUserActivity(ctx),
    };
    res.json(body);
  });

  r.get('/discover', (_req, res) => {
    res.json(getDiscover(ctx));
  });

  r.get('/profile', (_req, res) => {
    res.json(getProfile(ctx));
  });
  r.patch('/profile', (req, res) => {
    res.json(updateProfile(ctx, req.body));
  });

  r.get('/settings', (_req, res) => {
    res.json(getSettings(ctx.db));
  });
  r.patch('/settings', (req, res) => {
    res.json(updateSettings(ctx.db, req.body));
  });

  r.get('/progress', (_req, res) => {
    res.json(getProgress(ctx));
  });
  r.post('/quests/:id/claim', (req, res) => {
    res.json({ progress: claimQuest(ctx, param(req, 'id')), summary: getProgress(ctx) });
  });

  r.get('/notifications', (_req, res) => {
    res.json({ items: listNotifications(ctx), unread: unreadCount(ctx) });
  });
  r.post('/notifications/read-all', (_req, res) => {
    markAllRead(ctx);
    res.json({ ok: true });
  });

  r.get('/simulation/status', (_req, res) => {
    res.json(simulationStatus(ctx));
  });

  r.get('/data/export', (_req, res) => {
    const stamp = ctx.now().toISOString().slice(0, 10);
    res.setHeader('Content-Disposition', `attachment; filename="socialverse-export-${stamp}.json"`);
    res.json(exportData(ctx));
  });
  r.post('/data/reset', (req, res) => {
    resetAllData(ctx, req.body);
    res.json({ ok: true });
  });

  return r;
}
