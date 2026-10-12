-- CLINIC-014: the doctor sends a waiting patient for tests; the patient returns
-- (often the next day) and rejoins the END of that day's queue.
-- Forward-only and idempotent.

-- New status. Postgres can't USE a new enum value in the transaction that adds it
-- (the runner wraps each file in one), so nothing below refers to 'tests_requested'.
ALTER TYPE visit_status ADD VALUE IF NOT EXISTS 'tests_requested';

-- One row per "send for tests", so the history survives repeat requests.
CREATE TABLE IF NOT EXISTS visit_test_requests (
  id              SERIAL PRIMARY KEY,
  visit_id        INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  requested_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  returned_at     TIMESTAMPTZ
);

-- Matches every reader's newest-first order (id DESC), so the latest request is an index read.
CREATE INDEX IF NOT EXISTS idx_visit_test_requests_visit ON visit_test_requests (visit_id, id DESC);

-- A visit's place in the queue, separate from when it was registered: a returning
-- patient gets today's date and a new token at the end, while visit_date and
-- token_number keep the original registration. queue_token is the token the patient
-- is shown and called by. Existing visits start equal.
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS queue_date  DATE,
  ADD COLUMN IF NOT EXISTS queue_token INTEGER;
UPDATE visits SET queue_date = visit_date, queue_token = token_number
  WHERE queue_date IS NULL OR queue_token IS NULL;
ALTER TABLE visits ALTER COLUMN queue_date SET NOT NULL;
ALTER TABLE visits ALTER COLUMN queue_token SET NOT NULL;

-- queue_date DESC matches the queue list's ORDER BY queue_date DESC, queue_token.
CREATE UNIQUE INDEX IF NOT EXISTS visits_clinic_queue_unique
  ON visits (clinic_id, queue_date DESC, queue_token);
