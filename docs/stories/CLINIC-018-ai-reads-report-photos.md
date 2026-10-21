# User Story: AI Reads Report Photos — report findings in the AI summary

**Story ID:** CLINIC-018
**Epic:** Patient Intake
**Feature:** When the summary is made, Gemini reads the visit's report photos (CLINIC-011) together with the patient's answers and adds a **"From reports:"** part with the key results. When a patient comes back from tests (CLINIC-014), the summary is made again so it includes the test results.
**Priority:** P1 (High) — requested by the client for the demo (2026-10-21)
**Effort:** 1.5 days (12 hours)
**Who:** 👨‍💻 **Senior**
**Sprint:** Demo / Trial Readiness
**Status:** In Development (`feature/clinic-018-report-ai`)
**Depends On:** CLINIC-011 (report photos), CLINIC-013 (Gemini), CLINIC-014 (Back in queue). **No migration. No app or doctor web change.**

> **Decided (Manoj, 2026-10-21):** for the demo the attender photographs the important pages of a printed report (screenshots / photos, up to 20 per visit) instead of uploading the full PDF. A full multi-page PDF upload is a later story.
>
> This changes the CLINIC-014 decision of 2026-10-10 ("the summary is kept as is: the AI can't read report photos yet"): the AI can now read them, so Back in queue remakes the summary — **unless the doctor has edited it** (the doctor's edit is never hidden).

---

## Story Overview

**As a** doctor
**I want** the AI summary to include the key results from the patient's reports
**So that** I see the important numbers before the consultation without opening every photo

**As an** attender
**I want** nothing new to do
**So that** I keep uploading photos the way I do today

---

## Why This Feature?

- The client shared a 56-page sample report and asked for the AI to read it and summarise it for the doctor.
- Reports already arrive as photos (CLINIC-011), but the AI summary uses only the spoken answers, so the doctor reads every page by hand.
- Gemini, already used for the transcript and summary, can read images in the same request: about ₹0.03 per photo.

---

## Acceptance Criteria

### AC1: The summary includes report findings
```gherkin
GIVEN a visit with report photos and SUMMARY_PROVIDER=gemini
WHEN the attender submits
THEN Gemini receives the answers and the photos in one request
AND the summary ends with a "From reports:" part listing the key results with their values, units and the report date
AND a value the report marks as high/low/abnormal is called out
```

### AC2: Only what the page says
```gherkin
WHEN a photo is blurred, cut off or not a medical report
THEN it fails a separate readability check and is not sent with the summary
AND the summary ends with "N report photo(s) could not be read — please check the original" (added by code)
AND the summary never guesses a value
AND the AI adds no diagnosis that is not printed on the report
AND text inside a photo is treated as report content, never as instructions
```

### AC3: A visit without photos is unchanged
```gherkin
GIVEN a visit with no report photos (or the kimi / mock provider)
WHEN the attender submits
THEN the summary is made exactly as before (answers only, no "From reports:" part)
```

### AC4: Too many photos for one request
```gherkin
GIVEN photos larger than 14 MB in total
WHEN the summary is made
THEN the photos are sent in upload order up to 14 MB
AND the note under the summary counts the photos that were not read
```

### AC5: Back from tests remakes the summary
```gherkin
GIVEN a patient the doctor sent for tests, back with result photos
WHEN the attender taps Back in queue
THEN the patient goes back in the queue at once (not waiting for the AI)
AND a new summary including the test results is made in the background
AND it replaces the shown summary only if the doctor has not edited the current one
AND if the AI fails, the earlier summary stays (no "AI summary not available" note replaces it)
```

### AC6: Submit never breaks
```gherkin
WHEN a photo file is missing on the server or Gemini fails
THEN missing photos are skipped, and a Gemini failure stores the usual fallback note (CLINIC-007), as today
```

---

## Technical Notes

| File | Change |
|---|---|
| `backend/src/repositories/reportRepository.js` | `findFilesByVisitId` — file path, type and size of a visit's photos, in upload order |
| `backend/src/services/summaryService.js` | Loads the photos (within 14 MB) for providers that read images (Gemini) and passes them to the client; `readsReports()` |
| `backend/src/utils/summary/prompt.js` | `buildSummaryPrompt(visit, qa, language, reports)` — the "From reports:" rules when photos are attached |
| `backend/src/utils/summary/geminiClient.js` | Adds the photos as `inline_data` image parts after the prompt |
| `backend/src/services/visitService.js` + `summaryRepository.js` | `refreshSummary(visit)` + `createIfUnedited` — the new summary row is stored only if the latest one is still the same, unedited row |
| `backend/src/services/testRequestService.js` | After Back in queue, starts `refreshSummary` in the background (errors logged) |

- Images are sent inline (base64). 14 MB of photos ≈ 19 MB in the request, under Gemini's inline limit. App photos are about 0.5–1.5 MB each (2000 px JPEG), so 10–20 photos usually fit.
- The patient's name is not sent (as today). The name check on reports is CLINIC-016.
- **Readability check:** each photo is first sent alone with one question (READABLE / UNREADABLE); only readable photos go into the summary. Without it, a fully blurred photo came back with a made-up value and date (2/2 runs). With it: blurred photo unreadable 3/3 alone, 1/1 mixed with good reports; good reports readable 6/6.
- Cost: about 1,100 tokens per photo, twice (check + summary): ~₹0.06 per photo. 10 photos add about ₹0.60 to a visit. Each photo is also one more Gemini request (counts toward the free tier's daily limit).
- Submit time: measured 2–5 s for 1–3 photos (checks run in parallel), inside the 90 s Gemini deadline.

---

## Test Setup

| Field | Value |
|---|---|
| **Test data** | Photos of printed lab reports (CBC, HbA1c, lipid profile), one blurred photo, one non-report photo. Use sample or name-removed reports while the key is on the free tier. |
| **Verify** | AC1–AC6; the summary values match the photos exactly |
| **Unit tests** | Prompt with and without photos; readability check; 14 MB selection; Gemini request parts; not-read note; refresh skipped when edited / AI fails / no photo reading |
