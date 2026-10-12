const { AppError } = require('../utils/errors');

const TRANSITIONS = {
  waiting:    ['answering'],
  answering:  ['answered'],
  answered:   ['summarised'],
  summarised: ['done'],
  done:       [],
};

// The attender has submitted the visit (it has a summary). Listed explicitly, so an
// unknown status never counts as submitted.
const SUBMITTED = ['summarised', 'done'];

function isSubmitted(status) {
  return SUBMITTED.includes(status);
}

// Statuses in which the attender may still add or remove report photos (CLINIC-011).
// CLINIC-014 adds 'tests_requested' here so returning patients can upload results.
const REPORTS_EDITABLE = ['waiting', 'answering', 'answered'];

function canEditReports(status) {
  return REPORTS_EDITABLE.includes(status);
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move visit from ${from} to ${to}`, 409);
  }
}

module.exports = { TRANSITIONS, assertTransition, isSubmitted, canEditReports };
