import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CreatorMusicRelease } from '@/lib/creatorMusic';
import { creatorTheme, type CreatorThemeKey } from '@/lib/creatorTheme';
export function CreatorMusicCard({ release, themeKey, onOpen }: { release: CreatorMusicRelease; themeKey: CreatorThemeKey | null; onOpen: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const theme = creatorTheme(themeKey);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${release.title} by ${release.artist} on website`} onPress={onOpen} style={[styles.card, { borderColor: theme.border }]}>
    <View style={[styles.cover, { borderColor: theme.border }]}><Text accessible={false} style={[styles.disc, { color: theme.textAccent }]}>♫</Text>{release.coverArtUrl && failedUrl !== release.coverArtUrl ? <Image source={release.coverArtUrl} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setFailedUrl(release.coverArtUrl)} /> : null}</View>
    <View style={styles.info}><Text style={styles.title} numberOfLines={2}>{release.title}</Text><Text style={styles.artist} numberOfLines={1}>{release.artist}</Text>
      {release.typeLabel ? <Text style={styles.meta}>{release.typeLabel}</Text> : null}
      {release.priceLabel || release.accessLabel ? <Text style={styles.meta}>{release.priceLabel || release.accessLabel}</Text> : null}
      {release.hasPreview ? <Text style={[styles.preview, { color: theme.textAccent }]}>Preview available</Text> : null}
      <Text style={[styles.open, { color: theme.textAccent }]}>{release.hasPreview ? 'Listen on website ↗' : 'Open release ↗'}</Text>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({ card: { marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: '#130C1C', borderWidth: 1, flexDirection: 'row', gap: 14 }, cover: { width: 92, height: 92, borderRadius: 14, overflow: 'hidden', backgroundColor: '#21132F', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, disc: { fontSize: 34 }, info: { flex: 1, gap: 5 }, title: { color: '#F8F5FC', fontSize: 16, fontWeight: '800', lineHeight: 22 }, artist: { color: '#BDB3C8', fontSize: 13 }, meta: { color: '#ADA0BA', fontSize: 12 }, preview: { fontSize: 11, fontWeight: '700' }, open: { paddingTop: 5, fontSize: 12, fontWeight: '700' } });
