export type RelationshipStatus = 'close' | 'friendly' | 'neutral' | 'strained' | 'hostile';

/** Leitet aus der Zuneigung (-100 … 100) eine verständliche Statusstufe ab. */
export function relationshipStatus(affinity: number): RelationshipStatus {
  if (affinity >= 60) return 'close';
  if (affinity >= 20) return 'friendly';
  if (affinity > -20) return 'neutral';
  if (affinity > -60) return 'strained';
  return 'hostile';
}

export function clampAffinity(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)));
}

export function clampMetric(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
