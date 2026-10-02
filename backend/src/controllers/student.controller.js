import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// GET /api/admin/students?search=&page=1&limit=20
export const listStudents = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = 'WHERE s.name LIKE ? OR s.class LIKE ? OR s.parent_phone LIKE ?';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const countQuery = `SELECT COUNT(*) AS total FROM students s ${whereClause}`;
  const [[{ total }]] = await pool.execute(countQuery, params);

  const listQuery = `
    SELECT 
      s.student_id,
      s.name,
      s.class,
      s.parent_phone,
      GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') AS linked_parents,
      COUNT(DISTINCT ps.parent_id) AS parent_count,
      sts.status AS transport_status,
      sts.trip_id AS current_trip_id,
      sts.pickup_stop_id,
      sts.dropoff_stop_id,
      p_stop.name AS pickup_stop_name,
      d_stop.name AS dropoff_stop_name,
      b.bus_number AS current_bus_number,
      r.name AS current_route_name,
      r.route_code AS current_route_code
    FROM students s
    LEFT JOIN parent_students ps ON ps.student_id = s.student_id
    LEFT JOIN parents p ON p.parent_id = ps.parent_id
    LEFT JOIN (
      SELECT sts_sub.id, sts_sub.student_id, sts_sub.trip_id, sts_sub.status,
             sts_sub.pickup_stop_id, sts_sub.dropoff_stop_id
      FROM student_transport_status sts_sub
      JOIN (
        SELECT student_id, MAX(id) as max_id
        FROM student_transport_status
        GROUP BY student_id
      ) latest ON sts_sub.id = latest.max_id
    ) sts ON sts.student_id = s.student_id
    LEFT JOIN trips curr_t ON curr_t.id = sts.trip_id
    LEFT JOIN buses b ON b.id = curr_t.bus_id
    LEFT JOIN routes r ON r.id = curr_t.route_id
    LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
    LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
    ${whereClause}
    GROUP BY s.student_id, s.name, s.class, s.parent_phone, sts.status, sts.trip_id,
             sts.pickup_stop_id, sts.dropoff_stop_id, p_stop.name, d_stop.name,
             b.bus_number, r.name, r.route_code
    ORDER BY s.student_id DESC
    LIMIT ? OFFSET ?
  `;

  const [students] = await pool.execute(listQuery, [...params, limit, offset]);

  res.json({
    students,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/admin/students/:id
export const getStudent = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT student_id, name, class, parent_phone FROM students WHERE student_id = ?',
    [req.params.id]
  );
  if (!rows[0]) throw new ApiError(404, 'Student not found.');
  const student = rows[0];

  // Linked parents
  const [parents] = await pool.execute(`
    SELECT p.parent_id, p.name, p.phone, p.email, ps.relationship_type, ps.is_primary_contact
    FROM parent_students ps
    JOIN parents p ON p.parent_id = ps.parent_id
    WHERE ps.student_id = ?
    ORDER BY ps.is_primary_contact DESC, p.name ASC
  `, [student.student_id]);

  // Current/recent trip transport status
  const [transportRows] = await pool.execute(`
    SELECT sts.id, sts.trip_id, sts.status, sts.recorded_at, sts.notes,
           sts.pickup_stop_id, sts.dropoff_stop_id,
           p_stop.name AS pickup_stop_name, p_stop.stop_order AS pickup_stop_order,
           d_stop.name AS dropoff_stop_name, d_stop.stop_order AS dropoff_stop_order,
           t.status AS trip_status, t.direction, t.trip_date, t.route_id,
           b.bus_number, r.name AS route_name, r.route_code
    FROM student_transport_status sts
    JOIN trips t ON t.id = sts.trip_id
    JOIN buses b ON b.id = t.bus_id
    JOIN routes r ON r.id = t.route_id
    LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
    LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
    WHERE sts.student_id = ?
    ORDER BY sts.recorded_at DESC
    LIMIT 5
  `, [student.student_id]);

  res.json({
    student: {
      ...student,
      parents,
      transport_history: transportRows,
      current_status: transportRows[0] || null,
    },
  });
});

