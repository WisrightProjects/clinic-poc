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

// Scoped through the answer's visit: another clinic's answer comes back null.
async function findByIdForClinic(clinicId, id) {
  const { rows } = await db.query(
    'SELECT a.* FROM answers a JOIN visits v ON v.id = a.visit_id WHERE a.id = $1 AND v.clinic_id = $2',
    [id, clinicId]
  );
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

module.exports = { upsert, setTranscript, findByIdForClinic, findByVisitId, countByVisitId };
