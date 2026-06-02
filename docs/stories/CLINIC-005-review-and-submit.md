# User Story: Review & Submit — Attender reviews all Q&A + AI summary preview, then sends to the doctor

**Story ID:** CLINIC-005
**Epic:** Attender Intake
**Feature:** Attender reviews all captured Q&A on a Review screen with an AI summary preview, can jump back to edit/retake any answer, and confirms & sends the visit to the doctor
**Priority:** P1 (High)
**Effort:** 2.5 days (20 hours)
**Sprint:** Phase 1 — Attender Intake Flow
**Status:** Ready for Development
**Depends On:** CLINIC-004 (all answers captured per-question via recording flow); also consumes the mock summary produced by CLINIC-001's `POST /api/visits/:id/submit` endpoint

---

## Story Overview

**As an** attender at the clinic
**I want** to review all of a patient's captured spoken answers together with an AI-generated summary preview before sending
**So that** I can catch a wrong or missing answer, fix it, and confidently hand the doctor a complete, accurate intake

**As a** doctor
**I want** the summary the attender confirmed to be exactly what I later see on my dashboard
**So that** I can trust the intake and start consultation without re-checking every answer myself

---

## Why This Feature?

### Current Gap:
- CLINIC-004 leaves the attender on a per-question list (M-03) where each answer is captured in isolation; there is no single screen to read everything together.
- There is no preview of the AI summary on the attender side — the attender sends "blind" and only the doctor sees the summary, so a bad transcript reaches the doctor before anyone notices.
- The `visits.status` never moves past `'answered'` from the attender app today; nothing transitions a visit to `'summarised'` or stores a row in `summaries`.
- Double-tapping "Send" on a slow mobile network could fire `POST /api/visits/:id/submit` twice and risk a duplicate summary or a confusing error.
- After sending, there is no clean way to reset the app and start the next patient — the attender would have to restart the app.

