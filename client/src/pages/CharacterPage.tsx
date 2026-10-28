import { ArrowLeft, Bot, Drama, Edit3, Gamepad2, Globe2, MessageCircle, Target, Trash2 } from 'lucide-react';
import { VerifiedBadge } from '../components/play/PlayUI';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBootstrap, useCharacter, useCharacterMutations } from '../api/hooks';
import { FeedList } from '../components/feed/FeedList';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar, hueGradient } from '../components/ui/Avatar';
import { Tabs } from '../components/ui/Form';
import { ConfirmDialog } from '../components/ui/Modal';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { statusColor } from '../components/worlds/RelationshipGraph';
import { useI18n } from '../i18n';

type Tab = 'posts' | 'about' | 'relations' | 'interactions';

export function CharacterPage() {
  const { id = '' } = useParams();
  const { t, td } = useI18n();
  const { data: boot } = useBootstrap();
  const navigate = useNavigate();
  const query = useCharacter(id, true);
  const { remove } = useCharacterMutations();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('posts');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (query.data && handled.current !== query.data.character.id) {
      handled.current = query.data.character.id;
      if (query.data.progress.xpGained > 0) push('info', t('characters.newCard'));
      feedback(query.data.progress);
    }
  }, [query.data, feedback, push, t]);

  if (query.isPending)
    return (
      <div className="page">
        <SkeletonList count={2} height={200} />
      </div>
    );
  if (query.isError)
    return (
      <div className="page">
        {query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState title={t('errors.notFound')} action={<Link to="/characters" className="btn btn-secondary">{t('nav.characters')}</Link>} />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </div>
    );

  const c = query.data.character;
  // Eigene Spielfiguren und aktuell gespielte Figuren: kein Chat mit sich selbst, kein erneutes Übernehmen.
  const controlled = c.isPlayer || c.playedByYou;
  // Beiträge einer Welt gibt es erst nach dem Beitritt.
  const joinedWorld = Boolean(c.worldId && boot?.joinedWorlds.some((j) => j.world.id === c.worldId));
  return (
    <div className="page page-narrow">
      <Link to="/characters" className="back-link">
        <ArrowLeft aria-hidden /> {t('nav.characters')}
      </Link>
      <section className="profile-header card">
        <div className="profile-banner" style={{ background: hueGradient(c.avatarHue) }} aria-hidden />
        <div className="profile-head">
          <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="xxl" ring="muted" />
          <div className="profile-actions">
            {!controlled && (
              <Link to={`/chats/${c.id}`} className="btn btn-primary">
                <MessageCircle aria-hidden /> {t('characters.chat')}
              </Link>
            )}
            {!controlled && c.worldId && (
              <Link to={`/worlds/${c.worldId}/join?character=${c.id}`} className="btn btn-secondary">
                <Gamepad2 aria-hidden /> {t('play.modeExisting')}
              </Link>
            )}
            {c.isCustom && (
              <>
                <Link to={`/characters/${c.id}/edit`} className="btn btn-secondary" aria-label={t('characters.edit')}>
                  <Edit3 aria-hidden />
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)} aria-label={t('characters.delete')}>
                  <Trash2 aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="profile-info">
          <h1 className="row">
            {c.name} {c.prominent && <VerifiedBadge />}
          </h1>
          <span className="muted">@{c.handle}</span>
          <div className="row wrap">
            <span className="badge badge-ai">
              <Bot aria-hidden /> {t('labels.aiCharacter')}
            </span>
            {c.isRealPersonSim && (
              <span className="badge badge-sim">
                <Drama aria-hidden /> {t('labels.fictionalSim')}
              </span>
            )}
            <span className="badge">{c.isCustom ? t('labels.custom') : t('labels.preset')}</span>
            {controlled && <span className="badge badge-player">{t('play.playerBadge')}</span>}
          </div>
          {c.isRealPersonSim && <div className="notice notice-warning small">{t('labels.fictionalSimHint')}</div>}
          {c.tagline && <p className="profile-tagline">{c.tagline}</p>}
          <div className="row wrap small muted">
            {c.role && <span>{c.role}</span>}
            {c.worldId ? (
              <Link to={`/worlds/${c.worldId}`} className="row">
                <Globe2 aria-hidden className="icon-xs" /> {c.worldName}
              </Link>
            ) : (
              <span>{t('characters.noWorld')}</span>
            )}
            <span>
              {t('characters.mood')}: {td(`moods.${c.mood}`, c.mood)}
            </span>
          </div>
        </div>
      </section>

      <Tabs<Tab>
        label={c.name}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'posts', label: t('characters.tabPosts'), count: c.postCount },
          { id: 'about', label: t('characters.tabAbout') },
          { id: 'relations', label: t('characters.tabRelations'), count: c.relationships.length },
          { id: 'interactions', label: t('characters.tabInteractions') },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack tab-panel">
        {tab === 'posts' && (
          <FeedList
            filters={{ character: c.id }}
            emptyText={c.worldId && !joinedWorld ? t('play.previewHint', { world: c.worldName ?? '' }) : t('characters.postsEmpty')}
          />
        )}
        {tab === 'about' && (
          <div className="stack">
            {c.description && (
              <section className="card stack-sm">
                <p className="pre-line">{c.description}</p>
              </section>
            )}
            <section className="card stack-sm">
              <h2 className="card-heading">{t('characters.personality')}</h2>
              <div className="tag-list">
                {c.personality.map((p) => (
                  <span key={p} className="tag">
                    {p}
                  </span>
                ))}
              </div>
              <h2 className="card-heading">{t('characters.interests')}</h2>
              <div className="tag-list">
                {c.interests.map((p) => (
                  <span key={p} className="tag">
                    {p}
                  </span>
                ))}
              </div>
            </section>
            {c.goals.length > 0 && (
              <section className="card stack-sm">
                <h2 className="card-heading row">
                  <Target aria-hidden className="icon-xs accent" /> {t('play.figureGoals')}
                </h2>
                <ul className="rule-list">
                  {c.goals.map((g, i) => (
                    <li key={i} className="small muted">
                      {g}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {c.background && (
              <section className="card stack-sm">
                <h2 className="card-heading">{t('characters.background')}</h2>
                <p className="pre-line muted">{c.background}</p>
              </section>
            )}
            <section className="card stack-sm">
              <h2 className="card-heading">{t('characters.voice')}</h2>
              <p className="small">
                <strong>{t('characters.writingStyle')}:</strong> {td(`styles.${c.writingStyle}`, c.writingStyle)}
                {c.styleNotes && ` – ${c.styleNotes}`}
              </p>
              {c.rules.length > 0 && (
                <>
                  <strong className="small">{t('characters.rules')}</strong>
                  <ul className="rule-list">
                    {c.rules.map((r, i) => (
                      <li key={i} className="small muted">
                        {r}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            {c.groups.length > 0 && (
              <section className="card stack-sm">
                <h2 className="card-heading">{t('characters.groups')}</h2>
                <div className="chip-row">
                  {c.groups.map((g) => (
                    <span key={g.id} className="chip" style={{ borderColor: `hsl(${g.hue} 60% 50% / 0.6)` }}>
                      {g.name}
                      {g.role && <span className="faint">· {g.role}</span>}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        {tab === 'relations' &&
          (c.relationships.length === 0 ? (
            <EmptyState title={t('characters.noRelationships')} />
          ) : (
            <ul className="relationship-list">
              {c.relationships.map((r) => {
                const other = r.a.id === c.id ? r.b : r.a;
                return (
                  <li key={r.id} className="card card-tight relationship-row">
                    <Avatar name={other.name} hue={other.avatarHue} glyph={other.avatarGlyph} size="md" decorative />
                    <div className="grow">
                      <Link to={`/characters/${other.id}`}>
                        <strong className="small">{other.name}</strong>
                      </Link>
                      <div className="row wrap xsmall muted">
                        <span>{td(`relationshipKinds.${r.kind}`, r.kind)}</span>
                        <span className="status-pill" style={{ '--status-color': statusColor(r.status) } as React.CSSProperties}>
                          {td(`relationshipStatus.${r.status}`, r.status)} · {r.affinity}
                        </span>
                      </div>
                      {r.note && <p className="xsmall faint">{r.note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}
        {tab === 'interactions' && (
          <section className="card">
            <dl className="stat-grid">
              <div>
                <dt>{t('characters.statChatMessages')}</dt>
                <dd>{c.stats.chatMessages}</dd>
              </div>
              <div>
                <dt>{t('characters.statLastChat')}</dt>
                <dd>{c.stats.lastChatAt ? <RelativeTime iso={c.stats.lastChatAt} /> : t('characters.never')}</dd>
              </div>
              <div>
                <dt>{t('characters.statLikes')}</dt>
                <dd>{c.stats.likesGiven}</dd>
              </div>
              <div>
                <dt>{t('characters.statComments')}</dt>
                <dd>{c.stats.commentsOnYourPosts}</dd>
              </div>
              <div>
                <dt>{t('characters.statEvents')}</dt>
                <dd>{c.stats.eventsInvolved}</dd>
              </div>
            </dl>
            {!controlled && (
              <Link to={`/chats/${c.id}`} className="btn btn-secondary">
                <MessageCircle aria-hidden /> {t('characters.chat')}
              </Link>
            )}
          </section>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('characters.delete')}
          text={t('characters.confirmDelete')}
          confirmLabel={t('common.delete')}
          danger
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            remove.mutate(c.id, {
              onSuccess: () => {
                push('success', t('characters.deleted'));
                navigate('/characters');
              },
              onError: showError,
            })
          }
        />
      )}
    </div>
  );
}
