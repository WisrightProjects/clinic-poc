const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const summaryRepository = require('../repositories/summaryRepository');
const templateRepository = require('../repositories/templateRepository');
const statusEngine = require('./statusEngine');
const summaryService = require('./summaryService');
const { AppError } = require('../utils/errors');
const { validateNewVisit } = require('../utils/visitValidation');
const { validateSummaryEdit } = require('../utils/summaryValidation');

// Every entry point takes the signed-in user's clinicId (CLINIC-008). A visit from
// another clinic is NOT_FOUND, exactly like a missing one, so ids can't be probed.
async function findVisit(clinicId, id) {
  const visit = await visitRepository.findById(clinicId, id);
  if (!visit) throw new AppError('NOT_FOUND', 'Visit not found', 404);
  return visit;
}

async function create(clinicId, { patientName, age, sex, departmentId }) {
  const clean = validateNewVisit({ patientName, age, sex, departmentId });
  return visitRepository.createWithToken(clinicId, clean);
}

async function list(clinicId, statusQuery) {
  const statusFilter = statusQuery ? statusQuery.split(',').map(s => s.trim()) : [];
  return visitRepository.list(clinicId, statusFilter);
}

async function getById(clinicId, id) {
  const visit = await findVisit(clinicId, id);
  const [template, answers, summary] = await Promise.all([
    templateRepository.findActiveForVisit(visit),
    answerRepository.findByVisitId(visit.id),
    summaryRepository.findByVisitId(visit.id),
  ]);
  return { visit, template, answers, summary };
}

// The doctor's "mark done" action. Other statuses are set by the intake flow itself
// (answers, submit), so 'summarised' can never be set here without a summary.
async function updateStatus(clinicId, id, newStatus) {
  if (newStatus !== 'done') {
    throw new AppError('INVALID_TRANSITION', 'Only marking a visit done is allowed here', 409);
  }
  const visit = await findVisit(clinicId, id);
  statusEngine.assertTransition(visit.status, newStatus);
  return visitRepository.updateStatus(id, newStatus);
}

async function submit(clinicId, visitId) {
  const visit = await findVisit(clinicId, visitId);

  // AC5: idempotent — an already-summarised/done visit returns its existing
  // summary without re-asserting the transition or inserting a duplicate row.
  if (visit.status === 'summarised' || visit.status === 'done') {
    const existing = await summaryRepository.findByVisitId(visitId);
    if (existing) return existing;
  }

  // AC3/AC12: only an 'answered' visit may summarise; statusEngine 409s otherwise.
  statusEngine.assertTransition(visit.status, 'summarised');

  // Transcription runs in the background (see answerService), so an answer may still
  // be 'pending' when the attender taps Send. Block summarisation until every answer
  // has resolved (done/failed) so the AI summary is never built on a missing transcript.
  // 'failed' is terminal (not a transcript we can wait for), so it does not block.
  const answers = await answerRepository.findByVisitId(visitId);
  if (answers.some(a => a.transcript_status === 'pending')) {
    throw new AppError(
      'TRANSCRIPTION_PENDING',
      'Transcription is still finishing. Please wait a moment and send again.',
      409
    );
  }

  let summary = await summaryRepository.findByVisitId(visitId);
  if (!summary) {
    const { summaryText, generatedBy } = await summaryService.generate(visit);
    summary = await summaryRepository.create(visitId, summaryText, generatedBy);
  }
  await visitRepository.updateStatus(visitId, 'summarised');
  return summary; // return the summary row so the client can render it without a reload
}

// CLINIC-012: the doctor saves an edited summary. The AI's original (summary_text) is
// kept; the edit is stored beside it with who and when. Another clinic's visit is 404.
async function editSummary(clinicId, visitId, text, userId) {
  const editedText = validateSummaryEdit(text);
  const visit = await findVisit(clinicId, visitId);
  const summary = await summaryRepository.findByVisitId(visit.id);
  if (!summary) throw new AppError('NO_SUMMARY', 'This visit has no summary to edit yet', 409);
  await summaryRepository.updateEdit(summary.id, editedText, userId);
  return summaryRepository.findByVisitId(visit.id);
}

// Takes the visit and template the caller already loaded (clinic-scoped). The first
// answer moves waiting -> answering; the same call continues to 'answered' when that
// answer was the last one (e.g. a one-question template).
async function maybeAdvance(visit, template) {
  let status = visit.status;
  if (status === 'waiting') {
    statusEngine.assertTransition(status, 'answering');
    await visitRepository.updateStatus(visit.id, 'answering');
    status = 'answering';
  }
  if (status === 'answering' && template) {
    const answeredCount = await answerRepository.countByVisitId(visit.id);
    if (answeredCount >= template.questions.length) {
      statusEngine.assertTransition(status, 'answered');
      await visitRepository.updateStatus(visit.id, 'answered');
    }
  }
}

module.exports = { findVisit, create, list, getById, updateStatus, submit, editSummary, maybeAdvance };
