import {
  ArrowLeft,
  Edit3,
  Hourglass,
  Network,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useWorld, useWorldActions, useWorldEvents } from '../api/hooks';
import { CharacterCard } from '../components/characters/CharacterCard';
import { FeedList } from '../components/feed/FeedList';
import { PostComposer } from '../components/feed/PostComposer';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { Tabs } from '../components/ui/Form';
import { ConfirmDialog } from '../components/ui/Modal';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { WorldArt } from '../components/ui/WorldArt';
import { EventTimeline } from '../components/worlds/EventTimeline';
import { MetricBars } from '../components/worlds/MetricBars';
import { RelationshipGraph, statusColor } from '../components/worlds/RelationshipGraph';
import { StorylineCard } from '../components/worlds/StorylineCard';
import { GroupModal, RelationshipModal, TriggerEventModal } from '../components/worlds/WorldDialogs';
import { useI18n } from '../i18n';
import type { WorldDetail } from '../../../shared/types';

type Tab = 'overview' | 'residents' | 'relationships' | 'groups' | 'events' | 'posts';

function EventsTab({ worldId }: { worldId: string }) {
  const { t } = useI18n();
  const events = useWorldEvents(worldId);
  if (events.isPending) return <SkeletonList count={2} />;
  if (events.isError) return <ErrorState error={events.error} onRetry={() => void events.refetch()} />;
  const list = events.data.pages.flat();
  if (list.length === 0) return <EmptyState icon={Sparkles} title={t('worlds.eventsEmpty')} />;
  return (
    <div className="card">
      <EventTimeline events={list} />
      {events.hasNextPage && (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => void events.fetchNextPage()} disabled={events.isFetchingNextPage}>
          {t('worlds.loadOlder')}
        </button>
      )}
    </div>
  );
}

