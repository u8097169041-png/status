import { CheckCircle2, Circle, Crown, Gift, Hourglass, Lock, Scale, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ArcPath, DecisionDto, WorldQuestProgressDto } from '../../../shared/types';
import { useChooseOption, useClaimWorldQuest, useDecisions, useProgress, useQuestBoard, useWorldActions, useWorldQuests } from '../api/hooks';
import { LevelCard, QuestCard } from '../components/play/QuestUI';
import { EffectChips, NotJoinedState, PlayerStatusBar, useActivePlay } from '../components/play/PlayUI';
import { QuestItem } from '../components/progress/QuestItem';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { ConfirmDialog } from '../components/ui/Modal';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n, type TKey } from '../i18n';

const ARC_PATH_LABEL: Record<ArcPath, TKey> = {
  bold: 'tasks.arcBold',
  diplomatic: 'tasks.arcDiplomatic',
  neutral: 'tasks.arcNeutral',
};

function DecisionCard({ decision }: { decision: DecisionDto }) {
  const { t } = useI18n();
  const choose = useChooseOption();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [confirm, setConfirm] = useState<{ id: string; label: string } | null>(null);
  return (
    <article className="decision card" aria-labelledby={`decision-${decision.id}`}>
      <header className="decision-header">
        <Scale aria-hidden className="icon-sm accent" />
        <h3 id={`decision-${decision.id}`}>{decision.title}</h3>
        <span className="xsmall faint">
          <RelativeTime iso={decision.createdAt} />
        </span>
      </header>
      {decision.participants.length > 0 && (
        <div className="row wrap">
          {decision.participants.map((p) => (
            <span key={p.id} className="chip chip-static">
              <Avatar name={p.name} hue={p.avatarHue} glyph={p.avatarGlyph} size="xs" decorative /> {p.name}
            </span>
          ))}
        </div>
      )}
      <p className="small">{decision.description}</p>
      <ul className="decision-options">
        {decision.options.map((o) => (
          <li key={o.id} className={`decision-option ${o.locked ? 'locked' : ''} ${o.requires ? 'skill-option' : ''}`}>
            <div className="grow min-w-0 stack-xs">
              <strong className="small row wrap">
                {o.label}
                {o.requires && (
                  <span className={`badge ${o.locked ? '' : 'badge-player'}`}>
                    {o.locked ? <Lock aria-hidden /> : <Sparkles aria-hidden />}
                    {t('tasks.lockedOption', { skill: t(`skills.${o.requires.skill}` as TKey), level: o.requires.level })}
                  </span>
                )}
                {o.arcPath && <span className={`badge arc-path path-${o.arcPath}`}>{t(ARC_PATH_LABEL[o.arcPath])}</span>}
              </strong>
              <EffectChips effects={o.effects} />
              {o.outcomePreview && <span className="xsmall muted">{t('tasks.preview', { text: o.outcomePreview })}</span>}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={choose.isPending || o.locked}
              onClick={() => setConfirm({ id: o.id, label: o.label })}
            >
              {o.locked ? <Lock aria-hidden /> : null}
              {t('tasks.choose')}
            </button>
          </li>
        ))}
      </ul>
      {confirm && (
        <ConfirmDialog
          title={t('tasks.confirmTitle')}
          text={t('tasks.confirmText', { option: confirm.label })}
          confirmLabel={t('common.confirm')}
          busy={choose.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            choose.mutate(
              { id: decision.id, optionId: confirm.id },
              {
                onSuccess: (r) => {
                  setConfirm(null);
                  push('success', t('tasks.decided'), r.decision.outcome ?? undefined);
                  feedback(r.progress);
                },
                onError: (error) => {
                  setConfirm(null);
                  showError(error);
                },
              },
            )
          }
        />
      )}
    </article>
  );
}

