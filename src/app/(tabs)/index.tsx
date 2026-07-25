import { Link } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { FeedPostCard } from '@/components/feed/FeedPostCard';
import { ApiError } from '@/lib/api';
import { getFeed, type FeedPost } from '@/lib/feedApi';

const PAGE_SIZE = 10;
type FeedIconName = SymbolViewProps['name'];

export default function HomeScreen() {
  const { handleUnauthorized, isAuthenticated, user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const firstPageAbortRef = useRef<AbortController | null>(null);
  const paginationAbortRef = useRef<AbortController | null>(null);
  const authKey = user?.id ?? 'guest';

  const loadFirstPage = useCallback(
    async (mode: 'initial' | 'refresh') => {
      firstPageAbortRef.current?.abort();
      paginationAbortRef.current?.abort();
      const controller = new AbortController();
      firstPageAbortRef.current = controller;
      paginationAbortRef.current = null;
      loadingMoreRef.current = false;

      if (mode === 'initial') {
        setIsInitialLoading(true);
      } else {
        setIsRefreshing(true);
        setSessionExpiredMessage(null);
      }

      setIsLoadingMore(false);
      setInitialError(null);
      setPaginationError(null);

      try {
        const response = await getFeed({ take: PAGE_SIZE }, { signal: controller.signal });
        if (!mountedRef.current || firstPageAbortRef.current !== controller) return;

        setPosts(dedupePosts(response.posts));
        setNextCursor(response.nextCursor);
        if (mode === 'refresh' || isAuthenticated) {
          setSessionExpiredMessage(null);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        if (!mountedRef.current || firstPageAbortRef.current !== controller) return;

        if (error instanceof ApiError && error.status === 401) {
          await handleUnauthorized();
          if (!mountedRef.current || firstPageAbortRef.current !== controller) return;
          setSessionExpiredMessage('Your session expired. Showing the public feed.');
          setPosts([]);
          setNextCursor(null);
          setInitialError(null);
          return;
        }

        setInitialError(toFeedErrorMessage(error));
      } finally {
        if (!mountedRef.current || firstPageAbortRef.current !== controller) return;
        firstPageAbortRef.current = null;
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [handleUnauthorized, isAuthenticated]
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current || isInitialLoading || isRefreshing) return;

    paginationAbortRef.current?.abort();
    const controller = new AbortController();
    paginationAbortRef.current = controller;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setPaginationError(null);

    try {
      const response = await getFeed({ cursor: nextCursor, take: PAGE_SIZE }, { signal: controller.signal });
      if (!mountedRef.current || paginationAbortRef.current !== controller) return;

      setPosts((current) => dedupePosts([...current, ...response.posts]));
      setNextCursor(response.nextCursor);
    } catch (error) {
      if (isAbortError(error)) return;
      if (!mountedRef.current || paginationAbortRef.current !== controller) return;

      if (error instanceof ApiError && error.status === 401) {
        await handleUnauthorized();
        if (!mountedRef.current || paginationAbortRef.current !== controller) return;
        setSessionExpiredMessage('Your session expired. Showing the public feed.');
        setNextCursor(null);
        return;
      }

      setPaginationError(toFeedErrorMessage(error));
    } finally {
      if (!mountedRef.current || paginationAbortRef.current !== controller) return;
      paginationAbortRef.current = null;
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [handleUnauthorized, isInitialLoading, isRefreshing, nextCursor]);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    queueMicrotask(() => {
      if (!cancelled) {
        loadFirstPage('initial');
      }
    });

    return () => {
      cancelled = true;
      firstPageAbortRef.current?.abort();
      paginationAbortRef.current?.abort();
      firstPageAbortRef.current = null;
      paginationAbortRef.current = null;
      loadingMoreRef.current = false;
      mountedRef.current = false;
    };
  }, [authKey, loadFirstPage]);

  const refresh = useCallback(() => {
    loadFirstPage('refresh');
  }, [loadFirstPage]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => {
    return <FeedPostCard post={item} />;
  }, []);

  if (isInitialLoading) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.loaderMark}>
          <ActivityIndicator color="#d8b46a" />
        </View>
        <Text style={styles.centerText}>Curating your feed</Text>
      </View>
    );
  }

  if (initialError && posts.length === 0) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.stateIcon}>
          <FeedSymbol name={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' }} size={22} />
        </View>
        <Text style={styles.errorTitle}>Feed unavailable</Text>
        <Text style={styles.errorText}>{initialError}</Text>
        <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]} onPress={refresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <FeedHeader
              isAuthenticated={isAuthenticated}
              sessionExpiredMessage={sessionExpiredMessage}
            />
          }
          ListEmptyComponent={<EmptyFeed isAuthenticated={isAuthenticated} />}
          ListFooterComponent={
            <FeedFooter
              isLoadingMore={isLoadingMore}
              paginationError={paginationError}
              onRetry={loadMore}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor="#d8b46a"
              colors={['#d8b46a']}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.45}
        />
      </SafeAreaView>
    </View>
  );
}

