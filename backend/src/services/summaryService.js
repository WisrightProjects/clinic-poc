const fs = require('fs');
const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const templateRepository = require('../repositories/templateRepository');
const questionFlow = require('../utils/questionFlow');
const reportRepository = require('../repositories/reportRepository');
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
  const template = await templateRepository.findForVisit(visit);
  const answers = await answerRepository.findByVisitId(visit.id);
  const byQuestion = new Map(answers.map((a) => [a.question_id, a]));
  // Only the questions the visit is asked (CLINIC-021): answers left on an un-ticked
  // problem's questions never reach the summary.
  const qa = questionFlow.visibleQuestions(template?.questions || [], visit.sections)
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => ({ question: q.text, answer: byQuestion.get(q.id)?.transcript || '' }));
  return qa;
}

// CLINIC-018: report photos sent with the summary request, at most this many bytes in total
// (base64 makes it ~19 MB, under Gemini's inline request limit).
const MAX_REPORT_BYTES_PER_SUMMARY = 14 * 1024 * 1024;

// Pure: the photos that fit in the budget, in upload order, and how many did not.
function pickReports(files) {
  const picked = [];
  let total = 0;
  for (const file of files) {
    if (total + file.size_bytes > MAX_REPORT_BYTES_PER_SUMMARY) continue;
    picked.push(file);
    total += file.size_bytes;
  }
  return { picked, notRead: files.length - picked.length };
}

// The visit's report photos as base64 images. A file missing on disk is skipped and
// counted as not read, so the summary tells the doctor to check it.
async function loadReports(visitId) {
  const { picked, notRead: tooLarge } = pickReports(await reportRepository.findFilesByVisitId(visitId));
  const images = [];
  let notRead = tooLarge;
  for (const file of picked) {
    try {
      const data = (await fs.promises.readFile(path.join(config.reportsDir, file.file_path))).toString('base64');
      images.push({ mimeType: file.mime_type, data });
    } catch (err) {
      console.error(`[summary] report ${file.id} not read:`, err.message);
      notRead += 1;
    }
  }
  return { images, notRead };
}

// The real AI providers. 'claude' / 'sarvam' (paid LLMs) plug in here later — same shape.
// A client exporting readsReports: true also gets the report photos (CLINIC-018).
const PROVIDERS = new Map([['kimi', kimiClient], ['gemini', geminiClient]]);
const readsReports = () => Boolean(PROVIDERS.get(config.summaryProvider)?.readsReports);

// The provider's summary of the Q&A (and photos, if it reads them). Throws on a provider
// error or an empty reply — an empty one would be stored as a blank summary.
async function callProvider(client, visit, qa) {
  const reports = client.readsReports ? await loadReports(visit.id) : undefined;
  const summaryText = await client.summarise(visit, qa, config.summaryLanguage, reports);
  if (!summaryText) throw new Error('empty summary');
  return { summaryText, generatedBy: config.summaryProvider };
}

// Returns { summaryText, generatedBy }. Provider chosen by config.summaryProvider.
async function generate(visit) {
  const client = PROVIDERS.get(config.summaryProvider);
  // 'mock', or an unknown/blank provider — safe canned text instead of crashing.
  if (!client) return { summaryText: MOCK_SUMMARY, generatedBy: 'mock' };

  const qa = await buildQA(visit);
  try {
    return await callProvider(client, visit, qa);
  } catch (err) {
    // Provider unreachable/errored — never break submit; store a marked fallback.
    // Log so a misconfigured provider is visible (otherwise the canned text looks real).
    console.error(`[summary] provider "${config.summaryProvider}" failed, using fallback:`, err.message);
    return { summaryText: FALLBACK_SUMMARY, generatedBy: 'mock-fallback' };
  }
}

// CLINIC-018: a new summary including the report photos, for Back in queue; null when the
// provider can't read photos. Throws when the AI fails, so the caller keeps the earlier
// summary instead of storing the fallback note.
async function regenerate(visit) {
  if (!readsReports()) return null;
  return callProvider(PROVIDERS.get(config.summaryProvider), visit, await buildQA(visit));
}

module.exports = { generate, regenerate, readsReports, pickReports };
