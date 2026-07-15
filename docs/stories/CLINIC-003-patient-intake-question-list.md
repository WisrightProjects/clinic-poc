# User Story: Patient Intake & Question List — Attender starts/selects a visit and works the intake question list

**Story ID:** CLINIC-003
**Epic:** Attender Intake
**Feature:** Attender starts or selects the current patient visit, loads the department's active template questions plus existing answers, and works a question list with per-question state, progress, and a gated "Send to Doctor" action.
**Priority:** P0 (Critical)
**Effort:** 2.5 days (20 hours)
**Sprint:** Phase 1 — Attender Intake Flow
**Status:** Ready for Development
**Depends On:** CLINIC-001 (backend/DB schema, layered Express + PostgreSQL, departments/visits/answers tables and seeds), CLINIC-002 (question template — `question_templates` + `questions`, active template per department)

---

## Story Overview

**As an** clinic attender (front-desk staff)
**I want** to create or open the current patient's visit and see all intake questions with a clear answered/pending state and overall progress
**So that** I know exactly which questions remain, can resume an interrupted intake without losing prior answers, and only send the patient to the doctor once everything is captured

**As a** doctor
**I want** the attender to be blocked from submitting until every question is answered
**So that** I never receive a half-complete intake and can trust the Q&A and summary are based on the full questionnaire

---

## Why This Feature?

### Current Gap:
- The repo today is only static HTML mockups (`clinic-flow.html` screens S-01..D-01) and Docker config — there is **no running attender app, no backend wiring, no data layer integration**. M-01 exists purely as a visual.
- There is no way to actually create a `visits` row, assign a token number, or persist which questions are answered.
- An attender who closes the app mid-intake has no way to resume — there is no concept of an in-progress visit being re-opened with its prior answers intact.
- Nothing enforces "all questions answered" before sending to the doctor; the disabled button in the mockup is cosmetic only.

### Real-World Use Case (Busy Chennai morning OPD):
A walk-in patient, Lakshmi K., arrives at the General desk. The attender taps "New Patient", enters her name, age, sex and department, and the app assigns **Token 04** automatically. The app loads the 5 active General-template questions. Lakshmi answers Q1 and Q2 (recorded + transcribed), then the attender is pulled away by a phone call and the app is backgrounded. Twenty minutes later the attender re-opens Lakshmi's visit from the list: the two answered questions still show "Done" with their transcripts, progress reads "2 of 5 answered · 40%", and Q3-Q5 show "Record". The attender finishes Q3-Q5; only then does **Send to Doctor** become tappable.

This cannot be done with the current implementation (mockups only — no token assignment, no persistence, no resume, no gating logic).

### Solution:
Build the **Patient Question List** as the first real screen of the attender React Native (Expo) app, wired to the real backend:
- **Create / select visit** — `POST /api/visits` assigns a collision-free token and persists patient fields; existing visits are re-opened via `GET /api/visits/:id`.
- **Question + answer load** — fetch the department's **active** template questions and the visit's existing `answers`, merge into a per-question answered/pending view model.
- **Progress + gating** — compute "X of N answered" and percentage; keep **Send to Doctor** disabled until all questions have an answer.
- **Resume in-progress** — re-opening a visit in status `answering` restores prior transcripts and state with no data loss.
- **Empty / error states** — handle "no active template for department", patient-field validation, and offline/failed create with retry. Backend, DB and visit-status sync are REAL; AI summary generation is out of scope here (TEMPORARY MOCK, handled downstream).

---

## User Personas

### Primary: Anitha — The Clinic Attender
- **Role:** Front-desk staff who registers walk-in patients and captures their spoken answers on a shared Android tablet/phone before the doctor sees them.
- **Goal:** Register a patient fast, assign a token, and reliably reach an "all answered" state so she can hand the visit to the doctor.
- **Pain Point:** "When the desk is crowded I lose track of which patient still has questions left, and if the app closes I'm scared I'll have to redo everything."

### Secondary: Dr. Ramesh — The General Physician
- **Role:** Reviews each visit's Q&A and AI summary on the web dashboard before the patient walks in.
- **Goal:** Only ever see complete intakes so his pre-read is trustworthy.
- **Pain Point:** "Half the time the front desk sends me patients with two of five answers filled — then I'm doing the intake myself in the room."

---

## Detailed Sub-Stories

### Sub-Story 1: Create / select the current visit (token assignment)

**Story ID:** CLINIC-003.1
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want to enter a patient's name, age, sex and department and start a visit
So that the system assigns a unique token and creates the visit I will work against
```

### Sub-Story 2: Load template questions + existing answers into a question-list view model

**Story ID:** CLINIC-003.2
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want the visit screen to load the department's active questions and any answers already given
So that I see every question with its correct answered or pending state
```

### Sub-Story 3: Progress indicator + Send-to-Doctor gating

**Story ID:** CLINIC-003.3
**Points:** 3 | **Effort:** 4 hours

```gherkin
As an attender
I want a live "X of N answered" progress bar and a Send to Doctor button that only enables when complete
So that I always know what remains and cannot submit an incomplete intake
```

### Sub-Story 4: Resume in-progress visit + navigate to recording

**Story ID:** CLINIC-003.4
**Points:** 3 | **Effort:** 3 hours

```gherkin
As an attender
I want to re-open an in-progress visit and tap any pending question to record its answer
So that I can continue an interrupted intake without losing prior answers
```

### Sub-Story 5: Empty state, validation, and offline/retry handling

**Story ID:** CLINIC-003.5
**Points:** 3 | **Effort:** 3 hours

```gherkin
As an attender
I want clear messages when no template exists, when patient fields are invalid, or when create fails offline
So that I am never stuck on a blank or broken screen and can retry safely
```

---

## Acceptance Criteria

