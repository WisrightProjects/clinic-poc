export const MIN = 3;
export const MAX = 200;

export const isQuestionValid = (text) => {
  const t = (text || '').trim();
  return t.length >= MIN && t.length <= MAX;
};

export const questionError = (text) => {
  const t = (text || '').trim();
  if (t.length === 0) return 'Question is required';
  if (t.length < MIN) return 'Question is too short';
  if (t.length > MAX) return `Max ${MAX} characters`;
  return null;
};
