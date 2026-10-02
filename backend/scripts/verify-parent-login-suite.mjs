import { pool } from '../src/config/database.js';

const BASE_URL = 'http://localhost:5000/api';

async function testParentAuth() {
  console.log('====================================================');
  console.log('TESTING PARENT AUTHENTICATION & DASHBOARD FLOWS');
  console.log('====================================================\n');

  // 1. Test parent login with email and Portal@2025
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul.parent@example.com', password: 'Portal@2025' }),
    });
    const data = await res.json();
    console.log('[1] Login with Portal@2025:', res.status === 200 ? 'SUCCESS' : 'FAILED', `(role: ${data.user?.role})`);
    if (!res.ok) throw new Error('Portal@2025 failed');
  }

  // 2. Test parent login with email and Parent@12345
  let parentToken = '';
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul.parent@example.com', password: 'Parent@12345' }),
    });
    const data = await res.json();
    console.log('[2] Login with Parent@12345:', res.status === 200 ? 'SUCCESS' : 'FAILED', `(role: ${data.user?.role})`);
    if (!res.ok) throw new Error('Parent@12345 failed');
    parentToken = data.token;
  }

  // 3. Test parent login using phone number
  {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '9876543210', password: 'Parent@12345' }),
    });
    const data = await res.json();
    console.log('[3] Login with Phone number 9876543210:', res.status === 200 ? 'SUCCESS' : 'FAILED', `(email: ${data.user?.email})`);
    if (!res.ok) throw new Error('Phone login failed');
  }

  // 4. Test /api/parent/me
  {
    const res = await fetch(`${BASE_URL}/parent/me`, {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    const data = await res.json();
    console.log('[4] /api/parent/me:', res.status === 200 ? 'SUCCESS' : 'FAILED', `(parent: ${data.parent?.name}, user_id: ${data.parent?.user_id})`);
    if (!res.ok || !data.parent?.user_id) throw new Error('/api/parent/me failed');
  }

  // 5. Test /api/parent/dashboard
  {
    const res = await fetch(`${BASE_URL}/parent/dashboard`, {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    const data = await res.json();
    console.log('[5] /api/parent/dashboard:', res.status === 200 ? 'SUCCESS' : 'FAILED', `(children: ${data.children?.length})`);
    if (!res.ok || !data.parent) throw new Error('/api/parent/dashboard failed');
  }

  // 6. Test Admin Parent creation with password and verifying newly created parent can authenticate!
  {
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@schoolbus.local', password: 'Admin@12345' }),
    });
    const { token: adminToken } = await adminLoginRes.json();

    const uniquePhone = '99999' + Math.floor(10000 + Math.random() * 90000);
    const uniqueEmail = `test.parent.${uniquePhone}@example.com`;
    const createRes = await fetch(`${BASE_URL}/admin/parents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Auto QA Test Parent',
        phone: uniquePhone,
        email: uniqueEmail,
        password: 'CustomPassword@2026',
      }),
    });
    const createData = await createRes.json();
    console.log('[6] Admin create parent:', createRes.status === 201 ? 'SUCCESS' : 'FAILED', `(user_id: ${createData.parent?.user_id})`);
    if (!createRes.ok || !createData.parent?.user_id) throw new Error('Create parent failed');

    // Authenticate with the newly created parent's credentials!
    const newParentLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'CustomPassword@2026' }),
    });
    const newParentData = await newParentLogin.json();
    console.log('[7] Newly created parent login:', newParentLogin.status === 200 ? 'SUCCESS' : 'FAILED', `(role: ${newParentData.user?.role})`);
    if (!newParentLogin.ok || newParentData.user?.role !== 'PARENT') throw new Error('New parent login failed');

    // Clean up created parent and user
    await pool.execute('DELETE FROM parents WHERE parent_id = ?', [createData.parent.parent_id]);
    await pool.execute('DELETE FROM users WHERE id = ?', [createData.parent.user_id]);
    console.log('[8] Cleaned up temporary QA parent');
  }

  console.log('\nALL 8 PARENT AUTHENTICATION TESTS PASSED PERFECTLY!');
  await pool.end();
  process.exit(0);
}

testParentAuth().catch(async (err) => {
  console.error('Test error:', err);
  await pool.end();
  process.exit(1);
});
