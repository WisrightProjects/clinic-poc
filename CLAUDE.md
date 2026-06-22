# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClinicAI is a POC for an AI-powered patient intake and voice transcription system for clinics in India (Tamil/English). An attender records patients' spoken answers on a mobile app; the backend transcribes them (Sarvam AI STT) and generates an AI summary; doctors review the summary and Q&A transcript on a web dashboard.

The repo is a **monorepo with four independently-installed Node projects** plus shared DB/scripts tooling. There is no root install that wires them together — each app has its own `package.json` and `node_modules`. The stories in `docs/stories/` (CLINIC-001…006) are implemented; treat them as the spec when changing behavior.

## Layout

| Path | What it is | Stack |
|---|---|---|
| `backend/` | API server | Express 4 + PostgreSQL (`pg`), Multer audio upload |
| `mobile/` | Attender app (Android-first) | React Native 0.85 + Expo 56, React Navigation |
| `frontend/` | Doctor web dashboard | React 19 + Vite 8, React Router 7 |
| `db/` | Migrations, seeds, runners | plain SQL + `pg` |
| `scripts/` | Findings-triage pipeline tooling | Node ESM, no deps |
| root | Shared jest config for cross-cutting tests, `db` npm scripts | — |
| `index.html`, `clinic-flow.html` | Original static mockups — the **visual reference** for all UI | — |

> The mockup HTML is the source of truth for visual design — consult it before building or changing any screen. `docker-compose up --build` still serves the mockups at http://localhost:3030 (unrelated to the running apps).

## Running the stack locally

Bring up Postgres, then run each app from its own directory. Order matters: backend first (everything depends on it).

```bash
# 0. Postgres must be running with a `clinic_poc` database.
#    Connection comes from backend/.env (DATABASE_URL). Copy backend/.env.example -> backend/.env.

# 1. Backend (port 4000). Runs pending migrations on boot automatically.
cd backend && npm install && npm run dev      # nodemon; `npm start` for plain node

# 2. Seed demo data (idempotent). Run from REPO ROOT — db scripts read backend/.env.
npm run migrate   # usually redundant: server.js migrates on boot
npm run seed

# 3. Doctor web (port 5173). Proxies /api -> :4000, so no CORS in dev.
cd frontend && npm install && npm run dev

# 4. Mobile (Expo). Talks to the backend at http://10.0.2.2:4000/api (Android emulator
#    loopback). Override with EXPO_PUBLIC_API_URL for a device/tunnel.
cd mobile && npm install && npm start          # or: npm run android
```

Key env (`backend/.env`, see `backend/.env.example`): `DATABASE_URL`, `PORT=4000`, `STT_PROVIDER` (`whisper`|`sarvam`, default `whisper`), `WHISPER_URL`, `STT_LANGUAGE`, `USE_MOCK_SUMMARY=true`, `AUDIO_DIR`, `CORS_ORIGINS`. `config/index.js` throws on boot if `DATABASE_URL` is missing. `STT_PROVIDER=whisper` needs the `stt-service/` sidecar running (see its README).

## Tests

There are **three separate jest setups** — running `npm test` in the wrong place runs the wrong suite:

```bash
# Root: cross-cutting pure-logic tests. testMatch is restricted to __tests__/clinic003*.test.js
npm test                                  # from repo root
npm test -- -t "progress"                 # single test by name

# Backend unit tests (e.g. visit validation)
cd backend && npm test

# Frontend lint (no test runner configured)
cd frontend && npm run lint
```

