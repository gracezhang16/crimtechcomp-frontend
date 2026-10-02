import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks which article the reader is on.
 *
 * Articles are long and vary in height, so "largest visible ratio" is
 * unreliable. Instead the root margin shrinks the viewport to a thin band 30%
 * of the way down the screen (roughly where your eyes are when reading), and
 * whichever article crosses that band is the active one.
 */
export function useActiveArticle(
  containerRef: RefObject<HTMLElement>,
  itemCount: number,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || itemCount === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.articleId;
          if (entry.isIntersecting && id) setActiveId(id);
        }
      },
      { rootMargin: '-30% 0px -69% 0px' },
    );

    container
      .querySelectorAll<HTMLElement>('[data-article-id]')
      .forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [containerRef, itemCount]);

  return activeId;
}