const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const sttService = require('./sttService');
const visitService = require('./visitService');
const { AppError } = require('../utils/errors');

// The visit must be in the caller's clinic (else 404) and the question in its template
// (else 400). A rejected upload's file is deleted by the errorHandler.
async function loadTarget(clinicId, visitId, questionId) {
  const visit = await visitService.findVisit(clinicId, visitId);
  const template = await templateRepository.findActiveForVisit(visit);
  if (!template || !template.questions.some(q => q.id === Number(questionId))) {
    throw new AppError('BAD_REQUEST', 'questionId is not a question for this visit', 400);
  }
  return { visit, template };
}

async function recordAnswer(clinicId, visitId, questionId, file) {
  const { visit, template } = await loadTarget(clinicId, visitId, questionId);
  const audioPath = path.relative(config.audioDir, file.path);
  const answer = await answerRepository.upsert(visit.id, questionId, {
    audioPath,
    transcript: null,
    status: 'pending',
  });
  file.stored = true; // the answer row now references it: errorHandler must not delete it
  // Advance the visit lifecycle now — these are fast DB-only ops that don't depend
  // on the transcript (progress is derived from answer rows, not transcript text).
  await visitService.maybeAdvance(visit, template);
  startTranscription(answer.id, audioPath, file.path);
  return answer; // transcript_status 'pending'
}

// A typed answer (CLINIC-009): stored like a finished transcript — no audio, status 'done',
// and no transcription started. It advances the visit exactly as a recorded answer does,
// and a retake replaces the previous answer whichever method it used.
async function recordTextAnswer(clinicId, visitId, questionId, text) {
  const { visit, template } = await loadTarget(clinicId, visitId, questionId);
  const answer = await answerRepository.upsert(visit.id, questionId, {
    audioPath: null,
    transcript: text,
    status: 'done',
  });
  await visitService.maybeAdvance(visit, template);
  return answer;
}

// Fire-and-forget background transcription, so the upload responds immediately (holding
// the mobile connection open for the 5–8s STT call dropped over Wi-Fi as "Network Error").
// The transcript fills in later (pending → done/failed); clients reload to see it. Never
// throws: a failure is recorded as 'failed' and submit still works. audioPath identifies the
// recording being transcribed, so a late result never overwrites a newer retake.
function startTranscription(answerId, audioPath, filePath) {
  (async () => {
    try {
      const transcript = await sttService.transcribe(filePath);
      await answerRepository.setTranscript(answerId, audioPath, transcript, 'done');
    } catch (err) {
      console.error(`[answer] transcription failed for answer ${answerId}:`, err.message);
      try {
        await answerRepository.setTranscript(answerId, audioPath, null, 'failed');
      } catch (dbErr) {
        console.error(`[answer] could not mark answer ${answerId} failed:`, dbErr.message);
      }
    }
  })();
}

// Stored path (relative to AUDIO_DIR) of an answer's recording, only for the visit's
// own clinic (AC9). Another clinic's answer is NOT_FOUND, the same as a missing one — and
// so is a typed answer, which has no recording.
async function getAudioPath(clinicId, answerId) {
  const answer = await answerRepository.findByIdForClinic(clinicId, answerId);
  if (!answer || !answer.audio_path) throw new AppError('NOT_FOUND', 'Recording not found', 404);
  return answer.audio_path;
}

module.exports = { recordAnswer, recordTextAnswer, getAudioPath };
