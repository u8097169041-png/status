import { categoryOfGenre, type Genre } from '../../../shared/constants';
import { levelForXp } from '../../../shared/progress';
import {
  ARCHETYPES,
  ARCHETYPE_PROFILE,
  GOAL_TYPES,
  SKILLS,
  SKILL_LEVEL_REQUIREMENT,
  SKILL_MAX_LEVEL,
  archetypeFor,
  skillCost,
  skillPointsEarned,
  type Archetype,
  type GoalType,
  type SkillId,
} from '../../../shared/skills';
import type { SkillDto, SkillPointsDto } from '../../../shared/types';
import { CHARACTER_GOAL_TYPES } from '../content/seedWorlds3';
import { CHARACTER_GOAL_TYPES_V4 } from '../content/seedWorlds4';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, badRequest } from '../lib/errors';
import type { PlayerRow } from './players';

/** Rolle und Hauptziel einer Spielfigur (werden beim ersten Zugriff aus Rolle und Welt bestimmt und gespeichert). */
export function ensureRole(ctx: AppContext, p: PlayerRow): { archetype: Archetype; goalType: GoalType } {
  let archetype = p.archetype as Archetype;
  let goalType = p.goal_type as GoalType;
  if ((ARCHETYPES as readonly string[]).includes(archetype) && (GOAL_TYPES as readonly string[]).includes(goalType)) {
    return { archetype, goalType };
  }
  const info = get<{ role: string; genre: Genre }>(
    ctx.db,
    'SELECT c.role, w.genre FROM characters c JOIN worlds w ON w.id = ? WHERE c.id = ?',
    p.world_id,
    p.character_id,
  );
  archetype = archetypeFor(info?.role ?? '', info ? categoryOfGenre(info.genre) : '');
  if (!(GOAL_TYPES as readonly string[]).includes(goalType)) {
    goalType = (p.mode === 'existing' ? (CHARACTER_GOAL_TYPES[p.character_id] ?? CHARACTER_GOAL_TYPES_V4[p.character_id]) : undefined) ?? ARCHETYPE_PROFILE[archetype].defaultGoal;
  }
  run(ctx.db, 'UPDATE players SET archetype = ?, goal_type = ? WHERE id = ?', archetype, goalType, p.id);
  p.archetype = archetype;
  p.goal_type = goalType;
  return { archetype, goalType };
}

export function skillLevels(ctx: AppContext, playerId: string): Record<SkillId, number> {
  const levels = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<SkillId, number>;
  for (const r of all<{ skill_id: SkillId; level: number }>(ctx.db, 'SELECT skill_id, level FROM player_skills WHERE player_id = ?', playerId)) {
    if (r.skill_id in levels) levels[r.skill_id] = r.level;
  }
  return levels;
}

export function skillLevel(ctx: AppContext, playerId: string | null | undefined, skill: SkillId): number {
  if (!playerId) return 0;
  return get<{ level: number }>(ctx.db, 'SELECT level FROM player_skills WHERE player_id = ? AND skill_id = ?', playerId, skill)?.level ?? 0;
}

/** Charakterlevel einer Spielfigur (aus ihren eigenen XP, getrennt vom Kontolevel). */
export function playerLevel(ctx: AppContext, playerId: string): number {
  return levelForXp(get<{ xp: number }>(ctx.db, 'SELECT xp FROM players WHERE id = ?', playerId)?.xp ?? 0);
}

export function mainStagesCompleted(ctx: AppContext, playerId: string): number {
  return (
    get<{ n: number }>(ctx.db, `SELECT COUNT(*) AS n FROM quests WHERE player_id = ? AND kind = 'main' AND status = 'completed'`, playerId)
      ?.n ?? 0
  );
}

export function skillPoints(ctx: AppContext, p: PlayerRow): SkillPointsDto {
  const { archetype } = ensureRole(ctx, p);
  const levels = skillLevels(ctx, p.id);
  const earned = skillPointsEarned(levelForXp(p.xp), mainStagesCompleted(ctx, p.id));
  // Kosten pro Stufe sind konstant; ausgegeben ist also Stufe × Kosten.
  const spent = SKILLS.reduce((sum, s) => sum + levels[s] * skillCost(archetype, s), 0);
  return { earned, spent, available: Math.max(0, earned - spent) };
}

export function listSkills(ctx: AppContext, p: PlayerRow): SkillDto[] {
  const { archetype } = ensureRole(ctx, p);
  const levels = skillLevels(ctx, p.id);
  const points = skillPoints(ctx, p);
  const level = levelForXp(p.xp);
  return SKILLS.map((id) => {
    const current = levels[id];
    const cost = skillCost(archetype, id);
    const next = current + 1;
    const nextRequiredLevel = current >= SKILL_MAX_LEVEL ? null : SKILL_LEVEL_REQUIREMENT[next];
    const blockedReason: SkillDto['blockedReason'] =
      current >= SKILL_MAX_LEVEL ? 'max' : level < (nextRequiredLevel ?? 0) ? 'level' : points.available < cost ? 'points' : null;
    return {
      id,
      level: current,
      maxLevel: SKILL_MAX_LEVEL,
      core: ARCHETYPE_PROFILE[archetype].core.includes(id),
      cost,
      nextRequiredLevel,
      canUpgrade: blockedReason === null,
      blockedReason,
    };
  });
}

/** Steigert eine Fähigkeit um eine Stufe – nur mit genug Punkten und ausreichendem Charakterlevel. */
export function upgradeSkill(ctx: AppContext, p: PlayerRow, skillId: string): SkillDto[] {
  if (!(SKILLS as readonly string[]).includes(skillId)) throw badRequest('invalid_skill', 'Unbekannte Fähigkeit.');
  return tx(ctx.db, () => {
    const skill = listSkills(ctx, p).find((s) => s.id === skillId)!;
    if (skill.blockedReason === 'max') throw new AppError(409, 'skill_max', 'Diese Fähigkeit ist bereits auf der höchsten Stufe.');
    if (skill.blockedReason === 'level') throw new AppError(409, 'skill_level', `Dafür brauchst du Charakterlevel ${skill.nextRequiredLevel}.`);
    if (skill.blockedReason === 'points') throw new AppError(409, 'skill_points', 'Nicht genug Fähigkeitspunkte.');
    run(
      ctx.db,
      `INSERT INTO player_skills (player_id, skill_id, level, updated_at) VALUES (?, ?, 1, ?)
       ON CONFLICT(player_id, skill_id) DO UPDATE SET level = level + 1, updated_at = excluded.updated_at`,
      p.id,
      skillId,
      ctx.now().toISOString(),
    );
    return listSkills(ctx, p);
  });
}

/** Prüft eine Fähigkeitsvoraussetzung und wirft einen verständlichen Fehler. */
export function requireSkill(ctx: AppContext, playerId: string, req: { skill: SkillId; level: number } | undefined): void {
  if (req && skillLevel(ctx, playerId, req.skill) < req.level) {
    throw new AppError(403, 'skill_required', 'Dafür fehlt dir noch eine Fähigkeit.', req);
  }
}
