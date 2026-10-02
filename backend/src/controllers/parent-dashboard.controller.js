import { pool } from "../config/database.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isTripStale } from "./tracking.controller.js";
import { getRoadRouteGeometry } from "../services/routing.service.js";

const STALE_THRESHOLD_SECONDS = 60;

/**
 * Resolve the parent profile from the authenticated user (JWT sub = users.id).
 * Parents must have a corresponding row in the `parents` table linked via user_id.
 */
async function getParentFromUserId(userId) {
  const [rows] = await pool.execute(
    "SELECT parent_id, name, phone, email, user_id FROM parents WHERE user_id = ?",
    [userId]
  );
  return rows[0] || null;
}

/**
 * Get linked students for a parent.
 * Authoritatively uses the `parent_students` normalized table as the SOLE relationship mechanism.
 */
async function getLinkedStudents(parentId) {
  const [rows] = await pool.execute(`
    SELECT DISTINCT
      s.student_id,
      s.name,
      s.class,
      s.parent_phone,
      ps.relationship_type,
      ps.is_primary_contact,
      (SELECT sa.seat_number FROM seat_assignments sa WHERE sa.student_id = s.student_id ORDER BY sa.id DESC LIMIT 1) AS seat_number
    FROM students s
    JOIN parent_students ps ON ps.student_id = s.student_id
    WHERE ps.parent_id = ?
    ORDER BY s.name ASC
  `, [parentId]);

  return rows;
}

/**
 * Compute transport status for a student.
 * Returns a status string and full context data including student-specific pickup/dropoff stops.
 */
