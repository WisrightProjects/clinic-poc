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
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuestionList } from '../hooks/useQuestionList';
import { PatientHeader } from '../components/PatientHeader';
import { ProgressBar } from '../components/ProgressBar';
import { IntakeQuestionRow } from '../components/IntakeQuestionRow';
import { SendToDoctorButton } from '../components/SendToDoctorButton';

const NAVY = '#1a3050';

export default function QuestionListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitId } = route.params;

  const { items, answeredCount, total, percent, allAnswered, loading, error, reload, visit } =
    useQuestionList(visitId);

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
      <SafeAreaView style={styles.flex}>
        {visit && <PatientHeader name={visit.patient_name} token={visit.token_number} />}
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
    <SafeAreaView style={styles.flex}>
      {visit && <PatientHeader name={visit.patient_name} token={visit.token_number} />}
      <ProgressBar answered={answeredCount} total={total} percent={percent} />
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <IntakeQuestionRow
            index={index + 1}
            item={item}
            onRecord={() =>
              navigation.navigate('Recording', {
                visitId,
                questionId: item.id,
                questionText: item.text,
                index: index + 1,
                total,
              })
            }
          />
        )}
        style={styles.flex}
      />
      <SendToDoctorButton
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
  retryBtn: {
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: NAVY, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#6b7c93', textAlign: 'center' },
});