function FeedHeader({
  isAuthenticated,
  sessionExpiredMessage,
}: {
  isAuthenticated: boolean;
  sessionExpiredMessage: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brandCluster}>
          <Text style={styles.wordmark}>Vera</Text>
          <View style={styles.feedSwitch}>
            <Pressable style={({ pressed }) => [styles.feedPillActive, pressed && styles.pressed]}>
              <Text style={styles.feedPillActiveText}>For You</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.feedPill, pressed && styles.pressed]}>
              <Text style={styles.feedPillText}>Following</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} />
          <IconButton name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} />
        </View>
      </View>

      {!isAuthenticated && (
        <View style={styles.guestPrompt}>
          <Text style={styles.guestPromptText}>Browsing public previews</Text>
          <Link href="/sign-in" asChild>
            <Pressable style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
              <Text style={styles.signInButtonText}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      )}

      {sessionExpiredMessage && (
        <View style={styles.sessionNotice}>
          <FeedSymbol
            name={{ ios: 'exclamationmark.circle', android: 'error_outline', web: 'error_outline' }}
            size={15}
            color="#f2d38d"
          />
          <Text style={styles.sessionNoticeText}>{sessionExpiredMessage}</Text>
        </View>
      )}
    </View>
  );
}

function EmptyFeed({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptyBody}>
        {isAuthenticated
          ? 'Pull to refresh and check for new creator posts.'
          : 'Public previews will appear here when creators share new drops.'}
      </Text>
      {!isAuthenticated && (
        <Link href="/sign-in" asChild>
          <Pressable style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryButtonText}>Sign In</Text>
          </Pressable>
        </Link>
      )}
    </View>
  );
}

function FeedFooter({
  isLoadingMore,
  onRetry,
  paginationError,
}: {
  isLoadingMore: boolean;
  onRetry: () => void;
  paginationError: string | null;
}) {
  if (isLoadingMore) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator color="#d8b46a" />
      </View>
    );
  }

  if (paginationError) {
    return (
      <View style={styles.paginationError}>
        <Text style={styles.paginationErrorText}>{paginationError}</Text>
        <Pressable style={({ pressed }) => [styles.smallRetry, pressed && styles.pressed]} onPress={onRetry}>
          <Text style={styles.smallRetryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return <View style={styles.footerSpacer} />;
}

function Separator() {
  return <View style={styles.separator} />;
}

function IconButton({ name }: { name: FeedIconName }) {
  return (
    <Pressable style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <FeedSymbol name={name} size={18} />
    </Pressable>
  );
}

function FeedSymbol({
  color = '#fffaf1',
  name,
  size,
}: {
  color?: string;
  name: FeedIconName;
  size: number;
}) {
  return <SymbolView name={name} tintColor={color} size={size} weight="semibold" />;
}

function dedupePosts(items: FeedPost[]) {
  const seen = new Set<string>();
  const out: FeedPost[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }

  return out;
}

function toFeedErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.userMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Vera could not load the feed. Please try again.';
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050507',
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: Platform.select({ ios: 116, android: 126, default: 104 }),
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  headerTop: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  wordmark: {
    color: '#fffaf1',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
  },
  feedSwitch: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#241f2b',
    backgroundColor: '#0b0a0e',
    padding: 3,
  },
  feedPillActive: {
    borderRadius: 999,
    backgroundColor: '#d8b46a',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  feedPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedPillActiveText: {
    color: '#17100a',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  feedPillText: {
    color: '#928a9d',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#2a2431',
    backgroundColor: '#0d0c11',
  },
  guestPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2b2432',
    backgroundColor: '#0d0b11',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  guestPromptText: {
    flex: 1,
    color: '#b8b0c5',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  signInButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8b46a66',
    backgroundColor: '#d8b46a18',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signInButtonText: {
    color: '#f2d38d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  sessionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#5f4b214d',
    backgroundColor: '#1a1409cc',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sessionNoticeText: {
    flex: 1,
    color: '#f2d38d',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  separator: {
    height: 10,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerSpacer: {
    height: 14,
  },
  paginationError: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  paginationErrorText: {
    color: '#b8b0c5',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  smallRetry: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8b46a55',
    backgroundColor: '#d8b46a12',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallRetryText: {
    color: '#f2d38d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  emptyState: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2b2432',
    backgroundColor: '#0c0b10',
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    color: '#fffaf1',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  emptyBody: {
    color: '#a7a0b3',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050507',
    padding: 24,
    gap: 13,
  },
  loaderMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    borderWidth: 1,
    borderColor: '#d8b46a33',
    backgroundColor: '#111014',
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#332b3d',
    backgroundColor: '#111014',
  },
  centerText: {
    color: '#b8b0c5',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#fffaf1',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  errorText: {
    maxWidth: 320,
    color: '#b8b0c5',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#d8b46a',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#17100a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
