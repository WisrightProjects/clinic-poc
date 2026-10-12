// Purpose: CLINIC-009 — type the answer instead of recording it. A multiline box with a
// character counter and Save; the typed text is stored by the server as a finished
// transcript (no recording, nothing to wait for). Save goes back to the intake list, which
// reloads on focus. A failed save keeps the text so it can be retried.
// Props: { visitId, questionId, questionText, index, total, onCancel }  (onCancel = "Record instead")

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
// Same bottom-inset handling as the recorder, so Save isn't hidden behind the nav bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { saveTextAnswer } from '../api/answerApi';
import { QuestionCard } from './QuestionCard';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';
const MAX_TEXT = 2000; // matches the backend (MAX_ANSWER_TEXT_LENGTH); the server's 422 is the real guard

export function TypedAnswerForm({ visitId, questionId, questionText, index, total, onCancel }) {
  const navigation = useNavigation();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const canSave = text.trim().length > 0 && !saving;

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await saveTextAnswer(visitId, questionId, text.trim());
      navigation.goBack(); // list reloads on focus → shows the typed answer + Done
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Could not save the answer. Please retry.');
      setSaving(false);
    }
  }

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
            maxLength={MAX_TEXT}
            textAlignVertical="top"
            editable={!saving}
            autoFocus
          />
          <Text style={styles.counter}>
            {text.length} / {MAX_TEXT}
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveBtnText}>Save Answer</Text>}
          </TouchableOpacity>
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
  saveBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  // >=44dp tap target, muted text-link like the recorder's secondary actions.
  switchBtn: { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  switchBtnText: { color: '#6b7c93', fontSize: 14, fontWeight: '600' },
});
