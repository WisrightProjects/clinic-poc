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

-- Answers so visits with advanced statuses are internally consistent: the queue
-- status badge (visits.status) matches the per-question intake content (answers).
-- Fully answered: tokens 4, 8, 11, 12, 13. Partially answered (answering): token 7.
-- Waiting visits (5, 6, 9, 10) intentionally have no answers. audio_path is NULL
-- (seed rows have no real audio); transcript_status 'done'. Idempotent via the
-- answers UNIQUE (visit_id, question_id) guard.
INSERT INTO answers (visit_id, question_id, audio_path, transcript, transcript_status)
  SELECT vis.id, q.id, NULL, a.transcript, 'done'::transcript_status
  FROM (VALUES
    (4,  1, 'Fever iruku, 3 days-a aachu. Romba tired-a feel panren.'),
    (4,  2, 'Rendu vaaram-a iruku. Kadaisila worse-a aachu.'),
    (4,  3, 'Paracetamol mattum eduthen. Doctor prescribe panala.'),
    (4,  4, 'Penicillin allergy iruku. Sulfa drugs also react aachu before.'),
    (4,  5, 'BP iruku, controlled. Diabetes illai. Surgery panala before.'),
    (7,  1, 'Vayiru vali iruku, nethu raathiri-la start aachu.'),
    (7,  2, 'Nethu raathiri munnaadi-la iruku, innum kammi aagala.'),
    (8,  1, 'Thalai vali romba iruku, oru vaaram-a aachu.'),
    (8,  2, 'Oru vaaram-a iruku, padipadiyaa increase aachu.'),
    (8,  3, 'Crocin eduthen, aana relief illai.'),
    (8,  4, 'Endha allergy-um illai doctor.'),
    (8,  5, 'Sahaja BP iruku, matrapadi onnum illai.'),
    (11, 1, 'Joram-a iruku, jaastiya irumal-um varuthu.'),
    (11, 2, 'Moonu naal-a aachu, raathiri jaasti aagum.'),
    (11, 3, 'Veetla paracetamol eduthen, konjam kammi aanaachu.'),
    (11, 4, 'Penicillin-ku allergy iruku-nu munnaadi solraanga.'),
    (11, 5, 'Sugar konjam border-la iruku, marundhu edukala.'),
    (12, 1, 'Moochu thinaral maathiri feel aaguthu.'),
    (12, 2, 'Rendu naal-a aachu, padikira-pothu jaasti.'),
    (12, 3, 'Inhaler use panren, aana innaiku kudukala.'),
    (12, 4, 'Dust-ku allergy iruku, thummal varum.'),
    (12, 5, 'Asthma childhood-la irundhu iruku.'),
    (13, 1, 'Vayitru pokku iruku, kaalai-la irundhu.'),
    (13, 2, 'Indha kaalai-la start aachu, ippo konjam thaan.'),
    (13, 3, 'ORS kudichen, innum sariyaagala.'),
    (13, 4, 'Endha allergy-um theriyala.'),
    (13, 5, 'Munnaadi onnum periya problem illai.')
  ) AS a(token_number, order_index, transcript)
  JOIN visits vis ON vis.token_number = a.token_number
  JOIN questions q ON q.template_id = 1 AND q.order_index = a.order_index
  WHERE NOT EXISTS (
    SELECT 1 FROM answers ex WHERE ex.visit_id = vis.id AND ex.question_id = q.id
  );

-- Summaries for the other already-summarised/done seeded visits (token 4 above).
INSERT INTO summaries (visit_id, summary_text, generated_by)
  SELECT v.id,
    'Patient intake summary (demo): chief complaint with stated duration captured; '
    || 'medication tried with partial relief; allergy and past history noted. '
    || 'Requires physical examination and basic investigations.',
    'mock'
  FROM visits v
  WHERE v.token_number IN (11, 12)
  AND NOT EXISTS (SELECT 1 FROM summaries s WHERE s.visit_id = v.id);
