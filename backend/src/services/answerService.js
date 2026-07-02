const path = require('path');
const config = require('../config');
const answerRepository = require('../repositories/answerRepository');
const sttService = require('./sttService');
const visitService = require('./visitService');

async function recordAnswer(visitId, questionId, file) {
  if (!file || !file.path) {
    const err = new Error('Audio file is required');
    err.status = 400;
    throw err;
  }
  const audioPath = path.relative(config.audioDir, file.path);
  const answer = await answerRepository.upsert(visitId, questionId, audioPath, 'pending');
  // Advance the visit lifecycle now — these are fast DB-only ops that don't depend
  // on the transcript (progress is derived from answer rows, not transcript text).
  await visitService.maybeAdvance(visitId);
  // Transcribe in the BACKGROUND and respond immediately. Holding the mobile upload
  // connection open for the full 5–8s STT duration was intermittently dropping over
  // Wi-Fi as "Network Error" (the request/response never completing). The transcript
  // now fills in asynchronously (transcript_status: pending → done/failed) and clients
  // reload to see it — the answer row already exists, so the question shows as answered.
  startTranscription(answer.id, file.path);
  return answerRepository.findById(answer.id); // returned with transcript_status 'pending'
}

// Fire-and-forget background transcription. Never throws to the request handler;
// failures are recorded as transcript_status='failed', exactly as the old inline
// path did — submit still works, the answer is just marked failed.
function startTranscription(answerId, filePath) {
  (async () => {
    try {
      const transcript = await sttService.transcribe(filePath);
      await answerRepository.setTranscript(answerId, transcript, 'done');
    } catch (err) {
      console.error(`[answer] transcription failed for answer ${answerId}:`, err.message);
      try {
        await answerRepository.setTranscript(answerId, null, 'failed');
      } catch (dbErr) {
        console.error(`[answer] could not mark answer ${answerId} failed:`, dbErr.message);
      }
    }
  })();
}

module.exports = { recordAnswer };
