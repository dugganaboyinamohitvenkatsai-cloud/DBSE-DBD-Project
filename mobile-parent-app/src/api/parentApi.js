import { apiRequest } from './client';

/**
 * Fetch authoritative parent safety dashboard
 * Returns: { parent, children: [ { student, transport } ] }
 */
export async function fetchParentDashboard() {
  return await apiRequest('/parent/dashboard');
}

/**
 * Fetch authenticated parent profile
 */
export async function fetchParentProfile() {
  return await apiRequest('/parent/me');
}

/**
 * Fetch linked students
 */
export async function fetchParentStudents() {
  return await apiRequest('/parent/students');
}

/**
 * Fetch detailed transport status for single student
 */
export async function fetchStudentStatus(studentId) {
  return await apiRequest(`/parent/students/${studentId}/status`);
}

/**
 * Register FCM device push token with backend
 */
export async function registerDeviceToken(token, platform = 'android') {
  return await apiRequest('/parent/device-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

/**
 * Unregister FCM device push token upon logout
 */
export async function unregisterDeviceToken(token) {
  return await apiRequest('/parent/device-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}
