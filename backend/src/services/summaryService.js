const config = require('../config');

const MOCK_SUMMARY = 'Patient presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes. Requires physical examination. Consider CBC and fever panel.';

async function generate(_visitId) {
  if (config.useMockSummary) {
    return MOCK_SUMMARY;
  }
  // Real LLM drops in here without changing the endpoint contract
  return MOCK_SUMMARY;
}

module.exports = { generate };
