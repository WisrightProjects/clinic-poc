// Purpose: Holds the login session (token + user) for the attender app.
// The token lives encrypted in expo-secure-store so it survives app restarts
// (the backend issues 30-day tokens). An in-memory copy lets the axios request
// interceptor read it synchronously, and useSession() lets React components
// re-render when the session changes (login, logout, or a 401 from any API call).

import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'clinicai_session';

// `loaded` is false until the saved session has been read once at startup.
let state = { loaded: false, session: null }; // session: { token, user } | null
const listeners = new Set();

// Storage writes run one after another so a quick login -> logout can't leave the
// old session saved on disk.
let storageQueue = Promise.resolve();
function persist(op) {
  storageQueue = storageQueue.then(op).catch(() => {
    // Storage failed: the in-memory session is still correct for this run.
  });
}

function setState(next) {
  state = next;
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getToken() {
  return state.session?.token ?? null;
}

// { loaded, session } — session is null when signed out.
export function useSession() {
  return useSyncExternalStore(subscribe, () => state);
}

// Read the saved session once at app start. A missing or unreadable entry just
// means "signed out". Ignored if a login/logout already happened meanwhile.
export async function loadSession() {
  let saved = null;
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    saved = parsed?.token ? parsed : null;
  } catch {
    saved = null;
  }
  if (state.loaded) return;
  setState({ loaded: true, session: saved });
}

export async function saveSession({ token, user }) {
  const session = { token, user };
  setState({ loaded: true, session });
  persist(() => SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)));
}

export async function clearSession() {
  setState({ loaded: true, session: null });
  persist(() => SecureStore.deleteItemAsync(SESSION_KEY));
}
