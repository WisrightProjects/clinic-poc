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
    `You are a clinical scribe writing in ${language} for a doctor. This is for the doctor's eyes only — never patient-facing advice; the doctor interprets it and decides what to tell the patient.`,
    `Write for THIS patient specifically — vary your wording and sentence structure to match what they actually said; do not reuse the same phrasing or template for every patient.`,
    `Use ONLY the information given; do not invent findings. If an answer is empty, ignore it.`,
    `Keep the patient's uncertainty: if they say "I think", "not sure" or "I don't know", write it as possible or unknown, never as a confirmed fact.`,
    `Do not add diagnoses, types or medical terms the patient did not state (for example write "thyroid problem on tablets", not "hypothyroidism").`,
    `Include important negatives the patient reported (for example no allergies, no smoking).`,
    `Plain text only — no markdown, no asterisks, no bold/italic formatting.`,
    ``,
    `Patient: ${who || 'unknown'}`,
    ``,
    lines,
    ``,
    `Respond in exactly this format, with these two labels:`,
    `Clinical Summary: 2-4 sentences for the doctor, grounded only in what was said above.`,
    `Suggested Next Steps: 1-2 general categories for the doctor to consider (e.g. "routine follow-up", "dietary counseling") — suggestions only; the doctor decides, never a treatment, diagnosis or prescription.`,
  ].join('\n');
}

module.exports = { buildSummaryPrompt };
