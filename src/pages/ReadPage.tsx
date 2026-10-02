import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArticleCard } from '../components/ArticleCard';
import { ArticleNav } from '../components/ArticleNav';
import {
  CaughtUp,
  EmptyState,
  ErrorNotice,
  FeedSkeleton,
  LoadingMore,
} from '../components/FeedStates';
import { SearchBar } from '../components/SearchBar';
import { useActiveArticle } from '../hooks/useActiveArticle';
import { useArticleFeed } from '../hooks/useArticleFeed';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import {
  loadFeedSnapshot,
  loadScrollY,
  saveFeedSnapshot,
  saveScrollY,
  type FeedSnapshot,
} from '../lib/feedStorage';
import './ReadPage.css';

const SEARCH_DEBOUNCE_MS = 300;

interface RestoredSession {
  query: string;
  snapshot: FeedSnapshot | null;
  scrollY: number | null;
}

/** Decide what to show on first render: URL first, then sessionStorage. */
function restoreSession(urlQuery: string | null): RestoredSession {
  const saved = loadFeedSnapshot();
  const query = urlQuery ?? saved?.query ?? '';
  // Only reuse saved articles if they belong to the query we're about to show.
  const snapshot = saved && saved.query === query ? saved : null;
  return { query, snapshot, scrollY: snapshot ? loadScrollY() : null };
}

export default function ReadPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [restored] = useState(() => restoreSession(searchParams.get('q')));

  // Search: the input updates instantly, the feed follows 300ms later.
  const [inputValue, setInputValue] = useState(restored.query);
  const query = useDebouncedValue(inputValue.trim(), SEARCH_DEBOUNCE_MS);

  const feed = useArticleFeed(query, restored.snapshot);
  const { items, hasMore, status, loadMore } = feed;

  // Infinite scroll: a sentinel below the last article triggers the next page.
  const sentinelRef = useInfiniteScroll<HTMLDivElement>(loadMore, {
    enabled: hasMore && status !== 'error' && items.length > 0,
  });

  // Active article: drives the sidebar highlight and the ?article= URL param.
  const feedRef = useRef<HTMLDivElement>(null);
  const trackedId = useActiveArticle(feedRef, items.length);

  // While a sidebar click is smooth-scrolling the page, show the destination
  // as active right away instead of flickering through every article on the way.
  const [navTargetId, setNavTargetId] = useState<string | null>(null);
  const releaseNavTargetRef = useRef<(() => void) | null>(null);
  useEffect(() => () => releaseNavTargetRef.current?.(), []);

  const visibleId = navTargetId ?? trackedId;
  const activeId = visibleId && items.some((a) => a.id === visibleId) ? visibleId : null;

  // ---- Refresh resilience -------------------------------------------------

  // Restore scroll once, before paint, so there's no visible jump.
  const didRestoreRef = useRef(false);
  useLayoutEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    if (restored.snapshot) {
      console.log(
        `[feed] Restored ${restored.snapshot.items.length} articles for ` +
          `query "${restored.snapshot.query}" from sessionStorage, no request needed.`,
      );
      if (restored.scrollY !== null) window.scrollTo(0, restored.scrollY);
    }
  }, [restored]);

  // Save the loaded feed whenever a page finishes loading.
  useEffect(() => {
    if (feed.query === null || status !== 'idle') return;
    saveFeedSnapshot({ query: feed.query, items, nextCursor: feed.nextCursor, hasMore });
  }, [feed.query, items, feed.nextCursor, hasMore, status]);

  // Save scroll position, throttled, plus once more when the page is hidden.
  useEffect(() => {
    let timer: number | undefined;
    const onScroll = () => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        saveScrollY(window.scrollY);
      }, 200);
    };
    const onPageHide = () => saveScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // ---- URL + scroll side effects of search ---------------------------------

  // A new search starts at the top of its results.
  const lastQueryRef = useRef(query);
  useEffect(() => {
    if (lastQueryRef.current === query) return;
    lastQueryRef.current = query;
    window.scrollTo({ top: 0 });
  }, [query]);

  // Mirror the query and the active article into the URL (?q=…&article=…).
  // `replace` keeps this from flooding the back button with history entries.
  useEffect(() => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (activeId) next.set('article', activeId);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, activeId, searchParams, setSearchParams]);

  // ---- Handlers -------------------------------------------------------------

  const scrollToArticle = useCallback((id: string) => {
    const el = document.getElementById(`article-${id}`);
    if (!el) return;

    // Hold the highlight on the destination until the page stops scrolling.
    releaseNavTargetRef.current?.(); // a previous click still in progress
    setNavTargetId(id);
    let idleTimer: number | undefined;
    function release() {
      window.clearTimeout(idleTimer);
      window.removeEventListener('scroll', onScroll);
      releaseNavTargetRef.current = null;
      setNavTargetId(null);
    }
    function onScroll() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(release, 150);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    idleTimer = window.setTimeout(release, 150); // in case the page doesn't need to move
    releaseNavTargetRef.current = release;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true }); // move keyboard/screen-reader focus too
  }, []);

  const backToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.getElementById('article-search')?.focus({ preventScroll: true });
  }, []);

  const clearSearch = useCallback(() => setInputValue(''), []);

  // ---- Render ---------------------------------------------------------------

  const isEmpty = status === 'idle' && items.length === 0 && !hasMore;
  const isCaughtUp = status === 'idle' && items.length > 0 && !hasMore;
  const announcement =
    status === 'loading'
      ? 'Loading articles'
      : isEmpty
        ? 'No matching articles'
        : `${items.length} articles loaded${isCaughtUp ? ', end of feed' : ''}`;

  return (
    <div className="reader">
      <header className="masthead">
        <div className="masthead-inner">
          <p className="wordmark">Reader</p>
          <SearchBar value={inputValue} onChange={setInputValue} />
        </div>
      </header>

      <div className="layout">
        <aside className="layout-aside">
          <ArticleNav
            items={items}
            activeId={activeId}
            onSelect={scrollToArticle}
          />
        </aside>

        <main className="layout-main">
          {query && !isEmpty && (
            <p className="feed-context">Articles matching “{query}”</p>
          )}

          <div
            ref={feedRef}
            className="feed"
            role="feed"
            aria-busy={status === 'loading'}
            aria-label={query ? `Articles matching ${query}` : 'All articles'}
          >
            {items.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                position={index + 1}
                setSize={hasMore ? -1 : items.length}
              />
            ))}
          </div>

          {feed.isInitialLoading && <FeedSkeleton />}
          {status === 'loading' && items.length > 0 && <LoadingMore />}
          {status === 'error' && (
            <ErrorNotice message={feed.error} hasItems={items.length > 0} onRetry={feed.retry} />
          )}
          {isEmpty && <EmptyState query={query} onClear={clearSearch} />}
          {isCaughtUp && <CaughtUp count={items.length} onBackToTop={backToTop} />}

          <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
          <p className="visually-hidden" role="status" aria-live="polite">
            {announcement}
          </p>
        </main>
      </div>
    </div>
  );
}