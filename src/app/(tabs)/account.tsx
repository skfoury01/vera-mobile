import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { VeraScreen } from '@/components/vera-screen';
import { ApiError } from '@/lib/api';

export default function AccountScreen() {
  const { user, isAuthenticated, logout, logoutAll } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function runAuthAction(action: 'logout' | 'logoutAll') {
    setIsWorking(true);
    setMessage(null);

    try {
      if (action === 'logout') {
        await logout();
      } else {
        await logoutAll();
      }
      setMessage('Signed out on this device.');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.userMessage : 'The local session was cleared.');
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <VeraScreen
      eyebrow="Account"
      title="Your mobile identity hub."
      body="Profile, billing, security, and creator tools will live here as the native mobile surface grows."
      symbol="person.crop.circle.fill"
      highlights={[
        { value: isAuthenticated ? 'Active' : 'Guest', label: 'Session' },
        { value: 'Secure', label: 'Token storage' },
        { value: 'No', label: 'Server secrets' },
      ]}>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{isAuthenticated ? 'Session' : 'Not signed in'}</Text>
        <Text style={styles.panelCopy}>
          {isAuthenticated
            ? user?.email ?? user?.username ?? user?.id ?? 'Authenticated Vera user'
            : 'Sign in to restore your Vera account on this device.'}
        </Text>

        {message && <Text style={styles.message}>{message}</Text>}

        {!isAuthenticated && (
          <Pressable
            onPress={() => router.push('/sign-in')}
            style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        )}

        {isAuthenticated && (
          <View style={styles.actions}>
            <Pressable
              disabled={isWorking}
              onPress={() => runAuthAction('logout')}
              style={({ pressed }) => [styles.button, (pressed || isWorking) && styles.pressed]}>
              <Text style={styles.buttonText}>Log Out</Text>
            </Pressable>
            <Pressable
              disabled={isWorking}
              onPress={() => runAuthAction('logoutAll')}
              style={({ pressed }) => [
                styles.secondaryButton,
                (pressed || isWorking) && styles.pressed,
              ]}>
              <Text style={styles.secondaryButtonText}>Log Out All</Text>
            </Pressable>
          </View>
        )}
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
  message: {
    color: '#d8b46a',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
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
  signInButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8b46a',
  },
  signInButtonText: {
    color: '#17100a',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3144',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: '#fffaf1',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.72,
  },
});
