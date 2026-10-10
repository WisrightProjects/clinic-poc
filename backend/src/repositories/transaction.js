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

module.exports = { withTransaction };
