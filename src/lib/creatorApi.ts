import { normalizeCreatorMusic, normalizePageFocus, type CreatorMusicRelease, type ProfileSection } from '@/lib/creatorMusic';
import { creatorTheme, type CreatorThemeKey } from '@/lib/creatorTheme';
import { postRequest } from '@/lib/postApi';
import { avatarSource } from '@/lib/discoverApi';
import { creatorCategories, type CreatorCategory } from '@/lib/discoverCategories';

export type CreatorProfile = {
  id: string;
  userId: string;
  subscriptionPriceCents: number | null;
  currency: string | null;
  bannerUrl: string | null;
  bannerPositionY: number;
  accent: string;
  themeKey: CreatorThemeKey | null;
  stats: { posts: number; likes: number; views: number } | null;
  categories: CreatorCategory[];
  foundingCreator: boolean;
  canMessage: boolean;
  pageFocus: ProfileSection;
  musicReleases: CreatorMusicRelease[];
  profile: { displayName: string; username: string | null; avatarUrl: string | null; bio: string | null };
};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
export function normalizeCreator(value: unknown, expectedId: string): CreatorProfile {
  const data = value as { creator?: Record<string, unknown> } | null;
  const creator = data?.creator;
  if (!creator || creator.id !== expectedId || typeof creator.userId !== 'string' || !creator.userId) throw new Error('Invalid creator response');
  const profile = creator.profile as Record<string, unknown> | null;
  const username = text(profile?.username)?.replace(/^@+/, '') || null;
  const theme = creatorTheme((creator.theme as { key?: unknown } | undefined)?.key);
  const stats = creator.stats as Record<string, unknown> | null;
  const validCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
  return {
    id: expectedId, userId: creator.userId,
    subscriptionPriceCents: typeof creator.subscriptionPriceCents === 'number' && Number.isFinite(creator.subscriptionPriceCents) && creator.subscriptionPriceCents >= 0 ? Math.floor(creator.subscriptionPriceCents) : null,
    currency: typeof creator.currency === 'string' && /^[A-Za-z]{3}$/.test(creator.currency) ? creator.currency.toUpperCase() : null,
    bannerUrl: avatarSource(creator.bannerUrl),
    bannerPositionY: typeof creator.bannerPositionY === 'number' && Number.isFinite(creator.bannerPositionY) ? Math.max(0, Math.min(100, creator.bannerPositionY)) : 50,
    themeKey: theme.key, accent: theme.accent,
    // Missing totals stay missing; never infer totals from a paginated list.
    stats: stats && validCount(stats.posts) && validCount(stats.likes) && validCount(stats.views) ? { posts: stats.posts, likes: stats.likes, views: stats.views } : null,
    categories: creatorCategories(creator.categories, creator.category),
    foundingCreator: creator.foundingCreator === true,
    canMessage: creator.canMessage === true,
    pageFocus: normalizePageFocus(creator.pageFocus), musicReleases: normalizeCreatorMusic(creator.musicReleases, expectedId),
    profile: { displayName: text(profile?.displayName) || username || 'Vera creator', username, avatarUrl: avatarSource(profile?.avatarUrl), bio: text(profile?.bio) },
  };
}
export async function getCreator(id: string, signal?: AbortSignal) {
  const data = await postRequest(`/api/creators/id/${encodeURIComponent(id)}`, { signal, credentials: 'omit', cache: 'no-store' });
  return normalizeCreator(data, id);
}
