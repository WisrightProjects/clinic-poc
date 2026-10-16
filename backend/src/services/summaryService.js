const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const kimiClient = require('../utils/summary/kimiClient');
const geminiClient = require('../utils/summary/geminiClient');

// The 'mock' provider's canned demo text.
const MOCK_SUMMARY =
  'Patient presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes. Requires physical examination. Consider CBC and fever panel.';
// Stored when a real provider fails: it must never read like this patient's findings (the demo
// text above would show a doctor symptoms the patient never reported).
const FALLBACK_SUMMARY = "AI summary not available for this patient. Please read the patient's answers below.";

// The visit's ordered question/transcript pairs for the LLM.
async function buildQA(visit) {
  const template = await templateRepository.findActiveForVisit(visit);
  const answers = await answerRepository.findByVisitId(visit.id);
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  const qa = [...(template?.questions || [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({ question: q.text, answer: byQuestion.get(q.id)?.transcript || '' }));
  return qa;
}

// The real AI providers. 'claude' / 'sarvam' (paid LLMs) plug in here later — same shape.
const PROVIDERS = new Map([['kimi', kimiClient], ['gemini', geminiClient]]);

// Returns { summaryText, generatedBy }. Provider chosen by config.summaryProvider.
async function generate(visit) {
  const client = PROVIDERS.get(config.summaryProvider);
  // 'mock', or an unknown/blank provider — safe canned text instead of crashing.
  if (!client) return { summaryText: MOCK_SUMMARY, generatedBy: 'mock' };

  const qa = await buildQA(visit);
  try {
    const summaryText = await client.summarise(visit, qa, config.summaryLanguage);
    // An empty reply would be stored as a blank summary that submit never regenerates;
    // treat it as a failure so the marked fallback is stored instead.
    if (!summaryText) throw new Error('empty summary');
    return { summaryText, generatedBy: config.summaryProvider };
  } catch (err) {
    // Provider unreachable/errored — never break submit; store a marked fallback.
    // Log so a misconfigured provider is visible (otherwise the canned text looks real).
    console.error(`[summary] provider "${config.summaryProvider}" failed, using fallback:`, err.message);
    return { summaryText: FALLBACK_SUMMARY, generatedBy: 'mock-fallback' };
  }
}

module.exports = { generate };
