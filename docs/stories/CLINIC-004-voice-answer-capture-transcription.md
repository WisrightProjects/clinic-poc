# User Story: Voice Answer Capture + Transcription — Record a spoken answer, upload it, and show the transcript

**Story ID:** CLINIC-004
**Epic:** Attender Intake
**Feature:** For a selected question, the attender records the patient's spoken (Tanglish) answer, uploads the audio, and sees the transcribed text back on the question
**Priority:** P0 (Critical)
**Effort:** 4 days (32 hours)
**Sprint:** Phase 1 — Attender Intake MVP
**Status:** Ready for Development
**Depends On:** CLINIC-003 (visit + question list — provides the loaded `visits(:id)`, the ordered `questions`, and the per-question "Record" entry point)

---

## Story Overview

**As an** attender at the clinic front desk
**I want** to record the patient's spoken answer to a question, save it, and see the transcript appear on that question
**So that** the patient's mixed Tamil-English answer is captured as audio and turned into text without me having to type it

**As a** doctor (downstream consumer)
**I want** every recorded answer to be transcribed reliably with a clear pending/done/failed state
**So that** when the visit reaches me the Q&A is already in readable text and I can trust nothing was silently dropped

---

## Why This Feature?

### Current Gap:
- After CLINIC-003 the attender can see the question list for a visit, but tapping "Record" goes nowhere — there is no recording screen, no audio capture, no upload, and no transcript.
- There is no backend endpoint that accepts an uploaded answer file, persists it to `answers.audio_path`, or runs speech-to-text.
- `answers.transcript` and `answers.transcript_status` exist in the data model but are never populated.
- The visit status never advances from `waiting`; nothing transitions it to `answering` or `answered`.

### Real-World Use Case (Lakshmi K., Token 04, General):
The attender opens Lakshmi's visit and taps "Record" on Q3 "Any medication taken recently?". The phone asks for microphone permission. The attender holds the phone near the patient, who answers in Tanglish: *"Medicine edukala, rest panna sonna family..."*. A live waveform animates and a timer counts up. The attender taps **Stop & Save Answer**. The clip uploads, a spinner shows while transcription runs, then the transcript appears under the question and Q3 flips to a green "Done" state. Because this was the first saved answer, the visit moved from `waiting` to `answering`. The attender repeats for all questions; once the last one is saved the visit becomes `answered`. If a recording captured the wrong moment, the attender taps **Retake** and re-records, which replaces both the old audio and the old transcript.

This cannot be done with the current implementation — only static mockups exist (M-02).

### Solution:
Build the recording screen (M-02) and the backend upload + transcription pipeline:
- **RN recording screen + hook (NEW)** — mic permission flow, live waveform + elapsed timer, max-duration cap, Stop & Save, Retake (expo-audio).
- **Multipart upload to `POST /api/visits/:id/answers` (NEW)** — sends the audio file plus `question_id`; on failure offers retry; the local file is retained on network loss.
- **Backend answer + transcription pipeline (NEW)** — stores the file at `answers.audio_path`, creates/replaces the answer, runs transcription via a single transcription service interface (Sarvam AI = **REAL but STUBBABLE**), driving `transcript_status` `pending` -> `done` | `failed`.
- **STUB transcription (REAL interface, mock impl)** — when `USE_MOCK_STT=true` or no Sarvam key is set, the service returns a canned Tanglish transcript so the whole flow is testable without the external API.
- **Status lifecycle** — first saved answer moves the visit `waiting` -> `answering`; saving the final answer moves it to `answered`.

---

## User Personas

### Primary: Anitha — The Front-Desk Attender
- **Role:** Greets patients, creates the visit/token, and walks through the fixed intake questions by recording each spoken answer.
- **Goal:** Capture each answer quickly and confirm the transcript looks right before moving to the next question.
- **Pain Point:** "Patients answer in Tamil-English and talk fast. I can't type that. I just want to press record, then see the words come up so I know it worked."

