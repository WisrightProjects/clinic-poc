// Purpose: CLINIC-021 — answer a 'choice' question (e.g. Q1 "What problem brings you…"):
// big tick boxes for the options (one or more, per the question), plus an optional details
// box. Reopening shows the saved choices (resume mid-flow). Save goes back to the intake
// list, which reloads on focus and shows the questions for the problems chosen.
// Route params: { visitId, questionId, questionText, options, multi, choices?, details?, index, total }
// (options: [{ value, label }]; choices: the saved option values)

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { saveChoiceAnswer } from '../api/answerApi';
import { QuestionCard } from '../components/QuestionCard';
import { SaveAnswerButton } from '../components/SaveAnswerButton';
import { useSaveAnswer } from '../hooks/useSaveAnswer';
import { MAX_ANSWER_TEXT } from '../utils/answerTypes';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';

export default function ChoiceAnswerScreen() {
  const { visitId, questionId, questionText, options: rawOptions, multi, choices, details, index, total } =
    useRoute().params;
  const options = rawOptions ?? [];
  // A saved choice whose option was since removed has no tick box to clear: drop it, or every
  // save would be refused.
  const [picked, setPicked] = useState(() => (choices ?? []).filter((v) => options.some((o) => o.value === v)));
  const [text, setText] = useState(details ?? '');
  const { saving, error, save } = useSaveAnswer();

  const canSave = picked.length > 0 && !saving;
  const onSave = () => save(() => saveChoiceAnswer(visitId, questionId, picked, text.trim()));

  function toggle(value) {
    setPicked((current) => {
      if (current.includes(value)) return current.filter((v) => v !== value);
      return multi ? [...current, value] : [value];
    });
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <QuestionCard index={index} total={total} questionText={questionText} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.stage} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>{multi ? 'Tap all that apply' : 'Tap one'}</Text>
          {options.map((o) => {
            const on = picked.includes(o.value);
            return (
              <TouchableOpacity
                key={o.value}
                style={[styles.option, on && styles.optionOn]}
                onPress={() => toggle(o.value)}
                disabled={saving}
                activeOpacity={0.8}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.box, !multi && styles.round, on && styles.boxOn]}>
                  {on ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Details (optional) — e.g. for Other"
            placeholderTextColor="#9aa7b8"
            multiline
            maxLength={MAX_ANSWER_TEXT}
            textAlignVertical="top"
            editable={!saving}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <SaveAnswerButton onPress={onSave} disabled={!canSave} saving={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  stage: { paddingHorizontal: 16, paddingBottom: 16 },
  hint: { fontSize: 14, color: '#6b7c93', marginBottom: 10 },
  // >=54dp rows: quick, error-free tapping at the front desk.
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1ea',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 54,
    marginBottom: 10,
  },
  optionOn: { borderColor: TEAL, backgroundColor: '#e8f6f6' },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9aa7b8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  round: { borderRadius: 13 },
  boxOn: { borderColor: TEAL, backgroundColor: TEAL },
  tick: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  optionText: { fontSize: 17, color: NAVY, fontWeight: '500' },
  optionTextOn: { fontWeight: '700' },
  input: {
    minHeight: 90,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1ea',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: NAVY,
    marginTop: 4,
  },
  error: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginTop: 10 },
  footer: { padding: 20 },
});
