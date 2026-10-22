-- CLINIC-019: four physician question lists for the pilot (Diabetes, Fever, BP, Follow-up),
-- from "Physician OPD – Final Pilot Requirements" v1. Each is a department, so the attender
-- picks it in the existing New Patient picker (no app change). Every clinic gets its own copy
-- (templates are per clinic since 006); clinic-admin copies them from the Default Clinic for
-- clinics created later. The questions stay editable in the app's Settings.
-- Forward-only and idempotent: every insert is guarded, so re-running is a no-op.

-- Keep the SERIAL sequences past the current max (see 005: seeded rows use explicit ids).
SELECT setval(pg_get_serial_sequence('departments', 'id'),
              COALESCE((SELECT MAX(id) FROM departments), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('question_templates', 'id'),
              COALESCE((SELECT MAX(id) FROM question_templates), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('questions', 'id'),
              COALESCE((SELECT MAX(id) FROM questions), 0) + 1, false);

INSERT INTO departments (name) VALUES
  ('Physician – Diabetes'), ('Physician – Fever'), ('Physician – BP'), ('Physician – Follow-up')
  ON CONFLICT (name) DO NOTHING;

-- One active list per clinic for each new department, unless the clinic already has one.
INSERT INTO question_templates (department_id, name, is_active, clinic_id)
  SELECT d.id, d.name, true, c.id
  FROM departments d CROSS JOIN clinics c
  WHERE d.name IN ('Physician – Diabetes', 'Physician – Fever', 'Physician – BP', 'Physician – Follow-up')
    AND NOT EXISTS (SELECT 1 FROM question_templates qt WHERE qt.department_id = d.id AND qt.clinic_id = c.id AND qt.is_active);

-- Questions are only added to a list that has none, so edits made in Settings are never
-- duplicated or overwritten by a re-run.
INSERT INTO questions (template_id, order_index, text)
  SELECT qt.id, q.order_index, q.text
  FROM (VALUES
    ('Physician – Diabetes', 1,  'What is the main reason for today''s visit?'),
    ('Physician – Diabetes', 2,  'Since when have you had this problem?'),
    ('Physician – Diabetes', 3,  'Are you taking any medicines now? Please tell the names and doses.'),
    ('Physician – Diabetes', 4,  'Do you have any other illness, like BP, thyroid, heart, kidney or lung problem?'),
    ('Physician – Diabetes', 5,  'Are you allergic to any medicine? What happened?'),
    ('Physician – Diabetes', 6,  'How long have you had diabetes?'),
    ('Physician – Diabetes', 7,  'Are you taking your diabetes medicines regularly, sometimes missing, or stopped?'),
    ('Physician – Diabetes', 8,  'Do you know your recent sugar or HbA1c reading, and the date?'),
    ('Physician – Diabetes', 9,  'Recently, have you had sweating, shaking or dizziness, like low sugar? When?'),
    ('Physician – Diabetes', 10, 'Which of these do you have: too much thirst, frequent urination, blurred vision, unusual weakness? Please name them.'),
    ('Physician – Diabetes', 11, 'Any new wound, numbness or tingling in the feet?'),
    ('Physician – Diabetes', 12, 'Today''s vitals (attender): BP, pulse, temperature, SpO2, weight, sugar — or "Not recorded".'),

    ('Physician – Fever', 1,  'What is the main reason for today''s visit?'),
    ('Physician – Fever', 2,  'Are you taking any medicines now? Please tell the names and doses.'),
    ('Physician – Fever', 3,  'Do you have any other illness, like diabetes, BP, thyroid, heart, kidney or lung problem?'),
    ('Physician – Fever', 4,  'Are you allergic to any medicine? What happened?'),
    ('Physician – Fever', 5,  'How many days have you had fever?'),
    ('Physician – Fever', 6,  'Is the fever there all the time, or does it come and go?'),
    ('Physician – Fever', 7,  'Have you checked your temperature? What was the reading?'),
    ('Physician – Fever', 8,  'Which of these do you have: cough, sore throat, headache, body pain, vomiting, loose motions, burning while passing urine, rash? Please name them.'),
    ('Physician – Fever', 9,  'Have you taken any medicine for this fever? Which one, and when was the last dose?'),
    ('Physician – Fever', 10, 'Have you done any tests for this fever?'),
    ('Physician – Fever', 11, 'Today''s vitals (attender): BP, pulse, temperature, SpO2, weight, sugar — or "Not recorded".'),

    ('Physician – BP', 1,  'What is the main reason for today''s visit?'),
    ('Physician – BP', 2,  'Since when have you had this problem?'),
    ('Physician – BP', 3,  'Are you taking any medicines now? Please tell the names and doses.'),
    ('Physician – BP', 4,  'Do you have any other illness, like diabetes, thyroid, heart, kidney or lung problem?'),
    ('Physician – BP', 5,  'Are you allergic to any medicine? What happened?'),
    ('Physician – BP', 6,  'How long have you had high BP?'),
    ('Physician – BP', 7,  'Are you taking your BP medicines regularly, sometimes missing, or stopped?'),
    ('Physician – BP', 8,  'Do you check your BP at home? Regularly, sometimes, or never?'),
    ('Physician – BP', 9,  'Do you know your recent BP readings, and the date?'),
    ('Physician – BP', 10, 'Which of these have you had recently: headache, dizziness, blurred vision, swelling in the legs? Please name them.'),
    ('Physician – BP', 11, 'Any problems or side effects from your BP medicines?'),
    ('Physician – BP', 12, 'Today''s vitals (attender): BP, pulse, temperature, SpO2, weight, sugar — or "Not recorded".'),

    ('Physician – Follow-up', 1, 'What problem were you treated for last time, and when was your last visit?'),
    ('Physician – Follow-up', 2, 'Since your last visit, are you feeling better, the same, or worse?'),
    ('Physician – Follow-up', 3, 'Are you taking the medicines advised last time? Regularly, sometimes missing, stopped or changed?'),
    ('Physician – Follow-up', 4, 'Any new symptoms or problems since the last visit?'),
    ('Physician – Follow-up', 5, 'Have you done the tests advised last time?'),
    ('Physician – Follow-up', 6, 'Do you have new sugar, BP or temperature readings? Please tell them with the date.'),
    ('Physician – Follow-up', 7, 'For sugar patients: any low-sugar episodes (sweating, shaking) or foot problems? Others say "Not applicable".'),
    ('Physician – Follow-up', 8, 'Any medicine side effects, or anything new to tell the doctor?'),
    ('Physician – Follow-up', 9, 'Are you allergic to any medicine? What happened?'),
    ('Physician – Follow-up', 10, 'Today''s vitals (attender): BP, pulse, temperature, SpO2, weight, sugar — or "Not recorded".')
  ) AS q(dept, order_index, text)
  JOIN departments d ON d.name = q.dept
  JOIN question_templates qt ON qt.department_id = d.id AND qt.is_active
  WHERE NOT EXISTS (SELECT 1 FROM questions x WHERE x.template_id = qt.id);
