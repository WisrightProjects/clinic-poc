const path = require('path');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  sarvamApiKey: process.env.SARVAM_API_KEY || null,
  sttProvider: process.env.STT_PROVIDER || 'whisper', // 'whisper' | 'sarvam'
  whisperUrl: process.env.WHISPER_URL || 'http://localhost:8000',
  sttLanguage: process.env.STT_LANGUAGE || 'auto',
  // Summary provider: 'mock' (canned), 'kimi' (paid, OpenAI-compatible API).
  summaryProvider: process.env.SUMMARY_PROVIDER || (process.env.USE_MOCK_SUMMARY === 'true' ? 'mock' : 'mock'),
  summaryLanguage: process.env.SUMMARY_LANGUAGE || 'English',
  // Kimi (Moonshot AI) — paid, OpenAI-compatible. Base URL must end in /v1, e.g. https://api.moonshot.ai/v1
  kimiApiKey: process.env.KIMI_API_KEY || null,
  kimiBaseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1',
  kimiModel: process.env.KIMI_MODEL || 'moonshot-v1-8k',
  audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
