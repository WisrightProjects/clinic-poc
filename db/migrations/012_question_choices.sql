-- CLINIC-021 (step A): answer types and branching, without changing any question list yet.
--   questions.answer_type  how the question is answered: 'voice' (record or type, as before)
--                          or 'choice' (tap options). Later types (number, date) are added
--                          here; an app that doesn't know a type asks the attender to update.
--   questions.options      for 'choice': [{ "value": "diabetes", "label": "Diabetes",
--                          "section": "diabetes" }, …]. "value" is the stable id stored in
--                          answers; "section" (optional) is the section the option shows.
--   questions.multi        more than one option may be chosen.
--   questions.section      the question shows only when the visit has this section (NULL = always).
--   answers.value          the structured answer for a non-voice question, e.g.
--                          { "choices": ["diabetes"], "details": "…" } (NULL for voice / typed).
--   visits.sections        the sections chosen so far (from all the visit's choice answers).
--   departments.is_active  FALSE hides a department from the New Patient picker only.
-- Forward-only and idempotent; existing rows keep working unchanged (voice, no sections).

ALTER TABLE questions   ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'voice';
ALTER TABLE questions   ADD COLUMN IF NOT EXISTS options JSONB;
ALTER TABLE questions   ADD COLUMN IF NOT EXISTS multi BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE questions   ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE answers     ADD COLUMN IF NOT EXISTS value JSONB;
ALTER TABLE visits      ADD COLUMN IF NOT EXISTS sections TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
