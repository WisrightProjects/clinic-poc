// Purpose: API wrappers for visit endpoints.
// Uses the shared axios instance from client.js (x-role: attender header is pre-set).
//
// Response shape for getVisitDetail:
//   { visit, template, answers, summary }
//   Questions are at data.template.questions — NOT data.questions.
//   When no active template exists, template is null and questions will be [].

import { apiClient } from './client';

/**
 * Create a new visit.
 * @param {{ patientName: string, age?: number, sex?: string, departmentId: number }} body
 * @returns {Promise<Object>} The created visit row (id, token_number, patient_name, …)
 */
export function createVisit(body) {
  return apiClient.post('/visits', body).then((r) => r.data);
}

/**
 * Fetch visit detail — visit row, active template (with questions), answers, summary.
 * @param {string|number} id  Visit id
 * @returns {Promise<{ visit: Object, template: Object|null, answers: Array, summary: Object|null }>}
 */
export function getVisitDetail(id) {
  return apiClient.get(`/visits/${id}`).then((r) => r.data);
}

/**
 * Fetch the patient queue — all visits, ordered by token number.
 * @param {string} [status]  Optional visit_status filter (e.g. 'waiting')
 * @returns {Promise<Array>} Visit rows (id, token_number, patient_name, status, …)
 */
export function getVisits(status) {
  return apiClient
    .get('/visits', { params: status ? { status } : undefined })
    .then((r) => r.data);
}

/**
 * Submit a fully-answered visit for summarisation. Guarded (409 if incomplete)
 * and idempotent (re-submit returns the existing summary, no duplicate).
 * @param {string|number} id  Visit id
 * @returns {Promise<{ status: string, summary: Object }>} The stored summary row
 */
export function submitVisit(id) {
  // Submit triggers synchronous AI summary generation (Kimi LLM API), which can be
  // slow under load, so allow generous headroom beyond the 10s default.
  return apiClient.post(`/visits/${id}/submit`, undefined, { timeout: 120000 }).then((r) => r.data);
}
