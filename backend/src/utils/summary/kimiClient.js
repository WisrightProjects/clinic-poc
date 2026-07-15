const axios = require('axios');
const config = require('../../config');
const { buildSummaryPrompt } = require('./prompt');

// Paid summary provider: Kimi (Moonshot AI). OpenAI-compatible Chat Completions API,
// built from the visit's real Q&A via prompt.js. Base URL must end in /v1 (e.g. https://api.moonshot.ai/v1);
// we append /chat/completions. Returns the generated summary text.
async function summarise(visit, qa, language) {
  const prompt = buildSummaryPrompt(visit, qa, language || 'English');
  const baseUrl = config.kimiBaseUrl.replace(/\/+$/, ''); // tolerate a trailing slash
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model: config.kimiModel,
      messages: [{ role: 'user', content: prompt }],
      // No temperature override: some Kimi models (e.g. kimi-k2.5) reject anything but 1,
      // so we let the model apply its default. Grounding is enforced via the prompt.
    },
    {
      headers: {
        Authorization: `Bearer ${config.kimiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // cloud API; generous headroom but well under the mobile submit timeout
    }
  );
  return (response.data?.choices?.[0]?.message?.content || '').trim();
}

module.exports = { summarise };
