-- CLINIC-022: the four separate physician lists are replaced by the one "Physician" list
-- (CLINIC-021). Hidden from GET /departments (New Patient and Settings pickers) and refused
-- for new patients (visitService.create); their existing visits still open, answer and submit.
-- Idempotent: re-running changes nothing. Fails loudly if any of the four names is missing
-- (en dash, as in 010), instead of silently hiding nothing.
DO $$
BEGIN
  IF (SELECT count(*) FROM departments
       WHERE name IN ('Physician – Diabetes', 'Physician – Fever', 'Physician – BP', 'Physician – Follow-up')) <> 4 THEN
    RAISE EXCEPTION 'CLINIC-022: expected the four separate physician departments from migration 010';
  END IF;
END $$;

UPDATE departments SET is_active = false
 WHERE name IN ('Physician – Diabetes', 'Physician – Fever', 'Physician – BP', 'Physician – Follow-up');
