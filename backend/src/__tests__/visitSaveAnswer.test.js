'use strict';
// CLINIC-021: answers and Send change a visit's status one at a time, under the visit lock.
// saveAnswer re-checks "already sent" on the locked row and works the status out from the
// answers and sections read under that lock. DB, AI and other services are mocked.

jest.mock('../config', () => ({}));
jest.mock('../services/summaryService', () => ({ generate: jest.fn(), readsReports: () => false }));
jest.mock('../repositories/transaction', () => ({ withTransaction: fn => fn('client'), lockVisit: jest.fn() }));
jest.mock('../repositories/visitRepository', () => ({ findForUpdate: jest.fn(), updateStatus: jest.fn(), findById: jest.fn(), createWithToken: jest.fn() }));
jest.mock('../repositories/departmentRepository', () => ({ findById: jest.fn() }));
jest.mock('../repositories/answerRepository', () => ({ findByVisitId: jest.fn() }));
jest.mock('../repositories/templateRepository', () => ({ findForVisit: jest.fn() }));
jest.mock('../repositories/summaryRepository', () => ({ findByVisitId: jest.fn(), create: jest.fn() }));
jest.mock('../repositories/reportRepository', () => ({}));
jest.mock('../repositories/testRequestRepository', () => ({}));

const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const departmentRepository = require('../repositories/departmentRepository');
const visitService = require('../services/visitService');

const template = { questions: [{ id: 1 }, { id: 2 }, { id: 3, section: 'diabetes' }] };
const answered = ids => ids.map(id => ({ question_id: id }));
const write = jest.fn(async () => ({ id: 99 }));

beforeEach(() => jest.clearAllMocks());

test('refuses (409) when the locked row shows the visit was sent meanwhile; nothing written', async () => {
  visitRepository.findForUpdate.mockResolvedValue({ id: 9, status: 'summarised', sections: [] });
  await expect(visitService.saveAnswer(9, template, write)).rejects.toMatchObject({ code: 'ANSWERS_LOCKED', httpStatus: 409 });
  expect(write).not.toHaveBeenCalled();
  expect(visitRepository.updateStatus).not.toHaveBeenCalled();
});

test('first answer: waiting -> answering, inside the transaction', async () => {
  visitRepository.findForUpdate.mockResolvedValue({ id: 9, status: 'waiting', sections: [] });
  answerRepository.findByVisitId.mockResolvedValue(answered([1]));
  expect(await visitService.saveAnswer(9, template, write)).toEqual({ id: 99 });
  expect(write).toHaveBeenCalledWith('client');
  expect(visitRepository.updateStatus).toHaveBeenCalledWith(9, 'answering', 'client');
});

test('last visible answer: answering -> answered (hidden section not needed)', async () => {
  visitRepository.findForUpdate.mockResolvedValue({ id: 9, status: 'answering', sections: [] });
  answerRepository.findByVisitId.mockResolvedValue(answered([1, 2]));
  await visitService.saveAnswer(9, template, write);
  expect(visitRepository.updateStatus).toHaveBeenCalledWith(9, 'answered', 'client');
});

test('a newly chosen section adds an unanswered question: answered -> answering', async () => {
  // The write ticked Diabetes; the re-read row has the new sections.
  visitRepository.findForUpdate
    .mockResolvedValueOnce({ id: 9, status: 'answered', sections: [] })
    .mockResolvedValueOnce({ id: 9, status: 'answered', sections: ['diabetes'] });
  answerRepository.findByVisitId.mockResolvedValue(answered([1, 2]));
  await visitService.saveAnswer(9, template, write);
  expect(visitRepository.updateStatus).toHaveBeenCalledWith(9, 'answering', 'client');
});

test('no change, no status write', async () => {
  visitRepository.findForUpdate.mockResolvedValue({ id: 9, status: 'answering', sections: ['diabetes'] });
  answerRepository.findByVisitId.mockResolvedValue(answered([1, 2]));
  await visitService.saveAnswer(9, template, write);
  expect(visitRepository.updateStatus).not.toHaveBeenCalled();
});

describe('CLINIC-022: a retired (hidden) department takes no new patients', () => {
  const body = { patientName: 'Ravi', age: 40, sex: 'M', departmentId: 7 };
  test('hidden department -> 422 DEPARTMENT_RETIRED, nothing created', async () => {
    departmentRepository.findById.mockResolvedValue({ id: 7, name: 'Physician – Fever', is_active: false });
    await expect(visitService.create(1, body)).rejects.toMatchObject({ code: 'DEPARTMENT_RETIRED', httpStatus: 422 });
    expect(visitRepository.createWithToken).not.toHaveBeenCalled();
  });
  test('unknown department -> 422, nothing created', async () => {
    departmentRepository.findById.mockResolvedValue(null);
    await expect(visitService.create(1, body)).rejects.toMatchObject({ httpStatus: 422 });
    expect(visitRepository.createWithToken).not.toHaveBeenCalled();
  });
  test('active department -> created', async () => {
    departmentRepository.findById.mockResolvedValue({ id: 7, name: 'Physician', is_active: true });
    visitRepository.createWithToken.mockResolvedValue({ id: 50 });
    expect(await visitService.create(1, body)).toEqual({ id: 50 });
  });
});