### Secondary: Dr. Ramesh — The Reviewing Doctor
- **Role:** Reviews the AI summary and full Q&A on the web dashboard before seeing the patient.
- **Goal:** Get clean, complete transcripts with no silently missing answers.
- **Pain Point:** "If a recording failed to transcribe I need to know — a blank answer with no status is worse than a clear 'failed, retry'."

---

## Detailed Sub-Stories

### Sub-Story 1: Microphone Permission Flow
**Story ID:** CLINIC-004.1
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an attender
I want the app to request microphone permission before recording
So that I can grant access, or be guided to settings if I previously denied it
```

### Sub-Story 2: Record with Live Waveform + Elapsed Timer
**Story ID:** CLINIC-004.2
**Points:** 5 | **Effort:** 6 hours

```gherkin
As an attender
I want to record the answer with a live waveform animation and a counting timer
So that I get clear visual confirmation that audio is being captured
```

### Sub-Story 3: Stop & Save — Multipart Upload of Audio + question_id
**Story ID:** CLINIC-004.3
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want Stop & Save to upload the recorded file with the correct question_id
So that the answer is stored against the right question on the server
```

### Sub-Story 4: Backend Store + Transcription Pipeline (Sarvam, real-but-stubbable)
**Story ID:** CLINIC-004.4
**Points:** 5 | **Effort:** 6 hours

```gherkin
As the backend
I want to persist the uploaded file to answers.audio_path and transcribe it via the transcription service
So that transcript_status moves pending -> done/failed and the transcript text is saved
```

### Sub-Story 5: Transcript Display, Pending Spinner & Failed-Retry
**Story ID:** CLINIC-004.5
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an attender
I want a spinner while transcription is pending and the transcript shown when done
So that I know the state of each answer, and can retry if transcription failed
```

### Sub-Story 6: Retake (Replace Prior Audio + Transcript) and Status Transitions
**Story ID:** CLINIC-004.6
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want Retake to re-record and overwrite the previous answer, and the visit status to advance correctly
So that corrections fully replace the old answer and the visit reflects intake progress
```

---

## Acceptance Criteria

### AC1: Microphone permission granted
```gherkin
GIVEN the attender is on the Recording screen for a pending question
WHEN they tap Record and the OS microphone permission prompt appears
AND they grant permission
THEN recording starts immediately
AND the live waveform and elapsed timer (starting 0:00) are shown
```

### AC2: Microphone permission denied — prompt + settings deep-link
```gherkin
GIVEN the attender previously denied microphone permission
WHEN they tap Record
THEN recording does NOT start
AND an explanatory message is shown ("Microphone access is needed to record answers")
AND a "Open Settings" button deep-links to the app's OS settings page (Linking.openSettings())
AND on returning with permission granted, tapping Record starts recording
```

### AC3: Recording error is surfaced
```gherkin
GIVEN microphone permission is granted
WHEN the recorder fails to start or errors mid-capture (e.g. audio focus lost)
THEN recording stops cleanly
AND an inline error is shown with a "Try again" action
AND no partial answer is uploaded
```

### AC4: Max-duration cap
```gherkin
GIVEN a recording is in progress
WHEN the elapsed time reaches the configured maximum (MAX_RECORDING_SECONDS, default 120s)
THEN recording stops automatically
AND the captured clip is treated exactly like a Stop & Save (kept and ready to upload)
AND a brief "Maximum length reached" notice is shown
```

### AC5: Stop & Save uploads the correct file + question_id
```gherkin
GIVEN a recording has been captured for question Q with id question_id
WHEN the attender taps "Stop & Save Answer"
THEN a multipart POST is sent to /api/visits/:id/answers
AND the request includes the audio file part AND a question_id field matching Q
AND the backend stores the file and sets answers.audio_path to the saved path
AND a row in answers is created (or replaced) for (visit_id, question_id)
```

