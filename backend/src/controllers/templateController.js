const templateService = require('../services/templateService');

async function list(req, res) {
  const template = await templateService.getByDepartment(req.query.departmentId);
  res.json(template);
}

async function update(req, res) {
  const template = await templateService.update(req.params.id, req.body.questions);
  res.json(template);
}

module.exports = { list, update };
