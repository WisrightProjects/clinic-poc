// Single place that talks to the REAL backend through the Vite /api proxy.
// Attaches the doctor role header on every call (POC: no real auth).
// Throws an Error with .status on non-2xx for the error-state handling.

export const ROLE = 'doctor'

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-role': ROLE,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
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
  return res.status === 204 ? null : res.json()
}

// GET /api/visits?status= — full queue, or filtered by comma-separated statuses
export const getVisits = (status) =>
  request(`/visits${status ? `?status=${encodeURIComponent(status)}` : ''}`)

// GET /api/visits/:id — { visit, template, answers, summary }
export const getVisit = (id) => request(`/visits/${id}`)

// PATCH /api/visits/:id/status — doctor marks a summarised visit done
export const setVisitDone = (id) =>
  request(`/visits/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'done' }),
  })
