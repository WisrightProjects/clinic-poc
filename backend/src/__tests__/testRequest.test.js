// Tests for CLINIC-014: the tests_requested status rules and the doctor's note.
// Pure logic only — no config/DB/network — mirrors visitValidation.test.js style.

const { assertTransition, canEditReports, isSubmitted } = require('../services/statusEngine');
const { validateTestNote, MAX_TEST_NOTE_LENGTH } = require('../utils/testRequestValidation');

const invalid = expect.objectContaining({ code: 'INVALID_TRANSITION', httpStatus: 409 });

describe('AC6: status rules for tests_requested', () => {
  test('summarised -> tests_requested (doctor sends for tests) is allowed', () => {
    expect(() => assertTransition('summarised', 'tests_requested')).not.toThrow();
  });
  test('tests_requested -> summarised (back in queue) is allowed', () => {
    expect(() => assertTransition('tests_requested', 'summarised')).not.toThrow();
  });
  test('summarised -> done still works', () => {
    expect(() => assertTransition('summarised', 'done')).not.toThrow();
  });

  test.each(['waiting', 'answering', 'answered', 'done', 'tests_requested'])(
    'every other way into tests_requested is 409 (from %s)',
    from => expect(() => assertTransition(from, 'tests_requested')).toThrow(invalid)
  );
  test.each(['waiting', 'answering', 'answered', 'done', 'tests_requested'])(
    'every other way out of tests_requested is 409 (to %s)',
    to => expect(() => assertTransition('tests_requested', to)).toThrow(invalid)
  );
});

describe('isSubmitted: a visit away for tests counts as submitted', () => {
  test.each(['summarised', 'tests_requested', 'done'])('%s: submitted', s => expect(isSubmitted(s)).toBe(true));
  test.each(['waiting', 'answering', 'answered'])('%s: not yet', s => expect(isSubmitted(s)).toBe(false));
});

describe('reports stay editable while the patient is away for tests', () => {
  test.each(['waiting', 'answering', 'answered', 'tests_requested'])('%s: editable', s => expect(canEditReports(s)).toBe(true));
  test.each(['summarised', 'done'])('%s: locked', s => expect(canEditReports(s)).toBe(false));
});

describe('AC1: validateTestNote', () => {
  test('returns the trimmed note', () => {
    expect(validateTestNote('  Do ECG, lipid profile and HbA1c, and come back.  ')).toBe('Do ECG, lipid profile and HbA1c, and come back.');
  });
  test(`accepts exactly ${MAX_TEST_NOTE_LENGTH} characters`, () => {
    expect(validateTestNote('a'.repeat(MAX_TEST_NOTE_LENGTH))).toHaveLength(MAX_TEST_NOTE_LENGTH);
  });
  test.each([[''], ['   '], [null], [undefined], [7], [{}]])('a missing note (%p) is rejected with 422', note => {
    expect(() => validateTestNote(note)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', httpStatus: 422 }));
  });
  test('a too-long note is rejected with 422', () => {
    expect(() => validateTestNote('a'.repeat(MAX_TEST_NOTE_LENGTH + 1))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
