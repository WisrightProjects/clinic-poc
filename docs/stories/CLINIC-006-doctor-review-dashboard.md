# User Story: Doctor Review Dashboard — AI Summary & Patient Responses (Desktop Web)

**Story ID:** CLINIC-006
**Epic:** Doctor Review
**Feature:** A desktop web dashboard where the doctor reviews the queue, reads the AI clinical summary, drills into the full Q&A, and marks a visit Done — before seeing the patient.
**Priority:** P0 (Critical)
**Effort:** 3 days (24 hours)
**Sprint:** Phase 1 — Doctor Review
**Status:** Ready for Development
**Depends On:** CLINIC-001 (backend/DB — Express + PostgreSQL with `visits`/`questions`/`answers`/`summaries`, the `/api` layer and seeds), CLINIC-005 (attender submits a visit → status moves to `answered`/`summarised` so review-ready visits exist)

---

## Story Overview

**As a** doctor at the clinic
**I want** a desktop dashboard that lists my patient queue in token order with a status chip, lets me select any patient to read an AI clinical summary plus the full spoken Q&A, and mark them Done
**So that** I can walk into each consult already knowing the patient's complaint and history, and the next patient automatically rises to the top of my queue

**As a** clinic attender (secondary, indirect)
**I want** the visits I submit to appear on the doctor's screen within seconds without the doctor reloading
**So that** the doctor is never waiting on me and the consult flow keeps moving

---

## Why This Feature?

### Current Gap:
- The repository today is a **greenfield POC**: it contains only static HTML mockups (`clinic-flow.html`, `index.html`) served by nginx (`Dockerfile`, `docker-compose.yml`). There is **no React web app, no doctor route, no API client** — nothing the doctor can actually open.
- Screen **D-01** in `clinic-flow.html` is a pixel mockup only; the queue, chips, summary card and Q&A are hard-coded HTML with no data, no selection, no polling, and no Done action.
- The doctor currently has no way to see what the attender captured. Submitted intake data lives in PostgreSQL (CLINIC-001/CLINIC-005) but is **invisible** to the doctor.

### Real-World Use Case (Morning OPD at CarePoint Clinic):
Dr. Ramesh opens the dashboard at the start of General OPD. Ten tokens are queued. Token 04 (Lakshmi K.) shows a **Summarised** chip — the attender just finished her intake. He clicks her, reads the AI summary ("fever for 3 days, severe headache, no medication, no allergies"), skims her five spoken answers in Tanglish ("Fever iruku, 3 days-a aachu..."), calls her in, and after the consult clicks **Done**. Her chip turns to Done, his "Seen today" count ticks up, and Token 05 is now the next actionable patient. While he was reading, the attender submitted Token 05 — and it appeared on his screen on its own, no reload.
- The doctor must see **newly summarised patients appear automatically** (polling) — he never touches refresh.
- The doctor must read **Tanglish transcripts** (romanized Tamil + English) rendered correctly.
- Marking **Done must persist** to the DB and **immediately** update the chip and the small stats.

This cannot be done with the current implementation — there is no app, only a static mockup.

### Solution:
Build a **new React (Vite) desktop web app** that ports the D-01 mockup's visual style (teal/navy, browser-framed clinic layout) and is backed by the REAL `/api`:
- **Patient queue (left rail)** — `GET /api/visits` rendered in token order with status chips (Waiting / Summarised / Done).
- **Polling auto-refresh** — re-fetch the queue every ~5s so attender-submitted visits surface without a manual reload; the currently selected patient stays selected across refreshes.
- **Patient detail (main panel)** — demographics + small stats (seen today / remaining / Q&A count), the AI summary card (**mock** text from `summaries`), and a full Q&A drill-down (`GET /api/visits/:id`).
- **Mark Done** — `PATCH /api/visits/:id/status` → `done`, optimistically updating the chip + stats, persisting to DB, and advancing the queue.
- **Role gate (doctor only)** — no real auth; doctor role is asserted via a header/param sent on every request and a simple client guard.
- **Backward compatible** — the static mockup files are untouched; this is additive new app code.

---

## User Personas

