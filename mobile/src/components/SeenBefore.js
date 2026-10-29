// Purpose: CLINIC-027 — "Seen before on this number": the clinic's patients on the mobile the
// attender typed, one row each (name, sex, age, last visit, visits). Tapping one fills New
// Patient for a returning patient; someone new on the same phone just fills the form. Once
// one is picked, a "Returning patient" bar with Change (back to the list) replaces the list.
// Props: { patients, failed (the lookup failed), picked (name or null), onPick, onClear }

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { shortDate } from '../utils/queue';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

const details = (p) => [
  p.sex,
  p.age != null ? `${p.age} yrs` : null,
  `last ${shortDate(p.last_visit_date)}`,
  `${p.visit_count} visit${p.visit_count === 1 ? '' : 's'}`,
].filter(Boolean).join(' · ');

export function SeenBefore({ patients, failed, picked, onPick, onClear }) {
  if (picked) {
    return (
      <View style={styles.picked}>
        <Text style={styles.pickedText}>✓ Returning patient: <Text style={styles.bold}>{picked}</Text></Text>
        <TouchableOpacity onPress={onClear}>
          <Text style={styles.use}>Change</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (failed) return <Text style={styles.failed}>Could not check earlier visits on this number — fill the form.</Text>;
  if (!patients.length) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.head}>Seen before on this number</Text>
      {patients.map((p) => (
        <TouchableOpacity key={`${p.name}-${p.last_visit_date}`} style={styles.row} onPress={() => onPick(p)} activeOpacity={0.7}>
          <View style={styles.flex}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.details}>{details(p)}</Text>
          </View>
          <Text style={styles.use}>Use ›</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.foot}>Someone else on this number? Just fill the form below.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 8, borderWidth: 1, borderColor: '#9ad7d7', borderRadius: 10, backgroundColor: '#ffffff', overflow: 'hidden' },
  head: { backgroundColor: '#e6f7f7', color: TEAL, fontSize: 13, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#e8edf2' },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: NAVY },
  details: { fontSize: 12, color: '#6b7c93', marginTop: 2 },
  use: { color: TEAL, fontWeight: '700', fontSize: 14, marginLeft: 10 },
  picked: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center', padding: 10,
    backgroundColor: '#e6f7f7', borderWidth: 1, borderColor: '#9ad7d7', borderRadius: 10,
  },
  pickedText: { color: NAVY, fontSize: 14, flex: 1 },
  bold: { fontWeight: '700' },
  failed: { marginTop: 6, fontSize: 12, color: '#9a5b00' },
  foot: { fontSize: 12, color: '#6b7c93', textAlign: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e8edf2' },
});
