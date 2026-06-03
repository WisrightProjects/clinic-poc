const config = require('../config');
const sarvamClient = require('../utils/stt/sarvamClient');

const MOCK_TRANSCRIPTS = [
  'Fever iruku, 3 days-a aachu. Romba tired-a feel panren.',
  'Rendu vaaram-a iruku. Kadaisila worse-a aachu.',
  'Paracetamol mattum eduthen. Doctor prescribe panala.',
  'Penicillin allergy iruku. Sulfa drugs also react aachu before.',
  'BP iruku, controlled. Diabetes illai. Surgery panala before.',
];

let mockIndex = 0;

async function transcribe(filePath) {
  if (config.useMockStt) {
    const transcript = MOCK_TRANSCRIPTS[mockIndex % MOCK_TRANSCRIPTS.length];
    mockIndex++;
    return transcript;
  }
  return sarvamClient.transcribe(filePath);
}

module.exports = { transcribe };
