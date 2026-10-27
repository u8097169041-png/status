import { WORLD_METRICS } from '../../../../shared/constants';
import type { WorldMetrics } from '../../../../shared/types';
import { useI18n } from '../../i18n';

const COLORS = { harmony: '#4ade80', tension: '#fb7185', discovery: '#60a5fa' };

export function MetricBars({ metrics }: { metrics: WorldMetrics }) {
  const { t } = useI18n();
  return (
    <div className="stack-sm">
      {WORLD_METRICS.map((m) => (
        <div key={m} className="meter" style={{ '--meter-color': COLORS[m] } as React.CSSProperties}>
          <span>{t(`metrics.${m}`)}</span>
          <div className="progress" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics[m]} aria-label={t(`metrics.${m}`)}>
            <span style={{ width: `${metrics[m]}%` }} />
          </div>
          <strong>{metrics[m]}</strong>
        </div>
      ))}
    </div>
  );
}
