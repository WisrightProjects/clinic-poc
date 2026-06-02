# User Story: Foundation / Platform — Backend, DB, Status Engine, Storage & Config

**Story ID:** CLINIC-001
**Epic:** Platform Foundation
**Feature:** Postgres schema + migrations/seeds, layered Express API skeleton, visit status lifecycle engine, local audio storage, env-driven mock toggles, health check, CORS, header-based role separation
**Priority:** P0 (Critical)
**Effort:** 4 days (29 hours)
**Sprint:** Phase 1 — Platform Foundation
**Status:** Ready for Development
**Depends On:** None

---

## Story Overview

**As an** attender using the mobile intake app
**I want** a backend that can create a visit, store recorded audio answers, transcribe them, and submit them to the doctor
**So that** every patient's spoken intake is captured reliably and moved through the queue without manual paperwork

**As a** doctor using the web dashboard
**I want** a backend that exposes a queue of visits by status plus a per-visit summary and full Q&A
**So that** I can review an AI-prepared intake before the patient walks in

---

## Why This Feature?

### Current Gap:
- The repository contains only static HTML mockups (`index.html`, `clinic-flow.html`) and a single-stage `Dockerfile` that serves them via nginx. There is no application code at all.
- There is no database, no API, no audio storage, and no notion of a visit moving through statuses.
- The attender app and doctor dashboard (later stories) have nothing to talk to — every screen in the mockup is currently hard-coded HTML.
- There is no way to toggle between stubbed and real speech-to-text / AI summary, which the POC needs to demo offline.

### Real-World Use Case (Morning Clinic Queue):
At the CarePoint General clinic in Chennai, the attender registers patients as they arrive and assigns each a token (04, 05, 06 ...). For token 04 (Lakshmi K.), the attender asks the 5 fixed intake questions and records each Tanglish answer on the phone. The audio is uploaded, transcribed, and once all 5 are answered the attender submits the visit. The visit flips to `summarised`, a mock AI summary is generated, and Dr. Ramesh sees Lakshmi at the top of his queue with summary + Q&A ready — before she enters the consultation room.

- A visit must move strictly `waiting -> answering -> answered -> summarised -> done`; the attender cannot submit a half-answered visit, and the doctor cannot re-open a closed one.
- Audio files must survive a server restart and be retrievable by path stored on the answer row.
- The same backend must run with no Sarvam key (canned Tanglish transcript) for an offline demo, and with a key for the live demo, controlled by one env var.

This cannot be done with the current static-only implementation.

### Solution:
Build the backend platform that every other CLINIC story depends on:
- **Postgres schema + migrations + idempotent seeds** — all canonical tables, one "General" department, a 5-question template matching the mockup, and ~10 visits across statuses for the doctor-queue demo.
- **Layered Express API skeleton** — controllers -> services -> repositories, business logic only in services, implementing all canonical endpoints under `/api`.
- **Visit status lifecycle engine** — a single source of truth that rejects invalid transitions with a consistent error envelope.
- **Local audio storage** — multipart upload to a disk volume; path persisted to `answers.audio_path`; file served back for playback.
- **Config + mock toggles** — `USE_MOCK_STT` / `USE_MOCK_SUMMARY`, DB connection, Sarvam key, CORS for both clients, `/api/health`, and light role separation via an `x-role` header.

---

## User Personas

### Primary: Priya — The Clinic Attender
- **Role:** Registers walk-in patients, assigns tokens, records spoken answers to the fixed intake questions on the Android app.
- **Goal:** Capture a complete, correct set of answers per patient and hand them to the doctor with zero re-typing.
- **Pain Point:** "If the app lets me send a patient with missing answers, the doctor calls me back and the whole queue jams."

### Secondary: Dr. Ramesh — The General Physician
- **Role:** Reviews the AI summary and full Q&A on the desktop dashboard before each consultation, then closes the visit.
- **Pain Point:** "I need the summary and the patient's own words to be there reliably; if the data is flaky or out of order I stop trusting it."

---

## Detailed Sub-Stories

### Sub-Story 1: Database schema + migrations

**Story ID:** CLINIC-001.1
**Points:** 5 | **Effort:** 5 hours

```gherkin
As a backend developer
I want all canonical tables created by repeatable SQL migrations
So that any teammate can build the full schema from an empty database
```

### Sub-Story 2: Idempotent seed data

