-- CLINIC-012: the doctor can edit the AI summary. The AI's original stays in
-- summary_text; the doctor's version goes in edited_text, with who and when.
-- display_text is the one rule for what to show (the edit, else the AI text), so
-- every reader selects it instead of repeating COALESCE.
-- Forward-only and idempotent.

ALTER TABLE summaries
  ADD COLUMN IF NOT EXISTS edited_text  TEXT,
  ADD COLUMN IF NOT EXISTS edited_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS display_text TEXT GENERATED ALWAYS AS (COALESCE(edited_text, summary_text)) STORED;
