import { ApiError } from '../utils/api-error.js';

const UNABLE_TO_RESOLVE_MSG =
  'Unable to resolve this Google Maps location. Please check the link or enter coordinates manually.';

/**
 * Validates whether a hostname belongs to trusted Google Maps / Google domains.
 * Strictly prevents SSRF attacks.
 */
export function isTrustedGoogleDomain(hostname) {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.toLowerCase().trim();

  // Reject IP addresses or localhost
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;

  // Exact matches
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'maps.google.com') return true;

  // Regex matches for google.com and regional domains (e.g. google.co.in, google.co.uk)
  const isGoogleDomain =
    /^([a-z0-9-]+\.)?google\.(?:com|co\.[a-z]{2}|[a-z]{2})$/i.test(host);
  const isGooGlDomain = /^([a-z0-9-]+\.)?goo\.gl$/i.test(host);

  return isGoogleDomain || isGooGlDomain;
}

/**
 * Validates coordinate ranges.
 */
export function isValidCoordinatePair(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    isNaN(latitude) ||
    isNaN(longitude)
  ) {
    return false;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return false;
  }

  // Reject (0, 0)
  if (Math.abs(lat) < 1e-7 && Math.abs(lng) < 1e-7) {
    return false;
  }

  return true;
}

/**
 * Extracts coordinates from an URL string using known Google Maps patterns.
 * Returns { latitude, longitude, formatted_address } or null.
 */
export function extractCoordinatesFromGoogleUrl(urlObj) {
  const fullHref = urlObj.href;
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  // 1. Path pattern: /@(-?\d+\.\d+),(-?\d+\.\d+)
  const pathMatch = pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (isValidCoordinatePair(lat, lng)) {
      return {
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lng.toFixed(7)),
      };
    }
  }

  // 2. Data parameter patterns: !3d(-?\d+\.\d+)...!4d(-?\d+\.\d+)
  // (In Google Maps, 3d = latitude, 4d = longitude)
  const dataLatMatch = fullHref.match(/!3d(-?\d+(?:\.\d+)?)/);
  const dataLngMatch = fullHref.match(/!4d(-?\d+(?:\.\d+)?)/);
  if (dataLatMatch && dataLngMatch) {
    const lat = parseFloat(dataLatMatch[1]);
    const lng = parseFloat(dataLngMatch[1]);
    if (isValidCoordinatePair(lat, lng)) {
      return {
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lng.toFixed(7)),
      };
    }
  }

  // 3. Query parameters: q, ll, query, destination, daddr, center
  const coordParams = ['q', 'll', 'query', 'destination', 'daddr', 'center'];
  for (const param of coordParams) {
    const val = searchParams.get(param);
    if (val) {
      // Remove possible prefix like "loc:"
      const cleaned = val.replace(/^loc:\s*/i, '').trim();
      const coordMatch = cleaned.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        if (isValidCoordinatePair(lat, lng)) {
          return {
            latitude: Number(lat.toFixed(7)),
            longitude: Number(lng.toFixed(7)),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Safely resolves short links (e.g. maps.app.goo.gl or goo.gl/maps) by following
 * HTTP redirects while enforcing domain whitelist on every hop.
 */
async function resolveGoogleShortUrl(initialUrl) {
  let currentUrl = initialUrl;
  const maxHops = 5;

  for (let i = 0; i < maxHops; i++) {
    let parsed;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }

    if (!isTrustedGoogleDomain(parsed.hostname)) {
      // Untrusted redirect target; abort for SSRF safety
      return null;
    }

    // First check if current URL already contains coordinates
    const directCoords = extractCoordinatesFromGoogleUrl(parsed);
    if (directCoords) {
      return { ...directCoords, finalUrl: currentUrl };
    }

    // Follow redirect
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'SchoolBusPortal/1.0',
        },
      });
      clearTimeout(timeout);

      const location = response.headers.get('location');
      if (location) {
        // Resolve relative redirects against current URL
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      // If HEAD didn't redirect or gave 405, try GET without downloading large body
      if (response.status >= 300 && response.status < 400 && location) {
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      // If no redirect header from HEAD, we try a quick GET request
      const getController = new AbortController();
      const getTimeout = setTimeout(() => getController.abort(), 5000);
      const getResponse = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(getTimeout);

      const getLocation = getResponse.headers.get('location');
      if (getLocation) {
        currentUrl = new URL(getLocation, currentUrl).href;
        continue;
      }

      // If no further redirect, check current URL
      const finalParsed = new URL(currentUrl);
      const finalCoords = extractCoordinatesFromGoogleUrl(finalParsed);
      if (finalCoords) {
        return { ...finalCoords, finalUrl: currentUrl };
      }

      break;
    } catch (err) {
      clearTimeout(timeout);
      break;
    }
  }

  return null;
}

/**
 * Optional Google Geocoding API integration if GOOGLE_MAPS_API_KEY is configured.
 */
async function geocodeAddressWithApiKey(query, apiKey) {
  if (!apiKey || !query) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const endpoint = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
      const loc = data.results[0].geometry?.location;
      if (loc && isValidCoordinatePair(loc.lat, loc.lng)) {
        return {
          latitude: Number(loc.lat.toFixed(7)),
          longitude: Number(loc.lng.toFixed(7)),
          formatted_address: data.results[0].formatted_address || query,
        };
      }
    }
  } catch (err) {
    clearTimeout(timeout);
  }
  return null;
}

