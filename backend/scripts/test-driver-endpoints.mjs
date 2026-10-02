import { pool } from '../src/config/database.js';
import { createAccessToken } from '../src/utils/token.js';

const API_BASE = 'http://localhost:5000/api';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] Test ${totalTests}: ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Test ${totalTests}: ${message}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('       DRIVER DASHBOARD & TRIP ACTIONS TEST SUITE');
  console.log('================================================================\n');

  try {
    // 1. Get Rajesh (driver_id=5, user_id=6)
    const [rajeshUser] = await pool.execute("SELECT * FROM users WHERE role = 'DRIVER' AND id = 6 LIMIT 1");
    const rajeshToken = createAccessToken(rajeshUser[0]);

    // 2. Get Mahesh (driver_id=6, user_id=7)
    const [maheshUser] = await pool.execute("SELECT * FROM users WHERE role = 'DRIVER' AND id = 7 LIMIT 1");
    const maheshToken = createAccessToken(maheshUser[0]);

    // ── Test 1: GET /api/driver/trips returns assigned trips ──
    const res1 = await fetch(`${API_BASE}/driver/trips`, {
      headers: { Authorization: `Bearer ${rajeshToken}` },
    });
    const res1Data = await res1.json();
    assert(res1.status === 200 && Array.isArray(res1Data.trips), 'Rajesh retrieves assigned trips list');
    assert(res1Data.trips.length > 0 && res1Data.trips.some(t => t.id === 14), 'Trip 14 is present in Rajesh assigned trips');

    // ── Test 2: GET /api/driver/active-trip detects stale Trip 14 and supports today's active trip ──
    const res2Stale = await fetch(`${API_BASE}/driver/active-trip`, {
      headers: { Authorization: `Bearer ${rajeshToken}` },
    });
    const res2StaleData = await res2Stale.json();
    assert(res2Stale.status === 200 && res2StaleData.activeTrip === null, 'Rajesh active-trip excludes stale historical Trip 14');
    assert(res2StaleData.staleTrip === null || res2StaleData.staleTrip?.id === 14, 'Stale historical trip candidate handled properly');

    // Create a temporary active trip for TODAY to verify active telemetry data
    const todayStr = new Date().toISOString().slice(0, 10);
    const [insTrip] = await pool.execute(`
      INSERT INTO trips (bus_id, route_id, driver_id, trip_date, scheduled_start_at, started_at, status, direction)
      VALUES (9, 10, 5, ?, NOW(), NOW(), 'IN_PROGRESS', 'PICKUP')
    `, [todayStr]);
    const todayTripId = insTrip.insertId;

    // Link a student record to today's trip
    await pool.execute(`
      INSERT INTO student_transport_status (trip_id, student_id, status, recorded_at)
      VALUES (?, 1, 'WAITING', NOW())
    `, [todayTripId]);

    const res2 = await fetch(`${API_BASE}/driver/active-trip`, {
      headers: { Authorization: `Bearer ${rajeshToken}` },
    });
    const res2Data = await res2.json();
    assert(res2.status === 200 && res2Data.activeTrip !== null, "Rajesh active-trip returns today's active trip");
    assert(res2Data.activeTrip?.id === todayTripId, `Active trip ID is ${todayTripId}`);
    assert(typeof res2Data.activeTrip?.student_count === 'number', 'Active trip includes student_count');

    // Clean up temporary today trip
    await pool.execute('DELETE FROM student_transport_status WHERE trip_id = ?', [todayTripId]);
    await pool.execute('DELETE FROM trips WHERE id = ?', [todayTripId]);

    // ── Test 3: GET /api/driver/trips/:id/students returns students for Trip 14 ──
    const res3 = await fetch(`${API_BASE}/driver/trips/14/students`, {
      headers: { Authorization: `Bearer ${rajeshToken}` },
    });
    const res3Data = await res3.json();
    assert(res3.status === 200 && Array.isArray(res3Data.students), 'GET /driver/trips/14/students returns student roster');
    assert(res3Data.students.length > 0 && res3Data.students[0].student_name === 'Rahul', 'Rahul is enrolled on Trip 14 with transport status');

    // ── Test 4: Driver cannot start a trip assigned to another driver ──
    // Mahesh attempts to start Rajesh's Trip 14
    const res4 = await fetch(`${API_BASE}/driver/trips/14/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${maheshToken}` },
    });
    assert(res4.status === 403, 'Mahesh rejected with 403 when trying to start Rajesh trip');

    // ── Test 5: Driver cannot complete a trip assigned to another driver ──
    const res5 = await fetch(`${API_BASE}/driver/trips/14/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${maheshToken}` },
    });
    assert(res5.status === 403, 'Mahesh rejected with 403 when trying to complete Rajesh trip');

    // ── Test 6: Unauthenticated request rejected with 401 ──
    const res6 = await fetch(`${API_BASE}/driver/trips`);
    assert(res6.status === 401, 'Unauthenticated /driver/trips rejected with 401');

    // ── Test 7: Parent role rejected with 403 ──
    const parentToken = createAccessToken({ id: 9999, role: 'PARENT' });
    const res7 = await fetch(`${API_BASE}/driver/trips`, {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    assert(res7.status === 403, 'Parent role rejected with 403');

    console.log('\n=============================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log(`OVERALL RESULT: ${failedTests === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log('=============================================\n');
  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await pool.end();
    process.exitCode = failedTests === 0 ? 0 : 1;
  }
}

run();
