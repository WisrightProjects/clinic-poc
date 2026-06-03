const db = require('../config/db');

async function findAll() {
  const { rows } = await db.query('SELECT * FROM departments ORDER BY name');
  return rows;
}

module.exports = { findAll };
