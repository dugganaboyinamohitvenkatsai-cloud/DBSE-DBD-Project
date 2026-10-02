import { pool } from '../src/config/database.js';

async function inspect() {
  console.log('=== DRIVERS SCHEMA ===');
  const [cols] = await pool.execute('DESCRIBE drivers');
  console.table(cols);

  console.log('=== USERS & DRIVERS RECORDS ===');
  const [users] = await pool.execute(
    `SELECT u.id as user_id, u.full_name, u.email, u.role, u.is_active, 
            d.id as driver_id, d.license_number
     FROM users u 
     LEFT JOIN drivers d ON d.user_id = u.id 
     WHERE u.role = 'DRIVER' OR u.full_name LIKE '%Rajesh%' OR u.full_name LIKE '%Ramu%'`
  );
  console.table(users);

  console.log('\n=== ALL DRIVER RECORDS IN drivers TABLE ===');
  const [drivers] = await pool.execute('SELECT * FROM drivers');
  console.table(drivers);

  console.log('\n=== RECENT TRIPS WITH DRIVER ASSIGNMENTS ===');
  const [trips] = await pool.execute(
    `SELECT t.id as trip_id, t.bus_id, t.route_id, t.driver_id, t.trip_date, 
            t.direction, t.status, t.scheduled_start_at, t.started_at, t.completed_at,
            r.name as route_name, b.bus_number, b.registration_number
     FROM trips t
     LEFT JOIN routes r ON r.id = t.route_id
     LEFT JOIN buses b ON b.id = t.bus_id
     ORDER BY t.id DESC LIMIT 15`
  );
  console.table(trips);

  console.log('\n=== BUS TABLE ===');
  const [buses] = await pool.execute('SELECT * FROM buses LIMIT 10');
  console.table(buses);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
