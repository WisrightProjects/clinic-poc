const { AppError } = require('./errors');

const MIN = 3, MAX = 200;

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'A template must have at least one question', 422);
  }
  for (const q of questions) {
    const text = (q.text || '').trim();
    if (text.length < MIN || text.length > MAX) {
      throw new AppError('VALIDATION_ERROR', `Question text must be ${MIN}-${MAX} characters`, 422);
    }
  }
}

module.exports = { validateQuestions, MIN, MAX };
