const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const sttService = require('./sttService');
const visitService = require('./visitService');

async function recordAnswer(visitId, questionId, file) {
  if (!file || !file.path) {
    const err = new Error('Audio file is required');
    err.status = 400;
    throw err;
  }
  const audioPath = path.relative(config.audioDir, file.path);
  const answer = await answerRepository.upsert(visitId, questionId, audioPath, 'pending');
  try {
    const transcript = await sttService.transcribe(file.path);
    await answerRepository.setTranscript(answer.id, transcript, 'done');
  } catch (_err) {
    await answerRepository.setTranscript(answer.id, null, 'failed');
  }
  await visitService.maybeAdvance(visitId);
  return answerRepository.findById(answer.id);
}

module.exports = { recordAnswer };
