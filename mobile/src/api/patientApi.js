// Purpose: CLINIC-027 — a returning patient. The mobile goes in the POST body, never a URL.

import { apiClient } from './client';

/**
 * The clinic's patients on a mobile number, last seen first.
 * @param {string} mobile  10 digits
 * @returns {Promise<Array<{ name, sex, age, height_cm, last_visit_date, visit_count }>>}
 */
export function lookupPatients(mobile) {
  return apiClient.post('/patients/lookup', { mobile }).then((r) => r.data.patients);
}
