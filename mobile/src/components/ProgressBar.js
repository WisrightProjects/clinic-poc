// Purpose: Progress indicator for answered vs total questions.
// Props: { answered, total, percent }
// Shows "X of N answered · Y%" or "✓ Complete" when fully answered.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TEAL = '#0a8f8f';

export function ProgressBar({ answered, total, percent }) {
  const complete = total > 0 && answered === total;
  const label = complete
    ? '✓ Complete'
    : `${answered} of ${total} answered · ${percent}%`;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, complete && styles.labelComplete]}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f5f8fa' },
  label: { fontSize: 13, color: '#4a5568', marginBottom: 6, fontWeight: '500' },
  labelComplete: { color: '#0a8f8f', fontWeight: '700' },
  track: {
    height: 6,
    backgroundColor: '#dde3ea',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },
});
