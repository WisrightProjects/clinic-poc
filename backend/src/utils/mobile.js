// Purpose: Normalise an Indian mobile number to its 10 digits, so '98765 43210',
// '+91 98765-43210' and '09876543210' all match the same user (CLINIC-008).
// Returns the 10-digit string, or null if the input is not a valid mobile number.

function normalizeMobile(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let digits = String(input).replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

module.exports = { normalizeMobile };
