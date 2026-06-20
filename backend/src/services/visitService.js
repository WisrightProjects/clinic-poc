const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const summaryRepository = require('../repositories/summaryRepository');
const templateRepository = require('../repositories/templateRepository');
const statusEngine = require('./statusEngine');
const summaryService = require('./summaryService');
const { AppError } = require('../utils/errors');
const { validateNewVisit } = require('../utils/visitValidation');

async function create({ patientName, age, sex, departmentId }) {
  const clean = validateNewVisit({ patientName, age, sex, departmentId });
  return visitRepository.createWithToken(clean);
}

async function list(statusQuery) {
  const statusFilter = statusQuery ? statusQuery.split(',').map(s => s.trim()) : [];
  return visitRepository.list(statusFilter);
}

async function getById(id) {
  const visit = await visitRepository.findById(id);
  if (!visit) throw new AppError('NOT_FOUND', 'Visit not found', 404);
  const template = await templateRepository.findActiveByDepartmentId(visit.department_id);
  const answers = await answerRepository.findByVisitId(id);
  const summary = await summaryRepository.findByVisitId(id);
  return { visit, template, answers, summary };
}

async function updateStatus(id, newStatus) {
  const visit = await visitRepository.findById(id);
  if (!visit) throw new AppError('NOT_FOUND', 'Visit not found', 404);
  statusEngine.assertTransition(visit.status, newStatus);
  return visitRepository.updateStatus(id, newStatus);
}

async function submit(visitId) {
  const visit = await visitRepository.findById(visitId);
  if (!visit) throw new AppError('NOT_FOUND', 'Visit not found', 404);

  // AC5: idempotent — an already-summarised/done visit returns its existing
  // summary without re-asserting the transition or inserting a duplicate row.
  if (visit.status === 'summarised' || visit.status === 'done') {
    const existing = await summaryRepository.findByVisitId(visitId);
    if (existing) return existing;
  }

  // AC3/AC12: only an 'answered' visit may summarise; statusEngine 409s otherwise.
  statusEngine.assertTransition(visit.status, 'summarised');

  let summary = await summaryRepository.findByVisitId(visitId);
  if (!summary) {
    const summaryText = await summaryService.generate(visitId);
    summary = await summaryRepository.create(visitId, summaryText, 'mock');
  }
  await visitRepository.updateStatus(visitId, 'summarised');
  return summary; // return the summary row so the client can render it without a reload
}

async function maybeAdvance(visitId) {
  const visit = await visitRepository.findById(visitId);
  if (!visit) return;
  if (visit.status === 'waiting') {
    await visitRepository.updateStatus(visitId, 'answering');
    return;
  }
  if (visit.status === 'answering') {
    const template = await templateRepository.findActiveByDepartmentId(visit.department_id);
    if (!template) return;
    const answeredCount = await answerRepository.countByVisitId(visitId);
    if (answeredCount >= template.questions.length) {
      await visitRepository.updateStatus(visitId, 'answered');
    }
  }
}

module.exports = { create, list, getById, updateStatus, submit, maybeAdvance };
