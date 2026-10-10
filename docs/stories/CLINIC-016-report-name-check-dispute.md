# User Story: Report Name Check — flag reports with a different name as "Report in Dispute"

**Story ID:** CLINIC-016
**Epic:** Patient Intake
**Feature:** When a report is uploaded (or used for the AI summary), compare the name on the report with the registered patient. If it differs or is unclear, tell the attender, mark the report **"Report in Dispute"**, and let the doctor or attender choose whether disputed reports are included in the AI summary.
**Priority:** P1 (High)
**Effort:** 3 days (24 hours), plus the AI reading part, which depends on CLINIC-013
**Who:** 👨‍💻 **Senior** with **Uday Augustin** (approach, AI name reading, matching) · 🧑‍🎓 **Junior** (dispute labels, include/exclude switch) — see Work Split
**Sprint:** Phase 3 — Trial Readiness
**Status:** Draft — technical approach to be decided (Manoj + Uday Augustin), after CLINIC-013
**Depends On:** CLINIC-011 (report upload), CLINIC-013 (which model reads the name from a report photo)
**Migration number reserved:** `010_report_dispute.sql`

> **Decided (manager, 2026-10-10):** the system should alert on a **name mismatch during image upload or AI generation**. On mismatch it informs the attender — *"This report has a different name"* — marks the report **"Report in Dispute"**, and offers to upload a new report or record later. In AI summarisation, the doctor or attender can choose to **Include or Exclude disputed reports**. The exact technical logic is for the team to decide.

---

## Story Overview

**As an** attender
**I want** to be told immediately when a report seems to belong to someone else
**So that** I can ask the patient for the right report before the doctor sees it

**As a** doctor
**I want** reports from other people kept out of my patient's summary unless I choose to include them
**So that** I never make a decision on someone else's test results

---

## Why This Feature?

- Patients often carry a family member's reports in the same folder. A wrong report mixed into the AI summary could mislead the doctor.
- Indian names are written in many ways (initials first or last, father's name, spelling differences, Tamil and English script), so "different name" has to allow for that — and say "uncertain" rather than guess.

---

## Work Split

| Task | Who | Effort |
|---|---|---|
| Choose the approach (A/B/C) and the model for reading names | 👨‍💻 Senior + **Uday Augustin** | after CLINIC-013 |
| Name extraction from report photos, matching function + unit tests, migration `010` | 👨‍💻 Senior | 2 days |
| Mobile: mismatch alert, "Report in Dispute" label, replace report | 🧑‍🎓 Junior | 0.5 day |
| Doctor web + summary: dispute labels, "Include disputed reports" switch | 🧑‍🎓 Junior | 0.5 day |

---

## Acceptance Criteria

### AC1: Name is checked when a report is uploaded
```gherkin
GIVEN a patient registered as 'Ramesh Kumar'
WHEN the attender uploads a report
THEN the system reads the name on the report and classifies it as: match, mismatch, or unclear (no name found / unreadable)
AND the result is shown on the report thumbnail
```

### AC2: Mismatch alerts the attender and marks the report
```gherkin
GIVEN an uploaded report whose name is 'Lakshmi R'
WHEN the check returns mismatch
THEN the attender sees "This report has a different name (Lakshmi R)"
AND the report is marked "Report in Dispute"
AND the attender can replace it with a new report now, or keep it and upload the correct one later
```

### AC3: Name variations are not flagged as mismatches
```gherkin
GIVEN the patient 'K. Ramesh' (or 'Ramesh K', 'Ramesh Kumar', 'Rameshkumar')
WHEN a report shows any of these forms
THEN it is a match (or at worst unclear) — not a mismatch
```

### AC4: Unclear is shown, not hidden
```gherkin
WHEN no name can be read from the report
THEN it is marked "Name not verified" (not disputed), and the attender can confirm it manually
```

### AC5: Include or exclude disputed reports in the summary
```gherkin
GIVEN a visit with one disputed report
WHEN the summary is generated
THEN disputed reports are EXCLUDED by default
AND the doctor or attender can switch "Include disputed reports" on and regenerate
AND the summary states which reports were excluded
```

### AC6: The doctor sees the dispute
```gherkin
WHEN the doctor opens the visit
THEN disputed reports are shown with a "Report in Dispute" label and the name found on them
```

---

## Technical Options (decide with Uday Augustin)

| Option | How | Notes |
|---|---|---|
| **A. Check at upload** | Run name extraction as soon as the photo is uploaded | Attender gets the alert immediately (best UX, matches the manager's request). Needs a model fast enough on our server. |
| **B. Check at AI summary** | Extract names while generating the summary | One AI pass, but the attender learns about a wrong report later. |
| **C. Both** | Quick check at upload, re-check during summary | Most robust; costs two passes. |

For matching, normalise both names (lowercase, remove initials/dots/titles, handle Tamil↔English transliteration where possible), then compare by token overlap with a threshold; fall back to "unclear" rather than "mismatch" when unsure. The matching function should be **pure and unit-tested** with real name variations.

**Database** — `010_report_dispute.sql`: add to `visit_reports`: `extracted_name TEXT`, `name_check TEXT CHECK (name_check IN ('match','mismatch','unclear','pending'))`, `disputed BOOLEAN DEFAULT false`, `confirmed_by INT REFERENCES users(id)`. Add `summaries.included_disputed BOOLEAN DEFAULT false`.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Test data** | Report photos with: the same name, a name variation, a different name, no name, a blurry name |
| **Verify** | AC1–AC6 per photo; summary excludes disputed by default and includes it when switched on |
| **Unit tests** | Name-matching function with Indian name variations (AC3) |
