import fetch from 'node-fetch';

/**
 * In-memory cache for route road geometries.
 * Key: string hash of ordered stop coordinates
 * Value: { geometry: Array<[lat: number, lng: number]>, provider: string, cached_at: number }
 */
const geometryCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch road-following geometry for an ordered list of stops.
 * @param {Array<{ latitude: number|string, longitude: number|string }>} stops
 * @returns {Promise<{ coordinates: Array<[number, number]>, provider: string, is_road_following: boolean }>}
 */
export async function getRoadRouteGeometry(stops) {
  const validStops = (stops || []).filter(
    (s) =>
      s.latitude !== null &&
      s.latitude !== undefined &&
      s.longitude !== null &&
      s.longitude !== undefined &&
      !isNaN(Number(s.latitude)) &&
      !isNaN(Number(s.longitude)) &&
      !(Number(s.latitude) === 0 && Number(s.longitude) === 0)
  );

  // If fewer than 2 stops, road routing cannot be computed
  if (validStops.length < 2) {
    const fallback = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
    return {
      coordinates: fallback,
      provider: 'direct_fallback',
      is_road_following: false,
    };
  }

  // Create cache key
  const cacheKey = validStops
    .map((s) => `${Number(s.latitude).toFixed(5)},${Number(s.longitude).toFixed(5)}`)
    .join(';');

  const cached = geometryCache.get(cacheKey);
  if (cached && Date.now() - cached.cached_at < CACHE_TTL_MS) {
    return {
      coordinates: cached.geometry,
      provider: cached.provider,
      is_road_following: true,
    };
  }

  // 1. Try OpenStreetMap OSRM driving route API
  try {
    // OSRM expects coordinates in lng,lat format separated by semicolon
    const coordString = validStops
      .map((s) => `${Number(s.longitude)},${Number(s.latitude)}`)
      .join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SchoolBusPortal/1.0 (Transportation Tracking Platform)',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const rawCoords = data.routes[0].geometry.coordinates; // [[lng, lat], ...]
        // Convert to [lat, lng] format for Leaflet/maps
        const latLngs = rawCoords.map(([lng, lat]) => [Number(lat), Number(lng)]);

        geometryCache.set(cacheKey, {
          geometry: latLngs,
          provider: 'osrm_driving',
          cached_at: Date.now(),
        });

        return {
          coordinates: latLngs,
          provider: 'osrm_driving',
          is_road_following: true,
          distance_meters: data.routes[0].distance,
          duration_seconds: data.routes[0].duration,
        };
      }
    }
  } catch (err) {
    console.warn('[RoutingService] OSRM query failed or timed out:', err.message);
  }

  // 2. Try Google Directions API if GOOGLE_MAPS_API_KEY is present
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleApiKey && googleApiKey.trim()) {
    try {
      const origin = `${validStops[0].latitude},${validStops[0].longitude}`;
      const destination = `${validStops[validStops.length - 1].latitude},${validStops[validStops.length - 1].longitude}`;
      const waypoints = validStops
        .slice(1, -1)
        .map((s) => `${s.latitude},${s.longitude}`)
        .join('|');

      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${googleApiKey}`;
      if (waypoints) {
        url += `&waypoints=${waypoints}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          // Decode overview_polyline or legs
          const points = decodeGooglePolyline(data.routes[0].overview_polyline.points);
          geometryCache.set(cacheKey, {
            geometry: points,
            provider: 'google_directions',
            cached_at: Date.now(),
          });

          return {
            coordinates: points,
            provider: 'google_directions',
            is_road_following: true,
          };
        }
      }
    } catch (err) {
      console.warn('[RoutingService] Google Directions failed:', err.message);
    }
  }

  // 3. Graceful fallback to connecting stored stops
  const fallback = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
  return {
    coordinates: fallback,
    provider: 'stops_fallback',
    is_road_following: false,
  };
}

/**
 * Polyline decode helper for Google polyline strings
 */
function decodeGooglePolyline(encoded) {
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}
