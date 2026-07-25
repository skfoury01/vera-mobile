import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn({ email: email.trim(), password });
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign in is unavailable.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            <View style={styles.brandBlock}>
              <Text style={styles.wordmark}>Vera</Text>
              <Text style={styles.tagline}>Private creator access, built for mobile.</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#6f687a"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  editable={!isSubmitting}
                  style={styles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#6f687a"
                  secureTextEntry
                  autoComplete="password"
                  textContentType="password"
                  editable={!isSubmitting}
                  style={styles.input}
                />
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Integration pending</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                disabled={isSubmitting}
                onPress={handleSignIn}
                style={({ pressed }) => [
                  styles.signInButton,
                  (pressed || isSubmitting) && styles.pressed,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#17100a" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </Pressable>

              <Link href="/(tabs)" asChild>
                <Pressable disabled={isSubmitting} style={styles.createLink}>
                  <Text style={styles.createLinkText}>Create Account</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050507',
  },
  keyboard: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 34,
    gap: 32,
  },
  brandBlock: {
    gap: 10,
  },
  wordmark: {
    color: '#fffaf1',
    fontSize: 56,
    lineHeight: 60,
    fontWeight: '900',
  },
  tagline: {
    maxWidth: 320,
    color: '#aca4ba',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  form: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#292331',
    backgroundColor: '#111116',
    padding: 18,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#90889b',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#302838',
    backgroundColor: '#08080b',
    color: '#fffaf1',
    paddingHorizontal: 14,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  errorBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a2630',
    backgroundColor: '#241016',
    padding: 13,
    gap: 4,
  },
  errorTitle: {
    color: '#ffd8df',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  errorText: {
    color: '#e9a7b2',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
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
  createLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLinkText: {
    color: '#fffaf1',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
