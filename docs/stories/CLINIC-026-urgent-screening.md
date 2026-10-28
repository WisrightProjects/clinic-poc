# User Story: Urgent warning-sign screening + alert

**Story ID:** CLINIC-026
**Epic:** Patient Intake / Safety
**Feature:** Before the routine questions, the attender asks a short physician-approved list of warning signs (Yes / No / Not sure). Any Yes or Not sure shows **"URGENT – INFORM CLINICAL STAFF IMMEDIATELY"** on the app and flags the patient red at the top of the doctor's queue.
**Priority:** P1 (safety) — client document Section 8: "Do not leave an urgent patient waiting for the normal questionnaire to finish."
**Effort:** ~14 h
**Who:** 👨‍💻 **Senior** (safety logic); a junior can build the screens with review
**Status:** **Blocked** — needs the clinic physician's approved list and wording (client to send)
**Depends On:** CLINIC-021 (answer types). **New APK needed.**

> The app only shows the alert; it never judges the patient or suggests a diagnosis. The list and wording must come from the physician and be stored as given.

---

## Story Overview

**As an** attender
**I want** a few warning-sign questions first, with a clear red alert if any is Yes
**So that** a seriously ill patient is seen at once instead of waiting in the queue

**As a** doctor
**I want** urgent patients flagged red at the top of my queue
**So that** I see them first

---

## Draft list (from the client document — physician to approve)

1. Severe difficulty breathing
2. Chest pain or discomfort
3. Sudden weakness of one side or difficulty speaking
4. Loss of consciousness or new severe confusion
5. Major bleeding
6. Other urgent warning signs approved by the clinic physician

Answer per sign: **Yes / No / Not sure**. Yes **or Not sure** = urgent.

---

## What to do

1. Migration: the screening questions as `choice` questions (single, options Yes / No / Not sure) at the top of the Physician list, marked `config.urgent_if = ["yes","not_sure"]` (or a `questions.urgent` flag), plus `visits.urgent BOOLEAN NOT NULL DEFAULT false` and `urgent_at TIMESTAMPTZ`.
2. Backend: when a screening answer is saved, set `visits.urgent` (inside the same locked save as CLINIC-021, `visitService.saveAnswer`); the queue (`GET /visits`) sorts urgent waiting patients first and returns `urgent`.
3. App: after saving an urgent answer, a full-screen red alert "URGENT – INFORM CLINICAL STAFF IMMEDIATELY" with an "I have informed staff" button (logged); the patient row shows a red URGENT tag.
4. Doctor web: red URGENT chip, urgent patients at the top of the queue, and the urgent signs listed above the summary. Optional sound — confirm with the client.
5. AI summary: the urgent signs go first in the summary, word for word.

---

## Acceptance Criteria

- [ ] AC1: The screening questions come first on every new Physician visit.
- [ ] AC2: Yes or Not sure → the red alert on the app at once, the visit marked urgent.
- [ ] AC3: The doctor web shows urgent patients first, with a red chip and the signs.
- [ ] AC4: All No → no alert, normal flow.
- [ ] AC5: The wording matches the physician-approved list exactly.

## To confirm with the client

The approved list and wording; who must be alerted (attender screen only, doctor web too, sound?); whether "I have informed staff" needs a name.
