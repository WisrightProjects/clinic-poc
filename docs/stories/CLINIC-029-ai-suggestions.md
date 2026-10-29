# User Story: AI suggestions for the doctor to confirm

**Story ID:** CLINIC-029
**Epic:** Doctor Review (Phase 2)
**Feature:** A short "AI suggestions — for doctor to confirm" block on the doctor card: what is worth checking before the consultation.
**Priority:** P1 — client document Section 10 ("AI Suggestions – For Doctor to Confirm": "Clarify dizziness. Confirm medicine names and missed doses. Review recent BP and glucose readings.") and the client's sample ("AI Suggestions – Doctor to Review"). Final goal: "The AI should organise and highlight information, not invent diagnoses, prescribe treatment or replace the doctor's clinical judgement."
**Status:** In development (`feature/clinic-029-ai-suggestions`). No migration, no APK.
**Depends On:** CLINIC-028 (the doctor card).

---

## Design

- The summary prompt asks for a third heading, **"Doctor to review:"**, after "Relevant history" and before "From reports": **at most 3** short points — an unclear or contradicting answer, a reading / report value / change since the last visit worth reviewing, a missing detail worth asking. Each from the information given. **Never** a diagnosis, cause, treatment, medicine, dose or test to order. Nothing to check → "- None".
- The heading lives in `utils/summaryText.js` (`CARD_HEADINGS.review`) with the others; `doctorCard.js` reads the points into `summary_card.review` (bullets or "1." / "1)" numbering; "- None" → empty).
- Doctor card: the block **"AI suggestions — for doctor to confirm"** (AI), numbered; "Nothing flagged." when empty.
- A follow-up's comparison (CLINIC-027) does not get the previous visit's points: `previousText` keeps only a card summary's known sections (today's status, history, other lines) — the points were questions, not facts.
- The queue / previous-visit preview is cut at "Doctor to review", so it keeps the complaint and history.
- A card summary without the heading (made before this story, or edited out): `review: null` and the block is **hidden** — "Nothing flagged" would claim a check that was never made. Paragraph visits are unchanged.
- Points may be bulleted, numbered ("1." / "1)", not a decimal like "1.5 mg") or plain lines; a bulleted point that wraps is joined. "None" (also on the heading's line) = nothing flagged; the prompt asks for it in English.
- The queue preview drops only the heading line and its bulleted / numbered points, so the Vitals line and report results stay in it.

## Acceptance Criteria

- [ ] AC1: A new visit's card shows up to 3 numbered suggestions, each traceable to the answers, vitals or reports.
- [ ] AC2: No suggestion is a diagnosis, treatment, medicine, dose or test order.
- [ ] AC3: Nothing to check → "Nothing flagged."
- [ ] AC4: The next follow-up's "Since last visit" never repeats the previous suggestions as facts.

## How to test (production)

A follow-up with a vague or contradicting answer (e.g. "taking medicines: not sure") → a suggestion to clarify it; a simple visit → "Nothing flagged" or 1 point; read every suggestion against AC2.
