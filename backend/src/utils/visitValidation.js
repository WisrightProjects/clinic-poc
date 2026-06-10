// Purpose: Validate and normalize new-visit input fields.
// Throws AppError(VALIDATION_ERROR, 400) if any field fails.
// Input: { patientName, age, sex, departmentId }
// Output: normalized { patientName, age, sex, departmentId } or throws

const { AppError } = require('./errors');

function validateNewVisit({ patientName, age, sex, departmentId }) {
  const errors = {};

  if (!patientName || !patientName.trim()) {
    errors.patientName = 'required';
  }

  if (departmentId == null) {
    errors.departmentId = 'required';
  }

  if (age != null && (age < 0 || age > 120)) {
    errors.age = 'out of range (0–120)';
  }

  if (sex && !['M', 'F', 'O'].includes(sex)) {
    errors.sex = 'invalid (must be M, F, or O)';
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
    age: age != null ? age : null,
    sex: sex || null,
    departmentId,
  };
}

module.exports = { validateNewVisit };