### Real-World Use Case (Busy OPD morning, Token 04):
The attender has just finished recording all 5 answers for Lakshmi K. (Token 04). Before sending to Dr. Ramesh she wants one last look.
- She opens the Review screen (M-04) and reads all 5 transcripts in order, plus the AI summary preview generated from those answers.
- She notices Q3 ("Any medication taken?") transcribed poorly. She taps **Edit Answers**, lands back on M-03, retakes Q3 (reusing CLINIC-004's recording), and is returned to the Review screen.
- The summary preview now reflects the corrected answer. She taps **Confirm & Send to Doctor**.
- The visit moves to `'summarised'`, the mock summary is stored, and she sees a "Sent to Doctor" confirmation (M-05).
- She taps **Next Patient**, the app clears all state, and a fresh visit begins for Token 05.

This cannot be done with the current implementation (mockups only; no review screen, no submit wiring, no reset).

### Solution:
Build the attender Review & Submit flow and wire it to the canonical submit endpoint:
- **Review screen (M-04)** — read-only list of all Q&A pulled from `GET /api/visits/:id`, plus an AI summary preview.
- **Summary preview** — rendered from the **same temporary mock summary service** behind `POST /api/visits/:id/submit`, so the attender preview and the doctor view are byte-identical.
- **Edit/retake round-trip (M-03)** — jump back to the per-question list (reusing CLINIC-004's recording), then return to Review.
- **Guarded, idempotent submit** — submit allowed only when all questions answered; double-tap produces no duplicate `summaries` row.
- **Sent confirmation + Next Patient (M-05)** — confirm, then reset client state to a fresh visit.
- **Swap-ready** — the mock summary lives behind one service interface so a real local LLM drops in later WITHOUT changing the client.

---

## User Personas

### Primary: Anitha — The Clinic Attender
- **Role:** Greets walk-in patients, records their spoken answers to intake questions on an Android phone, and forwards them to the doctor.
- **Goal:** Send a complete, correct intake for each patient as fast as possible during a packed OPD morning.
- **Pain Point:** "Sometimes the recording catches the wrong thing and I don't notice until the doctor calls me back. I want to see everything once before I send it."

### Secondary: Dr. Ramesh — The General Physician
- **Role:** Sees ~10 patients a session from the doctor dashboard; relies on the AI summary + Q&A to prep each consult.
- **Goal:** Trust that the summary on his screen is the one the attender actually reviewed and approved.
- **Pain Point:** "If what the attender saw is different from what I see, I can't trust the summary at all."

---

## Detailed Sub-Stories

### Sub-Story 1: Review screen with all Q&A + AI summary preview (M-04)

**Story ID:** CLINIC-005.1
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want a Review screen that shows every question, its captured transcript, and an AI summary preview
So that I can read the full intake in one place before sending it to the doctor
```

### Sub-Story 2: Guarded + idempotent Confirm & Send wired to the submit endpoint

**Story ID:** CLINIC-005.2
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want Confirm & Send to be blocked unless all questions are answered, and safe to tap twice
So that I never send an incomplete intake or create a duplicate summary
```

### Sub-Story 3: Edit/retake round-trip back to Review (M-03 reuse)

**Story ID:** CLINIC-005.3
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an attender
I want to jump from Review back to the answer list to retake any answer and return to Review
So that I can fix a bad transcript without losing my place in the flow
```

### Sub-Story 4: Sent confirmation + Next Patient reset (M-05)

**Story ID:** CLINIC-005.4
**Points:** 3 | **Effort:** 3 hours

```gherkin
As an attender
I want a clear "Sent to Doctor" confirmation and a Next Patient button that clears all state
So that I can immediately start a fresh intake for the next token
```

### Sub-Story 5: Submit network-failure handling with retry

**Story ID:** CLINIC-005.5
**Points:** 3 | **Effort:** 3 hours

```gherkin
As an attender
I want a clear error and a Retry option when sending fails on a flaky network
So that a dropped request does not lose the patient's intake or leave the visit half-sent
```

---

## Acceptance Criteria

### AC1: Review screen renders all captured Q&A in order
```gherkin
GIVEN a visit whose status is 'answered' with a transcript for every question
WHEN the attender opens the Review & Submit screen (M-04)
THEN the screen fetches GET /api/visits/:id and lists each question with its transcript in order_index order
AND each item shows the question text and the answers.transcript value
```

### AC2: AI summary preview comes from the mock summary service
```gherkin
GIVEN the attender is on the Review & Submit screen
WHEN the AI summary preview section renders
THEN it displays the canned/templated English summary produced by the mock summary service
AND the preview is labelled "AI Summary" with a "Generated just now" timestamp
```

### AC3: Submit is allowed only when all questions are answered
```gherkin
GIVEN a visit that is missing a transcript for at least one question
WHEN the attender attempts Confirm & Send
THEN the request is blocked client-side AND the server responds 409 if called directly
AND a message "Answer all questions before sending" is shown
AND visits.status is NOT changed
```

### AC4: Confirm & Send transitions status and stores the mock summary
```gherkin
GIVEN a visit with status 'answered' and all questions answered
WHEN the attender taps Confirm & Send to Doctor
THEN POST /api/visits/:id/submit is called
AND visits.status is set to 'summarised'
AND a row is inserted into summaries(visit_id, summary_text, generated_by='mock')
```

### AC5: Submit is idempotent on double-tap
```gherkin
GIVEN a visit that has already been submitted (status 'summarised')
WHEN POST /api/visits/:id/submit is called again (e.g. a double-tap)
THEN the endpoint returns the existing summary with a success response
AND NO duplicate row is inserted into summaries
AND visits.status remains 'summarised'
```

### AC6: Edit-after-review returns the attender to the Review screen
```gherkin
GIVEN the attender is on the Review & Submit screen
WHEN they tap Edit Answers, retake an answer on the answer list (M-03), and finish
THEN they are returned to the Review & Submit screen (M-04)
AND the displayed transcript and AI summary preview reflect the updated answer
```

### AC7: Sent confirmation is shown after a successful submit
```gherkin
GIVEN Confirm & Send succeeded
WHEN the response is received
THEN the "Sent to Doctor" confirmation screen (M-05) is shown
AND it displays the patient name, the answered-count, and a Next Patient action
```

### AC8: Next Patient clears state and starts a fresh visit
```gherkin
GIVEN the attender is on the Sent confirmation screen
WHEN they tap Next Patient
THEN all current-visit state is cleared from the client store
AND the attender lands on a fresh, empty intake for a new visit
AND no data from the previous patient remains visible
```

### AC9: Submit network failure shows an error with Retry
```gherkin
GIVEN the attender taps Confirm & Send and the network request fails or times out
WHEN the failure is detected
THEN an error message is shown with a Retry action
AND the attender remains on the Review & Submit screen with all answers intact
AND tapping Retry re-issues POST /api/visits/:id/submit (idempotently)
```

### AC10: The send button reflects completeness state
```gherkin
GIVEN the attender is on the Review & Submit screen
WHEN not all questions are answered
THEN the Confirm & Send button is shown in a disabled/inactive style
AND when all questions are answered the button becomes active
```

### AC11: Attender preview matches the doctor view exactly
```gherkin
GIVEN a visit has been submitted
WHEN the doctor opens the same visit on the dashboard (D-01)
THEN the summary_text the doctor sees is the same value previewed to the attender on M-04
AND both are sourced from the single summaries row for that visit
```

### AC12: Submit is rejected for a visit not yet fully answered server-side
```gherkin
GIVEN a request to POST /api/visits/:id/submit
WHEN the server checks the visit's answers
THEN it returns 409 Conflict if any question lacks a transcript
AND returns 200 with the summary only when every question is answered
```

---

## Technical Implementation

> **GREENFIELD:** the repo currently contains only static HTML mockups + Docker. Every file below is **NEW**. The attender app is React Native (Expo, TypeScript); the backend is Node.js (Express) + PostgreSQL following the layered `backend/src/{controllers,services,repositories,models,routes,utils,config}` structure. The AI summary generation is a **TEMPORARY MOCK** isolated behind one service so a real local LLM can replace it later without any client change. STT (Sarvam) and answer capture are owned by CLINIC-004 and not built here.

### Part 1: Mock summary service — the swap-ready seam (4 hours)

#### Task 1.1: Define the summary-generator interface

**File:** `backend/src/services/summaryGenerator.ts` **(NEW)**

The single seam where a real LLM drops in later. The client never knows whether the summary is mock or LLM-generated.

```typescript
// summaryGenerator.ts — produces a visit summary from its answered Q&A.
// MOCK for this POC (generated_by='mock'); swap this module's impl for a
// local LLM later WITHOUT touching controllers, services, or the client.

export interface QAPair {
  questionText: string;   // questions.text
  transcript: string;     // answers.transcript
  orderIndex: number;     // questions.order_index
}

export interface VisitContext {
  patientName: string;    // visits.patient_name
  age: number | null;     // visits.age
  sex: string | null;     // visits.sex
}

export interface GeneratedSummary {
  summaryText: string;    // -> summaries.summary_text
  generatedBy: string;    // -> summaries.generated_by  ('mock' for now)
}

export interface SummaryGenerator {
  // Input:  visit context + ordered answered Q&A
  // Output: a GeneratedSummary ready to persist into summaries(...)
  generate(ctx: VisitContext, qa: QAPair[]): Promise<GeneratedSummary>;
}

// MOCK implementation — canned/templated English string.
// Deterministic so the attender preview and doctor view always match.
export const mockSummaryGenerator: SummaryGenerator = {
  async generate(ctx, qa) {
    const ordered = [...qa].sort((a, b) => a.orderIndex - b.orderIndex);
    const lines = ordered.map((p) => `- ${p.questionText} ${p.transcript}`.trim());
    const who = [ctx.sex, ctx.age != null ? `${ctx.age} yrs` : null]
      .filter(Boolean).join('/');
    const summaryText =
      `Patient (${who || 'unknown'}) intake summary:\n${lines.join('\n')}`;
    return { summaryText, generatedBy: 'mock' };
  },
};

// Single export the rest of the app imports. Replace the right-hand side
// with a real LLM-backed generator later — no other file changes.
export const summaryGenerator: SummaryGenerator = mockSummaryGenerator;
```

### Part 2: Submit service — guard, generate, persist, idempotent (4 hours)

#### Task 2.1: Submit/summarise service

**File:** `backend/src/services/visitSubmitService.ts` **(NEW)**

Business logic lives in the service (controllers stay thin). Guards completeness, calls the summary generator, persists, and is idempotent.

```typescript
// visitSubmitService.ts — transitions a fully-answered visit to 'summarised'
// and stores a generated summary. Idempotent + guarded.
import { visitsRepo } from '../repositories/visitsRepo';
import { answersRepo } from '../repositories/answersRepo';
import { questionsRepo } from '../repositories/questionsRepo';
import { summariesRepo } from '../repositories/summariesRepo';
import { summaryGenerator } from './summaryGenerator';

export class NotFoundError extends Error {}
export class NotAllAnsweredError extends Error {} // -> 409

// Input: visitId. Output: the summaries row (existing or newly created).
export async function submitVisit(visitId: string) {
  const visit = await visitsRepo.findById(visitId);
  if (!visit) throw new NotFoundError('visit not found');

  // Idempotent: already summarised -> return existing summary, no new row.
  if (visit.status === 'summarised' || visit.status === 'done') {
    const existing = await summariesRepo.findByVisitId(visitId);
    if (existing) return existing;
  }

  // Guard: every question for the template must have a transcript.
  const questions = await questionsRepo.findByTemplateForVisit(visitId);
  const answers = await answersRepo.findByVisitId(visitId);
  const answered = new Set(
    answers.filter((a) => a.transcript && a.transcript.trim().length > 0)
           .map((a) => a.question_id),
  );
  const allAnswered = questions.every((q) => answered.has(q.id));
  if (!allAnswered) throw new NotAllAnsweredError('not all questions answered');

  // Generate via the swappable seam (mock today, LLM later).
  const qa = questions.map((q) => {
    const a = answers.find((x) => x.question_id === q.id);
    return { questionText: q.text, transcript: a?.transcript ?? '', orderIndex: q.order_index };
  });
  const { summaryText, generatedBy } = await summaryGenerator.generate(
    { patientName: visit.patient_name, age: visit.age, sex: visit.sex }, qa,
  );

  // Persist summary + transition status atomically.
  const summary = await summariesRepo.create({ visit_id: visitId, summary_text: summaryText, generated_by: generatedBy });
  await visitsRepo.updateStatus(visitId, 'summarised');
  return summary;
}
```

#### Task 2.2: Controller + route for the canonical endpoints

**File:** `backend/src/controllers/visitsController.ts` **(NEW)**
**File:** `backend/src/routes/visits.ts` **(NEW)**

Thin controller: input -> service -> output. Maps service errors to HTTP codes.

```typescript
// visitsController.ts
import { Request, Response } from 'express';
import { getVisitDetail } from '../services/visitService';
import { submitVisit, NotFoundError, NotAllAnsweredError } from '../services/visitSubmitService';

// GET /api/visits/:id -> visit + answers + summary
export async function getVisit(req: Request, res: Response) {
  const detail = await getVisitDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'visit not found' });
  return res.json(detail);
}

