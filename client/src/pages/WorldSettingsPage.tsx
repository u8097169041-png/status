import { Globe2, Plus, Settings2, Sliders } from 'lucide-react';
import { Link } from 'react-router';
import { useSimulationStatus } from '../api/hooks';
import { NotJoinedState, useActivePlay } from '../components/play/PlayUI';
import { WorldArt } from '../components/ui/WorldArt';
import { MetricBars } from '../components/worlds/MetricBars';
import { useI18n } from '../i18n';

/** Weltanpassung: Einstieg in Simulation, Ereignisse, Beziehungen und Details der aktiven Welt. */
export function WorldSettingsPage() {
  const { t } = useI18n();
  const { world } = useActivePlay();
  const { data: sim } = useSimulationStatus();
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="titles">
          <h1>{t('worldSettings.title')}</h1>
          <p>{t('worldSettings.subtitle')}</p>
        </div>
      </header>
      {!world ? (
        <NotJoinedState />
      ) : (
        <div className="stack">
          <section className="card world-settings-card" style={{ '--world-hue': world.hue } as React.CSSProperties}>
            <WorldArt seed={world.id} style={world.artStyle} hue={world.hue} className="world-settings-art" />
            <div className="stack-sm grow">
              <h2>{world.name}</h2>
              <p className="small muted">{world.tagline}</p>
              <MetricBars metrics={world.metrics} />
              <div className="row wrap">
                <Link to={`/worlds/${world.id}`} className="btn btn-primary btn-sm">
                  <Sliders aria-hidden /> {t('worldSettings.open')}
                </Link>
                {world.isCustom && (
                  <Link to={`/worlds/${world.id}/edit`} className="btn btn-secondary btn-sm">
                    <Settings2 aria-hidden /> {t('worldSettings.edit')}
                  </Link>
                )}
              </div>
            </div>
          </section>
          <section className="card stack-sm">
            <h2 className="card-heading">{t('worldSettings.simulation')}</h2>
            <p className="small muted">{t('worldSettings.simulationHint')}</p>
            {sim && (
              <p className="small">
                {sim.autoEnabled
                  ? t('worldSettings.simStatus', { ticks: sim.ticksToday, max: sim.maxAutoTicksPerDay, minutes: sim.intervalMinutes })
                  : t('worldSettings.simOff')}
              </p>
            )}
            <Link to="/settings" className="btn btn-ghost btn-sm">
              {t('nav.settings')}
            </Link>
          </section>
        </div>
      )}
      <div className="row wrap">
        <Link to="/worlds/new" className="btn btn-secondary btn-sm">
          <Plus aria-hidden /> {t('worldSettings.createWorld')}
        </Link>
        <Link to="/worlds" className="btn btn-ghost btn-sm">
          <Globe2 aria-hidden /> {t('worldSettings.allWorlds')}
        </Link>
      </div>
    </div>
  );
}