function RelationshipsTab({ world }: { world: WorldDetail }) {
  const { t, td } = useI18n();
  const { removeRelationship } = useWorldActions(world.id);
  const showError = useErrorToast();
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack">
      <div className="row-between">
        <p className="small muted">{t('worlds.graphHint')}</p>
        {world.characters.length >= 2 && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> {t('relationship.add')}
          </button>
        )}
      </div>
      {world.characters.length > 0 && (
        <div className="card">
          <RelationshipGraph characters={world.characters} relationships={world.relationships} />
        </div>
      )}
      {world.relationships.length === 0 ? (
        <EmptyState icon={Network} title={t('worlds.relationshipsEmpty')} />
      ) : (
        <ul className="relationship-list">
          {world.relationships.map((r) => (
            <li key={r.id} className="card card-tight relationship-row">
              <span className="avatar-stack">
                <Avatar name={r.a.name} hue={r.a.avatarHue} glyph={r.a.avatarGlyph} size="sm" decorative />
                <Avatar name={r.b.name} hue={r.b.avatarHue} glyph={r.b.avatarGlyph} size="sm" decorative />
              </span>
              <div className="grow">
                <strong className="small">
                  <Link to={`/characters/${r.a.id}`}>{r.a.name}</Link> & <Link to={`/characters/${r.b.id}`}>{r.b.name}</Link>
                </strong>
                <div className="row wrap xsmall muted">
                  <span>{td(`relationshipKinds.${r.kind}`, r.kind)}</span>
                  <span className="status-pill" style={{ '--status-color': statusColor(r.status) } as React.CSSProperties}>
                    {td(`relationshipStatus.${r.status}`, r.status)} · {r.affinity}
                  </span>
                  {r.note && <span className="truncate">{r.note}</span>}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('common.remove')}
                onClick={() => {
                  if (window.confirm(t('relationship.confirmDelete'))) removeRelationship.mutate(r.id, { onError: showError });
                }}
              >
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && <RelationshipModal world={world} onClose={() => setAdding(false)} />}
    </div>
  );
}

function GroupsTab({ world }: { world: WorldDetail }) {
  const { t } = useI18n();
  const { removeGroup, removeMember, setMember } = useWorldActions(world.id);
  const showError = useErrorToast();
  const [creating, setCreating] = useState(false);
  return (
    <div className="stack">
      <div className="row-between">
        <span />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> {t('group.create')}
        </button>
      </div>
      {world.groups.length === 0 ? (
        <EmptyState icon={Users} title={t('worlds.groupsEmpty')} />
      ) : (
        <div className="grid-cards">
          {world.groups.map((g) => {
            const nonMembers = world.characters.filter((c) => !g.members.some((m) => m.character.id === c.id));
            return (
              <section key={g.id} className="card group-card" style={{ '--group-hue': g.hue } as React.CSSProperties}>
                <div className="row-between">
                  <h3>{g.name}</h3>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('common.delete')}
                    onClick={() => {
                      if (window.confirm(t('group.confirmDelete'))) removeGroup.mutate(g.id, { onError: showError });
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
                {g.description && <p className="small muted">{g.description}</p>}
                <ul className="member-list">
                  {g.members.length === 0 && <li className="xsmall faint">{t('group.noMembers')}</li>}
                  {g.members.map((m) => (
                    <li key={m.character.id} className="row">
                      <Avatar name={m.character.name} hue={m.character.avatarHue} glyph={m.character.avatarGlyph} size="xs" decorative />
                      <Link to={`/characters/${m.character.id}`} className="small grow truncate">
                        {m.character.name}
                      </Link>
                      {m.role && <span className="xsmall faint">{m.role}</span>}
                      <button
                        type="button"
                        className="icon-btn small-icon"
                        aria-label={`${t('group.removeMember')}: ${m.character.name}`}
                        onClick={() => removeMember.mutate({ groupId: g.id, characterId: m.character.id }, { onError: showError })}
                      >
                        <X />
                      </button>
                    </li>
                  ))}
                </ul>
                {nonMembers.length > 0 && (
                  <select
                    className="select select-sm"
                    value=""
                    aria-label={t('group.addMember')}
                    onChange={(e) => {
                      if (e.target.value) setMember.mutate({ groupId: g.id, characterId: e.target.value, role: '' }, { onError: showError });
                    }}
                  >
                    <option value="">+ {t('group.addMember')}</option>
                    {nonMembers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </section>
            );
          })}
        </div>
      )}
      {creating && <GroupModal world={world} onClose={() => setCreating(false)} />}
    </div>
  );
}

export function WorldPage() {
  const { id = '' } = useParams();
  const { t, td } = useI18n();
  const navigate = useNavigate();
  const query = useWorld(id, true);
  const actions = useWorldActions(id);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visitHandled = useRef<string | null>(null);

  useEffect(() => {
    if (query.data && visitHandled.current !== query.data.world.id) {
      visitHandled.current = query.data.world.id;
      if (query.data.progress.xpGained > 0) push('info', t('worlds.visitedNew'));
      feedback(query.data.progress);
    }
  }, [query.data, feedback, push, t]);

  if (query.isPending)
    return (
      <div className="page">
        <SkeletonList count={2} height={240} />
      </div>
    );
  if (query.isError)
    return (
      <div className="page">
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title={t('errors.notFound')} action={<Link to="/worlds" className="btn btn-secondary">{t('nav.worlds')}</Link>} />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );

  const world = query.data.world;
  const simulate = () =>
    actions.simulate.mutate(undefined, {
      onSuccess: (r) => {
        push(
          'info',
          r.events.length ? t('worlds.simulated', { day: r.world.day, count: r.events.length }) : t('worlds.simulatedNone'),
          r.events.map((e) => e.title).join(' · '),
        );
        feedback(r.progress);
        setTab('events');
      },
      onError: showError,
    });

  return (
    <div className="page world-page" style={{ '--world-hue': world.hue } as React.CSSProperties}>
      <Link to="/worlds" className="back-link">
        <ArrowLeft aria-hidden /> {t('nav.worlds')}
      </Link>
      <section className="world-hero">
        <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} className="world-hero-art" label={world.name} />
        <div className="hero-overlay" />
        <div className="world-hero-content">
          <div className="row wrap">
            <span className="badge">{td(`genres.${world.genre}`, world.genre)}</span>
            <span className="badge">{t('worlds.day', { day: world.day })}</span>
            {world.isCustom && <span className="badge badge-demo">{t('worlds.custom')}</span>}
          </div>
          <h1>{world.name}</h1>
          <p className="hero-tagline">{world.tagline}</p>
          <div className="row wrap">
            <button type="button" className="btn btn-primary" onClick={simulate} disabled={actions.simulate.isPending} title={t('worlds.simulateHint')}>
              {actions.simulate.isPending ? <span className="spinner" aria-hidden /> : <Hourglass aria-hidden />}
              {actions.simulate.isPending ? t('worlds.simulating') : t('worlds.simulate')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setTriggerOpen(true)}>
              <Zap aria-hidden /> {t('worlds.trigger')}
            </button>
            {world.isCustom && (
              <>
                <Link to={`/worlds/${world.id}/edit`} className="btn btn-ghost" aria-label={t('worlds.edit')}>
                  <Edit3 aria-hidden />
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)} aria-label={t('worlds.deleteWorld')}>
                  <Trash2 aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="with-rail world-layout">
        <div className="stack">
          <Tabs<Tab>
            label={world.name}
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: t('worlds.tabOverview') },
              { id: 'residents', label: t('worlds.tabResidents'), count: world.characters.length },
              { id: 'relationships', label: t('worlds.tabRelationships'), count: world.relationships.length },
              { id: 'groups', label: t('worlds.tabGroups'), count: world.groups.length },
              { id: 'events', label: t('worlds.tabEvents') },
              { id: 'posts', label: t('worlds.tabPosts') },
            ]}
          />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
            {tab === 'overview' && (
              <>
                {world.characters.length === 0 && <div className="notice notice-warning">{t('worlds.noCharactersNotice')}</div>}
                <section className="card stack-sm">
                  <h2 className="card-heading">{t('worlds.description')}</h2>
                  <p className="pre-line">{world.description}</p>
                </section>
                {world.lore && (
                  <section className="card stack-sm">
                    <h2 className="card-heading">{t('worlds.lore')}</h2>
                    <p className="pre-line muted">{world.lore}</p>
                  </section>
                )}
                <div className="form-grid two">
                  {world.atmosphere && (
                    <section className="card stack-sm">
                      <h2 className="card-heading">{t('worlds.atmosphere')}</h2>
                      <p className="muted small">{world.atmosphere}</p>
                    </section>
                  )}
                  {world.rules.length > 0 && (
                    <section className="card stack-sm">
                      <h2 className="card-heading">{t('worlds.rules')}</h2>
                      <ul className="rule-list">
                        {world.rules.map((r, i) => (
                          <li key={i} className="small muted">
                            {r}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
                <section className="section">
                  <h2>{t('worlds.storylines')}</h2>
                  {world.storylines.length === 0 ? (
                    <p className="muted small">{t('worlds.noStorylines')}</p>
                  ) : (
                    <div className="grid-cards">
                      {world.storylines.map((s) => (
                        <StorylineCard key={s.id} storyline={s} />
                      ))}
                    </div>
                  )}
                </section>
                {world.recentEvents.length > 0 && (
                  <section className="section">
                    <div className="section-header">
                      <h2>{t('worlds.tabEvents')}</h2>
                      <button type="button" className="link-btn small" onClick={() => setTab('events')}>
                        {t('common.viewAll')}
                      </button>
                    </div>
                    <div className="card">
                      <EventTimeline events={world.recentEvents.slice(0, 5)} />
                    </div>
                  </section>
                )}
              </>
            )}
            {tab === 'residents' && (
              <>
                <div className="row-between">
                  <span />
                  <Link to={`/characters/new?world=${world.id}`} className="btn btn-secondary btn-sm">
                    <UserPlus aria-hidden /> {t('worlds.addCharacter')}
                  </Link>
                </div>
                {world.characters.length === 0 ? (
                  <EmptyState icon={Users} title={t('worlds.residentsEmpty')} />
                ) : (
                  <div className="grid-cards">
                    {world.characters.map((c) => (
                      <CharacterCard key={c.id} character={c} showWorld={false} />
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === 'relationships' && <RelationshipsTab world={world} />}
            {tab === 'groups' && <GroupsTab world={world} />}
            {tab === 'events' && <EventsTab worldId={world.id} />}
            {tab === 'posts' && (
              <>
                <PostComposer defaultWorldId={world.id} lockWorld />
                <FeedList filters={{ world: world.id }} emptyText={t('worlds.postsEmpty')} />
              </>
            )}
          </div>
        </div>
        <aside className="rail rail-visible-mobile">
          <section className="card stack-sm">
            <h2 className="card-heading">{t('worlds.state')}</h2>
            <MetricBars metrics={world.metrics} />
          </section>
          <section className="card stack-sm">
            <h2 className="card-heading">{t('worlds.tabResidents')}</h2>
            <ul className="mini-list">
              {world.characters.map((c) => (
                <li key={c.id}>
                  <Link to={`/characters/${c.id}`} className="row">
                    <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="sm" decorative />
                    <span className="grow truncate small">{c.name}</span>
                    <span className="xsmall faint">{td(`moods.${c.mood}`, c.mood)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {triggerOpen && <TriggerEventModal world={world} onClose={() => setTriggerOpen(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={t('worlds.deleteWorld')}
          text={t('worlds.confirmDelete')}
          confirmLabel={t('common.delete')}
          danger
          busy={actions.remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            actions.remove.mutate(undefined, {
              onSuccess: () => {
                push('success', t('worlds.deleted'));
                navigate('/worlds');
              },
              onError: showError,
            })
          }
        />
      )}
    </div>
  );
}
