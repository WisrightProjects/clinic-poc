# User Story: Text Answers — type an answer instead of recording it

**Story ID:** CLINIC-009
**Epic:** Patient Intake
**Feature:** Let the attender either record an answer or type it. Neither is compulsory.
**Priority:** P1 (High)
**Effort:** 2 days (16 hours)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development
**Depends On:** CLINIC-004 (voice answer capture). **No migration** — can be built in parallel with CLINIC-008.

---

## Story Overview

**As an** attender
**I want** to type a patient's answer when recording isn't practical
**So that** a noisy waiting room, a short "No", or a failed recording doesn't stop the intake

---

## Why This Feature?

### Current Gap
- Answers can only be recorded. `answerController.create` throws `Audio file is required` when no file is sent, and `answerService.recordAnswer` rejects a missing file too.
- The schema already allows a text-only answer: `answers.audio_path` and `answers.transcript` are both nullable.
- The trial notes ask for "both voice and text input; neither method should be compulsory".

### Real-World Use Case
The waiting room is loud and the patient answers "Any medicine allergy?" with a quick "No". Recording, waiting for Whisper and checking the transcript takes 20 seconds for one word. Priya taps **Type instead**, types "No", and moves on. Later, Whisper fails on a recording (`transcript_status = failed`); she types the answer rather than recording again.

---

## Detailed Sub-Stories

### Sub-Story 1: Backend accepts a typed answer
**Story ID:** CLINIC-009.1 | **Effort:** 0.5 day
```gherkin
As an attender
I want to save an answer as text without an audio file
So that typed answers are stored like transcribed ones
```

### Sub-Story 2: "Type instead" on the recording screen
**Story ID:** CLINIC-009.2 | **Effort:** 1 day
```gherkin
As an attender
I want a Type option next to Record for each question
So that I can choose the quicker way for each answer
```

### Sub-Story 3: Show typed answers everywhere answers appear
**Story ID:** CLINIC-009.3 | **Effort:** 0.5 day
```gherkin
As a doctor
I want typed answers to appear exactly like transcribed ones
So that I read one consistent Q&A list
```

---

## Acceptance Criteria

### AC1: A typed answer is saved without audio
```gherkin
GIVEN a visit in 'waiting' or 'answering'
WHEN POST /api/visits/:id/answers is sent with { questionId, text: 'No allergies' } and no audio file
THEN the answer is stored with transcript = 'No allergies', transcript_status = 'done', audio_path = NULL
AND no transcription is started
AND the visit advances exactly as it does for a recorded answer (waiting → answering → answered)
```

### AC2: Exactly one of audio or text
```gherkin
WHEN the request has neither an audio file nor non-empty text
THEN the response is 400 BAD_REQUEST 'Record or type an answer'
WHEN the request has both
THEN the response is 400 BAD_REQUEST
WHEN text is longer than 2000 characters
THEN the response is 422 VALIDATION_ERROR
```

### AC3: Switching method on retake replaces the old answer
```gherkin
GIVEN a question answered by recording
WHEN the attender retakes it by typing
THEN audio_path is cleared and the typed text replaces the transcript
AND the reverse (typed → recorded) also replaces the old text
```

### AC4: Typed answers are treated like transcripts everywhere
```gherkin
GIVEN a visit with a mix of typed and recorded answers
THEN the question list, the review screen, the doctor's Q&A list and the AI summary prompt all use the typed text
AND submit is not blocked by typed answers (they are never 'pending')
```

### AC5: Neither method is compulsory
```gherkin
GIVEN any question
THEN the attender can complete it by recording OR by typing, and the intake can finish using any mix of the two
```

---

## Technical Implementation

**Backend**
- `backend/src/controllers/answerController.js` — accept either `req.file` or `req.body.text`; move the "one of the two" check (AC2) into a pure validator in `backend/src/utils/` so it can be unit-tested.
- `backend/src/services/answerService.js` — add `recordTextAnswer(visitId, questionId, text)`: upsert with `audio_path = NULL`, `transcript = text`, status `done`, then `visitService.maybeAdvance(visitId)`. No `startTranscription`.
- `backend/src/repositories/answerRepository.js` — the upsert must set `audio_path` **and** `transcript` on conflict, so a retake with the other method fully replaces the old answer (AC3). A recorded retake must reset `transcript` to NULL with status `pending`.
- Keep the route `POST /visits/:id/answers` (multer only parses multipart; send the text as a multipart field too, so the mobile client keeps one upload path).

**Mobile** (read the Expo SDK 56 docs first, per `mobile/AGENTS.md`)
- `mobile/src/screens/RecordingScreen.js` — add a **Type instead** toggle: a multiline `TextInput` + **Save** button. Keep the keyboard from covering the Save button.
- `mobile/src/api/answerApi.js` — add `saveTextAnswer(visitId, questionId, text)`.
- Question list and review screen already render `transcript`; confirm nothing assumes an audio file exists.

**Doctor web**
- `frontend/src/components/QaList.jsx` — no change expected (it renders the transcript); confirm.

**Tests**
- `backend/src/__tests__/answerInput.test.js` **(NEW)** — the AC2 validator (neither / both / too long / ok).

---

## File Summary

| File | Action |
|------|--------|
| `backend/src/controllers/answerController.js` | MODIFY |
| `backend/src/services/answerService.js` | MODIFY — `recordTextAnswer` |
| `backend/src/repositories/answerRepository.js` | MODIFY — upsert replaces audio/text |
| `backend/src/utils/answerInput.js` | NEW — pure validator |
| `mobile/src/screens/RecordingScreen.js`, `mobile/src/api/answerApi.js` | MODIFY |
| `backend/src/__tests__/answerInput.test.js` | NEW |

---

## Test Setup

| Field | Value |
|-------|-------|
| **Run** | Backend + mobile (Expo Go on the same Wi-Fi) |
| **Verify** | Type one answer, record another, retake a recorded one by typing → all show on review and doctor screens; submit works (AC1–AC5) |
| **Unit tests** | `cd backend && npm test` |
| **Release** | JS-only change — no new native module, but attenders still need a new APK (no over-the-air updates) |
