# User Story: Hide the four separate physician lists

**Story ID:** CLINIC-022
**Epic:** Patient Intake
**Feature:** Hide "Physician – Diabetes / Fever / BP / Follow-up" from the department pickers, now that one "Physician" list (CLINIC-021) asks only the questions for the problems ticked in Q1.
**Priority:** P1 — client: "It's a tool for physicians… after the normal 4 to 5 questions, this all should come" (no separate lists)
**Effort:** ~2 h
**Who:** 🧑‍💻 **Junior** (senior reviews the PR)
**Status:** In Development (`feature/clinic-022-hide-physician-lists`), migration `014_hide_separate_physician_lists.sql`. No real clinic uses the app yet, so it does not wait for an APK rollout; a phone still on the old app needs the CLINIC-021 APK to use "Physician".
**Depends On:** CLINIC-021 PR A (`departments.is_active`) and PR B (the new Physician list) merged and deployed.

---

## Story Overview

**As an** attender
**I want** only one "Physician" option in the New Patient picker
**So that** I can't pick an old separate list by mistake

---

## What to do

1. Add a new migration with the **next free number** in `db/migrations/` (check the folder and the reservations in `docs/stories/`), e.g. `014_hide_separate_physician_lists.sql`:
   ```sql
   -- CLINIC-022: the four separate physician lists are replaced by the one "Physician" list
   -- (CLINIC-021). Hidden from GET /departments only; their visits still open and submit.
   -- Idempotent: re-running changes nothing.
   UPDATE departments SET is_active = false
    WHERE name IN ('Physician – Diabetes', 'Physician – Fever', 'Physician – BP', 'Physician – Follow-up');
   ```
   The names use an **en dash (–)**, not a hyphen (-). Copy them from `db/migrations/010_physician_pilot_templates.sql`.
2. `backend/src/repositories/departmentRepository.js` already filters `WHERE is_active`. Also: `visitService.create` refuses a new patient on a hidden department (422 `DEPARTMENT_RETIRED`, for an app with an old list or a screen opened before the change), and `scripts/clinic-admin.mjs` no longer copies retired lists to new clinics. The migration fails loudly if any of the four names is missing.

**Do not:** delete the departments or their lists, or change any other migration (migrations are forward-only).

---

## Acceptance Criteria

- [ ] AC1: The New Patient picker shows General, Gynaecologist, Physician — not the four separate lists.
- [ ] AC2: A patient registered earlier on one of the four lists still opens, answers and sends to the doctor; the doctor web still shows them.
- [ ] AC3: Running the migration twice changes nothing.
- [ ] AC4: Registering a new patient on a hidden list is refused with "This list is no longer used — please go back and pick the department again".

## How to test (local)

1. `cd backend && npm run dev` — the log shows `Applying migration: 014_…` then `Done`.
2. Before running it, register a test patient on "Physician – Fever" and answer one question.
3. After: the app's picker has no "Physician –" entries; the test patient still opens and can be finished and sent.
4. `cd backend && npm test` — all pass.
