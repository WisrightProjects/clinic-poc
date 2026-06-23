# User Story: Real AI Summary — generate a per-patient clinical summary from the captured Q&A

**Story ID:** CLINIC-007
**Epic:** Doctor Review
**Feature:** Replace the stubbed, one-size-fits-all summary with a real AI-generated summary that reads each patient's actual transcribed answers, behind a swappable provider switch (open-source now, paid later) — mirroring the STT provider pattern from CLINIC-004 / the faster-whisper change.
**Priority:** P1 (High)
**Effort:** 1.5 days (12 hours)
**Sprint:** Phase 2 — Doctor Review
**Status:** Ready for Development
**Depends On:** CLINIC-001 (`summaries` table, `POST /api/visits/:id/submit`, status engine), CLINIC-005 (submit flow + attender preview), CLINIC-006 (doctor dashboard AI Summary card). Reuses the provider-switch pattern introduced for STT (`STT_PROVIDER`, commit `6dbbe1e`).

> **Update (2026-06-23):** Ollama removed; **Kimi (Moonshot AI)** is now the active paid provider, called over an OpenAI-compatible Chat Completions API (`KIMI_BASE_URL`/`KIMI_API_KEY`/`KIMI_MODEL`). The `SUMMARY_PROVIDER` switch and provider-agnostic seam are unchanged — only the concrete free-LLM implementation was dropped. Sections below describing the Ollama path are retained as the original point-in-time spec.

---

## Story Overview

**As a** doctor reviewing a patient on the dashboard
**I want** the AI Summary to actually reflect *this* patient's answers — not a fixed placeholder paragraph
**So that** I can trust it to prep the consult instead of reading every Q&A line myself

**As the** product owner running client demos
**I want** the summary engine to be a config switch (free open-source vs paid) like the STT provider
**So that** the POC runs free now, and we can enable a higher-quality paid model when a client pays — with no code change

---

## Why This Feature?

### Current Gap
- `backend/src/services/summaryService.js` is a **stub**: `generate(_visitId)` **ignores the visit entirely** and returns one hardcoded paragraph (`MOCK_SUMMARY`) for every patient.
- The flag `USE_MOCK_SUMMARY` is effectively dead — even when `false`, the same canned text is returned (there is a `// Real LLM drops in here` comment but nothing is wired).
- `visitService.submit()` (`backend/src/services/visitService.js:52-53`) calls `summaryService.generate(visitId)` and persists the result with a **hardcoded** `generated_by = 'mock'`.
- Result on the doctor dashboard (CLINIC-006 `AiSummaryCard`): every visit shows `generated · mock` and the identical "fever for 3 days / CBC and fever panel" paragraph — visibly wrong against the real transcripts the same screen now shows (e.g. a headache complaint summarised as "fever").
- Unlike STT — which had a real provider (Sarvam) wired behind the mock — the summary has **never** been connected to any real engine.

### Real-World Use Case (Doctor review, Token 02)
Dr. Ramesh opens Ravi (Token 02). The Q&A shows a headache complaint, homeopathy medication, no allergies — all real Whisper transcripts. The AI Summary box, however, says *"Patient presents with fever for 3 days…"* — generic and contradicting the answers, so he ignores it and reads all 5 Q&A manually. The summary adds zero value.
With this story, the summary reads Ravi's actual answers and produces, e.g.: *"50F presents with severe headache > 1 week. On homeopathic medication. No known drug allergies. No significant past history. Suggest examination."* — and is written in **English** even though the answers were spoken in Tamil, so the doctor can read it directly.

