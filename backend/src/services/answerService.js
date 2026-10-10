const fs = require('fs');
const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const sttService = require('./sttService');
const visitService = require('./visitService');
const { AppError } = require('../utils/errors');

async function recordAnswer(clinicId, visitId, questionId, file) {
  const visit = await findVisitForQuestion(clinicId, visitId, questionId, file);
  const audioPath = path.relative(config.audioDir, file.path);
  const answer = await answerRepository.upsert(visit.id, questionId, audioPath, 'pending');
  // Advance the visit lifecycle now — these are fast DB-only ops that don't depend
  // on the transcript (progress is derived from answer rows, not transcript text).
  await visitService.maybeAdvance(clinicId, visit.id);
  startTranscription(answer.id, file.path);
  return answerRepository.findById(answer.id); // returned with transcript_status 'pending'
}

// The visit must be in the caller's clinic (else 404) and the question in that clinic's
// template for the visit's department (else 400). Multer has already saved the file by
// the time this runs, so a rejected upload deletes it.
async function findVisitForQuestion(clinicId, visitId, questionId, file) {
  try {
    const visit = await visitService.findVisit(clinicId, visitId);
    const template = await templateRepository.findActiveByDepartmentId(clinicId, visit.department_id);
    if (!template || !template.questions.some(q => q.id === Number(questionId))) {
      throw new AppError('BAD_REQUEST', 'questionId is not a question for this visit', 400);
    }
    return visit;
  } catch (err) {
    fs.promises.unlink(file.path).catch(() => {});
    throw err;
  }
}

// Transcribe in the BACKGROUND so the upload responds immediately. Holding the mobile
// upload connection open for the full 5–8s STT duration was intermittently dropping over
// Wi-Fi as "Network Error" (the request/response never completing). The transcript
// now fills in asynchronously (transcript_status: pending → done/failed) and clients
// reload to see it — the answer row already exists, so the question shows as answered.
// Fire-and-forget background transcription. Never throws to the request handler;
// failures are recorded as transcript_status='failed', exactly as the old inline
// path did — submit still works, the answer is just marked failed.
function startTranscription(answerId, filePath) {
  (async () => {
    try {
      const transcript = await sttService.transcribe(filePath);
      await answerRepository.setTranscript(answerId, transcript, 'done');
    } catch (err) {
      console.error(`[answer] transcription failed for answer ${answerId}:`, err.message);
      try {
        await answerRepository.setTranscript(answerId, null, 'failed');
      } catch (dbErr) {
        console.error(`[answer] could not mark answer ${answerId} failed:`, dbErr.message);
      }
    }
  })();
}

// Absolute path of an answer's recording, only for the visit's own clinic (AC9).
async function getAudioFile(clinicId, answerId) {
  const answer = await answerRepository.findById(answerId);
  if (answer) await visitService.findVisit(clinicId, answer.visit_id); // 404 for another clinic
  if (!answer || !answer.audio_path) throw new AppError('NOT_FOUND', 'Recording not found', 404);
  const file = path.resolve(config.audioDir, answer.audio_path);
  if (!file.startsWith(path.resolve(config.audioDir) + path.sep)) {
    throw new AppError('NOT_FOUND', 'Recording not found', 404);
  }
  return file;
}

module.exports = { recordAnswer, getAudioFile };
