// Purpose: CLINIC-014.3 — a patient the doctor sent for tests is back. Shows the doctor's
// note and lets the attender add the test results as photos (the CLINIC-011 reports section,
// allowed while the visit is waiting for tests). "Back in queue" puts the patient at the END
// of today's queue (POST /visits/:id/requeue; the original date, answers, summary and note
// are kept). If no result was added since the doctor's request, the attender is warned but
// can still re-queue. Opened from the "Waiting for tests" section on Home.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { PatientHeader } from '../components/PatientHeader';
import { ReportsSection } from '../components/ReportsSection';
import { getVisitDetail } from '../api/visitApi';
import { listReports } from '../api/reportApi';
import { requeueVisit } from '../api/testRequestApi';
import { errorMessage } from '../utils/apiError';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export default function BackInQueueScreen() {
  const navigation = useNavigation();
  const { visitId } = useRoute().params;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false); // a result photo is being added / removed
  const [checking, setChecking] = useState(false); // counting the results (blocks a double tap)

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getVisitDetail(visitId));
    } catch (err) {
      setError(errorMessage(err, 'Could not load this patient.'));
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  // Reload on focus so the screen shows the current state when the attender returns.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const visit = data?.visit;
  const latest = data?.test_requests?.[0];
  const waiting = visit?.status === 'tests_requested';
  // Back in queue waits for a photo still uploading (else the server has no result to count
  // yet and the attender is wrongly warned) and for the counting itself (no double tap).
  const blocked = !waiting || sending || uploading || checking;

  // Results = reports added after the doctor's request. Older reports (photographed during
  // intake) don't count, or the "no results" warning would never show for a patient who
  // brought old reports. Read fresh, since photos were just added in the section below.
  const countResults = async () => {
    if (!latest) return 0;
    const reports = await listReports(visitId);
    return reports.filter((r) => new Date(r.created_at) >= new Date(latest.requested_at)).length;
  };

  const requeue = async () => {
    setSending(true);
    try {
      const requeued = await requeueVisit(visitId);
      Alert.alert('Back in queue', `${visit.patient_name} is Token ${requeued.queue_token} in today's queue.`);
      navigation.goBack();
    } catch (err) {
      // 409: already back / status changed — reload to show the real state.
      Alert.alert('Could not put back in queue', errorMessage(err, 'Please retry.'));
      setSending(false);
      load();
    }
  };

  const onBackInQueue = async () => {
    let resultCount = 0;
    setChecking(true);
    try {
      resultCount = await countResults();
    } catch {
      // Can't tell: don't block the attender — the warning below just asks them to confirm.
    } finally {
      setChecking(false);
    }
    if (resultCount > 0) return requeue();
    Alert.alert(
      'No test results uploaded',
      'The doctor will not see any results for this patient. Put them back in the queue anyway?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Back in queue', onPress: requeue },
      ]
    );
  };

  if (loading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {visit ? <PatientHeader name={visit.patient_name} token={visit.queue_token} /> : null}
      <ScrollView contentContainerStyle={styles.content}>
        {latest ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{latest.requested_by_name ?? 'Doctor'}'s note</Text>
            <Text style={styles.note}>{latest.note}</Text>
            <Text style={styles.meta}>
              {latest.acknowledged_at ? 'Patient informed' : 'Patient not informed yet'}
            </Text>
          </View>
        ) : null}

        <View style={styles.resultsCard}>
          <ReportsSection
            visitId={visitId}
            editable={waiting}
            title="Test results"
            hint="Add photos of the test results the patient brought."
            onBusyChange={setUploading}
          />
        </View>

        {!waiting ? (
          <Text style={styles.closed}>This patient is no longer waiting for tests.</Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, blocked && styles.btnDisabled]}
          onPress={onBackInQueue}
          disabled={blocked}
          activeOpacity={0.85}
        >
          {sending || checking ?<ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Back in queue</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e8edf2', padding: 14, marginBottom: 12 },
  cardLabel: { fontSize: 12, fontWeight: '800', color: '#6b7c93', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  note: { fontSize: 16, color: NAVY, lineHeight: 23 },
  meta: { fontSize: 12.5, color: '#6b7c93', marginTop: 8 },
  // The reports section draws its own white strip; round it to match the note card above.
  resultsCard: { borderRadius: 10, borderWidth: 1, borderColor: '#e8edf2', overflow: 'hidden', marginBottom: 12 },
  closed: { fontSize: 14, color: '#6b7c93', textAlign: 'center', marginTop: 8 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e8edf2', backgroundColor: '#ffffff' },
  btn: { backgroundColor: TEAL, borderRadius: 10, paddingVertical: 15, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: TEAL, fontSize: 15, fontWeight: '700' },
});
