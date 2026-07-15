// Purpose: Displays patient name and token number badge at the top of the intake screen.
// Props: { name, token }

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export function PatientHeader({ name, token }) {
  return (
    <View style={styles.container}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <View style={styles.tokenBadge}>
        <Text style={styles.tokenText}>Token {token}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: NAVY,
  },
  name: { fontSize: 17, fontWeight: '700', color: '#ffffff', flex: 1, marginRight: 12 },
  tokenBadge: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tokenText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
