import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthProvider';
import { CreatorContentTabs } from '@/components/creator/CreatorContentTabs';
import { CreatorMusicCard } from '@/components/creator/CreatorMusicCard';
import { musicReleaseUrl, type CreatorMusicRelease } from '@/lib/creatorMusic';
import { CreatorProfileHeader } from '@/components/creator/CreatorProfileHeader';
import { CreatorProfilePostCard } from '@/components/creator/CreatorProfilePostCard';
import { canMessageCreator, creatorMembershipUrl, creatorMessageUrl, creatorShareUrl, type CreatorPost } from '@/lib/creatorProfileApi';
import { CreatorProfileLoader, initialProfileState } from '@/lib/creatorProfileLoader';

export default function CreatorScreen() {
  const { creatorId } = useLocalSearchParams<{ creatorId: string }>();
  const { user } = useAuth();
  // Auth/route transitions unmount cached signed media before fetching a new viewer.
  return <CreatorContent key={`${creatorId}:${user?.id ?? 'guest'}`} creatorId={creatorId} />;
}

type ContentItem = { kind: 'post'; post: CreatorPost } | { kind: 'music'; release: CreatorMusicRelease };

function CreatorContent({ creatorId }: { creatorId: string }) {
  const { handleUnauthorized } = useAuth();
  const [state, setState] = useState(initialProfileState);
  const [loader] = useState(() => new CreatorProfileLoader(setState));
  const mounted = useRef(false);
  const refreshedOnResume = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; loader.cancel(); };
  }, [creatorId, loader]);
  useEffect(() => {
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active' && mounted.current) {
        refreshedOnResume.current = true;
        void loader.load(creatorId, true);
      }
      previous = next;
    });
    return () => listener.remove();
  }, [creatorId, loader]);
  useFocusEffect(useCallback(() => {
    // Fetch once on entry and recheck canonical settings after Post Detail.
    let active = true;
    queueMicrotask(() => { if (active) void loader.load(creatorId, Boolean(loader.state.data)); });
    return () => { active = false; loader.cancel(); };
  }, [creatorId, loader]));
  useEffect(() => { if (state.unauthorized) void handleUnauthorized(); }, [state.unauthorized, handleUnauthorized]);
  const data = state.data;
  async function website(url: string) {
    try {
      refreshedOnResume.current = false;
      const result = await openBrowserAsync(url);
      // Returning from web checkout rechecks server access. No token enters a URL.
      if (result.type !== 'opened' && !refreshedOnResume.current && mounted.current && loader.state.data) await loader.load(creatorId, true);
    } catch { Alert.alert('Unable to open Verapage', 'Please try again.'); }
  }
  function membership() { if (data) void website(creatorMembershipUrl(data.creator.id)); }
  function message() { if (data && canMessageCreator(data.creator, data.viewer)) void website(creatorMessageUrl(data.creator.userId)); }
  async function share() {
    if (!data) return;
    try { await Share.share({ message: `${data.creator.profile.displayName} on Vera\n${creatorShareUrl(data.creator.id)}`, url: creatorShareUrl(data.creator.id) }); }
    catch { Alert.alert('Unable to share profile', 'Please try again.'); }
  }
  const content: ContentItem[] = state.section === 'MUSIC'
    ? (data?.creator.musicReleases ?? []).map(release => ({ kind: 'music', release }))
    : (data?.posts ?? []).map(post => ({ kind: 'post', post }));
  function renderContent({ item }: { item: ContentItem }) {
    return item.kind === 'post'
      ? <CreatorProfilePostCard post={item.post} themeKey={data?.creator.themeKey ?? null} onMembership={membership} />
      : <CreatorMusicCard release={item.release} themeKey={data?.creator.themeKey ?? null} onOpen={() => void website(musicReleaseUrl(item.release.id))} />;
  }
  return <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.toolbarButton}><Text style={styles.toolbarText}>‹ Back</Text></Pressable>
      <Text style={styles.brand}>VERA</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Share creator profile" disabled={!data} accessibilityState={{ disabled: !data }} onPress={() => void share()} style={styles.toolbarButton}><Text style={[styles.toolbarText, !data && styles.disabled]}>Share</Text></Pressable>
    </View>
    <FlatList data={content} keyExtractor={item => item.kind === 'post' ? `post:${item.post.id}` : `music:${item.release.id}`} renderItem={renderContent} contentContainerStyle={styles.list} initialNumToRender={4} windowSize={5}
      refreshControl={<RefreshControl tintColor="#C084FC" refreshing={state.refreshing} onRefresh={() => void loader.load(creatorId, true)} />}
      ListHeaderComponent={data ? <><CreatorProfileHeader creator={data.creator} viewer={data.viewer} onMembership={membership} onMessage={message} /><CreatorContentTabs selected={state.section} themeKey={data.creator.themeKey} onSelect={section => loader.selectSection(section)} /><View style={styles.sectionHeading}><Text style={styles.title}>{state.section === 'MUSIC' ? 'Music' : 'Posts'}</Text><Text style={styles.secondary}>{state.section === 'MUSIC' ? 'Releases by' : 'Latest from'} {data.creator.profile.displayName}</Text></View></> : null}
      ListEmptyComponent={state.loading || state.refreshing ? <View accessibilityLabel="Loading creator profile" style={styles.state}><View style={styles.skeletonBanner} /><View style={styles.skeletonLine} /><ActivityIndicator color="#C084FC" /><Text style={styles.secondary}>Loading creator…</Text></View> : state.error ? <View style={styles.state}><Text style={styles.title}>{state.notFound ? 'Creator unavailable' : 'Unable to load profile'}</Text><Text accessibilityRole="alert" style={styles.secondary}>{state.notFound ? 'This creator could not be found or is no longer available.' : state.error}</Text><Pressable accessibilityRole="button" onPress={() => void loader.load(creatorId)} style={styles.retry}><Text style={styles.toolbarText}>Try again</Text></Pressable></View> : <View style={styles.state}><Text style={styles.title}>{state.section === 'MUSIC' ? 'No music released yet' : 'No posts yet'}</Text><Text style={styles.secondary}>Check back for something new from this creator.</Text></View>}
      ListFooterComponent={state.section !== 'POSTS' ? null : state.loadingMore ? <ActivityIndicator style={styles.footer} color="#C084FC" /> : data?.nextCursor ? <View style={styles.footer}>{state.paginationError ? <Text accessibilityRole="alert" style={styles.secondary}>{state.paginationError}</Text> : null}<Pressable accessibilityRole="button" onPress={() => void loader.more()} style={styles.retry}><Text style={styles.toolbarText}>{state.paginationError ? 'Retry loading posts' : 'Load more posts'}</Text></Pressable></View> : null}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07050B' }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, minHeight: 52 },
  toolbarButton: { minWidth: 70, minHeight: 44, padding: 12, justifyContent: 'center' }, toolbarText: { color: '#D8B4FE', fontSize: 14, fontWeight: '700' }, brand: { color: '#DAC0FF', fontSize: 12, fontWeight: '800', letterSpacing: 3 },
  sectionHeading: { paddingHorizontal: 20, paddingBottom: 18, gap: 6, alignItems: 'flex-start' },
  list: { flexGrow: 1, paddingBottom: 24 }, state: { padding: 24, alignItems: 'center', gap: 16 }, title: { color: '#F8F5FC', fontSize: 20, fontWeight: '800' }, secondary: { color: '#BDB3C8', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 48, backgroundColor: '#241434', borderRadius: 14, padding: 14, alignItems: 'center' }, footer: { padding: 24, gap: 12 }, disabled: { opacity: 0.4 },
  skeletonBanner: { height: 140, backgroundColor: '#1B1125', borderRadius: 20, width: '100%' }, skeletonLine: { height: 24, backgroundColor: '#21132F', borderRadius: 8, width: '65%' },
});
