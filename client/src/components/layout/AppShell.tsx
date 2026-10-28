import {
  Bell,
  ChevronDown,
  Coins,
  Compass,
  Globe2,
  Home,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import type { BootstrapDto } from '../../../../shared/types';
import { usePlayActions } from '../../api/hooks';
import { useI18n, type TKey } from '../../i18n';
import { formatNumber } from '../../lib/format';
import { AiModeBadge } from '../AiModeBadge';
import { useErrorToast } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { Menu } from '../ui/Menu';
import { useToast } from '../ui/Toast';
import { BrandMark } from './BrandMark';

interface NavItem {
  to: string;
  label: TKey;
  icon: LucideIcon;
  end?: boolean;
}

/** Hauptnavigation: Feed, Aufgaben, Chats, Aktivität, Profil. */
const PRIMARY: NavItem[] = [
  { to: '/feed', label: 'nav.feed', icon: Home },
  { to: '/tasks', label: 'nav.tasks', icon: ListChecks },
  { to: '/chats', label: 'nav.chats', icon: MessageCircle },
  { to: '/activity', label: 'nav.activity', icon: Bell },
  { to: '/profile', label: 'nav.profile', icon: UserRound },
];

const SECONDARY: NavItem[] = [
  { to: '/discover', label: 'nav.discover', icon: Compass },
  { to: '/characters', label: 'nav.characters', icon: Users },
  { to: '/search', label: 'nav.search', icon: Search },
  { to: '/shop', label: 'nav.shop', icon: ShoppingBag },
  { to: '/world-settings', label: 'nav.worldSettings', icon: SlidersHorizontal },
  { to: '/worlds', label: 'nav.worlds', icon: Globe2 },
  { to: '/progress', label: 'nav.progress', icon: Trophy },
  { to: '/settings', label: 'nav.settings', icon: Settings },
  { to: '/privacy', label: 'nav.privacy', icon: Shield },
];

/** Aktive Welt anzeigen und zwischen beigetretenen Welten wechseln. */
function WorldSwitcher({ boot, compact }: { boot: BootstrapDto; compact?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { setWorld } = usePlayActions();
  const showError = useErrorToast();
  const { push } = useToast();
  const world = boot.activeWorld;
  const items = [
    ...boot.joinedWorlds
      .filter((j) => j.world.id !== world?.id)
      .map((j) => ({
        label: t('play.switchTo', { world: j.world.name }),
        icon: <Globe2 aria-hidden />,
        onSelect: () =>
          setWorld.mutate(j.world.id, {
            onSuccess: () => {
              push('info', t('play.switched', { world: j.world.name }));
              navigate('/feed');
            },
            onError: showError,
          }),
      })),
    { label: t('nav.findWorld'), icon: <Compass aria-hidden />, onSelect: () => navigate('/discover') },
  ];
  return (
    <Menu
      label={t('nav.worldSwitcher')}
      align="start"
      triggerClassName={`world-switcher ${compact ? 'compact' : ''}`}
      trigger={
        <>
          <span className="world-dot" style={{ background: world ? `hsl(${world.hue} 80% 60%)` : 'var(--text-faint)' }} aria-hidden />
          <span className="world-switcher-text">
            <strong className="truncate">{world?.name ?? t('nav.noWorld')}</strong>
            {!compact && boot.activePlayer && <span className="truncate">{t('play.playingAs', { name: boot.activePlayer.character.name })}</span>}
          </span>
          <ChevronDown aria-hidden className="icon-xs" />
        </>
      }
      items={items}
    />
  );
}

export function AppShell({ boot, children }: { boot: BootstrapDto; children: ReactNode }) {
  const { t, lang, locale } = useI18n();
  const navigate = useNavigate();
  const unread = boot.unreadNotifications;
  const pending = boot.pendingDecisions;
  const me = boot.activePlayer?.character;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.accent = boot.profile.accentReward;
  }, [lang, boot.profile.accentReward]);

  const countFor = (to: string) => (to === '/activity' ? unread : to === '/tasks' ? pending : 0);

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const count = countFor(item.to);
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <Icon aria-hidden />
        <span className="label">{t(item.label)}</span>
        {count > 0 && (
          <>
            <span className="nav-count" aria-label={`${count}`}>
              {count > 99 ? '99+' : count}
            </span>
            <span className="nav-dot" aria-hidden />
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        {t('nav.skipToContent')}
      </a>
      <aside className="sidebar" aria-label={t('nav.main')}>
        <Link to="/" className="brand" aria-label="SocialVerse">
          <BrandMark />
          <span className="brand-name">SocialVerse</span>
        </Link>
        <div className="sidebar-world">
          <WorldSwitcher boot={boot} />
        </div>
        <nav className="nav" aria-label={t('nav.main')}>
          {PRIMARY.map(renderLink)}
          <span className="nav-label">{t('nav.more')}</span>
          {SECONDARY.map(renderLink)}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-mode">
            <AiModeBadge status={boot.ai} />
          </div>
          <Link to="/profile" className="sidebar-profile">
            {me ? (
              <Avatar name={me.name} hue={me.avatarHue} glyph={me.avatarGlyph} size="md" decorative />
            ) : (
              <Avatar name={boot.profile.displayName} hue={boot.profile.avatarHue} glyph={boot.profile.avatarGlyph} size="md" decorative />
            )}
            <span className="meta">
              <strong className="truncate">{me?.name ?? boot.profile.displayName}</strong>
              <span>
                {t('progress.level', { level: boot.level.level })} · {t('nav.coins', { coins: formatNumber(boot.coins, locale) })}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Link to="/" className="brand" aria-label="SocialVerse">
            <BrandMark />
          </Link>
          <WorldSwitcher boot={boot} compact />
          <div className="topbar-actions">
            <Link to="/shop" className="coin-chip" aria-label={t('nav.coins', { coins: boot.coins })}>
              <Coins aria-hidden /> <span>{formatNumber(boot.coins, locale)}</span>
            </Link>
            <Link to="/search" className="icon-btn" aria-label={t('nav.search')}>
              <Search />
            </Link>
            <Menu
              label={t('nav.moreMenu')}
              trigger={<MoreHorizontal />}
              items={SECONDARY.map((item) => {
                const Icon = item.icon;
                return { label: t(item.label), icon: <Icon aria-hidden />, onSelect: () => navigate(item.to) };
              })}
            />
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label={t('nav.main')}>
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const count = countFor(item.to);
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon aria-hidden />
              <span>{t(item.label)}</span>
              {count > 0 && <span className="nav-dot" aria-label={`${count}`} />}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
