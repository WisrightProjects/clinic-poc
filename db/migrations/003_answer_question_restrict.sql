ALTER TABLE answers
  DROP CONSTRAINT IF EXISTS answers_question_id_fkey,
  ADD CONSTRAINT answers_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE RESTRICT;
