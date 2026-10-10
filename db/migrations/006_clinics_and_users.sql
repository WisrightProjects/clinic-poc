-- CLINIC-008.1: clinics, users, and clinic-scoped visits/templates.
-- Production already has data, so existing visits and templates are moved into a
-- 'Default Clinic' before clinic_id becomes NOT NULL. Departments stay global;
-- answers, questions and summaries are scoped through their parent visit/template.
-- Forward-only and idempotent: every step is guarded, so re-running is a no-op.

CREATE TABLE IF NOT EXISTS clinics (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO clinics (name) VALUES ('Default Clinic')
  ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  clinic_id     INTEGER NOT NULL REFERENCES clinics(id),
  name          TEXT NOT NULL,
  mobile        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('doctor', 'attender')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add nullable, backfill to the default clinic, then enforce NOT NULL.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
UPDATE visits SET clinic_id = c.id
  FROM clinics c WHERE c.name = 'Default Clinic' AND visits.clinic_id IS NULL;
ALTER TABLE visits ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE question_templates ADD COLUMN IF NOT EXISTS clinic_id INTEGER REFERENCES clinics(id);
UPDATE question_templates SET clinic_id = c.id
  FROM clinics c WHERE c.name = 'Default Clinic' AND question_templates.clinic_id IS NULL;
ALTER TABLE question_templates ALTER COLUMN clinic_id SET NOT NULL;

-- Tokens restart at 1 per clinic per day (was: per day across all clinics).
-- Its (clinic_id, visit_date) prefix also serves the per-clinic queue lookups.
DROP INDEX IF EXISTS visits_daily_token_unique;
CREATE UNIQUE INDEX IF NOT EXISTS visits_clinic_daily_token_unique
  ON visits (clinic_id, visit_date, token_number);

CREATE INDEX IF NOT EXISTS idx_templates_clinic_department
  ON question_templates (clinic_id, department_id);
