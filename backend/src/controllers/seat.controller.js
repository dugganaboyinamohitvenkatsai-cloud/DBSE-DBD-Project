import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Normalize seat number format.
 * If numeric (e.g. 5 or "05" or "Seat 5"), formats consistently to e.g. "05" or "Seat 05".
 */
export function normalizeSeatNumber(rawSeat) {
  if (rawSeat === undefined || rawSeat === null) return '';
  const str = String(rawSeat).trim();
  const digitsMatch = str.match(/\d+/);
  if (digitsMatch) {
    const num = parseInt(digitsMatch[0], 10);
    return String(num).padStart(2, '0');
  }
  return str.toUpperCase();
}

/**
 * 1. GET /api/admin/trips/:tripId/seats
 * Retrieve full seat map, capacity, assignments, and student roster for a trip.
 */
export const getTripSeats = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  // 1. Fetch Trip & Bus Details
  const [tripRows] = await pool.execute(
    `SELECT 
       t.id, t.bus_id, t.route_id, t.driver_id, t.trip_date, t.direction,
       t.scheduled_start_at, t.started_at, t.completed_at, t.status,
       b.bus_number, b.registration_number, b.capacity, b.is_active AS bus_is_active,
       r.route_code, r.name AS route_name
     FROM trips t
     JOIN buses b ON b.id = t.bus_id
     JOIN routes r ON r.id = t.route_id
     WHERE t.id = ?`,
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) {
    throw new ApiError(404, 'Trip not found.');
  }

  const busCapacity = Number(trip.capacity) || 50;

  // 2. Fetch all seat assignments for this trip
  const [assignments] = await pool.execute(
    `SELECT 
       sa.id,
       sa.trip_id,
       sa.bus_id,
       sa.student_id,
       sa.seat_number,
       sa.assigned_at,
       s.name AS student_name,
       s.class AS student_class,
       s.parent_phone,
       sts.status AS transport_status,
       p_stop.name AS pickup_stop_name,
       d_stop.name AS dropoff_stop_name
     FROM seat_assignments sa
     JOIN students s ON s.student_id = sa.student_id
     LEFT JOIN student_transport_status sts ON sts.trip_id = sa.trip_id AND sts.student_id = sa.student_id
     LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
     LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
     WHERE sa.trip_id = ?
     ORDER BY CAST(REGEXP_SUBSTR(sa.seat_number, '[0-9]+') AS UNSIGNED) ASC, sa.seat_number ASC`,
    [tripId]
  );

  // 3. Fetch all active students in system for selection
  const [students] = await pool.execute(
    `SELECT 
       s.student_id,
       s.name,
       s.class,
       s.parent_phone,
       sts.status AS transport_status,
       sts.trip_id AS assigned_trip_id
     FROM students s
     LEFT JOIN student_transport_status sts ON sts.student_id = s.student_id AND sts.trip_id = ?
     ORDER BY s.name ASC`,
    [tripId]
  );

  // 4. Construct virtual seat grid (1..busCapacity)
  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(normalizeSeatNumber(a.seat_number), a);
  }

  const layout = [];
  for (let i = 1; i <= busCapacity; i++) {
    const seatNum = String(i).padStart(2, '0');
    const assigned = assignmentMap.get(seatNum) || null;
    layout.push({
      seat_number: seatNum,
      seat_index: i,
      is_occupied: Boolean(assigned),
      assignment: assigned,
    });
  }

  res.json({
    trip: {
      ...trip,
      capacity: busCapacity,
    },
    total_capacity: busCapacity,
    occupied_count: assignments.length,
    available_count: Math.max(0, busCapacity - assignments.length),
    layout,
    assignments,
    students,
  });
});

/**
 * 2. POST /api/admin/trips/:tripId/seats
 * Assign a student to a specific seat on this trip.
 */
