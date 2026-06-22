const config = require('../config');
const sarvamClient = require('../utils/stt/sarvamClient');
const whisperClient = require('../utils/stt/whisperClient');

async function transcribe(filePath) {
  if (config.sttProvider === 'sarvam') {
    return sarvamClient.transcribe(filePath);
  }
  // default: open-source Whisper sidecar
  return whisperClient.transcribe(filePath, config.sttLanguage);
}

module.exports = { transcribe };
