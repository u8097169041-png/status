/**
 * Spielwährung („Funken“) und Shop. Funken gibt es ausschließlich durch Spielen –
 * es gibt keine Echtgeld-Käufe und keine kostenpflichtigen Spielmechaniken.
 */

export const COIN_REWARDS = {
  levelUpPerLevel: 25,
  achievement: 20,
  decision: 5,
} as const;

export type ShopItemType = 'frame' | 'banner' | 'card';

export interface ShopItemDef {
  id: string;
  type: ShopItemType;
  price: number;
}

export const SHOP_ITEMS: ShopItemDef[] = [
  { id: 'frame-gold', type: 'frame', price: 60 },
  { id: 'frame-neon', type: 'frame', price: 80 },
  { id: 'frame-aurora', type: 'frame', price: 120 },
  { id: 'frame-leaf', type: 'frame', price: 60 },
  { id: 'banner-sunset', type: 'banner', price: 40 },
  { id: 'banner-nebula', type: 'banner', price: 60 },
  { id: 'banner-ocean', type: 'banner', price: 40 },
  { id: 'card-gala', type: 'card', price: 90 },
  { id: 'card-breaking-news', type: 'card', price: 90 },
  { id: 'card-summit', type: 'card', price: 110 },
];

/** Ereigniskarten, die erst im Shop freigeschaltet werden müssen (Karten-ID → Shop-Artikel). */
export const PREMIUM_CARDS: Record<string, string> = {
  gala: 'card-gala',
  'breaking-news': 'card-breaking-news',
  summit: 'card-summit',
};
