// Purpose: Patient intake question list screen (M-01).
// Presentational only — all data logic is in useQuestionList hook.
// Gets visitId from route.params; hook handles useFocusEffect reload internally.

import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
// safe-area-context SafeAreaView applies the Android bottom inset so the
// "Send to Doctor" footer isn't hidden behind the system navigation bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuestionList } from '../hooks/useQuestionList';
import { PatientHeader } from '../components/PatientHeader';
import { ProgressBar } from '../components/ProgressBar';
import { IntakeQuestionRow } from '../components/IntakeQuestionRow';
import { SendToDoctorButton } from '../components/SendToDoctorButton';
import { ReportsSection } from '../components/ReportsSection';
import { answerTypeOf, isKnownAnswerType } from '../utils/answerTypes';

const NAVY = '#1a3050';
// Report photos can only be added/removed until the visit is submitted (CLINIC-011).
const EDITABLE_STATUSES = ['waiting', 'answering', 'answered'];

export default function QuestionListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitId } = route.params;

  const { items, answeredCount, total, percent, allAnswered, loading, error, reload, visit } =
    useQuestionList(visitId);
  // Once sent to the doctor (summarised / tests_requested / done) the intake is read-only:
  // the server refuses changes (409 ANSWERS_LOCKED).
  const locked = !EDITABLE_STATUSES.includes(visit?.status);

  // Opens the screen for the question's answer type (CLINIC-021): tap options for 'choice'
  // (with its saved choices), else record / type.
  function openAnswer(item, index) {
    const common = { visitId, questionId: item.id, questionText: item.text, index: index + 1, total };
    if (answerTypeOf(item) === 'choice') {
      navigation.navigate('Choice', {
        ...common,
        options: item.options,
        multi: item.multi,
        choices: item.value?.choices,
        details: item.value?.details,
      });
    } else {
      navigation.navigate('Recording', { ...common, typedText: item.typedText });
    }
  }

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
        <TouchableOpacity style={styles.retryBtn} onPress={reload}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // AC8: no active template for this department
  if (total === 0 && !loading) {
    return (
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        {visit && <PatientHeader name={visit.patient_name} token={visit.queue_token} />}
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No questions configured</Text>
          <Text style={styles.emptyBody}>
            No active question template is set up for this department.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {visit && <PatientHeader name={visit.patient_name} token={visit.queue_token} />}
      <ProgressBar answered={answeredCount} total={total} percent={percent} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <IntakeQuestionRow
            index={index + 1}
            item={item}
            locked={locked}
            onRecord={locked || !isKnownAnswerType(item) ? undefined : () => openAnswer(item, index)}
          />
        )}
        style={styles.flex}
      />
      <ReportsSection visitId={visitId} editable={!locked} />
      <SendToDoctorButton
        sent={locked}
        disabled={!allAnswered}
        onPress={() => navigation.navigate('Review', { visitId })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  // Recovery action = teal text-link (matches web .link-btn), not a filled button.
  // minHeight keeps a >=44dp tap target even without a filled background.
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: '#0a8f8f', fontSize: 15, fontWeight: '700' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6b7c93', textAlign: 'center' },
});
