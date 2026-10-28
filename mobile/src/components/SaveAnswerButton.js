// Purpose: the "Save Answer" footer button shared by the answer screens (typed text, tap
// choices): teal, full width, spinner while saving, faded when it can't be pressed.
// Props: { onPress, disabled, saving }

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';

const TEAL = '#0a8f8f';

export function SaveAnswerButton({ onPress, disabled, saving }) {
  return (
    <TouchableOpacity
      style={[styles.saveBtn, disabled && styles.saveBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveBtnText}>Save Answer</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
});
