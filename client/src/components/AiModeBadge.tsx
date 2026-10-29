import { Cloud, Cpu, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import type { AiProviderId, AiStatusDto } from '../../../shared/types';
import { useI18n, type TKey } from '../i18n';

const ICONS: Record<AiProviderId, typeof Cpu> = { local: Cpu, server: Cloud, fallback: Sparkles };

/** Zeigt, welche KI gerade antwortet: lokale KI, Server-KI oder simulierte KI. */
export function AiModeBadge({ status, compact }: { status: AiStatusDto | undefined; compact?: boolean }) {
  const { t, td } = useI18n();
  if (!status) return null;
  const active = status.active;
  const Icon = ICONS[active];
  const title = t(`aiProviders.${active}` as TKey);
  const hint =
    active === 'fallback'
      ? `${t('mode.fallbackHint')} ${status.reason ? td(`aiReasons.${status.reason}`, '') : ''}`.trim()
      : t(active === 'local' ? 'mode.localHint' : 'mode.serverHint', { model: status.activeModel ?? '' });
  const kind = active === 'fallback' ? 'badge-demo' : 'badge-ai';
  if (compact) {
    return (
      <Link to="/settings#ai" className={`badge ${kind}`} title={hint}>
        <Icon aria-hidden />
        <span className="mode-label">{title}</span>
      </Link>
    );
  }
  return (
    <div className={`mode-card ${active === 'fallback' ? 'is-demo' : 'is-ai'}`}>
      <div className="row">
        <Icon aria-hidden />
        <strong>{title}</strong>
      </div>
      <p>{hint}</p>
      {active === 'fallback' && (
        <Link to="/settings#ai" className="small">
          {t('mode.configure')} →
        </Link>
      )}
    </div>
  );
}
