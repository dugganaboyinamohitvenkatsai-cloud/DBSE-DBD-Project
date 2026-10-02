import { pool } from '../src/config/database.js';

async function migrate() {
  console.log('--- Migrating stops table to add google_maps_url ---');

  const [columns] = await pool.execute('DESCRIBE stops');
  const columnNames = columns.map(c => c.Field);

  if (!columnNames.includes('google_maps_url')) {
    console.log('Adding google_maps_url column...');
    await pool.execute(`
      ALTER TABLE stops
      ADD COLUMN google_maps_url VARCHAR(500) NULL AFTER scheduled_time
    `);
    console.log('google_maps_url column added successfully.');
  } else {
    console.log('google_maps_url column already exists.');
  }

  console.log('Migration completed successfully.');
  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
