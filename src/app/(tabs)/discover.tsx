import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoverCreatorCard } from '@/components/discover/DiscoverCreatorCard';
import { categoryLabel, CREATOR_CATEGORIES, DISCOVER_MODES, DISCOVER_PAGE_SIZE, DISCOVER_DEBOUNCE_MS, type DiscoverCategory, type DiscoverSort } from '@/lib/discoverCategories';
import type { DiscoverCreator } from '@/lib/discoverApi';
import { DiscoverLoader, type DiscoverState } from '@/lib/discoverLoader';

const SORTS = DISCOVER_MODES;
const CATEGORIES = ['all', ...CREATOR_CATEGORIES] as const;

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DiscoverCategory>('all');
  // The website defaults guests to Trending; native personalization is unavailable.
  const [sort, setSort] = useState<DiscoverSort>('trending');
  const [results, setResults] = useState<DiscoverState>({ creators: [], loading: true, refreshing: false, error: null });
  const [loader] = useState(() => new DiscoverLoader(setResults));
  const [visibleCount, setVisibleCount] = useState(DISCOVER_PAGE_SIZE);
  const refreshRef = useRef(0);
  const listRef = useRef<FlatList<DiscoverCreator>>(null);
  const { creators, loading, refreshing, error } = results;
  const search = query.trim();

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loader.schedule({ query: '', category: 'all', sort: 'trending' });
    });
    return () => { cancelled = true; loader.cancel(); };
  }, [loader]);

  const updateFilters = (nextQuery: string, nextCategory: DiscoverCategory, nextSort: DiscoverSort, delay = 0) => {
    loader.schedule({ query: nextQuery, category: nextCategory, sort: nextSort, refresh: refreshRef.current }, delay);
    setVisibleCount(DISCOVER_PAGE_SIZE);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const changeQuery = (value: string) => {
    if (value.trim() !== search) updateFilters(value, category, sort, value.trim() ? DISCOVER_DEBOUNCE_MS : 0);
    setQuery(value);
  };
  const load = (refresh = false) => {
    if (refresh) {
      refreshRef.current++;
      setVisibleCount(DISCOVER_PAGE_SIZE);
    }
    void loader.load({ query, category, sort, refresh: refreshRef.current }, refresh);
  };
  const sortLabel = SORTS.find(item => item.value === sort)!.label;
  const title = search ? 'Search results' : sort === 'default' ? 'Explore creators' : sortLabel;

  return <SafeAreaView edges={['top']} style={styles.root}>
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>VERA</Text>
        <Text accessibilityRole="header" style={styles.title}>Discover</Text>
      </View>
      <Text style={styles.subtitle}>Find your people. Follow your curiosity.</Text>
      <View style={styles.search}>
        <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="#A99AB5" size={20} accessible={false} />
        <TextInput accessibilityLabel="Search creators by username or display name" placeholder="Search creators" placeholderTextColor="#95899F" value={query} onChangeText={changeQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={100} style={styles.input} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => changeQuery('')} style={styles.clear}><SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} tintColor="#A99AB5" size={20} accessible={false} /></Pressable> : null}
      </View>
    </View>
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} keyboardShouldPersistTaps="handled">
        {CATEGORIES.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: category === item }} onPress={() => { if (category !== item) { updateFilters(query, item, sort); setCategory(item); } }} style={[styles.chip, category === item && styles.chipActive]}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{categoryLabel(item)}</Text></Pressable>)}
      </ScrollView>
    </View>
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts} keyboardShouldPersistTaps="handled">
      {SORTS.map(item => (
        <Pressable
          key={item.value}
          accessibilityRole="button"
          accessibilityState={{ selected: sort === item.value }}
          onPress={() => {
            if (sort !== item.value) {
              updateFilters(query, category, item.value);
              setSort(item.value);
            }
          }}
          style={[styles.sort, sort === item.value && styles.sortActive]}>
          <Text numberOfLines={1} style={[styles.sortText, sort === item.value && styles.chipTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
      </ScrollView>
    </View>
    <FlatList
      ref={listRef}
      data={creators.slice(0, visibleCount)}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <DiscoverCreatorCard creator={item} />}
      style={styles.list}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={!search ? <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#B56CFF" colors={['#B56CFF']} /> : undefined}
      ListHeaderComponent={<View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{!loading && !error ? <Text style={styles.count}>{creators.length}</Text> : null}</View>}
      ItemSeparatorComponent={Separator}
      ListFooterComponent={!loading && visibleCount < creators.length ? <Pressable accessibilityRole="button" accessibilityLabel="Show more creators" onPress={() => setVisibleCount(count => count + DISCOVER_PAGE_SIZE)} style={[styles.retry, styles.more]}><Text style={styles.retryText}>Show more creators</Text></Pressable> : null}
      ListEmptyComponent={<View style={styles.empty}>
        {loading ? <><ActivityIndicator color="#B56CFF" /><Text style={styles.emptyText}>{search ? 'Finding creators…' : 'Discovering creators…'}</Text></> : error ? <><Text accessibilityRole="alert" style={styles.emptyTitle}>Couldn’t load creators</Text><Text style={styles.emptyText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></> : <><SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="#B56CFF" size={30} accessible={false} /><Text style={styles.emptyTitle}>{search ? 'No creators found' : 'No creators here yet'}</Text><Text style={styles.emptyText}>{search ? 'Try another name or a different category.' : 'Try another category or check back soon.'}</Text></>}
      </View>}
    />
  </SafeAreaView>;
}

function Separator() { return <View style={styles.separator} />; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07050B' },
  header: { paddingHorizontal: 20, paddingTop: 10, gap: 12 },
  eyebrow: { color: '#B56CFF', fontSize: 10, letterSpacing: 3, fontWeight: '800', marginBottom: 6 },
  title: { color: '#F8F5FC', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  subtitle: { color: '#A99AB5', fontSize: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, minHeight: 52, borderRadius: 18, backgroundColor: '#130A1B', borderWidth: 1, borderColor: '#A855F730', marginTop: 6 },
  input: { flex: 1, color: '#F8F5FC', fontSize: 16, paddingVertical: 14 },
  clear: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  categories: { gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  chip: { minHeight: 44, paddingHorizontal: 17, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF14', backgroundColor: '#130A1B', justifyContent: 'center' },
  chipActive: { backgroundColor: '#9B5CFF', borderColor: '#B56CFF' },
  chipText: { color: '#BDB3C8', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#F8F5FC' },
  sorts: { paddingHorizontal: 20, gap: 8 },
  sort: { flexShrink: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1, borderColor: '#FFFFFF14', backgroundColor: '#100817' },
  sortActive: { backgroundColor: '#321A42', borderColor: '#B56CFF80' },
  sortText: { flexShrink: 0, color: '#A99AB5', fontSize: 13, fontWeight: '700' },
  list: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 40, flexGrow: 1 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 14 },
  sectionTitle: { color: '#F8F5FC', fontSize: 18, fontWeight: '700' },
  count: { color: '#95899F', fontSize: 13 },
  separator: { height: 12 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 56, gap: 14 },
  emptyTitle: { color: '#F8F5FC', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: '#A99AB5', fontSize: 14, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 22, justifyContent: 'center', backgroundColor: '#9B5CFF', borderRadius: 16 },
  more: { alignSelf: 'center', marginTop: 20 },
  retryText: { color: '#F8F5FC', fontWeight: '700' },
});
