import { router } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Share } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/lib/api';
import type { FeedPost } from '@/lib/feedApi';
import { postShareUrl, reportPost, REPORT_REASONS, setBookmarked, setLiked } from '@/lib/postApi';

const patches = new Map<string, Partial<FeedPost>>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let revision = 0;
const emit = () => { revision++; listeners.forEach(fn => fn()); };
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function getPostRevision() { return revision; }
export function clearPostPatches(requestRevision: number) { if (!pending.size && revision === requestRevision) { patches.clear(); emit(); } }
export function updatePostState(userId: string | undefined, id: string, patch: Partial<FeedPost>) {
  const key = `${userId ?? 'guest'}:${id}`;
  patches.set(key, { ...patches.get(key), ...patch }); emit();
}
export function usePostActions(original: FeedPost) {
  const { user, isAuthenticated, handleUnauthorized } = useAuth();
  const currentUser = useRef(user?.id);
  useEffect(() => { currentUser.current = user?.id; }, [user?.id]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  useSyncExternalStore(subscribe, () => revision, () => revision);
  const key = `${user?.id ?? 'guest'}:${original.id}`;
  const post = { ...original, ...patches.get(key) };
  const requireAuth = () => { if (isAuthenticated) return true; router.push('/sign-in'); return false; };
  const handleError = async (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) { await handleUnauthorized(); router.push('/sign-in'); }
    else Alert.alert('Unable to complete action', error instanceof Error ? error.message : 'Please try again.');
  };
  const mutate = async (kind: 'like' | 'save') => {
    if (!requireAuth()) return;
    const requestKey = `${key}:${kind}`;
    if (pending.has(requestKey)) return;
    const actorId = user?.id;
    const previous = kind === 'like' ? { viewerHasLiked: post.viewerHasLiked, likeCount: post.likeCount } : { viewerHasBookmarked: post.viewerHasBookmarked };
    const optimistic = kind === 'like' ? { viewerHasLiked: !post.viewerHasLiked, likeCount: Math.max(0, post.likeCount + (post.viewerHasLiked ? -1 : 1)) } : { viewerHasBookmarked: !post.viewerHasBookmarked };
    pending.add(requestKey); updatePostState(actorId, post.id, optimistic);
    try {
      const result = kind === 'like' ? await setLiked(post.id, !post.viewerHasLiked) : await setBookmarked(post.id, !post.viewerHasBookmarked);
      if (currentUser.current === actorId) updatePostState(actorId, post.id, result);
    } catch (error) {
      updatePostState(actorId, post.id, previous);
      if (currentUser.current === actorId) await handleError(error);
    } finally { pending.delete(requestKey); emit(); }
  };
  const share = async () => {
    try { await Share.share({ message: `Check out this post on Verapage\n${postShareUrl(post.id)}` }); }
    catch (error) { await handleError(error); }
  };
  const report = () => { if (requireAuth()) setReportOpen(true); };
  const submitReport = async (reason: typeof REPORT_REASONS[number]) => {
    if (!requireAuth()) return;
    const requestKey = `${key}:report`;
    if (pending.has(requestKey)) return;
    pending.add(requestKey); setReporting(true);
    try {
      await reportPost(post.id, reason);
      updatePostState(user?.id, post.id, { hidden: true });
      setReportOpen(false);
      Alert.alert('Report submitted', 'Your report was sent for review.');
    } catch (error) { await handleError(error); }
    finally { pending.delete(requestKey); setReporting(false); emit(); }
  };

  return { post, reportOpen, reporting, submitReport, closeReport: () => setReportOpen(false), requireAuth, handleError, share, like: () => mutate('like'), save: () => mutate('save'),
    liking: pending.has(`${key}:like`), saving: pending.has(`${key}:save`),
    more: () => Alert.alert('Post options', undefined, [ { text: 'Share', onPress: share }, ...(user?.id !== post.creator?.userId ? [{ text: 'Report', onPress: report }] : []), { text: 'Cancel', style: 'cancel' } ]),
  };
}
