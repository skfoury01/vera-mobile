import { API_URL } from '@/lib/config';
import { ApiError, removeStoredToken, getStoredToken } from '@/lib/api';

export type FeedCreatorProfile = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

export type FeedCreator = {
  id: string;
  userId: string;
  profile: FeedCreatorProfile | null;
  streakCurrent: number;
};

export type FeedPost = {
  id: string;
  title: string | null;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  visibility: string | null;
  locked: boolean;
  isLocked: boolean;
  allowPreview: boolean;
  previewStartSeconds: number | null;
  previewDurationSeconds: number | null;
  previewMediaUrl: string | null;
  accessRequired: string | null;
  canView: boolean;
  createdAt: string;
  category: string | null;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  creator: FeedCreator | null;
};

export type FeedResponse = {
  posts: FeedPost[];
  nextCursor: string | null;
  category: string;
  sort: string;
  pageSize: number;
};

type GetFeedInput = {
  cursor?: string | null;
  take?: number;
  windowDays?: number;
};

type GetFeedOptions = {
  signal?: AbortSignal;
};

export async function getFeed(input: GetFeedInput = {}, options: GetFeedOptions = {}): Promise<FeedResponse> {
  const token = await getStoredToken();
  const response = await fetch(buildFeedUrl(input), {
    method: 'GET',
    headers: buildFeedHeaders(token),
    signal: options.signal,
  });
  const parsed = await parseJson(response);

  if (response.status === 401) {
    if (token) {
      await removeStoredToken();
    }
    throw new ApiError({
      status: 401,
      code: 'invalid',
      userMessage: 'Your session expired. Sign in again to personalize your feed.',
      details: parsed,
    });
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: 'unexpected_server_error',
      userMessage: 'Vera could not load the feed. Please try again.',
      details: parsed,
    });
  }

  return normalizeFeedResponse(parsed);
}

function buildFeedUrl(input: GetFeedInput) {
  const url = new URL('/api/feed/fyp', API_URL);
  if (input.cursor) url.searchParams.set('cursor', input.cursor);
  if (typeof input.take === 'number') url.searchParams.set('take', String(input.take));
  if (typeof input.windowDays === 'number') url.searchParams.set('windowDays', String(input.windowDays));
  return url.toString();
}

function buildFeedHeaders(token: string | null) {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function normalizeFeedResponse(value: unknown): FeedResponse {
  if (!value || typeof value !== 'object') {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      userMessage: 'Vera returned an unexpected feed response.',
      details: value,
    });
  }

  const data = value as Partial<FeedResponse>;
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
    category: typeof data.category === 'string' ? data.category : 'ALL',
    sort: typeof data.sort === 'string' ? data.sort : 'fyp',
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : 0,
  };
}
