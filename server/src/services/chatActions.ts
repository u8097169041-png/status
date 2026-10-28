import { CHAT_ACTIONS, CHAT_ACTION_RULES, SKILL_RULES, type ChatActionId } from '../../../shared/skills';
import type { ChatActionDto, ChatActionResult, ChatActionsDto, QuestRewardsDto } from '../../../shared/types';
import { CHAT_ACTION_MESSAGES, CHAT_ACTION_TEXT } from '../content/chatActionTexts';
import type { AppContext } from '../context';
import { get, parseJson, run, tx } from '../db/database';
import { AppError, badRequest } from '../lib/errors';
import { newId } from '../lib/ids';
import { fill, slugifyHandle } from '../lib/text';
import { dayKey } from '../lib/time';
import { resolveTarget, sendMessage } from './chats';
import { adjustPlayerStats, type PlayerRow } from './players';
import { addCharacterLike, insertCharacterPost } from './posts';
import { mergeDelta } from './progress';
import { evaluateQuests } from './quests';
import { getLanguage } from './settings';
import { skillLevels } from './skills';
import { adjustAffinity } from './society';

function affinityBetween(ctx: AppContext, x: string, y: string): number {
  const [a, b] = x < y ? [x, y] : [y, x];
  return get<{ affinity: number }>(ctx.db, 'SELECT affinity FROM relationships WHERE a_id = ? AND b_id = ?', a, b)?.affinity ?? 0;
}

function used(ctx: AppContext, playerId: string, action: ChatActionId, characterId: string, limit: 'daily' | 'once'): boolean {
  return Boolean(
    get(
      ctx.db,
      'SELECT 1 FROM action_uses WHERE player_id = ? AND action = ? AND ref = ? AND day = ?',
      playerId,
      action,
      characterId,
      limit === 'once' ? 'once' : dayKey(ctx.now()),
    ),
  );
}

function requirePlayer(ctx: AppContext, characterId: string): PlayerRow {
  const target = resolveTarget(ctx, characterId);
  if (!target.player) throw badRequest('no_player', 'Dialogoptionen gibt es nur in einer Welt, in der du mitspielst.');
  return target.player;
}

/** Benötigte Zuneigung für eine Option (Kooperation: mit Verhandlung 2 schon früher). */
function minAffinityFor(action: ChatActionId, negotiation: number): number | undefined {
  if (action === 'cooperate') {
    return negotiation >= 2 ? SKILL_RULES.cooperationAffinity.negotiation : SKILL_RULES.cooperationAffinity.normal;
  }
  return CHAT_ACTION_RULES[action].minAffinity;
}

/** Verfügbare Dialogoptionen gegenüber einer Figur – mit Grund, falls gesperrt. */
export function getChatActions(ctx: AppContext, characterId: string): ChatActionsDto {
  const player = requirePlayer(ctx, characterId);
  const skills = skillLevels(ctx, player.id);
  const affinity = affinityBetween(ctx, player.character_id, characterId);
  const actions: ChatActionDto[] = CHAT_ACTIONS.map((id) => {
    const rule = CHAT_ACTION_RULES[id];
    const minAffinity = minAffinityFor(id, skills.negotiation);
    let reason: ChatActionDto['reason'] = null;
    if (rule.requires && skills[rule.requires.skill] < rule.requires.level) reason = 'skill';
    else if (used(ctx, player.id, id, characterId, rule.limit)) reason = 'used';
    else if (minAffinity !== undefined && affinity < minAffinity) reason = 'affinityLow';
    else if (rule.maxAffinity !== undefined && affinity > rule.maxAffinity) reason = 'affinityHigh';
    return {
      id,
      requires: rule.requires,
      affinity: id === 'negotiate' ? rule.affinity + 4 * Math.max(0, skills.negotiation - 1) : rule.affinity,
      available: reason === null,
      reason,
      minAffinity,
      maxAffinity: rule.maxAffinity,
    };
  });
  const knowsGoals = Boolean(get(ctx.db, `SELECT 1 FROM action_uses WHERE player_id = ? AND action = 'personal' AND ref = ?`, player.id, characterId));
  const goals = knowsGoals
    ? parseJson<string[]>(get<{ goals: string }>(ctx.db, 'SELECT goals FROM characters WHERE id = ?', characterId)?.goals, [])
    : null;
  return { characterId, affinity, actions, knownGoals: goals };
}

/**
 * Führt eine Dialogoption aus: Sie sendet eine passende Nachricht (die Figur antwortet wie gewohnt)
 * und hat eine echte Wirkung auf Beziehung, Werte oder die Welt.
 */