export const assignTripSeat = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const { student_id, seat_number } = req.body || {};
  if (!student_id) throw new ApiError(400, 'Student ID is required.');
  if (!seat_number) throw new ApiError(400, 'Seat number is required.');

  const parsedStudentId = parseInt(student_id, 10);
  if (isNaN(parsedStudentId) || parsedStudentId <= 0) {
    throw new ApiError(400, 'Invalid student ID.');
  }

  const normalizedSeat = normalizeSeatNumber(seat_number);
  const seatInt = parseInt(normalizedSeat, 10);

  // 1. Verify Trip & Bus
  const [tripRows] = await pool.execute(
    'SELECT t.id, t.bus_id, b.capacity FROM trips t JOIN buses b ON b.id = t.bus_id WHERE t.id = ?',
    [tripId]
  );
  const trip = tripRows[0];
  if (!trip) throw new ApiError(404, 'Trip not found.');

  const capacity = Number(trip.capacity) || 50;

  // 2. Validate seat number bounds
  if (isNaN(seatInt) || seatInt < 1 || seatInt > capacity) {
    throw new ApiError(400, `Seat number must be between 01 and ${String(capacity).padStart(2, '0')}.`);
  }

  // 3. Verify Student exists
  const [studentRows] = await pool.execute(
    'SELECT student_id, name, class FROM students WHERE student_id = ?',
    [parsedStudentId]
  );
  const student = studentRows[0];
  if (!student) throw new ApiError(404, 'Student not found.');

  // 4. Rule 1: A seat cannot be assigned to two students for the same trip
  const [existingSeat] = await pool.execute(
    `SELECT sa.id, sa.student_id, s.name as student_name 
     FROM seat_assignments sa 
     JOIN students s ON s.student_id = sa.student_id 
     WHERE sa.trip_id = ? AND sa.seat_number = ?`,
    [tripId, normalizedSeat]
  );
  if (existingSeat.length > 0 && existingSeat[0].student_id !== parsedStudentId) {
    throw new ApiError(
      409,
      `Seat #${normalizedSeat} is already assigned to student "${existingSeat[0].student_name}".`
    );
  }

  // 5. Rule 2: A student cannot occupy two seats for the same trip
  const [existingStudent] = await pool.execute(
    `SELECT sa.id, sa.seat_number 
     FROM seat_assignments sa 
     WHERE sa.trip_id = ? AND sa.student_id = ?`,
    [tripId, parsedStudentId]
  );
  if (existingStudent.length > 0 && existingStudent[0].seat_number !== normalizedSeat) {
    throw new ApiError(
      409,
      `Student "${student.name}" is already assigned to Seat #${existingStudent[0].seat_number} on this trip.`
    );
  }

  // 6. Persist assignment to MySQL
  await pool.execute(
    `INSERT INTO seat_assignments (trip_id, bus_id, student_id, seat_number, assigned_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE 
       student_id = VALUES(student_id),
       bus_id = VALUES(bus_id),
       assigned_at = NOW()`,
    [tripId, trip.bus_id, parsedStudentId, normalizedSeat]
  );

  // 7. Also ensure student has a record in student_transport_status for this trip
  await pool.execute(
    `INSERT IGNORE INTO student_transport_status (trip_id, student_id, status, recorded_at)
     VALUES (?, ?, 'WAITING', NOW())`,
    [tripId, parsedStudentId]
  );

  // Fetch updated assignment
  const [savedRows] = await pool.execute(
    `SELECT sa.*, s.name AS student_name, s.class AS student_class, s.parent_phone
     FROM seat_assignments sa
     JOIN students s ON s.student_id = sa.student_id
     WHERE sa.trip_id = ? AND sa.seat_number = ?`,
    [tripId, normalizedSeat]
  );

  res.status(201).json({
    success: true,
    message: `Seat #${normalizedSeat} successfully assigned to ${student.name}.`,
    assignment: savedRows[0],
  });
});

/**
 * 3. DELETE /api/admin/trips/:tripId/seats/:seatNumber
 * Remove seat assignment from a specific seat on this trip.
 */
export const unassignTripSeat = asyncHandler(async (req, res) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId) || tripId <= 0) {
    throw new ApiError(400, 'Invalid trip ID.');
  }

  const normalizedSeat = normalizeSeatNumber(req.params.seatNumber);
  if (!normalizedSeat) {
    throw new ApiError(400, 'Valid seat number is required.');
  }

  const [existing] = await pool.execute(
    `SELECT sa.id, sa.student_id, s.name as student_name 
     FROM seat_assignments sa 
     JOIN students s ON s.student_id = sa.student_id 
     WHERE sa.trip_id = ? AND sa.seat_number = ?`,
    [tripId, normalizedSeat]
  );
  if (!existing[0]) {
    throw new ApiError(404, `Seat #${normalizedSeat} is not currently assigned.`);
  }

  await pool.execute(
    'DELETE FROM seat_assignments WHERE trip_id = ? AND seat_number = ?',
    [tripId, normalizedSeat]
  );

  res.json({
    success: true,
    message: `Seat #${normalizedSeat} assignment for ${existing[0].student_name} was removed.`,
  });
});
