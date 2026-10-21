const gemini = require('../gemini');
const { buildSummaryPrompt, notReadNote } = require('./prompt');

// AI summary with Gemini, from the visit's real Q&A (prompt.js). Same shape as kimiClient.
// reports (CLINIC-018): { images: [{ mimeType, data (base64) }], notRead } — the visit's
// report photos go in the same request, after the prompt, so the summary adds "From reports:".

// Each photo is first checked on its own: asked inside the summary request, Gemini made up a
// value and date from a fully blurred photo; asked alone, it called it unreadable 3/3 times
// (and the sharp reports readable 6/6). Only READABLE photos go into the summary.
const READABILITY_PROMPT = [
  'Look at this photo of a medical report. Can every test name, value and date on it be read',
  'sharply, character by character, without guessing? Answer with exactly one word:',
  'READABLE if yes, UNREADABLE if any of them is blurred, too dark, cut off, or if it is not a medical report.',
].join(' ');
// Anything but a clear READABLE (UNREADABLE, an explanation, …) counts as unreadable.
const isReadable = reply => /^\s*READABLE\b/i.test(reply);
// The checks and the summary share gemini's one time limit (under the app's 120 s submit
// timeout); the checks may use only this much of it, so the summary keeps at least 60 s.
const CHECKS_MS = 30000;

async function summarise(visit, qa, language, reports = { images: [], notRead: 0 }) {
  const deadline = Date.now() + gemini.DEADLINE_MS;
  const checksDeadline = Date.now() + CHECKS_MS;
  // A check that fails (quota, a rejected image, out of time) counts that photo as unreadable
  // rather than failing the whole summary.
  const checks = await Promise.allSettled(reports.images.map(img =>
    gemini.generate('report check', [{ text: READABILITY_PROMPT }, gemini.inlinePart(img.mimeType, img.data)], checksDeadline)));
  const images = reports.images.filter((_, i) => checks[i].status === 'fulfilled' && isReadable(checks[i].value));
  const notRead = reports.notRead + reports.images.length - images.length;

  const summary = await gemini.generate('summary', [
    { text: buildSummaryPrompt(visit, qa, language, images) },
    ...images.map(img => gemini.inlinePart(img.mimeType, img.data)),
  ], deadline);
  // An empty reply stays empty, so summaryService treats it as a failure.
  return summary && notRead ? `${summary}\n\n${notReadNote(notRead)}` : summary;
}

module.exports = { summarise, readsReports: true, isReadable };
