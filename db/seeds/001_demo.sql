INSERT INTO departments (id, name) VALUES (1, 'General')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO question_templates (id, department_id, name, is_active)
  SELECT 1, 1, 'General Intake', true
  WHERE NOT EXISTS (SELECT 1 FROM question_templates WHERE id = 1);

INSERT INTO questions (template_id, order_index, text)
  SELECT vals.* FROM (VALUES
    (1, 1, 'Main complaint today?'),
    (1, 2, 'Since how long?'),
    (1, 3, 'Any medication taken?'),
    (1, 4, 'Any known allergies?'),
    (1, 5, 'Past medical history?')
  ) AS vals(template_id, order_index, text)
  WHERE NOT EXISTS (SELECT 1 FROM questions WHERE template_id = 1);

INSERT INTO visits (token_number, patient_name, age, sex, department_id, status)
  SELECT v.token_number, v.patient_name, v.age, v.sex, v.department_id, v.status::visit_status
  FROM (VALUES
    (4,  'Lakshmi Krishnamurthy', 34, 'Female', 1, 'summarised'),
    (5,  'Arun M.',               41, 'Male',   1, 'waiting'),
    (6,  'Deepa N.',              28, 'Female', 1, 'waiting'),
    (7,  'Suresh P.',             52, 'Male',   1, 'answering'),
    (8,  'Kavitha R.',            36, 'Female', 1, 'answered'),
    (9,  'Bala S.',               45, 'Male',   1, 'waiting'),
    (10, 'Nithya K.',             30, 'Female', 1, 'waiting'),
    (11, 'Ravi T.',               60, 'Male',   1, 'done'),
    (12, 'Meena V.',              22, 'Female', 1, 'summarised'),
    (13, 'Gopal R.',              48, 'Male',   1, 'answered')
  ) AS v(token_number, patient_name, age, sex, department_id, status)
  WHERE NOT EXISTS (SELECT 1 FROM visits WHERE token_number = v.token_number);

INSERT INTO summaries (visit_id, summary_text, generated_by)
  SELECT v.id,
    'Patient (F/34) presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes. Requires physical examination. Consider CBC and fever panel.',
    'mock'
  FROM visits v
  WHERE v.token_number = 4
  AND NOT EXISTS (SELECT 1 FROM summaries s WHERE s.visit_id = v.id);
