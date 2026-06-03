const departmentRepository = require('../repositories/departmentRepository');

async function list() {
  return departmentRepository.findAll();
}

module.exports = { list };
