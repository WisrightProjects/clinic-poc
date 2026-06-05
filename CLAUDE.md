# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClinicAI is a POC for an AI-powered patient intake and voice transcription system for clinics in India (Tamil/English). The project is **greenfield** — currently only static HTML mockups and user story documents exist. No application code has been written yet.

## Running the Current Mockup

```bash
docker-compose up --build   # Serves static HTML at http://localhost:3030
```

No package.json or npm scripts exist yet. Once backend/mobile/web are scaffolded per the user stories, commands will be added.

## Planned Architecture (from `docs/stories/`)

The system has three components built in dependency order:

1. **Backend** (`backend/`) — Express.js + Node.js, PostgreSQL, Multer for audio uploads. Entry: `src/server.js` binds port, runs migrations on boot.
2. **Mobile App** (`attender-app/`) — React Native (Expo), Android-first. Used by clinic attenders to record patient voice answers.
3. **Doctor Web** (`doctor-web/`) — React + Vite. Used by doctors to review AI-generated summaries and Q&A transcripts.

### Backend Layering

Controllers → parse HTTP only. Services → business logic and transactions. Repositories → pure SQL. Utils → cross-cutting concerns.

```
backend/src/
├── routes/          # Express routers, /api/* canonical paths
├── controllers/     # Input parsing, response shaping — no business logic
├── services/        # Orchestration, validation, status transitions
├── repositories/    # SQL queries — no business rules
├── models/          # JSDoc typedefs
└── utils/
    ├── errors.js         # Consistent { error: { code, message } } envelope
    ├── roleGuard.js      # x-role header enforcement (attender | doctor)
    ├── statusEngine.js   # visit_status enum state machine
    └── stt/sarvamClient.js  # Sarvam AI wrapper (stubbable via USE_MOCK_STT)
```

### Database Schema (PostgreSQL)

Key enums: `visit_status` (`waiting` → `answering` → `answered` → `summarised` → `done`), `transcript_status` (`pending` | `done` | `failed`).

Core tables: `departments`, `question_templates`, `questions`, `visits`, `answers`, `summaries`.

Migrations live in `db/migrations/`, run via `node db/run-migrations.js`. Seeds use `ON CONFLICT DO NOTHING` for idempotency.

### Auth Pattern

No real auth in this phase. Role is passed via `x-role: attender` or `x-role: doctor` HTTP header. The `roleGuard` middleware rejects unknown roles with 403.

### External API: Sarvam AI (Speech-to-Text)

The STT call is wrapped in `utils/stt/sarvamClient.js`. Setting `USE_MOCK_STT=true` in the environment bypasses the real API and returns a fixture transcript — use this for offline demos.

Similarly, `USE_MOCK_SUMMARY=true` stubs the AI summary generation.

## User Stories

All planned features are documented in `docs/stories/`. Read these before implementing any feature — they contain acceptance criteria, API contracts, and DB schema details:

| Story | Component | Key Concern |
|---|---|---|
| `CLINIC-001` | Backend | Express scaffold, PostgreSQL schema, migrations, audio upload, status engine |
| `CLINIC-002` | Mobile | Question template settings screen |
| `CLINIC-003` | Mobile | Patient intake question list, token assignment |
| `CLINIC-004` | Mobile | Voice recording, multipart upload, STT transcription |
| `CLINIC-005` | Mobile | Attender review + AI summary preview + submit |
| `CLINIC-006` | Web | Doctor queue + patient detail dashboard |

CLINIC-001 is a hard prerequisite for everything else.

## Key Design Rules (from stories)

- All API responses use `{ error: { code, message } }` on failure — never plain strings.
- Status transitions are enforced server-side via `statusEngine.js`; invalid transitions return 409.
- Seed data and migrations must be idempotent (re-runnable without side effects).
- Mobile app screens must resume gracefully mid-flow (e.g., recording screen reloads existing answers from the server).
- The mockup HTML files (`index.html`, `clinic-flow.html`) are the visual reference for all UI work — consult them before building any screen.