### AC1: Token auto-assigned without collision on visit create
```gherkin
GIVEN the attender submits a new patient (patient_name, age, sex, department_id) via POST /api/visits
WHEN the backend creates the visits row
THEN it assigns the next sequential token_number scoped to the clinic day with no duplicate token_number for that scope
AND the response returns the new visit with status 'waiting'
AND two near-simultaneous creates never receive the same token_number
```

### AC2: Question list loads active template + merged answers
```gherkin
GIVEN a visit exists for a department that has an active question_template
WHEN the attender opens the visit and the app calls GET /api/visits/:id
THEN the screen lists every question from that template ordered by order_index
AND each question whose question_id appears in the visit's answers shows as answered with its transcript preview
AND each question without an answer shows as pending with a "Record" affordance
```

### AC3: Progress indicator reflects answered count
```gherkin
GIVEN a visit with N template questions and X answered
WHEN the question list renders
THEN the progress label reads "X of N answered"
AND the percentage equals round(X / N * 100)%
AND the progress bar fill width matches that percentage
AND when X equals N the label switches to a completed state (e.g. "✓ Complete")
```

### AC4: Send to Doctor disabled until all answered
```gherkin
GIVEN a visit where X is less than N
WHEN the question list renders
THEN the "Send to Doctor" button is disabled (non-interactive, dimmed)
AND a helper line reads "Answer all questions to continue"
WHEN every question becomes answered (X equals N)
THEN the "Send to Doctor" button becomes enabled
```

### AC5: First answer moves visit to 'answering'
```gherkin
GIVEN a visit in status 'waiting' with zero answers
WHEN the first answer is persisted (POST /api/visits/:id/answers from CLINIC-004) and the list reloads
THEN the visit status is 'answering'
AND the question list reflects one answered question
```

### AC6: Resume an in-progress visit with no data loss
```gherkin
GIVEN a visit in status 'answering' with 2 of 5 answers already recorded
WHEN the attender re-opens that visit (GET /api/visits/:id)
THEN the 2 previously answered questions show as answered with their original transcripts
AND the 3 remaining questions show as pending
AND progress reads "2 of 5 answered · 40%"
AND no prior answer is overwritten or lost
```

### AC7: Tapping a pending question routes to recording
```gherkin
GIVEN the question list is showing a pending question
WHEN the attender taps that question's "Record" affordance
THEN the app navigates to the recording screen (CLINIC-004) for that visit_id and question_id
AND on return the list reflects the newly captured answer (if saved)
```

### AC8: Empty state when no active template for department
```gherkin
GIVEN the visit's department has no active question_template (none exists or all are is_active = false)
WHEN the attender opens the visit
THEN the screen shows an empty state explaining no questions are configured for this department
AND the "Send to Doctor" button is hidden or disabled
AND no crash or infinite spinner occurs
```

### AC9: Patient field validation before create
```gherkin
GIVEN the attender is on the new-patient form
WHEN they attempt to start a visit with a blank patient_name, a missing department_id, or an age outside 0–120
THEN the create is blocked client-side with inline field errors
AND POST /api/visits is not called until the fields are valid
AND the backend independently rejects invalid payloads with a 400
```

### AC10: Offline / failed create shows retry
```gherkin
GIVEN the device is offline or POST /api/visits returns a network/5xx error
WHEN the attender taps "Start Visit"
THEN a non-blocking error message appears with a "Retry" action
AND the entered patient fields are preserved
AND tapping "Retry" re-attempts the same create without creating a duplicate visit on eventual success
```

### AC11: Role passed as attender (no real auth)
```gherkin
GIVEN there is no real authentication in this POC
WHEN the app calls any /api endpoint from this screen
THEN it sends the attender role via header (e.g. X-Role: attender)
AND the backend reads role from the header/param to scope behavior
```

### AC12: Answered count derived from answers, not status
```gherkin
GIVEN a visit whose status field may lag behind its answers (e.g. status still 'answering' but all answers present)
WHEN progress and the Send-to-Doctor gate are computed
THEN they are derived from the count of answered questions versus template questions
AND not solely from the visits.status value
```

---

## Technical Implementation

> **GREENFIELD NOTE:** The repository currently contains only `index.html`, `clinic-flow.html`, `Dockerfile`, `docker-compose.yml`, `.gitignore`. There is **no** `attender-app/`, `backend/`, or `db/` yet. CLINIC-001 is assumed to have scaffolded the layered backend (`backend/src/{controllers,services,repositories,models,routes,utils,config}`) and `db/{migrations,seeds}`, and the Expo app shell. Files below marked **NEW** are created in this story; files marked **Modify** extend CLINIC-001/CLINIC-002 scaffolding. All backend code is REAL (Express + PostgreSQL). AI summary generation is NOT touched here.

### Part 1: Backend — Visit create with safe token assignment (5 hours)

#### Task 1.1: Visit repository — insert + next-token query

**File:** `backend/src/repositories/visitRepository.js` (**NEW**)

Encapsulates all `visits` SQL. Token assignment uses a transactional, collision-safe strategy (advisory lock or `SELECT ... FOR UPDATE` + `MAX(token_number)+1`) scoped to the current day.

```javascript
// Purpose: Data access for visits. No business rules here.
// Input/Output: plain objects in, rows out. Caller owns the transaction.

async function getNextTokenNumber(client) {
  // collision-safe: serialize concurrent creates for the day's scope
  await client.query('SELECT pg_advisory_xact_lock($1)', [TOKEN_LOCK_KEY]);
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(token_number), 0) + 1 AS next
       FROM visits
      WHERE created_at::date = CURRENT_DATE`
  );
  return rows[0].next;
}

async function insertVisit(client, { tokenNumber, patientName, age, sex, departmentId }) {
  const { rows } = await client.query(
    `INSERT INTO visits (token_number, patient_name, age, sex, department_id, status)
     VALUES ($1, $2, $3, $4, $5, 'waiting')
     RETURNING id, token_number, patient_name, age, sex, department_id, status, created_at, updated_at`,
    [tokenNumber, patientName, age, sex, departmentId]
  );
  return rows[0];
}

