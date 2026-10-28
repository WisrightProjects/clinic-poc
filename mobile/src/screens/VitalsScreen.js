// Purpose: CLINIC-024 — the attender enters today's vitals as numbers: BP, pulse, temperature
// (°C/°F), SpO2 and blood sugar with its test type. Every field is optional ("Not recorded").
// Reopening shows the saved values (resume mid-flow). The server checks the ranges and its
// messages show under each field. Save goes back to the intake list (reloads on focus).
// The saved values are loaded from the server when the screen opens (not passed in), so a
// save never overwrites vitals another phone saved meanwhile with an old copy.
// Route params: { visitId }

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { getVisitDetail, saveVitals } from '../api/visitApi';
import { errorMessage } from '../utils/apiError';
import { SaveAnswerButton } from '../components/SaveAnswerButton';
import { NumberField } from '../components/NumberField';
import { ChoiceButtons } from '../components/ChoiceButtons';
import { useSaveAnswer } from '../hooks/useSaveAnswer';

const NAVY = '#1a3050';

const SUGAR_TYPES = [
  { value: 'fasting', label: 'Fasting' },
  { value: 'post_meal', label: 'Post-meal' },
  { value: 'random', label: 'Random' },
];
const TEMP_UNITS = [
  { value: 'F', label: '°F' },
  { value: 'C', label: '°C' },
];

// A saved number as text for its box ('' when not recorded; pg sends NUMERIC as a string).
const asText = (n) => (n == null ? '' : String(Number(n)));

// The form for a saved vitals row (or none).
const formFrom = (v) => ({
  bpSystolic: asText(v?.bp_systolic),
  bpDiastolic: asText(v?.bp_diastolic),
  pulse: asText(v?.pulse),
  temperature: asText(v?.temperature),
  temperatureUnit: v?.temperature_unit ?? 'F',
  spo2: asText(v?.spo2),
  sugar: asText(v?.sugar),
  sugarType: v?.sugar_type ?? null,
});

export default function VitalsScreen() {
  const { visitId } = useRoute().params;
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const { saving, error, fieldErrors, save } = useSaveAnswer();

  useEffect(() => {
    getVisitDetail(visitId)
      .then((d) => setForm(formFrom(d.vitals)))
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the vitals. Go back and try again.')));
  }, [visitId]);

  if (!form) {
    return (
      <View style={styles.centered}>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : <ActivityIndicator size="large" color={NAVY} />}
      </View>
    );
  }

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  // One field: its box wired to the form and to the server's message for it.
  const field = (key, placeholder, extra = {}) => (
    <NumberField value={form[key]} onChangeText={set(key)} placeholder={placeholder} error={fieldErrors[key]} {...extra} />
  );
  const onSave = () => save(() => saveVitals(visitId, form), 'Could not save the vitals. Please retry.');

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.stage} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Enter what was measured today. Leave the rest empty — it shows as "Not recorded".</Text>

          <Text style={styles.label}>Blood pressure (mmHg)</Text>
          <View style={styles.row}>
            {field('bpSystolic', '140', { style: styles.half })}
            <Text style={styles.slash}>/</Text>
            {field('bpDiastolic', '90', { style: styles.half })}
          </View>

          <Text style={styles.label}>Pulse (beats/min)</Text>
          {field('pulse', '82')}

          <Text style={styles.label}>Temperature</Text>
          <View style={styles.row}>
            {field('temperature', '98.6', { decimal: true, style: styles.half })}
            <ChoiceButtons options={TEMP_UNITS} value={form.temperatureUnit} onChange={set('temperatureUnit')} />
          </View>

          <Text style={styles.label}>SpO₂ (%)</Text>
          {field('spo2', '98')}

          <Text style={styles.label}>Blood sugar (mg/dL)</Text>
          {field('sugar', '140')}
          <View style={[styles.row, styles.gapTop]}>
            <ChoiceButtons options={SUGAR_TYPES} value={form.sugarType} onChange={set('sugarType')} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <SaveAnswerButton onPress={onSave} disabled={saving} saving={saving} label="Save Vitals" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f5f8fa' },
  stage: { padding: 16, paddingBottom: 24 },
  hint: { fontSize: 14, color: '#6b7c93', marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '600', color: NAVY, marginTop: 16, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gapTop: { marginTop: 8 },
  half: { flex: 1 },
  slash: { fontSize: 22, color: NAVY, fontWeight: '600', marginTop: 10 },
  error: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginTop: 14 },
  footer: { padding: 20 },
});
