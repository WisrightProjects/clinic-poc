# User Story: Registration fields — mobile, weight, height, New / Follow-up

**Story ID:** CLINIC-023
**Epic:** Patient Intake
**Feature:** Add the client's registration fields to New Patient: mobile number, weight, height and patient type (New / Follow-up), and show them to the doctor.
**Priority:** P1 — client document "Final Physician OPD Questionnaire", Section 1 (Patient Registration)
**Effort:** ~16 h
**Who:** 🧑‍💻 **Junior** (senior reviews the PR; ask before changing anything outside the files listed)
**Status:** In Development (`feature/clinic-023-registration-fields`), migration `015_registration_fields.sql`
**Depends On:** CLINIC-003 (New Patient), CLINIC-008 (clinics). **New APK needed.**

> Out of scope: finding a follow-up patient's history by mobile number — that is Phase 2 (patient record). This story only **stores** the fields.
> Privacy: the mobile number is patient data. Never log it, never put it in a URL.
> Phase 2 finds a patient's earlier visits by `(clinic_id, patient_mobile)` (indexed here); it should then check — or replace — the attender's New / Follow-up choice with that history, so the two can't disagree. Weight and height belong to the visit (they change between visits) and are owned here: CLINIC-024's vitals show them, they don't store a second weight.

---

## Story Overview

**As an** attender
**I want** to record the patient's mobile, weight, height and whether they are new or follow-up when I register them
**So that** the doctor sees them at once and the follow-up history (Phase 2) has a mobile number to search by

---

## Fields (client Section 1)

| Field | Input | Rules | Required |
|---|---|---|---|
| Mobile number | number pad | exactly 10 digits, starts 6–9 (same rule as `backend/src/utils/mobile.js`) | No (for now — confirm with client) |
| Weight | number | kg, 1–300, up to 1 decimal | No |
| Height | number | cm, 30–250 | No |
| Patient type | two buttons | `new` / `follow_up`, default `new` | Yes |

Existing fields (name, age, sex, department) are unchanged.

---

## What to do

1. **Migration** (next free number in `db/migrations/` when built — 015 if CLINIC-022 (014) is merged): add to `visits`
   `patient_mobile TEXT CHECK (patient_mobile ~ '^[6-9][0-9]{9}$')`, `weight_kg NUMERIC(5,1)`, `height_cm NUMERIC(5,1)`, `patient_type TEXT NOT NULL DEFAULT 'new' CHECK (patient_type IN ('new','follow_up'))`. Use `ADD COLUMN IF NOT EXISTS`.
2. **Validation** — `backend/src/utils/visitValidation.js` `validateNewVisit`: accept and check the 4 new fields (mobile normalised with `utils/mobile.js`); add unit tests in `backend/src/__tests__/visitValidation.test.js` for each rule (good and bad values, blanks allowed).
3. **Save** — `visitService.create` → `visitRepository.createWithToken`: store the new columns (parameters `$6…`, never string-pasted).
4. **App** — `mobile/src/screens/NewPatientScreen.js`: 3 new inputs (mobile with `keyboardType="number-pad"`, weight, height) and a New / Follow-up toggle; mirror the server rules in `mobile/src/utils/questionValidation.js` style for instant messages (the server stays the real check). Send them with `createVisit`.
5. **Doctor web** — `frontend/src/components/PatientHeader.jsx`: show "72 kg · 170 cm · Follow-up" after age/sex when present. Show the mobile only on the detail header, not in the queue list.
6. **AI summary** — `backend/src/utils/summary/prompt.js` `buildSummaryPrompt`: add weight/height and "follow-up visit" to the `Patient:` line when present (not the mobile number — it must not go to the AI). Add a test in `summaryProvider.test.js`.

**Do not:** change login mobiles (`users.mobile`), the status engine, or the question lists.

---

## Acceptance Criteria

- [ ] AC1: New Patient has mobile, weight, height and New / Follow-up; leaving mobile/weight/height blank still registers the patient.
- [ ] AC2: Wrong values are refused with a clear message on the field (app) and 400 `VALIDATION_ERROR` (server, same as the other New Patient fields): mobile not 10 digits or not starting 6–9, weight 1–300 kg / height 30–250 cm (one decimal at most), type not new / follow_up.
- [ ] AC3: The doctor web shows weight, height and patient type on the patient header; the mobile shows on the detail header only.
- [ ] AC4: The AI summary starts with age, sex, weight/height and "follow-up visit" when given (a prompt rule — tested: Gemini mentions all of them); the mobile number is never sent to the AI.
- [ ] AC5: Patients registered before this change still open (new fields empty, type "new").

## How to test

1. Backend: `cd backend && npm test` (new visitValidation and summaryProvider tests pass).
2. Local app (emulator or test APK on the local backend): register one patient with all fields, one with only the required ones, one with a bad mobile (9 digits) — check the messages.
3. Doctor web (`cd frontend && npm run dev`): the header shows the new fields; run `npm run lint`.
