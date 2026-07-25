import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Highlight = {
  label: string;
  value: string;
};

type VeraScreenProps = {
  eyebrow: string;
  title: string;
  body: string;
  symbol: SFSymbol;
  highlights: Highlight[];
  children?: ReactNode;
};

export function VeraScreen({ eyebrow, title, body, symbol, highlights, children }: VeraScreenProps) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.wordmark}>Vera</Text>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
            </View>
            <View style={styles.iconFrame}>
              <SymbolView name={symbol} tintColor="#d8b46a" size={24} />
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>

          <View style={styles.highlightGrid}>
            {highlights.map((item) => (
              <View key={item.label} style={styles.highlightCard}>
                <Text style={styles.highlightValue}>{item.value}</Text>
                <Text style={styles.highlightLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          {children ?? (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Ready for integration</Text>
                <View style={styles.statusDot} />
              </View>
              <Text style={styles.panelCopy}>
                This placeholder confirms the Vera navigation shell is active while the native API
                contracts are finalized.
              </Text>
              <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
                <Text style={styles.ghostButtonText}>Preview surface</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050507',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.select({ ios: 112, android: 132, default: 96 }),
    gap: 22,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    color: '#fffaf1',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
  },
  eyebrow: {
    marginTop: 3,
    color: '#8d8798',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  iconFrame: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151219',
    borderWidth: 1,
    borderColor: '#292331',
  },
  hero: {
    paddingTop: 18,
    gap: 12,
  },
  title: {
    color: '#fffaf1',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
  },
  body: {
    maxWidth: 520,
    color: '#b8b0c5',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  highlightGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  highlightCard: {
    flex: 1,
    minHeight: 82,
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26212d',
    backgroundColor: '#101014',
    padding: 12,
  },
  highlightValue: {
    color: '#f2d38d',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  highlightLabel: {
    color: '#8f879c',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#292331',
    backgroundColor: '#111116',
    padding: 16,
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: '#fffaf1',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#d8b46a',
  },
  panelCopy: {
    color: '#a7a0b3',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  ghostButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3144',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostButtonText: {
    color: '#f7f1e8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
