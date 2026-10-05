import { postRequest } from '@/lib/postApi';
export type CreatorProfile = { id: string; userId: string; subscriptionPriceCents: number; currency: string; profile: { displayName: string | null; username: string | null; avatarUrl: string | null; bio: string | null } | null };
export async function getCreator(id: string, signal?: AbortSignal) {
  const data = await postRequest<{ creator: CreatorProfile }>(`/api/creators/id/${encodeURIComponent(id)}`, { signal });
  if (!data?.creator?.id) throw new Error('Creator unavailable');
  return data.creator;
}
