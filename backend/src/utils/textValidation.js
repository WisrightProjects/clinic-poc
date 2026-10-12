// Purpose: The shared rule for free-text fields (summary edit, test note): trimmed,
// required, at most `max` characters. Returns the trimmed text, or throws
// AppError(VALIDATION_ERROR, 422) with the caller's messages.

const { AppError } = require('./errors');

function requireText(value, { max, emptyMessage, tooLongMessage }) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) throw new AppError('VALIDATION_ERROR', emptyMessage, 422);
  if (trimmed.length > max) throw new AppError('VALIDATION_ERROR', tooLongMessage, 422);
  return trimmed;
}

module.exports = { requireText };