### Primary: Dr. S. Ramesh — The General Physician
- **Role:** Sees ~30–40 OPD patients a morning at CarePoint Clinic, Chennai. Works at a desktop in his consult room.
- **Goal:** Walk into each consult already briefed; spend the live minutes examining, not interviewing.
- **Pain Point:** "By the time I ask the patient everything from scratch, half my consult is gone. I want the gist before they sit down — and I shouldn't have to keep hitting refresh to see who's ready."

### Secondary: Meena — The Clinic Attender
- **Role:** Records each patient's spoken answers on the Android app and sends them to the doctor.
- **Goal:** Once she taps Send, the patient should show up on the doctor's screen instantly.
- **Pain Point:** "Sometimes I send a patient and the doctor says he doesn't see them yet, so I have to walk over. The screen should just update on its own."

---

## Detailed Sub-Stories

### Sub-Story 1: Scaffold the doctor web app + API client + role gate

**Story ID:** CLINIC-006.1
**Points:** 3 | **Effort:** 4 hours

```gherkin
As a doctor
I want a Vite React app reachable at /doctor that talks to the real backend with my doctor role attached
So that there is a running shell where the queue and patient detail can live, and non-doctor access is blocked
```

### Sub-Story 2: Patient queue rail with status chips (token order)

**Story ID:** CLINIC-006.2
**Points:** 3 | **Effort:** 4 hours

```gherkin
As a doctor
I want the left rail to list my queue from GET /api/visits in token order with a Waiting/Summarised/Done chip per patient
So that I can see at a glance who is ready for me and who I have already seen
```

### Sub-Story 3: Queue polling auto-refresh with selection preserved

**Story ID:** CLINIC-006.3
**Points:** 5 | **Effort:** 5 hours

```gherkin
As a doctor
I want the queue to re-fetch every ~5 seconds so attender-submitted patients appear on their own
So that newly summarised patients surface without a manual reload, while the patient I am currently reading stays selected
```

### Sub-Story 4: Patient detail — demographics, stats, AI summary, Q&A drill-down

**Story ID:** CLINIC-006.4
**Points:** 5 | **Effort:** 6 hours

```gherkin
As a doctor
I want selecting a patient to load GET /api/visits/:id and show demographics, small stats, the mock AI summary card, and every question with its transcript
So that I am fully briefed on the patient's complaint and spoken history before the consult
```

### Sub-Story 5: Mark Done + loading/error/empty states

**Story ID:** CLINIC-006.5
**Points:** 5 | **Effort:** 5 hours

```gherkin
As a doctor
I want a Done button that PATCHes the visit to done and updates the chip and stats immediately, plus clear loading/error/empty handling
So that the queue advances and stays trustworthy even when a request is slow, fails, or the queue is empty
```

---

## Acceptance Criteria

### AC1: Queue loads in token order with correct chips
```gherkin
GIVEN the doctor opens /doctor and the backend returns a seeded queue from GET /api/visits
WHEN the dashboard renders
THEN the left rail lists every visit ordered by token_number ascending
AND each row shows a status chip mapped exactly: status 'waiting' → "Waiting", 'summarised' → "Summarised", 'done' → "Done"
AND the chip colors follow the D-01 mockup (Waiting = grey `cwait`, Summarised = green `csum`, Done = green `cdone`)
```

### AC2: Polling surfaces a newly 'summarised' patient without reload
```gherkin
GIVEN the doctor is viewing the dashboard and an attender then submits a visit so its status becomes 'summarised'
WHEN the next poll fires (~5s interval) and GET /api/visits is re-fetched
THEN the newly 'summarised' patient appears in the queue automatically with a "Summarised" chip
AND no full-page reload or manual refresh was required
AND the poll continues at the fixed interval while the page is open and stops when the page unmounts
```

### AC3: Selected patient stays selected across refreshes
```gherkin
GIVEN the doctor has selected Token 04 and is reading their detail
WHEN a background queue poll completes and re-renders the rail (including when other rows change status)
THEN Token 04 remains the selected row (highlighted per D-01 `dp.sel`)
AND the open detail panel is NOT reset, re-fetched-from-scratch, or scrolled to top by the poll
```

### AC4: Patient detail shows demographics, stats, summary, and full Q&A
```gherkin
GIVEN the doctor selects a 'summarised' patient
WHEN GET /api/visits/:id resolves
THEN the header shows patient_name, "Token {token_number}", and "{sex}, {age} yrs · {department}"
AND the stats strip shows seen-today, remaining, and Q&A count (e.g. "5/5")
AND the AI summary card renders summaries.summary_text with an "AI Summary" badge
AND every question renders in order_index order with its answers.transcript beneath it
```

