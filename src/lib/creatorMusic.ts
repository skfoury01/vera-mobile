import { avatarSource } from '@/lib/discoverApi';
export type ProfileSection = 'POSTS' | 'MUSIC';
export type CreatorMusicRelease = { id: string; title: string; typeLabel: string | null; coverArtUrl: string | null; artist: string; priceLabel: string | null; accessLabel: string | null; hasPreview: boolean };
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
export function normalizePageFocus(value: unknown): ProfileSection { return value === 'MUSIC' ? 'MUSIC' : 'POSTS'; }
export function defaultProfileSection(pageFocus: ProfileSection, releases: CreatorMusicRelease[]): ProfileSection {
  // Same fallback as Verapage /c/[id]: music first requires a public release.
  return pageFocus === 'MUSIC' && releases.length > 0 ? 'MUSIC' : 'POSTS';
}
export function normalizeCreatorMusic(value: unknown, creatorId: string): CreatorMusicRelease[] {
  if (value === undefined) return []; // Older deployments gracefully retain Posts.
  if (!Array.isArray(value)) throw new Error('Invalid creator music response');
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (row.status !== 'PUBLISHED' || row.visibility !== 'PUBLIC' || row.creatorId !== creatorId || !text(row.id) || !text(row.title)) return [];
    const id = text(row.id)!;
    if (seen.has(id)) return [];
    seen.add(id);
    // Deliberate allowlist: never retain audio, stems, download options or private data.
    return [{ id, title: text(row.title)!, typeLabel: text(row.typeLabel), coverArtUrl: avatarSource(row.coverArtUrl), artist: text(row.artist) || 'Vera creator', priceLabel: text(row.priceLabel), accessLabel: text(row.accessLabel), hasPreview: row.hasPreview === true }];
  });
}
export const musicReleaseUrl = (id: string) => `https://verapage.com/music/${encodeURIComponent(id)}`;
