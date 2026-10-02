import { pool } from '../src/config/database.js';

async function inspect() {
  try {
    const [cols] = await pool.query('DESCRIBE bus_locations');
    console.log('=== bus_locations schema ===');
    console.log(JSON.stringify(cols, null, 2));

    const [idx] = await pool.query('SHOW INDEX FROM bus_locations');
    console.log('\n=== bus_locations indexes ===');
    console.log(JSON.stringify(idx, null, 2));

    const fkSql = `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA='school_bus_portal' AND TABLE_NAME='bus_locations' AND REFERENCED_TABLE_NAME IS NOT NULL`;
    const [fk] = await pool.query(fkSql);
    console.log('\n=== bus_locations foreign keys ===');
    console.log(JSON.stringify(fk, null, 2));

    const [cnt] = await pool.query('SELECT count(*) as c FROM bus_locations');
    console.log('\n=== bus_locations row count ===');
    console.log(cnt[0].c);

    const [create] = await pool.query('SHOW CREATE TABLE bus_locations');
    console.log('\n=== FULL CREATE TABLE ===');
    console.log(create[0]['Create Table']);

    // Check if any other table references bus_locations
    const refSql = `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA='school_bus_portal' AND REFERENCED_TABLE_NAME='bus_locations'`;
    const [refs] = await pool.query(refSql);
    console.log('\n=== Tables referencing bus_locations ===');
    console.log(JSON.stringify(refs, null, 2));

    // Check existing rows
    const [rows] = await pool.query('SELECT * FROM bus_locations LIMIT 10');
    console.log('\n=== Existing rows (up to 10) ===');
    console.log(JSON.stringify(rows, null, 2));

    // Also check trips schema for reference
    const [tripCols] = await pool.query('DESCRIBE trips');
    console.log('\n=== trips schema ===');
    console.log(JSON.stringify(tripCols, null, 2));

    // Check all tables in the database
    const [tables] = await pool.query("SHOW TABLES");
    console.log('\n=== All tables ===');
    console.log(tables.map(t => Object.values(t)[0]));

  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

inspect();
