// Purpose: Previous-report photos (CLINIC-011). Backend contract:
//   POST   /visits/:id/reports   multipart, field "report", one or more images (attender only)
//   GET    /visits/:id/reports   -> [{ id, visit_id, mime_type, size_bytes, uploaded_by, created_at }]
//   GET    /reports/:id/file     -> the image; needs the login token, so it is fetched through
//                                  apiClient (which attaches it) and shown as a data URL
//   DELETE /reports/:id          (attender only, before the visit is submitted)
// Same multipart approach as answerApi.js: an { uri, name, type } part through axios,
// not the global fetch (RN throws "Unsupported FormDataPart implementation" there).

import { apiClient } from './client';

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
  imageCache.delete(reportId);
  return apiClient.delete(`/reports/${reportId}`);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// A report's image never changes for a given id, so a fetched one is kept — but only the
// most recent few, since each is a full-size photo held as a base64 string. (A small
// thumbnail route on the backend would cut this a lot.)
const imageCache = new Map();
const MAX_CACHED_IMAGES = 24;

/** The report image as a data URL, ready for <Image source={{ uri }} />. */
export async function fetchReportImage(reportId) {
  if (imageCache.has(reportId)) return imageCache.get(reportId);
  const { data } = await apiClient.get(`/reports/${reportId}/file`, {
    responseType: 'blob',
    timeout: 60000,
  });
  const dataUrl = await blobToDataUrl(data);
  imageCache.set(reportId, dataUrl);
  if (imageCache.size > MAX_CACHED_IMAGES) imageCache.delete(imageCache.keys().next().value);
  return dataUrl;
}
