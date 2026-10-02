import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PAGE_SIZE } from '../hooks/useArticleFeed';
import type { ArticleListItem } from '../types';

interface Props {
  items: ArticleListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

/** How long the sidebar takes to scroll from one set to the next. */
const SET_SCROLL_MS = 550;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Where the list should rest so `item` is fully visible, for a set whose first
 * title sits at scroll position `base`. Moves by whole titles, so on short
 * screens no title is ever left half-hidden.
 */
function restingScrollTop(list: HTMLElement, item: HTMLElement, base: number): number {
  const padTop = parseFloat(getComputedStyle(list).paddingTop) || 0;
  const itemBottom = item.offsetTop + item.offsetHeight;
  if (itemBottom <= base + list.clientHeight) return base;
  const minTop = itemBottom - list.clientHeight;
  const titles = Array.from(list.querySelectorAll<HTMLElement>('li[data-nav-id]'));
  const first = titles.find((li) => li.offsetTop - padTop >= minTop) ?? item;
  return first.offsetTop - padTop;
}

/**
 * Sidebar showing one loaded set (one API page) at a time: the set that
 * contains the article you're reading. The highlight moves down through the
 * set; when you reach the next set, the list scrolls up until the highlighted
 * article is at the top, then the previous set is dropped.
 */
export function ArticleNav({ items, activeId, onSelect }: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const spacerRef = useRef<HTMLLIElement>(null);
  const scrollTopRef = useRef(0); // last known scroll position of the list
  const animatingRef = useRef(false);
  const finalScrollTopRef = useRef<number | null>(null);

  const activeIndex = items.findIndex((a) => a.id === activeId);
  const setStart = activeIndex > -1 ? Math.floor(activeIndex / PAGE_SIZE) * PAGE_SIZE : 0;
  const setFirstId = items[setStart]?.id ?? null;

  // The set on screen, and during the scroll animation, the set being left.
  const [shown, setShown] = useState({ start: setStart, firstId: setFirstId });
  const [leaving, setLeaving] = useState<number | null>(null);

  // Moved to a different set? Decide during render whether to animate, so
  // the very first paint of the change already includes both sets.
  if (setStart !== shown.start || setFirstId !== shown.firstId) {
    const sameFeed = items[shown.start]?.id === shown.firstId; // not a new search
    const nextDoor = Math.abs(setStart - shown.start) === PAGE_SIZE;
    const animate = sameFeed && nextDoor && leaving === null && !prefersReducedMotion();
    setLeaving(animate ? shown.start : null);
    setShown({ start: setStart, firstId: setFirstId });
  }

  const renderStart = leaving === null ? shown.start : Math.min(leaving, shown.start);
  const rendered = items.slice(renderStart, renderStart + PAGE_SIZE * (leaving === null ? 1 : 2));

  // Run the set-to-set scroll, or settle the list after one.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    if (leaving === null) {
      // Settled. Apply the position the animation ended on (now that the old
      // set is gone the numbers change, but the picture on screen does not).
      const active = activeId
        ? list.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(activeId)}"]`)
        : null;
      const top = finalScrollTopRef.current ?? (active ? restingScrollTop(list, active, 0) : 0);
      finalScrollTopRef.current = null;
      list.scrollTop = top;
      scrollTopRef.current = top;
      return;
    }

    // Both sets are rendered, earlier set on top. Line them up with what was
    // on screen a moment ago, then scroll to the new set.
    const forward = shown.start > leaving;
    const padTop = parseFloat(getComputedStyle(list).paddingTop) || 0;
    const titles = list.querySelectorAll<HTMLElement>('li[data-nav-id]');
    const topSetHeight = titles[PAGE_SIZE].offsetTop - padTop;
    const newSetBase = forward ? topSetHeight : 0;
    const active = activeId
      ? list.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(activeId)}"]`)
      : null;

    const from = forward ? scrollTopRef.current : topSetHeight + scrollTopRef.current;
    const to = active ? restingScrollTop(list, active, newSetBase) : newSetBase;

    // A list can't scroll past its end, so add blank room below if needed.
    const spacer = spacerRef.current;
    if (spacer) {
      const room = Math.max(from, to) + list.clientHeight - list.scrollHeight;
      spacer.style.height = `${Math.max(0, room)}px`;
    }
    list.scrollTop = from;

    animatingRef.current = true;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - startedAt) / SET_SCROLL_MS);
      list.scrollTop = from + (to - from) * easeInOutCubic(t);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      } else {
        animatingRef.current = false;
        finalScrollTopRef.current = to - newSetBase; // same view without the old set
        setLeaving(null);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      animatingRef.current = false;
    };
    // activeId is read once at the start; later changes are handled on settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving, shown.start, shown.firstId]);

  // Within a set, keep the highlight in view on short screens.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId || animatingRef.current) return;
    const item = list.querySelector<HTMLElement>(`[data-nav-id="${CSS.escape(activeId)}"]`);
    if (!item) return;
    const visibleTop = list.scrollTop;
    const visibleBottom = visibleTop + list.clientHeight;
    if (item.offsetTop >= visibleTop && item.offsetTop + item.offsetHeight <= visibleBottom) return;
    const padTop = parseFloat(getComputedStyle(list).paddingTop) || 0;
    const top =
      item.offsetTop < visibleTop ? item.offsetTop - padTop : restingScrollTop(list, item, 0);
    list.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [activeId]);

  if (items.length === 0) return null;

  return (
    <nav className="toc" aria-label="Articles in this feed">
      <p className="toc-count">
        Articles {shown.start + 1}–{Math.min(shown.start + PAGE_SIZE, items.length)} of{' '}
        {items.length} loaded
      </p>
      <ul
        className="toc-list"
        ref={listRef}
        onScroll={(event) => {
          scrollTopRef.current = event.currentTarget.scrollTop;
        }}
      >
        {rendered.map((article, i) => {
          const index = renderStart + i;
          const isActive = article.id === activeId;
          const isRead = activeIndex > -1 && index < activeIndex;
          return (
            <li key={article.id} data-nav-id={article.id}>
              <a
                href={`#article-${article.id}`}
                className={`toc-link${isRead ? ' is-read' : ''}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onSelect(article.id);
                }}
              >
                <span className="toc-link-text">{article.title}</span>
              </a>
            </li>
          );
        })}
        {leaving !== null && <li ref={spacerRef} className="toc-spacer" aria-hidden="true" />}
      </ul>
    </nav>
  );
}