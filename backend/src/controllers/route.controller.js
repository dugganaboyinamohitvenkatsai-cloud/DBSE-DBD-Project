import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { resolveGoogleMapsLocation, searchPlaceLocations } from '../services/geocoding.service.js';

const SAFE_TEMP_OFFSET = 30000;
const MAX_SMALLINT_UNSIGNED = 65535;

/**
 * Helper to validate latitude
 */
function isValidLatitude(lat) {
  if (lat === null || lat === undefined || lat === '') return true;
  const num = Number(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
}

/**
 * Helper to validate longitude
 */
function isValidLongitude(lng) {
  if (lng === null || lng === undefined || lng === '') return true;
  const num = Number(lng);
  return !isNaN(num) && num >= -180 && num <= 180;
}

/**
 * Helper to validate TIME format (HH:MM or HH:MM:SS)
 */
function isValidTime(timeStr) {
  if (timeStr === null || timeStr === undefined || timeStr === '') return true;
  return /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/.test(String(timeStr).trim());
}

/**
 * Format scheduled time to HH:MM:SS or null
 */
function formatTime(timeStr) {
  if (!timeStr || String(timeStr).trim() === '') return null;
  const trimmed = String(timeStr).trim();
  if (/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  return trimmed;
}

// 1. GET /api/admin/routes?search=&page=1&limit=20
export const listRoutes = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = `
      WHERE r.route_code LIKE ?
         OR r.name LIKE ?
         OR r.description LIKE ?
    `;
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM routes r
    ${whereClause}
  `;
  const [[{ total }]] = await pool.execute(countQuery, params);

  const listQuery = `
    SELECT 
      r.id,
      r.route_code,
      r.name,
      r.description,
      r.estimated_duration_minutes,
      r.is_active,
      r.created_at,
      COUNT(s.id) AS stop_count
    FROM routes r
    LEFT JOIN stops s ON s.route_id = r.id
    ${whereClause}
    GROUP BY r.id
    ORDER BY r.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(listQuery, [...params, limit, offset]);

  const routes = rows.map((row) => ({
    ...row,
    is_active: Boolean(row.is_active),
    estimated_duration_minutes: row.estimated_duration_minutes !== null ? Number(row.estimated_duration_minutes) : null,
    stop_count: Number(row.stop_count),
  }));

  res.json({
    routes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// 2. GET /api/admin/routes/:id
export const getRoute = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [routeRows] = await pool.execute(
    `SELECT 
      id,
      route_code,
      name,
      description,
      estimated_duration_minutes,
      is_active,
      created_at
    FROM routes
    WHERE id = ?`,
    [routeId]
  );

  const route = routeRows[0];
  if (!route) {
    throw new ApiError(404, 'Route not found.');
  }

  const [stopRows] = await pool.execute(
    `SELECT 
      id,
      route_id,
      name,
      stop_order,
      latitude,
      longitude,
      scheduled_time,
      google_maps_url
    FROM stops
    WHERE route_id = ?
    ORDER BY stop_order ASC`,
    [routeId]
  );

  const stops = stopRows.map((s) => ({
    ...s,
    stop_order: Number(s.stop_order),
    latitude: s.latitude !== null ? Number(s.latitude) : null,
    longitude: s.longitude !== null ? Number(s.longitude) : null,
  }));

  res.json({
    route: {
      ...route,
      is_active: Boolean(route.is_active),
      estimated_duration_minutes: route.estimated_duration_minutes !== null ? Number(route.estimated_duration_minutes) : null,
    },
    stops,
  });
});

// GET /api/admin/routes/:id/stops
export const getRouteStops = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [routeRows] = await pool.execute('SELECT id FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  const [stopRows] = await pool.execute(
    `SELECT 
      id,
      route_id,
      name,
      stop_order,
      latitude,
      longitude,
      scheduled_time,
      google_maps_url
    FROM stops
    WHERE route_id = ?
    ORDER BY stop_order ASC`,
    [routeId]
  );

  const stops = stopRows.map((s) => ({
    ...s,
    stop_order: Number(s.stop_order),
    latitude: s.latitude !== null ? Number(s.latitude) : null,
    longitude: s.longitude !== null ? Number(s.longitude) : null,
  }));

  res.json({ stops });
});

