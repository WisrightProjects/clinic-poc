const departmentService = require('../services/departmentService');

async function list(_req, res) {
  const departments = await departmentService.list();
  res.json(departments);
}

module.exports = { list };
