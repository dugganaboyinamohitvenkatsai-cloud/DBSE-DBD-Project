import { pool } from '../src/config/database.js';

async function diagnose() {
  console.log('=== DIAGNOSING USERS TABLE ===');
  const [users] = await pool.execute(
    'SELECT id, email, role, is_active, (password_hash IS NOT NULL AND LENGTH(password_hash) > 0) AS has_password FROM users'
  );
  console.log(JSON.stringify(users, null, 2));

  console.log('\n=== DIAGNOSING PARENTS TABLE ===');
  const [parents] = await pool.execute(
    'SELECT parent_id, user_id, name, phone FROM parents'
  );
  console.log(JSON.stringify(parents, null, 2));

  await pool.end();
}

diagnose().catch(console.error);
