// Tests for backend/src/utils/summaryValidation.js (CLINIC-012 AC4).
// Pure logic only — no config/DB/network — mirrors visitValidation.test.js style.

const { validateSummaryEdit, MAX_SUMMARY_LENGTH: MAX } = require('../utils/summaryValidation');

describe('AC4: validateSummaryEdit', () => {
  test('returns the trimmed text', () => {
    expect(validateSummaryEdit('  Allergic to amoxicillin (rash, 2025)  ')).toBe('Allergic to amoxicillin (rash, 2025)');
  });

  test(`accepts exactly ${MAX} characters`, () => {
    expect(validateSummaryEdit('a'.repeat(MAX))).toHaveLength(MAX);
  });

  test.each([[''], ['   '], [null], [undefined], [42], [{}]])('rejects %p with 422 VALIDATION_ERROR', input => {
    expect(() => validateSummaryEdit(input)).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', httpStatus: 422 }));
  });

  test(`rejects more than ${MAX} characters`, () => {
    expect(() => validateSummaryEdit('a'.repeat(MAX + 1))).toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR', httpStatus: 422 }));
  });
});
