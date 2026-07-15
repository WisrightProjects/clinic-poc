// Purpose: Review & Submit screen (M-04). Read-only list of every question with
// its captured transcript, plus the AI summary preview once the visit is
// summarised. Attender can Edit Answers (back to the list) or Confirm & Send.
// Send is enabled only when all questions are answered, and is idempotent server-side.
//
// NOTE: under USE_MOCK_SUMMARY=true the summary is a fixed canned string and will
// not reflect the (also mock) transcripts — real LLM swaps in later.
//
// Route params: { visitId }

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useReviewSubmit } from '../hooks/useReviewSubmit';
import { PatientHeader } from '../components/PatientHeader';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export default function ReviewSubmitScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitId } = route.params;

  const {
    visit,
    qa,
    total,
    answeredCount,
    allAnswered,
    summaryText,
    loading,
    error,
    submitState,
    submitError,
    submit,
    reload,
  } = useReviewSubmit(visitId);

  const onSend = useCallback(async () => {
    const res = await submit();
    if (res) {
      navigation.replace('Sent', {
        patientName: visit?.patient_name,
        token: visit?.token_number,
        answeredCount,
        total,
        summaryText: res.summary?.summary_text ?? summaryText,
      });
    }
  }, [submit, navigation, visit, answeredCount, total, summaryText]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error?.response?.data?.error?.message ?? error.message ?? 'Failed to load visit'}
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={reload}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sending = submitState === 'sending';

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {visit && <PatientHeader name={visit.patient_name} token={visit.token_number} />}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionLabel}>
          Answers · {answeredCount}/{total}
        </Text>

        {qa.map((item, i) => (
          <View key={String(item.id)} style={styles.qaItem}>
            <View style={[styles.badge, item.transcript && styles.badgeDone]}>
              <Text style={[styles.badgeText, item.transcript && styles.badgeTextDone]}>
                {item.transcript ? '✓' : i + 1}
              </Text>
            </View>
            <View style={styles.qaBody}>
              <Text style={styles.qText}>{item.text}</Text>
              <Text style={[styles.qTranscript, !item.transcript && styles.qPending]}>
                {item.transcript || 'Not answered yet'}
              </Text>
            </View>
          </View>
        ))}

        {/* AI summary preview — only present once the visit is summarised */}
        <Text style={styles.sectionLabel}>AI Summary</Text>
        <View style={styles.summaryCard}>
          {summaryText ? (
            <Text style={styles.summaryText}>{summaryText}</Text>
          ) : (
            <Text style={styles.summaryPending}>
              The AI summary is generated when you send this intake to the doctor.
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {submitError ? <Text style={styles.footerError}>{submitError}</Text> : null}
        {!allAnswered ? (
          <Text style={styles.footerHint}>Answer all questions before sending</Text>
        ) : null}

        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => navigation.navigate('QuestionList', { visitId })}
        >
          <Text style={styles.editBtnText}>Edit Answers</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, (!allAnswered || sending) && styles.sendBtnDisabled]}
          onPress={onSend}
          disabled={!allAnswered || sending}
          activeOpacity={0.85}
        >
          {sending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.sendBtnText}>
              {submitError ? 'Retry Send' : 'Confirm & Send to Doctor'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7c93',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  qaItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e8edf2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeDone: { backgroundColor: TEAL },
  badgeText: { fontSize: 13, fontWeight: '700', color: NAVY },
  badgeTextDone: { color: '#ffffff' },
  qaBody: { flex: 1 },
  qText: { fontSize: 15, fontWeight: '600', color: NAVY, marginBottom: 4 },
  qTranscript: { fontSize: 14, color: '#41506b', lineHeight: 20 },
  qPending: { color: '#b26a00', fontStyle: 'italic' },
  summaryCard: {
    backgroundColor: '#eef6f6',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cfe8e8',
  },
  summaryText: { fontSize: 14, color: NAVY, lineHeight: 21 },
  summaryPending: { fontSize: 14, color: '#6b7c93', fontStyle: 'italic', lineHeight: 20 },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
  },
  footerError: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  footerHint: { color: '#b26a00', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  editBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 6 },
  editBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
  sendBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#a9d3d3' },
  sendBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: NAVY,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 12,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
