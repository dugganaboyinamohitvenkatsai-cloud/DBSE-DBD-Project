import 'dotenv/config';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

try {
  const [tables] = await connection.execute(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = ?
       AND table_name IN ('users', 'parents', 'students', 'drivers', 'buses', 'routes', 'stops', 'trips', 'student_transport_status', 'bus_locations', 'notifications', 'device_tokens')
     ORDER BY table_name`,
    [process.env.DB_NAME]
  );
  const [allTables] = await connection.execute(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = ?
     ORDER BY table_name`,
    [process.env.DB_NAME]
  );
  const [columns] = await connection.execute(
    `SELECT table_name, column_name, column_type, is_nullable, column_key, column_default, extra
     FROM information_schema.columns
     WHERE table_schema = ?
       AND table_name IN ('users', 'parents', 'students', 'drivers', 'buses', 'routes', 'stops', 'trips', 'student_transport_status', 'bus_locations', 'notifications', 'device_tokens')
     ORDER BY table_name, ordinal_position`,
    [process.env.DB_NAME]
  );
  const [constraints] = await connection.execute(
    `SELECT table_name, constraint_name, column_name, referenced_table_name, referenced_column_name
     FROM information_schema.key_column_usage
     WHERE table_schema = ?
       AND (table_name IN ('users', 'parents', 'students', 'drivers', 'buses', 'routes', 'stops', 'trips', 'student_transport_status', 'bus_locations', 'notifications', 'device_tokens')
         OR referenced_table_name IN ('users', 'parents', 'students', 'drivers', 'buses', 'routes', 'stops', 'trips'))
     ORDER BY table_name, constraint_name, ordinal_position`,
    [process.env.DB_NAME]
  );
  console.log(JSON.stringify({ tables, allTables, columns, constraints }, null, 2));
} finally {
  await connection.end();
}