### AC5: Mark Done persists and updates chip + stats immediately
```gherkin
GIVEN the doctor is viewing a non-done patient
WHEN the doctor clicks Done and PATCH /api/visits/:id/status with { "status": "done" } succeeds
THEN that patient's chip changes to "Done" immediately (optimistic)
AND the "Seen today" stat increments and "Remaining" decrements without a full reload
AND the change persists: a subsequent GET /api/visits returns that visit with status 'done'
AND the next actionable (non-done) patient becomes the natural next selection / top of the actionable list
```

### AC6: 'answered'-but-not-yet-summarised state vs 'summarised'
```gherkin
GIVEN a visit has status 'answered' (submitted, AI summary not yet generated) and another has status 'summarised'
WHEN the doctor selects each
THEN the 'summarised' visit shows its mock AI summary card populated from summaries.summary_text
AND the 'answered' visit shows the Q&A transcripts but a clear "Summary not ready yet" placeholder in the summary card instead of empty space
AND the queue chip for an 'answered' visit does NOT read "Summarised"
```

### AC7: Empty-queue state
```gherkin
GIVEN GET /api/visits returns an empty array (no visits for the department today)
WHEN the dashboard renders
THEN the queue rail shows an empty-state message (e.g. "No patients in the queue yet")
AND the main panel shows a neutral "Select a patient" / "Nothing to review" placeholder
AND no error is shown and polling continues so the first submitted visit will appear
```

### AC8: Loading states for queue and detail
```gherkin
GIVEN the queue or a patient detail is being fetched for the first time
WHEN the request is in flight
THEN the queue rail shows a loading indicator on initial load (not on background polls)
AND selecting a patient shows a loading state in the main panel until GET /api/visits/:id resolves
AND a background poll never replaces the visible queue with a loading spinner (only the first load does)
```

### AC9: Error states for queue and detail (with retry)
```gherkin
GIVEN GET /api/visits or GET /api/visits/:id fails (network/5xx)
WHEN the failure is received
THEN an inline, non-blocking error message with a Retry action is shown in the affected panel
AND a failed background poll keeps the last good queue visible (does not blank it) and retries on the next interval
AND a failed PATCH /api/visits/:id/status rolls back the optimistic chip/stat change and surfaces an error
```

### AC10: Tanglish transcripts render correctly
```gherkin
GIVEN an answer transcript contains Tanglish text (romanized Tamil mixed with English, e.g. "Fever iruku, 3 days-a aachu...")
WHEN the Q&A drill-down renders that transcript
THEN the text displays intact with no mojibake, truncation of multibyte characters, or HTML-escaping artifacts
AND the transcript is shown verbatim (read-only) styled per the D-01 `qa-a` italic style
```

### AC11: Role gate — doctor only (no real auth)
```gherkin
GIVEN there is no real authentication and the doctor role is asserted via header/param (e.g. X-Role: doctor)
WHEN the dashboard makes any /api request
THEN the doctor role header/param is attached to every request
AND a client without the doctor role is blocked from /doctor with a "Doctor access only" guard message
AND the backend queue/detail/status endpoints are reached as the doctor role
```

### AC12: Visual fidelity to the D-01 mockup
```gherkin
GIVEN the D-01 mockup style in clinic-flow.html (teal #0a8f8f / navy #1a3050, browser-framed layout, Inter font)
WHEN the dashboard renders on desktop
THEN the queue rail, chips, stats cards, AI summary gradient card, and Q&A items visually match the D-01 mockup classes (ds/dp/chip/stats/sum-card/qa-item)
AND the layout is desktop-oriented (two-pane: ~195px rail + flexible main), not a mobile/phone frame
```

---

## Technical Implementation

> GREENFIELD: every file below is **NEW** unless noted. The static mockup files (`clinic-flow.html`, `index.html`, `Dockerfile`, `docker-compose.yml`) are NOT modified. Frontend follows the SPEC structure `frontend/src/{components,pages,hooks,utils,store,assets}`; backend follows `backend/src/{controllers,services,repositories,models,routes,utils,config}`; DB under `db/{migrations,seeds}`.
> MOCK vs REAL: queue, detail, status sync and DB are REAL. The AI summary is **TEMPORARY MOCK** text stored in `summaries` with `generated_by = 'mock'` and is read as-is. Auth is **not real** — doctor role via header/param.

