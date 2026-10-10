# User Story: Clinics & Logins — each clinic sees only its own patients

**Story ID:** CLINIC-008
**Epic:** Trial Readiness
**Feature:** Turn the single shared POC into a multi-clinic system: every patient, token and question template belongs to a clinic, and every doctor and attender signs in with their own mobile number + password, seeing only their own clinic's data.
**Priority:** P0 (Blocker for the 10-doctor trial)
**Effort:** 7 days (56 hours)
**Who:** 👨‍💻 **Senior** leads (008.1–008.3 + release) · 🧑‍🎓 **Junior** (008.4–008.6, once the login API works)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development
**Depends On:** CLINIC-001 (schema, migrations, status engine), CLINIC-002 (templates), CLINIC-006 (doctor dashboard)
**Blocks:** CLINIC-011 (report upload), CLINIC-012 (doctor edit) — both need `clinic_id` and the logged-in user.
**Migration number reserved:** `006_clinics_and_users.sql`

> **Decided (manager, 2026-10-10):** for this POC, **1 doctor = 1 clinic**, and each clinic has **1 attender** using **1 clinic phone**. After login, each user lands in their own clinic.
> **Later (not in this story):** one doctor across multiple clinics (`user_clinics` link table + clinic switcher), and **family groups** (one patient record linked to family members). Keep `users.clinic_id` and the patient fields simple now, but don't hard-code "one clinic" anywhere outside the auth token, so these can be added without a rewrite.

---

## Story Overview

**As a** clinic owner joining the trial
**I want** my clinic's patients, tokens and questions kept separate from the other trial clinics
**So that** my patients' data is private and my token numbers start at 1 every morning

**As a** doctor or attender
**I want** to sign in with my mobile number and a password, and stay signed in
**So that** only I can see my clinic's patients, and I don't have to sign in every day

**As the** product owner
**I want** to create clinics and accounts myself with a script
**So that** onboarding 10 trial clinics doesn't need a sign-up screen

---

## Why This Feature?

### Current Gap
- **There is no login.** The role travels in an `x-role` header that anyone can set (`backend/src/utils/roleGuard.js`). The mobile app hard-codes `attender` (`mobile/src/api/client.js`), the doctor web hard-codes `doctor` (`frontend/src/utils/apiClient.js`), and `RequireDoctor.jsx` even accepts a `?role=` URL override.
- **One shared queue.** `GET /api/visits` returns every visit in the database. With 10 clinics, every attender and doctor would see every clinic's patients.
- **One shared token counter.** `visitRepository.createWithToken` takes one global advisory lock and allocates `MAX(token_number) + 1` across *all* visits today; the unique index is `(token_number, visit_date)`. Clinic B's first patient would get Token 4 if Clinic A registered three.
- **One shared set of questions.** Editing the Physician template in Settings changes it for every clinic.
- **Voice recordings are public.** `app.js` serves `/audio` statically **before** `/api` and the role guard, so anyone with a file URL can download a patient's recording.

### Real-World Use Case (Trial, Day 1)
Two trial clinics go live on the same morning. Clinic A's attender, Priya, registers three patients. At Clinic B, Kavitha registers her first patient — the app gives him **Token 4**, and her queue shows Priya's three patients too. Dr. Ramesh at Clinic B opens the dashboard and sees a stranger's chest-pain history. The trial stops on day one.
With this story, Kavitha's first patient is **Token 1**, her queue shows only Clinic B, and Dr. Ramesh signs in and sees only his own patients.

### Solution
- New `clinics` and `users` tables. A user has a mobile number, a hashed password, a role (`doctor` | `attender`) and one clinic.
- `visits` and `question_templates` get a `clinic_id`. Departments stay global (Physician, Gynaecologist, …); **each clinic gets its own copy of the templates**, so questions are editable per clinic.
- Login returns a signed token (JWT, 30-day expiry). Every `/api` request is authenticated, and every query is scoped to the user's clinic.
- `x-role` is removed; the role comes from the signed-in user.
- A script creates a clinic (copying the default templates) and its users.

---

## User Personas

### Primary: Priya — Clinic Attender
- **Role:** Registers patients and records answers on the clinic's Android phone.
- **Goal:** Open the app and start working; see only her clinic's queue.
- **Pain Point:** "Why are there patients from another clinic in my queue, and why does my first token say 4?"

