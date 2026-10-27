import { X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useCharacters, useTrending, useWorlds } from '../api/hooks';
import { FeedList } from '../components/feed/FeedList';
import { PostComposer } from '../components/feed/PostComposer';
import { StoriesBar } from '../components/feed/Stories';
import { useI18n } from '../i18n';

export function FeedPage() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const world = params.get('world') ?? undefined;
  const character = params.get('character') ?? undefined;
  const tag = params.get('tag') ?? undefined;
  const { data: worlds } = useWorlds();
  const { data: characters } = useCharacters();
  const { data: trending } = useTrending();

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const hasFilters = Boolean(world || character || tag);

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('feed.title')}</h1>
          <p>{t('feed.subtitle')}</p>
        </div>
      </header>
      <div className="with-rail">
        <div className="content-column">
          <StoriesBar />
          <PostComposer defaultWorldId={world ?? null} />
          <div className="feed-filters card card-tight">
            <div className="form-grid two">
              <select className="select" value={world ?? ''} onChange={(e) => setFilter('world', e.target.value || undefined)} aria-label={t('feed.filterWorld')}>
                <option value="">{t('feed.allWorlds')}</option>
                {worlds?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
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
            </div>
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
          <FeedList filters={{ world, character, tag }} />
        </div>
        <aside className="rail">
          <section className="card">
            <div className="card-title">
              <h2>{t('discover.trending')}</h2>
            </div>
            <div className="chip-row">
              {trending?.map((tr) => (
                <button key={tr.tag} type="button" className="chip" aria-pressed={tag === tr.tag} onClick={() => setFilter('tag', tr.tag)}>
                  #{tr.tag} <span className="faint">{tr.count}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
