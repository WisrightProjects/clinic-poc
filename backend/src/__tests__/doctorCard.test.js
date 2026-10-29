// CLINIC-028: the doctor card — the AI blocks read back from the summary text, and the main
// problem from the tap question. Pure logic only.

const { parseSummaryCard, mainProblem } = require('../utils/doctorCard');
const { buildSummaryPrompt } = require('../utils/summary/prompt');

const NL = String.fromCharCode(10);
const lines = (...l) => l.join(NL);

describe('parseSummaryCard', () => {
  test('a follow-up with reports: every block, nothing lost', () => {
    const card = parseSummaryCard(lines(
      'Since last visit (29 Oct): fever now comes and goes',
      "Today's status:",
      '- Complaint: Fever 7 days, comes and goes',
      '- Medicines: Dolo 650 once daily',
      'Relevant history:',
      '- Allergy: No known medicine allergy',
      'Vitals: Pulse 88/min.',
      '',
      'From reports:',
      'CRP 40 mg/L, 28 Oct (High)',
      'Other results: not marked abnormal on the report (see photos).',
      '',
      '1 report photo(s) could not be read — please check the original.',
    ));
    expect(card).toEqual({
      since: 'Since last visit (29 Oct): fever now comes and goes',
      today: [
        { label: 'Complaint', value: 'Fever 7 days, comes and goes' },
        { label: 'Medicines', value: 'Dolo 650 once daily' },
      ],
      history: [{ label: 'Allergy', value: 'No known medicine allergy' }],
      vitals: 'Vitals: Pulse 88/min.',
      other: [],
      reports: [
        'CRP 40 mg/L, 28 Oct (High)',
        'Other results: not marked abnormal on the report (see photos).',
        '1 report photo(s) could not be read — please check the original.',
      ],
    });
  });

  test('markdown headings, other bullets, a wrapped value and a stray line are kept', () => {
    const card = parseSummaryCard(lines(
      'Extra note from the AI.',
      "**TODAY'S STATUS:**",
      '• **Complaint**: Headache 2 days,',
      '  worse in the evening',
      '* Symptoms: Dizziness',
      '- answer unclear — please check with the patient',
      '**Relevant history**',
      '- Existing illness: Diabetes 6 years',
    ));
    expect(card.today).toEqual([
      { label: 'Complaint', value: 'Headache 2 days, worse in the evening' },
      { label: 'Symptoms', value: 'Dizziness' },
      { label: '', value: 'answer unclear — please check with the patient' },
    ]);
    expect(card.history).toEqual([{ label: 'Existing illness', value: 'Diabetes 6 years' }]);
    expect(card.other).toEqual(['Extra note from the AI.']);
  });

  test('"From reports: none marked abnormal" keeps its words', () => {
    const card = parseSummaryCard(lines("Today's status:", '- Complaint: Fever', '', 'From reports: none marked abnormal'));
    expect(card.reports).toEqual(['none marked abnormal']);
  });

  test.each([
    ['an old paragraph summary', 'Patient: M, 45 yrs, presenting with fever for 3 days.'],
    ['the "not available" note', "AI summary not available for this patient. Please read the patient's answers below."],
    ['empty', ''],
    ['no summary', null],
  ])('no headings (%s): null — the doctor web shows the paragraph', (_n, text) => {
    expect(parseSummaryCard(text)).toBeNull();
  });
});

describe('mainProblem', () => {
  const questions = [
    { id: 2, order_index: 2, answer_type: 'voice' },
    { id: 1, order_index: 1, answer_type: 'choice', options: [{ value: 'fever', label: 'Fever' }, { value: 'bp', label: 'High BP' }] },
  ];

  test('the labels tapped in the first tap question, and its details', () => {
    expect(mainProblem(questions, [{ question_id: 1, value: { choices: ['bp', 'fever'], details: 'since 3 days' } }]))
      .toEqual({ choices: ['High BP', 'Fever'], details: 'since 3 days' });
  });

  test('no tap question, or not answered: null', () => {
    expect(mainProblem([questions[0]], [])).toBeNull();
    expect(mainProblem(questions, [])).toBeNull();
    expect(mainProblem(questions, [{ question_id: 1, value: { choices: [] } }])).toBeNull();
  });
});

