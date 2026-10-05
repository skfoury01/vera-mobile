import { apiRequest, ApiError, getStoredToken } from '@/lib/api';
import type { FeedPost } from '@/lib/feedApi';
import { muxPlaybackId, normalizeBookmark, normalizeLike } from '@/lib/postMedia';
export const postPath = (id: string) => `/api/posts/${encodeURIComponent(id)}`;
export const postShareUrl = (id: string) => `https://verapage.com/p/${encodeURIComponent(id)}`;
export async function postRequest<T>(path: string, options: Parameters<typeof apiRequest>[1] = {}) {
  return apiRequest<T>(path, { ...options, token: await getStoredToken() });
}
export async function getPost(id: string, signal?: AbortSignal) {
  const data = await postRequest<{ post: FeedPost }>(postPath(id), { signal });
  if (!data?.post?.id || typeof data.post.canView !== 'boolean') throw new ApiError({ status: 0, code: 'invalid_response', userMessage: 'Invalid post response.' });
  return data.post;
}
export async function setLiked(id: string, liked: boolean) {
  return normalizeLike(await postRequest(`${postPath(id)}/like`, { method: liked ? 'POST' : 'DELETE' }));
}
export async function setBookmarked(id: string, saved: boolean) {
  return normalizeBookmark(await postRequest('/api/bookmarks', { method: 'POST', body: { postId: id, action: saved ? 'add' : 'remove' } }));
}
export type PostComment = { id: string; text: string; parentId: string | null; createdAt: string; mediaUrl?: string | null; user: { displayName: string | null; username: string | null; avatarUrl: string | null } };
export async function getComments(id: string, signal?: AbortSignal) {
  const data = await postRequest<{ comments: PostComment[] }>(`${postPath(id)}/comments`, { signal });
  if (!Array.isArray(data?.comments)) throw new Error('Invalid comments response');
  return data.comments;
}
export async function addComment(id: string, text: string, parentId?: string) {
  return postRequest<{ comment: PostComment; commentCount: number }>(`${postPath(id)}/comments`, { method: 'POST', body: { text, ...(parentId ? { parentId } : {}) } });
}
export const REPORT_REASONS = ['SPAM', 'HARASSMENT', 'HATE', 'NON_CONSENSUAL', 'UNDERAGE', 'IMPERSONATION', 'COPYRIGHT', 'OTHER'] as const;
export async function reportPost(id: string, reason: typeof REPORT_REASONS[number]) {
  return postRequest('/api/reports', { method: 'POST', body: { postId: id, reason } });
}
export async function resolveVideoUrl(id: string, url: string, signal?: AbortSignal, canViewFullMedia = true) {
  const playbackId = muxPlaybackId(url);
  if (playbackId && !canViewFullMedia) return null;
  if (!playbackId) return /^https?:\/\//.test(url) ? url : null;
  const data = await postRequest<{ tokens: { playback: string } }>(`${postPath(id)}/mux-playback-token`, { signal });
  if (!data?.tokens?.playback) throw new Error('Video playback is unavailable');
  return `https://stream.mux.com/${playbackId}.m3u8?token=${encodeURIComponent(data.tokens.playback)}`;
}
export async function claimPostPreview(id: string, signal?: AbortSignal) {
  const data = await postRequest<{ allowed: boolean; reason?: string }>(`${postPath(id)}/preview/use`, { method: 'POST', signal });
  if (data?.allowed !== true) throw new Error(data?.reason === 'already_used' ? 'You have already used this preview.' : 'This preview is unavailable.');
}
