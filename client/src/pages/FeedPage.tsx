import { ArrowRight, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useCharacters, useTrending } from '../api/hooks';
import { FeedList } from '../components/feed/FeedList';
import { PostComposer } from '../components/feed/PostComposer';
import { StoriesBar } from '../components/feed/Stories';
import { NotJoinedState, PlayerStatusBar, useActivePlay } from '../components/play/PlayUI';
import { Avatar } from '../components/ui/Avatar';
import { MetricBars } from '../components/worlds/MetricBars';
import { useI18n } from '../i18n';

/** Feed der aktiven Welt: Stories, Statusleiste der Spielfigur, Beiträge und Filter. */
export function FeedPage() {
  const { t } = useI18n();
  const { boot, worldId, world, player } = useActivePlay();
  const [params, setParams] = useSearchParams();
  const character = params.get('character') ?? undefined;
  const tag = params.get('tag') ?? undefined;
  const { data: characters } = useCharacters({ world: worldId ?? undefined });
  const { data: trending } = useTrending();

  if (!worldId || !world || !player || !boot) {
    return (
      <div className="page">
        <NotJoinedState />
      </div>
    );
  }

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const hasFilters = Boolean(character || tag);
  const npcs = (characters ?? []).filter((c) => !c.isPlayer && !c.playedByYou);

  return (
    <div className="page" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <header className="page-header">
        <div className="titles">
          <h1>{world.name}</h1>
          <p>
            {t('play.worldDay', { day: world.day })} · {world.tagline}
          </p>
        </div>
        <Link to={`/worlds/${world.id}`} className="btn btn-ghost btn-sm">
          {t('play.previewTitle')} <ArrowRight aria-hidden />
        </Link>
      </header>
      <div className="with-rail">
        <div className="content-column">
          <PlayerStatusBar player={player} coins={boot.coins} />
          <StoriesBar worldId={worldId} />
          <PostComposer worldId={worldId} />
          <div className="feed-filters card card-tight">
            <select
              className="select"
              value={character ?? ''}
              onChange={(e) => setFilter('character', e.target.value || undefined)}
              aria-label={t('feed.filterCharacter')}
            >
              <option value="">{t('feed.allCharacters')}</option>
              {characters?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {trending && trending.length > 0 && (
              <div className="chip-row scroll" role="group" aria-label={t('feed.filterTopic')}>
                {trending.map((tr) => (
                  <button
                    key={tr.tag}
                    type="button"
                    className="chip"
                    aria-pressed={tag === tr.tag}
                    onClick={() => setFilter('tag', tag === tr.tag ? undefined : tr.tag)}
                  >
                    #{tr.tag}
                  </button>
                ))}
              </div>
            )}
            {hasFilters && (
              <div className="row wrap">
                <span className="xsmall muted">{t('feed.activeFilters')}:</span>
                {tag && !trending?.some((x) => x.tag === tag) && <span className="chip active">#{tag}</span>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>
                  <X aria-hidden /> {t('feed.clearFilters')}
                </button>
              </div>
            )}
          </div>
          <FeedList filters={{ world: worldId, character, tag }} />
        </div>
        <aside className="rail">
          <section className="card stack-sm">
            <h2 className="card-heading">{t('worlds.state')}</h2>
            <MetricBars metrics={world.metrics} />
          </section>
          <section className="card stack-sm">
            <h2 className="card-heading">{t('play.chatWith')}</h2>
            <ul className="mini-list">
              {npcs.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link to={`/chats/${c.id}`} className="row">
                    <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="sm" decorative />
                    <span className="grow truncate small">{c.name}</span>
                    <span className="xsmall faint truncate mini-role">{c.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