// POST /api/visits/:id/submit -> guarded, idempotent summarise
export async function postSubmit(req: Request, res: Response) {
  try {
    const summary = await submitVisit(req.params.id);
    return res.status(200).json({ status: 'summarised', summary });
  } catch (e) {
    if (e instanceof NotFoundError) return res.status(404).json({ error: e.message });
    if (e instanceof NotAllAnsweredError) return res.status(409).json({ error: e.message });
    throw e;
  }
}
```

```typescript
// routes/visits.ts
import { Router } from 'express';
import { getVisit, postSubmit } from '../controllers/visitsController';
const router = Router();
router.get('/:id', getVisit);
router.post('/:id/submit', postSubmit);
export default router; // mounted at /api/visits
```

#### Task 2.3: Summaries repository (idempotency support)

**File:** `backend/src/repositories/summariesRepo.ts` **(NEW)**

```typescript
// summariesRepo.ts — data access for the summaries table.
// findByVisitId backs idempotency; create inserts a single row.
import { db } from '../config/db';

export const summariesRepo = {
  findByVisitId: (visitId: string) =>
    db.oneOrNone(
      'SELECT id, visit_id, summary_text, generated_by, created_at FROM summaries WHERE visit_id = $1',
      [visitId],
    ),
  create: ({ visit_id, summary_text, generated_by }:
    { visit_id: string; summary_text: string; generated_by: string }) =>
    db.one(
      `INSERT INTO summaries (visit_id, summary_text, generated_by)
       VALUES ($1, $2, $3)
       RETURNING id, visit_id, summary_text, generated_by, created_at`,
      [visit_id, summary_text, generated_by],
    ),
};
```

> A UNIQUE constraint on `summaries(visit_id)` (added in the CLINIC-001 migration) is the DB-level backstop for idempotency under concurrent double-tap.

### Part 3: Review & Submit screen (M-04) (5 hours)

#### Task 3.1: Review screen component

**File:** `frontend-attender/src/screens/ReviewSubmitScreen.tsx` **(NEW)**

Read-only Q&A list + AI summary preview + Confirm & Send. Keeps the component small; data shaping lives in a hook (Task 3.2).

```tsx
// ReviewSubmitScreen.tsx — M-04. Read-only review of all Q&A plus the
// AI summary preview, with Edit Answers and Confirm & Send actions.
import { View, ScrollView, Text } from 'react-native';
import { useReviewSubmit } from '../hooks/useReviewSubmit';
import { QAReviewItem } from '../components/QAReviewItem';
import { SummaryPreview } from '../components/SummaryPreview';
import { SendButton } from '../components/SendButton';