### Part 1: Backend read/queue endpoints for the doctor (6 hours)

> CLINIC-001 provides the Express app, DB pool, and table DDL. CLINIC-006 adds/finishes the doctor-facing read endpoints and the status mutation, using the canonical API verbatim.

#### Task 1.1: Queue repository query (token order, optional status filter)

**File:** `backend/src/repositories/visitRepository.js` **(NEW)**

Read visits ordered by `token_number`, with an optional `status` filter (the doctor queue typically requests `summarised` + `done` + `waiting`).

```javascript
// visitRepository.js — data access for `visits` (+ joined detail). No business logic here.
// Input: optional { statuses: string[] }  Output: rows from `visits`
const db = require('../config/db');

// Canonical statuses: 'waiting'|'answering'|'answered'|'summarised'|'done'
async function findQueue({ statuses } = {}) {
  if (statuses && statuses.length) {
    return db.query(
      `SELECT id, token_number, patient_name, age, sex, department_id, status, created_at
         FROM visits
        WHERE status = ANY($1)
        ORDER BY token_number ASC`,
      [statuses]
    ).then(r => r.rows);
  }
  return db.query(
    `SELECT id, token_number, patient_name, age, sex, department_id, status, created_at
       FROM visits ORDER BY token_number ASC`
  ).then(r => r.rows);
}

// Visit + ordered answers/transcripts + summary, for GET /api/visits/:id
async function findByIdWithDetail(id) { /* visit row + questions JOIN answers (order_index ASC) + latest summary */ }

async function updateStatus(id, status) {
  return db.query(
    `UPDATE visits SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, status]
  ).then(r => r.rows[0]);
}

module.exports = { findQueue, findByIdWithDetail, updateStatus };
```

#### Task 1.2: Visit service (queue shaping, detail assembly, status guard)

**File:** `backend/src/services/visitService.js` **(NEW)**

Business logic only: parse the `status=` query, assemble the detail payload (ordered Q&A + summary), and validate the status transition for Done.

```javascript
// visitService.js — business logic for the doctor review flow.
const repo = require('../repositories/visitRepository');

// GET /api/visits?status=  → parse comma list (e.g. "summarised,done,waiting")
async function getQueue(statusParam) {
  const statuses = statusParam ? statusParam.split(',').map(s => s.trim()) : null;
  return repo.findQueue({ statuses });
}

// GET /api/visits/:id → { visit, answers:[{question_id, text, transcript, transcript_status, order_index}], summary }
async function getVisitDetail(id) { /* fetch + shape ordered answers + summary */ }

// PATCH /api/visits/:id/status → only 'done' is accepted from the doctor in this POC
const ALLOWED = new Set(['done']);
async function markStatus(id, status) {
  if (!ALLOWED.has(status)) { const e = new Error('Unsupported status'); e.status = 400; throw e; }
  return repo.updateStatus(id, status);
}

module.exports = { getQueue, getVisitDetail, markStatus };
```

#### Task 1.3: Controller + routes (canonical `/api` paths) + doctor role middleware

**Files:** `backend/src/controllers/visitController.js` **(NEW)**, `backend/src/routes/visitRoutes.js` **(NEW)**, `backend/src/utils/roleGuard.js` **(NEW)**

Thin controllers (input → service → output). Routes mount the canonical paths exactly. `roleGuard` reads the asserted role from a header/param (no real auth).

```javascript
// visitRoutes.js — canonical API, verbatim
const router = require('express').Router();
const c = require('../controllers/visitController');
const requireDoctor = require('../utils/roleGuard'); // checks req.header('X-Role') === 'doctor' (or ?role=)

