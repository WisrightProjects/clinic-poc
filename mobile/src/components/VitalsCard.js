// Purpose: CLINIC-024 — today's vitals on the intake list: what was recorded (or "Not
// recorded") and an Add / Edit button that opens the Vitals screen. Vitals are optional and
// never block Send to Doctor. Read-only once the visit is sent (locked). The text comes from
// the server (vitals_text — the same wording as the doctor web and the summary line).
// Props: { text, locked, onEdit }

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export function VitalsCard({ text, locked, onEdit }) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title}>Today's vitals</Text>
        <Text style={[styles.value, !text && styles.empty]}>{text ?? 'Not recorded'}</Text>
      </View>
      {locked ? null : (
        <TouchableOpacity style={text ? styles.editBtn : styles.addBtn} onPress={onEdit} activeOpacity={0.75}>
          <Text style={text ? styles.editText : styles.addText}>{text ? 'Edit' : 'Add'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
  },
  body: { flex: 1, paddingRight: 10 },
  title: { fontSize: 15, fontWeight: '700', color: NAVY },
  value: { fontSize: 13, color: NAVY, marginTop: 3 },
  empty: { color: '#6b7c93' },
  addBtn: { backgroundColor: TEAL, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  addText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  editBtn: { borderWidth: 1, borderColor: TEAL, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  editText: { color: TEAL, fontSize: 13, fontWeight: '600' },
});
