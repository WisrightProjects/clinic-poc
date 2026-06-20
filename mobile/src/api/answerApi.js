// Purpose: Multipart upload of a recorded answer to the backend.
// Uses fetch (NOT the shared axios apiClient) so React Native sets the multipart
// boundary itself — apiClient defaults to Content-Type: application/json, which
// would corrupt the upload. Mirrors apiClient's base URL + x-role header.
//
// Backend contract (backend/src/controllers/answerController.js):
//   POST /visits/:id/answers  multipart  fields: audio (file), questionId
//   The request transcribes synchronously and returns the completed answer row.

import { apiClient } from './client';

const BASE_URL = apiClient.defaults.baseURL; // e.g. http://localhost:4000/api

/**
 * Upload a recorded audio answer for a question.
 * @param {string|number} visitId
 * @param {string|number} questionId
 * @param {string} fileUri  Local file URI from the recorder
 * @returns {Promise<Object>} The created/replaced answer row (transcript, transcript_status, …)
 * @throws {Error} on non-2xx — caller retains the local file and offers retry (AC6/AC10)
 */
export async function uploadAnswer(visitId, questionId, fileUri) {
  const form = new FormData();
  // Append questionId BEFORE the file: multer's filename() only sees body fields
  // parsed earlier in the multipart stream, so the saved file is named correctly.
  form.append('questionId', String(questionId)); // AC5: backend reads req.body.questionId
  form.append('audio', { uri: fileUri, name: 'answer.m4a', type: 'audio/m4a' });

  const res = await fetch(`${BASE_URL}/visits/${visitId}/answers`, {
    method: 'POST',
    headers: { 'x-role': 'attender' }, // do NOT set Content-Type — RN adds the boundary
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      // non-JSON error body — keep the status message
    }
    throw new Error(message);
  }
  return res.json();
}
