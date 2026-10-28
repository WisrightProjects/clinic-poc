-- CLINIC-023: the client's registration fields (Final Physician OPD Questionnaire, Section 1):
-- patient mobile (10 digits, as utils/mobile.js stores it), weight, height, and whether the
-- patient is new or a follow-up. All optional except the type (default 'new'), so visits made
-- before this keep working. Forward-only and idempotent.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS patient_mobile TEXT CHECK (patient_mobile ~ '^[6-9][0-9]{9}$');
ALTER TABLE visits ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(4,1) CHECK (weight_kg BETWEEN 1 AND 300);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS height_cm NUMERIC(4,1) CHECK (height_cm BETWEEN 30 AND 250);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS patient_type TEXT NOT NULL DEFAULT 'new'
  CHECK (patient_type IN ('new', 'follow_up'));
-- Phase 2 (patient history) will look patients up by mobile within a clinic.
CREATE INDEX IF NOT EXISTS idx_visits_clinic_mobile ON visits (clinic_id, patient_mobile)
  WHERE patient_mobile IS NOT NULL;
