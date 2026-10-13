// Tests for backend/src/utils/answerValidation.js — CLINIC-009 AC2 (exactly one of audio or text).

const { validateAnswer, MAX_ANSWER_TEXT_LENGTH } = require('../utils/answerValidation');

// Run the validator and return the thrown AppError (or fail the test if nothing is thrown).
function errorFrom(input) {
  try {
    validateAnswer(input);
  } catch (err) {
    return err;
  }
  throw new Error('expected validateAnswer to throw');
}

describe('AC2: validateAnswer', () => {
  test('accepts a recording with no text (returns null)', () => {
    expect(validateAnswer({ hasAudio: true, text: undefined })).toBeNull();
  });

  test('treats a blank text field next to a recording as no text', () => {
    expect(validateAnswer({ hasAudio: true, text: '   ' })).toBeNull();
  });

  test('accepts typed text with no recording and returns it trimmed', () => {
    expect(validateAnswer({ hasAudio: false, text: '  No allergies  ' })).toBe('No allergies');
  });

  test('accepts text of exactly the maximum length, measured after trimming', () => {
    const text = 'a'.repeat(MAX_ANSWER_TEXT_LENGTH);
    expect(validateAnswer({ hasAudio: false, text: `  ${text}  ` })).toBe(text);
  });

  test.each([
    ['missing', undefined],
    ['only spaces', '   \n '],
    ['not a string', 42],
  ])('rejects neither a recording nor text (%s) with 400 "Record or type an answer"', (_label, text) => {
    const err = errorFrom({ hasAudio: false, text });
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.message).toBe('Record or type an answer');
  });

  test('rejects both a recording and text with 400', () => {
    const err = errorFrom({ hasAudio: true, text: 'No allergies' });
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('BAD_REQUEST');
  });

  test('rejects text over the maximum length with 422 VALIDATION_ERROR', () => {
    const err = errorFrom({ hasAudio: false, text: 'a'.repeat(MAX_ANSWER_TEXT_LENGTH + 1) });
    expect(err.httpStatus).toBe(422);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});