export function ReviewSubmitScreen({ navigation, route }) {
  const { visitId } = route.params;
  const { visit, qa, summaryText, allAnswered, submitState, submit, retry } =
    useReviewSubmit(visitId);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        {qa.map((p) => <QAReviewItem key={p.questionId} {...p} />)}
        <SummaryPreview text={summaryText} />
      </ScrollView>
      <SendButton
        enabled={allAnswered}
        state={submitState}                 // idle | sending | error
        onPress={submit}                    // guarded + idempotent
        onRetry={retry}                     // AC9
        onEdit={() => navigation.navigate('AnswerList', { visitId })} // M-03, AC6
        onSent={() => navigation.replace('Sent', { visitId })}        // M-05, AC7
      />
    </View>
  );
}
```

#### Task 3.2: Review/submit hook (data + submit lifecycle)

**File:** `frontend-attender/src/hooks/useReviewSubmit.ts` **(NEW)**

```typescript
// useReviewSubmit.ts — loads GET /api/visits/:id, derives allAnswered,
// drives the idempotent submit lifecycle (idle/sending/error), and
// surfaces the summary preview text from the API response.
import { useEffect, useState, useCallback } from 'react';
import { getVisit, submitVisit } from '../api/visitsApi';

export function useReviewSubmit(visitId: string) {
  const [visit, setVisit] = useState(null);
  const [qa, setQa] = useState([]);
  const [summaryText, setSummaryText] = useState('');
  const [submitState, setSubmitState] = useState<'idle'|'sending'|'error'>('idle');

  const load = useCallback(async () => {
    const d = await getVisit(visitId);     // visit + answers + summary
    setVisit(d.visit);
    setQa(d.answers.map((a) => ({ questionId: a.question_id, ...a })));
    setSummaryText(d.summary?.summary_text ?? '');
  }, [visitId]);

  useEffect(() => { load(); }, [load]);    // reload on focus / after edit (AC6)

  const allAnswered = qa.length > 0 && qa.every((a) => a.transcript?.trim());

  const submit = useCallback(async () => {
    if (!allAnswered || submitState === 'sending') return; // client guard + double-tap
    setSubmitState('sending');
    try {
      const res = await submitVisit(visitId);   // idempotent server-side
      setSummaryText(res.summary.summary_text);  // preview == doctor view (AC11)
      setSubmitState('idle');
      return res;
    } catch {
      setSubmitState('error');                   // AC9
    }
  }, [visitId, allAnswered, submitState]);

  return { visit, qa, summaryText, allAnswered, submitState, submit, retry: submit, reload: load };
}
```

#### Task 3.3: Presentational components

**File:** `frontend-attender/src/components/QAReviewItem.tsx` **(NEW)**
**File:** `frontend-attender/src/components/SummaryPreview.tsx` **(NEW)**
**File:** `frontend-attender/src/components/SendButton.tsx` **(NEW)**

`SummaryPreview` renders the same `summary_text` the doctor sees (AC11). `SendButton` reflects the enabled/disabled completeness state (AC10) and the sending/error/retry states (AC9).

### Part 4: Sent confirmation + Next Patient reset (M-05) (3 hours)

#### Task 4.1: Sent confirmation screen

**File:** `frontend-attender/src/screens/SentScreen.tsx` **(NEW)**

```tsx
// SentScreen.tsx — M-05. Confirms the intake was sent and offers Next Patient,
// which clears all current-visit state and starts a fresh visit.
import { View, Text } from 'react-native';
import { useVisitStore } from '../store/visitStore';

