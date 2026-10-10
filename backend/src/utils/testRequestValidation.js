// Purpose: Validate the doctor's "send for tests" note (CLINIC-014 AC1).
// A note is required so the attender can tell the patient which tests to do.
// Returns the trimmed note, or throws AppError(VALIDATION_ERROR, 422).

const { AppError } = require('./errors');

const MAX_TEST_NOTE_LENGTH = 1000;

function validateTestNote(note) {
  const trimmed = typeof note === 'string' ? note.trim() : '';
  if (!trimmed) {
    throw new AppError('VALIDATION_ERROR', 'Write which tests the patient should do', 422);
  }
  if (trimmed.length > MAX_TEST_NOTE_LENGTH) {
    throw new AppError('VALIDATION_ERROR', `The note must be at most ${MAX_TEST_NOTE_LENGTH} characters`, 422);
  }
  return trimmed;
}

module.exports = { validateTestNote, MAX_TEST_NOTE_LENGTH };
