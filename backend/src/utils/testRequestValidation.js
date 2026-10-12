// Purpose: Validate the doctor's "send for tests" note (CLINIC-014 AC1).
// A note is required so the attender can tell the patient which tests to do.
// Returns the trimmed note, or throws AppError(VALIDATION_ERROR, 422).

const { requireText } = require('./textValidation');

const MAX_TEST_NOTE_LENGTH = 1000;

function validateTestNote(note) {
  return requireText(note, {
    max: MAX_TEST_NOTE_LENGTH,
    emptyMessage: 'Write which tests the patient should do',
    tooLongMessage: `The note must be at most ${MAX_TEST_NOTE_LENGTH} characters`,
  });
}

module.exports = { validateTestNote, MAX_TEST_NOTE_LENGTH };
