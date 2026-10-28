// Purpose: API wrappers for visit endpoints.
// Uses the shared axios instance from client.js (Bearer token is attached by its interceptor).
//
// Response shape for getVisitDetail:
//   { visit, template, answers, summary }
//   Questions are at data.template.questions — NOT data.questions.
//   template is the visit's own list (CLINIC-020: the one it was registered on, even if it was
//   replaced since) — never load questions for a visit from GET /templates (the active list).
//   When there is no list, template is null and questions will be [].

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
 * Fetch visit detail — visit row, the visit's own template (with questions), answers, summary.
 * @param {string|number} id  Visit id
 * @returns {Promise<{ visit: Object, template: Object|null, answers: Array, summary: Object|null }>}
 */
export function getVisitDetail(id) {
  return apiClient.get(`/visits/${id}`).then((r) => r.data);
}

/**
 * Save today's vitals (CLINIC-024): every field optional; numbers as typed.
 * @param {{ bpSystolic?, bpDiastolic?, pulse?, temperature?, temperatureUnit?, spo2?, sugar?, sugarType? }} vitals
 * @returns {Promise<Object>} the stored vitals row
 */
export function saveVitals(visitId, vitals) {
  return apiClient.put(`/visits/${visitId}/vitals`, vitals).then((r) => r.data);
}

/**
 * Fetch one day's patient queue (CLINIC-015), ordered by queue place, plus everyone
 * waiting for tests whatever their day.
 * @param {{ date?: string, status?: string }} [filters]  date = YYYY-MM-DD (today when
 *   omitted); status = optional visit_status filter (e.g. 'waiting')
 * @returns {Promise<Array>} Visit rows (id, queue_token, patient_name, status, …)
 */
export function getVisits({ date, status } = {}) {
  return apiClient.get('/visits', { params: { date, status } }).then((r) => r.data);
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
