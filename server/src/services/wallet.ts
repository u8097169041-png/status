import { PREMIUM_CARDS, SHOP_ITEMS } from '../../../shared/economy';
import type { ShopItemDto, WalletDto } from '../../../shared/types';
import type { AppContext } from '../context';
import { all, get, run, tx } from '../db/database';
import { AppError, badRequest, notFound } from '../lib/errors';
import { getProfileRow } from './mappers';

export function coinBalance(ctx: AppContext): number {
  return get<{ n: number | null }>(ctx.db, 'SELECT SUM(amount) AS n FROM wallet_ledger')?.n ?? 0;
}

/** Schreibt Funken gut – pro Schlüssel genau einmal. Gibt den tatsächlich gutgeschriebenen Betrag zurück. */
export function grantCoins(ctx: AppContext, key: string, amount: number, reason: string): number {
  if (amount <= 0) return 0;
  const inserted = run(
    ctx.db,
    'INSERT OR IGNORE INTO wallet_ledger (key, amount, reason, created_at) VALUES (?, ?, ?, ?)',
    key,
    amount,
    reason,
    ctx.now().toISOString(),
  );
  return inserted.changes > 0 ? amount : 0;
}

export function getWallet(ctx: AppContext): WalletDto {
  return {
    balance: coinBalance(ctx),
    recent: all<{ amount: number; reason: string; created_at: string }>(
      ctx.db,
      'SELECT amount, reason, created_at FROM wallet_ledger ORDER BY id DESC LIMIT 20',
    ).map((r) => ({ amount: r.amount, reason: r.reason, createdAt: r.created_at })),
  };
}

export function ownsItem(ctx: AppContext, itemId: string): boolean {
  return Boolean(get(ctx.db, 'SELECT 1 FROM purchases WHERE item_id = ?', itemId));
}

export function listShop(ctx: AppContext): ShopItemDto[] {
  const profile = getProfileRow(ctx);
  const owned = new Set(all<{ item_id: string }>(ctx.db, 'SELECT item_id FROM purchases').map((r) => r.item_id));
  return SHOP_ITEMS.map((item) => ({
    id: item.id,
    type: item.type,
    price: item.price,
    owned: owned.has(item.id),
    equipped: profile.frame_item === item.id || profile.banner_item === item.id,
  }));
}

export function buyItem(ctx: AppContext, itemId: string): ShopItemDto[] {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) throw notFound('Artikel');
  tx(ctx.db, () => {
    if (ownsItem(ctx, itemId)) throw new AppError(409, 'already_owned', 'Diesen Artikel besitzt du bereits.');
    if (coinBalance(ctx) < item.price) throw new AppError(400, 'insufficient_coins', 'Nicht genügend Funken.');
    run(
      ctx.db,
      'INSERT INTO wallet_ledger (key, amount, reason, created_at) VALUES (?, ?, ?, ?)',
      `buy:${itemId}`,
      -item.price,
      `shop:${itemId}`,
      ctx.now().toISOString(),
    );
    run(ctx.db, 'INSERT INTO purchases (item_id, purchased_at) VALUES (?, ?)', itemId, ctx.now().toISOString());
  });
  return listShop(ctx);
}

/** Rüstet Rahmen oder Banner aus (leere ID = ablegen). */
export function equipItem(ctx: AppContext, itemId: string, slot: 'frame' | 'banner'): ShopItemDto[] {
  if (itemId) {
    const item = SHOP_ITEMS.find((i) => i.id === itemId);
    if (!item || item.type !== slot) throw badRequest('invalid_item', 'Dieser Artikel passt nicht zu diesem Platz.');
    if (!ownsItem(ctx, itemId)) throw badRequest('not_owned', 'Diesen Artikel besitzt du noch nicht.');
  }
  run(ctx.db, `UPDATE user_profile SET ${slot === 'frame' ? 'frame_item' : 'banner_item'} = ? WHERE id = 1`, itemId);
  return listShop(ctx);
}

export function cardUnlocked(ctx: AppContext, cardId: string): boolean {
  const item = PREMIUM_CARDS[cardId];
  return !item || ownsItem(ctx, item);
}
