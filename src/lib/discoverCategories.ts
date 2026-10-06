// Website CategoryOption and /api/discover/creators category identifiers.
export const CREATOR_CATEGORIES = ['GAMING', 'FITNESS', 'ART', 'LIFESTYLE', 'MUSIC', 'EDUCATION', 'OTHER'] as const;
export type CreatorCategory = typeof CREATOR_CATEGORIES[number];
export type DiscoverCategory = CreatorCategory | 'all';
export const DISCOVER_MODES = [
  { value: 'default', label: 'Explore' },
  { value: 'trending', label: 'Trending' },
  { value: 'new', label: 'New & rising' },
  { value: 'top_pick', label: 'Top picks' },
] as const;
export type DiscoverSort = typeof DISCOVER_MODES[number]['value'];
export const DISCOVER_PAGE_SIZE = 12;
export const DISCOVER_DEBOUNCE_MS = 220;

export function normalizeCategory(value: unknown): DiscoverCategory | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toUpperCase();
  if (!key || key === 'ALL') return 'all';
  return CREATOR_CATEGORIES.includes(key as CreatorCategory) ? key as CreatorCategory : null;
}
export function categoryLabel(category: DiscoverCategory) {
  return category === 'all' ? 'All' : category[0] + category.slice(1).toLowerCase();
}
export function creatorCategories(categories: unknown, category: unknown): CreatorCategory[] {
  const values = Array.isArray(categories) && categories.length ? categories : [category];
  return [...new Set(values.map(normalizeCategory).filter((key): key is CreatorCategory => key !== null && key !== 'all'))];
}
