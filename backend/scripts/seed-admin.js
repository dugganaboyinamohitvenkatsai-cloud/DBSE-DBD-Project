import bcrypt from 'bcryptjs';
import { pool } from '../src/config/database.js';

const fullName = process.env.ADMIN_NAME || 'Portal Administrator';
const email = (process.env.ADMIN_EMAIL || 'admin@schoolbus.local').toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  throw new Error('ADMIN_PASSWORD must be set in backend/.env before seeding an administrator account.');
}
const passwordHash = await bcrypt.hash(password, 12);

await pool.execute(
  `INSERT INTO users (full_name, email, password_hash, role)
   VALUES (?, ?, ?, 'ADMIN')
   ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), is_active = TRUE`,
  [fullName, email, passwordHash]
);
await pool.end();
console.log(`Administrator account is ready for ${email}. Change its password after first login.`);