async function getVisitById(id) { /* SELECT * FROM visits WHERE id = $1 */ }

module.exports = { getNextTokenNumber, insertVisit, getVisitById };
```

#### Task 1.2: Visit service — orchestrate create in one transaction

**File:** `backend/src/services/visitService.js` (**NEW**)

All business logic lives here (per global rules): validate, open a transaction, get next token, insert.

```javascript
// Purpose: Visit business logic — create with safe token, fetch detail.
// Input: { patientName, age, sex, departmentId }  Output: visit row.
const db = require('../config/db');
const visitRepo = require('../repositories/visitRepository');
const { validateNewVisit } = require('../utils/visitValidation');

async function createVisit(payload) {
  const clean = validateNewVisit(payload); // throws 400-style error if invalid
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const tokenNumber = await visitRepo.getNextTokenNumber(client);
    const visit = await visitRepo.insertVisit(client, { tokenNumber, ...clean });
    await client.query('COMMIT');
    return visit;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createVisit };
```

#### Task 1.3: Visit detail service — merge questions + answers

**File:** `backend/src/services/visitService.js` (**Modify — same file as 1.2**)

`getVisitDetail(id)` returns the visit, the department's **active** template questions, and the existing answers so the client can build the per-question view model (supports AC2, AC6, AC8, AC12).

```javascript
// Output shape consumed by GET /api/visits/:id
// { visit, template: {...}|null, questions: [...], answers: [...] }
async function getVisitDetail(id) {
  const visit = await visitRepo.getVisitById(id);
  if (!visit) throw new NotFoundError('visit not found');
  const template = await templateRepo.getActiveTemplate(visit.department_id); // from CLINIC-002
  const questions = template ? await questionRepo.getByTemplate(template.id) : [];
  const answers = await answerRepo.getByVisit(id);
  return { visit, template, questions, answers };
}
```

#### Task 1.4: Validation util

**File:** `backend/src/utils/visitValidation.js` (**NEW**)

```javascript
// Purpose: validate + normalize new-visit input. Throws ValidationError(400).
function validateNewVisit({ patientName, age, sex, departmentId }) {
  const errors = {};
  if (!patientName || !patientName.trim()) errors.patientName = 'required';
  if (departmentId == null) errors.departmentId = 'required';
  if (age != null && (age < 0 || age > 120)) errors.age = 'out of range';
  if (sex && !['M', 'F', 'O'].includes(sex)) errors.sex = 'invalid';
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return { patientName: patientName.trim(), age: age ?? null, sex: sex ?? null, departmentId };
}
module.exports = { validateNewVisit };
```

#### Task 1.5: Controller + routes (thin)

**File:** `backend/src/controllers/visitController.js` (**NEW**), `backend/src/routes/visitRoutes.js` (**Modify** — add POST /, GET /:id)

```javascript
// Controller: input -> service -> output only. No business logic.
async function postVisit(req, res, next) {
  try { res.status(201).json(await visitService.createVisit(req.body)); }
  catch (err) { next(err); }
}
async function getVisit(req, res, next) {
  try { res.json(await visitService.getVisitDetail(req.params.id)); }
  catch (err) { next(err); }
}
```

```javascript
// visitRoutes.js
router.post('/', requireRole('attender'), visitController.postVisit);   // POST /api/visits
router.get('/:id', visitController.getVisit);                           // GET  /api/visits/:id
```

### Part 2: Attender app — Question List screen (8 hours)

#### Task 2.1: API client for visits

**File:** `attender-app/src/services/visitApi.js` (**NEW**)

```javascript
// Purpose: typed-ish fetch wrappers; always send attender role header.
const HEADERS = { 'Content-Type': 'application/json', 'X-Role': 'attender' };

