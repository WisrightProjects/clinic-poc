// Pure prompt builder for the AI summary — no config/DB/network deps so it can be
// unit-tested directly. Turns a visit + ordered Q&A into a clinical-summary prompt.

// What the summary says for an answer that can't be understood, so the doctor asks the patient.
const UNCLEAR_NOTE = 'answer unclear — please check with the patient';

function buildSummaryPrompt(visit, qa, language = 'English') {
  const who = [visit?.sex, visit?.age != null ? `${visit.age} yrs` : null]
    .filter(Boolean)
    .join(', ');
  const lines = (qa || [])
    .map((p) => `Q: ${p.question}\nA: ${p.answer || '(no answer)'}`)
    .join('\n');

  return [
    `You are a clinical scribe. Summarise the patient intake below into 2-4 concise sentences in ${language} for a doctor.`,
    `Use ONLY the information given; do not invent findings. If an answer is empty, ignore it.`,
    `Keep the patient's uncertainty: if they say "I think", "not sure" or "I don't know", write it as possible or unknown, never as a confirmed fact.`,
    `Do not add diagnoses, types or medical terms the patient did not state (for example write "thyroid problem on tablets", not "hypothyroidism").`,
    `Include important negatives the patient reported (for example no allergies, no smoking).`,
    // A misheard recording can come through as garbled text; guessing from it produced a
    // made-up diagnosis ("bipolar nerve issues") in testing (CLINIC-013).
    `The answers come from speech recognition and may contain misheard words. Only report what an answer clearly says in plain words. If an answer is garbled, partial or does not make sense, do not guess what it means and never turn a misheard word into a medical term: write "${UNCLEAR_NOTE}" for that question.`,
    ``,
    `Patient: ${who || 'unknown'}`,
    ``,
    lines,
    ``,
    `Summary:`,
  ].join('\n');
}

module.exports = { buildSummaryPrompt };
