import { ApiError, apiRequest, getStoredToken } from '@/lib/api';

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
  hidden?: boolean;
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
  viewerHasBookmarked: boolean;
  creator: FeedCreator | null;
};

export type FeedResponse = {
  posts: FeedPost[];
  nextCursor: string | null;
  category: string;
  sort: string;
  pageSize: number;
};

export type FeedMode = 'for-you' | 'following';

type GetFeedInput = {
  cursor?: string | null;
  take?: number;
  windowDays?: number;
  mode?: FeedMode;
};

type GetFeedOptions = {
  signal?: AbortSignal;
};

export async function getFeed(input: GetFeedInput = {}, options: GetFeedOptions = {}): Promise<FeedResponse> {
  const token = await getStoredToken();
  const parsed = await apiRequest(buildFeedUrl(input), { token, signal: options.signal });

  return normalizeFeedResponse(parsed);
}

function buildFeedUrl(input: GetFeedInput) {
  const url = new URL('/api/feed/fyp', 'https://verapage.com');
  if (input.cursor) url.searchParams.set('cursor', input.cursor);
  if (typeof input.take === 'number') url.searchParams.set('take', String(input.take));
  if (typeof input.windowDays === 'number') url.searchParams.set('windowDays', String(input.windowDays));
  if (input.mode) url.searchParams.set('mode', input.mode);
  return `${url.pathname}${url.search}`;
}

export function normalizeFeedResponse(value: unknown): FeedResponse {
  if (!value || typeof value !== 'object') {
    throw new ApiError({
      status: 0,
      code: 'invalid_response',
      userMessage: 'Vera returned an unexpected feed response.',
      details: value,
    });
  }

  const data = value as Partial<FeedResponse>;
  if (!Array.isArray(data.posts)) throw new ApiError({ status: 0, code: 'invalid_response', userMessage: 'Vera returned an unexpected feed response.' });
  return {
    posts: Array.isArray(data.posts) ? data.posts : [],
    nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
    category: typeof data.category === 'string' ? data.category : 'ALL',
    sort: typeof data.sort === 'string' ? data.sort : 'fyp',
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : 0,
  };
}