export async function performChatAction(ctx: AppContext, characterId: string, actionId: string): Promise<ChatActionResult> {
  if (!(CHAT_ACTIONS as readonly string[]).includes(actionId)) throw badRequest('invalid_action', 'Unbekannte Dialogoption.');
  const id = actionId as ChatActionId;
  const before = getChatActions(ctx, characterId);
  const action = before.actions.find((a) => a.id === id)!;
  if (!action.available) {
    const code = action.reason === 'skill' ? 'skill_required' : action.reason === 'used' ? 'action_used' : 'affinity_requirement';
    throw new AppError(409, code, 'Diese Dialogoption ist gerade nicht verfügbar.', { reason: action.reason });
  }
  const player = requirePlayer(ctx, characterId);
  const lang = getLanguage(ctx.db);
  const npc = get<{ name: string; handle: string; interests: string; goals: string; world_id: string }>(
    ctx.db,
    'SELECT name, handle, interests, goals, world_id FROM characters WHERE id = ?',
    characterId,
  )!;
  const world = get<{ name: string; day: number }>(ctx.db, 'SELECT name, day FROM worlds WHERE id = ?', player.world_id)!;
  const interests = parseJson<string[]>(npc.interests, []);
  const goals = parseJson<string[]>(npc.goals, []);
  const content = fill(CHAT_ACTION_MESSAGES[id][lang], {
    npc: npc.name,
    world: world.name,
    interest: interests[0] ?? CHAT_ACTION_TEXT.defaultInterest[lang],
    goal: goals[0] ?? CHAT_ACTION_TEXT.defaultGoal[lang],
  });

  // Normale Chatnachricht (inkl. Antwort, Erinnerung und Fortschritt).
  const message = await sendMessage(ctx, characterId, { content });

  const effects: QuestRewardsDto = {};
  const result = tx(ctx.db, () => {
    const affinityBefore = affinityBetween(ctx, player.character_id, characterId);
    // Erneut prüfen: zwischen Anfrage und Antwort könnte die Option schon genutzt worden sein.
    const rule = CHAT_ACTION_RULES[id];
    const marker = run(
      ctx.db,
      'INSERT OR IGNORE INTO action_uses (player_id, action, ref, day, created_at) VALUES (?, ?, ?, ?, ?)',
      player.id,
      id,
      characterId,
      rule.limit === 'once' ? 'once' : dayKey(ctx.now()),
      ctx.now().toISOString(),
    );
    if (marker.changes === 0) throw new AppError(409, 'action_used', 'Diese Dialogoption wurde bereits genutzt.');
    if (action.affinity) adjustAffinity(ctx, player.world_id, player.character_id, characterId, action.affinity);

    const me = get<{ name: string; handle: string }>(ctx.db, 'SELECT name, handle FROM characters WHERE id = ?', player.character_id)!;
    const tag = slugifyHandle(world.name).replace(/_/g, '') || 'socialverse';
    if (id === 'cooperate') {
      // Aus der Beziehung wird ein Bündnis (enge Beziehungen wie Freundschaft oder Familie bleiben erhalten).
      const [a, b] = player.character_id < characterId ? [player.character_id, characterId] : [characterId, player.character_id];
      run(
        ctx.db,
        `UPDATE relationships SET kind = 'ally' WHERE a_id = ? AND b_id = ? AND kind IN ('rival', 'colleague', 'ally')`,
        a,
        b,
      );
      effects.influence = 4;
      adjustPlayerStats(ctx, player.id, effects);
      const vars = { player: me.name, npc: npc.name, handle: me.handle, world: world.name, tag };
      const eventId = newId('e');
      run(
        ctx.db,
        `INSERT INTO world_events (id, world_id, day, kind, title, description, source, effects, participants, created_at)
         VALUES (?, ?, ?, 'cooperation', ?, ?, 'user', '[]', '[]', ?)`,
        eventId,
        player.world_id,
        world.day,
        fill(CHAT_ACTION_TEXT.cooperationTitle[lang], vars),
        fill(CHAT_ACTION_TEXT.cooperationDescription[lang], vars),
        ctx.now().toISOString(),
      );
      const postId = insertCharacterPost(ctx, {
        characterId,
        worldId: player.world_id,
        content: fill(CHAT_ACTION_TEXT.cooperationPost[lang], vars),
        source: 'sim',
        eventId,
      });
      addCharacterLike(ctx, postId, characterId);
    } else if (id === 'endorse') {
      effects.followers = 100;
      effects.reputation = 4;
      adjustPlayerStats(ctx, player.id, effects);
      insertCharacterPost(ctx, {
        characterId,
        worldId: player.world_id,
        content: fill(CHAT_ACTION_TEXT.endorsePost[lang], { handle: me.handle, tag }),
        source: 'sim',
      });
    }
    return { affinityBefore, affinityAfter: affinityBetween(ctx, player.character_id, characterId) };
  });

  // Beziehungsänderungen können Quests abschließen.
  message.progress = mergeDelta(message.progress, evaluateQuests(ctx, player.id));
  return {
    message,
    affinityBefore: result.affinityBefore,
    affinityAfter: result.affinityAfter,
    effects,
    actions: getChatActions(ctx, characterId),
  };
}
