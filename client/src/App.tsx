import { RefreshCw, ServerCrash } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import type { Lang } from '../../shared/constants';
import { useBootstrap } from './api/hooks';
import { BrandMark } from './components/layout/BrandMark';
import { AppShell } from './components/layout/AppShell';
import { Onboarding } from './components/Onboarding';
import { ToastProvider } from './components/ui/Toast';
import { I18nProvider, useI18n } from './i18n';
import { errorMessage } from './lib/format';
import { readStorage, writeStorage } from './lib/storage';
import { CharacterCreatePage, CharacterEditPage } from './pages/CharacterEditPage';
import { CharacterPage } from './pages/CharacterPage';
import { CharactersPage } from './pages/CharactersPage';
import { ActivityPage } from './pages/ActivityPage';
import { ChatsPage } from './pages/ChatsPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { FeedPage } from './pages/FeedPage';
import { JoinWorldPage } from './pages/JoinWorldPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PostPage } from './pages/PostPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProgressPage } from './pages/ProgressPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShopPage } from './pages/ShopPage';
import { SkillsPage } from './pages/SkillsPage';
import { TasksPage } from './pages/TasksPage';
import { WorldCreatePage, WorldEditPage } from './pages/WorldCreatePage';
import { WorldPage } from './pages/WorldPage';
import { WorldSettingsPage } from './pages/WorldSettingsPage';
import { WorldsPage } from './pages/WorldsPage';

function initialLanguage(): Lang {
  const stored = readStorage('sv.lang');
  if (stored === 'de' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Splash() {
  const { t } = useI18n();
  return (
    <div className="splash" role="status">
      <BrandMark />
      <span className="row muted">
        <span className="spinner" aria-hidden /> {t('common.loading')}
      </span>
    </div>
  );
}

function BackendError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t, td } = useI18n();
  return (
    <div className="splash" role="alert">
      <ServerCrash aria-hidden className="splash-icon" />
      <h1>{t('errors.loadFailed')}</h1>
      <p className="muted">{errorMessage(error, td)}</p>
      <button type="button" className="btn btn-primary" onClick={onRetry}>
        <RefreshCw aria-hidden /> {t('common.retry')}
      </button>
    </div>
  );
}

export function App() {
  const boot = useBootstrap();
  const lang = boot.data?.settings.language ?? initialLanguage();

  useEffect(() => {
    if (boot.data) writeStorage('sv.lang', boot.data.settings.language);
  }, [boot.data]);

  return (
    <I18nProvider lang={lang}>
      <ToastProvider>
        <ScrollToTop />
        {boot.isPending ? (
          <Splash />
        ) : boot.isError ? (
          <BackendError error={boot.error} onRetry={() => void boot.refetch()} />
        ) : (
          <>
            <AppShell boot={boot.data}>
              <Routes>
                {/* Mit aktiver Welt startet die App im Feed, sonst beim Entdecken. */}
                <Route path="/" element={<Navigate to={boot.data.activeWorld ? '/feed' : '/discover'} replace />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/shop" element={<ShopPage />} />
                <Route path="/skills" element={<SkillsPage />} />
                <Route path="/world-settings" element={<WorldSettingsPage />} />
                <Route path="/posts/:id" element={<PostPage />} />
                <Route path="/worlds" element={<WorldsPage />} />
                <Route path="/worlds/new" element={<WorldCreatePage />} />
                <Route path="/worlds/:id" element={<WorldPage />} />
                <Route path="/worlds/:id/edit" element={<WorldEditPage />} />
                <Route path="/worlds/:id/join" element={<JoinWorldPage />} />
                <Route path="/chats" element={<ChatsPage />} />
                <Route path="/chats/:characterId" element={<ChatsPage />} />
                <Route path="/characters" element={<CharactersPage />} />
                <Route path="/characters/new" element={<CharacterCreatePage />} />
                <Route path="/characters/:id" element={<CharacterPage />} />
                <Route path="/characters/:id/edit" element={<CharacterEditPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </AppShell>
            {!boot.data.settings.onboardingDone && <Onboarding boot={boot.data} />}
          </>
        )}
      </ToastProvider>
    </I18nProvider>
  );
}
