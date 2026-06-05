const MIN = 3, MAX = 200;

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    const e = new Error('A template must have at least one question');
    e.status = 422;
    throw e;
  }
  for (const q of questions) {
    const text = (q.text || '').trim();
    if (text.length < MIN || text.length > MAX) {
      const e = new Error(`Question text must be ${MIN}-${MAX} characters`);
      e.status = 422;
      throw e;
    }
  }
}

module.exports = { validateQuestions, MIN, MAX };
