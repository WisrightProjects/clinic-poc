import axios from 'axios';
import { getToken, clearSession } from '../auth/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Every request carries the login token (CLINIC-008). The old x-role header is
// ignored by the backend now.
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on a request that carried our current token means the session expired:
// sign out, and App.js shows the Login screen. A 401 without a token (wrong
// password on /auth/login) is a form error, and a 401 for an older token (a slow
// request from before a re-login) must not sign out the new session.
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const sent = error.config?.headers?.Authorization;
    if (error.response?.status === 401 && sent && sent === `Bearer ${getToken()}`) {
      clearSession();
    }
    return Promise.reject(error);
  }
);
