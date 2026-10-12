// Purpose: Login call (CLINIC-008). Returns { token, user: { id, name, role, clinic } }.

import { apiClient } from './client';

export function login(mobile, password) {
  return apiClient.post('/auth/login', { mobile, password }).then((r) => r.data);
}
