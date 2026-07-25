import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
        <ActivityIndicator color="#d8b46a" />
        <Text style={styles.centerText}>Loading your feed</Text>
      </View>
    );
  }

  if (initialError && posts.length === 0) {
    return (
      <View style={styles.centerScreen}>
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
              email={user?.email ?? null}
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
  email,
  isAuthenticated,
  sessionExpiredMessage,
}: {
  email: string | null;
  isAuthenticated: boolean;
  sessionExpiredMessage: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.wordmark}>Vera</Text>
          <Text style={styles.eyebrow}>For You</Text>
        </View>
        {!isAuthenticated && (
          <Link href="/sign-in" asChild>
            <Pressable style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </Pressable>
          </Link>
        )}
      </View>

      <Text style={styles.headerTitle}>
        {isAuthenticated ? 'Picked for your Vera universe.' : 'Explore creator drops from Vera.'}
      </Text>
      <Text style={styles.headerBody}>
        {isAuthenticated && email
          ? `Signed in as ${email}.`
          : 'Public previews are available now. Sign in to personalize what appears here.'}
      </Text>
      {sessionExpiredMessage && (
        <View style={styles.sessionNotice}>
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
          : 'Public posts will appear here when creators share previews.'}
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
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 116,
  },
  header: {
    paddingBottom: 18,
    gap: 12,
  },
  headerTop: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  wordmark: {
    color: '#fffaf1',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  eyebrow: {
    marginTop: 2,
    color: '#d8b46a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  headerTitle: {
    maxWidth: 340,
    color: '#fffaf1',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  headerBody: {
    maxWidth: 520,
    color: '#aca4ba',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  signInButton: {
    borderRadius: 999,
    backgroundColor: '#d8b46a',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signInButtonText: {
    color: '#17100a',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  sessionNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5f4b21',
    backgroundColor: '#1a1409',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sessionNoticeText: {
    color: '#f2d38d',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  separator: {
    height: 16,
  },
  footer: {
    paddingVertical: 22,
  },
  footerSpacer: {
    height: 22,
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
    borderColor: '#3a3144',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallRetryText: {
    color: '#fffaf1',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#292331',
    backgroundColor: '#101014',
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
    gap: 14,
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
    borderRadius: 8,
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
