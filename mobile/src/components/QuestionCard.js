// Purpose: The question being answered, shown at the top of the answer screen (record or type).
// Props: { index, total, questionText }

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export function QuestionCard({ index, total, questionText }) {
  return (
    <View style={styles.card}>
      {index && total ? (
        <Text style={styles.meta}>
          Question {index} of {total}
        </Text>
      ) : null}
      <Text style={styles.text}>{questionText ?? 'Record the answer'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  meta: { fontSize: 12, fontWeight: '700', color: TEAL, letterSpacing: 0.5, marginBottom: 6 },
  text: { fontSize: 18, fontWeight: '600', color: NAVY },
});