// POST /api/admin/students
export const createStudent = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw new ApiError(400, 'Request body is required.');
  const { name, class: studentClass, parent_phone } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Student name is required.');

  const [result] = await pool.execute(
    'INSERT INTO students (name, class, parent_phone) VALUES (?, ?, ?)',
    [name.trim(), studentClass?.trim() || null, parent_phone?.trim() || null]
  );

  const [rows] = await pool.execute(
    'SELECT student_id, name, class, parent_phone FROM students WHERE student_id = ?',
    [result.insertId]
  );

  res.status(201).json({ student: rows[0] });
});

// PUT /api/admin/students/:id
export const updateStudent = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw new ApiError(400, 'Request body is required.');
  const { name, class: studentClass, parent_phone } = req.body;

  const [existing] = await pool.execute(
    'SELECT student_id FROM students WHERE student_id = ?',
    [req.params.id]
  );
  if (!existing[0]) throw new ApiError(404, 'Student not found.');

  const updates = [];
  const params = [];

  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Student name cannot be empty.');
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (studentClass !== undefined) {
    updates.push('class = ?');
    params.push(studentClass?.trim() || null);
  }
  if (parent_phone !== undefined) {
    updates.push('parent_phone = ?');
    params.push(parent_phone?.trim() || null);
  }

  if (updates.length === 0) throw new ApiError(400, 'No fields provided to update.');

  params.push(req.params.id);
  await pool.execute(
    `UPDATE students SET ${updates.join(', ')} WHERE student_id = ?`,
    params
  );

  const [rows] = await pool.execute(
    'SELECT student_id, name, class, parent_phone FROM students WHERE student_id = ?',
    [req.params.id]
  );

  res.json({ student: rows[0] });
});

// DELETE /api/admin/students/:id
export const deleteStudent = asyncHandler(async (req, res) => {
  const [existing] = await pool.execute(
    'SELECT student_id FROM students WHERE student_id = ?',
    [req.params.id]
  );
  if (!existing[0]) throw new ApiError(404, 'Student not found.');

  await pool.execute('DELETE FROM students WHERE student_id = ?', [req.params.id]);

  res.json({ message: 'Student deleted successfully.' });
});

