const db = require('../config/db');

// summary_text is always the AI original. display_text (a generated column,
// migration 008) is what to show: the doctor's edit when there is one, else the AI's.
// Every read and write returns the row + edited_by_name.
// "Latest" is created_at DESC, id DESC everywhere (also visitRepository's queue preview).

async function create(visitId, summaryText, generatedBy) {
  const { rows } = await db.query(
    `INSERT INTO summaries (visit_id, summary_text, generated_by)
     VALUES ($1, $2, $3) RETURNING *, NULL::text AS edited_by_name`,
    [visitId, summaryText, generatedBy]
  );
  return rows[0];
}

async function findByVisitId(visitId) {
  const { rows } = await db.query(
    `SELECT s.*, u.name AS edited_by_name
       FROM summaries s LEFT JOIN users u ON u.id = s.edited_by
      WHERE s.visit_id = $1
      ORDER BY s.created_at DESC, s.id DESC LIMIT 1`,
    [visitId]
  );
  return rows[0] || null;
}

// Stores the doctor's edit on the visit's latest summary in one statement and
// returns it, or null when the visit has no summary. summary_text is never touched.
// Note for CLINIC-014: a regenerated summary is a NEW row, so it starts unedited —
// regeneration must decide on purpose whether to carry this edit forward.
async function updateEdit(visitId, text, userId) {
  const { rows } = await db.query(
    `WITH upd AS (
       UPDATE summaries SET edited_text = $1, edited_by = $2, edited_at = now()
        WHERE id = (SELECT id FROM summaries WHERE visit_id = $3
                     ORDER BY created_at DESC, id DESC LIMIT 1)
       RETURNING *)
     SELECT upd.*, u.name AS edited_by_name FROM upd LEFT JOIN users u ON u.id = upd.edited_by`,
    [text, userId, visitId]
  );
  return rows[0] || null;
}

module.exports = { create, findByVisitId, updateEdit };
