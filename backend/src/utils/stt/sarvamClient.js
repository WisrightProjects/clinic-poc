const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../../config');

async function transcribe(filePath) {
  if (config.useMockStt) {
    return 'Mock transcript: patient reported symptoms for testing purposes.';
  }

  if (!config.sarvamApiKey) {
    throw new Error('SARVAM_API_KEY is not configured');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('language_code', 'ta-IN');
    const response = await axios.post('https://api.sarvam.ai/speech-to-text', form, {
      headers: {
        ...form.getHeaders(),
        'api-subscription-key': config.sarvamApiKey,
      },
      timeout: 30000,
    });
    return response.data.transcript || '';
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'STT transcription failed';
    throw new Error(`Sarvam STT error: ${msg}`);
  }
}

module.exports = { transcribe };
