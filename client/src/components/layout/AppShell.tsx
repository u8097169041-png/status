import {
  Bell,
  Compass,
  Globe2,
  Home,
  MessageCircle,
  Settings,
  Shield,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import type { BootstrapDto } from '../../../../shared/types';
import { useI18n, type TKey } from '../../i18n';
import { AiModeBadge } from '../AiModeBadge';
import { Avatar } from '../ui/Avatar';
import { BrandMark } from './BrandMark';

interface NavItem {
  to: string;
  label: TKey;
  icon: LucideIcon;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'nav.discover', icon: Compass, end: true },
  { to: '/feed', label: 'nav.feed', icon: Home },
  { to: '/worlds', label: 'nav.worlds', icon: Globe2 },
  { to: '/chats', label: 'nav.chats', icon: MessageCircle },
  { to: '/profile', label: 'nav.profile', icon: UserRound },
];

const SECONDARY: NavItem[] = [
  { to: '/characters', label: 'nav.characters', icon: Users },
  { to: '/progress', label: 'nav.progress', icon: Trophy },
  { to: '/notifications', label: 'nav.notifications', icon: Bell },
  { to: '/settings', label: 'nav.settings', icon: Settings },
  { to: '/privacy', label: 'nav.privacy', icon: Shield },
];

export function AppShell({ boot, children }: { boot: BootstrapDto; children: ReactNode }) {
  const { t, lang } = useI18n();
  const unread = boot.unreadNotifications;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.accent = boot.profile.accentReward;
  }, [lang, boot.profile.accentReward]);

  const renderLink = (item: NavItem) => {
    const Icon = item.icon;
    const isBell = item.to === '/notifications';
    return (
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
        <Icon aria-hidden />
        <span className="label">{t(item.label)}</span>
        {isBell && unread > 0 && (
          <>
            <span className="nav-count" aria-label={`${unread}`}>
              {unread > 99 ? '99+' : unread}
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
            <Avatar name={boot.profile.displayName} hue={boot.profile.avatarHue} glyph={boot.profile.avatarGlyph} size="md" decorative />
            <span className="meta">
              <strong className="truncate">{boot.profile.displayName}</strong>
              <span>
                {t('progress.level', { level: boot.level.level })} · {t('progress.xp', { xp: boot.level.xp })}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Link to="/" className="brand" aria-label="SocialVerse">
            <BrandMark />
            <span className="brand-name">SocialVerse</span>
          </Link>
          <div className="topbar-actions">
            <AiModeBadge status={boot.ai} compact />
            <Link to="/characters" className="icon-btn" aria-label={t('nav.characters')}>
              <Users />
            </Link>
            <Link to="/notifications" className="icon-btn" aria-label={t('nav.notifications')}>
              <Bell />
              {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <Link to="/settings" className="icon-btn" aria-label={t('nav.settings')}>
              <Settings />
            </Link>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav className="bottom-nav" aria-label={t('nav.main')}>
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon aria-hidden />
              <span>{t(item.label)}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
