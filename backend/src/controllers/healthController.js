const db = require('../config/db');

async function check(_req, res) {
  let dbOk = false;
  try {
    await db.query('SELECT 1');
    dbOk = true;
  } catch (_err) {}
  if (!dbOk) return res.status(503).json({ status: 'error', db: false });
  res.json({ status: 'ok', db: true });
}

module.exports = { check };
