import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { LIMITS, type Lang } from '../../../shared/constants';
import type { AiModelDto, AppSettings, DeepPartial } from '../../../shared/types';
import {
  useAiActions,
  useAiModels,
  useAiStatus,
  useAiUsage,
  useBootstrap,
  useResetData,
  useSimulationStatus,
  useUpdateSettings,
} from '../api/hooks';
import { AiModeBadge } from '../components/AiModeBadge';
import { useErrorToast } from '../components/progress/useProgressFeedback';
import { NumberField, SelectField, Toggle } from '../components/ui/Form';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { formatDateTime, formatNumber, formatUsd, perMillion } from '../lib/format';

const LANGUAGE_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

function ModelPicker({ title, onSelect, onClose }: { title: string; onSelect: (id: string) => void; onClose: () => void }) {
  const { t, locale } = useI18n();
  const models = useAiModels(true);
  const [search, setSearch] = useState('');
  const [freeOnly, setFreeOnly] = useState(true);
  const [manual, setManual] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (models.data ?? [])
      .filter((m) => (!freeOnly || m.isFree) && (!q || `${m.id} ${m.name}`.toLowerCase().includes(q)))
      .slice(0, 150);
  }, [models.data, search, freeOnly]);
  const price = (m: AiModelDto) =>
    m.isFree
      ? t('aiSettings.free')
      : m.promptPrice === null || m.completionPrice === null
        ? t('aiSettings.priceUnknown')
        : t('aiSettings.price', { prompt: perMillion(m.promptPrice, locale), completion: perMillion(m.completionPrice, locale) });

  return (
    <Modal title={title} onClose={onClose} wide>
      <p className="xsmall muted">{t('aiSettings.modelsHint')}</p>
      <div className="row wrap">
        <div className="search-wrap grow">
          <Search aria-hidden />
          <input
            type="search"
            className="input"
            placeholder={t('aiSettings.modelSearch')}
            aria-label={t('aiSettings.modelSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-autofocus
          />
        </div>
        <button type="button" className="chip" aria-pressed={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
          {t('aiSettings.freeOnly')}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void models.refetch()} disabled={models.isFetching}>
          <RefreshCw aria-hidden /> {t('aiSettings.reloadModels')}
        </button>
      </div>
      {models.isPending && <Loading label={t('aiSettings.modelsLoading')} />}
      {models.isError && (
        <div className="notice notice-danger">
          <XCircle aria-hidden />
          <span>{t('aiSettings.modelsError', { message: (models.error as Error).message })}</span>
        </div>
      )}
      {models.data && (
        <ul className="model-list">
          {filtered.map((m) => (
            <li key={m.id}>
              <button type="button" className="model-row" onClick={() => onSelect(m.id)}>
                <span className="grow min-w-0">
                  <strong className="small block truncate">{m.name}</strong>
                  <span className="xsmall faint block truncate">{m.id}</span>
                </span>
                <span className="xsmall muted model-price">
                  <span className={m.isFree ? 'success-text' : ''}>{price(m)}</span>
                  {m.contextLength && <span className="block faint">{t('aiSettings.contextLength', { count: formatNumber(m.contextLength, locale) })}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onSelect(manual.trim());
        }}
      >
        <input
          className="input"
          value={manual}
          maxLength={LIMITS.modelId}
          placeholder="provider/model-name"
          aria-label={t('aiSettings.manualModel')}
          onChange={(e) => setManual(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary" disabled={!manual.trim()}>
          {t('common.confirm')}
        </button>
      </form>
      <span className="xsmall faint">{t('aiSettings.manualModel')}</span>
    </Modal>
  );
}

function ModelRow({ label, value, placeholder, onPick, onClear }: { label: string; value: string; placeholder: string; onPick: () => void; onClear?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="model-setting">
      <span className="field-label">{label}</span>
      <div className="row">
        <code className="model-id grow truncate">{value || placeholder}</code>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onPick}>
          {t('aiSettings.chooseModel')}
        </button>
        {onClear && value && (
          <button type="button" className="icon-btn" onClick={onClear} aria-label={t('common.remove')}>
            <X />
          </button>
        )}
      </div>
    </div>
  );
}

function AiSection({ settings, save }: { settings: AppSettings; save: (patch: DeepPartial<AppSettings>) => void }) {
  const { t, td, locale } = useI18n();
  const { data: status } = useAiStatus();
  const usage = useAiUsage();
  const ai = useAiActions();
  const showError = useErrorToast();
  const { push } = useToast();
  const [key, setKey] = useState('');
  const [picker, setPicker] = useState<null | 'chat' | 'world' | 'fallback'>(null);
  const [showLog, setShowLog] = useState(false);
  const s = settings.ai;

  const pick = (id: string) => {
    if (picker === 'chat') save({ ai: { chatModel: id } });
    if (picker === 'world') save({ ai: { worldModel: id } });
    if (picker === 'fallback') save({ ai: { fallbackModels: [...s.fallbackModels.filter((m) => m !== id), id].slice(0, LIMITS.fallbackModels) } });
    setPicker(null);
  };

  const test = ai.test.data;
  return (
    <section id="ai" className="settings-section card stack">
      <h2 className="row">
        <Bot aria-hidden className="icon-sm accent" /> {t('settings.ai')}
      </h2>
      <AiModeBadge status={status} />

      <div className="stack-sm">
        <h3 className="card-heading row">
          <KeyRound aria-hidden className="icon-xs" /> {t('aiSettings.key')}
        </h3>
        {status?.keySource === 'env' && <p className="small">{t('aiSettings.keyFromEnv', { hint: status.keyHint ?? '' })}</p>}
        {status?.keySource === 'local' && (
          <div className="row-between">
            <p className="small">{t('aiSettings.keyStored', { hint: status.keyHint ?? '' })}</p>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => ai.removeKey.mutate(undefined, { onSuccess: () => push('success', t('aiSettings.keyRemoved')), onError: showError })}
            >
              <Trash2 aria-hidden /> {t('aiSettings.keyRemove')}
            </button>
          </div>
        )}
        {!status?.keyConfigured && <p className="small muted">{t('aiSettings.keyNone')}</p>}
        {status?.keySource !== 'env' && (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              ai.saveKey.mutate(key.trim(), {
                onSuccess: () => {
                  setKey('');
                  push('success', t('aiSettings.keySaved'));
                },
                onError: showError,
              });
            }}
          >
            <input
              type="password"
              className="input"
              autoComplete="off"
              value={key}
              maxLength={LIMITS.apiKeyLength}
              placeholder={t('aiSettings.keyPlaceholder')}
              aria-label={t('aiSettings.key')}
              onChange={(e) => setKey(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={key.trim().length < 10 || ai.saveKey.isPending}>
              {t('aiSettings.keySave')}
            </button>
          </form>
        )}
        <p className="xsmall faint">{t('aiSettings.keyNotice')}</p>
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="small row">
          {t('aiSettings.getKey')} <ExternalLink aria-hidden className="icon-xs" />
        </a>
      </div>

      <Toggle label={t('aiSettings.enabled')} hint={t('aiSettings.enabledHint')} checked={s.enabled} onChange={(v) => save({ ai: { enabled: v } })} />

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.models')}</h3>
        <ModelRow label={t('aiSettings.chatModel')} value={s.chatModel} placeholder={t('aiSettings.noModel')} onPick={() => setPicker('chat')} onClear={() => save({ ai: { chatModel: '' } })} />
        <ModelRow label={t('aiSettings.worldModel')} value={s.worldModel} placeholder={t('aiSettings.sameAsChat')} onPick={() => setPicker('world')} onClear={() => save({ ai: { worldModel: '' } })} />
        <div className="model-setting">
          <span className="field-label">{t('aiSettings.fallbacks')}</span>
          <span className="field-hint">{t('aiSettings.fallbacksHint')}</span>
          {s.fallbackModels.map((m) => (
            <div key={m} className="row">
              <code className="model-id grow truncate">{m}</code>
              <button type="button" className="icon-btn" aria-label={`${t('common.remove')}: ${m}`} onClick={() => save({ ai: { fallbackModels: s.fallbackModels.filter((x) => x !== m) } })}>
                <X />
              </button>
            </div>
          ))}
          {s.fallbackModels.length < LIMITS.fallbackModels && (
            <button type="button" className="btn btn-ghost btn-sm align-start" onClick={() => setPicker('fallback')}>
              <Plus aria-hidden /> {t('aiSettings.addFallback')}
            </button>
          )}
        </div>
      </div>

      <div className="row wrap">
        <button type="button" className="btn btn-secondary" onClick={() => ai.test.mutate(undefined, { onError: showError })} disabled={ai.test.isPending || !status?.keyConfigured}>
          {ai.test.isPending ? <span className="spinner" aria-hidden /> : <Activity aria-hidden />}
          {ai.test.isPending ? t('aiSettings.testing') : t('aiSettings.test')}
        </button>
        {test &&
          (test.ok ? (
            <span className="notice notice-success small">
              <CheckCircle2 aria-hidden />
              <span>{test.model ? t('aiSettings.testOk', { model: test.model, ms: test.durationMs }) : t('aiSettings.testKeyOk')}</span>
            </span>
          ) : (
            <span className="notice notice-danger small">
              <XCircle aria-hidden />
              <span>
                {t('aiSettings.testFailed', {
                  message: `${td(`aiErrors.${test.error?.code ?? ''}`, test.error?.code ?? '')} – ${test.error?.message ?? ''}`,
                })}
              </span>
            </span>
          ))}
      </div>
      {status?.lastError && !test && (
        <p className="xsmall danger-text">
          {t('aiSettings.lastError', { message: `${td(`aiErrors.${status.lastError.code}`, status.lastError.code)} (${formatDateTime(status.lastError.at, locale)})` })}
        </p>
      )}

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.generation')}</h3>
        <div className="form-grid two">
          <NumberField label={t('aiSettings.maxTokens')} value={s.maxTokens} min={50} max={4000} onChange={(v) => save({ ai: { maxTokens: v } })} hint={t('aiSettings.maxTokensHint')} />
          <NumberField label={t('aiSettings.timeout')} value={s.timeoutSeconds} min={5} max={120} onChange={(v) => save({ ai: { timeoutSeconds: v } })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="temperature">
            {t('aiSettings.temperature')}: {s.temperature.toFixed(1)}
          </label>
          <input id="temperature" type="range" min={0} max={1.5} step={0.1} value={s.temperature} onChange={(e) => save({ ai: { temperature: Number(e.target.value) } })} />
        </div>
      </div>

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.limits')}</h3>
        <div className="form-grid two">
          <NumberField label={t('aiSettings.dailyRequests')} value={s.dailyRequestLimit} min={0} max={10000} onChange={(v) => save({ ai: { dailyRequestLimit: v } })} />
          <NumberField label={t('aiSettings.worldDailyLimit')} value={s.worldDailyLimit} min={0} max={1000} onChange={(v) => save({ ai: { worldDailyLimit: v } })} />
          <NumberField label={t('aiSettings.dailyBudget')} value={s.dailyBudgetUsd} min={0} max={1000} step={0.01} onChange={(v) => save({ ai: { dailyBudgetUsd: v } })} />
          <NumberField label={t('aiSettings.monthlyBudget')} value={s.monthlyBudgetUsd} min={0} max={10000} step={0.01} onChange={(v) => save({ ai: { monthlyBudgetUsd: v } })} />
        </div>
        <p className="xsmall faint">{t('aiSettings.budgetHint')}</p>
      </div>

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.activity')}</h3>
        <Toggle label={t('aiSettings.worldActivity')} hint={t('aiSettings.worldActivityHint')} checked={s.worldActivityEnabled} onChange={(v) => save({ ai: { worldActivityEnabled: v } })} />
        <Toggle label={t('aiSettings.reactions')} hint={t('aiSettings.reactionsHint')} checked={s.reactionsEnabled} onChange={(v) => save({ ai: { reactionsEnabled: v } })} />
        <Toggle label={t('aiSettings.summaries')} hint={t('aiSettings.summariesHint')} checked={s.summariesEnabled} onChange={(v) => save({ ai: { summariesEnabled: v } })} />
      </div>

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.usage')}</h3>
        {status && (
          <div className="usage-grid">
            {(
              [
                ['usageToday', status.today],
                ['usageMonth', status.month],
              ] as const
            ).map(([label, u]) => (
              <div key={label} className="usage-card">
                <strong className="small">{t(`aiSettings.${label}`)}</strong>
                <dl>
                  <div>
                    <dt>{t('aiSettings.requests')}</dt>
                    <dd>
                      {u.requests}
                      {u.failed > 0 && <span className="faint"> ({u.failed} {t('aiSettings.failed')})</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('aiSettings.tokens')}</dt>
                    <dd>{formatNumber(u.promptTokens + u.completionTokens, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t('aiSettings.cost')}</dt>
                    <dd>
                      {formatUsd(u.costUsd, locale)}
                      {!u.costKnown && <span className="faint"> ({t('aiSettings.costUnknown')})</span>}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
        {status && (status.limits.dailyRequestsReached || status.limits.dailyBudgetReached || status.limits.monthlyBudgetReached) && (
          <div className="notice notice-warning small">
            <Info aria-hidden />
            <span>{t('aiSettings.limitReached')}</span>
          </div>
        )}
        <button type="button" className="link-btn small align-start" onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}>
          {t('aiSettings.log')}
        </button>
        {showLog &&
          (usage.data?.entries.length ? (
            <div className="table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>{t('aiSettings.usageToday')}</th>
                    <th>{t('aiSettings.purposes')}</th>
                    <th>Model</th>
                    <th>{t('aiSettings.tokens')}</th>
                    <th>{t('aiSettings.cost')}</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.data.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDateTime(e.createdAt, locale)}</td>
                      <td>{e.purpose}</td>
                      <td className="truncate max-w">{e.model}</td>
                      <td>{e.promptTokens + e.completionTokens}</td>
                      <td>
                        {e.costUsd === null ? '–' : formatUsd(e.costUsd, locale)}
                        {e.costEstimated && <span className="faint"> ({t('aiSettings.estimated')})</span>}
                      </td>
                      <td className={e.status === 'ok' ? 'success-text' : 'danger-text'}>{e.status === 'ok' ? 'OK' : td(`aiErrors.${e.errorCode ?? ''}`, e.errorCode ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="xsmall muted">{t('aiSettings.logEmpty')}</p>
          ))}
      </div>

      {picker && (
        <ModelPicker
          title={picker === 'chat' ? t('aiSettings.chatModel') : picker === 'world' ? t('aiSettings.worldModel') : t('aiSettings.addFallback')}
          onSelect={pick}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  );
}

export function SettingsPage() {
  const { t, locale } = useI18n();
  const location = useLocation();
  const { data: boot } = useBootstrap();
  const update = useUpdateSettings();
  const reset = useResetData();
  const simStatus = useSimulationStatus();
  const showError = useErrorToast();
  const { push } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [reseedLang, setReseedLang] = useState<Lang | null>(null);

  const loaded = boot !== undefined;
  useEffect(() => {
    if (loaded && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash, loaded]);

  if (!boot) return <Loading />;
  const settings = boot.settings;
  const save = (patch: DeepPartial<AppSettings>) => update.mutate(patch, { onSuccess: () => push('success', t('settings.saved')), onError: showError });
  const otherLang: Lang = settings.language === 'de' ? 'en' : 'de';

  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="titles">
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </header>
      <nav className="chip-row scroll settings-nav" aria-label={t('settings.title')}>
        {(['general', 'ai', 'simulation', 'memory', 'privacy', 'about'] as const).map((id) => (
          <a key={id} href={`#${id}`} className="chip">
            {t(`settings.${id}`)}
          </a>
        ))}
      </nav>

      <div className="stack">
        <section id="general" className="settings-section card stack">
          <h2 className="row">
            <Globe aria-hidden className="icon-sm accent" /> {t('settings.general')}
          </h2>
          <SelectField
            label={t('settings.language')}
            value={settings.language}
            onChange={(v) => save({ language: v })}
            hint={t('settings.languageHint')}
            options={[
              { value: 'de', label: 'Deutsch' },
              { value: 'en', label: 'English' },
            ]}
          />
          <p className="small muted">{t('settings.contentLanguage', { lang: LANGUAGE_NAMES[boot.contentLanguage] })}</p>
          {boot.contentLanguage !== settings.language && (
            <button type="button" className="btn btn-secondary btn-sm align-start" onClick={() => setReseedLang(settings.language)}>
              <RefreshCw aria-hidden /> {t('settings.reseed', { lang: LANGUAGE_NAMES[settings.language] })}
            </button>
          )}
          {boot.contentLanguage === settings.language && (
            <button type="button" className="btn btn-ghost btn-sm align-start" onClick={() => setReseedLang(otherLang)}>
              <RefreshCw aria-hidden /> {t('settings.reseed', { lang: LANGUAGE_NAMES[otherLang] })}
            </button>
          )}
          <Link to="/profile" className="small">
            {t('settings.profileLink')} →
          </Link>
        </section>

        <AiSection settings={settings} save={save} />

        <section id="simulation" className="settings-section card stack">
          <h2 className="row">
            <Activity aria-hidden className="icon-sm accent" /> {t('settings.simulation')}
          </h2>
          <Toggle label={t('simSettings.auto')} hint={t('simSettings.autoHint')} checked={settings.simulation.autoEnabled} onChange={(v) => save({ simulation: { autoEnabled: v } })} />
          <div className="form-grid two">
            <NumberField label={t('simSettings.interval')} value={settings.simulation.intervalMinutes} min={1} max={1440} onChange={(v) => save({ simulation: { intervalMinutes: v } })} />
            <NumberField label={t('simSettings.maxTicks')} value={settings.simulation.maxAutoTicksPerDay} min={0} max={500} onChange={(v) => save({ simulation: { maxAutoTicksPerDay: v } })} />
            <NumberField label={t('simSettings.maxEvents')} value={settings.simulation.maxEventsPerTick} min={1} max={5} onChange={(v) => save({ simulation: { maxEventsPerTick: v } })} />
          </div>
          <Toggle label={t('simSettings.reactions')} checked={settings.simulation.reactionsEnabled} onChange={(v) => save({ simulation: { reactionsEnabled: v } })} />
          {simStatus.data && (
            <div className="notice small">
              <Info aria-hidden />
              <span>
                {t('simSettings.status', { count: simStatus.data.ticksToday, max: simStatus.data.maxAutoTicksPerDay })}{' '}
                {simStatus.data.nextTickAt ? t('simSettings.next', { time: formatDateTime(simStatus.data.nextTickAt, locale) }) : t('simSettings.paused')}
                <br />
                {t('simSettings.aiCalls', { count: simStatus.data.aiWorldCallsToday, max: simStatus.data.worldDailyLimit })}
              </span>
            </div>
          )}
        </section>

        <section id="memory" className="settings-section card stack">
          <h2 className="row">
            <Brain aria-hidden className="icon-sm accent" /> {t('settings.memory')}
          </h2>
          <div className="field">
            <label className="field-label" htmlFor="default-window">
              {t('memorySettings.defaultWindow')}: {settings.memory.defaultWindow}
            </label>
            <input
              id="default-window"
              type="range"
              min={LIMITS.memoryWindowMin}
              max={LIMITS.memoryWindowMax}
              value={settings.memory.defaultWindow}
              onChange={(e) => save({ memory: { defaultWindow: Number(e.target.value) } })}
            />
            <span className="field-hint">{t('memorySettings.defaultWindowHint')}</span>
          </div>
          <Toggle label={t('memorySettings.autoFacts')} hint={t('memorySettings.autoFactsHint')} checked={settings.memory.autoFacts} onChange={(v) => save({ memory: { autoFacts: v } })} />
        </section>

        <section id="privacy" className="settings-section card stack">
          <h2 className="row">
            <Shield aria-hidden className="icon-sm accent" /> {t('settings.privacy')}
          </h2>
          <Toggle
            label={t('privacySettings.sendDisplayName')}
            hint={t('privacySettings.sendDisplayNameHint')}
            checked={settings.privacy.sendDisplayName}
            onChange={(v) => save({ privacy: { sendDisplayName: v } })}
          />
          <div className="stack-sm">
            <strong className="small">{t('privacySettings.export')}</strong>
            <p className="xsmall muted">{t('privacySettings.exportHint')}</p>
            <a href="/api/data/export" download className="btn btn-secondary btn-sm align-start">
              <Download aria-hidden /> {t('privacySettings.export')}
            </a>
          </div>
          <div className="stack-sm danger-zone">
            <strong className="small">{t('privacySettings.reset')}</strong>
            <p className="xsmall muted">{t('privacySettings.resetHint')}</p>
            <div className="row wrap">
              <input
                className="input reset-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                aria-label={t('privacySettings.resetConfirmLabel')}
                placeholder={t('privacySettings.resetConfirmLabel')}
              />
              <button
                type="button"
                className="btn btn-danger"
                disabled={confirmText !== 'RESET' || reset.isPending}
                onClick={() =>
                  reset.mutate(
                    { language: settings.language },
                    {
                      onSuccess: () => {
                        setConfirmText('');
                        push('success', t('privacySettings.resetDone'));
                      },
                      onError: showError,
                    },
                  )
                }
              >
                <Trash2 aria-hidden /> {t('privacySettings.resetButton')}
              </button>
            </div>
          </div>
          <Link to="/privacy" className="small">
            {t('privacySettings.info')} →
          </Link>
        </section>

        <section id="about" className="settings-section card stack-sm">
          <h2 className="row">
            <Info aria-hidden className="icon-sm accent" /> {t('settings.about')}
          </h2>
          <p className="small">{t('about.version', { version: boot.version })}</p>
          <p className="small muted">{t('about.local')}</p>
          <p className="small muted">{t('about.noTracking')}</p>
          <p className="small muted">{t('about.singleUser')}</p>
        </section>
      </div>

      {reseedLang && (
        <ConfirmDialog
          title={t('settings.reseed', { lang: LANGUAGE_NAMES[reseedLang] })}
          text={t('settings.reseedConfirm')}
          confirmLabel={t('common.confirm')}
          danger
          busy={reset.isPending}
          onCancel={() => setReseedLang(null)}
          onConfirm={() =>
            reset.mutate(
              { language: reseedLang },
              {
                onSuccess: () => {
                  setReseedLang(null);
                  push('success', t('privacySettings.resetDone'));
                },
                onError: showError,
              },
            )
          }
        />
      )}
    </div>
  );
}
