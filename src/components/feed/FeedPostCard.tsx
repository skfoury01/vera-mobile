import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { FeedVideo } from '@/components/feed/FeedVideo';
import { usePostActions } from '@/hooks/usePostActions';
import { isPostLocked, selectMediaUrl } from '@/lib/postMedia';
import { Image } from 'expo-image';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { REPORT_REASONS } from '@/lib/postApi';
import type { FeedPost } from '@/lib/feedApi';

type FeedPostCardProps = {
  post: FeedPost;
  detail?: boolean;
  visible?: boolean;
  onComment?: () => void;
  videoThumbnails?: boolean;
  onMembership?: () => void;
  lockedMessage?: string;
  membershipActionLabel?: string;
  lockedContent?: ReactNode;
};
type FeedIconName = SymbolViewProps['name'];


export function FeedPostCard({ post: original, detail = false, visible = true, onComment, videoThumbnails = false, onMembership, lockedMessage, membershipActionLabel, lockedContent }: FeedPostCardProps) {
  const actions = usePostActions(original);
  const { post } = actions;
  const openPost = () => { if (!detail) router.push({ pathname: '/post/[postId]', params: { postId: post.id } }); };
  const openCreator = () => { if (post.creator?.id) router.push({ pathname: '/creator/[creatorId]', params: { creatorId: post.creator.id } }); };
  const membership = onMembership ?? openCreator;
  if (post.hidden) return null;
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
  const isLocked = isPostLocked(post);
  const showTitle = Boolean(title && title !== caption);

  return (
    <View style={styles.post}>
      <Modal visible={actions.reportOpen} transparent animationType="slide" onRequestClose={actions.closeReport}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' }}>
          <View style={{ backgroundColor: '#160D20', padding: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%' }}>
            <Text style={styles.lockedTitle}>Report post</Text>
            <Text style={styles.captionMuted}>Choose a reason. Verapage hides reported posts.</Text>
            <ScrollView>
              {REPORT_REASONS.map(reason => <Pressable key={reason} accessibilityRole="button" disabled={actions.reporting} onPress={() => actions.submitReport(reason)} style={styles.unlockButton}><Text style={styles.unlockButtonText}>{reason.toLowerCase().replaceAll('_', ' ')}</Text></Pressable>)}
            </ScrollView>
            {actions.reporting ? <ActivityIndicator color="#C084FC" /> : null}
            <Pressable accessibilityRole="button" onPress={actions.closeReport} style={styles.unlockButton}><Text style={styles.unlockButtonText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
      <View style={styles.creatorRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="View creator profile" onPress={openCreator} hitSlop={8}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{creatorName.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="View creator profile" onPress={openCreator} style={styles.creatorText}>
          <Text style={styles.creatorName} numberOfLines={1}>
            {creatorName}
          </Text>

          <View style={styles.subMetaRow}>
            {username ? (
              <Text style={styles.username} numberOfLines={1}>
                {username}
              </Text>
            ) : null}

            {username ? <Text style={styles.dot}>•</Text> : null}

            <Text style={styles.date}>{formatRelativeDate(post.createdAt)}</Text>

            {post.creator?.streakCurrent ? (
              <>
                <Text style={styles.dot}>•</Text>
                <View style={styles.streakPill}>
                  <Text style={styles.streak}>
                    {post.creator.streakCurrent} day streak
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </Pressable>

        <Pressable accessibilityLabel="Post options" accessibilityRole="button" hitSlop={8} onPress={actions.more} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
          <FeedSymbol name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }} size={18} />
        </Pressable>
      </View>

      {isLocked && lockedContent ? lockedContent : videoThumbnails && isVideo ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Open video post" onPress={openPost} style={styles.mediaFrame}>
          {!isLocked && post.thumbnailUrl ? <Image source={{ uri: post.thumbnailUrl }} style={styles.media} contentFit="contain" /> : <View style={styles.emptyMedia}><Text style={styles.emptyMediaText}>{isLocked ? 'Locked video' : 'Video post'}</Text></View>}
          <View style={{ position: 'absolute', alignSelf: 'center', top: '42%', backgroundColor: '#160D20CC', padding: 14, borderRadius: 30 }}><FeedSymbol name={{ ios: isLocked ? 'lock.fill' : 'play.fill', android: isLocked ? 'lock' : 'play_arrow', web: isLocked ? 'lock' : 'play_arrow' }} size={24} /></View>
        </Pressable>
      ) : mediaUrl ? (
        <View style={[styles.mediaFrame, isVideo && { aspectRatio: undefined }]}>
          {isVideo ? <FeedVideo key={mediaUrl} postId={post.id} url={mediaUrl} preview={isLocked} previewStart={post.previewStartSeconds ?? 0} previewDuration={post.previewDurationSeconds ?? 30} visible={visible} /> :
            <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={openPost} style={styles.media}>
              <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="contain" transition={160} />
            </Pressable>}
        </View>
      ) : videoThumbnails && !isLocked ? null : <Pressable accessibilityRole="button" accessibilityLabel="Open post" onPress={openPost}><EmptyMedia isLocked={isLocked} onMembership={membership} message={lockedMessage} actionLabel={membershipActionLabel} /></Pressable>}
      {isLocked && !lockedContent && (mediaUrl || (videoThumbnails && isVideo)) ? <View style={{ paddingHorizontal: 16 }}><Text style={styles.captionMuted}>{lockedMessage ?? 'Preview • Join this creator’s membership to unlock the full post.'}</Text><UnlockButton onPress={membership} label={membershipActionLabel} /></View> : null}
      {isVideo && !detail && !(isLocked && lockedContent) ? <Pressable accessibilityRole="button" accessibilityLabel="Open full post" onPress={openPost} style={styles.copyBlock}><Text style={styles.moreText}>Open post</Text></Pressable> : null}

      <ActionRow
        commentCount={post.commentCount}
        likeCount={post.likeCount}
        viewerHasLiked={post.viewerHasLiked}
        viewerHasBookmarked={post.viewerHasBookmarked}
        onLike={actions.like} onSave={actions.save} onShare={actions.share} onComment={onComment ?? (() => router.push({ pathname: '/post/[postId]', params: { postId: post.id } }))}
        liking={actions.liking} saving={actions.saving}
      />

      <Pressable accessibilityRole="button" accessibilityLabel="Open full caption" onPress={openPost} style={styles.copyBlock}>
        {caption && (
          <Text style={styles.caption} numberOfLines={detail ? undefined : 3}>
            <Text style={styles.captionName}>{creatorName} </Text>
            {caption}
            {!detail && caption.length > 140 ? <Text style={styles.moreText}> more</Text> : null}
          </Text>
        )}
        {showTitle && <Text style={styles.title}>{title}</Text>}
        {post.category && <Text style={styles.category}>{post.category}</Text>}
        {!caption && !showTitle && (
          <Text style={styles.captionMuted}>
            <Text style={styles.captionName}>{creatorName}</Text> shared a new post.
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function ActionRow({
  commentCount,
  likeCount,
  viewerHasLiked, viewerHasBookmarked, onLike, onSave, onShare, onComment, liking, saving,
}: {
  commentCount: number;
  likeCount: number;
  viewerHasLiked: boolean;
  viewerHasBookmarked: boolean;
  onLike: () => void; onSave: () => void; onShare: () => void; onComment: () => void;
  liking: boolean; saving: boolean;
}) {
  return (
    <View style={styles.actionsBlock}>
      <View style={styles.actionRow}>
        <ActionButton
          onPress={onLike} disabled={liking}
          active={viewerHasLiked}
          count={formatCount(likeCount)}
          label="Like"
          name={{ ios: viewerHasLiked ? 'heart.fill' : 'heart', android: 'favorite', web: 'favorite' }}
        />
        <ActionButton
          count={formatCount(commentCount)}
          label="Comment" onPress={onComment}
          name={{ ios: 'bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
        />
        <View style={styles.actionSpacer} />
        <ActionButton
          label="Share" onPress={onShare}
          name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
        />
        <ActionButton
          label={viewerHasBookmarked ? "Saved" : "Save"} active={viewerHasBookmarked} onPress={onSave} disabled={saving}
          name={{ ios: viewerHasBookmarked ? 'bookmark.fill' : 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }}
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
  name, onPress, disabled = false,
}: {
  onPress?: () => void; disabled?: boolean;
  accent?: boolean;
  active?: boolean;
  count?: string;
  label: string;
  name: FeedIconName;
}) {
  const color = accent ? '#D8B4FE' : active ? '#C084FC' : '#F8F5FC';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected: active }} hitSlop={6} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, (pressed || disabled) && styles.pressed]}>
      <FeedSymbol name={name} color={color} size={20} />
      {count ? <Text style={[styles.actionCount, active && styles.actionCountActive]}>{count}</Text> : null}
      {!count && <Text style={[styles.actionLabel, accent && styles.actionLabelAccent]}>{label}</Text>}
    </Pressable>
  );
}

function EmptyMedia({ isLocked, onMembership, message, actionLabel }: { isLocked: boolean; onMembership: () => void; message?: string; actionLabel?: string }) {
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
        <FeedSymbol name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} color="#12091F" size={18} />
      </View>
      <Text style={styles.emptyMediaText}>Premium Content</Text>
      <Text style={styles.emptyMediaSubtext}>{message ?? 'Subscribe to unlock exclusive content.'}</Text>
      <UnlockButton onPress={onMembership} label={actionLabel} />
    </View>
  );
}

function UnlockButton({ onPress, label = 'View membership' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === 'View membership' ? 'View membership information' : label} onPress={onPress} style={({ pressed }) => [styles.unlockButton, pressed && styles.pressed]}>
      <Text style={styles.unlockButtonText}>{label}</Text>
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
    borderBottomColor: '#1E1428',
    backgroundColor: '#07050B',
    paddingBottom: 14,
  },
  creatorRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#9B5CFF33',
    backgroundColor: '#1B1026',
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#9B5CFF33',
    backgroundColor: '#160D20',
  },
  avatarInitial: {
    color: '#D8B4FE',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
  },
  creatorText: {
    minWidth: 0,
    flex: 1,
  },
  creatorName: {
    maxWidth: 220,
    color: '#F8F5FC',
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
    minWidth: 0,
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    color: '#6F647A',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  username: {
    maxWidth: 112,
    color: '#A69CAF',
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  streakPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#9B5CFF30',
    backgroundColor: '#9B5CFF12',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  streak: {
    color: '#CFA8FF',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
  },
  date: {
    color: '#817689',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  moreButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  mediaFrame: {
    position: 'relative',
    aspectRatio: 4 / 5,
    marginHorizontal: 8,
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#33203F',
    backgroundColor: '#09060E',
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
    color: '#F8F5FC',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  lockedGlowTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -70,
    backgroundColor: '#9B5CFF24',
  },

  lockedGlowBottom: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -90,
    left: -55,
    backgroundColor: '#6D28D920',
  },

  lockedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#07050Bb8',
    padding: 22,
  },
  lockedPanel: {
    width: '82%',
    maxWidth: 300,
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#9B5CFF38',
    backgroundColor: '#140B1EE6',
    padding: 18,
    gap: 8,
  },
  lockIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8B4FE66',
    backgroundColor: '#A855F755',
  },
  lockedLabel: {
    marginTop: 14,
    color: '#C084FC',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  lockedTitle: {
    marginTop: 5,
    color: '#F8F5FC',
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
  },
  lockedMessage: {
    maxWidth: 280,
    marginTop: 8,
    color: '#C8BED2',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  unlockButton: {
    minWidth: 176,
    minHeight: 44,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#9B5CFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  unlockButtonText: {
    color: '#12091F',
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
    borderColor: '#33203F',
    backgroundColor: '#0D0713',
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
    borderColor: '#9B5CFF33',
    backgroundColor: '#100817',
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
    backgroundColor: '#A855F72E',
  },
  emptyAccentBottom: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: '#9B5CFF18',
  },
  emptyMediaText: {
    color: '#F8F5FC',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  emptyMediaSubtext: {
    color: '#A69CAF',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  actionsBlock: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 2,
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 17,
    paddingHorizontal: 6,
  },
  actionCount: {
    color: '#BDB3C8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  actionCountActive: {
    color: '#D8B4FE',
  },
  actionLabel: {
    color: '#BDB3C8',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  actionLabelAccent: {
    color: '#D8B4FE',
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
    color: '#9B5CFF',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8F5FC',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  caption: {
    color: '#E1DAE8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  captionMuted: {
    color: '#A69CAF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  captionName: {
    color: '#F8F5FC',
    fontWeight: '900',
  },
  moreText: {
    color: '#A69CAF',
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
