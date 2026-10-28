# User Story: More tap answers — Yes / No, number + unit, date

**Story ID:** CLINIC-025
**Epic:** Patient Intake
**Feature:** Let more Physician questions be answered by tapping instead of voice: single choice (Yes / Sometimes miss / Stopped…), number with a unit (2 days, 6 years), and date (test date). Voice / text stays for "describe" answers.
**Priority:** P1 — client document Section 9 (Input Rules): Select, Number and Units, Date, Text, Voice, Photo per question; "Display large buttons for quick selection"
**Effort:** ~30 h
**Who:** 👨‍💻 **Senior** (core answer-type logic); a junior can build the app screens after the API is done
**Status:** To Do
**Depends On:** CLINIC-021 (answer types `voice` / `choice`, `utils/answerTypes.js`). **New APK needed** (older APKs show "Update the app" for the new types — CLINIC-021 AC1).

---

## Story Overview

**As an** attender
**I want** to tap the answer or type a number for short questions
**So that** intake is faster and the numbers reach the doctor exactly

---

## Answer types to add

| Type | Stored value (`answers.value`) | Transcript (what the doctor and AI read) | Example questions (Physician list) |
|---|---|---|---|
| `choice` (single, existing) | `{ choices: ["sometimes"] }` | "Sometimes miss" | D2/H2 "taking medicines regularly", F2 "continuous / comes and goes", FU1 "better / same / worse" |
| `number` | `{ number: 6, unit: "years" }` or `{ unknown: "newly_diagnosed" }` | "6 years" / "Newly diagnosed" | Q2 since when, D1/H1 how long, F1 days of fever |
| `date` | `{ date: "2026-10-10" }` or `{ unknown: "dont_know" }` | "10 Oct 2026" | test date inside D3 (split into its own question) |

Question settings per type (in `questions`): allowed units (e.g. `["hours","days","weeks"]`), min/max, and optional "special answers" (Newly diagnosed / Don't know / Not applicable). Store them in a new `questions.config JSONB`.

---

## What to do

1. Migration: `questions.config JSONB`.
2. `backend/src/utils/answerTypes.js`: add `number` and `date` entries (validate + transcript), tests in `questionFlow.test.js` / a new `answerTypes.test.js`.
3. App: `NumberAnswerScreen` (number pad + unit buttons + special answers), `DateAnswerScreen` (date picker — read the Expo v56 docs first, `mobile/AGENTS.md`), add the types to `mobile/src/utils/answerTypes.js` KNOWN and `QuestionListScreen.openAnswer`.
4. Migration that switches the chosen Physician questions to these types with their options/config (new list version, the CLINIC-020/021 swap pattern, so old visits keep theirs). **Confirm the exact question list with the client first.**
5. Doctor web / summary: no change needed (they read the transcript).

---

## Acceptance Criteria

- [ ] AC1: Single-choice questions show big buttons; one tap + Save answers them.
- [ ] AC2: Number questions accept only numbers in range with a unit, or a special answer; the transcript reads naturally ("6 years").
- [ ] AC3: Date questions accept a past date or "Don't know".
- [ ] AC4: Older APKs show "Update the app" on these questions; the server refuses voice/text for them with the update message.
- [ ] AC5: AI summaries keep the numbers and dates exactly.

## To confirm with the client

Which questions become tap / number / date (proposed above), and whether Q4 "existing illness" should become multi-select that also opens sections (CLINIC-021 open point).
