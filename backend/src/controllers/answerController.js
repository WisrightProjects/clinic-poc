const config = require('../config');
const answerService = require('../services/answerService');
const { AppError } = require('../utils/errors');
const { sendStoredFile } = require('../utils/sendStoredFile');

async function create(req, res) {
  if (!req.file) throw new AppError('BAD_REQUEST', 'Audio file is required', 400);
  const { questionId } = req.body;
  if (!questionId) throw new AppError('BAD_REQUEST', 'questionId is required', 400);
  const answer = await answerService.recordAnswer(req.user.clinicId, req.params.id, questionId, req.file);
  res.status(201).json(answer);
}

async function audio(req, res, next) {
  const audioPath = await answerService.getAudioPath(req.user.clinicId, req.params.id);
  sendStoredFile(res, next, config.audioDir, audioPath, { notFoundMessage: 'Recording not found' });
}

module.exports = { create, audio };