### Solution
Apply the **same provider-switch pattern** already proven for STT:
- `SUMMARY_PROVIDER = mock | ollama | kimi` (default `mock`, so nothing breaks until configured). `claude` remains a possible future drop-in via the same switch.
- `summaryService.generate()` becomes a thin dispatcher that **loads the visit's real Q&A** (questions + transcripts) and hands it to the selected provider.
- **Open-source provider (Ollama)** — a local LLM (e.g. `qwen2.5`/`llama3.1`) called over HTTP; free, runs on a server.
- **Paid provider (Kimi / Moonshot AI)** — the team's purchased model, called over an OpenAI-compatible Chat Completions API (`KIMI_BASE_URL`/`KIMI_API_KEY`/`KIMI_MODEL`); higher quality. Trade-off: patient Q&A leaves the box to an external API.
- Output is **English by default** regardless of the answer language (configurable), which also addresses the parked "Tamil vs English on the doctor screen" question.
- `generated_by` becomes **dynamic** (the provider name), so the dashboard truthfully shows `generated · ollama` / `claude` / `mock`.
- No mobile, route, controller, schema, or doctor-web change — the API contract (`{ visit, template, answers, summary }`) is unchanged.

---

## User Personas

### Primary: Dr. Ramesh — General Physician
- **Role:** Reviews ~10 patients a session on the doctor dashboard; uses the AI summary to prep each consult.
- **Goal:** Read one trustworthy paragraph per patient instead of every Q&A line.
- **Pain Point:** "The summary says fever when the patient has a headache. I can't use it, so I read everything myself — it saves me nothing."

### Secondary: Product Owner — running client demos
- **Role:** Demos the POC; converts interest into paid engagements.
- **Goal:** Show a real, accurate summary now (free), and flip to a premium model when a client pays.
- **Pain Point:** "A hardcoded paragraph that's wrong on screen undermines the whole demo."

---

## Detailed Sub-Stories

### Sub-Story 1: Provider switch + Q&A-driven dispatcher
**Story ID:** CLINIC-007.1
**Points:** 5 | **Effort:** 4 hours
```gherkin
As the product owner
I want summary generation behind a SUMMARY_PROVIDER switch that reads the visit's real Q&A
So that the engine is swappable and the summary is per-patient, not canned
```

### Sub-Story 2: Open-source provider (Ollama)
**Story ID:** CLINIC-007.2
**Points:** 3 | **Effort:** 3 hours
```gherkin
As the product owner
I want a free local LLM provider that produces a real English summary from the answers
So that the POC demo is fully real end-to-end at zero per-use cost
```

### Sub-Story 3: Paid provider (Claude) as the upgrade path
**Story ID:** CLINIC-007.3
**Points:** 3 | **Effort:** 2 hours
```gherkin
As the product owner
I want a paid Claude provider enabled by an API key
So that a paying client gets higher-quality, reliable Tamil->English summaries with no code change
```

### Sub-Story 4: Truthful provenance + graceful failure
**Story ID:** CLINIC-007.4
**Points:** 2 | **Effort:** 3 hours
```gherkin
As a doctor
I want the summary to show which engine produced it and to never block submit if the engine is down
So that I can judge trust, and a failed summary never breaks the attender's send
```

---

## Acceptance Criteria

### AC1: Summary is generated from the visit's actual answers
```gherkin
GIVEN a visit with status 'answered' and real transcripts for every question
WHEN POST /api/visits/:id/submit runs with SUMMARY_PROVIDER != mock
THEN the stored summaries.summary_text reflects THIS visit's question+transcript content
AND two visits with different answers produce different summaries
```

### AC2: Provider is selected by SUMMARY_PROVIDER
```gherkin
GIVEN SUMMARY_PROVIDER is set to 'ollama' (or 'claude' or 'mock')
WHEN a summary is generated
THEN the corresponding provider client is used
AND with an unset/unknown value it defaults to 'mock' (back-compatible, no crash)
```

### AC3: generated_by reflects the real provider
```gherkin
GIVEN a summary produced by provider P
WHEN the summaries row is created
THEN summaries.generated_by = P  (e.g. 'ollama' | 'claude' | 'mock')
AND the doctor dashboard AiSummaryCard shows "generated · P"
```

