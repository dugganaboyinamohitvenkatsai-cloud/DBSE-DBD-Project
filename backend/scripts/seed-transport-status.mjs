import { pool } from "../src/config/database.js";

async function run() {
  await pool.execute(`
    INSERT IGNORE INTO student_transport_status (trip_id, student_id, status, recorded_at, notes)
    VALUES (14, 1, 'BOARDED', NOW(), 'Morning pickup route')
  `);
  const [rows] = await pool.execute("SELECT * FROM student_transport_status");
  console.log("STS ROWS:", rows);
  process.exit(0);
}
run().catch(console.error);
