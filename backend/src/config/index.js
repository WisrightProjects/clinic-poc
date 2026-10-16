const path = require('path');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}
// Signs login tokens (CLINIC-008). Long and random; anyone who has it can forge a login.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Missing or too short environment variable: JWT_SECRET (at least 32 characters)');
}

const audioDir = process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio');
// Provider names are matched exactly, so 'Gemini' or 'gemini ' set in Coolify would silently fall
// back to whisper / mock.
const providerName = (value, fallback) => (value || '').trim().toLowerCase() || fallback;
const sttProvider = providerName(process.env.STT_PROVIDER, 'whisper');
const summaryProvider = providerName(process.env.SUMMARY_PROVIDER, 'mock');
if ((sttProvider === 'gemini' || summaryProvider === 'gemini') && !process.env.GEMINI_API_KEY) {
  console.warn('[config] Gemini is selected but GEMINI_API_KEY is not set: transcriptions will fail and summaries fall back');
}

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  sarvamApiKey: process.env.SARVAM_API_KEY || null,
  sttProvider, // 'whisper' | 'sarvam' | 'gemini'
  whisperUrl: process.env.WHISPER_URL || 'http://localhost:8000',
  sttLanguage: process.env.STT_LANGUAGE || 'auto',
  // Summary provider: 'mock' (canned), 'kimi' (paid, OpenAI-compatible API), 'gemini' (paid).
  summaryProvider,
  summaryLanguage: process.env.SUMMARY_LANGUAGE || 'English',
  // Kimi (Moonshot AI) — paid, OpenAI-compatible. Base URL must end in /v1, e.g. https://api.moonshot.ai/v1
  kimiApiKey: process.env.KIMI_API_KEY || null,
  kimiBaseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1',
  kimiModel: process.env.KIMI_MODEL || 'kimi-k2.6',
  // 'disabled' (default) or 'enabled'. Thinking mode spends ~1,000+ hidden reasoning tokens per
  // summary (~45s vs ~4s), which pushed 15-17 question intakes past the 60s timeout.
  kimiThinking: process.env.KIMI_THINKING === 'enabled' ? 'enabled' : 'disabled',
  // Google Gemini — used when STT_PROVIDER and/or SUMMARY_PROVIDER is 'gemini' (see utils/gemini.js).
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  // The languages a patient may answer in (Gemini STT picks one per answer and writes it in
  // that language's script).
  geminiLanguages: (process.env.GEMINI_LANGUAGES || '').trim() || 'Tamil, Hindi or English',
  audioDir,
  // Report photos (CLINIC-011). Inside AUDIO_DIR by default so the one persistent
  // uploads volume keeps both recordings and reports across redeploys.
  reportsDir: process.env.REPORTS_DIR || path.join(audioDir, 'reports'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