### AC6: Upload failure with retry (local file retained)
```gherkin
GIVEN the attender taps Stop & Save
WHEN the upload request fails (timeout, 5xx, or no connectivity)
THEN an error state with a "Retry upload" action is shown
AND the locally recorded audio file is retained on the device (not deleted)
AND tapping "Retry upload" re-sends the same file + question_id without re-recording
```

### AC7: Transcription pending spinner, then transcript display
```gherkin
GIVEN the audio uploaded successfully
WHEN the backend has created the answer with transcript_status 'pending'
THEN the question shows a "Transcribing..." spinner
AND when transcript_status becomes 'done' the transcript text is shown under the question
AND the question's status indicator flips to the green "Done" state
```

### AC8: Transcription failed with retry
```gherkin
GIVEN the audio uploaded successfully
WHEN transcription fails and transcript_status becomes 'failed'
THEN the question shows a "Transcription failed" state with a "Retry transcription" action
AND tapping it re-runs transcription on the already-stored answers.audio_path (no re-recording, no re-upload)
AND on success transcript_status becomes 'done' and the transcript is shown
```

### AC9: Retake overwrites prior audio + transcript
```gherkin
GIVEN a question already has a saved answer (audio_path + transcript)
WHEN the attender taps Retake, re-records, and saves
THEN the new upload replaces the existing answers row for (visit_id, question_id)
AND the old audio file is no longer referenced and the previous transcript is cleared
AND transcript_status restarts at 'pending' for the new clip before resolving to 'done'/'failed'
```

### AC10: Network loss mid-recording keeps the local file
```gherkin
GIVEN a recording is in progress
WHEN network connectivity is lost during recording or at Stop & Save
THEN the recording is still saved to a local file on the device
AND the upload enters the retry state from AC6 rather than discarding the clip
AND no data is lost when connectivity returns and the attender retries
```

### AC11: Status transition — first answer moves visit to 'answering'
```gherkin
GIVEN a visit with status 'waiting' and no saved answers
WHEN the first answer is successfully saved (file stored)
THEN the visit status is updated from 'waiting' to 'answering'
AND this transition happens server-side as part of saving the answer
```

### AC12: Status transition — all answered moves visit to 'answered'
```gherkin
GIVEN a visit in status 'answering' where all questions but one have saved answers
WHEN the final question's answer is successfully saved
THEN the visit status is updated to 'answered'
AND the visit is now eligible for the review-and-submit step (CLINIC-005)
```

### AC13: STUB transcript when USE_MOCK_STT is on
```gherkin
GIVEN the backend env has USE_MOCK_STT=true (or no SARVAM_API_KEY is configured)
WHEN an answer is uploaded and transcription runs
THEN the transcription service returns a canned Tanglish transcript (e.g. "Medicine edukala, rest panna sonna family...")
AND transcript_status resolves to 'done' WITHOUT calling the external Sarvam API
AND the same code path / interface is used as the real Sarvam call (only the implementation differs)
```

---

## Technical Implementation

> GREENFIELD: every file below is **NEW** unless explicitly marked Modify. Paths follow the SPEC structure: RN app under `attender-app/`, backend under `backend/src/{controllers,services,repositories,models,routes,utils,config}`, DB under `db/`.

### Part 1: RN Recording Screen + Hook (12 hours)

#### Task 1.1: `useAudioRecorder` hook — permission, capture, timer, max-cap

**File:** `attender-app/src/hooks/useAudioRecorder.ts` — **NEW**

Wraps expo-audio. Owns permission state, recording lifecycle, elapsed timer, and the max-duration auto-stop. Exposes a small surface the screen renders from.

