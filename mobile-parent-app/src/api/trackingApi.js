import { apiRequest } from './client';

/**
 * Fetch detailed route stop progression and coordinates for an active/scheduled trip
 */
export async function fetchTripJourney(tripId) {
  return await apiRequest(`/trips/${tripId}/journey`);
}
