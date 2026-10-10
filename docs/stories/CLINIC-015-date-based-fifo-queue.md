# User Story: Date-Based FIFO Queue — today's patients first, in arrival order

**Story ID:** CLINIC-015
**Epic:** Patient Intake
**Feature:** Show each day's queue separately, first in first out, and stop sending every visit ever to the apps.
**Priority:** P2 (Medium)
**Effort:** 1.5 days (12 hours)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development (after CLINIC-008)
**Depends On:** CLINIC-008 (clinic scoping). Coordinates with CLINIC-014 (returning patients join today's queue).

> **Decided (manager, 2026-10-10):** queue policy is **First In, First Out (FIFO)**, with **date-based queues**.

---

## Story Overview

**As an** attender or doctor
**I want** to see today's queue in arrival order, and look back at an earlier day when needed
**So that** patients are seen fairly and the screen stays fast as the clinic's history grows

---

## Why This Feature?

### What already works
- Tokens are given in arrival order and restart daily, so ordering by token is already FIFO within a day.
- Both apps group the queue by `visit_date`, newest day first (`frontend/src/components/QueueRail.jsx`, `mobile/src/screens/HomeScreen.js`).

### Current Gap
- `visitRepository.list` returns **every visit ever**, ordered by `token_number` only (mixing days), and the apps re-group them on the phone. With 10 clinics over a 3-month trial this list keeps growing; the doctor web polls it every 5 seconds.
- There is no way to choose a specific day.
- A patient returning from tests (CLINIC-014) must join the **end of today's queue**, which ordering by the original token can't express.

---

## Acceptance Criteria

### AC1: Today's queue by default, in FIFO order
```gherkin
GIVEN visits registered today at 9:00 (token 1), 9:05 (token 2) and 9:10 (token 3)
WHEN the attender or doctor opens the queue
THEN only today's visits are shown, in the order 1, 2, 3
```

### AC2: Pick another day
```gherkin
WHEN the user picks an earlier date
THEN that day's visits are shown in FIFO order
AND the default returns to today when the screen is reopened
```

### AC3: Returning patients join the end
```gherkin
GIVEN a patient re-queued today after tests (CLINIC-014)
THEN they appear in today's queue after everyone already in it at that moment
```

### AC4: The API returns one day at a time
```gherkin
WHEN GET /api/visits?date=2026-10-10 is called
THEN only that clinic's visits for that date are returned, ordered by queue position
WHEN no date is given
THEN today's visits are returned
AND "Waiting for tests" (status tests_requested) is available regardless of date
```

---

## Technical Implementation

- `visitRepository.list(clinicId, { date, statuses })` — `WHERE clinic_id = $1 AND queue_date = $2` (falls back to `visit_date` until CLINIC-014's columns exist), `ORDER BY queue_token`. Add an index on `(clinic_id, queue_date, queue_token)`.
- `visitController.list` — read `?date=` (validate `YYYY-MM-DD`, default today in clinic time — IST).
- Doctor web and mobile — a date picker / "Today" chip; keep the existing date grouping only for multi-day views, or remove it once a day is selected.
- Note: "today" must be computed in **IST**, not server UTC, so the queue doesn't switch days at 5:30 am.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Verify** | Register 3 patients today and 2 with an earlier date (DB); default view shows today's 3 in order (AC1); pick the earlier date (AC2); re-queue a returned patient (AC3) |
| **Unit tests** | Pure date-parsing/default-to-IST-today helper |
