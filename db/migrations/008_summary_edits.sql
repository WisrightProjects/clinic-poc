-- CLINIC-012: the doctor can edit the AI summary. The AI's original stays in
-- summary_text; the doctor's version goes in edited_text, with who and when.
-- Forward-only and idempotent.

ALTER TABLE summaries
  ADD COLUMN IF NOT EXISTS edited_text TEXT,
  ADD COLUMN IF NOT EXISTS edited_by   INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS edited_at   TIMESTAMPTZ;
