const { AppError } = require('../utils/errors');

// summarised -> tests_requested: the doctor sends a waiting patient for tests (CLINIC-014).
// tests_requested -> summarised: the attender puts the returned patient back in the queue.
// answered -> answering: a newly ticked problem adds questions to answer (CLINIC-021).
const TRANSITIONS = {
  waiting:         ['answering'],
  answering:       ['answered'],
  answered:        ['summarised', 'answering'],
  summarised:      ['done', 'tests_requested'],
  tests_requested: ['summarised'],
  done:            [],
};

// The attender has submitted the visit (it has a summary): summarised, away for tests
// (CLINIC-014) or done. Listed explicitly, so an unknown status never counts.
const SUBMITTED = ['summarised', 'tests_requested', 'done'];

function isSubmitted(status) {
  return SUBMITTED.includes(status);
}

// Report photos (CLINIC-011) can change until submit, and again while the patient is
// away for tests, to upload the results (CLINIC-014).
const REPORTS_EDITABLE = ['waiting', 'answering', 'answered', 'tests_requested'];

function canEditReports(status) {
  return REPORTS_EDITABLE.includes(status);
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move visit from ${from} to ${to}`, 409);
  }
}

module.exports = { TRANSITIONS, assertTransition, isSubmitted, canEditReports };
