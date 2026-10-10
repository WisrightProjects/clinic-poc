const visitService = require('../services/visitService');

async function create(req, res) {
  const { patientName, age, sex, departmentId } = req.body;
  const visit = await visitService.create(req.user.clinicId, { patientName, age, sex, departmentId });
  res.status(201).json(visit);
}

async function list(req, res) {
  const visits = await visitService.list(req.user.clinicId, req.query.status);
  res.json(visits);
}

async function getById(req, res) {
  const data = await visitService.getById(req.user.clinicId, req.params.id);
  res.json(data);
}

async function updateStatus(req, res) {
  const visit = await visitService.updateStatus(req.user.clinicId, req.params.id, req.body.status);
  res.json(visit);
}

async function submit(req, res) {
  const summary = await visitService.submit(req.user.clinicId, req.params.id);
  res.json({ status: 'summarised', summary });
}

async function editSummary(req, res) {
  const summary = await visitService.editSummary(req.user.clinicId, req.params.id, req.body.text, req.user.id);
  res.json(summary);
}

module.exports = { create, list, getById, updateStatus, submit, editSummary };
