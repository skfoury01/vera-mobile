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
import { getFeed, type FeedMode, type FeedPost } from '@/lib/feedApi';

const PAGE_SIZE = 10;
type FeedIconName = SymbolViewProps['name'];

export default function HomeScreen() {
  const { handleUnauthorized, isAuthenticated, user } = useAuth();
  const [feedMode, setFeedMode] = useState<FeedMode>('for-you');
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
        const response = await getFeed(
          { take: PAGE_SIZE, mode: feedMode },
          { signal: controller.signal }
        );
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
    [feedMode, handleUnauthorized, isAuthenticated]
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
      const response = await getFeed(
        { cursor: nextCursor, take: PAGE_SIZE, mode: feedMode },
        { signal: controller.signal }
      );
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
  }, [feedMode, handleUnauthorized, isInitialLoading, isRefreshing, nextCursor]);

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

  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => {
      return (
        <View>
          <FeedPostCard post={item} />
          {index === 0 ? <PremiumDropCard /> : null}
          {index === 1 ? <CreatorRoomCard /> : null}
        </View>
      );
    },
    []
  );

  if (isInitialLoading) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.loaderMark}>
          <ActivityIndicator color="#9B5CFF" />
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
              activeMode={feedMode}
              isAuthenticated={isAuthenticated}
              onModeChange={setFeedMode}
              sessionExpiredMessage={sessionExpiredMessage}
            />
          }
          ListEmptyComponent={
            <EmptyFeed
              activeMode={feedMode}
              isAuthenticated={isAuthenticated}
            />
          }
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
              tintColor="#9B5CFF"
              colors={['#9B5CFF']}
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
  activeMode,
  isAuthenticated,
  onModeChange,
  sessionExpiredMessage,
}: {
  activeMode: FeedMode;
  isAuthenticated: boolean;
  onModeChange: (mode: FeedMode) => void;
  sessionExpiredMessage: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.brandCluster}>
          <Text style={styles.wordmark}>Vera</Text>
          <View style={styles.feedSwitch}>
            <Pressable
              onPress={() => onModeChange('for-you')}
              style={({ pressed }) => [
                activeMode === 'for-you' ? styles.feedPillActive : styles.feedPill,
                pressed && styles.pressed,
              ]}>
              <Text
                style={
                  activeMode === 'for-you'
                    ? styles.feedPillActiveText
                    : styles.feedPillText
                }>
                For You
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onModeChange('following')}
              style={({ pressed }) => [
                activeMode === 'following' ? styles.feedPillActive : styles.feedPill,
                pressed && styles.pressed,
              ]}>
              <Text
                style={
                  activeMode === 'following'
                    ? styles.feedPillActiveText
                    : styles.feedPillText
                }>
                Following
              </Text>
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
            color="#D8B4FE"
          />
          <Text style={styles.sessionNoticeText}>{sessionExpiredMessage}</Text>
        </View>
      )}
    </View>
  );
}

