import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '../components/ui/States';
import { useI18n } from '../i18n';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <EmptyState
        icon={Compass}
        title={t('errors.notFound')}
        text={t('errors.notFoundText')}
        action={
          <Link to="/" className="btn btn-primary">
            {t('errors.home')}
          </Link>
        }
      />
    </div>
  );
}
