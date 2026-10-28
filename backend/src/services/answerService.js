const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const sttService = require('./sttService');
const visitService = require('./visitService');
const statusEngine = require('./statusEngine');
const { AppError } = require('../utils/errors');
const questionFlow = require('../utils/questionFlow');
const answerTypes = require('../utils/answerTypes');
const visitRepository = require('../repositories/visitRepository');

// The visit must be in the caller's clinic (else 404), the question one it is asked — in its
// template and, for a section question (CLINIC-021), in a section the visit has (else 400) —
// and the visit not yet submitted (else 409; checked again under the lock when saving).
// A rejected upload's file is deleted by the errorHandler.
async function loadTarget(clinicId, visitId, questionId) {
  const visit = await visitService.findVisit(clinicId, visitId);
  // Once sent to the doctor the answers must match the AI summary they were written from,
  // including while the patient is away for tests.
  if (statusEngine.isSubmitted(visit.status)) {
    throw new AppError('ANSWERS_LOCKED', 'Answers cannot be changed after the visit is sent to the doctor', 409);
  }
  const template = await templateRepository.findForVisit(visit);
  const question = template?.questions.find(q => q.id === Number(questionId));
  if (!question || !questionFlow.isVisible(question, visit.sections)) {
    throw new AppError('BAD_REQUEST', 'questionId is not a question for this visit', 400);
  }
  return { visit, template, question };
}

// A recording or typed text, for a 'voice' question. Any other answer type (CLINIC-021) is
// answered in its own way: an older app that records or types it is told to update.
async function loadVoiceOrTextTarget(clinicId, visitId, questionId) {
  const target = await loadTarget(clinicId, visitId, questionId);
  if (answerTypes.typeOf(target.question) !== answerTypes.VOICE) {
    throw new AppError('BAD_REQUEST', answerTypes.UPDATE_APP_MESSAGE, 400);
  }
  return target;
}

async function recordAnswer(clinicId, visitId, questionId, file) {
  const { visit, template } = await loadVoiceOrTextTarget(clinicId, visitId, questionId);
  const audioPath = path.relative(config.audioDir, file.path);
  // Stored and the visit moved on in one locked transaction (visitService.saveAnswer) — fast
  // DB-only ops that don't depend on the transcript (progress comes from answer rows).
  const answer = await visitService.saveAnswer(visit.id, template, client =>
    answerRepository.upsert(visit.id, questionId, { audioPath, transcript: null, status: 'pending' }, client)
  );
  file.stored = true; // the answer row now references it: errorHandler must not delete it
  startTranscription(answer.id, audioPath, file.path);
  return answer; // transcript_status 'pending'
}

// A typed answer (CLINIC-009): stored like a finished transcript — no audio, status 'done',
// and no transcription started. It advances the visit exactly as a recorded answer does,
// and a retake replaces the previous answer whichever method it used.
async function recordTextAnswer(clinicId, visitId, questionId, text) {
  const { visit, template } = await loadVoiceOrTextTarget(clinicId, visitId, questionId);
  return visitService.saveAnswer(visit.id, template, client =>
    answerRepository.upsert(visit.id, questionId, { audioPath: null, transcript: text, status: 'done' }, client)
  );
}

// A structured answer (CLINIC-021), e.g. the options tapped for a 'choice' question. Stored
// as answers.value plus a readable transcript ("Diabetes, Fever — details") so the doctor
// web and the AI summary need no change. In the same locked transaction the visit's sections
// are recomputed from its answers — they may show or hide section questions — and the
// status is worked out again (visitService.saveAnswer).
async function recordTypedAnswer(clinicId, visitId, questionId, body) {
  const { visit, template, question } = await loadTarget(clinicId, visitId, questionId);
  const { value, transcript } = answerTypes.validateTypedAnswer(question, body);
  return visitService.saveAnswer(visit.id, template, async client => {
    const saved = await answerRepository.upsert(visit.id, question.id, { audioPath: null, transcript, status: 'done', value }, client);
    const answers = await answerRepository.findByVisitId(visit.id, client);
    await visitRepository.setSections(visit.id, questionFlow.sectionsFor(template.questions, answers), client);
    return saved;
  });
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

module.exports = { recordAnswer, recordTextAnswer, recordTypedAnswer, getAudioPath };
