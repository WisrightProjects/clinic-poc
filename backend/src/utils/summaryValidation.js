// Purpose: Validate the doctor's edited summary text (CLINIC-012 AC4).
// Returns the trimmed text, or throws AppError(VALIDATION_ERROR, 422).

const { requireText } = require('./textValidation');

const MAX_SUMMARY_LENGTH = 4000;

function validateSummaryEdit(text) {
  return requireText(text, {
    max: MAX_SUMMARY_LENGTH,
    emptyMessage: 'Summary text is required',
    tooLongMessage: `Summary text must be at most ${MAX_SUMMARY_LENGTH} characters`,
  });
}

module.exports = { validateSummaryEdit, MAX_SUMMARY_LENGTH };
