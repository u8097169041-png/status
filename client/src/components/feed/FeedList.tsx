import { Newspaper } from 'lucide-react';
import { useFeed, type FeedFilters } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { EmptyState, ErrorState, SkeletonList } from '../ui/States';
import { PostCard } from './PostCard';

export function FeedList({ filters, emptyText }: { filters: FeedFilters; emptyText?: string }) {
  const { t } = useI18n();
  const feed = useFeed(filters);

  if (feed.isPending) return <SkeletonList count={3} />;
  if (feed.isError) return <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />;
  const posts = feed.data.pages.flatMap((p) => p.items);
  const filtered = Object.values(filters).some(Boolean);
  if (posts.length === 0) {
    return <EmptyState icon={Newspaper} title={emptyText ?? (filtered ? t('feed.emptyFiltered') : t('feed.empty'))} />;
  }
  return (
    <div className="feed-list">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {feed.hasNextPage ? (
        <button type="button" className="btn btn-secondary btn-block" onClick={() => void feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
          {feed.isFetchingNextPage && <span className="spinner" aria-hidden />}
          {t('feed.loadMore')}
        </button>
      ) : (
        <p className="feed-end">{t('feed.end')}</p>
      )}
    </div>
  );
}
