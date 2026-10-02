/**
 * Service to calculate distance and detect stop arrivals dynamically.
 */

const EARTH_RADIUS_METERS = 6371000;
export const DEFAULT_ARRIVAL_RADIUS_METERS = 100; // 100 meters

/**
 * Calculate great-circle distance between two geographic coordinates using the Haversine formula.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} distance in meters
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return Infinity;

  // Never calculate distance from (0,0) or invalid geographic coordinates
  if ((nLat1 === 0 && nLon1 === 0) || (nLat2 === 0 && nLon2 === 0)) return Infinity;
  if (nLat1 < -90 || nLat1 > 90 || nLat2 < -90 || nLat2 > 90) return Infinity;
  if (nLon1 < -180 || nLon1 > 180 || nLon2 < -180 || nLon2 > 180) return Infinity;

  const toRad = (val) => (val * Math.PI) / 180;

  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Determine stop arrival state for a given GPS update.
 * @param {Object} params
 * @param {number} params.latitude - current bus latitude
 * @param {number} params.longitude - current bus longitude
 * @param {number} [params.accuracy] - current GPS accuracy in meters
 * @param {Array} params.stops - ordered array of stops for the trip route
 * @param {Set<number>|Array<number>} params.reachedStopIds - stop IDs already reached for this trip
 * @param {number} [params.arrivalRadiusMeters] - arrival radius threshold (default: 100m, expands slightly if accuracy is poor)
 * @returns {Object} { newlyReachedStop: Object|null, isFinalStop: boolean, stopProgression: Array }
 */
export function evaluateStopArrivals({
  latitude,
  longitude,
  accuracy = 0,
  stops = [],
  reachedStopIds = new Set(),
  arrivalRadiusMeters = DEFAULT_ARRIVAL_RADIUS_METERS,
}) {
  const reachedSet = reachedStopIds instanceof Set ? reachedStopIds : new Set(reachedStopIds);
  const effectiveRadius = Math.max(arrivalRadiusMeters, Math.min(Number(accuracy) || 0, 150));

  const hasValidBusGps =
    latitude !== null &&
    longitude !== null &&
    latitude !== undefined &&
    longitude !== undefined &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude)) &&
    !(Number(latitude) === 0 && Number(longitude) === 0) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180;

  let newlyReachedStop = null;
  let isFinalStop = false;

  // Build progression for each stop
  const stopProgression = stops.map((stop, index) => {
    const isAlreadyReached = reachedSet.has(stop.id);
    let distanceToBus = null;

    if (
      hasValidBusGps &&
      stop.latitude !== null &&
      stop.longitude !== null &&
      !isNaN(Number(stop.latitude)) &&
      !isNaN(Number(stop.longitude)) &&
      !(Number(stop.latitude) === 0 && Number(stop.longitude) === 0)
    ) {
      const dist = calculateDistanceMeters(
        Number(latitude),
        Number(longitude),
        Number(stop.latitude),
        Number(stop.longitude)
      );
      if (dist !== Infinity && !isNaN(dist)) {
        distanceToBus = Math.round(dist);
      }
    }

    return {
      ...stop,
      distanceToBus,
      isReached: isAlreadyReached,
      status: isAlreadyReached ? 'REACHED' : 'UPCOMING',
    };
  });

  // Find the earliest unreached stop that is within effective arrival radius
  for (let i = 0; i < stopProgression.length; i++) {
    const item = stopProgression[i];
    if (item.isReached) continue;

    // Check if within arrival radius
    if (item.distanceToBus !== null && item.distanceToBus <= effectiveRadius) {
      // Newly reached stop found!
      newlyReachedStop = stops[i];
      item.isReached = true;
      item.status = 'REACHED';
      reachedSet.add(newlyReachedStop.id);

      // Check if this is the final stop on the route
      if (i === stopProgression.length - 1) {
        isFinalStop = true;
      }
      break; // Process one stop transition per GPS point
    }
  }

  // Determine current active stop (first unreached stop, or the newly reached stop, or last reached stop if all complete)
  let foundCurrent = false;
  for (let i = 0; i < stopProgression.length; i++) {
    if (!stopProgression[i].isReached) {
      stopProgression[i].status = 'CURRENT';
      foundCurrent = true;
      break;
    }
  }

  if (!foundCurrent && stopProgression.length > 0) {
    // All reached: last stop is marked completed/final
    stopProgression[stopProgression.length - 1].status = 'FINAL_REACHED';
  }

  return {
    newlyReachedStop,
    isFinalStop,
    stopProgression,
  };
}
