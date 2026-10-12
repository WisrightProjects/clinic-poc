// Purpose: CLINIC-008.4 — attender sign-in with mobile number + password.
// On success the token is saved (authStore); App.js reacts to the new session and
// swaps this screen for the main stack, so no navigation call is needed here.
// Only attender accounts are accepted — a doctor login is refused and not stored.
// Error text comes from the backend envelope: error.response.data.error.message.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../api/authApi';
import { saveSession } from '../auth/authStore';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

function loginErrorMessage(err) {
  const apiMessage = err?.response?.data?.error?.message;
  if (apiMessage) return apiMessage;
  return err?.response
    ? 'Could not sign in. Please try again.'
    : 'Cannot reach the server. Check your connection.';
}

export default function LoginScreen() {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const passwordRef = useRef(null);

  const canSubmit = mobile.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { token, user } = await login(mobile.trim(), password);
      // The app is attender-only (the doctor uses the web dashboard), so refuse any
      // other role without storing the session.
      if (user.role !== 'attender') {
        setError('This app is for attenders. Doctors sign in on the web dashboard.');
        setSubmitting(false);
        return;
      }
      await saveSession({ token, user });
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>ClinicAI</Text>
          <Text style={styles.subtitle}>Attender sign in</Text>

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={15}
            placeholder="10-digit mobile number"
            placeholderTextColor="#9aa7b8"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!submitting}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            ref={passwordRef}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Password"
            placeholderTextColor="#9aa7b8"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            editable={!submitting}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            activeOpacity={0.85}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { fontSize: 32, fontWeight: '800', color: NAVY, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6b7c93', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '700', color: NAVY, marginBottom: 6 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1ea',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: NAVY,
    marginBottom: 16,
  },
  error: { color: '#c0392b', fontSize: 14, marginBottom: 12 },
  button: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
