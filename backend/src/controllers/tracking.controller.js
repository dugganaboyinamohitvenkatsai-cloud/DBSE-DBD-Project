import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';
import { evaluateStopArrivals } from '../services/stop-detection.service.js';
import { notifyStopReached } from '../services/notification.service.js';
import { getRoadRouteGeometry } from '../services/routing.service.js';

const STALE_THRESHOLD_SECONDS = 60; // 60 seconds threshold for stale GPS

/**
 * Helper to validate latitude
 */
function isValidLatitude(lat) {
  if (lat === null || lat === undefined || lat === '') return false;
  const num = Number(lat);
  return !isNaN(num) && num >= -90 && num <= 90;
}

/**
 * Helper to validate longitude
 */
function isValidLongitude(lng) {
  if (lng === null || lng === undefined || lng === '') return false;
  const num = Number(lng);
  return !isNaN(num) && num >= -180 && num <= 180;
}

/**
 * Helper to format datetime as YYYY-MM-DD HH:MM:SS in UTC
 */
function formatDateTimeUTC(dateObj = new Date()) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * Resolve driver profile from authenticated user.
 */
async function getDriverFromUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT d.id, d.user_id, d.employee_code, u.full_name, u.is_active
     FROM drivers d
     JOIN users u ON u.id = d.user_id
     WHERE d.user_id = ?`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Check whether an active trip is stale (e.g. past trip date or started > 20h ago).
 */
export function isTripStale(trip) {
  if (!trip) return false;
  if (!['STARTED', 'IN_PROGRESS', 'SCHEDULED'].includes(trip.status)) {
    return false;
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  let tripDateStr = null;
  if (trip.trip_date) {
    tripDateStr = typeof trip.trip_date === 'string'
      ? trip.trip_date.slice(0, 10)
      : new Date(trip.trip_date).toISOString().slice(0, 10);
  }

  // Trip scheduled for a past date is stale
  if (tripDateStr && tripDateStr < todayStr) {
    return true;
  }

  // Trip started more than 20 hours ago is stale
  if (trip.started_at) {
    const startedMs = new Date(trip.started_at).getTime();
    if (Date.now() - startedMs > 20 * 3600 * 1000) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the currently active trackable trip for a driver.
 * Excludes stale historical trips by default to prevent accidental GPS attachment.
 */
async function getActiveTripForDriver(driverId, includeStale = false) {
  const [rows] = await pool.execute(
    `SELECT 
       t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
       t.scheduled_start_at, t.started_at, t.completed_at, t.status,
       b.bus_number, b.registration_number, b.is_active AS bus_is_active,
       r.route_code, r.name AS route_name, r.estimated_duration_minutes, r.is_active AS route_is_active
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.driver_id = ? AND t.status IN ('STARTED', 'IN_PROGRESS')
     ORDER BY t.scheduled_start_at DESC, t.id DESC
     LIMIT 1`,
    [driverId]
  );
  const trip = rows[0] || null;
  if (!trip) return null;

  if (!includeStale && isTripStale(trip)) {
    return null;
  }

  return trip;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /api/driver/location - Ingest Driver GPS Location
// ─────────────────────────────────────────────────────────────────────────────
export const updateDriverLocation = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const userRole = req.auth?.role;

  if (!userId) {
    throw new ApiError(401, 'Authentication is required.');
  }

  // 1. Authorize: Only DRIVER or ADMIN can send location updates
  if (userRole !== 'DRIVER' && userRole !== 'ADMIN') {
    throw new ApiError(403, 'Only drivers are authorized to send live GPS coordinates.');
  }

  // 2. Resolve Driver
  let driver = await getDriverFromUserId(userId);

  // If ADMIN is testing/acting as a driver, resolve the active trip's driver or first driver
  if (!driver && userRole === 'ADMIN') {
    const [adminDrivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.employee_code, u.full_name, u.is_active
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       LIMIT 1`
    );
    driver = adminDrivers[0] || null;
  }

  if (!driver) {
    throw new ApiError(404, 'Driver profile not found.');
  }

  if (!driver.is_active) {
    throw new ApiError(403, 'Driver account is inactive.');
  }

  const { latitude, longitude, accuracy, timestamp, trip_id } = req.body || {};

  // 3. Resolve Driver's Active Trip (STARTED or IN_PROGRESS)
  let activeTrip = null;
  if (trip_id) {
    const parsedTripId = parseInt(trip_id, 10);
    const [specificTripRows] = await pool.execute(
      `SELECT 
         t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
         t.scheduled_start_at, t.started_at, t.completed_at, t.status,
         b.bus_number, b.registration_number, b.is_active AS bus_is_active,
         r.route_code, r.name AS route_name, r.estimated_duration_minutes, r.is_active AS route_is_active
       FROM trips t
       JOIN buses b ON b.id = t.bus_id
       JOIN routes r ON r.id = t.route_id
       WHERE t.id = ? AND t.driver_id = ?`,
      [parsedTripId, driver.id]
    );
    const found = specificTripRows[0];
    if (!found) {
      throw new ApiError(404, 'Specified trip not found for this driver.');
    }
    if (!['STARTED', 'IN_PROGRESS'].includes(found.status)) {
      throw new ApiError(409, `Trip #${found.id} has status "${found.status}" and cannot receive live GPS updates. Trips must be STARTED or IN_PROGRESS.`);
    }
    if (isTripStale(found)) {
      const dStr = found.trip_date ? (typeof found.trip_date === 'string' ? found.trip_date.slice(0, 10) : new Date(found.trip_date).toISOString().slice(0, 10)) : 'past';
      throw new ApiError(409, `Cannot submit GPS updates for Trip #${found.id}: trip date (${dStr}) is in the past and the trip is marked stale. Please start today's scheduled trip.`);
    }
    activeTrip = found;
  } else {
    activeTrip = await getActiveTripForDriver(driver.id);
  }

  if (!activeTrip) {
    throw new ApiError(409, 'No active trip found for this driver. Trips must be STARTED or IN_PROGRESS to receive GPS updates.');
  }

  // 4. Validate Bus
  if (!activeTrip.bus_is_active) {
    throw new ApiError(400, `Assigned bus "${activeTrip.bus_number}" is inactive.`);
  }

  // 5. Validate Coordinates Payload

  if (!isValidLatitude(latitude)) {
    throw new ApiError(400, 'Invalid latitude. Must be a numeric value between -90 and 90.');
  }
  if (!isValidLongitude(longitude)) {
    throw new ApiError(400, 'Invalid longitude. Must be a numeric value between -180 and 180.');
  }

  const numLat = Number(latitude);
  const numLng = Number(longitude);
  let numAccuracy = null;
  if (accuracy !== undefined && accuracy !== null && accuracy !== '') {
    numAccuracy = Number(accuracy);
    if (isNaN(numAccuracy) || numAccuracy < 0) {
      throw new ApiError(400, 'Invalid accuracy. Must be a non-negative number in meters.');
    }
  }

  // Recorded timestamp: server-controlled UTC time
  const recordedAtUTC = formatDateTimeUTC(new Date());

  // 6. Persist to existing `bus_locations` table
  await pool.execute(
    `INSERT INTO bus_locations (bus_id, latitude, longitude, recorded_at, source, accuracy_meters)
     VALUES (?, ?, ?, ?, 'DRIVER_APP', ?)`,
    [activeTrip.bus_id, numLat, numLng, recordedAtUTC, numAccuracy]
  );

  // 7. Load Route Stops ordered by stop_order ASC
  const [stops] = await pool.execute(
    `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
     FROM stops
     WHERE route_id = ?
     ORDER BY stop_order ASC`,
    [activeTrip.route_id]
  );

  // 8. Find Already Reached Stops for this Trip from `notifications` table
  // Each reached stop has an in-app STOP_REACHED notification recorded for this trip
  const [reachedRows] = await pool.execute(
    `SELECT DISTINCT title, body
     FROM notifications
     WHERE trip_id = ? AND type = 'STOP_REACHED'`,
    [activeTrip.id]
  );

  const reachedStopIds = new Set();
  for (const stop of stops) {
    const isRecorded = reachedRows.some(
      (r) => r.title.includes(stop.name) || r.body.includes(stop.name)
    );
    if (isRecorded) {
      reachedStopIds.add(stop.id);
    }
  }

  // 9. Evaluate Stop Arrival Detection using Haversine Algorithm
  const evaluation = evaluateStopArrivals({
    latitude: numLat,
    longitude: numLng,
    accuracy: numAccuracy,
    stops,
    reachedStopIds,
  });

  let stopEventTriggered = null;

  // 10. If a new stop arrival is detected, trigger notifications
  if (evaluation.newlyReachedStop) {
    const notifyRes = await notifyStopReached({
      tripId: activeTrip.id,
      trip: activeTrip,
      stop: evaluation.newlyReachedStop,
      isFinalStop: evaluation.isFinalStop,
      reachedAt: recordedAtUTC,
    });

    stopEventTriggered = {
      stop: evaluation.newlyReachedStop,
      is_final_stop: evaluation.isFinalStop,
      notifications_sent: notifyRes.notificationsCount,
      event: notifyRes.eventPayload,
    };
  }

  res.status(200).json({
    message: 'Location recorded successfully.',
    location: {
      bus_id: activeTrip.bus_id,
      trip_id: activeTrip.id,
      latitude: numLat,
      longitude: numLng,
      accuracy: numAccuracy,
      recorded_at: recordedAtUTC,
    },
    trip: {
      id: activeTrip.id,
      bus_number: activeTrip.bus_number,
      route_name: activeTrip.route_name,
      status: activeTrip.status,
    },
    stop_event: stopEventTriggered,
    progression: evaluation.stopProgression,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/driver/active-trip - Get Driver's Active Trip & Route Stops
// ─────────────────────────────────────────────────────────────────────────────
export const getDriverActiveTrip = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const userRole = req.auth?.role;

  let driver = await getDriverFromUserId(userId);
  if (!driver && userRole === 'ADMIN') {
    const [adminDrivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.employee_code, u.full_name, u.is_active
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       LIMIT 1`
    );
    driver = adminDrivers[0] || null;
  }

  if (!driver) {
    throw new ApiError(404, 'Driver profile not found.');
  }

  const activeTrip = await getActiveTripForDriver(driver.id);
  if (!activeTrip) {
    // Check if there is an abandoned/stale trip for this driver
    const staleTripCandidate = await getActiveTripForDriver(driver.id, true);
    const staleTrip = (staleTripCandidate && isTripStale(staleTripCandidate))
      ? {
          id: staleTripCandidate.id,
          trip_date: staleTripCandidate.trip_date,
          status: staleTripCandidate.status,
          bus_number: staleTripCandidate.bus_number,
          route_name: staleTripCandidate.route_name,
        }
      : null;

    // Check if there is an upcoming SCHEDULED trip for this driver
    const [scheduledRows] = await pool.execute(
      `SELECT 
         t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
         t.scheduled_start_at, t.started_at, t.completed_at, t.status,
         b.bus_number, b.registration_number, b.is_active AS bus_is_active,
         r.route_code, r.name AS route_name, r.estimated_duration_minutes, r.is_active AS route_is_active
       FROM trips t
       JOIN buses b ON b.id = t.bus_id
       JOIN routes r ON r.id = t.route_id
       WHERE t.driver_id = ? AND t.status = 'SCHEDULED' AND (t.trip_date >= CURDATE() OR t.trip_date IS NULL)
       ORDER BY t.scheduled_start_at ASC, t.id ASC
       LIMIT 1`,
      [driver.id]
    );
    const scheduledTrip = scheduledRows[0] || null;
    let scheduledStops = [];
    if (scheduledTrip) {
      const [sRows] = await pool.execute(
        `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
         FROM stops WHERE route_id = ? ORDER BY stop_order ASC`,
        [scheduledTrip.route_id]
      );
      scheduledStops = sRows;
    }

    return res.json({
      activeTrip: null,
      scheduledTrip: scheduledTrip ? { ...scheduledTrip, stops: scheduledStops } : null,
      staleTrip,
      message: scheduledTrip
        ? 'Upcoming scheduled trip available to start.'
        : staleTrip
        ? `Notice: Trip #${staleTrip.id} is marked stale. Please ask an admin to close it.`
        : 'No active trip in progress.',
    });
  }

  // Fetch stops
  const [stops] = await pool.execute(
    `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
     FROM stops
     WHERE route_id = ?
     ORDER BY stop_order ASC`,
    [activeTrip.route_id]
  );

  // Fetch latest location
  const [latestLoc] = await pool.execute(
    `SELECT latitude, longitude, accuracy_meters AS accuracy, recorded_at
     FROM bus_locations
     WHERE bus_id = ?
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    [activeTrip.bus_id]
  );

  // Fetch reached stops
  const [reachedRows] = await pool.execute(
    `SELECT DISTINCT title, body
     FROM notifications
     WHERE trip_id = ? AND type = 'STOP_REACHED'`,
    [activeTrip.id]
  );

  const reachedStopIds = new Set();
  for (const stop of stops) {
    if (reachedRows.some((r) => r.title.includes(stop.name) || r.body.includes(stop.name))) {
      reachedStopIds.add(stop.id);
    }
  }

  const latest = latestLoc[0] || null;
  const hasDriverGps =
    latest &&
    isValidLatitude(latest.latitude) &&
    isValidLongitude(latest.longitude) &&
    !(Number(latest.latitude) === 0 && Number(latest.longitude) === 0);

  const evaluation = evaluateStopArrivals({
    latitude: hasDriverGps ? Number(latest.latitude) : null,
    longitude: hasDriverGps ? Number(latest.longitude) : null,
    accuracy: hasDriverGps && latest.accuracy !== null ? Number(latest.accuracy) : 0,
    stops,
    reachedStopIds,
  });

  // Also query count of students assigned to this trip
  const [stsRows] = await pool.execute(
    `SELECT COUNT(*) AS student_count FROM student_transport_status WHERE trip_id = ?`,
    [activeTrip.id]
  );

  res.json({
    activeTrip: {
      ...activeTrip,
      latestLocation: hasDriverGps ? latest : null,
      stops: evaluation.stopProgression,
      student_count: Number(stsRows[0]?.student_count || 0),
    },
    scheduledTrip: null,
    staleTrip: null,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2b. GET /api/driver/trips - List All Trips Assigned to Driver
// ─────────────────────────────────────────────────────────────────────────────
export const listDriverTrips = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const userRole = req.auth?.role;

  let driver = await getDriverFromUserId(userId);
  if (!driver && userRole === 'ADMIN') {
    const [adminDrivers] = await pool.execute(
      `SELECT d.id, d.user_id, d.employee_code, u.full_name, u.is_active
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       LIMIT 1`
    );
    driver = adminDrivers[0] || null;
  }

  if (!driver) throw new ApiError(404, 'Driver profile not found.');

  const [trips] = await pool.execute(
    `SELECT 
       t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
       t.scheduled_start_at, t.started_at, t.completed_at, t.status, t.notes,
       b.bus_number, b.registration_number,
       r.route_code, r.name AS route_name, r.estimated_duration_minutes,
       (SELECT COUNT(*) FROM stops s WHERE s.route_id = r.id) AS stop_count,
       (SELECT COUNT(*) FROM student_transport_status sts WHERE sts.trip_id = t.id) AS student_count
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.driver_id = ?
     ORDER BY t.trip_date DESC, t.scheduled_start_at DESC, t.id DESC`,
    [driver.id]
  );

  res.json({
    trips: trips.map((t) => ({
      ...t,
      is_stale: isTripStale(t),
      stop_count: Number(t.stop_count || 0),
      student_count: Number(t.student_count || 0),
      estimated_duration_minutes: t.estimated_duration_minutes ? Number(t.estimated_duration_minutes) : null,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2c. POST /api/driver/trips/:id/start - Start Trip (Driver or Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const startDriverTrip = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const userRole = req.auth?.role;
  const tripId = parseInt(req.params.id, 10);

  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  let driver = await getDriverFromUserId(userId);
  if (!driver && userRole === 'ADMIN') {
    const [tripRows] = await pool.execute('SELECT driver_id FROM trips WHERE id = ?', [tripId]);
    if (tripRows[0]) {
      const [d] = await pool.execute('SELECT id, user_id FROM drivers WHERE id = ?', [tripRows[0].driver_id]);
      driver = d[0] || null;
    }
  }

  if (!driver) throw new ApiError(404, 'Driver profile not found.');

  const [existingTrips] = await pool.execute(
    `SELECT t.id, t.driver_id, t.bus_id, t.route_id, t.trip_date, t.status, t.started_at, b.bus_number, r.name AS route_name
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = existingTrips[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  if (userRole !== 'ADMIN' && trip.driver_id !== driver.id) {
    throw new ApiError(403, 'You are only authorized to start trips assigned to you.');
  }

  if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
    throw new ApiError(409, `Cannot start trip #${tripId} because it is already ${trip.status}.`);
  }

  // Prevent starting past-date trips
  const todayStr = new Date().toISOString().slice(0, 10);
  const tripDateStr = trip.trip_date
    ? (typeof trip.trip_date === 'string' ? trip.trip_date.slice(0, 10) : new Date(trip.trip_date).toISOString().slice(0, 10))
    : null;
  if (tripDateStr && tripDateStr < todayStr) {
    throw new ApiError(
      400,
      `Cannot start Trip #${tripId} because its scheduled trip date (${tripDateStr}) is in the past. Please schedule a trip for today or the future.`
    );
  }

  if (trip.status === 'IN_PROGRESS') {
    return res.json({
      message: 'Trip is already in progress.',
      trip,
    });
  }

  // Check if driver has any other non-stale trip currently IN_PROGRESS
  const [otherActiveRows] = await pool.execute(
    `SELECT id, trip_date, started_at, status FROM trips WHERE driver_id = ? AND status = 'IN_PROGRESS' AND id != ?`,
    [driver.id, tripId]
  );
  const activeNonStale = otherActiveRows.filter((t) => !isTripStale(t));
  if (activeNonStale.length > 0) {
    throw new ApiError(
      409,
      `You already have Trip #${activeNonStale[0].id} in progress today. Please complete or end that trip before starting another.`
    );
  }

  // Transition to IN_PROGRESS
  await pool.execute(
    `UPDATE trips 
     SET status = 'IN_PROGRESS', 
         started_at = COALESCE(started_at, NOW())
     WHERE id = ?`,
    [tripId]
  );

  const [updated] = await pool.execute(
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
    message: `Trip #${tripId} started successfully.`,
    trip: updated[0],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2d. POST /api/driver/trips/:id/complete - Complete Trip (Driver or Admin)
// ─────────────────────────────────────────────────────────────────────────────
export const completeDriverTrip = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const userRole = req.auth?.role;
  const tripId = parseInt(req.params.id, 10);

  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  let driver = await getDriverFromUserId(userId);
  if (!driver && userRole === 'ADMIN') {
    const [tripRows] = await pool.execute('SELECT driver_id FROM trips WHERE id = ?', [tripId]);
    if (tripRows[0]) {
      const [d] = await pool.execute('SELECT id, user_id FROM drivers WHERE id = ?', [tripRows[0].driver_id]);
      driver = d[0] || null;
    }
  }

  if (!driver) throw new ApiError(404, 'Driver profile not found.');

  const [existingTrips] = await pool.execute(
    `SELECT t.id, t.driver_id, t.bus_id, t.route_id, t.status, t.started_at, b.bus_number, r.name AS route_name
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = existingTrips[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  if (userRole !== 'ADMIN' && trip.driver_id !== driver.id) {
    throw new ApiError(403, 'You are only authorized to complete trips assigned to you.');
  }

  if (trip.status === 'COMPLETED') {
    return res.json({
      message: 'Trip is already completed.',
      trip,
    });
  }

  if (!['STARTED', 'IN_PROGRESS'].includes(trip.status)) {
    throw new ApiError(
      409,
      `Cannot complete trip #${tripId} with status "${trip.status}". Trip must be STARTED or IN_PROGRESS.`
    );
  }

  // Complete the trip
  await pool.execute(
    `UPDATE trips 
     SET status = 'COMPLETED', 
         completed_at = NOW()
     WHERE id = ?`,
    [tripId]
  );

  // Auto drop off any students still on bus or waiting
  await pool.execute(
    `UPDATE student_transport_status
     SET status = 'DROPPED_OFF', recorded_at = NOW()
     WHERE trip_id = ? AND status IN ('WAITING', 'BOARDED', 'ON_BUS')`,
    [tripId]
  );

  const [updated] = await pool.execute(
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
    message: `Trip #${tripId} marked as completed.`,
    trip: updated[0],
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2e. GET /api/driver/trips/:id/students - Get Students Enrolled on Trip
// ─────────────────────────────────────────────────────────────────────────────
export const getDriverTripStudents = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const [students] = await pool.execute(
    `SELECT 
       s.student_id,
       s.name AS student_name,
       s.class AS student_class,
       s.parent_phone,
       sts.status AS transport_status,
       sts.notes AS transport_notes,
       sts.recorded_at AS transport_recorded_at,
       sts.pickup_stop_id,
       sts.dropoff_stop_id,
       p_stop.name AS pickup_stop_name,
       p_stop.stop_order AS pickup_stop_order,
       p_stop.scheduled_time AS pickup_stop_time,
       d_stop.name AS dropoff_stop_name,
       d_stop.stop_order AS dropoff_stop_order,
       d_stop.scheduled_time AS dropoff_stop_time,
       sa.seat_number,
       (SELECT u.full_name FROM parent_students ps 
        JOIN parents p ON p.parent_id = ps.parent_id 
        JOIN users u ON u.id = p.user_id 
        WHERE ps.student_id = s.student_id AND ps.is_primary_contact = TRUE LIMIT 1) AS primary_parent_name,
       (SELECT p.phone FROM parent_students ps 
        JOIN parents p ON p.parent_id = ps.parent_id 
        WHERE ps.student_id = s.student_id AND ps.is_primary_contact = TRUE LIMIT 1) AS primary_parent_phone
     FROM student_transport_status sts
     JOIN students s ON s.student_id = sts.student_id
     LEFT JOIN seat_assignments sa ON sa.trip_id = sts.trip_id AND sa.student_id = s.student_id
     LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
     LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
     WHERE sts.trip_id = ?
     ORDER BY s.name ASC`,
    [tripId]
  );

  res.json({
    trip_id: tripId,
    students,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2f. POST /api/admin/trips/:id/close-stale - Admin Closes Abandoned Stale Trip
// ─────────────────────────────────────────────────────────────────────────────
export const closeStaleTrip = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const [tripRows] = await pool.execute(
    `SELECT t.id, t.bus_id, t.status, t.trip_date, b.bus_number
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  if (!['STARTED', 'IN_PROGRESS'].includes(trip.status)) {
    throw new ApiError(400, `Trip #${tripId} has status "${trip.status}" and is not an active/stale trip.`);
  }

  await pool.execute(
    `UPDATE trips
     SET status = 'COMPLETED',
         completed_at = NOW(),
         notes = CONCAT(COALESCE(notes, ''), ' [Closed as stale by admin]')
     WHERE id = ?`,
    [tripId]
  );

  await pool.execute(
    `UPDATE student_transport_status
     SET status = 'DROPPED_OFF', recorded_at = NOW(),
         notes = CONCAT(COALESCE(notes, ''), ' [Auto closed with stale trip]')
     WHERE trip_id = ? AND status IN ('WAITING', 'BOARDED', 'ON_BUS')`,
    [tripId]
  );

  res.json({
    success: true,
    message: `Stale Trip #${tripId} closed and marked as completed.`,
    trip_id: tripId,
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /api/trips/:tripId/journey - RedBus-Style Live Journey Payload
// ─────────────────────────────────────────────────────────────────────────────
export const getTripJourney = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  // 1. Fetch Trip details
  const [tripRows] = await pool.execute(
    `SELECT 
       t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
       t.scheduled_start_at, t.started_at, t.completed_at, t.status, t.notes,
       b.bus_number, b.registration_number, b.capacity,
       r.route_code, r.name AS route_name, r.description AS route_description,
       r.estimated_duration_minutes,
       u.full_name AS driver_name, d.employee_code AS driver_employee_code,
       u.phone AS driver_phone
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     JOIN drivers d ON d.id = t.driver_id
     JOIN users u ON u.id = d.user_id
     WHERE t.id = ?`,
    [tripId]
  );

  const trip = tripRows[0];
  if (!trip) {
    throw new ApiError(404, 'Trip not found.');
  }

  // 2. Fetch Latest Bus Location
  const [locRows] = await pool.execute(
    `SELECT id, latitude, longitude, accuracy_meters AS accuracy, recorded_at, source
     FROM bus_locations
     WHERE bus_id = ?
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    [trip.bus_id]
  );

  const latestLocation = locRows[0] || null;

  // Determine Staleness
  let isStale = false;
  let ageSeconds = null;

  if (latestLocation && latestLocation.recorded_at) {
    const recordedTime = new Date(latestLocation.recorded_at).getTime();
    const nowTime = Date.now();
    ageSeconds = Math.max(0, Math.round((nowTime - recordedTime) / 1000));
    if (ageSeconds > STALE_THRESHOLD_SECONDS) {
      isStale = true;
    }
  }

  // 3. Fetch Ordered Stops
  const [stops] = await pool.execute(
    `SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
     FROM stops
     WHERE route_id = ?
     ORDER BY stop_order ASC`,
    [trip.route_id]
  );

  // 4. Determine Reached Stops from `notifications` table
  const [reachedRows] = await pool.execute(
    `SELECT title, body, sent_at
     FROM notifications
     WHERE trip_id = ? AND type = 'STOP_REACHED'
     ORDER BY id ASC`,
    [trip.id]
  );

  const reachedStopIds = new Set();
  const stopArrivalTimes = {};

  for (const stop of stops) {
    const notif = reachedRows.find(
      (r) => r.title.includes(stop.name) || r.body.includes(stop.name)
    );
    if (notif) {
      reachedStopIds.add(stop.id);
      stopArrivalTimes[stop.id] = notif.sent_at;
    }
  }

  // 5. Evaluate Progression
  const hasValidGps =
    latestLocation &&
    isValidLatitude(latestLocation.latitude) &&
    isValidLongitude(latestLocation.longitude) &&
    !(Number(latestLocation.latitude) === 0 && Number(latestLocation.longitude) === 0);

  const evaluation = evaluateStopArrivals({
    latitude: hasValidGps ? Number(latestLocation.latitude) : null,
    longitude: hasValidGps ? Number(latestLocation.longitude) : null,
    accuracy: hasValidGps && latestLocation.accuracy !== null ? Number(latestLocation.accuracy) : 0,
    stops,
    reachedStopIds,
  });

  // Attach arrival timestamps to progression
  const enrichedProgression = evaluation.stopProgression.map((s) => ({
    ...s,
    reached_at: stopArrivalTimes[s.id] || null,
  }));

  const reachedCount = enrichedProgression.filter((s) => s.isReached).length;
  const remainingCount = enrichedProgression.length - reachedCount;

  // 6. Compute road-following route geometry
  const routeGeometry = await getRoadRouteGeometry(stops);

  res.json({
    trip: {
      ...trip,
      capacity: Number(trip.capacity),
    },
    location: (latestLocation && hasValidGps)
      ? {
          latitude: Number(latestLocation.latitude),
          longitude: Number(latestLocation.longitude),
          accuracy: latestLocation.accuracy !== null ? Number(latestLocation.accuracy) : null,
          recorded_at: latestLocation.recorded_at,
          age_seconds: ageSeconds,
          is_stale: isStale,
        }
      : null,
    journey: {
      total_stops: enrichedProgression.length,
      reached_stops_count: reachedCount,
      remaining_stops_count: remainingCount,
      stops: enrichedProgression,
      route_geometry: routeGeometry,
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /api/admin/trips/:id/location - Admin Location Telemetry Endpoint
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminTripLocation = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const [tripRows] = await pool.execute(
    `SELECT t.id, t.bus_id, t.driver_id, t.status, b.bus_number
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  const [locRows] = await pool.execute(
    `SELECT latitude, longitude, accuracy_meters AS accuracy, recorded_at
     FROM bus_locations
     WHERE bus_id = ?
     ORDER BY recorded_at DESC, id DESC
     LIMIT 1`,
    [trip.bus_id]
  );

  const loc = locRows[0] || null;
  const hasValidLoc =
    loc &&
    isValidLatitude(loc.latitude) &&
    isValidLongitude(loc.longitude) &&
    !(Number(loc.latitude) === 0 && Number(loc.longitude) === 0);

  if (!hasValidLoc) {
    return res.json({
      trip_id: trip.id,
      bus_id: trip.bus_id,
      bus_number: trip.bus_number,
      location: null,
      message: 'Waiting for live GPS signal.',
    });
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - new Date(loc.recorded_at).getTime()) / 1000));
  const isStale = ageSeconds > STALE_THRESHOLD_SECONDS;

  res.json({
    trip_id: trip.id,
    bus_id: trip.bus_id,
    bus_number: trip.bus_number,
    latitude: Number(loc.latitude),
    longitude: Number(loc.longitude),
    accuracy: loc.accuracy !== null ? Number(loc.accuracy) : null,
    recorded_at: loc.recorded_at,
    is_stale: isStale,
    age_seconds: ageSeconds,
  });
});
