const testRequestService = require('../services/testRequestService');

async function create(req, res) {
  const testRequest = await testRequestService.requestTests(req.user.clinicId, req.params.id, req.body.note, req.user.id);
  res.status(201).json(testRequest);
}

async function acknowledge(req, res) {
  res.json(await testRequestService.acknowledge(req.user.clinicId, req.params.id, req.user.id));
}

async function requeue(req, res) {
  res.json(await testRequestService.requeue(req.user.clinicId, req.params.id));
}

module.exports = { create, acknowledge, requeue };
