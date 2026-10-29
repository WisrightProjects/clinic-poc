// Purpose: CLINIC-027 — a returning patient. There is no patients table: a patient is the
// visits of one clinic with the same mobile and the same name (visitRepository SAME_NAME).

const visitRepository = require('../repositories/visitRepository');
const { normalizeMobile } = require('../utils/mobile');
const { throwFieldErrors } = require('../utils/fieldValidation');
const { SUBMITTED } = require('./statusEngine');

// How many patients one number can list (one family shares a phone; more is not a family).
const PATIENTS_PER_MOBILE = 10;

// POST /patients/lookup { mobile } (attender): the clinic's patients on that number, last seen
// first — name, sex, age now, latest height, last visit day and how many visits — so New
// Patient can fill the form for a returning one. Only visits sent to the doctor count (not a
// registration left waiting or abandoned). The mobile comes in the body, never a URL.
async function lookup(clinicId, body) {
  const mobile = normalizeMobile(body?.mobile);
  if (!mobile) throwFieldErrors({ mobile: 'Must be a 10-digit mobile number starting 6–9' });
  return { patients: await visitRepository.findPatientsByMobile(clinicId, mobile, SUBMITTED, PATIENTS_PER_MOBILE) };
}

module.exports = { lookup };