### Secondary: Dr. Ramesh — Physician (trial doctor)
- **Role:** Reviews his patients on a laptop or phone before each consultation.
- **Goal:** Trust that only he and his staff can see his patients' data.
- **Pain Point:** "Anyone with the link can open the dashboard. I can't put real patients in that."

### Tertiary: Product Owner — onboarding trial clinics
- **Role:** Sets up 10 clinics and their staff for the trial.
- **Goal:** Create a clinic and its accounts in minutes, and reset a forgotten password.

---

## Detailed Sub-Stories

### Sub-Story 1: Clinics, users and clinic-scoped data (schema)
**Story ID:** CLINIC-008.1
**Points:** 5 | **Effort:** 1.5 days | **Who:** 👨‍💻 Senior
```gherkin
As the product owner
I want every visit and template to belong to a clinic, and users to belong to one clinic
So that data can be separated per clinic without losing what is already in production
```

### Sub-Story 2: Login API + authentication on every request
**Story ID:** CLINIC-008.2
**Points:** 5 | **Effort:** 1.5 days | **Who:** 👨‍💻 Senior
```gherkin
As a doctor or attender
I want to sign in with my mobile number and password and get a long-lived session
So that the backend knows who I am and which clinic I belong to
```

### Sub-Story 3: Clinic-scoped endpoints, tokens and audio
**Story ID:** CLINIC-008.3
**Points:** 5 | **Effort:** 1.5 days | **Who:** 👨‍💻 Senior
```gherkin
As a clinic user
I want every list, read and write to be limited to my clinic
So that I can never see or change another clinic's patients, questions or recordings
```

### Sub-Story 4: Mobile app login
**Story ID:** CLINIC-008.4
**Points:** 3 | **Effort:** 1 day | **Who:** 🧑‍🎓 Junior (after 008.2)
```gherkin
As an attender
I want a login screen, to stay signed in for 30 days, and a logout button
So that the clinic phone opens straight into my clinic, and can be signed out if the phone changes hands
```

### Sub-Story 5: Doctor web login
**Story ID:** CLINIC-008.5
**Points:** 2 | **Effort:** 0.5 day | **Who:** 🧑‍🎓 Junior (after 008.2)
```gherkin
As a doctor
I want a login page on the dashboard that works on my laptop and phone
So that only I can open my patients' information
```

### Sub-Story 6: Account-setup script
**Story ID:** CLINIC-008.6
**Points:** 2 | **Effort:** 0.5 day | **Who:** 🧑‍🎓 Junior (after 008.1)
```gherkin
As the product owner
I want a command to create a clinic with its users, and to reset a password
So that I can onboard trial clinics without building an admin screen
```

---

## Acceptance Criteria

### AC1: Existing data is kept and assigned to a default clinic
```gherkin
GIVEN a database that already has visits, templates and answers (production today)
WHEN migration 006 runs
THEN a clinic named 'Default Clinic' exists
AND every existing visit and template has clinic_id set to it
AND no visit, answer or summary is lost
AND running the migration again changes nothing (idempotent)
```

### AC2: Login with mobile number and password
```gherkin
GIVEN a user with mobile '9876543210' and a password set by the setup script
WHEN POST /api/auth/login is called with the correct mobile and password
THEN the response is 200 with { token, user: { id, name, role, clinic: { id, name } } }
AND the token expires after 30 days
WHEN the password is wrong or the mobile is unknown
THEN the response is 401 with { error: { code: 'INVALID_LOGIN', message } }
AND the message does not reveal which of the two was wrong
```

### AC3: Every /api route except /health and /auth/login requires a valid token
```gherkin
GIVEN no Authorization header, an expired token, or a tampered token
WHEN any /api route other than GET /health or POST /auth/login is called
THEN the response is 401 with { error: { code: 'UNAUTHENTICATED', message } }
AND the x-role header is ignored (it no longer grants access)
```

### AC4: Lists only show the user's own clinic
```gherkin
GIVEN Clinic A has 3 visits today and Clinic B has 2
WHEN a Clinic B user calls GET /api/visits
THEN exactly Clinic B's 2 visits are returned
AND GET /api/templates returns only Clinic B's templates
```

