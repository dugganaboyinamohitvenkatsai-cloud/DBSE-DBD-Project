import { apiRequest } from './client';

/**
 * Fetch paginated in-app notifications
 */
export async function fetchParentNotifications(page = 1, limit = 20) {
  return await apiRequest(`/parent/notifications?page=${page}&limit=${limit}`);
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(notificationId) {
  return await apiRequest(`/parent/notifications/${notificationId}/read`, {
    method: 'PUT',
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead() {
  return await apiRequest('/parent/notifications/read-all', {
    method: 'PUT',
  });
}