export async function createVisit(body) {
  const res = await fetch(`${API_BASE}/api/visits`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw await toApiError(res);   // surfaces 400 field errors + 5xx for retry
  return res.json();
}

export async function getVisitDetail(id) {
  const res = await fetch(`${API_BASE}/api/visits/${id}`, { headers: HEADERS });
  if (!res.ok) throw await toApiError(res);
  return res.json();
}
```

#### Task 2.2: View-model hook — merge questions + answers, compute progress

**File:** `attender-app/src/hooks/useQuestionList.js` (**NEW**)

Pure-ish hook deriving the per-question list and progress from `GET /api/visits/:id`. Progress and the send gate are derived from `answers` vs `questions`, not from `visit.status` (AC12).

```javascript
// Output: { items, answeredCount, total, percent, allAnswered, loading, error, reload }
export function useQuestionList(visitId) {
  const [data, setData] = useState(null);
  // ...load via getVisitDetail(visitId)...
  const { questions = [], answers = [] } = data ?? {};
  const answeredIds = new Set(answers.map(a => a.question_id));
  const items = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map(q => ({
      ...q,
      answered: answeredIds.has(q.id),
      transcript: answers.find(a => a.question_id === q.id)?.transcript ?? null,
    }));
  const total = items.length;
  const answeredCount = items.filter(i => i.answered).length;
  const percent = total ? Math.round((answeredCount / total) * 100) : 0;
  const allAnswered = total > 0 && answeredCount === total;
  return { items, answeredCount, total, percent, allAnswered, /* loading, error, reload */ };
}
```

#### Task 2.3: Question List screen (M-01)

**File:** `attender-app/src/screens/QuestionListScreen.js` (**NEW**, kept < 150 lines — presentational only)

Renders the patient header (name + Token badge), `<ProgressBar>`, the `<QuestionRow>` list, the empty state (AC8), and the gated `<SendToDoctorButton>` (AC4). Tapping a pending row navigates to the recording route (AC7).

```jsx
// Presentational; logic from useQuestionList.
if (loading) return <ScreenSpinner />;
if (error) return <ErrorRetry message={error.message} onRetry={reload} />;
if (total === 0) return <NoTemplateEmptyState department={visit.department_id} />;
return (
  <Screen>
    <PatientHeader name={visit.patient_name} token={visit.token_number} />
    <ProgressBar answered={answeredCount} total={total} percent={percent} />
    <FlatList data={items} keyExtractor={i => String(i.id)}
      renderItem={({ item, index }) => (
        <QuestionRow index={index + 1} item={item}
          onRecord={() => nav.navigate('Recording', { visitId, questionId: item.id })} />
      )} />
    <SendToDoctorButton disabled={!allAnswered} onPress={goToReview} />
  </Screen>
);
```

#### Task 2.4: Presentational components

**Files:** `attender-app/src/components/QuestionRow.js`, `attender-app/src/components/ProgressBar.js`, `attender-app/src/components/SendToDoctorButton.js`, `attender-app/src/components/PatientHeader.js` (all **NEW**, each well under 150 lines)

`QuestionRow` shows the number badge (done check vs pending number), question text, transcript preview when answered, and Record/Done affordance — mirroring the `q-item` / `qn-done` / `qbtn-record` styling in `clinic-flow.html` M-01.

#### Task 2.5: New Patient form + create flow

**File:** `attender-app/src/screens/NewPatientScreen.js` (**NEW**)

Captures patient_name, age, sex, department (departments from `GET /api/departments`), runs client validation (AC9), calls `createVisit`, and on success navigates to `QuestionListScreen` with the new `visit.id`. On failure shows inline errors (400) or a retry banner (offline/5xx, AC10) while preserving entered fields.

### Part 3: Resume, navigation wiring & offline/retry (4 hours)

#### Task 3.1: Navigation routes

**File:** `attender-app/src/navigation/AppNavigator.js` (**Modify** — register `NewPatient`, `QuestionList`, and forward-declare `Recording` for CLINIC-004)

#### Task 3.2: Reload-on-focus for resume

**File:** `attender-app/src/screens/QuestionListScreen.js` (**Modify** — add `useFocusEffect(reload)`)

Re-fetches `GET /api/visits/:id` whenever the screen regains focus (e.g. returning from Recording, or re-opening a backgrounded in-progress visit), guaranteeing the resumed state and progress are fresh (AC6).

#### Task 3.3: Offline create guard + idempotent retry

**File:** `attender-app/src/utils/retry.js` (**NEW**)

Wraps `createVisit` with a single-flight guard so a double-tap or retry-after-timeout does not create two visits; surfaces a retry callback that preserves the in-memory patient payload (AC10).

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `backend/src/repositories/visitRepository.js` | **NEW** | ~70 lines |
| `backend/src/services/visitService.js` | **NEW** | ~110 lines |
| `backend/src/utils/visitValidation.js` | **NEW** | ~40 lines |
| `backend/src/controllers/visitController.js` | **NEW** | ~40 lines |
| `backend/src/routes/visitRoutes.js` | Modify — add POST `/`, GET `/:id` | +20 lines |
| `attender-app/src/services/visitApi.js` | **NEW** | ~60 lines |
| `attender-app/src/hooks/useQuestionList.js` | **NEW** | ~80 lines |
| `attender-app/src/screens/QuestionListScreen.js` | **NEW** | ~130 lines |
| `attender-app/src/screens/NewPatientScreen.js` | **NEW** | ~130 lines |
| `attender-app/src/components/QuestionRow.js` | **NEW** | ~70 lines |
| `attender-app/src/components/ProgressBar.js` | **NEW** | ~45 lines |
| `attender-app/src/components/SendToDoctorButton.js` | **NEW** | ~40 lines |
| `attender-app/src/components/PatientHeader.js` | **NEW** | ~45 lines |
| `attender-app/src/navigation/AppNavigator.js` | Modify — register routes | +25 lines |
| `attender-app/src/utils/retry.js` | **NEW** | ~35 lines |

**Backend & DB impact:** REAL. New `visits` insert/select repository + service + controller/route; relies on the `visits`, `question_templates`, `questions`, `answers` tables and seeds delivered by CLINIC-001/CLINIC-002 (no new tables introduced here). Audio upload, transcript writes, and visit-status sync are REAL but owned by CLINIC-004. **AI summary generation is out of scope (TEMPORARY MOCK elsewhere).** STT (Sarvam) is REAL-but-stubbable and not exercised by this screen.

---

## UI Test Setup

| Field | Value |
|-------|-------|
| **App URL** | Expo dev build / APK on Android emulator (e.g. Pixel API 34) — `attender-app` running via `expo start` (or installed APK); backend reachable at the emulator host (e.g. `http://10.0.2.2:3000`) |
| **Test Route** | Patient Question List screen (`QuestionListScreen`), reached via New Patient → Start Visit, or by opening an existing in-progress visit |
| **Login as** | Attender role — no real auth; the app sends `X-Role: attender` header on every `/api` call |
| **Test Data** | Seeded **General** department with an **active** `question_template` of 5 questions (CLINIC-002 seed); for resume test, a seeded visit in status `answering` with 2 of 5 `answers` populated; for empty-state test, a department with no active template |
| **Non-testable ACs** | AC1 (collision-free concurrency) — verify via backend integration/load test, not UI; AC5 (status → 'answering') — depends on CLINIC-004 answer POST, verify via API + DB; AC11 (role header) — inspect network request headers, not visible in UI; AC12 (derive from answers not status) — verify via crafted DB state + API, not directly visible |

---

## Pipeline Log

### Review — 2026-06-08 13:20 — Verdict: READY WITH NOTES

## Story Review: CLINIC-003 — Patient Intake & Question List

**Verdict:** READY WITH NOTES

---

### Dependencies

- **CLINIC-001**: IMPLEMENTED — Full backend scaffold confirmed. `backend/src/{controllers,services,repositories,routes,utils,config}` all exist. `POST /api/visits` and `GET /api/visits/:id` are registered in `backend/src/routes/index.js` lines 20 and 22. `pg_advisory_xact_lock` token assignment exists in `visitRepository.createWithToken` (lines 39–65).
- **CLINIC-002**: IMPLEMENTED — `mobile/src/screens/settings/QuestionSetupScreen.js`, `mobile/src/api/templates.api.js`, `mobile/src/hooks/useQuestionTemplate.js`, and `templateRepository.findActiveByDepartmentId` all exist. `question_templates` + `questions` tables and seeds are in place.

---

### Blockers

None — both hard dependencies are implemented and the backend endpoints this story consumes already exist. Development can start immediately, but the implementer must read the notes below before writing a single line of code.

---

### File plan (verified against codebase)

**BACKEND — corrected status:**

| Story says | Actual status | Correct action |
|---|---|---|
| `backend/src/repositories/visitRepository.js` — NEW | **ALREADY EXISTS** (67 lines, fully implemented with `createWithToken`, `findById`, `list`, `updateStatus`) | **SKIP** — do not recreate. |
| `backend/src/services/visitService.js` — NEW | **ALREADY EXISTS** (66 lines; has `create`, `getById`, `list`, `updateStatus`, `submit`, `maybeAdvance`) | **SKIP** — do not recreate. |
| `backend/src/controllers/visitController.js` — NEW | **ALREADY EXISTS** (29 lines; has `create`, `list`, `getById`, `updateStatus`, `submit`) | **SKIP** — do not recreate. |
| `backend/src/routes/visitRoutes.js` — Modify | **Does not exist as a standalone file.** Routes are inline in `backend/src/routes/index.js`. `POST /api/visits` (line 20) and `GET /api/visits/:id` (line 22) are already registered. | **SKIP** — routes exist. |
| `backend/src/utils/visitValidation.js` — NEW | **Does NOT exist** (only `questionValidation.js` exists) | **CREATE** — this is the one genuinely new backend file. |

**MOBILE — all paths must use `mobile/` not `attender-app/`:**

- CREATE: `mobile/src/services/visitApi.js`
- CREATE: `mobile/src/hooks/useQuestionList.js`
- CREATE: `mobile/src/screens/NewPatientScreen.js`
- CREATE: `mobile/src/screens/QuestionListScreen.js`
- CREATE: `mobile/src/components/IntakeQuestionRow.js` (**renamed** — see risks)
- CREATE: `mobile/src/components/ProgressBar.js`
- CREATE: `mobile/src/components/SendToDoctorButton.js`
- CREATE: `mobile/src/components/PatientHeader.js`
- CREATE: `mobile/src/utils/retry.js`
- MODIFY: `mobile/App.js` — introduce a root navigator (currently hardwires `SettingsStack` directly; no `AppNavigator.js` exists)
- CREATE: `mobile/src/navigation/AppNavigator.js` — the story says "Modify" but this file does not exist; it must be created, then `App.js` updated to import it
- DO NOT TOUCH: `mobile/src/components/QuestionRow.js` (owned by CLINIC-002 / QuestionSetupScreen)
- DO NOT TOUCH: `mobile/src/navigation/SettingsStack.js` (owned by CLINIC-002)

---

### Reference drift

- **Story throughout** references `attender-app/src/…` → **drifted**: the mobile directory is `mobile/`. Every path in the File Summary table and all task descriptions must be read with `mobile/` substituted for `attender-app/`.
- **Task 1.1 / File Summary** marks `visitRepository.js`, `visitService.js`, `visitController.js` as NEW → **drifted**: all three already exist and are fully implemented. The story's pseudocode in Tasks 1.1–1.3 describes the actual implementation accurately (token lock key `20240001`, `pg_advisory_xact_lock`, advisory lock scope), confirming intent matches reality.
- **Task 1.3 describes `getVisitDetail` returning** `{ visit, template, questions, answers }` with a top-level `questions` key → **drifted**: the real `visitService.getById` returns `{ visit, template, answers, summary }`. Questions are embedded inside `template.questions` (set by `templateRepository.findActiveByDepartmentId`). The `useQuestionList` hook must read `data.template?.questions ?? []`, not `data.questions`.
- **Task 1.2 token query** uses `created_at::date = CURRENT_DATE` → **drifted (minor)**: actual implementation uses a dedicated `visit_date` column (`WHERE visit_date = CURRENT_DATE`). The AC is satisfied; only the code snippet in the story is slightly off.
- **UI Test Setup — App URL** lists port `3000` → the existing `mobile/src/api/client.js` defaults to port `4000` (`http://10.0.2.2:4000/api`). Implementer should match the port the backend actually binds (check `backend/src/config/index.js` or `.env`).
- **Task 3.1** says "Modify `attender-app/src/navigation/AppNavigator.js`" → **drifted**: `AppNavigator.js` does not exist. `App.js` is the correct file to modify, and `AppNavigator.js` must be created fresh.

---

### Acceptance criteria notes

- **Unit-testable (pure logic, no running app):** AC3 (progress math), AC4 (gate logic), AC9 (client-side field validation), AC12 (answers-not-status derivation in `useQuestionList`)
- **Needs running app (Expo + backend):** AC2 (question list loads), AC6 (resume in-progress), AC7 (navigation to recording screen), AC8 (empty state for missing template), AC10 (offline/retry banner)
- **Manual / network-tab / DB-only:** AC1 (token collision — requires concurrent load test), AC5 (status → 'answering' — triggered by CLINIC-004 answer POST, not this screen), AC11 (role header — inspect axios request in Expo debugger)

All ACs are testable as written. AC5 is correctly flagged as out-of-scope for this screen; it is satisfied automatically by `visitService.maybeAdvance` which is already wired into `answerService` (CLINIC-004's concern).

---

### Risks & notes for the implementer

1. **`mobile/src/components/QuestionRow.js` name collision (HIGH).** A `QuestionRow` component already exists at that path — it is the drag-handle editor row for the CLINIC-002 settings screen. If the implementer creates a new `QuestionRow.js` at the same path it will overwrite the CLINIC-002 component and break `QuestionSetupScreen`. Name the new component `IntakeQuestionRow.js` (or `VisitQuestionRow.js`) and place it at `mobile/src/components/IntakeQuestionRow.js`. Import it by that name in `QuestionListScreen`.

2. **`GET /api/visits/:id` response shape mismatch (HIGH).** `visitService.getById` returns `{ visit, template, answers, summary }` where `template` is `{ ...template_row, questions: [...] }`. The story's `useQuestionList` pseudocode reads `data.questions` — that key does not exist. The hook must be written as: `const questions = data?.template?.questions ?? [];` and `const answers = data?.answers ?? [];`. When `template` is null (AC8 empty state), `questions` correctly becomes `[]`.

3. **`App.js` must be modified — no `AppNavigator.js` exists.** The current `App.js` renders `<SettingsStack />` directly inside `<NavigationContainer>`. To add the intake flow, the implementer must create `mobile/src/navigation/AppNavigator.js` (a tab or stack navigator containing both `SettingsStack` and the new intake screens) and update `App.js` to render `<AppNavigator />` instead. This is a structural change to the app entry point — plan for it.

4. **`visitApi.js` must use axios, not raw `fetch`.** The project already has `mobile/src/api/client.js` — an axios instance with `x-role: attender` header and base URL pre-configured. The story's pseudocode uses `fetch`; the implementer must instead export functions that call `apiClient.post('/visits', body)` and `apiClient.get(\`/visits/${id}\`)` from the existing `client.js`. This satisfies AC11 automatically (header is set on the shared client).

5. **`visitValidation.js` on the backend is the only genuinely new backend file.** The story allocates significant implementation time (Tasks 1.1–1.5, 5 hours) to backend work that is already done. That time should be reallocated to mobile work (navigation restructuring, component naming, `useQuestionList` shape fix).

6. **`visitService.create` has minimal validation** (only checks `patientName` and `departmentId` are truthy — no age range, no sex enum check). `visitValidation.js` should add the full checks described in Task 1.4 (age 0–120, sex in `['M','F','O']`) and be called from `visitService.create`, replacing the inline guard on lines 10–13.

7. **`roleGuard` is applied globally** (`router.use(roleGuard)` at line 15 of `routes/index.js`) — `GET /api/visits/:id` already requires a role header. The story's AC11 is implicitly enforced server-side; no extra wiring needed.

8. **`visit_date` column dependency.** `visitRepository.createWithToken` inserts `visit_date = CURRENT_DATE`. Verify the migration for the `visits` table includes this column; if CLINIC-001 was implemented without it the INSERT will fail. Check `db/migrations/` before testing token assignment.

9. **`react-native-gesture-handler` and `react-native-screens` are already in `package.json`** — no new dependencies needed for navigation. However the AGENTS.md note in `mobile/` explicitly warns to read Expo v56 docs before writing code (`https://docs.expo.dev/versions/v56.0.0/`). Verify `@react-navigation` API against that version before coding the new navigator — navigation APIs changed between v6 and v7 (the project already uses v7: `@react-navigation/native-stack ^7.x`).

10. **`useFocusEffect` reload (Task 3.2)** is critical for the resume AC (AC6) and for reflecting a newly saved answer when returning from the CLINIC-004 recording screen. It should be included in the initial `QuestionListScreen` build, not treated as a follow-up modification.

---

## Pipeline Log

### Implementation — 2026-06-08 13:44

## Implementation Report: CLINIC-003

### Files created
- `backend/src/utils/visitValidation.js` — validates new-visit input (patientName required, departmentId required, age 0–120, sex M/F/O); throws AppError(VALIDATION_ERROR, 400) with per-field errors object (~38 lines)
- `mobile/src/api/visitApi.js` — axios wrappers for POST /visits (createVisit) and GET /visits/:id (getVisitDetail); uses shared apiClient from client.js (~28 lines)
- `mobile/src/utils/retry.js` — withSingleFlight HOF: concurrent callers share one in-flight promise, resets after settle (~30 lines)
- `mobile/src/navigation/AppNavigator.js` — root native stack navigator; registers Settings (SettingsStack), NewPatient, QuestionList, and null placeholders for Recording (CLINIC-004) and Review (CLINIC-005); initial route is Settings (~55 lines)
- `mobile/src/hooks/useQuestionList.js` — fetches getVisitDetail, derives per-question view model; questions read from data.template.questions (not data.questions); progress derived from answers array not visit.status (AC12); includes useFocusEffect reload (~68 lines)
- `mobile/src/components/IntakeQuestionRow.js` — intake question row with numbered/checkmark badge, question text, transcript preview (60-char truncation), Record button / Done chip; navy+teal styling matching clinic-flow.html M-01 (~80 lines)
- `mobile/src/components/ProgressBar.js` — "X of N answered · Y%" label and filled track; switches to "✓ Complete" when fully answered (~38 lines)
- `mobile/src/components/PatientHeader.js` — patient name + Token badge on navy background (~35 lines)
- `mobile/src/components/SendToDoctorButton.js` — teal button, dimmed+non-interactive when disabled, shows "Answer all questions to continue" helper text (AC4) (~42 lines)
- `mobile/src/screens/QuestionListScreen.js` — presentational intake screen; ActivityIndicator loading, error+Retry, empty-state (no template, AC8), PatientHeader+ProgressBar+FlatList+SendToDoctorButton; navigates to Recording/Review (~120 lines)
- `mobile/src/screens/NewPatientScreen.js` — new patient form (name, age, sex, department picker); client-side validation before API call (AC9); createVisit wrapped with withSingleFlight (AC10); navigate to QuestionList on success with visitId; retry banner on network/5xx preserving field values (~138 lines)

### Files modified
- `backend/src/services/visitService.js` — replaced inline `if (!patientName || !departmentId)` guard in `create()` with `validateNewVisit()` call; added require for visitValidation at top
- `mobile/App.js` — replaced `SettingsStack` import and usage with `AppNavigator`; NavigationContainer and GestureHandlerRootView unchanged

### Contracts preserved
- `mobile/src/components/QuestionRow.js` — not touched (CLINIC-002 owned)
- `mobile/src/navigation/SettingsStack.js` — not touched (CLINIC-002 owned)
- `backend/src/repositories/visitRepository.js` — not touched (exists from CLINIC-001)
- `backend/src/controllers/visitController.js` — not touched (exists from CLINIC-001)
- `backend/src/routes/index.js` — not touched (routes already registered from CLINIC-001)
- GET /api/visits/:id response shape: hook reads `data.template.questions` and `data.answers` verbatim as confirmed by visitService.getById
- visitController.create returns the visit row directly (not wrapped); NewPatientScreen reads `visit.id` for navigation

### Deviations from the story
- Story task descriptions reference `attender-app/src/…` paths — all files placed under `mobile/src/…` per reviewer correction
- Story pseudocode for `useQuestionList` reads `data.questions` — corrected to `data.template?.questions ?? []` per reviewer note (HIGH risk item 2)
- `AppNavigator.js` created as a new file (story said "Modify") and `App.js` updated to import it, per reviewer note (risk item 3)
- Story Task 2.1 pseudocode uses raw `fetch` — implemented with axios `apiClient` per reviewer note (risk item 4)
- Backend Tasks 1.1–1.3, 1.5 skipped — visitRepository, visitService, visitController, routes all already exist from CLINIC-001 per reviewer file plan
- `visitApi.js` placed at `mobile/src/api/visitApi.js` (not `mobile/src/services/visitApi.js`) to match the project's existing api/ convention (client.js and templates.api.js live there)

### Build/typecheck status
- No TypeScript in this project (plain JS + Expo); no build command available without a running emulator
- All imports verified by cross-checking exported names against source files: `apiClient` from client.js, `SettingsStack` from SettingsStack.js, `getDepartments` from templates.api.js
- `@react-navigation/native-stack ^7.16.0` confirmed in package.json; `createNativeStackNavigator` API used consistently with existing SettingsStack.js pattern

### Notes for the tester
- Backend: `USE_MOCK_STT=true USE_MOCK_SUMMARY=true` for offline demo; backend binds port 4000 (mobile client.js default)
- Mobile: `cd mobile && expo start --android`; emulator host is `http://10.0.2.2:4000/api` (default in client.js)
- App starts on Settings screen (CLINIC-002 unchanged); tap Android back or add a "New Patient" entry point to reach NewPatientScreen
- AC1 (token collision) requires a concurrent load test against the backend — not testable via UI
- AC5 (status → answering) is triggered by CLINIC-004 answer POST — not exercised by this screen
- AC11 (x-role header) is set on the shared axios instance in client.js — inspect via Expo network debugger
- Recording and Review screens are null placeholders; navigation will succeed but render a blank screen until CLINIC-004/005 are implemented

### Security Audit — 2026-06-08 13:52 — Verdict: FINDINGS (0 critical/high)

## Security Audit: CLINIC-003

**Verdict:** FINDINGS

### Critical / High
- None.

### Medium / Low
- [backend/src/controllers/visitController.js:14-16 + backend/src/repositories/visitRepository.js:12-14] (Medium) [A04 Insecure Design / STRIDE: Information disclosure] `GET /api/visits/:id` passes `req.params.id` straight to `SELECT * FROM visits WHERE id = $1` with no type/format check. SQL injection is NOT possible (parameterized $1), but if the `visits.id` column is an integer/uuid type, a non-conforming `:id` (e.g. `/api/visits/abc`) makes Postgres raise a type-cast error that flows to the generic error handler. `errorHandler` (utils/errors.js:9-13) returns `err.message` verbatim with HTTP 500 — leaking raw Postgres error text (column types, internal phrasing) to the client. Fix: validate/coerce `id` in the controller or service (reject non-matching with a 400 `VALIDATION_ERROR`) and ensure the error handler does not echo raw driver messages for 500s. (PARTIALLY PRE-EXISTING: repo/controller predate this story, but this story is the first to wire the mobile client to exercise this path.)
- [backend/src/utils/visitValidation.js:15-17 + backend/src/repositories/visitRepository.js:53-56] (Medium) [A04 Insecure Design / STRIDE: Tampering] `departmentId` is only checked for `!= null` in validation; it is never verified to be an integer or to reference an existing department. A client can POST `departmentId: "1; whatever"` (string) or a non-existent id. SQL is parameterized so no injection, but a non-existent FK either throws a raw Postgres FK-violation 500 (info disclosure via the same error-handler path) or, if no FK constraint exists, creates an orphan visit. Fix: coerce `departmentId` to an integer and reject non-integers with 400; rely on a DB FK constraint plus a friendly mapped error for missing departments.
- [mobile/src/utils/retry.js:14-27 + mobile/src/screens/NewPatientScreen.js:27,80] (Medium) [A04 Insecure Design — duplicate-resource / STRIDE: Tampering] `withSingleFlight` only de-dupes *concurrent* calls — it nulls `inFlight` as soon as the promise settles. The retry banner (NewPatientScreen.js:102 calls `handleSubmit` again) fires *after* the first call has settled (failed), so the guard provides no protection against the exact AC10 scenario it was written for: a create that times out at the client (10s axios timeout, client.js:11) but *succeeds* server-side, then is retried, yields a SECOND visit and a duplicate token. True idempotency needs a client-generated idempotency key sent to the backend and de-duped there. Fix: generate a UUID per form submission, send it as an idempotency key, and have the backend return the existing visit on replay. (Note: this is a data-integrity/UX bug as much as a security one; flagging because it defeats the stated duplicate-prevention control.)
- [backend/src/utils/roleGuard.js:5-10 + mobile/src/api/client.js:9] (Low) [A01 Broken Access Control / A07 Identification & Auth Failures / STRIDE: Spoofing + Elevation of privilege] Authorization is a self-asserted `x-role` header with no authentication behind it. `GET /api/visits/:id` and `POST /api/visits` are reachable by anyone who sends `x-role: attender` or `x-role: doctor`; patient PII (name, age, sex, transcripts) is exposed to any unauthenticated caller on the network. This is the documented POC auth model (CLAUDE.md / AC11), so it is accepted-by-design for this phase — but it must be tracked as a hard blocker before any real-patient / production use. No fix required this story; do NOT ship this auth model to production.
- [mobile/src/screens/QuestionListScreen.js:44 / NewPatientScreen.js:85] (Low) [A09 Logging/Monitoring — minor] Error rendering reads `error?.response?.data?.error?.message` and falls back to `error.message`. Safe (no raw HTML injection — React Native `<Text>` does not interpret markup), but surfacing backend `message` strings directly to the UI can echo the raw Postgres text described above once it reaches the client. Mitigated entirely by fixing the two backend items. No standalone fix needed.

### Reviewed and acceptable
- [backend/src/repositories/visitRepository.js:3-65] All visit SQL (`create`, `createWithToken`, `findById`, `list`, `updateStatus`) uses parameterized queries (`$1..$5`, `ANY($1::visit_status[])`). No string concatenation into SQL anywhere in the diff. No injection path. The `pg_advisory_xact_lock` + `MAX(token_number)+1` token allocation is concurrency-safe (server-side serialization).
- [mobile/src/components/IntakeQuestionRow.js:31-33, PatientHeader.js:13-15] Attacker-influenceable text (patient_name, question_text, transcript) is rendered via React Native `<Text>` children, which do not interpret HTML/markup. No `dangerouslySetInnerHTML` / `innerHTML` equivalent exists in RN. Transcript is length-clamped to 60 chars. No XSS path.
- [mobile/src/api/client.js:1-12] No hardcoded secrets/API keys. Base URL is an emulator-loopback default (`10.0.2.2:4000`) overridable via `EXPO_PUBLIC_API_URL`; not a baked-in production host or credential. Sarvam/AI keys live server-side only (CLAUDE.md), not in the mobile build.
- [mobile/App.js, AppNavigator.js] Navigation wiring only; Recording/Review are `() => null` placeholders. No new entry point handling untrusted input. No deep-link / URL-param surface added.
- [mobile/src/hooks/useQuestionList.js:43-60] Consumes API JSON with safe optional-chaining/defaults (`data?.template?.questions ?? []`); no unvalidated shape assumption that could crash on hostile payloads. Progress math is division-guarded (`total > 0`).
- No new third-party dependencies introduced by this story (uses existing axios, @react-navigation, @react-native-picker). No dependency-supply-chain risk added.

### Pre-existing (not introduced by this story)
- The `x-role` no-auth model and the raw-error-message passthrough in `errorHandler` predate CLINIC-003. They are listed above because this story is the first to expose the visit-detail/PII path to the mobile client and so newly activates that attack surface — track, do not necessarily fix within this story.

---

### Test — Round 1 — 2026-06-08 15:10 — PASS

## Test Report: CLINIC-003

**Overall:** PASS

### Per-AC results
- AC1: NOT AUTOMATED — run a concurrent load test (e.g. 10 simultaneous POST /api/visits) against the backend and verify no two rows share the same token_number for the same visit_date.
- AC2: NOT AUTOMATED — open a visit on the running Expo app; verify the question list renders in order_index order with answered/pending state per the seed data.
- AC3: PASS
- AC4: PASS
- AC5: NOT AUTOMATED — triggered by CLINIC-004 POST /api/visits/:id/answers; verify via DB query after first answer is saved that visit.status = 'answering'.
- AC6: NOT AUTOMATED — with a seeded visit in status 'answering' with 2 of 5 answers, reopen the visit on the running app and verify "2 of 5 answered · 40%" and prior transcripts are shown.
- AC7: NOT AUTOMATED — tap a pending question's Record affordance on the running app and confirm navigation to the recording screen (CLINIC-004 placeholder).
- AC8: NOT AUTOMATED — open a visit whose department has no active template on the running app; verify the empty-state message is shown and Send to Doctor is hidden/disabled.
- AC9: PASS
- AC10: NOT AUTOMATED — disable the network on the device/emulator, tap Start Visit, verify a retry banner appears and field values are preserved; tap Retry and verify no duplicate visit is created.
- AC11: NOT AUTOMATED — in the Expo network debugger (or Charles Proxy), confirm every /api call from this screen includes the header X-Role: attender.
- AC12: PASS

### Test files written
- `D:\Projects\Clinic POC\clinic-poc\backend\src\__tests__\visitValidation.test.js` — covers AC9 (server-side validation: blank name, missing dept, age out of range, invalid sex, error shape/httpStatus/code, multi-field errors)
- `D:\Projects\Clinic POC\clinic-poc\__tests__\clinic003-progress-and-gate.test.js` — covers AC3 (progress math: answeredCount, percent, allAnswered across 0/partial/full/rounding), AC4 (SendToDoctorButton disabled=!allAnswered logic), AC9 (client-side validate() closure from NewPatientScreen), AC12 (progress from answers array not visit.status, wrong data.questions path is safely ignored, duplicate answer deduplication)

### Failures
None.

### Suite output summary
- Backend: 21 passed, 0 failed — `cd backend && npx jest --no-coverage`
- Root (mobile pure logic): 36 passed, 0 failed — `cd . && npx jest --no-coverage`
- Total: 57 passed, 0 failed
