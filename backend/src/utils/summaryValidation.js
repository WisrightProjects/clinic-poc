// Purpose: Validate the doctor's edited summary text (CLINIC-012 AC4).
// Returns the trimmed text, or throws AppError(VALIDATION_ERROR, 422).

const { AppError } = require('./errors');

const MAX = 4000;

function validateSummaryEdit(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    throw new AppError('VALIDATION_ERROR', 'Summary text is required', 422);
  }
  if (trimmed.length > MAX) {
    throw new AppError('VALIDATION_ERROR', `Summary text must be at most ${MAX} characters`, 422);
  }
  return trimmed;
}

module.exports = { validateSummaryEdit, MAX };
