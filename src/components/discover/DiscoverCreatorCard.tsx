import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryLabel } from '@/lib/discoverCategories';
import type { DiscoverCreator } from '@/lib/discoverApi';

export function DiscoverCreatorCard({ creator }: { creator: DiscoverCreator }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const name = creator.displayName || creator.username || 'Creator';
  const showAvatar = creator.avatarUrl && failedUrl !== creator.avatarUrl;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${name}${creator.username ? `, @${creator.username}` : ''}${creator.foundingCreator ? ', Founding creator' : ''}${creator.placement === 'sponsored' ? ', Sponsored' : creator.placement === 'featured' ? ', Featured' : ''}`}
      onPress={() => router.push({ pathname: '/creator/[creatorId]', params: { creatorId: creator.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.initial} accessible={false}>{Array.from(name)[0]?.toUpperCase() || 'V'}</Text>
          {showAvatar ? <Image source={creator.avatarUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={creator.avatarUrl} onError={() => setFailedUrl(creator.avatarUrl)} accessible={false} /> : null}
        </View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {creator.username ? <Text style={styles.username} numberOfLines={1}>@{creator.username.replace(/^@/, '')}</Text> : null}
        </View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#95899F" size={18} accessible={false} />
      </View>
      {creator.bio ? <Text style={styles.bio} numberOfLines={2} ellipsizeMode="tail">{creator.bio}</Text> : null}
      {creator.categories.length || creator.foundingCreator || creator.placement ? <View style={styles.tags}>
        {creator.placement ? <View style={styles.tag}><Text style={styles.tagText}>{creator.placement === 'sponsored' ? 'Sponsored' : 'Featured'}</Text></View> : null}
        {creator.foundingCreator ? <View style={styles.founding}><SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} tintColor="#D8B4FE" size={12} accessible={false} /><Text style={styles.foundingText}>Founding creator</Text></View> : null}
        {creator.categories.map(category => <View key={category} style={styles.tag}><Text style={styles.tagText}>{categoryLabel(category)}</Text></View>)}
      </View> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#130A1B', borderWidth: 1, borderColor: '#A855F724', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  pressed: { backgroundColor: '#21102E', opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', backgroundColor: '#321A42', borderWidth: 1, borderColor: '#B56CFF40', alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#D8B4FE', fontSize: 24, fontWeight: '700' },
  identity: { flex: 1, gap: 4 },
  name: { color: '#F8F5FC', fontSize: 18, fontWeight: '700' },
  username: { color: '#A99AB5', fontSize: 13 },
  bio: { color: '#BDB3C8', fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { backgroundColor: '#FFFFFF07', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { color: '#BDB3C8', fontSize: 11, fontWeight: '600' },
  founding: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#9B5CFF18', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  foundingText: { color: '#D8B4FE', fontSize: 11, fontWeight: '600' },
});
