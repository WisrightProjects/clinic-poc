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
      // Thinking off by default: a summary of given answers doesn't need hidden reasoning,
      // and with it on long intakes regularly exceeded the timeout below.
      thinking: { type: config.kimiThinking },
    },
    {
      headers: {
        Authorization: `Bearer ${config.kimiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000, // cloud API; generous headroom but well under the mobile submit timeout
    }
  );
  const text = (response.data?.choices?.[0]?.message?.content || '').trim();
  // An empty reply would be stored as a blank summary that submit never regenerates;
  // throw so summaryService records the marked fallback instead.
  if (!text) throw new Error('Kimi returned an empty summary');
  return text;
}

module.exports = { summarise };
