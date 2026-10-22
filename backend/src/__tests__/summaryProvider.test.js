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

  test('tells the model to keep uncertainty instead of stating it as fact', () => {
    const p = buildSummaryPrompt(visit, qa);
    expect(p).toContain("Keep the patient's uncertainty");
    expect(p).toContain('never as a confirmed fact');
  });

  test('CLINIC-019: keeps readings and doses exactly, vitals only when asked, never invented', () => {
    const p = buildSummaryPrompt(visit, qa);
    expect(p).toContain('exactly as given; never round or drop them');
    expect(p).toContain('Only if one of the questions asks for today\'s vitals');
    expect(p).toContain('"Vitals: not recorded"');
    expect(p).toContain('do not list them all as present');
  });

  test('tells the model not to add diagnoses the patient did not state', () => {
    expect(buildSummaryPrompt(visit, qa)).toContain('Do not add diagnoses');
  });

  test('tells the model to keep important negatives', () => {
    expect(buildSummaryPrompt(visit, qa)).toContain('Include important negatives');
  });

  test('tells the model to flag an unclear answer for the doctor instead of guessing', () => {
    const p = buildSummaryPrompt(visit, qa);
    expect(p).toContain('do not guess what it means');
    expect(p).toContain('answer unclear — please check with the patient');
  });

  test('handles unknown demographics and empty Q&A without throwing', () => {
    const p = buildSummaryPrompt({}, []);
    expect(p).toContain('Patient: unknown');
  });
});
