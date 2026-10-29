const visitService = require('../services/visitService');

async function create(req, res) {
  // validateNewVisit (in the service) keeps only the fields it knows.
  const visit = await visitService.create(req.user.clinicId, req.body ?? {});
  res.status(201).json(visit);
}

async function list(req, res) {
  const visits = await visitService.list(req.user.clinicId, req.query.status, req.query.date);
  res.json(visits);
}

async function getById(req, res) {
  const data = await visitService.getById(req.user.clinicId, req.params.id, { withHistory: req.user.role === 'doctor' });
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

// CLINIC-024: PUT /visits/:id/vitals — the attender's vitals form.
async function saveVitals(req, res) {
  res.json(await visitService.saveVitals(req.user.clinicId, req.params.id, req.body ?? {}, req.user.id));
}

module.exports = { create, list, getById, updateStatus, submit, editSummary, saveVitals };
