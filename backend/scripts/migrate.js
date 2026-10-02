import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(currentDirectory, '../database/schema.sql');
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
});

async function createStudentDependentTables() {
  const [primaryKey] = await connection.execute(
    `SELECT column_name, column_type
     FROM information_schema.columns
     WHERE table_schema = ? AND table_name = 'students' AND column_key = 'PRI'
     ORDER BY ordinal_position
     LIMIT 1`,
    [process.env.DB_NAME || 'school_bus_portal']
  );

  const studentKey = primaryKey[0];
  if (!studentKey || !['id', 'student_id'].includes(studentKey.COLUMN_NAME)) {
    throw new Error('The students table must have either id or student_id as its primary key.');
  }

  const referencedColumn = studentKey.COLUMN_NAME;
  const studentIdType = studentKey.COLUMN_TYPE;

  await connection.query(`
    CREATE TABLE IF NOT EXISTS student_transport_status (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      trip_id BIGINT UNSIGNED NOT NULL,
      student_id ${studentIdType} NOT NULL,
      status ENUM('WAITING', 'BOARDED', 'ON_BUS', 'DROPPED_OFF', 'ABSENT') NOT NULL DEFAULT 'WAITING',
      recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      recorded_by_user_id BIGINT UNSIGNED NULL,
      notes VARCHAR(500) NULL,
      UNIQUE KEY uq_student_trip (trip_id, student_id),
      INDEX idx_transport_status_trip (trip_id, status),
      CONSTRAINT fk_transport_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
      CONSTRAINT fk_transport_student FOREIGN KEY (student_id) REFERENCES students(${referencedColumn}) ON DELETE CASCADE,
      CONSTRAINT fk_transport_recorder FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(150) NOT NULL,
      body TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      trip_id BIGINT UNSIGNED NULL,
      student_id ${studentIdType} NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      sent_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notifications_user_read (user_id, is_read, created_at DESC),
      CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_notifications_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
      CONSTRAINT fk_notifications_student FOREIGN KEY (student_id) REFERENCES students(${referencedColumn}) ON DELETE SET NULL
    )
  `);
}

try {
  await connection.query(await fs.readFile(schemaPath, 'utf8'));
  await createStudentDependentTables();
  console.log('Database schema applied successfully.');
} finally {
  await connection.end();
}
