// Tests for the AI summary prompt builder (CLINIC-007).
// Pure logic only — no config/DB/network — mirrors visitValidation.test.js style.

const { buildSummaryPrompt } = require('../utils/summary/prompt');

describe('buildSummaryPrompt', () => {
  const visit = { sex: 'F', age: 50 };
  const qa = [
    { question: 'Main complaint today?', answer: 'severe headache for a week' },
    { question: 'Any known allergies?', answer: '' },
  ];

  test('includes patient demographics', () => {
    expect(buildSummaryPrompt(visit, qa)).toContain('F, 50 yrs');
  });

  test('AC1: includes the real questions and answers', () => {
    const p = buildSummaryPrompt(visit, qa);
    expect(p).toContain('Main complaint today?');
    expect(p).toContain('severe headache for a week');
  });

  test('marks empty answers so the model ignores them', () => {
    expect(buildSummaryPrompt(visit, qa)).toContain('(no answer)');
  });

  test('AC4: output language is configurable (English default)', () => {
    expect(buildSummaryPrompt(visit, qa)).toContain('in English');
    expect(buildSummaryPrompt(visit, qa, 'Tamil')).toContain('in Tamil');
  });

  test('handles unknown demographics and empty Q&A without throwing', () => {
    const p = buildSummaryPrompt({}, []);
    expect(p).toContain('Patient: unknown');
  });
});
