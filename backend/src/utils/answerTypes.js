// Purpose: CLINIC-021 answer types — how each kind of question is answered and checked.
// 'voice' is a recording or typed text (answerValidation, CLINIC-009). Every other type is
// sent as structured fields and stored as answers.value plus a readable transcript, so the
// doctor web and the AI summary read it unchanged. Add a type here (and in the app) to
// support e.g. number + unit or date answers. Pure — no DB / config.

const { AppError } = require('./errors');
const { MAX_ANSWER_TEXT_LENGTH } = require('./answerValidation');

const VOICE = 'voice';
const UPDATE_APP_MESSAGE = 'This question needs the latest app version — please update the app';

const typeOf = question => question?.answer_type || VOICE;

function parseList(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError('BAD_REQUEST', 'choices must be a list of options', 400);
  }
}

// Optional free text beside a structured answer (e.g. details for "Other").
function optionalDetails(rawText) {
  const details = typeof rawText === 'string' ? rawText.trim() : '';
  if (details.length > MAX_ANSWER_TEXT_LENGTH) {
    throw new AppError('VALIDATION_ERROR', `The details must be at most ${MAX_ANSWER_TEXT_LENGTH} characters`, 422);
  }
  return details;
}

const TYPES = {
  // Tap options: body { choices: [option values] (JSON list), text?: details }.
  choice: {
    validate(question, body) {
      const picked = parseList(body.choices);
      if (!Array.isArray(picked) || picked.length === 0) {
        throw new AppError('BAD_REQUEST', 'Choose at least one option', 400);
      }
      const options = question.options || [];
      if (picked.some(c => !options.some(o => o.value === c))) {
        throw new AppError('BAD_REQUEST', 'Choose from the options shown', 400);
      }
      const chosen = options.filter(o => picked.includes(o.value)); // option order, no duplicates
      if (!question.multi && chosen.length > 1) {
        throw new AppError('BAD_REQUEST', 'Choose only one option', 400);
      }
      const details = optionalDetails(body.text);
      const labels = chosen.map(o => o.label).join(', ');
      return {
        value: { choices: chosen.map(o => o.value), details },
        transcript: details ? `${labels} — ${details}` : labels,
      };
    },
  },
};

// Checks a structured answer for its question; returns { value, transcript } to store.
function validateTypedAnswer(question, body) {
  const type = TYPES[typeOf(question)];
  if (!type) throw new AppError('BAD_REQUEST', 'This question is answered by recording or typing', 400);
  return type.validate(question, body);
}

module.exports = { VOICE, UPDATE_APP_MESSAGE, typeOf, validateTypedAnswer };
