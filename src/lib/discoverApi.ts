import { apiRequest } from '@/lib/api';
import { API_URL } from '@/lib/config';
import { creatorCategories, type DiscoverCategory, type DiscoverSort, type CreatorCategory } from '@/lib/discoverCategories';
export { categoryLabel, CREATOR_CATEGORIES, type DiscoverCategory, type DiscoverSort } from '@/lib/discoverCategories';

// Public contract: fanbase-mvp/src/app/api/discover/creators/route.ts.
export type DiscoverCreator = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  categories: CreatorCategory[];
  foundingCreator: boolean;
  placement: 'featured' | 'sponsored' | null;
};
export type DiscoverOptions = { query: string; category: DiscoverCategory; sort: DiscoverSort; refresh?: number };
function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
export function normalizeDiscoverQuery(query: string) {
  return query.trim().replace(/^@+/, '').toLowerCase();
}
export function avatarSource(value: unknown) {
  const path = text(value);
  if (!path) return null;
  try {
    const url = new URL(path, API_URL);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
export function discoverRequestPath(options: DiscoverOptions) {
  const params = new URLSearchParams();
  // Website All uses default and omits both sort and category filters.
  if (options.sort !== 'default') params.set('sort', options.sort);
  if (options.category !== 'all') params.set('category', options.category);
  const query = normalizeDiscoverQuery(options.query);
  if (query) params.set('q', query);
  // This endpoint authenticates website cookies only. Use its public rankings.
  params.set('personalize', 'false');
  params.set('includeBundles', 'false');
  params.set('includePersonalizedBundles', 'false');
  params.set('refresh', String(options.refresh ?? 0));
  return `/api/discover/creators?${params}`;
}
export function normalizeDiscoverResponse(value: unknown, category: DiscoverCategory = 'all', query = ''): DiscoverCreator[] {
  if (!value || typeof value !== 'object' || !('creators' in value) || !Array.isArray(value.creators)) {
    throw new Error('Vera returned an unexpected discovery response. Please try again.');
  }
  const response = value as { creators: unknown[]; featuredCreators?: unknown };
  if (response.featuredCreators !== undefined && !Array.isArray(response.featuredCreators)) throw new Error('Invalid featured creators response');
  const featured = Array.isArray(response.featuredCreators) ? response.featuredCreators : [];
  const seen = new Set<string>();
  const search = normalizeDiscoverQuery(query);
  // Website renders Featured independently of creators. Empty organic results
  // must not hide valid category matches returned in the Featured pool.
  return [...featured.map(row => ({ row, featured: true })), ...response.creators.map(row => ({ row, featured: false }))].flatMap(({ row, featured }) => {
    if (!row || typeof row !== 'object') return [];
    const creator = row as Record<string, unknown>;
    const id = text(creator.id);
    if (!id || seen.has(id) || creator.status !== 'APPROVED' || creator.isSearchVisible !== true || creator.bannedAt || creator.userBannedAt) return [];
    const categories = creatorCategories(creator.categories, creator.category);
    if (category !== 'all' && !categories.includes(category)) return [];
    // Website matchesSearch also filters results from the top_pick fallback.
    if (search && ![creator.username, creator.displayName, creator.bio, ...categories].some(field => typeof field === 'string' && field.toLowerCase().includes(search))) return [];
    seen.add(id);
    return [{ id, displayName: text(creator.displayName), username: text(creator.username), avatarUrl: avatarSource(creator.avatarUrl), bio: text(creator.bio), categories, foundingCreator: creator.foundingCreator === true,
      placement: featured ? creator.isSponsored === true || creator.featuredSource === 'SPONSORED' ? 'sponsored' as const : 'featured' as const : null }];
  });
}
export async function getDiscoverCreators(options: DiscoverOptions, signal?: AbortSignal) {
  const response = await apiRequest(discoverRequestPath(options), { signal, credentials: 'omit', cache: 'no-store' });
  return normalizeDiscoverResponse(response, options.category, options.query);
}
