import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedPost } from '@/lib/feedApi';

type FeedPostCardProps = {
  post: FeedPost;
};
type FeedIconName = SymbolViewProps['name'];
const PRIVATE_POST_LOCK_IMAGE = '/images/private-post-lock.png';

export function FeedPostCard({ post }: FeedPostCardProps) {
  const creatorName =
    post.creator?.profile?.displayName ??
    post.creator?.profile?.username ??
    'Vera creator';
  const username = post.creator?.profile?.username ? `@${post.creator.profile.username}` : null;
  const avatarUrl = post.creator?.profile?.avatarUrl ?? null;
  const mediaUrl = selectMediaUrl(post);
  const title = post.title?.trim() || null;
  const caption = post.caption?.trim() || null;
  const isVideo = String(post.mediaType ?? '').toUpperCase() === 'VIDEO';
  const isLocked = (post.isLocked || post.locked) && !post.canView;
  const showTitle = Boolean(title && title !== caption);

  return (
    <View style={styles.post}>
      <View style={styles.creatorRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{creatorName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.creatorText}>
          <View style={styles.metaRow}>
            <Text style={styles.creatorName} numberOfLines={1}>
              {creatorName}
            </Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.date}>{formatRelativeDate(post.createdAt)}</Text>
          </View>
          <View style={styles.subMetaRow}>
            {username && (
              <Text style={styles.username} numberOfLines={1}>
                {username}
              </Text>
            )}
            {post.creator?.streakCurrent ? (
              <View style={styles.streakPill}>
                <Text style={styles.streak}>{post.creator.streakCurrent} day streak</Text>
              </View>
            ) : null}
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <FeedSymbol name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }} size={18} />
        </Pressable>
      </View>

      {mediaUrl ? (
        <View style={styles.mediaFrame}>
          <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="cover" transition={160} />
          {isLocked && <LockedOverlay hasPreview creatorName={creatorName} />}
          {isVideo && (
            <View style={styles.videoBadge}>
              <FeedSymbol name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={11} />
              <Text style={styles.videoBadgeText}>Video</Text>
            </View>
          )}
        </View>
      ) : (
        <EmptyMedia isLocked={isLocked} />
      )}

      <ActionRow
        commentCount={post.commentCount}
        likeCount={post.likeCount}
        viewerHasLiked={post.viewerHasLiked}
      />

      <View style={styles.copyBlock}>
        {caption && (
          <Text style={styles.caption} numberOfLines={3}>
            <Text style={styles.captionName}>{creatorName} </Text>
            {caption}
            {caption.length > 140 ? <Text style={styles.moreText}> more</Text> : null}
          </Text>
        )}
        {showTitle && <Text style={styles.title}>{title}</Text>}
        {post.category && <Text style={styles.category}>{post.category}</Text>}
        {!caption && !showTitle && (
          <Text style={styles.captionMuted}>
            <Text style={styles.captionName}>{creatorName}</Text> shared a new post.
          </Text>
        )}
      </View>
    </View>
  );
}

function ActionRow({
  commentCount,
  likeCount,
  viewerHasLiked,
}: {
  commentCount: number;
  likeCount: number;
  viewerHasLiked: boolean;
}) {
  return (
    <View style={styles.actionsBlock}>
      <View style={styles.actionRow}>
        <ActionButton
          active={viewerHasLiked}
          count={formatCount(likeCount)}
          label="Like"
          name={{ ios: viewerHasLiked ? 'heart.fill' : 'heart', android: 'favorite', web: 'favorite' }}
        />
        <ActionButton
          count={formatCount(commentCount)}
          label="Comment"
          name={{ ios: 'bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
        />
        <ActionButton
          accent
          label="Tip"
          name={{ ios: 'gift', android: 'redeem', web: 'redeem' }}
        />
        <View style={styles.actionSpacer} />
        <ActionButton
          label="Share"
          name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
        />
        <ActionButton
          label="Save"
          name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }}
        />
      </View>
    </View>
  );
}

function ActionButton({
  accent = false,
  active = false,
  count,
  label,
  name,
}: {
  accent?: boolean;
  active?: boolean;
  count?: string;
  label: string;
  name: FeedIconName;
}) {
  const color = accent ? '#f2d38d' : active ? '#ff7fa9' : '#fffaf1';

  return (
    <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <FeedSymbol name={name} color={color} size={20} />
      {count ? <Text style={[styles.actionCount, active && styles.actionCountActive]}>{count}</Text> : null}
      {!count && <Text style={[styles.actionLabel, accent && styles.actionLabelAccent]}>{label}</Text>}
    </Pressable>
  );
}

