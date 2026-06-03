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

async function list(statusFilter) {
  if (statusFilter && statusFilter.length > 0) {
    const { rows } = await db.query(
      `SELECT * FROM visits WHERE status = ANY($1::visit_status[]) ORDER BY token_number`,
      [statusFilter]
    );
    return rows;
  }
  const { rows } = await db.query('SELECT * FROM visits ORDER BY token_number');
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await db.query(
    `UPDATE visits SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0];
}

async function getNextToken() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(token_number), 0) + 1 AS next_token
       FROM visits WHERE created_at::date = CURRENT_DATE
       FOR UPDATE`
    );
    await client.query('COMMIT');
    return rows[0].next_token;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { create, findById, list, updateStatus, getNextToken };
