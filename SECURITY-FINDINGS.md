# Security Findings Triage

Run `node scripts/findings-rollup.mjs` to see all open findings.

---

## CLINIC-003 — Patient Intake & Question List

| # | Severity | File | Line | Finding | Status |
|---|---|---|---|---|---|
| S003-1 | Medium | backend/src/controllers/visitController.js | 14 | Unvalidated `id` param — raw Postgres cast error leaks via errorHandler on non-integer id | Open |
| S003-2 | Medium | backend/src/utils/visitValidation.js | 15 | `departmentId` not coerced to integer or FK-verified — non-integer passes null-check, FK violation returns raw 500 | Open |
| S003-3 | Medium | mobile/src/utils/retry.js | 14 | `withSingleFlight` resets on settle — client-side timeout on a succeeded request causes duplicate visit on retry; needs server-side idempotency key | Open |
| S003-4 | Low | mobile/src/screens/QuestionListScreen.js | 44 | UI echoes raw backend error message — leaks internal Postgres text if S003-1/S003-2 are not fixed | Open |
| S003-5 | Low | backend/src/utils/roleGuard.js | 5 | `x-role` self-asserted auth — accepted POC design; hard blocker before production | Accepted (POC) |
