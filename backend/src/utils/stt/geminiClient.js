const fs = require('fs');
const path = require('path');
const config = require('../../config');
const gemini = require('../gemini');

// Speech-to-text with Gemini, one request per answer: Gemini first names the ONE language the
// answer is spoken in (from GEMINI_LANGUAGES), then writes it word for word in that language's
// own script — so a patient can switch language from answer to answer. Naming the language
// first keeps the script right (CLINIC-013: 24/24 English, Tamil and Hindi answers correct).
// Telugu is not proven yet: Telugu spoken by a Tamil speaker was named "Tamil". Unclear parts come
// back as [unclear]. STT_LANGUAGE is not used (Whisper only). Same shape as whisperClient.
function buildPrompt(languages) {
  return [
    `This patient may answer in ${languages}. First decide which ONE language this answer is spoken in.`,
    "Then transcribe it exactly, word for word, written in that language's own script: Tamil in",
    'Tamil script, Telugu in Telugu script, Hindi in Devanagari, English in English letters. Never',
    "write one language in another language's script. English words mixed into another language",
    'stay as spoken. Do not translate, correct, summarise or add anything. If a part is not clear,',
    'write [unclear]. Reply on one line exactly as: <language name> | <transcript>',
  ].join(' ');
}

// "Tamil | இப்ப வரைக்கும் …" → the transcript. The label is dropped when it is a language name
// followed by "|", ":" or a line break, or is the whole reply (a near-silent clip can come back as
// just "English"). Any other reply is kept whole, so a transcript containing "|" isn't cut.
const LANGUAGE_LABEL = /^\s*(tamil|telugu|hindi|english|kannada|malayalam|marathi|bengali|gujarati|punjabi|urdu|odia)\s*(?:[|:\n]|$)/i;
function parseReply(reply) {
  return reply.replace(LANGUAGE_LABEL, '').trim();
}

async function transcribe(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`);
  }
  const data = (await fs.promises.readFile(filePath)).toString('base64');
  const reply = await gemini.generate('STT', [
    { text: buildPrompt(config.geminiLanguages) },
    gemini.inlinePart(gemini.audioMimeType(path.extname(filePath)), data),
  ]);
  return parseReply(reply); // an empty transcript is rejected in sttService
}

module.exports = { transcribe, buildPrompt, parseReply };
