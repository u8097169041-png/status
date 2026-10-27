import { Check, Compass, Flame, Handshake, HeartHandshake, MessageSquareWarning, PartyPopper, PenLine, Star, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { LIMITS, RELATIONSHIP_KINDS, type RelationshipKind } from '../../../../shared/constants';
import type { CharacterSummary, RelationshipDto, WorldDetail } from '../../../../shared/types';
import { useEventCards, useWorldActions } from '../../api/hooks';
import { useI18n, type TKey } from '../../i18n';
import { useErrorToast, useProgressFeedback } from '../progress/useProgressFeedback';
import { Avatar } from '../ui/Avatar';
import { HuePicker, ListEditor, SelectField, TextArea, TextField } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const CARD_ICONS: Record<string, LucideIcon> = {
  festival: PartyPopper,
  rumor: MessageSquareWarning,
  mystery: Compass,
  reconcile: HeartHandshake,
  crisis: Flame,
  alliance: Handshake,
  spotlight: Star,
  custom: PenLine,
};

function CharacterPicker({
  characters,
  selected,
  max,
  onChange,
}: {
  characters: CharacterSummary[];
  selected: string[];
  max: number;
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="picker-grid">
      {characters.map((c) => {
        const isSelected = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={`picker-item ${isSelected ? 'selected' : ''}`}
            aria-pressed={isSelected}
            onClick={() => {
              if (isSelected) onChange(selected.filter((id) => id !== c.id));
              else onChange(max === 1 ? [c.id] : [...selected, c.id].slice(-max));
            }}
          >
            <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="sm" decorative />
            <span className="truncate">{c.name}</span>
            {isSelected && <Check aria-hidden className="icon-xs" />}
          </button>
        );
      })}
    </div>
  );
}

