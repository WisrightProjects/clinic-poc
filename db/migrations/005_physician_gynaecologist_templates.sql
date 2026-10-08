-- Adds the Physician and Gynaecologist departments, each with its own active intake
-- template (question lists supplied by the clinic). Departments cannot be created
-- through the API, so they are added here; once present they appear in the mobile
-- department pickers (New Patient + Settings) and their questions stay editable there.
-- Forward-only and idempotent: every insert is guarded, so re-running is a no-op.

-- The demo seed inserts General / its template with an explicit id = 1, which leaves
-- the SERIAL sequences un-advanced; the next default id would then collide with 1.
-- Move each sequence past the current max before inserting.
SELECT setval(pg_get_serial_sequence('departments', 'id'),
              COALESCE((SELECT MAX(id) FROM departments), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('question_templates', 'id'),
              COALESCE((SELECT MAX(id) FROM question_templates), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('questions', 'id'),
              COALESCE((SELECT MAX(id) FROM questions), 0) + 1, false);

INSERT INTO departments (name) VALUES ('Physician'), ('Gynaecologist')
  ON CONFLICT (name) DO NOTHING;

INSERT INTO question_templates (department_id, name, is_active)
  SELECT d.id, t.name, true
  FROM (VALUES ('Physician', 'Physician Intake'),
               ('Gynaecologist', 'Gynaecologist Intake')) AS t(dept, name)
  JOIN departments d ON d.name = t.dept
  WHERE NOT EXISTS (SELECT 1 FROM question_templates qt WHERE qt.department_id = d.id);

-- Questions are only added to a template that has none, so later edits made from the
-- app's Settings screen are never duplicated or overwritten by a re-run.
INSERT INTO questions (template_id, order_index, text)
  SELECT qt.id, q.order_index, q.text
  FROM (VALUES
    ('Physician', 1,  'What is your main problem today?'),
    ('Physician', 2,  'Since when do you have this problem?'),
    ('Physician', 3,  'Did it start suddenly or gradually?'),
    ('Physician', 4,  'Is it getting better, worse, or staying the same?'),
    ('Physician', 5,  'What other symptoms do you have along with it?'),
    ('Physician', 6,  'Have you had this problem before?'),
    ('Physician', 7,  'Have you taken any medicine or treatment for this problem already?'),
    ('Physician', 8,  'Do you have diabetes, BP, thyroid, asthma, heart, kidney or any other long-term illness?'),
    ('Physician', 9,  'Which medicines do you take regularly?'),
    ('Physician', 10, 'Do you have any medicine allergy?'),
    ('Physician', 11, 'Any previous major surgery, admission or serious illness?'),
    ('Physician', 12, 'Have you done any recent blood test, X-ray, scan or other investigation?'),
    ('Physician', 13, 'Do you smoke, drink alcohol or use tobacco?'),
    ('Physician', 14, 'Has there been any recent change in appetite, weight, sleep or energy?'),
    ('Physician', 15, 'What is the main concern you want the doctor to help you with today?'),

    ('Gynaecologist', 1,  'What is your main problem today?'),
    ('Gynaecologist', 2,  'Since when do you have this problem?'),
    ('Gynaecologist', 3,  'When was your last period?'),
    ('Gynaecologist', 4,  'Are your periods regular or irregular?'),
    ('Gynaecologist', 5,  'How many days does your period usually last?'),
    ('Gynaecologist', 6,  'Is the bleeding normal, heavy, or very little?'),
    ('Gynaecologist', 7,  'Do you have pain during periods?'),
    ('Gynaecologist', 8,  'Do you have any unusual vaginal discharge, itching, or smell?'),
    ('Gynaecologist', 9,  'Is there any chance you may be pregnant?'),
    ('Gynaecologist', 10, 'Have you been pregnant before?'),
    ('Gynaecologist', 11, 'Any previous delivery, miscarriage, abortion, or C-section?'),
    ('Gynaecologist', 12, 'Are you taking any regular medicines or hormonal tablets?'),
    ('Gynaecologist', 13, 'Do you have thyroid, diabetes, BP, PCOS, fibroid, or any other long-term problem?'),
    ('Gynaecologist', 14, 'Have you had any previous gynaecological surgery or treatment?'),
    ('Gynaecologist', 15, 'Have you done any recent sonography, blood test, Pap smear, or other investigation?'),
    ('Gynaecologist', 16, 'Are you using any contraception or family-planning method?'),
    ('Gynaecologist', 17, 'Have you noticed any recent change in weight, appetite, or weakness?')
  ) AS q(dept, order_index, text)
  JOIN departments d ON d.name = q.dept
  JOIN question_templates qt ON qt.department_id = d.id AND qt.is_active
  WHERE NOT EXISTS (SELECT 1 FROM questions x WHERE x.template_id = qt.id);
