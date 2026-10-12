// Purpose: Validate what an answer request carries (CLINIC-009 AC2): exactly one of a
// recording or typed text. Pure — no config/DB/fs.
// Input:  { hasAudio: boolean, text: any }   (text is req.body.text)
// Output: the trimmed text for a typed answer, or null for a recording. Throws AppError:
//         400 BAD_REQUEST        neither, or both
//         422 VALIDATION_ERROR   text longer than MAX_ANSWER_TEXT_LENGTH

const { AppError } = require('./errors');

const MAX_ANSWER_TEXT_LENGTH = 2000;

function validateAnswer({ hasAudio, text }) {
  // A missing field and a blank string both mean "no text".
  const trimmed = typeof text === 'string' ? text.trim() : '';

  if (hasAudio && trimmed) {
    throw new AppError('BAD_REQUEST', 'Send either a recording or typed text, not both', 400);
  }
  if (!hasAudio && !trimmed) {
    throw new AppError('BAD_REQUEST', 'Record or type an answer', 400);
  }
  if (trimmed.length > MAX_ANSWER_TEXT_LENGTH) {
    throw new AppError(
      'VALIDATION_ERROR',
      `The answer must be at most ${MAX_ANSWER_TEXT_LENGTH} characters`,
      422
    );
  }
  return hasAudio ? null : trimmed;
}

module.exports = { validateAnswer, MAX_ANSWER_TEXT_LENGTH };
