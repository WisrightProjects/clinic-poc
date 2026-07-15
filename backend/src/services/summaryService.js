const config = require('../config');
const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const kimiClient = require('../utils/summary/kimiClient');

// Kept for the 'mock' provider and as the fallback when a real provider errors.
const MOCK_SUMMARY =
  'Patient presents with fever for 3 days and a severe headache. No medication taken prior to visit. No known allergies. No significant past history — BP normal, no diabetes. Requires physical examination. Consider CBC and fever panel.';

// Loads the visit + its ordered question/transcript pairs for the LLM.
async function buildQA(visitId) {
  const visit = await visitRepository.findById(visitId);
  const template = await templateRepository.findActiveByDepartmentId(visit.department_id);
  const answers = await answerRepository.findByVisitId(visitId);
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  const qa = [...(template?.questions || [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({ question: q.text, answer: byQuestion.get(q.id)?.transcript || '' }));
  return { visit, qa };
}

// Returns { summaryText, generatedBy }. Provider chosen by config.summaryProvider.
async function generate(visitId) {
  if (config.summaryProvider === 'mock') {
    return { summaryText: MOCK_SUMMARY, generatedBy: 'mock' };
  }

  const { visit, qa } = await buildQA(visitId);
  try {
    switch (config.summaryProvider) {
      // 'claude' / 'sarvam' (paid LLMs) plug in here later — same shape as kimiClient.
      case 'kimi': {
        const summaryText = await kimiClient.summarise(visit, qa, config.summaryLanguage);
        return { summaryText, generatedBy: 'kimi' };
      }
      default:
        // Unknown/blank provider — degrade to safe canned text instead of crashing.
        return { summaryText: MOCK_SUMMARY, generatedBy: 'mock' };
    }
  } catch (err) {
    // Provider unreachable/errored — never break submit; store a marked fallback.
    // Log so a misconfigured provider is visible (otherwise the canned text looks real).
    console.error(`[summary] provider "${config.summaryProvider}" failed, using fallback:`, err.message);
    return { summaryText: MOCK_SUMMARY, generatedBy: 'mock-fallback' };
  }
}

module.exports = { generate };
