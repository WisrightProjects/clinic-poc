// Purpose: Home / Patient Queue screen — the attender's landing screen.
// Shows today's visits (tap a row to resume its intake) and a "New Patient"
// button to start a fresh registration. This is the hub that links into the
// CLINIC-003 flow. Settings (question template) is reachable via the header gear
// configured in AppNavigator. Data comes from GET /visits via useVisitQueue.

import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVisitQueue } from '../hooks/useVisitQueue';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

// visit_status → pill colour. Keeps the queue scannable at a glance.
const STATUS_STYLE = {
  waiting: { bg: '#fff4e5', fg: '#b26a00', label: 'Waiting' },
  answering: { bg: '#e6f7f7', fg: TEAL, label: 'Answering' },
  answered: { bg: '#e8f0fe', fg: '#1a56c4', label: 'Answered' },
  summarised: { bg: '#ede7f6', fg: '#5e35b1', label: 'Summarised' },
  done: { bg: '#e6ffed', fg: '#38a169', label: 'Done' },
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] ?? { bg: '#eceff3', fg: '#6b7c93', label: status ?? '—' };
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <Text style={[styles.pillText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { visits, loading, error, reload } = useVisitQueue();

  const renderRow = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('QuestionList', { visitId: item.id })}
    >
      <View style={styles.tokenBadge}>
        <Text style={styles.tokenText}>{item.token_number}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.patientName} numberOfLines={1}>
          {item.patient_name}
        </Text>
        <Text style={styles.tokenLabel}>Token {item.token_number}</Text>
      </View>
      <StatusPill status={item.status} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <Text style={styles.heading}>Today's Patients</Text>
        <Text style={styles.subheading}>
          {visits.length} {visits.length === 1 ? 'patient' : 'patients'} in queue
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={NAVY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {error?.response?.data?.error?.message ?? error.message ?? 'Failed to load queue'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={reload}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No patients yet</Text>
          <Text style={styles.emptyBody}>Tap “New Patient” below to register the first visit.</Text>
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('NewPatient')}
        >
          <Text style={styles.newBtnText}>+  New Patient</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  heading: { fontSize: 22, fontWeight: '700', color: NAVY },
  subheading: { fontSize: 13, color: '#6b7c93', marginTop: 2 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  tokenBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tokenText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  rowBody: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '600', color: NAVY },
  tokenLabel: { fontSize: 12, color: '#6b7c93', marginTop: 2 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: NAVY, borderRadius: 6, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6b7c93', textAlign: 'center' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
    backgroundColor: '#ffffff',
  },
  newBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  newBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
