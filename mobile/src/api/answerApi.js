// Purpose: Multipart upload of a recorded answer to the backend.
// Uses axios (the shared apiClient) with a per-request multipart Content-Type.
// React Native's native XHR networking handles the { uri, name, type } file part
// and injects the multipart boundary — the global fetch in RN 0.85 throws
// "Unsupported FormDataPart implementation" for the same FormData, so we avoid it.
//
// Backend contract (backend/src/controllers/answerController.js):
//   POST /visits/:id/answers  multipart  fields: audio (file), questionId
//   Returns immediately with the answer row at transcript_status 'pending';
//   the backend transcribes in the background (pending → done/failed), so the
//   upload connection isn't held open for the whole STT duration. The list/review
//   screens reload to show the transcript once it resolves.

import { apiClient } from './client';

/**
 * Upload a recorded audio answer for a question.
 * @param {string|number} visitId
 * @param {string|number} questionId
 * @param {string} fileUri  Local file URI from the recorder
 * @returns {Promise<Object>} The created/replaced answer row (transcript, transcript_status, …)
 * @throws {Error} on failure — caller retains the local file and offers retry (AC6/AC10)
 */
// Retry only transient network failures (request dispatched but no HTTP response —
// RN's multipart upload intermittently drops the request body over Wi-Fi before it
// reaches the server). A real HTTP error (400/409/…) is a definitive server reply and
// must NOT be retried. Safe to retry because the backend upsert is keyed on
// (visit_id, question_id) — re-sending replaces, never duplicates.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [500, 1500]; // waits before attempts 2 and 3

const isTransientNetworkError = (err) =>
  !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll the visit until this question's answer finishes transcribing (leaves 'pending').
 * Used right after upload so the recording screen can hold a loader until the transcript
 * is ready — then the list shows it immediately instead of blank-until-manual-refresh.
 * Uses light GET requests (reliable; never holds a connection open), and gives up after
 * timeoutMs so a slow/stuck transcription can't block the attender forever.
 * @returns {Promise<Object|null>} the resolved answer row, or null if it timed out.
 */
export async function waitForAnswerTranscript(
  visitId,
  questionId,
  { timeoutMs = 45000, intervalMs = 1500 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { data } = await apiClient.get(`/visits/${visitId}`);
      const answer = (data?.answers || []).find(
        (a) => String(a.question_id) === String(questionId)
      );
      if (answer && answer.transcript_status !== 'pending') return answer;
    } catch {
      // transient GET failure — keep polling until the deadline
    }
    await wait(intervalMs);
  }
  return null; // timed out; caller proceeds, the list refreshes on next focus
}

export async function uploadAnswer(visitId, questionId, fileUri) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Build a FRESH FormData each attempt — a streamed request body can't be reused.
    const form = new FormData();
    // Append questionId BEFORE the file: multer's filename() only sees body fields
    // parsed earlier in the multipart stream, so the saved file is named correctly.
    form.append('questionId', String(questionId)); // AC5: backend reads req.body.questionId
    form.append('audio', { uri: fileUri, name: 'answer.m4a', type: 'audio/m4a' });

    try {
      const res = await apiClient.post(`/visits/${visitId}/answers`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, // RN appends the boundary
        timeout: 120000, // generous headroom; the upload itself is short
      });
      return res.data;
    } catch (err) {
      lastErr = err;
      // Give up on real server errors, or after the final attempt.
      if (!isTransientNetworkError(err) || attempt === MAX_ATTEMPTS) throw err;
      await wait(RETRY_BACKOFF_MS[attempt - 1] ?? 1500);
    }
  }
  throw lastErr; // unreachable, but keeps the contract explicit
}
