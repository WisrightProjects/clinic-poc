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
  useMockSummary: process.env.USE_MOCK_SUMMARY === 'true',
  audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
