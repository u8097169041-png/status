import type { PromptCharacter, WorldContext } from '../ai/prompts';
import type { AppContext } from '../context';
import { all, get, parseJson } from '../db/database';
import { getCharacter } from './characters';

export function loadWorldContext(ctx: AppContext, worldId: string | null): WorldContext | null {
  if (!worldId) return null;
  const w = get<{ name: string; tagline: string; description: string; rules: string }>(
    ctx.db,
    'SELECT name, tagline, description, rules FROM worlds WHERE id = ?',
    worldId,
  );
  if (!w) return null;
  const events = all<{ title: string }>(
    ctx.db,
    'SELECT title FROM world_events WHERE world_id = ? ORDER BY created_at DESC LIMIT 3',
    worldId,
  ).map((e) => e.title);
  return {
    name: w.name,
    tagline: w.tagline,
    description: w.description,
    rules: parseJson<string[]>(w.rules, []),
    recentEvents: events,
  };
}

export function loadPromptCharacter(ctx: AppContext, characterId: string): {
  character: PromptCharacter;
  worldId: string | null;
  world: WorldContext | null;
} {
  const detail = getCharacter(ctx, characterId).character;
  const character: PromptCharacter = {
    name: detail.name,
    handle: detail.handle,
    tagline: detail.tagline,
    description: detail.description,
    role: detail.role,
    personality: detail.personality,
    interests: detail.interests,
    background: detail.background,
    writingStyle: detail.writingStyle,
    styleNotes: detail.styleNotes,
    rules: detail.rules,
    mood: detail.mood,
    isRealPersonSim: detail.isRealPersonSim,
    relationships: detail.relationships.map((r) => ({
      name: r.a.id === characterId ? r.b.name : r.a.name,
      kind: r.kind,
      status: r.status,
    })),
  };
  return { character, worldId: detail.worldId, world: loadWorldContext(ctx, detail.worldId) };
}
