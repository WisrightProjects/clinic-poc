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

  test('CLINIC-023: weight, height and follow-up go on the patient line; the mobile never does', () => {
    const p = buildSummaryPrompt(
      { sex: 'M', age: 58, weight_kg: '72.0', height_cm: '170.5', patient_type: 'follow_up', patient_mobile: '9876543210' },
      qa
    );
    expect(p).toContain('Patient: M, 58 yrs, 72 kg, 170.5 cm, follow-up visit');
    expect(p).not.toContain('9876543210');
    // CLINIC-028: the doctor card shows the Patient line from the data, so it is context only.
    expect(p).toContain('The Patient line is shown to the doctor separately: do not repeat it.');
    expect(buildSummaryPrompt({ sex: 'F', age: 30, patient_type: 'new' }, qa)).toContain('Patient: F, 30 yrs\n');
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
    // A list before CLINIC-024 PR B, with the spoken vitals question.
    const p = buildSummaryPrompt(visit, [...qa, { question: "Today's vitals (attender)", answer: 'BP 130/80' }]);
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

describe('CLINIC-027: a follow-up compared with the previous visit', () => {
  const { buildSummaryPrompt } = require('../utils/summary/prompt');
  const qa = [{ question: 'Since when?', answer: '5 days' }];
  const previous = {
    date: '2026-10-29',
    text: ['Since last visit (20 Oct): no change reported', 'Fever for 3 days.', 'Vitals: BP 140/90 mmHg.'].join('\n'),
  };

  test('AC5: starts with what changed, only today describes today, previous given for comparison', () => {
    const p = buildSummaryPrompt({ sex: 'M', age: 45, previous }, qa);
    expect(p).toContain('Begin with one line "Since last visit (29 Oct): ..."');
    expect(p).toContain('never present a problem from the previous visit as today\'s');
    expect(p).toContain('for comparison only');
    expect(p).toContain('Fever for 3 days.');
    // Its own Vitals and comparison lines are not given (not today's, not to copy).
    expect(p).not.toContain('BP 140/90');
    expect(p).not.toContain('(20 Oct)');
  });

  test('no previous visit, or nothing left of it: no comparison', () => {
    expect(buildSummaryPrompt({ sex: 'M', age: 45 }, qa)).not.toContain('Since last visit');
    const onlyVitals = { date: '2026-10-29', text: 'Vitals: BP 130/80 mmHg.' };
    expect(buildSummaryPrompt({ sex: 'M', age: 45, previous: onlyVitals }, qa)).not.toContain('Since last visit');
  });

  test('the previous visit\'s report results and notes are not given (not today\'s)', () => {
    const withReports = { date: '2026-10-29', text: ['Fever for 3 days.', '', '**From reports:**', 'Hb 9.1 g/dL (Low)', '', '1 report photo(s) could not be read — please check the original.'].join('\n') };
    const p = buildSummaryPrompt({ sex: 'M', age: 45, previous: withReports }, qa);
    expect(p).toContain('Fever for 3 days.');
    expect(p).not.toContain('Hb 9.1');
    expect(p).not.toContain('could not be read');
  });
});
