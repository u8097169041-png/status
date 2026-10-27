import { Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useCharacters, useWorlds } from '../api/hooks';
import { CharacterCard } from '../components/characters/CharacterCard';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useI18n } from '../i18n';

export function CharactersPage() {
  const { t } = useI18n();
  const characters = useCharacters();
  const { data: worlds } = useWorlds();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (characters.data ?? []).filter((c) => {
      if (filter === 'custom' && !c.isCustom) return false;
      if (filter !== 'all' && filter !== 'custom' && c.worldId !== filter) return false;
      if (q && !`${c.name} ${c.handle} ${c.role} ${c.tagline}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [characters.data, filter, search]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="titles">
          <h1>{t('characters.title')}</h1>
          <p>{t('characters.subtitle')}</p>
        </div>
        <div className="actions">
          <Link to="/characters/new" className="btn btn-primary">
            <Plus aria-hidden /> {t('characters.create')}
          </Link>
        </div>
      </header>
      <div className="stack">
        <div className="row wrap filter-bar">
          <input
            type="search"
            className="input search-input"
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="chip-row scroll">
            <button type="button" className="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              {t('characters.filterAll')}
            </button>
            <button type="button" className="chip" aria-pressed={filter === 'custom'} onClick={() => setFilter('custom')}>
              {t('characters.filterCustom')}
            </button>
            {worlds?.map((w) => (
              <button key={w.id} type="button" className="chip" aria-pressed={filter === w.id} onClick={() => setFilter(w.id)}>
                {w.name}
              </button>
            ))}
          </div>
        </div>
        {characters.isPending && <SkeletonList count={3} />}
        {characters.isError && <ErrorState error={characters.error} onRetry={() => void characters.refetch()} />}
        {characters.data &&
          (list.length === 0 ? (
            <EmptyState
              icon={Users}
              title={filter === 'custom' ? t('characters.emptyCustom') : t('characters.empty')}
              action={
                <Link to="/characters/new" className="btn btn-primary">
                  <Plus aria-hidden /> {t('characters.create')}
                </Link>
              }
            />
          ) : (
            <div className="grid-cards">
              {list.map((c) => (
                <CharacterCard key={c.id} character={c} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