### AC5: Another clinic's record looks like it does not exist
```gherkin
GIVEN visit 41 belongs to Clinic A
WHEN a Clinic B user calls GET /api/visits/41, POST /api/visits/41/answers,
     POST /api/visits/41/submit or PATCH /api/visits/41/status
THEN the response is 404 NOT_FOUND (not 403, so ids can't be probed)
AND the same applies to PUT /api/templates/:id for another clinic's template
```

### AC6: Tokens restart at 1 per clinic per day
```gherkin
GIVEN Clinic A has already registered tokens 1, 2 and 3 today
WHEN Clinic B registers its first patient today
THEN that patient gets token 1
AND two clinics registering at the same moment never get an error or a duplicate within a clinic
```

### AC7: Each clinic edits its own questions
```gherkin
GIVEN Clinic A and Clinic B both have a Physician template
WHEN Clinic A's attender edits a Physician question in Settings
THEN Clinic B's Physician questions are unchanged
```

### AC8: Roles are enforced
```gherkin
GIVEN a signed-in attender
WHEN they call PATCH /api/visits/:id/status with { status: 'done' } (a doctor action)
THEN the response is 403 FORBIDDEN
GIVEN a signed-in doctor
WHEN they open the doctor dashboard
THEN they see their clinic's queue; an attender account cannot sign in to the doctor dashboard
```

### AC9: Recordings are no longer public
```gherkin
GIVEN an answer with a stored recording
WHEN the file is requested without a valid token, or by a user of another clinic
THEN it is not returned (401 / 404)
AND the old public /audio/<file> path no longer serves files
```

### AC10: Mobile stays signed in and can sign out
```gherkin
GIVEN an attender signed in on the app
WHEN they close and reopen the app within 30 days
THEN they go straight to the Home screen without signing in again
WHEN they tap Logout
THEN the stored token is removed and the Login screen is shown
WHEN any API call returns 401 (expired token)
THEN the app returns to the Login screen
```

### AC11: Setup script creates a working clinic
```gherkin
GIVEN the product owner runs the setup script for 'Sri Clinic, Madurai' with one doctor and one attender
THEN the clinic exists with its own copy of every active department template
AND both users can sign in with the passwords printed by the script
AND running the reset-password command for a mobile sets a new password for that user only
```

### AC12: Passwords are stored safely
```gherkin
GIVEN any user created by the script
THEN users.password_hash holds a bcrypt hash, never the plain password
AND no API response ever includes password_hash
```

---

## Technical Implementation

> Backend: Node.js + Express + PostgreSQL, CommonJS, layered `routes → controllers → services → repositories`. Keep the layers pure (see `CLAUDE.md`). All new routes use `wrap()`. All errors use `AppError`.

### Part 1: Migration 006 — clinics, users, clinic_id (1.5 days)

**File:** `db/migrations/006_clinics_and_users.sql` **(NEW)** — forward-only and idempotent (`IF NOT EXISTS`, guarded inserts). Order matters, because production has data:

1. `CREATE TABLE IF NOT EXISTS clinics (id SERIAL PK, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`.
2. Insert `'Default Clinic'` if no clinic exists.
3. `CREATE TABLE IF NOT EXISTS users (id SERIAL PK, clinic_id INT NOT NULL REFERENCES clinics(id), name TEXT NOT NULL, mobile TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('doctor','attender')), is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ DEFAULT now())`.
4. `ALTER TABLE visits ADD COLUMN IF NOT EXISTS clinic_id INT REFERENCES clinics(id)`, **backfill** every row to the default clinic, **then** `SET NOT NULL`. Same for `question_templates`.
5. Replace the token index: `DROP INDEX IF EXISTS visits_daily_token_unique`, then `CREATE UNIQUE INDEX IF NOT EXISTS visits_clinic_daily_token_unique ON visits (clinic_id, visit_date, token_number)`.
6. Indexes: `visits (clinic_id, visit_date)`, `question_templates (clinic_id, department_id)`.

> ⚠️ Merging deploys this to production automatically (the backend migrates on boot). Test it first on a copy of production-shaped data: migrations 001–005 + the seed, then 006, then 006 again.

**File:** `db/seeds/001_demo.sql` **(MODIFY)** — insert visits and templates with the default clinic's `clinic_id`, and add one demo doctor and one demo attender (documented demo passwords, local only). A fresh setup that follows the README must still work.

### Part 2: Auth (1.5 days)

**Dependencies (backend):** `bcryptjs` (pure JS — avoids native build problems on Windows) and `jsonwebtoken`.

