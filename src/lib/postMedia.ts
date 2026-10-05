import type { FeedPost } from './feedApi';

const realUrl = (value: string | null | undefined) => value && value !== '/images/private-post-lock.png' ? value : null;
export function isPostLocked(post: FeedPost) {
  return post.canView !== true;
}
export function selectVideoUrl(post: FeedPost) {
  if (post.mediaType?.toUpperCase() !== 'VIDEO') return null;
  if (isPostLocked(post)) return post.allowPreview === true ? realUrl(post.previewMediaUrl) : null;
  return realUrl(post.mediaUrl);
}
export function selectMediaUrl(post: FeedPost) {
  if (post.mediaType?.toUpperCase() === 'VIDEO') return selectVideoUrl(post);
  if (isPostLocked(post)) return null;
  return realUrl(post.mediaUrl) ?? realUrl(post.thumbnailUrl) ?? realUrl(post.previewUrl);
}
export function muxPlaybackId(url: string) {
  return /^mux:playback:([A-Za-z0-9_-]{6,128})$/.exec(url)?.[1] ?? null;
}
export function normalizeLike(value: unknown) {
  const data = value as { liked?: unknown; likeCount?: unknown } | null;
  if (typeof data?.liked !== 'boolean' || typeof data.likeCount !== 'number' || !Number.isFinite(data.likeCount)) throw new Error('Invalid like response');
  return { viewerHasLiked: data.liked, likeCount: Math.max(0, Math.floor(data.likeCount)) };
}
export function normalizeBookmark(value: unknown) {
  const data = value as { bookmarked?: unknown } | null;
  if (typeof data?.bookmarked !== 'boolean') throw new Error('Invalid bookmark response');
  return { viewerHasBookmarked: data.bookmarked };
}
