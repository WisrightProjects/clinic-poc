const visitService = require('../services/visitService');

async function create(req, res) {
  const { patientName, age, sex, departmentId } = req.body;
  const visit = await visitService.create({ patientName, age, sex, departmentId });
  res.status(201).json(visit);
}

async function list(req, res) {
  const visits = await visitService.list(req.query.status);
  res.json(visits);
}

async function getById(req, res) {
  const data = await visitService.getById(req.params.id);
  res.json(data);
}

async function updateStatus(req, res) {
  const visit = await visitService.updateStatus(req.params.id, req.body.status);
  res.json(visit);
}

async function submit(req, res) {
  const visit = await visitService.submit(req.params.id);
  res.json(visit);
}

module.exports = { create, list, getById, updateStatus, submit };
