import mysql from 'mysql2/promise';

async function reset() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'school_bus_portal',
  });
  await conn.execute("UPDATE trips SET status = 'SCHEDULED', started_at = NULL, completed_at = NULL WHERE id = 61");
  await conn.execute('DELETE FROM notifications WHERE trip_id = 61');
  await conn.execute("DELETE FROM bus_locations WHERE bus_id = 39 AND recorded_at >= '2026-09-29'");
  await conn.execute("UPDATE student_transport_status SET status = 'WAITING' WHERE trip_id = 61 AND student_id = 1");
  console.log('Trip 61 and associated test records reset to SCHEDULED state.');
  await conn.end();
}

reset().catch(console.error);
