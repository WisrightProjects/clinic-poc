# User Story: Doctor Edits the Summary — correct the AI text, keep the original

**Story ID:** CLINIC-012
**Epic:** Doctor Review
**Feature:** Let the doctor correct or add to the AI summary from the dashboard. The AI's original text is always kept.
**Priority:** P1 (High)
**Effort:** 2 days (16 hours)
**Who:** 👨‍💻 **Senior** (migration + edit API) · 🧑‍🎓 **Junior** (edit screens) — see Work Split
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development (after CLINIC-008)
**Depends On:** CLINIC-007 (AI summary), CLINIC-008 (signed-in doctor, for "edited by")
**Migration number reserved:** `008_summary_edits.sql`

> **Out of scope:** requesting tests before consultation and the attender alert — see **CLINIC-014**. This story only covers editing.

---

## Story Overview

**As a** doctor
**I want** to fix anything the AI summary got wrong and add my own notes
**So that** the patient record shows what I actually confirmed

---

## Why This Feature?

### Current Gap
- The doctor can only read the summary (`AiSummaryCard.jsx`); there is no edit endpoint.
- AI summaries can be wrong, for example from a mis-heard answer. Without editing, the doctor's only option is to ignore the summary.
- The trial notes ask that the doctor can "edit the information".

### Real-World Use Case
The summary says "No known allergies", but the patient tells Dr. Ramesh she reacted to amoxicillin last year. He taps **Edit**, adds "Allergic to amoxicillin (rash, 2025)", and saves. The card now shows "Edited by Dr. Ramesh", and he can still view the AI's original text.

---

## Work Split

| Task | Who | Effort |
|---|---|---|
| Migration `008_summary_edits.sql` + `PUT /api/visits/:id/summary` with clinic and doctor-role checks | 👨‍💻 Senior | 0.5 day |
| Doctor web: Edit / Save / Cancel, "Edited by", "View AI original" | 🧑‍🎓 Junior | 1 day |
| Mobile review screen shows the edited text; validator unit test | 🧑‍🎓 Junior | 0.5 day |

---

## Acceptance Criteria

### AC1: Doctor can edit and save
```gherkin
GIVEN a visit in 'summarised' or 'done' with a summary
WHEN the doctor taps Edit, changes the text and taps Save
THEN PUT /api/visits/:id/summary stores the edited text with edited_by (the doctor) and edited_at
AND the dashboard shows the edited text with "Edited by <doctor name> · <time>"
```

### AC2: The AI's original is never overwritten
```gherkin
GIVEN a summary that has been edited
THEN summaries.summary_text still holds the AI's original text
AND the doctor can open "View AI original"
```

### AC3: Only doctors of the same clinic can edit
```gherkin
WHEN an attender, or a doctor from another clinic, calls PUT /api/visits/:id/summary
THEN the response is 403 (attender) or 404 (other clinic)
```

### AC4: Validation
```gherkin
WHEN the edited text is empty or longer than 4000 characters
THEN the response is 422 VALIDATION_ERROR and nothing is saved
```

### AC5: Everyone sees the same latest version
```gherkin
GIVEN an edited summary
THEN GET /api/visits/:id returns the original fields unchanged plus edited_text, edited_by_name and edited_at
AND the doctor dashboard and the attender's review screen show the edited text
```

---

## Technical Implementation

- `db/migrations/008_summary_edits.sql` **(NEW, idempotent)** — `ALTER TABLE summaries ADD COLUMN IF NOT EXISTS edited_text TEXT, ADD COLUMN IF NOT EXISTS edited_by INT REFERENCES users(id), ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ`.
- `backend/src/repositories/summaryRepository.js` — `updateEdit(visitId, text, userId)`.
- `backend/src/services/visitService.js` (or a small `summaryEditService`) — check the visit belongs to the doctor's clinic and has a summary; validate (AC4).
- Route: `PUT /api/visits/:id/summary`, doctor role only (`requireRole('doctor')` from CLINIC-008).
- `frontend/src/components/AiSummaryCard.jsx` — Edit / Save / Cancel, "Edited by …", "View AI original". Usable on phone widths (CLINIC-010).
- Mobile review screen — show `edited_text` when present (read-only).
- Tests — pure validator for AC4.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Verify** | Edit a summary as a doctor (AC1); check `summary_text` unchanged in DB (AC2); try as attender and as another clinic's doctor (AC3); empty text (AC4); open on the attender app (AC5) |
| **Unit tests** | `cd backend && npm test` |
