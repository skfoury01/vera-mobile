import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VeraScreen } from '@/components/vera-screen';

export default function HomeScreen() {
  return (
    <VeraScreen
      eyebrow="Home"
      title="Your Vera universe starts here."
      body="A calm command center for subscriptions, creator drops, live moments, and the relationships that matter most."
      symbol="house.fill"
      highlights={[
        { value: 'Today', label: 'Feed pulse' },
        { value: '0', label: 'Unread now' },
        { value: 'Beta', label: 'Mobile shell' },
      ]}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Temporary access</Text>
        <Text style={styles.panelCopy}>
          The tab shell is available for navigation QA while native authentication is being defined.
        </Text>
        <Link href="/sign-in" asChild>
          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Open sign in</Text>
          </Pressable>
        </Link>
      </View>
    </VeraScreen>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#292331',
    backgroundColor: '#111116',
    padding: 16,
    gap: 14,
  },
  panelTitle: {
    color: '#fffaf1',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  panelCopy: {
    color: '#a7a0b3',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },
  button: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#d8b46a',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  buttonText: {
    color: '#17100a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.74,
  },
});