### AC4: Summary output language is English by default
```gherkin
GIVEN a visit whose answers are in Tamil (or mixed Tamil/English)
WHEN a real provider generates the summary
THEN the summary_text is written in English (default), suitable for the doctor to read
AND the output language is configurable (SUMMARY_LANGUAGE) without code change
```

### AC5: Provider failure does not break submit
```gherkin
GIVEN SUMMARY_PROVIDER='ollama' (or 'claude') and the provider is unreachable or errors
WHEN POST /api/visits/:id/submit runs
THEN the request still succeeds (visit transitions to 'summarised')
AND a clearly-marked fallback summary is stored (generated_by reflects the failure, e.g. 'mock-fallback')
AND no 500 is returned to the attender app
```

### AC6: Idempotency and contract are preserved
```gherkin
GIVEN a visit already 'summarised'/'done'
WHEN submit is called again
THEN the existing summaries row is returned, no new generation runs, no duplicate row
AND GET /api/visits/:id still returns { visit, template, answers, summary } unchanged in shape
```

### AC7: Mock remains available for offline/no-key demos
```gherkin
GIVEN SUMMARY_PROVIDER='mock'
WHEN a summary is generated
THEN the canned summary is returned (current behavior) with generated_by='mock'
AND no network/LLM call is made
```

---

## Technical Implementation

> The repo is built (not greenfield). Backend is Node.js + Express + PostgreSQL in CommonJS, layered as `backend/src/{routes,controllers,services,repositories,utils,config}`. This story changes only the **summary** layer and config — it mirrors the STT provider switch already shipped in `backend/src/services/sttService.js` + `utils/stt/*Client.js`. No mobile, route, controller, schema, or doctor-web change.

### Part 1: Config — provider switch (1 hour)

**File:** `backend/src/config/index.js` **(MODIFY)** — add summary keys alongside the STT ones; `useMockSummary` is superseded by `summaryProvider` (keep reading it for back-compat: if set true and `SUMMARY_PROVIDER` unset, resolve to `mock`).
```js
summaryProvider: process.env.SUMMARY_PROVIDER
  || (process.env.USE_MOCK_SUMMARY === 'true' ? 'mock' : 'mock'), // 'mock' | 'ollama' | 'claude'
summaryLanguage: process.env.SUMMARY_LANGUAGE || 'English',
ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5',
anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
```

**File:** `backend/.env.example` **(MODIFY)** — document `SUMMARY_PROVIDER`, `SUMMARY_LANGUAGE`, `OLLAMA_URL`, `OLLAMA_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`.

### Part 2: Dispatcher that reads real Q&A (3 hours)

**File:** `backend/src/services/summaryService.js` **(REWRITE)** — load the visit's questions + transcripts, build an ordered Q&A list, dispatch to the provider, and keep the mock as a real branch. Returns `{ summaryText, generatedBy }` so `generated_by` is dynamic.
```js
const config = require('../config');
const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const ollamaClient = require('../utils/summary/ollamaClient');
const claudeClient = require('../utils/summary/claudeClient');

const MOCK_SUMMARY = 'Patient presents with fever for 3 days and a severe headache...'; // unchanged

async function buildQA(visitId) {
  const visit = await visitRepository.findById(visitId);
  const template = await templateRepository.findActiveByDepartmentId(visit.department_id);
  const answers = await answerRepository.findByVisitId(visitId);
  const byQ = new Map(answers.map(a => [a.question_id, a]));
  const qa = [...template.questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map(q => ({ question: q.text, answer: byQ.get(q.id)?.transcript || '' }));
  return { visit, qa };
}

async function generate(visitId) {
  if (config.summaryProvider === 'mock') return { summaryText: MOCK_SUMMARY, generatedBy: 'mock' };
  const { visit, qa } = await buildQA(visitId);
  try {
    const text = config.summaryProvider === 'claude'
      ? await claudeClient.summarise(visit, qa, config.summaryLanguage)
      : await ollamaClient.summarise(visit, qa, config.summaryLanguage);
    return { summaryText: text, generatedBy: config.summaryProvider };
  } catch (_err) {
    return { summaryText: MOCK_SUMMARY, generatedBy: 'mock-fallback' }; // AC5
  }
}

module.exports = { generate };
```

