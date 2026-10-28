const db = require('../config/db');

// One answer per (visit, question). A retake — by any method — fully replaces the old
// answer (CLINIC-009 AC3): audio_path, transcript and value are all overwritten.
//   recorded: { audioPath, transcript: null, status: 'pending' }  (transcribed in the background)
//   typed:    { audioPath: null, transcript: text, status: 'done' }
//   choice:   { audioPath: null, transcript: labels, status: 'done', value: { choices, details } } (CLINIC-021)
// `client` lets a caller run it inside its transaction.
async function upsert(visitId, questionId, { audioPath, transcript, status, value = null }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO answers (visit_id, question_id, audio_path, transcript, transcript_status, value)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (visit_id, question_id) DO UPDATE
       SET audio_path = EXCLUDED.audio_path,
           transcript = EXCLUDED.transcript,
           transcript_status = EXCLUDED.transcript_status,
           value = EXCLUDED.value,
           created_at = now()
     RETURNING *`,
    [visitId, questionId, audioPath, transcript, status, value === null ? null : JSON.stringify(value)]
  );
  return rows[0];
}

// Called by the background transcription for the recording it transcribed. Only applies
// while the answer still points at that recording: if the attender has since retaken it
// (a new recording, or typed text), the late result is dropped (returns undefined) instead
// of overwriting the newer answer.
async function setTranscript(answerId, audioPath, transcript, status) {
  const { rows } = await db.query(
    `UPDATE answers SET transcript = $1, transcript_status = $2
      WHERE id = $3 AND audio_path = $4 RETURNING *`,
    [transcript, status, answerId, audioPath]
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

async function findByVisitId(visitId, client = db) {
  const { rows } = await client.query(
    'SELECT * FROM answers WHERE visit_id = $1 ORDER BY question_id',
    [visitId]
  );
  return rows;
}

module.exports = { upsert, setTranscript, findByIdForClinic, findByVisitId };
