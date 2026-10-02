export function FeedSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="skeleton-article">
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line skeleton-title short" />
          <div className="skeleton-line skeleton-meta" />
          <div className="skeleton-block" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function LoadingMore() {
  return (
    <p className="feed-note feed-loading">
      <span className="spinner" aria-hidden="true" />
      Loading more articles
    </p>
  );
}

interface ErrorNoticeProps {
  message: string | null;
  hasItems: boolean;
  onRetry: () => void;
}

export function ErrorNotice({ message, hasItems, onRetry }: ErrorNoticeProps) {
  return (
    <div className="notice notice-error" role="alert">
      <p className="notice-title">
        {hasItems ? 'The next articles didn’t load.' : 'Articles didn’t load.'}
      </p>
      {message && <p className="notice-body">{message}</p>}
      <button type="button" className="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

interface EmptyStateProps {
  query: string;
  onClear: () => void;
}

export function EmptyState({ query, onClear }: EmptyStateProps) {
  return (
    <div className="notice">
      <p className="notice-title">No articles match “{query}”.</p>
      <p className="notice-body">Search covers titles, summaries and author names. Try a shorter or different word.</p>
      <button type="button" className="button" onClick={onClear}>
        Clear search
      </button>
    </div>
  );
}

interface CaughtUpProps {
  count: number;
  onBackToTop: () => void;
}

export function CaughtUp({ count, onBackToTop }: CaughtUpProps) {
  return (
    <div className="caught-up">
      <p className="caught-up-title">You’re all caught up</p>
      <p className="notice-body">
        That’s all {count} {count === 1 ? 'article' : 'articles'} in this feed.
      </p>
      <button type="button" className="button" onClick={onBackToTop}>
        Back to top
      </button>
    </div>
  );
}