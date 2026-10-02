import { useCallback, useEffect, useReducer, useRef } from 'react';
import { fetchArticles } from '../api/client';
import type { FeedSnapshot } from '../lib/feedStorage';
import type { ArticleListItem, ArticlesListResponse } from '../types';

export const PAGE_SIZE = 10;

export type FeedStatus = 'idle' | 'loading' | 'error';

export interface FeedState {
  /** The query the current items belong to; null before the first load. */
  query: string | null;
  items: ArticleListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  status: FeedStatus;
  error: string | null;
}

type Action =
  | { type: 'reset'; query: string }
  | { type: 'request' }
  | { type: 'success'; query: string; page: ArticlesListResponse; append: boolean }
  | { type: 'failure'; query: string; error: string };

function appendUnique(existing: ArticleListItem[], incoming: ArticleListItem[]): ArticleListItem[] {
  const seen = new Set(existing.map((a) => a.id));
  return [...existing, ...incoming.filter((a) => !seen.has(a.id))];
}

function reducer(state: FeedState, action: Action): FeedState {
  switch (action.type) {
    case 'reset':
      return {
        query: action.query,
        items: [],
        nextCursor: null,
        hasMore: true,
        status: 'loading',
        error: null,
      };
    case 'request':
      return { ...state, status: 'loading', error: null };
    case 'success':
      // A late response for a query the user has already moved on from.
      if (action.query !== state.query) return state;
      return {
        ...state,
        items: action.append
          ? appendUnique(state.items, action.page.items)
          : action.page.items,
        nextCursor: action.page.nextCursor,
        hasMore: action.page.hasMore,
        status: 'idle',
        error: null,
      };
    case 'failure':
      if (action.query !== state.query) return state;
      return { ...state, status: 'error', error: action.error };
  }
}

function initState(snapshot: FeedSnapshot | null): FeedState {
  if (snapshot) {
    return {
      query: snapshot.query,
      items: snapshot.items,
      nextCursor: snapshot.nextCursor,
      hasMore: snapshot.hasMore,
      status: 'idle',
      error: null,
    };
  }
  return {
    query: null,
    items: [],
    nextCursor: null,
    hasMore: true,
    status: 'idle',
    error: null,
  };
}

/**
 * Cursor-paginated article feed for one search query.
 * - Changing `query` resets the feed and loads page 1 for the new query.
 * - `loadMore()` appends the next page using `nextCursor`. Safe to call often:
 *   it ignores calls while a request is in flight or when there is nothing left.
 * - Only one request is ever in flight; a newer one aborts the older one.
 */
export function useArticleFeed(query: string, snapshot: FeedSnapshot | null) {
  const [state, dispatch] = useReducer(reducer, snapshot, initState);

  const abortRef = useRef<AbortController | null>(null);
  // State updates are async, so two scroll events in the same frame could both
  // see status === 'idle'. This ref closes that gap synchronously.
  const inFlightRef = useRef(false);

  // Latest committed state, readable from effects without re-running them.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const loadPage = useCallback(async (cursor: string | null, q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    dispatch({ type: 'request' });

    try {
      const page = await fetchArticles({ cursor, limit: PAGE_SIZE, q }, controller.signal);
      if (controller.signal.aborted) return;
      dispatch({ type: 'success', query: q, page, append: cursor !== null });
    } catch (err) {
      if (controller.signal.aborted) return; // superseded on purpose, not an error
      dispatch({
        type: 'failure',
        query: q,
        error: err instanceof Error ? err.message : 'Something went wrong.',
      });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        inFlightRef.current = false;
      }
    }
  }, []);

  // Start (or restart) the feed whenever the query changes.
  useEffect(() => {
    let timer: number | undefined;

    // Already showing this query, e.g. restored from sessionStorage on refresh.
    if (stateRef.current.query !== query) {
      dispatch({ type: 'reset', query });
      // Deferring by a tick means an effect that is torn down immediately
      // (React StrictMode's dev-only mount/unmount/mount) never sends a request,
      // so the console shows exactly one request for page 1.
      timer = window.setTimeout(() => void loadPage(null, query), 0);
    }

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort(); // drop any in-flight page for the old query
    };
  }, [query, loadPage]);

  const loadMore = useCallback(() => {
    if (inFlightRef.current) return;
    if (state.status !== 'idle' || !state.hasMore) return;
    if (state.nextCursor === null || state.query === null) return;
    void loadPage(state.nextCursor, state.query);
  }, [state.status, state.hasMore, state.nextCursor, state.query, loadPage]);

  /** Re-request whichever page failed (page 1 if nextCursor is still null). */
  const retry = useCallback(() => {
    if (state.status !== 'error' || state.query === null) return;
    void loadPage(state.nextCursor, state.query);
  }, [state.status, state.nextCursor, state.query, loadPage]);

  return {
    ...state,
    loadMore,
    retry,
    isInitialLoading: state.status === 'loading' && state.items.length === 0,
  };
}