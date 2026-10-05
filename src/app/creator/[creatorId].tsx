import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCreator, type CreatorProfile } from '@/lib/creatorApi';
import { useAuth } from '@/auth/AuthProvider';
import { ApiError } from '@/lib/api';
export default function CreatorScreen() {
  const { creatorId } = useLocalSearchParams<{ creatorId: string }>();
  const { handleUnauthorized } = useAuth();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setCreator(null); setError(null); } });
    getCreator(creatorId, controller.signal).then(value => { if (!controller.signal.aborted) setCreator(value); }).catch(async e => {
      if (controller.signal.aborted) return;
      if (e instanceof ApiError && e.status === 401) await handleUnauthorized();
      setError(e instanceof Error ? e.message : 'Creator unavailable');
    });
    return () => controller.abort();
  }, [creatorId, attempt, handleUnauthorized]);
  return <SafeAreaView style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.button}><Text style={styles.text}>‹ Back</Text></Pressable>
    <ScrollView contentContainerStyle={styles.content}>
      {error ? <><Text style={styles.text}>{error}</Text><Pressable style={styles.button} onPress={() => setAttempt(v => v + 1)}><Text style={styles.text}>Retry</Text></Pressable></> : !creator ? <ActivityIndicator color="#C084FC" /> : <>
        {creator.profile?.avatarUrl ? <Image accessibilityLabel="Creator avatar" source={{ uri: creator.profile.avatarUrl }} style={styles.avatar} /> : null}
        <Text style={styles.name}>{creator.profile?.displayName ?? creator.profile?.username ?? 'Vera creator'}</Text>
        {creator.profile?.username ? <Text style={styles.muted}>@{creator.profile.username}</Text> : null}
        {creator.profile?.bio ? <Text style={styles.text}>{creator.profile.bio}</Text> : null}
        <Text style={styles.name}>Membership</Text>
        <Text style={styles.muted}>Members can unlock this creator’s exclusive posts. Membership purchases are not available in the mobile app yet.</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#07050B' }, content: { padding: 20, gap: 18 }, button: { minHeight: 44, padding: 14 }, text: { color: '#F8F5FC', fontSize: 16, lineHeight: 24 }, muted: { color: '#BDB3C8', lineHeight: 24 }, name: { color: '#D8B4FE', fontSize: 24, fontWeight: '800' }, avatar: { width: 96, height: 96, borderRadius: 48 } });
