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
  // Summary provider: 'mock' (canned), 'ollama' (free local LLM). 'claude'/'sarvam' plug in later.
  summaryProvider: process.env.SUMMARY_PROVIDER || (process.env.USE_MOCK_SUMMARY === 'true' ? 'mock' : 'mock'),
  summaryLanguage: process.env.SUMMARY_LANGUAGE || 'English',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5',
  audioDir: process.env.AUDIO_DIR || path.join(__dirname, '../../../storage/audio'),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081').split(','),
};
