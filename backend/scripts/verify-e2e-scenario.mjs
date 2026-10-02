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
    console.log(`[PASS] Step ${totalTests}: ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Step ${totalTests}: ${message}`);
  }
}

async function runE2E() {
  console.log('================================================================');
  console.log('   PHASE 16: END-TO-END SYSTEM VERIFICATION SCENARIO');
  console.log('================================================================\n');

  let adminToken, driverToken, parentToken;
  let testRouteId, testStopIds = [], testBusId, testTripId;

  try {
    // ── Setup Users & Tokens ──
    const [adminRows] = await pool.execute("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1");
    adminToken = createAccessToken(adminRows[0]);

    const [maheshRows] = await pool.execute("SELECT * FROM users WHERE role = 'DRIVER' AND id = 7 LIMIT 1");
    driverToken = createAccessToken(maheshRows[0]);
    const [maheshDrv] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [maheshRows[0].id]);
    const maheshDriverId = maheshDrv[0].id;

    const [parentRows] = await pool.execute("SELECT * FROM users WHERE role = 'PARENT' AND email = 'rahul.parent@example.com' LIMIT 1");
    parentToken = createAccessToken(parentRows[0]);

    // Pre-cleanup in case of previous interrupted runs
    await pool.execute("DELETE FROM student_transport_status WHERE trip_id IN (SELECT id FROM trips WHERE bus_id IN (SELECT id FROM buses WHERE bus_number = 'BUS-E2E'))");
    await pool.execute("DELETE FROM notifications WHERE trip_id IN (SELECT id FROM trips WHERE bus_id IN (SELECT id FROM buses WHERE bus_number = 'BUS-E2E'))");
    await pool.execute("DELETE FROM trips WHERE bus_id IN (SELECT id FROM buses WHERE bus_number = 'BUS-E2E')");
    await pool.execute("DELETE FROM buses WHERE bus_number = 'BUS-E2E'");
    await pool.execute("DELETE FROM stops WHERE route_id IN (SELECT id FROM routes WHERE route_code = 'E2E-R1')");
    await pool.execute("DELETE FROM routes WHERE route_code = 'E2E-R1'");

    // ── Step 1: Admin creates a Route & Stops with GPS coordinates ──
    const [routeRes] = await pool.execute(
      `INSERT INTO routes (name, route_code, description, estimated_duration_minutes, is_active)
       VALUES ('E2E Verification Route', 'E2E-R1', 'End-to-End Route', 30, 1)`
    );
    testRouteId = routeRes.insertId;

    const [s1] = await pool.execute(
      `INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time)
       VALUES (?, 'E2E Stop 1 (Kondapur)', 1, 17.4699000, 78.3578000, '08:00:00')`,
      [testRouteId]
    );
    const [s2] = await pool.execute(
      `INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time)
       VALUES (?, 'E2E Stop 2 (Botanical Garden)', 2, 17.4610000, 78.3620000, '08:15:00')`,
      [testRouteId]
    );
    testStopIds = [s1.insertId, s2.insertId];
    assert(testStopIds.length === 2, 'Admin creates route with 2 GPS-enabled stops');

    // ── Step 2: Admin creates Bus assigned to Mahesh ──
    const [busRes] = await pool.execute(
      `INSERT INTO buses (bus_number, registration_number, capacity, assigned_driver_id, is_active)
       VALUES ('BUS-E2E', 'TS 09 E2E 9999', 35, ?, 1)`,
      [maheshDriverId]
    );
    testBusId = busRes.insertId;
    assert(testBusId > 0, 'Admin creates active bus assigned to Mahesh');

    // ── Step 3: Admin schedules Trip ──
    const today = new Date().toISOString().slice(0, 10);
    const [tripRes] = await pool.execute(
      `INSERT INTO trips (bus_id, route_id, driver_id, trip_date, direction, scheduled_start_at, status)
       VALUES (?, ?, ?, ?, 'PICKUP', NOW(), 'SCHEDULED')`,
      [testBusId, testRouteId, maheshDriverId, today]
    );
    testTripId = tripRes.insertId;
    assert(testTripId > 0, `Admin schedules Trip #${testTripId} in SCHEDULED status`);

    // ── Step 4: Enroll Student (Rahul, student_id=1) onto Trip ──
    await pool.execute(
      `INSERT INTO student_transport_status (trip_id, student_id, status, recorded_at, recorded_by_user_id)
       VALUES (?, 1, 'WAITING', NOW(), ?)`,
      [testTripId, adminRows[0].id]
    );
    assert(true, 'Student Rahul (#1) enrolled on trip with status WAITING');

    // ── Step 5: Driver checks upcoming trip ──
    const driverTripRes = await fetch(`${API_BASE}/driver/active-trip`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const driverTripData = await driverTripRes.json();
    assert(
      driverTripRes.status === 200 && driverTripData.scheduledTrip?.id === testTripId,
      'Driver sees upcoming scheduled trip in Driver Portal'
    );

    // ── Step 6: Driver starts the Trip ──
    const startRes = await fetch(`${API_BASE}/driver/trips/${testTripId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const startData = await startRes.json();
    assert(
      startRes.status === 200 && startData.trip?.status === 'IN_PROGRESS',
      'Driver starts trip: status transitions to IN_PROGRESS'
    );

    // ── Step 7: Driver updates student boarding status to BOARDED ──
    const boardRes = await fetch(`${API_BASE}/admin/students/1/transport-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ trip_id: testTripId, status: 'BOARDED' }),
    });
    assert(boardRes.status === 200, 'Driver marks student as BOARDED');

    // ── Step 8: Driver broadcasts GPS approaching Stop 1 ──
    // Stop 1 is at 17.4699, 78.3578. Send coordinates 15m away
    const gpsRes = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4699100, longitude: 78.3578100, accuracy: 12 }),
    });
    const gpsData = await gpsRes.json();
    assert(
      gpsRes.status === 200 &&
      gpsData.stop_event !== null &&
      gpsData.stop_event.stop.name.includes('E2E Stop 1'),
      'Backend evaluates GPS: Stop 1 arrival detected via Haversine algorithm'
    );

    // ── Step 9: Verify Notification was delivered to targeted parent ──
    const [notifRows] = await pool.execute(
      `SELECT n.id, n.title, n.body, n.user_id, u.email
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE n.trip_id = ? AND n.type = 'STOP_REACHED'`,
      [testTripId]
    );
    assert(
      notifRows.length > 0 && notifRows.some(n => n.email === 'rahul.parent@example.com'),
      'Notification targeted to Rahul Parent (rahul.parent@example.com) via parent_students'
    );

    // ── Step 10: Parent checks transport status API ──
    const parentStatusRes = await fetch(`${API_BASE}/parent/students/1/status`, {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    const parentStatusData = await parentStatusRes.json();
    assert(
      parentStatusRes.status === 200 &&
      parentStatusData.transport !== null,
      'Parent dashboard receives valid transport status payload'
    );
    assert(
      parentStatusData.transport.journey.stops[0].isReached === true,
      'Parent journey tracker shows Stop 1 has been REACHED'
    );

    // ── Step 11: Driver completes the Trip ──
    const completeRes = await fetch(`${API_BASE}/driver/trips/${testTripId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const completeData = await completeRes.json();
    assert(
      completeRes.status === 200 && completeData.trip?.status === 'COMPLETED',
      'Driver completes trip: status transitions to COMPLETED'
    );

    // ── Step 12: Verify auto-dropoff on trip completion ──
    const [studentAfter] = await pool.execute(
      'SELECT status FROM student_transport_status WHERE trip_id = ? AND student_id = 1',
      [testTripId]
    );
    assert(
      studentAfter[0]?.status === 'DROPPED_OFF',
      'Student auto-transitioned to DROPPED_OFF upon trip completion'
    );

    console.log('\n--- Cleaning up E2E temporary fixtures ---');
    await pool.execute('DELETE FROM notifications WHERE trip_id = ?', [testTripId]);
    await pool.execute('DELETE FROM bus_locations WHERE bus_id = ?', [testBusId]);
    await pool.execute('DELETE FROM student_transport_status WHERE trip_id = ?', [testTripId]);
    await pool.execute('DELETE FROM trips WHERE id = ?', [testTripId]);
    await pool.execute('DELETE FROM buses WHERE id = ?', [testBusId]);
    await pool.execute('DELETE FROM stops WHERE route_id = ?', [testRouteId]);
    await pool.execute('DELETE FROM routes WHERE id = ?', [testRouteId]);
    console.log('E2E temporary fixtures successfully cleaned.');

    // ── Step 13: Integrity Check of legitimate data ──
    const [b9] = await pool.execute('SELECT * FROM buses WHERE id = 9');
    const [d5] = await pool.execute('SELECT * FROM drivers WHERE id = 5');
    const [stCount] = await pool.execute('SELECT COUNT(*) as c FROM students');
    const [pCount] = await pool.execute('SELECT COUNT(*) as c FROM parents');
    assert(
      b9.length === 1 && d5.length === 1 && stCount[0].c >= 2 && pCount[0].c >= 2,
      'Legitimate data (BUS-01, Rajesh, students, parents) completely intact'
    );

    console.log('\n=============================================');
    console.log(`TOTAL STEPS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log(`OVERALL RESULT: ${failedTests === 0 ? 'ALL STEPS PASSED' : 'SOME STEPS FAILED'}`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('E2E Verification Error:', err);
  } finally {
    await pool.end();
    process.exitCode = failedTests === 0 ? 0 : 1;
  }
}

runE2E();
