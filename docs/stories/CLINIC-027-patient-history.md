# User Story: Patient history by mobile number

**Story ID:** CLINIC-027
**Epic:** Patient Record (Phase 2)
**Feature:** Find a returning patient's earlier visits by mobile number and name: the doctor sees them, the attender can pick the patient at registration, and the AI summary says what changed.
**Priority:** P1 — client document "Final Physician OPD Questionnaire": "For follow-up patients, retrieve previous history and focus on changes"; Section 9 "display previous answers and ask what has changed"; Section 10 "The doctor must be able to open … previous visits".
**Status:** PR A done (PR #49, tested in production). PR B in development (`feature/clinic-027b-returning-patient`). No migration (uses the `(clinic_id, patient_mobile)` index from CLINIC-023). Mockup: `ClinicAI-027B-Returning-Patient-Mockup.html`.
**Depends On:** CLINIC-023 (patient mobile on the visit). PR A: no APK. PR B: **new APK**.

> Privacy: the mobile number is patient data. Never log it, never put it in a URL (the lookup is a POST body), never send it to the AI.

---

## Story Overview

**As a** doctor
**I want** to see a returning patient's earlier visits and their summaries
**So that** I know what changed since last time before the patient walks in

**As an** attender
**I want** to pick a returning patient when I type their mobile number
**So that** I don't retype their details and the visit is linked to their history

---

## Who is the same patient

There is no patients table yet. A returning patient's earlier visits are the visits of the **same clinic** with the **same mobile** and the **same name** (lower case, trimmed, repeated spaces made one). Age is not compared (it changes).

- One family often shares a phone: on Test Clinic, Test 12, 13 and 14 share one mobile and stay **three different patients**.
- Picking a returning patient (PR B) copies the stored name exactly, so later visits keep matching.
- Visits without a mobile (before CLINIC-023, or left empty) have no history — expected.
- A name typed differently ("Kishan Lal" / "Kishanlal") is a different patient until a patients table (later) can merge them.

---

## PR A — Doctor sees previous visits (backend + doctor web, no APK)

1. `GET /visits/:id` returns `previous_visits`: up to **5** earlier visits of the same patient (rule above), newest first, each `{ id, visit_date, department_name, status, summary_excerpt }`.
   - Only **finished** visits (`summarised`, `done`) — one still being answered has nothing to read, and one away for tests is the current problem, not history.
   - Earlier = registered before this visit (`id` smaller, same clinic), newest visit day (`visit_date`) first. All departments count.
   - Doctors only: the attender app's detail reads get `[]` (they don't show it).
   - The summary is the doctor's edit when there is one (`display_text`), shortened like the queue preview.
   - `[]` when the visit has no mobile.
2. Doctor web: a **"Previous visits"** panel on the patient screen (under the summary): date, department and the summary excerpt; tapping one opens that visit in place of the open one (`/doctor/:id`, works for a visit of another day; Back to queue still goes to the queue, and a summarised one can be marked Done). Hidden when there are none.

## PR B — Attender picks the patient; AI says what changed (new APK)

3. `POST /patients/lookup { mobile }` (attender, own clinic): one row per patient on that mobile — name, sex, latest age, latest height, last visit date, number of visits.
4. New Patient: **Mobile moves to the top**; when it has 10 digits, show **"Seen before"** — tapping one fills name, sex, age, height and sets **Follow-up**; every field stays editable. Weight is not filled (today's reading). Changing the number forgets the pick.
   Also in this APK: the Sex and Department pickers grow with the phone's font size (a fixed 50 px height cut the text off).
5. AI summary of a **follow-up** visit with an earlier finished visit: that visit's summary (the doctor's edit if any, without its Vitals and "Since last visit" lines) is given to the AI, marked with its date and "for comparison only"; the summary begins with "Since last visit (29 Oct): …" (or "no change reported"). An earlier problem must never be written as today's complaint. Prompt tests for it.

---

## Acceptance Criteria

- [ ] AC1 (A): A visit whose patient has earlier sent visits shows them, newest first, at most 5; each opens that visit.
- [ ] AC2 (A): Another patient on the same mobile (different name), another clinic's visits, and visits not yet sent never appear.
- [ ] AC3 (A): A visit without a mobile, or a first visit, shows no panel.
- [ ] AC4 (B): Typing a known mobile lists its patients; picking one fills the form and sets Follow-up.
- [ ] AC5 (B): A follow-up summary says what changed and never presents an earlier problem as today's.

## How to test (PR A)

Test Clinic: register **Test 12** again (same name, same mobile 9876543210), answer, send → the doctor web shows "Previous visits" with the earlier Test 12 visit; Test 13 and Test 14 (same mobile, other names) are not listed.
