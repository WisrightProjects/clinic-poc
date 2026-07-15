// Purpose: Format and display elapsed recording seconds as m:ss. Pure presentational.
// Props: { seconds }

import React from 'react';
import { Text, StyleSheet } from 'react-native';

function format(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecordTimer({ seconds }) {
  return <Text style={styles.timer}>{format(seconds)}</Text>;
}

const styles = StyleSheet.create({
  timer: { fontSize: 40, fontWeight: '700', color: '#1a3050', fontVariant: ['tabular-nums'] },
});
