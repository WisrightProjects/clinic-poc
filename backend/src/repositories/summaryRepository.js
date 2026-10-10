const db = require('../config/db');

async function create(visitId, summaryText, generatedBy) {
  const { rows } = await db.query(
    `INSERT INTO summaries (visit_id, summary_text, generated_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [visitId, summaryText, generatedBy]
  );
  return rows[0];
}

// The visit's latest summary, with the editing doctor's name (CLINIC-012).
// summary_text is always the AI's original; edited_text is the doctor's version.
async function findByVisitId(visitId) {
  const { rows } = await db.query(
    `SELECT s.*, u.name AS edited_by_name
       FROM summaries s LEFT JOIN users u ON u.id = s.edited_by
      WHERE s.visit_id = $1
      ORDER BY s.created_at DESC LIMIT 1`,
    [visitId]
  );
  return rows[0] || null;
}

// Stores the doctor's edit on that summary row; summary_text is never touched.
async function updateEdit(summaryId, text, userId) {
  await db.query(
    'UPDATE summaries SET edited_text = $1, edited_by = $2, edited_at = now() WHERE id = $3',
    [text, userId, summaryId]
  );
}

module.exports = { create, findByVisitId, updateEdit };
