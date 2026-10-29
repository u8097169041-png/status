import { Activity, Bot, Brain, CheckCircle2, Cloud, Cpu, Download, Globe, Info, RefreshCw, Shield, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { LIMITS, type Lang } from '../../../shared/constants';
import type { AiMode, AppSettings, DeepPartial } from '../../../shared/types';
import {
  useAiActions,
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
import { ConfirmDialog } from '../components/ui/Modal';
import { Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n, type TKey } from '../i18n';
import { formatDateTime, formatNumber, formatUsd } from '../lib/format';

const LANGUAGE_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

const MODES: AiMode[] = ['auto', 'server', 'fallback'];

/** Zeile der Diagnose mit Ampelsymbol. */
function DiagRow({ ok, label, value, hint }: { ok: boolean | null; label: string; value: string; hint?: string | null }) {
  const Icon = ok === null ? Info : ok ? CheckCircle2 : XCircle;
  return (
    <li className={`diag-row ${ok === null ? 'neutral' : ok ? 'ok' : 'bad'}`}>
      <Icon aria-hidden className="icon-sm" />
      <div className="grow min-w-0">
        <span className="small">
          <strong>{label}:</strong> {value}
        </span>
        {hint && <span className="xsmall muted block">{hint}</span>}
      </div>
    </li>
  );
}

function AiSection({ settings, save }: { settings: AppSettings; save: (patch: DeepPartial<AppSettings>) => void }) {
  const { t, td, locale } = useI18n();
  const { data: status } = useAiStatus();
  const usage = useAiUsage();
  const ai = useAiActions();
  const showError = useErrorToast();
  const { push } = useToast();
  const [showLog, setShowLog] = useState(false);
  const s = settings.ai;
  const test = ai.test.data;
  const local = status?.local;
  const server = status?.server;

  const localValue = !local
    ? '…'
    : !local.enabledByConfig
      ? t('aiSettings.localDisabled')
      : local.reachable === null
        ? t('aiSettings.localUnchecked')
        : local.reachable
          ? t('aiSettings.localReachable', { version: local.version ?? '?' })
          : t('aiSettings.localUnreachable', { url: local.baseUrl });
  const modelValue = !local?.model
    ? t('aiSettings.localNoModel')
    : `${local.model} · ${t(`aiSettings.modelSource_${local.modelSource ?? 'auto'}` as TKey)}`;
  const serverValue = !server
    ? '…'
    : !server.configured
      ? t('aiSettings.serverNotConfigured')
      : `${server.model} @ ${server.host}${server.consent ? '' : ` · ${t('aiSettings.serverNoConsent')}`}`;

  return (
    <section id="ai" className="settings-section card stack">
      <h2 className="row">
        <Bot aria-hidden className="icon-sm accent" /> {t('settings.ai')}
      </h2>
      <AiModeBadge status={status} />

      <fieldset className="goal-picker">
        <legend className="card-heading">{t('aiSettings.modeTitle')}</legend>
        <div className="ai-mode-grid" role="radiogroup" aria-label={t('aiSettings.modeTitle')}>
          {MODES.map((m) => {
            const disabled = m === 'server' && !server?.configured;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={s.mode === m}
                disabled={disabled}
                className={`goal-option ${s.mode === m ? 'selected' : ''}`}
                onClick={() => save({ ai: { mode: m } })}
              >
                <strong className="small">{t(`aiSettings.mode_${m}` as TKey)}</strong>
                <span className="xsmall muted">{disabled ? t('aiSettings.serverNotConfiguredShort') : t(`aiSettings.mode_${m}Hint` as TKey)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="stack-sm">
        <h3 className="card-heading row">
          <Activity aria-hidden className="icon-xs" /> {t('aiSettings.diagnosis')}
        </h3>
        {status && local && server && (
          <ul className="diag-list">
            <DiagRow
              ok={status.active !== 'fallback'}
              label={t('aiSettings.activeNow')}
              value={`${t(`aiProviders.${status.active}` as TKey)}${status.activeModel ? ` · ${status.activeModel}` : ''}`}
              hint={status.reason ? td(`aiReasons.${status.reason}`, status.reason) : null}
            />
            <DiagRow
              ok={local.enabledByConfig ? local.reachable : null}
              label={t('aiSettings.localRuntime')}
              value={localValue}
              hint={local.remote ? t('aiSettings.localRemote') : null}
            />
            {local.reachable && (
              <DiagRow
                ok={Boolean(local.model) && status.reason !== 'local-model-missing'}
                label={t('aiSettings.localModel')}
                value={modelValue}
                hint={local.models.length === 0 ? t('aiSettings.localPullHint') : null}
              />
            )}
            <DiagRow
              ok={server.configured ? server.consent && !server.blockedUntil : null}
              label={t('aiSettings.serverAi')}
              value={serverValue}
              hint={
                server.blockedUntil
                  ? t('aiSettings.serverBlocked', { time: formatDateTime(server.blockedUntil, locale) })
                  : server.configured
                    ? null
                    : t('aiSettings.serverSetupHint')
              }
            />
          </ul>
        )}
        <div className="row wrap">
          <button type="button" className="btn btn-secondary btn-sm" disabled={ai.recheck.isPending} onClick={() => ai.recheck.mutate(undefined, { onError: showError })}>
            {ai.recheck.isPending ? <span className="spinner" aria-hidden /> : <RefreshCw aria-hidden />} {t('aiSettings.recheck')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={ai.test.isPending || !local?.reachable || !local.model}
            onClick={() => ai.test.mutate('local', { onError: showError })}
          >
            <Cpu aria-hidden /> {t('aiSettings.testLocal')}
          </button>
          {server?.configured && (
            <button type="button" className="btn btn-ghost btn-sm" disabled={ai.test.isPending} onClick={() => ai.test.mutate('server', { onError: showError })}>
              <Cloud aria-hidden /> {t('aiSettings.testServer')}
            </button>
          )}
        </div>
        {ai.test.isPending && <p className="small muted">{t('aiSettings.testing')}</p>}
        {test &&
          !ai.test.isPending &&
          (test.ok ? (
            <p className="notice notice-success small" role="status">
              <CheckCircle2 aria-hidden />
              <span>{t('aiSettings.testOk', { provider: t(`aiProviders.${test.provider}` as TKey), model: test.model ?? '', ms: test.durationMs })}</span>
            </p>
          ) : (
            <p className="notice notice-danger small" role="status">
              <XCircle aria-hidden />
              <span>
                {t('aiSettings.testFailed', {
                  provider: t(`aiProviders.${test.provider}` as TKey),
                  message: td(`aiReasons.${test.error?.code ?? ''}`, td(`aiErrors.${test.error?.code ?? ''}`, test.error?.code ?? '')),
                })}
              </span>
            </p>
          ))}
        {status?.lastError && !test && (
          <p className="xsmall faint">
            {t('aiSettings.lastError', {
              provider: t(`aiProviders.${status.lastError.provider}` as TKey),
              message: `${td(`aiErrors.${status.lastError.code}`, status.lastError.code)} (${formatDateTime(status.lastError.at, locale)})`,
            })}
          </p>
        )}
      </div>

      {local && local.models.length > 0 && (
        <div className="stack-sm">
          <SelectField
            label={t('aiSettings.localModelSelect')}
            value={local.modelSource === 'env' ? (local.model ?? '') : s.localModel}
            onChange={(v) => save({ ai: { localModel: v } })}
            options={[
              { value: '', label: t('aiSettings.localModelAuto') },
              ...local.models.map((m) => ({
                value: m.name,
                label: `${m.name}${m.parameterSize ? ` · ${m.parameterSize}` : ''}${m.sizeGb ? ` · ${formatNumber(m.sizeGb, locale)} GB` : ''}`,
              })),
            ]}
            hint={local.modelSource === 'env' ? t('aiSettings.localModelEnv') : t('aiSettings.localModelHint')}
          />
        </div>
      )}

      {server?.configured && (
        <div className="stack-sm server-consent">
          <Toggle
            label={t('aiSettings.serverConsent')}
            hint={t('aiSettings.serverConsentHint', {
              requests: server.limits.maxRequestsPerDay,
              daily: formatUsd(server.limits.dailyBudgetUsd, locale),
              monthly: formatUsd(server.limits.monthlyBudgetUsd, locale),
            })}
            checked={s.serverConsent}
            onChange={(v) => save({ ai: { serverConsent: v } })}
          />
        </div>
      )}

      {status?.legacyKeyStored && (
        <div className="notice notice-warning small row-between wrap">
          <span>{t('aiSettings.legacyKey')}</span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => ai.removeLegacyKey.mutate(undefined, { onSuccess: () => push('success', t('aiSettings.legacyKeyRemoved')), onError: showError })}
          >
            <Trash2 aria-hidden /> {t('aiSettings.legacyKeyRemove')}
          </button>
        </div>
      )}

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.generation')}</h3>
        <div className="form-grid two">
          <NumberField label={t('aiSettings.maxTokens')} value={s.maxTokens} min={50} max={4000} onChange={(v) => save({ ai: { maxTokens: v } })} hint={t('aiSettings.maxTokensHint')} />
          <div className="field">
            <label className="field-label" htmlFor="temperature">
              {t('aiSettings.temperature')}: {s.temperature.toFixed(1)}
            </label>
            <input id="temperature" type="range" min={0} max={1.5} step={0.1} value={s.temperature} onChange={(e) => save({ ai: { temperature: Number(e.target.value) } })} />
          </div>
        </div>
      </div>

      <div className="stack-sm">
        <h3 className="card-heading">{t('aiSettings.limits')}</h3>
        <div className="form-grid two">
          <NumberField label={t('aiSettings.worldDailyLimit')} value={s.worldDailyLimit} min={0} max={1000} onChange={(v) => save({ ai: { worldDailyLimit: v } })} />
          {server?.configured && (
            <>
              <NumberField label={t('aiSettings.dailyRequests')} value={s.dailyRequestLimit} min={0} max={10000} onChange={(v) => save({ ai: { dailyRequestLimit: v } })} />
              <NumberField label={t('aiSettings.dailyBudget')} value={s.dailyBudgetUsd} min={0} max={1000} step={0.01} onChange={(v) => save({ ai: { dailyBudgetUsd: v } })} />
              <NumberField label={t('aiSettings.monthlyBudget')} value={s.monthlyBudgetUsd} min={0} max={10000} step={0.01} onChange={(v) => save({ ai: { monthlyBudgetUsd: v } })} />
            </>
          )}
        </div>
        <p className="xsmall faint">{server?.configured ? t('aiSettings.budgetHint') : t('aiSettings.limitsLocalHint')}</p>
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
            <div className="usage-card">
              <strong className="small">{t('aiSettings.usageLocal')}</strong>
              <dl>
                <div>
                  <dt>{t('aiSettings.requests')}</dt>
                  <dd>{status.localToday}</dd>
                </div>
                <div>
                  <dt>{t('aiSettings.cost')}</dt>
                  <dd>{formatUsd(0, locale)}</dd>
                </div>
              </dl>
            </div>
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
                    <th>{t('aiSettings.colTime')}</th>
                    <th>{t('aiSettings.colProvider')}</th>
                    <th>{t('aiSettings.purposes')}</th>
                    <th>{t('aiSettings.colModel')}</th>
                    <th>{t('aiSettings.tokens')}</th>
                    <th>{t('aiSettings.cost')}</th>
                    <th>{t('aiSettings.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.data.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDateTime(e.createdAt, locale)}</td>
                      <td>{t(`aiProviders.${e.provider}` as TKey)}</td>
                      <td>{td(`aiPurposes.${e.purpose}`, e.purpose)}</td>
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
