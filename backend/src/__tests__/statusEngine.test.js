// Tests for backend/src/services/statusEngine.js — pure logic, no config/DB.

const { assertTransition, isSubmitted } = require('../services/statusEngine');

describe('isSubmitted', () => {
  test.each(['summarised', 'done'])('%s is submitted', status => {
    expect(isSubmitted(status)).toBe(true);
  });

  test.each(['waiting', 'answering', 'answered', undefined, null, 'cancelled'])('%p is not submitted', status => {
    expect(isSubmitted(status)).toBe(false);
  });
});

describe('assertTransition', () => {
  test('allows the lifecycle in order', () => {
    expect(() => assertTransition('answered', 'summarised')).not.toThrow();
    expect(() => assertTransition('summarised', 'done')).not.toThrow();
  });

  test('rejects anything else with 409 INVALID_TRANSITION', () => {
    expect(() => assertTransition('done', 'summarised')).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION', httpStatus: 409 }));
    expect(() => assertTransition('waiting', 'done')).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });
});
