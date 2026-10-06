import { getCreator, type CreatorProfile } from '@/lib/creatorApi';
import { postRequest } from '@/lib/postApi';
import type { FeedPost } from '@/lib/feedApi';

export type CreatorPost = FeedPost & { isAgeLocked: boolean; previewUsed: boolean };
// This only advertises the server-provided preview. Post Detail still claims access.
export function hasCreatorPostPreview(post: CreatorPost) {
  return post.canView === false && !post.isAgeLocked && post.mediaType?.toUpperCase() === 'VIDEO'
    && post.allowPreview === true && !post.previewUsed && /^https?:\/\//.test(post.previewMediaUrl ?? '');
}
export type CreatorViewer = { loggedIn: boolean; subscribed: boolean; owner: boolean; ageConfirmed: boolean };
export type CreatorPostsPage = { posts: CreatorPost[]; nextCursor: string | null; viewer: CreatorViewer };
export type CreatorProfileData = CreatorPostsPage & { creator: CreatorProfile };
const text = (value: unknown) => typeof value === 'string' ? value : null;
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
export const creatorShareUrl = (id: string) => `https://verapage.com/c/${encodeURIComponent(id)}`;
export const creatorMembershipUrl = (id: string) => `${creatorShareUrl(id)}#subscription`;
export const creatorMessageUrl = (userId: string) => `https://verapage.com/messages?to=${encodeURIComponent(userId)}`;
export function membershipLabel(viewer: CreatorViewer) {
  return viewer.owner ? 'Your creator page' : viewer.subscribed ? 'Membership active' : 'Subscribe on website';
}
export function canMessageCreator(creator: CreatorProfile, viewer: CreatorViewer) {
  return viewer.loggedIn && !viewer.owner && creator.canMessage;
}
export function normalizeCreatorPosts(value: unknown, creator: CreatorProfile): CreatorPostsPage {
  const data = value as { posts?: unknown; nextCursor?: unknown; viewer?: Partial<CreatorViewer>; creator?: { creatorUserId?: unknown }; mode?: unknown } | null;
  if (!Array.isArray(data?.posts) || data?.creator?.creatorUserId !== creator.userId || data.mode !== 'public' || typeof data.viewer?.subscribed !== 'boolean' || typeof data.viewer.owner !== 'boolean' || typeof data.viewer.loggedIn !== 'boolean') throw new Error('Invalid creator posts response');
  const seen = new Set<string>();
  const posts: CreatorPost[] = data.posts.flatMap((value: unknown) => {
    const post = value as Record<string, unknown> | null;
    if (!post || post.kind !== 'CONTENT' || post.moderationStatus !== 'ACTIVE') return [];
    if (typeof post.id !== 'string' || !post.id || typeof post.canView !== 'boolean') throw new Error('Invalid creator post');
    if (post.creatorId !== undefined && post.creatorId !== creator.userId) throw new Error('Creator post mismatch');
    if (seen.has(post.id)) return [];
    seen.add(post.id);
    const canView = post.canView === true && post.isAgeLocked !== true;
    const allowPreview = post.allowPreview === true && post.isAgeLocked !== true && post.previewUsed !== true;
    return [{
      id: post.id, title: text(post.title), caption: text(post.caption), mediaType: text(post.mediaType),
      // Never retain full media from a locked response, even if an API regression supplies it.
      mediaUrl: canView ? text(post.mediaUrl) : null,
      thumbnailUrl: canView ? text(post.thumbnailUrl) : null,
      previewUrl: canView ? text(post.previewUrl) : null,
      previewMediaUrl: allowPreview ? text(post.previewMediaUrl) : null,
      canView, locked: !canView, isLocked: !canView, isAgeLocked: post.isAgeLocked === true,
      accessRequired: text(post.accessRequired), allowPreview, previewUsed: post.previewUsed === true,
      previewStartSeconds: typeof post.previewStartSeconds === 'number' ? post.previewStartSeconds : null,
      previewDurationSeconds: typeof post.previewDurationSeconds === 'number' ? post.previewDurationSeconds : null,
      visibility: text(post.visibility), createdAt: text(post.createdAt) || '', category: text(post.category),
      likeCount: count(post.likeCount), commentCount: count(post.commentCount),
      viewerHasLiked: post.viewerHasLiked === true, viewerHasBookmarked: post.viewerHasBookmarked === true,
      creator: { id: creator.id, userId: creator.userId, profile: creator.profile, streakCurrent: 0 },
    }];
  });
  return { posts, nextCursor: typeof data.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null,
    viewer: { loggedIn: data.viewer!.loggedIn!, subscribed: data.viewer!.subscribed!, owner: data.viewer!.owner!, ageConfirmed: data.viewer!.ageConfirmed === true } };
}
export async function getCreatorPosts(creator: CreatorProfile, cursor?: string | null, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  const path = `/api/creators/${encodeURIComponent(creator.userId)}/posts${params.size ? `?${params}` : ''}`;
  return normalizeCreatorPosts(await postRequest(path, { signal, credentials: 'omit', cache: 'no-store' }), creator);
}
export async function getCreatorProfile(id: string, signal?: AbortSignal): Promise<CreatorProfileData> {
  const creator = await getCreator(id, signal);
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  return { creator, ...await getCreatorPosts(creator, null, signal) };
}
