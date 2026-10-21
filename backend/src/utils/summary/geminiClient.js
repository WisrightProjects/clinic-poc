const gemini = require('../gemini');
const { buildSummaryPrompt } = require('./prompt');

// AI summary with Gemini, from the visit's real Q&A (prompt.js). Same shape as kimiClient.
async function summarise(visit, qa, language) {
  return gemini.generate('summary', [{ text: buildSummaryPrompt(visit, qa, language) }]);
}

module.exports = { summarise };
