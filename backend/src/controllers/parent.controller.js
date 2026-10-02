import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';
import { asyncHandler } from '../utils/async-handler.js';

// GET /api/admin/parents?search=&page=1&limit=20
export const listParents = asyncHandler(async (req, res) => {
  const search = (req.query.search || '').trim();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params = [];

  if (search) {
    whereClause = 'WHERE p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?';
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const countQuery = `SELECT COUNT(*) AS total FROM parents p ${whereClause}`;
  const [[{ total }]] = await pool.execute(countQuery, params);

  // Use parent_students table as the ONLY authoritative parent-student relationship
  const listQuery = `
    SELECT 
      p.parent_id,
      p.name,
      p.phone,
      p.email,
      p.user_id,
      COUNT(DISTINCT ps.student_id) AS student_count,
      GROUP_CONCAT(DISTINCT s.name ORDER BY s.name ASC SEPARATOR ', ') AS student_names
    FROM parents p
    LEFT JOIN parent_students ps ON ps.parent_id = p.parent_id
    LEFT JOIN students s ON s.student_id = ps.student_id
    ${whereClause}
    GROUP BY p.parent_id, p.name, p.phone, p.email, p.user_id
    ORDER BY p.parent_id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await pool.execute(listQuery, [...params, limit, offset]);

  const parents = rows.map((row) => ({
    ...row,
    student_count: Number(row.student_count || 0),
    student_names: row.student_names || null,
  }));

  res.json({
    parents,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  });
});

// GET /api/admin/parents/:id
export const getParent = asyncHandler(async (req, res) => {
  const [parentRows] = await pool.execute(
    'SELECT parent_id, user_id, name, phone, email FROM parents WHERE parent_id = ?',
    [req.params.id]
  );
  const parent = parentRows[0];
  if (!parent) throw new ApiError(404, 'Parent not found.');

  // Fetch linked students strictly from parent_students table
  const [studentRows] = await pool.execute(`
    SELECT DISTINCT
      s.student_id,
      s.name,
      s.class,
      ps.relationship_type,
      ps.is_primary_contact,
      ps.created_at AS linked_at
    FROM students s
    JOIN parent_students ps ON ps.student_id = s.student_id
    WHERE ps.parent_id = ?
    ORDER BY s.name ASC
  `, [parent.parent_id]);

  res.json({
    parent: {
      ...parent,
      students: studentRows,
      student_count: studentRows.length,
    },
  });
});

// POST /api/admin/parents
export const createParent = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }
  const { name, phone, email, password } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Parent name is required.');
  if (!phone || !phone.trim()) throw new ApiError(400, 'Phone number is required.');

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : `parent.${trimmedPhone}@schoolbus.local`;
  const plainPassword = (password && String(password).trim()) || 'Parent@12345';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Check if user with this email already exists
    const [existingUsers] = await connection.execute(
      'SELECT id, role, is_active FROM users WHERE email = ?',
      [trimmedEmail]
    );

    let userId;
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.role !== 'PARENT') {
        throw new ApiError(409, `A user with email "${trimmedEmail}" already exists with role "${existingUser.role}".`);
      }
      userId = existingUser.id;
      // If a password was explicitly provided, update it
      if (password && String(password).trim()) {
        await connection.execute(
          'UPDATE users SET full_name = ?, phone = ?, password_hash = ? WHERE id = ?',
          [trimmedName, trimmedPhone, passwordHash, userId]
        );
      } else {
        await connection.execute(
          'UPDATE users SET full_name = ?, phone = ? WHERE id = ?',
          [trimmedName, trimmedPhone, userId]
        );
      }
    } else {
      const [userInsert] = await connection.execute(
        'INSERT INTO users (full_name, email, password_hash, role, phone, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [trimmedName, trimmedEmail, passwordHash, 'PARENT', trimmedPhone]
      );
      userId = userInsert.insertId;
    }

    const [result] = await connection.execute(
      'INSERT INTO parents (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
      [userId, trimmedName, trimmedPhone, trimmedEmail]
    );

    await connection.commit();

    const [rows] = await pool.execute(
      'SELECT parent_id, user_id, name, phone, email FROM parents WHERE parent_id = ?',
      [result.insertId]
    );

    res.status(201).json({ parent: rows[0] });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// PUT /api/admin/parents/:id
export const updateParent = asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }
  const { name, phone, email, password } = req.body;

  const [existing] = await pool.execute(
    'SELECT parent_id, user_id, name, phone, email FROM parents WHERE parent_id = ?',
    [req.params.id]
  );
  if (!existing[0]) throw new ApiError(404, 'Parent not found.');
  const currentParent = existing[0];

  const trimmedName = name !== undefined ? name.trim() : currentParent.name;
  if (!trimmedName) throw new ApiError(400, 'Parent name cannot be empty.');

  const trimmedPhone = phone !== undefined ? phone.trim() : currentParent.phone;
  if (!trimmedPhone) throw new ApiError(400, 'Phone number cannot be empty.');

  const trimmedEmail = email !== undefined ? (email ? email.trim().toLowerCase() : null) : currentParent.email;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let userId = currentParent.user_id;

    if (userId) {
      // Update linked users table record
      if (password && String(password).trim()) {
        const passwordHash = await bcrypt.hash(password.trim(), 10);
        await connection.execute(
          'UPDATE users SET full_name = ?, phone = ?, email = COALESCE(?, email), password_hash = ? WHERE id = ?',
          [trimmedName, trimmedPhone, trimmedEmail, passwordHash, userId]
        );
      } else {
        await connection.execute(
          'UPDATE users SET full_name = ?, phone = ?, email = COALESCE(?, email) WHERE id = ?',
          [trimmedName, trimmedPhone, trimmedEmail, userId]
        );
      }
    } else {
      // Create user if missing
      const loginEmail = trimmedEmail || `parent.${trimmedPhone}@schoolbus.local`;
      const plainPassword = (password && String(password).trim()) || 'Parent@12345';
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const [userInsert] = await connection.execute(
        'INSERT INTO users (full_name, email, password_hash, role, phone, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [trimmedName, loginEmail, passwordHash, 'PARENT', trimmedPhone]
      );
      userId = userInsert.insertId;
    }

    await connection.execute(
      'UPDATE parents SET user_id = ?, name = ?, phone = ?, email = ? WHERE parent_id = ?',
      [userId, trimmedName, trimmedPhone, trimmedEmail, req.params.id]
    );

    await connection.commit();

    const [rows] = await pool.execute(
      'SELECT parent_id, user_id, name, phone, email FROM parents WHERE parent_id = ?',
      [req.params.id]
    );

    res.json({ parent: rows[0] });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
});

// DELETE /api/admin/parents/:id
export const deleteParent = asyncHandler(async (req, res) => {
  const [existing] = await pool.execute(
    'SELECT parent_id, name, phone FROM parents WHERE parent_id = ?',
    [req.params.id]
  );
  const parent = existing[0];
  if (!parent) throw new ApiError(404, 'Parent not found.');

  // Check parent_students for active links
  const [[{ link_count }]] = await pool.execute(`
    SELECT COUNT(*) AS link_count
    FROM parent_students
    WHERE parent_id = ?
  `, [parent.parent_id]);

  if (Number(link_count) > 0) {
    throw new ApiError(
      409,
      `Cannot delete parent "${parent.name}": linked to ${link_count} student(s). Please unlink all students first.`
    );
  }

  await pool.execute('DELETE FROM parents WHERE parent_id = ?', [req.params.id]);

  res.json({ message: 'Parent deleted successfully.' });
});

// GET /api/admin/parents/available-students
export const getAvailableStudents = asyncHandler(async (req, res) => {
  // In a many-to-many model, all students can potentially be linked to additional parents.
  // Return all students with their currently linked parent names.
  const [students] = await pool.execute(`
    SELECT 
      s.student_id,
      s.name,
      s.class,
      s.parent_phone,
      GROUP_CONCAT(p.name SEPARATOR ', ') AS linked_parent_names
    FROM students s
    LEFT JOIN parent_students ps ON ps.student_id = s.student_id
    LEFT JOIN parents p ON p.parent_id = ps.parent_id
    GROUP BY s.student_id, s.name, s.class, s.parent_phone
    ORDER BY s.name ASC
  `);
  res.json({ students });
});

// POST /api/admin/parents/:id/students
export const linkStudent = asyncHandler(async (req, res) => {
  const parentId = parseInt(req.params.id, 10);
  if (!req.body || typeof req.body !== 'object') {
    throw new ApiError(400, 'Request body is required.');
  }
  const studentId = parseInt(req.body.student_id, 10);
  const relationshipType = (req.body.relationship_type || 'GUARDIAN').toUpperCase();
  const isPrimary = req.body.is_primary_contact !== undefined ? Boolean(req.body.is_primary_contact) : true;

  if (isNaN(studentId)) {
    throw new ApiError(400, 'Valid student_id is required.');
  }

  const validTypes = ['FATHER', 'MOTHER', 'GUARDIAN', 'OTHER'];
  if (!validTypes.includes(relationshipType)) {
    throw new ApiError(400, `Invalid relationship_type. Allowed: ${validTypes.join(', ')}`);
  }

  // 1. Verify parent exists
  const [parentRows] = await pool.execute(
    'SELECT parent_id, name, phone FROM parents WHERE parent_id = ?',
    [parentId]
  );
  const parent = parentRows[0];
  if (!parent) throw new ApiError(404, 'Parent not found.');

  // 2. Verify student exists
  const [studentRows] = await pool.execute(
    'SELECT student_id, name, class FROM students WHERE student_id = ?',
    [studentId]
  );
  const student = studentRows[0];
  if (!student) throw new ApiError(404, 'Student not found.');

  // 3. Check if link already exists in parent_students
  const [existingLink] = await pool.execute(
    'SELECT id FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parent.parent_id, student.student_id]
  );
  if (existingLink.length > 0) {
    throw new ApiError(409, `Student "${student.name}" is already linked to parent "${parent.name}".`);
  }

  // 4. Insert into parent_students
  await pool.execute(`
    INSERT INTO parent_students (parent_id, student_id, relationship_type, is_primary_contact)
    VALUES (?, ?, ?, ?)
  `, [parent.parent_id, student.student_id, relationshipType, isPrimary]);

  // 5. Query updated linked students
  const [updatedStudentRows] = await pool.execute(`
    SELECT DISTINCT
      s.student_id, s.name, s.class,
      COALESCE(ps.relationship_type, 'GUARDIAN') AS relationship_type,
      COALESCE(ps.is_primary_contact, 1) AS is_primary_contact
    FROM students s
    JOIN parent_students ps ON ps.student_id = s.student_id
    WHERE ps.parent_id = ?
    ORDER BY s.name ASC
  `, [parent.parent_id]);

  res.json({
    message: `Student "${student.name}" successfully linked to parent "${parent.name}".`,
    parent: {
      parent_id: parent.parent_id,
      name: parent.name,
      phone: parent.phone,
      students: updatedStudentRows,
      student_count: updatedStudentRows.length,
    },
    linked_student: {
      student_id: student.student_id,
      name: student.name,
      class: student.class,
      relationship_type: relationshipType,
      is_primary_contact: isPrimary,
    },
  });
});

// DELETE /api/admin/parents/:id/students/:studentId
export const unlinkStudent = asyncHandler(async (req, res) => {
  const { id: parentId, studentId } = req.params;

  // 1. Verify parent exists
  const [parentRows] = await pool.execute(
    'SELECT parent_id, name, phone FROM parents WHERE parent_id = ?',
    [parentId]
  );
  const parent = parentRows[0];
  if (!parent) throw new ApiError(404, 'Parent not found.');

  // 2. Verify student exists
  const [studentRows] = await pool.execute(
    'SELECT student_id, name, class FROM students WHERE student_id = ?',
    [studentId]
  );
  const student = studentRows[0];
  if (!student) throw new ApiError(404, 'Student not found.');

  // 3. Remove link from parent_students
  await pool.execute(
    'DELETE FROM parent_students WHERE parent_id = ? AND student_id = ?',
    [parent.parent_id, student.student_id]
  );

  // 4. Query updated linked students
  const [updatedStudentRows] = await pool.execute(`
    SELECT DISTINCT
      s.student_id, s.name, s.class,
      COALESCE(ps.relationship_type, 'GUARDIAN') AS relationship_type,
      COALESCE(ps.is_primary_contact, 1) AS is_primary_contact
    FROM students s
    JOIN parent_students ps ON ps.student_id = s.student_id
    WHERE ps.parent_id = ?
    ORDER BY s.name ASC
  `, [parent.parent_id]);

  res.json({
    message: `Student "${student.name}" successfully unlinked from parent "${parent.name}".`,
    parent: {
      parent_id: parent.parent_id,
      name: parent.name,
      phone: parent.phone,
      students: updatedStudentRows,
      student_count: updatedStudentRows.length,
    },
  });
});
