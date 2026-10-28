// CLINIC-021: branching (questionFlow) and answer types (answerTypes) — the one rule every
// caller uses. Pure logic only.

const flow = require('../utils/questionFlow');
const answerTypes = require('../utils/answerTypes');
const statusEngine = require('../services/statusEngine');

const Q1 = {
  id: 1, order_index: 1, text: 'What problem brings you to the doctor today?',
  answer_type: 'choice', multi: true,
  options: [
    { value: 'fever', label: 'Fever', section: 'fever' },
    { value: 'diabetes', label: 'Diabetes', section: 'diabetes' },
    { value: 'bp', label: 'High BP', section: 'bp' },
    { value: 'headache', label: 'Headache' },
    { value: 'other', label: 'Other' },
  ],
};
const common = { id: 2, order_index: 2, text: 'Since when?', answer_type: 'voice' };
const d1 = { id: 3, order_index: 3, text: 'How long diabetes?', section: 'diabetes' };
const f1 = { id: 4, order_index: 4, text: 'How many days fever?', section: 'fever' };
const vitals = { id: 5, order_index: 5, text: 'Vitals' };
const all = [Q1, common, d1, f1, vitals];
const tapped = (...choices) => ({ question_id: 1, value: { choices, details: '' } });

describe('AC2: visible questions', () => {
  test('no sections chosen: only questions without a section', () => {
    expect(flow.visibleQuestions(all, []).map(q => q.id)).toEqual([1, 2, 5]);
  });
  test('a chosen section adds its questions, in list order', () => {
    expect(flow.visibleQuestions(all, ['fever', 'diabetes']).map(q => q.id)).toEqual([1, 2, 3, 4, 5]);
    expect(flow.visibleQuestions(all, ['diabetes']).map(q => q.id)).toEqual([1, 2, 3, 5]);
  });
  test('a visit without sections (older rows) sees every question without a section', () => {
    expect(flow.visibleQuestions(all, undefined).map(q => q.id)).toEqual([1, 2, 5]);
  });
});

describe('AC2: sections from choice answers', () => {
  test('options with a section add it; options without one add nothing', () => {
    expect(flow.sectionsFor(all, [tapped('diabetes', 'headache', 'fever')])).toEqual(['diabetes', 'fever']);
  });
  test('voice / typed answers (no value) add nothing', () => {
    expect(flow.sectionsFor(all, [{ question_id: 1, value: null }, { question_id: 2, value: null }])).toEqual([]);
  });
  test('un-ticking removes the section', () => {
    expect(flow.sectionsFor(all, [tapped('headache')])).toEqual([]);
  });
  test('a choice question inside an un-ticked section stops opening its own sections', () => {
    // D2 is in the diabetes section and opens a "foot" section.
    const d2 = { id: 6, order_index: 6, answer_type: 'choice', section: 'diabetes',
      options: [{ value: 'wound', label: 'Foot wound', section: 'foot' }] };
    const foot = { id: 7, order_index: 7, text: 'Foot details', section: 'foot' };
    const list = [...all, d2, foot];
    const d2Answer = { question_id: 6, value: { choices: ['wound'] } };
    expect(flow.sectionsFor(list, [tapped('diabetes'), d2Answer])).toEqual(['diabetes', 'foot']);
    expect(flow.sectionsFor(list, [tapped('headache'), d2Answer])).toEqual([]);
  });
  test('matching is by option value, so a label can be renamed safely', () => {
    const renamed = [{ ...Q1, options: Q1.options.map(o => (o.value === 'diabetes' ? { ...o, label: 'Sugar' } : o)) }];
    expect(flow.sectionsFor(renamed, [tapped('diabetes')])).toEqual(['diabetes']);
  });
});

describe('AC3: complete = every visible question answered (a set, not a count)', () => {
  const answered = ids => ids.map(id => ({ question_id: id }));
  test('all visible answered', () => {
    expect(flow.allAnswered(flow.visibleQuestions(all, ['diabetes']), answered([1, 2, 3, 5]))).toBe(true);
  });
  test('answers left on an un-ticked section do not make up for a missing one', () => {
    // 4 answers for 4 visible questions, but one is the hidden fever question.
    expect(flow.allAnswered(flow.visibleQuestions(all, ['diabetes']), answered([1, 2, 4, 5]))).toBe(false);
  });
  test('no questions is never complete', () => {
    expect(flow.allAnswered([], [])).toBe(false);
  });
  test('answered -> answering is allowed (a newly ticked problem adds questions)', () => {
    expect(() => statusEngine.assertTransition('answered', 'answering')).not.toThrow();
  });
});

describe('AC1: answer types', () => {
  test('a question without answer_type is voice (older rows)', () => {
    expect(answerTypes.typeOf({ text: 'x' })).toBe('voice');
    expect(answerTypes.typeOf(Q1)).toBe('choice');
  });
  test('choice: stores values in option order, details, and a readable transcript', () => {
    expect(answerTypes.validateTypedAnswer(Q1, { choices: '["headache","diabetes"]', text: ' since morning ' })).toEqual({
      value: { choices: ['diabetes', 'headache'], details: 'since morning' },
      transcript: 'Diabetes, Headache — since morning',
    });
    expect(answerTypes.validateTypedAnswer(Q1, { choices: ['fever'] }))
      .toEqual({ value: { choices: ['fever'], details: '' }, transcript: 'Fever' });
  });
  test('choice: duplicates are dropped', () => {
    expect(answerTypes.validateTypedAnswer(Q1, { choices: ['fever', 'fever'] }).value.choices).toEqual(['fever']);
  });
  test.each([
    ['empty list', '[]', 'Choose at least one option'],
    ['not JSON', 'fever', 'choices must be a list of options'],
    ['unknown option', '["cancer"]', 'Choose from the options shown'],
    ['a label instead of a value', '["Diabetes"]', 'Choose from the options shown'],
    ['not a list', '{"a":1}', 'Choose at least one option'],
  ])('choice: refuses %s', (_name, raw, message) => {
    expect(() => answerTypes.validateTypedAnswer(Q1, { choices: raw })).toThrow(message);
  });
  test('choice: one option only when the question is not multi', () => {
    expect(() => answerTypes.validateTypedAnswer({ ...Q1, multi: false }, { choices: ['fever', 'diabetes'] }))
      .toThrow('Choose only one option');
  });
  test('choice: details longer than the typed-answer limit are refused (422)', () => {
    expect(() => answerTypes.validateTypedAnswer(Q1, { choices: ['other'], text: 'x'.repeat(2001) })).toThrow('at most 2000');
  });
  test('a voice question takes no structured answer', () => {
    expect(() => answerTypes.validateTypedAnswer(common, { choices: ['fever'] })).toThrow('answered by recording or typing');
  });
});