router.get('/visits', requireDoctor, c.list);              // GET /api/visits?status=
router.get('/visits/:id', requireDoctor, c.getOne);        // GET /api/visits/:id
router.patch('/visits/:id/status', requireDoctor, c.setStatus); // PATCH /api/visits/:id/status
module.exports = router;
```

```javascript
// visitController.js — input → service → output only
const svc = require('../services/visitService');
exports.list      = (req, res, next) => svc.getQueue(req.query.status).then(v => res.json(v)).catch(next);
exports.getOne    = (req, res, next) => svc.getVisitDetail(req.params.id).then(v => v ? res.json(v) : res.status(404).end()).catch(next);
exports.setStatus = (req, res, next) => svc.markStatus(req.params.id, req.body.status).then(v => res.json(v)).catch(next);
```

#### Task 1.4: Seed a review-ready queue (incl. one 'summarised' visit with a MOCK summary)

**File:** `db/seeds/002_doctor_queue.sql` **(NEW)**

Seed ~10 visits across statuses (`done`, `summarised`, `waiting`), one `answered`-but-not-summarised, ordered token_number 01..10. For the `summarised` visit (Token 04, Lakshmi K.) seed 5 `questions`/`answers` with **Tanglish** transcripts and one `summaries` row with `generated_by = 'mock'` (mirroring the D-01 mockup copy).

```sql
-- 002_doctor_queue.sql — REAL queue data; AI summary is MOCK (generated_by='mock')
INSERT INTO summaries (visit_id, summary_text, generated_by)
VALUES (4, 'Patient (F/34) presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes.', 'mock');
```

### Part 2: Frontend app shell, routing & API client (4 hours)

#### Task 2.1: Vite React app + /doctor route + role gate

**Files:** `frontend/src/App.jsx` **(NEW)**, `frontend/src/main.jsx` **(NEW)**, `frontend/index.html` **(NEW)**, `frontend/vite.config.js` **(NEW)**

App boots at `http://localhost:5173`, routes `/doctor` to the dashboard page, and wraps it in a doctor-only guard.

```jsx
// App.jsx — desktop doctor web. Role is asserted, not authenticated (POC).
import { Routes, Route, Navigate } from 'react-router-dom';
import DoctorDashboardPage from './pages/DoctorDashboardPage';
import RequireDoctor from './components/RequireDoctor';

export default function App() {
  return (
    <Routes>
      <Route path="/doctor" element={<RequireDoctor><DoctorDashboardPage /></RequireDoctor>} />
      <Route path="*" element={<Navigate to="/doctor" replace />} />
    </Routes>
  );
}
```

#### Task 2.2: API client utility (attaches doctor role header)

**File:** `frontend/src/utils/apiClient.js` **(NEW)**

Centralized fetch wrapper that prefixes `/api`, attaches the doctor role header on every call, and throws typed errors for the error-state ACs.

```javascript
// apiClient.js — single place that talks to the REAL backend.
// Input: path + options. Output: parsed JSON. Throws ApiError on non-2xx.
const ROLE = 'doctor'; // POC: no real auth
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Role': ROLE, ...(options.headers || {}) },
  });
  if (!res.ok) { const e = new Error(`API ${res.status}`); e.status = res.status; throw e; }
  return res.status === 204 ? null : res.json();
}
export const getVisits   = (status) => request(`/visits${status ? `?status=${status}` : ''}`);
export const getVisit    = (id) => request(`/visits/${id}`);
export const setVisitDone = (id) => request(`/visits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) });
```

#### Task 2.3: Role guard component

**File:** `frontend/src/components/RequireDoctor.jsx` **(NEW)**

Blocks non-doctor access (role read from a constant/query param in the POC) and renders a "Doctor access only" message otherwise.

### Part 3: Queue rail + polling hook (5 hours)

#### Task 3.1: `useVisitQueue` polling hook (selection-safe)

**File:** `frontend/src/hooks/useVisitQueue.js` **(NEW)**

Fetches `GET /api/visits` on mount, then polls every 5s via `setInterval`, exposing `{ visits, isLoading (first load only), error, refetch }`. Background polls update data without flipping `isLoading` and keep the last good list on failure (AC2, AC8, AC9).

```javascript
// useVisitQueue.js — polling queue source for the doctor rail.
// Output: { visits, isLoading, error, refetch }
import { useEffect, useRef, useState, useCallback } from 'react';
import { getVisits } from '../utils/apiClient';

