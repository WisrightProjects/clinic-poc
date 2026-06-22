const config = require('../config');
const visitRepository = require('../repositories/visitRepository');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const ollamaClient = require('../utils/summary/ollamaClient');

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
    let summaryText;
    switch (config.summaryProvider) {
      // 'claude' / 'sarvam' (paid LLMs) plug in here later — same shape as ollamaClient.
      case 'ollama':
      default:
        summaryText = await ollamaClient.summarise(visit, qa, config.summaryLanguage);
    }
    return { summaryText, generatedBy: config.summaryProvider };
  } catch (_err) {
    // Provider unreachable/errored — never break submit; store a marked fallback.
    return { summaryText: MOCK_SUMMARY, generatedBy: 'mock-fallback' };
  }
}

module.exports = { generate };