```typescript
// Purpose: encapsulate mic permission + expo-audio recording with timer & max cap.
// Input:  { maxSeconds } config. Output: recorder state + start/stop/reset controls.
import { useState, useRef, useCallback } from 'react';
import { useAudioRecorder as useExpoRecorder, AudioModule, RecordingPresets } from 'expo-audio';

export type RecorderStatus = 'idle' | 'requesting' | 'denied' | 'recording' | 'stopped' | 'error';

export function useAudioRecorder(maxSeconds = 120) {
  const recorder = useExpoRecorder(RecordingPresets.HIGH_QUALITY);
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsed, setElapsed] = useState(0);          // seconds, drives the timer UI
  const [uri, setUri] = useState<string | null>(null); // local file kept on device (AC10)
  const tick = useRef<ReturnType<typeof setInterval>>();

  const start = useCallback(async () => {
    setStatus('requesting');
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) { setStatus('denied'); return; }   // -> AC2 settings deep-link in UI
    try {
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStatus('recording'); setElapsed(0);
      tick.current = setInterval(() => {
        setElapsed((s) => {
          const next = s + 1;
          if (next >= maxSeconds) { void stop(); }        // -> AC4 max-duration cap
          return next;
        });
      }, 1000);
    } catch { setStatus('error'); }                        // -> AC3 recording error
  }, [recorder, maxSeconds]);

  const stop = useCallback(async () => {
    clearInterval(tick.current);
    await recorder.stop();
    setUri(recorder.uri ?? null);                          // local file retained (AC6/AC10)
    setStatus('stopped');
  }, [recorder]);

  const reset = useCallback(() => { setUri(null); setElapsed(0); setStatus('idle'); }, []);
  return { status, elapsed, uri, start, stop, reset };
}
```

#### Task 1.2: Recording screen (M-02) — waveform, timer, Stop & Save, permission-denied state

**File:** `attender-app/src/screens/RecordingScreen.tsx` — **NEW** (keep < 150 lines; extract waveform + permission card)

Renders the M-02 layout: question card ("Question N of M" + text), live waveform, elapsed timer (`m:ss`), and the Stop & Save button. On `denied`, renders the permission card with an **Open Settings** deep-link.

```typescript
// Route param: { visitId, questionId, orderIndex, total, questionText }
import { Linking } from 'react-native';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { uploadAnswer } from '../services/answersApi';
import { Waveform } from '../components/Waveform';

export function RecordingScreen({ route, navigation }) {
  const { visitId, questionId } = route.params;
  const rec = useAudioRecorder();

  const onStopAndSave = async () => {
    await rec.stop();
    if (!rec.uri) return;
    await uploadAnswer(visitId, questionId, rec.uri); // multipart; retry handled in service/UI
    navigation.goBack();                              // list shows pending spinner -> transcript
  };

  if (rec.status === 'denied') {
    return (/* AC2: message + <Button title="Open Settings" onPress={() => Linking.openSettings()} /> */);
  }
  return (
    /* M-02: question card, "● Recording", <Waveform active={rec.status==='recording'} />,
       <Timer seconds={rec.elapsed} />, <Button title="Stop & Save Answer" onPress={onStopAndSave} /> */
  );
}
```

#### Task 1.3: Waveform + timer presentational components

**File:** `attender-app/src/components/Waveform.tsx` — **NEW**
**File:** `attender-app/src/components/RecordTimer.tsx` — **NEW**

Animated bar waveform (mirrors the M-02 `.waveform` animation) and a `m:ss` timer formatter. Pure presentational; no recording logic.

### Part 2: RN Upload + Status Service (5 hours)

#### Task 2.1: `answersApi` — multipart upload with retry + transcript polling

**File:** `attender-app/src/services/answersApi.ts` — **NEW**

Builds the multipart body (audio file + `question_id`), posts to the canonical endpoint, and exposes a fetch for transcript status used by the list to show pending spinner / transcript.

