const db = require('../config/db');

async function upsert(visitId, questionId, audioPath, transcriptStatus) {
  const { rows } = await db.query(
    `INSERT INTO answers (visit_id, question_id, audio_path, transcript_status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (visit_id, question_id) DO UPDATE
       SET audio_path = EXCLUDED.audio_path,
           transcript_status = EXCLUDED.transcript_status,
           transcript = NULL,
           created_at = now()
     RETURNING *`,
    [visitId, questionId, audioPath, transcriptStatus]
  );
  return rows[0];
}

async function setTranscript(answerId, transcript, status) {
  const { rows } = await db.query(
    `UPDATE answers SET transcript = $1, transcript_status = $2 WHERE id = $3 RETURNING *`,
    [transcript, status, answerId]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM answers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByVisitId(visitId) {
  const { rows } = await db.query(
    'SELECT * FROM answers WHERE visit_id = $1 ORDER BY question_id',
    [visitId]
  );
  return rows;
}

async function countByVisitId(visitId) {
  const { rows } = await db.query(
    'SELECT COUNT(*) AS count FROM answers WHERE visit_id = $1',
    [visitId]
  );
  return parseInt(rows[0].count, 10);
}

module.exports = { upsert, setTranscript, findById, findByVisitId, countByVisitId };
