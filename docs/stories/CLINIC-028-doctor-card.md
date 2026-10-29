# User Story: Doctor card screen

**Story ID:** CLINIC-028
**Epic:** Doctor Review (Phase 2)
**Feature:** Show the doctor one short screen of blocks instead of a summary paragraph: patient and main problem, today's status, relevant history, vitals, attender checklist (and AI suggestions next, task 12).
**Priority:** P1 — client document "Final Physician OPD Questionnaire", Section 10 "Doctor Smart Summary": "The doctor should see one short screen, not a long paragraph" … "The doctor must be able to open full answers, uploaded reports and previous visits."
**Status:** In development (`feature/clinic-028-doctor-card`). No migration, **no APK** (backend + doctor web). Mockup: `ClinicAI-Doctor-Card-Mockup.html`.
**Depends On:** CLINIC-018 (report photos), CLINIC-021 (Q1 taps), CLINIC-024 (vitals), CLINIC-027 (previous visits, "Since last visit").

---

## Story Overview

**As a** doctor
**I want** the patient's main problem, today's status, history, vitals and what the attender collected in fixed blocks
**So that** I can read the patient in seconds before they walk in, and still open every answer, photo and earlier visit

---

## Design

The AI still writes **plain text** (one summary row, as today), but in a fixed format the server reads back:

```
Since last visit (29 Oct): …          (follow-ups only, CLINIC-027)
Today's status:
- Complaint: Fever 7 days, comes and goes
- Medicines: Dolo 650 once daily
Relevant history:
- Allergy: No known medicine allergy
Vitals: …                              (added by the code, CLINIC-024)

From reports:                          (CLINIC-018, with the code's notes)
…
```

Keeping text means nothing that reads the summary changes: the doctor's Edit (CLINIC-012), the queue preview (`summary_excerpt`), Back-in-queue remakes, the Vitals line (`withVitalsLine`), the report notes (geminiClient), the "Since last visit" comparison (CLINIC-027 `previousText`) and the attender app's review / sent screens.

| Block | Source | Rule |
|---|---|---|
| Patient | Data | Name, token, sex, age, weight, height, New / Follow-up, mobile. |
| Main problem | Data | The labels tapped in the first tap question (Physician Q1) and its details — `main_problem`; none for lists without a tap question. |
| Since last visit | AI | Its own strip under the patient (follow-ups). |
| Today's status / Relevant history | AI | `- Label: value` lines under the two headings. The headings are always English (the parser needs them); labels and values follow `SUMMARY_LANGUAGE`. |
| Vitals | Data | `vitals_display` + weight + the time recorded (client: readings need a date/time). |
| Attender checklist | Data | History answered/asked, vitals recorded, report photos. Prescription comes with task 7 (photo per question). |
| From reports | AI | The abnormal results and the code's notes, word for word. |
| Also in the summary | AI | Any line outside the blocks — nothing the AI wrote is dropped. |
| AI suggestions | — | Task 12, next. |

- The same text shows, as plain lines, on the attender app's review / sent screens and in the queue preview (`summary_excerpt`) — readable as is, no app change.
- The headings and text markers live in one place, `utils/summaryText.js` (`CARD_HEADINGS`, `FROM_REPORTS`, `SINCE_LAST_VISIT`), used by the prompt, the parser, the Vitals line and the CLINIC-027 comparison.
- For doctors only, `GET /visits/:id` returns `summary_card` (`utils/doctorCard.js parseSummaryCard`: accepts markdown, `-`/`•`/`*` bullets, any case, wrapped lines) and `main_problem`; `PUT /visits/:id/summary` returns the card read from the edited text, so the page updates without a reload.
- **No headings → `summary_card: null` → the doctor web shows today's paragraph layout unchanged**: visits from before this story, the demo / "not available" text, and a doctor's edit that removes the headings.
- Below the card: tabs **Full answers** (default) · **AI summary text** (Edit, as CLINIC-012; the card re-reads after a save) · **Reports** · **Previous visits**. Send for tests, Mark Done and the day stats stay.

## Acceptance Criteria

- [ ] AC1: A new visit's summary shows as the card; every block is labelled DATA or AI.
- [ ] AC2: Main problem is exactly what was tapped in Q1; nothing in a DATA block comes from the AI.
- [ ] AC3: Nothing the AI wrote disappears (unknown lines show under "Also in the summary"; report notes kept word for word).
- [ ] AC4: Old visits, the "not available" note and an edit without headings show the paragraph as before.
- [ ] AC5: Full answers, the summary text (Edit), reports and previous visits are each one tap away.

## How to test (production, after deploy — Gemini writes the format)

A follow-up (Test 12: since last visit + previous visits), a Headache-only visit, a visit with a report photo, a General visit, an old visit (paragraph), an edit that removes the headings (paragraph), and the next follow-up after a card visit (the comparison still works).
