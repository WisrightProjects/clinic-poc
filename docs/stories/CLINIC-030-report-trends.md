# User Story: Report trends on the doctor card

**Story ID:** CLINIC-030
**Epic:** Doctor Review (Phase 2)
**Feature:** A "Trends" block on the doctor card: the same measurement across a returning patient's visits (e.g. HbA1c 8.2 → 7.6), so the doctor sees in seconds whether values went up or down without opening old visits.
**Priority:** P1 — client task 10 (report trends). Final goal of the client document: "organise and highlight information, not invent diagnoses".
**Status:** In development (`feature/clinic-030-report-trends`). No migration, no APK.
**Depends On:** CLINIC-024 (vitals as fields), CLINIC-027 (same patient), CLINIC-028 (the doctor card), CLINIC-018 (report results in the summary).

---

## Design

- **Same patient** as Previous visits (CLINIC-027): same clinic + mobile + name; finished visits (summarised / done) registered before this one. The block shows the open visit plus up to **4** earlier visits, oldest on the left.
- **Rows** (in this order, at most 6; a row needs a value on **2 or more** visits):
  - HbA1c — from the visit summary's **"From reports"** lines only (the doctor's edit when there is one), read by the AI from the photos: marked "from reports · AI-read". The review points, "Since last visit" and history are never read: they quote earlier values. The demo / "not available" summaries are skipped unless the doctor edited them.
  - Fasting, post-meal and random sugar — from the vitals fields, each type its own row (never mixed).
  - BP, pulse — vitals fields. Weight — registration (CLINIC-023). Temperature (with its unit), SpO2 — vitals fields.
- **Missing values:** "—" = not recorded that visit. HbA1c: "not listed" — the reports list only abnormal results, so a normal HbA1c is not in the summary; never shown as "not tested".
- HbA1c is read only in % (a report in mmol/mol only is left out), without reference ranges ("ref 4-5.6 %", "< 5.7 %") and only up to ";" (another test may follow on the line). The report's flag copied before the % is allowed ("7.6 H %", "(H)", "HH", "H*", "[H]", "↑"). With several HbA1c lines, the latest report date wins. "check photos" when none was found but some photos / values were not read, or a line names HbA1c in a form not read here ("> 14 %", mmol/mol first) — a listed test is never "not listed".
- The same report photo sent again on a later visit (same value and same report date) counts once, at the first visit; later visits say "same report". An earlier visit with no value in any row is left out of the columns.
- **Change:** the open visit vs the latest earlier value, as ↑ / ↓ / → with the difference (BP: both numbers). No colours, no "better / worse" words — no judgement. Temperatures in °C and °F are not compared.
- Each earlier value opens that visit (same as Previous visits). The last column is "Today" (registered today or back in today's queue after tests), or "<day> (this visit)" when an earlier visit is opened.
- Hidden for a new patient, or when nothing was measured on 2 visits. Doctor web only (`GET /visits/:id` → `trends`, filled for doctors, null otherwise).
- Code: `backend/src/utils/trends.js` (pure), `visitRepository.findTrendHistory`, `frontend/src/components/TrendsTable.jsx`.

## Acceptance Criteria

- [ ] AC1: A returning patient with BP on 2+ visits shows a BP row with each visit's value and the change from the last visit.
- [ ] AC2: HbA1c from the reports shows per visit; a visit without it says "not listed".
- [ ] AC3: Every value is exactly as recorded / printed — nothing estimated, no better / worse judgement.
- [ ] AC4: A new patient's card has no Trends block.
- [ ] AC5: Clicking an earlier value opens that visit.

## How to test (production)

A test patient with 2–3 visits on the same mobile + name, each with BP / sugar entered and a report photo with a high HbA1c → the doctor card of the latest visit shows the rows; a fresh mobile → no block.