```typescript
// uploadAnswer: POST /api/visits/:id/answers (multipart). Returns the created/replaced answer.
export async function uploadAnswer(visitId: string, questionId: string, fileUri: string) {
  const form = new FormData();
  form.append('audio', { uri: fileUri, name: 'answer.m4a', type: 'audio/m4a' } as any);
  form.append('question_id', questionId);                         // AC5: correct question_id
  const res = await fetch(`${API_BASE}/api/visits/${visitId}/answers`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('upload-failed');                  // AC6/AC10: caller keeps file + retry
  return res.json(); // { id, question_id, audio_path, transcript, transcript_status }
}

// getVisit: GET /api/visits/:id — used to poll transcript_status pending -> done/failed (AC7/AC8).
export async function getVisit(visitId: string) {
  const res = await fetch(`${API_BASE}/api/visits/${visitId}`);
  return res.json();
}

// retryTranscription: re-run STT on the already-stored audio (AC8) without re-upload.
export async function retryTranscription(visitId: string, answerId: string) {
  const res = await fetch(`${API_BASE}/api/visits/${visitId}/answers/${answerId}/transcribe`, { method: 'POST' });
  return res.json();
}
```

#### Task 2.2: Question list integration — pending/done/failed + Retake

**File:** `attender-app/src/screens/QuestionListScreen.tsx` — **Modify** (from CLINIC-003)

Render per-question state from `transcript_status`: spinner for `pending`, transcript + green Done for `done`, "Transcription failed / Retry" for `failed`. "Record" / "Retake" both navigate to `RecordingScreen` with the same `questionId`; Retake replaces the prior answer (AC9).

### Part 3: Backend Route + Controller (4 hours)

#### Task 3.1: Multipart route with file storage

**File:** `backend/src/routes/visits.routes.js` — **Modify** (add answers sub-routes)
**File:** `backend/src/config/upload.js` — **NEW** (multer disk storage -> `UPLOAD_DIR`, accept audio mimetypes, size limit)

```javascript
// POST /api/visits/:id/answers  (multipart: field "audio" + body.question_id)
router.post('/:id/answers', upload.single('audio'), answersController.saveAnswer);
// POST /api/visits/:id/answers/:answerId/transcribe  (retry STT on stored audio_path)
router.post('/:id/answers/:answerId/transcribe', answersController.retranscribe);
// GET /api/visits/:id  (returns visit + questions + answers w/ transcript_status)
router.get('/:id', visitsController.getVisit);
// PATCH /api/visits/:id/status
router.patch('/:id/status', visitsController.updateStatus);
```

#### Task 3.2: Answers controller — thin input -> service -> output

**File:** `backend/src/controllers/answers.controller.js` — **NEW**

```javascript
// saveAnswer: validate file + question_id, delegate to service, return the answer row.
async function saveAnswer(req, res, next) {
  try {
    const { id: visitId } = req.params;
    const { question_id } = req.body;
    if (!req.file || !question_id) return res.status(400).json({ error: 'audio file and question_id required' });
    const answer = await answersService.saveAndTranscribe({ visitId, questionId: question_id, file: req.file });
    res.status(201).json(answer);
  } catch (err) { next(err); }
}
```

### Part 4: Backend Service — Save, Replace, Status Transitions (6 hours)

#### Task 4.1: `answers.service` — create/replace answer, kick off transcription, advance visit status

**File:** `backend/src/services/answers.service.js` — **NEW** (all business logic here, not the controller)

