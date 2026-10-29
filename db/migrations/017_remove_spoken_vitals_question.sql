-- CLINIC-024 (PR B): vitals are entered as fields now (016, the Vitals card), so the spoken
-- "Today's vitals (attender)…" question is removed from each clinic's active Physician list.
-- It already has answers (answers.question_id is ON DELETE RESTRICT), so it is not deleted:
-- as in 013, the active list is made inactive and a copy without that question takes its
-- place. Visits keep the list they were registered on (visits.template_id; one not yet bound
-- to a list is bound to the old one first), so old and waiting visits still show and answer
-- it. Found like utils/vitals.js asksSpokenVitals: "vitals (attender)" in any case, so a list
-- reworded in Settings around it is swapped too. Idempotent: an active list without the
-- question is left alone. Fails loudly if no Physician list has the question at all (wording
-- changed here), instead of silently removing nothing.

DO $$
DECLARE
  spoken CONSTANT TEXT := '%vitals (attender)%';
  old_t RECORD;
  new_id INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM questions q
                   JOIN question_templates qt ON qt.id = q.template_id
                   JOIN departments d ON d.id = qt.department_id AND d.name = 'Physician'
                  WHERE q.text ILIKE spoken) THEN
    RAISE EXCEPTION 'CLINIC-024: no "Today''s vitals (attender)" question on any Physician list';
  END IF;

  FOR old_t IN
    SELECT qt.id, qt.department_id, qt.name, qt.clinic_id
      FROM question_templates qt
      JOIN departments d ON d.id = qt.department_id AND d.name = 'Physician'
     WHERE qt.is_active
       AND EXISTS (SELECT 1 FROM questions q
                    WHERE q.template_id = qt.id AND q.text ILIKE spoken)
     ORDER BY qt.id
  LOOP
    UPDATE visits SET template_id = old_t.id
     WHERE template_id IS NULL AND clinic_id = old_t.clinic_id AND department_id = old_t.department_id;
    UPDATE question_templates SET is_active = false WHERE id = old_t.id;
    INSERT INTO question_templates (department_id, name, is_active, clinic_id)
      VALUES (old_t.department_id, old_t.name, true, old_t.clinic_id)
      RETURNING id INTO new_id;
    INSERT INTO questions (template_id, order_index, text, answer_type, options, multi, section)
      SELECT new_id, ROW_NUMBER() OVER (ORDER BY q.order_index, q.id), q.text, q.answer_type, q.options, q.multi, q.section
        FROM questions q
       WHERE q.template_id = old_t.id AND q.text NOT ILIKE spoken;
  END LOOP;
END $$;
