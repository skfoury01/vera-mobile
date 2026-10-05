import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { FeedPostCard } from '@/components/feed/FeedPostCard';
import { updatePostState } from '@/hooks/usePostActions';
import { ApiError } from '@/lib/api';
import type { FeedPost } from '@/lib/feedApi';
import { addComment, getComments, getPost, type PostComment } from '@/lib/postApi';

export default function PostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user, isAuthenticated, handleUnauthorized } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const commentYRef = useRef(0);
  const submitRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const authKey = user?.id ?? 'guest';
  const onError = useCallback(async (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { await handleUnauthorized(); router.push('/sign-in'); }
    return e instanceof Error ? e.message : 'Please try again.';
  }, [handleUnauthorized]);
  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    setLoading(true); setError(null); setCommentsError(null); setPost(null); setComments([]);
    try {
      const item = await getPost(postId, controller.signal);
      if (controller.signal.aborted) return;
      setPost(item);
      if (item.canView) {
        try { const list = await getComments(postId, controller.signal); if (!controller.signal.aborted) setComments(list); }
        catch (e) { if (!controller.signal.aborted) setCommentsError(await onError(e)); }
      }
    } catch (e) { if (!controller.signal.aborted) setError(await onError(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [postId, onError]);
  useEffect(() => { let cancelled = false; queueMicrotask(() => { if (!cancelled) void load(); }); return () => { cancelled = true; controllerRef.current?.abort(); }; }, [load, authKey]);
  const submit = async () => {
    if (!isAuthenticated) { router.push('/sign-in'); return; }
    if (submitRef.current || !text.trim() || !post?.canView) return;
    const controller = controllerRef.current;
    submitRef.current = true; setSending(true); setCommentsError(null);
    try {
      const result = await addComment(postId, text.trim());
      if (controller?.signal.aborted) return;
      setText('');
      if (typeof result?.commentCount === 'number') updatePostState(user?.id, postId, { commentCount: result.commentCount });
      const list = await getComments(postId, controller?.signal);
      if (!controller?.signal.aborted) setComments(list);
    } catch (e) { if (!controller?.signal.aborted) setCommentsError(await onError(e)); }
    finally { submitRef.current = false; setSending(false); }
  };
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.button}><Text style={styles.text}>‹ Back</Text></Pressable>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color="#C084FC" /> : error ? <View style={styles.section}><Text style={styles.text}>{error}</Text><Pressable style={styles.button} onPress={load}><Text style={styles.text}>Retry</Text></Pressable></View> : post ? <>
          <FeedPostCard key={`${authKey}:${post.id}`} post={post} detail onComment={() => scrollRef.current?.scrollTo({ y: commentYRef.current, animated: true })} />
          <View style={styles.section} onLayout={event => { commentYRef.current = event.nativeEvent.layout.y; }}>
            <Text style={styles.heading}>Comments</Text>
            {!post.canView ? <Text style={styles.muted}>Join this creator’s membership to view the full post and comments.</Text> : <>
              {commentsError ? <><Text accessibilityRole="alert" style={styles.text}>{commentsError}</Text><Pressable accessibilityRole="button" onPress={load} style={styles.button}><Text style={styles.text}>Reload comments</Text></Pressable></> : null}
              {!comments.length && !commentsError ? <Text style={styles.muted}>No comments yet. Start the conversation.</Text> : null}
              {comments.map(comment => <View key={comment.id} style={[styles.comment, comment.parentId ? { marginLeft: 20 } : null]}>
                <Text style={styles.text}>{comment.user.displayName ?? comment.user.username ?? 'Vera member'}</Text>
                {comment.parentId ? <Text style={styles.muted}>Reply</Text> : null}
                <Text style={styles.muted}>{comment.text || (comment.mediaUrl ? 'Media attachment' : '')}</Text>
              </View>)}
              {isAuthenticated ? <>
                <TextInput accessibilityLabel="Write a comment" placeholder="Write a comment…" placeholderTextColor="#A69CAF" value={text} onChangeText={setText} multiline maxLength={2000} editable={!sending} style={styles.input} />
                <Pressable accessibilityRole="button" accessibilityLabel="Send comment" disabled={sending || !text.trim()} onPress={submit} style={[styles.button, (sending || !text.trim()) && { opacity: 0.5 }]}>{sending ? <ActivityIndicator color="#C084FC" /> : <Text style={styles.text}>Post comment</Text>}</Pressable>
              </> : <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={styles.button}><Text style={styles.text}>Sign in to comment</Text></Pressable>}
            </>}
          </View>
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07050B' }, section: { padding: 16, gap: 14 }, text: { color: '#F8F5FC', fontSize: 15 }, muted: { color: '#BDB3C8', lineHeight: 22 }, heading: { color: '#D8B4FE', fontWeight: '800', fontSize: 20 }, button: { minHeight: 44, padding: 14, backgroundColor: '#241032', borderRadius: 14 }, comment: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#33203F' }, input: { color: '#F8F5FC', minHeight: 90, borderWidth: 1, borderColor: '#9B5CFF', borderRadius: 14, padding: 14 } });
