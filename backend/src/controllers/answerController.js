const config = require('../config');
const answerService = require('../services/answerService');
const { AppError } = require('../utils/errors');
const { validateAnswer } = require('../utils/answerValidation');

// An answer is either a recording (multipart file "audio") or typed text (field "text"),
// never both and never neither (CLINIC-009). multer parses the multipart body in both
// cases, so the mobile client keeps one upload path. The check lives here because it
// depends on req.file; it runs before any DB work.
async function create(req, res) {
  const { questionId } = req.body;
  if (!questionId) throw new AppError('BAD_REQUEST', 'questionId is required', 400);
  const text = validateAnswer({ hasAudio: Boolean(req.file), text: req.body.text });
  const { clinicId } = req.user;
  const answer = text
    ? await answerService.recordTextAnswer(clinicId, req.params.id, questionId, text)
    : await answerService.recordAnswer(clinicId, req.params.id, questionId, req.file);
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
