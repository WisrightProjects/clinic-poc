# User Story: One Physician list — tap Q1, only the relevant sections follow

**Story ID:** CLINIC-021
**Epic:** Patient Intake
**Feature:** Replace the four separate physician lists (CLINIC-019/020) with one "Physician" list: 6 common questions first, where Q1 "What problem brings you…" is a **tap, multi-select** question; the Diabetes / Fever / BP / Follow-up questions appear **only for the problems chosen**; the vitals question last.
**Priority:** P1 (High) — confirmed by the client (2026-10-28): "after the normal 4 to 5 questions, this all should come", one Physician option, more than one problem allowed
**Effort:** ~56–70 h (Phase 1: tap answer for Q1 + branching)
**Who:** 👨‍💻 **Senior**
**Sprint:** Physician pilot — Phase 1
**Status:** PR A merged (#43). PR B in development (`feature/clinic-021b-physician-list`). PR C = CLINIC-022.
**Depends On:** CLINIC-020 (`visits.template_id`, the final question wording), CLINIC-009 (typed answers). **Migrations:** `012_question_choices.sql` (PR A), `013_physician_branching_list.sql` (PR B), hiding the four lists (PR C, next free number). **New APK needed.**

> **Open (does not block):** should "Diabetes" etc. in Q4 (existing illness) also add that section? Built for Q1 only; sections are attached to the options in the data, so Q4 can be switched on later with a data change, no new app.

---

## Story Overview

**As an** attender
**I want** to pick "Physician", tap the patient's problems in Q1, and see only the questions for those problems
**So that** one list fits every physician patient and no time is spent on questions that don't apply

**As a** doctor
**I want** the summary built only from the questions the patient was actually asked
**So that** a problem the attender un-ticked never shows up in the summary

---

## Release in three steps

Migrations run on boot, and attender phones keep the old APK until they update. So:

| Step | PR | Contents | Safe with the old APK? |
|---|---|---|---|
| A | Capability | Columns for options / sections / choices, choice-answer API, visibility rule, new APK with the tap screen. **No list changes.** | ✅ yes — nothing uses choices yet |
| B | New list | The new Physician list (Q1 tap + 23 questions; 22 since CLINIC-024 PR B). The four separate lists **stay visible**, so the pilot keeps running while phones are updated | Old app shows "please update the app" on Physician Q1 — attenders keep using the four lists until updated |
| C | Hide | Hide the four separate lists (`departments.is_active = false`) | Only after **every phone has the new APK** |

---

## The Physician list (PR B)

| Order | Questions | Shown when |
|---|---|---|
| 1 | What problem brings you to the doctor today? — **tap, more than one**: Fever, Diabetes, High BP, Follow-up visit, Cough / Cold, Stomach problem, Headache, Weakness, Other (+ optional details text) | always |
| 2–6 | Since when, other symptoms, existing illness, medicines, allergy (CLINIC-020 wording) | always |
| 7–10 | D1–D4 | Q1 has **Diabetes** |
| 11–14 | F1–F4 | Q1 has **Fever** |
| 15–18 | H1–H4 | Q1 has **High BP** |
| 19–22 | FU1–FU4 | Q1 has **Follow-up visit** |
| 23 | Today's vitals (attender) — **removed by CLINIC-024 PR B (017)**: vitals are entered as fields | always (lists before 017 only) |

Q1 = Diabetes + Fever → 6 + 4 + 4 + 1 = 15 questions. Q1 = Headache only → 7. **Since 017 (no spoken vitals question): 14 and 6** — counts 6 / 10 / 14 / 18.

---

## Acceptance Criteria

### AC1: Tap answer (PR A)
- [ ] Each question has an **answer type**: `voice` (record or type, as today) or `choice` (tap options; later types such as number or date are added the same way). An app that doesn't know a question's type shows "Update the app" for it.
- [ ] A `choice` question has **options** (a stable value, a label, optionally a section) and allows one or more choices.
- [ ] The app shows such a question as tick boxes (big tap targets) plus an optional "details" text box; reopening it shows the saved choices.
- [ ] `POST /visits/:id/answers` accepts `{ questionId, choices: [option values], text? }` for such a question. Every choice must be one of its options; at least one; one only if not multi. Stored as `answers.value = { choices, details }`.
- [ ] The answer's transcript is written as "Diabetes, Fever" (+ " — details"), so the doctor web and AI summary read it unchanged.
- [ ] A recording or plain text sent to any non-voice question is refused with 400 "This question needs the latest app version — please update the app".

### AC2: Branching — one rule (PR A)
- [ ] A question may belong to a **section**. The sections chosen for a visit are stored on the visit (`visits.sections`) together with the choice answer.
- [ ] **Visible** questions = no section, or a section the visit has. One definition, used by: visit detail, answer upload (answers to hidden questions are refused), status advance, submit, AI summary, the queue's answered / total.
- [ ] Un-ticking a problem hides its questions; answers already given to them are kept but not counted and not sent to the AI summary.

### AC3: Status
- [ ] A visit is `answered` only when **every visible question** has an answer (not a count).
- [ ] New transition **answered → answering**: ticking a new problem after all questions were answered makes the visit `answering` again. Submit re-checks on the server and refuses (409) while a visible question is unanswered.
- [ ] Answers and Send change the status one at a time: every answer is saved, and the status worked out, in one transaction with the visit row locked (refused if the visit was sent meanwhile); Send runs the AI first, then re-checks the status under the lock and refuses (409 `ANSWERS_CHANGED`) if an answer changed the questions during the AI call.

### AC4: The switch (PR B, hiding in PR C)
- [ ] Each clinic's "Physician" list is replaced by the list above (old list kept inactive; old visits keep their questions via `visits.template_id`).
- [ ] "Physician – Diabetes / Fever / BP / Follow-up" are hidden from `GET /departments` (`departments.is_active = false`) — the New Patient picker and the Settings list picker, as they are retired. Visits already on them still open, answer and submit.
- [ ] New clinics made with `scripts/clinic-admin.mjs` copy options and sections.

---

## Technical notes

- Columns (012): `questions.answer_type TEXT DEFAULT 'voice'`, `questions.options JSONB` (`[{ "value": "diabetes", "label": "Diabetes", "section": "diabetes" }, …]` — answers store the value, so a label can be renamed), `questions.multi BOOLEAN`, `questions.section TEXT`; `answers.value JSONB` (`{ choices, details }`); `visits.sections TEXT[] NOT NULL DEFAULT '{}'`; `departments.is_active BOOLEAN NOT NULL DEFAULT true`.
- The visibility rule lives once in JS (`utils/questionFlow.js`, pure, tested) and once as a shared SQL fragment for the queue. How each answer type is checked and turned into a transcript lives in `utils/answerTypes.js` (one entry per type); the app's list of types it knows is `mobile/src/utils/answerTypes.js`.
- `visits.sections` is recomputed when a choice answer is saved. If Q4 (or another question) is later given section-linked options, the migration doing it must also recompute `sections` for visits still waiting / answering / answered.
- Settings (CLINIC-002) edits keep options and sections (it updates text and order only); a question added in Settings is a normal voice/typed question with no section.
- PR B: merge it **after the new APK is on every attender phone** — on the old APK a "Physician" visit can't answer Q1 and can't be sent (it would have to be registered again). The four separate lists stay visible until CLINIC-022.
- Settings (CLINIC-002) shows the branching list as plain questions: it doesn't show sections, a question added there has no section (asked of everyone), and deleting Q1 removes the branching. Fix later (show the section; warn on Q1).
- Questions 2–23 use the CLINIC-020 wording, not each clinic's Settings edits to the four separate lists.
- Only Q1 is a tap question in this story; tap answers for the other questions are the next Phase 1 package.
