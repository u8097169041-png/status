import { Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LIMITS } from '../../../shared/constants';
import { useSearch } from '../api/hooks';
import { CharacterCard } from '../components/characters/CharacterCard';
import { PostCard } from '../components/feed/PostCard';
import { ErrorState, Loading, EmptyState } from '../components/ui/States';
import { WorldCard } from '../components/worlds/WorldCard';
import { useI18n } from '../i18n';

export function SearchPage() {
  const { t } = useI18n();
  const id = useId();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(input);

  // Kurze Verzögerung, damit nicht bei jedem Tastendruck gesucht wird.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(input);
      setParams(input ? { q: input } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, setParams]);

  const result = useSearch(query);
  const data = result.data;
  const total = data ? data.worlds.length + data.characters.length + data.posts.length : 0;

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('search.title')}</h1>
          <p>{t('search.hint')}</p>
        </div>
      </header>
      <form className="search-box card card-tight" role="search" onSubmit={(e) => e.preventDefault()}>
        <Search aria-hidden />
        <label htmlFor={id} className="sr-only">
          {t('search.label')}
        </label>
        <input
          id={id}
          type="search"
          className="input"
          value={input}
          maxLength={LIMITS.searchQuery}
          placeholder={t('search.placeholder')}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
      </form>
      {result.isFetching && !data && <Loading />}
      {result.isError && <ErrorState error={result.error} onRetry={() => void result.refetch()} />}
      {data && query.trim().length >= 2 && total === 0 && <EmptyState icon={Search} title={t('search.empty', { query: data.query })} />}
      {data && total > 0 && (
        <div className="stack">
          {data.worlds.length > 0 && (
            <section className="section">
              <h2>{t('search.worlds')}</h2>
              <div className="h-scroll">
                {data.worlds.map((w) => (
                  <WorldCard key={w.id} world={w} />
                ))}
              </div>
            </section>
          )}
          {data.characters.length > 0 && (
            <section className="section">
              <h2>{t('search.characters')}</h2>
              <div className="grid-cards">
                {data.characters.map((c) => (
                  <CharacterCard key={c.id} character={c} />
                ))}
              </div>
            </section>
          )}
          {data.posts.length > 0 && (
            <section className="section">
              <h2>{t('search.posts')}</h2>
              <div className="feed-list">
                {data.posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
