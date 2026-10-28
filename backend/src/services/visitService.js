const visitRepository = require('../repositories/visitRepository');
const departmentRepository = require('../repositories/departmentRepository');
const answerRepository = require('../repositories/answerRepository');
const summaryRepository = require('../repositories/summaryRepository');
const templateRepository = require('../repositories/templateRepository');
const reportRepository = require('../repositories/reportRepository');
const testRequestRepository = require('../repositories/testRequestRepository');
const statusEngine = require('./statusEngine');
const summaryService = require('./summaryService');
const { AppError } = require('../utils/errors');
const { validateNewVisit } = require('../utils/visitValidation');
const { validateSummaryEdit } = require('../utils/summaryValidation');
const { parseQueueDate } = require('../utils/queueDate');
const questionFlow = require('../utils/questionFlow');
const { withTransaction } = require('../repositories/transaction');

// The questions this visit is asked (CLINIC-021): its template with the questions of sections
// it doesn't have left out. Null when the visit has no template.
function askedTemplate(visit, template) {
  if (!template) return null;
  return { ...template, questions: questionFlow.visibleQuestions(template.questions, visit.sections) };
}

// Every entry point takes the signed-in user's clinicId (CLINIC-008). A visit from
// another clinic is NOT_FOUND, exactly like a missing one, so ids can't be probed.
async function findVisit(clinicId, id) {
  const visit = await visitRepository.findById(clinicId, id);
  if (!visit) throw new AppError('NOT_FOUND', 'Visit not found', 404);
  return visit;
}

// A hidden (retired) department takes no new patients (CLINIC-022): an app with an old
// department list, or a screen opened before the change, gets a clear message instead.
async function create(clinicId, fields) {
  const clean = validateNewVisit(fields);
  const department = await departmentRepository.findById(clean.departmentId);
  if (!department) throw new AppError('VALIDATION_ERROR', 'Choose a department', 422);
  if (!department.is_active) {
    throw new AppError('DEPARTMENT_RETIRED', 'This list is no longer used — please go back and pick the department again', 422);
  }
  return visitRepository.createWithToken(clinicId, clean);
}

// One day's queue (CLINIC-015): the visits whose queue place is on `dateQuery` (today, in the
// clinic's time zone, when not given), plus every patient waiting for tests, whatever day.
async function list(clinicId, statusQuery, dateQuery) {
  const statusFilter = statusQuery ? statusQuery.split(',').map(s => s.trim()) : [];
  return visitRepository.list(clinicId, { date: parseQueueDate(dateQuery), statuses: statusFilter });
}

async function getById(clinicId, id) {
  const visit = await findVisit(clinicId, id);
  const [template, answers, summary, reports, testRequests] = await Promise.all([
    templateRepository.findForVisit(visit),
    answerRepository.findByVisitId(visit.id),
    summaryRepository.findByVisitId(visit.id),
    reportRepository.findByVisitId(visit.id),
    testRequestRepository.findByVisitId(visit.id),
  ]);
  return { visit, template: askedTemplate(visit, template), answers, summary, reports, test_requests: testRequests };
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

  // A visit away for tests (CLINIC-014) only comes back through requeue, which gives
  // it a new place in today's queue — never through submit, summary or not.
  if (visit.status === 'tests_requested') {
    throw new AppError('AWAY_FOR_TESTS', 'This patient is away for tests — use Back in queue when they return', 409);
  }

  // AC5: idempotent — an already-submitted visit returns its existing summary without
  // re-asserting the transition or inserting a duplicate row.
  if (statusEngine.isSubmitted(visit.status)) {
    const existing = await summaryRepository.findByVisitId(visitId);
    if (existing) return existing;
  }

  // AC3/AC12: only an 'answered' visit may summarise; statusEngine 409s otherwise.
  statusEngine.assertTransition(visit.status, 'summarised');

  // Only the questions the visit is asked count (CLINIC-021): an answer left on an
  // un-ticked problem's question neither blocks nor completes the visit.
  const asked = askedTemplate(visit, await templateRepository.findForVisit(visit));
  const askedIds = new Set((asked?.questions || []).map(q => q.id));
  const answers = (await answerRepository.findByVisitId(visitId)).filter(a => askedIds.has(a.question_id));

  // Transcription runs in the background (see answerService), so an answer may still
  // be 'pending' when the attender taps Send. Block summarisation until every answer
  // has resolved (done/failed) so the AI summary is never built on a missing transcript.
  // 'failed' is terminal (not a transcript we can wait for), so it does not block.
  if (answers.some(a => a.transcript_status === 'pending')) {
    throw new AppError(
      'TRANSCRIPTION_PENDING',
      'Transcription is still finishing. Please wait a moment and send again.',
      409
    );
  }
  if (!asked || !questionFlow.allAnswered(asked.questions, answers)) {
    throw new AppError('ANSWERS_MISSING', 'Some questions are not answered yet', 409);
  }

  // The AI call can take up to 90 s, so it runs before the lock; the status is then checked
  // again under the visit lock (answers take the same lock, saveAnswer), so an answer that
  // changed the questions meanwhile — e.g. a newly ticked problem — is never sent unanswered.
  const existing = await summaryRepository.findByVisitId(visitId);
  const generated = existing ? null : await summaryService.generate(visit);
  return withTransaction(async client => {
    const current = await visitRepository.findForUpdate(visitId, client);
    // A second Send finished first: return its summary (AC5).
    if (statusEngine.isSubmitted(current.status)) return summaryRepository.findByVisitId(visitId);
    if (current.status !== 'answered') {
      throw new AppError('ANSWERS_CHANGED', 'The answers changed while sending — please check them and send again', 409);
    }
    const summary = existing || await summaryRepository.create(visitId, generated.summaryText, generated.generatedBy, client);
    await visitRepository.updateStatus(visitId, 'summarised', client);
    return summary; // return the summary row so the client can render it without a reload
  });
}

