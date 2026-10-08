// Pure prompt builder for the AI summary — no config/DB/network deps so it can be
// unit-tested directly. Turns a visit + ordered Q&A into a clinical-summary prompt.

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
    ``,
    `Patient: ${who || 'unknown'}`,
    ``,
    lines,
    ``,
    `Summary:`,
  ].join('\n');
}

module.exports = { buildSummaryPrompt };