Note the root `package.json` jest `testMatch` only picks up `clinic003*` files. The convention here is to test **pure logic extracted from hooks/utils** (the root test re-derives `useQuestionList.js`'s view-model math as a standalone function and references the mirrored line range) — so when you change derivation logic in a hook, update the mirrored test. Tests deliberately avoid a React runtime, a live DB, or network mocking.

## Backend architecture

Strict 4-layer separation — keep each layer's responsibility pure:

```
routes/        Express routers. /api/* canonical paths. roleGuard applied after /health.
controllers/   HTTP parse + response shaping only. No business logic.
services/      Orchestration, validation, status transitions, transactions.
repositories/  SQL only. No business rules.
utils/         errors.js (envelope + errorHandler), roleGuard.js, validation helpers.
config/        index.js (env), db.js (pool), upload.js (multer).
```

- Route handlers are wrapped with a `wrap(fn)` promise-catch adapter in `routes/index.js` so async errors reach the central `errorHandler`. New routes must use `wrap`.
- Errors: throw `AppError(code, message, httpStatus)` from `utils/errors.js`. The handler emits `{ error: { code, message } }` — **never** plain-string errors. Clients (both apps) read `error.message` off this shape.
- `app.js` wiring order: `cors(config.corsOrigins)` → `express.json()` → static `/audio` (serves `AUDIO_DIR`) → `/api` routes → `errorHandler` last.
- Server entry `server.js` runs migrations (own pool) **before** `app.listen`.

### Status engine

`services/statusEngine.js` is the single source of truth for the visit lifecycle. `assertTransition(from, to)` throws `INVALID_TRANSITION` (HTTP 409) for anything not in the table:

```
waiting → answering → answered → summarised → done   (done is terminal)
```

Never mutate `visits.status` in a repository/service without going through `assertTransition`. The two client apps mirror this state machine (`frontend/src/utils/statusMap.js`, mobile status display) — keep them consistent.

### API surface (all under `/api`, all require `x-role` except `/health`)

```
GET   /health
GET   /departments
GET   /templates            PUT /templates/:id
POST  /visits               GET /visits   (?status=csv)   GET /visits/:id
POST  /visits/:id/answers   (multipart, field "audio" — Multer; triggers STT)
PATCH /visits/:id/status    POST /visits/:id/submit
```

`GET /visits/:id` returns `{ visit, template, answers, summary }` (the shape the doctor web consumes).

### Auth (POC only)

No real auth. Role travels in the `x-role: attender|doctor` header; `utils/roleGuard.js` rejects unknown roles with 403 and is mounted **after** `/health` so health checks stay open. Mobile hard-codes `x-role: attender` (`mobile/src/api/client.js`); doctor web hard-codes `x-role: doctor` (`frontend/src/utils/apiClient.js`).

### STT / Summary

`services/sttService.js` dispatches on `STT_PROVIDER` (`whisper` | `sarvam`, default `whisper`):
- **whisper** (free, open-source) → `utils/stt/whisperClient.js` POSTs the audio to the
  `stt-service/` faster-whisper sidecar (`WHISPER_URL`, default `http://localhost:8000`). The
  sidecar must be running — start it with `docker compose -f docker-compose.stt.yml up` or per
  `stt-service/README.md`. `STT_LANGUAGE` (default `auto`) controls language detection (`ta`/`hi`/`en`).
- **sarvam** (paid) → `utils/stt/sarvamClient.js`, needs `SARVAM_API_KEY`.

There is **no STT mock** — a provider must be running to transcribe; if none responds, the answer
is saved with `transcript_status='failed'` (handled in `answerService`, no crash).

`services/summaryService.js` dispatches on `SUMMARY_PROVIDER` (`mock` | `ollama`, default `mock`):
- **mock** → one canned paragraph (no LLM call).
- **ollama** (free, open-source) → `utils/summary/ollamaClient.js` builds a prompt from the visit's
  real Q&A (`utils/summary/prompt.js`) and calls a local Ollama server (`OLLAMA_URL`, `OLLAMA_MODEL`);
  output language via `SUMMARY_LANGUAGE` (default English, even from Tamil answers).

`generated_by` on the `summaries` row is the provider name; a provider error falls back to the canned
text marked `mock-fallback` so submit never breaks. Paid providers (`claude`/`sarvam` LLM) plug into
the same `summaryService` switch later (see `docs/stories/CLINIC-007`).

## Database

PostgreSQL. Enums: `visit_status` (see status engine), `transcript_status` (`pending|done|failed`). Core tables: `departments`, `question_templates`, `questions`, `visits`, `answers`, `summaries`.

- Migrations: `db/migrations/NNN_*.sql`, applied in filename sort order, tracked in a `_migrations` table, each wrapped in a transaction. Runner: `db/run-migrations.js` (also invoked from `server.js`). **Migrations are forward-only and must be idempotent** — append a new numbered file, don't edit an applied one.
- Seeds: `db/seeds/`, run via `db/run-seeds.js`; use `ON CONFLICT DO NOTHING` so they're re-runnable.
- Both runners load `backend/.env` for `DATABASE_URL`, so run the `migrate`/`seed` npm scripts from the **repo root**.

## Client conventions

- **Mobile**: Expo 56 / RN 0.85 — these are recent, breaking versions. Per `mobile/AGENTS.md`, read the exact versioned docs at `https://docs.expo.dev/versions/v56.0.0/` before writing Expo/RN code; don't assume older API shapes. Navigation is a single native-stack in `src/navigation/AppNavigator.js`; screens map 1:1 to CLINIC stories. Screens must **resume mid-flow** by reloading server state (e.g. the recording screen rehydrates existing answers).
- **Doctor web**: all backend calls go through `src/utils/apiClient.js` (fetch wrapper that attaches the role header, unwraps `error.message`, treats 204 as null). Data flows through hooks (`useVisitQueue`, `useVisitDetail`). Don't call `fetch` directly from components.

## Findings-triage pipeline (`scripts/`, `*-FINDINGS.md`)

`SECURITY-FINDINGS.md` and `REVIEW-FINDINGS.md` are version-controlled triage tables (columns: `ID | Story | Source | Severity | Effort | Status | Location | Note`). `scripts/findings-merge.mjs` is the **only** writer (atomic, lock-serialized, never reuses an ID, never overwrites a hand-edited Status). `scripts/findings-rollup.mjs` prints everything still actionable (`Status` = Open / Recommend-soon). When triaging, edit the `Status` column by hand; let the merge script append new rows.

## Stories (specs)

Read the relevant `docs/stories/CLINIC-00X-*.md` before changing a feature — they carry acceptance criteria (the `AC#` tags referenced in tests), API contracts, and schema detail.

| Story | Component | Concern |
|---|---|---|
| CLINIC-001 | Backend | Express scaffold, schema, migrations, audio upload, status engine (prereq for all) |
| CLINIC-002 | Mobile | Question template settings |
| CLINIC-003 | Mobile | Patient intake question list, token assignment |
| CLINIC-004 | Mobile | Voice recording, multipart upload, STT |
| CLINIC-005 | Mobile | Attender review + AI summary preview + submit |
| CLINIC-006 | Web | Doctor queue + patient detail dashboard |
