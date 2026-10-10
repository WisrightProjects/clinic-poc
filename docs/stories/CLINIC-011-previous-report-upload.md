# User Story: Previous Report Upload — photograph old reports and link them to the patient

**Story ID:** CLINIC-011
**Epic:** Patient Intake
**Feature:** Let the attender photograph or pick the patient's previous reports, store them against the visit, and show them to the doctor. **No AI reads the reports in this story** — that comes after the local-model test (CLINIC-013) and the manager's answers on report types.
**Priority:** P1 (High)
**Effort:** 4 days (32 hours)
**Sprint:** Phase 3 — Trial Readiness
**Status:** Ready for Development (after CLINIC-008)
**Depends On:** CLINIC-008 (reports must be clinic-scoped and served only to signed-in users)
**Migration number reserved:** `007_visit_reports.sql`

> **Work in progress (manager, 2026-10-10):** start with the reports clinics actually bring; the report section will be improved during the 3-month trial based on real use. The name check and "Report in Dispute" flow is **CLINIC-016**.

> **Prerequisite — persistent file storage (check first):** in `docker-compose.app.yml` the backend stores files in `/app/uploads`, but no volume is declared for it (only Postgres has one). Unless Coolify mounts persistent storage there, **every redeploy deletes the stored files** — this may already be happening to voice recordings. Confirm in Coolify (backend → Storages) and add a named volume for `/app/uploads` if missing, **before** this story ships.

---

## Story Overview

**As an** attender
**I want** to take photos of the patient's old reports during intake
**So that** the doctor has the patient's history in front of them before the consultation

**As a** doctor
**I want** to see the uploaded reports next to the patient's answers
**So that** I don't have to ask the patient for the paper file again

---

## Why This Feature?

### Current Gap
- Nothing can be attached to a visit except answer recordings. Patients bring paper reports; the doctor sees them only in the chamber, if at all.
- The trial notes list "upload previous reports, linked to the patient record" for the initial release.

### Real-World Use Case
Arun brings a folder with last month's blood test and an old ECG. Priya taps **Add report**, photographs the two pages, and continues the intake. Before calling Arun in, Dr. Ramesh opens his visit and sees the two report photos under "Previous reports", taps one and zooms in.

---

## Acceptance Criteria

### AC1: Attender can add report photos
```gherkin
GIVEN a visit in 'waiting', 'answering' or 'answered'
WHEN the attender taps Add report and takes a photo or picks images from the gallery
THEN each image is uploaded and listed under the visit's reports with a thumbnail
AND the attender can remove a report uploaded by mistake before the visit is submitted
```

### AC2: Only images, within limits
```gherkin
WHEN a file that is not JPEG, PNG or WEBP is uploaded
THEN the response is 415 UNSUPPORTED_MEDIA
WHEN an image is larger than 10 MB, or the visit already has 20 reports
THEN the upload is rejected with a clear message
AND photos are resized/compressed on the phone before upload (long edge about 2000px)
```

### AC3: Reports are private to the clinic
```gherkin
GIVEN a report on a Clinic A visit
WHEN it is requested without a valid token or by a Clinic B user
THEN it is not returned (401 / 404)
AND report files are never served from a public static path
```

### AC4: Doctor sees the reports
```gherkin
GIVEN a visit with 2 reports
WHEN the doctor opens it on the dashboard (laptop or phone)
THEN a "Previous reports" section shows both thumbnails
AND tapping one opens it full-size and zoomable
AND GET /api/visits/:id gains a reports array without changing the existing fields
```

### AC5: Reports survive restarts and redeploys
```gherkin
GIVEN reports uploaded today
WHEN the backend is redeployed
THEN the reports are still available
```

### AC6: Upload is not blocked by reports
```gherkin
GIVEN a visit with no reports
THEN submit works exactly as today (reports are optional)
```

---

## Technical Implementation

**Database** — `db/migrations/007_visit_reports.sql` **(NEW, idempotent)**:
`visit_reports (id SERIAL PK, visit_id INT NOT NULL REFERENCES visits(id) ON DELETE CASCADE, file_path TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INT NOT NULL, uploaded_by INT REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT now())`, index on `visit_id`. Clinic ownership comes through the visit.

**Backend**
- `backend/src/config/upload.js` — add a **separate** multer instance for reports: own `REPORTS_DIR` (default `<AUDIO_DIR>/../reports`), `fileFilter` for image types, `limits: { fileSize: 10 MB }` (multer has no size limit by default).
- New `reportRepository`, `reportService`, `reportController`:
  - `POST /api/visits/:id/reports` (multipart field `report`, one or more files)
  - `GET /api/visits/:id/reports`
  - `GET /api/reports/:id/file` — authenticated, clinic-checked, `res.sendFile`
  - `DELETE /api/reports/:id` — only before the visit is `summarised`
- `visitService.getById` — add `reports` to the response.
- Add `REPORTS_DIR` to `config/index.js`, `.env.example` and the backend block of `docker-compose.app.yml`; add the uploads volume (see Prerequisite).

**Mobile** (read the Expo SDK 56 docs first, per `mobile/AGENTS.md`)
- Dependencies: `expo-image-picker` (camera + gallery) and `expo-image-manipulator` (resize/compress). **Native modules → new APK build required.** Add the camera permission text in `app.json`.
- An **Add report** entry on the question list / review screen, with thumbnails and remove.

**Doctor web**
- `frontend/src/components/ReportsList.jsx` **(NEW)** — thumbnails + full-size viewer, fetched with the auth token (images must be loaded through the authenticated endpoint, e.g. fetched as a blob).

**Tests** — pure validator for type/size/count limits (AC2).

---

## Test Setup

| Field | Value |
|-------|-------|
| **Run** | Backend + mobile (new dev build/APK for camera) + doctor web |
| **Verify** | Add 2 photos and 1 gallery image; remove one; doctor sees the rest (AC1, AC4); try a PDF and a 15 MB image (AC2); request a report as another clinic (AC3); redeploy and check reports remain (AC5) |
| **Unit tests** | `cd backend && npm test` |