**File:** `backend/src/config/index.js` **(MODIFY)** — `jwtSecret: process.env.JWT_SECRET` (throw on boot if missing, like `DATABASE_URL`), `jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d'`. Add both to `backend/.env.example` and to the backend `environment:` block in `docker-compose.app.yml` (undeclared vars are silently dropped in Coolify).

**New files:**
- `backend/src/repositories/userRepository.js` — `findByMobile`, `findById` (never select `password_hash` except in `findByMobile` for login).
- `backend/src/repositories/clinicRepository.js` — `create`, `findById`.
- `backend/src/services/authService.js` — `login(mobile, password)`: bcrypt compare, sign `{ sub: user.id }` only — clinic and role are reloaded from the DB on every request, so they can't go stale in a token.
- `backend/src/controllers/authController.js` — `POST /api/auth/login`, `GET /api/auth/me`.
- `backend/src/utils/auth.js` — **replaces `roleGuard.js`**: reads `Authorization: Bearer <token>`, verifies it, loads the user (reject if `is_active` is false), sets `req.user = { id, clinicId, role }`. Plus `requireRole('doctor')` for doctor-only routes.

**File:** `backend/src/routes/index.js` **(MODIFY)** — `/health` and `POST /auth/login` stay open; `router.use(auth)` replaces `router.use(roleGuard)`. `PATCH /visits/:id/status` to `done` requires the doctor role.

### Part 3: Clinic scoping (1.5 days)

Pass `req.user.clinicId` from every controller into the service and repository. **Every** query on `visits`, `question_templates`, `answers` (via its visit) and `summaries` (via its visit) filters by clinic. A record from another clinic returns `null` → `NOT_FOUND` (AC5).

- `visitRepository.list`, `findById` — add `WHERE v.clinic_id = $n`.
- `visitRepository.createWithToken` — use a **per-clinic** advisory lock (`pg_advisory_xact_lock(TOKEN_LOCK_KEY, clinicId)`, two-int form) and `WHERE visit_date = CURRENT_DATE AND clinic_id = $1`; insert `clinic_id`.
- `templateRepository.findActiveByDepartmentId(clinicId, departmentId)`, `findById(clinicId, id)`, `updateQuestions` — check the template belongs to the clinic.
- `answerService.recordAnswer`, `visitService.submit`, `updateStatus`, `maybeAdvance` — load the visit through the clinic-scoped `findById` first.
- `summaryService.buildQA` — use the clinic-scoped template lookup.

**Audio:** remove `app.use('/audio', express.static(...))` from `app.js`. Add `GET /api/answers/:id/audio` (authenticated): load the answer → its visit → check clinic → `res.sendFile`. Update any client that builds `/audio/...` URLs.

### Part 4: Mobile login (1 day)

> Per `mobile/AGENTS.md`, read the Expo SDK 56 docs before writing code: https://docs.expo.dev/versions/v56.0.0/

- **Dependency:** `expo-secure-store` (store the token encrypted). This is a native module, so **a new APK build is required** for this story.
- `mobile/src/api/client.js` — remove the `x-role` header; add an axios request interceptor that attaches `Authorization: Bearer <token>`, and a response interceptor that clears the token and returns to Login on 401 (AC10).
- `mobile/src/screens/LoginScreen.js` **(NEW)** — mobile number (numeric keypad) + password, error message from `error.message`.
- `mobile/src/navigation/AppNavigator.js` — show Login when no token, the existing stack when signed in.
- Home screen — show the clinic name and a **Logout** button (1 phone and 1 attender per clinic, so logout is rarely used, but needed if the phone or staff changes).

### Part 5: Doctor web login (0.5 day)

- `frontend/src/pages/LoginPage.jsx` **(NEW)** — build it responsive from the start (phone and laptop).
- `frontend/src/utils/apiClient.js` — remove `ROLE`/`x-role`; attach the token from `localStorage`; on 401 clear it and go to `/login`.
- `frontend/src/components/RequireDoctor.jsx` — replace the `?role=` check with "signed in **and** role is doctor".
- Show the clinic and doctor name in the top bar, with a Logout link.

### Part 6: Setup script (0.5 day)

