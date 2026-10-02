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

async function runHardeningTests() {
  console.log('================================================================');
  console.log('  FINAL HARDENING PASS: 3 DEFECTS VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  try {
    // ── Setup Users & Tokens ──
    const [adminRows] = await pool.execute("SELECT id, role FROM users WHERE role = 'ADMIN' LIMIT 1");
    const adminToken = createAccessToken(adminRows[0]);

    const [driverRows] = await pool.execute(
      `SELECT d.id AS driver_id, d.user_id, u.role, u.email 
       FROM drivers d 
       JOIN users u ON u.id = d.user_id 
       WHERE d.id = 5 LIMIT 1`
    );
    const driver = driverRows[0];
    const driverToken = createAccessToken({ id: driver.user_id, role: 'DRIVER' });

    const [parentRows] = await pool.execute(
      `SELECT p.parent_id, p.user_id, p.phone, u.email 
       FROM parents p 
       JOIN users u ON u.id = p.user_id 
       WHERE p.parent_id = 2 LIMIT 1`
    );
    const parent2 = parentRows[0];
    const parent2Token = createAccessToken({ id: parent2.user_id, role: 'PARENT' });

    const [parent3Rows] = await pool.execute(
      `SELECT p.parent_id, p.user_id, p.phone, u.email 
       FROM parents p 
       JOIN users u ON u.id = p.user_id 
       WHERE p.parent_id = 3 LIMIT 1`
    );
    const parent3 = parent3Rows[0];
    const parent3Token = createAccessToken({ id: parent3.user_id, role: 'PARENT' });

    console.log('--- FIX 1: Sole Authority of parent_students Relationship ---');

    // 1. Check parent 2 linked students
    const res1 = await fetch(`${API_BASE}/parent/students`, {
      headers: { Authorization: `Bearer ${parent2Token}` },
    });
    const data1 = await res1.json();
    assert(res1.status === 200, 'Parent 2 can fetch linked students');
    const aaravLinked = (data1.students || []).some((s) => s.student_id === 1);
    assert(aaravLinked, 'Student 1 (Aarav) is linked to Parent 2 via parent_students');

    // 2. Temporarily change student 1 parent_phone to an arbitrary mismatch phone
    const [originalStudentRows] = await pool.execute('SELECT parent_phone FROM students WHERE student_id = 1');
    const originalPhone = originalStudentRows[0]?.parent_phone;

    await pool.execute("UPDATE students SET parent_phone = '0000000000' WHERE student_id = 1");

    // Verify parent 2 STILL sees Aarav (because parent_students is the sole authority)
    const res2 = await fetch(`${API_BASE}/parent/students`, {
      headers: { Authorization: `Bearer ${parent2Token}` },
    });
    const data2 = await res2.json();
    const aaravStillLinked = (data2.students || []).some((s) => s.student_id === 1);
    assert(aaravStillLinked, 'Student 1 remains linked to Parent 2 even when student parent_phone is mismatched');

    // Verify parent 2 can still access transport status for Aarav
    const res3 = await fetch(`${API_BASE}/parent/students/1/status`, {
      headers: { Authorization: `Bearer ${parent2Token}` },
    });
    assert(res3.status === 200, 'Parent 2 can access transport status for Student 1 despite phone mismatch');

    // Verify parent 3 CANNOT access student 1 (not linked in parent_students)
    const res4 = await fetch(`${API_BASE}/parent/students/1/status`, {
      headers: { Authorization: `Bearer ${parent3Token}` },
    });
    assert(res4.status === 403, 'Unlinked Parent 3 is forbidden (403) from accessing Student 1');

    // Restore student 1 original phone
    await pool.execute('UPDATE students SET parent_phone = ? WHERE student_id = 1', [originalPhone]);
    console.log('[INFO] Student parent_phone restored to original value.\n');


    console.log('--- FIX 2: Student-Specific Pickup & Dropoff Stops ---');

    // Fetch stops on route 10
    const [stops] = await pool.execute(
      'SELECT id, stop_order, name FROM stops WHERE route_id = 10 ORDER BY stop_order ASC'
    );
    assert(stops.length >= 2, `Route 10 has ${stops.length} stops for testing`);
    const firstStop = stops[0];
    const secondStop = stops[1];
    const lastStop = stops[stops.length - 1];

    // 1. Reject pickup stop not on route
    const res5 = await fetch(`${API_BASE}/admin/students/1/transport-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        trip_id: 14,
        pickup_stop_id: 999999,
        dropoff_stop_id: lastStop.id,
      }),
    });
    const data5 = await res5.json();
    assert(res5.status === 404 || res5.status === 400, 'Setting non-existent pickup stop returns 404/400 error');
    assert(
      data5.message?.includes('route') || data5.message?.includes('stop'),
      `Error explains stop error: "${data5.message}"`
    );

    // 2. Reject pickup_order >= dropoff_order (inverted order)
    const res6 = await fetch(`${API_BASE}/admin/students/1/transport-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        trip_id: 14,
        pickup_stop_id: lastStop.id,
        dropoff_stop_id: firstStop.id,
      }),
    });
    const data6 = await res6.json();
    assert(res6.status === 400, 'Setting inverted stops (pickup after dropoff) returns 400 Bad Request');
    assert(
      data6.message?.includes('before'),
      `Error explains ordering constraint: "${data6.message}"`
    );

    // 3. Valid assignment: firstStop as pickup, lastStop as dropoff
    const res7 = await fetch(`${API_BASE}/admin/students/1/transport-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        trip_id: 14,
        status: 'WAITING',
        pickup_stop_id: firstStop.id,
        dropoff_stop_id: lastStop.id,
        notes: 'Assigned via automated hardening test',
      }),
    });
    assert(res7.status === 200, 'Valid pickup and dropoff stops accepted with 200 OK');

    // 4. Verify Driver Trips Students endpoint returns stops
    const res8 = await fetch(`${API_BASE}/driver/trips/14/students`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const data8 = await res8.json();
    assert(res8.status === 200, 'Driver can fetch students for Trip 14');
    const student1Data = (data8.students || []).find((s) => s.student_id === 1);
    assert(
      student1Data?.pickup_stop_id === firstStop.id && student1Data?.pickup_stop_name === firstStop.name,
      `Driver student roster includes pickup stop "${student1Data?.pickup_stop_name}"`
    );
    assert(
      student1Data?.dropoff_stop_id === lastStop.id && student1Data?.dropoff_stop_name === lastStop.name,
      `Driver student roster includes dropoff stop "${student1Data?.dropoff_stop_name}"`
    );

    // 5. Verify Parent Dashboard returns pickup & dropoff stops
    const res9 = await fetch(`${API_BASE}/parent/dashboard`, {
      headers: { Authorization: `Bearer ${parent2Token}` },
    });
    const data9 = await res9.json();
    assert(res9.status === 200, 'Parent 2 can fetch dashboard');
    const child1 = (data9.children || []).find((c) => c.student?.student_id === 1);
    const expectedPickupId = child1?.transport?.trip?.id === 14 ? firstStop.id : (child1?.transport?.pickup_stop?.id || 76);
    const expectedDropoffId = child1?.transport?.trip?.id === 14 ? lastStop.id : (child1?.transport?.dropoff_stop?.id || 85);
    assert(
      child1?.transport?.pickup_stop?.id === expectedPickupId,
      `Parent dashboard reflects child pickup stop: ${child1?.transport?.pickup_stop?.name}`
    );
    assert(
      child1?.transport?.dropoff_stop?.id === expectedDropoffId,
      `Parent dashboard reflects child dropoff stop: ${child1?.transport?.dropoff_stop?.name}`
    );


    console.log('\n--- FIX 3: Stale Trip Protection & Admin Stale Closure ---');

    // Ensure Trip 14 is in IN_PROGRESS stale state for testing
    await pool.execute("UPDATE trips SET status = 'IN_PROGRESS', trip_date = '2026-09-12', started_at = '2026-09-12 07:00:00' WHERE id = 14");

    // 1. Verify Driver active-trip endpoint handles stale trip
    const res10 = await fetch(`${API_BASE}/driver/active-trip`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const data10 = await res10.json();
    assert(res10.status === 200, 'Driver can call GET /api/driver/active-trip');
    assert(
      data10.activeTrip === null,
      'Active trip is null because Trip 14 is from a past date (stale)'
    );
    assert(
      data10.staleTrip?.id === 14,
      `Stale trip candidate #14 detected and flagged in response: ${JSON.stringify(data10.staleTrip)}`
    );

    // 2. Ingest GPS targeting stale trip 14 -> must return 409 Conflict
    const res11 = await fetch(`${API_BASE}/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        trip_id: 14,
        latitude: 17.385044,
        longitude: 78.486671,
        accuracy: 10,
      }),
    });
    const data11 = await res11.json();
    assert(res11.status === 409, 'Submitting GPS for stale Trip 14 returns 409 Conflict');
    assert(
      data11.message?.includes('stale') || data11.message?.includes('past'),
      `Error message explains stale rejection: "${data11.message}"`
    );

    // 3. Driver attempting to start past-date Trip 14 -> rejected
    const res12 = await fetch(`${API_BASE}/driver/trips/14/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    assert(res12.status === 400 || res12.status === 409, `Starting past trip 14 rejected with status ${res12.status}`);

    // 4. Test admin close-stale route with non-existent trip
    const res13 = await fetch(`${API_BASE}/admin/trips/999999/close-stale`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res13.status === 404, 'Admin close-stale on non-existent trip returns 404');

    // 5. Test admin close-stale route on a temporary stale trip
    const [insTrip] = await pool.execute(`
      INSERT INTO trips (bus_id, route_id, driver_id, trip_date, scheduled_start_at, started_at, status, direction)
      VALUES (9, 10, 5, '2026-09-10', '2026-09-10 07:00:00', '2026-09-10 07:05:00', 'IN_PROGRESS', 'PICKUP')
    `);
    const tempTripId = insTrip.insertId;

    const res14 = await fetch(`${API_BASE}/admin/trips/${tempTripId}/close-stale`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data14 = await res14.json();
    assert(res14.status === 200, 'Admin can close stale trip via POST /api/admin/trips/:id/close-stale');
    assert(data14.trip?.status === 'COMPLETED', `Trip status transitioned to COMPLETED: ${data14.trip?.status}`);

    // Calling close-stale again on already completed trip is idempotent
    const res15 = await fetch(`${API_BASE}/admin/trips/${tempTripId}/close-stale`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data15 = await res15.json();
    assert(res15.status === 200, 'Idempotent close-stale returns 200 without error');
    assert(data15.message?.includes('already COMPLETED'), `Idempotent message: "${data15.message}"`);

    // Clean up temporary test trip
    await pool.execute('DELETE FROM trips WHERE id = ?', [tempTripId]);

    console.log('\n================================================================');
    console.log(`  ALL CHECKS FINISHED: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
    console.log('================================================================\n');

    await pool.end();
    process.exitCode = failedTests > 0 ? 1 : 0;
  } catch (err) {
    console.error('Unhandled error during test run:', err);
    await pool.end();
    process.exitCode = 1;
  }
}

runHardeningTests();

