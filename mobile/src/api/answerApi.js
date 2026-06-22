// Purpose: Multipart upload of a recorded answer to the backend.
// Uses axios (the shared apiClient) with a per-request multipart Content-Type.
// React Native's native XHR networking handles the { uri, name, type } file part
// and injects the multipart boundary — the global fetch in RN 0.85 throws
// "Unsupported FormDataPart implementation" for the same FormData, so we avoid it.
//
// Backend contract (backend/src/controllers/answerController.js):
//   POST /visits/:id/answers  multipart  fields: audio (file), questionId
//   The request transcribes synchronously and returns the completed answer row.

import { apiClient } from './client';

/**
 * Upload a recorded audio answer for a question.
 * @param {string|number} visitId
 * @param {string|number} questionId
 * @param {string} fileUri  Local file URI from the recorder
 * @returns {Promise<Object>} The created/replaced answer row (transcript, transcript_status, …)
 * @throws {Error} on failure — caller retains the local file and offers retry (AC6/AC10)
 */
export async function uploadAnswer(visitId, questionId, fileUri) {
  const form = new FormData();
  // Append questionId BEFORE the file: multer's filename() only sees body fields
  // parsed earlier in the multipart stream, so the saved file is named correctly.
  form.append('questionId', String(questionId)); // AC5: backend reads req.body.questionId
  form.append('audio', { uri: fileUri, name: 'answer.m4a', type: 'audio/m4a' });

  const res = await apiClient.post(`/visits/${visitId}/answers`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }, // RN appends the boundary
    // Upload + synchronous STT can be slow on a CPU box under load (Whisper + LLM
    // sharing cores), so allow generous headroom before the client gives up.
    timeout: 120000,
  });
  return res.data;
}