export function TriggerEventModal({ world, onClose }: { world: WorldDetail; onClose: () => void }) {
  const { t } = useI18n();
  const { data: cards } = useEventCards();
  const { trigger } = useWorldActions(world.id);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [cardId, setCardId] = useState('festival');
  const [targets, setTargets] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [effect, setEffect] = useState<'harmony' | 'tension' | 'discovery'>('discovery');
  const card = cards?.find((c) => c.id === cardId);
  const needed = card?.needsTargets ?? 0;
  const ready = targets.length >= needed && (cardId !== 'custom' || title.trim().length > 0);

  return (
    <Modal
      wide
      title={t('cards.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!ready || trigger.isPending}
            onClick={() =>
              trigger.mutate(
                {
                  cardId,
                  targetIds: targets.slice(0, needed || 2),
                  customTitle: cardId === 'custom' ? title : undefined,
                  customDescription: cardId === 'custom' ? description : undefined,
                  customEffect: cardId === 'custom' ? effect : undefined,
                },
                {
                  onSuccess: (r) => {
                    push('success', t('cards.triggered'), r.events[0]?.title);
                    feedback(r.progress);
                    onClose();
                  },
                  onError: showError,
                },
              )
            }
          >
            {trigger.isPending && <span className="spinner" aria-hidden />}
            {trigger.isPending ? t('cards.triggering') : t('cards.trigger')}
          </button>
        </>
      }
    >
      <p className="muted small">{t('cards.subtitle', { world: world.name })}</p>
      {world.characters.length === 0 && <div className="notice notice-warning">{t('worlds.noCharactersNotice')}</div>}
      <div className="field">
        <span className="field-label">{t('cards.choose')}</span>
        <div className="event-card-grid" role="radiogroup" aria-label={t('cards.choose')}>
          {(cards ?? []).map((c) => {
            const Icon = CARD_ICONS[c.id] ?? Star;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={cardId === c.id}
                className={`event-card ${cardId === c.id ? 'selected' : ''}`}
                onClick={() => {
                  setCardId(c.id);
                  setTargets((prev) => prev.slice(0, c.needsTargets));
                }}
              >
                <Icon aria-hidden />
                <strong>{t(`cards.${c.id}` as TKey)}</strong>
                <span>{t(`cards.${c.id}Desc` as TKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {cardId === 'custom' && (
        <div className="form-grid">
          <TextField label={t('cards.customTitle')} value={title} onChange={setTitle} max={LIMITS.eventTitle} />
          <TextArea label={t('cards.customDescription')} value={description} onChange={setDescription} max={LIMITS.eventDescription} rows={3} />
          <SelectField
            label={t('cards.customEffect')}
            value={effect}
            onChange={setEffect}
            options={(['harmony', 'tension', 'discovery'] as const).map((m) => ({ value: m, label: t(`metrics.${m}`) }))}
          />
        </div>
      )}
      {(needed > 0 || cardId === 'custom') && world.characters.length > 0 && (
        <div className="field">
          <span className="field-label">{t('cards.targets', { count: needed || `0–2` })}</span>
          {needed > 0 && <span className="field-hint">{t('cards.targetsHint', { count: needed })}</span>}
          <CharacterPicker characters={world.characters} selected={targets} max={needed || 2} onChange={setTargets} />
        </div>
      )}
    </Modal>
  );
}

export function RelationshipModal({
  world,
  relationship,
  onClose,
}: {
  world: WorldDetail;
  relationship?: RelationshipDto;
  onClose: () => void;
}) {
  const { t, td } = useI18n();
  const { addRelationship, updateRelationship } = useWorldActions(world.id);
  const showError = useErrorToast();
  const { push } = useToast();
  const [aId, setAId] = useState(relationship?.a.id ?? world.characters[0]?.id ?? '');
  const [bId, setBId] = useState(relationship?.b.id ?? world.characters[1]?.id ?? '');
  const [kind, setKind] = useState<RelationshipKind>(relationship?.kind ?? 'friend');
  const [affinity, setAffinity] = useState(relationship?.affinity ?? 30);
  const [note, setNote] = useState(relationship?.note ?? '');
  const options = world.characters.map((c) => ({ value: c.id, label: c.name }));
  const busy = addRelationship.isPending || updateRelationship.isPending;
  const submit = () => {
    const callbacks = {
      onSuccess: () => {
        push('success', relationship ? t('relationship.updated') : t('relationship.created'));
        onClose();
      },
      onError: showError,
    };
    if (relationship) updateRelationship.mutate({ relId: relationship.id, kind, affinity, note }, callbacks);
    else addRelationship.mutate({ aId, bId, kind, affinity, note }, callbacks);
  };
  return (
    <Modal
      title={relationship ? t('relationship.edit') : t('relationship.add')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className="btn btn-primary" disabled={!aId || !bId || aId === bId || busy} onClick={submit}>
            {relationship ? t('common.save') : t('common.create')}
          </button>
        </>
      }
    >
      {relationship ? (
        <p className="small">
          <strong>{relationship.a.name}</strong> & <strong>{relationship.b.name}</strong>
        </p>
      ) : (
        <div className="form-grid two">
          <SelectField label={t('relationship.a')} value={aId} onChange={setAId} options={options} />
          <SelectField label={t('relationship.b')} value={bId} onChange={setBId} options={options} />
        </div>
      )}
      <SelectField
        label={t('relationship.kind')}
        value={kind}
        onChange={setKind}
        options={RELATIONSHIP_KINDS.map((k) => ({ value: k, label: td(`relationshipKinds.${k}`, k) }))}
      />
      <div className="field">
        <label className="field-label" htmlFor="rel-affinity">
          {t('relationship.affinityValue', { value: affinity })}
        </label>
        <input id="rel-affinity" type="range" min={-100} max={100} value={affinity} onChange={(e) => setAffinity(Number(e.target.value))} />
      </div>
      <TextField label={t('relationship.note')} value={note} onChange={setNote} max={LIMITS.characterShortText} />
    </Modal>
  );
}

export function StorylineModal({ world, onClose }: { world: WorldDetail; onClose: () => void }) {
  const { t } = useI18n();
  const { addStoryline } = useWorldActions(world.id);
  const showError = useErrorToast();
  const { push } = useToast();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [stages, setStages] = useState<string[]>([]);
  const [theme, setTheme] = useState<'harmony' | 'tension' | 'discovery'>('discovery');
  return (
    <Modal
      title={t('storyline.create')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!title.trim() || stages.length < 2 || addStoryline.isPending}
            onClick={() =>
              addStoryline.mutate(
                { title, summary, stages, theme },
                {
                  onSuccess: () => {
                    push('success', t('storyline.created'));
                    onClose();
                  },
                  onError: showError,
                },
              )
            }
          >
            {t('common.create')}
          </button>
        </>
      }
    >
      <TextField label={t('storyline.title')} value={title} onChange={setTitle} max={LIMITS.eventTitle} />
      <TextArea label={t('storyline.summary')} value={summary} onChange={setSummary} max={LIMITS.eventDescription} rows={3} />
      <ListEditor label={t('storyline.stages')} values={stages} onChange={setStages} placeholder={t('storyline.stagePlaceholder')} max={8} maxLength={LIMITS.worldRule} />
      <SelectField
        label={t('storyline.theme')}
        value={theme}
        onChange={setTheme}
        hint={t('storyline.themeHint')}
        options={(['harmony', 'tension', 'discovery'] as const).map((m) => ({ value: m, label: t(`metrics.${m}`) }))}
      />
    </Modal>
  );
}

export function GroupModal({ world, onClose }: { world: WorldDetail; onClose: () => void }) {
  const { t } = useI18n();
  const { addGroup } = useWorldActions(world.id);
  const showError = useErrorToast();
  const { push } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hue, setHue] = useState(world.hue);
  const [members, setMembers] = useState<string[]>([]);
  return (
    <Modal
      title={t('group.create')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!name.trim() || addGroup.isPending}
            onClick={() =>
              addGroup.mutate(
                { name, description, hue, memberIds: members },
                {
                  onSuccess: () => {
                    push('success', t('group.created'));
                    onClose();
                  },
                  onError: showError,
                },
              )
            }
          >
            {t('common.create')}
          </button>
        </>
      }
    >
      <TextField label={t('group.name')} value={name} onChange={setName} max={LIMITS.groupName} />
      <TextField label={t('group.description')} value={description} onChange={setDescription} max={LIMITS.characterShortText} />
      <HuePicker label={t('group.color')} value={hue} onChange={setHue} />
      {world.characters.length > 0 && (
        <div className="field">
          <span className="field-label">{t('group.members')}</span>
          <CharacterPicker characters={world.characters} selected={members} max={world.characters.length} onChange={setMembers} />
        </div>
      )}
    </Modal>
  );
}
