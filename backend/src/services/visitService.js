const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const summaryRepository = require('../repositories/summaryRepository');
const templateRepository = require('../repositories/templateRepository');
const statusEngine = require('./statusEngine');
const summaryService = require('./summaryService');
const { AppError } = require('../utils/errors');

async function create({ patientName, age, sex, departmentId }) {
  if (!patientName || !departmentId) {
    throw new AppError('BAD_REQUEST', 'patientName and departmentId are required', 400);
  }
  const tokenNumber = await visitRepository.getNextToken();
  return visitRepository.create({ tokenNumber, patientName, age, sex, departmentId });
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
  statusEngine.assertTransition(visit.status, 'summarised');
  const existing = await summaryRepository.findByVisitId(visitId);
  if (existing) return visitRepository.findById(visitId);
  const summaryText = await summaryService.generate(visitId);
  await summaryRepository.create(visitId, summaryText, 'mock');
  return visitRepository.updateStatus(visitId, 'summarised');
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