**Story ID:** CLINIC-001.2
**Points:** 3 | **Effort:** 4 hours

```gherkin
As a demo presenter
I want one "General" department, a 5-question template, and ~10 visits across statuses seeded idempotently
So that the doctor-queue demo always shows the same realistic data and re-running seeds never duplicates rows
```

### Sub-Story 3: Express app skeleton + config + health + CORS + role header

**Story ID:** CLINIC-001.3
**Points:** 5 | **Effort:** 5 hours

```gherkin
As a backend developer
I want a layered Express app with central config, /api/health, CORS for both clients, and an x-role header guard
So that controllers stay thin and the two front-ends can connect with the correct role
```

### Sub-Story 4: Visit status lifecycle engine

**Story ID:** CLINIC-001.4
**Points:** 5 | **Effort:** 5 hours

```gherkin
As a backend developer
I want one engine that knows every legal status transition
So that invalid transitions are rejected consistently no matter which endpoint triggers them
```

### Sub-Story 5: Visits + departments + templates CRUD endpoints

**Story ID:** CLINIC-001.5
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want to list departments/templates, create a visit, list/get visits by status, and submit a visit
So that the app can drive a patient from registration to doctor hand-off
```

### Sub-Story 6: Audio answer upload + storage + transcription trigger

**Story ID:** CLINIC-001.6
**Points:** 5 | **Effort:** 5 hours

```gherkin
As an attender
I want to upload a recorded answer as multipart audio and have it stored and transcribed
So that the audio path and Tanglish transcript are saved against the question for the doctor to review
```

---

## Acceptance Criteria

### AC1: Migrations run cleanly from an empty database
```gherkin
GIVEN a brand-new empty Postgres database
WHEN the migration runner is executed
THEN all canonical tables (departments, question_templates, questions, visits, answers, summaries) are created with the exact column names and enum types from the data model
AND running the migration runner a second time reports no pending migrations and does not error
```

### AC2: Seeds are reproducible and idempotent
```gherkin
GIVEN a freshly migrated database
WHEN the seed script is run
THEN exactly one "General" department, one active 5-question template, and ~10 visits across statuses exist
AND running the seed script again produces the identical row counts (no duplicates) using ON CONFLICT / existence checks
```

### AC3: Seeded data matches the mockup
```gherkin
GIVEN the seed script has run
WHEN the 5 seeded questions are read in order_index order
THEN they are exactly: "Main complaint today?", "Since how long?", "Any medication taken?", "Any known allergies?", "Past medical history?"
AND token 04 (Lakshmi Krishnamurthy, Female, 34, General) exists with status 'summarised' and a mock summary row
```

### AC4: Valid status transitions are accepted
```gherkin
GIVEN a visit with status 'waiting'
WHEN its status is moved to 'answering', then 'answered', then 'summarised', then 'done'
THEN each transition succeeds and updated_at is refreshed
AND the persisted status reflects the final value 'done'
```

### AC5: Invalid status transitions are rejected
```gherkin
GIVEN a visit with status 'waiting'
WHEN a PATCH /api/visits/:id/status request attempts to set status to 'done'
THEN the request is rejected with HTTP 409
AND the response uses the consistent JSON error envelope { error: { code, message } } with code 'INVALID_TRANSITION'
AND the visit status is unchanged in the database
```

### AC6: First answer flips waiting -> answering
```gherkin
GIVEN a visit with status 'waiting'
WHEN POST /api/visits/:id/answers stores its first answer
THEN the visit status is automatically set to 'answering'
AND the answer row stores audio_path and transcript_status
```

### AC7: Visit auto-advances to answered when all questions answered
```gherkin
GIVEN a visit in status 'answering' with answers for all but one question of its template
WHEN the final question's answer is uploaded
THEN the visit status is automatically set to 'answered'
AND POST /api/visits/:id/submit is now permitted
```

### AC8: Submit generates a mock summary and sets summarised
```gherkin
GIVEN a visit with status 'answered'
WHEN POST /api/visits/:id/submit is called
THEN a summaries row is created with generated_by = 'mock' and a canned English summary string
AND the visit status becomes 'summarised'
AND calling submit on a visit not in 'answered' returns 409 INVALID_TRANSITION
```

### AC9: Audio file is stored and retrievable
```gherkin
GIVEN POST /api/visits/:id/answers with a multipart audio file
WHEN the upload completes
THEN the file is written to the configured local storage volume
AND answers.audio_path holds a path that resolves to the saved file
AND the file is retrievable via GET on the static audio route after a server restart
```

### AC10: Mock STT toggle switches stub vs real
```gherkin
GIVEN USE_MOCK_STT = true (or no SARVAM_API_KEY present)
WHEN an answer is uploaded
THEN transcription returns a canned Tanglish transcript and transcript_status = 'done' without calling Sarvam
AND GIVEN USE_MOCK_STT = false with a key present, the same code path calls the real Sarvam client behind the one SttService interface
```

### AC11: Mock summary toggle is honoured
```gherkin
GIVEN USE_MOCK_SUMMARY = true
WHEN a visit is submitted
THEN the canned English summary is returned from the single SummaryService behind POST /api/visits/:id/submit
AND no external LLM is contacted, so a real local LLM can be dropped in later without changing the endpoint contract
```

### AC12: Role header + CORS + health
```gherkin
GIVEN the API is running
WHEN GET /api/health is called
THEN it returns 200 with { status: 'ok' } and a DB-connectivity flag
AND requests from the attender and doctor client origins pass CORS
AND a request whose x-role header is neither 'attender' nor 'doctor' is rejected with 403 in the consistent error envelope
```

---

## Technical Implementation

> GREENFIELD: the repo currently contains only `index.html`, `clinic-flow.html`, `Dockerfile`, `docker-compose.yml`, `.gitignore`. Every file below is **NEW**.

### Part 1: Database schema + migrations (5 hours)

#### Task 1.1: Create migration for all canonical tables

**File:** `db/migrations/001_init.sql` — **NEW**

Creates enum types and all six canonical tables verbatim.

```sql
-- 001_init.sql — initial ClinicAI schema (canonical names)
CREATE TYPE visit_status AS ENUM ('waiting','answering','answered','summarised','done');
CREATE TYPE transcript_status AS ENUM ('pending','done','failed');

CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE question_templates (
  id            SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questions (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES question_templates(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  text        TEXT NOT NULL
);

CREATE TABLE visits (
  id            SERIAL PRIMARY KEY,
  token_number  INTEGER NOT NULL,
  patient_name  TEXT NOT NULL,
  age           INTEGER,
  sex           TEXT,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  status        visit_status NOT NULL DEFAULT 'waiting',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE answers (
  id                SERIAL PRIMARY KEY,
  visit_id          INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  question_id       INTEGER NOT NULL REFERENCES questions(id),
  audio_path        TEXT,
  transcript        TEXT,
  transcript_status transcript_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (visit_id, question_id)
);

CREATE TABLE summaries (
  id           SERIAL PRIMARY KEY,
  visit_id     INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'mock',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Task 1.2: Minimal migration runner

**File:** `db/run-migrations.js` — **NEW**

A tiny runner that applies any `db/migrations/*.sql` not yet recorded in a `_migrations` table, so AC1's second run is a no-op.

```js
// Applies pending SQL files in lexical order; records each in _migrations.
// Idempotent: already-applied files are skipped.
async function runMigrations(pool) {
  await pool.query('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT name FROM _migrations');
  const applied = new Set(rows.map(r => r.name));
  for (const file of files.filter(f => !applied.has(f))) {
    await pool.query('BEGIN');
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
    await pool.query('INSERT INTO _migrations(name) VALUES ($1)', [file]);
    await pool.query('COMMIT');
  }
}
```

### Part 2: Idempotent seed data (4 hours)

#### Task 2.1: Seed department, template, 5 questions, ~10 visits, summary

**File:** `db/seeds/001_demo.sql` — **NEW**

Uses `ON CONFLICT DO NOTHING` and `WHERE NOT EXISTS` so re-runs add no duplicates (AC2). Questions and queue data match the mockup (AC3).

```sql
INSERT INTO departments (id, name) VALUES (1, 'General')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO question_templates (id, department_id, name, is_active)
  SELECT 1, 1, 'General Intake', true
  WHERE NOT EXISTS (SELECT 1 FROM question_templates WHERE id = 1);

INSERT INTO questions (template_id, order_index, text) VALUES
  (1, 1, 'Main complaint today?'),
  (1, 2, 'Since how long?'),
  (1, 3, 'Any medication taken?'),
  (1, 4, 'Any known allergies?'),
  (1, 5, 'Past medical history?')
  ON CONFLICT DO NOTHING;  -- relies on a uniqueness guard / pre-truncate per seed policy

-- ~10 visits across statuses for the doctor queue (tokens 04-13)
INSERT INTO visits (token_number, patient_name, age, sex, department_id, status)
  SELECT v.* FROM (VALUES
    (4,  'Lakshmi Krishnamurthy', 34, 'Female', 1, 'summarised'),
    (5,  'Arun M.',               41, 'Male',   1, 'waiting'),
    (6,  'Deepa N.',              28, 'Female', 1, 'waiting'),
    (7,  'Suresh P.',             52, 'Male',   1, 'answering'),
    (8,  'Kavitha R.',            36, 'Female', 1, 'answered'),
    (9,  'Bala S.',               45, 'Male',   1, 'waiting'),
    (10, 'Nithya K.',             30, 'Female', 1, 'waiting'),
    (11, 'Ravi T.',               60, 'Male',   1, 'done'),
    (12, 'Meena V.',              22, 'Female', 1, 'summarised'),
    (13, 'Gopal R.',              48, 'Male',   1, 'answered')
  ) AS v(token_number, patient_name, age, sex, department_id, status)
  WHERE NOT EXISTS (SELECT 1 FROM visits WHERE token_number = v.token_number);

-- canned mock summary for token 04 (matches clinic-flow.html D-01)
INSERT INTO summaries (visit_id, summary_text, generated_by)
  SELECT id,
    'Patient (F/34) presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes. Requires physical examination. Consider CBC and fever panel.',
    'mock'
  FROM visits v WHERE v.token_number = 4
  AND NOT EXISTS (SELECT 1 FROM summaries s WHERE s.visit_id = v.id);
```

### Part 3: Express app skeleton + config + health + CORS + role (5 hours)

#### Task 3.1: Central config with mock toggles

**File:** `backend/src/config/index.js` — **NEW**

```js
// Single source of env config. USE_MOCK_STT defaults true when no key present.
module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  sarvamApiKey: process.env.SARVAM_API_KEY || null,
  useMockStt: process.env.USE_MOCK_STT === 'true' || !process.env.SARVAM_API_KEY,
  useMockSummary: process.env.USE_MOCK_SUMMARY !== 'false', // mock by default this phase
  audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
```

**File:** `backend/.env.example` — **NEW** (DATABASE_URL, SARVAM_API_KEY, USE_MOCK_STT, USE_MOCK_SUMMARY, AUDIO_DIR, CORS_ORIGINS, PORT).

#### Task 3.2: App bootstrap — CORS, JSON error envelope, health, role guard

**File:** `backend/src/app.js` — **NEW**
**File:** `backend/src/server.js` — **NEW** (binds port, runs migrations on boot)

```js
// app.js — wiring only; no business logic here.
const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());
app.use('/api', routes);                       // all canonical endpoints
app.use('/audio', express.static(config.audioDir)); // AC9 retrieval
app.use(errorHandler);                          // consistent { error: { code, message } }
```

**File:** `backend/src/utils/errors.js` — **NEW** (`AppError(code, message, httpStatus)` + `errorHandler` middleware producing the canonical envelope).

**File:** `backend/src/utils/roleGuard.js` — **NEW**

```js
// Light role separation: client declares role via header, no real auth this phase.
const ROLES = ['attender', 'doctor'];
function roleGuard(req, _res, next) {
  req.role = req.header('x-role');
  if (!ROLES.includes(req.role)) throw new AppError('FORBIDDEN', 'Unknown or missing role', 403);
  next();
}
```

**File:** `backend/src/controllers/healthController.js` — **NEW** (`GET /api/health` -> `{ status:'ok', db:<bool> }`).

#### Task 3.3: DB pool + base repository

**File:** `backend/src/config/db.js` — **NEW** (pg `Pool` from `databaseUrl`).

### Part 4: Visit status lifecycle engine (5 hours)

#### Task 4.1: Transition table + guard

**File:** `backend/src/services/statusEngine.js` — **NEW**

The single source of truth used by every status change (AC4, AC5).

```js
// Allowed forward transitions only. Any pair not listed is rejected.
const TRANSITIONS = {
  waiting:    ['answering'],
  answering:  ['answered'],
  answered:   ['summarised'],
  summarised: ['done'],
  done:       [],
};
function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move visit from ${from} to ${to}`, 409);
  }
}
module.exports = { TRANSITIONS, assertTransition };
```

### Part 5: Visits / departments / templates endpoints (5 hours)

#### Task 5.1: Routes (canonical paths, verbatim)

**File:** `backend/src/routes/index.js` — **NEW**

```js
router.get('/health', healthController.check);
router.get('/departments', departmentController.list);
router.get('/templates', templateController.list);      // ?departmentId=
router.post('/templates', templateController.create);
router.put('/templates/:id', templateController.update);
router.post('/visits', visitController.create);
router.get('/visits', visitController.list);            // ?status=
router.get('/visits/:id', visitController.getById);
router.post('/visits/:id/answers', upload.single('audio'), answerController.create);
router.patch('/visits/:id/status', visitController.updateStatus);
router.post('/visits/:id/submit', visitController.submit);
```

#### Task 5.2: Thin controllers -> services -> repositories

**Files (all NEW):**
- `backend/src/controllers/visitController.js` — parses input, calls `visitService`, returns JSON.
- `backend/src/controllers/templateController.js`, `backend/src/controllers/departmentController.js`, `backend/src/controllers/answerController.js`.
- `backend/src/services/visitService.js` — create/list/get; `updateStatus` calls `statusEngine.assertTransition`; `submit` enforces `answered -> summarised` and invokes `summaryService`.
- `backend/src/services/templateService.js`, `backend/src/services/departmentService.js`.
- `backend/src/repositories/visitRepository.js`, `templateRepository.js`, `departmentRepository.js`, `answerRepository.js`, `summaryRepository.js` — all SQL lives here.
- `backend/src/models/index.js` — shared row-shape JSDoc typedefs.

```js
// visitService.submit — business rule lives in the service, not the controller.
async function submit(visitId) {
  const visit = await visitRepository.findById(visitId);
  statusEngine.assertTransition(visit.status, 'summarised');   // 409 if not 'answered'
  const text = await summaryService.generate(visitId);          // mock this phase
  await summaryRepository.create(visitId, text, 'mock');
  return visitRepository.updateStatus(visitId, 'summarised');
}
```

### Part 6: Audio upload + storage + transcription trigger (5 hours)

#### Task 6.1: Multipart upload to disk volume

**File:** `backend/src/config/upload.js` — **NEW** (multer disk storage to `config.audioDir`, filename `visit-<id>-q<questionId>-<ts>.<ext>`).

#### Task 6.2: Answer service — store path, trigger STT, auto-advance status

**File:** `backend/src/services/answerService.js` — **NEW**

```js
async function recordAnswer(visitId, questionId, file) {
  const audioPath = path.relative(config.audioDir, file.path); // stored in answers.audio_path (AC9)
  const answer = await answerRepository.upsert(visitId, questionId, audioPath, 'pending');
  const transcript = await sttService.transcribe(file.path);   // stub or Sarvam (AC10)
  await answerRepository.setTranscript(answer.id, transcript, 'done');
  await visitService.maybeAdvance(visitId);                    // waiting->answering / ->answered
  return answerRepository.findById(answer.id);
}
```

#### Task 6.3: STT + Summary services behind one interface each

**File:** `backend/src/services/sttService.js` — **NEW** (one `transcribe()`; returns canned Tanglish e.g. `"Fever iruku, 3 days-a aachu..."` when `config.useMockStt`, else calls Sarvam — AC10).
**File:** `backend/src/services/summaryService.js` — **NEW** (one `generate()`; returns canned English summary when `config.useMockSummary` — AC11; real local LLM drops in later without changing `POST /api/visits/:id/submit`).
**File:** `backend/src/utils/stt/sarvamClient.js` — **NEW** (real Sarvam HTTP call, only used when key present).

---

## File Summary

| File | Action | Approximate Lines |
|------|--------|-------------------|
| `db/migrations/001_init.sql` | **NEW** | ~70 lines |
| `db/run-migrations.js` | **NEW** | ~45 lines |
| `db/seeds/001_demo.sql` | **NEW** | ~70 lines |
| `db/run-seeds.js` | **NEW** | ~30 lines |
| `backend/src/config/index.js` | **NEW** | ~30 lines |
| `backend/src/config/db.js` | **NEW** | ~20 lines |
| `backend/src/config/upload.js` | **NEW** | ~30 lines |
| `backend/.env.example` | **NEW** | ~12 lines |
| `backend/src/app.js` | **NEW** | ~45 lines |
| `backend/src/server.js` | **NEW** | ~25 lines |
| `backend/src/routes/index.js` | **NEW** | ~30 lines |
| `backend/src/utils/errors.js` | **NEW** | ~45 lines |
| `backend/src/utils/roleGuard.js` | **NEW** | ~20 lines |
| `backend/src/services/statusEngine.js` | **NEW** | ~30 lines |
| `backend/src/services/visitService.js` | **NEW** | ~120 lines |
| `backend/src/services/answerService.js` | **NEW** | ~70 lines |
| `backend/src/services/sttService.js` | **NEW** | ~45 lines |
| `backend/src/services/summaryService.js` | **NEW** | ~40 lines |
| `backend/src/services/templateService.js` | **NEW** | ~60 lines |
| `backend/src/services/departmentService.js` | **NEW** | ~25 lines |
| `backend/src/utils/stt/sarvamClient.js` | **NEW** | ~50 lines |
| `backend/src/controllers/healthController.js` | **NEW** | ~25 lines |
| `backend/src/controllers/visitController.js` | **NEW** | ~80 lines |
| `backend/src/controllers/answerController.js` | **NEW** | ~35 lines |
| `backend/src/controllers/templateController.js` | **NEW** | ~45 lines |
| `backend/src/controllers/departmentController.js` | **NEW** | ~20 lines |
| `backend/src/repositories/visitRepository.js` | **NEW** | ~110 lines |
| `backend/src/repositories/answerRepository.js` | **NEW** | ~70 lines |
| `backend/src/repositories/templateRepository.js` | **NEW** | ~80 lines |
| `backend/src/repositories/departmentRepository.js` | **NEW** | ~25 lines |
| `backend/src/repositories/summaryRepository.js` | **NEW** | ~35 lines |
| `backend/src/models/index.js` | **NEW** | ~40 lines |
| `backend/package.json` | **NEW** | ~30 lines |

**Backend/database impact:** This story IS the backend and database. It creates the entire Postgres schema (6 canonical tables + 2 enums), the migration/seed tooling, and the full layered Express API. No existing app code is modified (the static mockups and Docker files are untouched). Every file in this story is new. All files stay well under the 600-line limit; services are split per domain to keep controllers thin.

---

## UI Test Setup

> This is a backend-only story. Most ACs are API / non-UI testable; verification is via curl, the migration/seed scripts, and `/api/health`. There is no app route to open.

| Field | Value |
|-------|-------|
| **App URL** | http://localhost:4000 (API base: `http://localhost:4000/api`) |
| **Test Route** | None (no UI). Verify via `GET http://localhost:4000/api/health` |
| **Login as** | No real auth — send header `x-role: attender` or `x-role: doctor` |
| **Test Data** | Run `node db/run-migrations.js` then `node db/run-seeds.js`; gives "General" dept, 5-question template, visits tokens 04-13 across statuses, token 04 mock summary |
| **Non-testable ACs (UI)** | All ACs are backend; none verifiable through a UI in this story. Use the curl checks below. |

### Verification commands (curl)

```bash
# AC1: migrations clean from empty DB, second run is a no-op
node db/run-migrations.js && node db/run-migrations.js

# AC2/AC3: idempotent seeds; re-run gives identical counts; questions match mockup
node db/run-seeds.js && node db/run-seeds.js

# AC12: health + DB flag
curl http://localhost:4000/api/health

# AC12: bad role rejected (403, error envelope)
curl -s -H "x-role: hacker" http://localhost:4000/api/visits

# AC5: invalid transition rejected (409 INVALID_TRANSITION)
curl -s -X PATCH http://localhost:4000/api/visits/5/status \
  -H "x-role: attender" -H "Content-Type: application/json" \
  -d '{"status":"done"}'

# AC9/AC6/AC10: upload audio answer -> stored path, transcript, status flips
curl -s -X POST http://localhost:4000/api/visits/5/answers \
  -H "x-role: attender" -F "questionId=1" -F "audio=@sample.m4a"

# AC9: retrieve stored audio after restart
curl -s http://localhost:4000/audio/<audio_path_from_answer>

# AC8/AC11: submit answered visit -> mock summary + summarised
curl -s -X POST http://localhost:4000/api/visits/8/submit -H "x-role: attender"
```
