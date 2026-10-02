import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// GET /api/admin/buses?search=&page=1&limit=20
export const listBuses = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = `
      WHERE b.bus_number LIKE ?
         OR b.registration_number LIKE ?
         OR u.full_name LIKE ?
         OR d.employee_code LIKE ?
    `;
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM buses b
    LEFT JOIN drivers d ON d.id = b.assigned_driver_id
    LEFT JOIN users u ON u.id = d.user_id
    ${whereClause}
  `;
  const [[{ total }]] = await pool.execute(countQuery, params);

  const listQuery = `
    SELECT 
      b.id,
      b.bus_number,
      b.registration_number,
      b.capacity,
      b.assigned_driver_id,
      u.full_name AS driver_name,
      d.employee_code AS driver_employee_code,
      u.phone AS driver_phone,
      b.is_active,
      b.created_at,
      b.updated_at
    FROM buses b
    LEFT JOIN drivers d ON d.id = b.assigned_driver_id
    LEFT JOIN users u ON u.id = d.user_id
    ${whereClause}
    ORDER BY b.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(listQuery, [...params, limit, offset]);

  const buses = rows.map((row) => ({
    ...row,
    is_active: Boolean(row.is_active),
    capacity: Number(row.capacity),
  }));

  res.json({
    buses,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/admin/buses/available-drivers?current_bus_id=
export const getAvailableDrivers = asyncHandler(async (req, res) => {
  const currentBusId = req.query.current_bus_id ? parseInt(req.query.current_bus_id, 10) : null;

  let query = `
    SELECT 
      d.id,
      u.full_name,
      u.email,
      u.phone,
      d.employee_code,
      d.license_number
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    WHERE u.is_active = TRUE
      AND u.role = 'DRIVER'
  `;

  const params = [];
  if (currentBusId) {
    query += `
      AND (
        d.id NOT IN (
          SELECT assigned_driver_id 
          FROM buses 
          WHERE assigned_driver_id IS NOT NULL AND id != ?
        )
      )
    `;
    params.push(currentBusId);
  } else {
    query += `
      AND (
        d.id NOT IN (
          SELECT assigned_driver_id 
          FROM buses 
          WHERE assigned_driver_id IS NOT NULL
        )
      )
    `;
  }

  query += ' ORDER BY u.full_name ASC';

  const [drivers] = await pool.execute(query, params);
  res.json({ drivers });
});

// GET /api/admin/buses/:id
export const getBus = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT 
      b.id,
      b.bus_number,
      b.registration_number,
      b.capacity,
      b.assigned_driver_id,
      u.full_name AS driver_name,
      d.employee_code AS driver_employee_code,
      u.phone AS driver_phone,
      u.email AS driver_email,
      b.is_active,
      b.created_at,
      b.updated_at
    FROM buses b
    LEFT JOIN drivers d ON d.id = b.assigned_driver_id
    LEFT JOIN users u ON u.id = d.user_id
    WHERE b.id = ?`,
    [req.params.id]
  );

  const bus = rows[0];
  if (!bus) throw new ApiError(404, 'Bus not found.');

  res.json({
    bus: {
      ...bus,
      is_active: Boolean(bus.is_active),
      capacity: Number(bus.capacity),
    },
  });
});

// POST /api/admin/buses
export const createBus = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }

  const { bus_number, registration_number, capacity, assigned_driver_id } = req.body;

  // Validation
  if (!bus_number || !bus_number.trim()) throw new ApiError(400, 'Bus number is required.');
  if (!registration_number || !registration_number.trim()) throw new ApiError(400, 'Registration number is required.');
  if (capacity === undefined || capacity === null || capacity === '') throw new ApiError(400, 'Capacity is required.');

  const parsedCapacity = parseInt(capacity, 10);
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    throw new ApiError(400, 'Capacity must be a positive integer.');
  }

  const trimmedBusNumber = bus_number.trim();
  const trimmedRegNumber = registration_number.trim();

  // Duplicate checks
  const [existingBusNum] = await pool.execute(
    'SELECT id FROM buses WHERE bus_number = ?',
    [trimmedBusNumber]
  );
  if (existingBusNum[0]) {
    throw new ApiError(409, `A bus with number "${trimmedBusNumber}" already exists.`);
  }

  const [existingRegNum] = await pool.execute(
    'SELECT id FROM buses WHERE registration_number = ?',
    [trimmedRegNumber]
  );
  if (existingRegNum[0]) {
    throw new ApiError(409, `A bus with registration number "${trimmedRegNumber}" already exists.`);
  }

  let validDriverId = null;
  if (assigned_driver_id) {
    const parsedDriverId = parseInt(assigned_driver_id, 10);
    // 1. Verify driver exists, user exists, role is DRIVER, is_active is TRUE
    const [driverRows] = await pool.execute(
      `SELECT d.id, u.full_name, u.is_active, u.role
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [parsedDriverId]
    );
    const driver = driverRows[0];
    if (!driver) throw new ApiError(404, 'Driver not found.');
    if (driver.role !== 'DRIVER') throw new ApiError(400, 'User is not a driver.');
    if (!driver.is_active) throw new ApiError(400, `Driver "${driver.full_name}" is currently inactive.`);

    // 2. Verify driver is not already assigned to another bus
    const [assignedBus] = await pool.execute(
      'SELECT id, bus_number FROM buses WHERE assigned_driver_id = ?',
      [parsedDriverId]
    );
    if (assignedBus[0]) {
      throw new ApiError(
        409,
        `Driver "${driver.full_name}" is already assigned to bus "${assignedBus[0].bus_number}".`
      );
    }
    validDriverId = parsedDriverId;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO buses (bus_number, registration_number, capacity, assigned_driver_id, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [trimmedBusNumber, trimmedRegNumber, parsedCapacity, validDriverId]
    );
    const busId = result.insertId;

    await connection.commit();

    // Query created bus with joined driver details
    const [createdRows] = await pool.execute(
      `SELECT 
        b.id,
        b.bus_number,
        b.registration_number,
        b.capacity,
        b.assigned_driver_id,
        u.full_name AS driver_name,
        d.employee_code AS driver_employee_code,
        u.phone AS driver_phone,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM buses b
      LEFT JOIN drivers d ON d.id = b.assigned_driver_id
      LEFT JOIN users u ON u.id = d.user_id
      WHERE b.id = ?`,
      [busId]
    );

    res.status(201).json({
      message: 'Bus created successfully.',
      bus: {
        ...createdRows[0],
        is_active: Boolean(createdRows[0].is_active),
        capacity: Number(createdRows[0].capacity),
      },
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PUT /api/admin/buses/:id
export const updateBus = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }

  const [existingRows] = await pool.execute(
    'SELECT id, bus_number, registration_number, assigned_driver_id FROM buses WHERE id = ?',
    [req.params.id]
  );
  const existingBus = existingRows[0];
  if (!existingBus) throw new ApiError(404, 'Bus not found.');

  const {
    bus_number,
    registration_number,
    capacity,
    assigned_driver_id,
    is_active,
  } = req.body;

  const updates = [];
  const params = [];

  if (bus_number !== undefined) {
    const trimmedBusNumber = bus_number.trim();
    if (!trimmedBusNumber) throw new ApiError(400, 'Bus number cannot be empty.');
    const [conflict] = await pool.execute(
      'SELECT id FROM buses WHERE bus_number = ? AND id != ?',
      [trimmedBusNumber, existingBus.id]
    );
    if (conflict[0]) {
      throw new ApiError(409, `Bus number "${trimmedBusNumber}" is already in use.`);
    }
    updates.push('bus_number = ?');
    params.push(trimmedBusNumber);
  }

  if (registration_number !== undefined) {
    const trimmedRegNumber = registration_number.trim();
    if (!trimmedRegNumber) throw new ApiError(400, 'Registration number cannot be empty.');
    const [conflict] = await pool.execute(
      'SELECT id FROM buses WHERE registration_number = ? AND id != ?',
      [trimmedRegNumber, existingBus.id]
    );
    if (conflict[0]) {
      throw new ApiError(409, `Registration number "${trimmedRegNumber}" is already in use.`);
    }
    updates.push('registration_number = ?');
    params.push(trimmedRegNumber);
  }

  if (capacity !== undefined) {
    const parsedCapacity = parseInt(capacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      throw new ApiError(400, 'Capacity must be a positive integer.');
    }
    updates.push('capacity = ?');
    params.push(parsedCapacity);
  }

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(Boolean(is_active));
  }

  if (assigned_driver_id !== undefined) {
    if (assigned_driver_id === null || assigned_driver_id === '' || assigned_driver_id === 0) {
      updates.push('assigned_driver_id = NULL');
    } else {
      const parsedDriverId = parseInt(assigned_driver_id, 10);
      const [driverRows] = await pool.execute(
        `SELECT d.id, u.full_name, u.is_active, u.role
         FROM drivers d
         JOIN users u ON u.id = d.user_id
         WHERE d.id = ?`,
        [parsedDriverId]
      );
      const driver = driverRows[0];
      if (!driver) throw new ApiError(404, 'Driver not found.');
      if (driver.role !== 'DRIVER') throw new ApiError(400, 'User is not a driver.');
      if (!driver.is_active) throw new ApiError(400, `Driver "${driver.full_name}" is currently inactive.`);

      // Verify driver is not assigned to another bus
      const [conflict] = await pool.execute(
        'SELECT id, bus_number FROM buses WHERE assigned_driver_id = ? AND id != ?',
        [parsedDriverId, existingBus.id]
      );
      if (conflict[0]) {
        throw new ApiError(
          409,
          `Driver "${driver.full_name}" is already assigned to bus "${conflict[0].bus_number}".`
        );
      }
      updates.push('assigned_driver_id = ?');
      params.push(parsedDriverId);
    }
  }

  if (updates.length === 0) {
    throw new ApiError(400, 'No fields provided to update.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    params.push(existingBus.id);
    await connection.execute(
      `UPDATE buses SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    await connection.commit();

    const [updatedRows] = await pool.execute(
      `SELECT 
        b.id,
        b.bus_number,
        b.registration_number,
        b.capacity,
        b.assigned_driver_id,
        u.full_name AS driver_name,
        d.employee_code AS driver_employee_code,
        u.phone AS driver_phone,
        b.is_active,
        b.created_at,
        b.updated_at
      FROM buses b
      LEFT JOIN drivers d ON d.id = b.assigned_driver_id
      LEFT JOIN users u ON u.id = d.user_id
      WHERE b.id = ?`,
      [existingBus.id]
    );

    res.json({
      message: 'Bus updated successfully.',
      bus: {
        ...updatedRows[0],
        is_active: Boolean(updatedRows[0].is_active),
        capacity: Number(updatedRows[0].capacity),
      },
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// DELETE /api/admin/buses/:id
export const deleteBus = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, bus_number FROM buses WHERE id = ?',
    [req.params.id]
  );
  const bus = rows[0];
  if (!bus) throw new ApiError(404, 'Bus not found.');

  // Trip safety check: check if bus is referenced by any trips
  const [[{ trip_count }]] = await pool.execute(
    'SELECT COUNT(*) AS trip_count FROM trips WHERE bus_id = ?',
    [bus.id]
  );
  if (Number(trip_count) > 0) {
    throw new ApiError(
      409,
      `Cannot delete bus "${bus.bus_number}": referenced by ${trip_count} trip(s). Please remove or reassign associated trips first.`
    );
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM buses WHERE id = ?', [bus.id]);

    await connection.commit();

    res.json({ message: 'Bus deleted successfully.' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});
