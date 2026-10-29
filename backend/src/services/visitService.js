const visitRepository = require('../repositories/visitRepository');
const departmentRepository = require('../repositories/departmentRepository');
const answerRepository = require('../repositories/answerRepository');
const summaryRepository = require('../repositories/summaryRepository');
const templateRepository = require('../repositories/templateRepository');
const reportRepository = require('../repositories/reportRepository');
const testRequestRepository = require('../repositories/testRequestRepository');
const vitalsRepository = require('../repositories/vitalsRepository');
const statusEngine = require('./statusEngine');
const summaryService = require('./summaryService');
const { AppError } = require('../utils/errors');
const { validateNewVisit } = require('../utils/visitValidation');
const { validateSummaryEdit } = require('../utils/summaryValidation');
const { parseQueueDate } = require('../utils/queueDate');
const questionFlow = require('../utils/questionFlow');
const { validateVitals, vitalsRow, vitalsText, withVitalsLine } = require('../utils/vitals');
const { parseSummaryCard, mainProblem } = require('../utils/doctorCard');
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

// CLINIC-027: a returning patient's earlier visits in the detail — finished ones only (a
// patient still away for tests is the current problem, not history), at most this many.
const PREVIOUS_VISIT_STATUSES = ['summarised', 'done'];
const PREVIOUS_VISITS_SHOWN = 5;

// Summaries written by no AI: the demo text and the "AI summary not available" note.
const NOT_AI_SUMMARIES = ['mock', 'mock-fallback'];

// CLINIC-027: a follow-up's last finished visit, for the AI to say what changed: its day and
// summary (the doctor's edit when there is one), or null — also when that summary is the demo
// text or the "not available" note and the doctor didn't write one (nothing real to compare).
async function lastVisitForPrompt(visit) {
  if (visit.patient_type !== 'follow_up') return null;
  const [last] = await visitRepository.findPrevious(visit, PREVIOUS_VISIT_STATUSES, 1);
  const summary = last && await summaryRepository.findByVisitId(last.id);
  if (!summary || (!summary.edited_text && NOT_AI_SUMMARIES.includes(summary.generated_by))) return null;
  return { date: last.visit_date, text: summary.display_text };
}

