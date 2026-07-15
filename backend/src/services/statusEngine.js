const { AppError } = require('../utils/errors');

const TRANSITIONS = {
  waiting:    ['answering'],
  answering:  ['answered'],
  answered:   ['summarised'],
  summarised: ['done'],
  done:       [],
};

function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw new AppError('INVALID_TRANSITION', `Cannot move visit from ${from} to ${to}`, 409);
  }
}

module.exports = { TRANSITIONS, assertTransition };