**File:** `backend/src/services/visitService.js` **(MODIFY, lines ~52-53)** — consume the new return shape so provenance is truthful:
```js
const { summaryText, generatedBy } = await summaryService.generate(visitId);
summary = await summaryRepository.create(visitId, summaryText, generatedBy);
```

### Part 3: Provider clients (4 hours)

**File:** `backend/src/utils/summary/ollamaClient.js` **(NEW)** — POST to `${config.ollamaUrl}/api/generate` (or `/api/chat`) with a clinical-summary prompt built from `qa`, instructing output in `language`. Mirrors `whisperClient.js` (axios, timeout, error throw). Returns the summary string.

**File:** `backend/src/utils/summary/claudeClient.js` **(NEW)** — call the Anthropic Messages API (`@anthropic-ai/sdk` or axios) with `config.anthropicApiKey`/`anthropicModel`; same prompt + `language`; returns the text. Throws on missing key so the dispatcher falls back (AC5).

> Prompt (shared): a short system instruction — "You are a clinical scribe. Summarise the patient intake below into 2-4 concise sentences in {language} for a doctor. Use only the information given; do not invent findings." — followed by the patient context (age/sex) and the ordered Q&A.

### Part 4: Tests (3 hours)

**File:** `backend/src/__tests__/summaryProvider.test.js` **(NEW)** — pure-logic tests for: provider resolution (AC2, default mock), QA assembly from questions+answers, prompt construction, and the fallback-on-error path returning `mock-fallback` (AC5). Network/LLM calls are mocked; no live DB (mirrors the existing `visitValidation.test.js` style).

---

## File Summary

| File | Action | Approx Lines |
|------|--------|--------------|
| `backend/src/config/index.js` | **MODIFY** — summary provider/lang/keys | ~8 |
| `backend/.env.example` | **MODIFY** — document new env | ~7 |
| `backend/src/services/summaryService.js` | **REWRITE** — dispatcher + real Q&A load + mock branch | ~45 |
| `backend/src/services/visitService.js` | **MODIFY** — use dynamic `generatedBy` | ~2 |
| `backend/src/utils/summary/ollamaClient.js` | **NEW** — free local LLM client | ~40 |
| `backend/src/utils/summary/claudeClient.js` | **NEW** — paid Claude client | ~40 |
| `backend/src/__tests__/summaryProvider.test.js` | **NEW** — dispatch/QA/fallback tests | ~90 |
| `CLAUDE.md` | **MODIFY** — document `SUMMARY_PROVIDER` in STT/Summary section | ~5 |

**Backend/DB impact:** No schema change — uses `visits`, `questions`, `answers`, `summaries` verbatim. `summaries.generated_by` now carries the real provider name instead of a hardcoded `'mock'`. The doctor web and mobile apps need **no change** (API contract unchanged). Two new runtime dependencies *only when used*: a reachable Ollama server (free) or an Anthropic API key (paid). With `SUMMARY_PROVIDER=mock` (default) the system behaves exactly as today.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Backend** | `cd backend && npm run dev`; set `SUMMARY_PROVIDER=ollama` (with Ollama running + a pulled model) or `=claude` (with `ANTHROPIC_API_KEY`) in `backend/.env` |
| **Test data** | A visit in status `'answered'` with real transcripts for all questions (e.g. Token 02, Ravi) |
| **Verify** | `POST /api/visits/:id/submit` -> inspect `summaries.summary_text` (per-patient, English) and `generated_by` (provider name); refresh the doctor dashboard AI Summary card |
| **Non-testable via UI** | AC5 (provider-down fallback — stop Ollama / unset key, confirm submit still 200s with `generated_by='mock-fallback'`); AC6 (idempotency — re-POST returns existing row, no duplicate) |
| **Unit tests** | `cd backend && npm test` runs `summaryProvider.test.js` |
```
