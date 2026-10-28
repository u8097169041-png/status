import { Check, Coins, Image, Lock, Sparkles, Square } from 'lucide-react';
import type { ShopItemDto } from '../../../shared/types';
import { useBootstrap, useShop, useShopActions, useWallet } from '../api/hooks';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n, type TKey } from '../i18n';
import { formatNumber } from '../lib/format';

function ItemPreview({ item }: { item: ShopItemDto }) {
  if (item.type === 'frame') return <span className={`shop-preview avatar-frame ${item.id}`} aria-hidden />;
  if (item.type === 'banner') return <span className={`shop-preview banner-preview ${item.id}`} aria-hidden />;
  return (
    <span className="shop-preview card-preview" aria-hidden>
      <Sparkles />
    </span>
  );
}

function ShopItem({ item, balance }: { item: ShopItemDto; balance: number }) {
  const { t } = useI18n();
  const { buy, equip } = useShopActions();
  const showError = useErrorToast();
  const { push } = useToast();
  const name = t(`shop.${item.id}` as TKey);
  const affordable = balance >= item.price;
  return (
    <li className={`shop-item card ${item.owned ? 'owned' : ''}`}>
      <ItemPreview item={item} />
      <strong className="small">{name}</strong>
      {!item.owned ? (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!affordable || buy.isPending}
          title={affordable ? undefined : t('errors.insufficient_coins')}
          onClick={() => buy.mutate(item.id, { onSuccess: () => push('success', t('shop.bought', { name })), onError: showError })}
        >
          {affordable ? <Coins aria-hidden /> : <Lock aria-hidden />} {t('shop.buy', { price: item.price })}
        </button>
      ) : item.type === 'card' ? (
        <span className="xsmall success-text row">
          <Check aria-hidden className="icon-xs" /> {t('shop.owned')}
        </span>
      ) : (
        <button
          type="button"
          className={`btn btn-sm ${item.equipped ? 'btn-ghost' : 'btn-secondary'}`}
          disabled={equip.isPending}
          aria-pressed={item.equipped}
          onClick={() => equip.mutate({ id: item.id, slot: item.type as 'frame' | 'banner', unequip: item.equipped }, { onError: showError })}
        >
          {item.equipped ? t('shop.unequip') : t('shop.equip')}
        </button>
      )}
    </li>
  );
}

/** Shop: kosmetische Artikel und Premium-Ereigniskarten gegen Spielwährung (kein Echtgeld). */
export function ShopPage() {
  const { t, locale } = useI18n();
  const { data: boot } = useBootstrap();
  const shop = useShop();
  const wallet = useWallet();
  const balance = wallet.data?.balance ?? boot?.coins ?? 0;
  const sections: { type: ShopItemDto['type']; title: TKey; icon: typeof Square; hint?: TKey }[] = [
    { type: 'frame', title: 'shop.frames', icon: Square },
    { type: 'banner', title: 'shop.banners', icon: Image },
    { type: 'card', title: 'shop.cards', icon: Sparkles, hint: 'shop.cardsHint' },
  ];
  return (
    <div className="page stack">
      <header className="page-header">
        <div className="titles">
          <h1>{t('shop.title')}</h1>
          <p>{t('shop.subtitle')}</p>
        </div>
        <span className="coin-balance" aria-label={`${t('shop.balance')}: ${balance}`}>
          <Coins aria-hidden /> {formatNumber(balance, locale)}
        </span>
      </header>
      <p className="notice">{t('shop.earnHint')}</p>
      {shop.isPending && <SkeletonList count={2} height={160} />}
      {shop.isError && <ErrorState error={shop.error} onRetry={() => void shop.refetch()} />}
      {shop.data &&
        sections.map((section) => {
          const Icon = section.icon;
          const items = shop.data.filter((i) => i.type === section.type);
          return (
            <section key={section.type} className="section">
              <h2 className="row">
                <Icon aria-hidden className="icon-sm accent" /> {t(section.title)}
              </h2>
              {section.hint && <p className="small muted">{t(section.hint)}</p>}
              <ul className="shop-grid">
                {items.map((item) => (
                  <ShopItem key={item.id} item={item} balance={balance} />
                ))}
              </ul>
            </section>
          );
        })}
      {wallet.data && wallet.data.recent.length > 0 && (
        <section className="section">
          <h2>{t('shop.recent')}</h2>
          <ul className="ledger card card-tight">
            {wallet.data.recent.map((e, i) => (
              <li key={i} className="row-between small">
                <span className="muted truncate">{e.reason}</span>
                <span className={e.amount >= 0 ? 'success-text' : 'danger-text'}>
                  {e.amount > 0 ? '+' : ''}
                  {e.amount}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
