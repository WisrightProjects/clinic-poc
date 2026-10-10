const config = require('../config');
const answerService = require('../services/answerService');
const { AppError } = require('../utils/errors');

async function create(req, res) {
  if (!req.file) throw new AppError('BAD_REQUEST', 'Audio file is required', 400);
  const { questionId } = req.body;
  if (!questionId) throw new AppError('BAD_REQUEST', 'questionId is required', 400);
  const answer = await answerService.recordAnswer(req.user.clinicId, req.params.id, questionId, req.file);
  res.status(201).json(answer);
}

// sendFile with `root` refuses paths that escape AUDIO_DIR (e.g. '..').
async function audio(req, res, next) {
  const audioPath = await answerService.getAudioPath(req.user.clinicId, req.params.id);
  res.sendFile(audioPath, { root: config.audioDir }, err => {
    if (err && !res.headersSent) next(new AppError('NOT_FOUND', 'Recording not found', 404));
  });
}

module.exports = { create, audio };