function PremiumDropCard() {
  return (
    <View style={styles.premiumDropShell}>
      <View style={styles.premiumDropGlowTop} />
      <View style={styles.premiumDropGlowBottom} />

      <View style={styles.premiumDropTopRow}>
        <View style={styles.premiumDropBadge}>
          <FeedSymbol
            name={{
              ios: 'sparkles',
              android: 'auto_awesome',
              web: 'auto_awesome',
            }}
            size={13}
            color="#F3E8FF"
          />
          <Text style={styles.premiumDropBadgeText}>NEW DROP</Text>
        </View>

        <Text style={styles.premiumDropTime}>Just released</Text>
      </View>

      <View style={styles.premiumDropPreview}>
        <View style={styles.premiumDropPreviewGlow} />

        <View style={styles.premiumDropLock}>
          <FeedSymbol
            name={{
              ios: 'lock.fill',
              android: 'lock',
              web: 'lock',
            }}
            size={22}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.premiumDropPreviewLabel}>MEMBERS ONLY</Text>
        <Text style={styles.premiumDropPreviewTitle}>
          Behind the Scenes Collection
        </Text>
        <Text style={styles.premiumDropPreviewMeta}>
          5 videos · 18 minutes
        </Text>
      </View>

      <View style={styles.premiumDropContent}>
        <View style={styles.premiumDropCreatorRow}>
          <View style={styles.premiumDropAvatar}>
            <Text style={styles.premiumDropAvatarText}>V</Text>
          </View>

          <View style={styles.premiumDropCreatorText}>
            <Text style={styles.premiumDropCreatorName}>Vera Creator</Text>
            <Text style={styles.premiumDropCreatorMeta}>
              Premium members get instant access
            </Text>
          </View>
        </View>

        <Text style={styles.premiumDropDescription}>
          A new exclusive collection made for the creator’s closest supporters.
        </Text>

        <View style={styles.premiumDropInfoRow}>
          <View style={styles.premiumDropInfoPill}>
            <FeedSymbol
              name={{
                ios: 'play.rectangle.fill',
                android: 'video_library',
                web: 'video_library',
              }}
              size={13}
              color="#D8B4FE"
            />
            <Text style={styles.premiumDropInfoText}>Video collection</Text>
          </View>

          <View style={styles.premiumDropInfoPill}>
            <FeedSymbol
              name={{
                ios: 'person.crop.circle.badge.checkmark',
                android: 'verified_user',
                web: 'verified_user',
              }}
              size={13}
              color="#D8B4FE"
            />
            <Text style={styles.premiumDropInfoText}>Membership required</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.premiumDropButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.premiumDropButtonText}>Unlock This Drop</Text>
          <FeedSymbol
            name={{
              ios: 'arrow.right',
              android: 'arrow_forward',
              web: 'arrow_forward',
            }}
            size={15}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
    </View>
  );
}

function CreatorRoomCard() {
  return (
    <View style={styles.creatorRoomShell}>
      <View style={styles.creatorRoomGlowTop} />
      <View style={styles.creatorRoomGlowBottom} />

      <View style={styles.creatorRoomHeader}>
        <View style={styles.creatorRoomIcon}>
          <FeedSymbol
            name={{
              ios: 'person.2.fill',
              android: 'groups',
              web: 'groups',
            }}
            size={20}
            color="#E9D5FF"
          />
        </View>

        <View style={styles.creatorRoomHeading}>
          <Text style={styles.creatorRoomEyebrow}>CREATOR ROOM</Text>
          <Text style={styles.creatorRoomTitle}>Enter their private world</Text>
        </View>
      </View>

      <Text style={styles.creatorRoomBody}>
        Exclusive drops, member lives, private polls and closer access to the
        creators you support.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.creatorRoomButton,
          pressed && styles.pressed,
        ]}>
        <Text style={styles.creatorRoomButtonText}>Explore Creator Rooms</Text>
        <FeedSymbol
          name={{
            ios: 'arrow.right',
            android: 'arrow_forward',
            web: 'arrow_forward',
          }}
          size={15}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  );
}

