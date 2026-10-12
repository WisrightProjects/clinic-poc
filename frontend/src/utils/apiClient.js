// Single place that talks to the REAL backend through the Vite /api proxy.
// Attaches the login token (CLINIC-008) as a Bearer header on every call.
// Throws an Error with .status on non-2xx for the error-state handling.

import { getToken, clearSession } from './authStore'

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    // Our token was rejected (expired/invalid): sign out; RequireDoctor then sends
    // the doctor to /login. A 401 without a token (wrong password on login) is just
    // a form error, and a late 401 for an older token must not sign out a newer login.
    if (res.status === 401 && token && token === getToken()) clearSession()
    let message = `API ${res.status}`
    try {
      const body = await res.json()
      message = body?.error?.message ?? message
    } catch {
      // non-JSON error body — keep the status message
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  if (options.asBlob) return res.blob()
  return res.status === 204 ? null : res.json()
}

// POST /api/auth/login — { token, user: { id, name, role, clinic: { id, name } } }
export const login = (mobile, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ mobile, password }) })

// GET /api/visits?status= — full queue, or filtered by comma-separated statuses
export const getVisits = (status) =>
  request(`/visits${status ? `?status=${encodeURIComponent(status)}` : ''}`)

// GET /api/visits/:id — { visit, template, answers, summary, reports }
export const getVisit = (id) => request(`/visits/${id}`)

// POST /api/visits/:id/test-request — doctor sends a summarised (waiting) patient for
// tests with a required note (CLINIC-014). 409 = the visit is no longer summarised,
// 422 = empty note or over 1000 characters.
export const requestTests = (id, note) =>
  request(`/visits/${id}/test-request`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  })

// GET /api/reports/:id/file — a previous-report photo (CLINIC-011) as a Blob. The route
// needs the login header, so a plain <img src> can't load it: fetch it here, then show
// it through URL.createObjectURL (see components/ReportsList.jsx).
export const getReportImage = (id) => request(`/reports/${id}/file`, { asBlob: true })

// PATCH /api/visits/:id/status — doctor marks a summarised visit done
export const setVisitDone = (id) =>
  request(`/visits/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' }),
  })
