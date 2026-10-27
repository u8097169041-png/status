import { CloudUpload, Drama, HardDrive, Lock, Server, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../i18n';

export function PrivacyPage() {
  const { t } = useI18n();
  const blocks = [
    { icon: HardDrive, title: t('privacyPage.localTitle'), body: [t('privacyPage.localText')] },
    {
      icon: CloudUpload,
      title: t('privacyPage.externalTitle'),
      body: [t('privacyPage.externalChat'), t('privacyPage.externalSummary'), t('privacyPage.externalWorld'), t('privacyPage.externalReactions'), t('privacyPage.externalGenerator')],
    },
    { icon: Lock, title: t('privacyPage.notSentTitle'), body: [t('privacyPage.notSentText')] },
    { icon: Server, title: t('privacyPage.providerTitle'), body: [t('privacyPage.providerText')] },
    { icon: SlidersHorizontal, title: t('privacyPage.controlTitle'), body: [t('privacyPage.controlText')] },
    { icon: Drama, title: t('privacyPage.disclaimerTitle'), body: [t('privacyPage.disclaimerText')] },
  ];
  return (
    <div className="page page-narrow">
      <header className="page-header">
        <div className="titles">
          <h1>{t('privacyPage.title')}</h1>
          <p>{t('privacyPage.subtitle')}</p>
        </div>
      </header>
      <div className="stack">
        {blocks.map((b) => (
          <section key={b.title} className="card privacy-block">
            <b.icon aria-hidden className="privacy-icon" />
            <div className="stack-sm">
              <h2 className="card-heading">{b.title}</h2>
              {b.body.length === 1 ? (
                <p className="small muted">{b.body[0]}</p>
              ) : (
                <ul className="rule-list">
                  {b.body.map((line) => (
                    <li key={line} className="small muted">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
