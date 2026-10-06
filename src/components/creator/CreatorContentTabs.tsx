import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileSection } from '@/lib/creatorMusic';
import { creatorTheme, type CreatorThemeKey } from '@/lib/creatorTheme';
export function CreatorContentTabs({ selected, themeKey, onSelect }: { selected: ProfileSection; themeKey: CreatorThemeKey | null; onSelect: (section: ProfileSection) => void }) {
  const theme = creatorTheme(themeKey);
  return <View style={styles.row}>{(['POSTS', 'MUSIC'] as const).map(section => <Pressable key={section} accessibilityRole="tab" accessibilityLabel={section === 'POSTS' ? 'Posts' : 'Music'} accessibilityState={{ selected: selected === section }} onPress={() => onSelect(section)} style={[styles.tab, selected === section && { borderBottomColor: theme.accent, backgroundColor: theme.soft }]}><Text numberOfLines={1} style={[styles.text, selected === section && { color: theme.textAccent }]}>{section === 'POSTS' ? 'Posts' : 'Music'}</Text></Pressable>)}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 18 }, tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#130C1C', borderBottomWidth: 2, borderBottomColor: 'transparent' }, text: { fontSize: 15, fontWeight: '700', color: '#ADA0BA' } });
