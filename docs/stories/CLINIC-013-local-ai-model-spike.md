# Spike: Local AI Model — can a small model on our server replace Kimi and read reports?

**Story ID:** CLINIC-013
**Epic:** AI Cost & Privacy
**Type:** Spike (timeboxed research — the deliverable is a findings note, not a feature)
**Priority:** P1 (High)
**Effort:** 3 days (timebox — stop and report at 3 days)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready to Start
**Depends On:** Nothing. Production stays on Kimi during the spike.

---

## Why This Spike?

- The trial notes ask to "explore a small model running on the team's server" and "avoid additional paid external AI services during the initial trial". Today summaries use **Kimi**, a paid external API, which also sends patient answers outside India.
- The next features need AI to **read report photos** (OCR) and to **check the patient name** on each report. That is much harder than summarising text, especially for handwritten or poor-quality photos.
- Our server runs Whisper on CPU today. We don't know whether a local model is fast enough there, or whether a GPU is needed.

**We should find out early whether this works — before building features that depend on it.**

---

## Questions This Spike Must Answer

1. **Summaries:** can a local text model (e.g. Qwen 2.5 7B, Llama 3.1 8B via Ollama) write summaries as good as Kimi's for our Physician and Gynaecologist intakes (including Tamil-English answers), and how long does one take on our server?
2. **Reading reports:** can a local vision/OCR model (e.g. Qwen2.5-VL, or Tesseract/PaddleOCR + a text model) extract the patient name, date, test names and values from report photos? How accurate is it on printed vs handwritten reports?
3. **Name check:** how reliably can it match the name on a report to the registered patient (exact, different, uncertain)?
4. **Resources:** RAM, CPU and disk needed; does it fit alongside Whisper on the current server, or do we need a bigger server or a GPU (and roughly what that costs per month)?

---

## Method

- **Test data:** 10–20 report photos with names hidden (from the clinic if the manager provides them; otherwise our own), plus 10 synthetic intakes. **No real patient data is sent to any external service.**
- Run each candidate model on a machine with the **same spec as the production server** (CPU-only first).
- For summaries, compare side by side with Kimi on the same intakes, using the quality checks already agreed: keeps the patient's uncertainty, adds no diagnoses, keeps important negatives.
- For reports, score each field (name, date, test, value) as correct / wrong / missing.

---

## Deliverable

`docs/spikes/CLINIC-013-local-model-findings.md` with:
- A results table per model: time per summary, time per report page, RAM used, accuracy scores.
- A recommendation: **(a)** move to a local model now, **(b)** local model for summaries + keep Kimi (or another) for reports, or **(c)** needs a GPU server — with a monthly cost estimate.
- Example outputs for 3 intakes and 3 reports.

---

## Acceptance Criteria

### AC1: Findings note is complete
```gherkin
GIVEN the spike is finished (or the 3-day timebox is reached)
THEN the findings note answers questions 1–4 with measured numbers, not estimates
AND includes a clear recommendation the manager can decide on
```

### AC2: No production change
```gherkin
THEN production summaries keep using Kimi throughout the spike
AND no patient data from production is used
```
