const answerService = require('../services/answerService');
const { AppError } = require('../utils/errors');

async function create(req, res) {
  if (!req.file) throw new AppError('BAD_REQUEST', 'Audio file is required', 400);
  const { questionId } = req.body;
  if (!questionId) throw new AppError('BAD_REQUEST', 'questionId is required', 400);
  const answer = await answerService.recordAnswer(req.user.clinicId, req.params.id, questionId, req.file);
  res.status(201).json(answer);
}

async function audio(req, res) {
  const file = await answerService.getAudioFile(req.user.clinicId, req.params.id);
  res.sendFile(file);
}

module.exports = { create, audio };
