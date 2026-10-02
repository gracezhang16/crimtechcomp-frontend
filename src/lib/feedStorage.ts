import type { ArticleListItem } from '../types';

/**
 * Refresh resilience. sessionStorage (not localStorage) is deliberate: it
 * survives a reload of this tab but starts fresh in a new tab, which is what
 * "pick up where I was" should mean for a feed.
 */
const FEED_KEY = 'article-reader:feed:v1';
const SCROLL_KEY = 'article-reader:scroll:v1';
const MAX_AGE_MS = 30 * 60 * 1000; // older snapshots are treated as stale

export interface FeedSnapshot {
  query: string;
  items: ArticleListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  savedAt: number;
}

export function loadFeedSnapshot(): FeedSnapshot | null {
  try {
    const raw = sessionStorage.getItem(FEED_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw) as FeedSnapshot;
    const isValid =
      typeof snap.query === 'string' &&
      Array.isArray(snap.items) &&
      typeof snap.savedAt === 'number' &&
      Date.now() - snap.savedAt < MAX_AGE_MS &&
      // An empty list is only worth restoring if it was a finished, empty result.
      (snap.items.length > 0 || snap.hasMore === false);
    return isValid ? snap : null;
  } catch {
    return null;
  }
}

export function saveFeedSnapshot(snap: Omit<FeedSnapshot, 'savedAt'>): void {
  try {
    sessionStorage.setItem(FEED_KEY, JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {
    // Storage full or unavailable (private mode). Persistence is best-effort.
  }
}

export function loadScrollY(): number | null {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    const y = raw === null ? NaN : Number(raw);
    return Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

export function saveScrollY(y: number): void {
  try {
    sessionStorage.setItem(SCROLL_KEY, String(Math.round(y)));
  } catch {
    // Best-effort, as above.
  }
}