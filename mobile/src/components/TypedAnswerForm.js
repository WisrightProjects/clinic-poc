// Purpose: CLINIC-009 — type the answer instead of recording it. A multiline box with a
// character counter and Save; the typed text is stored by the server as a finished
// transcript (no recording, nothing to wait for). Save goes back to the intake list, which
// reloads on focus. A failed save keeps the text so it can be retried.
// Props: { visitId, questionId, questionText, initialText?, index, total, onCancel }
// (onCancel = "Record instead"; initialText pre-fills the box when a typed answer is retaken)

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
// Same bottom-inset handling as the recorder, so Save isn't hidden behind the nav bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveTextAnswer } from '../api/answerApi';
import { QuestionCard } from './QuestionCard';
import { SaveAnswerButton } from './SaveAnswerButton';
import { useSaveAnswer } from '../hooks/useSaveAnswer';
import { MAX_ANSWER_TEXT } from '../utils/answerTypes';

const NAVY = '#1a3050';

export function TypedAnswerForm({ visitId, questionId, questionText, initialText, index, total, onCancel }) {
  const [text, setText] = useState(initialText ?? '');
  const { saving, error, save } = useSaveAnswer();

  const canSave = text.trim().length > 0 && !saving;
  // The list reloads on focus → shows the typed answer + Done.
  const onSave = () => save(() => saveTextAnswer(visitId, questionId, text.trim()));

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      {/* Keeps the Save button above the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <QuestionCard index={index} total={total} questionText={questionText} />
        <View style={styles.stage}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Type the patient's answer"
            placeholderTextColor="#9aa7b8"
            multiline
            maxLength={MAX_ANSWER_TEXT}
            textAlignVertical="top"
            editable={!saving}
            autoFocus
          />
          <Text style={styles.counter}>
            {text.length} / {MAX_ANSWER_TEXT}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.footer}>
          <SaveAnswerButton onPress={onSave} disabled={!canSave} saving={saving} />
          <TouchableOpacity style={styles.switchBtn} onPress={onCancel} disabled={saving}>
            <Text style={styles.switchBtnText}>Record instead</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  stage: { flex: 1, paddingHorizontal: 16 },
  input: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e1ea',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: NAVY,
  },
  counter: { fontSize: 12, color: '#6b7c93', textAlign: 'right', marginTop: 6 },
  error: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginTop: 8 },
  footer: { padding: 20 },
  // >=44dp tap target, muted text-link like the recorder's secondary actions.
  switchBtn: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  switchBtnText: { color: '#6b7c93', fontSize: 14, fontWeight: '600' },
});
