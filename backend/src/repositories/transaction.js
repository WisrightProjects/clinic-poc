const db = require('../config/db');

// Runs fn(client) inside BEGIN/COMMIT on one pooled connection; any throw rolls back.
// Every multi-statement write goes through here instead of repeating the boilerplate.
async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Locks a visit's row for the rest of the transaction and returns its status, so writes that
// depend on the visit (summary rows, report uploads, choice answers) can't interleave.
async function lockVisit(client, visitId) {
  const { rows: [visit] } = await client.query('SELECT status FROM visits WHERE id = $1 FOR UPDATE', [visitId]);
  return visit?.status;
}

module.exports = { withTransaction, lockVisit };
