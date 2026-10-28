const db = require('../config/db');

// The department list (New Patient and Settings pickers). A hidden department (is_active =
// false, CLINIC-021: a retired list) is left out here only: its visits still load and submit.
async function findAll() {
  const { rows } = await db.query('SELECT * FROM departments WHERE is_active ORDER BY name');
  return rows;
}

module.exports = { findAll };