```javascript
// saveAndTranscribe: persist file path to answers.audio_path, create/replace the (visit_id, question_id)
// answer, transition visit status, then run transcription (pending -> done/failed).
async function saveAndTranscribe({ visitId, questionId, file }) {
  // AC9: replace prior answer for this (visit_id, question_id) — removes old audio, clears old transcript
  await answersRepo.deleteByVisitAndQuestion(visitId, questionId);
  const answer = await answersRepo.create({
    visit_id: visitId, question_id: questionId,
    audio_path: file.path, transcript: null, transcript_status: 'pending',
  });
  await advanceVisitStatus(visitId);            // AC11/AC12: waiting->answering, all->answered
  await transcribeAnswer(answer.id);            // sets transcript + status done/failed
  return answersRepo.findById(answer.id);
}

// AC11/AC12: derive status from saved-answer count vs total questions for the visit.
async function advanceVisitStatus(visitId) {
  const { total, answered } = await answersRepo.countForVisit(visitId);
  if (answered >= total)      return visitsRepo.updateStatus(visitId, 'answered');
  if (answered >= 1)          return visitsRepo.updateStatus(visitId, 'answering');
}

// AC7/AC8/AC13: run STT via the single transcription interface; failures set 'failed'.
async function transcribeAnswer(answerId) {
  const answer = await answersRepo.findById(answerId);
  try {
    const text = await transcriptionService.transcribe(answer.audio_path);
    await answersRepo.setTranscript(answerId, text, 'done');
  } catch {
    await answersRepo.setTranscript(answerId, null, 'failed');
  }
}
```

#### Task 4.2: Answers repository — SQL against the canonical `answers` table

**File:** `backend/src/repositories/answers.repository.js` — **NEW**

`create`, `findById`, `deleteByVisitAndQuestion`, `setTranscript(id, transcript, transcript_status)`, and `countForVisit` (joins `questions` count vs distinct answered `question_id`). Uses exact columns: `id, visit_id, question_id, audio_path, transcript, transcript_status, created_at`.

### Part 5: Transcription Service — Sarvam REAL but STUBBABLE (4 hours)

#### Task 5.1: Single transcription interface + stub/real selection

**File:** `backend/src/services/transcription/index.js` — **NEW** (factory: chooses stub vs Sarvam)
**File:** `backend/src/services/transcription/sarvam.transcriber.js` — **NEW** (REAL Sarvam call)
**File:** `backend/src/services/transcription/stub.transcriber.js` — **NEW** (canned Tanglish)

```javascript
// index.js — ONE interface { transcribe(audioPath): Promise<string> }. The stub swaps for Sarvam.
const useMock = process.env.USE_MOCK_STT === 'true' || !process.env.SARVAM_API_KEY; // AC13
module.exports = useMock ? require('./stub.transcriber') : require('./sarvam.transcriber');
```

```javascript
// stub.transcriber.js — AC13: canned Tanglish transcript, no external call.
const CANNED = [
  'Medicine edukala, rest panna sonna family...',
  'Fever iruku, 3 days-a aachu. Kadinamaaga iruku...',
  'Illai, allergy illai doctor...',
];
let i = 0;
async function transcribe(_audioPath) { return CANNED[i++ % CANNED.length]; }
module.exports = { transcribe };
```

```javascript
// sarvam.transcriber.js — REAL: POST the audio file to Sarvam STT, return recognized text.
const fs = require('fs');
async function transcribe(audioPath) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(audioPath)]), 'answer.m4a');
  form.append('model', process.env.SARVAM_STT_MODEL ?? 'saarika:v2');
  form.append('language_code', 'ta-IN'); // Tanglish: Tamil-primary, code-mixed
  const res = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY }, body: form,
  });
  if (!res.ok) throw new Error(`sarvam-stt-${res.status}`);
  const data = await res.json();
  return data.transcript; // mapped into answers.transcript by the service layer
}
module.exports = { transcribe };
```

#### Task 5.2: Env config + sample

**File:** `backend/src/config/env.js` — **Modify** (surface `USE_MOCK_STT`, `SARVAM_API_KEY`, `SARVAM_STT_MODEL`, `UPLOAD_DIR`, `MAX_RECORDING_SECONDS`)
**File:** `.env.example` — **Modify** (document the same; default `USE_MOCK_STT=true` for the POC)

### Part 6: DB (1 hour)

#### Task 6.1: Ensure schema + seed cover answers and a pending-question visit

**File:** `db/migrations/0002_answers.sql` — **NEW (or verify exists from earlier story)**
**File:** `db/seeds/0002_visit_with_pending_questions.sql` — **NEW**