// PUT /api/admin/students/:id/transport-status — Update student's status on a trip
export const updateStudentTransportStatus = asyncHandler(async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const { trip_id, status, notes, pickup_stop_id, dropoff_stop_id } = req.body || {};

  const parsedTripId = parseInt(trip_id, 10);
  if (isNaN(parsedTripId)) {
    throw new ApiError(400, 'Valid trip_id is required.');
  }

  const allowedStatuses = ['WAITING', 'BOARDED', 'ON_BUS', 'DROPPED_OFF', 'ABSENT'];
  let targetStatus = status;
  if (!targetStatus) {
    const [curr] = await pool.execute(
      'SELECT status FROM student_transport_status WHERE trip_id = ? AND student_id = ?',
      [parsedTripId, studentId]
    );
    targetStatus = curr[0]?.status || 'WAITING';
  } else if (!allowedStatuses.includes(targetStatus)) {
    throw new ApiError(400, `Invalid status. Allowed: ${allowedStatuses.join(', ')}`);
  }

  // 1. Verify trip and its route exist
  const [tripRows] = await pool.execute(
    'SELECT id, route_id, bus_id, status FROM trips WHERE id = ?',
    [parsedTripId]
  );
  const trip = tripRows[0];
  if (!trip) {
    throw new ApiError(404, 'Trip not found.');
  }

  let validatedPickupStopId = null;
  let validatedDropoffStopId = null;
  let pickupStopOrder = null;
  let dropoffStopOrder = null;

  // 2. Validate pickup_stop_id if provided
  if (pickup_stop_id !== undefined && pickup_stop_id !== null) {
    const pId = parseInt(pickup_stop_id, 10);
    if (isNaN(pId)) throw new ApiError(400, 'Invalid pickup_stop_id.');
    const [pRows] = await pool.execute(
      'SELECT id, route_id, name, stop_order FROM stops WHERE id = ?',
      [pId]
    );
    const pStop = pRows[0];
    if (!pStop) throw new ApiError(404, `Pickup stop #${pId} not found.`);
    if (Number(pStop.route_id) !== Number(trip.route_id)) {
      throw new ApiError(
        400,
        `Pickup stop "${pStop.name}" does not belong to the route for Trip #${trip.id}.`
      );
    }
    validatedPickupStopId = pId;
    pickupStopOrder = pStop.stop_order;
  }

  // 3. Validate dropoff_stop_id if provided
  if (dropoff_stop_id !== undefined && dropoff_stop_id !== null) {
    const dId = parseInt(dropoff_stop_id, 10);
    if (isNaN(dId)) throw new ApiError(400, 'Invalid dropoff_stop_id.');
    const [dRows] = await pool.execute(
      'SELECT id, route_id, name, stop_order FROM stops WHERE id = ?',
      [dId]
    );
    const dStop = dRows[0];
    if (!dStop) throw new ApiError(404, `Dropoff stop #${dId} not found.`);
    if (Number(dStop.route_id) !== Number(trip.route_id)) {
      throw new ApiError(
        400,
        `Dropoff stop "${dStop.name}" does not belong to the route for Trip #${trip.id}.`
      );
    }
    validatedDropoffStopId = dId;
    dropoffStopOrder = dStop.stop_order;
  }

  // 4. Validate stop ordering if both stops are assigned
  if (pickupStopOrder !== null && dropoffStopOrder !== null) {
    if (pickupStopOrder >= dropoffStopOrder) {
      throw new ApiError(
        400,
        `Pickup stop (order #${pickupStopOrder}) must come before dropoff stop (order #${dropoffStopOrder}).`
      );
    }
  }

  // 5. Insert or update on duplicate key
  await pool.execute(`
    INSERT INTO student_transport_status (
      trip_id, student_id, status, recorded_at, recorded_by_user_id, notes,
      pickup_stop_id, dropoff_stop_id
    )
    VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      status = VALUES(status), 
      recorded_at = NOW(), 
      recorded_by_user_id = VALUES(recorded_by_user_id), 
      notes = COALESCE(VALUES(notes), notes),
      pickup_stop_id = COALESCE(VALUES(pickup_stop_id), pickup_stop_id),
      dropoff_stop_id = COALESCE(VALUES(dropoff_stop_id), dropoff_stop_id)
  `, [
    parsedTripId,
    studentId,
    targetStatus,
    req.auth?.sub || null,
    notes || null,
    validatedPickupStopId,
    validatedDropoffStopId,
  ]);

  res.json({
    success: true,
    message: `Student transport status updated to "${targetStatus}".`,
    student_id: studentId,
    trip_id: parsedTripId,
    status: targetStatus,
    pickup_stop_id: validatedPickupStopId,
    dropoff_stop_id: validatedDropoffStopId,
  });
});

// GET /api/admin/students/:id/transport-status — Get student's current transport assignment
export const getStudentTransport = asyncHandler(async (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  const [rows] = await pool.execute(`
    SELECT sts.id, sts.trip_id, sts.status, sts.notes, sts.recorded_at,
           sts.pickup_stop_id, sts.dropoff_stop_id,
           p_stop.name AS pickup_stop_name, p_stop.stop_order AS pickup_stop_order,
           d_stop.name AS dropoff_stop_name, d_stop.stop_order AS dropoff_stop_order,
           t.status AS trip_status, t.direction, t.trip_date, t.route_id,
           b.bus_number, r.name AS route_name, r.route_code
    FROM student_transport_status sts
    JOIN trips t ON t.id = sts.trip_id
    JOIN buses b ON b.id = t.bus_id
    JOIN routes r ON r.id = t.route_id
    LEFT JOIN stops p_stop ON p_stop.id = sts.pickup_stop_id
    LEFT JOIN stops d_stop ON d_stop.id = sts.dropoff_stop_id
    WHERE sts.student_id = ?
    ORDER BY 
      CASE t.status WHEN 'IN_PROGRESS' THEN 1 WHEN 'STARTED' THEN 2 WHEN 'SCHEDULED' THEN 3 ELSE 4 END,
      sts.recorded_at DESC
    LIMIT 1
  `, [studentId]);

  res.json({
    student_id: studentId,
    assignment: rows[0] || null,
  });
});

