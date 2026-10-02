import { apiRequest } from './client';

export async function loginParent(identifier, password) {
  const trimmed = identifier.trim();
  return await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: trimmed,
      phone: trimmed,
      password,
    }),
  });
}

export async function verifyCurrentSession() {
  return await apiRequest('/auth/me', {
    method: 'GET',
  });
}
