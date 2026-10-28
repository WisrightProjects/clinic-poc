'use strict';
// Answers are locked once the visit is submitted (CLINIC-009 review): both recorded and typed
// answers go through loadTarget, which rejects a submitted visit with 409 ANSWERS_LOCKED.

jest.mock('../config', () => ({ audioDir: 'audio' })); // the real one needs DATABASE_URL / JWT_SECRET
// saveAnswer (the locked save + status step) is tested in visitSaveAnswer.test.js; here it just runs the write.
jest.mock('../services/visitService', () => ({ findVisit: jest.fn(), saveAnswer: jest.fn((id, t, write) => write('client')) }));
jest.mock('../repositories/templateRepository', () => ({ findForVisit: jest.fn() }));
jest.mock('../repositories/answerRepository', () => ({ upsert: jest.fn(), setTranscript: jest.fn() }));
jest.mock('../services/sttService', () => ({ transcribe: jest.fn() }));
jest.mock('../repositories/visitRepository', () => ({ setSections: jest.fn() }));

const visitService = require('../services/visitService');
const templateRepository = require('../repositories/templateRepository');
const answerRepository = require('../repositories/answerRepository');
const answerService = require('../services/answerService');

const template = { questions: [{ id: 5 }] };

beforeEach(() => {
  jest.clearAllMocks();
  templateRepository.findForVisit.mockResolvedValue(template);
  answerRepository.upsert.mockResolvedValue({ id: 1 });
});

describe.each(['summarised', 'tests_requested', 'done'])('visit already %s', status => {
  beforeEach(() => visitService.findVisit.mockResolvedValue({ id: 9, status }));

  test('a typed answer is rejected with 409 and nothing is written', async () => {
    await expect(answerService.recordTextAnswer(1, 9, 5, 'text')).rejects.toMatchObject({
      code: 'ANSWERS_LOCKED',
      httpStatus: 409,
    });
    expect(answerRepository.upsert).not.toHaveBeenCalled();
  });

  test('a recording is rejected with 409 and nothing is written', async () => {
    await expect(answerService.recordAnswer(1, 9, 5, { path: 'x.webm' })).rejects.toMatchObject({
      code: 'ANSWERS_LOCKED',
      httpStatus: 409,
    });
    expect(answerRepository.upsert).not.toHaveBeenCalled();
  });
});

describe.each(['waiting', 'answering', 'answered'])('visit still %s', status => {
  test('a typed answer is accepted', async () => {
    visitService.findVisit.mockResolvedValue({ id: 9, status });
    await answerService.recordTextAnswer(1, 9, 5, 'text');
    expect(answerRepository.upsert).toHaveBeenCalled();
  });
});