// CLINIC-018: after Back in queue, remake the summary so it includes the test result photos.
// Skipped when the provider can't read photos (it would only repeat the summary) and when the
// doctor has edited the summary (their edit is never hidden). Not stored if, by the time the AI
// answers, the patient is no longer waiting in the queue (marked done, or sent for tests again).
// When the AI fails it throws and the earlier summary stays (better than the "not available"
// note). Returns the new row or null.
async function refreshSummary(visit) {
  if (!summaryService.readsReports()) return null;
  const current = await summaryRepository.findByVisitId(visit.id);
  if (!current || current.edited_text) return null;
  const remade = await summaryService.regenerate(visit);
  if (!remade) return null;
  return summaryRepository.createIfUnedited(visit.id, current.id, remade.summaryText, remade.generatedBy,
    status => status === 'summarised');
}

// CLINIC-012: the doctor saves an edited summary. The AI's original (summary_text) is
// kept; the edit is stored beside it with who and when. Another clinic's visit is 404;
// only a submitted visit can be edited (AC1).
async function editSummary(clinicId, visitId, text, userId) {
  const editedText = validateSummaryEdit(text);
  const visit = await findVisit(clinicId, visitId);
  const summary = statusEngine.isSubmitted(visit.status)
    ? await summaryRepository.updateEdit(visit.id, editedText, userId)
    : null;
  if (!summary) throw new AppError('NO_SUMMARY', 'This visit has no summary to edit yet', 409);
  return summary;
}

// Saves an answer and moves the visit on, in one transaction with the visit row locked, so
// answers and Send are taken one at a time (CLINIC-021: a tap answer can add or remove
// questions). `write(client)` stores the answer (and anything that goes with it). Refuses a
// visit already sent to the doctor (409), re-checked under the lock. Returns write's result.
async function saveAnswer(visitId, template, write) {
  return withTransaction(async client => {
    const locked = await visitRepository.findForUpdate(visitId, client);
    if (statusEngine.isSubmitted(locked.status)) {
      throw new AppError('ANSWERS_LOCKED', 'Answers cannot be changed after the visit is sent to the doctor', 409);
    }
    const result = await write(client);
    await advance(await visitRepository.findForUpdate(visitId, client), template, client);
    return result;
  });
}

// Works out the visit's status from its current answers and sections (read under the lock):
// the first answer moves waiting -> answering; 'answered' once every question the visit is
// asked has an answer (a set check, so answers left on an un-ticked section don't count); a
// newly ticked problem that adds unanswered questions moves 'answered' back to 'answering'.
async function advance(visit, template, client) {
  let status = visit.status;
  if (status === 'waiting') {
    statusEngine.assertTransition(status, 'answering');
    status = 'answering';
  }
  if (template && (status === 'answering' || status === 'answered')) {
    const answers = await answerRepository.findByVisitId(visit.id, client);
    const next = questionFlow.allAnswered(askedTemplate(visit, template).questions, answers) ? 'answered' : 'answering';
    if (next !== status) {
      statusEngine.assertTransition(status, next);
      status = next;
    }
  }
  if (status !== visit.status) await visitRepository.updateStatus(visit.id, status, client);
}

module.exports = { findVisit, create, list, getById, updateStatus, submit, refreshSummary, editSummary, saveAnswer };
