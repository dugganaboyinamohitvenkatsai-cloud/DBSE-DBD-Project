import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

const VALID_STATUSES = ['SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const VALID_DIRECTIONS = ['PICKUP', 'DROPOFF'];

// Helper to format date to YYYY-MM-DD using UTC values to align with database timezone: 'Z'
function formatDate(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return trimmed.split('T')[0];
  }
  if (dateVal instanceof Date) {
    const y = dateVal.getUTCFullYear();
    const m = String(dateVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateVal.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(dateVal).split('T')[0];
}

// Helper to format datetime to YYYY-MM-DD HH:MM:SS using UTC values
function formatDateTime(dtVal) {
  if (!dtVal) return null;
  if (typeof dtVal === 'string') {
    const trimmed = dtVal.trim();
    if (trimmed.includes('T')) {
      const [d, t] = trimmed.split('T');
      const timePart = t.length === 5 ? `${t}:00` : t.slice(0, 8);
      return `${d} ${timePart}`;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    }
  }
  if (dtVal instanceof Date) {
    const y = dtVal.getUTCFullYear();
    const m = String(dtVal.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dtVal.getUTCDate()).padStart(2, '0');
    const h = String(dtVal.getUTCHours()).padStart(2, '0');
    const min = String(dtVal.getUTCMinutes()).padStart(2, '0');
    const s = String(dtVal.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
  return String(dtVal);
}

/**
 * Validates state transition
 */
function isValidStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  switch (currentStatus) {
    case 'SCHEDULED':
      return nextStatus === 'STARTED' || nextStatus === 'CANCELLED' || nextStatus === 'COMPLETED';
    case 'STARTED':
      return nextStatus === 'IN_PROGRESS' || nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED';
    case 'IN_PROGRESS':
      return nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED';
    case 'COMPLETED':
      return false; // Terminal state
    case 'CANCELLED':
      return false; // Terminal state
    default:
      return false;
  }
}

// GET /api/admin/trips/options - Helper for frontend modal dropdowns
export const getTripOptions = asyncHandler(async (req, res) => {
  // 1. Active buses with assigned driver info
  const [buses] = await pool.execute(`
    SELECT 
      b.id,
      b.bus_number,
      b.registration_number,
      b.capacity,
      b.assigned_driver_id,
      b.is_active,
      u.full_name AS assigned_driver_name,
      d.employee_code AS assigned_driver_code
    FROM buses b
    LEFT JOIN drivers d ON d.id = b.assigned_driver_id
    LEFT JOIN users u ON u.id = d.user_id
    WHERE b.is_active = TRUE
    ORDER BY b.bus_number ASC
  `);

  // 2. Active drivers
  const [drivers] = await pool.execute(`
    SELECT 
      d.id,
      d.employee_code,
      d.license_number,
      d.license_expiry,
      u.full_name,
      u.email,
      u.phone,
      u.is_active
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    WHERE u.is_active = TRUE AND u.role = 'DRIVER'
    ORDER BY u.full_name ASC
  `);

  // 3. Active routes with stop counts
  const [routes] = await pool.execute(`
    SELECT 
      r.id,
      r.route_code,
      r.name,
      r.estimated_duration_minutes,
      r.is_active,
      COUNT(s.id) AS stop_count
    FROM routes r
    LEFT JOIN stops s ON s.route_id = r.id
    WHERE r.is_active = TRUE
    GROUP BY r.id
    ORDER BY r.name ASC
  `);

  res.json({
    buses: buses.map((b) => ({
      ...b,
      capacity: Number(b.capacity),
      is_active: Boolean(b.is_active),
    })),
    drivers: drivers.map((d) => ({
      ...d,
      license_expiry: formatDate(d.license_expiry),
      is_active: Boolean(d.is_active),
    })),
    routes: routes.map((r) => ({
      ...r,
      estimated_duration_minutes: r.estimated_duration_minutes ? Number(r.estimated_duration_minutes) : null,
      stop_count: Number(r.stop_count),
      is_active: Boolean(r.is_active),
    })),
  });
});

// GET /api/admin/trips?search=&status=&date=&page=1&limit=20
export const listTrips = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const status = (req.query.status || '').trim();
  const dateFilter = (req.query.date || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const whereConditions = [];
  const params = [];

  if (search) {
    whereConditions.push(`(
      r.route_code LIKE ?
      OR r.name LIKE ?
      OR b.bus_number LIKE ?
      OR b.registration_number LIKE ?
      OR u.full_name LIKE ?
      OR d.employee_code LIKE ?
    )`);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  if (status && VALID_STATUSES.includes(status)) {
    whereConditions.push('t.status = ?');
    params.push(status);
  }

  if (dateFilter) {
    const parsedDate = formatDate(dateFilter);
    if (parsedDate) {
      whereConditions.push('t.trip_date = ?');
      params.push(parsedDate);
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM trips t
    JOIN buses b ON b.id = t.bus_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    JOIN routes r ON r.id = t.route_id
    ${whereClause}
  `;
  const [[{ total }]] = await pool.execute(countQuery, params);

  const listQuery = `
    SELECT 
      t.id,
      t.bus_id,
      t.route_id,
      t.driver_id,
      t.trip_date,
      t.direction,
      t.scheduled_start_at,
      t.started_at,
      t.completed_at,
      t.status,
      t.notes,
      t.created_at,
      b.bus_number,
      b.registration_number,
      b.capacity,
      r.route_code,
      r.name AS route_name,
      r.estimated_duration_minutes,
      u.full_name AS driver_name,
      d.employee_code AS driver_employee_code,
      u.phone AS driver_phone
    FROM trips t
    JOIN buses b ON b.id = t.bus_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    JOIN routes r ON r.id = t.route_id
    ${whereClause}
    ORDER BY t.scheduled_start_at DESC, t.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(listQuery, [...params, limit, offset]);

  const items = rows.map((row) => ({
    ...row,
    trip_date: formatDate(row.trip_date),
    capacity: Number(row.capacity),
    estimated_duration_minutes: row.estimated_duration_minutes ? Number(row.estimated_duration_minutes) : null,
  }));

  res.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/admin/trips/:id
export const getTrip = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const [rows] = await pool.execute(
    `SELECT 
      t.id,
      t.bus_id,
      t.route_id,
      t.driver_id,
      t.trip_date,
      t.direction,
      t.scheduled_start_at,
      t.started_at,
      t.completed_at,
      t.status,
      t.notes,
      t.created_at,
      b.bus_number,
      b.registration_number,
      b.capacity,
      b.is_active AS bus_is_active,
      r.route_code,
      r.name AS route_name,
      r.description AS route_description,
      r.estimated_duration_minutes,
      r.is_active AS route_is_active,
      u.full_name AS driver_name,
      d.employee_code AS driver_employee_code,
      d.license_number AS driver_license_number,
      d.license_expiry AS driver_license_expiry,
      u.phone AS driver_phone,
      u.email AS driver_email,
      u.is_active AS driver_is_active
    FROM trips t
    JOIN buses b ON b.id = t.bus_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    JOIN routes r ON r.id = t.route_id
    WHERE t.id = ?`,
    [tripId]
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'Trip not found.');
  }

  // Fetch ordered stops for the route
  const [stopRows] = await pool.execute(
    `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
     FROM stops
     WHERE route_id = ?
     ORDER BY stop_order ASC`,
    [row.route_id]
  );

  const stops = stopRows.map((s) => ({
    ...s,
    stop_order: Number(s.stop_order),
    latitude: s.latitude !== null ? Number(s.latitude) : null,
    longitude: s.longitude !== null ? Number(s.longitude) : null,
  }));

  res.json({
    trip: {
      id: row.id,
      bus_id: row.bus_id,
      route_id: row.route_id,
      driver_id: row.driver_id,
      trip_date: formatDate(row.trip_date),
      direction: row.direction,
      scheduled_start_at: row.scheduled_start_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      status: row.status,
      notes: row.notes,
      created_at: row.created_at,
      bus_number: row.bus_number,
      registration_number: row.registration_number,
      route_code: row.route_code,
      route_name: row.route_name,
      driver_name: row.driver_name,
      driver_employee_code: row.driver_employee_code,
    },
    bus: {
      id: row.bus_id,
      bus_number: row.bus_number,
      registration_number: row.registration_number,
      capacity: Number(row.capacity),
      is_active: Boolean(row.bus_is_active),
    },
    driver: {
      id: row.driver_id,
      full_name: row.driver_name,
      employee_code: row.driver_employee_code,
      license_number: row.driver_license_number,
      license_expiry: formatDate(row.driver_license_expiry),
      phone: row.driver_phone,
      email: row.driver_email,
      is_active: Boolean(row.driver_is_active),
    },
    route: {
      id: row.route_id,
      route_code: row.route_code,
      name: row.route_name,
      description: row.route_description,
      estimated_duration_minutes: row.estimated_duration_minutes ? Number(row.estimated_duration_minutes) : null,
      is_active: Boolean(row.route_is_active),
      stop_count: stops.length,
    },
    stops,
  });
});

/**
 * Helper to check schedule overlaps for bus and driver
 */
async function checkScheduleConflicts({
  busId,
  driverId,
  tripDate,
  scheduledStartAt,
  durationMinutes,
  excludeTripId = null,
}) {
  const duration = durationMinutes && durationMinutes > 0 ? durationMinutes : 60;
  const startStr = formatDateTime(scheduledStartAt);

  // Active statuses that occupy bus/driver
  const activeStatuses = ['SCHEDULED', 'STARTED', 'IN_PROGRESS'];
  const placeholders = activeStatuses.map(() => '?').join(', ');

  // 1. Check Bus Conflict
  let busQuery = `
    SELECT 
      t.id, 
      t.scheduled_start_at, 
      r.estimated_duration_minutes,
      r.name AS route_name,
      b.bus_number
    FROM trips t
    JOIN routes r ON r.id = t.route_id
    JOIN buses b ON b.id = t.bus_id
    WHERE t.bus_id = ?
      AND t.trip_date = ?
      AND t.status IN (${placeholders})
      AND t.scheduled_start_at < DATE_ADD(?, INTERVAL ? MINUTE)
      AND DATE_ADD(t.scheduled_start_at, INTERVAL COALESCE(r.estimated_duration_minutes, 60) MINUTE) > ?
  `;
  const busParams = [busId, tripDate, ...activeStatuses, startStr, duration, startStr];
  if (excludeTripId) {
    busQuery += ' AND t.id != ?';
    busParams.push(excludeTripId);
  }

  const [busConflicts] = await pool.execute(busQuery, busParams);
  if (busConflicts.length > 0) {
    const c = busConflicts[0];
    throw new ApiError(
      409,
      `Schedule conflict: Bus "${c.bus_number}" is already scheduled for trip #${c.id} (${c.route_name}) during this time window.`
    );
  }

  // 2. Check Driver Conflict
  let driverQuery = `
    SELECT 
      t.id, 
      t.scheduled_start_at, 
      r.estimated_duration_minutes,
      r.name AS route_name,
      u.full_name AS driver_name
    FROM trips t
    JOIN routes r ON r.id = t.route_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    WHERE t.driver_id = ?
      AND t.trip_date = ?
      AND t.status IN (${placeholders})
      AND t.scheduled_start_at < DATE_ADD(?, INTERVAL ? MINUTE)
      AND DATE_ADD(t.scheduled_start_at, INTERVAL COALESCE(r.estimated_duration_minutes, 60) MINUTE) > ?
  `;
  const driverParams = [driverId, tripDate, ...activeStatuses, startStr, duration, startStr];
  if (excludeTripId) {
    driverQuery += ' AND t.id != ?';
    driverParams.push(excludeTripId);
  }

  const [driverConflicts] = await pool.execute(driverQuery, driverParams);
  if (driverConflicts.length > 0) {
    const c = driverConflicts[0];
    throw new ApiError(
      409,
      `Schedule conflict: Driver "${c.driver_name}" is already assigned to trip #${c.id} (${c.route_name}) during this time window.`
    );
  }
}

// POST /api/admin/trips
export const createTrip = asyncHandler(async (req, res) => {
  const {
    bus_id,
    route_id,
    driver_id,
    trip_date,
    direction,
    scheduled_start_at,
    notes = null,
  } = req.body;

  // 1. Validate required fields
  if (!bus_id) throw new ApiError(400, 'Bus ID is required.');
  if (!route_id) throw new ApiError(400, 'Route ID is required.');
  if (!driver_id) throw new ApiError(400, 'Driver ID is required.');
  if (!trip_date) throw new ApiError(400, 'Trip date is required.');
  if (!direction) throw new ApiError(400, 'Direction is required.');
  if (!scheduled_start_at) throw new ApiError(400, 'Scheduled start time is required.');

  const parsedBusId = parseInt(bus_id, 10);
  const parsedRouteId = parseInt(route_id, 10);
  const parsedDriverId = parseInt(driver_id, 10);

  if (isNaN(parsedBusId) || parsedBusId <= 0) throw new ApiError(400, 'Invalid bus ID.');
  if (isNaN(parsedRouteId) || parsedRouteId <= 0) throw new ApiError(400, 'Invalid route ID.');
  if (isNaN(parsedDriverId) || parsedDriverId <= 0) throw new ApiError(400, 'Invalid driver ID.');

  // 2. Validate direction
  const upperDirection = String(direction).trim().toUpperCase();
  if (!VALID_DIRECTIONS.includes(upperDirection)) {
    throw new ApiError(400, 'Invalid direction. Allowed values are PICKUP or DROPOFF.');
  }

  // 3. Validate trip_date & scheduled_start_at
  const parsedTripDate = formatDate(trip_date);
  if (!parsedTripDate) throw new ApiError(400, 'Invalid trip date format. Expected YYYY-MM-DD.');

  const parsedScheduledStart = formatDateTime(scheduled_start_at);
  if (!parsedScheduledStart) throw new ApiError(400, 'Invalid scheduled start datetime format.');

  // Verify scheduled_start_at matches trip_date
  if (!parsedScheduledStart.startsWith(parsedTripDate)) {
    throw new ApiError(400, `Scheduled start date (${parsedScheduledStart.split(' ')[0]}) must match trip date (${parsedTripDate}).`);
  }

  // 4. Validate Bus
  const [busRows] = await pool.execute(
    'SELECT id, bus_number, registration_number, capacity, assigned_driver_id, is_active FROM buses WHERE id = ?',
    [parsedBusId]
  );
  const bus = busRows[0];
  if (!bus) throw new ApiError(404, 'Selected bus not found.');
  if (!bus.is_active) throw new ApiError(400, `Bus "${bus.bus_number}" is inactive and cannot be used for new trips.`);
  if (!bus.assigned_driver_id) {
    throw new ApiError(400, `Bus "${bus.bus_number}" has no assigned driver. Please assign a driver to this bus before scheduling trips.`);
  }

  // 5. Bus <-> Driver Consistency
  if (Number(bus.assigned_driver_id) !== parsedDriverId) {
    throw new ApiError(
      409,
      `Driver mismatch: Selected driver does not match the driver assigned to bus "${bus.bus_number}".`
    );
  }

  // 6. Validate Driver
  const [driverRows] = await pool.execute(
    `SELECT d.id, d.employee_code, d.license_number, d.license_expiry, u.full_name, u.is_active, u.role
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     WHERE d.id = ?`,
    [parsedDriverId]
  );
  const driver = driverRows[0];
  if (!driver) throw new ApiError(404, 'Selected driver not found.');
  if (driver.role !== 'DRIVER') throw new ApiError(400, 'User is not a valid driver.');
  if (!driver.is_active) throw new ApiError(400, `Driver "${driver.full_name}" is inactive.`);

  const formattedLicenseExpiry = formatDate(driver.license_expiry);
  if (formattedLicenseExpiry && formattedLicenseExpiry < parsedTripDate) {
    throw new ApiError(
      400,
      `Driver "${driver.full_name}" has an expired license (${formattedLicenseExpiry}) for trip date (${parsedTripDate}).`
    );
  }

  // 7. Validate Route
  const [routeRows] = await pool.execute(
    'SELECT id, route_code, name, estimated_duration_minutes, is_active FROM routes WHERE id = ?',
    [parsedRouteId]
  );
  const route = routeRows[0];
  if (!route) throw new ApiError(404, 'Selected route not found.');
  if (!route.is_active) throw new ApiError(400, `Route "${route.name}" is inactive and cannot be used for trips.`);

  // Route must have at least 1 stop
  const [stopRows] = await pool.execute(
    'SELECT id, name, latitude, longitude FROM stops WHERE route_id = ?',
    [parsedRouteId]
  );
  if (stopRows.length === 0) {
    throw new ApiError(
      400,
      `Route "${route.name}" has no stops. Add at least one stop before creating a trip.`
    );
  }

  // Ensure stops are GPS-ready with coordinates
  const missingCoords = stopRows.filter((s) => s.latitude === null || s.longitude === null);
  if (missingCoords.length > 0) {
    throw new ApiError(
      400,
      `Route "${route.name}" has ${missingCoords.length} stop(s) missing GPS coordinates (e.g. "${missingCoords[0].name}"). Please configure latitude/longitude for all stops before scheduling trips.`
    );
  }

  // 8. Trip Schedule Conflict Detection
  await checkScheduleConflicts({
    busId: parsedBusId,
    driverId: parsedDriverId,
    tripDate: parsedTripDate,
    scheduledStartAt: parsedScheduledStart,
    durationMinutes: route.estimated_duration_minutes,
  });

  // 9. Insert Trip (Default status: SCHEDULED)
  const [result] = await pool.execute(
    `INSERT INTO trips (
      bus_id, route_id, driver_id, trip_date, direction, scheduled_start_at, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
    [
      parsedBusId,
      parsedRouteId,
      parsedDriverId,
      parsedTripDate,
      upperDirection,
      parsedScheduledStart,
      notes ? String(notes).trim() : null,
    ]
  );

  const tripId = result.insertId;

  // Query created trip
  const [createdRows] = await pool.execute(
    `SELECT 
      t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
      t.scheduled_start_at, t.started_at, t.completed_at, t.status, t.notes, t.created_at,
      b.bus_number, b.registration_number,
      r.route_code, r.name AS route_name,
      u.full_name AS driver_name, d.employee_code AS driver_employee_code
    FROM trips t
    JOIN buses b ON b.id = t.bus_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    JOIN routes r ON r.id = t.route_id
    WHERE t.id = ?`,
    [tripId]
  );

  res.status(201).json({
    message: 'Trip scheduled successfully.',
    trip: {
      ...createdRows[0],
      trip_date: formatDate(createdRows[0].trip_date),
    },
  });
});

// PUT /api/admin/trips/:id
export const updateTrip = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) throw new ApiError(400, 'Invalid trip ID.');

  const [existingRows] = await pool.execute(
    'SELECT * FROM trips WHERE id = ?',
    [tripId]
  );
  const currentTrip = existingRows[0];
  if (!currentTrip) throw new ApiError(404, 'Trip not found.');

  const {
    bus_id,
    route_id,
    driver_id,
    trip_date,
    direction,
    scheduled_start_at,
    notes,
    status,
  } = req.body;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let targetBusId = currentTrip.bus_id;
    let targetRouteId = currentTrip.route_id;
    let targetDriverId = currentTrip.driver_id;
    let targetTripDate = formatDate(currentTrip.trip_date);
    let targetDirection = currentTrip.direction;
    let targetScheduledStart = formatDateTime(currentTrip.scheduled_start_at);
    let targetNotes = currentTrip.notes;
    let targetStatus = currentTrip.status;
    let startedAt = currentTrip.started_at ? formatDateTime(currentTrip.started_at) : null;
    let completedAt = currentTrip.completed_at ? formatDateTime(currentTrip.completed_at) : null;

    // 1. Status Transition Validation
    if (status !== undefined && status !== null) {
      const upperStatus = String(status).trim().toUpperCase();
      if (!VALID_STATUSES.includes(upperStatus)) {
        throw new ApiError(400, `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}`);
      }

      if (!isValidStatusTransition(currentTrip.status, upperStatus)) {
        throw new ApiError(
          409,
          `Invalid status transition: Cannot transition trip from "${currentTrip.status}" to "${upperStatus}".`
        );
      }

      targetStatus = upperStatus;

      // Automatic timestamp management
      const nowStr = formatDateTime(new Date());
      if (upperStatus === 'STARTED' && !startedAt) {
        startedAt = nowStr;
      } else if (upperStatus === 'COMPLETED') {
        if (!startedAt) startedAt = nowStr;
        if (!completedAt) completedAt = nowStr;
      }
    }

    // 2. Validate Direction if provided
    if (direction !== undefined && direction !== null) {
      const upperDir = String(direction).trim().toUpperCase();
      if (!VALID_DIRECTIONS.includes(upperDir)) {
        throw new ApiError(400, 'Invalid direction. Allowed values: PICKUP or DROPOFF.');
      }
      targetDirection = upperDir;
    }

    // 3. Validate Date & Scheduled Start if provided
    let schedulingChanged = false;

    if (trip_date !== undefined && trip_date !== null) {
      const formatted = formatDate(trip_date);
      if (!formatted) throw new ApiError(400, 'Invalid trip date format (YYYY-MM-DD).');
      if (formatted !== targetTripDate) {
        targetTripDate = formatted;
        schedulingChanged = true;
      }
    }

    if (scheduled_start_at !== undefined && scheduled_start_at !== null) {
      const formattedStart = formatDateTime(scheduled_start_at);
      if (!formattedStart) throw new ApiError(400, 'Invalid scheduled start datetime format.');
      if (formattedStart !== targetScheduledStart) {
        targetScheduledStart = formattedStart;
        schedulingChanged = true;
      }
    }

    if (trip_date !== undefined || scheduled_start_at !== undefined) {
      if (!targetScheduledStart.startsWith(targetTripDate)) {
        throw new ApiError(400, `Scheduled start date (${targetScheduledStart.split(' ')[0]}) must match trip date (${targetTripDate}).`);
      }
    }

    if (notes !== undefined) {
      targetNotes = notes ? String(notes).trim() : null;
    }

    // 4. Re-validate Bus, Driver, Route if changed
    if (bus_id !== undefined && Number(bus_id) !== targetBusId) {
      targetBusId = parseInt(bus_id, 10);
      schedulingChanged = true;
    }
    if (route_id !== undefined && Number(route_id) !== targetRouteId) {
      targetRouteId = parseInt(route_id, 10);
      schedulingChanged = true;
    }
    if (driver_id !== undefined && Number(driver_id) !== targetDriverId) {
      targetDriverId = parseInt(driver_id, 10);
      schedulingChanged = true;
    }

    // Fetch Route details
    const [routeRows] = await connection.execute(
      'SELECT id, route_code, name, estimated_duration_minutes, is_active FROM routes WHERE id = ?',
      [targetRouteId]
    );
    const route = routeRows[0];
    if (!route) throw new ApiError(404, 'Selected route not found.');
    if (!route.is_active) throw new ApiError(400, `Route "${route.name}" is inactive.`);

    // If bus/driver/route changed: validate bus and driver
    if (schedulingChanged) {
      const [busRows] = await connection.execute(
        'SELECT id, bus_number, registration_number, capacity, assigned_driver_id, is_active FROM buses WHERE id = ?',
        [targetBusId]
      );
      const bus = busRows[0];
      if (!bus) throw new ApiError(404, 'Selected bus not found.');
      if (!bus.is_active) throw new ApiError(400, `Bus "${bus.bus_number}" is inactive.`);
      if (!bus.assigned_driver_id) {
        throw new ApiError(400, `Bus "${bus.bus_number}" has no assigned driver.`);
      }

      // Bus <-> Driver Consistency
      if (Number(bus.assigned_driver_id) !== targetDriverId) {
        throw new ApiError(
          409,
          `Driver mismatch: Selected driver does not match the driver assigned to bus "${bus.bus_number}".`
        );
      }

      // Validate Driver
      const [driverRows] = await connection.execute(
        `SELECT d.id, d.employee_code, d.license_expiry, u.full_name, u.is_active, u.role
         FROM drivers d
         JOIN users u ON u.id = d.user_id
         WHERE d.id = ?`,
        [targetDriverId]
      );
      const driver = driverRows[0];
      if (!driver) throw new ApiError(404, 'Selected driver not found.');
      if (!driver.is_active) throw new ApiError(400, `Driver "${driver.full_name}" is inactive.`);

      const formattedLicenseExpiry = formatDate(driver.license_expiry);
      if (formattedLicenseExpiry && formattedLicenseExpiry < targetTripDate) {
        throw new ApiError(
          400,
          `Driver "${driver.full_name}" license expired (${formattedLicenseExpiry}) for trip date (${targetTripDate}).`
        );
      }

      // Check route has stops and all have GPS coordinates
      const [updateStopRows] = await connection.execute(
        'SELECT id, name, latitude, longitude FROM stops WHERE route_id = ?',
        [targetRouteId]
      );
      if (updateStopRows.length === 0) {
        throw new ApiError(400, `Route "${route.name}" has no stops. Add at least one stop before creating or updating a trip.`);
      }
      const missingUpdateCoords = updateStopRows.filter((s) => s.latitude === null || s.longitude === null);
      if (missingUpdateCoords.length > 0) {
        throw new ApiError(
          400,
          `Route "${route.name}" has ${missingUpdateCoords.length} stop(s) missing GPS coordinates (e.g. "${missingUpdateCoords[0].name}"). Please configure latitude/longitude for all stops.`
        );
      }

      // 5. Schedule Conflict Check (only if status is active, excluding current trip)
      if (['SCHEDULED', 'STARTED', 'IN_PROGRESS'].includes(targetStatus)) {
        await checkScheduleConflicts({
          busId: targetBusId,
          driverId: targetDriverId,
          tripDate: targetTripDate,
          scheduledStartAt: targetScheduledStart,
          durationMinutes: route.estimated_duration_minutes,
          excludeTripId: tripId,
        });
      }
    }

    // 6. Execute Update
    await connection.execute(
      `UPDATE trips
       SET bus_id = ?,
           route_id = ?,
           driver_id = ?,
           trip_date = ?,
           direction = ?,
           scheduled_start_at = ?,
           started_at = ?,
           completed_at = ?,
           status = ?,
           notes = ?
       WHERE id = ?`,
      [
        targetBusId,
        targetRouteId,
        targetDriverId,
        targetTripDate,
        targetDirection,
        targetScheduledStart,
        startedAt,
        completedAt,
        targetStatus,
        targetNotes,
        tripId,
      ]
    );

    await connection.commit();

    // Query updated trip
    const [updatedRows] = await pool.execute(
      `SELECT 
        t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
        t.scheduled_start_at, t.started_at, t.completed_at, t.status, t.notes, t.created_at,
        b.bus_number, b.registration_number,
        r.route_code, r.name AS route_name,
        u.full_name AS driver_name, d.employee_code AS driver_employee_code
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      JOIN routes r ON r.id = t.route_id
      WHERE t.id = ?`,
      [tripId]
    );

    res.json({
      message: 'Trip updated successfully.',
      trip: {
        ...updatedRows[0],
        trip_date: formatDate(updatedRows[0].trip_date),
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

// DELETE /api/admin/trips/:id
export const deleteTrip = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) throw new ApiError(400, 'Invalid trip ID.');

  const [tripRows] = await pool.execute(
    'SELECT id, status, scheduled_start_at FROM trips WHERE id = ?',
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  // 1. Only SCHEDULED or CANCELLED trips may be deleted
  if (!['SCHEDULED', 'CANCELLED'].includes(trip.status)) {
    throw new ApiError(
      409,
      `Cannot delete trip: Only SCHEDULED or CANCELLED trips can be deleted. Operational trip with status "${trip.status}" must be preserved.`
    );
  }

  // 2. Check if student_transport_status records exist
  const [[{ transportCount }]] = await pool.execute(
    'SELECT COUNT(*) AS transportCount FROM student_transport_status WHERE trip_id = ?',
    [tripId]
  );
  if (Number(transportCount) > 0) {
    throw new ApiError(
      409,
      'Cannot delete trip: Recorded student transport history exists for this trip.'
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM trips WHERE id = ?', [tripId]);

    await connection.commit();

    res.json({
      message: 'Trip deleted successfully.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

/**
 * POST /api/admin/trips/:id/close-stale - Close a stale or abandoned trip
 */
export const closeStaleTrip = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) throw new ApiError(400, 'Invalid trip ID.');

  const [tripRows] = await pool.execute(
    `SELECT t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
            t.scheduled_start_at, t.started_at, t.completed_at, t.status,
            b.bus_number, r.name AS route_name
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    return res.json({
      message: `Trip #${tripId} is already ${trip.status}. No action needed.`,
      trip,
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE trips 
       SET status = 'COMPLETED',
           completed_at = COALESCE(completed_at, NOW())
       WHERE id = ?`,
      [tripId]
    );

    // Auto update any dangling student transport statuses
    await connection.execute(
      `UPDATE student_transport_status
       SET status = 'DROPPED_OFF',
           notes = CONCAT(COALESCE(notes, ''), ' [Closed by admin stale trip resolution]'),
           recorded_at = NOW()
       WHERE trip_id = ? AND status IN ('WAITING', 'BOARDED', 'ON_BUS')`,
      [tripId]
    );

    await connection.commit();

    const [updatedRows] = await pool.execute(
      `SELECT t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
              t.scheduled_start_at, t.started_at, t.completed_at, t.status,
              b.bus_number, r.name AS route_name
       FROM trips t
       JOIN buses b ON b.id = t.bus_id
       JOIN routes r ON r.id = t.route_id
       WHERE t.id = ?`,
      [tripId]
    );

    res.json({
      message: `Trip #${tripId} has been successfully closed as COMPLETED by admin.`,
      trip: updatedRows[0],
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