export function useVisitQueue(status = 'summarised,done,waiting,answered', intervalMs = 5000) {
  const [visits, setVisits] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // first load only
  const [error, setError] = useState(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try { const data = await getVisits(status); setVisits(data); setError(null); }
    catch (e) { setError(e); /* keep last good list */ }
    finally { if (firstLoad.current) { setIsLoading(false); firstLoad.current = false; } }
  }, [status]);

  useEffect(() => { load(); const id = setInterval(load, intervalMs); return () => clearInterval(id); }, [load, intervalMs]);
  return { visits, isLoading, error, refetch: load };
}
```

#### Task 3.2: Queue rail component (chips, token order, selection)

**Files:** `frontend/src/components/QueueRail.jsx` **(NEW)**, `frontend/src/components/StatusChip.jsx` **(NEW)**, `frontend/src/utils/statusMap.js` **(NEW)**

Renders the rail per D-01 (`ds`/`dp`/`dp-tok`). `statusMap.js` maps status → label + chip class verbatim (`waiting`→Waiting/`cwait`, `summarised`→Summarised/`csum`, `done`→Done/`cdone`). The selected `visit.id` (held in the page) drives the `dp.sel` highlight and is preserved across polls (AC3).

```javascript
// statusMap.js — canonical status → UI label + D-01 chip class
export const STATUS_UI = {
  waiting:    { label: 'Waiting',    chip: 'cwait' },
  summarised: { label: 'Summarised', chip: 'csum'  },
  done:       { label: 'Done',       chip: 'cdone' },
  answered:   { label: 'Answered',   chip: 'cwait' }, // submitted, summary pending
};
```

### Part 4: Patient detail panel — stats, summary, Q&A (6 hours)

#### Task 4.1: `useVisitDetail` hook

**File:** `frontend/src/hooks/useVisitDetail.js` **(NEW)**

Given the selected `visitId`, fetches `GET /api/visits/:id`, exposing `{ detail, isLoading, error, refetch }`. Re-fetches only when the selected id changes — NOT on every queue poll (protects AC3).

#### Task 4.2: Detail panel components

**Files:** `frontend/src/components/PatientHeader.jsx` **(NEW)**, `frontend/src/components/StatsStrip.jsx` **(NEW)**, `frontend/src/components/AiSummaryCard.jsx` **(NEW)**, `frontend/src/components/QaList.jsx` **(NEW)**

Ports D-01: `dm-top` header (name/token/sex/age/department), `stats`/`stat` strip (seen today / remaining / Q&A count), `sum-card` gradient AI summary (renders `summaries.summary_text`; shows "Summary not ready yet" when the visit is `answered` not `summarised` — AC6), and `qa-list`/`qa-item` Q&A drill-down rendering each question + `answers.transcript` verbatim with Tanglish intact (AC10).

```jsx
// AiSummaryCard.jsx — reads the MOCK summary as-is (generated_by='mock'); no client generation.
export default function AiSummaryCard({ summary, status }) {
  if (!summary) {
    return <div className="sum-card sum-card--pending">{status === 'answered'
      ? 'Summary not ready yet' : 'No summary available'}</div>;
  }
  return (
    <div className="sum-card">
      <div className="sum-hdr"><span className="ai-badge">AI Summary</span></div>
      <div className="sum-text">{summary.summary_text}</div>
    </div>
  );
}
```

### Part 5: Page composition, Done action & states (3 hours)

#### Task 5.1: Dashboard page wiring (selection + Done + advance)

**File:** `frontend/src/pages/DoctorDashboardPage.jsx` **(NEW)**

Owns selected-visit state, composes `QueueRail` + detail panel, and handles Done: calls `setVisitDone(id)`, optimistically updates the chip + stats, rolls back on failure (AC9), and advances selection to the next non-done visit (AC5). Holds empty-queue (AC7) and error/retry (AC9) rendering.

```jsx
// DoctorDashboardPage.jsx — composition root for /doctor
const { visits, isLoading, error, refetch } = useVisitQueue();
const [selectedId, setSelectedId] = useState(null);
// keep selection across polls: only auto-select when nothing is selected yet
useEffect(() => { if (!selectedId && visits.length) setSelectedId(firstActionable(visits)?.id); }, [visits, selectedId]);

