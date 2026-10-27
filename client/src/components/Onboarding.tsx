import { Bot, Cpu, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { LIMITS, type Lang } from '../../../shared/constants';
import type { BootstrapDto } from '../../../shared/types';
import { useResetData, useUpdateProfile, useUpdateSettings } from '../api/hooks';
import { useI18n } from '../i18n';
import { useErrorToast } from './progress/useProgressFeedback';
import { Avatar } from './ui/Avatar';
import { HuePicker, TextField } from './ui/Form';
import { Modal } from './ui/Modal';

function toHandle(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, LIMITS.characterHandle) || 'gast'
  );
}

/** Kurze Einführung beim ersten Start: Sprache, Name und Erklärung des Demo-/KI-Modus. */
export function Onboarding({ boot }: { boot: BootstrapDto }) {
  const { t } = useI18n();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const reset = useResetData();
  const showError = useErrorToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(boot.hasUserActivity ? boot.profile.displayName : '');
  const [hue, setHue] = useState(boot.profile.avatarHue);
  const lang = boot.settings.language;
  const needsReseed = lang !== boot.contentLanguage && !boot.hasUserActivity;
  const busy = updateSettings.isPending || updateProfile.isPending || reset.isPending;

  const chooseLanguage = (l: Lang) => updateSettings.mutate({ language: l }, { onError: showError });

  const next = () => {
    if (step === 0) {
      if (needsReseed) reset.mutate({ language: lang }, { onSuccess: () => setStep(1), onError: showError });
      else setStep(1);
    } else if (step === 1) {
      const displayName = name.trim() || (lang === 'de' ? 'Gast' : 'Guest');
      updateProfile.mutate({ displayName, handle: toHandle(displayName), avatarHue: hue }, { onSuccess: () => setStep(2), onError: showError });
    } else {
      updateSettings.mutate({ onboardingDone: true }, { onError: showError });
    }
  };

  return (
    <Modal
      title={t('onboarding.title')}
      onClose={() => updateSettings.mutate({ onboardingDone: true })}
      footer={
        <>
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
              {t('common.back')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={next} disabled={busy} data-autofocus>
            {busy && <span className="spinner" aria-hidden />}
            {busy ? t('onboarding.preparing') : step === 2 ? t('onboarding.start') : t('common.next')}
          </button>
        </>
      }
    >
      <div className="onboarding-steps" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= step ? 'active' : ''} />
        ))}
      </div>
      {step === 0 && (
        <div className="stack">
          <p className="onboarding-intro">
            <Sparkles aria-hidden className="icon-sm accent" /> {t('onboarding.intro')}
          </p>
          <div className="field">
            <span className="field-label">{t('onboarding.stepLanguage')}</span>
            <div className="lang-choice" role="radiogroup" aria-label={t('onboarding.stepLanguage')}>
              {(['de', 'en'] as const).map((l) => (
                <button key={l} type="button" role="radio" aria-checked={lang === l} className={`lang-option ${lang === l ? 'selected' : ''}`} onClick={() => chooseLanguage(l)}>
                  <strong>{l === 'de' ? 'Deutsch' : 'English'}</strong>
                </button>
              ))}
            </div>
            {needsReseed && <span className="field-hint">{t('onboarding.reseedHint')}</span>}
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="stack">
          <div className="row">
            <Avatar name={name || '?'} hue={hue} size="xl" decorative />
            <div className="grow">
              <TextField label={t('onboarding.stepProfile')} value={name} onChange={setName} max={LIMITS.profileName} placeholder={lang === 'de' ? 'z. B. Alex' : 'e.g. Alex'} />
            </div>
          </div>
          <HuePicker label={t('profile.avatarColor')} value={hue} onChange={setHue} />
        </div>
      )}
      {step === 2 && (
        <div className="stack">
          <h3>{t('onboarding.stepMode')}</h3>
          <div className="mode-explain">
            <Cpu aria-hidden />
            <p className="small">{t('onboarding.modeDemo')}</p>
          </div>
          <div className="mode-explain">
            <Bot aria-hidden />
            <p className="small">{t('onboarding.modeAi')}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
