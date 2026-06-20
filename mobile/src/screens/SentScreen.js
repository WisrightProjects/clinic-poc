// Purpose: Sent confirmation screen (M-05). Confirms the intake was sent to the
// doctor, shows the stored AI summary, and offers "Next Patient" which resets the
// navigation stack back to Home for a fresh intake (AC7, AC8).
//
// Route params: { patientName, token, answeredCount, total, summaryText }

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';
const GREEN = '#38a169';

export default function SentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { patientName, token, answeredCount, total, summaryText } = route.params ?? {};

  // AC8: clear navigation state and land on a fresh Home for the next patient
  const onNextPatient = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.checkCircle}>
          <Text style={styles.check}>✓</Text>
        </View>
        <Text style={styles.title}>Sent to Doctor</Text>
        <Text style={styles.subtitle}>
          {patientName ? `${patientName} · ` : ''}
          {token ? `Token ${token}` : ''}
        </Text>
        {answeredCount != null && total != null ? (
          <Text style={styles.count}>
            {answeredCount} of {total} answers sent
          </Text>
        ) : null}

        {summaryText ? (
          <>
            <Text style={styles.sectionLabel}>AI Summary</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{summaryText}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={onNextPatient} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>Next Patient</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  scroll: { padding: 24, alignItems: 'center' },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  check: { color: '#ffffff', fontSize: 44, fontWeight: '800', lineHeight: 50 },
  title: { fontSize: 24, fontWeight: '800', color: NAVY, marginBottom: 6 },
  subtitle: { fontSize: 16, color: '#41506b', marginBottom: 2 },
  count: { fontSize: 14, color: '#6b7c93', marginBottom: 20 },
  sectionLabel: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7c93',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 8,
  },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: '#eef6f6',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#cfe8e8',
  },
  summaryText: { fontSize: 14, color: NAVY, lineHeight: 21 },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e8edf2',
  },
  nextBtn: {
    backgroundColor: NAVY,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
