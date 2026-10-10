const { AppError } = require('../utils/errors');

// summarised -> tests_requested: the doctor sends a waiting patient for tests (CLINIC-014).
// tests_requested -> summarised: the attender puts the returned patient back in the queue.
const TRANSITIONS = {
  waiting:         ['answering'],
  answering:       ['answered'],
  answered:        ['summarised'],
  summarised:      ['done', 'tests_requested'],
  tests_requested: ['summarised'],
  done:            [],
};

// Before the attender submits. Every later status (summarised, tests_requested, done)
// counts as submitted.
const PRE_SUBMIT = ['waiting', 'answering', 'answered'];

function isSubmitted(status) {
  return !PRE_SUBMIT.includes(status);
}

// Report photos (CLINIC-011) can change until submit, and again while the patient is
// away for tests, to upload the results (CLINIC-014).
function canEditReports(status) {
  return !isSubmitted(status) || status === 'tests_requested';
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move visit from ${from} to ${to}`, 409);
  }
}

module.exports = { TRANSITIONS, assertTransition, isSubmitted, canEditReports };
