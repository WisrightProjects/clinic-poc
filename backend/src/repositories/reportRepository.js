const db = require('../config/db');
const { withTransaction } = require('./transaction');

// file_path stays internal (the API serves files by report id), so it isn't returned.
const COLUMNS = 'r.id, r.visit_id, r.mime_type, r.size_bytes, r.uploaded_by, r.created_at';

// files: [{ path, mimeType, size }] — one INSERT for all of them. The visit row is
// locked first and check(status, existingCount) runs inside the same transaction, so
// two uploads at once (or a submit during a slow upload) can't pass the rules twice.
async function createMany(visitId, userId, files, check) {
  const params = [visitId, userId];
  const values = files.map(f => {
    params.push(f.path, f.mimeType, f.size);
    const n = params.length;
    return `($1, $${n - 2}, $${n - 1}, $${n}, $2)`;
  });
  return withTransaction(async client => {
    const { rows: [visit] } = await client.query('SELECT status FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
    const { rows: [{ n }] } = await client.query(
      'SELECT COUNT(*)::int AS n FROM visit_reports WHERE visit_id = $1', [visitId]
    );
    check(visit.status, n);
    const { rows } = await client.query(
      `INSERT INTO visit_reports AS r (visit_id, file_path, mime_type, size_bytes, uploaded_by)
       VALUES ${values.join(', ')} RETURNING ${COLUMNS}`,
      params
    );
    return rows;
  });
}

async function findByVisitId(visitId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM visit_reports r WHERE r.visit_id = $1 ORDER BY r.id`,
    [visitId]
  );
  return rows;
}

async function countByVisitId(visitId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM visit_reports WHERE visit_id = $1', [visitId]);
  return rows[0].n;
}

// Scoped through the report's visit: another clinic's report comes back null.
// Includes file_path and the visit status, for serving and deleting.
async function findByIdForClinic(clinicId, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}, r.file_path, v.status AS visit_status
       FROM visit_reports r JOIN visits v ON v.id = r.visit_id
      WHERE r.id = $1 AND v.clinic_id = $2`,
    [id, clinicId]
  );
  return rows[0] || null;
}

async function remove(id) {
  await db.query('DELETE FROM visit_reports WHERE id = $1', [id]);
}

module.exports = { createMany, findByVisitId, countByVisitId, findByIdForClinic, remove };
