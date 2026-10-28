-- CLINIC-024: today's vitals as fields (client document Section 7), one row per visit,
-- entered by the attender. Every value is optional ("Not recorded"); weight and height stay
-- on the visit (CLINIC-023), so there is one weight per visit. Ranges are checked by
-- utils/vitals.js (and kept plausible here). Forward-only and idempotent.
CREATE TABLE IF NOT EXISTS visit_vitals (
  visit_id         INTEGER PRIMARY KEY REFERENCES visits(id) ON DELETE CASCADE,
  bp_systolic      INTEGER CHECK (bp_systolic BETWEEN 60 AND 260),
  bp_diastolic     INTEGER CHECK (bp_diastolic BETWEEN 30 AND 160),
  pulse            INTEGER CHECK (pulse BETWEEN 30 AND 220),
  temperature      NUMERIC(4,1) CHECK (temperature BETWEEN 34 AND 110),
  temperature_unit TEXT CHECK (temperature_unit IN ('C', 'F')),
  spo2             INTEGER CHECK (spo2 BETWEEN 50 AND 100),
  sugar            INTEGER CHECK (sugar BETWEEN 20 AND 700),
  sugar_type       TEXT CHECK (sugar_type IN ('fasting', 'post_meal', 'random')),
  recorded_by      INTEGER REFERENCES users(id),
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A temperature always has its unit, and a sugar its test type (and not without them).
  CHECK ((temperature IS NULL) = (temperature_unit IS NULL)),
  CHECK ((sugar IS NULL) = (sugar_type IS NULL))
);
