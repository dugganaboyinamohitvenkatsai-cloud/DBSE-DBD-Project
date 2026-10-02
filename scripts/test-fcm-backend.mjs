import { pool } from '../backend/src/config/database.js';
import { createAccessToken } from '../backend/src/utils/token.js';

const BASE_URL = 'http://localhost:5000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${totalTests}. ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${totalTests}. ${message}`);
  }
}

async function runFcmValidation() {
  console.log('===============================================================');
  console.log('  BACKEND FCM & PARENT DEVICE-TOKEN VALIDATION SUITE');
  console.log('===============================================================\n');

  try {
    // Checkpoint 1: Backend Health
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'ok', 'Backend starts and runs health probe without Firebase credentials');

    // Retrieve test accounts
    const [parents] = await pool.execute(`
      SELECT p.parent_id, p.user_id, u.email, u.phone, u.role
      FROM parents p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.parent_id ASC
    `);

    const parent1 = parents[0]; // e.g. Rahul Parent (user_id 22)
    const parent2 = parents[1]; // e.g. Mohit Father (user_id 23)

    const tokenParent1 = createAccessToken({ id: parent1.user_id, role: 'PARENT' });
    const tokenParent2 = createAccessToken({ id: parent2.user_id, role: 'PARENT' });

    const [driverRows] = await pool.execute("SELECT id, role FROM users WHERE role = 'DRIVER' LIMIT 1");
    const tokenDriver = createAccessToken({ id: driverRows[0].id, role: 'DRIVER' });

    // Checkpoint 2: Parent Login via auth API
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: parent1.email, password: 'Parent@12345' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.user?.role === 'PARENT', 'Existing parent login succeeds and returns PARENT role JWT');

    // Checkpoint 3: POST /api/parent/device-token works for PARENT
    const testToken1 = 'fcm_test_token_parent1_' + Date.now();
    const postRes1 = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenParent1}`,
      },
      body: JSON.stringify({ token: testToken1, platform: 'android' }),
    });
    const postData1 = await postRes1.json();
    assert(postRes1.status === 200 && postData1.success === true, 'POST /api/parent/device-token succeeds for authenticated PARENT');

    // Verify persisted record in device_tokens
    const [dtRows1] = await pool.execute(
      'SELECT user_id, token, platform FROM device_tokens WHERE token = ?',
      [testToken1]
    );
    assert(
      dtRows1.length === 1 && dtRows1[0].user_id === parent1.user_id && dtRows1[0].platform === 'android',
      'Device token correctly persisted in device_tokens associated with req.auth.sub'
    );

    // Checkpoint 4: Re-registering duplicate token updates safely without errors
    const rePostRes = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenParent1}`,
      },
      body: JSON.stringify({ token: testToken1, platform: 'android' }),
    });
    assert(rePostRes.status === 200, 'Duplicate device token re-registration handled gracefully (ON DUPLICATE KEY UPDATE)');

    // Checkpoint 5: DRIVER cannot access parent device-token endpoint (Role security)
    const driverAccessRes = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenDriver}`,
      },
      body: JSON.stringify({ token: 'driver_fcm_attempt', platform: 'android' }),
    });
    assert(driverAccessRes.status === 403, 'DRIVER role rejected with HTTP 403 from parent device-token endpoint');

    // Checkpoint 6: Unauthenticated request rejected
    const unauthRes = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'unauth_attempt' }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

    // Checkpoint 7: Cross-parent tenant isolation (Parent 2 cannot delete Parent 1 token)
    const crossDeleteRes = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenParent2}`,
      },
      body: JSON.stringify({ token: testToken1 }),
    });
    const crossDeleteData = await crossDeleteRes.json();
    assert(crossDeleteData.deleted === false, 'Tenant isolation verified: Parent 2 cannot delete Parent 1 device token');

    // Verify token 1 is STILL in database
    const [stillThere] = await pool.execute('SELECT token FROM device_tokens WHERE token = ?', [testToken1]);
    assert(stillThere.length === 1, 'Parent 1 device token remained protected in database');

    // Checkpoint 8: Parent 1 deletes own device token
    const ownDeleteRes = await fetch(`${BASE_URL}/parent/device-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenParent1}`,
      },
      body: JSON.stringify({ token: testToken1 }),
    });
    const ownDeleteData = await ownDeleteRes.json();
    assert(ownDeleteRes.status === 200 && ownDeleteData.deleted === true, 'Parent 1 successfully unregisters own device token on sign-out');

    // Checkpoint 9: In-app notification creation & flow preserved
    const notifRes = await fetch(`${BASE_URL}/parent/notifications`, {
      headers: { Authorization: `Bearer ${tokenParent1}` },
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200 && Array.isArray(notifData.notifications), 'GET /api/parent/notifications retrieves in-app notifications cleanly');

    // Checkpoint 10: Parent Dashboard returns children & real transit state
    const dashRes = await fetch(`${BASE_URL}/parent/dashboard`, {
      headers: { Authorization: `Bearer ${tokenParent1}` },
    });
    const dashData = await dashRes.json();
    assert(dashRes.status === 200 && Array.isArray(dashData.children), 'GET /api/parent/dashboard returns linked children with transit structures');

    // Checkpoint 11: Driver trip endpoints still work
    const driverTripsRes = await fetch(`${BASE_URL}/driver/trips`, {
      headers: { Authorization: `Bearer ${tokenDriver}` },
    });
    assert(driverTripsRes.status === 200, 'Existing driver trips API continues functioning with zero degradation');

    console.log('\n===============================================================');
    console.log(`  VALIDATION SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');

    await pool.end();
    if (failedTests > 0) process.exit(1);
  } catch (err) {
    console.error('Validation script encountered error:', err);
    await pool.end();
    process.exit(1);
  }
}

runFcmValidation();
