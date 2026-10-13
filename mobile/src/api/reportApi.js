// Purpose: Previous-report photos (CLINIC-011). Backend contract:
//   POST   /visits/:id/reports   multipart, field "report", one or more images (attender only)
//   GET    /visits/:id/reports   -> [{ id, visit_id, mime_type, size_bytes, uploaded_by, created_at }]
//   GET    /reports/:id/file     -> the image; needs the login token (see reportImageSource)
//   DELETE /reports/:id          (attender only, before the visit is submitted)
// Same multipart approach as answerApi.js: an { uri, name, type } part through axios,
// not the global fetch (RN throws "Unsupported FormDataPart implementation" there).

import { apiClient } from './client';
import { getToken } from '../auth/authStore';

export function listReports(visitId) {
  return apiClient.get(`/visits/${visitId}/reports`).then((r) => r.data);
}

/**
 * Upload one or more prepared images (local file URIs) in a single request.
 * @param {string|number} visitId
 * @param {string[]} fileUris  local JPEG URIs (already resized)
 * @returns {Promise<Object[]>} the created report rows
 */
export function uploadReports(visitId, fileUris) {
  const form = new FormData();
  fileUris.forEach((uri, i) => {
    form.append('report', { uri, name: `report-${Date.now()}-${i}.jpg`, type: 'image/jpeg' });
  });
  return apiClient
    .post(`/visits/${visitId}/reports`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }, // RN appends the boundary
      timeout: 120000,
    })
    .then((r) => r.data);
}

export function deleteReport(reportId) {
  return apiClient.delete(`/reports/${reportId}`);
}

/**
 * The <Image source> for a report photo. The file route needs the login token, and React
 * Native's Image can send headers itself, so the image library downloads and caches the
 * photo — nothing is held in JS memory.
 * It is an ARRAY on purpose: on Android, Image only passes `headers` to the native view
 * for an array source (RN 0.85 Image.android.js); a plain { uri, headers } object loses
 * the token and the server answers 401.
 */
export function reportImageSource(reportId) {
  return [
    {
      uri: `${apiClient.defaults.baseURL}/reports/${reportId}/file`,
      headers: { Authorization: `Bearer ${getToken()}` },
    },
  ];
}