function WorldQuestItem({ quest, worldId }: { quest: WorldQuestProgressDto; worldId: string }) {
  const { t, td } = useI18n();
  const claim = useClaimWorldQuest(worldId);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const label = td(`worldQuests.${quest.id}`, quest.id);
  const pct = Math.round((quest.current / quest.target) * 100);
  return (
    <li className={`quest ${quest.claimed ? 'claimed' : quest.completed ? 'completed' : ''}`}>
      <span className="quest-icon" aria-hidden>
        {quest.completed ? <CheckCircle2 /> : <Circle />}
      </span>
      <div className="quest-body">
        <div className="row-between">
          <strong className="small">{label}</strong>
          <span className="row">
            <span className="badge">+{quest.xp} XP</span>
            <span className="badge badge-coins">+{quest.coins}</span>
          </span>
        </div>
        <div className="row">
          <div className="progress progress-sm grow" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={quest.current}>
            <span style={{ width: `${pct}%` }} />
          </div>
          <span className="xsmall faint">
            {quest.current}/{quest.target}
          </span>
        </div>
      </div>
      {quest.completed && !quest.claimed && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={claim.isPending}
          onClick={() =>
            claim.mutate(quest.id, {
              onSuccess: (r) => {
                push('success', t('progress.claimedToast'));
                feedback(r.progress);
              },
              onError: showError,
            })
          }
        >
          <Gift aria-hidden /> {t('progress.claim')}
        </button>
      )}
      {quest.claimed && <span className="xsmall success-text">{t('progress.claimed')}</span>}
    </li>
  );
}

