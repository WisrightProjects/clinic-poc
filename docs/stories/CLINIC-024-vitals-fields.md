# User Story: Vitals as fields — BP, pulse, temperature, SpO₂, sugar

**Story ID:** CLINIC-024
**Epic:** Patient Intake
**Feature:** The attender enters today's vitals in separate number fields (not one spoken answer). The doctor sees them as a vitals row, and the AI summary gets them exactly.
**Priority:** P1 — client document Section 7 (Vital Signs): "Enter available measurements only… If not measured, display Not recorded."
**Effort:** ~16 h
**Who:** 🧑‍💻 **Junior** (senior reviews the PR)
**Status:** To Do
**Depends On:** CLINIC-021 (the Physician list), CLINIC-023. **New APK needed.** Weight and height are entered at registration (CLINIC-023, `visits.weight_kg / height_cm`): the vitals row on the doctor web shows them from there — **do not add a second weight column**.

---

## Story Overview

**As an** attender
**I want** to type each vital into its own field
**So that** the numbers are never misheard and the doctor sees them in one row

**As a** doctor
**I want** today's vitals in a fixed place on the patient screen
**So that** I don't have to find them inside an answer

---

## Fields (client Section 7)

| Vital | Input | Unit | Allowed range |
|---|---|---|---|
| Blood pressure | two numbers | mmHg | systolic 60–260, diastolic 30–160, systolic > diastolic |
| Pulse | number | beats/min | 30–220 |
| Temperature | number + °C/°F | °C / °F | 34–43 °C or 93–110 °F |
| SpO₂ | number | % | 50–100 |
| Blood sugar | number + test type (fasting / post-meal / random) | mg/dL | 20–700 |

Every field is optional. A field left empty shows **"Not recorded"**. The time recorded is saved automatically.

---

## What to do

0. **First (small, helps every form):** let `errorHandler` (`backend/src/utils/errors.js`) send the per-field messages a validator already builds (`err.fields`) as `{ error: { code, message, fields } }`, and have the app show them under the right field (NewPatientScreen first). Then the app only needs "required / format" checks and the number ranges live on the server.
1. **Migration** (next free number): table `visit_vitals (visit_id INT PRIMARY KEY REFERENCES visits(id) ON DELETE CASCADE, bp_systolic INT, bp_diastolic INT, pulse INT, temperature NUMERIC(4,1), temperature_unit TEXT CHECK (temperature_unit IN ('C','F')), spo2 INT, sugar INT, sugar_type TEXT CHECK (sugar_type IN ('fasting','post_meal','random')), recorded_by INT REFERENCES users(id), recorded_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
2. **Backend** (follow the 4 layers in CLAUDE.md):
   - `utils/vitalsValidation.js` — pure checks for the table above (and "BP needs both numbers", "temperature needs a unit", "sugar needs a type"); unit tests for each rule.
   - `repositories/vitalsRepository.js` — `upsert(visitId, vitals, userId)`, `findByVisitId(visitId)`.
   - `services/vitalsService.js` — load the visit with `visitService.findVisit(clinicId, id)` first (clinic scoping); refuse after the visit is sent (`statusEngine.isSubmitted` → 409, like answers).
   - Route `PUT /visits/:id/vitals` in `routes/index.js` with `wrap(...)` and `requireRole('attender')`.
   - `visitService.getById` returns `vitals` (or `null`) beside `answers`.
3. **App** — a "Vitals" card on `mobile/src/screens/QuestionListScreen.js` (above "Previous reports") that opens a new `VitalsScreen` (number pads, °C/°F toggle, sugar type buttons, Save). Reuse `components/SaveAnswerButton.js` and `hooks/useSaveAnswer.js`. Vitals are optional: they don't block Send to Doctor.
4. **Doctor web** — new `frontend/src/components/VitalsStrip.jsx` under the patient header: "BP 140/90 · Pulse 82 · Temp 101 °F · SpO₂ 98% · Sugar 210 (random)"; "Not recorded" for missing ones.
5. **AI summary** — `utils/summary/prompt.js`: when the visit has vitals, add them as a fixed `Vitals (attender):` line in the prompt and ask the AI to copy it exactly; `summaryService` passes them in. Test in `summaryProvider.test.js`.
6. **Remove the spoken vitals question** — a migration that deletes the "Today's vitals (attender)…" question from the **active** Physician list (only where no answer uses it; the Settings code shows how: `templateRepository.updateQuestions`). Ask the senior to review this step.

**Do not:** change the CLINIC-021 branching, the status engine, or old visits' answers.

---

## Acceptance Criteria

- [ ] AC1: The attender can enter any of the vitals, leave others empty, and save; reopening shows the saved values.
- [ ] AC2: Out-of-range values are refused with a clear message (app) and 422 (server).
- [ ] AC3: The doctor web shows the vitals row; empty ones say "Not recorded".
- [ ] AC4: The AI summary's Vitals line uses the entered numbers exactly; no value is invented.
- [ ] AC5: Another clinic's visit is 404; a sent visit's vitals can't be changed (409).
- [ ] AC6: New Physician visits no longer have the spoken vitals question; old visits still show theirs.

## How to test

`cd backend && npm test`; local app + local backend: enter BP 140/90, temp 101 °F, leave SpO₂ empty → doctor web row and summary; try BP 300/90 → refused.
