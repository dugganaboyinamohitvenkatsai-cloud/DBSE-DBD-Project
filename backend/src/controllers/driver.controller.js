import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// Helper to format date as YYYY-MM-DD
function formatDate(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') return dateVal.split('T')[0];
  const d = new Date(dateVal);
  return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
}

// GET /api/admin/drivers?search=&page=1&limit=20
export const listDrivers = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = `
      WHERE u.full_name LIKE ?
         OR u.email LIKE ?
         OR u.phone LIKE ?
         OR d.employee_code LIKE ?
         OR d.license_number LIKE ?
    `;
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    ${whereClause}
  `;
  const [[{ total }]] = await pool.execute(countQuery, params);

  const listQuery = `
    SELECT 
      d.id AS driver_id,
      d.user_id,
      u.full_name,
      u.email,
      u.phone,
      u.is_active,
      d.employee_code,
      d.license_number,
      d.license_expiry,
      d.created_at
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    ${whereClause}
    ORDER BY d.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(listQuery, [...params, limit, offset]);

  const drivers = rows.map((row) => ({
    ...row,
    is_active: Boolean(row.is_active),
    license_expiry: formatDate(row.license_expiry),
  }));

  res.json({
    drivers,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /api/admin/drivers/:id
export const getDriver = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT 
      d.id AS driver_id,
      d.user_id,
      u.full_name,
      u.email,
      u.phone,
      u.is_active,
      d.employee_code,
      d.license_number,
      d.license_expiry,
      d.created_at
    FROM drivers d
    JOIN users u ON u.id = d.user_id
    WHERE d.id = ?`,
    [req.params.id]
  );

  const driver = rows[0];
  if (!driver) throw new ApiError(404, 'Driver not found.');

  // Check if driver is assigned to a bus
  const [busRows] = await pool.execute(
    `SELECT id AS bus_id, bus_number, registration_number, capacity, is_active
     FROM buses
     WHERE assigned_driver_id = ?`,
    [driver.driver_id]
  );

  res.json({
    driver: {
      ...driver,
      is_active: Boolean(driver.is_active),
      license_expiry: formatDate(driver.license_expiry),
      assigned_bus: busRows[0] || null,
    },
  });
});

// POST /api/admin/drivers
export const createDriver = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }

  const {
    full_name,
    email,
    password,
    phone,
    employee_code,
    license_number,
    license_expiry,
  } = req.body;

  // Validate required fields
  if (!full_name || !full_name.trim()) throw new ApiError(400, 'Full name is required.');
  if (!email || !email.trim()) throw new ApiError(400, 'Email is required.');
  if (!password || !password.trim()) throw new ApiError(400, 'Password is required.');
  if (!employee_code || !employee_code.trim()) throw new ApiError(400, 'Employee code is required.');
  if (!license_number || !license_number.trim()) throw new ApiError(400, 'License number is required.');
  if (!license_expiry || !license_expiry.trim()) throw new ApiError(400, 'License expiry date is required.');

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedEmpCode = employee_code.trim();
  const trimmedLicNum = license_number.trim();
  const trimmedExpiry = license_expiry.trim();
  const trimmedPhone = phone ? phone.trim() : null;

  // Check uniqueness before beginning transaction
  const [existingUser] = await pool.execute(
    'SELECT id FROM users WHERE email = ?',
    [trimmedEmail]
  );
  if (existingUser[0]) {
    throw new ApiError(409, `A user with email "${trimmedEmail}" already exists.`);
  }

  const [existingEmp] = await pool.execute(
    'SELECT id FROM drivers WHERE employee_code = ?',
    [trimmedEmpCode]
  );
  if (existingEmp[0]) {
    throw new ApiError(409, `A driver with employee code "${trimmedEmpCode}" already exists.`);
  }

  const [existingLic] = await pool.execute(
    'SELECT id FROM drivers WHERE license_number = ?',
    [trimmedLicNum]
  );
  if (existingLic[0]) {
    throw new ApiError(409, `A driver with license number "${trimmedLicNum}" already exists.`);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password.trim(), 10);

  // Execute in an atomic transaction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Create user account
    const [userResult] = await connection.execute(
      `INSERT INTO users (full_name, email, password_hash, role, phone, is_active)
       VALUES (?, ?, ?, 'DRIVER', ?, TRUE)`,
      [full_name.trim(), trimmedEmail, passwordHash, trimmedPhone]
    );
    const userId = userResult.insertId;

    // 2. Create driver profile
    const [driverResult] = await connection.execute(
      `INSERT INTO drivers (user_id, employee_code, license_number, license_expiry)
       VALUES (?, ?, ?, ?)`,
      [userId, trimmedEmpCode, trimmedLicNum, trimmedExpiry]
    );
    const driverId = driverResult.insertId;

    await connection.commit();

    // 3. Return created driver
    const [createdRows] = await pool.execute(
      `SELECT 
        d.id AS driver_id,
        d.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        d.employee_code,
        d.license_number,
        d.license_expiry,
        d.created_at
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?`,
      [driverId]
    );

    res.status(201).json({
      message: 'Driver created successfully.',
      driver: {
        ...createdRows[0],
        is_active: Boolean(createdRows[0].is_active),
        license_expiry: formatDate(createdRows[0].license_expiry),
      },
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PUT /api/admin/drivers/:id
export const updateDriver = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }

  const [existingRows] = await pool.execute(
    'SELECT id, user_id FROM drivers WHERE id = ?',
    [req.params.id]
  );
  const existingDriver = existingRows[0];
  if (!existingDriver) throw new ApiError(404, 'Driver not found.');

  const {
    full_name,
    email,
    phone,
    employee_code,
    license_number,
    license_expiry,
    is_active,
    password,
  } = req.body;

  // Uniqueness checks if updating fields
  if (email !== undefined) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) throw new ApiError(400, 'Email cannot be empty.');
    const [conflict] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [trimmedEmail, existingDriver.user_id]
    );
    if (conflict[0]) {
      throw new ApiError(409, `Email "${trimmedEmail}" is already in use by another account.`);
    }
  }

  if (employee_code !== undefined) {
    const trimmedCode = employee_code.trim();
    if (!trimmedCode) throw new ApiError(400, 'Employee code cannot be empty.');
    const [conflict] = await pool.execute(
      'SELECT id FROM drivers WHERE employee_code = ? AND id != ?',
      [trimmedCode, existingDriver.id]
    );
    if (conflict[0]) {
      throw new ApiError(409, `Employee code "${trimmedCode}" is already in use.`);
    }
  }

  if (license_number !== undefined) {
    const trimmedLic = license_number.trim();
    if (!trimmedLic) throw new ApiError(400, 'License number cannot be empty.');
    const [conflict] = await pool.execute(
      'SELECT id FROM drivers WHERE license_number = ? AND id != ?',
      [trimmedLic, existingDriver.id]
    );
    if (conflict[0]) {
      throw new ApiError(409, `License number "${trimmedLic}" is already in use.`);
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Update user fields
    const userUpdates = [];
    const userParams = [];

    if (full_name !== undefined) {
      if (!full_name.trim()) throw new ApiError(400, 'Full name cannot be empty.');
      userUpdates.push('full_name = ?');
      userParams.push(full_name.trim());
    }
    if (email !== undefined) {
      userUpdates.push('email = ?');
      userParams.push(email.trim().toLowerCase());
    }
    if (phone !== undefined) {
      userUpdates.push('phone = ?');
      userParams.push(phone?.trim() || null);
    }
    if (is_active !== undefined) {
      userUpdates.push('is_active = ?');
      userParams.push(Boolean(is_active));
    }
    if (password && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      userUpdates.push('password_hash = ?');
      userParams.push(passwordHash);
    }

    if (userUpdates.length > 0) {
      userParams.push(existingDriver.user_id);
      await connection.execute(
        `UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`,
        userParams
      );
    }

    // 2. Update driver fields
    const driverUpdates = [];
    const driverParams = [];

    if (employee_code !== undefined) {
      driverUpdates.push('employee_code = ?');
      driverParams.push(employee_code.trim());
    }
    if (license_number !== undefined) {
      driverUpdates.push('license_number = ?');
      driverParams.push(license_number.trim());
    }
    if (license_expiry !== undefined) {
      if (!license_expiry.trim()) throw new ApiError(400, 'License expiry cannot be empty.');
      driverUpdates.push('license_expiry = ?');
      driverParams.push(license_expiry.trim());
    }

    if (driverUpdates.length > 0) {
      driverParams.push(existingDriver.id);
      await connection.execute(
        `UPDATE drivers SET ${driverUpdates.join(', ')} WHERE id = ?`,
        driverParams
      );
    }

    await connection.commit();

    const [updatedRows] = await pool.execute(
      `SELECT 
        d.id AS driver_id,
        d.user_id,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        d.employee_code,
        d.license_number,
        d.license_expiry,
        d.created_at
      FROM drivers d
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?`,
      [existingDriver.id]
    );

    res.json({
      message: 'Driver updated successfully.',
      driver: {
        ...updatedRows[0],
        is_active: Boolean(updatedRows[0].is_active),
        license_expiry: formatDate(updatedRows[0].license_expiry),
      },
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// DELETE /api/admin/drivers/:id
export const deleteDriver = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, user_id, employee_code FROM drivers WHERE id = ?',
    [req.params.id]
  );
  const driver = rows[0];
  if (!driver) throw new ApiError(404, 'Driver not found.');

  // DELETE SAFETY A: Check whether driver has assigned trips
  const [[{ trip_count }]] = await pool.execute(
    'SELECT COUNT(*) AS trip_count FROM trips WHERE driver_id = ?',
    [driver.id]
  );
  if (Number(trip_count) > 0) {
    throw new ApiError(
      409,
      `Cannot delete driver: assigned to ${trip_count} trip(s). Please reassign or cancel trips first.`
    );
  }

  // DELETE SAFETY B: Check whether driver is assigned to any buses
  const [[{ bus_count }]] = await pool.execute(
    'SELECT COUNT(*) AS bus_count FROM buses WHERE assigned_driver_id = ?',
    [driver.id]
  );
  if (Number(bus_count) > 0) {
    throw new ApiError(
      409,
      `Cannot delete driver: currently assigned to ${bus_count} bus(es). Please unassign the driver from all buses first.`
    );
  }

  // Atomically delete the user record, which cascades to delete the driver profile
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM drivers WHERE id = ?', [driver.id]);
    await connection.execute('DELETE FROM users WHERE id = ?', [driver.user_id]);

    await connection.commit();

    res.json({ message: 'Driver deleted successfully.' });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});