async function computeTransportStatus(student) {
  // 1. First check if student has a specific assigned trip that is active or scheduled
  let trip = null;
  const [studentTripRows] = await pool.execute(`
    SELECT
      t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
      t.scheduled_start_at, t.started_at, t.completed_at, t.status,
      b.bus_number, b.registration_number, b.capacity,
      r.name AS route_name, r.route_code, r.estimated_duration_minutes,
      u.full_name AS driver_name, d.employee_code AS driver_employee_code
    FROM student_transport_status sts
    JOIN trips t ON t.id = sts.trip_id
    JOIN buses b ON b.id = t.bus_id
    JOIN routes r ON r.id = t.route_id
    JOIN drivers d ON d.id = t.driver_id
    JOIN users u ON u.id = d.user_id
    WHERE sts.student_id = ? AND t.status IN ("STARTED", "IN_PROGRESS", "SCHEDULED")
    ORDER BY
      CASE t.status WHEN "IN_PROGRESS" THEN 1 WHEN "STARTED" THEN 2 WHEN "SCHEDULED" THEN 3 END,
      t.scheduled_start_at DESC
    LIMIT 1
  `, [student.student_id]);

  const candidateTrip = studentTripRows[0];
  if (candidateTrip && !isTripStale(candidateTrip)) {
    trip = candidateTrip;
  }

  // Fallback: active trip across the system (excluding stale trips)
  if (!trip) {
    const [activeTrips] = await pool.execute(`
      SELECT
        t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
        t.scheduled_start_at, t.started_at, t.completed_at, t.status,
        b.bus_number, b.registration_number, b.capacity,
        r.name AS route_name, r.route_code, r.estimated_duration_minutes,
        u.full_name AS driver_name, d.employee_code AS driver_employee_code
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      JOIN drivers d ON d.id = t.driver_id
      JOIN users u ON u.id = d.user_id
      WHERE t.status IN ("STARTED", "IN_PROGRESS", "SCHEDULED")
      ORDER BY
        CASE t.status WHEN "IN_PROGRESS" THEN 1 WHEN "STARTED" THEN 2 WHEN "SCHEDULED" THEN 3 END,
        t.scheduled_start_at DESC
      LIMIT 1
    `);
    const systemTrip = activeTrips[0];
    if (systemTrip && !isTripStale(systemTrip)) {
      trip = systemTrip;
    }
  }

  // Query student's transport status record (pickup/dropoff stops, status, notes)
  let studentStatusRow = null;
  if (trip) {
    const [stsRows] = await pool.execute(`
      SELECT 
        sts.status, sts.notes, sts.recorded_at,
        sts.pickup_stop_id, sts.dropoff_stop_id,
        p_stop.name AS pickup_stop_name,
        p_stop.stop_order AS pickup_stop_order,
        p_stop.scheduled_time AS pickup_stop_time,
        d_stop.name AS dropoff_stop_name,
        d_stop.stop_order AS dropoff_stop_order,
        d_stop.scheduled_time AS dropoff_stop_time
      FROM student_transport_status sts
      LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
      LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
      WHERE sts.trip_id = ? AND sts.student_id = ?
    `, [trip.id, student.student_id]);
    studentStatusRow = stsRows[0] || null;
  }
  if (!studentStatusRow && student.student_id) {
    const [recentSts] = await pool.execute(`
      SELECT 
        sts.status, sts.notes, sts.recorded_at,
        sts.pickup_stop_id, sts.dropoff_stop_id,
        p_stop.name AS pickup_stop_name,
        p_stop.stop_order AS pickup_stop_order,
        p_stop.scheduled_time AS pickup_stop_time,
        d_stop.name AS dropoff_stop_name,
        d_stop.stop_order AS dropoff_stop_order,
        d_stop.scheduled_time AS dropoff_stop_time
      FROM student_transport_status sts
      LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
      LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
      WHERE sts.student_id = ?
      ORDER BY sts.recorded_at DESC, sts.id DESC
      LIMIT 1
    `, [student.student_id]);
    studentStatusRow = recentSts[0] || null;
  }

  const pickupStopObj = studentStatusRow?.pickup_stop_id ? {
    id: studentStatusRow.pickup_stop_id,
    name: studentStatusRow.pickup_stop_name,
    stop_order: studentStatusRow.pickup_stop_order,
    scheduled_time: studentStatusRow.pickup_stop_time,
  } : null;

  const dropoffStopObj = studentStatusRow?.dropoff_stop_id ? {
    id: studentStatusRow.dropoff_stop_id,
    name: studentStatusRow.dropoff_stop_name,
    stop_order: studentStatusRow.dropoff_stop_order,
    scheduled_time: studentStatusRow.dropoff_stop_time,
  } : null;

  // Query student's seat assignment for this trip or recent assignment
  let seatNumber = null;
  if (trip && student.student_id) {
    const [seatRows] = await pool.execute(
      `SELECT seat_number FROM seat_assignments WHERE trip_id = ? AND student_id = ? LIMIT 1`,
      [trip.id, student.student_id]
    );
    if (seatRows.length > 0) {
      seatNumber = seatRows[0].seat_number;
    }
  }
  if (!seatNumber && student.student_id) {
    const [recentSeatRows] = await pool.execute(
      `SELECT seat_number FROM seat_assignments WHERE student_id = ? ORDER BY id DESC LIMIT 1`,
      [student.student_id]
    );
    if (recentSeatRows.length > 0) {
      seatNumber = recentSeatRows[0].seat_number;
    }
  }

  if (!trip) {
    // Check if there is a recent completed trip today
    const today = new Date().toISOString().split("T")[0];
    const [recentTrips] = await pool.execute(`
      SELECT t.id, t.status, t.completed_at, b.bus_number, r.name AS route_name
      FROM trips t
      JOIN buses b ON b.id = t.bus_id
      JOIN routes r ON r.id = t.route_id
      WHERE DATE(t.trip_date) = ? AND t.status IN ("COMPLETED", "CANCELLED")
      ORDER BY t.completed_at DESC
      LIMIT 1
    `, [today]);

    const recentTrip = recentTrips[0] || null;
    if (recentTrip) {
      return {
        status: recentTrip.status === "COMPLETED" ? "TRIP_COMPLETED" : "TRIP_CANCELLED",
        locationStatus: "NO_LOCATION",
        student_status: studentStatusRow?.status || null,
        seat_number: seatNumber,
        pickup_stop: pickupStopObj,
        dropoff_stop: dropoffStopObj,
        trip: recentTrip,
        bus: null,
        location: null,
        journey: null,
      };
    }

    return {
      status: "TRIP_NOT_STARTED",
      locationStatus: "NO_LOCATION",
      student_status: studentStatusRow?.status || null,
      seat_number: seatNumber,
      pickup_stop: pickupStopObj,
      dropoff_stop: dropoffStopObj,
      trip: null,
      bus: null,
      location: null,
      journey: null,
    };
  }


  // 2. Get latest bus location
  const [locRows] = await pool.execute(`
    SELECT id, latitude, longitude, accuracy_meters AS accuracy, recorded_at, source
    FROM bus_locations
    WHERE bus_id = ?
    ORDER BY recorded_at DESC, id DESC
    LIMIT 1
  `, [trip.bus_id]);

  const latestLocation = locRows[0] || null;

  let locationStatus = "NO_LOCATION";
  let isStale = false;
  let ageSeconds = null;

  if (latestLocation) {
    const recordedTime = new Date(latestLocation.recorded_at).getTime();
    ageSeconds = Math.max(0, Math.round((Date.now() - recordedTime) / 1000));
    isStale = ageSeconds > STALE_THRESHOLD_SECONDS;
    locationStatus = isStale ? "LOCATION_STALE" : "LIVE";
  }

  // 3. Get ordered stops
  const [stops] = await pool.execute(`
    SELECT id, route_id, name, stop_order, latitude, longitude, scheduled_time
    FROM stops
    WHERE route_id = ?
    ORDER BY stop_order ASC
  `, [trip.route_id]);

  // 4. Get reached stops from notifications
  const [reachedRows] = await pool.execute(`
    SELECT title, body, sent_at
    FROM notifications
    WHERE trip_id = ? AND type = "STOP_REACHED"
    ORDER BY id ASC
  `, [trip.id]);

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

  // 5. Build journey progression
  const stopProgression = stops.map((stop) => {
    const isReached = reachedStopIds.has(stop.id);
    return {
      ...stop,
      isReached,
      status: isReached ? "REACHED" : "UPCOMING",
      reached_at: stopArrivalTimes[stop.id] || null,
    };
  });

  // Determine current stop (first unreached, or FINAL_REACHED)
  let foundCurrent = false;
  for (const s of stopProgression) {
    if (!s.isReached) {
      s.status = "CURRENT";
      foundCurrent = true;
      break;
    }
  }
  if (!foundCurrent && stopProgression.length > 0) {
    stopProgression[stopProgression.length - 1].status = "FINAL_REACHED";
  }

  const reachedCount = stopProgression.filter((s) => s.isReached).length;
  const remainingCount = stopProgression.length - reachedCount;

  // Determine overall transport status
  let overallStatus = "BUS_ON_ROUTE";
  if (trip.status === "SCHEDULED") {
    overallStatus = "TRIP_NOT_STARTED";
  } else if (reachedCount === stopProgression.length && stopProgression.length > 0) {
    overallStatus = "STOP_REACHED";
  } else if (latestLocation && isStale) {
    overallStatus = "LOCATION_STALE";
  } else if (!latestLocation) {
    overallStatus = "NO_LOCATION";
  }

  const routeGeometry = await getRoadRouteGeometry(stops);

  return {
    status: overallStatus,
    locationStatus,
    student_status: studentStatusRow?.status || null,
    seat_number: seatNumber,
    pickup_stop: pickupStopObj,
    dropoff_stop: dropoffStopObj,
    trip: {
      ...trip,
      capacity: Number(trip.capacity),
    },
    bus: {
      id: trip.bus_id,
      bus_number: trip.bus_number,
      registration_number: trip.registration_number,
      capacity: Number(trip.capacity),
    },
    driver: {
      name: trip.driver_name,
      employee_code: trip.driver_employee_code,
    },
    location: latestLocation
      ? {
          latitude: Number(latestLocation.latitude),
          longitude: Number(latestLocation.longitude),
          accuracy: latestLocation.accuracy !== null ? Number(latestLocation.accuracy) : null,
          recorded_at: latestLocation.recorded_at,
          age_seconds: ageSeconds,
          is_stale: isStale,
          source: latestLocation.source,
        }
      : null,
    journey: {
      total_stops: stopProgression.length,
      reached_stops_count: reachedCount,
      remaining_stops_count: remainingCount,
      stops: stopProgression,
      route_geometry: routeGeometry,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent/me — Current parent profile
// ─────────────────────────────────────────────────────────────────────────────
export const getParentProfile = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found for this account.");

  res.json({ parent });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent/students — Linked students
// ─────────────────────────────────────────────────────────────────────────────
export const getParentStudents = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const students = await getLinkedStudents(parent.parent_id);
  res.json({ students });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent/students/:studentId/status — Transport status for one student
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentTransportStatus = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(studentId)) throw new ApiError(400, "Invalid student ID.");

  // Security: verify this student belongs to this parent strictly via parent_students
  const [studentRows] = await pool.execute(`
    SELECT DISTINCT s.student_id, s.name, s.class, s.parent_phone
    FROM students s
    JOIN parent_students ps ON ps.student_id = s.student_id
    WHERE s.student_id = ? AND ps.parent_id = ?
  `, [studentId, parent.parent_id]);

  const student = studentRows[0];
  if (!student) throw new ApiError(403, "Student not found or not linked to your account.");

  const transportStatus = await computeTransportStatus(student);

  res.json({
    student,
    transport: transportStatus,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent/dashboard — Full dashboard (profile + all students + status)
// ─────────────────────────────────────────────────────────────────────────────
export const getParentDashboard = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const students = await getLinkedStudents(parent.parent_id);

  const studentsWithStatus = await Promise.all(
    students.map(async (student) => {
      const transport = await computeTransportStatus(student);
      return { student, transport };
    })
  );

  res.json({
    parent,
    children: studentsWithStatus,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/parent/notifications — Parent's notification list
// ─────────────────────────────────────────────────────────────────────────────
export const getParentNotifications = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "20", 10)));
  const offset = (page - 1) * limit;

  const [notifications] = await pool.execute(`
    SELECT
      n.id, n.title, n.body, n.type, n.trip_id, n.student_id,
      n.is_read, n.sent_at, n.created_at,
      t.status AS trip_status,
      b.bus_number,
      r.name AS route_name
    FROM notifications n
    LEFT JOIN trips t ON t.id = n.trip_id
    LEFT JOIN buses b ON b.id = t.bus_id
    LEFT JOIN routes r ON r.id = t.route_id
    WHERE n.user_id = ?
    ORDER BY n.sent_at DESC, n.id DESC
    LIMIT ? OFFSET ?
  `, [parent.user_id, limit, offset]);

  const [countRows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
    [parent.user_id]
  );
  const [unreadRows] = await pool.execute(
    "SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0",
    [parent.user_id]
  );

  res.json({
    notifications,
    pagination: {
      page,
      limit,
      total: Number(countRows[0].total),
      unread: Number(unreadRows[0].unread),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/parent/notifications/:id/read — Mark notification as read
// ─────────────────────────────────────────────────────────────────────────────
export const markNotificationRead = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const notifId = parseInt(req.params.id, 10);
  if (isNaN(notifId)) throw new ApiError(400, "Invalid notification ID.");

  // Security: only mark notifications belonging to this parent
  const [rows] = await pool.execute(
    "SELECT id FROM notifications WHERE id = ? AND user_id = ?",
    [notifId, parent.user_id]
  );
  if (!rows[0]) throw new ApiError(403, "Notification not found or not yours.");

  await pool.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", [notifId]);
  res.json({ success: true, message: "Notification marked as read." });
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/parent/notifications/read-all — Mark all as read
// ─────────────────────────────────────────────────────────────────────────────
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const parent = await getParentFromUserId(req.auth.sub);
  if (!parent) throw new ApiError(404, "Parent profile not found.");

  const [result] = await pool.execute(
    "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
    [parent.user_id]
  );

  res.json({
    success: true,
    message: `${result.affectedRows} notification(s) marked as read.`,
    updated: result.affectedRows,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/parent/device-token — Register FCM Device Push Token
// ─────────────────────────────────────────────────────────────────────────────
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const token = (req.body?.token || '').trim();
  const platform = (req.body?.platform || 'android').trim().toLowerCase().slice(0, 30);

  if (!token) {
    throw new ApiError(400, 'Device push token is required.');
  }

  // Token security: User ID is authoritatively bound to req.auth.sub
  // ON DUPLICATE KEY UPDATE: Handles re-registering or platform updates gracefully
  await pool.execute(
    `INSERT INTO device_tokens (user_id, token, platform, created_at, updated_at)
     VALUES (?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       platform = VALUES(platform),
       updated_at = NOW()`,
    [userId, token, platform]
  );

  res.status(200).json({
    success: true,
    message: 'Device token registered successfully.',
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/parent/device-token — Unregister Device Push Token (Sign-Out)
// ─────────────────────────────────────────────────────────────────────────────
export const unregisterDeviceToken = asyncHandler(async (req, res) => {
  const userId = req.auth?.sub;
  const token = (req.body?.token || req.query?.token || '').trim();

  if (!token) {
    throw new ApiError(400, 'Device push token is required to unregister.');
  }

  // Isolation check: Only delete if the token belongs to the authenticated user
  const [result] = await pool.execute(
    'DELETE FROM device_tokens WHERE user_id = ? AND token = ?',
    [userId, token]
  );

  res.status(200).json({
    success: true,
    message: 'Device token unregistered successfully.',
    deleted: result.affectedRows > 0,
  });
});

