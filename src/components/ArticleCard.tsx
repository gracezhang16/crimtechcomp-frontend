import DOMPurify from 'dompurify';
import { memo, useMemo, useState } from 'react';
import type { ArticleListItem } from '../types';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

interface Props {
  article: ArticleListItem;
  /** 1-based position in the feed, for the ARIA feed pattern. */
  position: number;
  /** Total count once known; -1 while more pages may still load. */
  setSize: number;
}

/**
 * One full article. Memoized so that loading page 7 doesn't re-render (and
 * re-sanitize) the 60 articles already on screen.
 */
export const ArticleCard = memo(function ArticleCard({ article, position, setSize }: Props) {
  // contentHtml comes from a server, so sanitize before injecting it.
  const safeHtml = useMemo(
    () => DOMPurify.sanitize(article.contentHtml),
    [article.contentHtml],
  );
  const [imageFailed, setImageFailed] = useState(false);
  const titleId = `article-${article.id}-title`;

  return (
    <article
      id={`article-${article.id}`}
      className="article"
      data-article-id={article.id}
      aria-labelledby={titleId}
      aria-posinset={position}
      aria-setsize={setSize}
      tabIndex={-1}
    >
      <header className="article-header">
        <h2 id={titleId} className="article-title">
          {article.title}
        </h2>
        {article.dek && <p className="article-dek">{article.dek}</p>}
        <p className="article-meta">
          <span className="article-author">{article.author}</span>
          <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
          <span>{article.readingTimeMins} min read</span>
        </p>
      </header>

      {article.imageUrl && (
        // The figure reserves its height via aspect-ratio, so layout doesn't
        // jump when images arrive. That keeps scroll restoration accurate.
        <figure className="article-figure">
          {!imageFailed && (
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          )}
        </figure>
      )}

      <div className="article-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </article>
  );
});