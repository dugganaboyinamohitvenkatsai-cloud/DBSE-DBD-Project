import { pool } from '../src/config/database.js';

async function migrate() {
  console.log('--- Migrating student_transport_status to add pickup_stop_id and dropoff_stop_id ---');

  const [columns] = await pool.execute("DESCRIBE student_transport_status");
  const columnNames = columns.map(c => c.Field);

  if (!columnNames.includes('pickup_stop_id')) {
    console.log('Adding pickup_stop_id column...');
    await pool.execute(`
      ALTER TABLE student_transport_status
      ADD COLUMN pickup_stop_id BIGINT UNSIGNED NULL AFTER student_id,
      ADD CONSTRAINT fk_transport_pickup_stop
        FOREIGN KEY (pickup_stop_id) REFERENCES stops(id) ON DELETE SET NULL
    `);
    console.log('pickup_stop_id added successfully.');
  } else {
    console.log('pickup_stop_id column already exists.');
  }

  if (!columnNames.includes('dropoff_stop_id')) {
    console.log('Adding dropoff_stop_id column...');
    await pool.execute(`
      ALTER TABLE student_transport_status
      ADD COLUMN dropoff_stop_id BIGINT UNSIGNED NULL AFTER pickup_stop_id,
      ADD CONSTRAINT fk_transport_dropoff_stop
        FOREIGN KEY (dropoff_stop_id) REFERENCES stops(id) ON DELETE SET NULL
    `);
    console.log('dropoff_stop_id added successfully.');
  } else {
    console.log('dropoff_stop_id column already exists.');
  }

  console.log('Migration completed successfully.');
  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
