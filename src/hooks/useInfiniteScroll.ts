import { useEffect, useRef } from 'react';

interface Options {
  enabled: boolean;
  /** How far below the viewport to start loading. Default: ~1.5 screens. */
  rootMargin?: string;
}

/**
 * Calls `onLoadMore` when the returned sentinel element comes within
 * `rootMargin` of the viewport.
 *
 * The observer is rebuilt whenever `onLoadMore` changes (i.e. after each page
 * loads). A new observer reports the sentinel's current state straight away,
 * so if a page was too short to push the sentinel off-screen, the next page
 * loads immediately instead of the feed stalling.
 */
export function useInfiniteScroll<T extends Element>(
  onLoadMore: () => void,
  { enabled, rootMargin = '0px 0px 150% 0px' }: Options,
) {
  const sentinelRef = useRef<T | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!enabled || !node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, enabled, rootMargin]);

  return sentinelRef;
}