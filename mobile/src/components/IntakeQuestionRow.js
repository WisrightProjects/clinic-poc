// Purpose: Single row in the intake question list — shows answered/pending state.
// Mirrors clinic-flow.html M-01 q-item / qn-done / qbtn-record styling.
// Props: { index, item, onRecord }

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export function IntakeQuestionRow({ index, item, onRecord }) {
  const preview =
    item.answered && item.transcript
      ? item.transcript.length > 60
        ? item.transcript.slice(0, 60) + '…'
        : item.transcript
      : null;

  return (
    <View style={styles.row}>
      {/* Number / checkmark badge */}
      <View style={[styles.badge, item.answered && styles.badgeDone]}>
        <Text style={[styles.badgeText, item.answered && styles.badgeTextDone]}>
          {item.answered ? '✓' : index}
        </Text>
      </View>

      {/* Question text + transcript preview */}
      <View style={styles.body}>
        <Text style={styles.question}>{item.text}</Text>
        {preview ? (
          <Text style={styles.transcript}>{preview}</Text>
        ) : null}
      </View>

      {/* Record (pending) / Retake (answered). Both open the recording screen;
          the backend replaces the existing answer on re-upload (CLINIC-004 AC9),
          so Retake makes "Edit Answers" actually editable. */}
      {item.answered ? (
        <TouchableOpacity style={styles.retakeBtn} onPress={onRecord} activeOpacity={0.75}>
          <Text style={styles.retakeBtnText}>Retake</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.recordBtn} onPress={onRecord} activeOpacity={0.75}>
          <Text style={styles.recordBtnText}>Record</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8edf2',
    backgroundColor: '#ffffff',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e8edf2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeDone: { backgroundColor: TEAL },
  badgeText: { fontSize: 14, fontWeight: '700', color: NAVY },
  badgeTextDone: { color: '#ffffff' },
  body: { flex: 1 },
  question: { fontSize: 15, color: NAVY, fontWeight: '500' },
  transcript: { fontSize: 12, color: '#6b7c93', marginTop: 3 },
  recordBtn: {
    backgroundColor: TEAL,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  recordBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  retakeBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retakeBtnText: { color: TEAL, fontSize: 13, fontWeight: '600' },
});