async function handleDone(id) {
  setLocalStatus(id, 'done');           // optimistic chip + stats
  try { await setVisitDone(id); refetch(); setSelectedId(nextActionable(visits, id)?.id ?? null); }
  catch (e) { revertLocalStatus(id); showError(e); }
}
```

#### Task 5.2: Shared styles ported from D-01

**File:** `frontend/src/assets/doctor.css` **(NEW)**

Port the D-01 CSS variables and classes from `clinic-flow.html` (`--teal:#0a8f8f`, `--navy:#1a3050`, `ds/dp/chip/stats/stat/sum-card/qa-item`, Inter font) into the React app's stylesheet for visual parity (AC12).

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `backend/src/repositories/visitRepository.js` | **NEW** — queue / detail / status queries | ~80 lines |
| `backend/src/services/visitService.js` | **NEW** — queue parse, detail assembly, status guard | ~70 lines |
| `backend/src/controllers/visitController.js` | **NEW** — input → service → output | ~30 lines |
| `backend/src/routes/visitRoutes.js` | **NEW** — canonical `/api` paths | ~20 lines |
| `backend/src/utils/roleGuard.js` | **NEW** — doctor role header/param check | ~20 lines |
| `db/seeds/002_doctor_queue.sql` | **NEW** — review-ready queue + 1 summarised visit w/ MOCK summary + Tanglish answers | ~60 lines |
| `frontend/index.html` | **NEW** — Vite entry | ~15 lines |
| `frontend/vite.config.js` | **NEW** — dev server (5173) + `/api` proxy | ~20 lines |
| `frontend/src/main.jsx` | **NEW** — React/router bootstrap | ~15 lines |
| `frontend/src/App.jsx` | **NEW** — routes + `/doctor` | ~25 lines |
| `frontend/src/utils/apiClient.js` | **NEW** — fetch wrapper + role header | ~40 lines |
| `frontend/src/utils/statusMap.js` | **NEW** — status → label + chip class | ~20 lines |
| `frontend/src/components/RequireDoctor.jsx` | **NEW** — role gate | ~25 lines |
| `frontend/src/hooks/useVisitQueue.js` | **NEW** — polling queue hook | ~45 lines |
| `frontend/src/hooks/useVisitDetail.js` | **NEW** — detail fetch hook | ~40 lines |
| `frontend/src/components/QueueRail.jsx` | **NEW** — left rail | ~70 lines |
| `frontend/src/components/StatusChip.jsx` | **NEW** — chip | ~20 lines |
| `frontend/src/components/PatientHeader.jsx` | **NEW** — demographics header | ~30 lines |
| `frontend/src/components/StatsStrip.jsx` | **NEW** — seen/remaining/Q&A stats | ~35 lines |
| `frontend/src/components/AiSummaryCard.jsx` | **NEW** — mock summary card | ~30 lines |
| `frontend/src/components/QaList.jsx` | **NEW** — Q&A drill-down (Tanglish) | ~45 lines |
| `frontend/src/pages/DoctorDashboardPage.jsx` | **NEW** — composition + Done + states | ~130 lines |
| `frontend/src/assets/doctor.css` | **NEW** — D-01 styles ported | ~180 lines |

**Backend/DB impact:** REAL and additive — new repository/service/controller/route + role guard built on the CLINIC-001 Express+PostgreSQL base, plus one new seed. No schema change to the canonical tables (`visits`, `questions`, `answers`, `summaries`). The AI summary remains MOCK (`generated_by = 'mock'`), read as-is. The static mockup files (`clinic-flow.html`, `index.html`, `Dockerfile`, `docker-compose.yml`) are untouched. No real authentication is introduced — doctor role is asserted via header/param only.

---

## UI Test Setup

| Field | Value |
|-------|-------|
| **App URL** | http://localhost:5173 |
| **Test Route** | `/doctor` |
| **Login as** | doctor role — no real auth; the app attaches `X-Role: doctor` (or `?role=doctor`) on every `/api` request |
| **Test Data** | Run `db/seeds/002_doctor_queue.sql`: ~10 seeded visits in token order across statuses, including **one 'summarised' visit (Token 04, Lakshmi K.)** with a `summaries` row (`generated_by='mock'`) and 5 `answers` containing **Tanglish** transcripts; at least one `done` visit; at least one `answered`-but-not-summarised visit; backend (CLINIC-001) running with the canonical `/api` reachable from the Vite dev proxy |
| **Non-testable ACs** | AC2 partial — surfacing a *newly* summarised patient requires an attender submission (CLINIC-005) or a manual DB status flip mid-session to trigger; the ~5s polling visibly picking it up is observable, the upstream submission is out of this story's UI. AC5 persistence and AC9 (forced network failure / PATCH rollback) need a simulated failure or DB inspection beyond pure UI clicks. |
