import { Bot, Cpu } from 'lucide-react';
import { Link } from 'react-router';
import type { AiStatusDto } from '../../../shared/types';
import { useI18n } from '../i18n';

export function AiModeBadge({ status, compact }: { status: AiStatusDto | undefined; compact?: boolean }) {
  const { t } = useI18n();
  if (!status) return null;
  const isAi = status.mode === 'ai';
  const reason =
    status.demoReason === 'no-key' ? t('mode.noKey') : status.demoReason === 'no-model' ? t('mode.noModel') : status.demoReason === 'disabled' ? t('mode.disabled') : '';
  const hint = isAi ? t('mode.aiHint', { model: status.chatModel }) : `${t('mode.demoHint')} ${reason}`;
  if (compact) {
    return (
      <Link to="/settings#ai" className={`badge ${isAi ? 'badge-ai' : 'badge-demo'}`} title={hint}>
        {isAi ? <Bot aria-hidden /> : <Cpu aria-hidden />}
        <span className="mode-label">{isAi ? t('mode.ai') : t('mode.demo')}</span>
      </Link>
    );
  }
  return (
    <div className={`mode-card ${isAi ? 'is-ai' : 'is-demo'}`}>
      <div className="row">
        {isAi ? <Bot aria-hidden /> : <Cpu aria-hidden />}
        <strong>{isAi ? t('mode.ai') : t('mode.demo')}</strong>
      </div>
      <p>{hint}</p>
      {!isAi && (
        <Link to="/settings#ai" className="small">
          {t('mode.configure')} →
        </Link>
      )}
    </div>
  );
}
