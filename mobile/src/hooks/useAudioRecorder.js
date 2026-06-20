// Purpose: Encapsulate mic permission + expo-audio recording with an elapsed
// timer and a max-duration auto-stop. The screen renders from this small surface.
// Verified against Expo SDK 56 expo-audio API (useAudioRecorder/RecordingPresets/
// AudioModule.requestRecordingPermissionsAsync/setAudioModeAsync).
//
// status: 'idle' | 'requesting' | 'denied' | 'recording' | 'stopped' | 'error'
// Output: { status, elapsed, uri, start, stop, reset }

import { useState, useRef, useCallback } from 'react';
import {
  useAudioRecorder as useExpoRecorder,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio';

export const MAX_RECORDING_SECONDS = 120; // AC4: max-duration cap

export function useAudioRecorder(maxSeconds = MAX_RECORDING_SECONDS) {
  const recorder = useExpoRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState('idle');
  const [elapsed, setElapsed] = useState(0); // seconds — drives the timer UI
  const [uri, setUri] = useState(null); // local file kept on device (AC6/AC10)
  const tick = useRef(null);

  const clearTick = () => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
  };

  const stop = useCallback(async () => {
    clearTick();
    try {
      await recorder.stop();
      const recordedUri = recorder.uri ?? null; // retained locally for upload / retry
      setUri(recordedUri);
      setStatus('stopped');
      return recordedUri; // returned so callers avoid the stale-state closure
    } catch {
      setStatus('error'); // AC3: recording error surfaced
      return null;
    }
  }, [recorder]);

  const start = useCallback(async () => {
    setStatus('requesting');
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setStatus('denied'); // AC2: UI shows settings deep-link
      return;
    }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording');
      setElapsed(0);
      clearTick();
      tick.current = setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= maxSeconds) {
            void stop(); // AC4: auto-stop at the cap, clip kept like Stop & Save
          }
          return next;
        });
      }, 1000);
    } catch {
      clearTick();
      setStatus('error'); // AC3: failed to start
    }
  }, [recorder, maxSeconds, stop]);

  const reset = useCallback(() => {
    clearTick();
    setUri(null);
    setElapsed(0);
    setStatus('idle');
  }, []);

  return { status, elapsed, uri, start, stop, reset };
}
