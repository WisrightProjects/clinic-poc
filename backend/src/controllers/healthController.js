const db = require('../config/db');

async function check(_req, res) {
  let dbOk = false;
  try {
    await db.query('SELECT 1');
    dbOk = true;
  } catch (_err) {}
  res.json({ status: 'ok', db: dbOk });
}

module.exports = { check };
