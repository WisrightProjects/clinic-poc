# User Story: Doctor View on Mobile — usable on phone, laptop and desktop

**Story ID:** CLINIC-010
**Epic:** Doctor Review
**Feature:** Make the doctor dashboard work on a phone, with the patient's name at the top, followed by history, today's symptoms and the AI summary.
**Priority:** P1 (High)
**Effort:** 2 days (16 hours)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development
**Depends On:** CLINIC-006 (doctor dashboard). No backend or migration change. Can run in parallel with CLINIC-008 (whose login page should be built responsive from the start).

---

## Story Overview

**As a** doctor
**I want** to check the next patient's summary on my phone between consultations
**So that** I don't need a laptop in the chamber

---

## Why This Feature?

### Current Gap
- `frontend/src/assets/doctor.css` has **no** media queries. The layout (`.layout`, line 35) is a fixed **280px** queue column beside the patient detail. On a 360px phone the detail gets about 80px and is unreadable.
- The only responsive rules in the web app (`App.css`, `index.css`) are leftovers from the Vite starter template and don't touch the dashboard.
- The trial notes ask for a "clear doctor view … usable on a computer, laptop, and mobile".

### Real-World Use Case
Dr. Ramesh is between two patients. He opens the dashboard on his phone to read Token 5's summary before calling her in. Today he sees a squashed queue and a sliver of text. With this story, he sees the queue full-width, taps Token 5, reads her name, summary and answers full-screen, and taps Back.

---

## Acceptance Criteria

### AC1: Phone layout (under 768px wide)
```gherkin
GIVEN the dashboard on a 360–430px wide phone
THEN the queue is shown full-width
WHEN the doctor taps a patient
THEN the patient detail fills the screen with a visible Back control to the queue
AND nothing scrolls horizontally
```

### AC2: Laptop and desktop layout is unchanged
```gherkin
GIVEN a screen 1024px or wider
THEN the queue and the patient detail are side by side, as today
```

### AC3: Tablet layout (768–1023px)
```gherkin
GIVEN a tablet-width screen
THEN the layout is usable without horizontal scroll (side by side with a narrower queue, or the phone layout)
```

### AC4: Reading order for the patient
```gherkin
GIVEN any screen size
THEN the patient detail shows, top to bottom: patient name + token + age/sex, the AI summary, then the question-and-answer list
AND text is at least 15px on phones, and buttons are at least 44px tall
```

### AC5: Live updates keep working
```gherkin
GIVEN the phone layout with a patient open
WHEN the queue refreshes (every 5s polling)
THEN the open patient stays open and the scroll position is kept
```

---

## Technical Implementation

- `frontend/src/assets/doctor.css` — add `@media (max-width: 767px)` rules: `.layout` becomes a single column; the queue rail becomes full width; hide the rail while a patient is selected and hide the detail while none is.
- `frontend/src/pages/DoctorDashboardPage.jsx` — on phone widths, add a **Back to queue** control that clears the selection. Prefer the URL (`/doctor/:visitId`) for the selected patient, so the phone's back button works too.
- `frontend/src/index.css` — `#root` has `width: 1126px; max-width: 100%`; check it doesn't cause side-scroll on phones, and remove the unused starter-template rules from `App.css`/`index.css` if they interfere.
- Reorder `PatientHeader` → `AiSummaryCard` → `QaList` if needed (AC4); `StatsStrip` can move below on phones.

---

## Test Setup

| Field | Value |
|-------|-------|
| **Run** | `cd frontend && npm run dev`; open on a phone on the same Wi-Fi (`http://<laptop IP>:5173`) or use browser dev tools device mode |
| **Verify** | 360px, 412px, 768px, 1366px widths (AC1–AC3); open a patient and wait for a refresh (AC5) |
| **Lint** | `cd frontend && npm run lint` |
| **Release** | Web only — deploys with the frontend; no APK needed |