test('the prompt asks for the card format, with English headings and the safety rules kept', () => {
  const p = buildSummaryPrompt({ sex: 'M', age: 45 }, [{ question: 'Since when?', answer: '2 days' }], 'Tamil');
  expect(p).toContain("Today's status:");
  expect(p).toContain('Relevant history:');
  expect(p).toContain('in English exactly as shown; write the labels and values in Tamil');
  expect(p).toContain('do not invent findings');
  expect(p).toContain('exactly as given; never round or drop them');
  expect(p).not.toContain('2-4 concise sentences');
});

test('the prompt and the parser use the same headings (one list)', () => {
  const { CARD_HEADINGS } = require('../utils/summaryText');
  const p = buildSummaryPrompt({ sex: 'M', age: 45 }, [{ question: 'Since when?', answer: '2 days' }]);
  // The format the prompt shows, filled in, parses back into the blocks.
  const sample = lines(`${CARD_HEADINGS.today}:`, '- Complaint: Fever', `${CARD_HEADINGS.history}:`, '- Allergy: None');
  expect(p).toContain(`${CARD_HEADINGS.today}:`);
  expect(p).toContain(`${CARD_HEADINGS.history}:`);
  expect(parseSummaryCard(sample)).toMatchObject({ today: [{ label: 'Complaint' }], history: [{ label: 'Allergy' }] });
});

test('a "- Since last visit" bullet is still the since line', () => {
  const card = parseSummaryCard(lines('- Since last visit (29 Oct): no change reported', "Today's status:", '- Complaint: Fever'));
  expect(card.since).toBe('Since last visit (29 Oct): no change reported');
  expect(card.today).toHaveLength(1);
});

describe('parseSummaryCard: the edges found in review', () => {
  test('a note after a blank line (photos not read, no From reports) is not glued to the last value', () => {
    const card = parseSummaryCard(lines("Today's status:", '- Complaint: Fever', 'Relevant history:', '- Allergy: None', '',
      '2 report photo(s) could not be read — please check the original.'));
    expect(card.history).toEqual([{ label: 'Allergy', value: 'None' }]);
    expect(card.other).toEqual(['2 report photo(s) could not be read — please check the original.']);
  });

  test('a heading with its text on the same line', () => {
    const card = parseSummaryCard(lines("Today's status: Fever 3 days", 'Relevant history: none significant'));
    expect(card.today).toEqual([{ label: '', value: 'Fever 3 days' }]);
    expect(card.history).toEqual([{ label: '', value: 'none significant' }]);
  });

  test('an indented wrapped line with a time in it continues the value', () => {
    const card = parseSummaryCard(lines("Today's status:", '- Complaint: Chest pain since morning,', '  worse after 10:30 am'));
    expect(card.today).toEqual([{ label: 'Complaint', value: 'Chest pain since morning, worse after 10:30 am' }]);
  });

  test("the AI's spoken Vitals line (older lists) is kept for the card", () => {
    expect(parseSummaryCard(lines("Today's status:", '- Complaint: Fever', 'Vitals: BP 140/90')).vitals).toBe('Vitals: BP 140/90');
  });

  test('"from reports" inside a value is not the From reports paragraph', () => {
    const card = parseSummaryCard(lines("Today's status:", '- Tests done: CBC, from reports dated 20 Oct'));
    expect(card.today[0].value).toBe('CBC, from reports dated 20 Oct');
    expect(card.reports).toEqual([]);
  });
});

test('mainProblem skips a tap question the visit is not asked (caller passes the asked list)', () => {
  const asked = [{ id: 2, order_index: 2, answer_type: 'voice' }];
  expect(mainProblem(asked, [{ question_id: 1, value: { choices: ['fever'] } }])).toBeNull();
});
