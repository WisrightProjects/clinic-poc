ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS visit_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS visits_daily_token_unique
  ON visits (token_number, visit_date);
