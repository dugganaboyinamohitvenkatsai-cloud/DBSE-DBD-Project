import { pool } from '../src/config/database.js';

const [drivers] = await pool.execute(
  'SELECT d.id as driver_id, d.user_id, d.employee_code, u.id as uid, u.email, u.role FROM drivers d JOIN users u ON u.id = d.user_id'
);
console.log('Drivers:');
drivers.forEach(d => console.log(`  driver_id=${d.driver_id}, user_id=${d.user_id}, code=${d.employee_code}, email=${d.email}`));

const [trips] = await pool.execute(
  "SELECT id, driver_id, status, bus_id, route_id FROM trips WHERE status IN ('STARTED','IN_PROGRESS')"
);
console.log('\nActive trips:', JSON.stringify(trips, null, 2));

process.exit(0);
