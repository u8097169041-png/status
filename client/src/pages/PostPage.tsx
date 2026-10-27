import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { usePostDetail } from '../api/hooks';
import { CommentThread } from '../components/feed/CommentThread';
import { PostCard } from '../components/feed/PostCard';
import { EmptyState, ErrorState, SkeletonList } from '../components/ui/States';
import { useI18n } from '../i18n';

export function PostPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const detail = usePostDetail(id);
  return (
    <div className="page page-narrow">
      <Link to="/feed" className="back-link">
        <ArrowLeft aria-hidden /> {t('nav.feed')}
      </Link>
      {detail.isPending && <SkeletonList count={2} />}
      {detail.isError &&
        (detail.error instanceof ApiError && detail.error.status === 404 ? (
          <EmptyState icon={FileQuestion} title={t('post.notFound')} action={<Link to="/feed" className="btn btn-secondary">{t('nav.feed')}</Link>} />
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ))}
      {detail.data && (
        <div className="stack">
          <h1 className="sr-only">{t('post.title')}</h1>
          <PostCard post={detail.data.post} />
          <CommentThread postId={id} comments={detail.data.comments} />
        </div>
      )}
    </div>
  );
}
