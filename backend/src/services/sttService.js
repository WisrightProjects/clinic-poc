const config = require('../config');
const sarvamClient = require('../utils/stt/sarvamClient');
const whisperClient = require('../utils/stt/whisperClient');
const geminiClient = require('../utils/stt/geminiClient');

// STT_PROVIDER → client. Anything else (blank, unknown) uses the open-source Whisper sidecar.
// Same shape as summaryService's map. Whisper alone takes STT_LANGUAGE.
const whisper = { transcribe: filePath => whisperClient.transcribe(filePath, config.sttLanguage) };
const PROVIDERS = new Map([['sarvam', sarvamClient], ['gemini', geminiClient]]);

async function transcribe(filePath) {
  const client = PROVIDERS.get(config.sttProvider) || whisper;
  const transcript = String((await client.transcribe(filePath)) || '').trim();
  // Nothing back is a failure for every provider (the answer is marked failed and the attender
  // can retake it), not a finished blank answer — same rule as the empty summary in summaryService.
  if (!transcript) throw new Error('STT error: empty transcript');
  return transcript;
}

module.exports = { transcribe };
