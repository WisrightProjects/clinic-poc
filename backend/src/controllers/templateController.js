const templateService = require('../services/templateService');

async function list(req, res) {
  const template = await templateService.getByDepartment(req.user.clinicId, req.query.departmentId);
  res.json(template);
}

async function update(req, res) {
  const template = await templateService.update(req.user.clinicId, req.params.id, req.body.questions);
  res.json(template);
}

module.exports = { list, update };
