// Purpose: Validate the doctor's edited summary text (CLINIC-012 AC4).
// Returns the trimmed text, or throws AppError(VALIDATION_ERROR, 422).

const { AppError } = require('./errors');

const MAX_SUMMARY_LENGTH = 4000;

function validateSummaryEdit(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    throw new AppError('VALIDATION_ERROR', 'Summary text is required', 422);
  }
  if (trimmed.length > MAX_SUMMARY_LENGTH) {
    throw new AppError('VALIDATION_ERROR', `Summary text must be at most ${MAX_SUMMARY_LENGTH} characters`, 422);
  }
  return trimmed;
}

module.exports = { validateSummaryEdit, MAX_SUMMARY_LENGTH };