// 3. POST /api/admin/routes
export const createRoute = asyncHandler(async (req, res) => {
  const {
    route_code,
    name,
    description = null,
    estimated_duration_minutes = null,
    is_active = true,
  } = req.body;

  const trimmedCode = (route_code || '').trim();
  const trimmedName = (name || '').trim();
  const trimmedDesc = description !== null && description !== undefined ? String(description).trim() : null;

  if (!trimmedCode) {
    throw new ApiError(400, 'Route code is required.');
  }
  if (trimmedCode.length > 40) {
    throw new ApiError(400, 'Route code must not exceed 40 characters.');
  }

  if (!trimmedName) {
    throw new ApiError(400, 'Route name is required.');
  }
  if (trimmedName.length > 120) {
    throw new ApiError(400, 'Route name must not exceed 120 characters.');
  }

  let parsedDuration = null;
  if (estimated_duration_minutes !== null && estimated_duration_minutes !== undefined && estimated_duration_minutes !== '') {
    parsedDuration = parseInt(estimated_duration_minutes, 10);
    if (isNaN(parsedDuration) || parsedDuration <= 0 || parsedDuration > MAX_SMALLINT_UNSIGNED) {
      throw new ApiError(400, 'Estimated duration must be a positive number of minutes (1-65535).');
    }
  }

  const activeBool = is_active === undefined || is_active === null ? true : Boolean(is_active);

  // Check unique route_code
  const [existing] = await pool.execute('SELECT id FROM routes WHERE route_code = ?', [trimmedCode]);
  if (existing[0]) {
    throw new ApiError(409, `Route code "${trimmedCode}" already exists.`);
  }

  const [result] = await pool.execute(
    `INSERT INTO routes (route_code, name, description, estimated_duration_minutes, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [trimmedCode, trimmedName, trimmedDesc || null, parsedDuration, activeBool]
  );

  const [createdRows] = await pool.execute(
    `SELECT id, route_code, name, description, estimated_duration_minutes, is_active, created_at
     FROM routes WHERE id = ?`,
    [result.insertId]
  );

  const createdRoute = createdRows[0];

  res.status(201).json({
    message: 'Route created successfully.',
    route: {
      ...createdRoute,
      is_active: Boolean(createdRoute.is_active),
      estimated_duration_minutes: createdRoute.estimated_duration_minutes !== null ? Number(createdRoute.estimated_duration_minutes) : null,
      stop_count: 0,
    },
  });
});

// 4. PUT /api/admin/routes/:id
export const updateRoute = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [existingRows] = await pool.execute('SELECT * FROM routes WHERE id = ?', [routeId]);
  const current = existingRows[0];
  if (!current) {
    throw new ApiError(404, 'Route not found.');
  }

  const {
    route_code,
    name,
    description,
    estimated_duration_minutes,
    is_active,
  } = req.body;

  let trimmedCode = current.route_code;
  if (route_code !== undefined) {
    trimmedCode = (route_code || '').trim();
    if (!trimmedCode) {
      throw new ApiError(400, 'Route code cannot be empty.');
    }
    if (trimmedCode.length > 40) {
      throw new ApiError(400, 'Route code must not exceed 40 characters.');
    }
    // Check uniqueness excluding current
    const [dup] = await pool.execute(
      'SELECT id FROM routes WHERE route_code = ? AND id != ?',
      [trimmedCode, routeId]
    );
    if (dup[0]) {
      throw new ApiError(409, `Route code "${trimmedCode}" already exists.`);
    }
  }

  let trimmedName = current.name;
  if (name !== undefined) {
    trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new ApiError(400, 'Route name cannot be empty.');
    }
    if (trimmedName.length > 120) {
      throw new ApiError(400, 'Route name must not exceed 120 characters.');
    }
  }

  let trimmedDesc = current.description;
  if (description !== undefined) {
    trimmedDesc = description !== null ? String(description).trim() : null;
  }

  let parsedDuration = current.estimated_duration_minutes;
  if (estimated_duration_minutes !== undefined) {
    if (estimated_duration_minutes === null || estimated_duration_minutes === '') {
      parsedDuration = null;
    } else {
      parsedDuration = parseInt(estimated_duration_minutes, 10);
      if (isNaN(parsedDuration) || parsedDuration <= 0 || parsedDuration > MAX_SMALLINT_UNSIGNED) {
        throw new ApiError(400, 'Estimated duration must be a positive number of minutes (1-65535).');
      }
    }
  }

  let activeBool = current.is_active;
  if (is_active !== undefined) {
    activeBool = Boolean(is_active);
  }

  await pool.execute(
    `UPDATE routes 
     SET route_code = ?, name = ?, description = ?, estimated_duration_minutes = ?, is_active = ?
     WHERE id = ?`,
    [trimmedCode, trimmedName, trimmedDesc, parsedDuration, activeBool, routeId]
  );

  const [updatedRows] = await pool.execute(
    `SELECT id, route_code, name, description, estimated_duration_minutes, is_active, created_at
     FROM routes WHERE id = ?`,
    [routeId]
  );

  const updatedRoute = updatedRows[0];

  res.json({
    message: 'Route updated successfully.',
    route: {
      ...updatedRoute,
      is_active: Boolean(updatedRoute.is_active),
      estimated_duration_minutes: updatedRoute.estimated_duration_minutes !== null ? Number(updatedRoute.estimated_duration_minutes) : null,
    },
  });
});

// 5. DELETE /api/admin/routes/:id
export const deleteRoute = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [routeRows] = await pool.execute('SELECT id, name FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  // Check if route is referenced by trips
  const [[{ trip_count }]] = await pool.execute(
    'SELECT COUNT(*) AS trip_count FROM trips WHERE route_id = ?',
    [routeId]
  );

  if (Number(trip_count) > 0) {
    throw new ApiError(
      409,
      'This route cannot be deleted because it is referenced by existing trips.'
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // stops cascade delete automatically via foreign key stops.route_id -> routes.id ON DELETE CASCADE
    await connection.execute('DELETE FROM routes WHERE id = ?', [routeId]);

    await connection.commit();

    res.json({
      message: 'Route and associated stops deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

// 7. POST /api/admin/routes/:id/stops
export const createStop = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [routeRows] = await pool.execute('SELECT id FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  const { name, stop_order, latitude, longitude, scheduled_time, google_maps_url } = req.body;

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new ApiError(400, 'Stop name is required.');
  }
  if (trimmedName.length > 120) {
    throw new ApiError(400, 'Stop name must not exceed 120 characters.');
  }

  if (!isValidLatitude(latitude)) {
    throw new ApiError(400, 'Latitude must be a valid number between -90 and 90.');
  }
  if (!isValidLongitude(longitude)) {
    throw new ApiError(400, 'Longitude must be a valid number between -180 and 180.');
  }
  if (!isValidTime(scheduled_time)) {
    throw new ApiError(400, 'Scheduled time must be in valid format (HH:MM or HH:MM:SS).');
  }

  const parsedLat = latitude !== null && latitude !== undefined && latitude !== '' ? Number(latitude) : null;
  const parsedLng = longitude !== null && longitude !== undefined && longitude !== '' ? Number(longitude) : null;
  const parsedTime = formatTime(scheduled_time);
  const parsedGoogleMapsUrl = google_maps_url ? String(google_maps_url).trim().slice(0, 500) : null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Get current stops with row locks
    const [existingStops] = await connection.execute(
      'SELECT id, stop_order FROM stops WHERE route_id = ? ORDER BY stop_order ASC FOR UPDATE',
      [routeId]
    );

    let targetOrder;
    if (stop_order === undefined || stop_order === null || stop_order === '') {
      // Append automatically
      const maxOrder = existingStops.length > 0 ? existingStops[existingStops.length - 1].stop_order : 0;
      targetOrder = maxOrder + 1;
    } else {
      const explicitOrder = parseInt(stop_order, 10);
      if (isNaN(explicitOrder) || explicitOrder <= 0 || explicitOrder > MAX_SMALLINT_UNSIGNED) {
        throw new ApiError(400, 'Stop order must be a positive integer.');
      }
      targetOrder = explicitOrder;
    }

    // Check if targetOrder is already occupied or within existing range
    const conflictIndex = existingStops.findIndex((s) => s.stop_order >= targetOrder);

    if (conflictIndex !== -1) {
      // Safe two-phase shift for stops >= targetOrder
      const stopsToShift = existingStops.slice(conflictIndex);

      // Verify safe range
      if (existingStops.length + SAFE_TEMP_OFFSET + 10 > MAX_SMALLINT_UNSIGNED) {
        throw new ApiError(400, 'Stop sequence limit exceeded.');
      }

      // Phase 1: Move to temporary range
      for (let i = 0; i < stopsToShift.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [SAFE_TEMP_OFFSET + i + 1, stopsToShift[i].id, routeId]
        );
      }

      // Phase 2: Shift each stop by +1
      for (let i = 0; i < stopsToShift.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [stopsToShift[i].stop_order + 1, stopsToShift[i].id, routeId]
        );
      }
    }

    // Insert new stop
    const [insertResult] = await connection.execute(
      `INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time, google_maps_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [routeId, trimmedName, targetOrder, parsedLat, parsedLng, parsedTime, parsedGoogleMapsUrl]
    );

    await connection.commit();

    const [createdRows] = await pool.execute(
      `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time, google_maps_url
       FROM stops WHERE id = ?`,
      [insertResult.insertId]
    );

    const createdStop = createdRows[0];

    res.status(201).json({
      message: 'Stop created successfully.',
      stop: {
        ...createdStop,
        stop_order: Number(createdStop.stop_order),
        latitude: createdStop.latitude !== null ? Number(createdStop.latitude) : null,
        longitude: createdStop.longitude !== null ? Number(createdStop.longitude) : null,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

// 8. PUT /api/admin/routes/:id/stops/:stopId
export const updateStop = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  const stopId = parseInt(req.params.stopId, 10);

  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }
  if (isNaN(stopId) || stopId <= 0) {
    throw new ApiError(400, 'Invalid stop ID.');
  }

  const [routeRows] = await pool.execute('SELECT id FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  const [stopRows] = await pool.execute(
    'SELECT * FROM stops WHERE id = ? AND route_id = ?',
    [stopId, routeId]
  );
  const currentStop = stopRows[0];
  if (!currentStop) {
    throw new ApiError(404, 'Stop not found on this route.');
  }

  const { name, stop_order, latitude, longitude, scheduled_time, google_maps_url } = req.body;

  let trimmedName = currentStop.name;
  if (name !== undefined) {
    trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new ApiError(400, 'Stop name cannot be empty.');
    }
    if (trimmedName.length > 120) {
      throw new ApiError(400, 'Stop name must not exceed 120 characters.');
    }
  }

  let parsedLat = currentStop.latitude;
  if (latitude !== undefined) {
    if (!isValidLatitude(latitude)) {
      throw new ApiError(400, 'Latitude must be a valid number between -90 and 90.');
    }
    parsedLat = latitude !== null && latitude !== '' ? Number(latitude) : null;
  }

  let parsedLng = currentStop.longitude;
  if (longitude !== undefined) {
    if (!isValidLongitude(longitude)) {
      throw new ApiError(400, 'Longitude must be a valid number between -180 and 180.');
    }
    parsedLng = longitude !== null && longitude !== '' ? Number(longitude) : null;
  }

  let parsedTime = currentStop.scheduled_time;
  if (scheduled_time !== undefined) {
    if (!isValidTime(scheduled_time)) {
      throw new ApiError(400, 'Scheduled time must be in valid format (HH:MM or HH:MM:SS).');
    }
    parsedTime = formatTime(scheduled_time);
  }

  let parsedGoogleMapsUrl = currentStop.google_maps_url || null;
  if (google_maps_url !== undefined) {
    parsedGoogleMapsUrl = google_maps_url ? String(google_maps_url).trim().slice(0, 500) : null;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const oldOrder = Number(currentStop.stop_order);
    let requestedOrder = oldOrder;

    if (stop_order !== undefined && stop_order !== null && stop_order !== '') {
      const explicitOrder = parseInt(stop_order, 10);
      if (isNaN(explicitOrder) || explicitOrder <= 0 || explicitOrder > MAX_SMALLINT_UNSIGNED) {
        throw new ApiError(400, 'Stop order must be a positive integer.');
      }
      requestedOrder = explicitOrder;
    }

    if (requestedOrder !== oldOrder) {
      // Resequence stops
      const [allStops] = await connection.execute(
        'SELECT id, stop_order FROM stops WHERE route_id = ? ORDER BY stop_order ASC FOR UPDATE',
        [routeId]
      );

      // Create new ordered array of stop IDs
      // Exclude current stop, then insert at position (clamped to bounds)
      const otherStopIds = allStops.filter((s) => s.id !== stopId).map((s) => s.id);
      const targetIndex = Math.max(0, Math.min(requestedOrder - 1, otherStopIds.length));
      otherStopIds.splice(targetIndex, 0, stopId);

      // Two-phase resequence all stops
      // Phase 1: temporary safe values
      for (let i = 0; i < otherStopIds.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [SAFE_TEMP_OFFSET + i + 1, otherStopIds[i], routeId]
        );
      }

      // Phase 2: assign clean 1..N order
      for (let i = 0; i < otherStopIds.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [i + 1, otherStopIds[i], routeId]
        );
      }
    }

    // Update remaining fields
    await connection.execute(
      `UPDATE stops 
       SET name = ?, latitude = ?, longitude = ?, scheduled_time = ?, google_maps_url = ?
       WHERE id = ? AND route_id = ?`,
      [trimmedName, parsedLat, parsedLng, parsedTime, parsedGoogleMapsUrl, stopId, routeId]
    );

    await connection.commit();

    const [updatedRows] = await pool.execute(
      `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time, google_maps_url
       FROM stops WHERE id = ?`,
      [stopId]
    );

    const updatedStop = updatedRows[0];

    res.json({
      message: 'Stop updated successfully.',
      stop: {
        ...updatedStop,
        stop_order: Number(updatedStop.stop_order),
        latitude: updatedStop.latitude !== null ? Number(updatedStop.latitude) : null,
        longitude: updatedStop.longitude !== null ? Number(updatedStop.longitude) : null,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

// POST /api/admin/routes/resolve-location
// and POST /api/admin/stops/resolve-location
export const resolveLocation = asyncHandler(async (req, res) => {
  const url = req.body?.url || req.body?.google_maps_url || req.body?.link || req.body?.location;
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new ApiError(400, 'Unable to resolve this Google Maps location. Please check the link or enter coordinates manually.');
  }

  const result = await resolveGoogleMapsLocation(url);

  res.json({
    success: true,
    latitude: result.latitude,
    longitude: result.longitude,
    formatted_address: result.formatted_address || null,
    source_url: result.source_url,
  });
});

// GET /api/admin/routes/search-location?query=...
// and POST /api/admin/routes/search-location
export const searchLocation = asyncHandler(async (req, res) => {
  const query = req.query.query || req.query.q || req.body?.query || req.body?.q;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.json({ success: true, results: [] });
  }

  const results = await searchPlaceLocations(query);

  res.json({
    success: true,
    query: query.trim(),
    results,
  });
});

// 9. DELETE /api/admin/routes/:id/stops/:stopId
export const deleteStop = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  const stopId = parseInt(req.params.stopId, 10);

  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }
  if (isNaN(stopId) || stopId <= 0) {
    throw new ApiError(400, 'Invalid stop ID.');
  }

  const [routeRows] = await pool.execute('SELECT id FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  const [stopRows] = await pool.execute(
    'SELECT id, stop_order FROM stops WHERE id = ? AND route_id = ?',
    [stopId, routeId]
  );
  if (!stopRows[0]) {
    throw new ApiError(404, 'Stop not found on this route.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Delete target stop
    await connection.execute('DELETE FROM stops WHERE id = ? AND route_id = ?', [stopId, routeId]);

    // Reindex remaining stops safely
    const [remaining] = await connection.execute(
      'SELECT id FROM stops WHERE route_id = ? ORDER BY stop_order ASC FOR UPDATE',
      [routeId]
    );

    if (remaining.length > 0) {
      // Phase 1: move to temporary
      for (let i = 0; i < remaining.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [SAFE_TEMP_OFFSET + i + 1, remaining[i].id, routeId]
        );
      }
      // Phase 2: assign clean 1..N
      for (let i = 0; i < remaining.length; i++) {
        await connection.execute(
          'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
          [i + 1, remaining[i].id, routeId]
        );
      }
    }

    await connection.commit();

    res.json({
      message: 'Stop deleted and remaining stops reindexed successfully.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

// 10. PUT /api/admin/routes/:id/stops/reorder
export const reorderStops = asyncHandler(async (req, res) => {
  const routeId = parseInt(req.params.id, 10);
  if (isNaN(routeId) || routeId <= 0) {
    throw new ApiError(400, 'Invalid route ID.');
  }

  const [routeRows] = await pool.execute('SELECT id FROM routes WHERE id = ?', [routeId]);
  if (!routeRows[0]) {
    throw new ApiError(404, 'Route not found.');
  }

  const { stop_ids } = req.body;

  if (!Array.isArray(stop_ids)) {
    throw new ApiError(400, 'stop_ids must be an array of stop IDs.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [existingStops] = await connection.execute(
      'SELECT id, stop_order FROM stops WHERE route_id = ? ORDER BY stop_order ASC FOR UPDATE',
      [routeId]
    );

    if (existingStops.length === 0 && stop_ids.length === 0) {
      await connection.commit();
      return res.json({
        message: 'No stops to reorder.',
        stops: [],
      });
    }

    if (stop_ids.length !== existingStops.length) {
      throw new ApiError(
        400,
        `Expected ${existingStops.length} stop IDs for this route, received ${stop_ids.length}.`
      );
    }

    // Check duplicate IDs in request
    const uniqueIds = new Set(stop_ids.map(Number));
    if (uniqueIds.size !== stop_ids.length) {
      throw new ApiError(400, 'stop_ids contains duplicate IDs.');
    }

    // Check all IDs exist and belong to route
    const existingIdSet = new Set(existingStops.map((s) => s.id));
    for (const id of stop_ids) {
      const numId = Number(id);
      if (!existingIdSet.has(numId)) {
        throw new ApiError(400, `Stop ID ${id} does not belong to this route.`);
      }
    }

    // Check SMALLINT UNSIGNED overflow safety
    if (stop_ids.length + SAFE_TEMP_OFFSET > MAX_SMALLINT_UNSIGNED) {
      throw new ApiError(400, 'Too many stops to reorder safely.');
    }

    // Two-Phase Reorder
    // Phase 1: Set temporary stop_order (SAFE_TEMP_OFFSET + 1 .. N)
    for (let i = 0; i < stop_ids.length; i++) {
      const sId = Number(stop_ids[i]);
      await connection.execute(
        'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
        [SAFE_TEMP_OFFSET + i + 1, sId, routeId]
      );
    }

    // Phase 2: Set final stop_order (1 .. N)
    for (let i = 0; i < stop_ids.length; i++) {
      const sId = Number(stop_ids[i]);
      await connection.execute(
        'UPDATE stops SET stop_order = ? WHERE id = ? AND route_id = ?',
        [i + 1, sId, routeId]
      );
    }

    await connection.commit();

    // Fetch and return reordered stops
    const [updatedStops] = await pool.execute(
      `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
       FROM stops WHERE route_id = ? ORDER BY stop_order ASC`,
      [routeId]
    );

    res.json({
      message: 'Stops reordered successfully.',
      stops: updatedStops.map((s) => ({
        ...s,
        stop_order: Number(s.stop_order),
        latitude: s.latitude !== null ? Number(s.latitude) : null,
        longitude: s.longitude !== null ? Number(s.longitude) : null,
      })),
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
