import { apiRequest } from './client';

export async function loginDriver(identifier, password) {
  return await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: identifier.trim(),
      password,
    }),
  });
}

export async function verifyCurrentSession() {
  return await apiRequest('/auth/me', {
    method: 'GET',
  });
}
