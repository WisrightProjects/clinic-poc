-- CLINIC-011: photos of the patient's previous reports, attached to a visit.
-- Clinic ownership comes through the visit. file_path is relative to REPORTS_DIR.
-- Forward-only and idempotent.

CREATE TABLE IF NOT EXISTS visit_reports (
  id          SERIAL PRIMARY KEY,
  visit_id    INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  file_path   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_reports_visit ON visit_reports (visit_id);
