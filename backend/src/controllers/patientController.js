const patientService = require('../services/patientService');

// CLINIC-027: POST /patients/lookup — the attender's "Seen before" list on New Patient.
async function lookup(req, res) {
  res.json(await patientService.lookup(req.user.clinicId, req.body));
}

module.exports = { lookup };
