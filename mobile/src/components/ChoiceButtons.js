// Purpose: a row of buttons where one is chosen (New / Follow-up, °F / °C, Fasting /
// Post-meal / Random). Big tap targets; the chosen one is teal.
// Props: { options: [{ value, label }], value, onChange }

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export function ChoiceButtons({ options, value, onChange }) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.btn, on && styles.btnOn]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#c9d6df',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOn: { borderColor: TEAL, backgroundColor: '#e8f6f6' },
  text: { fontSize: 15, color: NAVY, fontWeight: '500' },
  textOn: { color: TEAL, fontWeight: '700' },
});