export function SentScreen({ navigation, route }) {
  const resetVisit = useVisitStore((s) => s.resetVisit); // clears current-visit state (AC8)
  return (
    <View>
      <Text>Sent to Doctor</Text>
      <Text>{route.params.answeredCount} answers sent.</Text>
      {/* Next Patient -> clear state -> fresh intake */}
      <NextPatientButton onPress={async () => {
        await resetVisit();
        navigation.reset({ index: 0, routes: [{ name: 'NewVisit' }] });
      }} />
    </View>
  );
}
```

#### Task 4.2: Visit store reset action

**File:** `frontend-attender/src/store/visitStore.ts` **(NEW)**

```typescript
// visitStore.ts — current-visit client state. resetVisit() clears all
// previous-patient data so Next Patient starts clean (AC8).
import { create } from 'zustand';

export const useVisitStore = create((set) => ({
  visitId: null, patient: null, answers: {}, summaryText: '',
  resetVisit: () => set({ visitId: null, patient: null, answers: {}, summaryText: '' }),
}));
```

### Part 5: Attender API client (1 hour)

#### Task 5.1: Visits API client

**File:** `frontend-attender/src/api/visitsApi.ts` **(NEW)**

```typescript
// visitsApi.ts — thin client for the canonical /api endpoints.
import { http } from './http';

