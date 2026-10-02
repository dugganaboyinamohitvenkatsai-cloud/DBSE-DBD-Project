import { apiRequest } from './client';

/**
 * Fetch all trips assigned to authenticated driver
 */
export async function fetchDriverTrips() {
  const data = await apiRequest('/driver/trips');
  return data?.trips || [];
}

/**
 * Fetch the currently active or next scheduled trip
 */
export async function fetchActiveTrip() {
  const data = await apiRequest('/driver/active-trip');
  return {
    activeTrip: data?.activeTrip || null,
    scheduledTrip: data?.scheduledTrip || null,
    staleTrip: data?.staleTrip || null,
  };
}

/**
 * Start an assigned trip
 */
export async function startTrip(tripId) {
  return await apiRequest(`/driver/trips/${tripId}/start`, {
    method: 'POST',
  });
}

/**
 * Complete an active trip
 */
export async function completeTrip(tripId) {
  return await apiRequest(`/driver/trips/${tripId}/complete`, {
    method: 'POST',
  });
}

/**
 * Ingest live GPS coordinates into backend
 */
export async function submitDriverLocation({ latitude, longitude, accuracy, timestamp, trip_id }) {
  return await apiRequest('/driver/location', {
    method: 'POST',
    body: JSON.stringify({
      latitude,
      longitude,
      accuracy,
      timestamp,
      trip_id,
    }),
  });
}

/**
 * Fetch students enrolled on a specific trip
 */
export async function fetchTripStudents(tripId) {
  const data = await apiRequest(`/driver/trips/${tripId}/students`);
  return data?.students || [];
}

/**
 * Update student boarding / transport status
 */
export async function updateStudentStatus(studentId, tripId, newStatus) {
  return await apiRequest(`/admin/students/${studentId}/transport-status`, {
    method: 'PUT',
    body: JSON.stringify({
      trip_id: tripId,
      status: newStatus,
    }),
  });
}
