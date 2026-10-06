import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { creatorTheme } from '@/lib/creatorTheme';
import type { CreatorProfile } from '@/lib/creatorApi';
import { categoryLabel } from '@/lib/discoverCategories';
import { canMessageCreator, membershipLabel, type CreatorViewer } from '@/lib/creatorProfileApi';

type Props = { creator: CreatorProfile; viewer: CreatorViewer; onMembership: () => void; onMessage: () => void };

export function CreatorProfileHeader({ creator, viewer, onMembership, onMessage }: Props) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const { profile } = creator;
  const theme = creatorTheme(creator.themeKey);
  const messaging = canMessageCreator(creator, viewer);
  let price: string | null = null;
  if (creator.subscriptionPriceCents !== null && creator.currency) {
    try { price = new Intl.NumberFormat(undefined, { style: 'currency', currency: creator.currency }).format(creator.subscriptionPriceCents / 100); } catch { /* Invalid currencies omit price. */ }
  }
  return <View>
    <View style={[styles.banner, { borderBottomColor: theme.accent }]}>
      <View style={[styles.glow, { backgroundColor: theme.glow }]} />
      <Text style={styles.bannerBrand}>VERA</Text>
      {creator.bannerUrl && failedBanner !== creator.bannerUrl ? <Image accessibilityLabel={`${profile.displayName} banner`} source={{ uri: creator.bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ top: `${creator.bannerPositionY}%`, left: '50%' }} onError={() => setFailedBanner(creator.bannerUrl)} /> : null}
    </View>
    <View style={styles.info}>
      <View style={[styles.avatar, { borderColor: theme.accent }]}>
        {profile.avatarUrl && failedAvatar !== profile.avatarUrl ? <Image accessibilityLabel={`${profile.displayName} avatar`} source={{ uri: profile.avatarUrl }} style={styles.avatarImage} contentFit="cover" onError={() => setFailedAvatar(profile.avatarUrl)} /> : <Text accessibilityLabel="Creator avatar fallback" style={styles.initial}>{profile.displayName.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <Text style={styles.name}>{profile.displayName}</Text>
      {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
      {creator.foundingCreator ? <Text style={[styles.badge, { color: theme.textAccent, backgroundColor: theme.soft, borderColor: theme.border }]}>✦ Founding creator</Text> : null}
      {creator.categories.length ? <View style={styles.categories}>{creator.categories.map(category => <Text key={category} style={styles.category}>{categoryLabel(category)}</Text>)}</View> : null}
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
      {creator.stats ? <View style={[styles.stats, { borderColor: theme.border }]}>
        {(['posts', 'likes', 'views'] as const).map(metric => <View key={metric} accessible accessibilityLabel={`${creator.stats![metric]} ${metric}`} style={styles.stat}>
          <Text style={[styles.statNumber, { color: theme.textAccent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(creator.stats![metric])}</Text>
          <Text style={styles.statLabel}>{metric[0].toUpperCase() + metric.slice(1)}</Text>
        </View>)}
      </View> : null}
      <View style={[styles.membership, { borderColor: theme.border }]}>
        <Text style={styles.membershipTitle}>{membershipLabel(viewer)}</Text>
        {!viewer.owner ? <Text style={styles.secondary}>{price ? `${price} / month · ` : ''}{viewer.subscribed ? 'Manage your membership on Verapage.' : 'Join this creator’s membership on Verapage.'}</Text> : null}
        <View style={styles.actions}>
          {!viewer.owner ? <Pressable accessibilityRole="button" accessibilityLabel={viewer.subscribed ? 'Manage membership on website' : 'Subscribe on website'} onPress={onMembership} style={[styles.action, styles.primary, { backgroundColor: theme.accent }]}><Text style={[styles.primaryText, { color: theme.onAccent }]}>{viewer.subscribed ? 'Manage membership' : 'Subscribe'}</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={messaging ? 'Message on website' : 'Message unavailable'} accessibilityState={{ disabled: !messaging }} disabled={!messaging} onPress={messaging ? onMessage : undefined} style={[styles.action, styles.message, { borderColor: theme.accent }, !messaging && styles.disabled]}><Text style={[styles.messageText, { color: theme.textAccent }]}>{messaging ? 'Message' : 'Message unavailable'}</Text></Pressable>
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  banner: { height: 180, backgroundColor: '#160D25', overflow: 'hidden', borderBottomWidth: 2, justifyContent: 'center', alignItems: 'center' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, right: -80, top: -150 },
  bannerBrand: { color: '#DAC6F1', fontSize: 24, fontWeight: '900', letterSpacing: 8 },
  info: { paddingHorizontal: 20, paddingBottom: 24, gap: 10 },
  avatar: { width: 92, height: 92, marginTop: -42, borderRadius: 46, borderWidth: 3, backgroundColor: '#21132F', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' }, initial: { color: '#E9D5FF', fontSize: 32, fontWeight: '800' },
  name: { color: '#F8F5FC', fontSize: 27, lineHeight: 33, fontWeight: '800' }, username: { color: '#BDB3C8', fontSize: 15 },
  badge: { color: '#DAC0FF', fontSize: 12, fontWeight: '700', alignSelf: 'flex-start', backgroundColor: '#29183B', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, category: { color: '#CBBAD9', fontSize: 12, backgroundColor: '#1B1125', borderColor: '#352342', borderWidth: 1, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6 },
  bio: { color: '#E1DAE8', fontSize: 15, lineHeight: 23, marginTop: 4 },
  membership: { borderWidth: 1, borderColor: '#382248', borderRadius: 20, padding: 16, gap: 12, marginTop: 8, marginBottom: 12, backgroundColor: '#130C1C' },
  membershipTitle: { color: '#E9D5FF', fontSize: 16, fontWeight: '700' }, secondary: { color: '#ADA0BA', fontSize: 13, lineHeight: 20 },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 14, marginTop: 6, marginBottom: 4 },
  stat: { flex: 1, minWidth: 64, alignItems: 'center', gap: 4 }, statNumber: { fontSize: 22, fontWeight: '800' }, statLabel: { color: '#ADA0BA', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' },
  action: { flexGrow: 1, flexBasis: 120, minWidth: 120 },
  primary: { backgroundColor: '#9B5CFF', borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: 12 }, primaryText: { color: '#12091F', fontWeight: '800', fontSize: 14, textAlign: 'center' },
  message: { backgroundColor: '#130C1C', borderWidth: 1, borderColor: '#4A325D', borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: 12 }, messageText: { color: '#DAC0FF', fontWeight: '700', fontSize: 14, textAlign: 'center' }, disabled: { opacity: 0.55 },
});