Migration confirms `answers(id, visit_id, question_id, audio_path, transcript, transcript_status, created_at)` with `transcript_status` constrained to `pending|done|failed`. Seed creates one `visits` row in status `waiting` with a question template that has pending (unanswered) questions — the Test Data for this story.

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `attender-app/src/hooks/useAudioRecorder.ts` | **NEW** | ~110 lines |
| `attender-app/src/screens/RecordingScreen.tsx` | **NEW** | ~140 lines |
| `attender-app/src/components/Waveform.tsx` | **NEW** | ~70 lines |
| `attender-app/src/components/RecordTimer.tsx` | **NEW** | ~30 lines |
| `attender-app/src/services/answersApi.ts` | **NEW** | ~90 lines |
| `attender-app/src/screens/QuestionListScreen.tsx` | Modify — render transcript_status + Retake | +80 lines |
| `backend/src/routes/visits.routes.js` | Modify — add answers + transcribe sub-routes | +20 lines |
| `backend/src/config/upload.js` | **NEW** — multer disk storage | ~40 lines |
| `backend/src/controllers/answers.controller.js` | **NEW** | ~60 lines |
| `backend/src/services/answers.service.js` | **NEW** | ~120 lines |
| `backend/src/repositories/answers.repository.js` | **NEW** | ~90 lines |
| `backend/src/services/transcription/index.js` | **NEW** — interface/factory | ~15 lines |
| `backend/src/services/transcription/sarvam.transcriber.js` | **NEW** — REAL Sarvam | ~45 lines |
| `backend/src/services/transcription/stub.transcriber.js` | **NEW** — STUB (canned Tanglish) | ~25 lines |
| `backend/src/config/env.js` | Modify — STT + upload env | +15 lines |
| `.env.example` | Modify — document STT/upload vars | +6 lines |
| `db/migrations/0002_answers.sql` | **NEW/verify** | ~25 lines |
| `db/seeds/0002_visit_with_pending_questions.sql` | **NEW** | ~30 lines |

**Backend/DB impact: substantial and REAL.** New multipart upload endpoint, file storage to `answers.audio_path`, transcription pipeline driving `transcript_status` pending->done/failed, and server-side `visits.status` transitions (waiting->answering->answered). Speech-to-text is REAL via Sarvam but STUBBABLE behind one interface (`USE_MOCK_STT`). AI summary generation is out of scope (separate story; currently mocked).

---

## UI Test Setup

| Field | Value |
|-------|-------|
| **App URL** | Expo (attender app) running on the Android emulator (`expo run:android` / dev build), launched with microphone permission available to the emulator |
| **Test Route** | Recording screen for a specific question — navigate from the Question List (M-01) by tapping **Record** on a pending question (M-02), e.g. Q3 "Any medication taken recently?" |
| **Login as** | attender role (no real auth in this POC — app opens directly into the attender flow) |
| **Test Data** | A `visits` row in status `waiting` linked to a question template with pending (unanswered) questions (seed `db/seeds/0002_visit_with_pending_questions.sql`); backend running with `USE_MOCK_STT=true` so transcription returns a canned Tanglish transcript |
| **Non-testable / HW-dependent ACs** | **AC1 (real mic capture)** — granting the OS prompt and capturing real audio is hardware/OS-dependent; verify the start-recording state, not audio fidelity. **AC3 (mid-capture hardware error)** — audio-focus-lost is hard to force on an emulator; verify the error UI via injected failure. **AC4 (max-duration auto-stop)** — timing-based; verify by lowering `MAX_RECORDING_SECONDS` in test config rather than waiting 120s. **AC10 (network loss mid-recording)** — requires toggling emulator connectivity; verify the local-file-retained + retry path, not the radio behavior itself. **AC13** is verifiable end-to-end via the STUB (no external Sarvam call). |