export const getVisit = (id: string) =>
  http.get(`/api/visits/${id}`).then((r) => r.data);   // visit + answers + summary

export const submitVisit = (id: string) =>
  http.post(`/api/visits/${id}/submit`).then((r) => r.data); // guarded + idempotent
```

### Part 6: Tests (3 hours)

#### Task 6.1: Submit service tests

**File:** `backend/src/services/__tests__/visitSubmitService.test.ts` **(NEW)**

Covers: 409 when not all answered (AC3/AC12); status -> 'summarised' + one `summaries` row (AC4); idempotent re-submit returns existing row, no duplicate (AC5); summary sourced from the mock generator (AC2).

#### Task 6.2: Review hook / screen tests

**File:** `frontend-attender/src/hooks/__tests__/useReviewSubmit.test.ts` **(NEW)**

Covers: client guard blocks submit when incomplete (AC3/AC10); double-tap fires once (AC5); error state on network failure + retry (AC9); preview text equals API summary (AC11).

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `backend/src/services/summaryGenerator.ts` | **NEW** — mock summary service (swap seam) | ~55 lines |
| `backend/src/services/visitSubmitService.ts` | **NEW** — guard + generate + persist + idempotent | ~60 lines |
| `backend/src/services/visitService.ts` | **NEW** — assembles GET /api/visits/:id detail | ~40 lines |
| `backend/src/controllers/visitsController.ts` | **NEW** — thin controller, error mapping | ~35 lines |
| `backend/src/routes/visits.ts` | **NEW** — route wiring under /api/visits | ~12 lines |
| `backend/src/repositories/summariesRepo.ts` | **NEW** — summaries data access | ~25 lines |
| `frontend-attender/src/screens/ReviewSubmitScreen.tsx` | **NEW** — M-04 review screen | ~90 lines |
| `frontend-attender/src/screens/SentScreen.tsx` | **NEW** — M-05 confirmation + Next Patient | ~55 lines |
| `frontend-attender/src/hooks/useReviewSubmit.ts` | **NEW** — data + submit lifecycle | ~70 lines |
| `frontend-attender/src/components/QAReviewItem.tsx` | **NEW** — single Q&A row | ~35 lines |
| `frontend-attender/src/components/SummaryPreview.tsx` | **NEW** — AI summary preview card | ~35 lines |
| `frontend-attender/src/components/SendButton.tsx` | **NEW** — guarded/sending/error/retry button | ~55 lines |
| `frontend-attender/src/store/visitStore.ts` | **NEW** — current-visit state + resetVisit | ~25 lines |
| `frontend-attender/src/api/visitsApi.ts` | **NEW** — visits API client | ~15 lines |
| `backend/src/services/__tests__/visitSubmitService.test.ts` | **NEW** — submit guard/idempotency tests | ~110 lines |
| `frontend-attender/src/hooks/__tests__/useReviewSubmit.test.ts` | **NEW** — review/submit hook tests | ~90 lines |

**Backend/DB impact:** Uses the canonical `visits`, `questions`, `answers`, `summaries` tables verbatim — no schema changes in this story. The `summaries` table, its `UNIQUE(visit_id)` constraint, and the `POST /api/visits/:id/submit` endpoint shell are introduced by CLINIC-001; this story implements the guard/idempotency/generation logic and the attender review/confirm UI. The AI summary is a **temporary mock** behind `summaryGenerator.ts` and can be replaced by a local LLM later without any client change.

---

## UI Test Setup

| Field | Value |
|-------|-------|
| **App URL** | Expo dev app on the Android emulator (Metro bundler), backend at `http://10.0.2.2:3000` (emulator -> host) |
| **Test Route** | Review & Submit screen (M-04) — navigate from the All Answered list (M-03) via "Next → Review & Submit" |
| **Login as** | attender role (no real auth in this POC — attender is the only mobile role) |
| **Test Data** | a seeded visit with status `'answered'` and a transcript for every question (e.g. Token 04, Lakshmi K., 5/5 answered). For AC3/AC10 also seed a visit missing one transcript. |
| **Non-testable ACs** | AC5 (idempotency — verified via API/DB: re-POST returns existing row, no duplicate in `summaries`); AC11 (cross-surface match — verified by comparing the M-04 preview to the doctor D-01 view / the single `summaries` row); AC12 (server-side 409 — verified via direct API call, not the UI) |
