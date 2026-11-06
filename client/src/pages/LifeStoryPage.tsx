import { AlertTriangle, ArrowLeft, Camera, ChevronUp, FastForward, MapPin, MoreHorizontal, Send, Skull, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { LifeMessageDto, LifeStoryDto } from '../../../shared/life';
import type { ImageJobDto } from '../../../shared/types';
import { useLifeActions, useLifeOlderMessages, useLifeStory } from '../api/lifeHooks';
import { CharacterPanel, MemoryPanel, StatBars, TimelinePanel } from '../components/life/LifePanels';
import { ImageDialog, ImageJobIndicator, SceneImage, SuggestionButtons, type ScenePerson } from '../components/media/Media';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { Tabs } from '../components/ui/Form';
import { Menu } from '../components/ui/Menu';
import { ConfirmDialog } from '../components/ui/Modal';
import { ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { LifeCover } from './LifeStoriesPage';

type Tab = 'story' | 'status' | 'characters' | 'timeline' | 'memory';

/** Ob eine Medienabfrage zutrifft – reagiert auf Größenänderungen (Handy drehen, Fenster verkleinern). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}
const MAX_INPUT = 600;

function Resolution({ m }: { m: LifeMessageDto }) {
  const { t, td } = useI18n();
  const r = m.resolution;
  if (!r) return null;
  const good = r.tier === 'success' || r.tier === 'critical_success';
  const bad = r.tier === 'failure' || r.tier === 'critical_failure';
  const changes = Object.entries(r.statChanges).filter(([, v]) => v);
  return (
    <div className={`life-resolution ${good ? 'good' : bad ? 'bad' : 'mixed'}`}>
      <strong className="xsmall">{t('life.resolution', { tier: td(`lifeTiers.${r.tier}`, r.tier), chance: Math.round(r.chance * 100) })}</strong>
      {changes.map(([k, v]) => {
        const positive = k === 'heat' ? v! < 0 : v! > 0;
        return (
          <span key={k} className={`stat-delta ${positive ? 'up' : 'down'}`}>
            {td(`lifeStats.${k}`, k)} {v! > 0 ? '+' : ''}
            {v}
          </span>
        );
      })}
    </div>
  );
}

function Message({ m, story, people }: { m: LifeMessageDto; story: LifeStoryDto; people: ScenePerson[] }) {
  const { t } = useI18n();
  if (m.role === 'player') {
    return (
      <div className="message user">
        <div className="message-stack">
          <div className="bubble">{m.content}</div>
          <span className="message-meta">{t('life.playerLabel')}</span>
        </div>
      </div>
    );
  }
  if (m.role === 'character') {
    const c = story.characters.find((x) => x.id === m.speakerId);
    return (
      <div className="message assistant">
        <Avatar name={m.speakerName ?? '?'} hue={c?.appearance.clothingHue ?? 220} photoUrl={c?.avatarUrl} size="sm" decorative />
        <div className="message-stack">
          <span className="message-speaker xsmall">{m.speakerName}</span>
          <div className="bubble">{m.content}</div>
        </div>
      </div>
    );
  }
  if (m.role === 'event') {
    return (
      <div className={`life-event severity-${m.severity ?? 'minor'}`} role="note">
        <AlertTriangle aria-hidden />
        <span className="small">
          {m.title && <strong>{m.title}: </strong>}
          {m.content}
        </span>
      </div>
    );
  }
  if (m.role === 'system') {
    return (
      <div className="life-ending" role="note">
        <Skull aria-hidden />
        <p>{m.content}</p>
      </div>
    );
  }
  if (m.role === 'image') {
    return (
      <div className="life-image">
        <SceneImage imageUrl={m.imageUrl} sceneCard={m.sceneCard} caption={m.content} people={people} />
      </div>
    );
  }
  // Erzähler
  return (
    <div className={`life-narration ${m.pending ? 'pending' : ''}`}>
      {m.away && <span className="badge">{t('life.away')}</span>}
      {m.resolution && <Resolution m={m} />}
      {m.pending ? (
        <p className="row muted small">
          <span className="typing-dots" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {t('life.narrating')}
        </p>
      ) : (
        m.content && <p>{m.content}</p>
      )}
    </div>
  );
}

export function LifeStoryPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const story = useLifeStory(id);
  const actions = useLifeActions(id);
  const older = useLifeOlderMessages(id);
  const showError = useErrorToast();
  const { push } = useToast();
  const [tab, setTab] = useState<Tab>('story');
  const desktop = useMediaQuery('(min-width: 900px)');
  const [draft, setDraft] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [imageJob, setImageJob] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [olderMessages, setOlderMessages] = useState<LifeMessageDto[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const data = story.data;
  const lastId = data?.messages.at(-1)?.id;
  const lastPending = data?.messages.at(-1)?.pending;

  useEffect(() => {
    if (tab === 'story') endRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId, lastPending, tab, imageJob]);

  useEffect(() => {
    setOlderMessages([]);
    setHasOlder(null);
  }, [id]);

  // Jeder Bildauftrag wird genau einmal abgeschlossen (lokal gestartet oder vom Server gemeldet).
  const handledJobs = useRef(new Set<string>());
  const onImageDone = useCallback(
    (job: ImageJobDto) => {
      setImageJob(null);
      if (handledJobs.current.has(job.id)) return;
      handledJobs.current.add(job.id);
      void story.refetch();
      if (job.status === 'done') push('success', t('images.done'));
      else if (job.status === 'failed') push('error', t('images.failed', { reason: job.error ?? '?' }));
    },
    [story, push, t],
  );

  if (story.isPending) return <Loading />;
  if (story.isError || !data) {
    return (
      <div className="page">
        <ErrorState error={story.error} onRetry={() => void story.refetch()} />
      </div>
    );
  }

  const ended = data.status === 'ended';
  const busy = data.narrating || actions.turn.isPending || actions.advance.isPending;
  const lastNarration = [...data.messages].reverse().find((m) => m.role === 'narrator');
  const suggestions = !ended && lastNarration && !lastNarration.pending ? (lastNarration.suggestions ?? []) : [];
  const messages = [...olderMessages.filter((o) => !data.messages.some((m) => m.id === o.id)), ...data.messages];
  const people: ScenePerson[] = [
    { id: 'player', name: data.playerName, hue: data.playerAppearance.clothingHue, photoUrl: data.playerAvatarUrl },
    ...data.characters.map((c) => ({ id: c.id, name: c.name, hue: c.appearance.clothingHue, photoUrl: c.avatarUrl })),
  ];
  const showOlder = hasOlder ?? data.hasOlderMessages;

  const act = (input: { text?: string; suggestionId?: string }) => {
    if (busy || ended) return;
    if (input.text !== undefined) setDraft('');
    actions.turn.mutate(input, {
      onError: (error) => {
        if (input.text) setDraft(input.text);
        showError(error);
      },
    });
  };

  return (
    <div className="page life-page">
      <header className="life-header">
        <Link to="/life" className="icon-btn" aria-label={t('life.back')}>
          <ArrowLeft />
        </Link>
        <LifeCover story={data} className="life-cover-sm" />
        <div className="grow min-w-0">
          <h1 className="life-title truncate">{data.title}</h1>
          <p className="xsmall muted truncate row">
            {t('life.as', { name: data.playerName, role: data.playerRole })} · {t('life.dayTurn', { day: data.day, turn: data.turn })}
            {data.location && (
              <>
                {' · '}
                <MapPin aria-hidden className="icon-xs" /> {data.location}
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={ended || Boolean(imageJob) || actions.image.isPending} onClick={() => setImageOpen(true)} title={t('life.image')}>
          <Camera aria-hidden /> <span className="hide-mobile">{t('life.image')}</span>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={ended || busy}
          title={t('life.advanceHint')}
          onClick={() => actions.advance.mutate(undefined, { onError: showError })}
        >
          <FastForward aria-hidden /> <span className="hide-mobile">{t('life.advance')}</span>
        </button>
        <Menu
          label={t('life.moreActions')}
          trigger={<MoreHorizontal />}
          items={[{ label: t('life.delete'), icon: <Trash2 aria-hidden />, onSelect: () => setConfirmDelete(true) }]}
        />
      </header>

      <div className="life-tabs mobile-only">
        <Tabs<Tab>
          label={data.title}
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'story', label: t('life.tabStory') },
            { id: 'status', label: t('life.tabStatus') },
            { id: 'characters', label: t('life.tabCharacters') },
            { id: 'timeline', label: t('life.tabTimeline'), count: data.events.length || undefined },
            { id: 'memory', label: t('life.tabMemory') },
          ]}
        />
      </div>

      <div className="life-layout">
        <section className={`life-main ${tab === 'story' || desktop ? '' : 'mobile-hidden'}`} aria-label={t('life.tabStory')}>
          <div className="life-messages" aria-live="polite">
            {showOlder && (
              <button
                type="button"
                className="btn btn-ghost btn-sm life-older"
                disabled={older.isPending}
                onClick={() =>
                  older.mutate(messages[0]?.id ?? 0, {
                    onSuccess: (r) => {
                      setOlderMessages((prev) => [...r.messages, ...prev]);
                      setHasOlder(r.hasOlderMessages);
                    },
                    onError: showError,
                  })
                }
              >
                <ChevronUp aria-hidden /> {t('life.olderMessages')}
              </button>
            )}
            {messages.map((m) => (
              <Message key={m.id} m={m} story={data} people={people} />
            ))}
            {(() => {
              const job = imageJob ?? data.imageJob?.id ?? null;
              return job && !handledJobs.current.has(job) ? <ImageJobIndicator key={job} jobId={job} onDone={onImageDone} /> : null;
            })()}
            <div ref={endRef} />
          </div>

          {ended ? (
            <div className="card life-ended-card stack-sm" role="status">
              <h2 className="row">
                <Skull aria-hidden /> {t('life.endedTitle')}
              </h2>
              {data.ending && <p>{data.ending}</p>}
              <p className="small muted">{t('life.endedText')}</p>
              <Link to="/life/new" className="btn btn-primary">
                <Sparkles aria-hidden /> {t('life.newAfterEnd')}
              </Link>
            </div>
          ) : (
            <div className="life-composer-wrap">
              <SuggestionButtons suggestions={suggestions} disabled={busy} onPick={(s) => act({ suggestionId: s.id })} />
              <form
                className="chat-composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim()) act({ text: draft.trim() });
                }}
              >
                <textarea
                  className="textarea"
                  rows={1}
                  value={draft}
                  maxLength={MAX_INPUT}
                  placeholder={t('life.composerPlaceholder')}
                  aria-label={t('life.composerLabel')}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim()) act({ text: draft.trim() });
                    }
                  }}
                />
                <button type="submit" className="btn btn-primary" disabled={!draft.trim() || busy} aria-label={t('life.act')}>
                  {busy ? <span className="spinner" aria-hidden /> : <Send aria-hidden />}
                </button>
              </form>
            </div>
          )}
        </section>

        <aside className="life-side" aria-label={t('life.tabStatus')}>
          {desktop ? (
            <>
              <StatBars story={data} />
              <CharacterPanel story={data} />
              <div className="life-side-tabs">
                <details>
                  <summary className="card-heading">{t('life.tabTimeline')}</summary>
                  <TimelinePanel story={data} />
                </details>
                <details>
                  <summary className="card-heading">{t('life.tabMemory')}</summary>
                  <MemoryPanel story={data} />
                </details>
              </div>
            </>
          ) : (
            <>
              {tab === 'status' && <StatBars story={data} />}
              {tab === 'characters' && <CharacterPanel story={data} />}
              {tab === 'timeline' && <TimelinePanel story={data} />}
              {tab === 'memory' && <MemoryPanel story={data} />}
            </>
          )}
        </aside>
      </div>

      {imageOpen && (
        <ImageDialog
          busy={actions.image.isPending}
          onClose={() => setImageOpen(false)}
          onSubmit={(description) =>
            actions.image.mutate(description, {
              onSuccess: (r) => {
                setImageOpen(false);
                if (r.job && (r.job.status === 'queued' || r.job.status === 'running')) setImageJob(r.job.id);
              },
              onError: showError,
            })
          }
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t('life.delete')}
          text={t('life.confirmDelete', { title: data.title })}
          confirmLabel={t('common.delete')}
          danger
          busy={actions.remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            actions.remove.mutate(undefined, {
              onSuccess: () => {
                push('success', t('life.deleted'));
                navigate('/life');
              },
              onError: showError,
            })
          }
        />
      )}
    </div>
  );
}
