# User Story: Trial Testing Fixes — report viewer, Back in queue, test results, tokens

**Story ID:** CLINIC-017
**Epic:** Trial Readiness
**Feature:** Fix the issues found while testing CLINIC-011 (report photos) and CLINIC-014 (tests before consultation) on production on 12–13 Oct 2026.
**Priority:** P1 (High)
**Effort:** 1.5 days (12 hours)
**Who:** 🧑‍🎓 **Junior** · 👨‍💻 Senior reviews the PR
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development
**Depends On:** CLINIC-011, CLINIC-014 (both in master). **No migration.**

> **Out of scope (handled elsewhere):**
> - Wrong patient's panel shown after switching patients on the doctor web (CR-003) — senior fix, separate PR.
> - Answers can be retaken after submit (CR-004) — PR #26 (CLINIC-009).
> - Phone thumbnails showing a red "!" — PR #28.

---

## Story Overview

**As a** doctor and an attender
**I want** the report viewer, the "Back from tests" screen and the waiting list to behave the way we expect
**So that** reports are fully readable, test results are clearly separate from intake reports, and nobody confuses two patients with the same token

---

## Why This Story?

During production testing with sample patients (Kumar, Ravi) we found five smaller problems. Each is recorded in the local findings tracker with its ID:

| ID | Where | Problem |
|---|---|---|
| CR-001 | Doctor web — report viewer | A tall report photo opens at full width, so on a laptop the doctor can't see the whole page without scrolling. |
| CR-002 | Doctor web — report viewer | The viewer background is see-through: the dashboard header shows behind the viewer's top bar. |
| CR-005 | App — Back from tests | "Back in queue" can be tapped while a result photo is still uploading; the attender then gets "No test results uploaded" although a photo was added (seen with Ravi: upload finished at 09:54:50, requeue at 09:54:52). |
| CR-006 | App — Back from tests | "Test results" lists **all** the visit's photos, including the intake reports from before the doctor's request, and each has a remove (×) button. Kumar showed "Test results (2)" before any result was added. |
| CR-007 | App Home + doctor web queue | A patient waiting for tests keeps the token of the day he was queued, so "Token 1 — Ravi (12 Oct)" and "Token 1 — Kumar (13 Oct)" appear side by side with no date. |

---

## Detailed Sub-Stories

### Sub-Story 1: Report viewer fits the screen (CR-001, CR-002)
**Story ID:** CLINIC-017.1 | **Effort:** 0.5 day | **Who:** 🧑‍🎓 Junior | **App:** Doctor web
```gherkin
As a doctor
I want a report photo to open showing the whole page
So that I can read it without scrolling, and zoom in only when I need to
```

### Sub-Story 2: Back in queue waits for photo uploads (CR-005)
**Story ID:** CLINIC-017.2 | **Effort:** 0.25 day | **Who:** 🧑‍🎓 Junior | **App:** Attender app
```gherkin
As an attender
I want Back in queue to wait until my result photos are uploaded
So that I am not warned about missing results I just added
```

### Sub-Story 3: Test results show only the results (CR-006)
**Story ID:** CLINIC-017.3 | **Effort:** 0.5 day | **Who:** 🧑‍🎓 Junior | **App:** Attender app
```gherkin
As an attender
I want "Test results" to show only photos added after the doctor's request
So that I know what I have uploaded, and can't delete the patient's intake reports by mistake
```

### Sub-Story 4: Show the date with an old token (CR-007)
**Story ID:** CLINIC-017.4 | **Effort:** 0.25 day | **Who:** 🧑‍🎓 Junior | **App:** Attender app + doctor web
```gherkin
As an attender and a doctor
I want a patient waiting for tests to show which day his token is from
So that two patients with "Token 1" are never confused
```

---

## Acceptance Criteria

### AC1: Viewer opens "fit to screen" (CR-001)
```gherkin
GIVEN a tall (portrait) or wide report photo
WHEN the doctor opens it in the viewer on a laptop (e.g. 1366×768 or 1920×1080)
THEN the whole photo is visible without scrolling
AND "+" zooms in (the photo can then be scrolled/panned), "−" zooms back out, "Reset" returns to fit-to-screen
AND Ctrl + mouse wheel still zooms, Esc / ✕ still closes, Previous / Next still work
AND on a phone-width screen the photo also fits the screen
```

### AC2: Viewer background is solid (CR-002)
```gherkin
WHEN the viewer is open
THEN nothing from the dashboard (header, clinic name, Logout) shows through the viewer
```

### AC3: Back in queue is blocked during an upload (CR-005)
```gherkin
GIVEN the attender is on Back from tests and a photo is uploading (spinner in the Test results card)
THEN the Back in queue button is disabled (greyed)
WHEN the upload finishes
THEN Back in queue is enabled again
AND tapping it with at least one result photo goes straight back to the queue — no warning
```

