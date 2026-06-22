const axios = require('axios');
const config = require('../../config');
const { buildSummaryPrompt } = require('./prompt');

// Free, open-source summary provider. Calls a local Ollama server's /api/generate
// with a clinical-summary prompt built from the visit's real Q&A. Returns the text.
async function summarise(visit, qa, language) {
  const prompt = buildSummaryPrompt(visit, qa, language || 'English');
  const response = await axios.post(
    `${config.ollamaUrl}/api/generate`,
    { model: config.ollamaModel, prompt, stream: false },
    { timeout: 180000 } // CPU LLM inference can be slow
  );
  return (response.data.response || '').trim();
}

module.exports = { summarise };
