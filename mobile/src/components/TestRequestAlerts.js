// Purpose: CLINIC-014 alert on Home — one banner per patient the doctor sent for tests whose
// request the attender has not yet acted on: "Dr. Ramesh requested tests for Token 20 –
// Arun" with the doctor's note. It stays until the attender taps "Informed patient"
// (POST /test-requests/:id/acknowledge). The list the Home screen already polls carries
// each visit's latest_test_request, so no extra request is needed to show it.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { acknowledgeTestRequest } from '../api/testRequestApi';

// Visits waiting for tests whose latest request is still unacknowledged.
function pendingTestAlerts(visits) {
  return visits.filter(
    (v) => v.status === 'tests_requested' && v.latest_test_request && !v.latest_test_request.acknowledged_at
  );
}

export function TestRequestAlerts({ visits, onChanged }) {
  const [busyId, setBusyId] = useState(null);
  const alerts = pendingTestAlerts(visits);
  if (alerts.length === 0) return null;

  const inform = async (testRequestId) => {
    setBusyId(testRequestId);
    try {
      await acknowledgeTestRequest(testRequestId);
    } catch (err) {
      // 409 = the patient is already back; the refresh below drops the banner.
      Alert.alert('Could not update', err?.response?.data?.error?.message ?? err?.message ?? 'Please retry.');
    } finally {
      setBusyId(null);
      onChanged();
    }
  };

  return (
    <View style={styles.wrap}>
      {alerts.map((v) => {
        const req = v.latest_test_request;
        const busy = busyId === req.id;
        return (
          <View key={req.id} style={styles.card}>
            <Text style={styles.title}>
              {req.requested_by_name ?? 'The doctor'} requested tests for Token {v.queue_token} – {v.patient_name}
            </Text>
            <Text style={styles.note}>{req.note}</Text>
            <TouchableOpacity
              style={[styles.btn, busy && styles.btnBusy]}
              onPress={() => inform(req.id)}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.btnText}>Informed patient</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 4 },
  card: {
    backgroundColor: '#fff4dc',
    borderColor: '#f0b44c',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: '800', color: '#7a4a00' },
  note: { fontSize: 14, color: '#41506b', marginTop: 6, lineHeight: 20 },
  btn: {
    backgroundColor: '#b45f06',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  btnBusy: { opacity: 0.7 },
  btnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
