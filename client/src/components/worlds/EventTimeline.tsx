import { ArrowDown, ArrowUp, BookOpen, Heart, HeartCrack, Lock, Megaphone, Repeat } from 'lucide-react';
import { useBootstrap, useReactToEvent } from '../../api/hooks';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { useToast } from '../ui/Toast';
import type { EventEffect, WorldEventDto } from '../../../../shared/types';
import { useI18n } from '../../i18n';
import { Avatar } from '../ui/Avatar';
import { RelativeTime } from '../ui/RelativeTime';

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function EffectChip({ effect }: { effect: EventEffect }) {
  const { t, td } = useI18n();
  switch (effect.type) {
    case 'metric':
      return (
        <span className={`effect ${effect.delta >= 0 ? 'up' : 'down'}`}>
          {effect.delta >= 0 ? <ArrowUp aria-hidden /> : <ArrowDown aria-hidden />}
          {t('effects.metric', { metric: t(`metrics.${effect.metric}`), delta: signed(effect.delta) })}
        </span>
      );
    case 'affinity':
      return (
        <span className={`effect ${effect.delta >= 0 ? 'up' : 'down'}`}>
          {effect.delta >= 0 ? <Heart aria-hidden /> : <HeartCrack aria-hidden />}
          {t('effects.affinity', { a: effect.a.name, b: effect.b.name, delta: signed(effect.delta), value: effect.affinity })}
        </span>
      );
    case 'relationshipKind':
      return (
        <span className="effect accent">
          <Repeat aria-hidden />
          {t('effects.relationshipKind', {
            a: effect.a.name,
            b: effect.b.name,
            from: td(`relationshipKinds.${effect.from}`, effect.from),
            to: td(`relationshipKinds.${effect.to}`, effect.to),
          })}
        </span>
      );
    case 'storyline':
      return (
        <span className="effect accent">
          <BookOpen aria-hidden />
          {effect.resolved
            ? t('effects.storylineResolved', { title: effect.title })
            : t('effects.storyline', { title: effect.title, stage: effect.stage + 1 })}
        </span>
      );
  }
}

export function eventKindLabel(kind: string, td: (k: string, f?: string) => string): string {
  if (kind.startsWith('card-')) return td('eventKinds.user');
  return td(`eventKinds.${kind}`, kind);
}

/** Öffentliche Reaktion auf ein Ereignis (Medienkompetenz 1) – nur in der Welt, in der man spielt. */
function ReactButton({ event }: { event: WorldEventDto }) {
  const { t } = useI18n();
  const { data: boot } = useBootstrap();
  const react = useReactToEvent();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const player = boot?.activePlayer;
  if (!player || player.worldId !== event.worldId || !REACTABLE.has(event.kind)) return null;
  const locked = player.skills.media < 1;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm event-react"
      disabled={locked || react.isPending}
      title={locked ? t('questBoard.reactLocked') : undefined}
      onClick={() =>
        react.mutate(
          { eventId: event.id },
          {
            onSuccess: (r) => {
              push('success', t('questBoard.reacted'), t('composer.reach', { followers: r.reach.followers }));
              feedback(r.progress);
            },
            onError: showError,
          },
        )
      }
    >
      {locked ? <Lock aria-hidden /> : <Megaphone aria-hidden />}
      {t('questBoard.react')}
    </button>
  );
}

const REACTABLE = new Set([
  'conflict',
  'rumor',
  'rivalry',
  'celebration',
  'discovery',
  'setback',
  'reconciliation',
  'friendship',
  'storyline',
  'storyline-new',
  'storyline-resolved',
  'storyline-ending',
  'gathering',
  'crisis',
  'mystery',
  'milestone',
  'cooperation',
]);

export function EventItem({ event, worldName, reactable }: { event: WorldEventDto; worldName?: string; reactable?: boolean }) {
  const { t, td } = useI18n();
  return (
    <li className={`event-item kind-${event.kind.startsWith('card-') ? 'user' : event.kind}`}>
      <span className="event-dot" aria-hidden />
      <div className="event-body">
        <div className="row wrap event-meta">
          <span className="badge">{eventKindLabel(event.kind, td)}</span>
          {worldName && <span className="xsmall muted">{worldName}</span>}
          <span className="xsmall faint">
            {t('worlds.day', { day: event.day })} · <RelativeTime iso={event.createdAt} />
          </span>
        </div>
        <h4>{event.title}</h4>
        {event.description && <p className="small muted">{event.description}</p>}
        {(event.participants.length > 0 || event.effects.length > 0) && (
          <div className="event-footer">
            {event.participants.length > 0 && (
              <span className="avatar-stack" role="img" aria-label={event.participants.map((p) => p.name).join(', ')}>
                {event.participants.map((p) => (
                  <Avatar key={p.id} name={p.name} hue={p.avatarHue} glyph={p.avatarGlyph} size="xs" decorative />
                ))}
              </span>
            )}
            {event.effects.map((effect, i) => (
              <EffectChip key={i} effect={effect} />
            ))}
          </div>
        )}
        {reactable && <ReactButton event={event} />}
      </div>
    </li>
  );
}

export function EventTimeline({
  events,
  showWorld,
  reactable,
}: {
  events: (WorldEventDto & { worldName?: string })[];
  showWorld?: boolean;
  reactable?: boolean;
}) {
  return (
    <ol className="timeline">
      {events.map((e) => (
        <EventItem key={e.id} event={e} worldName={showWorld ? e.worldName : undefined} reactable={reactable} />
      ))}
    </ol>
  );
}