function EmptyFeed({
  activeMode,
  isAuthenticated,
}: {
  activeMode: FeedMode;
  isAuthenticated: boolean;
}) {
  const isFollowing = activeMode === 'following';

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>
        {isFollowing ? 'Your Following feed is empty' : 'Nothing here yet'}
      </Text>
      <Text style={styles.emptyBody}>
        {isFollowing
          ? isAuthenticated
            ? 'Follow creators to see their newest posts and premium drops here.'
            : 'Sign in to see posts from creators you follow.'
          : isAuthenticated
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
        <ActivityIndicator color="#9B5CFF" />
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
  color = '#F8F5FC',
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
    backgroundColor: '#07050B',
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: Platform.select({ ios: 170, android: 180, default: 150 }),
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
    color: '#F8F5FC',
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
    borderColor: '#2B1837',
    backgroundColor: '#100817',
    padding: 3,
  },
  feedPillActive: {
    borderRadius: 999,
    backgroundColor: '#9B5CFF',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  feedPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  feedPillActiveText: {
    color: '#12091F',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  feedPillText: {
    color: '#A69CAF',
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
    borderColor: '#352143',
    backgroundColor: '#120A19',
  },
  guestPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#33203F',
    backgroundColor: '#130A1B',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  guestPromptText: {
    flex: 1,
    color: '#BDB3C8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  signInButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9B5CFF66',
    backgroundColor: '#9B5CFF18',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  signInButtonText: {
    color: '#D8B4FE',
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
    borderColor: '#7C3AED55',
    backgroundColor: '#21102ECC',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sessionNoticeText: {
    flex: 1,
    color: '#D8B4FE',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  premiumDropShell: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#A855F74A',
    backgroundColor: '#100817',
  },
  premiumDropGlowTop: {
    position: 'absolute',
    top: -95,
    right: -60,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#A855F738',
  },
  premiumDropGlowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#6D28D92B',
  },
  premiumDropTopRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  premiumDropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C084FC55',
    backgroundColor: '#A855F72A',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  premiumDropBadgeText: {
    color: '#E9D5FF',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  premiumDropTime: {
    color: '#A69CAF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  premiumDropPreview: {
    position: 'relative',
    minHeight: 230,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#5B2E75',
    backgroundColor: '#170A23',
    padding: 24,
  },
  premiumDropPreviewGlow: {
    position: 'absolute',
    top: -50,
    right: -25,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#B64CFF40',
  },
  premiumDropLock: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF66',
    backgroundColor: '#A855F755',
  },
  premiumDropPreviewLabel: {
    marginTop: 17,
    color: '#C084FC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  premiumDropPreviewTitle: {
    marginTop: 7,
    color: '#F8F5FC',
    textAlign: 'center',
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '900',
  },
  premiumDropPreviewMeta: {
    marginTop: 7,
    color: '#BDB3C8',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  premiumDropContent: {
    padding: 16,
    gap: 14,
  },
  premiumDropCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  premiumDropAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#C084FC66',
    backgroundColor: '#2B113D',
  },
  premiumDropAvatarText: {
    color: '#E9D5FF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  premiumDropCreatorText: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  premiumDropCreatorName: {
    color: '#F8F5FC',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  premiumDropCreatorMeta: {
    color: '#A69CAF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  premiumDropDescription: {
    color: '#C8BED2',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  premiumDropInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  premiumDropInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A855F733',
    backgroundColor: '#A855F714',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  premiumDropInfoText: {
    color: '#DCCFEB',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '800',
  },
  premiumDropButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  premiumDropButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  creatorRoomShell: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#A855F744',
    backgroundColor: '#13091D',
    padding: 19,
    gap: 15,
  },
  creatorRoomGlowTop: {
    position: 'absolute',
    top: -90,
    right: -55,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#9333EA38',
  },
  creatorRoomGlowBottom: {
    position: 'absolute',
    bottom: -120,
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#6D28D92B',
  },
  creatorRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorRoomIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C084FC55',
    backgroundColor: '#A855F72B',
  },
  creatorRoomHeading: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  creatorRoomEyebrow: {
    color: '#C084FC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  creatorRoomTitle: {
    color: '#F8F5FC',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
  },
  creatorRoomBody: {
    maxWidth: 560,
    color: '#C8BED2',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  creatorRoomButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  creatorRoomButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  separator: {
    height: 12,
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
    color: '#BDB3C8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  smallRetry: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9B5CFF55',
    backgroundColor: '#9B5CFF12',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallRetryText: {
    color: '#D8B4FE',
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
    borderColor: '#33203F',
    backgroundColor: '#110918',
    padding: 20,
    gap: 10,
  },
  emptyTitle: {
    color: '#F8F5FC',
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
    backgroundColor: '#07050B',
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
    borderColor: '#9B5CFF33',
    backgroundColor: '#140B1C',
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#3B2648',
    backgroundColor: '#140B1C',
  },
  centerText: {
    color: '#BDB3C8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  errorTitle: {
    color: '#F8F5FC',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  errorText: {
    maxWidth: 320,
    color: '#BDB3C8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#9B5CFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#12091F',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
