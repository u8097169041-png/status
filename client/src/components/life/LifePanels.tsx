/** Seitenleisten einer Lebensgeschichte: Werte, Figuren und Beziehungen, Ereignisse und Gedächtnis. */
import { Camera, HeartPulse, Lock, Search, Skull } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import type { LifeCharacterDto, LifeStat, LifeStoryDto } from '../../../../shared/life';
import { useImageStatus, useLifeActions, useLifeMemories } from '../../api/lifeHooks';
import { useI18n } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { Loading } from '../ui/States';
import { useErrorToast } from '../progress/useProgressFeedback';

/** Bei „Aufmerksamkeit“ (heat) ist ein hoher Wert schlecht. */
const INVERTED: LifeStat[] = ['heat'];

function meterColor(stat: LifeStat, value: number): string {
  const v = INVERTED.includes(stat) ? 100 - value : value;
  return v < 25 ? 'var(--danger)' : v < 50 ? 'var(--warning)' : stat === 'health' ? 'var(--success)' : 'var(--accent)';
}

export function StatBars({ story }: { story: LifeStoryDto }) {
  const { t, td } = useI18n();
  return (
    <section className="card stack-sm" aria-labelledby="life-stats-title">
      <h2 id="life-stats-title" className="card-heading">
        {t('life.statusTitle')}
      </h2>
      <ul className="life-stats">
        {story.statKeys.map((k) => {
          const value = story.stats[k] ?? 0;
          const delta = story.lastChanges[k] ?? 0;
          const good = INVERTED.includes(k) ? delta < 0 : delta > 0;
          return (
            <li key={k} className="meter" style={{ '--meter-color': meterColor(k, value) } as React.CSSProperties}>
              <span className="row">
                {k === 'health' && <HeartPulse aria-hidden className="icon-xs" />}
                {td(`lifeStats.${k}`, k)}
              </span>
              <span className="progress" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={td(`lifeStats.${k}`, k)}>
                <span style={{ width: `${value}%` }} />
              </span>
              <strong>
                {value}
                {delta !== 0 && (
                  <span className={`stat-delta ${good ? 'up' : 'down'}`}>
                    {delta > 0 ? '+' : ''}
                    {delta}
                  </span>
                )}
              </strong>
            </li>
          );
        })}
      </ul>
      <p className="xsmall faint">{t('life.statusHint')}</p>
      {story.assets.length > 0 && (
        <div className="stack-xs">
          <h3 className="card-heading">{t('life.assets')}</h3>
          <div className="chip-row">
            {story.assets.map((a) => (
              <span key={a} className="badge">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="stack-xs">
        <h3 className="card-heading">{t('life.promises')}</h3>
        {story.promises.length === 0 ? (
          <p className="xsmall muted">{t('life.noPromises')}</p>
        ) : (
          <ul className="life-list">
            {story.promises.map((p) => (
              <li key={p.id} className="small">
                {p.content}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RelationBar({ label, value, min = 0 }: { label: string; value: number; min?: number }) {
  const pct = ((value - min) / (100 - min)) * 100;
  const color = min < 0 ? (value <= -25 ? 'var(--danger)' : value >= 25 ? 'var(--success)' : 'var(--warning)') : 'var(--accent)';
  return (
    <div className="meter meter-compact" style={{ '--meter-color': color } as React.CSSProperties}>
      <span>{label}</span>
      <span className="progress progress-sm" role="meter" aria-valuemin={min} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span style={{ width: `${Math.max(2, pct)}%` }} />
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function CharacterRow({ c, storyId, imagesReady }: { c: LifeCharacterDto; storyId: string; imagesReady: boolean }) {
  const { t, td } = useI18n();
  const actions = useLifeActions(storyId);
  const showError = useErrorToast();
  const inactive = c.status !== 'alive';
  return (
    <li className={`life-character ${inactive ? 'inactive' : ''}`}>
      <div className="row">
        <Avatar name={c.name} hue={c.appearance.clothingHue} photoUrl={c.avatarUrl} size="lg" decorative />
        <div className="grow min-w-0">
          <strong className="block truncate">{c.name}</strong>
          <span className="xsmall muted block truncate">{c.role}</span>
          <span className="row xsmall">
            <span className={`badge stance-${c.stance}`}>{td(`lifeStances.${c.stance}`, c.stance)}</span>
            {inactive && (
              <span className="badge badge-danger">
                {c.status === 'dead' && <Skull aria-hidden />} {td(`lifeStatuses.${c.status}`, c.status)}
              </span>
            )}
            {c.fromSocial && <span className="badge">{t('life.fromSocial')}</span>}
          </span>
        </div>
      </div>
      {!inactive && (
        <div className="stack-xs">
          <RelationBar label={t('life.affinity')} value={c.affinity} min={-100} />
          <RelationBar label={t('life.trust')} value={c.trust} />
          <RelationBar label={t('life.loyalty')} value={c.loyalty} />
          {c.fear > 0 && <RelationBar label={t('life.fear')} value={c.fear} />}
        </div>
      )}
      {imagesReady && !c.hasPhoto && !inactive && (
        <button type="button" className="btn btn-ghost btn-sm" disabled={actions.avatar.isPending} onClick={() => actions.avatar.mutate(c.id, { onError: showError })}>
          <Camera aria-hidden /> {t('life.generatePhoto')}
        </button>
      )}
    </li>
  );
}

export function CharacterPanel({ story }: { story: LifeStoryDto }) {
  const { t } = useI18n();
  const status = useImageStatus();
  const imagesReady = Boolean(status.data?.backend && status.data.model);
  return (
    <section className="card stack-sm" aria-labelledby="life-chars-title">
      <h2 id="life-chars-title" className="card-heading">
        {t('life.charactersTitle')}
      </h2>
      <ul className="life-characters">
        {story.characters.map((c) => (
          <CharacterRow key={c.id} c={c} storyId={story.id} imagesReady={imagesReady} />
        ))}
      </ul>
    </section>
  );
}

export function TimelinePanel({ story }: { story: LifeStoryDto }) {
  const { t, td } = useI18n();
  return (
    <section className="card stack-sm" aria-labelledby="life-timeline-title">
      <h2 id="life-timeline-title" className="card-heading">
        {t('life.timelineTitle')}
      </h2>
      {story.events.length === 0 ? (
        <p className="small muted">{t('life.timelineEmpty')}</p>
      ) : (
        <ol className="life-timeline">
          {story.events.map((e) => (
            <li key={e.id} className={`severity-${e.severity}`}>
              <span className="xsmall faint">{t('common.day', { day: e.day })}</span>
              <span className={`badge severity-badge-${e.severity}`}>{td(`severity.${e.severity}`, e.severity)}</span>
              <strong className="small block">{e.title}</strong>
              <p className="small muted">{e.description}</p>
              {e.imageUrl && <img className="life-timeline-image" src={e.imageUrl} alt={e.title} loading="lazy" />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MemoryPanel({ story }: { story: LifeStoryDto }) {
  const { t, td } = useI18n();
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim());
  const memories = useLifeMemories(story.id, q, true);
  const nameOf = (k: string) => (k === '*' ? t('life.everyone') : k === 'player' ? t('life.you') : k);
  return (
    <section className="card stack-sm" aria-labelledby="life-memory-title">
      <h2 id="life-memory-title" className="card-heading">
        {t('life.memoryTitle')}
      </h2>
      <p className="xsmall muted">{t('life.memoryHint')}</p>
      <div className="input-with-icon">
        <Search aria-hidden />
        <input type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('life.memorySearch')} aria-label={t('life.memorySearch')} />
      </div>
      {memories.isPending && <Loading />}
      {memories.data && memories.data.length === 0 && <p className="small muted">{t('life.memoryEmpty')}</p>}
      {memories.data && memories.data.length > 0 && (
        <ul className="life-memories">
          {memories.data.map((m) => (
            <li key={m.id} className={m.critical ? 'critical' : ''}>
              <span className="row xsmall">
                <span className="badge">{td(`lifeMemoryKinds.${m.kind}`, m.kind)}</span>
                {m.critical && (
                  <span className="badge badge-danger">
                    <Lock aria-hidden /> {t('life.critical')}
                  </span>
                )}
                <span className="faint">{t('life.turnN', { turn: m.turn })}</span>
              </span>
              <span className="small block">{m.content}</span>
              <span className="xsmall faint">{t('life.knownBy', { names: m.knownBy.map(nameOf).join(', ') })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
