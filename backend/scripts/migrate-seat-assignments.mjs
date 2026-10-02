import { pool } from '../src/config/database.js';

async function migrate() {
  console.log('Running seat_assignments migration...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seat_assignments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      trip_id BIGINT UNSIGNED NOT NULL,
      bus_id BIGINT UNSIGNED NOT NULL,
      student_id INT NOT NULL,
      seat_number VARCHAR(10) NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_trip_seat (trip_id, seat_number),
      UNIQUE KEY uq_trip_student (trip_id, student_id),
      KEY idx_trip_id (trip_id),
      KEY idx_bus_id (bus_id),
      KEY idx_student_id (student_id),
      CONSTRAINT fk_seat_trip FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      CONSTRAINT fk_seat_bus FOREIGN KEY (bus_id) REFERENCES buses (id) ON DELETE CASCADE,
      CONSTRAINT fk_seat_student FOREIGN KEY (student_id) REFERENCES students (student_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('seat_assignments table created or already exists.');
  const [cols] = await pool.execute('DESCRIBE seat_assignments');
  console.table(cols);

  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
