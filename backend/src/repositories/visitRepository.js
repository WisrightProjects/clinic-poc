const db = require('../config/db');

async function create({ tokenNumber, patientName, age, sex, departmentId }) {
  const { rows } = await db.query(
    `INSERT INTO visits (token_number, patient_name, age, sex, department_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tokenNumber, patientName, age, sex, departmentId]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM visits WHERE id = $1', [id]);
  return rows[0] || null;
}

// Each queue row carries intake progress so the client can show "answered/total"
// without a per-visit fetch:
//   answered_count  = recorded answer rows for the visit (matches maybeAdvance)
//   total_questions = questions in the department's active template (0 if none).
//                     A department is expected to have exactly one active template;
//                     if more than one is ever active, the lowest id wins.
// Counts are cast ::int so pg returns numbers, not bigint strings.
const PROGRESS_COLUMNS = `
  (SELECT COUNT(*)::int FROM answers a WHERE a.visit_id = v.id) AS answered_count,
  (SELECT COUNT(*)::int FROM questions q
     WHERE q.template_id = (
       SELECT t.id FROM question_templates t
        WHERE t.department_id = v.department_id AND t.is_active
        ORDER BY t.id LIMIT 1)) AS total_questions`;

async function list(statusFilter) {
  if (statusFilter && statusFilter.length > 0) {
    const { rows } = await db.query(
      `SELECT v.*, ${PROGRESS_COLUMNS}
         FROM visits v
        WHERE v.status = ANY($1::visit_status[])
        ORDER BY v.token_number`,
      [statusFilter]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT v.*, ${PROGRESS_COLUMNS} FROM visits v ORDER BY v.token_number`
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

async function createWithToken({ patientName, age, sex, departmentId }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Advisory lock serializes all token allocations for the day,
    // including the first visit when no rows exist yet to FOR UPDATE.
    await client.query('SELECT pg_advisory_xact_lock($1)', [TOKEN_LOCK_KEY]);
    const { rows: existing } = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next
         FROM visits
        WHERE visit_date = CURRENT_DATE`
    );
    const nextToken = existing[0].next;
    const { rows } = await client.query(
      `INSERT INTO visits (token_number, patient_name, age, sex, department_id, visit_date)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE) RETURNING *`,
      [nextToken, patientName, age, sex, departmentId]
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

module.exports = { create, createWithToken, findById, list, updateStatus };
