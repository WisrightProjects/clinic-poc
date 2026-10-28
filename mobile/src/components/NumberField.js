// Purpose: a number box with its label and the error under it (registration weight / height,
// CLINIC-023; vitals, CLINIC-024). decimal: a decimal pad, and a decimal comma typed by some
// phones' number pads is turned into a point.
// Props: { label?, value, onChangeText, placeholder, error?, decimal?, style? } — pass
// style={{ flex: 1 }} to share a row.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

const NAVY = '#1a3050';

export function NumberField({ label, value, onChangeText, placeholder, error, decimal = false, style }) {
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={decimal ? (t) => onChangeText(t.replace(',', '.')) : onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa7b8"
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        maxLength={5}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: NAVY, marginBottom: 4, marginTop: 14 },
  input: {
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c9d6df',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1a2332',
  },
  inputError: { borderColor: '#c0392b' },
  error: { fontSize: 12, color: '#c0392b', marginTop: 3 },
});