### AC4: Test results = photos added after the request (CR-006)
```gherkin
GIVEN Kumar has 2 intake photos and is sent for tests
WHEN the attender opens Back from tests
THEN "Test results" shows "No results added yet" (count 0), not the 2 intake photos
AND the intake photos are either hidden or shown separately under "Intake reports" WITHOUT a remove (×) button
WHEN the attender adds 1 result photo
THEN "Test results (1)" shows only that photo, with its × button
AND the doctor web still shows all 3 photos under "Previous reports"
```

### AC5: Old token shows its date (CR-007)
```gherkin
GIVEN Ravi was queued on 12 Oct as Token 1 and is now waiting for tests on 13 Oct
THEN in the "Waiting for tests" group (app Home and doctor web queue) Ravi shows "Token 1 · 12 Oct"
AND patients in today's group still show just their token
AND when Ravi comes back he gets today's token at the end of the queue (unchanged behaviour)
```

---

## Technical Implementation

**CLINIC-017.1 — Doctor web viewer** (`frontend/src/components/ReportsList.jsx`, `frontend/src/assets/doctor.css`)
- Today the image width is `zoom × 100%` of the stage (`.rv-img`, `style={{ width: ... }}`), so zoom 1 = full width.
- At zoom 1, show the image with `max-width: 100%; max-height: 100%` of the stage (`.rv-stage` already has `flex: 1; min-height: 0`), centred. Only above zoom 1 switch to a width-based size so it can be panned.
- `.rv-overlay` background: use an opaque colour (e.g. `#0a1422`) instead of `rgba(10, 20, 34, 0.92)`.
- Check with both sample reports (`SAMPLE-report-1-blood-test.png`, `SAMPLE-report-2-lipid-ecg.png`) and a photo taken with the phone.

**CLINIC-017.2 — Back in queue waits** (`mobile/src/screens/BackInQueueScreen.js`, `mobile/src/components/ReportsSection.js`, `mobile/src/hooks/useReports.js`)
- `useReports` already has a `busy` flag. Let `ReportsSection` report it to its parent (e.g. an `onBusyChange(busy)` prop called from an effect), keep it in BackInQueueScreen state, and add it to the button's `disabled` condition.
- Also disable the button while `countResults()` is running, so a double tap can't send two requeues.

**CLINIC-017.3 — Test results only** (`mobile/src/screens/BackInQueueScreen.js`, `mobile/src/components/ReportsSection.js`)
- BackInQueueScreen already knows the request time (`latest.requested_at`) and already filters by it in `countResults`. Pass a filter (e.g. `since={latest.requested_at}`) to `ReportsSection` so the list and the count show only photos with `created_at >= since`.
- Intake photos: simplest is not to show them on this screen. If you show them, put them in a separate read-only strip (no ×).
- Note for review: the server still allows the attender to delete any photo while the patient is away for tests (`statusEngine.canEditReports`). Locking intake photos on the server too is a backend change — leave it out of this PR; the senior will decide.

**CLINIC-017.4 — Token date** (`mobile/src/screens/HomeScreen.js`, `frontend/src/components/QueueRail.jsx`)
- Both already group by `utils/queue.js` (`TESTS_GROUP`). In the Waiting for tests group, when `queue_date` is not today, render the token with a short date: `Token 1 · 12 Oct` (reuse each file's existing `shortDate` helper).
- Keep `frontend/src/utils/queue.js` and `mobile/src/utils/queue.js` in step if you add a helper.

**Tests**
- No backend change, so no new jest tests are required. If you extract a pure helper (e.g. "photos added since"), add a small test in the style of the existing pure-logic tests.

---

## File Summary

| File | Action |
|------|--------|
| `frontend/src/components/ReportsList.jsx` | MODIFY — fit-to-screen at zoom 1 |
| `frontend/src/assets/doctor.css` | MODIFY — `.rv-img` sizing, opaque `.rv-overlay` |
| `mobile/src/screens/BackInQueueScreen.js` | MODIFY — disable while uploading / counting; pass `since` |
| `mobile/src/components/ReportsSection.js` | MODIFY — `onBusyChange`, optional `since` filter |
| `mobile/src/hooks/useReports.js` | MODIFY only if needed for the filter |
| `mobile/src/screens/HomeScreen.js` | MODIFY — token + date in Waiting for tests |
| `frontend/src/components/QueueRail.jsx` | MODIFY — token + date in Waiting for tests |

---

## Test Setup

| Item | Value |
|---|---|
| **Branch** | `feature/clinic-017` from `master` (after PR #26 and PR #28 are merged) |
| **Run** | Local backend + doctor web + app (Expo); final check on a new APK |
| **Logins** | Local demo: doctor `9000000001`, attender `9000000002`, password `demo1234` |
| **Verify** | AC1–AC2 with the two sample reports on a laptop and at phone width; AC3 by tapping Back in queue right after picking a photo; AC4 with a patient who has intake photos; AC5 by sending a patient from a previous day for tests (or change `queue_date` in the local DB to yesterday) |
| **PR** | One PR into `master`, with screenshots of each AC (before / after) |
