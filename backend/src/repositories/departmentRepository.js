const db = require('../config/db');

// The department list (New Patient and Settings pickers). A hidden department (is_active =
// false, CLINIC-021/022: a retired list) is left out here and takes no new patients
// (visitService.create); its existing visits still load and submit.
async function findAll() {
  const { rows } = await db.query('SELECT * FROM departments WHERE is_active ORDER BY name');
  return rows;
}

// Departments are global (CLINIC-008), so no clinic filter.
async function findById(id) {
  const { rows } = await db.query('SELECT * FROM departments WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { findAll, findById };
