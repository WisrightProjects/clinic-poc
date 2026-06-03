const path = require('path');

module.exports = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL,
  sarvamApiKey: process.env.SARVAM_API_KEY || null,
  useMockStt: process.env.USE_MOCK_STT === 'true' || !process.env.SARVAM_API_KEY,
  useMockSummary: process.env.USE_MOCK_SUMMARY !== 'false',
  audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
