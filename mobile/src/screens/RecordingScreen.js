// Purpose: Voice recording screen (M-02). Records the patient's spoken answer to a
// question, uploads it, and returns to the intake list (which reloads on focus and
// shows the transcript + Done). All recorder logic lives in useAudioRecorder; this
// screen renders states and orchestrates the upload + retry.
//
// Route params: { visitId, questionId, questionText?, index?, total? }

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from 'react-native';
// safe-area-context SafeAreaView applies the Android bottom inset so the Record /
// Stop & Save button isn't hidden behind the system navigation bar.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { uploadAnswer } from '../api/answerApi';
import { Waveform } from '../components/Waveform';
import { RecordTimer } from '../components/RecordTimer';

const NAVY = '#1a3050';
const TEAL = '#0a8f8f';
const RED = '#e53e3e';

export default function RecordingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { visitId, questionId, questionText, index, total } = route.params;

  const rec = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const doUpload = useCallback(
    async (fileUri) => {
      setUploading(true);
      setUploadError(null);
      try {
        await uploadAnswer(visitId, questionId, fileUri); // synchronous transcribe on server
        navigation.goBack(); // list reloads on focus → shows transcript + Done
      } catch (err) {
        // AC6/AC10: keep the local file, surface a retry action
        setUploadError(err?.message ?? 'Could not save the answer. Please retry.');
        setUploading(false);
      }
    },
    [visitId, questionId, navigation]
  );

  const onStopAndSave = useCallback(async () => {
    const fileUri = await rec.stop();
    if (!fileUri) return; // recorder error surfaced by the hook (status 'error')
    doUpload(fileUri);
  }, [rec, doUpload]);

  // --- Permission denied (AC2) ---
  if (rec.status === 'denied') {
    return (
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.bigIcon}>🎙️</Text>
          <Text style={styles.title}>Microphone access needed</Text>
          <Text style={styles.body}>
            Microphone access is needed to record answers. Enable it in Settings, then try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={rec.reset}>
            <Text style={styles.secondaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isRecording = rec.status === 'recording';

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={styles.questionCard}>
        {index && total ? (
          <Text style={styles.qMeta}>
            Question {index} of {total}
          </Text>
        ) : null}
        <Text style={styles.qText}>{questionText ?? 'Record the answer'}</Text>
      </View>

      <View style={styles.stage}>
        {uploading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={TEAL} />
            <Text style={styles.body}>Saving answer…</Text>
          </View>
        ) : uploadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{uploadError}</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => rec.uri && doUpload(rec.uri)}
            >
              <Text style={styles.primaryBtnText}>Retry Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={rec.reset}>
              <Text style={styles.secondaryBtnText}>Re-record</Text>
            </TouchableOpacity>
          </View>
        ) : rec.status === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Recording failed. Please try again.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={rec.reset}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Waveform active={isRecording} />
            <RecordTimer seconds={rec.elapsed} />
            <Text style={styles.hint}>
              {isRecording ? '● Recording…' : 'Tap the button to start recording'}
            </Text>
          </>
        )}
      </View>

      {!uploading && !uploadError && rec.status !== 'error' && (
        <View style={styles.footer}>
          {isRecording ? (
            <TouchableOpacity style={styles.stopBtn} onPress={onStopAndSave}>
              <View style={styles.stopSquare} />
              <Text style={styles.stopBtnText}>Stop &amp; Save Answer</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.recordBtn} onPress={rec.start}>
              <View style={styles.recordDot} />
              <Text style={styles.recordBtnText}>Record</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f8fa' },
  questionCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8edf2',
  },
  qMeta: { fontSize: 12, fontWeight: '700', color: TEAL, letterSpacing: 0.5, marginBottom: 6 },
  qText: { fontSize: 18, fontWeight: '600', color: NAVY },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 16, fontSize: 14, color: '#6b7c93', fontWeight: '600' },
  bigIcon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: NAVY, marginBottom: 8 },
  body: { fontSize: 14, color: '#6b7c93', textAlign: 'center', marginTop: 8, paddingHorizontal: 16 },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16, paddingHorizontal: 16 },
  footer: { padding: 20 },
  recordBtn: {
    backgroundColor: RED,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  recordDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffffff' },
  recordBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  stopBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: '#ffffff' },
  stopBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 16,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 24, marginTop: 8 },
  secondaryBtnText: { color: NAVY, fontSize: 14, fontWeight: '600' },
});
