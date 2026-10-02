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

async function runTests() {
  console.log('================================================================');
  console.log('  REDBUS LIVE BUS TRACKING & STOP NOTIFICATIONS TEST SUITE');
  console.log('================================================================\n');

  let adminToken, driverToken, parentToken;
  let testRouteId, testStopIds = [], testBusId, testDriverUserId, testDriverProfileId, testTripId;
  const createdTestNotificationIds = [];
  const createdLocationIds = [];

  try {
    // ── Pre-check: Verify initial state of legitimate data ──
    const [origBuses] = await pool.execute('SELECT id, bus_number FROM buses WHERE id = 9');
    assert(origBuses.length === 1 && origBuses[0].bus_number === 'BUS-01', 'BUS-01 (#9) exists before test');

    const [origDrivers] = await pool.execute('SELECT id, employee_code FROM drivers WHERE id = 5');
    assert(origDrivers.length === 1 && origDrivers[0].employee_code === 'DRV-101', 'Rajesh (#5) exists before test');

    const [adminUser] = await pool.execute("SELECT * FROM users WHERE role = 'ADMIN' LIMIT 1");
    adminToken = createAccessToken(adminUser[0]);

    // Use Mahesh (user id=7, driver profile id=6) for stop-detection tests — he has NO active trips,
    // so the controller will pick testTripId cleanly.
    const [driverUser] = await pool.execute("SELECT * FROM users WHERE role = 'DRIVER' AND id = 7 LIMIT 1");
    driverToken = createAccessToken(driverUser[0]);
    // Resolve Mahesh's driver profile id for trip fixture
    const [maheshRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [driverUser[0].id]);
    const maheshDriverProfileId = maheshRows[0]?.id;

    // Create / mock a parent user token for auth testing
    const parentUser = { id: 9999, role: 'PARENT' };
    parentToken = createAccessToken(parentUser);

    // ── Test 1: Unauthenticated GPS update rejected ──
    const res1 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 17.45, longitude: 78.38, accuracy: 10 }),
    });
    assert(res1.status === 401, 'Unauthenticated GPS update returns 401');

    // ── Test 2: Unauthorized role (PARENT) rejected ──
    const res2 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${parentToken}`,
      },
      body: JSON.stringify({ latitude: 17.45, longitude: 78.38, accuracy: 10 }),
    });
    assert(res2.status === 403, 'Unauthorized role (PARENT) rejected with 403');

    // ── Test 3: Driver with no active trip rejected ──
    // Create a temporary driver with no active trips
    const [tempUserRes] = await pool.execute(
      "INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES ('Temp Driver', 'temp.driver@test.local', 'hash', 'DRIVER', 1)"
    );
    const tempDriverUserId = tempUserRes.insertId;
    const [tempDrvRes] = await pool.execute(
      "INSERT INTO drivers (user_id, employee_code, license_number, license_expiry) VALUES (?, 'DRV-TEMP', 'DL-TEMP', '2030-01-01')",
      [tempDriverUserId]
    );
    const tempDriverId = tempDrvRes.insertId;
    const tempDriverToken = createAccessToken({ id: tempDriverUserId, role: 'DRIVER' });

    const res3 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tempDriverToken}`,
      },
      body: JSON.stringify({ latitude: 17.45, longitude: 78.38, accuracy: 10 }),
    });
    const res3Data = await res3.json();
    assert(res3.status === 409 && res3Data.message.includes('No active trip found'), 'Driver with no active trip rejected with 409');

    // Clean up temp driver
    await pool.execute('DELETE FROM drivers WHERE id = ?', [tempDriverId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [tempDriverUserId]);

    // ── Setup Fixture for Stop Arrival Detection Testing ──
    // Create a realistic Hyderabad route: "Kondapur - Hitec City Express"
    const [routeRes] = await pool.execute(
      "INSERT INTO routes (name, route_code, description, estimated_duration_minutes, is_active) VALUES ('Kondapur Express', 'KP-EXP', 'Test route', 30, 1)"
    );
    testRouteId = routeRes.insertId;

    // 3 Stops with coordinates in Hyderabad
    // Stop 1: Kondapur Signal (17.4699, 78.3578)
    // Stop 2: Botanical Garden (17.4610, 78.3620)
    // Stop 3: Hitec City Metro (17.4485, 78.3810)
    const [s1] = await pool.execute(
      "INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time) VALUES (?, 'Kondapur Signal', 1, 17.4699000, 78.3578000, '08:00:00')",
      [testRouteId]
    );
    const [s2] = await pool.execute(
      "INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time) VALUES (?, 'Botanical Garden', 2, 17.4610000, 78.3620000, '08:10:00')",
      [testRouteId]
    );
    const [s3] = await pool.execute(
      "INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time) VALUES (?, 'Hitec City Metro', 3, 17.4485000, 78.3810000, '08:25:00')",
      [testRouteId]
    );
    testStopIds = [s1.insertId, s2.insertId, s3.insertId];

    // Create a temporary bus assigned to Mahesh (no active trips)
    const [tBus] = await pool.execute(
      `INSERT INTO buses (bus_number, registration_number, capacity, assigned_driver_id, is_active) VALUES ('BUS-TRACK-01', 'TS 09 TEST 1111', 40, ?, 1)`,
      [maheshDriverProfileId]
    );
    testBusId = tBus.insertId;

    // Create an active test trip (IN_PROGRESS) assigned to Mahesh
    const [tTrip] = await pool.execute(
      `INSERT INTO trips (bus_id, route_id, driver_id, trip_date, direction, scheduled_start_at, started_at, status)
       VALUES (?, ?, ?, CURDATE(), 'PICKUP', NOW(), NOW(), 'IN_PROGRESS')`,
      [testBusId, testRouteId, maheshDriverProfileId]
    );
    testTripId = tTrip.insertId;

    // ── Test 4: Invalid latitude rejected ──
    const res4 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 95.0, longitude: 78.38, accuracy: 10 }),
    });
    assert(res4.status === 400, 'Invalid latitude (> 90) rejected with 400');

    // ── Test 5: Invalid longitude rejected ──
    const res5 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.46, longitude: -200, accuracy: 10 }),
    });
    assert(res5.status === 400, 'Invalid longitude (< -180) rejected with 400');

    // ── Test 6: Invalid accuracy rejected ──
    const res6 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.46, longitude: 78.38, accuracy: -5 }),
    });
    assert(res6.status === 400, 'Negative accuracy rejected with 400');

    // ── Test 7: GPS point far from any stop does not trigger stop arrival ──
    // Coordinates in Secunderabad (17.4399, 78.4983) ~15km away
    const res7 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4399, longitude: 78.4983, accuracy: 10 }),
    });
    const res7Data = await res7.json();
    assert(res7.status === 200 && res7Data.stop_event === null, 'GPS outside arrival radius does not trigger stop arrival');

    // Verify location saved to bus_locations
    const [bLocs] = await pool.execute('SELECT id, bus_id, source FROM bus_locations WHERE bus_id = ?', [testBusId]);
    assert(bLocs.length > 0 && bLocs[0].source === 'DRIVER_APP', 'GPS point persisted in bus_locations with source DRIVER_APP');

    // ── Test 8: Approaching Stop 1 triggers Stop 1 Arrival ──
    // Kondapur Signal is at (17.4699000, 78.3578000). Send coordinates 20m away (17.4699100, 78.3578100)
    const res8 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4699100, longitude: 78.3578100, accuracy: 15 }),
    });
    const res8Data = await res8.json();
    assert(
      res8.status === 200 &&
      res8Data.stop_event !== null &&
      res8Data.stop_event.stop.name === 'Kondapur Signal' &&
      res8Data.stop_event.is_final_stop === false,
      'Stop 1 arrival detected when approaching Kondapur Signal'
    );

    // Verify in-app notifications were created
    const [notifRows1] = await pool.execute(
      'SELECT id, title, type FROM notifications WHERE trip_id = ? AND type = "STOP_REACHED"',
      [testTripId]
    );
    assert(notifRows1.length > 0 && notifRows1[0].title.includes('Kondapur Signal'), 'STOP_REACHED notification saved in database for Stop 1');

    // ── Test 9: Duplicate Prevention — Second GPS point near Stop 1 does NOT trigger duplicate notification ──
    const res9 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4699200, longitude: 78.3578200, accuracy: 10 }),
    });
    const res9Data = await res9.json();
    assert(res9.status === 200 && res9Data.stop_event === null, 'Duplicate arrival near Stop 1 produces NO duplicate notification');

    const [notifRows2] = await pool.execute(
      'SELECT COUNT(*) as c FROM notifications WHERE trip_id = ? AND type = "STOP_REACHED"',
      [testTripId]
    );
    assert(notifRows2[0].c === notifRows1.length, 'Notification count remains unchanged after duplicate GPS update');

    // ── Test 10: Approaching Stop 2 triggers Stop 2 Arrival ──
    // Botanical Garden is at (17.4610000, 78.3620000). Send coordinates 30m away
    const res10 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4610200, longitude: 78.3620200, accuracy: 12 }),
    });
    const res10Data = await res10.json();
    assert(
      res10.status === 200 &&
      res10Data.stop_event !== null &&
      res10Data.stop_event.stop.name === 'Botanical Garden' &&
      res10Data.stop_event.is_final_stop === false,
      'Stop 2 arrival detected sequentially for Botanical Garden'
    );

    // ── Test 11: Approaching Stop 3 triggers FINAL STOP Arrival ──
    // Hitec City Metro is at (17.4485000, 78.3810000). Final stop on route!
    const res11 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.4485100, longitude: 78.3810100, accuracy: 8 }),
    });
    const res11Data = await res11.json();
    assert(
      res11.status === 200 &&
      res11Data.stop_event !== null &&
      res11Data.stop_event.stop.name === 'Hitec City Metro' &&
      res11Data.stop_event.is_final_stop === true,
      'Final stop arrival detected with is_final_stop = true'
    );

    // ── Test 12: GET /api/trips/:tripId/journey returns RedBus progression ──
    const res12 = await fetch(`${API_BASE}/trips/${testTripId}/journey`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res12Data = await res12.json();
    assert(
      res12.status === 200 &&
      res12Data.journey.total_stops === 3 &&
      res12Data.journey.reached_stops_count === 3 &&
      res12Data.journey.remaining_stops_count === 0 &&
      res12Data.journey.stops[0].isReached === true &&
      res12Data.journey.stops[1].isReached === true &&
      res12Data.journey.stops[2].isReached === true,
      'RedBus live journey endpoint returns correct dynamic stop progression (all 3 reached)'
    );

    // ── Test 13: GET /api/admin/trips/:id/location returns live telemetry ──
    const res13 = await fetch(`${API_BASE}/admin/trips/${testTripId}/location`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res13Data = await res13.json();
    assert(
      res13.status === 200 &&
      res13Data.latitude === 17.44851 &&
      res13Data.longitude === 78.38101 &&
      res13Data.is_stale === false,
      'Admin trip location telemetry endpoint returns live coordinates and fresh status'
    );

    // ── Test 14: GET /api/driver/active-trip returns active trip and stops ──
    const res14 = await fetch(`${API_BASE}/driver/active-trip`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const res14Data = await res14.json();
    assert(
      res14.status === 200 &&
      res14Data.activeTrip !== null &&
      res14Data.activeTrip.id === testTripId &&
      res14Data.activeTrip.stops.length === 3,
      'Driver active-trip endpoint returns current active trip and ordered route stops'
    );

    // ── Test 15: Trip in COMPLETED status rejects GPS updates ──
    // Pass trip_id explicitly so backend rejects THIS specific trip, not the real trip #14
    await pool.execute("UPDATE trips SET status = 'COMPLETED' WHERE id = ?", [testTripId]);
    const res15 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.46, longitude: 78.38, accuracy: 10, trip_id: testTripId }),
    });
    assert(res15.status === 409, 'Completed trip rejected with 409 Conflict');

    // ── Test 16: Trip in CANCELLED status rejects GPS updates ──
    await pool.execute("UPDATE trips SET status = 'CANCELLED' WHERE id = ?", [testTripId]);
    const res16 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ latitude: 17.46, longitude: 78.38, accuracy: 10, trip_id: testTripId }),
    });
    assert(res16.status === 409, 'Cancelled trip rejected with 409 Conflict');

    // ── Clean Up Test Fixtures ──
    console.log('\n--- Cleaning up temporary test fixtures ---');
    await pool.execute('DELETE FROM notifications WHERE trip_id = ?', [testTripId]);
    await pool.execute('DELETE FROM bus_locations WHERE bus_id = ?', [testBusId]);
    // Also remove any stray DRIVER_APP locations on the real bus (bus_id=9) from
    // previous test runs where trip_id was not yet passed explicitly
    await pool.execute("DELETE FROM bus_locations WHERE bus_id = 9 AND source = 'DRIVER_APP'");
    await pool.execute('DELETE FROM trips WHERE id = ?', [testTripId]);
    await pool.execute('DELETE FROM buses WHERE id = ?', [testBusId]);
    await pool.execute('DELETE FROM stops WHERE route_id = ?', [testRouteId]);
    await pool.execute('DELETE FROM routes WHERE id = ?', [testRouteId]);
    console.log('Temporary test fixtures successfully deleted.');

    // ── Final Verification of Legitimate Data ──
    console.log('\n--- Verifying Integrity of Legitimate Data ---');
    const [b9] = await pool.execute('SELECT * FROM buses WHERE id = 9');
    assert(b9.length === 1 && b9[0].bus_number === 'BUS-01' && b9[0].assigned_driver_id === 5, 'BUS-01 (#9) intact with assigned driver 5');

    const [d5] = await pool.execute('SELECT * FROM drivers WHERE id = 5');
    assert(d5.length === 1 && d5[0].employee_code === 'DRV-101', 'Rajesh (#5) intact with DRV-101');

    const [d6] = await pool.execute('SELECT * FROM drivers WHERE id = 6');
    assert(d6.length === 1 && d6[0].employee_code === 'DRV-102', 'Mahesh (#6) intact with DRV-102');

    const [stRows] = await pool.execute('SELECT count(*) as c FROM students');
    assert(stRows[0].c >= 2, 'Students count preserved (at least 2 students exist)');

    const [pRows] = await pool.execute('SELECT count(*) as c FROM parents');
    assert(pRows[0].c >= 2, 'Parents count preserved (at least 2 parents exist)');

    const [r10] = await pool.execute('SELECT id, route_code FROM routes WHERE id = 10');
    assert(r10.length === 1 && r10[0].route_code === 'BHEL', 'Route #10 intact with BHEL');

    const [cleanLocs] = await pool.execute('SELECT count(*) as c FROM bus_locations WHERE bus_id = ?', [testBusId]);
    assert(cleanLocs[0].c === 0, 'bus_locations cleaned (0 test records remain)');

    const [cleanNotifs] = await pool.execute('SELECT count(*) as c FROM notifications WHERE trip_id = ?', [testTripId]);
    assert(cleanNotifs[0].c === 0, 'notifications cleaned (0 test records remain)');

    console.log('\n=============================================');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log(`OVERALL RESULT: ${failedTests === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Test suite error:', err);
    process.exit(1);
  } finally {
    process.exit(failedTests === 0 ? 0 : 1);
  }
}

runTests();
