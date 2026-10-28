// Purpose: shared checks for optional form fields (CLINIC-023 registration, CLINIC-024
// vitals) and the one way to refuse a form: 400 VALIDATION_ERROR with a message per field
// (err.fields — the apps show each under its field). Pure — no DB / config.

const { AppError } = require('./errors');

const isBlank = v => v == null || (typeof v === 'string' && v.trim() === '');

// A number from a JSON number or plain digits text ("72.5"; a decimal comma "72,5" from some
// phones' number pads is read as a point). No hex, exponents, booleans or lists.
// decimals: how many digits after the point are allowed (0 = a whole number).
// Returns { value } (null when blank) or { error }.
function optionalNumber(value, { min, max, decimals = 0 }) {
  if (isBlank(value)) return { value: null };
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const pattern = decimals ? new RegExp(`^\\d+([.,]\\d{1,${decimals}})?$`) : /^\d+$/;
  const n = pattern.test(text) ? Number(text.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) {
    return { error: decimals ? `Must be ${min}–${max}, at most ${decimals} decimal` : `Must be a whole number ${min}–${max}` };
  }
  return { value: n };
}

// Throws the form's errors ({ field: message }) as one 400, if there are any.
function throwFieldErrors(errors) {
  if (Object.keys(errors).length === 0) return;
  const message = Object.entries(errors).map(([field, msg]) => `${field}: ${msg}`).join('; ');
  const err = new AppError('VALIDATION_ERROR', message, 400);
  err.fields = errors;
  throw err;
}

module.exports = { isBlank, optionalNumber, throwFieldErrors };
