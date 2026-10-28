// Purpose: CLINIC-021 branching — which questions a visit is asked. Pure (no DB / config),
// so every caller shares one rule: visit detail, answer upload, status advance, submit and
// the AI summary. The queue's SQL count uses the same rule (VISIBLE_QUESTION_SQL) — keep the
// two in step. How each question is answered lives in answerTypes.

// A question is asked when it has no section, or its section was chosen for the visit.
function isVisible(question, sections = []) {
  return !question.section || sections.includes(question.section);
}

function visibleQuestions(questions = [], sections = []) {
  return questions.filter(q => isVisible(q, sections));
}

// SQL twin of isVisible for a question row `q` and a visit row `v`.
const VISIBLE_QUESTION_SQL = '(q.section IS NULL OR q.section = ANY(v.sections))';

// Every visible question has an answer (a set check, not a count: answers left on a
// section that was un-ticked must not count).
function allAnswered(questions, answers) {
  const answered = new Set(answers.map(a => a.question_id));
  return questions.length > 0 && questions.every(q => answered.has(q.id));
}

// The sections chosen by these answers' choices, using only questions in `questions`.
function chosenSections(questions, answers) {
  const byId = new Map(questions.map(q => [q.id, q]));
  const sections = new Set();
  for (const a of answers) {
    const options = byId.get(a.question_id)?.options;
    const choices = a.value?.choices;
    if (!Array.isArray(options) || !Array.isArray(choices)) continue;
    for (const o of options) {
      if (o.section && choices.includes(o.value)) sections.add(o.section);
    }
  }
  return [...sections].sort();
}

// The sections a visit has: those chosen in its choice answers — counting only answers to
// questions that are themselves asked, so a choice question inside a section that was
// un-ticked stops opening its own sections. Repeated until nothing changes (a section can
// hold a question that opens another). `questions` is the visit's whole list.
function sectionsFor(questions, answers) {
  let sections = [];
  for (;;) {
    const next = chosenSections(visibleQuestions(questions, sections), answers);
    if (next.join() === sections.join()) return sections;
    sections = next;
  }
}

module.exports = { isVisible, visibleQuestions, VISIBLE_QUESTION_SQL, allAnswered, sectionsFor };
