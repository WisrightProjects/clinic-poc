const db = require('../config/db');

async function create(visitId, summaryText, generatedBy) {
  const { rows } = await db.query(
    `INSERT INTO summaries (visit_id, summary_text, generated_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [visitId, summaryText, generatedBy]
  );
  return rows[0];
}

async function findByVisitId(visitId) {
  const { rows } = await db.query('SELECT * FROM summaries WHERE visit_id = $1', [visitId]);
  return rows[0] || null;
}

module.exports = { create, findByVisitId };
