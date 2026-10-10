# User Story: Tests Before Consultation — doctor sends a waiting patient for tests, patient returns later

**Story ID:** CLINIC-014
**Epic:** Doctor Review
**Feature:** While a patient waits in the queue, the doctor reads their AI summary and writes a note such as "Do CBC, ECG and come back". The attender is alerted, the patient goes for the tests, and when they come back (usually the next day) with results, the attender uploads them and puts the patient back in that day's queue.
**Priority:** P1 (High)
**Effort:** 4 days (32 hours)
**Who:** 👨‍💻 **Senior** (status, migration, re-queue, summary regeneration) · 🧑‍🎓 **Junior** (alert, lists, buttons) — see each sub-story
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development (after CLINIC-008 and CLINIC-011)
**Depends On:** CLINIC-008 (doctor/attender roles, clinic scoping), CLINIC-011 (uploading the test results as reports), CLINIC-015 (date-based queue)
**Migration number reserved:** `009_tests_requested.sql`

---

## Story Overview

**As a** doctor
**I want** to send a waiting patient for tests before I see them
**So that** when they come in, I already have the results and the consultation is useful

**As an** attender (the clinic's front office)
**I want** to be alerted when the doctor asks for tests, and to put the patient back in the queue when they return
**So that** the patient knows what to do and doesn't wait for nothing

**As a** patient
**I want** to do my tests first and see the doctor once
**So that** I don't wait hours only to be told to come back with tests

---

## Why This Feature?

### Current Gap
- The doctor can only read a summary and mark a visit `done`. There is no way to send a waiting patient for tests.
- The status engine (`backend/src/services/statusEngine.js`) only allows `waiting → answering → answered → summarised → done`. A visit can't leave the queue and come back.

### Real-World Use Case (from the manager)
It's 11 am. Dr. Ramesh is with his 3rd patient. In a short break he opens the summary of **Token 20**, who is still waiting: chest tightness on exertion, diabetic, smoker. He writes: *"Do ECG, lipid profile and HbA1c, and come back."* Priya, the attender, sees the alert on the clinic phone, explains it to the patient, and he leaves for the lab instead of waiting two more hours.
The **next day** he returns with the results. Priya finds him under **Waiting for tests**, photographs the reports, and taps **Back in queue**. He gets a token at the end of today's queue (FIFO). When he goes in, Dr. Ramesh sees yesterday's answers, his own note, and the new results together.

---

## Detailed Sub-Stories

### Sub-Story 1: Doctor requests tests (with a note)
**Story ID:** CLINIC-014.1 | **Effort:** 1 day | **Who:** 👨‍💻 Senior (API + status) · 🧑‍🎓 Junior (doctor web button + note)
```gherkin
As a doctor
I want a "Send for tests" action with a note on a waiting patient's summary
So that the patient can do the tests before seeing me
```

### Sub-Story 2: Attender alert
**Story ID:** CLINIC-014.2 | **Effort:** 1 day | **Who:** 🧑‍🎓 Junior
```gherkin
As the attender
I want a clear alert on the clinic phone when the doctor requests tests
So that I can tell the patient before they keep waiting
```

### Sub-Story 3: Patient returns — upload results and re-queue
**Story ID:** CLINIC-014.3 | **Effort:** 1.5 days | **Who:** 👨‍💻 Senior (re-queue logic) · 🧑‍🎓 Junior (mobile screens)
```gherkin
As the attender
I want to find a returning patient, upload their results and put them back in today's queue
So that the doctor sees them with the results
```

### Sub-Story 4: Doctor sees the full history
**Story ID:** CLINIC-014.4 | **Effort:** 0.5 day | **Who:** 🧑‍🎓 Junior
```gherkin
As a doctor
I want to see my earlier note and the new results together with the original answers
So that I don't have to ask the patient to repeat anything
```

---

## Acceptance Criteria

### AC1: Doctor sends a patient for tests
```gherkin
GIVEN a visit in 'summarised' (patient waiting, summary ready)
WHEN the doctor taps "Send for tests", writes a note and confirms
THEN the visit moves to 'tests_requested'
AND the note, the doctor and the time are saved
AND the visit leaves today's waiting queue and appears under "Waiting for tests"
WHEN the note is empty
THEN the action is rejected (a note is required so the patient knows which tests)
```

### AC2: Attender is alerted
```gherkin
GIVEN the attender app is open on the clinic phone
WHEN the doctor sends Token 20 for tests
THEN within about 10 seconds the attender sees an alert: "Dr. Ramesh requested tests for Token 20 – <patient name>" with the note
AND the alert stays visible until the attender taps "Informed patient"
```

### AC3: Returning patient goes to the end of that day's queue
```gherkin
GIVEN a visit in 'tests_requested' (from any earlier day)
WHEN the patient returns and the attender taps "Back in queue"
THEN the visit appears in TODAY's queue with a new token at the end (FIFO)
AND the original visit date, answers, summary and doctor note are kept
```

### AC4: Results are uploaded and included in the summary
```gherkin
GIVEN a returning patient
WHEN the attender uploads the test results (as reports, CLINIC-011) and taps "Back in queue"
THEN the AI summary is regenerated to include the new results (subject to CLINIC-016's dispute rules)
AND if no results were uploaded, the attender is warned but can still re-queue
```

### AC5: Doctor sees everything in one place
```gherkin
GIVEN a returned patient in today's queue
WHEN the doctor opens them
THEN the screen shows: a "Returned with test results" badge, the doctor's earlier note,
     the new results, the updated summary and the original answers
```

### AC6: Status rules
```gherkin
THEN only these new transitions are allowed:
     summarised → tests_requested (doctor only)
     tests_requested → summarised (attender "Back in queue")
AND every other transition into or out of tests_requested returns 409 INVALID_TRANSITION
AND the mobile app and doctor web status displays include the new status
```

---

## Technical Implementation

**Database** — `db/migrations/009_tests_requested.sql` **(NEW)**:
- `ALTER TYPE visit_status ADD VALUE IF NOT EXISTS 'tests_requested'`. ⚠️ PostgreSQL can't **use** a new enum value in the same transaction that adds it, and the migration runner wraps each file in a transaction — keep this migration to the `ALTER TYPE` alone, and put any data changes that use the value in a later file.
- New table `visit_test_requests (id, visit_id → visits ON DELETE CASCADE, note TEXT NOT NULL, requested_by → users, requested_at, acknowledged_at, returned_at)` — keeps history if a patient is sent for tests more than once.
- For re-queueing: add `visits.queue_date DATE` and `visits.queue_token INT` (defaulting to `visit_date` / `token_number` for existing rows), so a returning patient gets a new place in today's queue **without** changing the original `visit_date`. Coordinate with CLINIC-015, which orders the queue by these columns. Unique index on `(clinic_id, queue_date, queue_token)`.

**Backend**
- `statusEngine.js` — add the two transitions (AC6); update `__tests__`.
- `POST /api/visits/:id/test-request` (doctor) — validate note, transition, insert request.
- `POST /api/test-requests/:id/acknowledge` (attender) — "Informed patient".
- `POST /api/visits/:id/requeue` (attender) — assign the next `queue_token` for today (per-clinic lock, like `createWithToken`), set `returned_at`, transition back to `summarised`, and regenerate the summary to include new reports.
- `GET /api/visits?status=tests_requested` serves the "Waiting for tests" list.

**Mobile** — alert banner on Home (driven by the existing polling of `/visits`, no push service needed for the POC); a **Waiting for tests** section; **Back in queue** with an "Add results" step that reuses CLINIC-011's upload.

**Doctor web** — "Send for tests" button + note dialog on the summary card; "Returned with test results" badge; earlier note shown above the summary.

**Status mirrors** — update `frontend/src/utils/statusMap.js` and the mobile status display (see `CLAUDE.md`: both apps mirror the status engine).

---

## Open Points

- Push notifications (alert when the app is closed) are **not** in this story; the alert works while the app is open. Add later if needed.
- If a patient never returns, the visit stays in "Waiting for tests". A cleanup rule (e.g. hide after 7 days) can be decided during the trial.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Verify** | Doctor sends Token 20 for tests (AC1); attender sees the alert (AC2); next day (or change `queue_date` in the DB to simulate), re-queue with a result photo (AC3, AC4); doctor view shows note + results (AC5); invalid transitions return 409 (AC6) |
| **Unit tests** | `cd backend && npm test` — status engine transitions |
