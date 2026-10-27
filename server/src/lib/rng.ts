/** Deterministischer Zufallsgenerator (mulberry32) für reproduzierbare Simulationen. */
export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  shuffle<T>(items: readonly T[]): T[];
  weighted<T>(items: readonly { item: T; weight: number }[]): T;
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: string | number): Rng {
  let state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() auf leerer Liste');
      return items[Math.floor(next() * items.length)];
    },
    chance: (p) => next() < p,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    weighted: (items) => {
      const total = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0);
      if (total <= 0) return rng.pick(items).item;
      let roll = next() * total;
      for (const entry of items) {
        roll -= Math.max(0, entry.weight);
        if (roll <= 0) return entry.item;
      }
      return items[items.length - 1].item;
    },
  };
  return rng;
}
