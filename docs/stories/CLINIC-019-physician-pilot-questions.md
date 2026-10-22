# User Story: Physician Pilot Questions — four question lists (Diabetes, Fever, BP, Follow-up)

**Story ID:** CLINIC-019
**Epic:** Patient Intake
**Feature:** Add four physician question lists, taken from "Physician OPD – Final Pilot Requirements" (version 1). The attender picks one when registering the patient, and the patient answers only that list.
**Priority:** P1 (High) — needed for the physician pilot
**Effort:** 0.5 day
**Who:** 👨‍💻 **Senior**
**Sprint:** Physician pilot
**Status:** In Development (`feature/clinic-019-physician-questions`)
**Depends On:** CLINIC-002 (question lists, editable in Settings), CLINIC-008 (lists per clinic). **Migration:** `010_physician_pilot_templates.sql`. **No app or doctor web change, no new APK.**

> **Decided (client, 2026-10-22):** for this pilot, **questions only**: the rest of the requirements (patient memory, skipping already answered questions, urgent-sign alerts, vitals fields, structured doctor screen, admin dashboard) comes after the pilot. Flow **Option A**: four short lists, picked once at registration; questions do not change based on answers.

---

## Story Overview

**As an** attender
**I want** to pick Diabetes, Fever, BP or Follow-up when I register a patient
**So that** the patient answers only the 10–12 questions for that problem

**As a** physician
**I want** the routine history for that problem collected before the patient comes in
**So that** I spend the consultation on examination and decisions

---

## The four lists

Each new-visit list = the common questions + the questions for that problem + one vitals question for the attender.

| List (department) | Questions |
|---|---|
| Physician – Diabetes | 5 common + 6 diabetes + vitals = 12 |
| Physician – Fever | 4 common ("since when" is covered by "how many days of fever") + 6 fever + vitals = 11 |
| Physician – BP | 5 common + 6 BP + vitals = 12 |
| Physician – Follow-up | last visit + 5 follow-up + readings + low sugar/foot + allergy + vitals = 10 |

The exact wording is in the migration. A patient with two problems (e.g. diabetes + BP) uses the list for the main one; the other is covered by "other illness" and medicines. The existing "Physician" list stays.

---

## Acceptance Criteria

### AC1: The four lists appear in the picker
```gherkin
GIVEN the backend has started (migration 010 applied)
WHEN the attender opens New Patient
THEN the department picker shows Physician – Diabetes, Physician – Fever, Physician – BP and Physician – Follow-up
AND picking one shows exactly that list's questions, in order
```

### AC2: Every clinic gets its own copy
```gherkin
GIVEN several clinics
WHEN the migration runs
THEN each clinic gets its own active list for each of the four departments
AND a clinic created later with clinic-admin copies them from the Default Clinic
```

### AC3: Safe to re-run, edits kept
```gherkin
WHEN the migration runs again, or a clinic has already edited a list in Settings
THEN nothing is duplicated or overwritten
```

### AC4: Vitals are never made up
```gherkin
GIVEN SUMMARY_PROVIDER=gemini and the vitals question is answered "Not recorded"
THEN the AI summary says "Vitals: not recorded" and shows no vital sign value
AND when vitals are given, the summary copies them exactly on one "Vitals:" line (the mock provider is a fixed demo text and is not used for this)
```

---

## Test Setup

| Field | Value |
|---|---|
| **Test data** | One patient per list; one Diabetes patient with a sugar report photo |
| **Verify** | AC1–AC4 on local and production |

---

## Review changes (2026-10-22)

- Questions listing several symptoms now ask "Which of these do you have … Please name them", and the summary prompt says a bare "yes / some" is reported as not clear, never as all symptoms present.
- The summary prompt (all providers) keeps every number (doses, sugar, HbA1c, BP, temperature, with dates) exactly, and adds a "Vitals:" line only when a question asks for today's vitals.
- Follow-up list: medicine-allergy question added (10 questions).
- Known, not changed for the pilot: departments are global, so every clinic's picker shows the four lists (a list choice per clinic is for after the pilot).
