import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedPostCard } from '@/components/feed/FeedPostCard';
import { hasCreatorPostPreview, type CreatorPost } from '@/lib/creatorProfileApi';
import { creatorTheme, type CreatorThemeKey } from '@/lib/creatorTheme';

export function CreatorProfilePostCard({ post, themeKey, onMembership }: { post: CreatorPost; themeKey: CreatorThemeKey | null; onMembership: () => void }) {
  const openPost = () => router.push({ pathname: '/post/[postId]', params: { postId: post.id } });
  return <FeedPostCard post={post} videoThumbnails visible={false}
    lockedContent={<LockedPanel post={post} themeKey={themeKey} onMembership={onMembership} onOpenPost={openPost} />} />;
}

function LockedPanel({ post, themeKey, onMembership, onOpenPost }: { post: CreatorPost; themeKey: CreatorThemeKey | null; onMembership: () => void; onOpenPost: () => void }) {
  const theme = creatorTheme(themeKey);
  const preview = hasCreatorPostPreview(post);
  const membership = post.accessRequired === 'subscription' || post.visibility === 'SUBSCRIBERS_ONLY';
  const title = post.isAgeLocked ? 'Age confirmation required' : preview ? 'Preview available' : membership ? post.previewUsed ? 'Subscribe to unlock the full post' : 'Subscribe to unlock' : 'Post unavailable';
  return <View style={[styles.panel, { borderColor: theme.border }]}>
    <View style={[styles.icon, { backgroundColor: theme.soft }]}>
      <SymbolView name={preview ? { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' } : { ios: 'lock.fill', android: 'lock', web: 'lock' }} size={22} tintColor={theme.accent} accessible={false} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {preview ? <>
      <Text style={[styles.badge, { color: theme.textAccent, backgroundColor: theme.soft }]}>One-time preview</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Watch preview" onPress={onOpenPost} style={[styles.button, styles.secondary, { borderColor: theme.accent }]}><Text style={[styles.buttonText, { color: theme.textAccent }]}>Watch preview</Text></Pressable>
      <Text style={styles.copy}>Subscribe to unlock the full post</Text>
    </> : <Text style={styles.copy}>{post.isAgeLocked ? 'Confirm your age on Verapage to view this post.' : membership ? 'Members-only post' : 'Open this post for access details.'}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={post.isAgeLocked ? 'Confirm age on website' : membership ? 'View membership' : 'Open post'} onPress={post.isAgeLocked || membership ? onMembership : onOpenPost} style={[styles.button, { backgroundColor: theme.accent }]}><Text style={[styles.buttonText, { color: theme.onAccent }]}>{post.isAgeLocked ? 'Confirm age on website' : membership ? 'View membership' : 'Open post'}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 12, padding: 18, borderRadius: 20, borderWidth: 1, backgroundColor: '#130C1C', minHeight: 180, alignItems: 'center', gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F8F5FC', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  copy: { color: '#BDB3C8', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  badge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  button: { alignSelf: 'stretch', minHeight: 46, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  secondary: { borderWidth: 1, backgroundColor: '#130C1C' }, buttonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
