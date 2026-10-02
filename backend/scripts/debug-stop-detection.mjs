import { pool } from '../src/config/database.js';
import { createAccessToken } from '../src/utils/token.js';

const API_BASE = 'http://localhost:5000/api';

try {
  // Get Mahesh's user and driver info
  const [driverUser] = await pool.execute("SELECT * FROM users WHERE role = 'DRIVER' AND id = 7 LIMIT 1");
  console.log('Mahesh user:', JSON.stringify(driverUser[0]));
  const driverToken = createAccessToken(driverUser[0]);

  const [maheshRows] = await pool.execute('SELECT id FROM drivers WHERE user_id = ?', [driverUser[0].id]);
  const maheshDriverProfileId = maheshRows[0]?.id;
  console.log('Mahesh driver profile id:', maheshDriverProfileId);

  // Create test route + stops
  const [routeRes] = await pool.execute(
    "INSERT INTO routes (name, route_code, description, estimated_duration_minutes, is_active) VALUES ('Debug Route', 'DBG-01', 'Debug', 30, 1)"
  );
  const routeId = routeRes.insertId;

  const [s1] = await pool.execute(
    "INSERT INTO stops (route_id, name, stop_order, latitude, longitude, scheduled_time) VALUES (?, 'Debug Stop 1', 1, 17.4699000, 78.3578000, '08:00:00')",
    [routeId]
  );

  const [tBus] = await pool.execute(
    `INSERT INTO buses (bus_number, registration_number, capacity, assigned_driver_id, is_active) VALUES ('BUS-DBG', 'TS 00 DBG 0000', 40, ?, 1)`,
    [maheshDriverProfileId]
  );
  const busId = tBus.insertId;

  const [tTrip] = await pool.execute(
    `INSERT INTO trips (bus_id, route_id, driver_id, trip_date, direction, scheduled_start_at, started_at, status)
     VALUES (?, ?, ?, CURDATE(), 'PICKUP', NOW(), NOW(), 'IN_PROGRESS')`,
    [busId, routeId, maheshDriverProfileId]
  );
  const tripId = tTrip.insertId;
  console.log('Created test trip:', tripId, 'for driver profile', maheshDriverProfileId);

  // Check active trips for Mahesh
  const [activeTrips] = await pool.execute(
    "SELECT id, driver_id, status FROM trips WHERE driver_id = ? AND status IN ('STARTED','IN_PROGRESS')",
    [maheshDriverProfileId]
  );
  console.log('Mahesh active trips:', JSON.stringify(activeTrips));

  // Send GPS near Stop 1
  const res = await fetch(`${API_BASE}/driver/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${driverToken}` },
    body: JSON.stringify({ latitude: 17.4699100, longitude: 78.3578100, accuracy: 15 }),
  });
  const data = await res.json();
  console.log('GPS response status:', res.status);
  console.log('stop_event:', JSON.stringify(data.stop_event));
  console.log('trip_id in response:', data.location?.trip_id);
  console.log('Full response:', JSON.stringify(data, null, 2));

  // Cleanup
  await pool.execute('DELETE FROM notifications WHERE trip_id = ?', [tripId]);
  await pool.execute('DELETE FROM bus_locations WHERE bus_id = ?', [busId]);
  await pool.execute('DELETE FROM trips WHERE id = ?', [tripId]);
  await pool.execute('DELETE FROM buses WHERE id = ?', [busId]);
  await pool.execute('DELETE FROM stops WHERE route_id = ?', [routeId]);
  await pool.execute('DELETE FROM routes WHERE id = ?', [routeId]);
  console.log('Cleaned up.');
} catch (e) {
  console.error(e);
}
process.exit(0);
