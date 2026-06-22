const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const config = require('../../config');

// Posts the recorded audio to the local faster-whisper sidecar (see stt-service/).
// Same shape as sarvamClient.transcribe so the two providers are interchangeable.
async function transcribe(filePath, language) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }

  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    // 'auto' (or empty) lets Whisper detect the language itself.
    if (language && language !== 'auto') {
      form.append('language', language);
    }
    const response = await axios.post(`${config.whisperUrl}/transcribe`, form, {
      headers: { ...form.getHeaders() },
      timeout: 120000, // CPU transcription can be slow
    });
    return response.data.transcript || '';
  } catch (err) {
    const msg = err.response?.data?.detail || err.message || 'Whisper transcription failed';
    throw new Error(`Whisper STT error: ${msg}`);
  }
}

module.exports = { transcribe };