// `forDoctor`: also what only the doctor web shows — the patient's previous visits and the
// doctor card (the attender app's many intake reads skip them).
async function getById(clinicId, id, { forDoctor = false } = {}) {
  const visit = await findVisit(clinicId, id);
  const [template, answers, summary, reports, testRequests, vitals, previousVisits] = await Promise.all([
    templateRepository.findForVisit(visit),
    answerRepository.findByVisitId(visit.id),
    summaryRepository.findByVisitId(visit.id),
    reportRepository.findByVisitId(visit.id),
    testRequestRepository.findByVisitId(visit.id),
    vitalsRepository.findByVisitId(visit.id),
    forDoctor ? visitRepository.findPrevious(visit, PREVIOUS_VISIT_STATUSES, PREVIOUS_VISITS_SHOWN) : [],
  ]);
  // CLINIC-024: the vitals row (or null) and its display, built once here for both apps.
  return {
    visit, template: askedTemplate(visit, template), answers, summary, reports, test_requests: testRequests,
    vitals, vitals_display: vitalsRow(vitals, template?.questions), vitals_text: vitalsText(vitals),
    previous_visits: previousVisits, // CLINIC-027: the same patient's earlier visits ([] for the attender)
    // CLINIC-028: the doctor card — the AI blocks read from the summary text (null: show the
    // paragraph, e.g. a visit from before the card) and the main problem tapped in Q1.
    summary_card: forDoctor ? parseSummaryCard(summary?.display_text) : null,
    main_problem: forDoctor ? mainProblem(askedTemplate(visit, template)?.questions, answers) : null,
  };
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
  const template = await templateRepository.findForVisit(visit);
  const asked = askedTemplate(visit, template);
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
  // The AI sees today's vitals as context (CLINIC-024); the exact "Vitals:" line is added
  // below by the code, from the vitals read under the lock.
  // CLINIC-027: a follow-up's last visit too, so the summary can say what changed.
  let promptVitals = null;
  let generated = null;
  if (!existing) {
    let previous;
    [promptVitals, previous] = await Promise.all([vitalsRepository.findByVisitId(visitId), lastVisitForPrompt(visit)]);
    generated = await summaryService.generate({ ...visit, vitals: promptVitals, previous });
  }
  return withTransaction(async client => {
    const current = await visitRepository.findForUpdate(visitId, client);
    // A second Send finished first: return its summary (AC5).
    if (statusEngine.isSubmitted(current.status)) return summaryRepository.findByVisitId(visitId);
    if (current.status !== 'answered') {
      throw new AppError('ANSWERS_CHANGED', 'The answers changed while sending — please check them and send again', 409);
    }
    let summary = existing;
    if (!summary) {
      // Vitals saved during the AI call would leave the AI's text (and any Vitals line it wrote
      // from a spoken answer) out of step with the line added here: send again, like answers.
      const vitals = await vitalsRepository.findByVisitId(visitId, client);
      if (vitalsText(vitals) !== vitalsText(promptVitals)) {
        throw new AppError('ANSWERS_CHANGED', 'The vitals changed while sending — please send again', 409);
      }
      summary = await summaryRepository.create(visitId, withVitalsLine(generated.summaryText, vitals, template.questions),
        generated.generatedBy, client);
    }
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
  // Vitals can't change after submit (saveVitals refuses), so reading them here is safe.
  const [vitals, template, previous] = await Promise.all([
    vitalsRepository.findByVisitId(visit.id), templateRepository.findForVisit(visit), lastVisitForPrompt(visit)]);
  const remade = await summaryService.regenerate({ ...visit, vitals, previous });
  if (!remade) return null;
  return summaryRepository.createIfUnedited(visit.id, current.id, withVitalsLine(remade.summaryText, vitals, template?.questions),
    remade.generatedBy, status => status === 'summarised');
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
  // The doctor card read from the edited text (CLINIC-028), so the page updates without a reload.
  return { ...summary, summary_card: parseSummaryCard(summary.display_text) };
}

// Saves an answer and moves the visit on, in one transaction with the visit row locked, so
// answers and Send are taken one at a time (CLINIC-021: a tap answer can add or remove
// questions). `write(client)` stores the answer (and anything that goes with it). Refuses a
// visit already sent to the doctor (409), re-checked under the lock. Returns write's result.
async function saveAnswer(visitId, template, write) {
  return whileNotSent(visitId, 'ANSWERS_LOCKED', 'Answers cannot be changed after the visit is sent to the doctor',
    async client => {
      const result = await write(client);
      await advance(await visitRepository.findForUpdate(visitId, client), template, client);
      return result;
    });
}

// Runs fn(client) in a transaction with the visit row locked, refusing (409 code) a visit
// already sent to the doctor — the one "sent means locked" check for answers and vitals.
function whileNotSent(visitId, code, message, fn) {
  return withTransaction(async client => {
    const locked = await visitRepository.findForUpdate(visitId, client);
    if (statusEngine.isSubmitted(locked.status)) throw new AppError(code, message, 409);
    return fn(client);
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

// CLINIC-024: the attender saves today's vitals (all optional). Clinic-scoped like every
// visit route; refused (409) once the visit is sent to the doctor — re-checked under the
// visit lock, so a Send can't slip between. The status doesn't change.
async function saveVitals(clinicId, visitId, body, userId) {
  const visit = await findVisit(clinicId, visitId);
  const vitals = validateVitals(body);
  return whileNotSent(visit.id, 'VITALS_LOCKED', 'Vitals cannot be changed after the visit is sent to the doctor',
    client => vitalsRepository.upsert(visit.id, vitals, userId, client));
}

module.exports = { findVisit, create, list, getById, updateStatus, submit, refreshSummary, editSummary, saveAnswer, saveVitals };