**File:** `scripts/clinic-admin.mjs` **(NEW)** — reads `backend/.env` like the db runners.
- `node scripts/clinic-admin.mjs create-clinic "Sri Clinic, Madurai" --doctor "Dr. Ramesh:9876543210" --attender "Priya:9876500000"` → creates the clinic, **copies every active template and its questions** into it, creates the users with random passwords, and prints them once.
- `node scripts/clinic-admin.mjs reset-password 9876543210` → prints a new password.

### Part 7: Tests (0.5 day)

Following the repo convention (pure logic, no live DB):
- `backend/src/__tests__/auth.test.js` — token sign/verify round trip, expired and tampered tokens rejected, `requireRole` allows/blocks.
- Extend `visitValidation`-style tests for any new pure helpers (e.g. mobile number validation).

### Part 8: Release plan — 👨‍💻 Senior

> ⚠️ **This is a breaking change.** Once the backend requires a login, the APK clients have today and the current doctor web **stop loading data**. Everything must go live together.

1. **Before merging:** test migration 006 on a copy of production-shaped data (001–005 + seed → 006 → 006 again).
2. **In Coolify, before deploying:** set `JWT_SECRET` (a long random value, marked as a Secret). The backend refuses to start without it.
3. **Deploy** the backend and the doctor web together (one Coolify redeploy). Migration 006 runs on boot and moves existing data into "Default Clinic".
4. **Create the accounts:** run `scripts/clinic-admin.mjs create-clinic` for each trial clinic; note the printed passwords.
5. **Build the new APK** (`expo-secure-store` is a new native module) and share it with each clinic **together with** their attender's mobile number and password.
6. **Share the doctor login** (mobile number + password) with each doctor.
7. **Check after go-live:** sign in as two different clinics and confirm each sees only its own patients and tokens start at 1.

**Do this outside clinic hours** — between steps 3 and 5, the old app cannot be used.

---

## File Summary

| File | Action | Approx Lines |
|------|--------|--------------|
| `db/migrations/006_clinics_and_users.sql` | **NEW** — clinics, users, clinic_id + backfill, token index | ~60 |
| `db/seeds/001_demo.sql` | **MODIFY** — clinic_id + demo users | ~20 |
| `backend/src/utils/auth.js` | **NEW** — replaces `roleGuard.js` | ~45 |
| `backend/src/services/authService.js`, `controllers/authController.js` | **NEW** | ~70 |
| `backend/src/repositories/userRepository.js`, `clinicRepository.js` | **NEW** | ~50 |
| `backend/src/repositories/visitRepository.js`, `templateRepository.js` | **MODIFY** — clinic scoping, per-clinic tokens | ~40 |
| `backend/src/services/*` (visit, answer, summary, template) | **MODIFY** — pass clinicId | ~40 |
| `backend/src/routes/index.js`, `app.js` | **MODIFY** — auth, audio route | ~20 |
| `backend/src/config/index.js`, `.env.example`, `docker-compose.app.yml` | **MODIFY** — JWT settings | ~10 |
| `mobile/src/screens/LoginScreen.js`, `api/client.js`, `navigation/AppNavigator.js`, Home | **NEW/MODIFY** | ~180 |
| `frontend/src/pages/LoginPage.jsx`, `utils/apiClient.js`, `components/RequireDoctor.jsx` | **NEW/MODIFY** | ~140 |
| `scripts/clinic-admin.mjs` | **NEW** | ~120 |
| `backend/src/__tests__/auth.test.js` | **NEW** | ~80 |
| `CLAUDE.md` | **MODIFY** — replace the "Auth (POC only)" section | ~10 |

---

## Test Setup

| Field | Value |
|-------|-------|
| **Backend** | `cd backend && npm run dev` with `JWT_SECRET` set in `backend/.env` |
| **Accounts** | Run `scripts/clinic-admin.mjs create-clinic` twice to make Clinic A and Clinic B, each with a doctor and an attender |
| **Verify isolation** | Register patients in both clinics; each attender/doctor sees only their own (AC4); tokens start at 1 in both (AC6); request a Clinic A visit id as a Clinic B user → 404 (AC5) |
| **Verify migration** | On a DB at 005 with seed data: run migrations → existing visits are in 'Default Clinic' (AC1); run again → no change |
| **Mobile** | New APK build required (`expo-secure-store`). Sign in, close and reopen app (stays signed in), Logout (AC10) |
| **Unit tests** | `cd backend && npm test` |
