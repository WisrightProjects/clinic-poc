const db = require('../config/db');

// Every read is scoped to the caller's clinic (CLINIC-008): another clinic's visit
// comes back null, so callers answer 404 and ids can't be probed.
async function findById(clinicId, id) {
  const { rows } = await db.query('SELECT * FROM visits WHERE id = $1 AND clinic_id = $2', [id, clinicId]);
  return rows[0] || null;
}

// Each queue row carries intake progress so the client can show "answered/total"
// without a per-visit fetch:
//   answered_count  = recorded answer rows for the visit (matches maybeAdvance)
//   total_questions = questions in the clinic's active template for the department
//                     (0 if none). A department is expected to have exactly one active template;
//                     if more than one is ever active, the lowest id wins.
// Counts are cast ::int so pg returns numbers, not bigint strings.
const PROGRESS_COLUMNS = `
  (SELECT COUNT(*)::int FROM answers a WHERE a.visit_id = v.id) AS answered_count,
  (SELECT COUNT(*)::int FROM questions q
     WHERE q.template_id = (
       SELECT t.id FROM question_templates t
        WHERE t.department_id = v.department_id AND t.clinic_id = v.clinic_id AND t.is_active
        ORDER BY t.id LIMIT 1)) AS total_questions`;

// A short excerpt of the visit's AI summary, so the queue row can show a
// two-line preview without a per-visit fetch. Only submitted visits
// (summarised/done) have a summary; others come back null. Truncated to keep
// the list payload small — the client clamps it to two lines anyway.
const SUMMARY_COLUMN = `
  (SELECT LEFT(s.summary_text, 240)
     FROM summaries s
    WHERE s.visit_id = v.id
    ORDER BY s.created_at DESC
    LIMIT 1) AS summary_excerpt`;

// An empty statusFilter means every status.
async function list(clinicId, statusFilter) {
  const { rows } = await db.query(
    `SELECT v.*, ${PROGRESS_COLUMNS}, ${SUMMARY_COLUMN}
       FROM visits v
      WHERE v.clinic_id = $1
        AND (cardinality($2::visit_status[]) = 0 OR v.status = ANY($2::visit_status[]))
      ORDER BY v.token_number`,
    [clinicId, statusFilter]
  );
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE visits SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}

const TOKEN_LOCK_KEY = 20240001;

// Tokens restart at 1 per clinic per day.
async function createWithToken(clinicId, { patientName, age, sex, departmentId }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Per-clinic advisory lock (two-int form) serializes token allocation within a
    // clinic, including its first visit of the day when no rows exist yet to FOR UPDATE.
    // Different clinics never wait on each other.
    await client.query('SELECT pg_advisory_xact_lock($1, $2)', [TOKEN_LOCK_KEY, clinicId]);
    const { rows: existing } = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next
         FROM visits
        WHERE visit_date = CURRENT_DATE AND clinic_id = $1`,
      [clinicId]
    );
    const nextToken = existing[0].next;
    const { rows } = await client.query(
      `INSERT INTO visits (clinic_id, token_number, patient_name, age, sex, department_id, visit_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE) RETURNING *`,
      [clinicId, nextToken, patientName, age, sex, departmentId]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createWithToken, findById, list, updateStatus };
