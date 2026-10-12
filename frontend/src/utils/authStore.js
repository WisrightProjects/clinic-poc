// Login session for the doctor web (CLINIC-008.5): { token, user } in localStorage.
// The backend issues 30-day tokens, so the doctor stays signed in across reloads.
// The session is cached in memory and components subscribe via useSession(), so
// logout, a 401 expiry, or a sign-in/out in another tab re-renders immediately and
// RequireDoctor redirects to /login without a page reload.

import { useSyncExternalStore } from 'react'

const KEY = 'clinicai_session'

// Storage can be blocked (private window), so every access is wrapped.
function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null')
    return parsed?.token ? parsed : null
  } catch {
    return null
  }
}

let session = readStored() // { token, user } | null
const listeners = new Set()

function setSession(next) {
  session = next
  listeners.forEach((fn) => fn())
}

// Another tab signed in or out: follow it.
window.addEventListener('storage', (e) => {
  if (e.key === KEY) setSession(readStored())
})

const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const getToken = () => session?.token ?? null

// Current { token, user } or null; re-renders the component when it changes.
export const useSession = () => useSyncExternalStore(subscribe, () => session)

// The web dashboard is doctor-only (AC8).
export const isDoctor = (s) => s?.user?.role === 'doctor'

export function saveSession(next) {
  setSession(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // storage blocked: the doctor will have to sign in again after a reload
  }
}

export function clearSession() {
  setSession(null)
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
