/**
 * Unit tests for CLINIC-003 mobile pure-logic:
 *   AC3  — progress math (answeredCount, percent, allAnswered)
 *   AC4  — SendToDoctorButton disabled logic
 *   AC12 — progress derived from answers array, NOT from visit.status
 *
 * Strategy: The logic lives inside useQuestionList.js as plain JS expressions.
 * We extract the exact same derivation as a standalone pure function so we can
 * test it without a React runtime, without a running app, and without mocking
 * navigation or Axios.  The function mirrors lines 43–60 of useQuestionList.js
 * exactly — any change there should be reflected here.
 */

// ---------------------------------------------------------------------------
// Pure derivation function — mirrors useQuestionList.js lines 43–60 verbatim
// ---------------------------------------------------------------------------

/**
 * Derives the question-list view model from raw API data.
 * This is the logic that AC3, AC4, and AC12 verify.
 *
 * @param {{ template: { questions: Array }|null, answers: Array, visit: object }} data
 * @returns {{ items, answeredCount, total, percent, allAnswered }}
 */
function deriveQuestionListViewModel(data) {
  // CRITICAL (AC12 + reviewer risk 2): questions live at data.template.questions
  const questions = data?.template?.questions ?? [];
  const answers = data?.answers ?? [];

  const answeredIds = new Set(answers.map((a) => a.question_id));

  const items = [...questions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({
      ...q,
      answered: answeredIds.has(q.id),
      transcript: answers.find((a) => a.question_id === q.id)?.transcript ?? null,
    }));

  const total = items.length;
  // AC12: answered count from answers array, never from visit.status
  const answeredCount = items.filter((i) => i.answered).length;
  const percent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const allAnswered = total > 0 && answeredCount === total;

  return { items, answeredCount, total, percent, allAnswered };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuestion(id, order_index) {
  return { id, order_index, text: `Question ${id}` };
}

function makeAnswer(question_id, transcript = 'some transcript') {
  return { question_id, transcript };
}

// ---------------------------------------------------------------------------
// AC3: Progress indicator reflects answered count
// ---------------------------------------------------------------------------

describe('AC3: progress math — answeredCount, percent, allAnswered derivation', () => {
  test('0 of 5 answered: answeredCount=0, percent=0, allAnswered=false', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [],
    };
    const { answeredCount, total, percent, allAnswered } = deriveQuestionListViewModel(data);
    expect(total).toBe(5);
    expect(answeredCount).toBe(0);
    expect(percent).toBe(0);
    expect(allAnswered).toBe(false);
  });

  test('2 of 5 answered: answeredCount=2, percent=40, allAnswered=false', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(1), makeAnswer(2)],
    };
    const { answeredCount, total, percent, allAnswered } = deriveQuestionListViewModel(data);
    expect(total).toBe(5);
    expect(answeredCount).toBe(2);
    expect(percent).toBe(40);
    expect(allAnswered).toBe(false);
  });

  test('5 of 5 answered: answeredCount=5, percent=100, allAnswered=true', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [1, 2, 3, 4, 5].map(makeAnswer),
    };
    const { answeredCount, total, percent, allAnswered } = deriveQuestionListViewModel(data);
    expect(total).toBe(5);
    expect(answeredCount).toBe(5);
    expect(percent).toBe(100);
    expect(allAnswered).toBe(true);
  });

  test('1 of 3 answered: percent rounds to 33 (Math.round)', () => {
    const data = {
      template: { questions: [1, 2, 3].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(1)],
    };
    const { percent } = deriveQuestionListViewModel(data);
    expect(percent).toBe(33);
  });

  test('2 of 3 answered: percent rounds to 67 (Math.round)', () => {
    const data = {
      template: { questions: [1, 2, 3].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(1), makeAnswer(2)],
    };
    const { percent } = deriveQuestionListViewModel(data);
    expect(percent).toBe(67);
  });

  test('percent is 0 when total is 0 (no template questions)', () => {
    const data = { template: null, answers: [] };
    const { percent, total } = deriveQuestionListViewModel(data);
    expect(total).toBe(0);
    expect(percent).toBe(0);
  });

  test('allAnswered is false when total is 0 (empty template)', () => {
    const data = { template: { questions: [] }, answers: [] };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(allAnswered).toBe(false);
  });

  test('items are sorted by order_index regardless of input order', () => {
    const data = {
      template: {
        questions: [
          makeQuestion(3, 3),
          makeQuestion(1, 1),
          makeQuestion(2, 2),
        ],
      },
      answers: [],
    };
    const { items } = deriveQuestionListViewModel(data);
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  test('each item has answered=true when its id appears in answers', () => {
    const data = {
      template: { questions: [1, 2, 3].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(2)],
    };
    const { items } = deriveQuestionListViewModel(data);
    expect(items.find((i) => i.id === 1).answered).toBe(false);
    expect(items.find((i) => i.id === 2).answered).toBe(true);
    expect(items.find((i) => i.id === 3).answered).toBe(false);
  });

  test('transcript is attached to answered item', () => {
    const data = {
      template: { questions: [makeQuestion(1, 1)] },
      answers: [makeAnswer(1, 'Patient said: I have a headache')],
    };
    const { items } = deriveQuestionListViewModel(data);
    expect(items[0].transcript).toBe('Patient said: I have a headache');
  });

  test('transcript is null for unanswered item', () => {
    const data = {
      template: { questions: [makeQuestion(1, 1)] },
      answers: [],
    };
    const { items } = deriveQuestionListViewModel(data);
    expect(items[0].transcript).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC4: SendToDoctorButton disabled logic
// ---------------------------------------------------------------------------

describe('AC4: SendToDoctorButton disabled — enabled only when all questions answered', () => {
  test('disabled=true when 0 of 5 answered', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [],
    };
    const { allAnswered } = deriveQuestionListViewModel(data);
    // disabled prop = !allAnswered
    expect(!allAnswered).toBe(true);
  });

  test('disabled=true when 4 of 5 answered (not yet complete)', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [1, 2, 3, 4].map(makeAnswer),
    };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(!allAnswered).toBe(true);
  });

  test('disabled=false (enabled) when all 5 of 5 answered', () => {
    const data = {
      template: { questions: [1, 2, 3, 4, 5].map((i) => makeQuestion(i, i)) },
      answers: [1, 2, 3, 4, 5].map(makeAnswer),
    };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(!allAnswered).toBe(false);
  });

  test('disabled=true when template is null (no questions configured, AC8)', () => {
    const data = { template: null, answers: [] };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(!allAnswered).toBe(true);
  });

  test('disabled=true when template has 0 questions', () => {
    const data = { template: { questions: [] }, answers: [] };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(!allAnswered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC12: Progress derived from answers array, NOT from visit.status
// ---------------------------------------------------------------------------

describe('AC12: progress gate uses answers array, not visit.status', () => {
  test('allAnswered=true even when visit.status is still "answering" (status lag)', () => {
    // Simulates: backend status hasn't yet transitioned to "answered" but all
    // answers are present — the gate must open based on answers, not status.
    const data = {
      visit: { id: 42, status: 'answering' },  // status lags
      template: { questions: [1, 2, 3].map((i) => makeQuestion(i, i)) },
      answers: [1, 2, 3].map(makeAnswer),       // but all answers are here
    };
    const { allAnswered, answeredCount, total } = deriveQuestionListViewModel(data);
    expect(allAnswered).toBe(true);
    expect(answeredCount).toBe(3);
    expect(total).toBe(3);
  });

  test('allAnswered=false even when visit.status is "answered" but answers array is partial', () => {
    // Edge case: status advanced but only 2 of 3 answers present in API response
    const data = {
      visit: { id: 99, status: 'answered' },   // status ahead
      template: { questions: [1, 2, 3].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(1), makeAnswer(2)],  // only 2 answers
    };
    const { allAnswered } = deriveQuestionListViewModel(data);
    expect(allAnswered).toBe(false);
  });

  test('percent is computed from answers array length, not from visit.status', () => {
    // Regardless of what status says, percent must match actual answered count
    const data = {
      visit: { id: 7, status: 'waiting' },
      template: { questions: [1, 2, 3, 4].map((i) => makeQuestion(i, i)) },
      answers: [makeAnswer(1), makeAnswer(2)],  // 2 of 4 = 50%
    };
    const { percent } = deriveQuestionListViewModel(data);
    expect(percent).toBe(50);
  });

  test('answeredCount ignores duplicate answer entries for the same question_id', () => {
    // Defensive: if API ever returns duplicate answers for same question, count must not double
    const data = {
      template: { questions: [1, 2].map((i) => makeQuestion(i, i)) },
      answers: [
        makeAnswer(1, 'first'),
        makeAnswer(1, 'duplicate'), // same question_id again
        makeAnswer(2, 'ok'),
      ],
    };
    const { answeredCount } = deriveQuestionListViewModel(data);
    // Set-based deduplication: question 1 and 2 are both answered => 2
    expect(answeredCount).toBe(2);
  });

  test('data.questions key (wrong path) is ignored — must use data.template.questions', () => {
    // This tests the risk-2 fix: old pseudocode read data.questions which does not exist.
    // Passing questions at the wrong key must produce 0 items (graceful, not crash).
    const data = {
      visit: { id: 1, status: 'answering' },
      questions: [makeQuestion(1, 1), makeQuestion(2, 2)],  // wrong path — should be ignored
      template: null,                                        // correct path has no questions
      answers: [makeAnswer(1)],
    };
    const { total, answeredCount } = deriveQuestionListViewModel(data);
    expect(total).toBe(0);
    expect(answeredCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC9 (client-side) — validate() function from NewPatientScreen.js
// ---------------------------------------------------------------------------
// The validate() function is a useCallback closure but the logic is pure.
// We mirror it here directly to test the client-side gate without React.

describe('AC9: client-side validation in NewPatientScreen — validate()', () => {
  /**
   * Mirror of NewPatientScreen validate() closure — lines 49–58
   */
  function validate(patientName, age, sex, departmentId) {
    const errs = {};
    if (!patientName.trim()) errs.patientName = 'Patient name is required';
    if (!departmentId) errs.departmentId = 'Department is required';
    const ageNum = age !== '' ? Number(age) : null;
    if (age !== '' && (isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      errs.age = 'Age must be between 0 and 120';
    }
    if (sex && !['M', 'F', 'O'].includes(sex)) errs.sex = 'Select a valid option';
    return errs;
  }

  test('valid inputs produce empty errors object (no block)', () => {
    const errs = validate('Lakshmi K.', '35', 'F', 1);
    expect(Object.keys(errs)).toHaveLength(0);
  });

  test('blank patientName produces patientName error', () => {
    const errs = validate('', '35', 'F', 1);
    expect(errs.patientName).toBeDefined();
  });

  test('whitespace-only patientName produces patientName error', () => {
    const errs = validate('   ', '35', 'F', 1);
    expect(errs.patientName).toBeDefined();
  });

  test('missing departmentId (null) produces departmentId error', () => {
    const errs = validate('Ravi', '30', 'M', null);
    expect(errs.departmentId).toBeDefined();
  });

  test('missing departmentId (0 / falsy) produces departmentId error', () => {
    const errs = validate('Ravi', '30', 'M', 0);
    expect(errs.departmentId).toBeDefined();
  });

  test('age = "-1" (below 0) produces age error', () => {
    const errs = validate('Ravi', '-1', 'M', 1);
    expect(errs.age).toBeDefined();
  });

  test('age = "121" (above 120) produces age error', () => {
    const errs = validate('Ravi', '121', 'M', 1);
    expect(errs.age).toBeDefined();
  });

  test('age = "0" is valid (boundary)', () => {
    const errs = validate('Baby', '0', 'M', 1);
    expect(errs.age).toBeUndefined();
  });

  test('age = "120" is valid (boundary)', () => {
    const errs = validate('Elder', '120', 'O', 1);
    expect(errs.age).toBeUndefined();
  });

  test('age = "" (not entered) is valid — age is optional', () => {
    const errs = validate('Ravi', '', 'M', 1);
    expect(errs.age).toBeUndefined();
  });

  test('age = "abc" (non-numeric string) produces age error', () => {
    const errs = validate('Ravi', 'abc', 'M', 1);
    expect(errs.age).toBeDefined();
  });

  test('sex = "X" (invalid) produces sex error', () => {
    const errs = validate('Ravi', '30', 'X', 1);
    expect(errs.sex).toBeDefined();
  });

  test('sex = "" (not selected) is valid — sex is optional', () => {
    const errs = validate('Ravi', '30', '', 1);
    expect(errs.sex).toBeUndefined();
  });

  test('POST is blocked when there are errors (non-empty errs object)', () => {
    // Proxy: handleSubmit early-returns when Object.keys(errs).length > 0
    // Verified by: blank name + null dept => errs is non-empty => no call
    const errs = validate('', '30', 'M', null);
    expect(Object.keys(errs).length).toBeGreaterThan(0);
  });

  test('multiple invalid fields all appear in errs at once', () => {
    const errs = validate('', '999', 'Z', null);
    expect(errs.patientName).toBeDefined();
    expect(errs.age).toBeDefined();
    expect(errs.sex).toBeDefined();
    expect(errs.departmentId).toBeDefined();
  });
});
