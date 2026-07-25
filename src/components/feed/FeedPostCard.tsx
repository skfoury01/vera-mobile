import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { FeedPost } from '@/lib/feedApi';

type FeedPostCardProps = {
  post: FeedPost;
};

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

  return (
    <View style={styles.card}>
      <View style={styles.creatorRow}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{creatorName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        <View style={styles.creatorText}>
          <Text style={styles.creatorName} numberOfLines={1}>
            {creatorName}
          </Text>
          <View style={styles.metaRow}>
            {username && (
              <Text style={styles.username} numberOfLines={1}>
                {username}
              </Text>
            )}
            {post.creator?.streakCurrent ? (
              <Text style={styles.streak}>{post.creator.streakCurrent} day streak</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.date}>{formatDate(post.createdAt)}</Text>
      </View>

      {mediaUrl ? (
        <View style={styles.mediaFrame}>
          <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="cover" transition={160} />
          {isLocked && <LockedOverlay />}
          {isVideo && (
            <View style={styles.videoBadge}>
              <Text style={styles.videoBadgeText}>Video</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.emptyMedia}>
          <Text style={styles.emptyMediaText}>{isLocked ? 'Subscriber-only post' : 'No preview available'}</Text>
          {isLocked && <Text style={styles.emptyMediaSubtext}>Sign in or subscribe on Vera to unlock.</Text>}
        </View>
      )}

      <View style={styles.copyBlock}>
        {post.category && <Text style={styles.category}>{post.category}</Text>}
        {title && <Text style={styles.title}>{title}</Text>}
        {caption && (
          <Text style={styles.caption} numberOfLines={4}>
            {caption}
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>{formatCount(post.likeCount)} likes</Text>
        <Text style={styles.stat}>{formatCount(post.commentCount)} comments</Text>
      </View>
    </View>
  );
}

function selectMediaUrl(post: FeedPost) {
  const isLocked = (post.isLocked || post.locked) && !post.canView;

  if (isLocked) {
    return post.previewMediaUrl ?? post.previewUrl ?? post.thumbnailUrl ?? null;
  }

  return post.mediaUrl ?? post.thumbnailUrl ?? post.previewUrl ?? null;
}

function LockedOverlay() {
  return (
    <View style={styles.lockedOverlay}>
      <View style={styles.lockedPill}>
        <Text style={styles.lockedText}>Subscriber-only</Text>
      </View>
    </View>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatCount(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#292331',
    backgroundColor: '#101014',
  },
  creatorRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#191420',
  },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3a3144',
    backgroundColor: '#17131d',
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
    color: '#fffaf1',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  metaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    maxWidth: 150,
    color: '#928a9d',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  streak: {
    color: '#d8b46a',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  date: {
    color: '#777080',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  mediaFrame: {
    position: 'relative',
    aspectRatio: 4 / 5,
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
    backgroundColor: '#05050799',
  },
  lockedPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d8b46a55',
    backgroundColor: '#120f14dd',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  lockedText: {
    color: '#f2d38d',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  emptyMedia: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08080b',
    padding: 20,
    gap: 6,
  },
  emptyMediaText: {
    color: '#fffaf1',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  emptyMediaSubtext: {
    color: '#9d96a8',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  copyBlock: {
    paddingHorizontal: 14,
    paddingTop: 13,
    gap: 7,
  },
  category: {
    color: '#d8b46a',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#fffaf1',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '900',
  },
  caption: {
    color: '#b8b0c5',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 15,
  },
  stat: {
    color: '#8f879c',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
});
