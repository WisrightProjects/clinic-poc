// Purpose: Gated submit button — disabled until all questions are answered (AC4).
// Props: { disabled, sent, onPress }  (sent = the visit is already with the doctor: shows
// "Sent to doctor", disabled)
// When disabled: dimmed + helper text "Answer all questions to continue"
// When enabled: active teal button

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TEAL = '#0a8f8f';

export function SendToDoctorButton({ disabled, sent, onPress }) {
  // Already sent: dimmed "Sent to doctor", no helper text (nothing left to answer).
  disabled = disabled || sent;
  return (
    <View style={styles.container}>
      {disabled && !sent && (
        <Text style={styles.helperText}>Answer all questions to continue</Text>
      )}
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        onPress={disabled ? undefined : onPress}
        activeOpacity={disabled ? 1 : 0.75}
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
          {sent ? 'Sent to doctor' : 'Send to Doctor'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e8edf2' },
  helperText: { fontSize: 12, color: '#9aa5b4', textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#c8d6df' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  buttonTextDisabled: { color: '#8fa8b5' },
});
