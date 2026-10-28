// Purpose: Validate and normalize new-visit input fields.
// Throws AppError(VALIDATION_ERROR, 400) if any field fails.
// Input: { patientName, age, sex, departmentId, patientMobile?, weightKg?, heightCm?, patientType? }
// Output: normalized { patientName, age, sex, departmentId, patientMobile, weightKg, heightCm,
//         patientType } or throws. The last four are the client's registration fields
//         (CLINIC-023): all optional, patientType defaults to 'new'.

const { AppError } = require('./errors');
const { normalizeMobile } = require('./mobile');

const PATIENT_TYPES = ['new', 'follow_up'];
// Plausible ranges, matched by the DB checks (migration 015) and the app's form.
const WEIGHT_KG = { min: 1, max: 300 };
const HEIGHT_CM = { min: 30, max: 250 };

const isBlank = v => v == null || (typeof v === 'string' && v.trim() === '');

// Optional fields: { value } (null when blank) or { error }.
function optionalMobile(value) {
  if (isBlank(value)) return { value: null };
  const mobile = normalizeMobile(value);
  return mobile ? { value: mobile } : { error: 'must be a 10-digit mobile number starting 6–9' };
}

// A number in range with at most one decimal: a JSON number, or plain digits text like
// "72.5" (no hex, exponents, booleans or lists).
const DECIMAL_TEXT = /^\d+(\.\d+)?$/;
function measurement(value, { min, max }) {
  if (isBlank(value)) return { value: null };
  const ok = typeof value === 'number' || (typeof value === 'string' && DECIMAL_TEXT.test(value.trim()));
  const n = ok ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min || n > max || Math.round(n * 10) !== n * 10) {
    return { error: `must be ${min}–${max}, at most one decimal` };
  }
  return { value: n };
}

function validateNewVisit({ patientName, age, sex, departmentId, patientMobile, weightKg, heightCm, patientType }) {
  const errors = {};

  if (!patientName || typeof patientName !== 'string' || !patientName.trim()) {
    errors.patientName = 'required';
  }

  if (departmentId == null) {
    errors.departmentId = 'required';
  }

  const ageNum = age != null ? Number(age) : null;
  if (age != null && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
    errors.age = 'out of range (0–120)';
  }

  if (sex != null && sex !== '' && (typeof sex !== 'string' || !['M', 'F', 'O'].includes(sex))) {
    errors.sex = 'invalid (must be M, F, or O)';
  }

  const mobile = optionalMobile(patientMobile);
  if (mobile.error) errors.patientMobile = mobile.error;
  const weight = measurement(weightKg, WEIGHT_KG);
  if (weight.error) errors.weightKg = weight.error;
  const height = measurement(heightCm, HEIGHT_CM);
  if (height.error) errors.heightCm = height.error;

  const type = isBlank(patientType) ? 'new' : patientType;
  if (!PATIENT_TYPES.includes(type)) {
    errors.patientType = 'must be new or follow_up';
  }

  if (Object.keys(errors).length > 0) {
    const message = Object.entries(errors)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
    const err = new AppError('VALIDATION_ERROR', message, 400);
    err.fields = errors;
    throw err;
  }

  return {
    patientName: patientName.trim(),
    age: ageNum,
    sex: sex || null,
    departmentId,
    patientMobile: mobile.value,
    weightKg: weight.value,
    heightCm: height.value,
    patientType: type,
  };
}

module.exports = { validateNewVisit };
