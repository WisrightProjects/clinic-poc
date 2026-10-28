# User Story: Final Physician Questions — client's wording for the four lists

**Story ID:** CLINIC-020
**Epic:** Patient Intake
**Feature:** Replace the four physician pilot lists (CLINIC-019) with the questions from the client's "ClinicAI – Final Physician OPD Questionnaire" (Development Version 1): 6 common questions first, then the questions for the chosen problem, then the attender's vitals.
**Priority:** P1 (High) — wanted by the client before the pilot
**Effort:** 0.5 day
**Who:** 👨‍💻 **Senior**
**Sprint:** Physician pilot
**Status:** In Development (`feature/clinic-020-final-physician-questions`)
**Depends On:** CLINIC-019 (the four lists). **Migration:** `011_final_physician_questions.sql`. **No app or doctor web change, no new APK.**

> **Decided (2026-10-28):** today only the question wording (item A). Tap answers, real branching, vitals fields, urgent screening, handwritten prescriptions, follow-up history and the doctor card screen are Phase 1 / Phase 2 (see the V1 estimate), not this story.

---

## Story Overview

**As an** attender
**I want** the four physician lists to ask exactly the client's final questions
**So that** the pilot uses the wording the physician approved

**As a** doctor
**I want** patients answered on the old lists to still show their own questions
**So that** an old visit never shows new questions with blank answers

---

## The four lists (11 questions each)

| Order | Diabetes | Fever | BP | Follow-up |
|---|---|---|---|---|
| 1–6 | Common Q1–Q6 | Common Q1–Q6 | Common Q1–Q6 | Common Q1–Q6 |
| 7–10 | D1–D4 | F1–F4 | H1–H4 | FU1–FU4 |
| 11 | Today's vitals (attender) | Today's vitals (attender) | Today's vitals (attender) | Today's vitals (attender) |

- The answer options from the document (e.g. "Yes / Sometimes miss / Stopped / Not prescribed") are written into the question text, so the attender can read them out. Answers stay voice or typed text; tap buttons come in Phase 1.
- The Fever "temperature" field and Section 7 vitals are covered by the vitals question (temperature with °C/°F, or "Not recorded").
- The exact wording is in the migration. Every question is under the 200-character limit.

---

## Acceptance Criteria

### AC1: New lists replace the old ones
- [ ] For every clinic, each of the four physician departments gets a new active list with the 11 questions above; the CLINIC-019 list is made inactive (kept, not deleted).
- [ ] New patients registered on these departments get the new questions.
- [ ] Re-running the migration adds nothing (a list that already starts with the new Q1 is left alone).
- [ ] New clinics made with `scripts/clinic-admin.mjs` copy the new lists (it copies active lists from the Default Clinic).

### AC2: Old visits keep their own questions
- [ ] A visit records the list it was registered on (`visits.template_id`) and keeps showing, summarising and accepting answers for it, even after that list is made inactive.
- [ ] Visits that existed before the migration with answers keep the list their answers belong to. Patients still waiting (no answers) get the new list.
- [ ] The queue's "answered / total" counts the visit's own list.

### AC3: Summary keeps working
- [ ] The vitals question still produces the "Vitals: ..." line (CLINIC-019 rule).

---

## Technical notes

- New column `visits.template_id` (set on create from the active list; migration 011 fills it before the swap for existing visits that have answers). `templateRepository.findForVisit(visit)` (was `findActiveForVisit`) loads it; a visit without one (waiting at deploy time, demo seeds, made by the old backend during a deploy) gets the active list, stored on first read so it never moves later. Used by visit detail, answers, the AI summary, and the queue's question count (`ACTIVE_TEMPLATE_ID` SQL shared between the two repositories).
- **Known limit:** a Settings edit still rewrites question text in place, so an old visit shows the new wording above its answer. Fix later by saving the question text on each answer, or by making Settings edits create a new list version.
- The migration's re-run guard is "new Q1 text present"; `_migrations` already stops a second run, so only a manual re-run after a Settings edit of Q1 would swap again.
- If the client changes the wording again, make the swap a reusable step (SQL function or `clinic-admin.mjs` option) instead of a third hand-written migration.
- Edits made in Settings to the CLINIC-019 lists are not carried over (the client's final wording replaces them); the old lists stay in the database as inactive.
- CLINIC-016's reserved migration moves from 011 to 012.
