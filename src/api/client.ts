/**
 * API Client for Articles API
 * 
 * For local development, use the mock API server (see api-server/README.md)
 * For production, set VITE_API_BASE_URL environment variable or update this constant
 */

import type {
  ArticleDetail,
  ArticlesListParams,
  ArticlesListResponse,
} from '../types';

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Coerce whatever the server sends into the shape the UI relies on. */
function normalizeArticle<T extends { id: string }>(raw: T): T {
  return { ...raw, id: String(raw.id) };
}

function normalizePage(raw: ArticlesListResponse): ArticlesListResponse {
  const nextCursor = raw.nextCursor ?? null;
  return {
    items: (raw.items ?? []).map(normalizeArticle),
    nextCursor,
    // Never claim there is more to load if there's no cursor to load it with.
    hasMore: Boolean(raw.hasMore) && nextCursor !== null,
  };
}

/**
 * GET /articles: one page of the feed.
 * Every request is logged so the console shows pages being fetched one at a
 * time as you scroll, never all at once.
 */
export async function fetchArticles(
  { cursor = null, limit = 10, q = null }: ArticlesListParams,
  signal?: AbortSignal,
): Promise<ArticlesListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (q) params.set('q', q);
  const url = `${API_BASE_URL}/articles?${params.toString()}`;

  const startedAt = performance.now();
  console.log(`[API] → GET ${url}`);

  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (err) {
    if (signal?.aborted) {
      console.log(`[API] ✕ aborted ${url}`);
      throw err;
    }
    console.error(`[API] ✕ network error ${url}`, err);
    throw new ApiError(
      'Could not reach the article server. Check that the mock API is running on port 3001.',
    );
  }

  if (!response.ok) {
    console.error(`[API] ✕ ${response.status} ${url}`);
    throw new ApiError(
      `The article server responded with ${response.status}.`,
      response.status,
    );
  }

  const page = normalizePage((await response.json()) as ArticlesListResponse);
  const ms = Math.round(performance.now() - startedAt);
  console.log(
    `[API] ← ${response.status} ${page.items.length} articles, ` +
      `nextCursor=${JSON.stringify(page.nextCursor)}, hasMore=${page.hasMore} (${ms}ms)`,
  );
  return page;
}

/** GET /articles/:id: not needed by the feed, kept for a future detail view. */
export async function fetchArticle(
  id: string,
  signal?: AbortSignal,
): Promise<ArticleDetail> {
  const url = `${API_BASE_URL}/articles/${encodeURIComponent(id)}`;
  console.log(`[API] → GET ${url}`);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new ApiError(
      `The article server responded with ${response.status}.`,
      response.status,
    );
  }
  return normalizeArticle((await response.json()) as ArticleDetail);
}