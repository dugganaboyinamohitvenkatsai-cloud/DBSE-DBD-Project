-- ==============================================================================
-- School Bus Tracking & Student Safety Portal - Complete Relational Database Schema
-- Database Engine: MySQL 8.0 Community Server / Storage Engine: InnoDB
-- Charset: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS school_bus_portal
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE school_bus_portal;

-- ------------------------------------------------------------------------------
-- 1. Table: users (Identity, authentication, and RBAC accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'PARENT', 'DRIVER') NOT NULL,
  phone VARCHAR(25) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 2. Table: parents (Guardian profiles and emergency contacts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  address TEXT NULL,
  emergency_contact_name VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(25) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_parents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 3. Table: drivers (Commercial bus driver records and license governance)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  license_number VARCHAR(80) NOT NULL UNIQUE,
  license_expiry DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_drivers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 4. Table: buses (Physical fleet vehicle inventory and capacities)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS buses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bus_number VARCHAR(40) NOT NULL UNIQUE,
  registration_number VARCHAR(40) NOT NULL UNIQUE,
  capacity SMALLINT UNSIGNED NOT NULL,
  assigned_driver_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_buses_driver FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 5. Table: routes (Geographic transit corridors and corridors)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  route_code VARCHAR(40) NOT NULL UNIQUE,
  description TEXT NULL,
  estimated_duration_minutes SMALLINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 6. Table: stops (Ordered geographic waypoints along a transit route)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stops (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  stop_order SMALLINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  scheduled_time TIME NULL,
  google_maps_url VARCHAR(500) NULL,
  UNIQUE KEY uq_stop_route_order (route_id, stop_order),
  CONSTRAINT fk_stops_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 7. Table: students (Enrolled pupils receiving transportation services)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admission_number VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(120) NOT NULL,
  grade VARCHAR(40) NOT NULL,
  section VARCHAR(20) NULL,
  date_of_birth DATE NULL,
  parent_id BIGINT UNSIGNED NOT NULL,
  route_id BIGINT UNSIGNED NULL,
  stop_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_students_parent FOREIGN KEY (parent_id) REFERENCES parents(id),
  CONSTRAINT fk_students_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL,
  CONSTRAINT fk_students_stop FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 8. Table: parent_students (Verified multi-guardian to student junction)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parent_students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  relationship_type ENUM('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER') NOT NULL DEFAULT 'GUARDIAN',
  is_primary_contact BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_parent_student (parent_id, student_id),
  INDEX idx_ps_parent (parent_id),
  INDEX idx_ps_student (student_id),
  CONSTRAINT fk_ps_parent FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 9. Table: trips (Scheduled bus transit runs linking driver, bus, and route)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bus_id BIGINT UNSIGNED NOT NULL,
  route_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED NOT NULL,
  trip_date DATE NOT NULL,
  direction ENUM('PICKUP', 'DROPOFF') NOT NULL,
  scheduled_start_at DATETIME NOT NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  status ENUM('SCHEDULED', 'STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trips_date_status (trip_date, status),
  CONSTRAINT fk_trips_bus FOREIGN KEY (bus_id) REFERENCES buses(id),
  CONSTRAINT fk_trips_route FOREIGN KEY (route_id) REFERENCES routes(id),
  CONSTRAINT fk_trips_driver FOREIGN KEY (driver_id) REFERENCES drivers(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 10. Table: student_transport_status (Roster attendance and custody transitions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_transport_status (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  status ENUM('WAITING', 'BOARDED', 'ON_BUS', 'DROPPED_OFF', 'ABSENT') NOT NULL DEFAULT 'WAITING',
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by_user_id BIGINT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  UNIQUE KEY uq_student_trip (trip_id, student_id),
  INDEX idx_transport_status_trip (trip_id, status),
  CONSTRAINT fk_transport_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_transport_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_transport_recorder FOREIGN KEY (recorded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 11. Table: bus_locations (High-frequency GPS telemetry stream from driver app)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bus_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bus_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  speed DECIMAL(6,2) DEFAULT 0.00,
  heading DECIMAL(5,2) DEFAULT 0.00,
  recorded_at DATETIME NOT NULL,
  source ENUM('GPS_DEVICE', 'DRIVER_APP', 'DEMO') NOT NULL,
  accuracy_meters DECIMAL(8,2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bus_location_latest (bus_id, recorded_at DESC),
  CONSTRAINT fk_locations_bus FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 12. Table: seat_assignments (Prevents duplicate seat and student assignments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seat_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT UNSIGNED NOT NULL,
  bus_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  seat_number VARCHAR(10) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_trip_seat (trip_id, seat_number),
  UNIQUE KEY uq_trip_student (trip_id, student_id),
  KEY idx_trip_id (trip_id),
  KEY idx_bus_id (bus_id),
  KEY idx_student_id (student_id),
  CONSTRAINT fk_seat_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  CONSTRAINT fk_seat_bus FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE,
  CONSTRAINT fk_seat_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 13. Table: notifications (Persistent parent alert log and in-app inbox)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  trip_id BIGINT UNSIGNED NULL,
  student_id BIGINT UNSIGNED NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_user_read (user_id, is_read, created_at DESC),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------------------------
-- 14. Table: device_tokens (FCM multicast mobile device push registration tokens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(512) NOT NULL UNIQUE,
  platform VARCHAR(30) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_device_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
