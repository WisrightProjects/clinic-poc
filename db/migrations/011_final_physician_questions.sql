-- CLINIC-020: the client's final wording for the four physician lists ("ClinicAI – Final
-- Physician OPD Questionnaire", Development Version 1): 6 common questions, then 4 for the
-- problem, then the attender's vitals. Each clinic's CLINIC-019 list is made inactive (kept)
-- and a new active list takes its place.
-- A visit now records the list it was registered on (visits.template_id), so visits made
-- before the swap keep their own questions. Forward-only and idempotent: re-running is a no-op.

-- 1. Record the list of each existing visit that has answers: the list its answers belong
--    to. Visits with no answers yet (still waiting) are left empty, so they get the new list
--    the first time they are opened (templateRepository.findForVisit stores it then).
ALTER TABLE visits ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES question_templates(id);
CREATE INDEX IF NOT EXISTS idx_visits_template ON visits (template_id);

UPDATE visits v SET template_id = (
    SELECT q.template_id FROM answers a JOIN questions q ON q.id = a.question_id
     WHERE a.visit_id = v.id ORDER BY a.id LIMIT 1)
  WHERE v.template_id IS NULL;

-- 2. The new lists.
SELECT setval(pg_get_serial_sequence('question_templates', 'id'),
              COALESCE((SELECT MAX(id) FROM question_templates), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('questions', 'id'),
              COALESCE((SELECT MAX(id) FROM questions), 0) + 1, false);

CREATE TEMP TABLE final_lists (dept TEXT, order_index INT, text TEXT) ON COMMIT DROP;

-- Common questions 1-6 and the vitals question 11, the same in every list.
INSERT INTO final_lists (dept, order_index, text)
  SELECT d.dept, q.order_index, q.text
  FROM (VALUES ('Physician – Diabetes'), ('Physician – Fever'), ('Physician – BP'), ('Physician – Follow-up')) AS d(dept)
  CROSS JOIN (VALUES
    (1,  'What problem brings you to the doctor today?'),
    (2,  'Since when do you have this problem? (hours / days / weeks / months / years, or "Routine follow-up")'),
    (3,  'Do you have any other symptoms? (fever, cough, body pain, headache, dizziness, weakness, vomiting, loose motions, breathing difficulty, other, or none)'),
    (4,  'Do you have any existing illness? (diabetes, high BP, thyroid, heart disease, kidney disease, asthma, other, none known, or not sure)'),
    (5,  'Are you taking any medicines? (Yes / No / Not sure) If yes: medicine name, dose and how often — and upload the prescription or medicine photo.'),
    (6,  'Do you have any medicine allergy? (Yes / No known medicine allergy / Not sure) If yes: which medicine and what reaction.'),
    (11, 'Today''s vitals (attender): BP (mmHg), pulse, temperature (°C/°F), SpO2 (%), weight (kg), height (cm), blood sugar (mg/dL, which test) — or "Not recorded".')
  ) AS q(order_index, text);

-- Questions 7-10 for each problem.
INSERT INTO final_lists (dept, order_index, text) VALUES
  ('Physician – Diabetes', 7,  'How long have you had diabetes? (months / years, or "Newly diagnosed" / "Don''t know")'),
  ('Physician – Diabetes', 8,  'Are you taking diabetes medicines regularly? (Yes / Sometimes miss / Stopped / Not prescribed)'),
  ('Physician – Diabetes', 9,  'Do you have recent sugar or HbA1c reports? If yes: fasting, post-meal or random sugar (mg/dL), HbA1c (%) and the test date — only the ones available.'),
  ('Physician – Diabetes', 10, 'Have you had any of these recently? (sweating / shaking, dizziness / possible low sugar, blurred vision, frequent urination, excessive thirst, foot wound, numbness / tingling, none)'),

  ('Physician – Fever', 7,  'How many days have you had fever? (hours / days / weeks)'),
  ('Physician – Fever', 8,  'Is your fever continuous or does it come and go? (Continuous / Comes and goes / Not sure)'),
  ('Physician – Fever', 9,  'Any of these other symptoms? (cough, cold / sore throat, body pain, headache, vomiting, loose motions, burning urination, rash, other, none) Skip ones already told.'),
  ('Physician – Fever', 10, 'Have you taken any medicine or done tests for this fever? If medicine: name and last dose (date / time). If tests: upload the reports.'),

  ('Physician – BP', 7,  'How long have you had high BP? (months / years, or "Newly diagnosed" / "Don''t know")'),
  ('Physician – BP', 8,  'Are you taking BP medicines regularly? (Yes / Sometimes miss / Stopped / Not prescribed)'),
  ('Physician – BP', 9,  'Do you have recent BP readings? (Yes / No / Don''t know) If yes: the reading (mmHg), the date, and home or clinic.'),
  ('Physician – BP', 10, 'Have you had any of these? (dizziness, headache, blurred vision, swelling in legs, medicine side effects, none, other)'),

  ('Physician – Follow-up', 7,  'Are you feeling better, the same or worse? (Better / Same / Worse)'),
  ('Physician – Follow-up', 8,  'Are you taking your prescribed medicines regularly? (Yes / Sometimes miss / Stopped / Medicine changed / Not applicable) If stopped or changed: why?'),
  ('Physician – Follow-up', 9,  'Do you have any new symptoms or problems? (Yes / No) If yes: describe the problem and since when.'),
  ('Physician – Follow-up', 10, 'Have you completed the tests advised by the doctor? (Yes / Not yet / No tests advised / Don''t remember) If yes: upload the reports.');

-- 3. Swap: make each active physician list that doesn't start with the new Q1 inactive,
--    and add an empty active list in its place.
WITH old AS (
  UPDATE question_templates qt SET is_active = false
    FROM departments d
   WHERE d.id = qt.department_id
     AND d.name IN (SELECT dept FROM final_lists)
     AND qt.is_active
     AND NOT EXISTS (
       SELECT 1 FROM questions q
        WHERE q.template_id = qt.id AND q.order_index = 1
          AND q.text = (SELECT text FROM final_lists WHERE order_index = 1 LIMIT 1))
  RETURNING qt.department_id, qt.name, qt.clinic_id)
INSERT INTO question_templates (department_id, name, is_active, clinic_id)
  SELECT department_id, name, true, clinic_id FROM old;

-- 4. Fill only the new (empty) active lists.
INSERT INTO questions (template_id, order_index, text)
  SELECT qt.id, f.order_index, f.text
  FROM final_lists f
  JOIN departments d ON d.name = f.dept
  JOIN question_templates qt ON qt.department_id = d.id AND qt.is_active
  WHERE NOT EXISTS (SELECT 1 FROM questions x WHERE x.template_id = qt.id);