/**
 * Main service function to resolve a Google Maps link or location input into coordinates.
 *
 * @param {string} input - Google Maps URL or raw coordinate string
 * @returns {Promise<{ latitude: number, longitude: number, formatted_address?: string, source_url: string }>}
 */
export async function resolveGoogleMapsLocation(input) {
  if (!input || typeof input !== 'string') {
    throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
  }

  // Check if input is a direct "lat, lng" pair
  const directPairMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (directPairMatch) {
    const lat = parseFloat(directPairMatch[1]);
    const lng = parseFloat(directPairMatch[2]);
    if (isValidCoordinatePair(lat, lng)) {
      return {
        latitude: Number(lat.toFixed(7)),
        longitude: Number(lng.toFixed(7)),
        source_url: trimmed,
      };
    }
  }

  // Parse as URL
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
  }

  // Protocol check
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
  }

  // Domain check for Google
  if (!isTrustedGoogleDomain(parsedUrl.hostname)) {
    throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
  }

  // 1. Direct coordinate extraction
  const directCoords = extractCoordinatesFromGoogleUrl(parsedUrl);
  if (directCoords) {
    return {
      latitude: directCoords.latitude,
      longitude: directCoords.longitude,
      source_url: trimmed,
    };
  }

  // 2. Short URL expansion (maps.app.goo.gl or goo.gl)
  if (parsedUrl.hostname === 'maps.app.goo.gl' || parsedUrl.hostname === 'goo.gl') {
    const expanded = await resolveGoogleShortUrl(trimmed);
    if (expanded && isValidCoordinatePair(expanded.latitude, expanded.longitude)) {
      return {
        latitude: expanded.latitude,
        longitude: expanded.longitude,
        source_url: trimmed,
      };
    }
  }

  // 3. Fallback: Google Geocoding API if API key is configured
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    // Extract search query from q or query params, or place name from pathname
    let searchQuery = parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query');
    if (!searchQuery && parsedUrl.pathname.includes('/place/')) {
      const placePart = parsedUrl.pathname.split('/place/')[1];
      if (placePart) {
        searchQuery = decodeURIComponent(placePart.split('/')[0]).replace(/\+/g, ' ');
      }
    }

    if (searchQuery) {
      const geocoded = await geocodeAddressWithApiKey(searchQuery, apiKey);
      if (geocoded) {
        return {
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          formatted_address: geocoded.formatted_address,
          source_url: trimmed,
        };
      }
    }
  }

  // If all resolution methods failed:
  throw new ApiError(400, UNABLE_TO_RESOLVE_MSG);
}

/**
 * Search locations and return suggested places with coordinates.
 * Supports Google Geocoding API if key is present, and OpenStreetMap Nominatim as zero-config engine.
 */
export async function searchPlaceLocations(query) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return [];
  }
  const cleanQuery = query.trim();

  // 1. Google Places / Geocoding if API key is configured
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey && apiKey.trim() && apiKey !== 'your_google_maps_api_key_here') {
    try {
      const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanQuery)}&key=${apiKey}`;
      const res = await fetch(geoUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results.slice(0, 6).map((item, idx) => ({
            id: item.place_id || String(idx),
            name: item.formatted_address.split(',')[0],
            display_name: item.formatted_address,
            latitude: Number(item.geometry.location.lat.toFixed(7)),
            longitude: Number(item.geometry.location.lng.toFixed(7)),
            provider: 'google',
          }));
        }
      }
    } catch (err) {
      console.warn('[GeocodingService] Google search fallback:', err.message);
    }
  }

  // 2. OpenStreetMap Nominatim Search (Zero-config, global + Indian coverage)
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&addressdetails=1&limit=6`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'SchoolBusPortal/1.0 (admin@schoolbus.local)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        return list
          .filter(item => isValidCoordinatePair(item.lat, item.lon))
          .map(item => ({
            id: String(item.place_id || item.osm_id),
            name: item.name || item.display_name.split(',')[0].trim(),
            display_name: item.display_name,
            latitude: Number(parseFloat(item.lat).toFixed(7)),
            longitude: Number(parseFloat(item.lon).toFixed(7)),
            provider: 'osm',
          }));
      }
    }
  } catch (err) {
    console.warn('[GeocodingService] Nominatim search error:', err.message);
  }

  return [];
}

