import { CheckCircle2, Circle, Gift, Hourglass, Scale } from 'lucide-react';
import { useState } from 'react';
import type { DecisionDto, WorldQuestProgressDto } from '../../../shared/types';
import { useChooseOption, useClaimWorldQuest, useDecisions, useProgress, useWorldActions, useWorldQuests } from '../api/hooks';
import { EffectChips, NotJoinedState, PlayerStatusBar, useActivePlay } from '../components/play/PlayUI';
import { QuestItem } from '../components/progress/QuestItem';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { ConfirmDialog } from '../components/ui/Modal';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

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
          <li key={o.id} className="decision-option">
            <div className="grow min-w-0 stack-xs">
              <strong className="small">{o.label}</strong>
              <EffectChips effects={o.effects} />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={choose.isPending} onClick={() => setConfirm({ id: o.id, label: o.label })}>
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
      <PlayerStatusBar player={player} coins={boot.coins} />
      <div className="with-rail">
        <div className="stack">
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
              <h2>{t('tasks.worldQuests')}</h2>
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
