// Purpose: Validate and normalize new-visit input fields.
// Throws AppError(VALIDATION_ERROR, 400) if any field fails (err.fields: one message per field).
// Input: { patientName, age, sex, departmentId, patientMobile?, weightKg?, heightCm?, patientType? }
// Output: normalized { patientName, age, sex, departmentId, patientMobile, weightKg, heightCm,
//         patientType } or throws. The last four are the client's registration fields
//         (CLINIC-023): all optional, patientType defaults to 'new'.

const { normalizeMobile } = require('./mobile');
const { isBlank, optionalNumber, throwFieldErrors } = require('./fieldValidation');

const PATIENT_TYPES = ['new', 'follow_up'];
// Plausible ranges, matched by the DB checks (migration 015) and the app's form.
const WEIGHT_KG = { min: 1, max: 300, decimals: 1 };
const HEIGHT_CM = { min: 30, max: 250, decimals: 1 };

function optionalMobile(value) {
  if (isBlank(value)) return { value: null };
  const mobile = normalizeMobile(value);
  return mobile ? { value: mobile } : { error: 'Must be a 10-digit mobile number starting 6–9' };
}

function validateNewVisit({ patientName, age, sex, departmentId, patientMobile, weightKg, heightCm, patientType }) {
  const errors = {};

  if (!patientName || typeof patientName !== 'string' || !patientName.trim()) {
    errors.patientName = 'Patient name is required';
  }

  if (departmentId == null) {
    errors.departmentId = 'Department is required';
  }

  const ageNum = age != null ? Number(age) : null;
  if (age != null && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
    errors.age = 'Age must be between 0 and 120';
  }

  if (sex != null && sex !== '' && (typeof sex !== 'string' || !['M', 'F', 'O'].includes(sex))) {
    errors.sex = 'Select a valid option';
  }

  const mobile = optionalMobile(patientMobile);
  if (mobile.error) errors.patientMobile = mobile.error;
  const weight = optionalNumber(weightKg, WEIGHT_KG);
  if (weight.error) errors.weightKg = weight.error;
  const height = optionalNumber(heightCm, HEIGHT_CM);
  if (height.error) errors.heightCm = height.error;

  const type = isBlank(patientType) ? 'new' : patientType;
  if (!PATIENT_TYPES.includes(type)) {
    errors.patientType = 'Must be new or follow_up';
  }

  throwFieldErrors(errors);

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
