import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useCharacter, useCharacterMutations } from '../api/hooks';
import { CharacterForm, EMPTY_CHARACTER } from '../components/characters/CharacterForm';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';

export function CharacterCreatePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { create } = useCharacterMutations();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const initial = { ...EMPTY_CHARACTER, worldId: params.get('world'), avatarHue: Math.floor(Math.random() * 360) };
  return (
    <div className="page">
      <Link to="/characters" className="back-link">
        <ArrowLeft aria-hidden /> {t('nav.characters')}
      </Link>
      <header className="page-header">
        <h1>{t('characterForm.createTitle')}</h1>
      </header>
      <CharacterForm
        initial={initial}
        submitLabel={t('characterForm.create')}
        busy={create.isPending}
        onCancel={() => navigate(-1)}
        onSubmit={(input) =>
          create.mutate(input, {
            onSuccess: (r) => {
              push('success', t('characterForm.created', { name: r.character.name }));
              feedback(r.progress);
              navigate(`/characters/${r.character.id}`);
            },
            onError: showError,
          })
        }
      />
    </div>
  );
}

export function CharacterEditPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const navigate = useNavigate();
  const query = useCharacter(id);
  const { update } = useCharacterMutations();
  const showError = useErrorToast();
  const { push } = useToast();
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data.character;
  if (!c.isCustom) {
    return (
      <div className="page">
        <EmptyState title={t('characters.readOnlyPreset')} action={<Link to={`/characters/${c.id}`} className="btn btn-secondary">{t('common.back')}</Link>} />
      </div>
    );
  }
  return (
    <div className="page">
      <Link to={`/characters/${c.id}`} className="back-link">
        <ArrowLeft aria-hidden /> {c.name}
      </Link>
      <header className="page-header">
        <h1>{t('characterForm.editTitle')}</h1>
      </header>
      <CharacterForm
        initial={{
          name: c.name,
          handle: c.handle,
          tagline: c.tagline,
          description: c.description,
          role: c.role,
          worldId: c.worldId,
          personality: c.personality,
          interests: c.interests,
          background: c.background,
          writingStyle: c.writingStyle,
          styleNotes: c.styleNotes,
          rules: c.rules,
          avatarHue: c.avatarHue,
          avatarGlyph: c.avatarGlyph,
          isRealPersonSim: c.isRealPersonSim,
        }}
        submitLabel={t('common.save')}
        busy={update.isPending}
        onCancel={() => navigate(`/characters/${c.id}`)}
        onSubmit={(input) =>
          update.mutate(
            { id: c.id, input },
            {
              onSuccess: () => {
                push('success', t('characterForm.saved'));
                navigate(`/characters/${c.id}`);
              },
              onError: showError,
            },
          )
        }
      />
    </div>
  );
}
