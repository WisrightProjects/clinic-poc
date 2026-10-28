// Purpose: CLINIC-021 — the answer types this app version can show, and the typed-answer
// limit. The server marks each question with answer_type; a type this app doesn't know
// (added in a later version) is shown as "Update the app" instead of being recorded.

export const MAX_ANSWER_TEXT = 2000; // matches the backend (MAX_ANSWER_TEXT_LENGTH); the server's 422 is the real guard

// 'voice' = record or type (CLINIC-004/009); 'choice' = tap options (CLINIC-021).
const KNOWN = ['voice', 'choice'];

export const answerTypeOf = (question) => question?.answer_type || 'voice';

export const isKnownAnswerType = (question) => KNOWN.includes(answerTypeOf(question));
