-- CLINIC-021 (step B): one "Physician" list for every physician patient. Q1 is a tap
-- question (more than one answer); the Diabetes / Fever / BP / Follow-up questions show only
-- for the problems chosen in Q1 (questions.section, see utils/questionFlow). Needs the new
-- APK: the old app shows "please update the app" on Q1, so until every phone is updated
-- attenders keep using the four separate lists, which stay visible here (hiding them is a
-- later step). Each clinic's old "Physician" list is made inactive (kept: visits keep their
-- own list through visits.template_id). Forward-only and idempotent: a Physician list whose
-- Q1 is already a choice question is left alone.

SELECT setval(pg_get_serial_sequence('question_templates', 'id'),
              COALESCE((SELECT MAX(id) FROM question_templates), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('questions', 'id'),
              COALESCE((SELECT MAX(id) FROM questions), 0) + 1, false);

CREATE TEMP TABLE physician_list (order_index INT, text TEXT, options JSONB, multi BOOLEAN, section TEXT) ON COMMIT DROP;
-- Q1 is the only 'choice' question; every other question is 'voice' (record or type).

INSERT INTO physician_list (order_index, text, options, multi, section) VALUES
  (1,  'What problem brings you to the doctor today?',
       '[{"value":"fever","label":"Fever","section":"fever"},{"value":"diabetes","label":"Diabetes","section":"diabetes"},{"value":"bp","label":"High BP","section":"bp"},{"value":"followup","label":"Follow-up visit","section":"followup"},{"value":"cough_cold","label":"Cough / Cold"},{"value":"stomach","label":"Stomach problem"},{"value":"headache","label":"Headache"},{"value":"weakness","label":"Weakness"},{"value":"other","label":"Other"}]',
       true, NULL),
  (2,  'Since when do you have this problem? (hours / days / weeks / months / years, or "Routine follow-up")', NULL, false, NULL),
  (3,  'Do you have any other symptoms? (fever, cough, body pain, headache, dizziness, weakness, vomiting, loose motions, breathing difficulty, other, or none)', NULL, false, NULL),
  (4,  'Do you have any existing illness? (diabetes, high BP, thyroid, heart disease, kidney disease, asthma, other, none known, or not sure)', NULL, false, NULL),
  (5,  'Are you taking any medicines? (Yes / No / Not sure) If yes: medicine name, dose and how often — and upload the prescription or medicine photo.', NULL, false, NULL),
  (6,  'Do you have any medicine allergy? (Yes / No known medicine allergy / Not sure) If yes: which medicine and what reaction.', NULL, false, NULL),

  (7,  'How long have you had diabetes? (months / years, or "Newly diagnosed" / "Don''t know")', NULL, false, 'diabetes'),
  (8,  'Are you taking diabetes medicines regularly? (Yes / Sometimes miss / Stopped / Not prescribed)', NULL, false, 'diabetes'),
  (9,  'Do you have recent sugar or HbA1c reports? If yes: fasting, post-meal or random sugar (mg/dL), HbA1c (%) and the test date — only the ones available.', NULL, false, 'diabetes'),
  (10, 'Have you had any of these recently? (sweating / shaking, dizziness / possible low sugar, blurred vision, frequent urination, excessive thirst, foot wound, numbness / tingling, none)', NULL, false, 'diabetes'),

  (11, 'How many days have you had fever? (hours / days / weeks)', NULL, false, 'fever'),
  (12, 'Is your fever continuous or does it come and go? (Continuous / Comes and goes / Not sure)', NULL, false, 'fever'),
  (13, 'Any of these other symptoms? (cough, cold / sore throat, body pain, headache, vomiting, loose motions, burning urination, rash, other, none) Skip ones already told.', NULL, false, 'fever'),
  (14, 'Have you taken any medicine or done tests for this fever? If medicine: name and last dose (date / time). If tests: upload the reports.', NULL, false, 'fever'),

  (15, 'How long have you had high BP? (months / years, or "Newly diagnosed" / "Don''t know")', NULL, false, 'bp'),
  (16, 'Are you taking BP medicines regularly? (Yes / Sometimes miss / Stopped / Not prescribed)', NULL, false, 'bp'),
  (17, 'Do you have recent BP readings? (Yes / No / Don''t know) If yes: the reading (mmHg), the date, and home or clinic.', NULL, false, 'bp'),
  (18, 'Have you had any of these? (dizziness, headache, blurred vision, swelling in legs, medicine side effects, none, other)', NULL, false, 'bp'),

  (19, 'Are you feeling better, the same or worse since your last visit? (Better / Same / Worse)', NULL, false, 'followup'),
  (20, 'Are you taking your prescribed medicines regularly? (Yes / Sometimes miss / Stopped / Medicine changed / Not applicable) If stopped or changed: why?', NULL, false, 'followup'),
  (21, 'Do you have any new symptoms or problems? (Yes / No) If yes: describe the problem and since when.', NULL, false, 'followup'),
  (22, 'Have you completed the tests advised by the doctor? (Yes / Not yet / No tests advised / Don''t remember) If yes: upload the reports.', NULL, false, 'followup'),

  (23, 'Today''s vitals (attender): BP (mmHg), pulse, temperature (°C/°F), SpO2 (%), weight (kg), height (cm), blood sugar (mg/dL, which test) — or "Not recorded".', NULL, false, NULL);

-- Swap: each clinic's active Physician list whose Q1 is not a tap question yet is made
-- inactive and an empty active list takes its place.
WITH old AS (
  UPDATE question_templates qt SET is_active = false
    FROM departments d
   WHERE d.id = qt.department_id AND d.name = 'Physician' AND qt.is_active
     AND NOT EXISTS (SELECT 1 FROM questions q
                      WHERE q.template_id = qt.id AND q.order_index = 1 AND q.answer_type = 'choice')
  RETURNING qt.department_id, qt.name, qt.clinic_id)
INSERT INTO question_templates (department_id, name, is_active, clinic_id)
  SELECT department_id, name, true, clinic_id FROM old;

-- A clinic with no active Physician list at all gets one too (as 010 did for its lists).
INSERT INTO question_templates (department_id, name, is_active, clinic_id)
  SELECT d.id, d.name, true, c.id
  FROM departments d CROSS JOIN clinics c
  WHERE d.name = 'Physician'
    AND NOT EXISTS (SELECT 1 FROM question_templates qt
                     WHERE qt.department_id = d.id AND qt.clinic_id = c.id AND qt.is_active);

-- Fill only the new (empty) active Physician lists.
INSERT INTO questions (template_id, order_index, text, answer_type, options, multi, section)
  SELECT qt.id, p.order_index, p.text, CASE WHEN p.options IS NULL THEN 'voice' ELSE 'choice' END,
         p.options, p.multi, p.section
  FROM physician_list p
  CROSS JOIN question_templates qt
  JOIN departments d ON d.id = qt.department_id AND d.name = 'Physician'
  WHERE qt.is_active
    AND NOT EXISTS (SELECT 1 FROM questions x WHERE x.template_id = qt.id);