/** Aufgaben der aktiven Spielfigur: Entscheidungen, Weltaufgaben, Tagesquests und Meilensteine. */
export function TasksPage() {
  const { t } = useI18n();
  const { boot, worldId, world, player } = useActivePlay();
  const pending = useDecisions(worldId, 'pending');
  const resolved = useDecisions(worldId, 'resolved');
  const quests = useWorldQuests(worldId);
  const progress = useProgress();
  const board = useQuestBoard(worldId);
  const feedbackBoard = useProgressFeedback();
  // Beim Laden abgeschlossene Quests (z. B. durch die Simulation) einmal anzeigen.
  const shownProgress = useRef<unknown>(null);
  useEffect(() => {
    if (board.data && shownProgress.current !== board.data.progress) {
      shownProgress.current = board.data.progress;
      feedbackBoard(board.data.progress);
    }
  }, [board.data, feedbackBoard]);
  const mediaLevel = board.data?.player.skills.media ?? 0;
  const { simulate } = useWorldActions(worldId ?? '');
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();

  if (!worldId || !player || !world || !boot) {
    return (
      <div className="page">
        <NotJoinedState />
      </div>
    );
  }

  return (
    <div className="page stack">
      <header className="page-header">
        <div className="titles">
          <h1>{t('tasks.title')}</h1>
          <p>
            {t('tasks.subtitle')} · {world.name}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={simulate.isPending}
          onClick={() =>
            simulate.mutate(undefined, {
              onSuccess: (r) => {
                push('info', r.events.length ? t('worlds.simulated', { day: r.world.day, count: r.events.length }) : t('worlds.simulatedNone'));
                feedback(r.progress);
              },
              onError: showError,
            })
          }
        >
          {simulate.isPending ? <span className="spinner" aria-hidden /> : <Hourglass aria-hidden />} {t('tasks.advanceTime')}
        </button>
      </header>
      {board.data && <LevelCard player={board.data.player} />}
      <PlayerStatusBar player={player} coins={boot.coins} />
      <div className="with-rail">
        <div className="stack">
          <section className="section" aria-labelledby="tasks-main">
            <div className="section-header">
              <h2 id="tasks-main">{t('questBoard.main')}</h2>
            </div>
            {board.isPending && <SkeletonList count={1} height={200} />}
            {board.isError && <ErrorState error={board.error} onRetry={() => void board.refetch()} />}
            {board.data &&
              (board.data.main ? (
                <QuestCard quest={board.data.main} highlight mediaLevel={mediaLevel} />
              ) : (
                <EmptyState icon={Crown} title={t('questBoard.mainDone')} />
              ))}
          </section>

          <section className="section" aria-labelledby="tasks-decisions">
            <div className="section-header">
              <h2 id="tasks-decisions">{t('tasks.decisions')}</h2>
            </div>
            {pending.isPending && <SkeletonList count={1} height={180} />}
            {pending.isError && <ErrorState error={pending.error} onRetry={() => void pending.refetch()} />}
            {pending.data && pending.data.length === 0 && <EmptyState icon={Scale} title={t('tasks.decisionsEmpty')} />}
            <div className="stack">
              {pending.data?.map((d) => (
                <DecisionCard key={d.id} decision={d} />
              ))}
            </div>
          </section>

          <section className="section" aria-labelledby="tasks-side">
            <div className="section-header">
              <h2 id="tasks-side">{t('questBoard.side')}</h2>
            </div>
            {board.data && board.data.side.length === 0 && <p className="small muted">{t('questBoard.sideEmpty')}</p>}
            <div className="quest-grid">
              {board.data?.side.map((q) => (
                <QuestCard key={q.id} quest={q} mediaLevel={mediaLevel} />
              ))}
            </div>
          </section>

          <section className="section" aria-labelledby="tasks-events">
            <div className="section-header">
              <h2 id="tasks-events">{t('questBoard.events')}</h2>
            </div>
            {board.data && board.data.events.length === 0 && <p className="small muted">{t('questBoard.eventsEmpty')}</p>}
            {board.data?.events.map((q) => (
              <QuestCard key={q.id} quest={q} mediaLevel={mediaLevel} />
            ))}
            {board.data && board.data.events.length > 0 && <p className="xsmall faint">{t('questBoard.reactHint')}</p>}
          </section>

          <section className="section" aria-labelledby="tasks-completed">
            <div className="section-header">
              <h2 id="tasks-completed">{t('questBoard.completed')}</h2>
            </div>
            {board.data && board.data.completed.length === 0 && <p className="small muted">{t('questBoard.completedEmpty')}</p>}
            <ul className="completed-quests">
              {board.data?.completed.map((q) => (
                <li key={q.id} className="card card-tight row">
                  <CheckCircle2 aria-hidden className="icon-sm success-text" />
                  <span className="grow min-w-0">
                    <strong className="small block truncate">{q.title}</strong>
                    <span className="xsmall muted">{q.kind === 'main' ? t('questBoard.main') : q.kind === 'event' ? t('questBoard.events') : t('questBoard.side')}</span>
                  </span>
                  <span className="badge">+{q.xp} XP</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="section" aria-labelledby="tasks-history">
            <div className="section-header">
              <h2 id="tasks-history">{t('tasks.history')}</h2>
            </div>
            {resolved.data && resolved.data.length === 0 && <p className="small muted">{t('tasks.historyEmpty')}</p>}
            <ul className="decision-history">
              {resolved.data?.map((d) => (
                <li key={d.id} className="card card-tight">
                  <div className="row-between">
                    <strong className="small">{d.title}</strong>
                    {d.resolvedAt && (
                      <span className="xsmall faint">
                        <RelativeTime iso={d.resolvedAt} />
                      </span>
                    )}
                  </div>
                  <p className="xsmall accent">{t('tasks.chosen', { option: d.options.find((o) => o.id === d.chosenOptionId)?.label ?? '' })}</p>
                  {d.outcome && <p className="small muted">{d.outcome}</p>}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="rail rail-visible-mobile">
          <section className="card">
            <div className="card-title">
              <h2>{t('questBoard.worldMilestones')}</h2>
            </div>
            <p className="xsmall muted">{t('tasks.worldQuestsHint')}</p>
            {quests.isError && <ErrorState error={quests.error} onRetry={() => void quests.refetch()} />}
            <ul className="quest-list">
              {quests.data?.map((q) => (
                <WorldQuestItem key={q.id} quest={q} worldId={worldId} />
              ))}
            </ul>
          </section>
          {progress.data && (
            <>
              <section className="card">
                <div className="card-title">
                  <h2>{t('tasks.daily')}</h2>
                </div>
                <ul className="quest-list">
                  {progress.data.daily.map((q) => (
                    <QuestItem key={q.id} quest={q} />
                  ))}
                </ul>
              </section>
              <section className="card">
                <div className="card-title">
                  <h2>{t('tasks.milestones')}</h2>
                </div>
                <ul className="quest-list">
                  {progress.data.general.map((q) => (
                    <QuestItem key={q.id} quest={q} />
                  ))}
                </ul>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