function EmptyMedia({ isLocked }: { isLocked: boolean }) {
  if (!isLocked) {
    return (
      <View style={styles.emptyMedia}>
        <View style={styles.emptyAccentTop} />
        <View style={styles.emptyAccentBottom} />
        <Text style={styles.emptyMediaText}>No preview available</Text>
      </View>
    );
  }

  return (
    <View style={styles.lockedCompactMedia}>
      <View style={styles.emptyAccentTop} />
      <View style={styles.emptyAccentBottom} />
      <View style={styles.lockIcon}>
        <FeedSymbol name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} color="#17100a" size={18} />
      </View>
      <Text style={styles.emptyMediaText}>Premium Content</Text>
      <Text style={styles.emptyMediaSubtext}>Subscribe to unlock exclusive content.</Text>
      <UnlockButton />
    </View>
  );
}

function LockedOverlay({ creatorName, hasPreview }: { creatorName: string; hasPreview: boolean }) {
  return (
    <View style={styles.lockedOverlay}>
      <View style={styles.lockedPanel}>
        <View style={styles.lockIcon}>
          <FeedSymbol name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} color="#17100a" size={17} />
        </View>
        <Text style={styles.lockedLabel}>Subscriber-only</Text>
        <Text style={styles.lockedMessage}>
          {hasPreview ? 'Subscribe to unlock this post' : `Unlock premium posts from ${creatorName}`}
        </Text>
        <UnlockButton />
      </View>
    </View>
  );
}

function UnlockButton() {
  return (
    <Pressable style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}>
      <Text style={styles.unlockButtonText}>View membership</Text>
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

export function selectMediaUrl(post: FeedPost) {
  const isLocked = (post.isLocked || post.locked) && !post.canView;

  if (isLocked) {
    return firstRealPreviewUrl(post.previewMediaUrl, post.previewUrl, post.thumbnailUrl);
  }

  return post.mediaUrl ?? post.thumbnailUrl ?? post.previewUrl ?? null;
}

function firstRealPreviewUrl(...values: (string | null | undefined)[]) {
  return values.find((value) => Boolean(value && value !== PRIVATE_POST_LOCK_IMAGE)) ?? null;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  post: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#19151f',
    backgroundColor: '#050507',
    paddingBottom: 14,
  },
  creatorRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 9,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d8b46a33',
    backgroundColor: '#191420',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8b46a33',
    backgroundColor: '#15111a',
  },
  avatarInitial: {
    color: '#f2d38d',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  creatorText: {
    minWidth: 0,
    flex: 1,
  },
  creatorName: {
    maxWidth: 168,
    color: '#fffaf1',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    color: '#62596c',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  username: {
    maxWidth: 145,
    color: '#928a9d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  streakPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8b46a30',
    backgroundColor: '#d8b46a12',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  streak: {
    color: '#f2d38d',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  date: {
    color: '#777080',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  moreButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  mediaFrame: {
    position: 'relative',
    aspectRatio: 3 / 4,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2b2432',
    backgroundColor: '#07070a',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffffff2a',
    backgroundColor: '#00000088',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  videoBadgeText: {
    color: '#fffaf1',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050507b8',
    padding: 22,
  },
  lockedPanel: {
    width: '82%',
    maxWidth: 300,
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8b46a38',
    backgroundColor: '#0c0a0ed9',
    padding: 18,
    gap: 8,
  },
  lockIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#d8b46a',
  },
  lockedLabel: {
    color: '#f2d38d',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  lockedMessage: {
    color: '#fffaf1',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  unlockButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#d8b46a',
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  unlockButtonText: {
    color: '#17100a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  emptyMedia: {
    position: 'relative',
    minHeight: 330,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#2b2432',
    backgroundColor: '#08070b',
    padding: 24,
    gap: 8,
  },
  lockedCompactMedia: {
    position: 'relative',
    minHeight: 176,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: 8,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#d8b46a33',
    backgroundColor: '#09080c',
    padding: 22,
    gap: 8,
  },
  emptyAccentTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#6b4fff24',
  },
  emptyAccentBottom: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#d8b46a18',
  },
  emptyMediaText: {
    color: '#fffaf1',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  emptyMediaSubtext: {
    color: '#9d96a8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionsBlock: {
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  actionRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionSpacer: {
    flex: 1,
  },
  actionButton: {
    minWidth: 36,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 17,
    paddingHorizontal: 6,
  },
  actionCount: {
    color: '#b8b0c5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  actionCountActive: {
    color: '#ff9bbb',
  },
  actionLabel: {
    color: '#b8b0c5',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  actionLabelAccent: {
    color: '#f2d38d',
  },
  copyBlock: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 6,
  },
  category: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    color: '#d8b46a',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#fffaf1',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  caption: {
    color: '#d8d2df',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  captionMuted: {
    color: '#a59dae',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  captionName: {
    color: '#fffaf1',
    fontWeight: '900',
  },
  moreText: {
    color: '#928a9d',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
