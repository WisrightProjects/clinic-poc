// CLINIC-014: tests before consultation.
// The doctor sends a waiting patient (summarised) for tests with a note; the attender
// is alerted, tells the patient ("Informed patient"), and when the patient returns
// with results (uploaded as reports, CLINIC-011) puts them back at the end of that
// day's queue. The summary is kept as is: the AI can't read report photos yet, and
// regenerating would only repeat it and hide the doctor's edit (decided 2026-10-10).
//
// Each status change is checked twice on purpose: assertTransition first, for a clear
// 409 message; then the SQL only updates a visit still in the expected status, so a
// concurrent change can't slip through (changedMeanwhile).
const testRequestRepository = require('../repositories/testRequestRepository');
const visitRepository = require('../repositories/visitRepository');
const visitService = require('./visitService');
const statusEngine = require('./statusEngine');
const { AppError } = require('../utils/errors');
const { validateTestNote } = require('../utils/testRequestValidation');

const changedMeanwhile = () =>
  new AppError('INVALID_TRANSITION', 'This visit changed meanwhile — reload and try again', 409);

async function requestTests(clinicId, visitId, note, userId) {
  const cleanNote = validateTestNote(note);
  const visit = await visitService.findVisit(clinicId, visitId);
  statusEngine.assertTransition(visit.status, 'tests_requested');
  const testRequest = await testRequestRepository.requestTests(clinicId, visit.id, cleanNote, userId);
  if (!testRequest) throw changedMeanwhile();
  return testRequest;
}

async function acknowledge(clinicId, testRequestId, userId) {
  const testRequest = await testRequestRepository.acknowledge(clinicId, testRequestId, userId);
  if (testRequest) return testRequest;
  if (await testRequestRepository.findByIdForClinic(clinicId, testRequestId)) {
    throw new AppError('REQUEST_CLOSED', 'The patient is already back from tests', 409);
  }
  throw new AppError('NOT_FOUND', 'Test request not found', 404);
}

// Back in queue: a new place at the end of today's queue, the request marked
// returned — one transaction under the clinic's token lock.
async function requeue(clinicId, visitId) {
  const visit = await visitService.findVisit(clinicId, visitId);
  statusEngine.assertTransition(visit.status, 'summarised');
  const requeued = await visitRepository.withTokenLock(clinicId, async client => {
    const row = await visitRepository.requeue(client, clinicId, visit.id);
    if (row) await testRequestRepository.markReturned(client, visit.id);
    return row;
  });
  if (!requeued) throw changedMeanwhile();
  return requeued;
}

module.exports = { requestTests, acknowledge, requeue };
